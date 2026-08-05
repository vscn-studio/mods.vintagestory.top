'use client';

import { ArrowLeft, BookOpen, Check, ChevronDown, ChevronLeft, ChevronRight, Coffee, Copy, Download, EllipsisVertical, Flag, GitBranch, Heart, MessageCircle } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useSiteLanguage } from '@/components/SiteLanguageContext';

type ContentPreviewPageProps = {
  kind: 'mod' | 'modpack';
  id: string;
};

type PreviewSection = 'description' | 'screenshots' | 'changelog' | 'versions';

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
  author: string;
  authorType: 'user' | 'organization';
  authorId: string;
  description: { zh: string; en: string };
  members?: PreviewMember[];
  compatibleVersions?: string[];
  environments?: PreviewLocalizedValue[];
  tags?: PreviewLocalizedValue[];
  license?: PreviewLocalizedValue;
  published?: PreviewLocalizedValue;
  updated?: PreviewLocalizedValue;
};

const contentData: Record<string, PreviewContent> = {
  wildcraft: {
    name: { zh: '荒野工艺', en: 'Wildcraft' },
    author: 'Mira',
    authorType: 'user' as const,
    authorId: 'mira',
    description: {
      zh: '扩展野外采集、制作与生存路线，让每次远行都有新的发现。',
      en: 'Expands gathering, crafting, and survival paths for more rewarding expeditions.'
    }
  },
  'mechanical-expansion': {
    name: { zh: '机械扩展', en: 'Mechanical Expansion' },
    author: 'Stoneworks',
    authorType: 'organization' as const,
    authorId: 'stoneworks',
    members: [
      { id: 'aria', name: 'Aria', role: { zh: '创始人', en: 'Founder' } },
      { id: 'toma', name: 'Toma', role: { zh: '维护者', en: 'Maintainer' } },
      { id: 'nox', name: 'Nox', role: { zh: '贡献者', en: 'Contributor' } }
    ],
    description: {
      zh: '为风车、齿轮和自动化设备加入新的组合与升级选项。',
      en: 'Adds new combinations and upgrades for windmills, gears, and automation.'
    }
  },
  'ancient-ruins': {
    name: { zh: '远古遗迹', en: 'Ancient Ruins' },
    author: 'Lumen Team',
    authorType: 'organization' as const,
    authorId: 'lumen-team',
    members: [
      { id: 'lumen', name: 'Lumen', role: { zh: '负责人', en: 'Lead' } },
      { id: 'cinder', name: 'Cinder', role: { zh: '设计者', en: 'Designer' } },
      { id: 'rui', name: 'Rui', role: { zh: '汉化维护', en: 'Translator' } }
    ],
    description: {
      zh: '在世界各处加入可探索的遗迹、谜题和适合多人游玩的奖励。',
      en: 'Introduces explorable ruins, puzzles, and rewards built for multiplayer worlds.'
    }
  },
  'natural-soundscapes': {
    name: { zh: '自然音景', en: 'Natural Soundscapes' },
    author: 'Northwind',
    authorType: 'user' as const,
    authorId: 'northwind',
    description: {
      zh: '重新设计环境声音，让不同群系和天气拥有更清晰的氛围层次。',
      en: 'Reworks environmental audio with clearer layers for biomes and weather.'
    }
  }
} as const;

const previewCopy = {
  'zh-CN': {
    back: '返回内容',
    author: '作者',
    ownerRole: '所有者',
    organizationRole: '组织',
    membersPlaceholder: '成员列表接入后将在这里显示。',
    downloads: '下载量',
    followers: '关注量',
    follow: '关注',
    download: '下载',
    moreActions: '更多操作',
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
    placeholder: '详细内容接入后将在这里显示。',
    versionValue: '1.21 · 1.22'
  },
  en: {
    back: 'Back to content',
    author: 'Author',
    ownerRole: 'Owner',
    organizationRole: 'Organization',
    membersPlaceholder: 'Members will appear here when connected.',
    downloads: 'Downloads',
    followers: 'Followers',
    follow: 'Follow',
    download: 'Download',
    moreActions: 'More actions',
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
    placeholder: 'Detailed content will appear here when connected.',
    versionValue: '1.21 · 1.22'
  }
} as const;

