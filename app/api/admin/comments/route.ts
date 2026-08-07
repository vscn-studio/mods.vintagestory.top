import { NextRequest } from 'next/server';
import { z } from 'zod';
import { adminMutationError, moderatorOrResponse, requireConfirmation } from '@/lib/admin-auth';
import { jsonData, jsonError, parsePage } from '@/lib/api-errors';
import { writeAudit } from '@/lib/audit';

export const runtime = 'nodejs';

const schema = z.object({ commentId: z.string().min(1), hidden: z.boolean() });

export async function GET(request: NextRequest) {
  const auth = await moderatorOrResponse(request);
  if ('response' in auth) return auth.response;
  const { page, pageSize } = parsePage(request);
  const query = (request.nextUrl.searchParams.get('q') ?? '').trim().slice(0, 120);
  const where = query ? { OR: [{ body: { contains: query, mode: 'insensitive' as const } }, { account: { username: { contains: query, mode: 'insensitive' as const } } }, { project: { name: { contains: query, mode: 'insensitive' as const } } }] } : {};
  const [total, comments] = await Promise.all([
    auth.db.comment.count({ where }),
    auth.db.comment.findMany({ where, include: { account: { select: { id: true, username: true, displayName: true } }, project: { select: { id: true, slug: true, name: true } } }, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize })
  ]);
  return jsonData(comments.map((comment) => ({ id: comment.id, body: comment.body, hidden: Boolean(comment.hiddenAt), author: comment.account, project: comment.project, createdAt: comment.createdAt.toISOString(), updatedAt: comment.updatedAt.toISOString() })), request, { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) });
}

export async function PATCH(request: NextRequest) {
  const csrfError = adminMutationError(request);
  if (csrfError) return csrfError;
  const auth = await moderatorOrResponse(request);
  if ('response' in auth) return auth.response;
  let input: z.infer<typeof schema>;
  try { input = schema.parse(await request.json()); } catch { return jsonError('VALIDATION_ERROR', '评论管理数据无效。', 422, request); }
  const comment = await auth.db.comment.findUnique({ where: { id: input.commentId } });
  if (!comment) return jsonError('NOT_FOUND', '评论不存在。', 404, request);
  const confirmationError = await requireConfirmation(request, auth.db, auth.actor.id, { action: 'admin.comment.update', resourceType: 'comment', resourceId: comment.id });
  if (confirmationError) return confirmationError;
  const updated = await auth.db.comment.update({ where: { id: comment.id }, data: { hiddenAt: input.hidden ? new Date() : null } });
  await writeAudit(auth.db, request, { actorId: auth.actor.id, action: input.hidden ? 'comment.hide' : 'comment.restore', resourceType: 'comment', resourceId: comment.id, before: { hiddenAt: comment.hiddenAt }, after: { hiddenAt: updated.hiddenAt } });
  return jsonData({ id: updated.id, hidden: Boolean(updated.hiddenAt) }, request);
}
