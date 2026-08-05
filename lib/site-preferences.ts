import { cookies } from 'next/headers';
import type { SiteLanguage } from '@/components/AuthModal';
import { getServerSessionAccountSummary, type SessionAccountSummary } from '@/lib/auth-server';

export async function getSitePreferences(): Promise<{
  language: SiteLanguage;
  nightMode: boolean;
  sessionAccount: SessionAccountSummary | null;
}> {
  const cookieStore = await cookies();
  return {
    language: cookieStore.get('vscn-language')?.value === 'en' ? 'en' : 'zh-CN',
    nightMode: cookieStore.get('vscn-night-mode')?.value === 'true',
    sessionAccount: await getServerSessionAccountSummary()
  };
}
