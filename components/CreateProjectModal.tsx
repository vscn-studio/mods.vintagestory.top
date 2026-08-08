'use client';

import {
  Link2,
  Package,
  Plus,
  X
} from 'lucide-react';
import { FormEvent, useEffect, useRef, useState } from 'react';
import { useSiteLanguage } from '@/components/SiteLanguageContext';
import type { ProjectDraft, ProjectDraftType, ProjectDraftVisibility } from '@/lib/project-draft';

type ProjectType = ProjectDraftType;
type ProjectOwner = 'personal' | `organization:${string}`;
type Visibility = ProjectDraftVisibility;

type CreateProjectModalProps = {
  username: string;
  avatarUrl?: string;
  organizations: Array<string | { id?: string; slug?: string; name?: string; avatarUrl?: string }>;
  onClose: () => void;
  onContinue: (draft: ProjectDraft) => void;
};

type LocalizedCopy = {
  zh: string;
  en: string;
};

type ProjectTypeOption = {
  value: ProjectType;
  label: LocalizedCopy;
};

type OwnerOption = {
  value: ProjectOwner;
  label: string;
  avatarUrl?: string;
};

const projectTypes: ProjectTypeOption[] = [
  { value: 'mod', label: { zh: '模组', en: 'Mod' } },
  { value: 'modpack', label: { zh: '整合包', en: 'Modpack' } },
  { value: 'theme-pack', label: { zh: '主题包', en: 'Theme pack' } },
  { value: 'server', label: { zh: '服务器调整', en: 'Server tweak' } }
];

const copy = {
  'zh-CN': {
    close: '关闭创建项目窗口',
    title: '创建项目',
    projectType: '类型',
    projectName: '名称',
    projectNamePlaceholder: '例如：Vintage Story 汉化包',
    projectUrl: 'URL链接',
    owner: '所有者',
    visibility: '可见性',
    public: '公开',
    private: '私有',
    overview: '概述',
    overviewPlaceholder: '用一两句话介绍这个项目。',
    cancel: '取消',
    create: '继续投稿',
    projectTypeRequired: '请选择项目类型。'
  },
  en: {
    close: 'Close create project dialog',
    title: 'Create project',
    projectType: 'Project type',
    projectName: 'Project name',
    projectNamePlaceholder: 'For example: Vintage Story localization',
    projectUrl: 'Project URL',
    owner: 'Owner',
    visibility: 'Visibility',
    public: 'Public',
    private: 'Private',
    overview: 'Overview',
    overviewPlaceholder: 'Describe this project in one or two sentences.',
    cancel: 'Cancel',
    create: 'Continue to submission',
    projectTypeRequired: 'Choose a project type.'
  }
} as const;

