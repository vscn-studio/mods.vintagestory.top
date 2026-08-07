import { createHash, createHmac, randomBytes } from 'node:crypto';
import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { DeleteObjectCommand, GetObjectCommand, HeadBucketCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export type StorageUpload = {
  objectKey: string;
  size: number;
  sha256: string;
  mimeType: string;
  name: string;
};

export type StorageAdapter = {
  put(buffer: Buffer, input: { objectKey: string; mimeType: string; name: string }): Promise<StorageUpload>;
  get(objectKey: string): Promise<Buffer>;
  remove(objectKey: string): Promise<void>;
  downloadUrl(objectKey: string, expiresInSeconds?: number): Promise<string | null>;
};

function driver(): 'local' | 's3' {
  return (process.env.STORAGE_DRIVER ?? 'local').trim().toLowerCase() === 's3' ? 's3' : 'local';
}

function localRoot(): string {
  // Keep the local adapter runtime-only in standalone tracing; the path is intentionally configurable.
  const configured = process.env.STORAGE_LOCAL_DIR?.trim();
  return configured ? path.resolve(configured) : path.join(/*turbopackIgnore: true*/ process.cwd(), 'data', 'objects');
}

function safeObjectPath(objectKey: string): string {
  const root = localRoot();
  const target = path.resolve(root, objectKey);
  if (target !== root && !target.startsWith(`${root}${path.sep}`)) throw new Error('Invalid storage object key');
  return target;
}

function sha256(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

function objectKey(prefix: string, name: string): string {
  const clean = name.toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 100) || 'file';
  return `${prefix}/${new Date().toISOString().slice(0, 10)}/${randomBytes(12).toString('hex')}-${clean}`;
}

const localAdapter: StorageAdapter = {
  async put(buffer, input) {
    const target = safeObjectPath(input.objectKey);
    await mkdir(path.dirname(target), { recursive: true, mode: 0o700 });
    const temporary = `${target}.${process.pid}.${randomBytes(6).toString('hex')}.tmp`;
    await writeFile(temporary, buffer, { mode: 0o600 });
    await rename(temporary, target);
    return { objectKey: input.objectKey, size: buffer.byteLength, sha256: sha256(buffer), mimeType: input.mimeType, name: input.name };
  },
  async get(key) {
    return readFile(safeObjectPath(key));
  },
  async remove(key) {
    await rm(safeObjectPath(key), { force: true });
  },
  async downloadUrl(key) {
    const file = safeObjectPath(key);
    await stat(file);
    return `/api/v1/files/object/${encodeURIComponent(key)}`;
  }
};

type RemoteStorageProvider = 's3' | 'dogecloud';
type S3Connection = { key: string; client: S3Client; bucket: string; endpoint?: string; provider: RemoteStorageProvider };
type DogeCloudToken = { credentials: { accessKeyId: string; secretAccessKey: string; sessionToken: string }; space: string; bucket: string; endpoint: string; expiresAt: number };

const DOGECLOUD_API_PATH = '/auth/tmp_token.json';
const DOGECLOUD_TOKEN_REFRESH_MARGIN_SECONDS = 300;
let cachedS3: S3Connection | null = null;
let cachedDogeCloudToken: DogeCloudToken | null = null;

function env(name: string): string {
  return (process.env[name] ?? '').trim();
}

function remoteProvider(): RemoteStorageProvider {
  return env('STORAGE_S3_PROVIDER').toLowerCase() === 'dogecloud' ? 'dogecloud' : 's3';
}

function forcePathStyle(): boolean {
  return env('STORAGE_S3_FORCE_PATH_STYLE').toLowerCase() === 'true';
}

function signedUrlTtl(): number {
  return Math.max(60, Math.min(900, Number.parseInt(env('STORAGE_S3_SIGNED_URL_TTL') || '300', 10) || 300));
}

function validHttpUrl(value: string, field: string): string {
  let parsed: URL;
  try { parsed = new URL(value); } catch { throw new Error(`${field} must be an absolute HTTP(S) URL`); }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') throw new Error(`${field} must use HTTP(S)`);
  parsed.search = '';
  parsed.hash = '';
  return parsed.toString().replace(/\/$/, '');
}

function dogeCloudSettings(): { accessKeyId: string; secretAccessKey: string; space: string; apiBase: string } {
  const accessKeyId = env('STORAGE_DOGECLOUD_ACCESS_KEY') || env('STORAGE_S3_ACCESS_KEY');
  const secretAccessKey = process.env.STORAGE_DOGECLOUD_SECRET_KEY || process.env.STORAGE_S3_SECRET_KEY || '';
  const space = env('STORAGE_DOGECLOUD_BUCKET') || env('STORAGE_S3_BUCKET');
  const apiBase = validHttpUrl(env('STORAGE_DOGECLOUD_API_BASE') || 'https://api.dogecloud.com', 'STORAGE_DOGECLOUD_API_BASE');
  if (!accessKeyId || !secretAccessKey || !space) throw new Error('DogeCloud storage is not configured');
  return { accessKeyId, secretAccessKey, space, apiBase };
}

function stringAt(value: unknown, key: string): string {
  return value && typeof value === 'object' && typeof (value as Record<string, unknown>)[key] === 'string'
    ? String((value as Record<string, unknown>)[key]).trim()
    : '';
}

async function dogeCloudToken(): Promise<DogeCloudToken> {
  const settings = dogeCloudSettings();
  const now = Math.floor(Date.now() / 1000);
  if (cachedDogeCloudToken && cachedDogeCloudToken.expiresAt - DOGECLOUD_TOKEN_REFRESH_MARGIN_SECONDS > now && cachedDogeCloudToken.space === settings.space) return cachedDogeCloudToken;
  const body = JSON.stringify({ channel: 'OSS_FULL', scopes: [settings.space], ttl: 7200 });
  const signature = createHmac('sha1', settings.secretAccessKey).update(Buffer.from(`${DOGECLOUD_API_PATH}\n${body}`, 'utf8')).digest('hex');
  let response: Response;
  try {
    response = await fetch(`${settings.apiBase}${DOGECLOUD_API_PATH}`, { method: 'POST', headers: { Authorization: `TOKEN ${settings.accessKeyId}:${signature}`, 'Content-Type': 'application/json' }, body, cache: 'no-store' });
  } catch {
    throw new Error('DogeCloud credential request failed');
  }
  const payload = await response.json().catch(() => null) as { code?: unknown; msg?: unknown; data?: unknown } | null;
  if (!response.ok || payload?.code !== 200 || !payload.data || typeof payload.data !== 'object') {
    const message = typeof payload?.msg === 'string' ? payload.msg.slice(0, 160) : `HTTP ${response.status}`;
    throw new Error(`DogeCloud credential request failed: ${message}`);
  }
  const data = payload.data as Record<string, unknown>;
  const credentials = data.Credentials;
  const buckets = Array.isArray(data.Buckets) ? data.Buckets : [];
  const selected = buckets.find((bucket) => stringAt(bucket, 'name') === settings.space) ?? buckets[0];
  const accessKeyId = stringAt(credentials, 'accessKeyId');
  const secretAccessKey = stringAt(credentials, 'secretAccessKey');
  const sessionToken = stringAt(credentials, 'sessionToken');
  const bucket = stringAt(selected, 's3Bucket');
  const endpoint = stringAt(selected, 's3Endpoint');
  const expirationValue = typeof data.ExpiredAt === 'number' ? data.ExpiredAt : Number(data.ExpiredAt);
  const expiresAt = Number.isFinite(expirationValue) ? Math.floor(expirationValue > 10_000_000_000 ? expirationValue / 1000 : expirationValue) : 0;
  if (!accessKeyId || !secretAccessKey || !sessionToken || !bucket || !endpoint || expiresAt <= now) throw new Error('DogeCloud returned incomplete temporary S3 credentials');
  cachedDogeCloudToken = { credentials: { accessKeyId, secretAccessKey, sessionToken }, space: settings.space, bucket, endpoint: validHttpUrl(endpoint, 'DogeCloud S3 endpoint'), expiresAt };
  return cachedDogeCloudToken;
}

async function s3Config(): Promise<S3Connection> {
  const provider = remoteProvider();
  if (provider === 'dogecloud') {
    const token = await dogeCloudToken();
    const key = `dogecloud|${token.bucket}|${token.endpoint}|${token.credentials.accessKeyId}|${token.credentials.sessionToken}`;
    if (!cachedS3 || cachedS3.key !== key) {
      cachedS3 = {
        key,
        bucket: token.bucket,
        endpoint: token.endpoint,
        provider,
        client: new S3Client({ region: 'automatic', endpoint: token.endpoint, forcePathStyle: forcePathStyle(), credentials: token.credentials })
      };
    }
    return cachedS3;
  }
  const endpoint = env('STORAGE_S3_ENDPOINT') ? validHttpUrl(env('STORAGE_S3_ENDPOINT'), 'STORAGE_S3_ENDPOINT') : undefined;
  const region = env('STORAGE_S3_REGION') || 'us-east-1';
  const bucket = env('STORAGE_S3_BUCKET');
  const accessKeyId = env('STORAGE_S3_ACCESS_KEY');
  const secretAccessKey = process.env.STORAGE_S3_SECRET_KEY ?? '';
  if (!bucket || !accessKeyId || !secretAccessKey) throw new Error('S3 storage is not configured');
  const key = `s3|${endpoint ?? ''}|${region}|${bucket}|${accessKeyId}`;
  if (!cachedS3 || cachedS3.key !== key) {
    cachedS3 = { key, bucket, endpoint, provider, client: new S3Client({ region, endpoint, forcePathStyle: forcePathStyle(), credentials: { accessKeyId, secretAccessKey } }) };
  }
  return cachedS3;
}

const s3Adapter: StorageAdapter = {
  async put(buffer, input) {
    const { client, bucket } = await s3Config();
    await client.send(new PutObjectCommand({ Bucket: bucket, Key: input.objectKey, Body: buffer, ContentType: input.mimeType, ContentLength: buffer.byteLength }));
    return { objectKey: input.objectKey, size: buffer.byteLength, sha256: sha256(buffer), mimeType: input.mimeType, name: input.name };
  },
  async get(key) {
    const { client, bucket } = await s3Config();
    const response = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    if (!response.Body || typeof response.Body.transformToByteArray !== 'function') throw new Error('S3 object body is unavailable');
    return Buffer.from(await response.Body.transformToByteArray());
  },
  async remove(key) {
    const { client, bucket } = await s3Config();
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  },
  async downloadUrl(key) {
    const { client, bucket } = await s3Config();
    return getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn: signedUrlTtl() });
  }
};

