import { NextRequest, NextResponse } from 'next/server';
import { authenticateEmail, createAccountSession, normalizeEmail } from '@/lib/auth-server';
import { checkCsrf, rateLimit } from '@/lib/request-security';

export const runtime = 'nodejs';

const genericFailure = '邮箱或密码错误，请检查后重试。';

function errorResponse(status = 401) {
  return NextResponse.json({ ok: false, message: genericFailure }, { status, headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: NextRequest) {
  if (!checkCsrf(request)) return errorResponse(403);
  if (!rateLimit(request, 20)) return errorResponse(429);
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return errorResponse();
  }
  const rawEmail = typeof body.email === 'string' ? body.email : '';
  const password = typeof body.password === 'string' ? body.password : '';
  const email = normalizeEmail(rawEmail);
  const safePassword = password.length > 128 ? `${password.slice(0, 128)}\u0000` : password;
  let account = null;
  try {
    account = await authenticateEmail(email, safePassword);
  } catch {
    return errorResponse(503);
  }
  if (!account) return errorResponse();
  const response = NextResponse.json({ ok: true, account: { id: account.id, displayName: account.displayName } }, { headers: { 'Cache-Control': 'no-store' } });
  try {
    await createAccountSession(response, account.id, request);
  } catch {
    return NextResponse.json({ ok: false, message: '会话服务暂时不可用，请稍后重试。' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
  return response;
}
