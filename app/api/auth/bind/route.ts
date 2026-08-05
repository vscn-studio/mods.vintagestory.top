import { NextRequest, NextResponse } from 'next/server';
import {
  clearPendingIdentity,
  consumeActivationChallenge,
  getPendingIdentity,
  normalizeEmail,
  setAccountSession,
  upsertModAccount
} from '@/lib/auth-server';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const identity = getPendingIdentity(request);
  if (!identity) {
    return NextResponse.json(
      { ok: false, message: '认证状态已过期，请重新选择登录方式。' },
      { status: 401, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { ok: false, message: '请求格式无效' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  const bindEmail = normalizeEmail(body.bindEmail);
  const activationCode = typeof body.activationCode === 'string' ? body.activationCode.trim() : '';
  if (!bindEmail) {
    return NextResponse.json(
      { ok: false, message: '请输入有效的绑定邮箱。' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } }
    );
  }
  if (!/^\d{6}$/.test(activationCode)) {
    return NextResponse.json(
      { ok: false, message: '请输入邮箱收到的 6 位验证码。' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  let verification: Awaited<ReturnType<typeof consumeActivationChallenge>>;
  try {
    verification = await consumeActivationChallenge(identity, bindEmail, activationCode);
  } catch {
    return NextResponse.json(
      { ok: false, message: '验证码服务暂时不可用，请稍后重试。' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } }
    );
  }
  if (verification !== 'ok') {
    return NextResponse.json(
      {
        ok: false,
        message:
          verification === 'locked'
            ? '验证码尝试次数过多，请重新发送验证码。'
            : '验证码无效或已过期，请重新获取。'
      },
      { status: 400, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  let account: Awaited<ReturnType<typeof upsertModAccount>>;
  try {
    account = await upsertModAccount(identity, bindEmail);
  } catch {
    return NextResponse.json(
      { ok: false, message: '账号保存失败，请稍后重试。' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } }
    );
  }
  const response = NextResponse.json({
    ok: true,
    account: {
      id: account.id,
      provider: account.provider,
      displayName: account.displayName,
      bindEmail: account.bindEmail
    }
  }, { headers: { 'Cache-Control': 'no-store' } });
  setAccountSession(response, account.id);
  clearPendingIdentity(response);
  return response;
}
