import { randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';

export type ApiErrorCode =
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'CONFLICT'
  | 'CONFIRMATION_REQUIRED'
  | 'RATE_LIMITED'
  | 'DATABASE_UNAVAILABLE'
  | 'STORAGE_CONNECTION_FAILED'
  | 'INTERNAL_ERROR';

export function requestId(request?: Request): string {
  return request?.headers.get('x-request-id')?.slice(0, 80) || randomBytes(10).toString('hex');
}

export function jsonError(
  code: ApiErrorCode,
  message: string,
  status: number,
  request?: Request,
  details?: unknown
): NextResponse {
  const id = requestId(request);
  return NextResponse.json(
    { error: { code, message, ...(details === undefined ? {} : { details }), requestId: id } },
    { status, headers: { 'Cache-Control': 'no-store', 'X-Request-Id': id } }
  );
}

export function jsonData<T>(data: T, request?: Request, meta?: Record<string, unknown>): NextResponse {
  const id = requestId(request);
  return NextResponse.json(
    { data, ...(meta ? { meta } : {}) },
    { headers: { 'Cache-Control': 'no-store', 'X-Request-Id': id } }
  );
}

export function databaseUnavailable(request?: Request): NextResponse {
  return jsonError('DATABASE_UNAVAILABLE', '业务数据库尚未配置或暂时不可用。', 503, request);
}

export function parsePage(request: Request): { page: number; pageSize: number } {
  const url = new URL(request.url);
  const page = Math.max(1, Math.min(10_000, Number.parseInt(url.searchParams.get('page') ?? '1', 10) || 1));
  const pageSize = Math.max(1, Math.min(60, Number.parseInt(url.searchParams.get('pageSize') ?? '20', 10) || 20));
  return { page, pageSize };
}
