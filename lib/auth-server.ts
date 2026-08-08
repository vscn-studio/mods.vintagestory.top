import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { cookies } from 'next/headers';
import type { NextRequest, NextResponse } from 'next/server';
import type { Prisma, SiteRole as PrismaSiteRole } from '@prisma/client';
import { getDb, databaseConfigured } from '@/lib/db';
import { verifyPassword } from '@/lib/password';

export type AuthProvider = 'official' | 'community';

export type PendingIdentity = {
  provider: AuthProvider;
  subject: string;
  displayName: string;
  providerEmail?: string;
  providerEmailVerified?: boolean;
  username?: string;
  playerName?: string;
  playerUid?: string;
  avatarUrl?: string;
  groups?: string[];
};

export type ModAccount = PendingIdentity & {
  id: string;
  bindEmail: string;
  createdAt: string;
  lastLoginAt: string;
  linkedIdentities?: PendingIdentity[];
  organizations?: string[];
  ownedOrganizations?: string[];
  organizationDetails?: Array<{ id: string; slug: string; name: string; role: string }>;
  status?: 'ACTIVE' | 'SUSPENDED' | 'BANNED';
  siteRoles?: string[];
  /** Stored-only fields. They are never included in account summaries. */
  passwordHash?: string;
  passwordSetAt?: string;
};

export type SessionAccountSummary = {
  id: string;
  displayName: string;
  username: string;
  provider: AuthProvider;
  avatarUrl?: string;
  isAdmin?: boolean;
  hasOfficialIdentity: boolean;
  siteRoles: string[];
  organizations: string[];
  ownedOrganizations: string[];
  organizationDetails?: Array<{ id: string; slug: string; name: string; role: string }>;
  status?: 'ACTIVE' | 'SUSPENDED' | 'BANNED';
};

export type IdentityAuthenticationResult =
  | { status: 'authenticated'; account: ModAccount }
  | { status: 'needs-binding' }
  | { status: 'provider-conflict'; provider: AuthProvider };

export class AccountBindingConflictError extends Error {
  constructor(readonly provider: AuthProvider) {
    super(`The email is already bound to another ${provider} account.`);
    this.name = 'AccountBindingConflictError';
  }
}

export function normalizeGroups(value: unknown): string[] {
  const values = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : [];
  const unique = [...new Set(
    values
      .filter((group): group is string => typeof group === 'string')
      .map((group) => group.trim())
      .filter((group) => group.length > 0 && group.length <= 64)
  )];
  const groups: string[] = [];
  let totalLength = 0;
  for (const group of unique) {
    if (groups.length >= 32 || totalLength + group.length > 2048) break;
    groups.push(group);
    totalLength += group.length;
  }
  return groups;
}

export function normalizeOrganizationNames(value: unknown): string[] {
  const values = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : [];
  return [...new Set(
    values
      .filter((organization): organization is string => typeof organization === 'string')
      .map((organization) => organization.trim())
      .filter((organization) => organization.length > 0 && organization.length <= 80)
  )].slice(0, 64);
}

export function isCommunityAdmin(account: ModAccount): boolean {
  const communityIdentity = accountIdentities(account).find((identity) => identity.provider === 'community');
  if (!communityIdentity) return false;
  const configuredGroup = (process.env.COMMUNITY_ADMIN_GROUP ?? '管理员').trim();
  if (!configuredGroup) return false;
  const expected = configuredGroup.toLocaleLowerCase();
  return (communityIdentity.groups ?? []).some((group) => group.trim().toLocaleLowerCase() === expected);
}

function identityMatches(left: PendingIdentity, right: PendingIdentity): boolean {
  return left.provider === right.provider && left.subject === right.subject;
}

type AccountIdentityFields = Pick<
  ModAccount,
  'provider' | 'subject' | 'displayName' | 'providerEmail' | 'providerEmailVerified' | 'username' | 'playerName' | 'playerUid' | 'avatarUrl' | 'groups' | 'linkedIdentities'
>;

function accountPrimaryIdentity(account: AccountIdentityFields): PendingIdentity {
  return {
    provider: account.provider,
    subject: account.subject,
    displayName: account.displayName,
    providerEmail: account.providerEmail,
    providerEmailVerified: account.providerEmailVerified,
    username: account.username,
    playerName: account.playerName,
    playerUid: account.playerUid,
    avatarUrl: account.avatarUrl,
    groups: account.groups
  };
}

export function accountIdentities(account: AccountIdentityFields): PendingIdentity[] {
  const primary = accountPrimaryIdentity(account);
  const linked = Array.isArray(account.linkedIdentities)
    ? account.linkedIdentities.filter((identity) => identity && identity.provider && identity.subject && identity.displayName)
    : [];
  return [primary, ...linked];
}

export function getAccountPrimaryIdentity(account: ModAccount): PendingIdentity {
  return accountIdentities(account).find((identity) => identity.provider === 'community') ?? accountPrimaryIdentity(account);
}

export function getAccountAvatarUrl(account: ModAccount): string | undefined {
  return accountIdentities(account).find((identity) => identity.provider === 'community')?.avatarUrl;
}

export function hasOfficialIdentity(account: ModAccount): boolean {
  return accountIdentities(account).some((identity) => identity.provider === 'official');
}

