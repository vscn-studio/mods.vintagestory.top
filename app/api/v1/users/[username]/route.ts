import { NextRequest } from 'next/server';
import type { Prisma } from '@prisma/client';
import { databaseOrResponse, optionalActor } from '@/lib/api-auth';
import { jsonData, jsonError, parsePage } from '@/lib/api-errors';
import { profileProjectInclude, projectType, serializeProfileProject } from '@/lib/project-service';
import { getActiveActor } from '@/lib/authorization';

export const runtime = 'nodejs';
type Params = { params: Promise<{ username: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { username } = await params;
  const database = await databaseOrResponse(request);
  if ('response' in database) return database.response;
  const session = await optionalActor(request);
  if ('response' in session) return session.response;
  const actor = getActiveActor(session.actor);
  const { page, pageSize } = parsePage(request);
  const requestedType = request.nextUrl.searchParams.get('type');
  const type = projectType(requestedType);
  if (requestedType && !type) return jsonError('VALIDATION_ERROR', '项目类型无效。', 422, request);
  const organizationAccess = actor?.siteRoles.includes('ADMIN')
    ? { archivedAt: null }
    : {
        archivedAt: null,
        OR: [
          { visibility: 'PUBLIC' as const },
          ...(actor ? [{ ownerId: actor.id }, { members: { some: { accountId: actor.id } } }] : [])
        ]
      };
  const account = await database.db.account.findUnique({
    where: { username },
    include: {
      organizationMemberships: { where: { organization: organizationAccess }, include: { organization: true } },
      ownedOrganizations: { where: organizationAccess }
    }
  });
  if (!account || account.status !== 'ACTIVE') return jsonError('NOT_FOUND', '用户不存在。', 404, request);

  const profileProjects: Prisma.ProjectWhereInput = {
    ownerAccountId: account.id,
    ownerOrganizationId: null,
    status: 'ACTIVE',
    ...(actor?.siteRoles.includes('ADMIN')
      ? {}
      : actor
        ? { OR: [{ visibility: 'PUBLIC' }, { ownerAccountId: actor.id }, { members: { some: { accountId: actor.id } } }] }
        : { visibility: 'PUBLIC' })
  };
  const projectPage: Prisma.ProjectWhereInput = type ? { AND: [profileProjects, { type }] } : profileProjects;
  const [total, projectStats, projects] = await Promise.all([
    database.db.project.count({ where: projectPage }),
    database.db.project.aggregate({ where: profileProjects, _count: { _all: true }, _sum: { downloadCount: true, followerCount: true } }),
    database.db.project.findMany({
      where: projectPage,
      include: profileProjectInclude,
      orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
      skip: (page - 1) * pageSize,
      take: pageSize
    })
  ]);
  const organizations = new Map<string, { slug: string; name: string; role: string }>();
  for (const membership of account.organizationMemberships) {
    organizations.set(membership.organization.id, { slug: membership.organization.slug, name: membership.organization.name, role: membership.organization.ownerId === account.id ? 'owner' : membership.role.toLowerCase() });
  }
  for (const organization of account.ownedOrganizations) {
    organizations.set(organization.id, { slug: organization.slug, name: organization.name, role: 'owner' });
  }
  return jsonData({
    id: account.id,
    username: account.username,
    displayName: account.displayName,
    bio: account.bio ?? '',
    avatarUrl: account.avatarUrl,
    projects: projects.map(serializeProfileProject),
    projectStats: {
      projects: projectStats._count._all,
      downloads: projectStats._sum.downloadCount ?? 0,
      followers: projectStats._sum.followerCount ?? 0
    },
    organizations: [...organizations.values()],
    createdAt: account.createdAt.toISOString()
  }, request, { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) });
}
