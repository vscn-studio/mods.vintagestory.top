import { NextRequest } from 'next/server';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { actorOrResponse, databaseOrResponse, mutationAllowed, officialActorOrResponse } from '@/lib/api-auth';
import { jsonData, jsonError, parsePage } from '@/lib/api-errors';
import { getSessionAccount } from '@/lib/auth-server';
import { canProjectPermission, effectiveOrganizationRole, effectiveProjectRole, getActiveActor, getDatabaseActor, organizationRoleAllows, projectCapabilities } from '@/lib/authorization';
import { auditProjectMutation, projectInclude, projectType, projectVisibility, replaceProjectTaxonomy, serializeProject, slugify } from '@/lib/project-service';

export const runtime = 'nodejs';

const createProjectSchema = z.object({
  type: z.string(),
  name: z.string().trim().min(1).max(120),
  nameEn: z.string().trim().max(120).optional(),
  slug: z.string().trim().min(1).max(100),
  summary: z.string().trim().min(1).max(500),
  summaryEn: z.string().trim().max(500).optional(),
  visibility: z.enum(['public', 'private']).default('public'),
  tags: z.array(z.string().trim().min(1).max(120)).max(24).optional(),
  categories: z.array(z.string().trim().min(1).max(120)).max(16).optional(),
  gameVersions: z.array(z.string().trim().min(1).max(40)).max(32).optional(),
  environments: z.array(z.string().trim().min(1).max(120)).max(16).optional(),
  owner: z.object({ type: z.enum(['personal', 'organization']), id: z.string().trim().min(1).max(100).optional() }).default({ type: 'personal' })
});

export async function GET(request: NextRequest) {
  const database = await databaseOrResponse(request);
  if ('response' in database) return database.response;
  const { db } = database;
  const { page, pageSize } = parsePage(request);
  const url = request.nextUrl;
  const query = (url.searchParams.get('q') ?? '').trim().slice(0, 120);
  const requestedType = projectType(url.searchParams.get('type'));
  const gameVersion = (url.searchParams.get('gameVersion') ?? '').trim().slice(0, 40);
  const category = (url.searchParams.get('category') ?? '').trim().slice(0, 80);
  const environment = (url.searchParams.get('environment') ?? '').trim().slice(0, 80);
  const sort = url.searchParams.get('sort') ?? 'updated';
  const mine = url.searchParams.get('mine') === 'true';
  const session = await getSessionAccount(request);
  const sessionActor = session ? await getDatabaseActor(session.id) : null;
  const actor = getActiveActor(sessionActor);
  const filters: Prisma.ProjectWhereInput[] = [
    { status: 'ACTIVE' },
    { OR: [{ ownerOrganizationId: null }, { ownerOrganization: { is: { archivedAt: null } } }] }
  ];
  if (requestedType) filters.push({ type: requestedType });
  if (gameVersion) filters.push({ gameVersions: { some: { gameVersion: { value: { contains: gameVersion, mode: 'insensitive' } } } } });
  if (category) filters.push({ categories: { some: { category: { OR: [{ slug: category.toLowerCase() }, { name: { contains: category, mode: 'insensitive' } }, { nameEn: { contains: category, mode: 'insensitive' } }] } } } });
  if (environment) filters.push({ environments: { some: { environment: { OR: [{ slug: environment.toLowerCase() }, { name: { contains: environment, mode: 'insensitive' } }, { nameEn: { contains: environment, mode: 'insensitive' } }] } } } });
  if (query) {
    filters.push({ OR: [
      { name: { contains: query, mode: 'insensitive' } },
      { nameEn: { contains: query, mode: 'insensitive' } },
      { summary: { contains: query, mode: 'insensitive' } },
      { summaryEn: { contains: query, mode: 'insensitive' } },
      { slug: { contains: query, mode: 'insensitive' } },
      { tags: { some: { tag: { name: { contains: query, mode: 'insensitive' } } } } },
      { ownerAccount: { displayName: { contains: query, mode: 'insensitive' } } },
      { ownerOrganization: { name: { contains: query, mode: 'insensitive' } } }
    ] });
  }
  if (mine) {
    if (!sessionActor) return jsonError('UNAUTHENTICATED', '请先登录。', 401, request);
    if (!actor) return jsonError('FORBIDDEN', '当前账号不可读取私人资源。', 403, request);
    filters.push({ OR: [{ ownerAccountId: actor.id }, { members: { some: { accountId: actor.id } } }, { ownerOrganization: { is: { ownerId: actor.id } } }, { ownerOrganization: { members: { some: { accountId: actor.id } } } }] });
  } else if (!actor?.siteRoles.includes('ADMIN')) {
    filters.push(actor ? { OR: [{ visibility: 'PUBLIC' }, { ownerAccountId: actor.id }, { members: { some: { accountId: actor.id } } }, { ownerOrganization: { is: { ownerId: actor.id } } }, { ownerOrganization: { members: { some: { accountId: actor.id } } } }] } : { visibility: 'PUBLIC' });
  }
  const where: Prisma.ProjectWhereInput = { AND: filters };
  const orderBy: Prisma.ProjectOrderByWithRelationInput[] = sort === 'published'
    ? [{ createdAt: 'desc' }, { id: 'asc' }]
    : sort === 'name'
      ? [{ name: 'asc' }, { id: 'asc' }]
      : sort === 'downloads'
        ? [{ downloadCount: 'desc' }, { id: 'asc' }]
        : sort === 'followers'
          ? [{ followerCount: 'desc' }, { id: 'asc' }]
          : [{ updatedAt: 'desc' }, { id: 'asc' }];
  const [total, projects] = await Promise.all([
    db.project.count({ where }),
    db.project.findMany({ where, include: projectInclude, orderBy, skip: (page - 1) * pageSize, take: pageSize })
  ]);
  return jsonData(projects.map((project) => {
    const includePrivate = Boolean(actor && (actor.siteRoles.includes('ADMIN') || effectiveProjectRole(actor, project) || project.visibility === 'PRIVATE'));
    const includeUncleanFiles = Boolean(actor && canProjectPermission(actor, project, 'file.manage'));
    const role = actor ? effectiveProjectRole(actor, project) : null;
    return {
      ...serializeProject(project, { includePrivate, includeUncleanFiles }),
      viewer: actor ? { role: role?.toLowerCase() ?? null, capabilities: projectCapabilities(actor, project) } : undefined
    };
  }), request, { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) });
}