const PENDING_COOKIE = 'mod_pending_identity';
const VERIFIED_BINDING_COOKIE = 'mod_verified_binding';
const SESSION_COOKIE = 'mod_session';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 14;
const MIN_SESSION_SECRET_LENGTH = 32;
const ACTIVATION_CODE_TTL_MS = 10 * 60 * 1000;
const ACTIVATION_RESEND_COOLDOWN_MS = 60 * 1000;
const ACTIVATION_MAX_ATTEMPTS = 5;
const developmentSecret = randomBytes(32).toString('hex');
const developmentAccountTimestamp = '1970-01-01T00:00:00.000Z';

type ActivationChallenge = {
  id: string;
  provider: AuthProvider;
  subject: string;
  bindEmail: string;
  codeHash: string;
  createdAt: number;
  expiresAt: number;
  attempts: number;
};

let activationLock: Promise<void> = Promise.resolve();

function secret(): string {
  const configured = (process.env.MOD_AUTH_SESSION_SECRET ?? process.env.AUTH_SESSION_SECRET ?? '').trim();
  if (configured) {
    if (process.env.NODE_ENV === 'production' && configured.length < MIN_SESSION_SECRET_LENGTH) {
      throw new Error(`MOD_AUTH_SESSION_SECRET must contain at least ${MIN_SESSION_SECRET_LENGTH} characters in production`);
    }
    return configured;
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('MOD_AUTH_SESSION_SECRET must be configured in production');
  }
  return developmentSecret;
}

function encode(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function decode(value: string): string {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function sign(value: string): string {
  return createHmac('sha256', secret()).update(value).digest('base64url');
}

function seal<T>(value: T): string {
  const payload = encode(JSON.stringify(value));
  return `${payload}.${sign(payload)}`;
}

function encrypt<T>(value: T): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', createHash('sha256').update(secret()).digest(), iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  return `${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${ciphertext.toString('base64url')}`;
}

function decrypt<T>(value: string): T | null {
  const [ivRaw, tagRaw, ciphertextRaw] = value.split('.');
  if (!ivRaw || !tagRaw || !ciphertextRaw) return null;
  try {
    const decipher = createDecipheriv('aes-256-gcm', createHash('sha256').update(secret()).digest(), Buffer.from(ivRaw, 'base64url'));
    decipher.setAuthTag(Buffer.from(tagRaw, 'base64url'));
    return JSON.parse(Buffer.concat([decipher.update(Buffer.from(ciphertextRaw, 'base64url')), decipher.final()]).toString('utf8')) as T;
  } catch {
    return null;
  }
}

function unseal<T>(value: string): T | null {
  const [payload, signature] = value.split('.');
  if (!payload || !signature) return null;
  const expected = Buffer.from(sign(payload), 'utf8');
  const received = Buffer.from(signature, 'utf8');
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;
  try {
    return JSON.parse(decode(payload)) as T;
  } catch {
    return null;
  }
}

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge
  };
}

export function setPendingIdentity(response: NextResponse, identity: PendingIdentity): void {
  response.cookies.set(PENDING_COOKIE, encrypt(identity), cookieOptions(10 * 60));
}

export function getPendingIdentity(request: NextRequest): PendingIdentity | null {
  const raw = request.cookies.get(PENDING_COOKIE)?.value;
  if (!raw) return null;
  const identity = decrypt<PendingIdentity>(raw) ?? unseal<PendingIdentity>(raw);
  if (!identity || !identity.subject || !identity.displayName) return null;
  return identity;
}

export function clearPendingIdentity(response: NextResponse): void {
  response.cookies.set(PENDING_COOKIE, '', cookieOptions(0));
}

type VerifiedBinding = {
  provider: AuthProvider;
  subject: string;
  bindEmail: string;
  expiresAt: number;
};

export function setVerifiedBinding(response: NextResponse, identity: PendingIdentity, bindEmail: string): void {
  response.cookies.set(
    VERIFIED_BINDING_COOKIE,
    encrypt({ provider: identity.provider, subject: identity.subject, bindEmail, expiresAt: Date.now() + ACTIVATION_CODE_TTL_MS } satisfies VerifiedBinding),
    cookieOptions(Math.ceil(ACTIVATION_CODE_TTL_MS / 1000))
  );
}

export function getVerifiedBinding(request: NextRequest): VerifiedBinding | null {
  const raw = request.cookies.get(VERIFIED_BINDING_COOKIE)?.value;
  if (!raw) return null;
  const value = decrypt<VerifiedBinding>(raw) ?? unseal<VerifiedBinding>(raw);
  if (!value || !value.provider || !value.subject || !value.bindEmail || !Number.isFinite(value.expiresAt) || value.expiresAt <= Date.now()) return null;
  return value;
}

export function clearVerifiedBinding(response: NextResponse): void {
  response.cookies.set(VERIFIED_BINDING_COOKIE, '', cookieOptions(0));
}

export function setAccountSession(response: NextResponse, accountId: string): void {
  response.cookies.set(SESSION_COOKIE, seal({ accountId, issuedAt: Date.now() }), cookieOptions(SESSION_TTL_SECONDS));
}

