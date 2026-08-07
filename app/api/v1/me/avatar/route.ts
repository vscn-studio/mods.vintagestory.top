import { NextRequest } from 'next/server';
import { actorOrResponse, mutationAllowed } from '@/lib/api-auth';
import { jsonData, jsonError } from '@/lib/api-errors';
import { createObjectKey, getStorageAdapter, inferUploadMimeType, objectKeyFromMediaUrl, storageProviderName, validateUpload } from '@/lib/storage';
import { writeAudit } from '@/lib/audit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const csrfError = mutationAllowed(request);
  if (csrfError) return csrfError;
  const auth = await actorOrResponse(request);
  if ('response' in auth) return auth.response;
  const form = await request.formData();
  const entry = form.get('file');
  if (!(entry instanceof File) || entry.size > 5 * 1024 * 1024 || !entry.type.startsWith('image/')) return jsonError('VALIDATION_ERROR', '请选择不超过 5 MB 的图片。', 422, request);
  const buffer = Buffer.from(await entry.arrayBuffer());
  try { validateUpload(buffer, { name: entry.name, mimeType: entry.type, maxBytes: 5 * 1024 * 1024 }); } catch (error) { return jsonError('VALIDATION_ERROR', error instanceof Error ? error.message : '头像校验失败。', 422, request); }
  const mimeType = inferUploadMimeType(entry.name, entry.type);
  const key = createObjectKey('avatars', entry.name);
  const adapter = getStorageAdapter();
  let stored;
  try {
    stored = await adapter.put(buffer, { objectKey: key, mimeType, name: entry.name });
  } catch (error) {
    return jsonError('INTERNAL_ERROR', error instanceof Error ? error.message : '头像存储失败。', 503, request);
  }
  const avatarUrl = `/api/v1/media/${key.split('/').map(encodeURIComponent).join('/')}`;
  const previous = await auth.db.account.findUnique({ where: { id: auth.actor.id }, select: { avatarUrl: true } });
  let account;
  try {
    account = await auth.db.$transaction(async (tx) => {
      const updated = await tx.account.update({ where: { id: auth.actor.id }, data: { avatarUrl } });
      await tx.storageObject.upsert({
        where: { objectKey: key },
        create: { objectKey: key, provider: storageProviderName(), bucket: process.env.STORAGE_S3_BUCKET, mimeType, size: stored.size, sha256: stored.sha256 },
        update: { deletedAt: null, provider: storageProviderName(), bucket: process.env.STORAGE_S3_BUCKET, mimeType, size: stored.size, sha256: stored.sha256 }
      });
      await writeAudit(tx, request, { actorId: auth.actor.id, action: 'account.avatar.update', resourceType: 'account', resourceId: updated.id, before: { avatarUrl: previous?.avatarUrl ?? null }, after: { avatarUrl } });
      return updated;
    });
  } catch (error) {
    await adapter.remove(key).catch(() => undefined);
    return jsonError('INTERNAL_ERROR', error instanceof Error ? error.message : '头像保存失败。', 503, request);
  }
  const previousKey = objectKeyFromMediaUrl(previous?.avatarUrl);
  if (previousKey && previousKey !== key) {
    await auth.db.storageObject.updateMany({ where: { objectKey: previousKey, deletedAt: null }, data: { deletedAt: new Date() } }).catch(() => undefined);
    await adapter.remove(previousKey).catch(() => undefined);
  }
  return jsonData({ avatarUrl }, request);
}

export async function DELETE(request: NextRequest) {
  const csrfError = mutationAllowed(request);
  if (csrfError) return csrfError;
  const auth = await actorOrResponse(request);
  if ('response' in auth) return auth.response;
  const account = await auth.db.account.findUnique({ where: { id: auth.actor.id }, select: { id: true, avatarUrl: true } });
  if (!account) return jsonError('NOT_FOUND', '账号不存在。', 404, request);
  try {
    await auth.db.$transaction(async (tx) => {
      await tx.account.update({ where: { id: account.id }, data: { avatarUrl: null } });
      await writeAudit(tx, request, { actorId: auth.actor.id, action: 'account.avatar.remove', resourceType: 'account', resourceId: account.id, before: { avatarUrl: account.avatarUrl } });
    });
  } catch (error) {
    return jsonError('INTERNAL_ERROR', error instanceof Error ? error.message : '头像移除失败。', 503, request);
  }
  const previousKey = objectKeyFromMediaUrl(account.avatarUrl);
  if (previousKey) {
    await auth.db.storageObject.updateMany({ where: { objectKey: previousKey, deletedAt: null }, data: { deletedAt: new Date() } }).catch(() => undefined);
    await getStorageAdapter().remove(previousKey).catch(() => undefined);
  }
  return jsonData({ avatarUrl: null }, request);
}