export function getStorageAdapter(): StorageAdapter {
  return driver() === 's3' ? s3Adapter : localAdapter;
}

export function createObjectKey(prefix: 'avatars' | 'projects' | 'releases', name: string): string {
  return objectKey(prefix, name);
}

/** Extract only keys generated by the media endpoint; external avatar URLs are ignored. */
export function objectKeyFromMediaUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const parsed = new URL(value, 'http://vscn.invalid');
    if (parsed.origin !== 'http://vscn.invalid' || !parsed.pathname.startsWith('/api/v1/media/')) return null;
    const raw = parsed.pathname.slice('/api/v1/media/'.length);
    if (!raw) return null;
    const key = raw.split('/').map((part) => decodeURIComponent(part)).join('/');
    if (!key || key.startsWith('/') || key.includes('\\') || key.split('/').some((part) => part === '.' || part === '..')) return null;
    return key;
  } catch {
    return null;
  }
}

export function storageProviderName(): string {
  return driver() === 's3' ? remoteProvider() : 'local';
}

export type StorageStatus = {
  driver: 'local' | 's3';
  provider: 'local' | RemoteStorageProvider;
  configured: boolean;
  bucket: string | null;
  endpoint: string | null;
  region: string | null;
  forcePathStyle: boolean;
  signedUrlTtl: number | null;
};

