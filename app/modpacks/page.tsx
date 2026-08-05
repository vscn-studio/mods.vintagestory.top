import { ContentBrowser } from '@/components/ContentBrowser';
import { HomeShell } from '@/components/HomeShell';
import { getSitePreferences } from '@/lib/site-preferences';

export default async function ModpacksPage() {
  const preferences = await getSitePreferences();

  return (
    <HomeShell
      initialLanguage={preferences.language}
      initialNightMode={preferences.nightMode}
      initialSessionAccount={preferences.sessionAccount}
    >
      <ContentBrowser />
    </HomeShell>
  );
}
