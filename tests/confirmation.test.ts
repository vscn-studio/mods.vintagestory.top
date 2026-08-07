import type { PrismaClient } from '@prisma/client';
import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import { issueConfirmation, requireConfirmation } from '@/lib/admin-auth';
import { isConfirmationScope } from '@/lib/confirmation-contract';

type Row = {
  accountId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  tokenHash: string;
  expiresAt: Date;
  consumedAt?: Date | null;
};

function fakeDb() {
  const rows: Row[] = [];
  const db = {
    $transaction: async (operations: Promise<unknown>[]) => Promise.all(operations),
    actionConfirmation: {
      deleteMany: async ({ where }: { where: Partial<Row> }) => {
        const before = rows.length;
        for (let index = rows.length - 1; index >= 0; index -= 1) {
          const row = rows[index];
          if (row.accountId === where.accountId && row.action === where.action && row.resourceType === where.resourceType && row.resourceId === where.resourceId) rows.splice(index, 1);
        }
        return { count: before - rows.length };
      },
      create: async ({ data }: { data: Row }) => { rows.push({ ...data }); return data; },
      updateMany: async ({ where, data }: { where: Partial<Row> & { consumedAt: null; expiresAt: { gt: Date } }; data: { consumedAt: Date } }) => {
        const row = rows.find((candidate) => candidate.accountId === where.accountId && candidate.action === where.action && candidate.resourceType === where.resourceType && candidate.resourceId === where.resourceId && candidate.tokenHash === where.tokenHash && candidate.consumedAt == null && candidate.expiresAt > where.expiresAt.gt);
        if (!row) return { count: 0 };
        row.consumedAt = data.consumedAt;
        return { count: 1 };
      }
    }
  } as unknown as PrismaClient;
  return db;
}

describe('one-time confirmations', () => {
  it('binds a token to the actor and consumes it exactly once', async () => {
    const db = fakeDb();
    const scope = { action: 'project.archive' as const, resourceType: 'project' as const, resourceId: 'project-1' };
    const issued = await issueConfirmation(db, 'account-1', scope);
    const request = new NextRequest('http://localhost/api/v1/projects/project-1', { headers: { 'x-confirmation-token': issued.token } });
    expect(await requireConfirmation(request, db, 'account-1', scope)).toBeNull();
    const replay = await requireConfirmation(request, db, 'account-1', scope);
    expect(replay?.status).toBe(409);
    const wrongActor = await requireConfirmation(request, db, 'account-2', scope);
    expect(wrongActor?.status).toBe(409);
  });

  it('rejects an invalid action/resource pairing', () => {
    expect(isConfirmationScope({ action: 'project.archive', resourceType: 'project' })).toBe(true);
    expect(isConfirmationScope({ action: 'project.archive', resourceType: 'account' })).toBe(false);
  });
});
