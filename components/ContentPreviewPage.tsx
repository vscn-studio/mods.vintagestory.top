'use client';

import { BookOpen, Check, ChevronLeft, ChevronRight, Coffee, Copy, Download, EllipsisVertical, Flag, GitBranch, Heart, MessageCircle, Pencil, Trash2, X } from 'lucide-react';
import Link from 'next/link';
import { type FormEvent, useEffect, useRef, useState } from 'react';
import { useSiteLanguage } from '@/components/SiteLanguageContext';
import type { SessionAccountSummary } from '@/lib/auth-server';
import { type PreviewSection } from '@/lib/preview-sections';
import { ensureCsrfToken } from '@/lib/client-confirmation';
import { getLicenseOption } from '@/lib/licenses';
import { filterSupportedGameVersions } from '@/lib/game-versions';

type ContentPreviewPageProps = {
  kind: 'mod' | 'modpack';
  id: string;
  initialSection?: PreviewSection;
  sessionAccount?: SessionAccountSummary | null;
};

type PreviewMember = {
  id: string;
  name: string;
  role: { zh: string; en: string };
};

type PreviewLocalizedValue = {
  zh: string;
  en: string;
};

type PreviewContent = {
  name: { zh: string; en: string };
  summary: { zh: string; en: string };
  iconUrl?: string | null;
  author?: string;
  authorType: 'user' | 'organization';
  authorId: string;
  description: { zh: string; en: string };
  members?: PreviewMember[];
  compatibleVersions?: string[];
  environments?: PreviewLocalizedValue[];
  tags?: PreviewLocalizedValue[];
  license?: PreviewLocalizedValue | string;
  published?: PreviewLocalizedValue;
  updated?: PreviewLocalizedValue;
  id?: string;
  slug?: string;
  owner?: { type: 'user' | 'organization'; id: string; slug?: string; username?: string; name: string } | null;
  gameVersions?: string[];
  createdAt?: string;
  updatedAt?: string;
  stats?: { downloads: number; followers: number; favorites?: number; comments?: number };
  links?: { repository?: string | null; issues?: string | null; wiki?: string | null; discord?: string | null; sponsor?: string | null };
  releases?: Array<{ id: string; version: string; changelog?: string | null; status: string; compatibleVersions: unknown; environments: unknown; publishedAt?: string | null; updatedAt: string; files: Array<{ id: string; name: string; size: number; mimeType: string; downloads: number; scanStatus: string }> }>;
  viewer?: { following?: boolean; favorited?: boolean; capabilities?: string[] };
  screenshots?: Array<{ id: string; caption?: string | null; url: string; sortOrder: number }>;
};

const previewCopy = {
  'zh-CN': {
    author: '作者',
    ownerRole: '所有者',
    organizationRole: '组织',
    downloads: '下载量',
    followers: '关注量',
    follow: '关注',
    download: '下载',
    moreActions: '更多操作',
    edit: '编辑',
    report: '举报',
    copyLink: '复制链接',
    description: '简介',
    screenshots: '截图',
    changelog: '更新日志',
    versions: '版本',
    sectionNavigation: '预览内容分区',
    gameVersionFilter: '游戏版本',
    allVersions: '全部版本',
    versionNumber: '版本号',
    compatibleVersions: '兼容版本',
    published: '发布时间',
    updated: '更新时间',
    tableDownloads: '下载量',
    previousPage: '上一页',
    nextPage: '下一页',
    compatibility: '兼容性',
    runtimeEnvironment: '运行环境',
    sourceCode: '查看源代码',
    issues: 'Issues 提交',
    wiki: 'Wiki 网址',
    discord: 'Discord 社区',
    sponsor: 'Ko-fi 赞助',
    relatedLinks: '相关链接',
    projectInfo: '项目信息',
    license: '许可证',
    tags: '标签',
    clientOnly: '纯客户端',
    serverOnly: '纯服务器',
    bothSides: '双端',
    noData: '暂无内容。',
    versionValue: '1.21 · 1.22'
    ,editComment: '编辑评论', deleteComment: '删除评论', saveComment: '保存评论', cancelComment: '取消', edited: '已编辑'
  },
  en: {
    author: 'Author',
    ownerRole: 'Owner',
    organizationRole: 'Organization',
    downloads: 'Downloads',
    followers: 'Followers',
    follow: 'Follow',
    download: 'Download',
    moreActions: 'More actions',
    edit: 'Edit',
    report: 'Report',
    copyLink: 'Copy link',
    description: 'Description',
    screenshots: 'Screenshots',
    changelog: 'Changelog',
    versions: 'Versions',
    sectionNavigation: 'Preview content sections',
    gameVersionFilter: 'Game versions',
    allVersions: 'All versions',
    versionNumber: 'Version',
    compatibleVersions: 'Compatible versions',
    published: 'Published',
    updated: 'Updated',
    tableDownloads: 'Downloads',
    previousPage: 'Previous page',
    nextPage: 'Next page',
    compatibility: 'Compatibility',
    runtimeEnvironment: 'Runtime environment',
    sourceCode: 'View source code',
    issues: 'Issues',
    wiki: 'Wiki',
    discord: 'Discord community',
    sponsor: 'Ko-fi',
    relatedLinks: 'Related links',
    projectInfo: 'Project information',
    license: 'License',
    tags: 'Tags',
    clientOnly: 'Client only',
    serverOnly: 'Server only',
    bothSides: 'Client + server',
    noData: 'No content yet.',
    versionValue: '1.21 · 1.22'
    ,editComment: 'Edit comment', deleteComment: 'Delete comment', saveComment: 'Save comment', cancelComment: 'Cancel', edited: 'Edited'
  }
} as const;

