import { NextRequest, NextResponse } from 'next/server';
import {
  getSessionAccountSummary,
  getSessionAccount,
} from '@/lib/auth-server';
import { setCsrfCookie } from '@/lib/request-security';
import { databaseConfigured, databaseReady } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  if (databaseConfigured() && !(await databaseReady())) {
    const response = NextResponse.json({ ok: false, message: '账号服务暂时不可用。' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
    setCsrfCookie(response);
    return response;
  }
  const account = await getSessionAccount(request);
  if (!account) {
    const response = NextResponse.json({ ok: false, message: '未登录' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
    setCsrfCookie(response);
    return response;
  }
  const summary = getSessionAccountSummary(account);
  const response = NextResponse.json({
    ok: true,
    account: {
      ...summary,
      bindEmail: account.bindEmail,
      playerName: account.playerName
    }
  }, { headers: { 'Cache-Control': 'no-store' } });
  setCsrfCookie(response);
  return response;
}
