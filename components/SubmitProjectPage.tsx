'use client';

import { Check, ChevronDown, CircleAlert, FileText, FolderKanban, Info, LoaderCircle, LockKeyhole, Package, Plus, Tag, UsersRound } from 'lucide-react';
import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { useSiteLanguage } from '@/components/SiteLanguageContext';
import type { SessionAccountSummary } from '@/lib/auth-server';
import { ensureCsrfToken } from '@/lib/client-confirmation';
import { clearProjectDraft, readProjectDraft, type ProjectDraft, type ProjectDraftType } from '@/lib/project-draft';

type Props = { sessionAccount?: SessionAccountSummary | null };
type Organization = { id: string; slug: string; name: string; role?: string };

const projectTypes: Array<{ value: ProjectDraftType; zh: string; en: string }> = [
  { value: 'mod', zh: '模组', en: 'Mod' },
  { value: 'modpack', zh: '整合包', en: 'Modpack' },
  { value: 'theme-pack', zh: '主题包', en: 'Theme pack' },
  { value: 'server', zh: '服务器调整', en: 'Server tweak' }
];

const copy = {
  'zh-CN': {
    title: '投稿项目', subtitle: '完善公开资料后创建项目，版本、文件和截图将在项目管理页继续添加。', account: '投稿账号', basics: '基本资料', basicsDescription: '这些信息会作为项目公开目录的第一条记录。', metadata: '分类与兼容性', metadataDescription: '可选信息可用于目录搜索与筛选。', required: '必填项', type: '项目类型', owner: '所有者', personal: '个人项目', name: '项目名称', nameEn: '英文名称', slug: '项目 URL', summary: '项目简介', summaryEn: '英文简介', visibility: '可见性', public: '公开', private: '私有', tags: '标签', categories: '分类', gameVersions: '游戏版本', environments: '运行环境', commaHint: '多个值请使用逗号分隔。', slugHint: '仅使用小写字母、数字和连字符；保存时会自动规范化。', draft: '已带入顶部创建窗口中的草稿，可继续补充或修改。', create: '创建项目', creating: '正在创建…', reset: '清除草稿', success: '项目已创建，正在进入管理页…', signInTitle: '登录后才能投稿', signInDescription: '项目创建需要有效的站点账号和已绑定的 VintageStory 官方身份。', officialTitle: '需要绑定 VintageStory 官方身份', officialDescription: '当前账号可以浏览内容，但不能创建项目或组织。请在登录菜单中绑定官方游戏账号。', checklistTitle: '发布前检查', checklist: ['确认项目名称与 URL 不重复', '公开项目资料不含敏感信息', '版本文件会在项目管理页进行审核'], metadataTitle: '投稿信息', ownerHint: '组织项目会再次检查你的组织角色。', error: '创建项目失败。', back: '返回我的项目', goSignIn: '前往登录', profile: '前往个人主页'
  },
  en: {
    title: 'Submit a project', subtitle: 'Complete the public project record here. Releases, files, and screenshots are managed after creation.', account: 'Submitting account', basics: 'Project basics', basicsDescription: 'These fields create the project record shown in the public directory.', metadata: 'Taxonomy and compatibility', metadataDescription: 'Optional fields improve directory search and filtering.', required: 'Required', type: 'Project type', owner: 'Owner', personal: 'Personal project', name: 'Project name', nameEn: 'English name', slug: 'Project URL', summary: 'Summary', summaryEn: 'English summary', visibility: 'Visibility', public: 'Public', private: 'Private', tags: 'Tags', categories: 'Categories', gameVersions: 'Game versions', environments: 'Environments', commaHint: 'Separate multiple values with commas.', slugHint: 'Use lowercase letters, digits, and hyphens. It is normalized when saved.', draft: 'The draft from the create dialog is loaded. You can finish or revise it here.', create: 'Create project', creating: 'Creating…', reset: 'Clear draft', success: 'Project created. Opening project management…', signInTitle: 'Sign in to submit', signInDescription: 'Project creation requires a site account with a linked official Vintage Story identity.', officialTitle: 'Link an official Vintage Story identity', officialDescription: 'This account can browse content but cannot create projects or organizations. Link the official game account from the sign-in menu.', checklistTitle: 'Before publishing', checklist: ['Confirm the project name and URL are unique', 'Do not place sensitive information in public metadata', 'Release files are reviewed in project management'], metadataTitle: 'Submission details', ownerHint: 'Organization ownership is checked against your current organization role.', error: 'Unable to create project.', back: 'Back to my projects', goSignIn: 'Go to sign in', profile: 'Open profile'
  }
} as const;

