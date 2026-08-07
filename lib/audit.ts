import type { Prisma, PrismaClient } from '@prisma/client';
import type { NextRequest } from 'next/server';
import { clientIp } from '@/lib/request-security';

export async function writeAudit(
  db: PrismaClient | Prisma.TransactionClient,
  request: Request | NextRequest | undefined,
  input: {
    actorId?: string;
    action: string;
    resourceType: string;
    resourceId?: string;
    before?: unknown;
    after?: unknown;
  }
): Promise<void> {
  await db.auditLog.create({
    data: {
      actorId: input.actorId,
      action: input.action,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      before: input.before as never,
      after: input.after as never,
      requestId: request?.headers.get('x-request-id')?.slice(0, 80),
      ipAddress: request ? clientIp(request) : undefined,
      userAgent: request?.headers.get('user-agent')?.slice(0, 512)
    }
  });
}
