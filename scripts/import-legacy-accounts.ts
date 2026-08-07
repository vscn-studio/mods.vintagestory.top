import { PrismaClient } from '@prisma/client';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { writeFile } from 'node:fs/promises';

type LegacyIdentity = { provider: 'official' | 'community'; subject: string; displayName: string; providerEmail?: string; providerEmailVerified?: boolean; username?: string; playerName?: string; playerUid?: string; avatarUrl?: string; groups?: string[] };
type LegacyAccount = LegacyIdentity & { id: string; bindEmail: string; createdAt: string; lastLoginAt: string; linkedIdentities?: LegacyIdentity[]; organizations?: string[]; ownedOrganizations?: string[] };

const db = new PrismaClient();
const dataDir = path.resolve(process.env.MOD_AUTH_DATA_DIR ?? path.join(process.cwd(), 'data'));

function slug(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || `legacy-${Date.now()}`;
}

function username(account: LegacyAccount): string {
  return (account.username ?? account.playerName ?? account.displayName).trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || `user-${account.id.slice(-8)}`;
}

async function main() {
  const file = path.join(dataDir, 'accounts.json');
  let accounts: LegacyAccount[];
  try { accounts = JSON.parse(await readFile(file, 'utf8')) as LegacyAccount[]; } catch { console.log(`No legacy account file at ${file}; nothing to import.`); return; }
  const report = { accounts: 0, identities: 0, organizations: 0, memberships: 0, conflicts: [] as string[] };
  for (const legacy of accounts) {
    const allIdentities = [legacy, ...(legacy.linkedIdentities ?? [])];
    let accountUsername = username(legacy);
    const occupied = await db.account.findFirst({ where: { username: accountUsername, NOT: { id: legacy.id } } });
    if (occupied) accountUsername = `${accountUsername.slice(0, 70)}-${legacy.id.slice(-6)}`;
    const bindEmail = legacy.bindEmail.trim().toLowerCase();
    try {
      await db.account.upsert({ where: { id: legacy.id }, create: { id: legacy.id, username: accountUsername, displayName: legacy.displayName, bindEmail, avatarUrl: legacy.avatarUrl, createdAt: new Date(legacy.createdAt), lastLoginAt: new Date(legacy.lastLoginAt) }, update: { username: accountUsername, displayName: legacy.displayName, bindEmail, avatarUrl: legacy.avatarUrl, lastLoginAt: new Date(legacy.lastLoginAt) } });
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002') {
        report.conflicts.push(`account ${legacy.id} conflicts on username or binding email and was skipped`);
        continue;
      }
      throw error;
    }
    report.accounts += 1;
    for (const identity of allIdentities) {
      const existingIdentity = await db.identity.findUnique({ where: { provider_subject: { provider: identity.provider === 'official' ? 'OFFICIAL' : 'COMMUNITY', subject: identity.subject } }, select: { accountId: true } });
      if (existingIdentity && existingIdentity.accountId !== legacy.id) {
        report.conflicts.push(`identity ${identity.provider}:${identity.subject} belongs to ${existingIdentity.accountId}, skipped for ${legacy.id}`);
        continue;
      }
      await db.identity.upsert({ where: { provider_subject: { provider: identity.provider === 'official' ? 'OFFICIAL' : 'COMMUNITY', subject: identity.subject } }, create: { accountId: legacy.id, provider: identity.provider === 'official' ? 'OFFICIAL' : 'COMMUNITY', subject: identity.subject, displayName: identity.displayName, providerEmail: identity.providerEmail, providerEmailVerified: identity.providerEmailVerified === true, username: identity.username, playerName: identity.playerName, playerUid: identity.playerUid, avatarUrl: identity.avatarUrl, groups: identity.groups ?? undefined }, update: { accountId: legacy.id, displayName: identity.displayName, providerEmail: identity.providerEmail, providerEmailVerified: identity.providerEmailVerified === true, username: identity.username, playerName: identity.playerName, playerUid: identity.playerUid, avatarUrl: identity.avatarUrl, groups: identity.groups ?? undefined } });
      report.identities += 1;
    }
    const organizationNames = [...new Set([...(legacy.organizations ?? []), ...(legacy.ownedOrganizations ?? [])])];
    for (const name of organizationNames) {
      const organizationSlug = slug(name);
      const existingOrganization = await db.organization.findUnique({ where: { slug: organizationSlug }, select: { id: true, name: true, ownerId: true } });
      if (existingOrganization && existingOrganization.name !== name) report.conflicts.push(`organization slug ${organizationSlug} maps both ${existingOrganization.name} and ${name}`);
      if (existingOrganization && existingOrganization.ownerId !== legacy.id && (legacy.ownedOrganizations ?? []).some((owned) => slug(owned) === organizationSlug)) report.conflicts.push(`organization ${organizationSlug} has owner ${existingOrganization.ownerId}; legacy owner ${legacy.id} retained as member`);
      const organization = await db.organization.upsert({ where: { slug: organizationSlug }, create: { slug: organizationSlug, name, ownerId: legacy.id }, update: {} });
      report.organizations += 1;
      const claimedOwner = (legacy.ownedOrganizations ?? []).some((owned) => slug(owned) === organizationSlug);
      // The Organization.ownerId column is authoritative. Do not create a
      // second OWNER membership when conflicting legacy arrays name two owners.
      const role = claimedOwner && organization.ownerId === legacy.id ? 'OWNER' : 'MEMBER';
      await db.organizationMember.upsert({ where: { organizationId_accountId: { organizationId: organization.id, accountId: legacy.id } }, create: { organizationId: organization.id, accountId: legacy.id, role }, update: { role } });
      report.memberships += 1;
    }
  }
  await writeFile(path.join(dataDir, 'legacy-import-report.json'), JSON.stringify(report, null, 2), 'utf8');
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => db.$disconnect());