function splitValues(value: string): string[] {
  return value.split(/[,，]/).map((item) => item.trim()).filter(Boolean);
}

function slugify(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 100);
}

function emptyDraft(): ProjectDraft {
  return { type: 'mod', name: '', slug: '', summary: '', visibility: 'public', owner: { type: 'personal' } };
}

export function SubmitProjectPage({ sessionAccount = null }: Props) {
  const language = useSiteLanguage();
  const text = copy[language];
  const [draft, setDraft] = useState<ProjectDraft>(emptyDraft);
  const [nameEn, setNameEn] = useState('');
  const [summaryEn, setSummaryEn] = useState('');
  const [tags, setTags] = useState('');
  const [categories, setCategories] = useState('');
  const [gameVersions, setGameVersions] = useState('');
  const [environments, setEnvironments] = useState('');
  const [organizations, setOrganizations] = useState<Organization[]>(sessionAccount?.organizationDetails ?? []);
  const [loadedDraft, setLoadedDraft] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const stored = readProjectDraft();
    if (stored) {
      setDraft(stored);
      setLoadedDraft(true);
    }
  }, []);

  useEffect(() => {
    if (!sessionAccount) return;
    const controller = new AbortController();
    fetch('/api/v1/me/profile', { cache: 'no-store', signal: controller.signal }).then(async (response) => {
      const payload = await response.json().catch(() => ({})) as { data?: { organizations?: Organization[]; ownedOrganizations?: Organization[] } };
      if (!response.ok || !payload.data) return;
      const entries = [
        ...(payload.data.organizations ?? []),
        ...(payload.data.ownedOrganizations ?? []).map((organization) => ({ ...organization, role: 'owner' }))
      ];
      setOrganizations(entries.filter((entry, index, list) => Boolean(entry.slug) && list.findIndex((candidate) => candidate.slug === entry.slug) === index));
    }).catch(() => undefined);
    return () => controller.abort();
  }, [sessionAccount]);

  const owner = draft.owner;
  const ownerValue = owner.type === 'organization' ? `organization:${owner.id}` : 'personal';
  const eligibleOrganizations = useMemo(() => organizations.filter((organization) => ['owner', 'admin', 'maintainer'].includes(organization.role?.toLowerCase() ?? '')), [organizations]);
  const ownerName = owner.type === 'organization'
    ? organizations.find((organization) => organization.slug === owner.id)?.name ?? owner.id
    : text.personal;

  function updateDraft(update: Partial<ProjectDraft>) {
    setDraft((current) => ({ ...current, ...update }));
  }

  function clearDraft() {
    clearProjectDraft();
    setDraft(emptyDraft());
    setLoadedDraft(false);
    setNameEn('');
    setSummaryEn('');
    setTags('');
    setCategories('');
    setGameVersions('');
    setEnvironments('');
    setError('');
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!sessionAccount?.hasOfficialIdentity) return;
    setSaving(true);
    setError('');
    try {
      const csrf = await ensureCsrfToken();
      const response = await fetch('/api/v1/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(csrf ? { 'x-csrf-token': decodeURIComponent(csrf) } : {}) },
        body: JSON.stringify({
          type: draft.type,
          name: draft.name,
          nameEn: nameEn.trim() || undefined,
          slug: draft.slug,
          summary: draft.summary,
          summaryEn: summaryEn.trim() || undefined,
          visibility: draft.visibility,
          tags: splitValues(tags),
          categories: splitValues(categories),
          gameVersions: splitValues(gameVersions),
          environments: splitValues(environments),
          owner: draft.owner
        })
      });
      const payload = await response.json().catch(() => ({})) as { data?: { slug: string }; error?: { message?: string } };
      if (!response.ok || !payload.data) throw new Error(payload.error?.message ?? text.error);
      const project = payload.data;
      clearProjectDraft();
      setSuccess(true);
      window.setTimeout(() => window.location.assign(`/projects/${encodeURIComponent(project.slug)}/manage`), 550);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : text.error);
    } finally {
      setSaving(false);
    }
  }

  if (!sessionAccount) {
    return <section className="workspace-page submit-page"><div className="workspace-page__inner submit-page__inner"><div className="admin-panel submit-auth-required"><span className="submit-auth-required__icon"><LockKeyhole size={25} /></span><h2>{text.signInTitle}</h2><p>{text.signInDescription}</p><a className="admin-button admin-button--primary" href="/">{text.goSignIn}</a></div></div></section>;
  }

  if (!sessionAccount.hasOfficialIdentity) {
    return <section className="workspace-page submit-page"><div className="workspace-page__inner submit-page__inner"><div className="admin-panel submit-auth-required"><span className="submit-auth-required__icon"><CircleAlert size={25} /></span><h2>{text.officialTitle}</h2><p>{text.officialDescription}</p><a className="admin-button" href={`/user/${encodeURIComponent(sessionAccount.username)}`}>{text.profile}</a></div></div></section>;
  }

  return <section className="workspace-page submit-page"><div className="workspace-page__inner submit-page__inner">
    <header className="workspace-page__header submit-page__heading"><div><h1>{text.title}</h1><p className="submit-panel__description">{text.subtitle}</p></div><div className="submit-page__account"><span>{text.account}</span><strong>{sessionAccount.displayName || sessionAccount.username}</strong></div></header>
    <form className="submit-layout" onSubmit={submit}>
      <div className="submit-main">
        <section className="admin-panel submit-panel"><header className="admin-panel__heading"><div><h2>{text.basics}</h2><p className="submit-panel__description">{text.basicsDescription}</p></div><span className="submit-required-hint">{text.required}</span></header><div className="admin-form-grid">
          <fieldset className="submit-field--full"><legend>{text.type}</legend><div className="submit-type-options">{projectTypes.map((type) => <label className="submit-type-option" key={type.value}><input type="radio" name="type" value={type.value} checked={draft.type === type.value} onChange={() => updateDraft({ type: type.value })} /><span className="submit-type-option__mark"><Check size={13} /></span><span>{language === 'en' ? type.en : type.zh}</span></label>)}</div></fieldset>
          <label className="admin-field"><span>{text.name}</span><span className="submit-input-with-icon"><Package size={16} /><input value={draft.name} onChange={(event) => updateDraft({ name: event.target.value })} maxLength={120} required autoFocus /></span></label>
          <label className="admin-field"><span>{text.nameEn}</span><span className="submit-input-with-icon"><Package size={16} /><input value={nameEn} onChange={(event) => setNameEn(event.target.value)} maxLength={120} /></span></label>
          <label className="admin-field"><span>{text.slug}</span><span className="submit-input-with-icon"><FolderKanban size={16} /><input value={draft.slug} onChange={(event) => updateDraft({ slug: slugify(event.target.value) })} maxLength={100} pattern="[a-z0-9][a-z0-9-]*" required /></span><small className="submit-field__hint">{text.slugHint}</small></label>
          <label className="admin-field"><span>{text.owner}</span><span className="submit-select-wrap"><select value={ownerValue} onChange={(event) => updateDraft({ owner: event.target.value === 'personal' ? { type: 'personal' } : { type: 'organization', id: event.target.value.slice('organization:'.length) } })}><option value="personal">{text.personal}</option>{eligibleOrganizations.map((organization) => <option key={organization.slug} value={`organization:${organization.slug}`}>{organization.name}</option>)}</select><ChevronDown size={16} /></span><small className="submit-field__hint">{text.ownerHint}</small></label>
          <label className="admin-field admin-field--full"><span>{text.summary}</span><textarea value={draft.summary} onChange={(event) => updateDraft({ summary: event.target.value })} maxLength={500} rows={4} required /></label>
          <label className="admin-field admin-field--full"><span>{text.summaryEn}</span><textarea value={summaryEn} onChange={(event) => setSummaryEn(event.target.value)} maxLength={500} rows={3} /></label>
          <fieldset className="submit-field--full"><legend>{text.visibility}</legend><div className="submit-type-options"><label className="submit-type-option"><input type="radio" name="visibility" checked={draft.visibility === 'public'} onChange={() => updateDraft({ visibility: 'public' })} /><span className="submit-type-option__mark"><Check size={13} /></span><span>{text.public}</span></label><label className="submit-type-option"><input type="radio" name="visibility" checked={draft.visibility === 'private'} onChange={() => updateDraft({ visibility: 'private' })} /><span className="submit-type-option__mark"><Check size={13} /></span><span>{text.private}</span></label></div></fieldset>
        </div></section>
        <section className="admin-panel submit-panel"><header className="admin-panel__heading"><div><h2>{text.metadata}</h2><p className="submit-panel__description">{text.metadataDescription}</p></div></header><div className="admin-form-grid">
          <label className="admin-field"><span>{text.tags}</span><span className="submit-input-with-icon"><Tag size={16} /><input value={tags} onChange={(event) => setTags(event.target.value)} maxLength={600} /></span></label>
          <label className="admin-field"><span>{text.categories}</span><span className="submit-input-with-icon"><FolderKanban size={16} /><input value={categories} onChange={(event) => setCategories(event.target.value)} maxLength={600} /></span></label>
          <label className="admin-field"><span>{text.gameVersions}</span><input value={gameVersions} onChange={(event) => setGameVersions(event.target.value)} maxLength={600} /></label>
          <label className="admin-field"><span>{text.environments}</span><input value={environments} onChange={(event) => setEnvironments(event.target.value)} maxLength={600} /></label>
          <p className="submit-form-info submit-field--full"><Info size={16} />{text.commaHint}</p>
        </div></section>
        {loadedDraft ? <p className="submit-draft-notice"><FileText size={16} />{text.draft}</p> : null}
        {error ? <p className="submit-feedback submit-feedback--error" role="alert"><CircleAlert size={16} />{error}</p> : null}
        {success ? <p className="submit-feedback submit-feedback--success" role="status"><Check size={16} />{text.success}</p> : null}
        <div className="submit-actions"><div className="submit-actions__secondary"><button className="submit-clear-button" type="button" disabled={saving} onClick={clearDraft}>{text.reset}</button></div><div className="submit-actions__primary"><a className="admin-button" href="/projects">{text.back}</a><button className="admin-button admin-button--primary" type="submit" disabled={saving || success}>{saving ? <LoaderCircle className="submit-spinner" size={16} /> : <Plus size={16} />}{saving ? text.creating : text.create}</button></div></div>
      </div>
      <aside className="submit-sidebar"><section className="admin-panel submit-side-panel"><header className="admin-panel__heading"><h2>{text.checklistTitle}</h2></header><ul className="submit-checklist">{text.checklist.map((item) => <li key={item}><Check size={16} />{item}</li>)}</ul></section><section className="admin-panel submit-side-panel"><header className="admin-panel__heading"><h2>{text.metadataTitle}</h2></header><dl className="submit-meta-list"><div><dt>{text.account}</dt><dd>{sessionAccount.username}</dd></div><div><dt>{text.owner}</dt><dd>{ownerName}</dd></div></dl></section><p className="submit-side-tip"><UsersRound size={17} />{text.ownerHint}</p></aside>
    </form>
  </div></section>;
}
