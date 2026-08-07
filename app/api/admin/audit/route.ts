import { NextRequest } from 'next/server';
import { reviewerOrResponse } from '@/lib/admin-auth';
import { jsonData, parsePage } from '@/lib/api-errors';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const auth = await reviewerOrResponse(request); if ('response' in auth) return auth.response;
  const { page, pageSize } = parsePage(request);
  const action = request.nextUrl.searchParams.get('action')?.trim().slice(0, 120);
  const resourceType = request.nextUrl.searchParams.get('resourceType')?.trim().slice(0, 80);
  const actorId = request.nextUrl.searchParams.get('actorId')?.trim().slice(0, 64);
  const direction = request.nextUrl.searchParams.get('sort') === 'asc' ? 'asc' : 'desc';
  const where = { ...(action ? { action: { contains: action, mode: 'insensitive' as const } } : {}), ...(resourceType ? { resourceType } : {}), ...(actorId ? { actorId } : {}) };
  const [total, logs] = await Promise.all([
    auth.db.auditLog.count({ where }),
    auth.db.auditLog.findMany({ where, include: { actor: { select: { id: true, username: true, displayName: true } } }, orderBy: { createdAt: direction }, skip: (page - 1) * pageSize, take: pageSize })
  ]);
  return jsonData(logs.map((log) => ({ id: log.id, action: log.action, resourceType: log.resourceType, resourceId: log.resourceId, actor: log.actor, before: log.before, after: log.after, ipAddress: log.ipAddress, createdAt: log.createdAt.toISOString() })), request, { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) });
}
