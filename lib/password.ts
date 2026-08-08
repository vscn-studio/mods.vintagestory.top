import { randomBytes, scrypt as scryptCallback, scryptSync, timingSafeEqual } from 'node:crypto';

const KEY_LENGTH = 64;
const COST = 16_384;
const BLOCK_SIZE = 8;
const PARALLELIZATION = 1;
const SALT_LENGTH = 16;
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;
const DUMMY_HASH = scryptSync('mod-db-dummy-password', 'mod-db-dummy-salt', KEY_LENGTH, {
  N: COST,
  r: BLOCK_SIZE,
  p: PARALLELIZATION
}).toString('base64url');

function deriveKey(password: string, salt: Buffer, cost: number, blockSize: number, parallelization: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(password, salt, KEY_LENGTH, { N: cost, r: blockSize, p: parallelization }, (error, derived) => {
      if (error) reject(error);
      else resolve(derived);
    });
  });
}

export function validatePassword(password: unknown): string | null {
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH || password.length > MAX_PASSWORD_LENGTH) return null;
  return password;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const derived = await deriveKey(password, salt, COST, BLOCK_SIZE, PARALLELIZATION);
  return `scrypt$${COST}$${BLOCK_SIZE}$${PARALLELIZATION}$${salt.toString('base64url')}$${derived.toString('base64url')}`;
}

export async function verifyPassword(password: string, encoded: string | null | undefined): Promise<boolean> {
  const parts = typeof encoded === 'string' ? encoded.split('$') : [];
  let expected = DUMMY_HASH;
  let salt = Buffer.from('mod-db-dummy-salt', 'utf8');
  let cost = COST;
  let blockSize = BLOCK_SIZE;
  let parallelization = PARALLELIZATION;
  if (parts.length === 6 && parts[0] === 'scrypt') {
    const parsedCost = Number(parts[1]);
    const parsedBlockSize = Number(parts[2]);
    const parsedParallelization = Number(parts[3]);
    if (
      Number.isSafeInteger(parsedCost) && parsedCost >= 1_024 && parsedCost <= 1_048_576 &&
      Number.isSafeInteger(parsedBlockSize) && parsedBlockSize >= 1 && parsedBlockSize <= 32 &&
      Number.isSafeInteger(parsedParallelization) && parsedParallelization >= 1 && parsedParallelization <= 8
    ) {
      try {
        const parsedSalt = Buffer.from(parts[4], 'base64url');
        const parsedExpected = Buffer.from(parts[5], 'base64url');
        if (parsedSalt.length >= 8 && parsedExpected.length === KEY_LENGTH) {
          salt = parsedSalt;
          expected = parts[5];
          cost = parsedCost;
          blockSize = parsedBlockSize;
          parallelization = parsedParallelization;
        }
      } catch {
        // Keep the dummy parameters for malformed hashes.
      }
    }
  }
  let actual: Buffer;
  try {
    actual = await deriveKey(password, salt, cost, blockSize, parallelization);
  } catch {
    return false;
  }
  const expectedBuffer = Buffer.from(expected, 'base64url');
  return expectedBuffer.length === actual.length && timingSafeEqual(expectedBuffer, actual);
}
