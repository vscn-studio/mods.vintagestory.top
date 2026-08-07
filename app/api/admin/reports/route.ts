import { NextRequest } from 'next/server';
import { z } from 'zod';
import { moderatorOrResponse, adminMutationError, requireConfirmation } from '@/lib/admin-auth';
import { jsonData, jsonError, parsePage } from '@/lib/api-errors';
import { writeAudit } from '@/lib/audit';

export const runtime = 'nodejs';
const schema = z.object({ reportId: z.string().min(1), status: z.enum(['IN_REVIEW', 'RESOLVED', 'DISMISSED']), resolution: z.string().max(2000).optional() });

export async function GET(request: NextRequest) {
  const auth = await moderatorOrResponse(request); if ('response' in auth) return auth.response;
  const { page, pageSize } = parsePage(request); const status = request.nextUrl.searchParams.get('status'); const where = status && ['OPEN', 'IN_REVIEW', 'RESOLVED', 'DISMISSED'].includes(status) ? { status: status as 'OPEN' | 'IN_REVIEW' | 'RESOLVED' | 'DISMISSED' } : {};
  const [total, reports] = await Promise.all([auth.db.report.count({ where }), auth.db.report.findMany({ where, include: { reporter: { select: { id: true, username: true, displayName: true } }, project: { select: { id: true, slug: true, name: true } }, release: { select: { id: true, version: true } }, file: { select: { id: true, name: true } }, comment: { select: { id: true, body: true } }, account: { select: { id: true, username: true } } }, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize })]);
  return jsonData(reports.map((report) => ({ id: report.id, targetType: report.targetType.toLowerCase(), target: report.project ?? report.release ?? report.file ?? report.comment ?? report.account, reason: report.reason, status: report.status.toLowerCase(), resolution: report.resolution, reporter: report.reporter, createdAt: report.createdAt.toISOString(), updatedAt: report.updatedAt.toISOString() })), request, { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) });
}

export async function PATCH(request: NextRequest) {
  const csrfError = adminMutationError(request); if (csrfError) return csrfError;
  const auth = await moderatorOrResponse(request); if ('response' in auth) return auth.response;
  let input: z.infer<typeof schema>; try { input = schema.parse(await request.json()); } catch { return jsonError('VALIDATION_ERROR', '举报处理数据无效。', 422, request); }
  const report = await auth.db.report.findUnique({ where: { id: input.reportId } }); if (!report) return jsonError('NOT_FOUND', '举报不存在。', 404, request);
  if (input.status !== 'IN_REVIEW') {
    const confirmationError = await requireConfirmation(request, auth.db, auth.actor.id, { action: 'admin.report.resolve', resourceType: 'report', resourceId: report.id });
    if (confirmationError) return confirmationError;
  }
  const updated = await auth.db.report.update({ where: { id: report.id }, data: { status: input.status, resolution: input.resolution?.trim() || null } });
  await writeAudit(auth.db, request, { actorId: auth.actor.id, action: 'report.resolve', resourceType: 'report', resourceId: report.id, before: { status: report.status }, after: { status: updated.status, resolution: updated.resolution } });
  return jsonData({ id: updated.id, status: updated.status.toLowerCase() }, request);
}
