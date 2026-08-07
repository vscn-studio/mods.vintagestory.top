import { NextRequest } from 'next/server';
import { actorOrResponse, mutationAllowed } from '@/lib/api-auth';
import { jsonData, jsonError } from '@/lib/api-errors';
import { effectiveOrganizationRole, organizationRoleAllows } from '@/lib/authorization';
import { writeAudit } from '@/lib/audit';
import { createObjectKey, getStorageAdapter, inferUploadMimeType, objectKeyFromMediaUrl, storageProviderName, validateUpload } from '@/lib/storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
type Params = { params: Promise<{ slug: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const csrfError = mutationAllowed(request);
  if (csrfError) return csrfError;
  const { slug } = await params;
  const auth = await actorOrResponse(request);
  if ('response' in auth) return auth.response;
  const organization = await auth.db.organization.findUnique({ where: { slug }, include: { members: true } });
  const role = organization ? effectiveOrganizationRole(auth.actor, organization) : null;
  if (!organization || !role || !organizationRoleAllows(role, 'manage')) return jsonError('FORBIDDEN', '没有修改组织头像的权限。', 403, request);
  const form = await request.formData();
  const entry = form.get('file');
  if (!(entry instanceof File) || entry.size > 5 * 1024 * 1024 || !entry.type.startsWith('image/')) return jsonError('VALIDATION_ERROR', '请选择不超过 5 MB 的图片。', 422, request);
  const buffer = Buffer.from(await entry.arrayBuffer());
  try { validateUpload(buffer, { name: entry.name, mimeType: entry.type, maxBytes: 5 * 1024 * 1024 }); } catch (error) { return jsonError('VALIDATION_ERROR', error instanceof Error ? error.message : '头像校验失败。', 422, request); }
  const mimeType = inferUploadMimeType(entry.name, entry.type);
  const key = createObjectKey('avatars', entry.name);
  const adapter = getStorageAdapter();
  let stored;
  try { stored = await adapter.put(buffer, { objectKey: key, mimeType, name: entry.name }); } catch (error) { return jsonError('INTERNAL_ERROR', error instanceof Error ? error.message : '头像存储失败。', 503, request); }
  const avatarUrl = `/api/v1/media/${key.split('/').map(encodeURIComponent).join('/')}`;
  const previous = organization.avatarUrl;
  try {
    await auth.db.$transaction(async (tx) => {
      await tx.organization.update({ where: { id: organization.id }, data: { avatarUrl } });
      await tx.storageObject.upsert({
        where: { objectKey: key },
        create: { objectKey: key, provider: storageProviderName(), bucket: process.env.STORAGE_S3_BUCKET, mimeType, size: stored.size, sha256: stored.sha256 },
        update: { deletedAt: null, provider: storageProviderName(), bucket: process.env.STORAGE_S3_BUCKET, mimeType, size: stored.size, sha256: stored.sha256 }
      });
      await writeAudit(tx, request, { actorId: auth.actor.id, action: 'organization.avatar.update', resourceType: 'organization', resourceId: organization.id, before: { avatarUrl: previous }, after: { avatarUrl } });
    });
  } catch (error) {
    await adapter.remove(key).catch(() => undefined);
    return jsonError('INTERNAL_ERROR', error instanceof Error ? error.message : '头像保存失败。', 503, request);
  }
  const previousKey = objectKeyFromMediaUrl(previous);
  if (previousKey && previousKey !== key) {
    await auth.db.storageObject.updateMany({ where: { objectKey: previousKey, deletedAt: null }, data: { deletedAt: new Date() } }).catch(() => undefined);
    await adapter.remove(previousKey).catch(() => undefined);
  }
  return jsonData({ avatarUrl }, request);
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const csrfError = mutationAllowed(request); if (csrfError) return csrfError;
  const { slug } = await params; const auth = await actorOrResponse(request); if ('response' in auth) return auth.response;
  const organization = await auth.db.organization.findUnique({ where: { slug }, include: { members: true } });
  const role = organization ? effectiveOrganizationRole(auth.actor, organization) : null;
  if (!organization || !role || !organizationRoleAllows(role, 'manage')) return jsonError('FORBIDDEN', '没有修改组织头像的权限。', 403, request);
  const previous = organization.avatarUrl;
  try {
    await auth.db.$transaction(async (tx) => {
      await tx.organization.update({ where: { id: organization.id }, data: { avatarUrl: null } });
      await writeAudit(tx, request, { actorId: auth.actor.id, action: 'organization.avatar.remove', resourceType: 'organization', resourceId: organization.id, before: { avatarUrl: previous } });
    });
  } catch (error) {
    return jsonError('INTERNAL_ERROR', error instanceof Error ? error.message : '头像移除失败。', 503, request);
  }
  const previousKey = objectKeyFromMediaUrl(previous);
  if (previousKey) {
    await auth.db.storageObject.updateMany({ where: { objectKey: previousKey, deletedAt: null }, data: { deletedAt: new Date() } }).catch(() => undefined);
    await getStorageAdapter().remove(previousKey).catch(() => undefined);
  }
  return jsonData({ avatarUrl: null }, request);
}