export async function createAccountSession(
  response: NextResponse,
  accountId: string,
  request?: Request
): Promise<void> {
  const db = getDb();
  if (!db) {
    setAccountSession(response, accountId);
    return;
  }
  const rawToken = randomBytes(32).toString('base64url');
  const tokenHash = createHmac('sha256', secret()).update(`session:${rawToken}`).digest('hex');
  const session = await db.session.create({
    data: {
      accountId,
      tokenHash,
      expiresAt: new Date(Date.now() + SESSION_TTL_SECONDS * 1000),
      userAgent: request?.headers.get('user-agent')?.slice(0, 512),
      ipAddress: request?.headers.get('x-forwarded-for')?.split(',')[0]?.trim().slice(0, 64)
    }
  });
  response.cookies.set(SESSION_COOKIE, seal({ sessionId: session.id, token: rawToken }), cookieOptions(SESSION_TTL_SECONDS));
}

export async function revokeAccountSession(request: NextRequest): Promise<void> {
  const raw = request.cookies.get(SESSION_COOKIE)?.value;
  const session = raw ? unseal<{ sessionId?: string }>(raw) : null;
  const db = getDb();
  if (!db || !session?.sessionId) return;
  await db.session.updateMany({ where: { id: session.sessionId, revokedAt: null }, data: { revokedAt: new Date() } }).catch(() => undefined);
}

export function getSessionRecordId(request: NextRequest): string | null {
  const raw = request.cookies.get(SESSION_COOKIE)?.value;
  const session = raw ? unseal<{ sessionId?: string }>(raw) : null;
  return session?.sessionId ?? null;
}

export function clearAccountSession(response: NextResponse): void {
  response.cookies.set(SESSION_COOKIE, '', cookieOptions(0));
}