export function storageStatus(): StorageStatus {
  if (driver() === 'local') return { driver: 'local', provider: 'local', configured: true, bucket: null, endpoint: null, region: null, forcePathStyle: false, signedUrlTtl: null };
  const provider = remoteProvider();
  if (provider === 'dogecloud') {
    const configured = Boolean((env('STORAGE_DOGECLOUD_ACCESS_KEY') || env('STORAGE_S3_ACCESS_KEY')) && (process.env.STORAGE_DOGECLOUD_SECRET_KEY || process.env.STORAGE_S3_SECRET_KEY) && (env('STORAGE_DOGECLOUD_BUCKET') || env('STORAGE_S3_BUCKET')));
    return { driver: 's3', provider, configured, bucket: env('STORAGE_DOGECLOUD_BUCKET') || env('STORAGE_S3_BUCKET') || null, endpoint: null, region: 'automatic', forcePathStyle: forcePathStyle(), signedUrlTtl: signedUrlTtl() };
  }
  const configured = Boolean(env('STORAGE_S3_BUCKET') && env('STORAGE_S3_ACCESS_KEY') && process.env.STORAGE_S3_SECRET_KEY);
  return { driver: 's3', provider, configured, bucket: env('STORAGE_S3_BUCKET') || null, endpoint: env('STORAGE_S3_ENDPOINT') || null, region: env('STORAGE_S3_REGION') || 'us-east-1', forcePathStyle: forcePathStyle(), signedUrlTtl: signedUrlTtl() };
}