export async function POST(request: NextRequest) {
  const csrfError = mutationAllowed(request);
  if (csrfError) return csrfError;
  const auth = await officialActorOrResponse(request);
  if ('response' in auth) return auth.response;
  let parsed: z.infer<typeof createProjectSchema>;
  try {
    parsed = createProjectSchema.parse(await request.json());
  } catch (error) {
    return jsonError('VALIDATION_ERROR', '项目数据无效。', 422, request, error instanceof z.ZodError ? error.issues : undefined);
  }
  const type = projectType(parsed.type);
  if (!type) return jsonError('VALIDATION_ERROR', '项目类型无效。', 422, request);
  const slug = slugify(parsed.slug);
  if (await auth.db.project.findUnique({ where: { slug }, select: { id: true } })) return jsonError('CONFLICT', '项目 URL 已被使用。', 409, request);

  let ownerOrganizationId: string | undefined;
  if (parsed.owner.type === 'organization') {
    if (!parsed.owner.id) return jsonError('VALIDATION_ERROR', '请选择项目所属组织。', 422, request);
    const organization = await auth.db.organization.findFirst({
      where: { OR: [{ id: parsed.owner.id }, { slug: parsed.owner.id }], archivedAt: null },
      include: { members: true }
    });
    const role = organization ? effectiveOrganizationRole(auth.actor, organization) : null;
    if (!organization || !role || !organizationRoleAllows(role, 'project.manage')) return jsonError('FORBIDDEN', '没有在该组织创建项目的权限。', 403, request);
    ownerOrganizationId = organization.id;
  }

  let project;
  try {
    project = await auth.db.$transaction(async (tx) => {
      const created = await tx.project.create({
        data: {
          slug,
          type,
          name: parsed.name,
          nameEn: parsed.nameEn || null,
          summary: parsed.summary,
          summaryEn: parsed.summaryEn || null,
          visibility: projectVisibility(parsed.visibility),
          creatorId: auth.actor.id,
          ownerAccountId: ownerOrganizationId ? null : auth.actor.id,
          ownerOrganizationId: ownerOrganizationId ?? null,
          members: { create: { accountId: auth.actor.id, role: ownerOrganizationId ? 'MAINTAINER' : 'OWNER' } }
        }
      });
      await replaceProjectTaxonomy(tx, created.id, parsed);
      return tx.project.findUniqueOrThrow({ where: { id: created.id }, include: projectInclude });
    });
  } catch (error) {
    if ((error as { code?: string }).code === 'P2002') return jsonError('CONFLICT', '项目 URL 或分类标识已被使用。', 409, request);
    throw error;
  }
  await auditProjectMutation(auth.db, request, auth.actor.id, 'project.create', project.id, { slug: project.slug, type: project.type, visibility: project.visibility });
  return jsonData(serializeProject(project, { includePrivate: true }), request);
}
