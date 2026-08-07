import { createHash, randomBytes } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { actorOrResponse, mutationAllowed } from '@/lib/api-auth';
import { jsonError } from '@/lib/api-errors';
import { siteRoleAllows } from '@/lib/authorization';
import type { ConfirmationScope } from '@/lib/confirmation-contract';

export async function adminOrResponse(request: NextRequest) {
  const auth = await actorOrResponse(request);
  if ('response' in auth) return auth;
  if (!siteRoleAllows(auth.actor, 'ADMIN')) return { response: jsonError('FORBIDDEN', '需要站点管理员权限。', 403, request) };
  return auth;
}

export async function reviewerOrResponse(request: NextRequest) {
  const auth = await actorOrResponse(request);
  if ('response' in auth) return auth;
  if (!siteRoleAllows(auth.actor, 'REVIEWER')) return { response: jsonError('FORBIDDEN', '需要审核权限。', 403, request) };
  return auth;
}

export async function moderatorOrResponse(request: NextRequest) {
  const auth = await actorOrResponse(request);
  if ('response' in auth) return auth;
  if (!siteRoleAllows(auth.actor, 'MODERATOR')) return { response: jsonError('FORBIDDEN', '需要内容管理权限。', 403, request) };
  return auth;
}

function confirmationHash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function issueConfirmation(
  db: PrismaClient,
  accountId: string,
  scope: ConfirmationScope
): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
  await db.$transaction([
    db.actionConfirmation.deleteMany({
      where: {
        accountId,
        action: scope.action,
        resourceType: scope.resourceType,
        resourceId: scope.resourceId
      }
    }),
    db.actionConfirmation.create({
      data: {
        accountId,
        action: scope.action,
        resourceType: scope.resourceType,
        resourceId: scope.resourceId,
        tokenHash: confirmationHash(token),
        expiresAt
      }
    })
  ]);
  return { token, expiresAt };
}

export async function requireConfirmation(
  request: NextRequest,
  db: PrismaClient,
  accountId: string,
  scope: ConfirmationScope
): Promise<NextResponse | null> {
  const token = request.headers.get('x-confirmation-token')?.trim();
  if (!token || token.length < 32 || token.length > 256) {
    return jsonError('CONFIRMATION_REQUIRED', '此操作需要一次性二次确认令牌。', 409, request);
  }
  const consumed = await db.actionConfirmation.updateMany({
    where: {
      accountId,
      action: scope.action,
      resourceType: scope.resourceType,
      resourceId: scope.resourceId,
      tokenHash: confirmationHash(token),
      consumedAt: null,
      expiresAt: { gt: new Date() }
    },
    data: { consumedAt: new Date() }
  });
  if (consumed.count !== 1) {
    return jsonError('CONFIRMATION_REQUIRED', '二次确认令牌无效、已过期或已使用。', 409, request);
  }
  return null;
}

export function adminMutationError(request: NextRequest): NextResponse | null {
  return mutationAllowed(request);
}
