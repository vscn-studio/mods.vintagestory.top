import type { Account, Organization, OrganizationMember, OrganizationRole, Project, ProjectMember, ProjectRole, SiteRole } from '@prisma/client';
import { getDb } from '@/lib/db';
import { getSessionAccount } from '@/lib/auth-server';
import { jsonError } from '@/lib/api-errors';
import type { NextRequest } from 'next/server';

export type Actor = {
  id: string;
  status: string;
  hasOfficialIdentity: boolean;
  siteRoles: SiteRole[];
};

export type ProjectPermission =
  | 'read'
  | 'update'
  | 'member.manage'
  | 'transfer'
  | 'archive'
  | 'release.create'
  | 'release.publish'
  | 'file.manage';

export type OrganizationPermission = 'read' | 'manage' | 'project.manage' | 'transfer';

export const projectPermissions: readonly ProjectPermission[] = [
  'read',
  'update',
  'member.manage',
  'transfer',
  'archive',
  'release.create',
  'release.publish',
  'file.manage'
];

export const organizationPermissions: readonly OrganizationPermission[] = [
  'read',
  'manage',
  'project.manage',
  'transfer'
];

/** Only active accounts may exercise resource-scoped grants. */
export function getActiveActor(actor: Actor | null | undefined): Actor | null {
  return actor?.status === 'ACTIVE' ? actor : null;
}

export function siteRoleAllows(actor: Actor, role: SiteRole): boolean {
  return actor.siteRoles.includes('ADMIN') || actor.siteRoles.includes(role);
}

export function projectRoleAllows(role: ProjectRole, permission: ProjectPermission): boolean {
  if (role === 'OWNER') return true;
  if (role === 'MAINTAINER') return ['read', 'update', 'member.manage', 'release.create', 'release.publish', 'file.manage'].includes(permission);
  if (role === 'CONTRIBUTOR') return ['read', 'release.create', 'file.manage'].includes(permission);
  if (role === 'REVIEWER') return permission === 'read';
  return permission === 'read';
}

export function organizationRoleAllows(role: OrganizationRole, permission: OrganizationPermission): boolean {
  if (role === 'OWNER') return true;
  if (role === 'ADMIN') return ['read', 'manage', 'project.manage'].includes(permission);
  if (role === 'MAINTAINER') return ['read', 'project.manage'].includes(permission);
  return permission === 'read';
}

/** Resolve the role from the organization owner column first, then membership. */
export function effectiveOrganizationRole(
  actor: Actor,
  organization: Pick<Organization, 'ownerId'> & { members: Pick<OrganizationMember, 'accountId' | 'role'>[] }
): OrganizationRole | null {
  if (organization.ownerId === actor.id) return 'OWNER';
  return organization.members.find((member) => member.accountId === actor.id)?.role ?? null;
}

export async function getDatabaseActor(accountId: string): Promise<Actor | null> {
  const db = getDb();
  if (!db) {
    // The development-only fixture intentionally is not persisted. Keep it usable
    // for admin UI smoke tests while preserving the official-identity requirement.
    if (process.env.NODE_ENV === 'development' && process.env.MOD_AUTH_DEV_ACCOUNT_ENABLED === 'true' && accountId === 'mod_local_development_admin') {
      return { id: accountId, status: 'ACTIVE', hasOfficialIdentity: false, siteRoles: ['ADMIN'] };
    }
    return null;
  }
  const account = await db.account.findUnique({
    where: { id: accountId },
    include: { identities: true, siteRoles: true }
  });
  if (!account) {
    if (process.env.NODE_ENV === 'development' && process.env.MOD_AUTH_DEV_ACCOUNT_ENABLED === 'true' && accountId === 'mod_local_development_admin') {
      return { id: accountId, status: 'ACTIVE', hasOfficialIdentity: false, siteRoles: ['ADMIN'] };
    }
    return null;
  }
  const configuredGroup = (process.env.COMMUNITY_ADMIN_GROUP ?? '管理员').trim().toLocaleLowerCase();
  const oidcAdmin = Boolean(configuredGroup && account.identities.some((identity) => {
    if (identity.provider !== 'COMMUNITY' || !Array.isArray(identity.groups)) return false;
    return identity.groups.some((group) => typeof group === 'string' && group.trim().toLocaleLowerCase() === configuredGroup);
  }));
  const roles = new Set(account.siteRoles.map((assignment) => assignment.role));
  if (oidcAdmin) roles.add('ADMIN');
  return {
    id: account.id,
    status: account.status,
    hasOfficialIdentity: account.identities.some((identity) => identity.provider === 'OFFICIAL'),
    siteRoles: [...roles]
  };
}

export async function requireDatabaseActor(request: NextRequest): Promise<Actor | null> {
  const legacy = await getSessionAccount(request);
  if (!legacy) return null;
  return getDatabaseActor(legacy.id);
}

export async function getProjectForAuthorization(projectIdOrSlug: string): Promise<(Project & { members: ProjectMember[]; ownerOrganization: (Organization & { members: OrganizationMember[] }) | null }) | null> {
  const db = getDb();
  if (!db) return null;
  return db.project.findFirst({
    where: { OR: [{ id: projectIdOrSlug }, { slug: projectIdOrSlug }] },
    include: { members: true, ownerOrganization: { include: { members: true } } }
  });
}

