import { NextRequest, NextResponse } from 'next/server';
import { optionalActor } from '@/lib/api-auth';
import { canReadProject, getActiveActor } from '@/lib/authorization';
import { jsonError } from '@/lib/api-errors';
import { getStorageAdapter, storageProviderName } from '@/lib/storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
type Params = { params: Promise<{ key: string[] }> };

function decodeObjectKey(parts: string[]): string | null {
  try {
    const decoded = parts.map((part) => decodeURIComponent(part)).join('/');
    if (!decoded || decoded.startsWith('/') || decoded.includes('\\') || decoded.split('/').some((part) => part === '..' || part === '.')) return null;
    return decoded;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest, { params }: Params) {
  const { key } = await params;
  const objectKey = decodeObjectKey(key);
  if (!objectKey) return new NextResponse(null, { status: 404 });
  const auth = await optionalActor(request);
  if ('response' in auth) return auth.response;
  const actor = getActiveActor(auth.actor);

  // Media URLs are intentionally not bearer URLs. Resolve the owning resource
  // first so a leaked/random object key cannot expose private files.
  const mediaUrl = `/api/v1/media/${objectKey.split('/').map(encodeURIComponent).join('/')}`;
  const screenshot = await auth.db.screenshot.findUnique({
    where: { objectKey },
    include: { project: { include: { members: true, ownerOrganization: { include: { members: true } } } } }
  });
  let isPublic = false;
  if (screenshot) {
    if (!canReadProject(actor, screenshot.project as never)) return jsonError('NOT_FOUND', '媒体不存在。', 404, request);
    isPublic = screenshot.project.visibility === 'PUBLIC' && screenshot.project.status === 'ACTIVE' && !screenshot.project.ownerOrganization?.archivedAt;
  } else {
    const [projectIcon, organization, account, object] = await Promise.all([
      auth.db.project.findFirst({ where: { iconUrl: mediaUrl }, include: { members: true, ownerOrganization: { include: { members: true } } } }),
      auth.db.organization.findFirst({ where: { avatarUrl: mediaUrl }, include: { members: true } }),
      auth.db.account.findFirst({ where: { avatarUrl: mediaUrl }, select: { id: true, status: true } }),
      auth.db.storageObject.findUnique({ where: { objectKey }, select: { mimeType: true, deletedAt: true } })
    ]);
    if (projectIcon) {
      if (!canReadProject(actor, projectIcon as never)) return jsonError('NOT_FOUND', '媒体不存在。', 404, request);
      isPublic = projectIcon.visibility === 'PUBLIC' && projectIcon.status === 'ACTIVE' && !projectIcon.ownerOrganization?.archivedAt;
    } else if (organization) {
      const member = Boolean(actor && (organization.ownerId === actor.id || organization.members.some((item) => item.accountId === actor.id)));
      if (organization.archivedAt || (organization.visibility === 'PRIVATE' && !member && !actor?.siteRoles.includes('ADMIN'))) return jsonError('NOT_FOUND', '媒体不存在。', 404, request);
      isPublic = organization.visibility === 'PUBLIC' && !organization.archivedAt;
    } else if (account) {
      if (account.status !== 'ACTIVE') return jsonError('NOT_FOUND', '媒体不存在。', 404, request);
      isPublic = true;
    } else if (!object || object.deletedAt) {
      return jsonError('NOT_FOUND', '媒体不存在。', 404, request);
    } else {
      // Release binaries have a separate, authorization-aware download route;
      // never make arbitrary StorageObject rows readable as media.
      return jsonError('NOT_FOUND', '媒体不存在。', 404, request);
    }
  }

  try {
    const object = await auth.db.storageObject.findUnique({ where: { objectKey }, select: { mimeType: true, deletedAt: true } });
    if (object?.deletedAt) return new NextResponse(null, { status: 404 });
    const signedUrl = await getStorageAdapter().downloadUrl(objectKey);
    if (signedUrl && storageProviderName() !== 'local') return NextResponse.redirect(new URL(signedUrl, request.url), 302);
    const buffer = await getStorageAdapter().get(objectKey);
    const extension = objectKey.split('.').pop()?.toLowerCase();
    const fallbackMime = extension === 'png' ? 'image/png' : extension === 'jpg' || extension === 'jpeg' ? 'image/jpeg' : extension === 'webp' ? 'image/webp' : 'application/octet-stream';
    return new NextResponse(new Uint8Array(buffer), { headers: { 'Content-Type': object?.mimeType ?? fallbackMime, 'Content-Length': String(buffer.byteLength), 'Cache-Control': isPublic ? 'public, max-age=3600' : 'private, no-store' } });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
