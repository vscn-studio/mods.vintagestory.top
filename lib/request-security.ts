import { randomBytes, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { publicOrigin } from '@/lib/web-url';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
export const CSRF_COOKIE = 'vscn_csrf';
const RATE_WINDOW_MS = 60_000;
const rateCounters = new Map<string, { startedAt: number; count: number }>();

export function sameOrigin(request: Request): boolean {
  if (!MUTATING_METHODS.has(request.method.toUpperCase())) return true;
  const origin = request.headers.get('origin');
  if (!origin) return false;
  try {
    // A reverse proxy can leave request.url on its internal HTTP origin.
    // In production WEB_URL is the authoritative browser-facing origin.
    const expectedOrigin = process.env.NODE_ENV === 'production'
      ? publicOrigin(request)
      : new URL(request.url).origin;
    return new URL(origin).origin === expectedOrigin;
  } catch {
    return false;
  }
}

export function checkCsrf(request: Request): boolean {
  if (!MUTATING_METHODS.has(request.method.toUpperCase())) return true;
  if (!sameOrigin(request)) return false;
  const supplied = request.headers.get('x-csrf-token');
  const cookie = request.headers.get('cookie')?.match(/(?:^|;\s*)vscn_csrf=([^;]+)/)?.[1];
  if (!supplied || !cookie) return false;
  try {
    const left = Buffer.from(supplied);
    const right = Buffer.from(decodeURIComponent(cookie));
    return left.length > 0 && left.length === right.length && timingSafeEqual(left, right);
  } catch {
    return false;
  }
}

/** Set a readable double-submit token. The token itself carries no authority. */
export function setCsrfCookie(response: NextResponse, token = randomBytes(32).toString('base64url')): string {
  response.cookies.set(CSRF_COOKIE, token, {
    httpOnly: false,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24
  });
  return token;
}

/** Lightweight per-process guard. Deployments with multiple instances should use an edge/shared limiter. */
export function rateLimit(request: Request, limit = Number.parseInt(process.env.API_RATE_LIMIT ?? '120', 10)): boolean {
  if (!MUTATING_METHODS.has(request.method.toUpperCase())) return true;
  const now = Date.now();
  const key = `${clientIp(request) ?? 'unknown'}:${request.method}:${new URL(request.url).pathname}`;
  const current = rateCounters.get(key);
  if (!current || now - current.startedAt >= RATE_WINDOW_MS) {
    rateCounters.set(key, { startedAt: now, count: 1 });
    return true;
  }
  current.count += 1;
  return current.count <= Math.max(1, Math.min(10_000, limit || 120));
}

export function clientIp(request: Request): string | undefined {
  const forwarded = request.headers.get('x-forwarded-for');
  return (forwarded?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || undefined)?.slice(0, 64);
}
