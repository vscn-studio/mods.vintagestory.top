import { notFound } from 'next/navigation';
import { ContentPreviewPage } from '@/components/ContentPreviewPage';
import { HomeShell } from '@/components/HomeShell';
import { getServerSessionAccountSummary } from '@/lib/auth-server';
import { readableProjectPage } from '@/lib/page-access';
import { getSitePreferences } from '@/lib/site-preferences';

export default async function ModpackPreviewRoute({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, preferences, account] = await Promise.all([params, getSitePreferences(), getServerSessionAccountSummary()]);
  const page = await readableProjectPage(id, 'MODPACK', account);
  if (page.access === 'not-found') notFound();

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
