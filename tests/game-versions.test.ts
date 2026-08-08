import { describe, expect, it } from 'vitest';
import { isSupportedGameVersion, normalizeGameVersionFilter, parseGameVersionCatalog } from '@/lib/game-versions';

describe('parseGameVersionCatalog', () => {
  it('extracts and classifies stable and unstable game versions', () => {
    const versions = parseGameVersionCatalog({
      '1.22.6': { windows: { latest: 1, urls: { cdn: 'https://cdn.example/gamefiles/stable/client.exe' } } },
      '1.23.0-rc.1': { linux: { latest: true, urls: { cdn: 'https://cdn.example/gamefiles/unstable/client.tar.gz' } } },
      malformed: 'not an asset map'
    });

    expect(versions).toEqual([
      { value: '1.23.0-rc.1', channel: 'unstable', latest: true },
      { value: '1.22.6', channel: 'stable', latest: true }
    ]);
  });

  it('keeps unique, valid versions from a multi-select query parameter', () => {
    expect(normalizeGameVersionFilter(' 1.22.6,1.22.5,1.22.6,,1.22.4 ')).toEqual(['1.22.6', '1.22.5', '1.22.4']);
  });

  it('excludes versions older than the supported 1.4.4-dev.2 baseline', () => {
    expect(isSupportedGameVersion('1.4.4-dev.1')).toBe(false);
    expect(isSupportedGameVersion('1.4.4-dev.2')).toBe(true);
    expect(isSupportedGameVersion('1.4.4')).toBe(true);
    expect(normalizeGameVersionFilter('1.4.3,1.4.4-dev.1,1.4.4-dev.2,1.5.0')).toEqual(['1.4.4-dev.2', '1.5.0']);
  });

  it('does not return old catalog entries to version selectors', () => {
    const versions = parseGameVersionCatalog({
      '1.4.3': { windows: { urls: { cdn: 'https://cdn.example/stable/client.exe' } } },
      '1.4.4-dev.2': { windows: { urls: { cdn: 'https://cdn.example/unstable/client.exe' } } }
    });
    expect(versions.map((version) => version.value)).toEqual(['1.4.4-dev.2']);
  });
});