function titleFromId(id: string): string {
  return id
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function ContentPreviewPage({ kind, id }: ContentPreviewPageProps) {
  const language = useSiteLanguage();
  const text = previewCopy[language];
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<PreviewSection>('description');
  const [isVersionFilterOpen, setIsVersionFilterOpen] = useState(false);
  const [selectedVersions, setSelectedVersions] = useState<string[]>([]);
  const [openReleaseMenu, setOpenReleaseMenu] = useState<string | null>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);
  const versionFilterRef = useRef<HTMLDivElement>(null);
  const releaseMenuRef = useRef<HTMLDivElement>(null);

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

  const fallback = {
    name: { zh: titleFromId(id), en: titleFromId(id) },
    author: 'Community creator',
    authorType: 'user' as const,
    authorId: 'community-creator',
    description: { zh: text.placeholder, en: text.placeholder }
  };
  const content = contentData[id as keyof typeof contentData] ?? fallback;
  const name = language === 'en' ? content.name.en : content.name.zh;
  const description = language === 'en' ? content.description.en : content.description.zh;
  const authorPath = content.authorType === 'user' ? `/user/${content.authorId}` : `/organization/${content.authorId}`;
  const members = content.members ?? [];
  const compatibleVersions = content.compatibleVersions ?? ['1.21', '1.22'];
  const runtimeEnvironments = content.environments ?? [{ zh: text.bothSides, en: text.bothSides }];
  const sidebarTags = content.tags ?? [
    { zh: kind === 'modpack' ? '整合包' : '生存', en: kind === 'modpack' ? 'Modpack' : 'Survival' },
    { zh: '社区创作', en: 'Community' }
  ];
  const license = content.license ?? { zh: 'MIT', en: 'MIT' };
  const published = content.published ?? { zh: '2026-06-14', en: '2026-06-14' };
  const updated = content.updated ?? { zh: '2026-07-28', en: '2026-07-28' };
  const repositoryUrl = `https://github.com/scgm0/${id}`;
  const relatedLinks = [
    { id: 'source', label: text.sourceCode, href: repositoryUrl },
    { id: 'issues', label: text.issues, href: `${repositoryUrl}/issues` },
    { id: 'wiki', label: text.wiki, href: `${repositoryUrl}/wiki` },
    { id: 'discord', label: text.discord, href: 'https://discord.com/' },
    { id: 'sponsor', label: text.sponsor, href: 'https://ko-fi.com/scgm0' }
  ];
  const sectionTabs: Array<{ id: PreviewSection; label: string }> = [
    { id: 'description', label: text.description },
    { id: 'screenshots', label: text.screenshots },
    { id: 'changelog', label: text.changelog },
    { id: 'versions', label: text.versions }
  ];
  const sectionHrefs: Record<PreviewSection, string> = {
    description: '#preview-panel-description',
    screenshots: '/screenshots',
    changelog: '/changelog',
    versions: '/versions'
  };
  const screenshotCards = language === 'en'
    ? ['In-world overview', 'Mechanical details', 'Automation setup']
    : ['游戏内场景', '机械结构细节', '自动化布局'];
  const changelogEntries = language === 'en'
    ? [
        { version: '1.0.1', date: '2026-07-28', summary: 'Improves gear performance and updates multiplayer compatibility.' },
        { version: '1.0.0', date: '2026-06-14', summary: 'Initial release with windmill and mechanical power systems.' }
      ]
    : [
        { version: '1.0.1', date: '2026-07-28', summary: '优化齿轮性能，并更新多人游戏兼容性。' },
        { version: '1.0.0', date: '2026-06-14', summary: '首次发布，加入风车与机械动力系统。' }
      ];
  const versionEntries = language === 'en'
    ? [
        { version: '1.0.1', game: '1.21 · 1.22', published: '2026-07-28', updated: '2026-07-28', downloads: '24.8K' },
        { version: '1.0.0', game: '1.21', published: '2026-06-14', updated: '2026-06-18', downloads: '18.2K' }
      ]
    : [
        { version: '1.0.1', game: '1.21 · 1.22', published: '2026-07-28', updated: '2026-07-28', downloads: '24.8K' },
        { version: '1.0.0', game: '1.21', published: '2026-06-14', updated: '2026-06-18', downloads: '18.2K' }
      ];
  const gameVersionOptions = ['1.22', '1.21', '1.20'];
  const selectedVersionLabel = selectedVersions.length > 0 ? selectedVersions.join(' · ') : text.allVersions;

  function toggleVersion(version: string) {
    setSelectedVersions((current) => current.includes(version) ? current.filter((item) => item !== version) : [...current, version]);
  }

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
          <ChevronDown className={isVersionFilterOpen ? 'preview-version-filter__chevron preview-version-filter__chevron--up' : 'preview-version-filter__chevron'} size={15} strokeWidth={1.8} aria-hidden="true" />
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
        <button className="content-pagination__button" type="button" title={text.previousPage} aria-label={text.previousPage} disabled>
          <ChevronLeft size={17} strokeWidth={1.8} aria-hidden="true" />
        </button>
        <span className="content-pagination__current" aria-current="page">1</span>
        <button className="content-pagination__button" type="button" title={text.nextPage} aria-label={text.nextPage} disabled>
          <ChevronRight size={17} strokeWidth={1.8} aria-hidden="true" />
        </button>
      </div>
    </div>
  ) : null;

  return (
    <section className="preview-page" aria-labelledby="preview-title">
      <div className="preview-page__inner">
        <Link className="preview-page__back" href={kind === 'modpack' ? '/modpacks' : '/mods'}>
          <ArrowLeft size={17} strokeWidth={1.9} aria-hidden="true" />
          <span>{text.back}</span>
        </Link>

        <header className="preview-hero">
          <div className="preview-hero__media-column">
            <div className="preview-hero__media">
              <img src="/brand/vintage-story-game-logo.png" alt="" />
            </div>
          </div>
          <div className="preview-hero__copy">
            <h1 id="preview-title">{name}</h1>
            <p className="preview-description">{description}</p>
            <div className="preview-hero__meta-row">
              <dl className="preview-hero__stats">
                <div>
                  <dt aria-label={text.downloads}>
                    <Download size={16} strokeWidth={1.9} aria-hidden="true" />
                  </dt>
                  <dd>128.4K</dd>
                </div>
                <div>
                  <dt aria-label={text.followers}>
                    <Heart size={16} strokeWidth={1.9} aria-hidden="true" />
                  </dt>
                  <dd>2.8K</dd>
                </div>
              </dl>
              <ul className="preview-tags" aria-label={text.tags}>
                <li>{kind === 'modpack' ? 'Modpack' : 'Survival'}</li>
                <li>{text.versionValue}</li>
                <li>{language === 'en' ? 'Community' : '社区创作'}</li>
              </ul>
            </div>
          </div>
          <div className="preview-hero__actions">
            <button className="preview-action preview-action--primary" type="button">
              <Download size={17} strokeWidth={1.9} aria-hidden="true" />
              <span>{text.download}</span>
            </button>
            <button className="preview-action" type="button">
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
                <button className="preview-more__item preview-more__item--danger" type="button" role="menuitem" onClick={() => setIsMoreOpen(false)}>
                  <Flag size={16} strokeWidth={1.9} aria-hidden="true" />
                  {text.report}
                </button>
                <button className="preview-more__item" type="button" role="menuitem" onClick={() => setIsMoreOpen(false)}>
                  <Copy size={16} strokeWidth={1.9} aria-hidden="true" />
                  {text.copyLink}
                </button>
              </div>
            </div>
          </div>
        </header>

        <nav className="content-switcher" aria-label={text.sectionNavigation}>
          {sectionTabs.map((tab) => (
            <a
              className={activeSection === tab.id ? 'content-switcher__item content-switcher__item--active' : 'content-switcher__item'}
              key={tab.id}
              href={sectionHrefs[tab.id]}
              aria-current={activeSection === tab.id ? 'page' : undefined}
              onClick={(event) => {
                event.preventDefault();
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
                <p>{description}</p>
                <p>{text.placeholder}</p>
              </section>
            ) : null}

            {activeSection === 'screenshots' ? (
              <section className="preview-section">
                <div className="preview-screenshot-grid">
                  {screenshotCards.map((caption) => (
                    <figure className="preview-screenshot-card" key={caption}>
                      <div className="preview-screenshot-card__media">
                        <img src="/brand/vintage-story-game-logo.png" alt={caption} loading="lazy" />
                      </div>
                      <figcaption>{caption}</figcaption>
                    </figure>
                  ))}
                </div>
              </section>
            ) : null}

            {activeSection === 'changelog' ? (
              <section className="preview-section">
                <div className="preview-changelog-list">
                  {changelogEntries.map((entry) => (
                    <article className="preview-changelog-item" key={entry.version}>
                      <div className="preview-changelog-item__heading">
                        <div className="preview-changelog-item__meta">
                          <strong>v{entry.version}</strong>
                          <time dateTime={entry.date}>{entry.date}</time>
                        </div>
                        <button className="preview-action preview-action--primary preview-changelog-item__download" type="button">
                          <Download size={16} strokeWidth={1.9} aria-hidden="true" />
                          <span>{text.download}</span>
                        </button>
                      </div>
                      <p>{entry.summary}</p>
                    </article>
                  ))}
                </div>
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
                      {versionEntries.map((entry) => (
                        <tr key={entry.version}>
                          <th scope="row"><strong>v{entry.version}</strong></th>
                          <td>
                            <ul className="preview-version-tags" aria-label={text.compatibleVersions}>
                              {entry.game.split(' · ').map((version) => <li key={version}>{version}</li>)}
                            </ul>
                          </td>
                          <td><time dateTime={entry.published}>{entry.published}</time></td>
                          <td><time dateTime={entry.updated}>{entry.updated}</time></td>
                          <td>{entry.downloads}</td>
                          <td>
                            <button className="preview-version-table__download" type="button" title={text.download} aria-label={`${text.download} v${entry.version}`}>
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
                                <button className="preview-more__item" type="button" role="menuitem" onClick={() => setOpenReleaseMenu(null)}>
                                  <Download size={16} strokeWidth={1.9} aria-hidden="true" />
                                  {text.download}
                                </button>
                                <button className="preview-more__item preview-more__item--danger" type="button" role="menuitem" onClick={() => setOpenReleaseMenu(null)}>
                                  <Flag size={16} strokeWidth={1.9} aria-hidden="true" />
                                  {text.report}
                                </button>
                                <button className="preview-more__item" type="button" role="menuitem" onClick={() => setOpenReleaseMenu(null)}>
                                  <Copy size={16} strokeWidth={1.9} aria-hidden="true" />
                                  {text.copyLink}
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      ))}
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
                      {compatibleVersions.map((version) => <li key={version}>{version}</li>)}
                    </ul>
                  </dd>
                </div>
                <div>
                  <dt>{text.runtimeEnvironment}</dt>
                  <dd>
                    <ul className="preview-sidebar-tags preview-sidebar-tags--compact" aria-label={text.runtimeEnvironment}>
                      {runtimeEnvironments.map((environment) => <li key={language === 'en' ? environment.en : environment.zh}>{language === 'en' ? environment.en : environment.zh}</li>)}
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
                  <strong>{content.author}</strong>
                  <span>{content.authorType === 'organization' ? text.organizationRole : text.ownerRole}</span>
                </span>
              </Link>
              {content.authorType === 'organization' ? (
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
                    <p>{text.membersPlaceholder}</p>
                  )}
                </div>
              ) : null}
            </section>

            <section className="preview-sidebar__section">
              <div className="preview-section__heading">
                <h2>{text.relatedLinks}</h2>
              </div>
              <nav className="preview-related-links" aria-label={text.relatedLinks}>
                {relatedLinks.map((link) => (
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

            <section className="preview-sidebar__section">
              <div className="preview-section__heading">
                <h2>{text.tags}</h2>
              </div>
              <ul className="preview-sidebar-tags" aria-label={text.tags}>
                {sidebarTags.map((tag) => <li key={language === 'en' ? tag.en : tag.zh}>{language === 'en' ? tag.en : tag.zh}</li>)}
                <li>{compatibleVersions.join(' · ')}</li>
              </ul>
            </section>

            <section className="preview-sidebar__section">
              <div className="preview-section__heading">
                <h2>{text.projectInfo}</h2>
              </div>
              <dl className="preview-detail-list preview-project-info">
                <div>
                  <dt>{text.license}</dt>
                  <dd>{language === 'en' ? license.en : license.zh}</dd>
                </div>
                <div>
                  <dt>{text.published}</dt>
                  <dd>{language === 'en' ? published.en : published.zh}</dd>
                </div>
                <div>
                  <dt>{text.updated}</dt>
                  <dd>{language === 'en' ? updated.en : updated.zh}</dd>
                </div>
              </dl>
            </section>
          </aside>
        </div>
      </div>
    </section>
  );
}
