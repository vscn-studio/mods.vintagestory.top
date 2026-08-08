import { NextRequest } from 'next/server';
import { z } from 'zod';
import { actorOrResponse, mutationAllowed, optionalActor } from '@/lib/api-auth';
import { jsonData, jsonError } from '@/lib/api-errors';
import { canProjectPermission, canReadProject, effectiveProjectRole, getActiveActor } from '@/lib/authorization';
import { sanitizeChangelog } from '@/lib/changelog';
import { findProject } from '@/lib/project-service';
import { writeAudit } from '@/lib/audit';
import { canTransitionRelease } from '@/lib/release-state';
import { requireConfirmation } from '@/lib/admin-auth';
import { MAX_RELEASE_COMPATIBLE_VERSIONS } from '@/lib/game-versions';

export const runtime = 'nodejs';
type Params = { params: Promise<{ id: string }> };
const updateSchema = z.object({ changelog: z.string().max(100_000).optional(), compatibleVersions: z.array(z.string().max(40)).max(MAX_RELEASE_COMPATIBLE_VERSIONS).optional(), environments: z.array(z.string().max(80)).max(16).optional() });

async function findRelease(db: NonNullable<ReturnType<typeof import('@/lib/db').getDb>>, id: string) {
  return db.release.findUnique({ where: { id }, include: { project: { include: { members: true, ownerOrganization: { include: { members: true } } } }, files: true } });
}

export async function GET(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const auth = await optionalActor(request);
  if ('response' in auth) return auth.response;
  const release = await findRelease(auth.db, id);
  if (!release) return jsonError('NOT_FOUND', '版本不存在。', 404, request);
  const actor = getActiveActor(auth.actor);
  const readable = canReadProject(actor, release.project as never);
  const member = Boolean(actor && (effectiveProjectRole(actor, release.project as never) || actor.siteRoles.includes('ADMIN')));
  const canSeeUnclean = Boolean(actor && canProjectPermission(actor, release.project as never, 'file.manage'));
  if (!readable) return jsonError('NOT_FOUND', '版本不存在。', 404, request);
  if (release.status !== 'PUBLISHED' && !member) return jsonError('NOT_FOUND', '版本不存在。', 404, request);
  return jsonData({ id: release.id, projectId: release.projectId, version: release.version, changelog: sanitizeChangelog(release.changelog), status: release.status.toLowerCase(), compatibleVersions: release.compatibleVersions ?? [], environments: release.environments ?? [], publishedAt: release.publishedAt?.toISOString() ?? null, files: release.files.filter((file) => file.scanStatus === 'CLEAN' || canSeeUnclean).map((file) => ({ id: file.id, name: file.name, mimeType: file.mimeType, size: Number(file.size), sha256: file.sha256, scanStatus: file.scanStatus.toLowerCase(), downloads: file.downloads })) }, request);
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const csrfError = mutationAllowed(request);
  if (csrfError) return csrfError;
  const { id } = await params;
  const auth = await actorOrResponse(request);
  if ('response' in auth) return auth.response;
  const release = await findRelease(auth.db, id);
  if (!release) return jsonError('NOT_FOUND', '版本不存在。', 404, request);
  if (!canProjectPermission(auth.actor, release.project as never, 'release.create')) return jsonError('FORBIDDEN', '没有编辑此版本的权限。', 403, request);
  if (!['DRAFT', 'REJECTED'].includes(release.status)) return jsonError('CONFLICT', '待审核、已发布或已撤回的版本不能直接编辑。', 409, request);
  let input: z.infer<typeof updateSchema>;
  try { input = updateSchema.parse(await request.json()); } catch { return jsonError('VALIDATION_ERROR', '版本数据无效。', 422, request); }
  const updated = await auth.db.release.update({ where: { id }, data: { ...(input.changelog === undefined ? {} : { changelog: sanitizeChangelog(input.changelog) }), ...(input.compatibleVersions === undefined ? {} : { compatibleVersions: input.compatibleVersions }), ...(input.environments === undefined ? {} : { environments: input.environments }) }, include: { files: true } });
  await writeAudit(auth.db, request, { actorId: auth.actor.id, action: 'release.update', resourceType: 'release', resourceId: id, after: { changelog: updated.changelog } });
  return jsonData({ id: updated.id, version: updated.version, status: updated.status.toLowerCase(), changelog: sanitizeChangelog(updated.changelog), compatibleVersions: updated.compatibleVersions, environments: updated.environments }, request);
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const csrfError = mutationAllowed(request);
  if (csrfError) return csrfError;
  const { id } = await params;
  const auth = await actorOrResponse(request);
  if ('response' in auth) return auth.response;
  const release = await findRelease(auth.db, id);
  if (!release) return jsonError('NOT_FOUND', '版本不存在。', 404, request);
  if (!canProjectPermission(auth.actor, release.project as never, 'release.publish')) return jsonError('FORBIDDEN', '没有撤回此版本的权限。', 403, request);
  const confirmationError = await requireConfirmation(request, auth.db, auth.actor.id, { action: 'release.withdraw', resourceType: 'release', resourceId: release.id });
  if (confirmationError) return confirmationError;
  if (!canTransitionRelease(release.status, 'WITHDRAWN')) return jsonError('CONFLICT', '当前版本状态不能撤回。', 409, request);
  const updated = await auth.db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "Release" WHERE "id" = ${id} FOR UPDATE`;
    const current = await tx.release.findUnique({ where: { id }, select: { status: true } });
    if (!current || !canTransitionRelease(current.status, 'WITHDRAWN')) throw new Error('release_invalid_transition');
    const changed = await tx.release.updateMany({ where: { id, status: current.status }, data: { status: 'WITHDRAWN', publishedAt: null } });
    if (!changed.count) throw new Error('release_invalid_transition');
    if (current.status === 'PENDING_REVIEW') {
      await tx.reviewTask.updateMany({ where: { releaseId: id, status: 'QUEUED' }, data: { status: 'REJECTED', decision: 'Release withdrawn before review.' } });
    }
    return tx.release.findUniqueOrThrow({ where: { id } });
  }).catch((error) => {
    if (error instanceof Error && error.message === 'release_invalid_transition') return null;
    throw error;
  });
  if (!updated) return jsonError('CONFLICT', '当前版本状态已变更，请刷新后重试。', 409, request);
  await writeAudit(auth.db, request, { actorId: auth.actor.id, action: 'release.withdraw', resourceType: 'release', resourceId: id, before: { status: release.status }, after: { status: updated.status } });
  return jsonData({ id: updated.id, status: updated.status.toLowerCase() }, request);
}
