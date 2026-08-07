import { notFound } from 'next/navigation';
import { ContentPreviewPage } from '@/components/ContentPreviewPage';
import { HomeShell } from '@/components/HomeShell';
import { getServerSessionAccountSummary } from '@/lib/auth-server';
import { readableProjectPage } from '@/lib/page-access';
import { getSitePreferences } from '@/lib/site-preferences';
import { isPreviewSection } from '@/lib/preview-sections';

export default async function ModPreviewSectionRoute({ params }: { params: Promise<{ modid: string; section: string }> }) {
  const [{ modid, section }, preferences, account] = await Promise.all([params, getSitePreferences(), getServerSessionAccountSummary()]);

  if (!isPreviewSection(section) || section === 'description') notFound();
  if ((await readableProjectPage(modid, ['MOD', 'THEME_PACK', 'SERVER'], account)).access === 'not-found') notFound();

  return (
    <HomeShell
      initialLanguage={preferences.language}
      initialNightMode={preferences.nightMode}
      initialSessionAccount={preferences.sessionAccount}
    >
      <ContentPreviewPage kind="mod" id={modid} initialSection={section} sessionAccount={preferences.sessionAccount} />
    </HomeShell>
  );
}
