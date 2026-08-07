import { describe, expect, it } from 'vitest';
import { canProjectPermission, canReadProject, effectiveOrganizationRole, effectiveProjectRole, getActiveActor, organizationRoleAllows, projectRoleAllows } from '@/lib/authorization';
import { getSessionAccountSummary, hasOfficialIdentity, type ModAccount } from '@/lib/auth-server';
import { slugify } from '@/lib/project-service';
import { assertReleaseTransition, canTransitionRelease } from '@/lib/release-state';
import { projectMatchesPageType } from '@/lib/page-access';

const baseProject = { id: 'p', slug: 'p', type: 'MOD', name: 'p', nameEn: null, summary: 'p', summaryEn: null, description: null, descriptionEn: null, visibility: 'PRIVATE', status: 'ACTIVE', ownerAccountId: 'owner', ownerOrganizationId: null, creatorId: 'owner', license: null, repositoryUrl: null, issueUrl: null, wikiUrl: null, discordUrl: null, sponsorUrl: null, downloadCount: 0, followerCount: 0, favoriteCount: 0, createdAt: new Date(), updatedAt: new Date(), archivedAt: null, members: [{ accountId: 'owner', role: 'OWNER' }] as any, ownerOrganization: null } as any;

describe('identity eligibility', () => {
  it('detects an official identity even when community is primary', () => {
    const account: ModAccount = { id: 'a', provider: 'community', subject: 'c', displayName: 'Community', bindEmail: 'a@example.com', createdAt: '', lastLoginAt: '', linkedIdentities: [{ provider: 'official', subject: 'o', displayName: 'Player' }] };
    expect(hasOfficialIdentity(account)).toBe(true);
    expect(getSessionAccountSummary(account).hasOfficialIdentity).toBe(true);
    expect(getSessionAccountSummary(account).provider).toBe('community');
  });
});

describe('public project routes', () => {
  it('keeps theme packs and server tweaks on the existing mod detail route', () => {
    expect(projectMatchesPageType('MOD', ['MOD', 'THEME_PACK', 'SERVER'])).toBe(true);
    expect(projectMatchesPageType('THEME_PACK', ['MOD', 'THEME_PACK', 'SERVER'])).toBe(true);
    expect(projectMatchesPageType('SERVER', ['MOD', 'THEME_PACK', 'SERVER'])).toBe(true);
    expect(projectMatchesPageType('MODPACK', ['MOD', 'THEME_PACK', 'SERVER'])).toBe(false);
    expect(projectMatchesPageType('MODPACK', 'MODPACK')).toBe(true);
  });
});

describe('authorization matrix', () => {
  it('keeps viewer read-only', () => { expect(projectRoleAllows('VIEWER', 'read')).toBe(true); expect(projectRoleAllows('VIEWER', 'update')).toBe(false); expect(projectRoleAllows('MAINTAINER', 'release.publish')).toBe(true); });
  it('hides private projects from unrelated actors', () => { expect(canReadProject({ id: 'other', status: 'ACTIVE', hasOfficialIdentity: true, siteRoles: [] }, baseProject)).toBe(false); expect(canReadProject(null, { ...baseProject, visibility: 'PUBLIC' })).toBe(true); });
  it('maps organization maintainers to project maintainers for resource visibility', () => { const project = { ...baseProject, ownerOrganization: { ownerId: 'owner', archivedAt: null, members: [{ accountId: 'a', role: 'MAINTAINER' }] }, ownerOrganizationId: 'o', ownerAccountId: null }; expect(effectiveProjectRole({ id: 'a', status: 'ACTIVE', hasOfficialIdentity: true, siteRoles: [] }, project)).toBe('MAINTAINER'); });
  it('limits organization maintainers to releases and files unless they hold a direct project role', () => {
    const maintainer = { id: 'org-maintainer', status: 'ACTIVE', hasOfficialIdentity: true, siteRoles: [] } as any;
    const project = {
      ...baseProject,
      ownerAccountId: null,
      ownerOrganizationId: 'organization',
      members: [],
      ownerOrganization: { ownerId: 'org-owner', archivedAt: null, members: [{ accountId: maintainer.id, role: 'MAINTAINER' }] }
    } as any;
    expect(canProjectPermission(maintainer, project, 'release.create')).toBe(true);
    expect(canProjectPermission(maintainer, project, 'release.publish')).toBe(true);
    expect(canProjectPermission(maintainer, project, 'file.manage')).toBe(true);
    expect(canProjectPermission(maintainer, project, 'update')).toBe(false);
    expect(canProjectPermission(maintainer, project, 'member.manage')).toBe(false);
    expect(canProjectPermission(maintainer, project, 'transfer')).toBe(false);
    expect(canProjectPermission(maintainer, project, 'archive')).toBe(false);

    project.members.push({ accountId: maintainer.id, role: 'MAINTAINER' });
    expect(canProjectPermission(maintainer, project, 'update')).toBe(true);
    expect(canProjectPermission(maintainer, project, 'member.manage')).toBe(true);
  });
  it('enforces organization roles', () => { expect(organizationRoleAllows('ADMIN', 'manage')).toBe(true); expect(organizationRoleAllows('MEMBER', 'manage')).toBe(false); });
  it('treats the owner column as authoritative and excludes inactive actors', () => {
    const owner = { id: 'owner', status: 'ACTIVE', hasOfficialIdentity: true, siteRoles: [] } as any;
    expect(effectiveOrganizationRole(owner, { ownerId: 'owner', members: [] } as any)).toBe('OWNER');
    const inactive = { ...owner, status: 'BANNED' } as any;
    expect(getActiveActor(inactive)).toBeNull();
    expect(canReadProject(inactive, baseProject)).toBe(false);
  });
  it('keeps archived projects read-only for their owner', () => {
    const owner = { id: 'owner', status: 'ACTIVE', hasOfficialIdentity: true, siteRoles: [] } as any;
    const archived = { ...baseProject, status: 'ARCHIVED', ownerAccountId: owner.id } as any;
    expect(canReadProject(owner, archived)).toBe(true);
    expect(canProjectPermission(owner, archived, 'archive')).toBe(true);
    expect(canProjectPermission(owner, archived, 'update')).toBe(false);
    expect(canProjectPermission(owner, archived, 'release.create')).toBe(false);
  });
});

describe('release state and slugs', () => {
  it('allows only the documented publish flow', () => { expect(canTransitionRelease('DRAFT', 'PENDING_REVIEW')).toBe(true); expect(canTransitionRelease('DRAFT', 'PUBLISHED')).toBe(false); expect(() => assertReleaseTransition('PUBLISHED', 'DRAFT')).toThrow(); });
  it('normalizes and bounds project slugs', () => { expect(slugify('Hello World')).toBe('hello-world'); expect(slugify('')).toMatch(/^project-/); });
});
