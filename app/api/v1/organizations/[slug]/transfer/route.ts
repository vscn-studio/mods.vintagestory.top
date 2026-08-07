import { NextRequest } from 'next/server';
import { z } from 'zod';
import { actorOrResponse, mutationAllowed } from '@/lib/api-auth';
import { jsonData, jsonError } from '@/lib/api-errors';
import { writeAudit } from '@/lib/audit';
import { requireConfirmation } from '@/lib/admin-auth';
import { effectiveOrganizationRole } from '@/lib/authorization';

export const runtime = 'nodejs';
type Params = { params: Promise<{ slug: string }> };
const schema = z.object({ username: z.string().trim().min(1).max(80) });

export async function POST(request: NextRequest, { params }: Params) {
  const csrfError = mutationAllowed(request); if (csrfError) return csrfError;
  const { slug } = await params; const auth = await actorOrResponse(request); if ('response' in auth) return auth.response;
  const organization = await auth.db.organization.findUnique({ where: { slug }, include: { members: true } });
  const role = organization ? effectiveOrganizationRole(auth.actor, organization) : null;
  if (!organization || role !== 'OWNER') return jsonError('FORBIDDEN', '只有组织 Owner 可以转让组织。', 403, request);
  if (organization.archivedAt) return jsonError('CONFLICT', '组织已归档。', 409, request);
  const confirmationError = await requireConfirmation(request, auth.db, auth.actor.id, { action: 'organization.transfer', resourceType: 'organization', resourceId: organization.id });
  if (confirmationError) return confirmationError;
  let input: z.infer<typeof schema>; try { input = schema.parse(await request.json()); } catch { return jsonError('VALIDATION_ERROR', '转让数据无效。', 422, request); }
  const target = await auth.db.account.findUnique({ where: { username: input.username } });
  if (!target || target.status !== 'ACTIVE') return jsonError('NOT_FOUND', '目标账号不存在。', 404, request);
  if (target.id === auth.actor.id) return jsonError('CONFLICT', '不能转让给当前 Owner。', 409, request);
  const updated = await auth.db.$transaction(async (tx) => {
    // Serialize ownership transfers for this organization so two concurrent
    // requests cannot both promote different owners.
    await tx.$queryRaw`SELECT "id" FROM "Organization" WHERE "id" = ${organization.id} FOR UPDATE`;
    await tx.organizationMember.updateMany({ where: { organizationId: organization.id, role: 'OWNER' }, data: { role: 'ADMIN' } });
    await tx.organizationMember.upsert({ where: { organizationId_accountId: { organizationId: organization.id, accountId: target.id } }, create: { organizationId: organization.id, accountId: target.id, role: 'OWNER' }, update: { role: 'OWNER' } });
    return tx.organization.update({ where: { id: organization.id }, data: { ownerId: target.id }, select: { id: true, slug: true, ownerId: true } });
  });
  await writeAudit(auth.db, request, { actorId: auth.actor.id, action: 'organization.transfer', resourceType: 'organization', resourceId: organization.id, before: { ownerId: auth.actor.id }, after: { ownerId: target.id } });
  return jsonData(updated, request);
}
