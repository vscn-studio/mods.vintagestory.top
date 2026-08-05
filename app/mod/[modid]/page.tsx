import { ContentPreviewPage } from '@/components/ContentPreviewPage';
import { HomeShell } from '@/components/HomeShell';
import { getSitePreferences } from '@/lib/site-preferences';

export default async function ModPreviewRoute({ params }: { params: Promise<{ modid: string }> }) {
  const [{ modid }, preferences] = await Promise.all([params, getSitePreferences()]);

  return (
    <HomeShell
      initialLanguage={preferences.language}
      initialNightMode={preferences.nightMode}
      initialSessionAccount={preferences.sessionAccount}
    >
      <ContentPreviewPage kind="mod" id={modid} />
    </HomeShell>
  );
}
