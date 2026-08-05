import { NextRequest, NextResponse } from 'next/server';
import { getSessionAccount } from '@/lib/auth-server';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const account = await getSessionAccount(request);
  if (!account) return NextResponse.json({ ok: false, message: '未登录' }, { status: 401 });
  return NextResponse.json({
    ok: true,
    account: {
      id: account.id,
      provider: account.provider,
      displayName: account.displayName,
      bindEmail: account.bindEmail,
      playerName: account.playerName,
      username: account.username
    }
  });
}
