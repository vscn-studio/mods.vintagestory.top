'use client';

import { ChevronDown, ChevronLeft, ChevronRight, Grid2X2, List, PackageOpen, Search } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useSiteLanguage } from '@/components/SiteLanguageContext';

type ContentType = 'mods' | 'theme-pack' | 'modpacks' | 'server';
type ViewMode = 'list' | 'grid';

type FilterOption = {
  id: string;
  zh: string;
  en: string;
};

const typeTabs: Array<{ id: ContentType; href: string; zh: string; en: string }> = [
  { id: 'mods', href: '/mods', zh: '模组', en: 'Mods' },
  { id: 'theme-pack', href: '/mods?type=theme-pack', zh: '主题包', en: 'Theme Packs' },
  { id: 'modpacks', href: '/modpacks', zh: '整合包', en: 'Modpacks' },
  { id: 'server', href: '/mods?type=server', zh: '服务器调整', en: 'Server Tweaks' }
];

const gameVersions: FilterOption[] = [
  { id: '1.22', zh: '1.22', en: '1.22' },
  { id: '1.21', zh: '1.21', en: '1.21' },
  { id: '1.20', zh: '1.20', en: '1.20' },
  { id: '1.19', zh: '1.19', en: '1.19' }
];

const categories: FilterOption[] = [
  { id: 'adventure', zh: '冒险', en: 'Adventure' },
  { id: 'building', zh: '建筑', en: 'Building' },
  { id: 'survival', zh: '生存', en: 'Survival' },
  { id: 'technology', zh: '科技', en: 'Technology' },
  { id: 'magic', zh: '魔法', en: 'Magic' }
];

const environments: FilterOption[] = [
  { id: 'client', zh: '纯客户端', en: 'Client-only' },
  { id: 'server', zh: '纯服务器', en: 'Server-only' },
  { id: 'both', zh: '双端', en: 'Both sides' }
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
    sortUpdated: '最近更新',
    sortCreated: '最近发布',
    sortDownloads: '下载量',
    viewMode: '显示方式',
    listView: '列表布局',
    gridView: '网格布局',
    perPage: '每页显示',
    items: '项',
    previousPage: '上一页',
    nextPage: '下一页',
    emptyTitle: '内容列表准备中',
    emptyDescription: '筛选和排序控件已就绪，内容接入后会显示在这里。'
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
    sortUpdated: 'Recently updated',
    sortCreated: 'Recently published',
    sortDownloads: 'Downloads',
    viewMode: 'View mode',
    listView: 'List view',
    gridView: 'Grid view',
    perPage: 'Items per page',
    items: 'items',
    previousPage: 'Previous page',
    nextPage: 'Next page',
    emptyTitle: 'Content is being prepared',
    emptyDescription: 'Filtering and sorting controls are ready. Content will appear here once connected.'
  }
} as const;

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

      {isOpen ? (
        <div className="content-select-popover" role="listbox" aria-label={label}>
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
      ) : null}
    </div>
  );
}

export function ContentBrowser() {
  const language = useSiteLanguage();
  const text = browserCopy[language];
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeType = getActiveType(pathname, searchParams.get('type'));
  const [query, setQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [sort, setSort] = useState('updated');
  const [perPage, setPerPage] = useState('20');
  const [selectedFilters, setSelectedFilters] = useState<Record<string, boolean>>({});

  const groups = useMemo(
    () => [
      { id: 'version', label: text.gameVersion, options: gameVersions },
      { id: 'category', label: text.category, options: categories },
      { id: 'environment', label: text.environment, options: environments }
    ],
    [text]
  );
  const sortOptions = [
    { value: 'updated', label: text.sortUpdated },
    { value: 'created', label: text.sortCreated },
    { value: 'downloads', label: text.sortDownloads }
  ];
  const perPageOptions = ['12', '20', '40', '60'].map((value) => ({ value, label: `${value} ${text.items}` }));

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
  }

  function toggleFilter(id: string) {
    setSelectedFilters((current) => ({ ...current, [id]: !current[id] }));
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
                <div className="content-filter-options">
                  {group.options.map((option) => (
                    <label className="content-check" key={option.id}>
                      <input
                        type="checkbox"
                        checked={Boolean(selectedFilters[option.id])}
                        onChange={() => toggleFilter(option.id)}
                      />
                      <span>{language === 'en' ? option.en : option.zh}</span>
                    </label>
                  ))}
                </div>
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
              <ContentSelect label={text.sort} value={sort} options={sortOptions} onChange={setSort} />

              <ContentSelect className="content-select--count" label={text.perPage} value={perPage} options={perPageOptions} onChange={setPerPage} />

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
                <button className="content-pagination__button" type="button" title={text.previousPage} aria-label={text.previousPage} disabled>
                  <ChevronLeft size={17} strokeWidth={1.8} aria-hidden="true" />
                </button>
                <span className="content-pagination__current" aria-current="page">1</span>
                <button className="content-pagination__button" type="button" title={text.nextPage} aria-label={text.nextPage} disabled>
                  <ChevronRight size={17} strokeWidth={1.8} aria-hidden="true" />
                </button>
              </div>
            </div>

            <div className={`content-empty content-empty--${viewMode}`}>
              <div className="content-empty__icon" aria-hidden="true">
                <PackageOpen size={28} strokeWidth={1.55} />
              </div>
              <h2>{text.emptyTitle}</h2>
              <p>{text.emptyDescription}</p>
            </div>
          </section>
        </div>
      </div>
    </section>
  );
}
