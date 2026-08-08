import { NextRequest, NextResponse } from 'next/server';
import {
  AccountBindingConflictError,
  clearPendingIdentity,
  clearVerifiedBinding,
  consumeActivationChallenge,
  findBindingConflict,
  getPendingIdentity,
  getVerifiedBinding,
  normalizeEmail,
  createAccountSession,
  setVerifiedBinding,
  upsertModAccount
} from '@/lib/auth-server';
import { hashPassword, validatePassword } from '@/lib/password';
import { checkCsrf, rateLimit } from '@/lib/request-security';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  if (!checkCsrf(request)) return NextResponse.json({ ok: false, message: '请求来源校验失败。' }, { status: 403, headers: { 'Cache-Control': 'no-store' } });
  if (!rateLimit(request, 20)) return NextResponse.json({ ok: false, message: '请求过于频繁，请稍后重试。' }, { status: 429, headers: { 'Cache-Control': 'no-store' } });
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
  const step = body.step === 'set-password' ? 'set-password' : 'verify-code';
  const activationCode = typeof body.activationCode === 'string' ? body.activationCode.trim() : '';
  if (!bindEmail) {
    return NextResponse.json(
      { ok: false, message: '请输入有效的绑定邮箱。' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  try {
    if (await findBindingConflict(identity, bindEmail)) {
      return NextResponse.json(
        {
          ok: false,
          code: 'EMAIL_PROVIDER_CONFLICT',
          message: '该邮箱已绑定其他 Mod 站账号，不能用于当前绑定。'
        },
        { status: 409, headers: { 'Cache-Control': 'no-store' } }
      );
    }
  } catch {
    return NextResponse.json(
      { ok: false, message: '账号绑定服务暂时不可用，请稍后重试。' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  if (step === 'verify-code' && !/^\d{6}$/.test(activationCode)) {
    return NextResponse.json(
      { ok: false, message: '请输入邮箱收到的 6 位验证码。' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  if (step === 'verify-code') {
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
    const response = NextResponse.json({ ok: true, verified: true }, { headers: { 'Cache-Control': 'no-store' } });
    setVerifiedBinding(response, identity, bindEmail);
    return response;
  }

  const verified = getVerifiedBinding(request);
  if (!verified || verified.provider !== identity.provider || verified.subject !== identity.subject || verified.bindEmail !== bindEmail) {
    return NextResponse.json({ ok: false, message: '请先验证绑定邮箱。' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
  }
  const password = typeof body.password === 'string' ? body.password : '';
  const confirmPassword = typeof body.confirmPassword === 'string' ? body.confirmPassword : '';
  if (!validatePassword(password)) {
    return NextResponse.json({ ok: false, message: '密码长度需为 8 至 128 个字符。' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
  }
  if (password !== confirmPassword) {
    return NextResponse.json({ ok: false, message: '两次输入的密码不一致。' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
  }
  let passwordHash: string;
  try {
    passwordHash = await hashPassword(password);
  } catch {
    return NextResponse.json({ ok: false, message: '密码服务暂时不可用，请稍后重试。' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }

  let account: Awaited<ReturnType<typeof upsertModAccount>>;
  try {
    account = await upsertModAccount(identity, bindEmail, passwordHash);
  } catch (error) {
    if (error instanceof AccountBindingConflictError) {
      return NextResponse.json(
        {
          ok: false,
          code: 'EMAIL_PROVIDER_CONFLICT',
          message: '该邮箱已绑定其他 Mod 站账号，不能用于当前绑定。'
        },
        { status: 409, headers: { 'Cache-Control': 'no-store' } }
      );
    }
    return NextResponse.json(
      { ok: false, message: '账号保存失败，请稍后重试。' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } }
    );
  }
  if (account.status !== 'ACTIVE') {
    return NextResponse.json({ ok: false, code: 'ACCOUNT_DISABLED', message: '该账号已被停用，无法登录。' }, { status: 403, headers: { 'Cache-Control': 'no-store' } });
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
  try {
    await createAccountSession(response, account.id, request);
  } catch {
    return NextResponse.json({ ok: false, message: '会话服务暂时不可用，请稍后重试。' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
  clearPendingIdentity(response);
  clearVerifiedBinding(response);
  return response;
}
