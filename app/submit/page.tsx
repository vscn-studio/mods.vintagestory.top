import { HomeShell } from '@/components/HomeShell';
import { SubmitProjectPage } from '@/components/SubmitProjectPage';
import { getSitePreferences } from '@/lib/site-preferences';

export default async function SubmitPage() {
  const preferences = await getSitePreferences();
  return <HomeShell initialLanguage={preferences.language} initialNightMode={preferences.nightMode} initialSessionAccount={preferences.sessionAccount}><SubmitProjectPage sessionAccount={preferences.sessionAccount} /></HomeShell>;
}
