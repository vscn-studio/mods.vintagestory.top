import { NextRequest } from 'next/server';
import { z } from 'zod';
import { officialActorOrResponse, mutationAllowed, databaseOrResponse, optionalActor } from '@/lib/api-auth';
import { jsonData, jsonError, parsePage } from '@/lib/api-errors';
import { effectiveOrganizationRole, getActiveActor, organizationCapabilities, organizationRoleAllows } from '@/lib/authorization';
import { writeAudit } from '@/lib/audit';

export const runtime = 'nodejs';
const createSchema = z.object({ slug: z.string().trim().min(2).max(80).regex(/^[a-z0-9][a-z0-9-]*$/), name: z.string().trim().min(1).max(120), description: z.string().max(2000).optional(), visibility: z.enum(['public', 'private']).default('public') });

function serializeOrganization(organization: any, includeMembers = true, canSeePrivateProjects = false, actor?: any) {
  const members = includeMembers
    ? organization.members?.map((member: any) => ({ id: member.account.id, username: member.account.username, name: member.account.displayName, avatarUrl: member.account.avatarUrl, role: member.role.toLowerCase() })) ?? []
    : [];
  if (includeMembers && organization.owner && !members.some((member: { id: string }) => member.id === organization.owner.id)) {
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
    owner: organization.owner ? { id: organization.owner.id, username: organization.owner.username, name: organization.owner.displayName } : null,
    members,
    projects: organization.projects?.filter((project: any) => canSeePrivateProjects || project.visibility === 'PUBLIC').map((project: any) => ({ id: project.id, slug: project.slug, name: project.name, type: project.type.toLowerCase() })) ?? [],
    viewer: actor ? { role: role?.toLowerCase() ?? null, capabilities: organizationCapabilities(actor, organization) } : undefined,
    createdAt: organization.createdAt.toISOString(),
    updatedAt: organization.updatedAt.toISOString()
  };
}

export async function GET(request: NextRequest) {
  const database = await databaseOrResponse(request);
  if ('response' in database) return database.response;
  const { page, pageSize } = parsePage(request);
  const mine = request.nextUrl.searchParams.get('mine') === 'true';
  const session = await optionalActor(request);
  if ('response' in session) return session.response;
  const actor = getActiveActor(session.actor);
  if (mine && !session.actor) return jsonError('UNAUTHENTICATED', '请先登录。', 401, request);
  if (mine && !actor) return jsonError('FORBIDDEN', '当前账号不可读取私人资源。', 403, request);
  const ownedOrMember = actor ? [{ ownerId: actor.id }, { members: { some: { accountId: actor.id } } }] : [];
  const where = mine
    ? { archivedAt: null, OR: ownedOrMember }
    : actor?.siteRoles.includes('ADMIN')
      ? { archivedAt: null }
      : actor
        ? { archivedAt: null, OR: [{ visibility: 'PUBLIC' as const }, ...ownedOrMember] }
        : { archivedAt: null, visibility: 'PUBLIC' as const };
  const [total, organizations] = await Promise.all([
    database.db.organization.count({ where }),
    database.db.organization.findMany({ where, include: { owner: true, members: { include: { account: true } }, projects: { where: { status: 'ACTIVE' }, select: { id: true, slug: true, name: true, type: true } } }, orderBy: { updatedAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize })
  ]);
  return jsonData(organizations.map((organization) => {
    const canSeePrivateProjects = Boolean(actor && (actor.siteRoles.includes('ADMIN') || effectiveOrganizationRole(actor, organization)));
    return serializeOrganization(organization, true, canSeePrivateProjects, actor);
  }), request, { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) });
}

export async function POST(request: NextRequest) {
  const csrfError = mutationAllowed(request);
  if (csrfError) return csrfError;
  const auth = await officialActorOrResponse(request);
  if ('response' in auth) return auth.response;
  let input: z.infer<typeof createSchema>;
  try { input = createSchema.parse(await request.json()); } catch (error) { return jsonError('VALIDATION_ERROR', '组织数据无效。', 422, request, error instanceof z.ZodError ? error.issues : undefined); }
  if (await auth.db.organization.findUnique({ where: { slug: input.slug }, select: { id: true } })) return jsonError('CONFLICT', '组织 URL 已被使用。', 409, request);
  let organization;
  try {
    organization = await auth.db.organization.create({ data: { slug: input.slug, name: input.name, description: input.description, visibility: input.visibility === 'private' ? 'PRIVATE' : 'PUBLIC', ownerId: auth.actor.id, members: { create: { accountId: auth.actor.id, role: 'OWNER' } } }, include: { owner: true, members: { include: { account: true } }, projects: true } });
  } catch (error) {
    if ((error as { code?: string }).code === 'P2002') return jsonError('CONFLICT', '组织 URL 已被使用。', 409, request);
    throw error;
  }
  await writeAudit(auth.db, request, { actorId: auth.actor.id, action: 'organization.create', resourceType: 'organization', resourceId: organization.id, after: { slug: organization.slug, visibility: organization.visibility } });
  return jsonData(serializeOrganization(organization, true, true, auth.actor), request);
}
