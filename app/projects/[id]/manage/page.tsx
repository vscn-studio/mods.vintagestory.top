import { notFound } from 'next/navigation';
import { HomeShell } from '@/components/HomeShell';
import { ProjectManagementPage } from '@/components/ManagementPages';
import { manageableProjectPage } from '@/lib/page-access';
import { getSitePreferences } from '@/lib/site-preferences';

export default async function ProjectManageRoute({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, preferences] = await Promise.all([params, getSitePreferences()]);
  if ((await manageableProjectPage(id, preferences.sessionAccount)) === 'not-found') notFound();
  return <HomeShell initialLanguage={preferences.language} initialNightMode={preferences.nightMode} initialSessionAccount={preferences.sessionAccount}><ProjectManagementPage id={id} /></HomeShell>;
}
