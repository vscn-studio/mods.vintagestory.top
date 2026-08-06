import { ContentPreviewPage } from '@/components/ContentPreviewPage';
import { HomeShell } from '@/components/HomeShell';
import { getSitePreferences } from '@/lib/site-preferences';

export default async function ModpackPreviewRoute({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, preferences] = await Promise.all([params, getSitePreferences()]);

  return (
    <HomeShell
      initialLanguage={preferences.language}
      initialNightMode={preferences.nightMode}
      initialSessionAccount={preferences.sessionAccount}
    >
      <ContentPreviewPage kind="modpack" id={id} sessionAccount={preferences.sessionAccount} />
    </HomeShell>
  );
}
