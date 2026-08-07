import { describe, expect, it } from 'vitest';
import { normalizeGameVersionFilter, parseGameVersionCatalog } from '@/lib/game-versions';

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
});
