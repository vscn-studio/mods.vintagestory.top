import { NextRequest, NextResponse } from 'next/server';
import { databaseReady, getDb } from '@/lib/db';
import { databaseUnavailable, jsonError } from '@/lib/api-errors';
import { checkCsrf, rateLimit } from '@/lib/request-security';
import { getDatabaseActor, requireDatabaseActor, type Actor } from '@/lib/authorization';

export async function databaseOrResponse(request: NextRequest) {
  const db = getDb();
  if (!db || !(await databaseReady())) return { response: databaseUnavailable(request) };
  return { db };
}

export async function actorOrResponse(request: NextRequest): Promise<{ actor: Actor; db: NonNullable<ReturnType<typeof getDb>> } | { response: NextResponse }> {
  const db = getDb();
  if (!db || !(await databaseReady())) return { response: databaseUnavailable(request) };
  let actor: Actor | null;
  try {
    actor = await requireDatabaseActor(request);
  } catch {
    return { response: databaseUnavailable(request) };
  }
  if (!actor) return { response: jsonError('UNAUTHENTICATED', '请先登录。', 401, request) };
  if (actor.status !== 'ACTIVE') return { response: jsonError('FORBIDDEN', '当前账号不可执行此操作。', 403, request) };
  return { actor, db };
}

export async function optionalActor(request: NextRequest): Promise<{ actor: Actor | null; db: NonNullable<ReturnType<typeof getDb>> } | { response: NextResponse }> {
  const db = getDb();
  if (!db || !(await databaseReady())) return { response: databaseUnavailable(request) };
  let actor: Actor | null;
  try {
    actor = await requireDatabaseActor(request);
  } catch {
    return { response: databaseUnavailable(request) };
  }
  return { actor, db };
}

export async function officialActorOrResponse(request: NextRequest): Promise<{ actor: Actor; db: NonNullable<ReturnType<typeof getDb>> } | { response: NextResponse }> {
  const result = await actorOrResponse(request);
  if ('response' in result) return result;
  if (!result.actor.hasOfficialIdentity) return { response: jsonError('FORBIDDEN', '请先绑定 VintageStory 官方游戏身份。', 403, request) };
  return result;
}

export function mutationAllowed(request: NextRequest): NextResponse | null {
  if (!rateLimit(request)) return jsonError('RATE_LIMITED', '请求过于频繁，请稍后重试。', 429, request);
  return checkCsrf(request) ? null : jsonError('FORBIDDEN', '请求来源校验失败。', 403, request);
}

export async function actorFromId(db: NonNullable<ReturnType<typeof getDb>>, accountId: string): Promise<Actor | null> {
  return getDatabaseActor(accountId);
}
