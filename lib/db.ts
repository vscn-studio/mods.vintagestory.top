import { PrismaClient } from '@prisma/client';

declare global {
  // eslint-disable-next-line no-var
  var __vscnPrisma: PrismaClient | undefined;
}

let unavailable = false;
let healthCheckedAt = 0;
let healthOk = false;
let healthProbe: Promise<boolean> | null = null;

export function databaseConfigured(): boolean {
  return Boolean((process.env.DATABASE_URL ?? '').trim());
}

export function getDb(): PrismaClient | null {
  if (!databaseConfigured() || unavailable) return null;
  if (!globalThis.__vscnPrisma) {
    try {
      globalThis.__vscnPrisma = new PrismaClient({
        log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error']
      });
    } catch {
      unavailable = true;
      return null;
    }
  }
  return globalThis.__vscnPrisma;
}

/**
 * Prisma creates its client lazily, so a configured DATABASE_URL is not enough
 * to know whether business queries can actually be served.  API entry points
 * use this short-lived probe to turn an unavailable database into a 503 rather
 * than leaking a Prisma connection error as a generic 500.
 */
export async function databaseReady(): Promise<boolean> {
  const db = getDb();
  if (!db) return false;
  const now = Date.now();
  if (now - healthCheckedAt < 1_000) return healthOk;
  if (healthProbe) return healthProbe;
  healthProbe = db.$queryRaw`SELECT 1`
    .then(() => {
      healthOk = true;
      healthCheckedAt = Date.now();
      return true;
    })
    .catch(() => {
      healthOk = false;
      healthCheckedAt = Date.now();
      return false;
    })
    .finally(() => {
      healthProbe = null;
    });
  return healthProbe;
}

export async function disconnectDb(): Promise<void> {
  if (globalThis.__vscnPrisma) {
    await globalThis.__vscnPrisma.$disconnect();
    globalThis.__vscnPrisma = undefined;
  }
  healthCheckedAt = 0;
  healthOk = false;
  healthProbe = null;
}