export function CreateProjectModal({ username, avatarUrl, organizations, onClose, onContinue }: CreateProjectModalProps) {
  const language = useSiteLanguage();
  const text = copy[language];
  const [projectType, setProjectType] = useState<ProjectType>('mod');
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [owner, setOwner] = useState<ProjectOwner>('personal');
  const [visibility, setVisibility] = useState<Visibility>('public');
  const [overview, setOverview] = useState('');
  const [error, setError] = useState('');
  const [isOwnerOpen, setIsOwnerOpen] = useState(false);
  const ownerMenuRef = useRef<HTMLDivElement>(null);
  const organizationOptions = organizations.reduce<Array<{ value: string; label: string; avatarUrl?: string }>>((result, organization) => {
    const value = typeof organization === 'string' ? organization.trim() : organization.slug ?? organization.id ?? organization.name ?? '';
    const label = typeof organization === 'string' ? organization.trim() : organization.name ?? organization.slug ?? organization.id ?? '';
    if (value && !result.some((item) => item.value === value)) result.push({ value, label, avatarUrl: typeof organization === 'string' ? undefined : organization.avatarUrl });
    return result;
  }, []);
  const ownerOptions: OwnerOption[] = [
    { value: 'personal', label: username, avatarUrl },
    ...organizationOptions.map((organization) => ({
      value: `organization:${organization.value}` as ProjectOwner,
      label: organization.label,
      avatarUrl: organization.avatarUrl
    }))
  ];
  const selectedOwner = ownerOptions.find((option) => option.value === owner) ?? ownerOptions[0];
  const projectUrlPrefix = `https://mods.vintagestory.top/${projectType === 'modpack' ? 'modpack' : 'mod'}/`;

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!ownerMenuRef.current?.contains(event.target as Node)) setIsOwnerOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      if (isOwnerOpen) {
        event.preventDefault();
        setIsOwnerOpen(false);
        return;
      }
      onClose();
    }
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOwnerOpen, onClose]);

  function createProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!projectType) {
      setError(text.projectTypeRequired);
      return;
    }
    setError('');
    const ownerId = owner.startsWith('organization:') ? owner.slice('organization:'.length) : '';
    onContinue({
      type: projectType,
      name: name.trim(),
      slug: url.trim(),
      summary: overview.trim(),
      visibility,
      owner: ownerId ? { type: 'organization', id: ownerId } : { type: 'personal' }
    });
  }

  return (
    <div
      className="auth-modal-backdrop"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section className="auth-modal create-project-modal" role="dialog" aria-modal="true" aria-labelledby="create-project-title">
        <button className="auth-modal__close" type="button" aria-label={text.close} onClick={onClose}>
          <X size={19} strokeWidth={1.8} aria-hidden="true" />
        </button>

        <>
            <div className="auth-modal__heading create-project-modal__heading">
              <h2 id="create-project-title">{text.title}</h2>
            </div>

            <form className="auth-form create-project-form" onSubmit={createProject}>
              <fieldset className="create-project-fieldset">
                <legend className="auth-field__label">{text.projectType}</legend>
                <nav className="content-switcher" aria-label={text.projectType}>
                  {projectTypes.map((item) => (
                    <button
                      className={projectType === item.value ? 'content-switcher__item content-switcher__item--active' : 'content-switcher__item'}
                      key={item.value}
                      type="button"
                      aria-pressed={projectType === item.value}
                      onClick={() => setProjectType(item.value)}
                    >
                      {language === 'en' ? item.label.en : item.label.zh}
                    </button>
                  ))}
                </nav>
              </fieldset>

              <label className="auth-field">
                <span>{text.projectName}</span>
                <span className="auth-input-wrap">
                  <Package size={17} strokeWidth={1.8} aria-hidden="true" />
                  <input value={name} onChange={(event) => setName(event.target.value)} placeholder={text.projectNamePlaceholder} maxLength={80} required autoFocus />
                </span>
              </label>

              <label className="auth-field">
                <span>{text.projectUrl}</span>
                <span className="auth-input-wrap create-project-url-wrap">
                  <Link2 size={17} strokeWidth={1.8} aria-hidden="true" />
                  <span className="create-project-url-prefix">{projectUrlPrefix}</span>
                  <input type="text" value={url} onChange={(event) => setUrl(event.target.value)} maxLength={80} required />
                </span>
              </label>

              <div className="create-project-owner-field">
                <span className="auth-field__label">{text.owner}</span>
                <div className="content-select-menu create-project-owner-menu" ref={ownerMenuRef}>
                  <button
                    className={isOwnerOpen ? 'content-select content-select--open' : 'content-select'}
                    type="button"
                    aria-haspopup="listbox"
                    aria-expanded={isOwnerOpen}
                    onClick={() => setIsOwnerOpen((open) => !open)}
                  >
                    <span className="content-select__value"><OwnerIdentity option={selectedOwner} /></span>
                  </button>
                  <div
                    className={isOwnerOpen ? 'content-select-popover content-select-popover--open' : 'content-select-popover'}
                    role="listbox"
                    aria-hidden={!isOwnerOpen}
                    aria-label={text.owner}
                  >
                    {ownerOptions.map((option) => (
                      <button
                        className="content-select-option create-project-owner-option"
                        key={option.value}
                        type="button"
                        role="option"
                        aria-selected={option.value === owner}
                        onClick={() => {
                          setOwner(option.value);
                          setError('');
                          setIsOwnerOpen(false);
                        }}
                      >
                        <OwnerIdentity option={option} />
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <fieldset className="create-project-fieldset">
                <legend className="auth-field__label">{text.visibility}</legend>
                <nav className="content-switcher" aria-label={text.visibility}>
                  <button
                    className={visibility === 'public' ? 'content-switcher__item content-switcher__item--active' : 'content-switcher__item'}
                    type="button"
                    aria-pressed={visibility === 'public'}
                    onClick={() => setVisibility('public')}
                  >
                    {text.public}
                  </button>
                  <button
                    className={visibility === 'private' ? 'content-switcher__item content-switcher__item--active' : 'content-switcher__item'}
                    type="button"
                    aria-pressed={visibility === 'private'}
                    onClick={() => setVisibility('private')}
                  >
                    {text.private}
                  </button>
                </nav>
              </fieldset>

              <label className="auth-field">
                <span>{text.overview}</span>
                <span className="auth-input-wrap create-project-textarea-wrap">
                  <textarea value={overview} onChange={(event) => setOverview(event.target.value)} placeholder={text.overviewPlaceholder} maxLength={300} rows={3} required />
                </span>
              </label>

              {error ? <p className="auth-form__error" role="alert">{error}</p> : null}
              <div className="create-project-form__actions">
                <button className="auth-code-button" type="button" onClick={onClose}>{text.cancel}</button>
                <button className="auth-modal__primary" type="submit"><PlusIcon /><span>{text.create}</span></button>
              </div>
            </form>
        </>
      </section>
    </div>
  );
}

function PlusIcon() {
  return <Plus size={17} strokeWidth={1.9} aria-hidden="true" />;
}

function OwnerIdentity({ option }: { option: OwnerOption }) {
  return (
    <span className="create-project-owner-identity">
      <span className="account-avatar" aria-hidden="true">
        {option.avatarUrl ? <img src={option.avatarUrl} alt="" /> : <span className="account-avatar__initial">{option.label.trim().slice(0, 1).toUpperCase() || '?'}</span>}
      </span>
      <span>{option.label}</span>
    </span>
  );
}
