import { NextRequest, NextResponse } from 'next/server';
import { optionalActor } from '@/lib/api-auth';
import { jsonError } from '@/lib/api-errors';
import { canReadProject } from '@/lib/authorization';
import { getStorageAdapter, storageProviderName } from '@/lib/storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const auth = await optionalActor(request);
  if ('response' in auth) return auth.response;
  const file = await auth.db.file.findUnique({ where: { id }, include: { release: { include: { project: { include: { members: true, ownerOrganization: { include: { members: true } } } } } } } });
  if (!file || file.scanStatus !== 'CLEAN' || file.release.status !== 'PUBLISHED' || file.release.project.status !== 'ACTIVE' || !canReadProject(auth.actor, file.release.project as never)) return jsonError('NOT_FOUND', '文件不存在。', 404, request);
  const adapter = getStorageAdapter();
  let url: string | null = null;
  let buffer: Buffer | null = null;
  try {
    url = await adapter.downloadUrl(file.objectKey);
    if (!url || storageProviderName() === 'local') buffer = await adapter.get(file.objectKey);
  } catch {
    return jsonError('NOT_FOUND', '文件不存在。', 404, request);
  }
  await auth.db.$transaction([
    auth.db.file.update({ where: { id: file.id }, data: { downloads: { increment: 1 } } }),
    auth.db.project.update({ where: { id: file.release.project.id }, data: { downloadCount: { increment: 1 } } })
  ]);
  if (url && storageProviderName() !== 'local') return NextResponse.redirect(new URL(url, request.url), 302);
  if (buffer) {
    return new NextResponse(new Uint8Array(buffer), { headers: { 'Content-Type': file.mimeType, 'Content-Length': String(buffer.byteLength), 'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`, 'Cache-Control': 'private, no-store' } });
  }
  return jsonError('NOT_FOUND', '文件不存在。', 404, request);
}
