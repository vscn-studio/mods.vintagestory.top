'use client';

import { ArrowLeft, CalendarDays, Copy, Download, EllipsisVertical, Flag, Heart, MessageSquare, Package, Settings2 } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useSiteLanguage } from '@/components/SiteLanguageContext';

type ContentPreviewPageProps = {
  kind: 'mod' | 'modpack';
  id: string;
};

type PreviewMember = {
  id: string;
  name: string;
  role: { zh: string; en: string };
};

type PreviewContent = {
  name: { zh: string; en: string };
  author: string;
  authorType: 'user' | 'organization';
  authorId: string;
  description: { zh: string; en: string };
  members?: PreviewMember[];
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
    changelog: '更新记录',
    compatibility: '兼容性',
    projectInfo: '项目信息',
    tags: '标签',
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
    changelog: 'Changelog',
    compatibility: 'Compatibility',
    projectInfo: 'Project information',
    tags: 'Tags',
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
  const moreMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!moreMenuRef.current?.contains(event.target as Node)) setIsMoreOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsMoreOpen(false);
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

        <div className="preview-layout">
          <main className="preview-main">
            <section className="preview-section">
              <div className="preview-section__heading">
                <h2>{text.description}</h2>
                <MessageSquare size={18} strokeWidth={1.8} aria-hidden="true" />
              </div>
              <p>{description}</p>
              <p>{text.placeholder}</p>
            </section>
            <section className="preview-section">
              <div className="preview-section__heading">
                <h2>{text.changelog}</h2>
                <CalendarDays size={18} strokeWidth={1.8} aria-hidden="true" />
              </div>
              <div className="preview-placeholder">{text.placeholder}</div>
            </section>
          </main>

          <aside className="preview-sidebar">
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
                <h2>{text.compatibility}</h2>
                <Settings2 size={17} strokeWidth={1.8} aria-hidden="true" />
              </div>
              <p>{text.placeholder}</p>
            </section>
            <section className="preview-sidebar__section">
              <div className="preview-section__heading">
                <h2>{text.projectInfo}</h2>
                <Package size={17} strokeWidth={1.8} aria-hidden="true" />
              </div>
              <p>{text.placeholder}</p>
            </section>
          </aside>
        </div>
      </div>
    </section>
  );
}
