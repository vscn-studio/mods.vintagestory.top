import { NextRequest } from 'next/server';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { actorOrResponse, mutationAllowed, optionalActor } from '@/lib/api-auth';
import { jsonData, jsonError, parsePage } from '@/lib/api-errors';
import { writeAudit } from '@/lib/audit';
import { effectiveOrganizationRole, getActiveActor, organizationCapabilities, organizationRoleAllows } from '@/lib/authorization';
import { profileProjectInclude, projectType, serializeProfileProject } from '@/lib/project-service';

export const runtime = 'nodejs';
type Params = { params: Promise<{ slug: string }> };
const updateSchema = z.object({ name: z.string().trim().min(1).max(120).optional(), description: z.string().max(2000).nullable().optional(), visibility: z.enum(['public', 'private']).optional() });

function output(organization: any, projects: any[] = [], projectStats?: { projects: number; downloads: number; followers: number }, includeMembers = true, actor?: any) {
  const members = includeMembers ? organization.members.map((member: any) => ({ id: member.account.id, username: member.account.username, name: member.account.displayName, avatarUrl: member.account.avatarUrl, role: member.role.toLowerCase() })) : [];
  if (includeMembers && !members.some((member: { id: string }) => member.id === organization.owner.id)) {
    members.unshift({ id: organization.owner.id, username: organization.owner.username, name: organization.owner.displayName, avatarUrl: organization.owner.avatarUrl, role: 'owner' });
  }
  const role = actor ? effectiveOrganizationRole(actor, organization) : null;
  return {
    id: organization.id,
    slug: organization.slug,
    name: organization.name,
    description: organization.description,
    avatarUrl: organization.avatarUrl,
    visibility: organization.visibility.toLowerCase(),
    owner: { id: organization.owner.id, username: organization.owner.username, name: organization.owner.displayName },
    members,
    projects: projects.map(serializeProfileProject),
    projectStats: projectStats ?? { projects: 0, downloads: 0, followers: 0 },
    viewer: actor ? { role: role?.toLowerCase() ?? null, capabilities: organizationCapabilities(actor, organization) } : undefined,
    createdAt: organization.createdAt.toISOString(),
    updatedAt: organization.updatedAt.toISOString()
  };
}

export async function GET(request: NextRequest, { params }: Params) {
  const { slug } = await params;
  const auth = await optionalActor(request);
  if ('response' in auth) return auth.response;
  const { page, pageSize } = parsePage(request);
  const requestedType = request.nextUrl.searchParams.get('type');
  const type = projectType(requestedType);
  if (requestedType && !type) return jsonError('VALIDATION_ERROR', '项目类型无效。', 422, request);
  const organization = await auth.db.organization.findUnique({ where: { slug }, include: { owner: true, members: { include: { account: true } } } });
  if (!organization || organization.archivedAt) return jsonError('NOT_FOUND', '组织不存在。', 404, request);
  const actor = getActiveActor(auth.actor);
  const member = Boolean(actor && effectiveOrganizationRole(actor, organization));
  if (organization.visibility === 'PRIVATE' && !member && !actor?.siteRoles.includes('ADMIN')) return jsonError('NOT_FOUND', '组织不存在。', 404, request);
  const privateProjectAccess: Prisma.ProjectWhereInput = actor?.siteRoles.includes('ADMIN') || member
    ? {}
    : actor
      ? { OR: [{ visibility: 'PUBLIC' }, { members: { some: { accountId: actor.id } } }] }
      : { visibility: 'PUBLIC' };
  const profileProjects: Prisma.ProjectWhereInput = {
    ownerOrganizationId: organization.id,
    status: 'ACTIVE',
    ...privateProjectAccess
  };
  const projectPage: Prisma.ProjectWhereInput = type ? { AND: [profileProjects, { type }] } : profileProjects;
  const [total, projectStats, projects] = await Promise.all([
    auth.db.project.count({ where: projectPage }),
    auth.db.project.aggregate({ where: profileProjects, _count: { _all: true }, _sum: { downloadCount: true, followerCount: true } }),
    auth.db.project.findMany({
      where: projectPage,
      include: profileProjectInclude,
      orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
      skip: (page - 1) * pageSize,
      take: pageSize
    })
  ]);
  return jsonData(output(organization, projects, {
    projects: projectStats._count._all,
    downloads: projectStats._sum.downloadCount ?? 0,
    followers: projectStats._sum.followerCount ?? 0
  }, true, actor), request, { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const csrfError = mutationAllowed(request);
  if (csrfError) return csrfError;
  const { slug } = await params;
  const auth = await actorOrResponse(request);
  if ('response' in auth) return auth.response;
  const organization = await auth.db.organization.findUnique({ where: { slug }, include: { owner: true, members: { include: { account: true } } } });
  if (!organization || organization.archivedAt) return jsonError('NOT_FOUND', '组织不存在。', 404, request);
  const role = effectiveOrganizationRole(auth.actor, organization);
  if (!role || !organizationRoleAllows(role, 'manage')) return jsonError('FORBIDDEN', '没有编辑组织设置的权限。', 403, request);
  let input: z.infer<typeof updateSchema>;
  try { input = updateSchema.parse(await request.json()); } catch { return jsonError('VALIDATION_ERROR', '组织资料无效。', 422, request); }
  const updated = await auth.db.organization.update({ where: { id: organization.id }, data: { ...(input.name === undefined ? {} : { name: input.name }), ...(input.description === undefined ? {} : { description: input.description }), ...(input.visibility === undefined ? {} : { visibility: input.visibility === 'private' ? 'PRIVATE' : 'PUBLIC' }) }, include: { owner: true, members: { include: { account: true } } } });
  await writeAudit(auth.db, request, { actorId: auth.actor.id, action: 'organization.update', resourceType: 'organization', resourceId: organization.id, before: { name: organization.name, visibility: organization.visibility }, after: { name: updated.name, visibility: updated.visibility } });
  const projectStats = await auth.db.project.aggregate({
    where: { ownerOrganizationId: updated.id, status: 'ACTIVE' },
    _count: { _all: true },
    _sum: { downloadCount: true, followerCount: true }
  });
  return jsonData(output(updated, [], {
    projects: projectStats._count._all,
    downloads: projectStats._sum.downloadCount ?? 0,
    followers: projectStats._sum.followerCount ?? 0
  }, true, auth.actor), request);
}
