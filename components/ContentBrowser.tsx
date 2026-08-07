'use client';

import { AlertCircle, ChevronDown, ChevronLeft, ChevronRight, Clock3, Download, Grid2X2, Heart, List, LoaderCircle, Search } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, useEffect, useRef, useState } from 'react';
import { useSiteLanguage } from '@/components/SiteLanguageContext';

type ContentType = 'mods' | 'theme-pack' | 'modpacks' | 'server';
type ViewMode = 'list' | 'grid';

const typeTabs: Array<{ id: ContentType; href: string; zh: string; en: string }> = [
  { id: 'mods', href: '/mods', zh: '模组', en: 'Mods' },
  { id: 'theme-pack', href: '/mods?type=theme-pack', zh: '主题包', en: 'Theme Packs' },
  { id: 'modpacks', href: '/modpacks', zh: '整合包', en: 'Modpacks' },
  { id: 'server', href: '/mods?type=server', zh: '服务器调整', en: 'Server Tweaks' }
];

const browserCopy = {
  'zh-CN': {
    eyebrow: 'MOD DATABASE',
    title: '探索内容',
    description: '按类型浏览 VintageStory 的社区创作。',
    filters: '筛选',
    gameVersion: '游戏版本',
    category: '分类',
    environment: '运行环境',
    searchPlaceholder: '搜索模组名称、作者或标签',
    sort: '排序方式',
    sortRelevance: '相关性',
    sortDownloads: '下载量',
    sortFollowers: '关注量',
    sortPublished: '发布时间',
    sortUpdated: '更新时间',
    viewMode: '显示方式',
    listView: '列表布局',
    gridView: '网格布局',
    cardDownloads: '下载量',
    cardFollowers: '关注量',
    cardUpdated: '最近更新',
    cardBy: 'by',
    perPage: '每页显示',
    items: '项',
    previousPage: '上一页',
    nextPage: '下一页',
    emptyTitle: '暂无公开项目',
    emptyDescription: '还没有符合当前筛选条件的项目。',
    loading: '正在加载内容…',
    loadError: '内容加载失败，请稍后重试。',
    retry: '重试',
    filterPlaceholder: '输入后回车筛选',
    clearFilter: '清除'
  },
  en: {
    eyebrow: 'MOD DATABASE',
    title: 'Explore content',
    description: 'Browse VintageStory community creations by type.',
    filters: 'Filters',
    gameVersion: 'Game version',
    category: 'Category',
    environment: 'Environment',
    searchPlaceholder: 'Search by name, author, or tag',
    sort: 'Sort by',
    sortRelevance: 'Relevance',
    sortDownloads: 'Downloads',
    sortFollowers: 'Followers',
    sortPublished: 'Date published',
    sortUpdated: 'Date updated',
    viewMode: 'View mode',
    listView: 'List view',
    gridView: 'Grid view',
    cardDownloads: 'Downloads',
    cardFollowers: 'Followers',
    cardUpdated: 'Updated',
    cardBy: 'by',
    perPage: 'Items per page',
    items: 'items',
    previousPage: 'Previous page',
    nextPage: 'Next page',
    emptyTitle: 'No public projects',
    emptyDescription: 'No projects match the current filters.',
    loading: 'Loading content…',
    loadError: 'Content could not be loaded. Try again.',
    retry: 'Retry',
    filterPlaceholder: 'Type and press Enter',
    clearFilter: 'Clear'
  }
} as const;

type ApiProject = {
  id: string;
  slug: string;
  type: string;
  name: { zh: string; en: string };
  summary: { zh: string; en: string };
  owner: { type: 'user' | 'organization'; id: string; slug?: string; username?: string; name: string } | null;
  tags: Array<{ slug: string; name: string; nameEn: string }>;
  stats: { downloads: number; followers: number };
  updatedAt: string;
};

type ApiEnvelope = { data?: ApiProject[]; meta?: { page?: number; pageSize?: number; total?: number; totalPages?: number }; error?: { message?: string } };

