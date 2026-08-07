import { NextRequest } from 'next/server';
import { z } from 'zod';
import { actorOrResponse, mutationAllowed } from '@/lib/api-auth';
import { jsonData, jsonError } from '@/lib/api-errors';
import { writeAudit } from '@/lib/audit';
import { canReadProject } from '@/lib/authorization';

export const runtime = 'nodejs';
const schema = z.object({ targetType: z.enum(['PROJECT', 'RELEASE', 'FILE', 'COMMENT', 'ACCOUNT']), targetId: z.string().trim().min(1).max(120), reason: z.string().trim().min(1).max(2000) });

export async function POST(request: NextRequest) {
  const csrfError = mutationAllowed(request); if (csrfError) return csrfError;
  const auth = await actorOrResponse(request); if ('response' in auth) return auth.response;
  let input: z.infer<typeof schema>; try { input = schema.parse(await request.json()); } catch { return jsonError('VALIDATION_ERROR', '举报数据无效。', 422, request); }
  let exists = false;
  let targetId = input.targetId;
  if (input.targetType === 'PROJECT') {
    const project = await auth.db.project.findFirst({ where: { OR: [{ id: input.targetId }, { slug: input.targetId }] }, include: { members: true, ownerOrganization: { include: { members: true } } } });
    exists = Boolean(project && canReadProject(auth.actor, project as never));
    if (project) targetId = project.id;
  } else if (input.targetType === 'RELEASE') {
    const release = await auth.db.release.findUnique({ where: { id: input.targetId }, include: { project: { include: { members: true, ownerOrganization: { include: { members: true } } } } } });
    exists = Boolean(release && release.status === 'PUBLISHED' && canReadProject(auth.actor, release.project as never));
  } else if (input.targetType === 'FILE') {
    const file = await auth.db.file.findUnique({ where: { id: input.targetId }, include: { release: { include: { project: { include: { members: true, ownerOrganization: { include: { members: true } } } } } } } });
    exists = Boolean(file && file.scanStatus === 'CLEAN' && file.release.status === 'PUBLISHED' && canReadProject(auth.actor, file.release.project as never));
  } else if (input.targetType === 'COMMENT') {
    const comment = await auth.db.comment.findUnique({ where: { id: input.targetId }, include: { project: { include: { members: true, ownerOrganization: { include: { members: true } } } } } });
    exists = Boolean(comment && !comment.hiddenAt && canReadProject(auth.actor, comment.project as never));
  }
  else exists = Boolean(await auth.db.account.findUnique({ where: { id: input.targetId }, select: { id: true } }));
  if (!exists) return jsonError('NOT_FOUND', '举报目标不存在。', 404, request);
  const target = input.targetType === 'PROJECT' ? { projectId: targetId } : input.targetType === 'RELEASE' ? { releaseId: targetId } : input.targetType === 'FILE' ? { fileId: targetId } : input.targetType === 'COMMENT' ? { commentId: targetId } : { accountId: targetId };
  const report = await auth.db.report.create({ data: { reporterId: auth.actor.id, targetType: input.targetType, reason: input.reason, ...target } });
  await writeAudit(auth.db, request, { actorId: auth.actor.id, action: 'report.create', resourceType: input.targetType.toLowerCase(), resourceId: targetId, after: { reportId: report.id } });
  return jsonData({ id: report.id, status: report.status.toLowerCase() }, request);
}
