import type { SiteRole } from '@prisma/client';
import { databaseReady, getDb } from '@/lib/db';
import type { SessionAccountSummary } from '@/lib/auth-server';
import { canProjectPermission, canReadProject, effectiveOrganizationRole, organizationCapabilities, type Actor } from '@/lib/authorization';
import { findProject, type FullProject } from '@/lib/project-service';

export type PageAccess = 'ok' | 'not-found' | 'unavailable';

function pageActor(account: SessionAccountSummary | null): Actor | null {
  if (!account) return null;
  const siteRoles = new Set<SiteRole>((account.siteRoles ?? []) as SiteRole[]);
  if (account.isAdmin) siteRoles.add('ADMIN');
  return { id: account.id, status: account.status ?? 'ACTIVE', hasOfficialIdentity: account.hasOfficialIdentity, siteRoles: [...siteRoles] };
}

export type ProjectPageType = 'MOD' | 'MODPACK' | 'THEME_PACK' | 'SERVER';

export function projectMatchesPageType(projectType: ProjectPageType, expectedTypes: ProjectPageType | readonly ProjectPageType[]): boolean {
  return Array.isArray(expectedTypes) ? expectedTypes.includes(projectType) : projectType === expectedTypes;
}

export async function readableProjectPage(
  idOrSlug: string,
  expectedType: ProjectPageType | readonly ProjectPageType[],
  account: SessionAccountSummary | null
): Promise<{ access: PageAccess; project: FullProject | null }> {
  const db = getDb();
  if (!db || !(await databaseReady())) return { access: 'unavailable', project: null };
  try {
    const project = await findProject(db, idOrSlug);
    if (!project || !projectMatchesPageType(project.type, expectedType) || !canReadProject(pageActor(account), project as never)) return { access: 'not-found', project: null };
    return { access: 'ok', project };
  } catch {
    return { access: 'unavailable', project: null };
  }
}

const projectManagementPermissions = ['update', 'member.manage', 'transfer', 'archive', 'release.create', 'release.publish', 'file.manage'] as const;

/** Keep management shells from rendering for a user who cannot mutate the resource. */
export async function manageableProjectPage(idOrSlug: string, account: SessionAccountSummary | null): Promise<PageAccess> {
  const db = getDb();
  if (!db || !(await databaseReady())) return 'unavailable';
  const actor = pageActor(account);
  if (!actor) return 'not-found';
  try {
    const project = await findProject(db, idOrSlug);
    if (!project) return 'not-found';
    return projectManagementPermissions.some((permission) => canProjectPermission(actor, project as never, permission))
      ? 'ok'
      : 'not-found';
  } catch {
    return 'unavailable';
  }
}

export async function readableOrganizationPage(slug: string, account: SessionAccountSummary | null): Promise<PageAccess> {
  const db = getDb();
  if (!db || !(await databaseReady())) return 'unavailable';
  try {
    const organization = await db.organization.findUnique({ where: { slug }, include: { members: true } });
    if (!organization || organization.archivedAt) return 'not-found';
    const actor = pageActor(account);
    const role = actor ? effectiveOrganizationRole(actor, organization) : null;
    if (organization.visibility === 'PRIVATE' && !role && !actor?.siteRoles.includes('ADMIN')) return 'not-found';
    return 'ok';
  } catch {
    return 'unavailable';
  }
}

/** Only organization owners and admins should receive the organization management UI. */
export async function manageableOrganizationPage(slug: string, account: SessionAccountSummary | null): Promise<PageAccess> {
  const db = getDb();
  if (!db || !(await databaseReady())) return 'unavailable';
  const actor = pageActor(account);
  if (!actor) return 'not-found';
  try {
    const organization = await db.organization.findUnique({ where: { slug }, include: { members: true } });
    if (!organization || organization.archivedAt) return 'not-found';
    return organizationCapabilities(actor, organization).some((capability) => capability === 'manage' || capability === 'transfer')
      ? 'ok'
      : 'not-found';
  } catch {
    return 'unavailable';
  }
}

export async function existingUserPage(username: string): Promise<PageAccess> {
  const db = getDb();
  if (!db || !(await databaseReady())) return 'unavailable';
  try {
    const account = await db.account.findUnique({ where: { username }, select: { id: true, status: true } });
    return account?.status === 'ACTIVE' ? 'ok' : 'not-found';
  } catch {
    return 'unavailable';
  }
}
