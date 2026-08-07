import { NextRequest } from 'next/server';
import { z } from 'zod';
import { actorOrResponse, mutationAllowed } from '@/lib/api-auth';
import { jsonData, jsonError } from '@/lib/api-errors';
import { canProjectPermission, effectiveOrganizationRole, organizationRoleAllows } from '@/lib/authorization';
import { findProject, projectInclude, serializeProject } from '@/lib/project-service';
import { writeAudit } from '@/lib/audit';
import { requireConfirmation } from '@/lib/admin-auth';

export const runtime = 'nodejs';
type Params = { params: Promise<{ id: string }> };
const schema = z.object({ ownerType: z.enum(['personal', 'organization']), ownerId: z.string().trim().min(1).max(120) });

export async function POST(request: NextRequest, { params }: Params) {
  const csrfError = mutationAllowed(request); if (csrfError) return csrfError;
  const { id } = await params; const auth = await actorOrResponse(request); if ('response' in auth) return auth.response;
  const project = await findProject(auth.db, id); if (!project) return jsonError('NOT_FOUND', '项目不存在。', 404, request);
  if (!canProjectPermission(auth.actor, project as never, 'transfer')) return jsonError('FORBIDDEN', '只有项目 Owner 可以转让项目。', 403, request);
  const confirmationError = await requireConfirmation(request, auth.db, auth.actor.id, { action: 'project.transfer', resourceType: 'project', resourceId: project.id });
  if (confirmationError) return confirmationError;
  let input: z.infer<typeof schema>; try { input = schema.parse(await request.json()); } catch { return jsonError('VALIDATION_ERROR', '转让数据无效。', 422, request); }
  if (input.ownerType === 'personal') {
    const target = await auth.db.account.findFirst({ where: { OR: [{ id: input.ownerId }, { username: input.ownerId }], status: 'ACTIVE' } });
    if (!target) return jsonError('NOT_FOUND', '目标账号不存在。', 404, request);
    const updated = await auth.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Project" WHERE "id" = ${project.id} FOR UPDATE`;
      await tx.projectMember.updateMany({ where: { projectId: project.id, accountId: auth.actor.id }, data: { role: 'VIEWER' } });
      await tx.projectMember.upsert({ where: { projectId_accountId: { projectId: project.id, accountId: target.id } }, create: { projectId: project.id, accountId: target.id, role: 'OWNER' }, update: { role: 'OWNER' } });
      return tx.project.update({ where: { id: project.id }, data: { ownerAccountId: target.id, ownerOrganizationId: null }, include: projectInclude });
    });
    await writeAudit(auth.db, request, { actorId: auth.actor.id, action: 'project.transfer', resourceType: 'project', resourceId: project.id, before: { ownerAccountId: auth.actor.id }, after: { ownerAccountId: target.id } });
    return jsonData(serializeProject(updated, { includePrivate: true }), request);
  }
  const organization = await auth.db.organization.findFirst({ where: { OR: [{ id: input.ownerId }, { slug: input.ownerId }], archivedAt: null }, include: { members: true } });
  const organizationRole = organization ? effectiveOrganizationRole(auth.actor, organization) : null;
  if (!organization || !organizationRole || !organizationRoleAllows(organizationRole, 'transfer')) return jsonError('FORBIDDEN', '没有将项目转入该组织的权限。', 403, request);
  const updated = await auth.db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "Project" WHERE "id" = ${project.id} FOR UPDATE`;
    await tx.projectMember.updateMany({ where: { projectId: project.id, accountId: auth.actor.id }, data: { role: 'MAINTAINER' } });
    return tx.project.update({ where: { id: project.id }, data: { ownerAccountId: null, ownerOrganizationId: organization.id }, include: projectInclude });
  });
  await writeAudit(auth.db, request, { actorId: auth.actor.id, action: 'project.transfer', resourceType: 'project', resourceId: project.id, before: { ownerAccountId: auth.actor.id }, after: { ownerOrganizationId: organization.id } });
  return jsonData(serializeProject(updated, { includePrivate: true }), request);
}
