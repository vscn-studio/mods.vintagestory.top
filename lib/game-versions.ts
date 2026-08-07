export type GameVersionChannel = 'stable' | 'unstable';

export type GameVersionOption = {
  value: string;
  channel: GameVersionChannel;
  latest: boolean;
};

type CdnAsset = {
  latest?: unknown;
  urls?: { cdn?: unknown };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function compareVersions(left: GameVersionOption, right: GameVersionOption): number {
  return right.value.localeCompare(left.value, undefined, { numeric: true, sensitivity: 'base' });
}

export function normalizeGameVersionFilter(value: string | null | undefined): string[] {
  const versions: string[] = [];
  const seen = new Set<string>();
  for (const item of (value ?? '').split(',')) {
    const version = item.trim();
    if (!version || version.length > 40 || seen.has(version)) continue;
    seen.add(version);
    versions.push(version);
    if (versions.length === 32) break;
  }
  return versions;
}

/** Extract the version-level metadata from Vintage Story's download catalog. */
export function parseGameVersionCatalog(payload: unknown): GameVersionOption[] {
  if (!isRecord(payload)) return [];

  const versions: GameVersionOption[] = [];
  for (const [value, platforms] of Object.entries(payload)) {
    const normalizedValue = value.trim();
    if (!normalizedValue || normalizedValue.length > 40 || !isRecord(platforms)) continue;

    let unstable = false;
    let latest = false;
    for (const asset of Object.values(platforms)) {
      if (!isRecord(asset)) continue;
      const details = asset as CdnAsset;
      latest ||= details.latest === 1 || details.latest === true;
      if (isRecord(details.urls) && typeof details.urls.cdn === 'string' && details.urls.cdn.includes('/unstable/')) unstable = true;
    }

    versions.push({ value: normalizedValue, channel: unstable ? 'unstable' : 'stable', latest });
  }

  return versions.sort(compareVersions);
}