function titleFromId(id: string): string {
  return id
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function ContentPreviewPage({ kind, id, initialSection, sessionAccount = null }: ContentPreviewPageProps) {
  const language = useSiteLanguage();
  const text = previewCopy[language];
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<PreviewSection>(initialSection ?? 'description');
  const [isVersionFilterOpen, setIsVersionFilterOpen] = useState(false);
  const [selectedVersions, setSelectedVersions] = useState<string[]>([]);
  const [versionPage, setVersionPage] = useState(1);
  const [openReleaseMenu, setOpenReleaseMenu] = useState<string | null>(null);
  const [content, setContent] = useState<PreviewContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [following, setFollowing] = useState(false);
  const [favorited, setFavorited] = useState(false);
  const [actionMessage, setActionMessage] = useState('');
  const [comments, setComments] = useState<Array<{ id: string; body: string; author: { username: string; displayName: string; avatarUrl?: string | null }; createdAt: string; updatedAt?: string }>>([]);
  const [commentBody, setCommentBody] = useState('');
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentBody, setEditingCommentBody] = useState('');
  const [commentBusyId, setCommentBusyId] = useState('');
  const moreMenuRef = useRef<HTMLDivElement>(null);
  const versionFilterRef = useRef<HTMLDivElement>(null);
  const releaseMenuRef = useRef<HTMLDivElement>(null);
  const basePath = kind === 'modpack' ? `/modpack/${id}` : `/mod/${id}`;

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setLoadError('');
    setNotFound(false);
    fetch(`/api/v1/projects/${encodeURIComponent(id)}`, { cache: 'no-store', signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json() as { data?: PreviewContent; error?: { message?: string } };
        if (response.status === 404) { setNotFound(true); return; }
        if (!response.ok || !payload.data) throw new Error(payload.error?.message ?? (language === 'en' ? 'Unable to load project.' : '项目加载失败。'));
        const raw = payload.data as any;
        setFollowing(Boolean(raw.viewer?.following));
        setFavorited(Boolean(raw.viewer?.favorited));
        const owner = raw.owner;
        setContent({
          ...raw,
          authorType: owner?.type ?? 'user',
          authorId: owner?.type === 'organization' ? owner.slug ?? owner.id : owner?.username ?? owner?.id ?? '',
          author: owner?.name ?? '',
          summary: raw.summary ?? { zh: '', en: '' },
          description: raw.description ?? { zh: '', en: '' },
          tags: (raw.tags ?? []).map((tag: { name: string; nameEn?: string }) => ({ zh: tag.name, en: tag.nameEn ?? tag.name })),
          environments: (raw.environments ?? []).map((environment: { name: string; nameEn?: string }) => ({ zh: environment.name, en: environment.nameEn ?? environment.name })),
          license: typeof raw.license === 'string' ? raw.license : null,
          published: { zh: raw.createdAt ?? '', en: raw.createdAt ?? '' },
          updated: { zh: raw.updatedAt ?? '', en: raw.updatedAt ?? '' }
        });
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setLoadError(error instanceof Error ? error.message : (language === 'en' ? 'Unable to load project.' : '项目加载失败。'));
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [id, language]);

  async function reloadComments() {
    const response = await fetch(`/api/v1/projects/${encodeURIComponent(id)}/comments`, { cache: 'no-store' });
    const payload = await response.json().catch(() => ({})) as { data?: typeof comments };
    if (response.ok) setComments(payload.data ?? []);
  }

  useEffect(() => {
    if (loading || notFound) return;
    void reloadComments().catch(() => undefined);
  }, [id, loading, notFound]);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (!moreMenuRef.current?.contains(target)) setIsMoreOpen(false);
      if (!versionFilterRef.current?.contains(target)) setIsVersionFilterOpen(false);
      if (!releaseMenuRef.current?.contains(target)) setOpenReleaseMenu(null);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsMoreOpen(false);
        setIsVersionFilterOpen(false);
        setOpenReleaseMenu(null);
      }
    }

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  useEffect(() => {
    function handlePopState() {
      const path = window.location.pathname.replace(/\/$/, '');
      if (path === `${basePath}/screenshots`) {
        setActiveSection('screenshots');
      } else if (path === `${basePath}/changelog`) {
        setActiveSection('changelog');
      } else if (path === `${basePath}/versions`) {
        setActiveSection('versions');
      } else {
        setActiveSection('description');
      }
    }

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [basePath]);

  const current = content ?? {
    name: { zh: titleFromId(id), en: titleFromId(id) },
    summary: { zh: '', en: '' },
    author: language === 'en' ? 'Unknown creator' : '未知作者',
    authorType: 'user' as const,
    authorId: '',
    description: { zh: '', en: '' },
    stats: { downloads: 0, followers: 0 },
    releases: []
  };
  const name = language === 'en' ? current.name.en : current.name.zh;
  const summary = language === 'en' ? current.summary.en : current.summary.zh;
  const description = current.description.zh;
  const author = current.author ?? (current.authorType === 'organization' ? current.owner?.name : undefined) ?? '';
  const authorPath = current.authorType === 'user' ? `/user/${encodeURIComponent(current.authorId)}` : `/organization/${encodeURIComponent(current.authorId)}`;
  const canEditContent = current.viewer?.capabilities?.some((capability) => [
    'update', 'member.manage', 'transfer', 'archive', 'release.create', 'release.publish', 'file.manage'
  ].includes(capability)) ?? false;
  const members = current.members ?? [];
  const releases = current.releases ?? [];
  const compatibleVersions = filterSupportedGameVersions(releases.flatMap((release) => Array.isArray(release.compatibleVersions) ? release.compatibleVersions.filter((value): value is string => typeof value === 'string') : []));
  const runtimeEnvironments = current.environments ?? [];
  const sidebarTags = current.tags ?? [];
  const localizedSidebarTags = sidebarTags
    .map((tag) => language === 'en' ? tag.en : tag.zh)
    .map((tag) => tag.trim())
    .filter(Boolean);
  const previewTagItems = [
    ...localizedSidebarTags,
    ...(compatibleVersions.length > 0 ? [compatibleVersions.slice(0, 3).join(' · ')] : []),
    kind === 'modpack' ? 'Modpack' : 'Mod'
  ];
  const license = typeof current.license === 'string' ? current.license : '';
  const licenseOption = getLicenseOption(license);
  const published = current.published ?? { zh: '', en: '' };
  const updated = current.updated ?? { zh: '', en: '' };
  const repositoryUrl = current.links?.repository ?? '';
  const relatedLinks = [
    { id: 'source', label: text.sourceCode, href: repositoryUrl },
    { id: 'issues', label: text.issues, href: current.links?.issues ?? (repositoryUrl ? `${repositoryUrl}/issues` : '') },
    { id: 'wiki', label: text.wiki, href: current.links?.wiki ?? (repositoryUrl ? `${repositoryUrl}/wiki` : '') },
    { id: 'discord', label: text.discord, href: current.links?.discord ?? '' },
    { id: 'sponsor', label: text.sponsor, href: current.links?.sponsor ?? '' }
  ];
  const sectionTabs: Array<{ id: PreviewSection; label: string }> = [
    { id: 'description', label: text.description },
    { id: 'screenshots', label: text.screenshots },
    { id: 'changelog', label: text.changelog },
    { id: 'versions', label: text.versions }
  ];
  const sectionHrefs: Record<PreviewSection, string> = {
    description: basePath,
    screenshots: `${basePath}/screenshots`,
    changelog: `${basePath}/changelog`,
    versions: `${basePath}/versions`
  };
  const screenshotCards = current.screenshots ?? [];
  const changelogEntries = releases.filter((release) => release.changelog).map((release) => ({ version: release.version, date: release.publishedAt ?? release.updatedAt, summary: release.changelog ?? '' }));
  const versionEntries = releases.filter((release) => release.status === 'published').map((release) => ({ version: release.version, game: filterSupportedGameVersions(Array.isArray(release.compatibleVersions) ? release.compatibleVersions.filter((value): value is string => typeof value === 'string') : []).join(' · '), published: release.publishedAt ?? release.updatedAt, updated: release.updatedAt, downloads: release.files.reduce((sum, file) => sum + file.downloads, 0).toLocaleString(), files: release.files }));
  const gameVersionOptions = filterSupportedGameVersions(releases.flatMap((release) => Array.isArray(release.compatibleVersions) ? release.compatibleVersions.filter((value): value is string => typeof value === 'string') : []));
  const selectedVersionLabel = selectedVersions.length > 0 ? selectedVersions.join(' · ') : text.allVersions;
  const filteredVersionEntries = selectedVersions.length > 0
    ? versionEntries.filter((entry) => entry.game.split(' · ').some((version) => selectedVersions.includes(version)))
    : versionEntries;
  const versionPageSize = 20;
  const versionTotalPages = Math.max(1, Math.ceil(filteredVersionEntries.length / versionPageSize));
  const visibleVersionEntries = filteredVersionEntries.slice((versionPage - 1) * versionPageSize, versionPage * versionPageSize);
  const downloadableRelease = versionEntries.find((entry) => entry.files.length > 0);

  useEffect(() => {
    setVersionPage((page) => Math.min(page, versionTotalPages));
  }, [versionTotalPages]);

  function toggleVersion(version: string) {
    setVersionPage(1);
    setSelectedVersions((current) => current.includes(version) ? current.filter((item) => item !== version) : [...current, version]);
  }

  async function mutate(path: string, method: 'POST' | 'PATCH' | 'DELETE', body?: unknown): Promise<boolean> {
    if (!sessionAccount) {
      setActionMessage(language === 'en' ? 'Sign in to use this action.' : '请先登录后再执行此操作。');
      return false;
    }
    const csrf = await ensureCsrfToken();
    const response = await fetch(path, { method, headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(csrf ? { 'x-csrf-token': decodeURIComponent(csrf) } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
    const payload = await response.json().catch(() => ({})) as { error?: { message?: string } };
    if (!response.ok) {
      setActionMessage(payload.error?.message ?? (language === 'en' ? 'Action failed.' : '操作失败。'));
      return false;
    }
    setActionMessage('');
    return true;
  }

  async function toggleFollow() {
    const ok = await mutate(`/api/v1/projects/${encodeURIComponent(id)}/follow`, following ? 'DELETE' : 'POST');
    if (ok) setFollowing((value) => !value);
  }

  async function toggleFavorite() {
    const ok = await mutate(`/api/v1/projects/${encodeURIComponent(id)}/favorite`, favorited ? 'DELETE' : 'POST');
    if (ok) setFavorited((value) => !value);
  }

  function downloadRelease(release: { files: Array<{ id: string }> }) {
    const file = release.files[0];
    if (!file) {
      setActionMessage(language === 'en' ? 'No clean downloadable file is available.' : '当前没有可下载的干净文件。');
      return;
    }
    window.location.href = `/api/v1/files/${encodeURIComponent(file.id)}/download`;
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setActionMessage(language === 'en' ? 'Link copied.' : '链接已复制。');
    } catch {
      setActionMessage(language === 'en' ? 'Unable to copy the link.' : '复制链接失败。');
    }
    setIsMoreOpen(false);
  }

  async function reportProject() {
    const reason = window.prompt(language === 'en' ? 'Why are you reporting this project?' : '请说明举报原因：');
    if (!reason?.trim()) return;
    await mutate('/api/v1/reports', 'POST', { targetType: 'PROJECT', targetId: content?.id ?? id, reason: reason.trim() });
    setIsMoreOpen(false);
  }

  async function addComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!commentBody.trim()) return;
    const ok = await mutate(`/api/v1/projects/${encodeURIComponent(id)}/comments`, 'POST', { body: commentBody.trim() });
    if (ok) {
      setCommentBody('');
      await reloadComments();
    }
  }

  function beginCommentEdit(comment: typeof comments[number]) {
    setEditingCommentId(comment.id);
    setEditingCommentBody(comment.body);
  }

  async function saveComment(commentId: string) {
    const body = editingCommentBody.trim();
    if (!body) return;
    setCommentBusyId(commentId);
    const ok = await mutate(`/api/v1/projects/${encodeURIComponent(id)}/comments?commentId=${encodeURIComponent(commentId)}`, 'PATCH', { body });
    setCommentBusyId('');
    if (!ok) return;
    setComments((items) => items.map((comment) => comment.id === commentId ? { ...comment, body, updatedAt: new Date().toISOString() } : comment));
    setEditingCommentId(null);
    setEditingCommentBody('');
  }

  async function deleteComment(commentId: string) {
    if (!window.confirm(text.deleteComment)) return;
    setCommentBusyId(commentId);
    const ok = await mutate(`/api/v1/projects/${encodeURIComponent(id)}/comments?commentId=${encodeURIComponent(commentId)}`, 'DELETE');
    setCommentBusyId('');
    if (!ok) return;
    setComments((items) => items.filter((comment) => comment.id !== commentId));
    if (editingCommentId === commentId) {
      setEditingCommentId(null);
      setEditingCommentBody('');
    }
  }

  function formatDate(value: string | null | undefined): string {
    if (!value) return text.noData;
    try { return new Intl.DateTimeFormat(language === 'en' ? 'en' : 'zh-CN', { dateStyle: 'medium' }).format(new Date(value)); } catch { return value; }
  }

  if (loading) return <section className="preview-page"><div className="preview-page__inner"><p className="preview-empty-state">{language === 'en' ? 'Loading project…' : '正在加载项目…'}</p></div></section>;
  if (notFound) return <section className="preview-page"><div className="preview-page__inner"><h1>{language === 'en' ? 'Project not found' : '项目不存在'}</h1><p className="preview-empty-state">{language === 'en' ? 'This project is private, archived, or unavailable.' : '项目可能是私有、已归档或不存在。'}</p></div></section>;
  if (loadError) return <section className="preview-page"><div className="preview-page__inner"><h1>{language === 'en' ? 'Unable to load project' : '项目加载失败'}</h1><p className="preview-empty-state">{loadError}</p></div></section>;

  const versionToolbar = activeSection === 'versions' ? (
    <div className="preview-version-toolbar">
      <div className="preview-version-filter" ref={versionFilterRef}>
        <button
          className="preview-version-filter__trigger"
          type="button"
          aria-haspopup="listbox"
          aria-expanded={isVersionFilterOpen}
          onClick={() => setIsVersionFilterOpen((open) => !open)}
        >
          <span className="preview-version-filter__label">{text.gameVersionFilter}</span>
          <span className="preview-version-filter__value">{selectedVersionLabel}</span>
        </button>
        <div
          className={isVersionFilterOpen ? 'preview-version-filter__menu preview-version-filter__menu--open' : 'preview-version-filter__menu'}
          role="listbox"
          aria-label={text.gameVersionFilter}
          aria-multiselectable="true"
          aria-hidden={!isVersionFilterOpen}
        >
          {gameVersionOptions.map((version) => {
            const isSelected = selectedVersions.includes(version);
            return (
              <button
                className={isSelected ? 'preview-version-filter__option preview-version-filter__option--active' : 'preview-version-filter__option'}
                key={version}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => toggleVersion(version)}
              >
                <span>{version}</span>
                {isSelected ? <Check size={15} strokeWidth={2} aria-hidden="true" /> : null}
              </button>
            );
          })}
        </div>
      </div>

      <div className="content-pagination preview-version-pagination" aria-label={language === 'en' ? 'Pagination' : '分页'}>
        <button className="content-pagination__button" type="button" title={text.previousPage} aria-label={text.previousPage} disabled={versionPage <= 1} onClick={() => setVersionPage((page) => Math.max(1, page - 1))}>
          <ChevronLeft size={17} strokeWidth={1.8} aria-hidden="true" />
        </button>
        <span className="content-pagination__current" aria-current="page">{versionPage}</span>
        <button className="content-pagination__button" type="button" title={text.nextPage} aria-label={text.nextPage} disabled={versionPage >= versionTotalPages} onClick={() => setVersionPage((page) => Math.min(versionTotalPages, page + 1))}>
          <ChevronRight size={17} strokeWidth={1.8} aria-hidden="true" />
        </button>
      </div>
    </div>
  ) : null;

  return (
    <section className="preview-page" aria-labelledby="preview-title">
      <div className="preview-page__inner">
        <header className="preview-hero">
          <div className="preview-hero__media-column">
            <div className="preview-hero__media">
              <img src={current.iconUrl || '/brand/vintage-story-game-logo.png'} alt="" />
            </div>
          </div>
          <div className="preview-hero__copy">
            <h1 id="preview-title">{name}</h1>
            <div className="preview-description preview-rich-content">{summary ? <p>{summary}</p> : null}</div>
            <div className="preview-hero__meta-row">
              <dl className="preview-hero__stats">
                <div>
                  <dt aria-label={text.downloads}>
                    <Download size={16} strokeWidth={1.9} aria-hidden="true" />
                  </dt>
                  <dd>{(current.stats?.downloads ?? 0).toLocaleString()}</dd>
                </div>
                <div>
                  <dt aria-label={text.followers}>
                    <Heart size={16} strokeWidth={1.9} aria-hidden="true" />
                  </dt>
                  <dd>{(current.stats?.followers ?? 0).toLocaleString()}</dd>
                </div>
              </dl>
              {previewTagItems.length > 0 ? (
                <ul className="preview-tags" aria-label={text.tags}>
                  {previewTagItems.map((tag) => <li key={tag}>{tag}</li>)}
                </ul>
              ) : null}
            </div>
          </div>
          <div className="preview-hero__actions">
            <button className="preview-action preview-action--primary" type="button" disabled={!downloadableRelease} onClick={() => downloadableRelease && downloadRelease(downloadableRelease)}>
              <Download size={17} strokeWidth={1.9} aria-hidden="true" />
              <span>{text.download}</span>
            </button>
            <button className={following ? 'preview-action preview-action--active' : 'preview-action'} type="button" aria-pressed={following} onClick={() => void toggleFollow()}>
              <Heart size={17} strokeWidth={1.9} aria-hidden="true" />
              <span>{text.follow}</span>
            </button>
            <div className="preview-more" ref={moreMenuRef}>
              <button
                className="preview-action preview-action--icon"
                type="button"
                title={text.moreActions}
                aria-label={text.moreActions}
                aria-haspopup="menu"
                aria-expanded={isMoreOpen}
                onClick={() => setIsMoreOpen((open) => !open)}
              >
                <EllipsisVertical size={24} strokeWidth={2} aria-hidden="true" />
              </button>
              <div
                className={isMoreOpen ? 'preview-more__menu preview-more__menu--open' : 'preview-more__menu'}
                role="menu"
                aria-hidden={!isMoreOpen}
              >
                <button className="preview-more__item" type="button" role="menuitem" onClick={() => void toggleFavorite()}>
                  <Heart size={16} strokeWidth={1.9} aria-hidden="true" />
                  {favorited ? (language === 'en' ? 'Remove favorite' : '取消收藏') : (language === 'en' ? 'Favorite' : '收藏')}
                </button>
                {canEditContent ? <button className="preview-more__item" type="button" role="menuitem" onClick={() => { window.location.href = `/projects/${encodeURIComponent(content?.slug ?? id)}/manage`; }}>
                  <Pencil size={16} strokeWidth={1.9} aria-hidden="true" />
                  {text.edit}
                </button> : null}
                <button className="preview-more__item preview-more__item--danger" type="button" role="menuitem" onClick={() => void reportProject()}>
                  <Flag size={16} strokeWidth={1.9} aria-hidden="true" />
                  {text.report}
                </button>
                <button className="preview-more__item" type="button" role="menuitem" onClick={() => void copyLink()}>
                  <Copy size={16} strokeWidth={1.9} aria-hidden="true" />
                  {text.copyLink}
                </button>
              </div>
            </div>
          </div>
        </header>
        {actionMessage ? <p className="preview-action-message" role="status">{actionMessage}</p> : null}

        <nav className="content-switcher" aria-label={text.sectionNavigation}>
          {sectionTabs.map((tab) => (
            <a
              className={activeSection === tab.id ? 'content-switcher__item content-switcher__item--active' : 'content-switcher__item'}
              key={tab.id}
              href={sectionHrefs[tab.id]}
              aria-current={activeSection === tab.id ? 'page' : undefined}
              onClick={(event) => {
                event.preventDefault();
                window.history.pushState({}, '', sectionHrefs[tab.id]);
                setActiveSection(tab.id);
              }}
            >
              {tab.label}
            </a>
          ))}
        </nav>

        <div className="preview-layout">
          <div className="preview-content-column">
            {versionToolbar}
          <main className={activeSection === 'screenshots' || activeSection === 'versions' ? 'preview-main preview-main--flat' : 'preview-main'} id={`preview-panel-${activeSection}`} role="tabpanel" aria-label={sectionTabs.find((tab) => tab.id === activeSection)?.label}>
            {activeSection === 'description' ? (
              <section className="preview-section">
                {description ? <div className="preview-rich-content" dangerouslySetInnerHTML={{ __html: description }} /> : <p className="preview-empty-state">{text.noData}</p>}
                <div className="preview-comments">
                  <div className="preview-section__heading"><h2>{language === 'en' ? 'Comments' : '评论'}</h2></div>
                  {comments.length ? <div className="preview-comments__list">{comments.map((comment) => {
                    const ownComment = comment.author.username === sessionAccount?.username;
                    const editing = editingCommentId === comment.id;
                    return <article className="preview-comment" key={comment.id}>
                      <div className="preview-comment__heading"><span><strong>{comment.author.displayName || comment.author.username}</strong><time>{formatDate(comment.createdAt)}{comment.updatedAt && comment.updatedAt !== comment.createdAt ? ` · ${text.edited}` : ''}</time></span>{ownComment ? <span className="preview-comment__actions">{editing ? <><button className="preview-more__item" type="button" disabled={commentBusyId === comment.id} onClick={() => void saveComment(comment.id)}><Check size={15} />{text.saveComment}</button><button className="preview-more__item" type="button" disabled={commentBusyId === comment.id} onClick={() => { setEditingCommentId(null); setEditingCommentBody(''); }}><X size={15} />{text.cancelComment}</button></> : <><button className="preview-more__item" type="button" onClick={() => beginCommentEdit(comment)}><Pencil size={15} />{text.editComment}</button><button className="preview-more__item preview-more__item--danger" type="button" disabled={commentBusyId === comment.id} onClick={() => void deleteComment(comment.id)}><Trash2 size={15} />{text.deleteComment}</button></>}</span> : null}</div>
                      {editing ? <textarea className="preview-comment__editor" value={editingCommentBody} onChange={(event) => setEditingCommentBody(event.target.value)} maxLength={5000} rows={3} autoFocus /> : <p>{comment.body}</p>}
                    </article>;
                  })}</div> : <p className="preview-empty-state">{text.noData}</p>}
                  <form className="preview-comment-form" onSubmit={addComment}><textarea value={commentBody} onChange={(event) => setCommentBody(event.target.value)} maxLength={5000} rows={3} placeholder={sessionAccount ? (language === 'en' ? 'Write a comment' : '写下评论') : (language === 'en' ? 'Sign in to comment' : '登录后发表评论')} disabled={!sessionAccount} /><button className="auth-modal__primary" type="submit" disabled={!sessionAccount || !commentBody.trim()}>{language === 'en' ? 'Post' : '发布'}</button></form>
                </div>
              </section>
            ) : null}

            {activeSection === 'screenshots' ? (
              <section className="preview-section">
                {screenshotCards.length > 0 ? <div className="preview-screenshot-grid">
                  {screenshotCards.map((screenshot) => (
                    <figure className="preview-screenshot-card" key={screenshot.id}>
                      <div className="preview-screenshot-card__media">
                        <img src={screenshot.url} alt={screenshot.caption ?? name} loading="lazy" />
                      </div>
                      {screenshot.caption ? <figcaption>{screenshot.caption}</figcaption> : null}
                    </figure>
                  ))}
                </div> : <p className="preview-empty-state">{text.noData}</p>}
              </section>
            ) : null}

            {activeSection === 'changelog' ? (
              <section className="preview-section">
                {changelogEntries.length > 0 ? <div className="preview-changelog-list">
                  {changelogEntries.map((entry) => (
                    <article className="preview-changelog-item" key={entry.version}>
                      <div className="preview-changelog-item__heading">
                        <div className="preview-changelog-item__meta">
                          <strong>v{entry.version}</strong>
                          <time dateTime={entry.date}>{formatDate(entry.date)}</time>
                        </div>
                        <button className="preview-action preview-action--primary preview-changelog-item__download" type="button" onClick={() => { const release = releases.find((item) => item.version === entry.version); if (release) downloadRelease(release); }}>
                          <Download size={16} strokeWidth={1.9} aria-hidden="true" />
                          <span>{text.download}</span>
                        </button>
                      </div>
                      <div className="preview-changelog-item__content" dangerouslySetInnerHTML={{ __html: entry.summary }} />
                    </article>
                  ))}
                </div> : <p className="preview-empty-state">{text.noData}</p>}
              </section>
            ) : null}

            {activeSection === 'versions' ? (
              <section className="preview-section">
                <table className="preview-version-table">
                    <thead>
                      <tr>
                        <th scope="col">{text.versionNumber}</th>
                        <th scope="col">{text.compatibleVersions}</th>
                        <th scope="col">{text.published}</th>
                        <th scope="col">{text.updated}</th>
                        <th scope="col">{text.tableDownloads}</th>
                        <th scope="col">{text.download}</th>
                        <th scope="col"><span className="sr-only">{text.moreActions}</span></th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleVersionEntries.length > 0 ? visibleVersionEntries.map((entry) => (
                        <tr key={entry.version}>
                          <th scope="row"><strong>v{entry.version}</strong></th>
                          <td>
                            <ul className="preview-version-tags" aria-label={text.compatibleVersions}>
                              {entry.game.split(' · ').map((version) => <li key={version}>{version}</li>)}
                            </ul>
                          </td>
                          <td><time dateTime={entry.published}>{formatDate(entry.published)}</time></td>
                          <td><time dateTime={entry.updated}>{formatDate(entry.updated)}</time></td>
                          <td>{entry.downloads}</td>
                          <td>
                            <button className="preview-version-table__download" type="button" title={text.download} aria-label={`${text.download} v${entry.version}`} onClick={() => { const release = releases.find((item) => item.version === entry.version); if (release) downloadRelease(release); }}>
                              <Download size={16} strokeWidth={1.9} aria-hidden="true" />
                              <span>{text.download}</span>
                            </button>
                          </td>
                          <td>
                            <div className="preview-release-menu" ref={openReleaseMenu === entry.version ? releaseMenuRef : undefined}>
                              <button
                                className="preview-action preview-action--icon"
                                type="button"
                                title={text.moreActions}
                                aria-label={`${text.moreActions} v${entry.version}`}
                                aria-haspopup="menu"
                                aria-expanded={openReleaseMenu === entry.version}
                                onClick={() => setOpenReleaseMenu((current) => current === entry.version ? null : entry.version)}
                              >
                                <EllipsisVertical size={21} strokeWidth={2} aria-hidden="true" />
                              </button>
                              <div
                                className={openReleaseMenu === entry.version ? 'preview-more__menu preview-more__menu--open' : 'preview-more__menu'}
                                role="menu"
                                aria-hidden={openReleaseMenu !== entry.version}
                              >
                                <button className="preview-more__item" type="button" role="menuitem" onClick={() => { const release = releases.find((item) => item.version === entry.version); if (release) downloadRelease(release); setOpenReleaseMenu(null); }}>
                                  <Download size={16} strokeWidth={1.9} aria-hidden="true" />
                                  {text.download}
                                </button>
                                <button className="preview-more__item preview-more__item--danger" type="button" role="menuitem" onClick={() => { void reportProject(); setOpenReleaseMenu(null); }}>
                                  <Flag size={16} strokeWidth={1.9} aria-hidden="true" />
                                  {text.report}
                                </button>
                                <button className="preview-more__item" type="button" role="menuitem" onClick={() => { void copyLink(); setOpenReleaseMenu(null); }}>
                                  <Copy size={16} strokeWidth={1.9} aria-hidden="true" />
                                  {text.copyLink}
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )) : <tr><td colSpan={7} className="preview-empty-state">{text.noData}</td></tr>}
                    </tbody>
                  </table>
              </section>
            ) : null}
          </main>
          </div>

          <aside className="preview-sidebar">
            <section className="preview-sidebar__section preview-compatibility-section">
              <div className="preview-section__heading">
                <h2>{text.compatibility}</h2>
              </div>
              <dl className="preview-detail-list">
                <div>
                  <dt>{text.compatibleVersions}</dt>
                  <dd>
                    <ul className="preview-sidebar-tags preview-sidebar-tags--compact" aria-label={text.compatibleVersions}>
                      {compatibleVersions.length > 0 ? compatibleVersions.map((version) => <li key={version}>{version}</li>) : <li>{text.noData}</li>}
                    </ul>
                  </dd>
                </div>
                <div>
                  <dt>{text.runtimeEnvironment}</dt>
                  <dd>
                    <ul className="preview-sidebar-tags preview-sidebar-tags--compact" aria-label={text.runtimeEnvironment}>
                      {runtimeEnvironments.length > 0 ? runtimeEnvironments.map((environment) => <li key={language === 'en' ? environment.en : environment.zh}>{language === 'en' ? environment.en : environment.zh}</li>) : <li>{text.noData}</li>}
                    </ul>
                  </dd>
                </div>
              </dl>
            </section>

            <section className="preview-owner-card">
              <div className="preview-owner-card__heading">
                <h2>{text.author}</h2>
              </div>
              <Link className="preview-owner-card__identity" href={authorPath}>
                <span className="preview-owner-card__avatar">
                  <img src="/brand/logo-icon-rounded.svg" alt="" />
                </span>
                <span className="preview-owner-card__name">
                    <strong>{author}</strong>
                    <span>{current.authorType === 'organization' ? text.organizationRole : text.ownerRole}</span>
                </span>
              </Link>
              {current.authorType === 'organization' ? (
                <div className="preview-owner-card__members">
                  {members.length > 0 ? (
                    <div className="preview-owner-card__member-list">
                      {members.map((member) => (
                        <Link className="preview-owner-card__member" href={`/user/${member.id}`} key={member.id}>
                          <span className="preview-owner-card__member-avatar">
                            <img src="/brand/logo-icon-rounded.svg" alt="" />
                          </span>
                          <span className="preview-owner-card__member-name">
                            <strong>{member.name}</strong>
                            <span>{language === 'en' ? member.role.en : member.role.zh}</span>
                          </span>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <p>{text.noData}</p>
                  )}
                </div>
              ) : null}
            </section>

            <section className="preview-sidebar__section">
              <div className="preview-section__heading">
                <h2>{text.relatedLinks}</h2>
              </div>
              <nav className="preview-related-links" aria-label={text.relatedLinks}>
                {relatedLinks.filter((link) => link.href).map((link) => (
                  <span className="preview-related-links__item" key={link.label}>
                    <span className="preview-related-links__icon" aria-hidden="true">
                      {link.id === 'source' || link.id === 'issues' ? <GitBranch size={17} strokeWidth={1.8} aria-hidden="true" /> : null}
                      {link.id === 'wiki' ? <BookOpen size={17} strokeWidth={1.8} aria-hidden="true" /> : null}
                      {link.id === 'discord' ? <MessageCircle size={17} strokeWidth={1.8} aria-hidden="true" /> : null}
                      {link.id === 'sponsor' ? <Coffee size={17} strokeWidth={1.8} aria-hidden="true" /> : null}
                    </span>
                    <a href={link.href} target="_blank" rel="noreferrer">{link.label}</a>
                  </span>
                ))}
              </nav>
            </section>

            {localizedSidebarTags.length > 0 ? (
              <section className="preview-sidebar__section">
                <div className="preview-section__heading">
                  <h2>{text.tags}</h2>
                </div>
                <ul className="preview-sidebar-tags" aria-label={text.tags}>
                  {localizedSidebarTags.map((tag) => <li key={tag}>{tag}</li>)}
                </ul>
              </section>
            ) : null}

            <section className="preview-sidebar__section">
              <div className="preview-section__heading">
                <h2>{text.projectInfo}</h2>
              </div>
              <dl className="preview-detail-list preview-project-info">
                <div>
                  <dt>{text.license}</dt>
                  <dd>{license ? licenseOption ? <a className="preview-license-link" href={licenseOption.href} target="_blank" rel="noreferrer">{license}</a> : license : text.noData}</dd>
                </div>
                <div>
                  <dt>{text.published}</dt>
                    <dd>{published.en || published.zh || text.noData}</dd>
                </div>
                <div>
                  <dt>{text.updated}</dt>
                    <dd>{updated.en || updated.zh || text.noData}</dd>
                </div>
              </dl>
            </section>
          </aside>
        </div>
      </div>
    </section>
  );
}
