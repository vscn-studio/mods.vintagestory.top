import { randomBytes, randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { describe, expect, it, vi } from 'vitest';
import { PATCH as adminAccountsPatch } from '@/app/api/admin/accounts/route';
import { PATCH as adminReviewsPatch } from '@/app/api/admin/reviews/route';
import { POST as officialLogin } from '@/app/api/auth/official/route';
import { POST as issueConfirmation } from '@/app/api/v1/confirmations/route';
import { POST as favoriteProject } from '@/app/api/v1/projects/[id]/favorite/route';
import { GET as getProject } from '@/app/api/v1/projects/[id]/route';
import { GET as listProjects } from '@/app/api/v1/projects/route';
import { GET as getUser } from '@/app/api/v1/users/[username]/route';
import { GET as getOrganization } from '@/app/api/v1/organizations/[slug]/route';
import { DELETE as deleteReleaseFile } from '@/app/api/v1/releases/[id]/files/route';
import { POST as publishRelease } from '@/app/api/v1/releases/[id]/publish/route';
import { GET as listOrganizations } from '@/app/api/v1/organizations/route';
import { GET as getOrganizationMembers } from '@/app/api/v1/organizations/[slug]/members/route';
import { POST as respondToOrganizationInvitation } from '@/app/api/v1/organization-invitations/[id]/route';
import { DELETE as archiveProject } from '@/app/api/v1/projects/[id]/route';
import { consumeActivationChallenge, createAccountSession, issueActivationChallenge } from '@/lib/auth-server';
import { issueConfirmation as issueServerConfirmation } from '@/lib/admin-auth';
import { getDb } from '@/lib/db';

const enabled = Boolean(process.env.DATABASE_URL);

async function responseJson(response: Response): Promise<{ data?: any; meta?: { page?: number; pageSize?: number; total?: number; totalPages?: number }; error?: { code?: string; message?: string } }> {
  return response.json() as Promise<{ data?: any; meta?: { page?: number; pageSize?: number; total?: number; totalPages?: number }; error?: { code?: string; message?: string } }>;
}

async function createTestAccount(db: PrismaClient, label: string, status: 'ACTIVE' | 'SUSPENDED' | 'BANNED' = 'ACTIVE') {
  const suffix = randomUUID().replace(/-/g, '');
  const id = `api_${label}_${suffix}`;
  const account = await db.account.create({ data: { id, username: id.slice(0, 78), displayName: `API ${label}`, bindEmail: `${id}@example.test`, status } });
  await db.identity.create({ data: { accountId: id, provider: 'OFFICIAL', subject: `api:${id}`, displayName: `API ${label}`, playerName: `API ${label}`, playerUid: `api:${id}` } });
  return account;
}

async function sessionHeaders(accountId: string) {
  const sessionResponse = new NextResponse();
  await createAccountSession(sessionResponse, accountId, new Request('http://localhost/api/test', { headers: { 'user-agent': 'vitest' } }));
  const sessionCookie = sessionResponse.cookies.get('mod_session')?.value;
  if (!sessionCookie) throw new Error('test session cookie was not created');
  const csrf = randomBytes(16).toString('hex');
  return { cookie: `mod_session=${sessionCookie}; vscn_csrf=${csrf}`, origin: 'http://localhost', 'x-csrf-token': csrf };
}

describe.skipIf(!enabled)('database API integration', () => {
  it('persists and consumes a high-risk confirmation token', async () => {
    const db = getDb() as PrismaClient;
    const accountId = `api_test_${randomUUID().replace(/-/g, '')}`;
    const subject = `api-test:${randomUUID()}`;
    const projectId = randomUUID();
    const account = await db.account.create({ data: { id: accountId, username: accountId.slice(0, 40), displayName: 'API test account', bindEmail: `${accountId}@example.test` } });
    await db.identity.create({ data: { accountId: account.id, provider: 'OFFICIAL', subject, displayName: 'API test player', playerName: 'API test player', playerUid: subject } });
    const project = await db.project.create({ data: { id: projectId, slug: `api-test-${accountId.slice(-12)}`, type: 'MOD', name: 'API test project', summary: 'API test project', ownerAccountId: account.id, creatorId: account.id } });
    await db.projectMember.create({ data: { projectId: project.id, accountId: account.id, role: 'OWNER' } });

    const sessionResponse = new NextResponse();
    await createAccountSession(sessionResponse, account.id, new Request('http://localhost/api/test', { headers: { 'user-agent': 'vitest' } }));
    const sessionCookie = sessionResponse.cookies.get('mod_session')?.value;
    expect(sessionCookie).toBeTruthy();
    const csrf = randomBytes(16).toString('hex');
    const cookie = `mod_session=${sessionCookie}; vscn_csrf=${csrf}`;
    const baseHeaders = { cookie, origin: 'http://localhost', 'x-csrf-token': csrf };

    try {
      const issueResponse = await issueConfirmation(new NextRequest('http://localhost/api/v1/confirmations', { method: 'POST', headers: { ...baseHeaders, 'content-type': 'application/json' }, body: JSON.stringify({ action: 'project.archive', resourceType: 'project', resourceId: project.id, confirmed: true }) }));
      expect(issueResponse.status).toBe(200);
      const issued = await responseJson(issueResponse);
      expect(issued.data?.token).toBeTruthy();

      const archiveRequest = () => new NextRequest(`http://localhost/api/v1/projects/${project.id}`, { method: 'DELETE', headers: { ...baseHeaders, 'x-confirmation-token': issued.data.token } });
      const first = await archiveProject(archiveRequest(), { params: Promise.resolve({ id: project.id }) });
      expect(first.status).toBe(200);
      const replay = await archiveProject(archiveRequest(), { params: Promise.resolve({ id: project.id }) });
      expect(replay.status).toBe(409);
      const replayPayload = await responseJson(replay);
      expect(replayPayload.error?.code).toBe('CONFIRMATION_REQUIRED');
    } finally {
      await db.project.delete({ where: { id: project.id } }).catch(() => undefined);
      await db.account.delete({ where: { id: account.id } }).catch(() => undefined);
    }
  });

  it('persists activation challenges and consumes them atomically', async () => {
    const db = getDb() as PrismaClient;
    const subject = `activation:${randomUUID()}`;
    const identity = { provider: 'official' as const, subject, displayName: 'Activation test player', playerName: 'Activation test player', playerUid: subject };
    const email = `${randomUUID()}@example.test`;
    try {
      const issued = await issueActivationChallenge(identity, email, '123456');
      expect(issued.ok).toBe(true);
      if (!issued.ok) return;
      const cooldown = await issueActivationChallenge(identity, email, '654321');
      expect(cooldown.ok).toBe(false);
      const consumed = await Promise.all([
        consumeActivationChallenge(identity, email, '123456'),
        consumeActivationChallenge(identity, email, '123456')
      ]);
      expect(consumed.sort()).toEqual(['invalid', 'ok']);

      const second = await issueActivationChallenge(identity, email, '123456');
      expect(second.ok).toBe(true);
      for (let attempt = 0; attempt < 4; attempt += 1) {
        expect(await consumeActivationChallenge(identity, email, '000000')).toBe('invalid');
      }
      expect(await consumeActivationChallenge(identity, email, '000000')).toBe('locked');
      expect(await consumeActivationChallenge(identity, email, '123456')).toBe('invalid');
    } finally {
      await db.activationChallenge.deleteMany({ where: { provider: 'OFFICIAL', subject } }).catch(() => undefined);
    }
  });

  it('honors an organization owner column when the membership row is missing', async () => {
    const db = getDb() as PrismaClient;
    const owner = await createTestAccount(db, 'org-owner');
    const organization = await db.organization.create({ data: { slug: `api-owner-${randomUUID().slice(0, 10)}`, name: 'Owner truth test', visibility: 'PRIVATE', ownerId: owner.id } });
    try {
      const headers = await sessionHeaders(owner.id);
      const response = await getOrganizationMembers(new NextRequest(`http://localhost/api/v1/organizations/${organization.slug}/members`, { headers }), { params: Promise.resolve({ slug: organization.slug }) });
      expect(response.status).toBe(200);
      const payload = await responseJson(response);
      expect(payload.data?.[0]).toMatchObject({ id: owner.id, role: 'owner' });
    } finally {
      await db.organization.delete({ where: { id: organization.id } }).catch(() => undefined);
      await db.account.delete({ where: { id: owner.id } }).catch(() => undefined);
    }
  });

  it('lists only the active actor organizations and returns management capabilities', async () => {
    const db = getDb() as PrismaClient;
    const owner = await createTestAccount(db, 'org-list-owner');
    const organization = await db.organization.create({ data: { slug: `api-mine-${randomUUID().slice(0, 10)}`, name: 'Mine organization', ownerId: owner.id, members: { create: { accountId: owner.id, role: 'OWNER' } } } });
    try {
      const headers = await sessionHeaders(owner.id);
      const response = await listOrganizations(new NextRequest('http://localhost/api/v1/organizations?mine=true&pageSize=60', { headers }));
      if (!response) throw new Error('organization list response was not created');
      expect(response.status).toBe(200);
      const payload = await responseJson(response);
      const item = payload.data?.find((candidate: any) => candidate.id === organization.id);
      expect(item).toMatchObject({ id: organization.id, viewer: { role: 'owner' } });
      expect(item.viewer.capabilities).toEqual(expect.arrayContaining(['manage', 'project.manage', 'transfer']));
    } finally {
      await db.organization.delete({ where: { id: organization.id } }).catch(() => undefined);
      await db.account.delete({ where: { id: owner.id } }).catch(() => undefined);
    }
  });

  it('does not expose private or draft data to inactive accounts', async () => {
    const db = getDb() as PrismaClient;
    const owner = await createTestAccount(db, 'resource-owner');
    const inactive = await createTestAccount(db, 'resource-banned', 'BANNED');
    const privateProject = await db.project.create({ data: { slug: `api-private-${randomUUID().slice(0, 10)}`, type: 'MOD', name: 'Private test project', summary: 'Private test project', visibility: 'PRIVATE', ownerAccountId: owner.id, creatorId: owner.id } });
    const publicProject = await db.project.create({ data: { slug: `api-public-${randomUUID().slice(0, 10)}`, type: 'MOD', name: 'Public test project', summary: 'Public test project', ownerAccountId: owner.id, creatorId: owner.id } });
    await db.projectMember.createMany({ data: [
      { projectId: privateProject.id, accountId: owner.id, role: 'OWNER' },
      { projectId: privateProject.id, accountId: inactive.id, role: 'VIEWER' },
      { projectId: publicProject.id, accountId: owner.id, role: 'OWNER' },
      { projectId: publicProject.id, accountId: inactive.id, role: 'VIEWER' }
    ] });
    await db.release.create({ data: { projectId: publicProject.id, version: '1.0.0', status: 'DRAFT', createdById: owner.id } });
    try {
      const headers = await sessionHeaders(inactive.id);
      const privateResponse = await getProject(new NextRequest(`http://localhost/api/v1/projects/${privateProject.id}`, { headers }), { params: Promise.resolve({ id: privateProject.id }) });
      expect(privateResponse.status).toBe(404);
      const mineResponse = await listProjects(new NextRequest('http://localhost/api/v1/projects?mine=true', { headers }));
      expect(mineResponse).toBeDefined();
      expect(mineResponse?.status).toBe(403);
      const publicResponse = await getProject(new NextRequest(`http://localhost/api/v1/projects/${publicProject.id}`, { headers }), { params: Promise.resolve({ id: publicProject.id }) });
      expect(publicResponse.status).toBe(200);
      const publicPayload = await responseJson(publicResponse);
      expect(publicPayload.data?.releases).toEqual([]);
    } finally {
      await db.project.deleteMany({ where: { id: { in: [privateProject.id, publicProject.id] } } }).catch(() => undefined);
      await db.account.delete({ where: { id: owner.id } }).catch(() => undefined);
      await db.account.delete({ where: { id: inactive.id } }).catch(() => undefined);
    }
  });

  it('does not expose a profile owner private organization to unrelated visitors', async () => {
    const db = getDb() as PrismaClient;
    const owner = await createTestAccount(db, 'private-profile-owner');
    const visitor = await createTestAccount(db, 'private-profile-visitor');
    const organization = await db.organization.create({
      data: {
        slug: `api-private-profile-${randomUUID().slice(0, 10)}`,
        name: 'Private profile organization',
        visibility: 'PRIVATE',
        ownerId: owner.id,
        members: { create: { accountId: owner.id, role: 'OWNER' } }
      }
    });
    try {
      const params = { params: Promise.resolve({ username: owner.username }) };
      const anonymous = await getUser(new NextRequest(`http://localhost/api/v1/users/${owner.username}`), params);
      if (!anonymous) throw new Error('profile response was not created');
      expect(anonymous.status).toBe(200);
      expect((await responseJson(anonymous)).data?.organizations).not.toContainEqual(expect.objectContaining({ slug: organization.slug }));

      const visitorHeaders = await sessionHeaders(visitor.id);
      const unrelated = await getUser(new NextRequest(`http://localhost/api/v1/users/${owner.username}`, { headers: visitorHeaders }), params);
      if (!unrelated) throw new Error('profile response was not created');
      expect(unrelated.status).toBe(200);
      expect((await responseJson(unrelated)).data?.organizations).not.toContainEqual(expect.objectContaining({ slug: organization.slug }));

      const ownerHeaders = await sessionHeaders(owner.id);
      const ownProfile = await getUser(new NextRequest(`http://localhost/api/v1/users/${owner.username}`, { headers: ownerHeaders }), params);
      if (!ownProfile) throw new Error('profile response was not created');
      expect(ownProfile.status).toBe(200);
      expect((await responseJson(ownProfile)).data?.organizations).toContainEqual(expect.objectContaining({ slug: organization.slug, role: 'owner' }));
    } finally {
      await db.organization.delete({ where: { id: organization.id } }).catch(() => undefined);
      await db.account.delete({ where: { id: owner.id } }).catch(() => undefined);
      await db.account.delete({ where: { id: visitor.id } }).catch(() => undefined);
    }
  });

  it('paginates profile projects by type and keeps private organization projects scoped to authorized members', async () => {
    const db = getDb() as PrismaClient;
    const owner = await createTestAccount(db, 'profile-page-owner');
    const member = await createTestAccount(db, 'profile-page-member');
    const outsider = await createTestAccount(db, 'profile-page-outsider');
    const suffix = randomUUID().slice(0, 10);
    const personalProjects = await Promise.all([
      db.project.create({ data: { slug: `api-profile-mod-a-${suffix}`, type: 'MOD', name: 'Profile mod A', summary: 'Profile mod A', downloadCount: 3, followerCount: 1, ownerAccountId: owner.id, creatorId: owner.id, members: { create: { accountId: owner.id, role: 'OWNER' } } } }),
      db.project.create({ data: { slug: `api-profile-mod-b-${suffix}`, type: 'MOD', name: 'Profile mod B', summary: 'Profile mod B', downloadCount: 5, followerCount: 2, ownerAccountId: owner.id, creatorId: owner.id, members: { create: { accountId: owner.id, role: 'OWNER' } } } }),
      db.project.create({ data: { slug: `api-profile-pack-${suffix}`, type: 'MODPACK', name: 'Profile pack', summary: 'Profile pack', downloadCount: 7, followerCount: 3, ownerAccountId: owner.id, creatorId: owner.id, members: { create: { accountId: owner.id, role: 'OWNER' } } } }),
      db.project.create({ data: { slug: `api-profile-private-${suffix}`, type: 'MOD', name: 'Profile private mod', summary: 'Profile private mod', visibility: 'PRIVATE', downloadCount: 11, followerCount: 4, ownerAccountId: owner.id, creatorId: owner.id, members: { create: [{ accountId: owner.id, role: 'OWNER' }, { accountId: member.id, role: 'VIEWER' }] } } })
    ]);
    const organization = await db.organization.create({ data: { slug: `api-profile-org-${suffix}`, name: 'Profile paging organization', ownerId: owner.id, members: { create: { accountId: owner.id, role: 'OWNER' } } } });
    const [publicOrganizationProject, memberOrganizationProject, hiddenOrganizationProject] = await Promise.all([
      db.project.create({ data: { slug: `api-org-public-${suffix}`, type: 'MOD', name: 'Public organization project', summary: 'Public organization project', ownerOrganizationId: organization.id, creatorId: owner.id, members: { create: { accountId: owner.id, role: 'MAINTAINER' } } } }),
      db.project.create({ data: { slug: `api-org-member-private-${suffix}`, type: 'MOD', name: 'Member private organization project', summary: 'Member private organization project', visibility: 'PRIVATE', ownerOrganizationId: organization.id, creatorId: owner.id, members: { create: [{ accountId: owner.id, role: 'MAINTAINER' }, { accountId: member.id, role: 'VIEWER' }] } } }),
      db.project.create({ data: { slug: `api-org-hidden-private-${suffix}`, type: 'MOD', name: 'Hidden private organization project', summary: 'Hidden private organization project', visibility: 'PRIVATE', ownerOrganizationId: organization.id, creatorId: owner.id, members: { create: { accountId: owner.id, role: 'MAINTAINER' } } } })
    ]);
    try {
      const userParams = { params: Promise.resolve({ username: owner.username }) };
      const anonymousUser = await getUser(new NextRequest(`http://localhost/api/v1/users/${owner.username}?type=mod&page=1&pageSize=1`), userParams);
      if (!anonymousUser) throw new Error('user profile response was not created');
      expect(anonymousUser.status).toBe(200);
      const anonymousUserPayload = await responseJson(anonymousUser);
      expect(anonymousUserPayload.meta).toMatchObject({ page: 1, pageSize: 1, total: 2, totalPages: 2 });
      expect(anonymousUserPayload.data?.projects).toHaveLength(1);
      expect(anonymousUserPayload.data?.projectStats).toMatchObject({ projects: 3, downloads: 15, followers: 6 });

      const memberHeaders = await sessionHeaders(member.id);
      const memberUser = await getUser(new NextRequest(`http://localhost/api/v1/users/${owner.username}?type=mod&page=2&pageSize=2`, { headers: memberHeaders }), userParams);
      if (!memberUser) throw new Error('member user profile response was not created');
      const memberUserPayload = await responseJson(memberUser);
      expect(memberUserPayload.meta).toMatchObject({ page: 2, total: 3, totalPages: 2 });
      expect(memberUserPayload.data?.projects).toHaveLength(1);
      expect(memberUserPayload.data?.projectStats).toMatchObject({ projects: 4, downloads: 26, followers: 10 });

      const packResponse = await getUser(new NextRequest(`http://localhost/api/v1/users/${owner.username}?type=modpack`, { headers: memberHeaders }), userParams);
      if (!packResponse) throw new Error('pack profile response was not created');
      const packPayload = await responseJson(packResponse);
      expect(packPayload.meta).toMatchObject({ total: 1 });
      expect(packPayload.data?.projects[0]).toMatchObject({ id: personalProjects[2].id, type: 'modpack' });

      const invalidType = await getUser(new NextRequest(`http://localhost/api/v1/users/${owner.username}?type=invalid-type`), userParams);
      if (!invalidType) throw new Error('invalid type response was not created');
      expect(invalidType.status).toBe(422);

      const organizationParams = { params: Promise.resolve({ slug: organization.slug }) };
      const outsiderResponse = await getOrganization(new NextRequest(`http://localhost/api/v1/organizations/${organization.slug}?type=mod`, { headers: await sessionHeaders(outsider.id) }), organizationParams);
      if (!outsiderResponse) throw new Error('outsider organization response was not created');
      const outsiderPayload = await responseJson(outsiderResponse);
      expect(outsiderPayload.meta).toMatchObject({ total: 1 });
      expect(outsiderPayload.data?.projects).toEqual([expect.objectContaining({ id: publicOrganizationProject.id })]);

      const memberResponse = await getOrganization(new NextRequest(`http://localhost/api/v1/organizations/${organization.slug}?type=mod`, { headers: memberHeaders }), organizationParams);
      if (!memberResponse) throw new Error('member organization response was not created');
      const memberPayload = await responseJson(memberResponse);
      expect(memberPayload.meta).toMatchObject({ total: 2 });
      expect(memberPayload.data?.projects.map((project: { id: string }) => project.id)).toEqual(expect.arrayContaining([publicOrganizationProject.id, memberOrganizationProject.id]));
      expect(memberPayload.data?.projects.map((project: { id: string }) => project.id)).not.toContain(hiddenOrganizationProject.id);
    } finally {
      await db.project.deleteMany({ where: { id: { in: [...personalProjects.map((project) => project.id), publicOrganizationProject.id, memberOrganizationProject.id, hiddenOrganizationProject.id] } } }).catch(() => undefined);
      await db.organization.delete({ where: { id: organization.id } }).catch(() => undefined);
      await db.account.delete({ where: { id: owner.id } }).catch(() => undefined);
      await db.account.delete({ where: { id: member.id } }).catch(() => undefined);
      await db.account.delete({ where: { id: outsider.id } }).catch(() => undefined);
    }
  });

  it('serializes competing invitation responses so membership matches the final response', async () => {
    const db = getDb() as PrismaClient;
    const owner = await createTestAccount(db, 'invitation-owner');
    const recipient = await createTestAccount(db, 'invitation-recipient');
    const organization = await db.organization.create({
      data: {
        slug: `api-invitation-${randomUUID().slice(0, 10)}`,
        name: 'Invitation race organization',
        ownerId: owner.id,
        members: { create: { accountId: owner.id, role: 'OWNER' } }
      }
    });
    const invitation = await db.organizationInvitation.create({
      data: {
        organizationId: organization.id,
        recipientId: recipient.id,
        invitedById: owner.id,
        role: 'MEMBER',
        expiresAt: new Date(Date.now() + 60_000)
      }
    });
    try {
      const headers = await sessionHeaders(recipient.id);
      const request = (action: 'accept' | 'decline') => new NextRequest(`http://localhost/api/v1/organization-invitations/${invitation.id}?action=${action}`, { method: 'POST', headers });
      const [accept, decline] = await Promise.all([
        respondToOrganizationInvitation(request('accept'), { params: Promise.resolve({ id: invitation.id }) }),
        respondToOrganizationInvitation(request('decline'), { params: Promise.resolve({ id: invitation.id }) })
      ]);
      expect([accept.status, decline.status].filter((status) => status === 200)).toHaveLength(1);
      expect([accept.status, decline.status].every((status) => status === 200 || status === 404)).toBe(true);

      const finalInvitation = await db.organizationInvitation.findUniqueOrThrow({ where: { id: invitation.id } });
      const membership = await db.organizationMember.findUnique({ where: { organizationId_accountId: { organizationId: organization.id, accountId: recipient.id } } });
      expect(['ACCEPTED', 'DECLINED']).toContain(finalInvitation.status);
      expect(Boolean(membership)).toBe(finalInvitation.status === 'ACCEPTED');
    } finally {
      await db.organization.delete({ where: { id: organization.id } }).catch(() => undefined);
      await db.account.delete({ where: { id: owner.id } }).catch(() => undefined);
      await db.account.delete({ where: { id: recipient.id } }).catch(() => undefined);
    }
  });

  it('serializes concurrent favorites and requires confirmation for account restrictions', async () => {
    const db = getDb() as PrismaClient;
    const owner = await createTestAccount(db, 'favorite-owner');
    const follower = await createTestAccount(db, 'favorite-user');
    const project = await db.project.create({ data: { slug: `api-favorite-${randomUUID().slice(0, 10)}`, type: 'MOD', name: 'Favorite test project', summary: 'Favorite test project', ownerAccountId: owner.id, creatorId: owner.id, members: { create: { accountId: owner.id, role: 'OWNER' } } } });
    const admin = await createTestAccount(db, 'account-admin');
    const target = await createTestAccount(db, 'account-target');
    await db.siteRoleAssignment.create({ data: { accountId: admin.id, role: 'ADMIN' } });
    try {
      const userHeaders = await sessionHeaders(follower.id);
      const favoriteRequest = () => new NextRequest(`http://localhost/api/v1/projects/${project.id}/favorite`, { method: 'POST', headers: userHeaders });
      const favoriteResponses = await Promise.all(Array.from({ length: 4 }, () => favoriteProject(favoriteRequest(), { params: Promise.resolve({ id: project.id }) })));
      expect(favoriteResponses.every((response) => response.status === 200)).toBe(true);
      expect(await db.favorite.count({ where: { projectId: project.id } })).toBe(1);
      expect((await db.project.findUniqueOrThrow({ where: { id: project.id }, select: { favoriteCount: true } })).favoriteCount).toBe(1);

      const adminHeaders = await sessionHeaders(admin.id);
      const accountRequest = (body: Record<string, unknown>, confirmationToken?: string) => new NextRequest('http://localhost/api/admin/accounts', { method: 'PATCH', headers: { ...adminHeaders, 'content-type': 'application/json', ...(confirmationToken ? { 'x-confirmation-token': confirmationToken } : {}) }, body: JSON.stringify(body) });
      const withoutConfirmation = await adminAccountsPatch(accountRequest({ accountId: target.id, status: 'SUSPENDED' }));
      expect(withoutConfirmation.status).toBe(409);
      const restriction = await issueServerConfirmation(db, admin.id, { action: 'admin.account.manage', resourceType: 'account', resourceId: target.id });
      const restricted = await adminAccountsPatch(accountRequest({ accountId: target.id, status: 'SUSPENDED' }, restriction.token));
      expect(restricted.status).toBe(200);
      const reactivated = await adminAccountsPatch(accountRequest({ accountId: target.id, status: 'ACTIVE' }));
      expect(reactivated.status).toBe(200);
      const roleWithoutConfirmation = await adminAccountsPatch(accountRequest({ accountId: target.id, addRoles: ['MODERATOR'] }));
      expect(roleWithoutConfirmation.status).toBe(409);
      const roleConfirmation = await issueServerConfirmation(db, admin.id, { action: 'admin.account.manage', resourceType: 'account', resourceId: target.id });
      const roleUpdated = await adminAccountsPatch(accountRequest({ accountId: target.id, addRoles: ['MODERATOR'] }, roleConfirmation.token));
      expect(roleUpdated.status).toBe(200);
    } finally {
      await db.project.delete({ where: { id: project.id } }).catch(() => undefined);
      await db.account.delete({ where: { id: owner.id } }).catch(() => undefined);
      await db.account.delete({ where: { id: follower.id } }).catch(() => undefined);
      await db.account.delete({ where: { id: admin.id } }).catch(() => undefined);
      await db.account.delete({ where: { id: target.id } }).catch(() => undefined);
    }
  });

  it('rejects file mutation after a release enters review', async () => {
    const db = getDb() as PrismaClient;
    const owner = await createTestAccount(db, 'pending-file-owner');
    const project = await db.project.create({ data: { slug: `api-pending-file-${randomUUID().slice(0, 10)}`, type: 'MOD', name: 'Pending file project', summary: 'Pending file project', ownerAccountId: owner.id, creatorId: owner.id, members: { create: { accountId: owner.id, role: 'OWNER' } } } });
    const release = await db.release.create({ data: { projectId: project.id, version: '1.0.0', status: 'PENDING_REVIEW', createdById: owner.id } });
    const file = await db.file.create({ data: { releaseId: release.id, objectKey: `test/pending-${randomUUID()}.zip`, name: 'pending.zip', mimeType: 'application/zip', size: BigInt(1), sha256: 'a'.repeat(64), scanStatus: 'CLEAN', uploadedById: owner.id } });
    try {
      const headers = await sessionHeaders(owner.id);
      const response = await deleteReleaseFile(new NextRequest(`http://localhost/api/v1/releases/${release.id}/files?fileId=${file.id}`, { method: 'DELETE', headers }), { params: Promise.resolve({ id: release.id }) });
      expect(response.status).toBe(409);
      expect((await responseJson(response)).error?.code).toBe('CONFLICT');
      expect(await db.file.findUnique({ where: { id: file.id }, select: { id: true } })).toBeTruthy();
    } finally {
      await db.project.delete({ where: { id: project.id } }).catch(() => undefined);
      await db.account.delete({ where: { id: owner.id } }).catch(() => undefined);
    }
  });

  it('serializes review and withdrawal so a withdrawn release cannot end published', async () => {
    const db = getDb() as PrismaClient;
    const owner = await createTestAccount(db, 'review-race-owner');
    const reviewer = await createTestAccount(db, 'review-race-reviewer');
    await db.siteRoleAssignment.create({ data: { accountId: reviewer.id, role: 'REVIEWER' } });
    const project = await db.project.create({ data: { slug: `api-review-race-${randomUUID().slice(0, 10)}`, type: 'MOD', name: 'Review race project', summary: 'Review race project', ownerAccountId: owner.id, creatorId: owner.id, members: { create: { accountId: owner.id, role: 'OWNER' } } } });
    const release = await db.release.create({ data: { projectId: project.id, version: '1.0.0', status: 'PENDING_REVIEW', createdById: owner.id } });
    const file = await db.file.create({ data: { releaseId: release.id, objectKey: `test/race-${randomUUID()}.zip`, name: 'race.zip', mimeType: 'application/zip', size: BigInt(1), sha256: 'b'.repeat(64), scanStatus: 'CLEAN', uploadedById: owner.id } });
    const task = await db.reviewTask.create({ data: { projectId: project.id, releaseId: release.id } });
    try {
      const ownerHeaders = await sessionHeaders(owner.id);
      const reviewerHeaders = await sessionHeaders(reviewer.id);
      const withdrawConfirmation = await issueServerConfirmation(db, owner.id, { action: 'release.withdraw', resourceType: 'release', resourceId: release.id });
      const reviewConfirmation = await issueServerConfirmation(db, reviewer.id, { action: 'admin.review.decide', resourceType: 'review_task', resourceId: task.id });
      const withdrawRequest = new NextRequest(`http://localhost/api/v1/releases/${release.id}/publish?action=withdraw`, { method: 'POST', headers: { ...ownerHeaders, 'x-confirmation-token': withdrawConfirmation.token } });
      const reviewRequest = new NextRequest('http://localhost/api/admin/reviews', { method: 'PATCH', headers: { ...reviewerHeaders, 'content-type': 'application/json', 'x-confirmation-token': reviewConfirmation.token }, body: JSON.stringify({ taskId: task.id, decision: 'approve' }) });
      const [withdrawResponse, reviewResponse] = await Promise.all([publishRelease(withdrawRequest, { params: Promise.resolve({ id: release.id }) }), adminReviewsPatch(reviewRequest)]);
      expect(withdrawResponse.status).toBe(200);
      expect([200, 409]).toContain(reviewResponse.status);
      expect((await db.release.findUniqueOrThrow({ where: { id: release.id } })).status).toBe('WITHDRAWN');
    } finally {
      await db.project.delete({ where: { id: project.id } }).catch(() => undefined);
      await db.account.delete({ where: { id: owner.id } }).catch(() => undefined);
      await db.account.delete({ where: { id: reviewer.id } }).catch(() => undefined);
      void file;
    }
  });

  it('does not create a session for a suspended official account', async () => {
    const db = getDb() as PrismaClient;
    const account = await createTestAccount(db, 'disabled-login', 'SUSPENDED');
    const playerUid = `disabled-${randomUUID()}`;
    await db.identity.update({ where: { provider_subject: { provider: 'OFFICIAL', subject: `api:${account.id}` } }, data: { subject: `vs:${playerUid}`, providerEmail: account.bindEmail } });
    const originalFetch = globalThis.fetch;
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('latestunstable')) return new Response('1.22.1', { status: 200 });
      return new Response(JSON.stringify({ valid: 1, uid: playerUid, playername: 'Disabled player' }), { status: 200, headers: { 'content-type': 'application/json' } });
    }));
    try {
      const csrf = randomBytes(16).toString('hex');
      const response = await officialLogin(new NextRequest('http://localhost/api/auth/official', { method: 'POST', headers: { origin: 'http://localhost', cookie: `vscn_csrf=${csrf}`, 'x-csrf-token': csrf, 'content-type': 'application/json' }, body: JSON.stringify({ account: account.bindEmail, password: 'not-a-real-password' }) }));
      expect(response.status).toBe(403);
      const payload = await response.json() as { code?: string };
      expect(payload.code).toBe('ACCOUNT_DISABLED');
      expect(response.cookies.get('mod_session')).toBeUndefined();
    } finally {
      globalThis.fetch = originalFetch;
      await db.account.delete({ where: { id: account.id } }).catch(() => undefined);
    }
  });
});
