'use client';

import { ChevronLeft, ChevronRight, Download, FolderKanban, Grid2X2, Heart, List, Pencil } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ProfileEditModal, type ProfileEditValues, type ProfileMember } from '@/components/ProfileEditModal';
import { useSiteLanguage } from '@/components/SiteLanguageContext';
import type { SessionAccountSummary } from '@/lib/auth-server';
import { requestConfirmation } from '@/lib/client-confirmation';
import { ensureCsrfToken } from '@/lib/client-confirmation';

type AccountPreviewPageProps = {
  kind: 'user' | 'organization';
  id: string;
  sessionAccount?: SessionAccountSummary | null;
};

type ProjectType = 'mods' | 'theme-pack' | 'modpacks' | 'server';

type ProfileProject = {
  id: string;
  type: ProjectType;
  name: { zh: string; en: string };
  description: { zh: string; en: string };
  tags: Array<{ zh: string; en: string }>;
  summary?: { zh: string; en: string };
  slug?: string;
  stats?: { downloads: number; followers: number };
};

type ProfileResponse = {
  id: string;
  username?: string;
  displayName: string;
  name?: string;
  bio?: string;
  description?: string;
  avatarUrl?: string | null;
  projects: Array<Record<string, unknown>>;
  projectStats?: { projects: number; downloads: number; followers: number };
  members?: Array<{ id: string; username: string; name: string; role: string; avatarUrl?: string | null }>;
  createdAt?: string;
};

type ProfileEnvelope = {
  data?: ProfileResponse;
  meta?: { page?: number; pageSize?: number; total?: number; totalPages?: number };
  error?: { message?: string };
};

const profilePageSize = 20;

function apiProjectType(type: ProjectType): string {
  return type === 'mods' ? 'mod' : type === 'modpacks' ? 'modpack' : type;
}

const memberRoleNames = {
  owner: { zh: '所有者', en: 'Owner' },
  admin: { zh: '管理员', en: 'Admin' },
  maintainer: { zh: '维护者', en: 'Maintainer' },
  member: { zh: '成员', en: 'Member' },
  viewer: { zh: '只读成员', en: 'Viewer' }
} as const;

const copy = {
  'zh-CN': {
    projectsTitle: '项目',
    organization: '组织',
    members: '组织成员',
    projectCount: '项目数量',
    downloads: '下载量',
    followers: '关注量',
    contentNavigation: '探索内容',
    mods: '模组',
    themePacks: '主题包',
    modpacks: '整合包',
    serverTweaks: '服务器调整',
    viewMode: '显示方式',
    listView: '列表布局',
    gridView: '网格布局',
    previousPage: '上一页',
    nextPage: '下一页',
    pagination: '分页',
    noProjects: '该分类暂无项目。',
    loadingProjects: '正在加载项目…',
    retry: '重试',
    noDescription: '暂无公开资料介绍。',
    edit: '编辑'
  },
  en: {
    projectsTitle: 'Projects',
    organization: 'Organization',
    members: 'Organization members',
    projectCount: 'Projects',
    downloads: 'Downloads',
    followers: 'Followers',
    contentNavigation: 'Explore content',
    mods: 'Mods',
    themePacks: 'Theme packs',
    modpacks: 'Modpacks',
    serverTweaks: 'Server tweaks',
    viewMode: 'View mode',
    listView: 'List view',
    gridView: 'Grid view',
    previousPage: 'Previous page',
    nextPage: 'Next page',
    pagination: 'Pagination',
    noProjects: 'No projects in this category yet.',
    loadingProjects: 'Loading projects…',
    retry: 'Retry',
    noDescription: 'No public profile description.',
    edit: 'Edit'
  }
} as const;

