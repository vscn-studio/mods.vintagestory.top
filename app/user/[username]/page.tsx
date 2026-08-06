import { AccountPreviewPage } from '@/components/AccountPreviewPage';
import { HomeShell } from '@/components/HomeShell';
import { getSitePreferences } from '@/lib/site-preferences';

export default async function UserPreviewRoute({ params }: { params: Promise<{ username: string }> }) {
  const [{ username }, preferences] = await Promise.all([params, getSitePreferences()]);

  return (
    <HomeShell
      initialLanguage={preferences.language}
      initialNightMode={preferences.nightMode}
      initialSessionAccount={preferences.sessionAccount}
    >
      <AccountPreviewPage kind="user" id={username} sessionAccount={preferences.sessionAccount} />
    </HomeShell>
  );
}
