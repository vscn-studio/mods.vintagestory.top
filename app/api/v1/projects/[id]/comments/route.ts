import { NextRequest } from 'next/server';
import { z } from 'zod';
import { actorOrResponse, mutationAllowed, optionalActor } from '@/lib/api-auth';
import { jsonData, jsonError } from '@/lib/api-errors';
import { canReadProject } from '@/lib/authorization';
import { writeAudit } from '@/lib/audit';
import { canProjectPermission } from '@/lib/authorization';
import { requireConfirmation } from '@/lib/admin-auth';

export const runtime = 'nodejs';
type Params = { params: Promise<{ id: string }> };
const schema = z.object({ body: z.string().trim().min(1).max(5000) });

export async function GET(request: NextRequest, { params }: Params) {
  const { id } = await params; const auth = await optionalActor(request); if ('response' in auth) return auth.response;
  const project = await auth.db.project.findFirst({ where: { OR: [{ id }, { slug: id }] }, include: { members: true, ownerOrganization: { include: { members: true } } } });
  if (!project) return jsonError('NOT_FOUND', '项目不存在。', 404, request);
  if (!canReadProject(auth.actor, project as never)) return jsonError('NOT_FOUND', '项目不存在。', 404, request);
  const comments = await auth.db.comment.findMany({ where: { projectId: project.id, hiddenAt: null }, include: { account: { select: { username: true, displayName: true, avatarUrl: true } } }, orderBy: { createdAt: 'asc' } });
  return jsonData(comments.map((comment) => ({ id: comment.id, body: comment.body, author: comment.account, createdAt: comment.createdAt.toISOString(), updatedAt: comment.updatedAt.toISOString() })), request);
}

export async function POST(request: NextRequest, { params }: Params) {
  const csrfError = mutationAllowed(request); if (csrfError) return csrfError;
  const { id } = await params; const auth = await actorOrResponse(request); if ('response' in auth) return auth.response;
  const project = await auth.db.project.findFirst({ where: { OR: [{ id }, { slug: id }] }, include: { members: true, ownerOrganization: { include: { members: true } } } });
  if (!project) return jsonError('NOT_FOUND', '项目不存在。', 404, request);
  if (!canReadProject(auth.actor, project as never)) return jsonError('NOT_FOUND', '项目不存在。', 404, request);
  let input: z.infer<typeof schema>; try { input = schema.parse(await request.json()); } catch { return jsonError('VALIDATION_ERROR', '评论内容无效。', 422, request); }
  const comment = await auth.db.comment.create({ data: { projectId: project.id, accountId: auth.actor.id, body: input.body } });
  const recipientId = project.ownerAccountId ?? project.ownerOrganization?.ownerId;
  if (recipientId && recipientId !== auth.actor.id) await auth.db.notification.create({ data: { accountId: recipientId, type: 'project.comment', payload: { projectId: project.id, commentId: comment.id } } });
  await writeAudit(auth.db, request, { actorId: auth.actor.id, action: 'project.comment.create', resourceType: 'comment', resourceId: comment.id });
  return jsonData({ id: comment.id, body: comment.body, createdAt: comment.createdAt.toISOString() }, request);
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const csrfError = mutationAllowed(request); if (csrfError) return csrfError;
  const { id } = await params; const commentId = request.nextUrl.searchParams.get('commentId')?.trim();
  if (!commentId) return jsonError('VALIDATION_ERROR', '评论 ID 无效。', 422, request);
  const auth = await actorOrResponse(request); if ('response' in auth) return auth.response;
  const comment = await auth.db.comment.findUnique({ where: { id: commentId }, include: { project: { include: { members: true, ownerOrganization: { include: { members: true } } } } } });
  if (!comment || (comment.project.id !== id && comment.project.slug !== id)) return jsonError('NOT_FOUND', '评论不存在。', 404, request);
  const canManage = canProjectPermission(auth.actor, comment.project as never, 'update');
  if (comment.accountId !== auth.actor.id && !canManage) return jsonError('FORBIDDEN', '没有编辑此评论的权限。', 403, request);
  if (comment.hiddenAt && !canManage) return jsonError('FORBIDDEN', '隐藏评论不能编辑。', 403, request);
  let input: z.infer<typeof schema>; try { input = schema.parse(await request.json()); } catch { return jsonError('VALIDATION_ERROR', '评论内容无效。', 422, request); }
  const updated = await auth.db.$transaction(async (tx) => {
    const value = await tx.comment.update({ where: { id: comment.id }, data: { body: input.body } });
    await writeAudit(tx, request, { actorId: auth.actor.id, action: 'project.comment.update', resourceType: 'comment', resourceId: comment.id, before: { body: comment.body }, after: { body: value.body } });
    return value;
  });
  return jsonData({ id: updated.id, body: updated.body, updatedAt: updated.updatedAt.toISOString() }, request);
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const csrfError = mutationAllowed(request); if (csrfError) return csrfError;
  const { id } = await params; const commentId = request.nextUrl.searchParams.get('commentId')?.trim();
  if (!commentId) return jsonError('VALIDATION_ERROR', '评论 ID 无效。', 422, request);
  const auth = await actorOrResponse(request); if ('response' in auth) return auth.response;
  const comment = await auth.db.comment.findUnique({ where: { id: commentId }, include: { project: { include: { members: true, ownerOrganization: { include: { members: true } } } } } });
  if (!comment || (comment.project.id !== id && comment.project.slug !== id)) return jsonError('NOT_FOUND', '评论不存在。', 404, request);
  const canManage = canProjectPermission(auth.actor, comment.project as never, 'member.manage');
  if (comment.accountId !== auth.actor.id && !canManage) return jsonError('FORBIDDEN', '没有删除此评论的权限。', 403, request);
  if (comment.accountId !== auth.actor.id) {
    const confirmationError = await requireConfirmation(request, auth.db, auth.actor.id, { action: 'admin.comment.update', resourceType: 'comment', resourceId: comment.id });
    if (confirmationError) return confirmationError;
  }
  await auth.db.$transaction(async (tx) => {
    await tx.comment.delete({ where: { id: comment.id } });
    await writeAudit(tx, request, { actorId: auth.actor.id, action: 'project.comment.delete', resourceType: 'comment', resourceId: comment.id, before: { projectId: comment.projectId, authorId: comment.accountId } });
  });
  return jsonData({ removed: true }, request);
}