export function effectiveProjectRole(
  actor: Actor,
  project: Project & { members: ProjectMember[]; ownerOrganization: (Organization & { members: OrganizationMember[] }) | null }
): ProjectRole | null {
  // The owner columns are the source of truth. Membership rows are kept for
  // collaboration, but an owner must retain access even if a legacy import
  // missed the corresponding membership row.
  if (project.ownerAccountId === actor.id) return 'OWNER';
  const direct = project.members.find((member) => member.accountId === actor.id)?.role;
  const orgMember = project.ownerOrganization?.members.find((member) => member.accountId === actor.id);
  const organizationRole = project.ownerOrganization?.ownerId === actor.id
    ? 'OWNER'
    : orgMember?.role === 'OWNER'
      ? 'OWNER'
      : orgMember?.role === 'ADMIN' || orgMember?.role === 'MAINTAINER'
        ? 'MAINTAINER'
        : orgMember
          ? 'VIEWER'
          : null;
  // Organization-level grants are additive. An explicit project Viewer row
  // must not silently remove the project-management rights of an organization
  // Admin or Owner.
  const rank: Record<ProjectRole, number> = { VIEWER: 1, REVIEWER: 2, CONTRIBUTOR: 3, MAINTAINER: 4, OWNER: 5 };
  if (!direct) return organizationRole;
  if (!organizationRole) return direct;
  return rank[direct] >= rank[organizationRole] ? direct : organizationRole;
}

/**
 * Organization membership is intentionally narrower than an equivalent
 * project role. An organization Maintainer can operate releases and files,
 * but cannot rewrite project metadata or its collaboration roster.
 */
function organizationProjectPermissionAllows(role: OrganizationRole, permission: ProjectPermission): boolean {
  if (role === 'OWNER') return true;
  if (role === 'ADMIN') return ['read', 'update', 'member.manage', 'release.create', 'release.publish', 'file.manage'].includes(permission);
  if (role === 'MAINTAINER') return ['read', 'release.create', 'release.publish', 'file.manage'].includes(permission);
  return permission === 'read';
}

export function canReadProject(actor: Actor | null, project: Project & { members: ProjectMember[]; ownerOrganization: (Organization & { members: OrganizationMember[] }) | null }): boolean {
  const activeActor = getActiveActor(actor);
  if (project.ownerOrganization?.archivedAt) return Boolean(activeActor && siteRoleAllows(activeActor, 'ADMIN'));
  if (project.status === 'ARCHIVED') {
    return Boolean(activeActor && (siteRoleAllows(activeActor, 'ADMIN') || canProjectPermission(activeActor, project, 'archive')));
  }
  if (project.visibility === 'PUBLIC') return true;
  return Boolean(activeActor && (siteRoleAllows(activeActor, 'ADMIN') || effectiveProjectRole(activeActor, project)));
}

export function canProjectPermission(actor: Actor, project: Project & { members: ProjectMember[]; ownerOrganization: (Organization & { members: OrganizationMember[] }) | null }, permission: ProjectPermission): boolean {
  if (actor.status !== 'ACTIVE') return false;
  if (siteRoleAllows(actor, 'ADMIN')) return true;
  if (project.ownerOrganization?.archivedAt) return false;
  // Archived projects remain readable to their owner for recovery, but all
  // ordinary mutations must stop until an administrator restores the project.
  if (project.status === 'ARCHIVED' && permission !== 'archive') return false;
  if (project.ownerAccountId === actor.id) return true;
  const directRole = project.members.find((member) => member.accountId === actor.id)?.role;
  if (directRole && projectRoleAllows(directRole, permission)) return true;
  const organizationRole = project.ownerOrganization
    ? effectiveOrganizationRole(actor, project.ownerOrganization)
    : null;
  return Boolean(organizationRole && organizationProjectPermissionAllows(organizationRole, permission));
}

/** Capabilities are presentation hints only; mutations still authorize server-side. */
export function projectCapabilities(actor: Actor | null | undefined, project: Project & { members: ProjectMember[]; ownerOrganization: (Organization & { members: OrganizationMember[] }) | null }): ProjectPermission[] {
  const activeActor = getActiveActor(actor);
  if (!activeActor) return [];
  return projectPermissions.filter((permission) => canProjectPermission(activeActor, project, permission)) as ProjectPermission[];
}

export function organizationCapabilities(actor: Actor | null | undefined, organization: Pick<Organization, 'ownerId' | 'archivedAt'> & { members: Pick<OrganizationMember, 'accountId' | 'role'>[] }): OrganizationPermission[] {
  const activeActor = getActiveActor(actor);
  if (!activeActor) return [];
  if (siteRoleAllows(activeActor, 'ADMIN')) return [...organizationPermissions];
  if (organization.archivedAt) return [];
  const role = effectiveOrganizationRole(activeActor, organization);
  return role ? organizationPermissions.filter((permission) => organizationRoleAllows(role, permission)) as OrganizationPermission[] : [];
}

export function authorizationError(request: NextRequest, authenticated: boolean, privateResource = false) {
  return jsonError(authenticated && !privateResource ? 'FORBIDDEN' : authenticated ? 'NOT_FOUND' : 'UNAUTHENTICATED', authenticated && !privateResource ? '没有执行此操作的权限。' : authenticated ? '资源不存在。' : '请先登录。', authenticated && !privateResource ? 403 : authenticated ? 404 : 401, request);
}
