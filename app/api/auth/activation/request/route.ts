import { randomInt } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { sendActivationEmail } from '@/lib/email-server';
import {
  discardActivationChallenge,
  findBindingConflict,
  getPendingIdentity,
  issueActivationChallenge,
  normalizeEmail
} from '@/lib/auth-server';

export const runtime = 'nodejs';

function errorResponse(message: string, status = 400, extra?: Record<string, unknown>) {
  return NextResponse.json({ ok: false, message, ...extra }, { status, headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: NextRequest) {
  const identity = getPendingIdentity(request);
  if (!identity) return errorResponse('认证状态已过期，请重新选择登录方式。', 401);

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return errorResponse('请求格式无效');
  }

  const bindEmail = normalizeEmail(body.bindEmail);
  if (!bindEmail) return errorResponse('请输入有效的绑定邮箱。');

  try {
    if (await findBindingConflict(identity, bindEmail)) {
      return errorResponse(
        identity.provider === 'community' ? '该邮箱已绑定另外一个社区账号。' : '该邮箱已绑定另外一个游戏账号。',
        409,
        { code: 'EMAIL_PROVIDER_CONFLICT' }
      );
    }
  } catch {
    return errorResponse('账号绑定服务暂时不可用，请稍后重试。', 503);
  }

  let challenge: Awaited<ReturnType<typeof issueActivationChallenge>>;
  try {
    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
    challenge = await issueActivationChallenge(identity, bindEmail, code);
    if (!challenge.ok) {
      return errorResponse('验证码已发送，请稍后再试。', 429, {
        retryAfterSeconds: challenge.retryAfterSeconds
      });
    }

    try {
      await sendActivationEmail(bindEmail, code);
    } catch {
      await discardActivationChallenge(challenge.challengeId);
      return errorResponse('验证码邮件发送失败，请稍后重试。', 503);
    }
  } catch {
    return errorResponse('验证码服务暂时不可用，请稍后重试。', 503);
  }

  return NextResponse.json(
    {
      ok: true,
      message: '验证码已发送，请检查邮箱。',
      expiresInSeconds: Math.max(1, Math.ceil((challenge.expiresAt - Date.now()) / 1000)),
      retryAfterSeconds: 60
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
