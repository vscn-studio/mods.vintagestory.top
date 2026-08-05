import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { NextRequest, NextResponse } from 'next/server';

export type AuthProvider = 'official' | 'community';

export type PendingIdentity = {
  provider: AuthProvider;
  subject: string;
  displayName: string;
  providerEmail?: string;
  username?: string;
  playerName?: string;
  playerUid?: string;
  avatarUrl?: string;
};

type ModAccount = PendingIdentity & {
  id: string;
  bindEmail: string;
  createdAt: string;
  lastLoginAt: string;
};

const PENDING_COOKIE = 'mod_pending_identity';
const SESSION_COOKIE = 'mod_session';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 14;
const MIN_SESSION_SECRET_LENGTH = 32;
const ACTIVATION_CODE_TTL_MS = 10 * 60 * 1000;
const ACTIVATION_RESEND_COOLDOWN_MS = 60 * 1000;
const ACTIVATION_MAX_ATTEMPTS = 5;
const developmentSecret = randomBytes(32).toString('hex');

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
  response.cookies.set(PENDING_COOKIE, seal(identity), cookieOptions(10 * 60));
}

export function getPendingIdentity(request: NextRequest): PendingIdentity | null {
  const raw = request.cookies.get(PENDING_COOKIE)?.value;
  if (!raw) return null;
  const identity = unseal<PendingIdentity>(raw);
  if (!identity || !identity.subject || !identity.displayName) return null;
  return identity;
}

export function clearPendingIdentity(response: NextResponse): void {
  response.cookies.set(PENDING_COOKIE, '', cookieOptions(0));
}

export function setAccountSession(response: NextResponse, accountId: string): void {
  response.cookies.set(SESSION_COOKIE, seal({ accountId, issuedAt: Date.now() }), cookieOptions(SESSION_TTL_SECONDS));
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

export async function issueActivationChallenge(
  identity: PendingIdentity,
  bindEmail: string,
  code: string
): Promise<{ ok: true; challengeId: string; expiresAt: number } | { ok: false; retryAfterSeconds: number }> {
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

export async function getSessionAccount(request: NextRequest): Promise<ModAccount | null> {
  const raw = request.cookies.get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  const session = unseal<{ accountId?: string; issuedAt?: number }>(raw);
  if (!session?.accountId || !session.issuedAt || Date.now() - session.issuedAt > SESSION_TTL_SECONDS * 1000) {
    return null;
  }
  const accounts = await readAccounts();
  return accounts.find((account) => account.id === session.accountId) ?? null;
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

export async function upsertModAccount(identity: PendingIdentity, bindEmail: string): Promise<ModAccount> {
  const accounts = await readAccounts();
  const now = new Date().toISOString();
  const existing = accounts.find(
    (account) => account.provider === identity.provider && account.subject === identity.subject
  );
  if (existing) {
    Object.assign(existing, identity, { bindEmail, lastLoginAt: now });
    await writeAccounts(accounts);
    return existing;
  }

  const account: ModAccount = {
    ...identity,
    id: `mod_${randomBytes(12).toString('hex')}`,
    bindEmail,
    createdAt: now,
    lastLoginAt: now
  };
  accounts.push(account);
  await writeAccounts(accounts);
  return account;
}
