'use client';

import {
  Boxes,
  CheckCircle2,
  ChevronDown,
  Globe2,
  Link2,
  LockKeyhole,
  Package,
  Palette,
  Plus,
  ServerCog,
  X,
  type LucideIcon
} from 'lucide-react';
import { FormEvent, useEffect, useRef, useState } from 'react';
import { useSiteLanguage } from '@/components/SiteLanguageContext';

type ProjectType = 'mod' | 'modpack' | 'theme-pack' | 'server';
type ProjectOwner = 'personal' | `organization:${string}`;
type Visibility = 'public' | 'private';

type CreateProjectModalProps = {
  username: string;
  organizations: string[];
  onClose: () => void;
};

type LocalizedCopy = {
  zh: string;
  en: string;
};

type ProjectTypeOption = {
  value: ProjectType;
  label: LocalizedCopy;
  icon: LucideIcon;
};

const projectTypes: ProjectTypeOption[] = [
  { value: 'mod', label: { zh: '模组', en: 'Mod' }, icon: Package },
  { value: 'modpack', label: { zh: '整合包', en: 'Modpack' }, icon: Boxes },
  { value: 'theme-pack', label: { zh: '主题包', en: 'Theme pack' }, icon: Palette },
  { value: 'server', label: { zh: '服务器调整', en: 'Server tweak' }, icon: ServerCog }
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
    publicHint: '所有人都可以查看项目',
    private: '私有',
    privateHint: '仅项目成员可以查看项目',
    overview: '概述',
    overviewPlaceholder: '用一两句话介绍这个项目。',
    cancel: '取消',
    create: '创建项目',
    createdTitle: '项目已创建',
    createdDescription: '项目基本资料已保存，接下来可以添加版本、文件和详细介绍。',
    done: '完成',
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
    publicHint: 'Everyone can view this project',
    private: 'Private',
    privateHint: 'Only project members can view this project',
    overview: 'Overview',
    overviewPlaceholder: 'Describe this project in one or two sentences.',
    cancel: 'Cancel',
    create: 'Create project',
    createdTitle: 'Project created',
    createdDescription: 'The project basics are saved. You can add releases, files, and detailed content next.',
    done: 'Done',
    projectTypeRequired: 'Choose a project type.'
  }
} as const;

export function CreateProjectModal({ username, organizations, onClose }: CreateProjectModalProps) {
  const language = useSiteLanguage();
  const text = copy[language];
  const [projectType, setProjectType] = useState<ProjectType>('mod');
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [owner, setOwner] = useState<ProjectOwner>('personal');
  const [visibility, setVisibility] = useState<Visibility>('public');
  const [overview, setOverview] = useState('');
  const [error, setError] = useState('');
  const [created, setCreated] = useState(false);
  const [isOwnerOpen, setIsOwnerOpen] = useState(false);
  const ownerMenuRef = useRef<HTMLDivElement>(null);
  const organizationNames = [...new Set(organizations.map((organization) => organization.trim()).filter(Boolean))];
  const ownerOptions: Array<{ value: ProjectOwner; label: string }> = [
    { value: 'personal', label: username },
    ...organizationNames.map((organization) => ({
      value: `organization:${organization}` as ProjectOwner,
      label: organization
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
    setCreated(true);
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

        {created ? (
          <div className="auth-modal__success create-project-success">
            <CheckCircle2 size={32} strokeWidth={1.7} aria-hidden="true" />
            <strong>{text.createdTitle}</strong>
            <span>{text.createdDescription}</span>
            <button className="auth-modal__primary" type="button" onClick={onClose}>{text.done}</button>
          </div>
        ) : (
          <>
            <div className="auth-modal__heading create-project-modal__heading">
              <h2 id="create-project-title">{text.title}</h2>
            </div>

            <form className="auth-form create-project-form" onSubmit={createProject}>
              <fieldset className="create-project-fieldset">
                <legend className="auth-field__label">{text.projectType}</legend>
                <div className="create-project-type-options">
                  {projectTypes.map((item) => {
                    const Icon = item.icon;
                    return (
                      <label className={projectType === item.value ? 'create-project-type create-project-type--active' : 'create-project-type'} key={item.value}>
                        <input
                          type="radio"
                          name="projectType"
                          value={item.value}
                          checked={projectType === item.value}
                          onChange={() => setProjectType(item.value)}
                        />
                        <Icon size={17} strokeWidth={1.9} aria-hidden="true" />
                        <span>{language === 'en' ? item.label.en : item.label.zh}</span>
                      </label>
                    );
                  })}
                </div>
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
                    <span className="content-select__value">{selectedOwner.label}</span>
                    <ChevronDown className={isOwnerOpen ? 'content-select__chevron content-select__chevron--up' : 'content-select__chevron'} size={15} strokeWidth={1.8} aria-hidden="true" />
                  </button>
                  <div
                    className={isOwnerOpen ? 'content-select-popover content-select-popover--open' : 'content-select-popover'}
                    role="listbox"
                    aria-hidden={!isOwnerOpen}
                    aria-label={text.owner}
                  >
                    {ownerOptions.map((option) => (
                      <button
                        className={option.value === owner ? 'content-select-option content-select-option--active' : 'content-select-option'}
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
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <fieldset className="create-project-fieldset">
                <legend className="auth-field__label">{text.visibility}</legend>
                <div className="create-project-visibility-options">
                  <label className={visibility === 'public' ? 'create-project-visibility create-project-visibility--active' : 'create-project-visibility'}>
                    <input type="radio" name="visibility" value="public" checked={visibility === 'public'} onChange={() => setVisibility('public')} />
                    <Globe2 size={17} strokeWidth={1.8} aria-hidden="true" />
                    <span>{text.public}<small>{text.publicHint}</small></span>
                  </label>
                  <label className={visibility === 'private' ? 'create-project-visibility create-project-visibility--active' : 'create-project-visibility'}>
                    <input type="radio" name="visibility" value="private" checked={visibility === 'private'} onChange={() => setVisibility('private')} />
                    <LockKeyhole size={17} strokeWidth={1.8} aria-hidden="true" />
                    <span>{text.private}<small>{text.privateHint}</small></span>
                  </label>
                </div>
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
        )}
      </section>
    </div>
  );
}

function PlusIcon() {
  return <Plus size={17} strokeWidth={1.9} aria-hidden="true" />;
}