export async function testStorageConnection(): Promise<StorageStatus & { endpoint: string | null }> {
  const status = storageStatus();
  if (status.driver === 'local') {
    await mkdir(localRoot(), { recursive: true, mode: 0o700 });
    return status;
  }
  const connection = await s3Config();
  await connection.client.send(new HeadBucketCommand({ Bucket: connection.bucket }));
  return { ...status, bucket: connection.bucket, endpoint: connection.endpoint ?? status.endpoint };
}

export function validateUpload(buffer: Buffer, input: { name: string; mimeType: string; maxBytes?: number }): void {
  const maxBytes = input.maxBytes ?? 500 * 1024 * 1024;
  if (buffer.byteLength === 0 || buffer.byteLength > maxBytes) throw new Error('File size is outside the allowed range');
  const name = input.name.trim();
  if (!name || name.length > 255 || /[\u0000-\u001f\u007f]/.test(name)) throw new Error('File name is invalid');
  const lower = name.toLowerCase();
  const kind = lower.endsWith('.tar.gz') || lower.endsWith('.tgz') ? 'gzip' : lower.endsWith('.zip') ? 'zip' : lower.endsWith('.jar') ? 'jar' : lower.endsWith('.png') ? 'png' : lower.endsWith('.jpg') || lower.endsWith('.jpeg') ? 'jpeg' : lower.endsWith('.webp') ? 'webp' : lower.endsWith('.json') ? 'json' : null;
  if (!kind) throw new Error('File type is not allowed');

  const declared = (input.mimeType || 'application/octet-stream').split(';', 1)[0].trim().toLowerCase();
  const imageSignature = kind === 'png'
    ? buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    : kind === 'jpeg'
      ? buffer.subarray(0, 3).equals(Buffer.from([255, 216, 255]))
      : kind === 'webp'
        ? buffer.length >= 12 && buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP'
        : false;
  if (kind === 'png' || kind === 'jpeg' || kind === 'webp') {
    if (!imageSignature) throw new Error('Image signature does not match the file extension');
    if (declared !== 'application/octet-stream' && !declared.startsWith('image/')) throw new Error('Image MIME type is invalid');
  }
  if (kind === 'zip' || kind === 'jar') {
    const zipSignature = buffer.length >= 4 && (buffer.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04])) || buffer.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x05, 0x06])) || buffer.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x07, 0x08])));
    if (!zipSignature) throw new Error('Archive signature does not match the file extension');
    if (declared.startsWith('image/') || declared === 'application/pdf') throw new Error('Archive MIME type is invalid');
  }
  if (kind === 'gzip') {
    if (buffer.length < 2 || buffer[0] !== 0x1f || buffer[1] !== 0x8b) throw new Error('GZIP signature does not match the file extension');
    if (declared.startsWith('image/')) throw new Error('Archive MIME type is invalid');
  }
  if (kind === 'json') {
    try { JSON.parse(buffer.toString('utf8')); } catch { throw new Error('JSON content is invalid'); }
    if (declared.startsWith('image/')) throw new Error('JSON MIME type is invalid');
  }
}

/** Return a stable MIME type instead of trusting a browser-provided header. */
export function inferUploadMimeType(name: string, declared?: string): string {
  const lower = name.trim().toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.jar')) return 'application/java-archive';
  if (lower.endsWith('.zip')) return 'application/zip';
  if (lower.endsWith('.tar.gz') || lower.endsWith('.tgz')) return 'application/gzip';
  if (lower.endsWith('.json')) return 'application/json';
  return (declared || 'application/octet-stream').split(';', 1)[0].trim().toLowerCase() || 'application/octet-stream';
}
