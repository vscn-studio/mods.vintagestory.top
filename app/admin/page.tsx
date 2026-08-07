import { notFound } from 'next/navigation';
import { AdminDashboard } from '@/components/AdminDashboard';
import { HomeShell } from '@/components/HomeShell';
import { getSitePreferences } from '@/lib/site-preferences';

export default async function AdminPage() {
  const preferences = await getSitePreferences();
  const account = preferences.sessionAccount;

  if (!account || !account.isAdmin) {
    notFound();
  }

  return (
    <HomeShell
      initialLanguage={preferences.language}
      initialNightMode={preferences.nightMode}
      initialSessionAccount={account}
    >
      <AdminDashboard />
    </HomeShell>
  );
}
