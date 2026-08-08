import { NextRequest } from 'next/server';
import { z } from 'zod';
import { actorOrResponse, mutationAllowed, optionalActor } from '@/lib/api-auth';
import { jsonData, jsonError } from '@/lib/api-errors';
import { canProjectPermission, canReadProject, effectiveProjectRole, getActiveActor } from '@/lib/authorization';
import { sanitizeChangelog } from '@/lib/changelog';
import { MAX_RELEASE_COMPATIBLE_VERSIONS } from '@/lib/game-versions';
import { findProject, serializeProject } from '@/lib/project-service';
import { writeAudit } from '@/lib/audit';

export const runtime = 'nodejs';
type Params = { params: Promise<{ id: string }> };

const releaseSchema = z.object({
  version: z.string().trim().min(1).max(80).regex(/^v?\d+(?:\.\d+){0,3}(?:[-+][0-9A-Za-z.-]+)?$/),
  changelog: z.string().max(100_000).optional(),
  compatibleVersions: z.array(z.string().trim().min(1).max(40)).max(MAX_RELEASE_COMPATIBLE_VERSIONS).default([]),
  environments: z.array(z.string().trim().min(1).max(80)).max(16).default([])
});

export async function GET(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const auth = await optionalActor(request);
  if ('response' in auth) return auth.response;
  const project = await findProject(auth.db, id);
  const actor = getActiveActor(auth.actor);
  if (!project || !canReadProject(actor, project as never)) return jsonError('NOT_FOUND', '项目不存在。', 404, request);
  const canPrivate = Boolean(actor && (actor.siteRoles.includes('ADMIN') || effectiveProjectRole(actor, project as never)));
  const canSeeUnclean = Boolean(actor && canProjectPermission(actor, project as never, 'file.manage'));
  const releases = project.releases.filter((release) => canPrivate || release.status === 'PUBLISHED').map((release) => ({
    id: release.id,
    version: release.version,
    changelog: sanitizeChangelog(release.changelog),
    status: release.status.toLowerCase(),
    compatibleVersions: release.compatibleVersions ?? [],
    environments: release.environments ?? [],
    publishedAt: release.publishedAt?.toISOString() ?? null,
    updatedAt: release.updatedAt.toISOString(),
    files: release.files.filter((file) => file.scanStatus === 'CLEAN' || canSeeUnclean).map((file) => ({ id: file.id, name: file.name, size: Number(file.size), mimeType: file.mimeType, downloads: file.downloads, scanStatus: file.scanStatus.toLowerCase() }))
  }));
  return jsonData(releases, request);
}

export async function POST(request: NextRequest, { params }: Params) {
  const csrfError = mutationAllowed(request);
  if (csrfError) return csrfError;
  const { id } = await params;
  const auth = await actorOrResponse(request);
  if ('response' in auth) return auth.response;
  const project = await findProject(auth.db, id);
  if (!project) return jsonError('NOT_FOUND', '项目不存在。', 404, request);
  if (!canProjectPermission(auth.actor, project as never, 'release.create')) return jsonError('FORBIDDEN', '没有创建项目版本的权限。', 403, request);
  let input: z.infer<typeof releaseSchema>;
  try { input = releaseSchema.parse(await request.json()); } catch (error) { return jsonError('VALIDATION_ERROR', '版本数据无效。', 422, request, error instanceof z.ZodError ? error.issues : undefined); }
  const version = input.version.replace(/^v/i, '');
  const changelog = input.changelog === undefined ? undefined : sanitizeChangelog(input.changelog);
  if (await auth.db.release.findUnique({ where: { projectId_version: { projectId: project.id, version } }, select: { id: true } })) return jsonError('CONFLICT', '该版本号已经存在。', 409, request);
  let release;
  try {
    release = await auth.db.release.create({ data: { projectId: project.id, version, changelog, compatibleVersions: input.compatibleVersions, environments: input.environments, createdById: auth.actor.id }, include: { files: true } });
  } catch (error) {
    if ((error as { code?: string }).code === 'P2002') return jsonError('CONFLICT', '该版本号已经存在。', 409, request);
    return jsonError('INTERNAL_ERROR', error instanceof Error ? error.message : '版本保存失败。', 503, request);
  }
  await writeAudit(auth.db, request, { actorId: auth.actor.id, action: 'release.create', resourceType: 'release', resourceId: release.id, after: { projectId: project.id, version } });
  return jsonData({ id: release.id, projectId: project.id, version: release.version, status: release.status.toLowerCase(), changelog: release.changelog, compatibleVersions: release.compatibleVersions, environments: release.environments, files: [] }, request);
}
