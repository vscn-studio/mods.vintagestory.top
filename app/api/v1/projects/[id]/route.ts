import { NextRequest } from 'next/server';
import { z } from 'zod';
import { actorOrResponse, mutationAllowed, optionalActor } from '@/lib/api-auth';
import { jsonData, jsonError } from '@/lib/api-errors';
import { canProjectPermission, canReadProject, effectiveProjectRole, getActiveActor, projectCapabilities } from '@/lib/authorization';
import { auditProjectMutation, findProject, projectInclude, replaceProjectTaxonomy, serializeProject } from '@/lib/project-service';
import { requireConfirmation } from '@/lib/admin-auth';

export const runtime = 'nodejs';

const updateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  nameEn: z.string().trim().max(120).nullable().optional(),
  summary: z.string().trim().min(1).max(500).optional(),
  summaryEn: z.string().trim().max(500).nullable().optional(),
  description: z.string().max(100_000).nullable().optional(),
  descriptionEn: z.string().max(100_000).nullable().optional(),
  visibility: z.enum(['public', 'private']).optional(),
  license: z.string().max(120).nullable().optional(),
  repositoryUrl: z.string().url().max(2048).nullable().optional(),
  issueUrl: z.string().url().max(2048).nullable().optional(),
  wikiUrl: z.string().url().max(2048).nullable().optional(),
  discordUrl: z.string().url().max(2048).nullable().optional(),
  sponsorUrl: z.string().url().max(2048).nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(120)).max(24).optional(),
  categories: z.array(z.string().trim().min(1).max(120)).max(16).optional(),
  gameVersions: z.array(z.string().trim().min(1).max(40)).max(32).optional(),
  environments: z.array(z.string().trim().min(1).max(120)).max(16).optional()
});

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const auth = await optionalActor(request);
  if ('response' in auth) return auth.response;
  const db = auth.db;
  const project = await findProject(db, id);
  if (!project) return jsonError('NOT_FOUND', '项目不存在。', 404, request);
  const actor = getActiveActor(auth.actor);
  const readable = canReadProject(actor, project as never);
  if (!readable) return jsonError('NOT_FOUND', '项目不存在。', 404, request);
  const [following, favorited] = actor ? await Promise.all([
    db.follow.findUnique({ where: { accountId_projectId: { accountId: actor.id, projectId: project.id } }, select: { projectId: true } }),
    db.favorite.findUnique({ where: { accountId_projectId: { accountId: actor.id, projectId: project.id } }, select: { projectId: true } })
  ]) : [null, null];
  const includePrivate = Boolean(actor && (actor.siteRoles.includes('ADMIN') || effectiveProjectRole(actor, project as never)));
  const includeUncleanFiles = Boolean(actor && canProjectPermission(actor, project as never, 'file.manage'));
  const role = actor ? effectiveProjectRole(actor, project as never) : null;
  return jsonData({
    ...serializeProject(project, { includePrivate, includeUncleanFiles }),
    viewer: {
      following: Boolean(following),
      favorited: Boolean(favorited),
      role: role?.toLowerCase() ?? null,
      capabilities: actor ? projectCapabilities(actor, project as never) : []
    }
  }, request);
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const csrfError = mutationAllowed(request);
  if (csrfError) return csrfError;
  const { id } = await params;
  const auth = await actorOrResponse(request);
  if ('response' in auth) return auth.response;
  const project = await findProject(auth.db, id);
  if (!project) return jsonError('NOT_FOUND', '项目不存在。', 404, request);
  if (!canProjectPermission(auth.actor, project as never, 'update')) return jsonError('FORBIDDEN', '没有编辑项目的权限。', 403, request);
  let parsed: z.infer<typeof updateSchema>;
  try {
    parsed = updateSchema.parse(await request.json());
  } catch (error) {
    return jsonError('VALIDATION_ERROR', '项目资料无效。', 422, request, error instanceof z.ZodError ? error.issues : undefined);
  }
  const before = { name: project.name, summary: project.summary, visibility: project.visibility, updatedAt: project.updatedAt.toISOString() };
  const updated = await auth.db.$transaction(async (tx) => {
    await tx.project.update({ where: { id: project.id }, data: {
      ...(parsed.name === undefined ? {} : { name: parsed.name }),
      ...(parsed.nameEn === undefined ? {} : { nameEn: parsed.nameEn }),
      ...(parsed.summary === undefined ? {} : { summary: parsed.summary }),
      ...(parsed.summaryEn === undefined ? {} : { summaryEn: parsed.summaryEn }),
      ...(parsed.description === undefined ? {} : { description: parsed.description }),
      ...(parsed.descriptionEn === undefined ? {} : { descriptionEn: parsed.descriptionEn }),
      ...(parsed.visibility === undefined ? {} : { visibility: parsed.visibility === 'private' ? 'PRIVATE' : 'PUBLIC' }),
      ...(parsed.license === undefined ? {} : { license: parsed.license }),
      ...(parsed.repositoryUrl === undefined ? {} : { repositoryUrl: parsed.repositoryUrl }),
      ...(parsed.issueUrl === undefined ? {} : { issueUrl: parsed.issueUrl }),
      ...(parsed.wikiUrl === undefined ? {} : { wikiUrl: parsed.wikiUrl }),
      ...(parsed.discordUrl === undefined ? {} : { discordUrl: parsed.discordUrl }),
      ...(parsed.sponsorUrl === undefined ? {} : { sponsorUrl: parsed.sponsorUrl })
    } });
    await replaceProjectTaxonomy(tx, project.id, parsed);
    return tx.project.findUniqueOrThrow({ where: { id: project.id }, include: projectInclude });
  });
  await auditProjectMutation(auth.db, request, auth.actor.id, 'project.update', project.id, { name: updated.name, visibility: updated.visibility }, before);
  return jsonData(serializeProject(updated, { includePrivate: true, includeUncleanFiles: true }), request);
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const csrfError = mutationAllowed(request);
  if (csrfError) return csrfError;
  const { id } = await params;
  const auth = await actorOrResponse(request);
  if ('response' in auth) return auth.response;
  const project = await findProject(auth.db, id);
  if (!project) return jsonError('NOT_FOUND', '项目不存在。', 404, request);
  if (!canProjectPermission(auth.actor, project as never, 'archive')) return jsonError('FORBIDDEN', '只有项目 Owner 可以归档项目。', 403, request);
  const confirmationError = await requireConfirmation(request, auth.db, auth.actor.id, { action: 'project.archive', resourceType: 'project', resourceId: project.id });
  if (confirmationError) return confirmationError;
  const archived = await auth.db.project.update({ where: { id: project.id }, data: { status: 'ARCHIVED', archivedAt: new Date() }, include: projectInclude });
  await auditProjectMutation(auth.db, request, auth.actor.id, 'project.archive', project.id, { status: 'ARCHIVED' }, { status: project.status });
  return jsonData(serializeProject(archived, { includePrivate: true, includeUncleanFiles: true }), request);
}
