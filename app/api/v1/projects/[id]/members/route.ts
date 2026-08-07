import { NextRequest } from 'next/server';
import { z } from 'zod';
import { actorOrResponse, mutationAllowed, optionalActor } from '@/lib/api-auth';
import { jsonData, jsonError } from '@/lib/api-errors';
import { canProjectPermission, canReadProject } from '@/lib/authorization';
import { findProject, projectInclude, serializeProject } from '@/lib/project-service';
import { writeAudit } from '@/lib/audit';
import { requireConfirmation } from '@/lib/admin-auth';

export const runtime = 'nodejs';

type Params = { params: Promise<{ id: string }> };
const memberSchema = z.object({ username: z.string().trim().min(1).max(80), role: z.enum(['maintainer', 'contributor', 'reviewer', 'viewer']) });

export async function GET(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const auth = await optionalActor(request);
  if ('response' in auth) return auth.response;
  const project = await findProject(auth.db, id);
  if (!project) return jsonError('NOT_FOUND', '项目不存在。', 404, request);
  if (!canReadProject(auth.actor, project as never)) return jsonError('NOT_FOUND', '项目不存在。', 404, request);
  return jsonData(project.members.map((member) => ({ id: member.account.id, username: member.account.username, name: member.account.displayName, role: member.role.toLowerCase(), avatarUrl: member.account.avatarUrl })), request);
}

export async function POST(request: NextRequest, { params }: Params) {
  const csrfError = mutationAllowed(request);
  if (csrfError) return csrfError;
  const { id } = await params;
  const auth = await actorOrResponse(request);
  if ('response' in auth) return auth.response;
  const project = await findProject(auth.db, id);
  if (!project) return jsonError('NOT_FOUND', '项目不存在。', 404, request);
  if (!canProjectPermission(auth.actor, project as never, 'member.manage')) return jsonError('FORBIDDEN', '没有管理项目成员的权限。', 403, request);
  let input: z.infer<typeof memberSchema>;
  try { input = memberSchema.parse(await request.json()); } catch { return jsonError('VALIDATION_ERROR', '成员数据无效。', 422, request); }
  const account = await auth.db.account.findUnique({ where: { username: input.username } });
  if (!account || account.status !== 'ACTIVE') return jsonError('NOT_FOUND', '目标账号不存在。', 404, request);
  if (project.members.some((member) => member.accountId === account.id)) return jsonError('CONFLICT', '该账号已经是项目成员。', 409, request);
  let member;
  try {
    member = await auth.db.$transaction(async (tx) => {
      const created = await tx.projectMember.create({ data: { projectId: project.id, accountId: account.id, role: input.role.toUpperCase() as 'MAINTAINER' | 'CONTRIBUTOR' | 'REVIEWER' | 'VIEWER' } });
      await tx.notification.create({ data: { accountId: account.id, type: 'project.member.added', payload: { projectId: project.id, projectSlug: project.slug, role: input.role } } });
      await writeAudit(tx, request, { actorId: auth.actor.id, action: 'project.member.add', resourceType: 'project', resourceId: project.id, after: { accountId: account.id, role: created.role } });
      return created;
    });
  } catch (error) {
    if ((error as { code?: string }).code === 'P2002') return jsonError('CONFLICT', '该账号已经是项目成员。', 409, request);
    return jsonError('INTERNAL_ERROR', error instanceof Error ? error.message : '项目成员保存失败。', 503, request);
  }
  const updated = await findProject(auth.db, project.id);
  return jsonData(updated ? serializeProject(updated, { includePrivate: true }) : { ok: true }, request);
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const csrfError = mutationAllowed(request);
  if (csrfError) return csrfError;
  const { id } = await params;
  const auth = await actorOrResponse(request);
  if ('response' in auth) return auth.response;
  const project = await findProject(auth.db, id);
  if (!project || !canProjectPermission(auth.actor, project as never, 'member.manage')) return jsonError('FORBIDDEN', '没有管理项目成员的权限。', 403, request);
  let input: z.infer<typeof memberSchema>;
  try { input = memberSchema.parse(await request.json()); } catch { return jsonError('VALIDATION_ERROR', '成员数据无效。', 422, request); }
  const account = await auth.db.account.findUnique({ where: { username: input.username } });
  const member = account ? project.members.find((item) => item.accountId === account.id) : null;
  if (!member || member.role === 'OWNER') return jsonError('NOT_FOUND', '项目成员不存在或不能修改 Owner。', 404, request);
  const confirmationError = await requireConfirmation(request, auth.db, auth.actor.id, { action: 'project.member.role.update', resourceType: 'project', resourceId: `${project.id}:${member.accountId}` });
  if (confirmationError) return confirmationError;
  const updated = await auth.db.projectMember.update({ where: { id: member.id }, data: { role: input.role.toUpperCase() as 'MAINTAINER' | 'CONTRIBUTOR' | 'REVIEWER' | 'VIEWER' } });
  await writeAudit(auth.db, request, { actorId: auth.actor.id, action: 'project.member.role.update', resourceType: 'project', resourceId: project.id, before: { accountId: member.accountId, role: member.role }, after: { accountId: member.accountId, role: updated.role } });
  return jsonData(updated, request);
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const csrfError = mutationAllowed(request);
  if (csrfError) return csrfError;
  const { id } = await params;
  const username = request.nextUrl.searchParams.get('username')?.trim();
  const auth = await actorOrResponse(request);
  if ('response' in auth) return auth.response;
  const project = await findProject(auth.db, id);
  if (!project || !canProjectPermission(auth.actor, project as never, 'member.manage')) return jsonError('FORBIDDEN', '没有管理项目成员的权限。', 403, request);
  const account = username ? await auth.db.account.findUnique({ where: { username } }) : null;
  const member = account ? project.members.find((item) => item.accountId === account.id) : null;
  if (!member || member.role === 'OWNER') return jsonError('NOT_FOUND', '项目成员不存在或不能移除 Owner。', 404, request);
  const confirmationError = await requireConfirmation(request, auth.db, auth.actor.id, { action: 'project.member.remove', resourceType: 'project', resourceId: `${project.id}:${member.accountId}` });
  if (confirmationError) return confirmationError;
  await auth.db.projectMember.delete({ where: { id: member.id } });
  await writeAudit(auth.db, request, { actorId: auth.actor.id, action: 'project.member.remove', resourceType: 'project', resourceId: project.id, before: { accountId: member.accountId, role: member.role } });
  return jsonData({ removed: true }, request);
}
