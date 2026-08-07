import { NextRequest } from 'next/server';
import { z } from 'zod';
import { actorOrResponse, mutationAllowed, optionalActor } from '@/lib/api-auth';
import { jsonData, jsonError } from '@/lib/api-errors';
import { effectiveOrganizationRole, getActiveActor, organizationRoleAllows } from '@/lib/authorization';
import { writeAudit } from '@/lib/audit';
import { requireConfirmation } from '@/lib/admin-auth';

export const runtime = 'nodejs';
type Params = { params: Promise<{ slug: string }> };
const memberSchema = z.object({ username: z.string().trim().min(1).max(80), role: z.enum(['admin', 'maintainer', 'member', 'viewer']) });

export async function GET(request: NextRequest, { params }: Params) {
  const { slug } = await params;
  const auth = await optionalActor(request);
  if ('response' in auth) return auth.response;
  const organization = await auth.db.organization.findUnique({ where: { slug }, include: { owner: true, members: { include: { account: true } } } });
  if (!organization || organization.archivedAt) return jsonError('NOT_FOUND', '组织不存在。', 404, request);
  const actor = getActiveActor(auth.actor);
  const isMember = Boolean(actor && effectiveOrganizationRole(actor, organization));
  if (organization.visibility === 'PRIVATE' && !isMember && !actor?.siteRoles.includes('ADMIN')) return jsonError('NOT_FOUND', '组织不存在。', 404, request);
  const members = organization.members.map((member) => ({ id: member.account.id, username: member.account.username, name: member.account.displayName, avatarUrl: member.account.avatarUrl, role: member.role.toLowerCase() }));
  if (!members.some((member) => member.id === organization.owner.id)) members.unshift({ id: organization.owner.id, username: organization.owner.username, name: organization.owner.displayName, avatarUrl: organization.owner.avatarUrl, role: 'owner' });
  return jsonData(members, request);
}

