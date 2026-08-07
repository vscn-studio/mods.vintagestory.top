import { NextRequest, NextResponse } from 'next/server';
import { clearAccountSession, revokeAccountSession } from '@/lib/auth-server';
import { checkCsrf, rateLimit, setCsrfCookie } from '@/lib/request-security';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  if (!rateLimit(request, 30) || !checkCsrf(request)) return NextResponse.json({ ok: false, message: '请求来源校验失败。' }, { status: 403 });
  await revokeAccountSession(request);
  const response = NextResponse.json({ ok: true });
  clearAccountSession(response);
  setCsrfCookie(response);
  return response;
}
