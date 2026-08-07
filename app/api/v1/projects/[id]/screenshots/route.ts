import { NextRequest } from 'next/server';
import { z } from 'zod';
import { actorOrResponse, mutationAllowed, optionalActor } from '@/lib/api-auth';
import { jsonData, jsonError } from '@/lib/api-errors';
import { canProjectPermission, canReadProject } from '@/lib/authorization';
import { createObjectKey, getStorageAdapter, inferUploadMimeType, storageProviderName, validateUpload } from '@/lib/storage';
import { findProject } from '@/lib/project-service';
import { writeAudit } from '@/lib/audit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
type Params = { params: Promise<{ id: string }> };
const captionSchema = z.string().trim().max(500).optional();

export async function GET(request: NextRequest, { params }: Params) {
  const { id } = await params; const auth = await optionalActor(request); if ('response' in auth) return auth.response;
  const project = await findProject(auth.db, id); if (!project || !canReadProject(auth.actor, project as never)) return jsonError('NOT_FOUND', '项目不存在。', 404, request);
  return jsonData(project.screenshots.map((screenshot) => ({ id: screenshot.id, caption: screenshot.caption, sortOrder: screenshot.sortOrder, url: `/api/v1/media/${screenshot.objectKey.split('/').map(encodeURIComponent).join('/')}` })), request);
}

export async function POST(request: NextRequest, { params }: Params) {
  const csrfError = mutationAllowed(request); if (csrfError) return csrfError;
  const { id } = await params; const auth = await actorOrResponse(request); if ('response' in auth) return auth.response;
  const project = await findProject(auth.db, id); if (!project) return jsonError('NOT_FOUND', '项目不存在。', 404, request);
  if (!canProjectPermission(auth.actor, project as never, 'update')) return jsonError('FORBIDDEN', '没有上传项目截图的权限。', 403, request);
  const form = await request.formData(); const entry = form.get('file'); if (!(entry instanceof File) || !entry.type.startsWith('image/') || entry.size > 10 * 1024 * 1024) return jsonError('VALIDATION_ERROR', '请选择不超过 10 MB 的图片。', 422, request);
  const buffer = Buffer.from(await entry.arrayBuffer()); try { validateUpload(buffer, { name: entry.name, mimeType: entry.type, maxBytes: 10 * 1024 * 1024 }); } catch (error) { return jsonError('VALIDATION_ERROR', error instanceof Error ? error.message : '截图校验失败。', 422, request); }
  const mimeType = inferUploadMimeType(entry.name, entry.type);
  const key = createObjectKey('projects', entry.name);
  const adapter = getStorageAdapter();
  let stored;
  try { stored = await adapter.put(buffer, { objectKey: key, mimeType, name: entry.name }); } catch (error) { return jsonError('INTERNAL_ERROR', error instanceof Error ? error.message : '截图存储失败。', 503, request); }
  let caption: string | undefined;
  try { caption = captionSchema.parse(form.get('caption') ?? undefined); } catch { await adapter.remove(key).catch(() => undefined); return jsonError('VALIDATION_ERROR', '截图说明无效。', 422, request); }
  let screenshot;
  try {
    screenshot = await auth.db.$transaction(async (tx) => {
      // Keep sort order stable when multiple uploads arrive concurrently.
      await tx.$queryRaw`SELECT "id" FROM "Project" WHERE "id" = ${project.id} FOR UPDATE`;
      const last = await tx.screenshot.findFirst({ where: { projectId: project.id }, orderBy: { sortOrder: 'desc' }, select: { sortOrder: true } });
      const created = await tx.screenshot.create({ data: { projectId: project.id, objectKey: key, caption, sortOrder: (last?.sortOrder ?? -1) + 1, createdById: auth.actor.id } });
      await tx.storageObject.create({ data: { objectKey: key, provider: storageProviderName(), bucket: process.env.STORAGE_S3_BUCKET, mimeType, size: stored.size, sha256: stored.sha256 } });
      await writeAudit(tx, request, { actorId: auth.actor.id, action: 'project.screenshot.upload', resourceType: 'screenshot', resourceId: created.id, after: { projectId: project.id } });
      return created;
    });
  } catch (error) {
    await adapter.remove(key).catch(() => undefined);
    return jsonError('INTERNAL_ERROR', error instanceof Error ? error.message : '截图索引保存失败。', 503, request);
  }
  return jsonData({ id: screenshot.id, caption: screenshot.caption, sortOrder: screenshot.sortOrder, url: `/api/v1/media/${key.split('/').map(encodeURIComponent).join('/')}` }, request);
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const csrfError = mutationAllowed(request); if (csrfError) return csrfError;
  const { id } = await params; const screenshotId = request.nextUrl.searchParams.get('screenshotId'); if (!screenshotId) return jsonError('VALIDATION_ERROR', '截图 ID 无效。', 422, request);
  const auth = await actorOrResponse(request); if ('response' in auth) return auth.response;
  const screenshot = await auth.db.screenshot.findUnique({ where: { id: screenshotId }, include: { project: { include: { members: true, ownerOrganization: { include: { members: true } } } } } });
  if (!screenshot || (screenshot.project.id !== id && screenshot.project.slug !== id)) return jsonError('NOT_FOUND', '截图不存在。', 404, request);
  if (!canProjectPermission(auth.actor, screenshot.project as never, 'update')) return jsonError('FORBIDDEN', '没有删除项目截图的权限。', 403, request);
  try {
    await auth.db.$transaction(async (tx) => {
      await tx.screenshot.delete({ where: { id: screenshot.id } });
      await tx.storageObject.updateMany({ where: { objectKey: screenshot.objectKey, deletedAt: null }, data: { deletedAt: new Date() } });
      await writeAudit(tx, request, { actorId: auth.actor.id, action: 'project.screenshot.delete', resourceType: 'screenshot', resourceId: screenshot.id, before: { projectId: screenshot.project.id, objectKey: screenshot.objectKey } });
    });
  } catch (error) {
    return jsonError('INTERNAL_ERROR', error instanceof Error ? error.message : '截图删除失败。', 503, request);
  }
  await getStorageAdapter().remove(screenshot.objectKey).catch(() => undefined);
  return jsonData({ removed: true }, request);
}
