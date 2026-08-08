export type GameVersionChannel = 'stable' | 'unstable';

/** Release compatibility is a catalog selection, not a URL filter. */
export const MAX_RELEASE_COMPATIBLE_VERSIONS = 512;
export const MIN_SUPPORTED_GAME_VERSION = '1.4.4-dev.2';

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

type ParsedGameVersion = {
  major: number;
  minor: number;
  patch: number;
  stage: 'dev' | 'pre' | 'rc' | 'stable';
  stageNumber: number;
};

const stageRank: Record<ParsedGameVersion['stage'], number> = { dev: 0, pre: 1, rc: 2, stable: 3 };

function parseComparableGameVersion(value: string): ParsedGameVersion | null {
  const match = /^v?(\d+)\.(\d+)\.(\d+)(?:-((?:dev|pre|rc))(?:[.-]?(\d+))?)?$/i.exec(value.trim());
  if (!match) return null;
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    stage: (match[4]?.toLowerCase() as ParsedGameVersion['stage'] | undefined) ?? 'stable',
    stageNumber: Number(match[5] ?? 0)
  };
}

/** Compare semantic Vintage Story versions in ascending order. */
export function compareGameVersions(left: string, right: string): number {
  const leftParsed = parseComparableGameVersion(left);
  const rightParsed = parseComparableGameVersion(right);
  if (!leftParsed || !rightParsed) return left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' });
  for (const key of ['major', 'minor', 'patch'] as const) {
    if (leftParsed[key] !== rightParsed[key]) return leftParsed[key] - rightParsed[key];
  }
  const stageDifference = stageRank[leftParsed.stage] - stageRank[rightParsed.stage];
  return stageDifference || leftParsed.stageNumber - rightParsed.stageNumber;
}

export function isSupportedGameVersion(value: string): boolean {
  return compareGameVersions(value, MIN_SUPPORTED_GAME_VERSION) >= 0 && Boolean(parseComparableGameVersion(value));
}

export function filterSupportedGameVersions(values: string[]): string[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    const normalized = value.trim();
    if (!normalized || seen.has(normalized) || !isSupportedGameVersion(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}

function compareVersions(left: GameVersionOption, right: GameVersionOption): number {
  return compareGameVersions(right.value, left.value);
}

export function normalizeGameVersionFilter(value: string | null | undefined): string[] {
  const versions: string[] = [];
  const seen = new Set<string>();
  for (const item of (value ?? '').split(',')) {
    const version = item.trim();
    if (!version || version.length > 40 || seen.has(version) || !isSupportedGameVersion(version)) continue;
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
    if (!isSupportedGameVersion(normalizedValue)) continue;

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
