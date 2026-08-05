'use client';

import { ChevronDown, ChevronLeft, ChevronRight, Clock3, Download, Grid2X2, Heart, List, Search } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
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
    emptyTitle: 'Content is being prepared',
    emptyDescription: 'Filtering and sorting controls are ready. Content will appear here once connected.'
  }
} as const;

type SampleMod = {
  id: string;
  image: string;
  name: { zh: string; en: string };
  author: string;
  authorType: 'user' | 'organization';
  authorId: string;
  description: { zh: string; en: string };
  tags: { zh: string; en: string }[];
  downloads: string;
  followers: string;
  updated: { zh: string; en: string };
};

const sampleMods: SampleMod[] = [
  {
    id: 'wildcraft',
    image: '/brand/vintage-story-game-logo.png',
    name: { zh: '荒野工艺', en: 'Wildcraft' },
    author: 'Mira',
    authorType: 'user',
    authorId: 'mira',
    description: {
      zh: '扩展野外采集、制作与生存路线，让每次远行都有新的发现。',
      en: 'Expands gathering, crafting, and survival paths for more rewarding expeditions.'
    },
    tags: [
      { zh: '生存', en: 'Survival' },
      { zh: '双端', en: 'Both sides' }
    ],
    downloads: '128.4K',
    followers: '2.8K',
    updated: { zh: '2 小时前', en: '2 hours ago' }
  },
  {
    id: 'mechanical-expansion',
    image: '/brand/vintage-story-game-logo.png',
    name: { zh: '机械扩展', en: 'Mechanical Expansion' },
    author: 'Stoneworks',
    authorType: 'organization',
    authorId: 'stoneworks',
    description: {
      zh: '为风车、齿轮和自动化设备加入新的组合与升级选项。',
      en: 'Adds new combinations and upgrades for windmills, gears, and automation.'
    },
    tags: [
      { zh: '科技', en: 'Technology' },
      { zh: '服务器', en: 'Server' }
    ],
    downloads: '94.7K',
    followers: '1.9K',
    updated: { zh: '昨天', en: 'Yesterday' }
  },
  {
    id: 'ancient-ruins',
    image: '/brand/vintage-story-game-logo.png',
    name: { zh: '远古遗迹', en: 'Ancient Ruins' },
    author: 'Lumen Team',
    authorType: 'organization',
    authorId: 'lumen-team',
    description: {
      zh: '在世界各处加入可探索的遗迹、谜题和适合多人游玩的奖励。',
      en: 'Introduces explorable ruins, puzzles, and rewards built for multiplayer worlds.'
    },
    tags: [
      { zh: '冒险', en: 'Adventure' },
      { zh: '探索', en: 'Exploration' }
    ],
    downloads: '76.2K',
    followers: '1.4K',
    updated: { zh: '3 天前', en: '3 days ago' }
  },
  {
    id: 'natural-soundscapes',
    image: '/brand/vintage-story-game-logo.png',
    name: { zh: '自然音景', en: 'Natural Soundscapes' },
    author: 'Northwind',
    authorType: 'user',
    authorId: 'northwind',
    description: {
      zh: '重新设计环境声音，让不同群系和天气拥有更清晰的氛围层次。',
      en: 'Reworks environmental audio with clearer layers for biomes and weather.'
    },
    tags: [
      { zh: '音频', en: 'Audio' },
      { zh: '纯客户端', en: 'Client only' }
    ],
    downloads: '51.8K',
    followers: '1.1K',
    updated: { zh: '5 天前', en: '5 days ago' }
  }
];

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
  const [query, setQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [sort, setSort] = useState('relevance');
  const [perPage, setPerPage] = useState('20');
  const groups = useMemo(
    () => [
      { id: 'version', label: text.gameVersion },
      { id: 'category', label: text.category },
      { id: 'environment', label: text.environment }
    ],
    [text]
  );
  const sortOptions = [
    { value: 'relevance', label: text.sortRelevance },
    { value: 'downloads', label: text.sortDownloads },
    { value: 'followers', label: text.sortFollowers },
    { value: 'published', label: text.sortPublished },
    { value: 'updated', label: text.sortUpdated }
  ];
  const perPageOptions = ['12', '20', '40', '60'].map((value) => ({ value, label: `${value} ${text.items}` }));

  function openCard(modId: string) {
    router.push(activeType === 'modpacks' ? `/modpack/${modId}` : `/mod/${modId}`);
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
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

            <div className={`content-cards content-cards--${viewMode}`}>
              {sampleMods.map((mod) => {
                const name = language === 'en' ? mod.name.en : mod.name.zh;
                const description = language === 'en' ? mod.description.en : mod.description.zh;
                const updated = language === 'en' ? mod.updated.en : mod.updated.zh;

                return (
                  <article
                    className={`content-card content-card--${viewMode} content-card--interactive`}
                    key={mod.id}
                    role="link"
                    tabIndex={0}
                    aria-label={name}
                    onClick={() => openCard(mod.id)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        openCard(mod.id);
                      }
                    }}
                  >
                    <div className="content-card__media">
                      <img src={mod.image} alt={name} loading="lazy" />
                    </div>

                    <div className="content-card__body">
                      <div className="content-card__summary">
                        <div className="content-card__icon" aria-hidden="true">
                          <img src={mod.image} alt="" loading="lazy" />
                        </div>
                        <div className="content-card__copy">
                          <h2 className="content-card__title">
                            <span>{name}</span>{' '}
                            <Link
                              className="content-card__author"
                              href={`/${mod.authorType === 'user' ? 'user' : 'organization'}/${mod.authorId}`}
                              onClick={(event) => event.stopPropagation()}
                            >
                              {text.cardBy} {mod.author}
                            </Link>
                          </h2>
                          <p className="content-card__description">{description}</p>
                        </div>
                      </div>

                      <ul className="content-card__tags" aria-label={language === 'en' ? 'Tags' : '标签'}>
                        {mod.tags.map((tag) => (
                          <li key={tag.en}>{language === 'en' ? tag.en : tag.zh}</li>
                        ))}
                      </ul>
                    </div>

                    <dl className="content-card__stats">
                      <div>
                        <dt aria-label={text.cardDownloads}>
                          <Download size={15} strokeWidth={1.9} aria-hidden="true" />
                        </dt>
                        <dd>{mod.downloads}</dd>
                      </div>
                      <div>
                        <dt aria-label={text.cardFollowers}>
                          <Heart size={15} strokeWidth={1.9} aria-hidden="true" />
                        </dt>
                        <dd>{mod.followers}</dd>
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
              })}
            </div>
          </section>
        </div>
      </div>
    </section>
  );
}
