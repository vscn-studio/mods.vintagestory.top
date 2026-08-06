import { NextRequest, NextResponse } from 'next/server';
import {
  getAccountAvatarUrl,
  getAccountPrimaryIdentity,
  getSessionAccount,
  isCommunityAdmin,
  normalizeOrganizationNames
} from '@/lib/auth-server';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const account = await getSessionAccount(request);
  if (!account) return NextResponse.json({ ok: false, message: '未登录' }, { status: 401 });
  const identity = getAccountPrimaryIdentity(account);
  return NextResponse.json({
    ok: true,
    account: {
      id: account.id,
      provider: identity.provider,
      displayName: identity.displayName,
      username: identity.username ?? identity.displayName,
      bindEmail: account.bindEmail,
      playerName: identity.playerName,
      avatarUrl: getAccountAvatarUrl(account),
      isAdmin: isCommunityAdmin(account),
      organizations: normalizeOrganizationNames(account.organizations),
      ownedOrganizations: normalizeOrganizationNames(account.ownedOrganizations)
    }
  });
}
