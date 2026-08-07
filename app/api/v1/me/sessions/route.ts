import { NextRequest } from 'next/server';
import { actorOrResponse, mutationAllowed } from '@/lib/api-auth';
import { jsonData } from '@/lib/api-errors';
import { getSessionRecordId } from '@/lib/auth-server';
import { writeAudit } from '@/lib/audit';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const auth = await actorOrResponse(request); if ('response' in auth) return auth.response;
  const currentId = getSessionRecordId(request);
  const sessions = await auth.db.session.findMany({ where: { accountId: auth.actor.id, revokedAt: null, expiresAt: { gt: new Date() } }, orderBy: { lastSeenAt: 'desc' }, select: { id: true, createdAt: true, lastSeenAt: true, expiresAt: true, userAgent: true, ipAddress: true } });
  return jsonData(sessions.map((session) => ({ ...session, current: session.id === currentId, createdAt: session.createdAt.toISOString(), lastSeenAt: session.lastSeenAt.toISOString(), expiresAt: session.expiresAt.toISOString() })), request);
}

export async function DELETE(request: NextRequest) {
  const csrfError = mutationAllowed(request); if (csrfError) return csrfError;
  const auth = await actorOrResponse(request); if ('response' in auth) return auth.response;
  const sessionId = request.nextUrl.searchParams.get('id')?.trim();
  const where = sessionId ? { id: sessionId, accountId: auth.actor.id, revokedAt: null } : { accountId: auth.actor.id, revokedAt: null };
  const updated = await auth.db.session.updateMany({ where, data: { revokedAt: new Date() } });
  if (sessionId && !updated.count) return jsonData({ revoked: false, sessionId }, request);
  await writeAudit(auth.db, request, { actorId: auth.actor.id, action: sessionId ? 'account.session.revoke' : 'account.sessions.revoke_all', resourceType: 'account', resourceId: auth.actor.id, after: sessionId ? { sessionId } : { all: true } });
  return jsonData({ revoked: true, ...(sessionId ? { sessionId } : { count: updated.count }) }, request);
}
