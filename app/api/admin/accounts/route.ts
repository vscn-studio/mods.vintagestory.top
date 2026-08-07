import { NextRequest } from 'next/server';
import { z } from 'zod';
import { adminOrResponse, adminMutationError, requireConfirmation } from '@/lib/admin-auth';
import { jsonData, jsonError, parsePage } from '@/lib/api-errors';
import { writeAudit } from '@/lib/audit';

export const runtime = 'nodejs';
const updateSchema = z.object({ accountId: z.string().min(1), status: z.enum(['ACTIVE', 'SUSPENDED', 'BANNED']).optional(), addRoles: z.array(z.enum(['MODERATOR', 'REVIEWER', 'ADMIN'])).optional(), removeRoles: z.array(z.enum(['MODERATOR', 'REVIEWER', 'ADMIN'])).optional() });

export async function GET(request: NextRequest) {
  const auth = await adminOrResponse(request); if ('response' in auth) return auth.response;
  const { page, pageSize } = parsePage(request); const query = (request.nextUrl.searchParams.get('q') ?? '').trim();
  const where = query ? { OR: [{ username: { contains: query, mode: 'insensitive' as const } }, { displayName: { contains: query, mode: 'insensitive' as const } }, { bindEmail: { contains: query, mode: 'insensitive' as const } }] } : {};
  const [total, accounts] = await Promise.all([
    auth.db.account.count({ where }),
    auth.db.account.findMany({ where, include: { identities: true, organizationMemberships: { include: { organization: true } }, siteRoles: true }, orderBy: { updatedAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize })
  ]);
  return jsonData(accounts.map((account) => ({ id: account.id, username: account.username, displayName: account.displayName, bindEmail: account.bindEmail, status: account.status.toLowerCase(), hasOfficialIdentity: account.identities.some((identity) => identity.provider === 'OFFICIAL'), identities: account.identities.map((identity) => ({ provider: identity.provider.toLowerCase(), subject: identity.subject, displayName: identity.displayName })), roles: account.siteRoles.map((role) => role.role.toLowerCase()), organizations: account.organizationMemberships.map((membership) => ({ slug: membership.organization.slug, name: membership.organization.name, role: membership.role.toLowerCase() })), updatedAt: account.updatedAt.toISOString() })), request, { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) });
}

export async function PATCH(request: NextRequest) {
  const csrfError = adminMutationError(request); if (csrfError) return csrfError;
  const auth = await adminOrResponse(request); if ('response' in auth) return auth.response;
  let input: z.infer<typeof updateSchema>; try { input = updateSchema.parse(await request.json()); } catch { return jsonError('VALIDATION_ERROR', '用户管理数据无效。', 422, request); }
  const account = await auth.db.account.findUnique({ where: { id: input.accountId }, include: { siteRoles: true } }); if (!account) return jsonError('NOT_FOUND', '账号不存在。', 404, request);
  const highRisk = Boolean((input.status && input.status !== 'ACTIVE') || input.addRoles?.length || input.removeRoles?.length);
  if (highRisk) {
    const confirmationError = await requireConfirmation(request, auth.db, auth.actor.id, { action: 'admin.account.manage', resourceType: 'account', resourceId: account.id });
    if (confirmationError) return confirmationError;
  }
  const changesAdminPopulation = Boolean(
    input.addRoles?.includes('ADMIN') || input.removeRoles?.includes('ADMIN') ||
    (input.status !== undefined && account.siteRoles.some((role) => role.role === 'ADMIN'))
  );
  let updated;
  try {
    updated = await auth.db.$transaction(async (tx) => {
      if (changesAdminPopulation) await tx.$queryRaw`SELECT "id" FROM "SiteRoleAssignment" WHERE "role" = 'ADMIN' FOR UPDATE`;
      const next = await tx.account.update({ where: { id: account.id }, data: input.status ? { status: input.status } : {} });
      if (input.status && input.status !== 'ACTIVE') {
        // A suspended/banned account must not keep an already-issued session.
        await tx.session.updateMany({ where: { accountId: account.id, revokedAt: null }, data: { revokedAt: new Date() } });
      }
      for (const role of input.addRoles ?? []) await tx.siteRoleAssignment.upsert({ where: { accountId_role: { accountId: account.id, role } }, create: { accountId: account.id, role, assignedBy: auth.actor.id }, update: {} });
      for (const role of input.removeRoles ?? []) await tx.siteRoleAssignment.deleteMany({ where: { accountId: account.id, role } });
      if (changesAdminPopulation) {
        const activeAdminCount = await tx.siteRoleAssignment.count({ where: { role: 'ADMIN', account: { status: 'ACTIVE' } } });
        if (activeAdminCount === 0) throw new Error('last_active_admin');
      }
      return next;
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'last_active_admin') return jsonError('CONFLICT', '不能移除、封禁或暂停最后一个站点管理员。', 409, request);
    throw error;
  }
  await writeAudit(auth.db, request, { actorId: auth.actor.id, action: 'user.manage', resourceType: 'account', resourceId: account.id, before: { status: account.status, roles: account.siteRoles.map((role) => role.role) }, after: { status: updated.status, addRoles: input.addRoles, removeRoles: input.removeRoles } });
  return jsonData({ id: updated.id, status: updated.status.toLowerCase() }, request);
}