function displayName(id: string): string {
  return id
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function profileId(value: string): string {
  return value.trim().toLocaleLowerCase().replace(/\s+/g, '-');
}

export function AccountPreviewPage({ kind, id, sessionAccount = null }: AccountPreviewPageProps) {
  const language = useSiteLanguage();
  const text = copy[language];
  const [projectType, setProjectType] = useState<ProjectType>('mods');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [reloadToken, setReloadToken] = useState(0);
  const name = displayName(id);
  const projectTabs: Array<{ id: ProjectType; label: string }> = [
    { id: 'mods', label: text.mods },
    { id: 'theme-pack', label: text.themePacks },
    { id: 'modpacks', label: text.modpacks },
    { id: 'server', label: text.serverTweaks }
  ];
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setLoadError('');
    const baseEndpoint = kind === 'user' ? `/api/v1/users/${encodeURIComponent(id)}` : `/api/v1/organizations/${encodeURIComponent(id)}`;
    const query = new URLSearchParams({ type: apiProjectType(projectType), page: String(page), pageSize: String(profilePageSize) });
    const endpoint = `${baseEndpoint}?${query.toString()}`;
    fetch(endpoint, { cache: 'no-store', signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json() as ProfileEnvelope;
        if (response.status === 404) throw new Error(language === 'en' ? 'Profile not found.' : '资料不存在。');
        if (!response.ok || !payload.data) throw new Error(payload.error?.message ?? (language === 'en' ? 'Unable to load profile.' : '资料加载失败。'));
        setProfile(payload.data);
        const nextTotalPages = Math.max(1, payload.meta?.totalPages ?? 1);
        setTotalPages(nextTotalPages);
        if (page > nextTotalPages) setPage(nextTotalPages);
      })
      .catch((error: unknown) => { if (error instanceof DOMException && error.name === 'AbortError') return; setLoadError(error instanceof Error ? error.message : ''); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [id, kind, language, page, projectType, reloadToken]);

  const profileProjects: ProfileProject[] = (profile?.projects ?? []).map((project) => {
    const item = project as { id: string; slug?: string; type?: string; name?: { zh: string; en: string }; summary?: { zh: string; en: string }; description?: { zh: string; en: string }; tags?: Array<{ name: string; nameEn: string }>; stats?: { downloads: number; followers: number } };
    const rawType = item.type ?? 'mod';
    const normalizedType = rawType === 'modpack' ? 'modpacks' : rawType === 'theme_pack' || rawType === 'theme-pack' ? 'theme-pack' : rawType === 'server' ? 'server' : 'mods';
    return { id: item.slug ?? item.id, slug: item.slug, type: normalizedType as ProjectType, name: item.name ?? { zh: '', en: '' }, description: item.summary ?? item.description ?? { zh: '', en: '' }, tags: (item.tags ?? []).map((tag) => ({ zh: tag.name, en: tag.nameEn })), stats: item.stats };
  });
  const visibleProjects = profileProjects.filter((project) => project.type === projectType);
  const projectCount = Number(profile?.projectStats?.projects ?? profileProjects.length);
  const totalDownloads = Number(profile?.projectStats?.downloads ?? profileProjects.reduce((sum, project) => sum + Number((project as ProfileProject & { stats?: { downloads?: number } }).stats?.downloads ?? 0), 0));
  const totalFollowers = Number(profile?.projectStats?.followers ?? profileProjects.reduce((sum, project) => sum + Number((project as ProfileProject & { stats?: { followers?: number } }).stats?.followers ?? 0), 0));
  const canEditProfile = kind === 'user'
    ? profileId(sessionAccount?.username ?? '') === profileId(id)
    : Boolean(sessionAccount?.organizationDetails?.some((organization) => organization.slug === id && ['owner', 'admin'].includes(organization.role)) || sessionAccount?.ownedOrganizations.some((organizationName) => profileId(organizationName) === profileId(id)));
  const profileName = profile?.displayName ?? profile?.name ?? (kind === 'user' && canEditProfile ? sessionAccount?.displayName : undefined) ?? name;
  const profileAvatarUrl = profile?.avatarUrl ?? (kind === 'user' && canEditProfile ? sessionAccount?.avatarUrl : undefined);
  const profileDescription = profile?.bio ?? profile?.description ?? '';
  const organizationMembers: ProfileMember[] = (profile?.members ?? []).map((member) => ({ id: member.id, username: member.username, name: member.name, role: member.role as ProfileMember['role'], avatarUrl: member.avatarUrl ?? undefined }));
  const [editOpen, setEditOpen] = useState(false);

  async function saveProfile(values: ProfileEditValues) {
    const csrf = await ensureCsrfToken();
    const headers = { 'Content-Type': 'application/json', ...(csrf ? { 'x-csrf-token': decodeURIComponent(csrf) } : {}) };
    const membershipChanges = kind === 'organization' && (values.members.some((member) => { const old = organizationMembers.find((item) => item.id === member.id); return old && old.role !== member.role && member.role !== 'owner'; }) || organizationMembers.some((member) => member.role !== 'owner' && !values.members.some((next) => next.id === member.id)));
    if (membershipChanges && !window.confirm(language === 'en' ? 'Confirm organization membership changes?' : '确认修改组织成员和角色？')) return;
    const endpoint = kind === 'user' ? '/api/v1/me/profile' : `/api/v1/organizations/${encodeURIComponent(id)}`;
    const response = await fetch(endpoint, { method: 'PATCH', headers, body: JSON.stringify(kind === 'user' ? { displayName: values.name, bio: values.description } : { name: values.name, description: values.description }) });
    const payload = await response.json().catch(() => ({})) as { data?: ProfileResponse; error?: { message?: string } };
    if (!response.ok) throw new Error(payload.error?.message ?? (language === 'en' ? 'Save failed.' : '保存失败。'));
    if (kind === 'organization') {
      const previous = new Map(organizationMembers.map((member) => [member.id, member]));
      const next = new Map(values.members.map((member) => [member.id, member]));
      for (const member of values.members) {
        const old = previous.get(member.id);
        if (!old) {
          const invitation = await fetch(`/api/v1/organizations/${encodeURIComponent(id)}/members`, { method: 'POST', headers, body: JSON.stringify({ username: member.username ?? member.id, role: member.role }) });
          if (!invitation.ok) { const detail = await invitation.json().catch(() => ({})) as { error?: { message?: string } }; throw new Error(detail.error?.message ?? (language === 'en' ? 'Member invitation failed.' : '成员邀请失败。')); }
        } else if (old.role !== member.role && member.role !== 'owner') {
          const confirmation = await requestConfirmation('organization.member.role.update', 'organization', `${profile?.id ?? id}:${member.id}`);
          const roleResponse = await fetch(`/api/v1/organizations/${encodeURIComponent(id)}/members`, { method: 'PATCH', headers: { ...headers, ...confirmation }, body: JSON.stringify({ username: member.username ?? member.id, role: member.role }) });
          if (!roleResponse.ok) { const detail = await roleResponse.json().catch(() => ({})) as { error?: { message?: string } }; throw new Error(detail.error?.message ?? (language === 'en' ? 'Role update failed.' : '角色更新失败。')); }
        }
      }
      for (const member of organizationMembers) {
        if (!next.has(member.id) && member.role !== 'owner') {
          const confirmation = await requestConfirmation('organization.member.remove', 'organization', `${profile?.id ?? id}:${member.id}`);
          const removeResponse = await fetch(`/api/v1/organizations/${encodeURIComponent(id)}/members?username=${encodeURIComponent(member.username ?? member.id)}`, { method: 'DELETE', headers: { ...headers, ...confirmation } });
          if (!removeResponse.ok) { const detail = await removeResponse.json().catch(() => ({})) as { error?: { message?: string } }; throw new Error(detail.error?.message ?? (language === 'en' ? 'Member removal failed.' : '成员移除失败。')); }
        }
      }
    }
    let nextAvatar = profile?.avatarUrl ?? undefined;
    if (values.avatarRemoved && !values.avatarFile) {
      const avatarEndpoint = kind === 'user' ? '/api/v1/me/avatar' : `/api/v1/organizations/${encodeURIComponent(id)}/avatar`;
      const removeResponse = await fetch(avatarEndpoint, { method: 'DELETE', headers: csrf ? { 'x-csrf-token': decodeURIComponent(csrf) } : undefined });
      if (!removeResponse.ok) throw new Error(language === 'en' ? 'Avatar removal failed.' : '头像移除失败。');
      nextAvatar = undefined;
    } else if (values.avatarFile) {
      const form = new FormData();
      form.set('file', values.avatarFile);
      const avatarEndpoint = kind === 'user' ? '/api/v1/me/avatar' : `/api/v1/organizations/${encodeURIComponent(id)}/avatar`;
      const avatarResponse = await fetch(avatarEndpoint, { method: 'POST', headers: csrf ? { 'x-csrf-token': decodeURIComponent(csrf) } : undefined, body: form });
      const avatarPayload = await avatarResponse.json().catch(() => ({})) as { data?: { avatarUrl?: string }; error?: { message?: string } };
      if (!avatarResponse.ok) throw new Error(avatarPayload.error?.message ?? (language === 'en' ? 'Avatar upload failed.' : '头像上传失败。'));
      nextAvatar = avatarPayload.data?.avatarUrl ?? nextAvatar;
    }
    if (profile) setProfile({ ...profile, displayName: values.name, name: values.name, bio: values.description, description: values.description, avatarUrl: nextAvatar });
    setEditOpen(false);
  }

  function changeProjectType(nextType: ProjectType) {
    setProjectType(nextType);
    setPage(1);
  }

  function changePage(nextPage: number) {
    setPage(Math.max(1, Math.min(totalPages, nextPage)));
  }

  if (!profile && loading) return <section className="profile-page"><div className="profile-page__inner"><p className="profile-projects__empty">{language === 'en' ? 'Loading profile…' : '正在加载资料…'}</p></div></section>;
  if (!profile && loadError) return <section className="profile-page"><div className="profile-page__inner"><h1>{language === 'en' ? 'Profile unavailable' : '资料不可用'}</h1><p className="profile-projects__empty">{loadError}</p></div></section>;

  return (
    <section className="profile-page" aria-labelledby="profile-title">
      <div className="profile-page__inner">
        <header className="profile-hero">
          <div className="profile-avatar">
            <img src={profileAvatarUrl ?? '/brand/logo-icon-rounded.svg'} alt="" />
          </div>
          <div className="profile-hero__copy">
            <h1 id="profile-title">{profileName}</h1>
            <p>{profileDescription || text.noDescription}</p>
            <dl className="profile-project-stats">
              <div>
                <dt aria-label={text.projectCount}><FolderKanban size={16} strokeWidth={1.9} aria-hidden="true" /></dt>
                <dd>{projectCount}</dd>
              </div>
              <div>
                <dt aria-label={text.downloads}><Download size={16} strokeWidth={1.9} aria-hidden="true" /></dt>
                <dd>{totalDownloads.toLocaleString()}</dd>
              </div>
              <div>
                <dt aria-label={text.followers}><Heart size={16} strokeWidth={1.9} aria-hidden="true" /></dt>
                <dd>{totalFollowers.toLocaleString()}</dd>
              </div>
            </dl>
          </div>
          {canEditProfile ? (
            <button className="preview-action profile-hero__edit-button" type="button" onClick={() => setEditOpen(true)}>
              <Pencil size={17} strokeWidth={1.9} aria-hidden="true" />
              <span>{text.edit}</span>
            </button>
          ) : null}
        </header>

        <div className={kind === 'organization' ? 'profile-content-layout profile-content-layout--with-sidebar' : 'profile-content-layout'}>
          <div className="profile-projects">
          <div className="content-toolbar profile-project-toolbar">
            <nav className="content-switcher" aria-label={text.contentNavigation}>
              {projectTabs.map((tab) => (
                <button
                  className={projectType === tab.id ? 'content-switcher__item content-switcher__item--active' : 'content-switcher__item'}
                  key={tab.id}
                  type="button"
                  aria-pressed={projectType === tab.id}
                  onClick={() => changeProjectType(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </nav>

            <div className="content-view-toggle" role="group" aria-label={text.viewMode}>
              <button
                className={viewMode === 'list' ? 'content-view-toggle__item content-view-toggle__item--active' : 'content-view-toggle__item'}
                type="button"
                title={text.listView}
                aria-label={text.listView}
                aria-pressed={viewMode === 'list'}
                onClick={() => setViewMode('list')}
              >
                <List size={17} strokeWidth={1.8} aria-hidden="true" />
              </button>
              <button
                className={viewMode === 'grid' ? 'content-view-toggle__item content-view-toggle__item--active' : 'content-view-toggle__item'}
                type="button"
                title={text.gridView}
                aria-label={text.gridView}
                aria-pressed={viewMode === 'grid'}
                onClick={() => setViewMode('grid')}
              >
                <Grid2X2 size={17} strokeWidth={1.8} aria-hidden="true" />
              </button>
            </div>

            <div className="content-pagination" aria-label={text.pagination}>
              <button className="content-pagination__button" type="button" title={text.previousPage} aria-label={text.previousPage} disabled={page <= 1 || loading} onClick={() => changePage(page - 1)}>
                <ChevronLeft size={17} strokeWidth={1.8} aria-hidden="true" />
              </button>
              <span className="content-pagination__current" aria-current="page">{page}</span>
              <button className="content-pagination__button" type="button" title={text.nextPage} aria-label={text.nextPage} disabled={page >= totalPages || loading} onClick={() => changePage(page + 1)}>
                <ChevronRight size={17} strokeWidth={1.8} aria-hidden="true" />
              </button>
            </div>
          </div>

            <div className={`content-cards content-cards--${viewMode} profile-projects__content`} data-project-type={projectType} aria-label={text.projectsTitle}>
              {loading ? <p className="profile-projects__empty">{text.loadingProjects}</p> : loadError ? <p className="profile-projects__empty">{loadError} <button className="auth-code-button" type="button" onClick={() => setReloadToken((value) => value + 1)}>{text.retry}</button></p> : visibleProjects.length > 0 ? visibleProjects.map((project) => {
                const projectName = language === 'en' ? project.name.en : project.name.zh;
                const projectDescription = language === 'en' ? project.description.en : project.description.zh;
                return (
                  <Link className={`content-card content-card--${viewMode} content-card--interactive`} href={`/${project.type === 'modpacks' ? 'modpack' : 'mod'}/${project.id}`} key={project.id}>
                    <div className="content-card__media">
                      <img src="/brand/vintage-story-game-logo.png" alt={projectName} loading="lazy" />
                    </div>
                    <div className="content-card__body">
                      <div className="content-card__summary">
                        <div className="content-card__icon" aria-hidden="true">
                          <img src="/brand/vintage-story-game-logo.png" alt="" loading="lazy" />
                        </div>
                        <div className="content-card__copy">
                          <h2 className="content-card__title">
                            <span>{projectName}</span>{' '}
                            <span className="content-card__author">by {profileName}</span>
                          </h2>
                          <p className="content-card__description">{projectDescription}</p>
                        </div>
                      </div>
                      <ul className="content-card__tags" aria-label={language === 'en' ? 'Tags' : '标签'}>
                        {project.tags.map((tag) => <li key={tag.en}>{language === 'en' ? tag.en : tag.zh}</li>)}
                      </ul>
                    </div>
                  </Link>
                );
              }) : <p className="profile-projects__empty">{text.noProjects}</p>}
            </div>
          </div>

          {kind === 'organization' ? (
            <aside className="profile-organization-card profile-members-card">
              <div className="preview-owner-card__heading">
                <h2>{text.members}</h2>
              </div>
              <div className="preview-owner-card__members">
                {organizationMembers.length > 0 ? (
                  <div className="preview-owner-card__member-list">
                    {organizationMembers.map((member) => (
                      <Link className="preview-owner-card__member" href={`/user/${encodeURIComponent(member.username ?? member.id)}`} key={member.id}>
                        <span className="preview-owner-card__member-avatar">
                          {member.avatarUrl ? <img src={member.avatarUrl} alt="" /> : <img src="/brand/logo-icon-rounded.svg" alt="" />}
                        </span>
                        <span className="preview-owner-card__member-name">
                          <strong>{member.name}</strong>
                          <span>{language === 'en' ? memberRoleNames[member.role].en : memberRoleNames[member.role].zh}</span>
                        </span>
                      </Link>
                    ))}
                  </div>
                ) : <p>{text.noProjects}</p>}
              </div>
            </aside>
          ) : null}
        </div>
        {editOpen ? (
          <ProfileEditModal
            kind={kind}
            initialName={profileName}
            initialAvatarUrl={profileAvatarUrl}
            initialDescription={profileDescription}
            initialMembers={organizationMembers}
            canManageMembers={kind === 'organization' && canEditProfile}
            english={language === 'en'}
            onClose={() => setEditOpen(false)}
            onSave={saveProfile}
          />
        ) : null}
      </div>
    </section>
  );
}
