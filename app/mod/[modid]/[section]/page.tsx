import { notFound } from 'next/navigation';
import { ContentPreviewPage } from '@/components/ContentPreviewPage';
import { HomeShell } from '@/components/HomeShell';
import { getSitePreferences } from '@/lib/site-preferences';
import { isPreviewSection } from '@/lib/preview-sections';

export default async function ModPreviewSectionRoute({ params }: { params: Promise<{ modid: string; section: string }> }) {
  const [{ modid, section }, preferences] = await Promise.all([params, getSitePreferences()]);

  if (!isPreviewSection(section) || section === 'description') notFound();

  return (
    <HomeShell
      initialLanguage={preferences.language}
      initialNightMode={preferences.nightMode}
      initialSessionAccount={preferences.sessionAccount}
    >
      <ContentPreviewPage kind="mod" id={modid} initialSection={section} />
    </HomeShell>
  );
}
