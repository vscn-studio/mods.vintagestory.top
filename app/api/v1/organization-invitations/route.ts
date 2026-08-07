import { NextRequest } from 'next/server';
import { actorOrResponse } from '@/lib/api-auth';
import { jsonData, parsePage } from '@/lib/api-errors';

export const runtime = 'nodejs';

/** Return invitations addressed to the current account. */
export async function GET(request: NextRequest) {
  const auth = await actorOrResponse(request);
  if ('response' in auth) return auth.response;
  const { page, pageSize } = parsePage(request);
  const where = { recipientId: auth.actor.id, status: 'PENDING' as const, expiresAt: { gt: new Date() } };
  const [total, invitations] = await Promise.all([
    auth.db.organizationInvitation.count({ where }),
    auth.db.organizationInvitation.findMany({ where, include: { organization: { select: { id: true, slug: true, name: true, avatarUrl: true } }, invitedBy: { select: { id: true, username: true, displayName: true } } }, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize })
  ]);
  return jsonData(invitations.map((invitation) => ({ id: invitation.id, role: invitation.role.toLowerCase(), expiresAt: invitation.expiresAt.toISOString(), createdAt: invitation.createdAt.toISOString(), organization: invitation.organization, invitedBy: invitation.invitedBy })), request, { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) });
}
