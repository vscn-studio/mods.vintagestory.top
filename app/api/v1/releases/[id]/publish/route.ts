import { NextRequest } from 'next/server';
import { actorOrResponse, mutationAllowed } from '@/lib/api-auth';
import { jsonData, jsonError } from '@/lib/api-errors';
import { canProjectPermission } from '@/lib/authorization';
import { writeAudit } from '@/lib/audit';
import { canTransitionRelease } from '@/lib/release-state';
import { requireConfirmation } from '@/lib/admin-auth';

export const runtime = 'nodejs';
type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const csrfError = mutationAllowed(request);
  if (csrfError) return csrfError;
  const { id } = await params;
  const auth = await actorOrResponse(request);
  if ('response' in auth) return auth.response;
  const release = await auth.db.release.findUnique({ where: { id }, include: { project: { include: { members: true, ownerOrganization: { include: { members: true } } } }, files: true } });
  if (!release) return jsonError('NOT_FOUND', '版本不存在。', 404, request);
  if (!canProjectPermission(auth.actor, release.project as never, 'release.publish')) return jsonError('FORBIDDEN', '没有发布版本的权限。', 403, request);
  const requestedAction = request.nextUrl.searchParams.get('action') ?? 'submit';
  if (requestedAction !== 'submit' && requestedAction !== 'withdraw') return jsonError('VALIDATION_ERROR', '版本操作无效。', 422, request);
  const action = requestedAction;
  const confirmationError = await requireConfirmation(request, auth.db, auth.actor.id, { action: action === 'submit' ? 'release.submit_review' : 'release.withdraw', resourceType: 'release', resourceId: release.id });
  if (confirmationError) return confirmationError;
  if (action === 'submit') {
    let updated;
    try {
      updated = await auth.db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "Release" WHERE "id" = ${id} FOR UPDATE`;
        const current = await tx.release.findUnique({ where: { id }, include: { files: true } });
        if (!current) throw new Error('release_missing');
        if (current.files.length === 0 || current.files.some((file) => file.scanStatus !== 'CLEAN')) throw new Error('release_unclean');
        if (!canTransitionRelease(current.status, 'PENDING_REVIEW')) throw new Error('release_invalid_transition');
        const changed = await tx.release.updateMany({ where: { id, status: current.status }, data: { status: 'PENDING_REVIEW' } });
        if (!changed.count) throw new Error('release_already_changed');
        const queued = await tx.reviewTask.findFirst({ where: { releaseId: id, status: 'QUEUED' }, select: { id: true } });
        if (!queued) await tx.reviewTask.create({ data: { releaseId: id, projectId: release.project.id } });
        return tx.release.findUniqueOrThrow({ where: { id } });
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (message === 'release_missing') return jsonError('NOT_FOUND', '版本不存在。', 404, request);
      if (message === 'release_unclean') return jsonError('CONFLICT', '版本必须包含已通过扫描的文件。', 409, request);
      if (message === 'release_invalid_transition' || message === 'release_already_changed') return jsonError('CONFLICT', '当前版本状态不能提交审核。', 409, request);
      return jsonError('INTERNAL_ERROR', '版本提交审核失败。', 503, request);
    }
    await writeAudit(auth.db, request, { actorId: auth.actor.id, action: 'release.submit_review', resourceType: 'release', resourceId: id, after: { status: updated.status } });
    return jsonData({ id, status: updated.status.toLowerCase() }, request);
  }
  let updated;
  try {
    updated = await auth.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Release" WHERE "id" = ${id} FOR UPDATE`;
      const current = await tx.release.findUnique({ where: { id }, select: { status: true } });
      if (!current || !canTransitionRelease(current.status, 'WITHDRAWN')) throw new Error('release_invalid_transition');
      const changed = await tx.release.updateMany({ where: { id, status: current.status }, data: { status: 'WITHDRAWN', publishedAt: null } });
      if (!changed.count) throw new Error('release_invalid_transition');
      if (current.status === 'PENDING_REVIEW') {
        await tx.reviewTask.updateMany({ where: { releaseId: id, status: 'QUEUED' }, data: { status: 'REJECTED', decision: 'Release withdrawn before review.' } });
      }
      return tx.release.findUniqueOrThrow({ where: { id } });
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'release_invalid_transition') return jsonError('CONFLICT', '当前版本状态不能撤回。', 409, request);
    return jsonError('INTERNAL_ERROR', '版本撤回失败。', 503, request);
  }
  await writeAudit(auth.db, request, { actorId: auth.actor.id, action: 'release.withdraw', resourceType: 'release', resourceId: id, after: { status: updated.status } });
  return jsonData({ id, status: updated.status.toLowerCase() }, request);
}
