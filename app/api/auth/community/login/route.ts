import { createHash, randomBytes } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { publicOrigin, publicUrl } from '@/lib/web-url';

export const runtime = 'nodejs';

const issuer = () => (process.env.OIDC_ISSUER ?? 'https://connect.vintagestory.top').replace(/\/+$/, '');

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge
  };
}

function challenge(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url');
}

function safeReturnTo(request: NextRequest): string {
  const candidate = request.nextUrl.searchParams.get('returnTo');
  if (!candidate || candidate.length > 2048) return '/';
  try {
    const parsed = new URL(candidate, request.url);
    return parsed.origin === publicOrigin(request) ? `${parsed.pathname}${parsed.search}${parsed.hash}` : '/';
  } catch {
    return '/';
  }
}

export async function GET(request: NextRequest) {
  const clientId = (process.env.OIDC_CLIENT_ID ?? '').trim();
  const clientSecret = (process.env.OIDC_CLIENT_SECRET ?? '').trim();
  const redirectUri =
    (process.env.OIDC_REDIRECT_URI ?? '').trim() || publicUrl(request, '/api/auth/community/callback').toString();
  if (!clientId || !clientSecret) {
    return NextResponse.json(
      {
        ok: false,
        message: '社区 OIDC 尚未配置，请设置 OIDC_CLIENT_ID 和 OIDC_CLIENT_SECRET。'
      },
      { status: 503 }
    );
  }

  let discovery: { authorization_endpoint?: string };
  try {
    const response = await fetch(`${issuer()}/.well-known/openid-configuration`, { cache: 'no-store' });
    if (!response.ok) throw new Error('discovery failed');
    discovery = (await response.json()) as { authorization_endpoint?: string };
  } catch {
    return NextResponse.json({ ok: false, message: '社区 OIDC 服务暂时不可用。' }, { status: 502 });
  }
  if (!discovery.authorization_endpoint) {
    return NextResponse.json({ ok: false, message: '社区 OIDC 配置缺少授权端点。' }, { status: 502 });
  }

  const state = randomBytes(24).toString('base64url');
  const verifier = randomBytes(32).toString('base64url');
  const authorization = new URL(discovery.authorization_endpoint);
  authorization.searchParams.set('client_id', clientId);
  authorization.searchParams.set('redirect_uri', redirectUri);
  authorization.searchParams.set('response_type', 'code');
  authorization.searchParams.set('scope', 'openid profile email');
  authorization.searchParams.set('state', state);
  authorization.searchParams.set('code_challenge', challenge(verifier));
  authorization.searchParams.set('code_challenge_method', 'S256');

  const response = NextResponse.redirect(authorization);
  response.cookies.set('mod_oidc_state', state, cookieOptions(10 * 60));
  response.cookies.set('mod_oidc_verifier', verifier, cookieOptions(10 * 60));
  response.cookies.set('mod_oidc_return_to', safeReturnTo(request), cookieOptions(10 * 60));
  return response;
}
