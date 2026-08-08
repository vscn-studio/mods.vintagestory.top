import { describe, expect, it } from 'vitest';
import { getLicenseOption, isSupportedLicense } from '@/lib/licenses';

describe('license presets', () => {
  it('resolves SPDX license information for preview links', () => {
    expect(getLicenseOption('MIT')).toEqual({
      value: 'MIT',
      label: 'MIT License',
      href: 'https://spdx.org/licenses/MIT.html'
    });
  });

  it('accepts only preset license values', () => {
    expect(isSupportedLicense('GPL-3.0-or-later')).toBe(true);
    expect(isSupportedLicense('made-up-license')).toBe(false);
  });
});
