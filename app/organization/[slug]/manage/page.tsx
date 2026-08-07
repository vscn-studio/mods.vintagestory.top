import { notFound } from 'next/navigation';
import { HomeShell } from '@/components/HomeShell';
import { OrganizationManagementPage } from '@/components/ManagementPages';
import { manageableOrganizationPage } from '@/lib/page-access';
import { getSitePreferences } from '@/lib/site-preferences';

export default async function OrganizationManageRoute({ params }: { params: Promise<{ slug: string }> }) {
  const [{ slug }, preferences] = await Promise.all([params, getSitePreferences()]);
  if ((await manageableOrganizationPage(slug, preferences.sessionAccount)) === 'not-found') notFound();
  return <HomeShell initialLanguage={preferences.language} initialNightMode={preferences.nightMode} initialSessionAccount={preferences.sessionAccount}><OrganizationManagementPage slug={slug} /></HomeShell>;
}
