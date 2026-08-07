import { NextRequest } from 'next/server';
import { adminOrResponse } from '@/lib/admin-auth';
import { jsonData, jsonError, parsePage } from '@/lib/api-errors';
import { adminMutationError, requireConfirmation } from '@/lib/admin-auth';
import { writeAudit } from '@/lib/audit';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const auth = await adminOrResponse(request); if ('response' in auth) return auth.response;
  const { page, pageSize } = parsePage(request);
  const query = (request.nextUrl.searchParams.get('q') ?? '').trim().slice(0, 120);
  const where = query ? { OR: [{ name: { contains: query, mode: 'insensitive' as const } }, { slug: { contains: query, mode: 'insensitive' as const } }, { owner: { username: { contains: query, mode: 'insensitive' as const } } }] } : {};
  const [total, organizations] = await Promise.all([
    auth.db.organization.count({ where }),
    auth.db.organization.findMany({ where, include: { owner: true, members: true, projects: { select: { id: true } } }, orderBy: { updatedAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize })
  ]);
  return jsonData(organizations.map((organization) => ({ id: organization.id, slug: organization.slug, name: organization.name, owner: { id: organization.owner.id, username: organization.owner.username }, members: organization.members.length, projects: organization.projects.length, visibility: organization.visibility.toLowerCase(), archived: Boolean(organization.archivedAt), status: organization.archivedAt ? 'archived' : 'active', updatedAt: organization.updatedAt.toISOString() })), request, { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) });
}

export async function PATCH(request: NextRequest) {
  const csrfError = adminMutationError(request); if (csrfError) return csrfError;
  const auth = await adminOrResponse(request); if ('response' in auth) return auth.response;
  const body = await request.json().catch(() => ({})) as { organizationId?: string; name?: string; description?: string | null; visibility?: 'PUBLIC' | 'PRIVATE'; archived?: boolean };
  if (!body.organizationId || (!body.name && body.description === undefined && !body.visibility && body.archived === undefined)) return jsonError('VALIDATION_ERROR', '组织管理数据无效。', 422, request);
  const organization = await auth.db.organization.findUnique({ where: { id: body.organizationId } }); if (!organization) return jsonError('NOT_FOUND', '组织不存在。', 404, request);
  if (body.archived !== undefined) {
    const confirmationError = await requireConfirmation(request, auth.db, auth.actor.id, { action: 'admin.organization.update', resourceType: 'organization', resourceId: organization.id });
    if (confirmationError) return confirmationError;
  }
  const data = {
    ...(body.name ? { name: body.name.trim().slice(0, 120) } : {}),
    ...(body.description === undefined ? {} : { description: body.description }),
    ...(body.visibility ? { visibility: body.visibility } : {}),
    ...(body.archived === undefined ? {} : { archivedAt: body.archived ? new Date() : null })
  };
  const updated = await auth.db.organization.update({ where: { id: organization.id }, data });
  await writeAudit(auth.db, request, { actorId: auth.actor.id, action: 'admin.organization.update', resourceType: 'organization', resourceId: organization.id, before: { name: organization.name, visibility: organization.visibility, archivedAt: organization.archivedAt }, after: { name: updated.name, visibility: updated.visibility, archivedAt: updated.archivedAt } });
  return jsonData({ id: updated.id, slug: updated.slug, archived: Boolean(updated.archivedAt), visibility: updated.visibility.toLowerCase() }, request);
}