function getActiveType(pathname: string, queryType: string | null): ContentType {
  if (pathname === '/modpacks') return 'modpacks';
  if (queryType === 'theme-pack' || queryType === 'server') return queryType;
  return 'mods';
}

type ContentSelectOption = {
  value: string;
  label: string;
};

type ContentSelectProps = {
  className?: string;
  label: string;
  value: string;
  options: ContentSelectOption[];
  onChange: (value: string) => void;
};

function ContentSelect({ className = '', label, value, options, onChange }: ContentSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const selectedOption = options.find((option) => option.value === value) ?? options[0];

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setIsOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsOpen(false);
    }

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return (
    <div className={`content-select-menu${className ? ` ${className}` : ''}`} ref={menuRef}>
      <button
        className={isOpen ? 'content-select content-select--open' : 'content-select'}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
      >
        <span className="content-select__label">{label}</span>
        <span className="content-select__value">{selectedOption?.label}</span>
        <ChevronDown className={isOpen ? 'content-select__chevron content-select__chevron--up' : 'content-select__chevron'} size={15} strokeWidth={1.8} aria-hidden="true" />
      </button>

      <div
        className={isOpen ? 'content-select-popover content-select-popover--open' : 'content-select-popover'}
        role="listbox"
        aria-hidden={!isOpen}
        aria-label={label}
      >
        {options.map((option) => (
          <button
            className={option.value === value ? 'content-select-option content-select-option--active' : 'content-select-option'}
            key={option.value}
            type="button"
            role="option"
            aria-selected={option.value === value}
            onClick={() => {
              onChange(option.value);
              setIsOpen(false);
            }}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function ContentBrowser() {
  const language = useSiteLanguage();
  const text = browserCopy[language];
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeType = getActiveType(pathname, searchParams.get('type'));
  const [query, setQuery] = useState(searchParams.get('q') ?? '');
  const [gameVersion, setGameVersion] = useState(searchParams.get('gameVersion') ?? '');
  const [category, setCategory] = useState(searchParams.get('category') ?? '');
  const [environment, setEnvironment] = useState(searchParams.get('environment') ?? '');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [sort, setSort] = useState(searchParams.get('sort') ?? 'updated');
  const [perPage, setPerPage] = useState(searchParams.get('pageSize') ?? '20');
  const [page, setPage] = useState(Number(searchParams.get('page') ?? '1') || 1);
  const [projects, setProjects] = useState<ApiProject[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [reloadToken, setReloadToken] = useState(0);
  const groups = [
    { id: 'version', label: text.gameVersion, value: gameVersion, setValue: setGameVersion, param: 'gameVersion' },
    { id: 'category', label: text.category, value: category, setValue: setCategory, param: 'category' },
    { id: 'environment', label: text.environment, value: environment, setValue: setEnvironment, param: 'environment' }
  ];
  const sortOptions = [
    { value: 'relevance', label: text.sortRelevance },
    { value: 'downloads', label: text.sortDownloads },
    { value: 'followers', label: text.sortFollowers },
    { value: 'published', label: text.sortPublished },
    { value: 'updated', label: text.sortUpdated }
  ];
  const perPageOptions = ['12', '20', '40', '60'].map((value) => ({ value, label: `${value} ${text.items}` }));

  function openCard(project: ApiProject) {
    router.push(project.type === 'modpack' ? `/modpack/${project.slug}` : `/mod/${project.slug}`);
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    updateUrl({ q: query, gameVersion, category, environment, sort, pageSize: perPage, page: '1' });
  }

  function updateUrl(values: Record<string, string>) {
    const next = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(values)) {
      if (value) next.set(key, value); else next.delete(key);
    }
    router.replace(`${pathname}${next.toString() ? `?${next.toString()}` : ''}`, { scroll: false });
  }

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ type: activeType === 'modpacks' ? 'modpack' : activeType, sort: sort === 'relevance' ? 'updated' : sort, page: String(page), pageSize: perPage });
    if (query.trim()) params.set('q', query.trim());
    if (gameVersion.trim()) params.set('gameVersion', gameVersion.trim());
    if (category.trim()) params.set('category', category.trim());
    if (environment.trim()) params.set('environment', environment.trim());
    setLoading(true);
    setLoadError('');
    fetch(`/api/v1/projects?${params.toString()}`, { cache: 'no-store', signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json() as ApiEnvelope;
        if (!response.ok) throw new Error(payload.error?.message ?? text.loadError);
        setProjects(payload.data ?? []);
        setTotal(payload.meta?.total ?? 0);
        setTotalPages(Math.max(1, payload.meta?.totalPages ?? 1));
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setProjects([]);
        setLoadError(error instanceof Error ? error.message : text.loadError);
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [activeType, category, environment, gameVersion, page, perPage, query, reloadToken, sort, text.loadError]);

  useEffect(() => {
    setQuery(searchParams.get('q') ?? '');
    setGameVersion(searchParams.get('gameVersion') ?? '');
    setCategory(searchParams.get('category') ?? '');
    setEnvironment(searchParams.get('environment') ?? '');
    setSort(searchParams.get('sort') ?? 'updated');
    setPerPage(searchParams.get('pageSize') ?? '20');
    setPage(Math.max(1, Number(searchParams.get('page') ?? '1') || 1));
  }, [searchParams]);

  function changeSort(value: string) {
    setSort(value);
    setPage(1);
    updateUrl({ sort: value, page: '1' });
  }

  function changePerPage(value: string) {
    setPerPage(value);
    setPage(1);
    updateUrl({ pageSize: value, page: '1' });
  }

  function changePage(nextPage: number) {
    const bounded = Math.max(1, Math.min(totalPages, nextPage));
    setPage(bounded);
    updateUrl({ page: String(bounded) });
  }

  function formatDate(value: string): string {
    try { return new Intl.DateTimeFormat(language === 'en' ? 'en' : 'zh-CN', { dateStyle: 'medium' }).format(new Date(value)); } catch { return value; }
  }

  return (
    <section className="content-page" aria-label={text.title}>
      <div className="content-page__inner">
        <nav className="content-switcher" aria-label={text.title}>
          {typeTabs.map((tab) => (
            <Link
              className={activeType === tab.id ? 'content-switcher__item content-switcher__item--active' : 'content-switcher__item'}
              href={tab.href}
              key={tab.id}
              aria-current={activeType === tab.id ? 'page' : undefined}
            >
              {language === 'en' ? tab.en : tab.zh}
            </Link>
          ))}
        </nav>

        <div className="content-layout">
          <aside className="content-filters" aria-label={text.filters}>
            {groups.map((group) => (
              <details className="content-filter-group" key={group.id} open>
                <summary>
                  <span>{group.label}</span>
                  <ChevronDown size={16} strokeWidth={1.8} aria-hidden="true" />
                </summary>
                <form className="content-filter-group__form" onSubmit={(event) => { event.preventDefault(); setPage(1); updateUrl({ [group.param]: group.value, page: '1' }); }}>
                  <input
                    type="search"
                    value={group.value}
                    onChange={(event) => group.setValue(event.target.value)}
                    placeholder={text.filterPlaceholder}
                    aria-label={group.label}
                  />
                  {group.value ? <button type="button" title={text.clearFilter} aria-label={`${text.clearFilter}: ${group.label}`} onClick={() => { group.setValue(''); setPage(1); updateUrl({ [group.param]: '', page: '1' }); }}>×</button> : null}
                </form>
              </details>
            ))}
          </aside>

          <section className="content-results" aria-label={text.title}>
            <form className="content-search" role="search" onSubmit={submitSearch}>
              <Search size={19} strokeWidth={1.8} aria-hidden="true" />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={text.searchPlaceholder}
                aria-label={text.searchPlaceholder}
              />
            </form>

            <div className="content-toolbar">
              <ContentSelect label={text.sort} value={sort} options={sortOptions} onChange={changeSort} />

              <ContentSelect className="content-select--count" label={text.perPage} value={perPage} options={perPageOptions} onChange={changePerPage} />

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

              <div className="content-pagination" aria-label={language === 'en' ? 'Pagination' : '分页'}>
                <button className="content-pagination__button" type="button" title={text.previousPage} aria-label={text.previousPage} disabled={page <= 1 || loading} onClick={() => changePage(page - 1)}>
                  <ChevronLeft size={17} strokeWidth={1.8} aria-hidden="true" />
                </button>
                <span className="content-pagination__current" aria-current="page">{page}</span>
                <button className="content-pagination__button" type="button" title={text.nextPage} aria-label={text.nextPage} disabled={page >= totalPages || loading} onClick={() => changePage(page + 1)}>
                  <ChevronRight size={17} strokeWidth={1.8} aria-hidden="true" />
                </button>
              </div>
            </div>

            <div className={`content-cards content-cards--${viewMode}`}>
              {loading ? <p className="content-browser__empty"><LoaderCircle className="content-browser__spinner" size={20} aria-hidden="true" />{text.loading}</p> : loadError ? <div className="content-browser__empty"><AlertCircle size={21} aria-hidden="true" /><p>{loadError}</p><button className="auth-code-button" type="button" onClick={() => setReloadToken((value) => value + 1)}>{text.retry}</button></div> : projects.length > 0 ? projects.map((mod) => {
                const name = language === 'en' ? mod.name.en : mod.name.zh;
                const description = language === 'en' ? mod.summary.en : mod.summary.zh;
                const updated = formatDate(mod.updatedAt);
                const ownerType = mod.owner?.type ?? 'user';
                const ownerId = ownerType === 'organization' ? mod.owner?.slug ?? mod.owner?.id ?? '' : mod.owner?.username ?? mod.owner?.id ?? '';
                const ownerName = mod.owner?.name ?? (language === 'en' ? 'Unknown creator' : '未知作者');

                return (
                  <article
                    className={`content-card content-card--${viewMode} content-card--interactive`}
                    key={mod.id}
                    role="link"
                    tabIndex={0}
                    aria-label={name}
                    onClick={() => openCard(mod)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        openCard(mod);
                      }
                    }}
                  >
                    <div className="content-card__media">
                      <img src="/brand/vintage-story-game-logo.png" alt={name} loading="lazy" />
                    </div>

                    <div className="content-card__body">
                      <div className="content-card__summary">
                        <div className="content-card__icon" aria-hidden="true">
                          <img src="/brand/vintage-story-game-logo.png" alt="" loading="lazy" />
                        </div>
                        <div className="content-card__copy">
                          <h2 className="content-card__title">
                            <span>{name}</span>{' '}
                            <Link
                              className="content-card__author"
                              href={`/${ownerType === 'user' ? 'user' : 'organization'}/${encodeURIComponent(ownerId)}`}
                              onClick={(event) => event.stopPropagation()}
                            >
                              {text.cardBy} {ownerName}
                            </Link>
                          </h2>
                          <p className="content-card__description">{description}</p>
                        </div>
                      </div>

                      <ul className="content-card__tags" aria-label={language === 'en' ? 'Tags' : '标签'}>
                        {mod.tags.map((tag) => (
                          <li key={tag.slug}>{language === 'en' ? tag.nameEn : tag.name}</li>
                        ))}
                      </ul>
                    </div>

                    <dl className="content-card__stats">
                      <div>
                        <dt aria-label={text.cardDownloads}>
                          <Download size={15} strokeWidth={1.9} aria-hidden="true" />
                        </dt>
                        <dd>{mod.stats.downloads.toLocaleString()}</dd>
                      </div>
                      <div>
                        <dt aria-label={text.cardFollowers}>
                          <Heart size={15} strokeWidth={1.9} aria-hidden="true" />
                        </dt>
                        <dd>{mod.stats.followers.toLocaleString()}</dd>
                      </div>
                      <div>
                        <dt aria-label={text.cardUpdated}>
                          <Clock3 size={15} strokeWidth={1.9} aria-hidden="true" />
                        </dt>
                        <dd>{updated}</dd>
                      </div>
                    </dl>
                  </article>
                );
              }) : <div className="content-browser__empty"><strong>{text.emptyTitle}</strong><p>{text.emptyDescription}</p></div>}
            </div>
          </section>
        </div>
      </div>
    </section>
  );
}
