import { NextRequest } from 'next/server';
import { adminOrResponse, adminMutationError, requireConfirmation } from '@/lib/admin-auth';
import { jsonData, jsonError } from '@/lib/api-errors';
import { getStorageAdapter } from '@/lib/storage';
import { writeAudit } from '@/lib/audit';

export const runtime = 'nodejs';
type Params = { params: Promise<{ id: string }> };

export async function DELETE(request: NextRequest, { params }: Params) {
  const csrfError = adminMutationError(request); if (csrfError) return csrfError;
  const { id } = await params;
  const auth = await adminOrResponse(request); if ('response' in auth) return auth.response;
  const file = await auth.db.file.findUnique({ where: { id }, include: { release: { select: { id: true, version: true, status: true, projectId: true } } } });
  if (!file) return jsonError('NOT_FOUND', '文件不存在。', 404, request);
  if (file.release.status === 'PUBLISHED') return jsonError('CONFLICT', '已发布版本的文件不能直接删除，请先撤回版本。', 409, request);
  const confirmationError = await requireConfirmation(request, auth.db, auth.actor.id, { action: 'admin.file.delete', resourceType: 'file', resourceId: file.id });
  if (confirmationError) return confirmationError;
  try {
    await auth.db.$transaction(async (tx) => {
      await tx.file.delete({ where: { id: file.id } });
      await tx.storageObject.updateMany({ where: { objectKey: file.objectKey, deletedAt: null }, data: { deletedAt: new Date() } });
      await writeAudit(tx, request, { actorId: auth.actor.id, action: 'admin.file.delete', resourceType: 'file', resourceId: file.id, before: { releaseId: file.release.id, name: file.name, objectKey: file.objectKey } });
    });
  } catch (error) {
    return jsonError('INTERNAL_ERROR', error instanceof Error ? error.message : '文件删除失败。', 503, request);
  }
  await getStorageAdapter().remove(file.objectKey).catch(() => undefined);
  return jsonData({ removed: true, id: file.id }, request);
}
