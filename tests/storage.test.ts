import { describe, expect, it } from 'vitest';
import { inferUploadMimeType, storageStatus, validateUpload } from '@/lib/storage';

describe('upload validation', () => {
  it('checks archive magic bytes instead of trusting the extension', () => {
    expect(() => validateUpload(Buffer.from('not a zip'), { name: 'mod.zip', mimeType: 'application/zip' })).toThrow();
    expect(() => validateUpload(Buffer.from([0x50, 0x4b, 0x03, 0x04]), { name: 'mod.zip', mimeType: 'application/zip' })).not.toThrow();
  });

  it('checks image signatures and normalizes MIME types', () => {
    const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0]);
    expect(() => validateUpload(png, { name: 'cover.png', mimeType: 'image/png' })).not.toThrow();
    expect(() => validateUpload(Buffer.from('fake'), { name: 'cover.png', mimeType: 'image/png' })).toThrow();
    expect(inferUploadMimeType('archive.jar', 'text/plain')).toBe('application/java-archive');
  });

  it('parses JSON payloads before accepting JSON files', () => {
    expect(() => validateUpload(Buffer.from('{"modid":"demo"}'), { name: 'modinfo.json', mimeType: 'application/json' })).not.toThrow();
    expect(() => validateUpload(Buffer.from('{invalid'), { name: 'modinfo.json', mimeType: 'application/json' })).toThrow();
  });

  it('recognizes DogeCloud OSS configuration without exposing credentials', () => {
    const original = {
      driver: process.env.STORAGE_DRIVER,
      provider: process.env.STORAGE_S3_PROVIDER,
      bucket: process.env.STORAGE_DOGECLOUD_BUCKET,
      access: process.env.STORAGE_DOGECLOUD_ACCESS_KEY,
      secret: process.env.STORAGE_DOGECLOUD_SECRET_KEY
    };
    try {
      process.env.STORAGE_DRIVER = 's3';
      process.env.STORAGE_S3_PROVIDER = 'dogecloud';
      process.env.STORAGE_DOGECLOUD_BUCKET = 'vscn-assets';
      process.env.STORAGE_DOGECLOUD_ACCESS_KEY = 'test-access-key';
      process.env.STORAGE_DOGECLOUD_SECRET_KEY = 'test-secret-key';
      expect(storageStatus()).toMatchObject({ driver: 's3', provider: 'dogecloud', configured: true, bucket: 'vscn-assets', endpoint: null, region: 'automatic' });
    } finally {
      for (const [name, value] of Object.entries({ STORAGE_DRIVER: original.driver, STORAGE_S3_PROVIDER: original.provider, STORAGE_DOGECLOUD_BUCKET: original.bucket, STORAGE_DOGECLOUD_ACCESS_KEY: original.access, STORAGE_DOGECLOUD_SECRET_KEY: original.secret })) {
        if (value === undefined) delete process.env[name];
        else process.env[name] = value;
      }
    }
  });
});
