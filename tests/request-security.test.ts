import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkCsrf, sameOrigin } from '@/lib/request-security';

describe('request security', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('requires an origin and matching double-submit token for mutations', () => {
    const token = 'csrf-test-token';
    const valid = new NextRequest('http://localhost/api/v1/projects', {
      method: 'POST',
      headers: { origin: 'http://localhost', cookie: `vscn_csrf=${token}`, 'x-csrf-token': token }
    });
    expect(sameOrigin(valid)).toBe(true);
    expect(checkCsrf(valid)).toBe(true);
    expect(checkCsrf(new NextRequest(valid.url, { method: 'POST', headers: { origin: 'http://localhost', cookie: `vscn_csrf=${token}`, 'x-csrf-token': 'wrong' } }))).toBe(false);
    expect(checkCsrf(new NextRequest(valid.url, { method: 'POST', headers: { cookie: `vscn_csrf=${token}`, 'x-csrf-token': token } }))).toBe(false);
  });

  it('does not impose CSRF checks on safe methods', () => {
    const request = new NextRequest('http://localhost/api/v1/projects', { method: 'GET' });
    expect(sameOrigin(request)).toBe(true);
    expect(checkCsrf(request)).toBe(true);
  });

  it('uses WEB_URL as the public origin behind a production reverse proxy', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('WEB_URL', 'https://mods.vintagestory.top');
    const token = 'proxy-csrf-token';
    const request = new NextRequest('http://127.0.0.1:3100/api/auth/activation/request', {
      method: 'POST',
      headers: {
        origin: 'https://mods.vintagestory.top',
        cookie: `vscn_csrf=${token}`,
        'x-csrf-token': token
      }
    });

    expect(sameOrigin(request)).toBe(true);
    expect(checkCsrf(request)).toBe(true);
    expect(sameOrigin(new NextRequest(request.url, {
      method: 'POST',
      headers: { origin: 'https://evil.example' }
    }))).toBe(false);
  });
});
