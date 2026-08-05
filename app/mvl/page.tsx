import { HomeShell } from '@/components/HomeShell';
import { MvlPage } from '@/components/MvlPage';
import { getSitePreferences } from '@/lib/site-preferences';

export default async function MvlRoute() {
  const preferences = await getSitePreferences();

  return (
    <HomeShell
      initialLanguage={preferences.language}
      initialNightMode={preferences.nightMode}
      initialSessionAccount={preferences.sessionAccount}
    >
      <MvlPage />
    </HomeShell>
  );
}
