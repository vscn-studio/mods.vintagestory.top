import { NextRequest } from 'next/server';
import { reviewerOrResponse, adminMutationError, requireConfirmation } from '@/lib/admin-auth';
import { jsonData, jsonError, parsePage } from '@/lib/api-errors';
import { writeAudit } from '@/lib/audit';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const auth = await reviewerOrResponse(request); if ('response' in auth) return auth.response;
  const { page, pageSize } = parsePage(request);
  const requestedStatus = request.nextUrl.searchParams.get('status')?.toUpperCase();
  const where = requestedStatus && ['QUEUED', 'APPROVED', 'REJECTED', 'QUARANTINED'].includes(requestedStatus) ? { status: requestedStatus as 'QUEUED' | 'APPROVED' | 'REJECTED' | 'QUARANTINED' } : {};
  const [total, tasks] = await Promise.all([
    auth.db.reviewTask.count({ where }),
    auth.db.reviewTask.findMany({ where, include: { project: { select: { id: true, slug: true, name: true } }, release: { select: { id: true, version: true, status: true } }, file: { select: { id: true, name: true, scanStatus: true } } }, orderBy: { createdAt: 'asc' }, skip: (page - 1) * pageSize, take: pageSize })
  ]);
  return jsonData(tasks.map((task) => ({ id: task.id, status: task.status.toLowerCase(), project: task.project, release: task.release, file: task.file, decision: task.decision, createdAt: task.createdAt.toISOString() })), request, { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) });
}

export async function PATCH(request: NextRequest) {
  const csrfError = adminMutationError(request); if (csrfError) return csrfError;
  const auth = await reviewerOrResponse(request); if ('response' in auth) return auth.response;
  const body = await request.json().catch(() => ({})) as { taskId?: string; decision?: 'approve' | 'reject'; reason?: string };
  if (!body.taskId || !body.decision) return jsonError('VALIDATION_ERROR', '审核数据无效。', 422, request);
  const task = await auth.db.reviewTask.findUnique({ where: { id: body.taskId }, include: { release: { include: { files: true } }, project: true, file: true } }); if (!task) return jsonError('NOT_FOUND', '审核任务不存在。', 404, request);
  const confirmationError = await requireConfirmation(request, auth.db, auth.actor.id, { action: 'admin.review.decide', resourceType: 'review_task', resourceId: task.id });
  if (confirmationError) return confirmationError;
  if (task.status !== 'QUEUED') return jsonError('CONFLICT', '该审核任务已经处理。', 409, request);
  const approved = body.decision === 'approve';
  if (task.release && task.release.status !== 'PENDING_REVIEW') return jsonError('CONFLICT', '版本当前不在待审核状态。', 409, request);
  if (approved && task.release && task.release.files.some((file) => file.scanStatus !== 'CLEAN')) return jsonError('CONFLICT', '仍有文件未通过扫描。', 409, request);
  try {
    await auth.db.$transaction(async (tx) => {
      let releaseForDecision: { id: string; status: string; files: Array<{ scanStatus: string }> } | null = null;
      if (task.release) {
        await tx.$queryRaw`SELECT "id" FROM "Release" WHERE "id" = ${task.release.id} FOR UPDATE`;
        releaseForDecision = await tx.release.findUnique({ where: { id: task.release.id }, include: { files: { select: { scanStatus: true } } } });
        if (!releaseForDecision || releaseForDecision.status !== 'PENDING_REVIEW') throw new Error('Review release was already changed');
        if (approved && releaseForDecision.files.some((file) => file.scanStatus !== 'CLEAN')) throw new Error('Review release has unclean files');
      }
      const taskUpdate = await tx.reviewTask.updateMany({ where: { id: task.id, status: 'QUEUED' }, data: { status: approved ? 'APPROVED' : 'REJECTED', decision: body.reason?.trim() || null, assignedToId: auth.actor.id } });
      if (!taskUpdate.count) throw new Error('Review task was already handled');
      if (releaseForDecision) {
        const releaseUpdate = await tx.release.updateMany({ where: { id: releaseForDecision.id, status: 'PENDING_REVIEW' }, data: { status: approved ? 'PUBLISHED' : 'REJECTED', publishedAt: approved ? new Date() : null } });
        if (!releaseUpdate.count) throw new Error('Review release was already changed');
      }
      if (task.file && !approved) await tx.file.update({ where: { id: task.file.id }, data: { scanStatus: 'QUARANTINED' } });
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Review task was already handled') return jsonError('CONFLICT', '该审核任务已经处理。', 409, request);
    if (error instanceof Error && error.message === 'Review release was already changed') return jsonError('CONFLICT', '版本状态已变更，无法完成当前审核。', 409, request);
    if (error instanceof Error && error.message === 'Review release has unclean files') return jsonError('CONFLICT', '仍有文件未通过扫描。', 409, request);
    throw error;
  }
  const recipientId = task.release?.createdById ?? task.project?.creatorId;
  if (recipientId) await auth.db.notification.create({ data: { accountId: recipientId, type: approved ? 'release.published' : 'release.rejected', payload: { releaseId: task.release?.id, taskId: task.id, reason: body.reason ?? null } } });
  if (approved && task.release?.projectId) {
    const followers = await auth.db.follow.findMany({ where: { projectId: task.release.projectId }, select: { accountId: true } });
    const recipients = [...new Set(followers.map((follow) => follow.accountId).filter((accountId) => accountId !== recipientId))];
    if (recipients.length) await auth.db.notification.createMany({ data: recipients.map((accountId) => ({ accountId, type: 'release.published', payload: { releaseId: task.release?.id, taskId: task.id } })) });
  }
  await writeAudit(auth.db, request, { actorId: auth.actor.id, action: `review.${body.decision}`, resourceType: task.release ? 'release' : task.file ? 'file' : 'project', resourceId: task.release?.id ?? task.file?.id ?? task.project?.id, after: { taskId: task.id, reason: body.reason } });
  return jsonData({ id: task.id, status: approved ? 'approved' : 'rejected' }, request);
}
