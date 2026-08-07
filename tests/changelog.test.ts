import { describe, expect, it } from 'vitest';
import { sanitizeChangelog } from '@/lib/changelog';

describe('sanitizeChangelog', () => {
  it('preserves the supported rich-text markup', () => {
    expect(sanitizeChangelog('<p><strong>Important</strong> <a href="https://example.com">details</a></p><ul><li>One</li></ul>'))
      .toBe('<p><strong>Important</strong> <a href="https://example.com">details</a></p><ul><li>One</li></ul>');
  });

  it('removes executable markup and unsafe links', () => {
    expect(sanitizeChangelog('<script>alert(1)</script><p onclick="alert(1)"><a href="javascript:alert(1)">Unsafe</a></p>'))
      .toBe('<p><a>Unsafe</a></p>');
  });
});
