import { notFound } from 'next/navigation';
import { ContentPreviewPage } from '@/components/ContentPreviewPage';
import { HomeShell } from '@/components/HomeShell';
import { getServerSessionAccountSummary } from '@/lib/auth-server';
import { readableProjectPage } from '@/lib/page-access';
import { getSitePreferences } from '@/lib/site-preferences';

export default async function ModPreviewRoute({ params }: { params: Promise<{ modid: string }> }) {
  const [{ modid }, preferences, account] = await Promise.all([params, getSitePreferences(), getServerSessionAccountSummary()]);
  const page = await readableProjectPage(modid, ['MOD', 'THEME_PACK', 'SERVER'], account);
  if (page.access === 'not-found') notFound();

  return (
    <HomeShell
      initialLanguage={preferences.language}
      initialNightMode={preferences.nightMode}
      initialSessionAccount={preferences.sessionAccount}
    >
      <ContentPreviewPage kind="mod" id={modid} sessionAccount={preferences.sessionAccount} />
    </HomeShell>
  );
}
