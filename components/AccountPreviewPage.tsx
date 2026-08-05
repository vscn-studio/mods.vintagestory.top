'use client';

import { ArrowLeft, FolderKanban, Package, Settings, UsersRound } from 'lucide-react';
import Link from 'next/link';
import { useSiteLanguage } from '@/components/SiteLanguageContext';

type AccountPreviewPageProps = {
  kind: 'user' | 'organization';
  id: string;
};

const copy = {
  'zh-CN': {
    back: '返回内容',
    userEyebrow: '用户首页',
    organizationEyebrow: '组织首页',
    projects: '项目',
    followers: '关注者',
    joined: '加入时间',
    projectsTitle: '公开项目',
    activityTitle: '最近动态',
    settings: '页面设置',
    placeholder: '相关内容接入后将在这里显示。',
    joinedValue: '2026 年',
    projectCount: '0',
    followerCount: '0'
  },
  en: {
    back: 'Back to content',
    userEyebrow: 'User profile',
    organizationEyebrow: 'Organization profile',
    projects: 'Projects',
    followers: 'Followers',
    joined: 'Joined',
    projectsTitle: 'Public projects',
    activityTitle: 'Recent activity',
    settings: 'Page settings',
    placeholder: 'Related content will appear here when connected.',
    joinedValue: '2026',
    projectCount: '0',
    followerCount: '0'
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

  return (
    <section className="profile-page" aria-labelledby="profile-title">
      <div className="profile-page__inner">
        <Link className="preview-page__back" href="/mods">
          <ArrowLeft size={17} strokeWidth={1.9} aria-hidden="true" />
          <span>{text.back}</span>
        </Link>

        <header className="profile-hero">
          <div className="profile-avatar">
            <img src="/brand/logo-icon-rounded.svg" alt="" />
          </div>
          <div className="profile-hero__copy">
            <span className="preview-eyebrow">{kind === 'organization' ? text.organizationEyebrow : text.userEyebrow}</span>
            <h1 id="profile-title">{name}</h1>
            <p>{text.placeholder}</p>
          </div>
          <button className="preview-action" type="button">
            <Settings size={17} strokeWidth={1.9} aria-hidden="true" />
            <span>{text.settings}</span>
          </button>
        </header>

        <dl className="profile-stats">
          <div><dt>{text.projects}</dt><dd>{text.projectCount}</dd></div>
          <div><dt>{text.followers}</dt><dd>{text.followerCount}</dd></div>
          <div><dt>{text.joined}</dt><dd>{text.joinedValue}</dd></div>
        </dl>

        <div className="profile-layout">
          <section className="profile-section">
            <div className="preview-section__heading">
              <h2>{text.projectsTitle}</h2>
              {kind === 'organization' ? <UsersRound size={18} strokeWidth={1.8} aria-hidden="true" /> : <FolderKanban size={18} strokeWidth={1.8} aria-hidden="true" />}
            </div>
            <div className="preview-placeholder">{text.placeholder}</div>
          </section>
          <section className="profile-section">
            <div className="preview-section__heading">
              <h2>{text.activityTitle}</h2>
              <Package size={18} strokeWidth={1.8} aria-hidden="true" />
            </div>
            <div className="preview-placeholder">{text.placeholder}</div>
          </section>
        </div>
      </div>
    </section>
  );
}
