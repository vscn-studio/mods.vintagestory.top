import { NextRequest } from 'next/server';
import { z } from 'zod';
import { reviewerOrResponse, adminMutationError } from '@/lib/admin-auth';
import { jsonData, jsonError } from '@/lib/api-errors';
import { writeAudit } from '@/lib/audit';

export const runtime = 'nodejs';
type Params = { params: Promise<{ id: string }> };
const schema = z.object({ status: z.enum(['CLEAN', 'QUARANTINED', 'FAILED']) });

export async function PATCH(request: NextRequest, { params }: Params) {
  const csrfError = adminMutationError(request); if (csrfError) return csrfError;
  const { id } = await params; const auth = await reviewerOrResponse(request); if ('response' in auth) return auth.response;
  let input: z.infer<typeof schema>; try { input = schema.parse(await request.json()); } catch { return jsonError('VALIDATION_ERROR', '扫描状态无效。', 422, request); }
  const file = await auth.db.file.findUnique({ where: { id }, select: { id: true, scanStatus: true, releaseId: true } }); if (!file) return jsonError('NOT_FOUND', '文件不存在。', 404, request);
  const updated = await auth.db.file.update({ where: { id }, data: { scanStatus: input.status } });
  await writeAudit(auth.db, request, { actorId: auth.actor.id, action: 'file.scan.update', resourceType: 'file', resourceId: id, before: { scanStatus: file.scanStatus }, after: { scanStatus: updated.scanStatus } });
  return jsonData({ id, scanStatus: updated.scanStatus.toLowerCase() }, request);
}
