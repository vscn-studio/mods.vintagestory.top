'use client';

import { ChevronLeft, ChevronRight, Download, FolderKanban, Grid2X2, Heart, List } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { useSiteLanguage } from '@/components/SiteLanguageContext';

type AccountPreviewPageProps = {
  kind: 'user' | 'organization';
  id: string;
};

type ProjectType = 'mods' | 'theme-pack' | 'modpacks' | 'server';

type ProfileProject = {
  id: string;
  type: ProjectType;
  name: { zh: string; en: string };
  description: { zh: string; en: string };
  tags: Array<{ zh: string; en: string }>;
};

type ProfileOrganization = {
  id: string;
  name: string;
  role: { zh: string; en: string };
};

const profileProjects: Record<string, ProfileProject[]> = {
  mira: [
    {
      id: 'wildcraft',
      type: 'mods',
      name: { zh: '荒野工艺', en: 'Wildcraft' },
      description: { zh: '扩展野外采集、制作与生存路线。', en: 'Expands gathering, crafting, and survival paths.' },
      tags: [{ zh: '生存', en: 'Survival' }, { zh: '社区创作', en: 'Community' }]
    }
  ],
  stoneworks: [
    {
      id: 'mechanical-expansion',
      type: 'mods',
      name: { zh: '机械扩展', en: 'Mechanical Expansion' },
      description: { zh: '为风车、齿轮和自动化设备加入新的组合与升级选项。', en: 'Adds new combinations and upgrades for windmills, gears, and automation.' },
      tags: [{ zh: '自动化', en: 'Automation' }, { zh: '双端', en: 'Client + server' }]
    }
  ],
  'lumen-team': [
    {
      id: 'ancient-ruins',
      type: 'mods',
      name: { zh: '远古遗迹', en: 'Ancient Ruins' },
      description: { zh: '在世界各处加入可探索的遗迹、谜题和奖励。', en: 'Introduces explorable ruins, puzzles, and rewards.' },
      tags: [{ zh: '探索', en: 'Exploration' }, { zh: '多人', en: 'Multiplayer' }]
    }
  ]
};

const profileOrganizations: Record<string, ProfileOrganization> = {
  mira: {
    id: 'stoneworks',
    name: 'Stoneworks',
    role: { zh: '成员', en: 'Member' }
  }
};

const copy = {
  'zh-CN': {
    projectsTitle: '公开项目',
    organization: '组织',
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
    noProjects: '该分类暂无公开项目。',
    placeholder: '相关内容接入后将在这里显示。'
  },
  en: {
    projectsTitle: 'Public projects',
    organization: 'Organization',
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
    noProjects: 'No public projects in this category yet.',
    placeholder: 'Related content will appear here when connected.'
  }
} as const;

function displayName(id: string): string {
  return id
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function AccountPreviewPage({ kind, id }: AccountPreviewPageProps) {
  const language = useSiteLanguage();
  const text = copy[language];
  const name = displayName(id);
  const [projectType, setProjectType] = useState<ProjectType>('mods');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const projectTabs: Array<{ id: ProjectType; label: string }> = [
    { id: 'mods', label: text.mods },
    { id: 'theme-pack', label: text.themePacks },
    { id: 'modpacks', label: text.modpacks },
    { id: 'server', label: text.serverTweaks }
  ];
  const visibleProjects = (profileProjects[id] ?? []).filter((project) => project.type === projectType);
  const projectCount = (profileProjects[id] ?? []).length;
  const organization = kind === 'user' ? profileOrganizations[id] : undefined;

  return (
    <section className="profile-page" aria-labelledby="profile-title">
      <div className="profile-page__inner">
        <header className="profile-hero">
          <div className="profile-avatar">
            <img src="/brand/logo-icon-rounded.svg" alt="" />
          </div>
          <div className="profile-hero__copy">
            <h1 id="profile-title">{name}</h1>
            <p>{text.placeholder}</p>
            <dl className="profile-project-stats">
              <div>
                <dt aria-label={text.projectCount}><FolderKanban size={16} strokeWidth={1.9} aria-hidden="true" /></dt>
                <dd>{projectCount}</dd>
              </div>
              <div>
                <dt aria-label={text.downloads}><Download size={16} strokeWidth={1.9} aria-hidden="true" /></dt>
                <dd>{projectCount > 0 ? '128.4K' : '0'}</dd>
              </div>
              <div>
                <dt aria-label={text.followers}><Heart size={16} strokeWidth={1.9} aria-hidden="true" /></dt>
                <dd>{projectCount > 0 ? '2.8K' : '0'}</dd>
              </div>
            </dl>
          </div>
        </header>

        <div className={organization ? 'profile-content-layout profile-content-layout--with-sidebar' : 'profile-content-layout'}>
          <div className="profile-projects">
          <div className="content-toolbar profile-project-toolbar">
            <nav className="content-switcher" aria-label={text.contentNavigation}>
              {projectTabs.map((tab) => (
                <button
                  className={projectType === tab.id ? 'content-switcher__item content-switcher__item--active' : 'content-switcher__item'}
                  key={tab.id}
                  type="button"
                  aria-pressed={projectType === tab.id}
                  onClick={() => setProjectType(tab.id)}
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
              <button className="content-pagination__button" type="button" title={text.previousPage} aria-label={text.previousPage} disabled>
                <ChevronLeft size={17} strokeWidth={1.8} aria-hidden="true" />
              </button>
              <span className="content-pagination__current" aria-current="page">1</span>
              <button className="content-pagination__button" type="button" title={text.nextPage} aria-label={text.nextPage} disabled>
                <ChevronRight size={17} strokeWidth={1.8} aria-hidden="true" />
              </button>
            </div>
          </div>

            <div className={`content-cards content-cards--${viewMode} profile-projects__content`} data-project-type={projectType} aria-label={text.projectsTitle}>
              {visibleProjects.length > 0 ? visibleProjects.map((project) => {
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
                            <span className="content-card__author">by {name}</span>
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

          {organization ? (
            <aside className="profile-organization-card">
              <div className="preview-owner-card__heading">
                <h2>{text.organization}</h2>
              </div>
              <Link className="preview-owner-card__identity" href={`/organization/${organization.id}`}>
                <span className="preview-owner-card__avatar">
                  <img src="/brand/logo-icon-rounded.svg" alt="" />
                </span>
                <span className="preview-owner-card__name">
                  <strong>{organization.name}</strong>
                  <span>{language === 'en' ? organization.role.en : organization.role.zh}</span>
                </span>
              </Link>
            </aside>
          ) : null}
        </div>
      </div>
    </section>
  );
}
