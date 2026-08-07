import { NextRequest } from 'next/server';
import { adminOrResponse, adminMutationError, requireConfirmation } from '@/lib/admin-auth';
import { jsonData, jsonError, parsePage } from '@/lib/api-errors';
import { writeAudit } from '@/lib/audit';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const auth = await adminOrResponse(request); if ('response' in auth) return auth.response;
  const { page, pageSize } = parsePage(request);
  const query = (request.nextUrl.searchParams.get('q') ?? '').trim().slice(0, 120);
  const status = request.nextUrl.searchParams.get('status')?.toUpperCase();
  const type = request.nextUrl.searchParams.get('type')?.toUpperCase();
  const where = { ...(query ? { OR: [{ name: { contains: query, mode: 'insensitive' as const } }, { slug: { contains: query, mode: 'insensitive' as const } }, { ownerAccount: { username: { contains: query, mode: 'insensitive' as const } } }, { ownerOrganization: { name: { contains: query, mode: 'insensitive' as const } } }] } : {}), ...(status && ['ACTIVE', 'ARCHIVED'].includes(status) ? { status: status as 'ACTIVE' | 'ARCHIVED' } : {}), ...(type && ['MOD', 'MODPACK', 'THEME_PACK', 'SERVER'].includes(type) ? { type: type as 'MOD' | 'MODPACK' | 'THEME_PACK' | 'SERVER' } : {}) };
  const [total, projects] = await Promise.all([
    auth.db.project.count({ where }),
    auth.db.project.findMany({ where, include: { ownerAccount: true, ownerOrganization: true, releases: { select: { status: true } } }, orderBy: { updatedAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize })
  ]);
  return jsonData(projects.map((project) => ({ id: project.id, slug: project.slug, name: project.name, type: project.type.toLowerCase(), visibility: project.visibility.toLowerCase(), status: project.status.toLowerCase(), owner: project.ownerOrganization?.slug ?? project.ownerAccount?.username ?? null, releases: project.releases.length, updatedAt: project.updatedAt.toISOString() })), request, { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) });
}

export async function PATCH(request: NextRequest) {
  const csrfError = adminMutationError(request); if (csrfError) return csrfError;
  const auth = await adminOrResponse(request); if ('response' in auth) return auth.response;
  const body = await request.json().catch(() => ({})) as { projectId?: string; status?: 'ACTIVE' | 'ARCHIVED'; visibility?: 'PUBLIC' | 'PRIVATE' };
  if (!body.projectId || (!body.status && !body.visibility)) return jsonError('VALIDATION_ERROR', '项目管理数据无效。', 422, request);
  const project = await auth.db.project.findUnique({ where: { id: body.projectId } }); if (!project) return jsonError('NOT_FOUND', '项目不存在。', 404, request);
  const confirmationError = await requireConfirmation(request, auth.db, auth.actor.id, { action: 'admin.project.update', resourceType: 'project', resourceId: project.id }); if (confirmationError) return confirmationError;
  const updated = await auth.db.project.update({ where: { id: project.id }, data: { ...(body.status ? { status: body.status, archivedAt: body.status === 'ARCHIVED' ? new Date() : null } : {}), ...(body.visibility ? { visibility: body.visibility } : {}) } });
  await writeAudit(auth.db, request, { actorId: auth.actor.id, action: 'admin.project.update', resourceType: 'project', resourceId: project.id, before: { status: project.status, visibility: project.visibility }, after: { status: updated.status, visibility: updated.visibility } });
  return jsonData({ id: updated.id, status: updated.status.toLowerCase(), visibility: updated.visibility.toLowerCase() }, request);
}
