'use client';

import {
  Archive,
  ArrowRightLeft,
  Check,
  FilePenLine,
  FileUp,
  ImagePlus,
  LoaderCircle,
  Save,
  Send,
  Trash2,
  Undo2,
  UserPlus
} from 'lucide-react';
import { type ChangeEvent, type FormEvent, type ReactNode, useCallback, useEffect, useState } from 'react';
import { useSiteLanguage } from '@/components/SiteLanguageContext';
import { ensureCsrfToken, requestConfirmation } from '@/lib/client-confirmation';

type ProjectManagementProps = { id: string };

type Release = {
  id: string;
  version: string;
  status: string;
  changelog?: string | null;
  compatibleVersions?: string[];
  environments?: string[];
  files: Array<{ id: string; name: string; scanStatus: string; size: number }>;
};

type ProjectMember = {
  id: string;
  username: string;
  name: string;
  role: string;
};

type Screenshot = {
  id: string;
  url: string;
  caption?: string | null;
  sortOrder: number;
};

type Viewer = {
  capabilities?: string[];
};

type Project = {
  id: string;
  slug: string;
  name: { zh: string; en: string };
  summary: { zh: string; en: string };
  description: { zh: string; en: string };
  visibility: string;
  releases: Release[];
  members: ProjectMember[];
  screenshots: Screenshot[];
  viewer?: Viewer;
};

type OrganizationMember = {
  id: string;
  username: string;
  name: string;
  role: string;
};

type Organization = {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  visibility: string;
  members: OrganizationMember[];
  viewer?: Viewer;
};

const copy = {
  'zh-CN': {
    project: '项目管理',
    organization: '组织管理',
    loading: '正在加载…',
    error: '加载失败。',
    forbidden: '你没有管理此资源的权限。',
    save: '保存',
    saved: '已保存',
    name: '名称',
    summary: '简介',
    description: '详细介绍',
    visibility: '可见性',
    public: '公开',
    private: '私有',
    releases: '版本',
    version: '版本号',
    changelog: '更新日志',
    compatibleVersions: '兼容游戏版本',
    environments: '运行环境',
    createRelease: '创建版本',
    saveRelease: '保存版本资料',
    upload: '上传文件',
    deleteFile: '删除文件',
    submit: '提交审核',
    withdraw: '撤回版本',
    archive: '归档项目',
    archiveOrganization: '归档组织',
    confirmArchive: '确认归档',
    members: '成员',
    username: '用户名',
    role: '角色',
    invite: '添加成员',
    remove: '移除',
    transfer: '转让',
    transferTarget: '目标用户名或组织 slug',
    personal: '个人',
    organizationName: '组织名称',
    organizationDescription: '组织介绍',
    screenshots: '截图',
    screenshotCaption: '截图说明（可选）',
    uploadScreenshot: '上传截图',
    deleteScreenshot: '删除截图',
    noFiles: '尚未上传文件。',
    noScreenshots: '尚未上传截图。',
    releaseImmutable: '此版本已进入审核或发布流程，不能再编辑文件。',
    invitationSent: '邀请已发送，等待对方接受。'
  },
  en: {
    project: 'Project management',
    organization: 'Organization management',
    loading: 'Loading…',
    error: 'Unable to load data.',
    forbidden: 'You do not have permission to manage this resource.',
    save: 'Save',
    saved: 'Saved',
    name: 'Name',
    summary: 'Summary',
    description: 'Description',
    visibility: 'Visibility',
    public: 'Public',
    private: 'Private',
    releases: 'Releases',
    version: 'Version',
    changelog: 'Changelog',
    compatibleVersions: 'Compatible game versions',
    environments: 'Environments',
    createRelease: 'Create release',
    saveRelease: 'Save release details',
    upload: 'Upload file',
    deleteFile: 'Delete file',
    submit: 'Submit for review',
    withdraw: 'Withdraw release',
    archive: 'Archive project',
    archiveOrganization: 'Archive organization',
    confirmArchive: 'Confirm archive',
    members: 'Members',
    username: 'Username',
    role: 'Role',
    invite: 'Add member',
    remove: 'Remove',
    transfer: 'Transfer',
    transferTarget: 'Target username or organization slug',
    personal: 'Personal',
    organizationName: 'Organization name',
    organizationDescription: 'Organization description',
    screenshots: 'Screenshots',
    screenshotCaption: 'Screenshot caption (optional)',
    uploadScreenshot: 'Upload screenshot',
    deleteScreenshot: 'Delete screenshot',
    noFiles: 'No files uploaded.',
    noScreenshots: 'No screenshots uploaded.',
    releaseImmutable: 'This release is being reviewed or published and its files cannot be changed.',
    invitationSent: 'Invitation sent. It will appear after the recipient accepts.'
  }
} as const;

