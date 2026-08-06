'use client';

import {
  ArchiveRestore,
  BadgeCheck,
  BellRing,
  Blocks,
  Braces,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Cloud,
  Code2,
  Database,
  Download,
  EllipsisVertical,
  FileArchive,
  FileImage,
  FileText,
  Files,
  FolderOpen,
  Gamepad2,
  Gauge,
  History,
  KeyRound,
  LogIn,
  Menu,
  MessageSquare,
  PackageSearch,
  Plus,
  RefreshCcw,
  Save,
  Search,
  Shield,
  ShieldCheck,
  SlidersHorizontal,
  Tags,
  Trash2,
  Upload,
  UserRound,
  UsersRound,
  Wrench,
  type LucideIcon
} from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { useSiteLanguage } from '@/components/SiteLanguageContext';

type AdminSection =
  | 'permissions'
  | 'api'
  | 'storage'
  | 'files'
  | 'accounts'
  | 'content'
  | 'review'
  | 'logs'
  | 'updates';

type LocalizedText = { zh: string; en: string };

const navigation: Array<{ id: AdminSection; label: LocalizedText; icon: LucideIcon }> = [
  { id: 'permissions', label: { zh: '权限管理', en: 'Permissions' }, icon: ShieldCheck },
  { id: 'api', label: { zh: 'API 管理', en: 'API management' }, icon: Braces },
  { id: 'storage', label: { zh: '存储设置', en: 'Storage settings' }, icon: Database },
  { id: 'files', label: { zh: '文件管理', en: 'File management' }, icon: Files },
  { id: 'accounts', label: { zh: '用户与组织', en: 'Users & organizations' }, icon: UsersRound },
  { id: 'content', label: { zh: '内容管理', en: 'Content management' }, icon: PackageSearch },
  { id: 'review', label: { zh: '审核中心', en: 'Review center' }, icon: BadgeCheck },
  { id: 'logs', label: { zh: '日志', en: 'Logs' }, icon: FileText },
  { id: 'updates', label: { zh: '更新与备份', en: 'Updates & backups' }, icon: RefreshCcw }
];

const copy = {
  zh: {
    admin: '管理后台',
    navigation: '后台导航',
    openNavigation: '打开后台导航',
    closeNavigation: '关闭后台导航',
    save: '保存设置',
    search: '搜索',
    configure: '配置',
    manage: '管理',
    viewAll: '查看全部',
    enabled: '运行中',
    disabled: '已停用',
    normal: '正常',
    warning: '需注意',
    noData: '暂无数据',
    more: '更多操作'
  },
  en: {
    admin: 'Administration',
    navigation: 'Admin navigation',
    openNavigation: 'Open admin navigation',
    closeNavigation: 'Close admin navigation',
    save: 'Save settings',
    search: 'Search',
    configure: 'Configure',
    manage: 'Manage',
    viewAll: 'View all',
    enabled: 'Running',
    disabled: 'Disabled',
    normal: 'Healthy',
    warning: 'Attention',
    noData: 'No data',
    more: 'More actions'
  }
} as const;