export function normalizeEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const email = value.trim().toLowerCase();
  if (email.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

function dataFile(): string {
  return path.resolve(process.env.MOD_AUTH_DATA_DIR ?? path.join(process.cwd(), 'data'), 'accounts.json');
}

function activationDataFile(): string {
  return path.resolve(
    process.env.MOD_AUTH_DATA_DIR ?? path.join(process.cwd(), 'data'),
    'activation-challenges.json'
  );
}

function activationCodeHash(code: string): string {
  return createHmac('sha256', secret()).update(`activation:${code}`).digest('hex');
}

function activationProvider(provider: AuthProvider): 'OFFICIAL' | 'COMMUNITY' {
  return provider === 'official' ? 'OFFICIAL' : 'COMMUNITY';
}

function hashesMatch(expectedHash: string, actualHash: string): boolean {
  const expected = Buffer.from(expectedHash, 'utf8');
  const actual = Buffer.from(actualHash, 'utf8');
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

async function withActivationLock<T>(operation: () => Promise<T>): Promise<T> {
  const previous = activationLock;
  let release!: () => void;
  activationLock = new Promise<void>((resolve) => {
    release = resolve;
  });
  await previous;
  try {
    return await operation();
  } finally {
    release();
  }
}

async function readActivationChallenges(): Promise<ActivationChallenge[]> {
  try {
    const raw = await readFile(activationDataFile(), 'utf8');
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as ActivationChallenge[]) : [];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
}

async function issueActivationChallengeInDatabase(
  db: NonNullable<ReturnType<typeof getDb>>,
  identity: PendingIdentity,
  bindEmail: string,
  code: string
): Promise<{ ok: true; challengeId: string; expiresAt: number } | { ok: false; retryAfterSeconds: number }> {
  const now = new Date();
  const provider = activationProvider(identity.provider);
  const recent = await db.activationChallenge.findFirst({ where: { provider, subject: identity.subject, bindEmail } });
  if (recent && recent.expiresAt > now && recent.attempts < ACTIVATION_MAX_ATTEMPTS && recent.createdAt.getTime() + ACTIVATION_RESEND_COOLDOWN_MS > now.getTime()) {
    return { ok: false, retryAfterSeconds: Math.max(1, Math.ceil((recent.createdAt.getTime() + ACTIVATION_RESEND_COOLDOWN_MS - now.getTime()) / 1000)) };
  }
  const challengeId = `act_${randomBytes(16).toString('hex')}`;
  const expiresAt = new Date(now.getTime() + ACTIVATION_CODE_TTL_MS);
  try {
    await db.$transaction(async (tx) => {
      await tx.activationChallenge.deleteMany({ where: { OR: [{ provider, subject: identity.subject }, { expiresAt: { lte: now } }] } });
      await tx.activationChallenge.create({ data: { id: challengeId, provider, subject: identity.subject, bindEmail, codeHash: activationCodeHash(code), expiresAt, createdAt: now } });
    });
  } catch (error) {
    // A concurrent request may have won the unique challenge slot. Re-read it
    // and expose the same cooldown response instead of a generic 500.
    const concurrent = await db.activationChallenge.findFirst({ where: { provider, subject: identity.subject, bindEmail } }).catch(() => null);
    if (concurrent && concurrent.expiresAt > now) return { ok: false, retryAfterSeconds: Math.max(1, Math.ceil((concurrent.createdAt.getTime() + ACTIVATION_RESEND_COOLDOWN_MS - now.getTime()) / 1000)) };
    throw error;
  }
  return { ok: true, challengeId, expiresAt: expiresAt.getTime() };
}

async function discardActivationChallengeInDatabase(db: NonNullable<ReturnType<typeof getDb>>, challengeId: string): Promise<void> {
  await db.activationChallenge.deleteMany({ where: { id: challengeId } });
}

async function consumeActivationChallengeInDatabase(
  db: NonNullable<ReturnType<typeof getDb>>,
  identity: PendingIdentity,
  bindEmail: string,
  code: string
): Promise<'ok' | 'invalid' | 'expired' | 'locked'> {
  const provider = activationProvider(identity.provider);
  return db.$transaction(async (tx) => {
    const found = await tx.activationChallenge.findFirst({ where: { provider, subject: identity.subject, bindEmail } });
    if (!found) return 'invalid';
    await tx.$queryRaw`SELECT "id" FROM "ActivationChallenge" WHERE "id" = ${found.id} FOR UPDATE`;
    const challenge = await tx.activationChallenge.findUnique({ where: { id: found.id } });
    if (!challenge) return 'invalid';
    const now = new Date();
    if (challenge.expiresAt <= now) {
      await tx.activationChallenge.delete({ where: { id: challenge.id } });
      return 'expired';
    }
    if (challenge.attempts >= ACTIVATION_MAX_ATTEMPTS) {
      await tx.activationChallenge.delete({ where: { id: challenge.id } });
      return 'locked';
    }
    if (!hashesMatch(challenge.codeHash, activationCodeHash(code))) {
      const attempts = challenge.attempts + 1;
      if (attempts >= ACTIVATION_MAX_ATTEMPTS) {
        await tx.activationChallenge.delete({ where: { id: challenge.id } });
        return 'locked';
      }
      await tx.activationChallenge.update({ where: { id: challenge.id }, data: { attempts } });
      return 'invalid';
    }
    await tx.activationChallenge.delete({ where: { id: challenge.id } });
    return 'ok';
  });
}

export async function issueActivationChallenge(
  identity: PendingIdentity,
  bindEmail: string,
  code: string
): Promise<{ ok: true; challengeId: string; expiresAt: number } | { ok: false; retryAfterSeconds: number }> {
  if (databaseConfigured()) {
    const db = getDb();
    if (!db) throw new Error('Database is unavailable');
    return issueActivationChallengeInDatabase(db, identity, bindEmail, code);
  }
  return withActivationLock(async () => {
    const now = Date.now();
    let challenges = (await readActivationChallenges()).filter(
      (challenge) => challenge.expiresAt > now && challenge.attempts < ACTIVATION_MAX_ATTEMPTS
    );
    const recent = challenges.find(
      (challenge) =>
        challenge.provider === identity.provider &&
        challenge.subject === identity.subject &&
        challenge.bindEmail === bindEmail &&
        challenge.createdAt + ACTIVATION_RESEND_COOLDOWN_MS > now
    );
    if (recent) {
      return {
        ok: false,
        retryAfterSeconds: Math.max(1, Math.ceil((recent.createdAt + ACTIVATION_RESEND_COOLDOWN_MS - now) / 1000))
      };
    }

    const challengeId = `act_${randomBytes(16).toString('hex')}`;
    const expiresAt = now + ACTIVATION_CODE_TTL_MS;
    const challenge: ActivationChallenge = {
      id: challengeId,
      provider: identity.provider,
      subject: identity.subject,
      bindEmail,
      codeHash: activationCodeHash(code),
      createdAt: now,
      expiresAt,
      attempts: 0
    };
    challenges = challenges.filter(
      (item) => item.provider !== identity.provider || item.subject !== identity.subject
    );
    challenges.push(challenge);
    await writeJsonArray(activationDataFile(), challenges);
    return { ok: true, challengeId, expiresAt };
  });
}

export async function discardActivationChallenge(challengeId: string): Promise<void> {
  if (databaseConfigured()) {
    const db = getDb();
    if (!db) throw new Error('Database is unavailable');
    await discardActivationChallengeInDatabase(db, challengeId);
    return;
  }
  await withActivationLock(async () => {
    const challenges = await readActivationChallenges();
    const remaining = challenges.filter((challenge) => challenge.id !== challengeId);
    if (remaining.length !== challenges.length) await writeJsonArray(activationDataFile(), remaining);
  });
}

export async function consumeActivationChallenge(
  identity: PendingIdentity,
  bindEmail: string,
  code: string
): Promise<'ok' | 'invalid' | 'expired' | 'locked'> {
  if (databaseConfigured()) {
    const db = getDb();
    if (!db) throw new Error('Database is unavailable');
    return consumeActivationChallengeInDatabase(db, identity, bindEmail, code);
  }
  return withActivationLock(async () => {
    const now = Date.now();
    const challenges = await readActivationChallenges();
    const matching = challenges.find(
      (challenge) =>
        challenge.provider === identity.provider &&
        challenge.subject === identity.subject &&
        challenge.bindEmail === bindEmail
    );
    if (!matching) return 'invalid';

    if (matching.expiresAt <= now) {
      await writeJsonArray(
        activationDataFile(),
        challenges.filter((challenge) => challenge.id !== matching.id)
      );
      return 'expired';
    }
    if (matching.attempts >= ACTIVATION_MAX_ATTEMPTS) {
      await writeJsonArray(
        activationDataFile(),
        challenges.filter((challenge) => challenge.id !== matching.id)
      );
      return 'locked';
    }

    if (!hashesMatch(matching.codeHash, activationCodeHash(code))) {
      matching.attempts += 1;
      if (matching.attempts >= ACTIVATION_MAX_ATTEMPTS) {
        await writeJsonArray(
          activationDataFile(),
          challenges.filter((challenge) => challenge.id !== matching.id)
        );
        return 'locked';
      }
      await writeJsonArray(activationDataFile(), challenges);
      return 'invalid';
    }

    await writeJsonArray(
      activationDataFile(),
      challenges.filter((challenge) => challenge.id !== matching.id)
    );
    return 'ok';
  });
}

async function readAccounts(): Promise<ModAccount[]> {
  try {
    const raw = await readFile(dataFile(), 'utf8');
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as ModAccount[]) : [];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
}

type DbAccountRecord = Prisma.AccountGetPayload<{
  include: {
    identities: true;
    siteRoles: true;
    organizationMemberships: { include: { organization: true } };
    ownedOrganizations: true;
  };
}>;

function dbIdentityToPending(identity: DbAccountRecord['identities'][number]): PendingIdentity {
  return {
    provider: identity.provider === 'OFFICIAL' ? 'official' : 'community',
    subject: identity.subject,
    displayName: identity.displayName,
    providerEmail: identity.providerEmail ?? undefined,
    providerEmailVerified: identity.providerEmailVerified,
    username: identity.username ?? undefined,
    playerName: identity.playerName ?? undefined,
    playerUid: identity.playerUid ?? undefined,
    avatarUrl: identity.avatarUrl ?? undefined,
    groups: normalizeGroups(identity.groups)
  };
}

function dbAccountToModAccount(account: DbAccountRecord): ModAccount {
  const identities = account.identities.map(dbIdentityToPending);
  const preferred = identities.find((identity) => identity.provider === 'community') ?? identities[0];
  const primary = preferred ?? {
    provider: 'community' as const,
    subject: `account:${account.id}`,
    displayName: account.displayName,
    username: account.username
  };
  const ownedIds = new Set(account.ownedOrganizations.map((organization) => organization.id));
  const membershipDetails = account.organizationMemberships.map((membership) => ({
    id: membership.organization.id,
    slug: membership.organization.slug,
    name: membership.organization.name,
    role: ownedIds.has(membership.organization.id) ? 'owner' : membership.role.toLowerCase()
  }));
  const ownerDetails = account.ownedOrganizations
    .filter((organization) => !membershipDetails.some((membership) => membership.id === organization.id))
    .map((organization) => ({ id: organization.id, slug: organization.slug, name: organization.name, role: 'owner' }));
  const organizationDetails = [...membershipDetails, ...ownerDetails];
  return {
    ...primary,
    id: account.id,
    bindEmail: account.bindEmail,
    createdAt: account.createdAt.toISOString(),
    lastLoginAt: (account.lastLoginAt ?? account.updatedAt).toISOString(),
    avatarUrl: account.avatarUrl ?? primary.avatarUrl,
    linkedIdentities: identities.filter((identity) => identity !== preferred),
    organizations: [...new Set([...account.organizationMemberships.map((membership) => membership.organization.slug), ...account.ownedOrganizations.map((organization) => organization.slug)])],
    ownedOrganizations: account.ownedOrganizations.map((organization) => organization.slug),
    organizationDetails,
    status: account.status,
    siteRoles: account.siteRoles.map((assignment) => assignment.role)
  };
}

async function findDbAccountById(accountId: string): Promise<ModAccount | null> {
  const db = getDb();
  if (!db) return null;
  try {
    const account = await db.account.findUnique({
      where: { id: accountId },
      include: {
        identities: true,
        siteRoles: true,
        organizationMemberships: { include: { organization: true } },
        ownedOrganizations: true
      }
    });
    if (!account) return null;
    return dbAccountToModAccount(account);
  } catch {
    return null;
  }
}

async function getSessionAccountByCookieValue(raw: string | undefined): Promise<ModAccount | null> {
  if (!raw) return null;
  const session = unseal<{ accountId?: string; sessionId?: string; token?: string; issuedAt?: number }>(raw);
  if (databaseConfigured() && session?.sessionId) {
    const db = getDb();
    if (!db) return null;
    try {
      const stored = await db.session.findUnique({
        where: { id: session.sessionId },
        include: {
          account: {
            include: {
              identities: true,
              siteRoles: true,
              organizationMemberships: { include: { organization: true } },
              ownedOrganizations: true
            }
          }
        }
      });
      if (!stored || stored.revokedAt || stored.expiresAt <= new Date()) return null;
      const token = session.token;
      if (!token) return null;
      const tokenHash = createHmac('sha256', secret()).update(`session:${token}`).digest('hex');
      if (!hashesMatch(stored.tokenHash, tokenHash)) return null;
      void db.session.update({ where: { id: stored.id }, data: { lastSeenAt: new Date() } }).catch(() => undefined);
      return dbAccountToModAccount(stored.account);
    } catch {
      return null;
    }
  }
  if (!session?.accountId || !session.issuedAt || Date.now() - session.issuedAt > SESSION_TTL_SECONDS * 1000) {
    return null;
  }
  if (databaseConfigured()) return findDbAccountById(session.accountId);
  const accounts = await readAccounts();
  return accounts.find((account) => account.id === session.accountId) ?? null;
}

function environmentFlag(value: string | undefined): boolean {
  return ['1', 'true', 'yes', 'on'].includes((value ?? '').trim().toLowerCase());
}

function getDevelopmentAccount(): ModAccount | null {
  if (process.env.NODE_ENV !== 'development' || !environmentFlag(process.env.MOD_AUTH_DEV_ACCOUNT_ENABLED)) {
    return null;
  }

  const displayName = (process.env.MOD_AUTH_DEV_ACCOUNT_NAME ?? '本地管理员').trim() || '本地管理员';
  const username = (process.env.MOD_AUTH_DEV_ACCOUNT_USERNAME ?? 'local-admin').trim() || 'local-admin';
  const bindEmail = (process.env.MOD_AUTH_DEV_ACCOUNT_EMAIL ?? 'local-admin@localhost.test').trim() || 'local-admin@localhost.test';
  const adminGroup = (process.env.COMMUNITY_ADMIN_GROUP ?? '管理员').trim();

  return {
    id: 'mod_local_development_admin',
    provider: 'community',
    subject: `local-admin-development:${username}`,
    displayName,
    username,
    providerEmail: bindEmail,
    providerEmailVerified: true,
    bindEmail,
    groups: adminGroup ? [adminGroup] : [],
    organizations: ['stoneworks'],
    ownedOrganizations: ['stoneworks'],
    createdAt: developmentAccountTimestamp,
    lastLoginAt: developmentAccountTimestamp
  };
}

export async function getSessionAccount(request: NextRequest): Promise<ModAccount | null> {
  const developmentAccount = getDevelopmentAccount();
  if (developmentAccount) return developmentAccount;
  return getSessionAccountByCookieValue(request.cookies.get(SESSION_COOKIE)?.value);
}

export function getSessionAccountSummary(account: ModAccount): SessionAccountSummary {
  const identity = getAccountPrimaryIdentity(account);
  const official = hasOfficialIdentity(account);
  const siteRoles = [...new Set(account.siteRoles ?? [])];
  return {
    id: account.id,
    displayName: identity.displayName,
    username: identity.username ?? identity.displayName,
    provider: identity.provider,
    avatarUrl: getAccountAvatarUrl(account),
    isAdmin: (account.status ?? 'ACTIVE') === 'ACTIVE' && (isCommunityAdmin(account) || siteRoles.includes('ADMIN')),
    hasOfficialIdentity: official,
    siteRoles,
    organizations: normalizeOrganizationNames(account.organizations),
    ownedOrganizations: normalizeOrganizationNames(account.ownedOrganizations),
    organizationDetails: account.organizationDetails,
    status: account.status
  };
}

export async function getServerSessionAccountSummary(): Promise<SessionAccountSummary | null> {
  const developmentAccount = getDevelopmentAccount();
  if (developmentAccount) return getSessionAccountSummary(developmentAccount);
  const cookieStore = await cookies();
  const account = await getSessionAccountByCookieValue(cookieStore.get(SESSION_COOKIE)?.value);
  return account ? getSessionAccountSummary(account) : null;
}

export async function findModAccountByIdentity(identity: PendingIdentity): Promise<ModAccount | null> {
  const db = getDb();
  if (db) {
    try {
      const found = await db.identity.findUnique({
        where: { provider_subject: { provider: identity.provider === 'official' ? 'OFFICIAL' : 'COMMUNITY', subject: identity.subject } },
        include: {
          account: {
            include: {
              identities: true,
              siteRoles: true,
              organizationMemberships: { include: { organization: true } },
              ownedOrganizations: true
            }
          }
        }
      });
      return found ? dbAccountToModAccount(found.account) : null;
    } catch {
      return null;
    }
  }
  const accounts = await readAccounts();
  return accounts.find((account) => accountIdentities(account).some((item) => identityMatches(item, identity))) ?? null;
}

function accountHasProviderIdentity(account: ModAccount, provider: AuthProvider): PendingIdentity | undefined {
  return accountIdentities(account).find((identity) => identity.provider === provider);
}

function accountEmailMatches(account: ModAccount, email: string): boolean {
  return normalizeEmail(account.bindEmail) === email;
}

export async function findBindingConflict(identity: PendingIdentity, bindEmail: string): Promise<ModAccount | null> {
  const db = getDb();
  if (db) {
    try {
      const accounts = await db.account.findMany({
        where: { bindEmail: { equals: bindEmail, mode: 'insensitive' } },
        include: { identities: true, siteRoles: true, organizationMemberships: { include: { organization: true } }, ownedOrganizations: true }
      });
      const conflict = accounts.find((account) => !account.identities.some((item) => item.provider === providerEnum(identity.provider) && item.subject === identity.subject));
      return conflict ? dbAccountToModAccount(conflict) : null;
    } catch {
      return null;
    }
  }
  const accounts = await readAccounts();
  return (
    accounts.find((account) => {
      if (!accountEmailMatches(account, bindEmail)) return false;
      return !accountIdentities(account).some((item) => identityMatches(item, identity));
    }) ?? null
  );
}

function updateAccountIdentity(account: ModAccount, identity: PendingIdentity, now: string): void {
  const identities = accountIdentities(account);
  const existingIndex = identities.findIndex((item) => identityMatches(item, identity));
  if (existingIndex >= 0) {
    identities[existingIndex] = identity;
  } else {
    identities.push(identity);
  }

  const preferred = identities.find((item) => item.provider === 'community') ?? identities[0];
  Object.assign(account, preferred, {
    linkedIdentities: identities.filter((item) => !identityMatches(item, preferred)),
    lastLoginAt: now
  });
  if (account.linkedIdentities?.length === 0) delete account.linkedIdentities;
}

export async function authenticateIdentity(identity: PendingIdentity): Promise<IdentityAuthenticationResult> {
  const db = getDb();
  if (db) return authenticateIdentityInDatabase(db, identity);
  const accounts = await readAccounts();
  const now = new Date().toISOString();
  const existing = accounts.find((account) => accountIdentities(account).some((item) => identityMatches(item, identity)));
  if (existing) {
    updateAccountIdentity(existing, identity, now);
    await writeAccounts(accounts);
    return { status: 'authenticated', account: existing };
  }

  const providerEmail = normalizeEmail(identity.providerEmail);
  const canUseProviderEmail = identity.provider === 'official' || identity.providerEmailVerified === true;
  if (!providerEmail || !canUseProviderEmail) return { status: 'needs-binding' };
  const emailMatches = accounts.filter((account) => accountEmailMatches(account, providerEmail));
  if (emailMatches.some((account) => accountHasProviderIdentity(account, identity.provider))) {
    return { status: 'provider-conflict', provider: identity.provider };
  }
  return { status: 'needs-binding' };
}

function safeUsername(value: string): string {
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 70);
  return normalized || `user-${randomBytes(5).toString('hex')}`;
}

function providerEnum(provider: AuthProvider): 'OFFICIAL' | 'COMMUNITY' {
  return provider === 'official' ? 'OFFICIAL' : 'COMMUNITY';
}

async function loadDbAccount(db: NonNullable<ReturnType<typeof getDb>>, accountId: string): Promise<ModAccount> {
  const account = await db.account.findUniqueOrThrow({
    where: { id: accountId },
    include: {
      identities: true,
      siteRoles: true,
      organizationMemberships: { include: { organization: true } },
      ownedOrganizations: true
    }
  });
  return dbAccountToModAccount(account);
}

async function syncDbIdentity(db: NonNullable<ReturnType<typeof getDb>>, accountId: string, identity: PendingIdentity, now: Date): Promise<void> {
  await db.identity.upsert({
    where: { provider_subject: { provider: providerEnum(identity.provider), subject: identity.subject } },
    create: {
      accountId,
      provider: providerEnum(identity.provider),
      subject: identity.subject,
      displayName: identity.displayName,
      providerEmail: identity.providerEmail,
      providerEmailVerified: identity.providerEmailVerified === true,
      username: identity.username,
      playerName: identity.playerName,
      playerUid: identity.playerUid,
      avatarUrl: identity.avatarUrl,
      groups: identity.groups ?? undefined,
      lastSeenAt: now
    },
    update: {
      accountId,
      displayName: identity.displayName,
      providerEmail: identity.providerEmail,
      providerEmailVerified: identity.providerEmailVerified === true,
      username: identity.username,
      playerName: identity.playerName,
      playerUid: identity.playerUid,
      avatarUrl: identity.avatarUrl,
      groups: identity.groups ?? undefined,
      lastSeenAt: now
    }
  });
  const preferred = identity.provider === 'community' ? identity : undefined;
  if (preferred) {
    await db.account.update({ where: { id: accountId }, data: { displayName: preferred.displayName, username: safeUsername(preferred.username ?? preferred.displayName), avatarUrl: preferred.avatarUrl, lastLoginAt: now } });
  } else {
    await db.account.update({ where: { id: accountId }, data: { lastLoginAt: now } });
  }
}

async function authenticateIdentityInDatabase(db: NonNullable<ReturnType<typeof getDb>>, identity: PendingIdentity): Promise<IdentityAuthenticationResult> {
  const provider = providerEnum(identity.provider);
  const now = new Date();
  try {
    const existing = await db.identity.findUnique({ where: { provider_subject: { provider, subject: identity.subject } } });
    if (existing) {
      await syncDbIdentity(db, existing.accountId, identity, now);
      return { status: 'authenticated', account: await loadDbAccount(db, existing.accountId) };
    }
    const providerEmail = normalizeEmail(identity.providerEmail);
    if (!providerEmail || (identity.provider === 'community' && identity.providerEmailVerified !== true)) return { status: 'needs-binding' };
    const emailMatches = await db.account.findMany({ where: { bindEmail: { equals: providerEmail, mode: 'insensitive' } }, include: { identities: true } });
    if (emailMatches.some((account) => account.identities.some((item) => item.provider === provider))) return { status: 'provider-conflict', provider: identity.provider };
    return { status: 'needs-binding' };
  } catch {
    return { status: 'needs-binding' };
  }
}

async function writeAccounts(accounts: ModAccount[]): Promise<void> {
  await writeJsonArray(dataFile(), accounts);
}

async function writeJsonArray<T>(file: string, values: T[]): Promise<void> {
  const directory = path.dirname(file);
  const temporaryFile = `${file}.${process.pid}.${randomBytes(8).toString('hex')}.tmp`;
  await mkdir(directory, { recursive: true, mode: 0o700 });
  try {
    await writeFile(temporaryFile, JSON.stringify(values, null, 2), { encoding: 'utf8', mode: 0o600 });
    await rename(temporaryFile, file);
  } finally {
    await unlink(temporaryFile).catch(() => undefined);
  }
}

export async function upsertModAccount(identity: PendingIdentity, bindEmail: string, passwordHash?: string): Promise<ModAccount> {
  const db = getDb();
  if (db) return upsertModAccountInDatabase(db, identity, bindEmail, passwordHash);
  const accounts = await readAccounts();
  const now = new Date().toISOString();
  const existing = accounts.find((account) => accountIdentities(account).some((item) => identityMatches(item, identity)));
  if (existing) {
    updateAccountIdentity(existing, identity, now);
    if (passwordHash && !existing.passwordHash) {
      existing.passwordHash = passwordHash;
      existing.passwordSetAt = now;
    }
    await writeAccounts(accounts);
    return existing;
  }

  const matchingAccounts = accounts.filter((account) => accountEmailMatches(account, bindEmail));
  if (matchingAccounts.length > 0) {
    throw new AccountBindingConflictError(identity.provider);
  }

  const account: ModAccount = {
    ...identity,
    id: `mod_${randomBytes(12).toString('hex')}`,
    bindEmail,
    passwordHash,
    passwordSetAt: passwordHash ? now : undefined,
    createdAt: now,
    lastLoginAt: now
  };
  accounts.push(account);
  await writeAccounts(accounts);
  return account;
}

async function upsertModAccountInDatabase(db: NonNullable<ReturnType<typeof getDb>>, identity: PendingIdentity, bindEmail: string, passwordHash?: string): Promise<ModAccount> {
  const normalizedEmail = normalizeEmail(bindEmail);
  if (!normalizedEmail) throw new Error('Invalid binding email');
  const provider = providerEnum(identity.provider);
  const now = new Date();
  return db.$transaction(async (tx) => {
    const existingIdentity = await tx.identity.findUnique({ where: { provider_subject: { provider, subject: identity.subject } } });
    if (existingIdentity) {
      await syncDbIdentity(tx as NonNullable<ReturnType<typeof getDb>>, existingIdentity.accountId, identity, now);
      if (passwordHash) {
        await tx.account.updateMany({ where: { id: existingIdentity.accountId, passwordHash: null }, data: { passwordHash, passwordSetAt: now } });
      }
      return loadDbAccount(tx as NonNullable<ReturnType<typeof getDb>>, existingIdentity.accountId);
    }
    const matches = await tx.account.findMany({ where: { bindEmail: { equals: normalizedEmail, mode: 'insensitive' } }, include: { identities: true } });
    if (matches.length > 0) throw new AccountBindingConflictError(identity.provider);
    const base = safeUsername(identity.username ?? identity.playerName ?? identity.displayName);
    let username = base;
    for (let index = 2; index < 1000; index += 1) {
      const occupied = await tx.account.findUnique({ where: { username } });
      if (!occupied) break;
      username = `${base.slice(0, 70)}-${index}`;
    }
    const account = await tx.account.create({
      data: {
        id: `mod_${randomBytes(12).toString('hex')}`,
        username,
        displayName: identity.displayName,
        bindEmail: normalizedEmail,
        passwordHash,
        passwordSetAt: passwordHash ? now : undefined,
        avatarUrl: identity.avatarUrl,
        lastLoginAt: now,
        identities: {
          create: {
            provider,
            subject: identity.subject,
            displayName: identity.displayName,
            providerEmail: identity.providerEmail,
            providerEmailVerified: identity.providerEmailVerified === true,
            username: identity.username,
            playerName: identity.playerName,
            playerUid: identity.playerUid,
            avatarUrl: identity.avatarUrl,
            groups: identity.groups ?? undefined,
            lastSeenAt: now
          }
        }
      }
    });
    return loadDbAccount(tx as NonNullable<ReturnType<typeof getDb>>, account.id);
  });
}

export async function authenticateEmail(email: string | null, password: string): Promise<ModAccount | null> {
  const normalizedEmail = email ? normalizeEmail(email) : null;
  const db = getDb();
  if (db) {
    let account: DbAccountRecord | null = null;
    try {
      account = await db.account.findFirst({
        where: {
          bindEmail: { equals: normalizedEmail ?? 'invalid-email@invalid.local', mode: 'insensitive' },
          status: 'ACTIVE',
          identities: { some: { provider: { in: ['COMMUNITY', 'OFFICIAL'] } } }
        },
        include: {
          identities: true,
          siteRoles: true,
          organizationMemberships: { include: { organization: true } },
          ownedOrganizations: true
        }
      });
    } catch {
      account = null;
    }
    if (!await verifyPassword(password, account?.passwordHash)) return null;
    return account ? dbAccountToModAccount(account) : null;
  }
  const accounts = await readAccounts();
  const account = normalizedEmail
    ? accounts.find((item) => item.status === 'ACTIVE' && accountEmailMatches(item, normalizedEmail) && accountIdentities(item).some((identity) => identity.provider === 'community' || identity.provider === 'official'))
    : undefined;
  if (!await verifyPassword(password, account?.passwordHash)) return null;
  return account ?? null;
}
