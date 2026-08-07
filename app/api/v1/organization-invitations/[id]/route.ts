import { NextRequest } from 'next/server';
import { actorOrResponse, mutationAllowed } from '@/lib/api-auth';
import { jsonData, jsonError } from '@/lib/api-errors';
import { effectiveOrganizationRole, organizationRoleAllows } from '@/lib/authorization';
import { writeAudit } from '@/lib/audit';

export const runtime = 'nodejs';
type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const csrfError = mutationAllowed(request);
  if (csrfError) return csrfError;
  const { id } = await params;
  const auth = await actorOrResponse(request);
  if ('response' in auth) return auth.response;
  const requestedAction = request.nextUrl.searchParams.get('action');
  if (requestedAction !== 'accept' && requestedAction !== 'decline') return jsonError('VALIDATION_ERROR', '邀请操作无效。', 422, request);
  const action = requestedAction === 'decline' ? 'DECLINED' : 'ACCEPTED';
  let result: { organizationId: string; status: 'ACCEPTED' | 'DECLINED' | 'EXPIRED' };
  try {
    result = await auth.db.$transaction(async (tx) => {
      // Serialize accept/decline/revoke requests on the invitation row. A
      // plain read followed by an update could otherwise let a declined
      // invitation create a membership after a concurrent accept.
      await tx.$queryRaw`SELECT "id" FROM "OrganizationInvitation" WHERE "id" = ${id} FOR UPDATE`;
      const invitation = await tx.organizationInvitation.findUnique({ where: { id }, include: { organization: true } });
      if (!invitation || invitation.recipientId !== auth.actor.id || invitation.status !== 'PENDING') throw new Error('invitation_not_pending');
      const now = new Date();
      if (invitation.organization.archivedAt) throw new Error('organization_archived');
      if (invitation.expiresAt <= now) {
        await tx.organizationInvitation.update({ where: { id }, data: { status: 'EXPIRED', respondedAt: now } });
        return { organizationId: invitation.organizationId, status: 'EXPIRED' as const };
      }
      if (action === 'ACCEPTED') {
        await tx.organizationMember.upsert({ where: { organizationId_accountId: { organizationId: invitation.organizationId, accountId: auth.actor.id } }, create: { organizationId: invitation.organizationId, accountId: auth.actor.id, role: invitation.role }, update: {} });
      }
      await tx.organizationInvitation.update({ where: { id }, data: { status: action, respondedAt: now } });
      return { organizationId: invitation.organizationId, status: action };
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'invitation_not_pending') return jsonError('NOT_FOUND', '邀请不存在或已处理。', 404, request);
    if (error instanceof Error && error.message === 'organization_archived') return jsonError('CONFLICT', '组织已归档。', 409, request);
    throw error;
  }
  if (result.status === 'EXPIRED') return jsonError('CONFLICT', '邀请已过期。', 409, request);
  await writeAudit(auth.db, request, { actorId: auth.actor.id, action: `organization.invitation.${result.status.toLowerCase()}`, resourceType: 'organization', resourceId: result.organizationId, after: { invitationId: id, status: result.status } });
  return jsonData({ id, status: result.status.toLowerCase() }, request);
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const csrfError = mutationAllowed(request);
  if (csrfError) return csrfError;
  const { id } = await params;
  const auth = await actorOrResponse(request);
  if ('response' in auth) return auth.response;
  let result: { organizationId: string; status: 'REVOKED' };
  try {
    result = await auth.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "OrganizationInvitation" WHERE "id" = ${id} FOR UPDATE`;
      const invitation = await tx.organizationInvitation.findUnique({ where: { id }, include: { organization: { include: { members: true } } } });
      if (!invitation || invitation.status !== 'PENDING') throw new Error('invitation_not_pending');
      const managerRole = effectiveOrganizationRole(auth.actor, invitation.organization);
      if (invitation.invitedById !== auth.actor.id && (!managerRole || !organizationRoleAllows(managerRole, 'manage'))) throw new Error('invitation_forbidden');
      const updated = await tx.organizationInvitation.updateMany({ where: { id, status: 'PENDING' }, data: { status: 'REVOKED', respondedAt: new Date() } });
      if (!updated.count) throw new Error('invitation_not_pending');
      return { organizationId: invitation.organizationId, status: 'REVOKED' as const };
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'invitation_not_pending') return jsonError('NOT_FOUND', '邀请不存在或已处理。', 404, request);
    if (error instanceof Error && error.message === 'invitation_forbidden') return jsonError('FORBIDDEN', '没有撤回此邀请的权限。', 403, request);
    throw error;
  }
  await writeAudit(auth.db, request, { actorId: auth.actor.id, action: 'organization.invitation.revoke', resourceType: 'organization', resourceId: result.organizationId, before: { status: 'PENDING' }, after: { status: result.status, invitationId: id } });
  return jsonData({ id, status: result.status.toLowerCase() }, request);
}
