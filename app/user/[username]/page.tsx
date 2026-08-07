import { notFound } from 'next/navigation';
import { AccountPreviewPage } from '@/components/AccountPreviewPage';
import { HomeShell } from '@/components/HomeShell';
import { existingUserPage } from '@/lib/page-access';
import { getSitePreferences } from '@/lib/site-preferences';

export default async function UserPreviewRoute({ params }: { params: Promise<{ username: string }> }) {
  const [{ username }, preferences] = await Promise.all([params, getSitePreferences()]);
  if ((await existingUserPage(username)) === 'not-found') notFound();

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
