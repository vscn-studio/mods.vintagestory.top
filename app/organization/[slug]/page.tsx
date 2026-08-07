import { notFound } from 'next/navigation';
import { AccountPreviewPage } from '@/components/AccountPreviewPage';
import { HomeShell } from '@/components/HomeShell';
import { getServerSessionAccountSummary } from '@/lib/auth-server';
import { readableOrganizationPage } from '@/lib/page-access';
import { getSitePreferences } from '@/lib/site-preferences';

export default async function OrganizationPreviewRoute({ params }: { params: Promise<{ slug: string }> }) {
  const [{ slug }, preferences, account] = await Promise.all([params, getSitePreferences(), getServerSessionAccountSummary()]);
  if ((await readableOrganizationPage(slug, account)) === 'not-found') notFound();

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
