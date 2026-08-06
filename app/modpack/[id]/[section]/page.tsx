import { notFound } from 'next/navigation';
import { ContentPreviewPage } from '@/components/ContentPreviewPage';
import { HomeShell } from '@/components/HomeShell';
import { getSitePreferences } from '@/lib/site-preferences';
import { isPreviewSection } from '@/lib/preview-sections';

export default async function ModpackPreviewSectionRoute({ params }: { params: Promise<{ id: string; section: string }> }) {
  const [{ id, section }, preferences] = await Promise.all([params, getSitePreferences()]);

  if (!isPreviewSection(section) || section === 'description') notFound();

  return (
    <HomeShell
      initialLanguage={preferences.language}
      initialNightMode={preferences.nightMode}
      initialSessionAccount={preferences.sessionAccount}
    >
      <ContentPreviewPage kind="modpack" id={id} initialSection={section} />
    </HomeShell>
  );
}
