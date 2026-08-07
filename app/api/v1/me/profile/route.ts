import { NextRequest } from 'next/server';
import { z } from 'zod';
import { actorOrResponse, mutationAllowed } from '@/lib/api-auth';
import { jsonData, jsonError } from '@/lib/api-errors';
import { writeAudit } from '@/lib/audit';

export const runtime = 'nodejs';
const profileSchema = z.object({ displayName: z.string().trim().min(1).max(120).optional(), bio: z.string().max(2000).nullable().optional() });

export async function GET(request: NextRequest) {
  const auth = await actorOrResponse(request);
  if ('response' in auth) return auth.response;
  const account = await auth.db.account.findUnique({ where: { id: auth.actor.id }, include: { identities: true, organizationMemberships: { include: { organization: true } }, ownedOrganizations: true, siteRoles: true } });
  if (!account) return jsonError('NOT_FOUND', '账号不存在。', 404, request);
  return jsonData({ id: account.id, username: account.username, displayName: account.displayName, bio: account.bio ?? '', avatarUrl: account.avatarUrl, hasOfficialIdentity: account.identities.some((identity) => identity.provider === 'OFFICIAL'), siteRoles: account.siteRoles.map((role) => role.role.toLowerCase()), organizations: account.organizationMemberships.map((membership) => ({ id: membership.organization.id, slug: membership.organization.slug, name: membership.organization.name, role: membership.role.toLowerCase() })), ownedOrganizations: account.ownedOrganizations.map((organization) => ({ id: organization.id, slug: organization.slug, name: organization.name })), createdAt: account.createdAt.toISOString() }, request);
}

export async function PATCH(request: NextRequest) {
  const csrfError = mutationAllowed(request);
  if (csrfError) return csrfError;
  const auth = await actorOrResponse(request);
  if ('response' in auth) return auth.response;
  let input: z.infer<typeof profileSchema>;
  try { input = profileSchema.parse(await request.json()); } catch (error) { return jsonError('VALIDATION_ERROR', '资料数据无效。', 422, request, error instanceof z.ZodError ? error.issues : undefined); }
  const before = await auth.db.account.findUnique({ where: { id: auth.actor.id }, select: { displayName: true, bio: true } });
  const account = await auth.db.account.update({ where: { id: auth.actor.id }, data: { ...(input.displayName === undefined ? {} : { displayName: input.displayName }), ...(input.bio === undefined ? {} : { bio: input.bio }) } });
  await writeAudit(auth.db, request, { actorId: auth.actor.id, action: 'account.profile.update', resourceType: 'account', resourceId: account.id, before, after: { displayName: account.displayName, bio: account.bio } });
  return jsonData({ id: account.id, username: account.username, displayName: account.displayName, bio: account.bio ?? '', avatarUrl: account.avatarUrl }, request);
}