export async function POST(request: NextRequest, { params }: Params) {
  const csrfError = mutationAllowed(request);
  if (csrfError) return csrfError;
  const { slug } = await params;
  const auth = await actorOrResponse(request);
  if ('response' in auth) return auth.response;
  const organization = await auth.db.organization.findUnique({ where: { slug }, include: { members: true } });
  if (!organization || organization.archivedAt) return jsonError('NOT_FOUND', '组织不存在。', 404, request);
  const managerRole = effectiveOrganizationRole(auth.actor, organization);
  if (!managerRole || !organizationRoleAllows(managerRole, 'manage')) return jsonError('FORBIDDEN', '没有管理组织成员的权限。', 403, request);
  let input: z.infer<typeof memberSchema>;
  try { input = memberSchema.parse(await request.json()); } catch { return jsonError('VALIDATION_ERROR', '成员邀请数据无效。', 422, request); }
  const recipient = await auth.db.account.findUnique({ where: { username: input.username } });
  if (!recipient || recipient.status !== 'ACTIVE') return jsonError('NOT_FOUND', '目标账号不存在。', 404, request);
  if (organization.members.some((member) => member.accountId === recipient.id)) return jsonError('CONFLICT', '该账号已经是组织成员。', 409, request);
  const pending = await auth.db.organizationInvitation.findFirst({ where: { organizationId: organization.id, recipientId: recipient.id, status: 'PENDING', expiresAt: { gt: new Date() } }, select: { id: true } });
  if (pending) return jsonError('CONFLICT', '该账号已有待处理邀请。', 409, request);
  let invitation;
  try {
    invitation = await auth.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Organization" WHERE "id" = ${organization.id} FOR UPDATE`;
      const [existingMember, existingInvitation] = await Promise.all([
        tx.organizationMember.findUnique({ where: { organizationId_accountId: { organizationId: organization.id, accountId: recipient.id } }, select: { id: true } }),
        tx.organizationInvitation.findFirst({ where: { organizationId: organization.id, recipientId: recipient.id, status: 'PENDING', expiresAt: { gt: new Date() } }, select: { id: true } })
      ]);
      if (existingMember) throw new Error('organization_member_exists');
      if (existingInvitation) throw new Error('organization_invitation_exists');
      const created = await tx.organizationInvitation.create({ data: { organizationId: organization.id, recipientId: recipient.id, invitedById: auth.actor.id, role: input.role.toUpperCase() as 'ADMIN' | 'MAINTAINER' | 'MEMBER' | 'VIEWER', expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) } });
      await tx.notification.create({ data: { accountId: recipient.id, type: 'organization.invitation', payload: { invitationId: created.id, organizationId: organization.id, organizationSlug: organization.slug, role: input.role } } });
      await writeAudit(tx, request, { actorId: auth.actor.id, action: 'organization.invitation.create', resourceType: 'organization', resourceId: organization.id, after: { recipientId: recipient.id, role: input.role } });
      return created;
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'organization_member_exists') return jsonError('CONFLICT', '该账号已经是组织成员。', 409, request);
    if (error instanceof Error && error.message === 'organization_invitation_exists') return jsonError('CONFLICT', '该账号已有待处理邀请。', 409, request);
    return jsonError('INTERNAL_ERROR', error instanceof Error ? error.message : '组织邀请保存失败。', 503, request);
  }
  return jsonData({ id: invitation.id, status: invitation.status.toLowerCase(), expiresAt: invitation.expiresAt.toISOString() }, request);
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const csrfError = mutationAllowed(request);
  if (csrfError) return csrfError;
  const { slug } = await params;
  const auth = await actorOrResponse(request);
  if ('response' in auth) return auth.response;
  const organization = await auth.db.organization.findUnique({ where: { slug }, include: { members: true } });
  if (!organization || organization.archivedAt) return jsonError('NOT_FOUND', '组织不存在。', 404, request);
  const managerRole = effectiveOrganizationRole(auth.actor, organization);
  if (!managerRole || !organizationRoleAllows(managerRole, 'manage')) return jsonError('FORBIDDEN', '没有管理组织成员的权限。', 403, request);
  let input: z.infer<typeof memberSchema>;
  try { input = memberSchema.parse(await request.json()); } catch { return jsonError('VALIDATION_ERROR', '成员数据无效。', 422, request); }
  const recipient = await auth.db.account.findUnique({ where: { username: input.username } });
  const member = recipient ? organization.members.find((item) => item.accountId === recipient.id) : null;
  if (!member || member.role === 'OWNER') return jsonError('NOT_FOUND', '成员不存在或不能修改 Owner。', 404, request);
  const confirmationError = await requireConfirmation(request, auth.db, auth.actor.id, { action: 'organization.member.role.update', resourceType: 'organization', resourceId: `${organization.id}:${member.accountId}` });
  if (confirmationError) return confirmationError;
  const updated = await auth.db.organizationMember.update({ where: { id: member.id }, data: { role: input.role.toUpperCase() as 'ADMIN' | 'MAINTAINER' | 'MEMBER' | 'VIEWER' } });
  await writeAudit(auth.db, request, { actorId: auth.actor.id, action: 'organization.member.role.update', resourceType: 'organization', resourceId: organization.id, before: { accountId: member.accountId, role: member.role }, after: { accountId: member.accountId, role: updated.role } });
  return jsonData(updated, request);
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const csrfError = mutationAllowed(request);
  if (csrfError) return csrfError;
  const { slug } = await params;
  const username = request.nextUrl.searchParams.get('username')?.trim();
  const auth = await actorOrResponse(request);
  if ('response' in auth) return auth.response;
  const organization = await auth.db.organization.findUnique({ where: { slug }, include: { members: true } });
  if (!organization || organization.archivedAt) return jsonError('NOT_FOUND', '组织不存在。', 404, request);
  const managerRole = effectiveOrganizationRole(auth.actor, organization);
  if (!managerRole || !organizationRoleAllows(managerRole, 'manage')) return jsonError('FORBIDDEN', '没有管理组织成员的权限。', 403, request);
  const account = username ? await auth.db.account.findUnique({ where: { username } }) : null;
  const member = account ? organization.members.find((item) => item.accountId === account.id) : null;
  if (!member || member.role === 'OWNER') return jsonError('NOT_FOUND', '成员不存在或不能移除 Owner。', 404, request);
  const confirmationError = await requireConfirmation(request, auth.db, auth.actor.id, { action: 'organization.member.remove', resourceType: 'organization', resourceId: `${organization.id}:${member.accountId}` });
  if (confirmationError) return confirmationError;
  await auth.db.organizationMember.delete({ where: { id: member.id } });
  await writeAudit(auth.db, request, { actorId: auth.actor.id, action: 'organization.member.remove', resourceType: 'organization', resourceId: organization.id, before: { accountId: member.accountId, role: member.role } });
  return jsonData({ removed: true }, request);
}
