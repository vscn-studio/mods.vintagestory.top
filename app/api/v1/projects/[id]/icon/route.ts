import { NextRequest } from 'next/server';
import { actorOrResponse, mutationAllowed } from '@/lib/api-auth';
import { jsonData, jsonError } from '@/lib/api-errors';
import { canProjectPermission } from '@/lib/authorization';
import { writeAudit } from '@/lib/audit';
import { findProject } from '@/lib/project-service';
import { createObjectKey, getStorageAdapter, inferUploadMimeType, objectKeyFromMediaUrl, storageProviderName, validateUpload } from '@/lib/storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };
const maxIconBytes = 5 * 1024 * 1024;

export async function POST(request: NextRequest, { params }: Params) {
  const csrfError = mutationAllowed(request);
  if (csrfError) return csrfError;
  const { id } = await params;
  const auth = await actorOrResponse(request);
  if ('response' in auth) return auth.response;
  const project = await findProject(auth.db, id);
  if (!project) return jsonError('NOT_FOUND', '项目不存在。', 404, request);
  if (!canProjectPermission(auth.actor, project as never, 'update')) return jsonError('FORBIDDEN', '没有修改项目图标的权限。', 403, request);

  const form = await request.formData();
  const entry = form.get('file');
  if (!(entry instanceof File) || entry.size > maxIconBytes || !entry.type.startsWith('image/')) return jsonError('VALIDATION_ERROR', '请选择不超过 5 MB 的图片。', 422, request);
  const buffer = Buffer.from(await entry.arrayBuffer());
  try {
    validateUpload(buffer, { name: entry.name, mimeType: entry.type, maxBytes: maxIconBytes });
  } catch (error) {
    return jsonError('VALIDATION_ERROR', error instanceof Error ? error.message : '项目图标校验失败。', 422, request);
  }

  const mimeType = inferUploadMimeType(entry.name, entry.type);
  const key = createObjectKey('project-icons', entry.name);
  const adapter = getStorageAdapter();
  let stored;
  try {
    stored = await adapter.put(buffer, { objectKey: key, mimeType, name: entry.name });
  } catch (error) {
    return jsonError('INTERNAL_ERROR', error instanceof Error ? error.message : '项目图标存储失败。', 503, request);
  }

  const iconUrl = `/api/v1/media/${key.split('/').map(encodeURIComponent).join('/')}`;
  const previous = project.iconUrl;
  try {
    await auth.db.$transaction(async (tx) => {
      await tx.project.update({ where: { id: project.id }, data: { iconUrl } });
      await tx.storageObject.upsert({
        where: { objectKey: key },
        create: { objectKey: key, provider: storageProviderName(), bucket: process.env.STORAGE_S3_BUCKET, mimeType, size: stored.size, sha256: stored.sha256 },
        update: { deletedAt: null, provider: storageProviderName(), bucket: process.env.STORAGE_S3_BUCKET, mimeType, size: stored.size, sha256: stored.sha256 }
      });
      await writeAudit(tx, request, { actorId: auth.actor.id, action: 'project.icon.update', resourceType: 'project', resourceId: project.id, before: { iconUrl: previous }, after: { iconUrl } });
    });
  } catch (error) {
    await adapter.remove(key).catch(() => undefined);
    return jsonError('INTERNAL_ERROR', error instanceof Error ? error.message : '项目图标保存失败。', 503, request);
  }

  const previousKey = objectKeyFromMediaUrl(previous);
  if (previousKey && previousKey !== key) {
    await auth.db.storageObject.updateMany({ where: { objectKey: previousKey, deletedAt: null }, data: { deletedAt: new Date() } }).catch(() => undefined);
    await adapter.remove(previousKey).catch(() => undefined);
  }
  return jsonData({ iconUrl }, request);
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const csrfError = mutationAllowed(request);
  if (csrfError) return csrfError;
  const { id } = await params;
  const auth = await actorOrResponse(request);
  if ('response' in auth) return auth.response;
  const project = await findProject(auth.db, id);
  if (!project) return jsonError('NOT_FOUND', '项目不存在。', 404, request);
  if (!canProjectPermission(auth.actor, project as never, 'update')) return jsonError('FORBIDDEN', '没有修改项目图标的权限。', 403, request);

  const previous = project.iconUrl;
  try {
    await auth.db.$transaction(async (tx) => {
      await tx.project.update({ where: { id: project.id }, data: { iconUrl: null } });
      await writeAudit(tx, request, { actorId: auth.actor.id, action: 'project.icon.remove', resourceType: 'project', resourceId: project.id, before: { iconUrl: previous }, after: { iconUrl: null } });
    });
  } catch (error) {
    return jsonError('INTERNAL_ERROR', error instanceof Error ? error.message : '项目图标移除失败。', 503, request);
  }

  const previousKey = objectKeyFromMediaUrl(previous);
  if (previousKey) {
    await auth.db.storageObject.updateMany({ where: { objectKey: previousKey, deletedAt: null }, data: { deletedAt: new Date() } }).catch(() => undefined);
    await getStorageAdapter().remove(previousKey).catch(() => undefined);
  }
  return jsonData({ iconUrl: null }, request);
}
