import { NextRequest } from 'next/server';
import { actorOrResponse, mutationAllowed } from '@/lib/api-auth';
import { jsonData, jsonError } from '@/lib/api-errors';
import { canReadProject } from '@/lib/authorization';
import { writeAudit } from '@/lib/audit';

export const runtime = 'nodejs';
type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const csrfError = mutationAllowed(request); if (csrfError) return csrfError;
  const { id } = await params; const auth = await actorOrResponse(request); if ('response' in auth) return auth.response;
  const project = await auth.db.project.findFirst({ where: { OR: [{ id }, { slug: id }] }, include: { members: true, ownerOrganization: { include: { members: true } } } }); if (!project || !canReadProject(auth.actor, project as never)) return jsonError('NOT_FOUND', '项目不存在。', 404, request);
  const added = await auth.db.$transaction(async (tx) => {
    // Serialize relation changes per project. This makes the counter update
    // deterministic even when two browser tabs click at the same time.
    await tx.$queryRaw`SELECT "id" FROM "Project" WHERE "id" = ${project.id} FOR UPDATE`;
    const result = await tx.favorite.createMany({ data: { accountId: auth.actor.id, projectId: project.id }, skipDuplicates: true });
    if (!result.count) return false;
    const count = await tx.favorite.count({ where: { projectId: project.id } });
    await tx.project.update({ where: { id: project.id }, data: { favoriteCount: count } });
    await writeAudit(tx, request, { actorId: auth.actor.id, action: 'project.favorite.add', resourceType: 'project', resourceId: project.id });
    return true;
  });
  const recipientId = project.ownerAccountId ?? project.ownerOrganization?.ownerId;
  if (added && recipientId && recipientId !== auth.actor.id) await auth.db.notification.create({ data: { accountId: recipientId, type: 'project.favorited', payload: { projectId: project.id, projectSlug: project.slug } } }).catch(() => undefined);
  return jsonData({ favorited: true }, request);
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const csrfError = mutationAllowed(request); if (csrfError) return csrfError;
  const { id } = await params; const auth = await actorOrResponse(request); if ('response' in auth) return auth.response;
  const project = await auth.db.project.findFirst({ where: { OR: [{ id }, { slug: id }] }, include: { members: true, ownerOrganization: { include: { members: true } } } }); if (!project || !canReadProject(auth.actor, project as never)) return jsonError('NOT_FOUND', '项目不存在。', 404, request);
  const removed = await auth.db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "Project" WHERE "id" = ${project.id} FOR UPDATE`;
    const result = await tx.favorite.deleteMany({ where: { accountId: auth.actor.id, projectId: project.id } });
    if (!result.count) return false;
    const count = await tx.favorite.count({ where: { projectId: project.id } });
    await tx.project.update({ where: { id: project.id }, data: { favoriteCount: count } });
    await writeAudit(tx, request, { actorId: auth.actor.id, action: 'project.favorite.remove', resourceType: 'project', resourceId: project.id });
    return true;
  });
  return jsonData({ favorited: false }, request);
}
