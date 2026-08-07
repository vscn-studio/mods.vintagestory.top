import { HomeShell } from '@/components/HomeShell';
import { WorkspacePage } from '@/components/WorkspacePage';
import { getSitePreferences } from '@/lib/site-preferences';

export default async function OrganizationsPage() { const preferences = await getSitePreferences(); return <HomeShell initialLanguage={preferences.language} initialNightMode={preferences.nightMode} initialSessionAccount={preferences.sessionAccount}><WorkspacePage kind="organizations" sessionAccount={preferences.sessionAccount} /></HomeShell>; }
