'use client';

import { Bell, Check, FolderKanban, Heart, LoaderCircle, LogOut, Monitor, Save, Settings, UsersRound, X } from 'lucide-react';
import Link from 'next/link';
import { type FormEvent, useEffect, useState } from 'react';
import { useSiteLanguage } from '@/components/SiteLanguageContext';
import type { SessionAccountSummary } from '@/lib/auth-server';
import { ensureCsrfToken } from '@/lib/client-confirmation';

type WorkspaceKind = 'settings' | 'notifications' | 'favorites' | 'follows' | 'projects' | 'organizations';
type Props = { kind: WorkspaceKind; sessionAccount?: SessionAccountSummary | null };
type Viewer = { role?: string | null; capabilities?: string[] };
type Project = {
  id: string;
  slug: string;
  type: string;
  name: { zh: string; en: string };
  summary: { zh: string; en: string };
  stats?: { downloads: number; followers: number };
  updatedAt: string;
  viewer?: Viewer;
};
type Notification = { id: string; type: string; payload: Record<string, unknown>; read: boolean; createdAt: string; title?: string; description?: string; href?: string | null };
type Invitation = { id: string; role: string; expiresAt: string; createdAt: string; organization: { id: string; slug: string; name: string }; invitedBy: { username: string; displayName: string } };
type BrowserSession = { id: string; createdAt: string; lastSeenAt: string; expiresAt: string; userAgent?: string | null; ipAddress?: string | null; current: boolean };
type Organization = {
  id: string;
  slug: string;
  name: string;
  members?: Array<{ id: string; name: string; role: string }>;
  projects?: Array<{ id: string; slug: string; name: string; type: string }>;
  viewer?: Viewer;
};

const copy = {
  'zh-CN': {
    settings: '账户设置', notifications: '消息提醒', favorites: '我的收藏', follows: '我的关注', projects: '我的项目', organizations: '组织管理',
    save: '保存', saved: '已保存', noData: '暂无数据。', loading: '正在加载…', error: '加载失败。', retry: '重试',
    displayName: '显示名称', bio: '个人介绍', markAll: '全部标为已读', markRead: '标为已读', unread: '未读', invitations: '组织邀请',
    invitedBy: '邀请人', accept: '接受', decline: '拒绝', members: '成员', projectCount: '项目', open: '打开', manage: '管理', signIn: '请先登录。',
    sessions: '登录会话', currentSession: '当前会话', revoke: '撤销', revokeAll: '退出所有会话', revokeAllConfirm: '这会使当前设备也退出登录。是否继续？', revokeConfirm: '确定撤销这个登录会话吗？', sessionCreated: '登录于', sessionLastSeen: '最近活动', sessionError: '会话操作失败。', notificationFallback: '新的站内通知', followHint: '关注的项目会在有新版本或动态时出现在通知中。'
  },
  en: {
    settings: 'Account settings', notifications: 'Notifications', favorites: 'Favorites', follows: 'Following', projects: 'My projects', organizations: 'Organizations',
    save: 'Save', saved: 'Saved', noData: 'No data yet.', loading: 'Loading…', error: 'Unable to load data.', retry: 'Retry',
    displayName: 'Display name', bio: 'Bio', markAll: 'Mark all as read', markRead: 'Mark read', unread: 'Unread', invitations: 'Organization invitations',
    invitedBy: 'Invited by', accept: 'Accept', decline: 'Decline', members: 'members', projectCount: 'projects', open: 'Open', manage: 'Manage', signIn: 'Sign in first.',
    sessions: 'Signed-in sessions', currentSession: 'Current session', revoke: 'Revoke', revokeAll: 'Sign out everywhere', revokeAllConfirm: 'This also signs out this device. Continue?', revokeConfirm: 'Revoke this signed-in session?', sessionCreated: 'Signed in', sessionLastSeen: 'Last active', sessionError: 'Unable to update sessions.', notificationFallback: 'New site notification', followHint: 'Projects you follow can send release and activity notifications here.'
  }
} as const;

