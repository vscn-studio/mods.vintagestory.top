'use client';

import {
  AlignLeft,
  AlertTriangle,
  Archive,
  ArrowRightLeft,
  BarChart3,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleDot,
  ExternalLink,
  FilePenLine,
  FileUp,
  HardDrive,
  ImagePlus,
  Images,
  Info,
  Lightbulb,
  Link2,
  LoaderCircle,
  Monitor,
  Save,
  Scale,
  Send,
  Tags,
  Trash2,
  Undo2,
  UserPlus,
  UsersRound
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { type ChangeEvent, type FormEvent, type ReactNode, useCallback, useEffect, useState } from 'react';
import { ContentSelect, type ContentSelectOption } from '@/components/ContentSelect';
import { GameVersionPicker } from '@/components/GameVersionPicker';
import type { RichTextEditorProps } from '@/components/RichTextEditor';
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

type TaxonomyItem = {
  slug: string;
  name: string;
  nameEn: string;
};

type Project = {
  id: string;
  slug: string;
  name: { zh: string; en: string };
  summary: { zh: string; en: string };
  description: { zh: string; en: string };
  visibility: string;
  status: string;
  type: string;
  license?: string | null;
  links?: { repository?: string | null; issues?: string | null; wiki?: string | null; discord?: string | null; sponsor?: string | null };
  tags: TaxonomyItem[];
  categories: TaxonomyItem[];
  environments: TaxonomyItem[];
  stats: { downloads: number; followers: number; favorites: number; comments: number };
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
    noData: '暂无数据',
    releaseImmutable: '此版本已进入审核或发布流程，不能再编辑文件。',
    invitationSent: '邀请已发送，等待对方接受。',
    general: '通用', taxonomy: '标签与分类', descriptionSection: '描述', license: '许可证', gallery: '图库', links: '相关链接', analytics: '分析', navigation: '项目设置导航', checklist: '发布前检查单', checklistHide: '收起检查项', checklistShow: '显示检查项', required: '强制', warning: '警告', recommendation: '建议', complete: '已完成', projectInformation: '项目信息', projectUrl: '项目地址', urlImmutable: '项目地址创建后不可修改。', saveChanges: '保存更改', taxonomyDescription: '设置用于目录筛选和项目发现的标签、分类及兼容信息。', tags: '标签', categories: '分类', gameVersions: '游戏版本', descriptionDescription: '使用完整的项目说明，帮助玩家了解功能、安装方式与兼容性。', licenseDescription: '明确项目分发与使用条件。', linksDescription: '添加玩家、贡献者和维护者需要的外部链接。', repository: '代码仓库', issues: '问题追踪', wiki: '文档站点', discord: '社群链接', sponsor: '赞助链接', analyticsDescription: '公开项目的累计数据。', downloads: '下载', followers: '关注', favorites: '收藏', comments: '评论', checklistRelease: '上传一个版本', checklistReleaseDescription: '项目提交审核前至少需要有一个版本。', checklistDescription: '添加项目描述', checklistDescriptionDescription: '请提供能清晰说明项目目的与功能的详细介绍。', checklistLicense: '选择一个许可证', checklistLicenseDescription: '选择项目分发所使用的许可证。', checklistSummary: '扩充你的简介', checklistSummaryDescription: '建议至少使用 30 个字符，使简介完整且易于理解。', checklistGallery: '添加展示图', checklistGalleryDescription: '展示图能帮助玩家快速了解项目内容。', checklistLinks: '添加外部链接', checklistLinksDescription: '可添加代码仓库、问题追踪或社群地址。', openVersions: '前往版本', openDescription: '前往描述', openLicense: '前往许可证', openGallery: '前往图库', openLinks: '前往链接', noDescription: '尚未添加描述。', noLicense: '尚未选择许可证。', noLinks: '尚未添加外部链接。', archiveDescription: '归档后项目将不再显示在公开目录中。', ownerActions: '所有权操作'
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
    noData: 'No data',
    releaseImmutable: 'This release is being reviewed or published and its files cannot be changed.',
    invitationSent: 'Invitation sent. It will appear after the recipient accepts.', general: 'General', taxonomy: 'Tags & categories', descriptionSection: 'Description', license: 'License', gallery: 'Gallery', links: 'Links', analytics: 'Analytics', navigation: 'Project settings navigation', checklist: 'Publishing checklist', checklistHide: 'Hide checklist', checklistShow: 'Show checklist', required: 'Required', warning: 'Warning', recommendation: 'Recommendation', complete: 'Complete', projectInformation: 'Project information', projectUrl: 'Project URL', urlImmutable: 'The project URL cannot be changed after creation.', saveChanges: 'Save changes', taxonomyDescription: 'Configure tags, categories, and compatibility details used for discovery.', tags: 'Tags', categories: 'Categories', gameVersions: 'Game versions', descriptionDescription: 'Write a complete project description so players understand features, installation, and compatibility.', licenseDescription: 'Set the terms for distributing and using this project.', linksDescription: 'Add external resources for players, contributors, and maintainers.', repository: 'Repository', issues: 'Issue tracker', wiki: 'Documentation', discord: 'Community link', sponsor: 'Sponsor link', analyticsDescription: 'Public totals for this project.', downloads: 'Downloads', followers: 'Followers', favorites: 'Favorites', comments: 'Comments', checklistRelease: 'Upload a release', checklistReleaseDescription: 'A project needs at least one release before it can be submitted for review.', checklistDescription: 'Add a project description', checklistDescriptionDescription: 'Provide a detailed description of the project purpose and functionality.', checklistLicense: 'Choose a license', checklistLicenseDescription: 'Choose the license used to distribute this project.', checklistSummary: 'Expand your summary', checklistSummaryDescription: 'Use at least 30 characters so the summary is useful and clear.', checklistGallery: 'Add a showcase image', checklistGalleryDescription: 'A showcase image helps players understand the project at a glance.', checklistLinks: 'Add external links', checklistLinksDescription: 'Link a repository, issue tracker, or community space.', openVersions: 'Open releases', openDescription: 'Open description', openLicense: 'Open license', openGallery: 'Open gallery', openLinks: 'Open links', noDescription: 'No description has been added.', noLicense: 'No license has been selected.', noLinks: 'No external links have been added.', archiveDescription: 'Archived projects are removed from the public directory.', ownerActions: 'Ownership actions'
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

function normalizeEnvironmentValue(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (normalized === 'client' || value.trim() === '客户端') return 'client';
  if (normalized === 'server' || value.trim() === '服务端') return 'server';
  return normalized;
}

type ProjectSection = 'general' | 'taxonomy' | 'description' | 'versions' | 'license' | 'gallery' | 'links' | 'members' | 'analytics';

const RichTextEditor = dynamic<RichTextEditorProps>(() => import('@/components/RichTextEditor').then((module) => module.RichTextEditor), {
  ssr: false,
  loading: () => <div className="management-rich-editor__loading"><LoaderCircle size={16} />Loading editor…</div>
});

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
  const [activeSection, setActiveSection] = useState<ProjectSection>('general');
  const [checklistOpen, setChecklistOpen] = useState(true);
  const [visibility, setVisibility] = useState('public');
  const [taxonomyEnvironments, setTaxonomyEnvironments] = useState<string[]>([]);
  const [releaseCompatibleVersions, setReleaseCompatibleVersions] = useState<string[]>([]);
  const [releaseFile, setReleaseFile] = useState<File | null>(null);

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

  useEffect(() => {
    if (!project) return;
    setVisibility(project.visibility);
    setTaxonomyEnvironments([...new Set(project.environments.map((environment) => normalizeEnvironmentValue(environment.slug || environment.name)).filter(Boolean))]);
  }, [project]);

  async function updateProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSaved(false);
    setError('');
    const has = (name: string) => form.has(name);
    const textValue = (name: string) => String(form.get(name) ?? '').trim();
    const nullableValue = (name: string) => {
      const value = textValue(name);
      return value || null;
    };
    const payload: Record<string, unknown> = {
      ...(has('name') ? { name: textValue('name') } : {}),
      ...(has('summary') ? { summary: textValue('summary') } : {}),
      ...(has('description') ? { description: String(form.get('description') ?? '') } : {}),
      ...(has('visibility') ? { visibility: textValue('visibility') } : {}),
      ...(has('license') ? { license: nullableValue('license') } : {}),
      ...(has('repositoryUrl') ? { repositoryUrl: nullableValue('repositoryUrl') } : {}),
      ...(has('issueUrl') ? { issueUrl: nullableValue('issueUrl') } : {}),
      ...(has('wikiUrl') ? { wikiUrl: nullableValue('wikiUrl') } : {}),
      ...(has('discordUrl') ? { discordUrl: nullableValue('discordUrl') } : {}),
      ...(has('sponsorUrl') ? { sponsorUrl: nullableValue('sponsorUrl') } : {}),
      ...(has('tags') ? { tags: listValues(form.get('tags')) } : {}),
      ...(has('categories') ? { categories: listValues(form.get('categories')) } : {}),
      ...(has('environments') ? { environments: listValues(form.get('environments')) } : {})
    };
    const response = await fetch(`/api/v1/projects/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: await mutationHeaders(true),
      body: JSON.stringify(payload)
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
    setError('');
    const response = await fetch(`/api/v1/projects/${encodeURIComponent(id)}/releases`, {
      method: 'POST',
      headers: await mutationHeaders(true),
      body: JSON.stringify({ version, changelog, compatibleVersions: releaseCompatibleVersions })
    });
    if (!response.ok) {
      setError(await responseError(response, text.error));
      return;
    }
    const payload = await response.json().catch(() => ({})) as { data?: { id?: string } };
    const releaseId = payload.data?.id;
    if (!releaseId) {
      setError(text.error);
      await load();
      return;
    }
    if (releaseFile) {
      const form = new FormData();
      form.set('file', releaseFile);
      const fileResponse = await fetch(`/api/v1/releases/${encodeURIComponent(releaseId)}/files`, {
        method: 'POST',
        headers: await mutationHeaders(),
        body: form
      });
      if (!fileResponse.ok) {
        setError(await responseError(fileResponse, text.error));
        await load();
        return;
      }
    }
    setVersion('');
    setChangelog('');
    setReleaseCompatibleVersions([]);
    setReleaseFile(null);
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
  const canCreateRelease = capabilities.has('release.create');
  const canManageFiles = capabilities.has('file.manage');
  const canManageReleases = capabilities.has('release.create') || capabilities.has('file.manage') || capabilities.has('release.publish');
  const canArchive = capabilities.has('archive');
  const canTransfer = capabilities.has('transfer');
  if (!canUpdate && !canManageMembers && !canManageReleases && !canArchive && !canTransfer) {
    return <ManagementError title={text.project} error={text.forbidden} />;
  }
  const localizedKey = language === 'en' ? 'en' : 'zh';
  const hasDescription = Boolean(project.description[localizedKey].trim());
  const hasLicense = Boolean(project.license?.trim());
  const hasLinks = Object.values(project.links ?? {}).some(Boolean);
  const releaseGameVersions = [...new Set(project.releases.flatMap((release) => release.compatibleVersions ?? []).filter((value): value is string => typeof value === 'string' && Boolean(value.trim())))];
  const visibilityOptions: ContentSelectOption[] = [
    { value: 'public', label: text.public },
    { value: 'private', label: text.private }
  ];
  const transferOptions: ContentSelectOption[] = [
    { value: 'personal', label: text.personal },
    { value: 'organization', label: text.organization }
  ];
  const memberRoleOptions: ContentSelectOption[] = [
    { value: 'maintainer', label: 'Maintainer' },
    { value: 'contributor', label: 'Contributor' },
    { value: 'reviewer', label: 'Reviewer' },
    { value: 'viewer', label: 'Viewer' }
  ];
  const environmentOptions = [
    { value: 'client', label: language === 'en' ? 'Client' : '客户端', icon: Monitor },
    { value: 'server', label: language === 'en' ? 'Server' : '服务端', icon: HardDrive }
  ];
  const environmentLabel = (value: string) => environmentOptions.find((option) => option.value === value)?.label ?? value;
  const toggleTaxonomyEnvironment = (value: string) => {
    setTaxonomyEnvironments((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
  };
  const navItems = [
    { id: 'general' as const, label: text.general, icon: Info, available: canUpdate },
    { id: 'taxonomy' as const, label: text.taxonomy, icon: Tags, available: canUpdate },
    { id: 'description' as const, label: text.descriptionSection, icon: AlignLeft, available: canUpdate },
    { id: 'versions' as const, label: text.releases, icon: CircleDot, available: canManageReleases },
    { id: 'license' as const, label: text.license, icon: Scale, available: canUpdate },
    { id: 'gallery' as const, label: text.gallery, icon: Images, available: canUpdate },
    { id: 'links' as const, label: text.links, icon: Link2, available: canUpdate },
    { id: 'members' as const, label: text.members, icon: UsersRound, available: canManageMembers },
    { id: 'analytics' as const, label: text.analytics, icon: BarChart3, available: true }
  ].filter((item) => item.available);
  const currentSection = navItems.some((item) => item.id === activeSection) ? activeSection : navItems[0]?.id ?? 'analytics';
  const checklistItems = [
    { id: 'release', tone: 'required' as const, title: text.checklistRelease, description: text.checklistReleaseDescription, done: project.releases.length > 0, section: 'versions' as ProjectSection, action: text.openVersions },
    { id: 'description', tone: 'required' as const, title: text.checklistDescription, description: text.checklistDescriptionDescription, done: hasDescription, section: 'description' as ProjectSection, action: text.openDescription },
    { id: 'license', tone: 'required' as const, title: text.checklistLicense, description: text.checklistLicenseDescription, done: hasLicense, section: 'license' as ProjectSection, action: text.openLicense },
    { id: 'summary', tone: 'warning' as const, title: text.checklistSummary, description: text.checklistSummaryDescription, done: project.summary[localizedKey].trim().length >= 30, section: 'general' as ProjectSection, action: text.general },
    { id: 'gallery', tone: 'recommendation' as const, title: text.checklistGallery, description: text.checklistGalleryDescription, done: project.screenshots.length > 0, section: 'gallery' as ProjectSection, action: text.openGallery },
    { id: 'links', tone: 'recommendation' as const, title: text.checklistLinks, description: text.checklistLinksDescription, done: hasLinks, section: 'links' as ProjectSection, action: text.openLinks }
  ];

  return (
    <section className="management-page">
      <div className="management-page__inner">
        <header className="management-page__heading">
          <div>
            <span className="management-page__eyebrow">{text.project}</span>
            <h1>{project.name[localizedKey]}</h1>
            <a className="management-page__public-link" href={project.type === 'modpack' ? `/modpack/${encodeURIComponent(project.slug)}` : `/mod/${encodeURIComponent(project.slug)}`}>
              <ExternalLink size={15} />{project.slug}
            </a>
          </div>
          {canArchive ? <button className="management-button management-button--danger" type="button" onClick={() => void archiveProject()}>
            <Archive size={16} />
            {text.archive}
          </button> : null}
        </header>
        {error ? <p className="auth-form__error" role="alert">{error}</p> : null}

        <section className="management-checklist" aria-labelledby="management-checklist-title">
          <div className="management-checklist__header">
            <div>
              <h2 id="management-checklist-title">{text.checklist}</h2>
              <div className="management-checklist__legend" aria-label={text.checklist}>
                <span className="management-checklist__legend-item management-checklist__legend-item--required"><CircleDot size={15} />{text.required}</span>
                <span className="management-checklist__legend-item management-checklist__legend-item--warning"><AlertTriangle size={15} />{text.warning}</span>
                <span className="management-checklist__legend-item management-checklist__legend-item--recommendation"><Lightbulb size={15} />{text.recommendation}</span>
              </div>
            </div>
            <button className="management-icon-button" type="button" title={checklistOpen ? text.checklistHide : text.checklistShow} aria-label={checklistOpen ? text.checklistHide : text.checklistShow} aria-expanded={checklistOpen} onClick={() => setChecklistOpen((open) => !open)}><ChevronDown className={checklistOpen ? 'management-checklist__chevron' : 'management-checklist__chevron management-checklist__chevron--closed'} size={18} /></button>
          </div>
          {checklistOpen ? <div className="management-checklist__grid">
            {checklistItems.map((item) => {
              const StateIcon = item.done ? CheckCircle2 : item.tone === 'required' ? CircleDot : item.tone === 'warning' ? AlertTriangle : Lightbulb;
              const sectionAvailable = navItems.some((navItem) => navItem.id === item.section);
              return <article className={`management-check management-check--${item.tone}${item.done ? ' management-check--complete' : ''}`} key={item.id}>
                <h3><StateIcon size={17} aria-hidden="true" />{item.title}</h3>
                <p>{item.description}</p>
                {sectionAvailable ? <button type="button" className="management-check__action" onClick={() => setActiveSection(item.section)}>{item.done ? text.complete : item.action}<ExternalLink size={14} aria-hidden="true" /></button> : null}
              </article>;
            })}
          </div> : null}
        </section>

        <div className="management-workbench">
          <aside className="management-sidebar">
            <nav className="management-nav" aria-label={text.navigation}>
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = currentSection === item.id;
                return <button className={active ? 'management-nav__item management-nav__item--active' : 'management-nav__item'} type="button" key={item.id} aria-current={active ? 'page' : undefined} onClick={() => setActiveSection(item.id)}><Icon size={18} aria-hidden="true" /><span>{item.label}</span></button>;
              })}
            </nav>
          </aside>
          <div className="management-workbench__content">

        {canUpdate && currentSection === 'general' ? <section className="management-panel">
          <div className="management-panel__heading"><div><h2>{text.projectInformation}</h2><p>{text.urlImmutable}</p></div></div>
          <form className="management-form management-form--panel" onSubmit={updateProject}>
            <label className="management-field"><span>{text.name}</span><input name="name" defaultValue={project.name[localizedKey]} maxLength={120} required /></label>
            <label className="management-field"><span>{text.projectUrl}</span><input value={project.slug} readOnly aria-readonly="true" /></label>
            <label className="management-field"><span>{text.summary}</span><textarea name="summary" defaultValue={project.summary[localizedKey]} rows={3} maxLength={500} required /></label>
            <div className="management-field">
              <span>{text.visibility}</span>
              <input type="hidden" name="visibility" value={visibility} />
              <ContentSelect className="management-content-select" ariaLabel={text.visibility} value={visibility} options={visibilityOptions} onChange={setVisibility} />
            </div>
            <div className="management-form__actions"><button className="management-button management-button--primary" type="submit"><Save size={16} />{saved ? text.saved : text.saveChanges}</button></div>
          </form>
          {canTransfer ? <section className="management-subsection"><div><h3>{text.ownerActions}</h3><p>{text.transferTarget}</p></div><form className="management-inline-form" onSubmit={transferProject}><ContentSelect className="management-content-select management-content-select--compact" ariaLabel={text.transfer} value={transferType} options={transferOptions} onChange={(value) => setTransferType(value as 'personal' | 'organization')} /><input value={transferTarget} onChange={(event) => setTransferTarget(event.target.value)} placeholder={text.transferTarget} maxLength={120} required /><button className="management-button" type="submit"><ArrowRightLeft size={16} />{text.transfer}</button></form></section> : null}
          {canArchive ? <section className="management-danger-zone"><div><h3>{text.archive}</h3><p>{text.archiveDescription}</p></div><button className="management-button management-button--danger" type="button" onClick={() => void archiveProject()}><Archive size={16} />{text.archive}</button></section> : null}
        </section> : null}

        {canUpdate && currentSection === 'taxonomy' ? <section className="management-panel">
          <div className="management-panel__heading"><div><h2>{text.taxonomy}</h2><p>{text.taxonomyDescription}</p></div></div>
          <div className="management-taxonomy-layout">
            <form className="management-form management-form--panel" onSubmit={updateProject}>
              <label className="management-field"><span>{text.tags}</span><span className="game-version-picker__search management-taxonomy-search"><input name="tags" type="search" defaultValue={project.tags.map((item) => item.name).join(', ')} maxLength={600} /></span></label>
              <label className="management-field"><span>{text.categories}</span><span className="game-version-picker__search management-taxonomy-search"><input name="categories" type="search" defaultValue={project.categories.map((item) => item.name).join(', ')} maxLength={600} /></span></label>
              <div className="management-field">
                <span>{text.environments}</span>
                <input type="hidden" name="environments" value={taxonomyEnvironments.join(',')} />
                <div className="content-filter-options management-environment-options">
                  {environmentOptions.map((option) => {
                    const Icon = option.icon;
                    const selected = taxonomyEnvironments.includes(option.value);
                    return <div className="content-filter-option" key={option.value}><button className={selected ? 'content-filter-option__button content-filter-option__button--selected' : 'content-filter-option__button'} type="button" aria-pressed={selected} onClick={() => toggleTaxonomyEnvironment(option.value)}><span className="content-filter-option__icon"><Icon size={16} strokeWidth={2} aria-hidden="true" /></span><span className="content-filter-option__label">{option.label}</span><Check className="content-filter-option__check" size={16} strokeWidth={2} aria-hidden="true" /></button></div>;
                  })}
                </div>
              </div>
              <p className="management-form__hint">{language === 'en' ? 'Separate tags and categories with commas.' : '标签和分类可使用逗号分隔。'}</p>
              <div className="management-form__actions"><button className="management-button management-button--primary" type="submit"><Save size={16} />{saved ? text.saved : text.saveChanges}</button></div>
            </form>
            <aside className="preview-sidebar__section preview-compatibility-section management-compatibility-preview">
              <div className="preview-section__heading"><h2>{language === 'en' ? 'Compatibility' : '兼容性'}</h2></div>
              <dl className="preview-detail-list">
                <div><dt>{text.gameVersions}</dt><dd><ul className="preview-sidebar-tags preview-sidebar-tags--compact" aria-label={text.gameVersions}>{releaseGameVersions.length ? releaseGameVersions.map((gameVersion) => <li key={gameVersion}>{gameVersion}</li>) : <li>{text.noData}</li>}</ul></dd></div>
                <div><dt>{text.environments}</dt><dd><ul className="preview-sidebar-tags preview-sidebar-tags--compact" aria-label={text.environments}>{taxonomyEnvironments.length ? taxonomyEnvironments.map((environment) => <li key={environment}>{environmentLabel(environment)}</li>) : <li>{text.noData}</li>}</ul></dd></div>
              </dl>
            </aside>
          </div>
        </section> : null}

        {canUpdate && currentSection === 'description' ? <section className="management-panel">
          <div className="management-panel__heading"><div><h2>{text.descriptionSection}</h2><p>{text.descriptionDescription}</p></div></div>
          <form className="management-form management-form--panel" onSubmit={updateProject}>
            <label className="management-field"><span>{text.description}</span><textarea name="description" defaultValue={project.description[localizedKey]} rows={16} maxLength={100000} /></label>
            <div className="management-form__actions"><button className="management-button management-button--primary" type="submit"><Save size={16} />{saved ? text.saved : text.saveChanges}</button></div>
          </form>
        </section> : null}

        {canUpdate && currentSection === 'license' ? <section className="management-panel">
          <div className="management-panel__heading"><div><h2>{text.license}</h2><p>{text.licenseDescription}</p></div></div>
          <form className="management-form management-form--panel" onSubmit={updateProject}>
            <label className="management-field"><span>{text.license}</span><input name="license" defaultValue={project.license ?? ''} maxLength={120} placeholder="MIT" /></label>
            <div className="management-form__actions"><button className="management-button management-button--primary" type="submit"><Save size={16} />{saved ? text.saved : text.saveChanges}</button></div>
          </form>
        </section> : null}

        {canUpdate && currentSection === 'links' ? <section className="management-panel">
          <div className="management-panel__heading"><div><h2>{text.links}</h2><p>{text.linksDescription}</p></div></div>
          <form className="management-form management-form--panel" onSubmit={updateProject}>
            <label className="management-field"><span>{text.repository}</span><input name="repositoryUrl" type="url" defaultValue={project.links?.repository ?? ''} placeholder="https://" maxLength={2048} /></label>
            <label className="management-field"><span>{text.issues}</span><input name="issueUrl" type="url" defaultValue={project.links?.issues ?? ''} placeholder="https://" maxLength={2048} /></label>
            <label className="management-field"><span>{text.wiki}</span><input name="wikiUrl" type="url" defaultValue={project.links?.wiki ?? ''} placeholder="https://" maxLength={2048} /></label>
            <label className="management-field"><span>{text.discord}</span><input name="discordUrl" type="url" defaultValue={project.links?.discord ?? ''} placeholder="https://" maxLength={2048} /></label>
            <label className="management-field"><span>{text.sponsor}</span><input name="sponsorUrl" type="url" defaultValue={project.links?.sponsor ?? ''} placeholder="https://" maxLength={2048} /></label>
            <div className="management-form__actions"><button className="management-button management-button--primary" type="submit"><Save size={16} />{saved ? text.saved : text.saveChanges}</button></div>
          </form>
        </section> : null}

        {currentSection === 'analytics' ? <section className="management-panel">
          <div className="management-panel__heading"><div><h2>{text.analytics}</h2><p>{text.analyticsDescription}</p></div></div>
          <dl className="management-stat-grid"><div><dt>{text.downloads}</dt><dd>{project.stats.downloads.toLocaleString()}</dd></div><div><dt>{text.followers}</dt><dd>{project.stats.followers.toLocaleString()}</dd></div><div><dt>{text.favorites}</dt><dd>{project.stats.favorites.toLocaleString()}</dd></div><div><dt>{text.comments}</dt><dd>{project.stats.comments.toLocaleString()}</dd></div></dl>
        </section> : null}

        {canManageMembers && currentSection === 'members' ? <section className="management-panel">
          <div className="management-panel__heading"><div><h2>{text.members}</h2><p>{language === 'en' ? 'Manage project roles and membership.' : '管理项目成员和角色。'}</p></div></div>
          <form className="management-inline-form" onSubmit={addMember}>
            <input value={memberUsername} onChange={(event) => setMemberUsername(event.target.value)} placeholder={text.username} maxLength={80} required />
            <ContentSelect className="management-content-select management-content-select--compact" ariaLabel={text.role} value={memberRole} options={memberRoleOptions} onChange={setMemberRole} />
            <button className="auth-code-button" type="submit"><UserPlus size={16} />{text.invite}</button>
          </form>
          <ul className="management-member-list">
            {project.members.map((member) => (
              <li key={member.id}>
                <span><strong>{member.name}</strong><small>{member.username} · {member.role}</small></span>
                {member.role === 'owner' ? null : (
                  <span className="admin-actions">
                    <ContentSelect className="management-content-select management-content-select--compact management-content-select--role" ariaLabel={`${text.role}: ${member.username}`} value={member.role} options={memberRoleOptions} onChange={(role) => void changeMember(member, role)} />
                    <button className="admin-icon-button" type="button" title={text.remove} aria-label={text.remove} onClick={() => void removeMember(member)}><Trash2 size={16} /></button>
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section> : null}

        {canManageReleases && currentSection === 'versions' ? <section className="management-panel">
          <div className="management-panel__heading"><div><h2>{text.releases}</h2><p>{language === 'en' ? 'Create releases, upload files, and submit them for review.' : '创建版本、上传文件并提交审核。'}</p></div></div>
          {canCreateRelease ? <form className="management-form management-release-create-form" onSubmit={createRelease}>
            <label className="management-field"><span>{text.version}</span><input value={version} onChange={(event) => setVersion(event.target.value)} placeholder="1.0.0" maxLength={80} required /></label>
            <div className="management-field"><span>{text.changelog}</span><RichTextEditor value={changelog} onChange={setChangelog} ariaLabel={text.changelog} /></div>
            <div className="management-field">
              <span>{text.compatibleVersions}</span>
              <GameVersionPicker value={releaseCompatibleVersions} onChange={setReleaseCompatibleVersions} ariaLabel={text.compatibleVersions} />
            </div>
            {canManageFiles ? <div className="management-field"><span>{text.upload}</span><label className="management-release-file"><FileUp size={17} aria-hidden="true" /><span>{releaseFile?.name ?? text.upload}</span><input type="file" onChange={(event) => setReleaseFile(event.target.files?.[0] ?? null)} required /></label></div> : null}
            <div className="management-form__actions"><button className="management-button management-button--primary" type="submit"><Send size={16} />{text.createRelease}</button></div>
          </form> : null}
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

        {canUpdate && currentSection === 'gallery' ? <section className="management-panel">
          <div className="management-panel__heading"><div><h2>{text.gallery}</h2><p>{language === 'en' ? 'Upload project screenshots and showcase media.' : '上传项目截图与展示媒体。'}</p></div></div>
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

          </div>
        </div>
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
