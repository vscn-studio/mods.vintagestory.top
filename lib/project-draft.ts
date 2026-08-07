export type ProjectDraftType = 'mod' | 'modpack' | 'theme-pack' | 'server';
export type ProjectDraftVisibility = 'public' | 'private';

export type ProjectDraft = {
  type: ProjectDraftType;
  name: string;
  slug: string;
  summary: string;
  visibility: ProjectDraftVisibility;
  owner: { type: 'personal' } | { type: 'organization'; id: string };
};

export const PROJECT_DRAFT_STORAGE_KEY = 'vscn.project-submission-draft';

export function saveProjectDraft(draft: ProjectDraft): void {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(PROJECT_DRAFT_STORAGE_KEY, JSON.stringify(draft));
}

export function readProjectDraft(): ProjectDraft | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(PROJECT_DRAFT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ProjectDraft>;
    if (!parsed || typeof parsed.name !== 'string' || typeof parsed.slug !== 'string' || typeof parsed.summary !== 'string') return null;
    if (!['mod', 'modpack', 'theme-pack', 'server'].includes(String(parsed.type))) return null;
    if (!['public', 'private'].includes(String(parsed.visibility))) return null;
    const owner = parsed.owner?.type === 'organization' && typeof parsed.owner.id === 'string' && parsed.owner.id.trim()
      ? { type: 'organization' as const, id: parsed.owner.id.trim() }
      : { type: 'personal' as const };
    return {
      type: parsed.type as ProjectDraftType,
      name: parsed.name,
      slug: parsed.slug,
      summary: parsed.summary,
      visibility: parsed.visibility as ProjectDraftVisibility,
      owner
    };
  } catch {
    return null;
  }
}

export function clearProjectDraft(): void {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(PROJECT_DRAFT_STORAGE_KEY);
}