function AdminPanel({ title, action, children, className = '' }: { title: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`admin-panel${className ? ` ${className}` : ''}`}>
      <div className="admin-panel__heading">
        <h2>{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function StatusPill({ children, tone = 'success' }: { children: ReactNode; tone?: 'success' | 'warning' | 'neutral' | 'danger' }) {
  return <span className={`admin-status admin-status--${tone}`}>{children}</span>;
}

function Toggle({ label, defaultChecked = false }: { label: string; defaultChecked?: boolean }) {
  return (
    <label className="admin-toggle">
      <input type="checkbox" defaultChecked={defaultChecked} />
      <span className="admin-toggle__track" aria-hidden="true"><span /></span>
      <span className="admin-toggle__label">{label}</span>
    </label>
  );
}

function QuietButton({ children, icon: Icon, primary = false }: { children: ReactNode; icon?: LucideIcon; primary?: boolean }) {
  return (
    <button className={`admin-button${primary ? ' admin-button--primary' : ''}`} type="button">
      {Icon ? <Icon size={17} strokeWidth={2} aria-hidden="true" /> : null}
      <span>{children}</span>
    </button>
  );
}

function MoreButton({ label }: { label: string }) {
  return (
    <button className="admin-icon-button" type="button" title={label} aria-label={label}>
      <EllipsisVertical size={19} strokeWidth={2} aria-hidden="true" />
    </button>
  );
}

type PermissionEntry = {
  id: string;
  category: { zh: string; en: string };
  name: { zh: string; en: string };
  roles: { zh: string; en: string };
  enabled: boolean;
};

const permissionEntries: PermissionEntry[] = [
  { id: 'project.create', category: { zh: '项目', en: 'Projects' }, name: { zh: '创建项目', en: 'Create projects' }, roles: { zh: '已验证用户', en: 'Verified users' }, enabled: true },
  { id: 'project.update', category: { zh: '项目', en: 'Projects' }, name: { zh: '编辑项目资料', en: 'Edit project details' }, roles: { zh: '项目 Owner、Maintainer', en: 'Project Owner, Maintainer' }, enabled: true },
  { id: 'project.member.manage', category: { zh: '项目', en: 'Projects' }, name: { zh: '管理项目成员', en: 'Manage project members' }, roles: { zh: '项目 Owner、Maintainer', en: 'Project Owner, Maintainer' }, enabled: true },
  { id: 'project.transfer', category: { zh: '项目', en: 'Projects' }, name: { zh: '转让项目', en: 'Transfer projects' }, roles: { zh: '项目 Owner', en: 'Project Owner' }, enabled: true },
  { id: 'project.archive', category: { zh: '项目', en: 'Projects' }, name: { zh: '归档或删除项目', en: 'Archive or delete projects' }, roles: { zh: '项目 Owner', en: 'Project Owner' }, enabled: true },
  { id: 'release.create', category: { zh: '版本与文件', en: 'Releases & files' }, name: { zh: '创建项目版本', en: 'Create releases' }, roles: { zh: '项目 Owner、Maintainer、Contributor', en: 'Project Owner, Maintainer, Contributor' }, enabled: true },
  { id: 'release.publish', category: { zh: '版本与文件', en: 'Releases & files' }, name: { zh: '发布或撤回版本', en: 'Publish or withdraw releases' }, roles: { zh: '项目 Owner、Maintainer', en: 'Project Owner, Maintainer' }, enabled: true },
  { id: 'release.file.manage', category: { zh: '版本与文件', en: 'Releases & files' }, name: { zh: '上传和管理文件', en: 'Upload and manage files' }, roles: { zh: '项目 Owner、Maintainer、Contributor', en: 'Project Owner, Maintainer, Contributor' }, enabled: true },
  { id: 'download.public', category: { zh: '版本与文件', en: 'Releases & files' }, name: { zh: '下载公开文件', en: 'Download public files' }, roles: { zh: '所有访客', en: 'All visitors' }, enabled: true },
  { id: 'comment.create', category: { zh: '社区', en: 'Community' }, name: { zh: '发表评论', en: 'Publish comments' }, roles: { zh: '已验证用户', en: 'Verified users' }, enabled: true },
  { id: 'comment.moderate', category: { zh: '社区', en: 'Community' }, name: { zh: '管理评论和举报', en: 'Moderate comments and reports' }, roles: { zh: '版主、站点管理员', en: 'Moderators, Site administrators' }, enabled: true },
  { id: 'organization.create', category: { zh: '组织', en: 'Organizations' }, name: { zh: '创建组织', en: 'Create organizations' }, roles: { zh: '可信用户', en: 'Trusted users' }, enabled: true },
  { id: 'organization.manage', category: { zh: '组织', en: 'Organizations' }, name: { zh: '管理组织成员和设置', en: 'Manage organization members and settings' }, roles: { zh: '组织 Owner、Admin', en: 'Organization Owner, Admin' }, enabled: true },
  { id: 'organization.project.manage', category: { zh: '组织', en: 'Organizations' }, name: { zh: '管理组织项目', en: 'Manage organization projects' }, roles: { zh: '组织 Owner、Admin、Maintainer', en: 'Organization Owner, Admin, Maintainer' }, enabled: true },
  { id: 'github.connect', category: { zh: 'GitHub 集成', en: 'GitHub integration' }, name: { zh: '连接 GitHub 账号', en: 'Connect GitHub accounts' }, roles: { zh: '本人', en: 'Account owner' }, enabled: true },
  { id: 'github.import', category: { zh: 'GitHub 集成', en: 'GitHub integration' }, name: { zh: '导入 GitHub 仓库', en: 'Import GitHub repositories' }, roles: { zh: '项目 Owner、Maintainer', en: 'Project Owner, Maintainer' }, enabled: true },
  { id: 'github.sync', category: { zh: 'GitHub 集成', en: 'GitHub integration' }, name: { zh: '同步 README、标签和 Release', en: 'Sync README, tags, and releases' }, roles: { zh: '项目 Owner、Maintainer', en: 'Project Owner, Maintainer' }, enabled: true },
  { id: 'github.publish', category: { zh: 'GitHub 集成', en: 'GitHub integration' }, name: { zh: '从 GitHub 发布版本', en: 'Publish releases from GitHub' }, roles: { zh: '项目 Owner、Maintainer', en: 'Project Owner, Maintainer' }, enabled: true },
  { id: 'review.content', category: { zh: '审核', en: 'Review' }, name: { zh: '审核项目、版本和文件', en: 'Review projects, releases, and files' }, roles: { zh: '审核员、站点管理员', en: 'Reviewers, Site administrators' }, enabled: true },
  { id: 'user.manage', category: { zh: '站点管理', en: 'Site administration' }, name: { zh: '管理用户和封禁', en: 'Manage users and bans' }, roles: { zh: '站点管理员', en: 'Site administrators' }, enabled: true },
  { id: 'api.key.manage', category: { zh: '站点管理', en: 'Site administration' }, name: { zh: '管理 API 密钥', en: 'Manage API keys' }, roles: { zh: '站点管理员', en: 'Site administrators' }, enabled: true },
  { id: 'audit.view', category: { zh: '站点管理', en: 'Site administration' }, name: { zh: '查看审计日志', en: 'View audit logs' }, roles: { zh: '站点管理员、审核员', en: 'Site administrators, Reviewers' }, enabled: true }
];

function PermissionsView({ english, common }: { english: boolean; common: typeof copy.zh | typeof copy.en }) {
  return (
    <AdminPanel title={english ? 'Website permissions' : '网站权限列表'} action={<QuietButton icon={Plus}>{english ? 'Add policy' : '添加权限规则'}</QuietButton>}>
      <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>{english ? 'Category' : '类别'}</th><th>{english ? 'Permission' : '权限'}</th><th>{english ? 'Allowed roles' : '允许角色'}</th><th>{english ? 'Status' : '状态'}</th><th>{english ? 'Availability' : '开放使用'}</th><th><span className="sr-only">{common.more}</span></th></tr></thead><tbody>
        {permissionEntries.map((entry) => <tr key={entry.id}><td><span className="admin-table__muted">{english ? entry.category.en : entry.category.zh}</span></td><td><strong>{english ? entry.name.en : entry.name.zh}</strong><small className="admin-table__code">{entry.id}</small></td><td>{english ? entry.roles.en : entry.roles.zh}</td><td><StatusPill tone={entry.enabled ? 'success' : 'warning'}>{entry.enabled ? common.enabled : common.disabled}</StatusPill></td><td><Toggle label={entry.enabled ? common.enabled : common.disabled} defaultChecked={entry.enabled} /></td><td><MoreButton label={common.more} /></td></tr>)}
      </tbody></table></div>
    </AdminPanel>
  );
}

function ApiView({ english, common }: { english: boolean; common: typeof copy.zh | typeof copy.en }) {
  return (
    <div className="admin-stack">
      <AdminPanel title={english ? 'Mod submission API' : '网站提交模组 API'} action={<QuietButton icon={KeyRound}>{english ? 'Create key' : '创建密钥'}</QuietButton>}>
        <div className="admin-api-summary"><span><Code2 size={20} strokeWidth={2} aria-hidden="true" /><strong>POST /api/v1/projects</strong></span><StatusPill>{common.enabled}</StatusPill><span>{english ? '82,634 calls this month' : '本月调用 82,634 次'}</span><span>{english ? 'Rate limit: 120/min' : '频率限制：120 次/分钟'}</span></div>
      </AdminPanel>
      <AdminPanel title={english ? 'API logs' : 'API 日志'} action={<QuietButton icon={SlidersHorizontal}>{english ? 'Filters' : '筛选'}</QuietButton>}>
        <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>{english ? 'Time' : '时间'}</th><th>{english ? 'Endpoint' : '接口'}</th><th>{english ? 'Client' : '调用方'}</th><th>{english ? 'Status' : '状态'}</th><th>{english ? 'Latency' : '耗时'}</th></tr></thead><tbody>
          {[['14:28:43', 'POST /api/v1/projects', 'MVL Publisher', '201', '184 ms'], ['14:27:09', 'GET /api/v1/versions', 'Community Bot', '200', '42 ms'], ['14:24:51', 'POST /api/v1/files', 'mod-uploader', '429', '18 ms']].map((row) => <tr key={row[0]}>{row.map((cell, index) => <td key={cell}>{index === 3 ? <StatusPill tone={cell === '429' ? 'warning' : 'success'}>{cell}</StatusPill> : cell}</td>)}</tr>)}
        </tbody></table></div>
      </AdminPanel>
    </div>
  );
}

function StorageView({ english, common }: { english: boolean; common: typeof copy.zh | typeof copy.en }) {
  return (
    <div className="admin-grid admin-grid--two">
      <AdminPanel title={english ? 'Storage providers' : '存储服务配置'} action={<QuietButton icon={Save} primary>{common.save}</QuietButton>}>
        <div className="admin-provider-list">
          <div className="admin-provider"><span className="admin-provider__icon"><Cloud size={21} strokeWidth={2} /></span><div><strong>Amazon S3</strong><small>mods-production / ap-east-1</small></div><StatusPill>{english ? 'Connected' : '已连接'}</StatusPill><button type="button">{common.configure}</button></div>
          <div className="admin-provider"><span className="admin-provider__icon"><Database size={21} strokeWidth={2} /></span><div><strong>{english ? 'Dogecast S3' : '多吉云 S3'}</strong><small>vscn-static / Shanghai</small></div><StatusPill>{english ? 'Connected' : '已连接'}</StatusPill><button type="button">{common.configure}</button></div>
        </div>
      </AdminPanel>
      <AdminPanel title={english ? 'Storage statistics' : '存储统计'}>
        <div className="admin-storage-usage"><div><strong>384 GB</strong><span>/ 1 TB</span></div><div className="admin-progress"><span style={{ width: '38.4%' }} /></div><dl><div><dt>{english ? 'Mod files' : '模组文件'}</dt><dd>286 GB</dd></div><div><dt>{english ? 'Images' : '图片资源'}</dt><dd>74 GB</dd></div><div><dt>{english ? 'Other' : '其他文件'}</dt><dd>24 GB</dd></div></dl></div>
      </AdminPanel>
      <AdminPanel title={english ? 'Upload limits' : '上传限制'}>
        <div className="admin-form-grid"><label className="admin-field"><span>{english ? 'Maximum file size' : '单文件上限'}</span><div className="admin-field__unit"><input type="number" defaultValue="500" /><span>MB</span></div></label><label className="admin-field"><span>{english ? 'Temporary retention' : '临时文件保留'}</span><div className="admin-field__unit"><input type="number" defaultValue="24" /><span>{english ? 'hours' : '小时'}</span></div></label><label className="admin-field admin-field--full"><span>{english ? 'Allowed file types' : '允许的文件类型'}</span><input defaultValue=".zip, .tar.gz, .json, .png, .jpg, .webp" /></label></div>
      </AdminPanel>
      <AdminPanel title={english ? 'Image processing' : '图片处理'}>
        <div className="admin-setting-list"><Toggle label={english ? 'Generate WebP automatically' : '自动生成 WebP'} defaultChecked /><Toggle label={english ? 'Strip image metadata' : '移除图片元数据'} defaultChecked /><Toggle label={english ? 'Generate responsive thumbnails' : '生成响应式缩略图'} defaultChecked /></div>
      </AdminPanel>
    </div>
  );
}

function FilesView({ english, common }: { english: boolean; common: typeof copy.zh | typeof copy.en }) {
  const tabs = english ? [['Mod files', FileArchive], ['Images', FileImage], ['User avatars', UserRound], ['Temporary files', History], ['File types', FolderOpen]] as const : [['模组文件列表', FileArchive], ['图片资源', FileImage], ['用户头像', UserRound], ['临时文件', History], ['文件类型', FolderOpen]] as const;
  return (
    <AdminPanel title={english ? 'File library' : '文件资源库'} action={<div className="admin-actions"><QuietButton icon={Trash2}>{english ? 'Clean temporary files' : '清理临时文件'}</QuietButton><QuietButton icon={Upload} primary>{english ? 'Upload' : '上传文件'}</QuietButton></div>}>
      <div className="admin-subnav">{tabs.map(([label, Icon], index) => <button className={index === 0 ? 'admin-subnav__item admin-subnav__item--active' : 'admin-subnav__item'} type="button" key={label}><Icon size={17} strokeWidth={2} />{label}</button>)}</div>
      <div className="admin-table-tools"><label><Search size={17} strokeWidth={2} /><input placeholder={english ? 'Search by file name or project' : '按文件名或项目搜索'} /></label><QuietButton icon={SlidersHorizontal}>{english ? 'File type' : '文件类型'}</QuietButton></div>
      <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>{english ? 'File' : '文件'}</th><th>{english ? 'Project' : '所属项目'}</th><th>{english ? 'Type' : '类型'}</th><th>{english ? 'Size' : '大小'}</th><th>{english ? 'Uploaded' : '上传时间'}</th><th><span className="sr-only">{common.more}</span></th></tr></thead><tbody>
        <tr><td colSpan={6} className="admin-table__empty">{common.noData}</td></tr>
      </tbody></table></div>
    </AdminPanel>
  );
}

function AccountsView({ english, common }: { english: boolean; common: typeof copy.zh | typeof copy.en }) {
  return (
    <div className="admin-stack">
      <AdminPanel title={english ? 'Users' : '用户列表'} action={<QuietButton icon={Search}>{common.search}</QuietButton>}>
        <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>{english ? 'User' : '用户'}</th><th>{english ? 'Linked identity' : '绑定身份'}</th><th>{english ? 'Organizations' : '所属组织'}</th><th>{english ? 'Last active' : '最近活动'}</th><th>{english ? 'Status' : '状态'}</th><th><span className="sr-only">{common.more}</span></th></tr></thead><tbody>
          {[["Mira", english ? 'Community + Game' : '社区 + 游戏', 'Stoneworks', english ? '2 min ago' : '2 分钟前'], ['Aria', english ? 'Community' : '社区', 'Stoneworks', english ? '1 hour ago' : '1 小时前'], ['Toma', english ? 'Game' : '游戏', '-', english ? 'Yesterday' : '昨天']].map((row) => <tr key={row[0]}><td><span className="admin-user"><span>{row[0].slice(0, 1)}</span><strong>{row[0]}</strong></span></td>{row.slice(1).map((cell) => <td key={cell}>{cell}</td>)}<td><StatusPill>{english ? 'Active' : '正常'}</StatusPill></td><td><MoreButton label={common.more} /></td></tr>)}
        </tbody></table></div>
      </AdminPanel>
      <div className="admin-grid admin-grid--two">
        <AdminPanel title={english ? 'Organizations' : '组织列表'} action={<div className="admin-actions"><QuietButton icon={Wrench}>{english ? 'Organization settings' : '组织设置'}</QuietButton><QuietButton icon={Plus}>{english ? 'Create organization' : '创建组织'}</QuietButton></div>}><ul className="admin-entity-list"><li><span className="admin-user"><span>S</span><span><strong>Stoneworks</strong><small>{english ? '8 members · 14 projects' : '8 位成员 · 14 个项目'}</small></span></span><ChevronRight size={18} /></li><li><span className="admin-user"><span>V</span><span><strong>VSCN Studio</strong><small>{english ? '5 members · 7 projects' : '5 位成员 · 7 个项目'}</small></span></span><ChevronRight size={18} /></li></ul></AdminPanel>
        <AdminPanel title={english ? 'User activity logs' : '用户日志'}><ul className="admin-activity-list"><li><LogIn size={17} /><span><strong>Mira</strong>{english ? ' signed in through community OIDC' : ' 通过社区 OIDC 登录'}</span><time>{english ? '2 min ago' : '2 分钟前'}</time></li><li><Wrench size={17} /><span><strong>Aria</strong>{english ? ' updated an organization role' : ' 更新了组织成员角色'}</span><time>{english ? '1 hour ago' : '1 小时前'}</time></li></ul></AdminPanel>
      </div>
    </div>
  );
}

function ContentView({ english, common }: { english: boolean; common: typeof copy.zh | typeof copy.en }) {
  const modules = english
    ? [['Projects', '1,284', PackageSearch], ['Categories', '24', Blocks], ['Tags', '168', Tags], ['Game versions', '12', Gamepad2], ['Comments', '8,642', MessageSquare], ['Announcements', '6', BellRing]] as const
    : [['模组列表', '1,284', PackageSearch], ['分类管理', '24', Blocks], ['标签管理', '168', Tags], ['游戏版本管理', '12', Gamepad2], ['评论管理', '8,642', MessageSquare], ['公告管理', '6', BellRing]] as const;
  return (
    <>
      <div className="admin-module-grid">{modules.map(([label, count, Icon]) => <button className="admin-module" type="button" key={label}><span><Icon size={20} strokeWidth={2} /></span><strong>{label}</strong><small>{count}</small><ChevronRight size={17} /></button>)}</div>
      <AdminPanel title={english ? 'Recent projects' : '最近模组'} action={<div className="admin-actions"><QuietButton icon={SlidersHorizontal}>{english ? 'Manage categories' : '分类配置'}</QuietButton><QuietButton icon={Tags}>{english ? 'Merge tags' : '标签合并/迁移'}</QuietButton><QuietButton icon={Plus} primary>{english ? 'Add' : '添加内容'}</QuietButton></div>}>
        <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>{english ? 'Project' : '模组'}</th><th>{english ? 'Owner' : '所有者'}</th><th>{english ? 'Category' : '分类'}</th><th>{english ? 'Version' : '游戏版本'}</th><th>{english ? 'Status' : '状态'}</th><th><span className="sr-only">{common.more}</span></th></tr></thead><tbody>
          <tr><td colSpan={6} className="admin-table__empty">{common.noData}</td></tr>
        </tbody></table></div>
      </AdminPanel>
    </>
  );
}

function ReviewView({ english, common }: { english: boolean; common: typeof copy.zh | typeof copy.en }) {
  return (
    <div className="admin-grid admin-grid--two">
      <AdminPanel title={english ? 'Malware detection' : '恶意文件检测'}>
        <div className="admin-scan"><span className="admin-scan__icon"><Shield size={30} strokeWidth={2} /></span><div><strong>{english ? 'Scanner is active' : '文件扫描服务运行中'}</strong><span>{english ? '1,842 files scanned in the last 24 hours' : '最近 24 小时已扫描 1,842 个文件'}</span></div><StatusPill>{common.normal}</StatusPill></div>
        <dl className="admin-review-stats"><div><dt>{english ? 'Pending' : '等待扫描'}</dt><dd>3</dd></div><div><dt>{english ? 'Suspicious' : '可疑文件'}</dt><dd>1</dd></div><div><dt>{english ? 'Blocked' : '已拦截'}</dt><dd>12</dd></div></dl>
      </AdminPanel>
      <AdminPanel title={english ? 'Review queue' : '待审核内容'}><ul className="admin-review-list"><li><span><MessageSquare size={18} /><span><strong>{english ? 'Reported comment' : '被举报的评论'}</strong><small>{english ? '3 reports need review' : '3 位用户举报，等待处理'}</small></span></span><StatusPill tone="neutral">{english ? 'Queued' : '队列中'}</StatusPill></li></ul></AdminPanel>
      <AdminPanel title={english ? 'Review history' : '审核历史'} className="admin-panel--full"><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>{english ? 'Time' : '时间'}</th><th>{english ? 'Item' : '审核对象'}</th><th>{english ? 'Result' : '结果'}</th><th>{english ? 'Reviewer' : '审核人'}</th></tr></thead><tbody><tr><td colSpan={4} className="admin-table__empty">{common.noData}</td></tr></tbody></table></div></AdminPanel>
    </div>
  );
}

function LogsView({ english, common }: { english: boolean; common: typeof copy.zh | typeof copy.en }) {
  const tabs = english ? ['Login logs', 'Operation logs', 'API logs', 'Upload logs', 'Error logs', 'Security logs'] : ['登录日志', '操作日志', 'API 日志', '上传日志', '错误日志', '安全日志'];
  return (
    <AdminPanel title={english ? 'System logs' : '系统日志'} action={<QuietButton icon={Download}>{english ? 'Export logs' : '导出日志'}</QuietButton>}>
      <div className="admin-subnav">{tabs.map((label, index) => <button className={index === 0 ? 'admin-subnav__item admin-subnav__item--active' : 'admin-subnav__item'} type="button" key={label}>{label}</button>)}</div>
      <div className="admin-table-tools"><label><Search size={17} /><input placeholder={english ? 'Search logs' : '搜索日志'} /></label><QuietButton icon={SlidersHorizontal}>{english ? 'Level & time' : '级别与时间'}</QuietButton></div>
      <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>{english ? 'Time' : '时间'}</th><th>{english ? 'Level' : '级别'}</th><th>{english ? 'User / Service' : '用户 / 服务'}</th><th>{english ? 'Event' : '事件'}</th><th>{english ? 'IP address' : 'IP 地址'}</th></tr></thead><tbody>
        <tr><td>2026-08-06 14:28:43</td><td><StatusPill>INFO</StatusPill></td><td>Mira</td><td>{english ? 'Community OIDC sign-in succeeded' : '社区 OIDC 登录成功'}</td><td>203.0.113.24</td></tr><tr><td>2026-08-06 14:02:11</td><td><StatusPill tone="warning">WARN</StatusPill></td><td>auth-service</td><td>{english ? 'Activation code attempt rejected' : '邮箱激活码验证失败'}</td><td>198.51.100.8</td></tr><tr><td>2026-08-06 13:54:02</td><td><StatusPill tone="neutral">AUDIT</StatusPill></td><td>Aria</td><td>{english ? 'Updated project category' : '修改了项目分类'}</td><td>203.0.113.19</td></tr>
      </tbody></table></div>
    </AdminPanel>
  );
}

function UpdatesView({ english, common }: { english: boolean; common: typeof copy.zh | typeof copy.en }) {
  return (
    <div className="admin-grid admin-grid--two">
      <AdminPanel title={english ? 'Website version' : '网站版本'}>
        <div className="admin-version"><span className="admin-version__icon"><Gauge size={26} strokeWidth={2} /></span><div><span>VSCN Mod DB</span><strong>v0.1.0</strong><small>{english ? 'Current version is up to date' : '当前已是最新版本'}</small></div><StatusPill>{english ? 'Latest' : '最新'}</StatusPill></div>
      </AdminPanel>
      <AdminPanel title={english ? 'Backup schedule' : '自动备份设置'} action={<QuietButton icon={Save}>{common.save}</QuietButton>}><div className="admin-setting-list"><Toggle label={english ? 'Database backups' : '数据库自动备份'} defaultChecked /><Toggle label={english ? 'File index backups' : '文件索引自动备份'} defaultChecked /></div><label className="admin-field admin-field--spaced"><span>{english ? 'Retention period' : '备份保留时间'}</span><span className="admin-select-wrap"><select defaultValue="30"><option value="7">7 {english ? 'days' : '天'}</option><option value="30">30 {english ? 'days' : '天'}</option><option value="90">90 {english ? 'days' : '天'}</option></select><ChevronDown size={16} strokeWidth={2} aria-hidden="true" /></span></label></AdminPanel>
      <AdminPanel title={english ? 'Data backups' : '数据备份'} action={<QuietButton icon={Database} primary>{english ? 'Create backup' : '立即备份'}</QuietButton>}>
        <ul className="admin-backup-list"><li><span><FileArchive size={18} /><span><strong>backup-2026-08-06-0300</strong><small>2.8 GB · 2026-08-06 03:00</small></span></span><button type="button"><ArchiveRestore size={17} />{english ? 'Restore' : '恢复'}</button></li><li><span><FileArchive size={18} /><span><strong>backup-2026-08-05-0300</strong><small>2.7 GB · 2026-08-05 03:00</small></span></span><button type="button"><ArchiveRestore size={17} />{english ? 'Restore' : '恢复'}</button></li></ul>
      </AdminPanel>
      <AdminPanel title={english ? 'Update & data history' : '更新记录与数据日志'}><ul className="admin-activity-list"><li><CheckCircle2 size={17} /><span>{english ? 'Database backup completed' : '数据库备份完成'}</span><time>2026-08-06 03:02</time></li><li><RefreshCcw size={17} /><span>{english ? 'Updated website to v0.1.0' : '网站更新至 v0.1.0'}</span><time>2026-08-01 20:18</time></li><li><ArchiveRestore size={17} /><span>{english ? 'Restore verification passed' : '数据恢复校验通过'}</span><time>2026-07-28 09:42</time></li></ul></AdminPanel>
    </div>
  );
}

export function AdminDashboard() {
  const language = useSiteLanguage();
  const english = language === 'en';
  const common = english ? copy.en : copy.zh;
  const [activeSection, setActiveSection] = useState<AdminSection>('permissions');
  const [navigationOpen, setNavigationOpen] = useState(false);
  const activeItem = navigation.find((item) => item.id === activeSection) ?? navigation[0];

  function renderContent() {
    switch (activeSection) {
      case 'permissions': return <PermissionsView english={english} common={common} />;
      case 'api': return <ApiView english={english} common={common} />;
      case 'storage': return <StorageView english={english} common={common} />;
      case 'files': return <FilesView english={english} common={common} />;
      case 'accounts': return <AccountsView english={english} common={common} />;
      case 'content': return <ContentView english={english} common={common} />;
      case 'review': return <ReviewView english={english} common={common} />;
      case 'logs': return <LogsView english={english} common={common} />;
      case 'updates': return <UpdatesView english={english} common={common} />;
      default: return <PermissionsView english={english} common={common} />;
    }
  }

  return (
    <div className="admin-page">
      <button className="admin-mobile-trigger" type="button" aria-label={common.openNavigation} aria-expanded={navigationOpen} onClick={() => setNavigationOpen(true)}><Menu size={19} strokeWidth={2} /><span>{common.admin}</span></button>
      <div className={navigationOpen ? 'admin-sidebar-backdrop admin-sidebar-backdrop--open' : 'admin-sidebar-backdrop'} onClick={() => setNavigationOpen(false)} aria-hidden="true" />
      <aside className={navigationOpen ? 'admin-sidebar admin-sidebar--open' : 'admin-sidebar'} aria-label={common.navigation}>
        <nav className="admin-nav">
          {navigation.map((item) => {
            const Icon = item.icon;
            const selected = item.id === activeSection;
            return <button className={selected ? 'admin-nav__item admin-nav__item--active' : 'admin-nav__item'} type="button" aria-current={selected ? 'page' : undefined} key={item.id} onClick={() => { setActiveSection(item.id); setNavigationOpen(false); }}><Icon size={19} strokeWidth={2} aria-hidden="true" /><span>{english ? item.label.en : item.label.zh}</span></button>;
          })}
        </nav>
      </aside>
      <section className="admin-workspace" aria-labelledby="admin-view-title">
        <header className="admin-workspace__header"><div><h1 id="admin-view-title">{english ? activeItem.label.en : activeItem.label.zh}</h1></div></header>
        <div className="admin-workspace__content">{renderContent()}</div>
      </section>
    </div>
  );
}