async function csrf(): Promise<Record<string, string>> {
  const token = await ensureCsrfToken();
  return token ? { 'x-csrf-token': decodeURIComponent(token) } : {};
}

function projectHref(project: Project): string {
  return project.type === 'modpack' ? `/modpack/${encodeURIComponent(project.slug)}` : `/mod/${encodeURIComponent(project.slug)}`;
}

function canManageProject(project: Project): boolean {
  return project.viewer?.capabilities?.some((capability) => ['update', 'member.manage', 'transfer', 'archive', 'release.create', 'release.publish', 'file.manage'].includes(capability)) ?? false;
}

function canManageOrganization(organization: Organization): boolean {
  return organization.viewer?.capabilities?.includes('manage') ?? false;
}

function dateTime(value: string): string {
  try { return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)); } catch { return value; }
}

export function WorkspacePage({ kind, sessionAccount = null }: Props) {
  const language = useSiteLanguage();
  const text = copy[language];
  const [projects, setProjects] = useState<Project[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [sessions, setSessions] = useState<BrowserSession[]>([]);
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [busyId, setBusyId] = useState('');
  const [refresh, setRefresh] = useState(0);
  const title = text[kind];

  useEffect(() => {
    if (!sessionAccount) {
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    const endpoint = kind === 'settings'
      ? '/api/v1/me/profile'
      : kind === 'notifications'
        ? '/api/v1/notifications?pageSize=60'
        : kind === 'favorites'
          ? '/api/v1/me/favorites?pageSize=60'
          : kind === 'follows'
            ? '/api/v1/me/follows?pageSize=60'
            : kind === 'projects'
              ? '/api/v1/projects?mine=true&pageSize=60'
              : '/api/v1/organizations?mine=true&pageSize=60';
    setLoading(true);
    setError('');

    async function load() {
      const response = await fetch(endpoint, { cache: 'no-store', signal: controller.signal });
      const payload = await response.json().catch(() => ({})) as { data?: unknown; error?: { message?: string } };
      if (!response.ok) throw new Error(payload.error?.message ?? text.error);
      if (kind === 'settings') {
        const item = payload.data as { displayName: string; bio: string };
        setDisplayName(item.displayName);
        setBio(item.bio);
        const sessionResponse = await fetch('/api/v1/me/sessions', { cache: 'no-store', signal: controller.signal });
        const sessionPayload = await sessionResponse.json().catch(() => ({})) as { data?: BrowserSession[]; error?: { message?: string } };
        if (!sessionResponse.ok) throw new Error(sessionPayload.error?.message ?? text.error);
        setSessions(sessionPayload.data ?? []);
      } else if (kind === 'notifications') {
        setNotifications((payload.data as Notification[]) ?? []);
        const invitationResponse = await fetch('/api/v1/organization-invitations?pageSize=60', { cache: 'no-store', signal: controller.signal });
        const invitationPayload = await invitationResponse.json().catch(() => ({})) as { data?: Invitation[]; error?: { message?: string } };
        if (!invitationResponse.ok) throw new Error(invitationPayload.error?.message ?? text.error);
        setInvitations(invitationPayload.data ?? []);
      } else if (kind === 'organizations') {
        setOrganizations((payload.data as Organization[]) ?? []);
      } else {
        setProjects((payload.data as Project[]) ?? []);
      }
    }

    void load().catch((reason: unknown) => {
      if (reason instanceof DOMException && reason.name === 'AbortError') return;
      setError(reason instanceof Error ? reason.message : text.error);
    }).finally(() => setLoading(false));
    return () => controller.abort();
  }, [kind, refresh, sessionAccount, text.error]);

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaved(false);
    const response = await fetch('/api/v1/me/profile', { method: 'PATCH', headers: { 'Content-Type': 'application/json', ...(await csrf()) }, body: JSON.stringify({ displayName: displayName.trim(), bio }) });
    const payload = await response.json().catch(() => ({})) as { error?: { message?: string } };
    if (!response.ok) {
      setError(payload.error?.message ?? text.error);
      return;
    }
    setSaved(true);
  }

  async function markRead(id?: string) {
    const response = await fetch('/api/v1/notifications', { method: 'PATCH', headers: { 'Content-Type': 'application/json', ...(await csrf()) }, body: JSON.stringify(id ? { id } : { all: true }) });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({})) as { error?: { message?: string } };
      setError(payload.error?.message ?? text.error);
      return;
    }
    setNotifications((items) => items.map((item) => !id || item.id === id ? { ...item, read: true } : item));
  }

  async function respondToInvitation(id: string, action: 'accept' | 'decline') {
    setBusyId(id);
    const response = await fetch(`/api/v1/organization-invitations/${encodeURIComponent(id)}?action=${action}`, { method: 'POST', headers: await csrf() });
    const payload = await response.json().catch(() => ({})) as { error?: { message?: string } };
    setBusyId('');
    if (!response.ok) {
      setError(payload.error?.message ?? text.error);
      return;
    }
    setInvitations((items) => items.filter((item) => item.id !== id));
    if (action === 'accept') setRefresh((value) => value + 1);
  }

  async function revokeSession(sessionId?: string) {
    if (!window.confirm(sessionId ? text.revokeConfirm : text.revokeAllConfirm)) return;
    setBusyId(sessionId ?? 'all');
    const suffix = sessionId ? `?id=${encodeURIComponent(sessionId)}` : '';
    const response = await fetch(`/api/v1/me/sessions${suffix}`, { method: 'DELETE', headers: await csrf() });
    const payload = await response.json().catch(() => ({})) as { error?: { message?: string } };
    setBusyId('');
    if (!response.ok) {
      setError(payload.error?.message ?? text.sessionError);
      return;
    }
    const revokedCurrent = !sessionId || sessions.some((session) => session.id === sessionId && session.current);
    if (revokedCurrent) window.location.assign('/');
    else setSessions((items) => items.filter((session) => session.id !== sessionId));
  }

  if (!sessionAccount) return <section className="workspace-page"><div className="workspace-page__inner"><h1>{title}</h1><p>{text.signIn}</p></div></section>;

  const body = loading ? (
    <p className="workspace-page__state"><LoaderCircle className="content-browser__spinner" size={20} />{text.loading}</p>
  ) : error ? (
    <div className="workspace-page__state"><p>{error}</p><button className="auth-code-button" type="button" onClick={() => setRefresh((value) => value + 1)}>{text.retry}</button></div>
  ) : kind === 'settings' ? (
    <div className="workspace-form">
      <form className="workspace-form" onSubmit={saveSettings}>
        <label className="auth-field"><span>{text.displayName}</span><span className="auth-input-wrap"><input value={displayName} onChange={(event) => setDisplayName(event.target.value)} maxLength={120} required /></span></label>
        <label className="auth-field"><span>{text.bio}</span><span className="auth-input-wrap profile-edit-textarea-wrap"><textarea value={bio} onChange={(event) => setBio(event.target.value)} rows={6} maxLength={2000} /></span></label>
        <button className="auth-modal__primary" type="submit"><Save size={17} /><span>{saved ? text.saved : text.save}</span></button>
      </form>
      <section className="management-section"><div className="workspace-list__toolbar"><h2>{text.sessions}</h2><button className="auth-code-button" type="button" disabled={!sessions.length || busyId === 'all'} onClick={() => void revokeSession()}><LogOut size={16} />{text.revokeAll}</button></div><div className="workspace-list">{sessions.length ? sessions.map((session) => <article className={session.current ? 'workspace-item workspace-item--unread' : 'workspace-item'} key={session.id}><strong><Monitor size={16} /> {session.current ? text.currentSession : session.userAgent || 'Browser'}</strong><time>{text.sessionCreated}: {dateTime(session.createdAt)} · {text.sessionLastSeen}: {dateTime(session.lastSeenAt)}{session.ipAddress ? ` · ${session.ipAddress}` : ''}</time><div className="workspace-list__actions"><button className="auth-code-button" type="button" disabled={busyId === session.id} onClick={() => void revokeSession(session.id)}><X size={16} />{text.revoke}</button></div></article>) : <p className="workspace-page__state">{text.noData}</p>}</div></section>
    </div>
  ) : kind === 'notifications' ? (
    <section className="workspace-list">
      <div className="workspace-list__toolbar"><strong>{notifications.filter((item) => !item.read).length} {text.unread}</strong><button className="auth-code-button" type="button" onClick={() => void markRead()}><Check size={16} />{text.markAll}</button></div>
      {invitations.length ? <section className="workspace-list__section"><h2>{text.invitations}</h2>{invitations.map((invitation) => <article className="workspace-item workspace-item--unread" key={invitation.id}><strong><Link href={`/organization/${encodeURIComponent(invitation.organization.slug)}`}>{invitation.organization.name}</Link></strong><time>{text.invitedBy}: {invitation.invitedBy.displayName} · {invitation.role}</time><div className="workspace-list__actions"><button className="auth-modal__primary" type="button" disabled={busyId === invitation.id} onClick={() => void respondToInvitation(invitation.id, 'accept')}><Check size={16} />{text.accept}</button><button className="auth-code-button" type="button" disabled={busyId === invitation.id} onClick={() => void respondToInvitation(invitation.id, 'decline')}><X size={16} />{text.decline}</button></div></article>)}</section> : null}
      {notifications.length ? notifications.map((item) => <article className={item.read ? 'workspace-item' : 'workspace-item workspace-item--unread'} key={item.id}><strong>{item.href ? <Link href={item.href} onClick={() => { if (!item.read) void markRead(item.id); }}>{item.title ?? text.notificationFallback}</Link> : item.title ?? text.notificationFallback}</strong><time>{dateTime(item.createdAt)}</time><p>{item.description ?? item.type}</p>{!item.read ? <div className="workspace-list__actions"><button className="auth-code-button" type="button" onClick={() => void markRead(item.id)}><Check size={16} />{text.markRead}</button></div> : null}</article>) : !invitations.length ? <p className="workspace-page__state">{text.noData}</p> : null}
    </section>
  ) : kind === 'organizations' ? (
    <section className="workspace-grid">{organizations.length ? organizations.map((organization) => <article className="workspace-card workspace-card--panel" key={organization.id}><Link className="workspace-card__title" href={`/organization/${encodeURIComponent(organization.slug)}`}>{organization.name}</Link><span>{organization.members?.length ?? 0} {text.members} · {organization.projects?.length ?? 0} {text.projectCount}</span><div className="workspace-card__actions"><Link href={`/organization/${encodeURIComponent(organization.slug)}`}>{text.open}</Link>{canManageOrganization(organization) ? <Link href={`/organization/${encodeURIComponent(organization.slug)}/manage`}>{text.manage}</Link> : null}</div></article>) : <p className="workspace-page__state">{text.noData}</p>}</section>
  ) : (
    <section className="workspace-grid">{projects.length ? projects.map((project) => <article className="workspace-card workspace-card--panel" key={project.id}><Link className="workspace-card__title" href={projectHref(project)}>{language === 'en' ? project.name.en : project.name.zh}</Link><span>{language === 'en' ? project.summary.en : project.summary.zh}</span><small>{project.stats?.downloads?.toLocaleString() ?? 0} downloads</small><div className="workspace-card__actions"><Link href={projectHref(project)}>{text.open}</Link>{canManageProject(project) ? <Link href={`/projects/${encodeURIComponent(project.slug)}/manage`}>{text.manage}</Link> : null}</div></article>) : <p className="workspace-page__state">{kind === 'follows' ? text.followHint : text.noData}</p>}</section>
  );

  return <section className="workspace-page" aria-labelledby="workspace-title"><div className="workspace-page__inner"><header className="workspace-page__header"><span className="workspace-page__icon" aria-hidden="true">{kind === 'settings' ? <Settings size={22} /> : kind === 'notifications' ? <Bell size={22} /> : kind === 'favorites' || kind === 'follows' ? <Heart size={22} /> : kind === 'projects' ? <FolderKanban size={22} /> : <UsersRound size={22} />}</span><h1 id="workspace-title">{title}</h1></header>{body}</div></section>;
}
