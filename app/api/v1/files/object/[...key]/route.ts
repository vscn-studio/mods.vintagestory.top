import { NextRequest, NextResponse } from 'next/server';
import { optionalActor } from '@/lib/api-auth';
import { jsonError } from '@/lib/api-errors';
import { canReadProject } from '@/lib/authorization';
import { getStorageAdapter } from '@/lib/storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
type Params = { params: Promise<{ key: string[] }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { key } = await params;
  let objectKey: string;
  try {
    objectKey = key.map(decodeURIComponent).join('/');
  } catch {
    return new NextResponse(null, { status: 404 });
  }
  if (!objectKey || objectKey.startsWith('/') || objectKey.includes('\\') || objectKey.split('/').some((part) => part === '..' || part === '.')) return new NextResponse(null, { status: 404 });
  const auth = await optionalActor(request); if ('response' in auth) return auth.response;
  const file = await auth.db.file.findUnique({ where: { objectKey }, include: { release: { include: { project: { include: { members: true, ownerOrganization: { include: { members: true } } } } } } } });
  if (!file || file.scanStatus !== 'CLEAN' || file.release.status !== 'PUBLISHED' || file.release.project.status !== 'ACTIVE' || !canReadProject(auth.actor, file.release.project as never)) return jsonError('NOT_FOUND', '文件不存在。', 404, request);
  try { const buffer = await getStorageAdapter().get(objectKey); return new NextResponse(new Uint8Array(buffer), { headers: { 'Content-Type': file.mimeType, 'Content-Length': String(buffer.byteLength), 'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`, 'Cache-Control': 'private, no-store' } }); } catch { return jsonError('NOT_FOUND', '文件不存在。', 404, request); }
}