async function mutationHeaders(json = false): Promise<Record<string, string>> {
  const csrf = await ensureCsrfToken();
  return {
    ...(json ? { 'Content-Type': 'application/json' } : {}),
    ...(csrf ? { 'x-csrf-token': decodeURIComponent(csrf) } : {})
  };
}

type ErrorPayload = { error?: { message?: string }; message?: string };

function parsedResponseError(payload: ErrorPayload, fallback: string): string {
  return payload.error?.message ?? payload.message ?? fallback;
}

async function responseError(response: Response, fallback: string): Promise<string> {
  const payload = await response.json().catch(() => ({})) as ErrorPayload;
  return parsedResponseError(payload, fallback);
}

function listValues(value: FormDataEntryValue | null): string[] {
  return typeof value === 'string'
    ? value.split(',').map((item) => item.trim()).filter(Boolean)
    : [];
}

function releaseCanEdit(status: string): boolean {
  return status === 'draft' || status === 'rejected';
}

export function ProjectManagementPage({ id }: ProjectManagementProps) {
  const language = useSiteLanguage();
  const text = copy[language];
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [version, setVersion] = useState('');
  const [changelog, setChangelog] = useState('');
  const [memberUsername, setMemberUsername] = useState('');
  const [memberRole, setMemberRole] = useState('viewer');
  const [transferType, setTransferType] = useState<'personal' | 'organization'>('personal');
  const [transferTarget, setTransferTarget] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/v1/projects/${encodeURIComponent(id)}`, { cache: 'no-store' });
      const payload = await response.json().catch(() => ({})) as { data?: Project } & ErrorPayload;
      if (!response.ok || !payload.data) throw new Error(parsedResponseError(payload, text.error));
      setProject(payload.data);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : text.error);
    } finally {
      setLoading(false);
    }
  }, [id, text.error]);

  useEffect(() => {
    void ensureCsrfToken();
    void load();
  }, [load]);

  async function updateProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSaved(false);
    const response = await fetch(`/api/v1/projects/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: await mutationHeaders(true),
      body: JSON.stringify({
        name: form.get('name'),
        summary: form.get('summary'),
        description: form.get('description'),
        visibility: form.get('visibility')
      })
    });
    if (!response.ok) {
      setError(await responseError(response, text.error));
      return;
    }
    setSaved(true);
    await load();
  }

  async function createRelease(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await fetch(`/api/v1/projects/${encodeURIComponent(id)}/releases`, {
      method: 'POST',
      headers: await mutationHeaders(true),
      body: JSON.stringify({ version, changelog })
    });
    if (!response.ok) {
      setError(await responseError(response, text.error));
      return;
    }
    setVersion('');
    setChangelog('');
    await load();
  }

  async function updateRelease(event: FormEvent<HTMLFormElement>, release: Release) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const response = await fetch(`/api/v1/releases/${encodeURIComponent(release.id)}`, {
      method: 'PATCH',
      headers: await mutationHeaders(true),
      body: JSON.stringify({
        changelog: form.get('changelog'),
        compatibleVersions: listValues(form.get('compatibleVersions')),
        environments: listValues(form.get('environments'))
      })
    });
    if (!response.ok) {
      setError(await responseError(response, text.error));
      return;
    }
    await load();
  }

  async function uploadFile(event: ChangeEvent<HTMLInputElement>, releaseId: string) {
    const file = event.target.files?.[0];
    if (!file) return;
    const form = new FormData();
    form.set('file', file);
    const response = await fetch(`/api/v1/releases/${encodeURIComponent(releaseId)}/files`, {
      method: 'POST',
      headers: await mutationHeaders(),
      body: form
    });
    event.target.value = '';
    if (!response.ok) {
      setError(await responseError(response, text.error));
      return;
    }
    await load();
  }

  async function deleteFile(releaseId: string, fileId: string) {
    if (!window.confirm(text.deleteFile)) return;
    try {
      const confirmation = await requestConfirmation('release.file.delete', 'file', fileId);
      const response = await fetch(`/api/v1/releases/${encodeURIComponent(releaseId)}/files?fileId=${encodeURIComponent(fileId)}`, {
        method: 'DELETE',
        headers: { ...(await mutationHeaders()), ...confirmation }
      });
      if (!response.ok) {
        setError(await responseError(response, text.error));
        return;
      }
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : text.error);
    }
  }

  async function submitRelease(releaseId: string) {
    if (!window.confirm(text.submit)) return;
    try {
      const confirmation = await requestConfirmation('release.submit_review', 'release', releaseId);
      const response = await fetch(`/api/v1/releases/${encodeURIComponent(releaseId)}/publish`, {
        method: 'POST',
        headers: { ...(await mutationHeaders()), ...confirmation }
      });
      if (!response.ok) {
        setError(await responseError(response, text.error));
        return;
      }
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : text.error);
    }
  }

  async function withdrawRelease(releaseId: string) {
    if (!window.confirm(text.withdraw)) return;
    try {
      const confirmation = await requestConfirmation('release.withdraw', 'release', releaseId);
      const response = await fetch(`/api/v1/releases/${encodeURIComponent(releaseId)}/publish?action=withdraw`, {
        method: 'POST',
        headers: { ...(await mutationHeaders()), ...confirmation }
      });
      if (!response.ok) {
        setError(await responseError(response, text.error));
        return;
      }
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : text.error);
    }
  }

  async function uploadScreenshot(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const file = form.get('file');
    if (!(file instanceof File) || file.size === 0) return;
    const response = await fetch(`/api/v1/projects/${encodeURIComponent(id)}/screenshots`, {
      method: 'POST',
      headers: await mutationHeaders(),
      body: form
    });
    if (!response.ok) {
      setError(await responseError(response, text.error));
      return;
    }
    event.currentTarget.reset();
    await load();
  }

  async function deleteScreenshot(screenshot: Screenshot) {
    if (!window.confirm(text.deleteScreenshot)) return;
    const response = await fetch(`/api/v1/projects/${encodeURIComponent(id)}/screenshots?screenshotId=${encodeURIComponent(screenshot.id)}`, {
      method: 'DELETE',
      headers: await mutationHeaders()
    });
    if (!response.ok) {
      setError(await responseError(response, text.error));
      return;
    }
    await load();
  }

  async function addMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await fetch(`/api/v1/projects/${encodeURIComponent(id)}/members`, {
      method: 'POST',
      headers: await mutationHeaders(true),
      body: JSON.stringify({ username: memberUsername, role: memberRole })
    });
    if (!response.ok) {
      setError(await responseError(response, text.error));
      return;
    }
    setMemberUsername('');
    await load();
  }

  async function changeMember(member: ProjectMember, role: string) {
    if (!project || member.role === 'owner' || member.role === role) return;
    try {
      const confirmation = await requestConfirmation('project.member.role.update', 'project', `${project.id}:${member.id}`);
      const response = await fetch(`/api/v1/projects/${encodeURIComponent(id)}/members`, {
        method: 'PATCH',
        headers: { ...(await mutationHeaders(true)), ...confirmation },
        body: JSON.stringify({ username: member.username, role })
      });
      if (!response.ok) {
        setError(await responseError(response, text.error));
        return;
      }
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : text.error);
    }
  }

  async function removeMember(member: ProjectMember) {
    if (!project || member.role === 'owner' || !window.confirm(text.remove)) return;
    try {
      const confirmation = await requestConfirmation('project.member.remove', 'project', `${project.id}:${member.id}`);
      const response = await fetch(`/api/v1/projects/${encodeURIComponent(id)}/members?username=${encodeURIComponent(member.username)}`, {
        method: 'DELETE',
        headers: { ...(await mutationHeaders()), ...confirmation }
      });
      if (!response.ok) {
        setError(await responseError(response, text.error));
        return;
      }
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : text.error);
    }
  }

  async function transferProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!project || !transferTarget.trim() || !window.confirm(text.transfer)) return;
    try {
      const confirmation = await requestConfirmation('project.transfer', 'project', project.id);
      const response = await fetch(`/api/v1/projects/${encodeURIComponent(id)}/transfer`, {
        method: 'POST',
        headers: { ...(await mutationHeaders(true)), ...confirmation },
        body: JSON.stringify({ ownerType: transferType, ownerId: transferTarget.trim() })
      });
      if (!response.ok) {
        setError(await responseError(response, text.error));
        return;
      }
      window.location.assign('/projects');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : text.error);
    }
  }

  async function archiveProject() {
    if (!project || !window.confirm(text.confirmArchive)) return;
    try {
      const confirmation = await requestConfirmation('project.archive', 'project', project.id);
      const response = await fetch(`/api/v1/projects/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: { ...(await mutationHeaders()), ...confirmation }
      });
      if (!response.ok) {
        setError(await responseError(response, text.error));
        return;
      }
      window.location.assign('/projects');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : text.error);
    }
  }

  if (loading) return <ManagementLoading text={text.loading} />;
  if (!project) return <ManagementError title={text.project} error={error || text.error} />;
  const capabilities = new Set(project.viewer?.capabilities ?? []);
  const canUpdate = capabilities.has('update');
  const canManageMembers = capabilities.has('member.manage');
  const canManageReleases = capabilities.has('release.create') || capabilities.has('file.manage') || capabilities.has('release.publish');
  const canArchive = capabilities.has('archive');
  const canTransfer = capabilities.has('transfer');
  if (!canUpdate && !canManageMembers && !canManageReleases && !canArchive && !canTransfer) {
    return <ManagementError title={text.project} error={text.forbidden} />;
  }

  return (
    <section className="management-page">
      <div className="management-page__inner">
        <header className="workspace-page__header">
          <h1>{text.project}: {project.name[language === 'en' ? 'en' : 'zh']}</h1>
          {canArchive ? <button className="admin-button admin-button--danger" type="button" onClick={() => void archiveProject()}>
            <Archive size={16} />
            {text.archive}
          </button> : null}
        </header>
        {error ? <p className="auth-form__error" role="alert">{error}</p> : null}

        {canUpdate ? <form className="management-form" onSubmit={updateProject}>
          <Field label={text.name}><input name="name" defaultValue={project.name.zh} maxLength={120} required /></Field>
          <Field label={text.summary}><input name="summary" defaultValue={project.summary.zh} maxLength={500} required /></Field>
          <Field label={text.description}><textarea name="description" defaultValue={project.description.zh} rows={8} maxLength={100000} /></Field>
          <label className="auth-field">
            <span>{text.visibility}</span>
            <select name="visibility" defaultValue={project.visibility}>
              <option value="public">{text.public}</option>
              <option value="private">{text.private}</option>
            </select>
          </label>
          <button className="auth-modal__primary" type="submit"><Save size={16} />{saved ? text.saved : text.save}</button>
        </form> : null}

        {canManageMembers ? <section className="management-section">
          <h2>{text.members}</h2>
          <form className="management-inline-form" onSubmit={addMember}>
            <input value={memberUsername} onChange={(event) => setMemberUsername(event.target.value)} placeholder={text.username} maxLength={80} required />
            <select value={memberRole} onChange={(event) => setMemberRole(event.target.value)}>
              <option value="maintainer">Maintainer</option>
              <option value="contributor">Contributor</option>
              <option value="reviewer">Reviewer</option>
              <option value="viewer">Viewer</option>
            </select>
            <button className="auth-code-button" type="submit"><UserPlus size={16} />{text.invite}</button>
          </form>
          <ul className="management-member-list">
            {project.members.map((member) => (
              <li key={member.id}>
                <span><strong>{member.name}</strong><small>{member.username} · {member.role}</small></span>
                {member.role === 'owner' ? null : (
                  <span className="admin-actions">
                    <select aria-label={`${text.role}: ${member.username}`} value={member.role} onChange={(event) => void changeMember(member, event.target.value)}>
                      <option value="maintainer">Maintainer</option>
                      <option value="contributor">Contributor</option>
                      <option value="reviewer">Reviewer</option>
                      <option value="viewer">Viewer</option>
                    </select>
                    <button className="admin-icon-button" type="button" title={text.remove} aria-label={text.remove} onClick={() => void removeMember(member)}><Trash2 size={16} /></button>
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section> : null}

        {canManageReleases ? <section className="management-section">
          <h2>{text.releases}</h2>
          <form className="management-inline-form" onSubmit={createRelease}>
            <input value={version} onChange={(event) => setVersion(event.target.value)} placeholder={text.version} maxLength={80} required />
            <input value={changelog} onChange={(event) => setChangelog(event.target.value)} placeholder={text.changelog} maxLength={100000} />
            <button className="auth-code-button" type="submit"><Send size={16} />{text.createRelease}</button>
          </form>
          {project.releases.map((release) => {
            const editable = releaseCanEdit(release.status);
            const canEditRelease = editable && capabilities.has('release.create');
            const canEditFiles = editable && capabilities.has('file.manage');
            const canSubmit = editable && capabilities.has('release.publish');
            const canWithdraw = release.status !== 'withdrawn' && capabilities.has('release.publish');
            return (
              <article className="management-release" key={release.id}>
                <div>
                  <strong>v{release.version}</strong>
                  <span>{release.status}</span>
                </div>
                {canEditFiles ? <label className="auth-code-button"><FileUp size={16} />{text.upload}<input type="file" hidden onChange={(event) => void uploadFile(event, release.id)} /></label> : null}
                {canSubmit ? <button className="auth-code-button" type="button" onClick={() => void submitRelease(release.id)}><Check size={16} />{text.submit}</button> : null}
                {canWithdraw ? <button className="auth-code-button" type="button" onClick={() => void withdrawRelease(release.id)}><Undo2 size={16} />{text.withdraw}</button> : null}
                {!canEditRelease && !canEditFiles && !canWithdraw ? <span className="management-release__notice">{text.releaseImmutable}</span> : null}
                {canEditRelease ? (
                  <form className="management-release__form" onSubmit={(event) => void updateRelease(event, release)}>
                    <label><span>{text.changelog}</span><textarea name="changelog" defaultValue={release.changelog ?? ''} rows={3} maxLength={100000} /></label>
                    <label><span>{text.compatibleVersions}</span><input name="compatibleVersions" defaultValue={(release.compatibleVersions ?? []).join(', ')} maxLength={1000} /></label>
                    <label><span>{text.environments}</span><input name="environments" defaultValue={(release.environments ?? []).join(', ')} maxLength={1000} /></label>
                    <button className="auth-code-button" type="submit"><FilePenLine size={16} />{text.saveRelease}</button>
                  </form>
                ) : null}
                <ul className="management-release__files">
                  {release.files.length ? release.files.map((file) => (
                    <li key={file.id}>
                      <span>{file.name} · {file.scanStatus}</span>
                      {canEditFiles ? <button className="admin-icon-button" type="button" title={text.deleteFile} aria-label={text.deleteFile} onClick={() => void deleteFile(release.id, file.id)}><Trash2 size={16} /></button> : null}
                    </li>
                  )) : <li>{text.noFiles}</li>}
                </ul>
              </article>
            );
          })}
        </section> : null}

        {canUpdate ? <section className="management-section">
          <h2>{text.screenshots}</h2>
          <form className="management-inline-form" onSubmit={uploadScreenshot}>
            <input type="file" name="file" accept="image/png,image/jpeg,image/webp" required />
            <input name="caption" placeholder={text.screenshotCaption} maxLength={500} />
            <button className="auth-code-button" type="submit"><ImagePlus size={16} />{text.uploadScreenshot}</button>
          </form>
          {project.screenshots.length ? (
            <div className="management-screenshot-grid">
              {project.screenshots.map((screenshot) => (
                <figure className="management-screenshot" key={screenshot.id}>
                  <img src={screenshot.url} alt={screenshot.caption || project.name[language === 'en' ? 'en' : 'zh']} />
                  <figcaption>{screenshot.caption || ''}</figcaption>
                  <button className="admin-icon-button" type="button" title={text.deleteScreenshot} aria-label={text.deleteScreenshot} onClick={() => void deleteScreenshot(screenshot)}><Trash2 size={16} /></button>
                </figure>
              ))}
            </div>
          ) : <p className="management-empty">{text.noScreenshots}</p>}
        </section> : null}

        {canTransfer ? <section className="management-section">
          <h2>{text.transfer}</h2>
          <form className="management-inline-form" onSubmit={transferProject}>
            <select value={transferType} onChange={(event) => setTransferType(event.target.value as 'personal' | 'organization')}>
              <option value="personal">{text.personal}</option>
              <option value="organization">{text.organization}</option>
            </select>
            <input value={transferTarget} onChange={(event) => setTransferTarget(event.target.value)} placeholder={text.transferTarget} maxLength={120} required />
            <button className="auth-code-button" type="submit"><ArrowRightLeft size={16} />{text.transfer}</button>
          </form>
        </section> : null}
      </div>
    </section>
  );
}

export function OrganizationManagementPage({ slug }: { slug: string }) {
  const language = useSiteLanguage();
  const text = copy[language];
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [username, setUsername] = useState('');
  const [role, setRole] = useState('member');
  const [transferTarget, setTransferTarget] = useState('');
  const [invitationSent, setInvitationSent] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/v1/organizations/${encodeURIComponent(slug)}`, { cache: 'no-store' });
      const payload = await response.json().catch(() => ({})) as { data?: Organization } & ErrorPayload;
      if (!response.ok || !payload.data) throw new Error(parsedResponseError(payload, text.error));
      setOrganization(payload.data);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : text.error);
    } finally {
      setLoading(false);
    }
  }, [slug, text.error]);

  useEffect(() => {
    void ensureCsrfToken();
    void load();
  }, [load]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const response = await fetch(`/api/v1/organizations/${encodeURIComponent(slug)}`, {
      method: 'PATCH',
      headers: await mutationHeaders(true),
      body: JSON.stringify({ name: form.get('name'), description: form.get('description'), visibility: form.get('visibility') })
    });
    if (!response.ok) {
      setError(await responseError(response, text.error));
      return;
    }
    await load();
  }

  async function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setInvitationSent(false);
    const response = await fetch(`/api/v1/organizations/${encodeURIComponent(slug)}/members`, {
      method: 'POST',
      headers: await mutationHeaders(true),
      body: JSON.stringify({ username, role })
    });
    if (!response.ok) {
      setError(await responseError(response, text.error));
      return;
    }
    setUsername('');
    setInvitationSent(true);
  }

  async function changeMember(member: OrganizationMember, nextRole: string) {
    if (!organization || member.role === 'owner' || member.role === nextRole) return;
    try {
      const confirmation = await requestConfirmation('organization.member.role.update', 'organization', `${organization.id}:${member.id}`);
      const response = await fetch(`/api/v1/organizations/${encodeURIComponent(slug)}/members`, {
        method: 'PATCH',
        headers: { ...(await mutationHeaders(true)), ...confirmation },
        body: JSON.stringify({ username: member.username, role: nextRole })
      });
      if (!response.ok) {
        setError(await responseError(response, text.error));
        return;
      }
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : text.error);
    }
  }

  async function removeMember(member: OrganizationMember) {
    if (!organization || member.role === 'owner' || !window.confirm(text.remove)) return;
    try {
      const confirmation = await requestConfirmation('organization.member.remove', 'organization', `${organization.id}:${member.id}`);
      const response = await fetch(`/api/v1/organizations/${encodeURIComponent(slug)}/members?username=${encodeURIComponent(member.username)}`, {
        method: 'DELETE',
        headers: { ...(await mutationHeaders()), ...confirmation }
      });
      if (!response.ok) {
        setError(await responseError(response, text.error));
        return;
      }
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : text.error);
    }
  }

  async function archiveOrganization() {
    if (!organization || !window.confirm(text.confirmArchive)) return;
    try {
      const confirmation = await requestConfirmation('organization.archive', 'organization', organization.id);
      const response = await fetch(`/api/v1/organizations/${encodeURIComponent(slug)}/archive`, {
        method: 'POST',
        headers: { ...(await mutationHeaders()), ...confirmation }
      });
      if (!response.ok) {
        setError(await responseError(response, text.error));
        return;
      }
      window.location.assign('/organizations');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : text.error);
    }
  }

  async function transferOrganization(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!organization || !transferTarget.trim() || !window.confirm(text.transfer)) return;
    try {
      const confirmation = await requestConfirmation('organization.transfer', 'organization', organization.id);
      const response = await fetch(`/api/v1/organizations/${encodeURIComponent(slug)}/transfer`, {
        method: 'POST',
        headers: { ...(await mutationHeaders(true)), ...confirmation },
        body: JSON.stringify({ username: transferTarget.trim() })
      });
      if (!response.ok) {
        setError(await responseError(response, text.error));
        return;
      }
      window.location.assign('/organizations');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : text.error);
    }
  }

  if (loading) return <ManagementLoading text={text.loading} />;
  if (!organization) return <ManagementError title={text.organization} error={error || text.error} />;
  const capabilities = new Set(organization.viewer?.capabilities ?? []);
  const canManage = capabilities.has('manage');
  const canTransfer = capabilities.has('transfer');
  if (!canManage && !canTransfer) return <ManagementError title={text.organization} error={text.forbidden} />;

  return (
    <section className="management-page">
      <div className="management-page__inner">
        <header className="workspace-page__header">
          <h1>{text.organization}: {organization.name}</h1>
          {canTransfer ? <button className="admin-button admin-button--danger" type="button" onClick={() => void archiveOrganization()}>
            <Archive size={16} />
            {text.archiveOrganization}
          </button> : null}
        </header>
        {error ? <p className="auth-form__error" role="alert">{error}</p> : null}

        {canManage ? <form className="management-form" onSubmit={save}>
          <Field label={text.organizationName}><input name="name" defaultValue={organization.name} maxLength={120} required /></Field>
          <Field label={text.organizationDescription}><textarea name="description" defaultValue={organization.description ?? ''} rows={6} maxLength={2000} /></Field>
          <label className="auth-field">
            <span>{text.visibility}</span>
            <select name="visibility" defaultValue={organization.visibility}>
              <option value="public">{text.public}</option>
              <option value="private">{text.private}</option>
            </select>
          </label>
          <button className="auth-modal__primary" type="submit"><Save size={16} />{text.save}</button>
        </form> : null}

        {canManage ? <section className="management-section">
          <h2>{text.members}</h2>
          <form className="management-inline-form" onSubmit={invite}>
            <input value={username} onChange={(event) => setUsername(event.target.value)} placeholder={text.username} maxLength={80} required />
            <select value={role} onChange={(event) => setRole(event.target.value)}>
              <option value="admin">Admin</option>
              <option value="maintainer">Maintainer</option>
              <option value="member">Member</option>
              <option value="viewer">Viewer</option>
            </select>
            <button className="auth-code-button" type="submit"><UserPlus size={16} />{text.invite}</button>
          </form>
          {invitationSent ? <p className="management-inline-notice" role="status">{text.invitationSent}</p> : null}
          <ul className="management-member-list">
            {organization.members.map((member) => (
              <li key={member.id}>
                <span><strong>{member.name}</strong><small>{member.username} · {member.role}</small></span>
                {member.role === 'owner' ? null : (
                  <span className="admin-actions">
                    <select aria-label={`${text.role}: ${member.username}`} value={member.role} onChange={(event) => void changeMember(member, event.target.value)}>
                      <option value="admin">Admin</option>
                      <option value="maintainer">Maintainer</option>
                      <option value="member">Member</option>
                      <option value="viewer">Viewer</option>
                    </select>
                    <button className="admin-icon-button" type="button" title={text.remove} aria-label={text.remove} onClick={() => void removeMember(member)}><Trash2 size={16} /></button>
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section> : null}

        {canTransfer ? <section className="management-section">
          <h2>{text.transfer}</h2>
          <form className="management-inline-form" onSubmit={transferOrganization}>
            <input value={transferTarget} onChange={(event) => setTransferTarget(event.target.value)} placeholder={text.username} maxLength={80} required />
            <button className="auth-code-button" type="submit"><ArrowRightLeft size={16} />{text.transfer}</button>
          </form>
        </section> : null}
      </div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="auth-field"><span>{label}</span><span className="auth-input-wrap profile-edit-textarea-wrap">{children}</span></label>;
}

function ManagementLoading({ text }: { text: string }) {
  return <section className="workspace-page"><div className="workspace-page__inner"><p className="workspace-page__state"><LoaderCircle className="content-browser__spinner" size={20} />{text}</p></div></section>;
}

function ManagementError({ title, error }: { title: string; error: string }) {
  return <section className="workspace-page"><div className="workspace-page__inner"><h1>{title}</h1><p className="workspace-page__state">{error}</p></div></section>;
}
