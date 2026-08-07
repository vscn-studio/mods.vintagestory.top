import { NextRequest, NextResponse } from 'next/server';
import { authenticateIdentity, clearPendingIdentity, createAccountSession, setPendingIdentity } from '@/lib/auth-server';
import { checkCsrf, rateLimit } from '@/lib/request-security';

export const runtime = 'nodejs';

type OfficialLoginResponse = {
  valid?: number;
  reason?: string;
  uid?: string;
  playername?: string;
  playerName?: string;
  prelogintoken?: string;
  preLoginToken?: string;
};

function errorResponse(message: string, status = 400, extra?: Record<string, unknown>) {
  return NextResponse.json({ ok: false, message, ...extra }, { status });
}

export async function POST(request: NextRequest) {
  if (!checkCsrf(request)) return errorResponse('请求来源校验失败', 403);
  if (!rateLimit(request, 20)) return errorResponse('请求过于频繁，请稍后重试', 429);
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return errorResponse('请求格式无效');
  }

  const account = typeof body.account === 'string' ? body.account.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  const totpCode = typeof body.totpCode === 'string' ? body.totpCode.trim() : '';
  const preLoginToken = typeof body.preLoginToken === 'string' ? body.preLoginToken.trim() : '';
  if (!account || !password) return errorResponse('请输入 VintageStory 账号和密码');
  if (account.length > 320 || password.length > 1024 || totpCode.length > 32 || preLoginToken.length > 512) {
    return errorResponse('认证参数长度无效');
  }

  const loginUrl = process.env.VS_AUTH3_LOGIN_URL ?? 'https://auth3.vintagestory.at/v2/gamelogin';
  const versionUrl = process.env.VS_API_LATEST_UNSTABLE_URL ?? 'https://api.vintagestory.at/latestunstable.txt';
  let gameVersion = '1.22.1';
  try {
    const versionResponse = await fetch(versionUrl, { headers: { Accept: 'text/plain' }, cache: 'no-store' });
    if (versionResponse.ok) gameVersion = (await versionResponse.text()).trim() || gameVersion;
  } catch {
    // The official login endpoint can still accept the fallback version.
  }

  const form = new URLSearchParams({
    email: account,
    password,
    totpcode: totpCode,
    prelogintoken: preLoginToken,
    gameloginversion: gameVersion
  });

  let loginData: OfficialLoginResponse;
  try {
    const response = await fetch(loginUrl, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
      cache: 'no-store'
    });
    if (!response.ok) return errorResponse('VintageStory 认证服务暂时不可用', 502);
    loginData = (await response.json()) as OfficialLoginResponse;
  } catch {
    return errorResponse('VintageStory 认证服务连接失败', 502);
  }

  if ((loginData.valid ?? 0) !== 1) {
    const reason = (loginData.reason ?? '').toLowerCase();
    if (reason === 'requiretotpcode' || reason === 'wrongtotpcode') {
      return errorResponse(
        reason === 'wrongtotpcode' ? '二步验证码错误，请重试。' : '请输入 VintageStory 账号的二步验证码。',
        400,
        {
          code: 'VS_TOTP_REQUIRED',
          preLoginToken: loginData.prelogintoken ?? loginData.preLoginToken ?? preLoginToken
        }
      );
    }
    return errorResponse(`VintageStory 登录失败${loginData.reason ? `：${loginData.reason}` : ''}`, 401);
  }

  const playerName = (loginData.playername ?? loginData.playerName ?? '').trim();
  const playerUid = (loginData.uid ?? '').trim();
  if (!playerName || !playerUid) return errorResponse('VintageStory 返回数据不完整，无法完成绑定', 502);

  const identity = {
    provider: 'official' as const,
    subject: `vs:${playerUid}`,
    displayName: playerName,
    providerEmail: account,
    providerEmailVerified: true,
    playerName,
    playerUid
  };
  let authentication: Awaited<ReturnType<typeof authenticateIdentity>>;
  try {
    authentication = await authenticateIdentity(identity);
  } catch {
    return errorResponse('账号绑定服务暂时不可用，请稍后重试。', 503);
  }
  if (authentication.status === 'provider-conflict') {
    return errorResponse('该邮箱已绑定另外一个游戏账号。', 409, { code: 'EMAIL_PROVIDER_CONFLICT' });
  }
  if (authentication.status === 'authenticated' && authentication.account.status !== 'ACTIVE') {
    return errorResponse('该账号已被停用，无法登录。', 403, { code: 'ACCOUNT_DISABLED' });
  }
  if (authentication.status === 'authenticated') {
    const response = NextResponse.json({ ok: true, authenticated: true, identity });
    try {
      await createAccountSession(response, authentication.account.id, request);
    } catch {
      return errorResponse('会话服务暂时不可用，请稍后重试。', 503);
    }
    clearPendingIdentity(response);
    return response;
  }

  const response = NextResponse.json({ ok: true, authenticated: false, identity });
  setPendingIdentity(response, identity);
  return response;
}
