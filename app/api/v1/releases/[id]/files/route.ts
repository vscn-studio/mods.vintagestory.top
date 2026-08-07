import { NextRequest, NextResponse } from 'next/server';
import { actorOrResponse, mutationAllowed, optionalActor } from '@/lib/api-auth';
import { jsonData, jsonError } from '@/lib/api-errors';
import { canProjectPermission, canReadProject, effectiveProjectRole, getActiveActor } from '@/lib/authorization';
import { createObjectKey, getStorageAdapter, inferUploadMimeType, storageProviderName, validateUpload } from '@/lib/storage';
import { writeAudit } from '@/lib/audit';
import { requireConfirmation } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const auth = await optionalActor(request);
  if ('response' in auth) return auth.response;
  const release = await auth.db.release.findUnique({ where: { id }, include: { project: { include: { members: true, ownerOrganization: { include: { members: true } } } }, files: true } });
  if (!release) return jsonError('NOT_FOUND', '版本不存在。', 404, request);
  const actor = getActiveActor(auth.actor);
  const member = Boolean(actor && (actor.siteRoles.includes('ADMIN') || effectiveProjectRole(actor, release.project as never)));
  const canSeeUnclean = Boolean(actor && canProjectPermission(actor, release.project as never, 'file.manage'));
  if (!canReadProject(actor, release.project as never)) return jsonError('NOT_FOUND', '版本不存在。', 404, request);
  if (release.status !== 'PUBLISHED' && !member) return jsonError('NOT_FOUND', '版本不存在。', 404, request);
  return jsonData(release.files.filter((file) => file.scanStatus === 'CLEAN' || canSeeUnclean).map((file) => ({ id: file.id, name: file.name, mimeType: file.mimeType, size: Number(file.size), sha256: file.sha256, scanStatus: file.scanStatus.toLowerCase(), downloads: file.downloads, createdAt: file.createdAt.toISOString() })), request);
}

export async function POST(request: NextRequest, { params }: Params) {
  const csrfError = mutationAllowed(request);
  if (csrfError) return csrfError;
  const { id } = await params;
  const auth = await actorOrResponse(request);
  if ('response' in auth) return auth.response;
  const release = await auth.db.release.findUnique({ where: { id }, include: { project: { include: { members: true, ownerOrganization: { include: { members: true } } } } } });
  if (!release) return jsonError('NOT_FOUND', '版本不存在。', 404, request);
  if (!canProjectPermission(auth.actor, release.project as never, 'file.manage')) return jsonError('FORBIDDEN', '没有上传文件的权限。', 403, request);
  if (!['DRAFT', 'REJECTED'].includes(release.status)) return jsonError('CONFLICT', '待审核、已发布或已撤回的版本不能再修改文件。', 409, request);
  const form = await request.formData();
  const entry = form.get('file');
  if (!(entry instanceof File)) return jsonError('VALIDATION_ERROR', '请选择要上传的文件。', 422, request);
  if (entry.size > 500 * 1024 * 1024) return jsonError('VALIDATION_ERROR', '文件不能超过 500 MB。', 422, request);
  const buffer = Buffer.from(await entry.arrayBuffer());
  try { validateUpload(buffer, { name: entry.name, mimeType: entry.type || 'application/octet-stream' }); } catch (error) { return jsonError('VALIDATION_ERROR', error instanceof Error ? error.message : '文件校验失败。', 422, request); }
  const mimeType = inferUploadMimeType(entry.name, entry.type);
  const expectedSha = typeof form.get('sha256') === 'string' ? String(form.get('sha256')).trim().toLowerCase() : '';
  if (expectedSha && !/^[a-f0-9]{64}$/.test(expectedSha)) return jsonError('VALIDATION_ERROR', 'SHA-256 格式无效。', 422, request);
  const key = createObjectKey('releases', entry.name);
  let stored;
  try { stored = await getStorageAdapter().put(buffer, { objectKey: key, mimeType, name: entry.name }); } catch (error) { return jsonError('INTERNAL_ERROR', error instanceof Error ? error.message : '文件存储失败。', 503, request); }
  if (expectedSha && expectedSha !== stored.sha256) {
    await getStorageAdapter().remove(key).catch(() => undefined);
    return jsonError('VALIDATION_ERROR', '文件 SHA-256 校验失败。', 422, request);
  }
  const scanStatus = process.env.STORAGE_SCAN_MODE === 'clean' ? 'CLEAN' : 'PENDING';
  let file;
  try {
    file = await auth.db.$transaction(async (tx) => {
      const created = await tx.file.create({ data: { releaseId: release.id, objectKey: key, name: stored.name, mimeType, size: stored.size, sha256: stored.sha256, scanStatus, uploadedById: auth.actor.id } });
      await tx.storageObject.create({ data: { objectKey: key, provider: storageProviderName(), bucket: process.env.STORAGE_S3_BUCKET, mimeType, size: stored.size, sha256: stored.sha256 } });
      await writeAudit(tx, request, { actorId: auth.actor.id, action: 'release.file.upload', resourceType: 'file', resourceId: created.id, after: { releaseId: release.id, name: created.name, size: created.size.toString(), scanStatus } });
      return created;
    });
  } catch (error) {
    await getStorageAdapter().remove(key).catch(() => undefined);
    return jsonError('INTERNAL_ERROR', error instanceof Error ? error.message : '文件索引保存失败。', 503, request);
  }
  return jsonData({ id: file.id, name: file.name, mimeType: file.mimeType, size: Number(file.size), sha256: file.sha256, scanStatus: file.scanStatus.toLowerCase() }, request);
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const csrfError = mutationAllowed(request); if (csrfError) return csrfError;
  const { id } = await params; const fileId = request.nextUrl.searchParams.get('fileId'); if (!fileId) return jsonError('VALIDATION_ERROR', '文件 ID 无效。', 422, request);
  const auth = await actorOrResponse(request); if ('response' in auth) return auth.response;
  const release = await auth.db.release.findUnique({ where: { id }, include: { project: { include: { members: true, ownerOrganization: { include: { members: true } } } } } });
  const file = await auth.db.file.findUnique({ where: { id: fileId } });
  if (!release || !file || file.releaseId !== release.id) return jsonError('NOT_FOUND', '文件不存在。', 404, request);
  if (!canProjectPermission(auth.actor, release.project as never, 'file.manage')) return jsonError('FORBIDDEN', '没有删除文件的权限。', 403, request);
  if (!['DRAFT', 'REJECTED'].includes(release.status)) return jsonError('CONFLICT', '待审核、已发布或已撤回的版本不能删除文件。', 409, request);
  const confirmationError = await requireConfirmation(request, auth.db, auth.actor.id, { action: 'release.file.delete', resourceType: 'file', resourceId: file.id });
  if (confirmationError) return confirmationError;
  try {
    await auth.db.$transaction(async (tx) => {
      await tx.file.delete({ where: { id: file.id } });
      await tx.storageObject.updateMany({ where: { objectKey: file.objectKey, deletedAt: null }, data: { deletedAt: new Date() } });
      await writeAudit(tx, request, { actorId: auth.actor.id, action: 'release.file.delete', resourceType: 'file', resourceId: file.id, before: { name: file.name, releaseId: release.id, objectKey: file.objectKey } });
    });
  } catch (error) {
    return jsonError('INTERNAL_ERROR', error instanceof Error ? error.message : '文件删除失败。', 503, request);
  }
  await getStorageAdapter().remove(file.objectKey).catch(() => undefined);
  return jsonData({ removed: true }, request);
}
