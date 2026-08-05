import { NextRequest, NextResponse } from 'next/server';
import {
  authenticateIdentity,
  clearPendingIdentity,
  normalizeGroups,
  setAccountSession,
  setPendingIdentity
} from '@/lib/auth-server';
import { publicOrigin, publicUrl } from '@/lib/web-url';

export const runtime = 'nodejs';

const issuer = () => (process.env.OIDC_ISSUER ?? 'https://connect.vintagestory.top').replace(/\/+$/, '');

function clearOidcCookies(response: NextResponse): void {
  for (const name of ['mod_oidc_state', 'mod_oidc_verifier', 'mod_oidc_return_to']) {
    response.cookies.set(name, '', {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 0
    });
  }
}

function errorRedirect(request: NextRequest, message: string): NextResponse {
  const url = publicUrl(request, '/');
  url.searchParams.set('auth_error', message);
  return NextResponse.redirect(url);
}

function safeReturnTo(request: NextRequest, candidate: string | undefined): string {
  if (!candidate || candidate.length > 2048) return '/';
  try {
    const parsed = new URL(candidate, request.url);
    if (parsed.origin !== publicOrigin(request)) return '/';
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return '/';
  }
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const state = request.nextUrl.searchParams.get('state');
  const storedState = request.cookies.get('mod_oidc_state')?.value;
  const verifier = request.cookies.get('mod_oidc_verifier')?.value;
  const clientId = (process.env.OIDC_CLIENT_ID ?? '').trim();
  const clientSecret = (process.env.OIDC_CLIENT_SECRET ?? '').trim();
  const redirectUri =
    (process.env.OIDC_REDIRECT_URI ?? '').trim() || publicUrl(request, '/api/auth/community/callback').toString();
  if (!code || !state || !storedState || state !== storedState || !verifier) {
    return errorRedirect(request, '社区授权状态无效或已过期，请重新尝试。');
  }
  if (!clientId || !clientSecret) return errorRedirect(request, '社区 OIDC 尚未配置。');

  let discovery: { token_endpoint?: string; userinfo_endpoint?: string };
  try {
    const response = await fetch(`${issuer()}/.well-known/openid-configuration`, { cache: 'no-store' });
    if (!response.ok) throw new Error('discovery failed');
    discovery = (await response.json()) as { token_endpoint?: string; userinfo_endpoint?: string };
  } catch {
    return errorRedirect(request, '社区 OIDC 服务暂时不可用。');
  }
  if (!discovery.token_endpoint || !discovery.userinfo_endpoint) {
    return errorRedirect(request, '社区 OIDC 配置缺少令牌或 UserInfo 端点。');
  }

  const tokenBody = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    client_id: clientId,
    code_verifier: verifier
  });
  let token: { access_token?: string; token_type?: string };
  try {
    const basic = Buffer.from(`${clientId}:${clientSecret}`, 'utf8').toString('base64');
    const response = await fetch(discovery.token_endpoint, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${basic}`
      },
      body: tokenBody.toString(),
      cache: 'no-store'
    });
    if (!response.ok) throw new Error('token failed');
    token = (await response.json()) as { access_token?: string; token_type?: string };
  } catch {
    return errorRedirect(request, '社区授权令牌交换失败，请重新尝试。');
  }
  if (!token.access_token) return errorRedirect(request, '社区 OIDC 未返回访问令牌。');

  let profile: {
    sub?: string;
    preferred_username?: string;
    name?: string;
    email?: string;
    email_verified?: boolean;
    picture?: string;
    groups?: unknown;
  };
  try {
    const response = await fetch(discovery.userinfo_endpoint, {
      headers: { Accept: 'application/json', Authorization: `Bearer ${token.access_token}` },
      cache: 'no-store'
    });
    if (!response.ok) throw new Error('userinfo failed');
    profile = (await response.json()) as typeof profile;
  } catch {
    return errorRedirect(request, '无法读取社区账号资料，请重新尝试。');
  }
  if (!profile.sub) return errorRedirect(request, '社区 OIDC 返回的身份资料不完整。');

  const displayName = (profile.preferred_username ?? profile.name ?? '').trim();
  if (!displayName) return errorRedirect(request, '社区 OIDC 未返回用户名。');
  const groups = normalizeGroups(profile.groups);
  const identity = {
    provider: 'community' as const,
    subject: `oidc:${profile.sub}`,
    displayName,
    providerEmail: profile.email?.trim() || undefined,
    providerEmailVerified: profile.email_verified === true,
    username: profile.preferred_username?.trim() || displayName,
    avatarUrl: profile.picture?.trim() || undefined,
    groups: groups.length > 0 ? groups : undefined
  };

  const returnTo = safeReturnTo(request, request.cookies.get('mod_oidc_return_to')?.value);
  const redirect = new URL(returnTo, `${publicOrigin(request)}/`);
  let authentication: Awaited<ReturnType<typeof authenticateIdentity>>;
  try {
    authentication = await authenticateIdentity(identity);
  } catch {
    return errorRedirect(request, '账号绑定服务暂时不可用，请稍后重试。');
  }
  if (authentication.status === 'provider-conflict') {
    return errorRedirect(request, '该邮箱已绑定另外一个社区账号。');
  }

  if (authentication.status !== 'authenticated') redirect.searchParams.set('auth', 'community');
  const response = NextResponse.redirect(redirect);
  if (authentication.status === 'authenticated') {
    setAccountSession(response, authentication.account.id);
  } else {
    setPendingIdentity(response, identity);
  }
  clearOidcCookies(response);
  if (authentication.status === 'authenticated') clearPendingIdentity(response);
  return response;
}
