import { HomeShell } from '@/components/HomeShell';
import { WorkspacePage } from '@/components/WorkspacePage';
import { getSitePreferences } from '@/lib/site-preferences';

export default async function ProjectsPage() { const preferences = await getSitePreferences(); return <HomeShell initialLanguage={preferences.language} initialNightMode={preferences.nightMode} initialSessionAccount={preferences.sessionAccount}><WorkspacePage kind="projects" sessionAccount={preferences.sessionAccount} /></HomeShell>; }
