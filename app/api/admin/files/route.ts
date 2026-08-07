import { NextRequest } from 'next/server';
import { adminOrResponse } from '@/lib/admin-auth';
import { jsonData, parsePage } from '@/lib/api-errors';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const auth = await adminOrResponse(request);
  if ('response' in auth) return auth.response;
  const { page, pageSize } = parsePage(request);
  const query = (request.nextUrl.searchParams.get('q') ?? '').trim().slice(0, 120);
  const scanStatus = request.nextUrl.searchParams.get('scanStatus')?.toUpperCase();
  const where = {
    ...(query ? { OR: [{ name: { contains: query, mode: 'insensitive' as const } }, { release: { project: { name: { contains: query, mode: 'insensitive' as const } } } }] } : {}),
    ...(scanStatus && ['PENDING', 'CLEAN', 'QUARANTINED', 'FAILED'].includes(scanStatus) ? { scanStatus: scanStatus as 'PENDING' | 'CLEAN' | 'QUARANTINED' | 'FAILED' } : {})
  };
  const [total, files] = await Promise.all([
    auth.db.file.count({ where }),
    auth.db.file.findMany({ where, include: { release: { include: { project: { select: { id: true, slug: true, name: true } } } }, uploadedBy: { select: { id: true, username: true, displayName: true } } }, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize })
  ]);
  return jsonData(files.map((file) => ({ id: file.id, name: file.name, mimeType: file.mimeType, size: Number(file.size), sha256: file.sha256, scanStatus: file.scanStatus.toLowerCase(), downloads: file.downloads, release: { id: file.release.id, version: file.release.version }, project: file.release.project, uploadedBy: file.uploadedBy, createdAt: file.createdAt.toISOString(), updatedAt: file.updatedAt.toISOString() })), request, { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) });
}
