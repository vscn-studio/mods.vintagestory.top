import { AccountPreviewPage } from '@/components/AccountPreviewPage';
import { HomeShell } from '@/components/HomeShell';
import { getSitePreferences } from '@/lib/site-preferences';

export default async function OrganizationPreviewRoute({ params }: { params: Promise<{ slug: string }> }) {
  const [{ slug }, preferences] = await Promise.all([params, getSitePreferences()]);

  return (
    <HomeShell
      initialLanguage={preferences.language}
      initialNightMode={preferences.nightMode}
      initialSessionAccount={preferences.sessionAccount}
    >
      <AccountPreviewPage kind="organization" id={slug} sessionAccount={preferences.sessionAccount} />
    </HomeShell>
  );
}
