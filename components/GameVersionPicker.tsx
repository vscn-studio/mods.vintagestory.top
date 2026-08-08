'use client';

import { Check, ListFilter, LoaderCircle, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSiteLanguage } from '@/components/SiteLanguageContext';
import { isSupportedGameVersion, MAX_RELEASE_COMPATIBLE_VERSIONS, type GameVersionOption } from '@/lib/game-versions';

type Props = {
  value: string[];
  onChange: (versions: string[]) => void;
  ariaLabel: string;
  collapsible?: boolean;
  variant?: 'list' | 'tree';
};

type ParsedVersion = {
  major: number;
  minor: number;
  patch: number;
  prerelease: string;
};

type VersionTreeLeaf = {
  option: GameVersionOption & { saved?: boolean };
  prerelease: string;
};

type VersionTreePatch = {
  value: number;
  leaves: VersionTreeLeaf[];
};

type VersionTreeMinor = {
  value: number;
  patches: VersionTreePatch[];
};

type VersionTreeMajor = {
  value: number;
  minors: VersionTreeMinor[];
};

const copy = {
  'zh-CN': {
    loading: '正在获取游戏版本…',
    unavailable: '游戏版本目录暂时不可用。',
    retry: '重新获取游戏版本',
    stable: '稳定版',
    unstable: '测试版',
    latest: '最新',
    saved: '已存版本',
    maximum: '最多选择 32 个游戏版本',
    releaseMaximum: `最多选择 ${MAX_RELEASE_COMPATIBLE_VERSIONS} 个游戏版本`,
    searchPlaceholder: '筛选版本号',
    noMatches: '没有匹配的游戏版本',
    allVersions: '列出所有版本',
    selectPlaceholder: '选择兼容版本',
    selectedPrefix: '已选择',
    selectedSuffix: '个版本',
    major: '主',
    minor: '次',
    patch: '补丁',
    prerelease: '预发布',
    release: '正式版',
    selectedCount: (count: number) => `已选择 ${count} 个版本`
  },
  en: {
    loading: 'Loading game versions…',
    unavailable: 'The game version catalog is temporarily unavailable.',
    retry: 'Reload game versions',
    stable: 'Stable',
    unstable: 'Unstable',
    latest: 'Latest',
    saved: 'Saved version',
    maximum: 'Select up to 32 game versions',
    releaseMaximum: `Select up to ${MAX_RELEASE_COMPATIBLE_VERSIONS} game versions`,
    searchPlaceholder: 'Filter versions',
    noMatches: 'No matching game versions',
    allVersions: 'List all versions',
    selectPlaceholder: 'Select compatible versions',
    selectedPrefix: 'Selected',
    selectedSuffix: 'versions',
    major: 'Major',
    minor: 'Minor',
    patch: 'Patch',
    prerelease: 'Pre-release',
    release: 'Release',
    selectedCount: (count: number) => `${count} Version${count === 1 ? '' : 's'} Selected`
  }
} as const;

function parseVersion(value: string): ParsedVersion | null {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:-([a-z]+(?:[.-]?\d+)?))?$/i.exec(value.trim());
  if (!match) return null;

  const prerelease = match[4] ? match[4].replace(/^(dev|pre|rc)[.-]?(\d+)$/i, '$1.$2') : '';
  return { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]), prerelease };
}

function compareTreeLeaves(left: VersionTreeLeaf, right: VersionTreeLeaf) {
  if (!left.prerelease && right.prerelease) return -1;
  if (left.prerelease && !right.prerelease) return 1;
  return right.option.value.localeCompare(left.option.value, undefined, { numeric: true, sensitivity: 'base' });
}

function buildVersionTree(options: Array<GameVersionOption & { saved?: boolean }>): { tree: VersionTreeMajor[]; unparsed: Array<GameVersionOption & { saved?: boolean }> } {
  const majorMap = new Map<number, Map<number, Map<number, VersionTreeLeaf[]>>>();
  const unparsed: Array<GameVersionOption & { saved?: boolean }> = [];

  for (const option of options) {
    const parsed = parseVersion(option.value);
    if (!parsed) {
      unparsed.push(option);
      continue;
    }

    const minorMap = majorMap.get(parsed.major) ?? new Map<number, Map<number, VersionTreeLeaf[]>>();
    const patchMap = minorMap.get(parsed.minor) ?? new Map<number, VersionTreeLeaf[]>();
    const leaves = patchMap.get(parsed.patch) ?? [];
    leaves.push({ option, prerelease: parsed.prerelease });
    patchMap.set(parsed.patch, leaves);
    minorMap.set(parsed.minor, patchMap);
    majorMap.set(parsed.major, minorMap);
  }

  const tree = [...majorMap.entries()]
    .sort(([left], [right]) => right - left)
    .map(([major, minorMap]) => ({
      value: major,
      minors: [...minorMap.entries()]
        .sort(([left], [right]) => right - left)
        .map(([minor, patchMap]) => ({
          value: minor,
          patches: [...patchMap.entries()]
            .sort(([left], [right]) => right - left)
            .map(([patch, leaves]) => ({ value: patch, leaves: leaves.sort(compareTreeLeaves) }))
        }))
    }));

  return { tree, unparsed: unparsed.sort((left, right) => right.value.localeCompare(left.value, undefined, { numeric: true, sensitivity: 'base' })) };
}

export function GameVersionPicker({ value, onChange, ariaLabel, collapsible = false, variant = 'list' }: Props) {
  const language = useSiteLanguage();
  const text = copy[language];
  const pickerRef = useRef<HTMLDivElement>(null);
  const [options, setOptions] = useState<GameVersionOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const [query, setQuery] = useState('');
  const [showAllVersions, setShowAllVersions] = useState(false);
  const [open, setOpen] = useState(!collapsible);
  const selectionLimit = variant === 'tree' ? MAX_RELEASE_COMPATIBLE_VERSIONS : 32;
  const maximumText = variant === 'tree' ? text.releaseMaximum : text.maximum;

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setFailed(false);
    fetch('/api/v1/game-versions', { signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({})) as { data?: GameVersionOption[] };
        if (!response.ok || !Array.isArray(payload.data)) throw new Error('Unable to load game versions');
        setOptions(payload.data);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setFailed(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [reloadToken]);

  useEffect(() => {
    if (!collapsible || !open) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [collapsible, open]);

  const optionMap = useMemo(() => new Map(options.map((option) => [option.value, option])), [options]);
  const listedOptions = useMemo(() => [
    ...options,
    ...value.filter((version) => isSupportedGameVersion(version) && !optionMap.has(version)).map((version) => ({ value: version, channel: 'stable' as const, latest: false, saved: true }))
  ], [optionMap, options, value]);
  const visibleOptions = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return listedOptions.filter((option) => {
      const selected = value.includes(option.value);
      if (!showAllVersions && option.channel === 'unstable' && !selected) return false;
      return !keyword || option.value.toLowerCase().includes(keyword);
    });
  }, [listedOptions, query, showAllVersions, value]);
  const visibleTreeOptions = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return listedOptions.filter((option) => !keyword || option.value.toLowerCase().includes(keyword));
  }, [listedOptions, query]);
  const versionTree = useMemo(() => buildVersionTree(visibleTreeOptions), [visibleTreeOptions]);

  const selectedSummary = value.length === 0
    ? text.selectPlaceholder
    : value.length <= 2
      ? value.join(' · ')
      : `${value.slice(0, 2).join(' · ')} +${value.length - 2}`;

  const toggleVersion = useCallback((version: string) => {
    if (value.includes(version)) {
      onChange(value.filter((current) => current !== version));
      return;
    }
    if (value.length < selectionLimit) onChange([...value, version]);
  }, [onChange, selectionLimit, value]);

  const renderVersionOption = (option: GameVersionOption & { saved?: boolean }) => {
    const selected = value.includes(option.value);
    const saved = Boolean(option.saved);
    const disabled = !selected && value.length >= selectionLimit;
    return (
      <button className={selected ? 'game-version-picker__option game-version-picker__option--selected' : 'game-version-picker__option'} key={option.value} type="button" role={collapsible ? 'option' : undefined} disabled={disabled} title={disabled ? maximumText : undefined} aria-pressed={selected} aria-selected={collapsible ? selected : undefined} onClick={() => toggleVersion(option.value)}>
        <span className="game-version-picker__value">{option.value}</span>
        <span className={option.channel === 'unstable' ? 'game-version-picker__channel game-version-picker__channel--unstable' : 'game-version-picker__channel'}>{saved ? text.saved : option.channel === 'unstable' ? text.unstable : text.stable}</span>
        {option.latest ? <span className="game-version-picker__latest">{text.latest}</span> : null}
        <span className="game-version-picker__check" aria-hidden="true"><Check size={13} strokeWidth={2.6} /></span>
      </button>
    );
  };

  const renderTreeLeaf = (leaf: VersionTreeLeaf) => {
    const { option } = leaf;
    const selected = value.includes(option.value);
    const disabled = !selected && value.length >= selectionLimit;
    const prereleaseLabel = leaf.prerelease ? `.${leaf.prerelease.replace('.', '-')}` : '\u00a0';
    return (
      <div className="game-version-picker__tree-row game-version-picker__tree-row--leaf" key={option.value}>
        <span className={leaf.prerelease ? 'game-version-picker__tree-label game-version-picker__tree-label--pre' : 'game-version-picker__tree-label game-version-picker__tree-label--release'}>{prereleaseLabel}</span>
        <button className={selected ? 'game-version-picker__tree-select game-version-picker__tree-select--selected' : 'game-version-picker__tree-select'} type="button" role="option" disabled={disabled} title={disabled ? maximumText : option.value} aria-label={option.value} aria-pressed={selected} aria-selected={selected} onClick={() => toggleVersion(option.value)}>
          <span className="game-version-picker__tree-mark" aria-hidden="true">{selected ? <Check size={13} strokeWidth={2.8} /> : null}</span>
        </button>
      </div>
    );
  };

  const treeContent = (
    <>
      <div className="game-version-picker__search">
        <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={text.searchPlaceholder} aria-label={text.searchPlaceholder} />
      </div>
      <div className="game-version-picker__tree" role="listbox" aria-label={ariaLabel}>
        <p className="game-version-picker__tree-count">{text.selectedCount(value.length)}</p>
        <div className="game-version-picker__tree-heading" aria-hidden="true"><span>{text.major}</span><span>{text.minor}</span><span>{text.patch}</span><span>{text.prerelease}</span><span /></div>
        <div className="game-version-picker__tree-body">
          {versionTree.tree.map((major) => (
            <div className="game-version-picker__tree-branch game-version-picker__tree-branch--major" key={major.value}>
              <span className="game-version-picker__tree-label game-version-picker__tree-label--major">{major.value}</span>
              <div className="game-version-picker__tree-children">
                {major.minors.map((minor) => (
                  <div className="game-version-picker__tree-branch game-version-picker__tree-branch--minor" key={minor.value}>
                    <span className="game-version-picker__tree-label game-version-picker__tree-label--minor">.{minor.value}</span>
                    <div className="game-version-picker__tree-children">
                      {minor.patches.map((patch) => (
                        <div className="game-version-picker__tree-branch game-version-picker__tree-branch--patch" key={patch.value}>
                          <span className="game-version-picker__tree-label game-version-picker__tree-label--patch">.{patch.value}</span>
                          <div className="game-version-picker__tree-children">{patch.leaves.map(renderTreeLeaf)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {versionTree.unparsed.map(renderVersionOption)}
          {!loading && !failed && !visibleTreeOptions.length ? <p className="game-version-picker__state">{text.noMatches}</p> : null}
          {loading ? <p className="game-version-picker__state"><LoaderCircle size={16} />{text.loading}</p> : null}
          {failed ? <p className="game-version-picker__state game-version-picker__state--error">{text.unavailable}</p> : null}
        </div>
      </div>
      {failed ? <button className="game-version-picker__retry game-version-picker__retry--tree" type="button" title={text.retry} aria-label={text.retry} onClick={() => setReloadToken((current) => current + 1)}><RefreshCw size={15} /></button> : null}
    </>
  );

  const listContent = (
    <>
      <div className="game-version-picker__search">
        <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={text.searchPlaceholder} aria-label={text.searchPlaceholder} />
      </div>
      <div className="game-version-picker__list">
        {visibleOptions.map(renderVersionOption)}
        {!loading && !failed && !visibleOptions.length ? <p className="game-version-picker__state">{text.noMatches}</p> : null}
        {loading ? <p className="game-version-picker__state"><LoaderCircle size={16} />{text.loading}</p> : null}
        {failed ? <p className="game-version-picker__state game-version-picker__state--error">{text.unavailable}</p> : null}
      </div>
      <div className="game-version-picker__all-versions">
        <button className={showAllVersions ? 'game-version-picker__all-versions-toggle game-version-picker__all-versions-toggle--checked' : 'game-version-picker__all-versions-toggle'} type="button" role="checkbox" aria-checked={showAllVersions} aria-label={text.allVersions} onClick={() => setShowAllVersions((current) => !current)}>
          <span className="game-version-picker__all-versions-mark" aria-hidden="true">{showAllVersions ? <Check size={14} strokeWidth={2.4} /> : null}</span>
          <span aria-hidden="true">{text.allVersions}</span>
        </button>
      </div>
      {failed ? <button className="game-version-picker__retry" type="button" title={text.retry} aria-label={text.retry} onClick={() => setReloadToken((current) => current + 1)}><RefreshCw size={15} /></button> : null}
    </>
  );

  const pickerContent = variant === 'tree' ? treeContent : listContent;

  return (
    <div ref={pickerRef} className={collapsible ? `game-version-picker game-version-picker--dropdown${open ? ' game-version-picker--open' : ''}` : 'game-version-picker'} role="group" aria-label={ariaLabel} aria-busy={loading}>
      {collapsible ? (
        <>
          <button className="game-version-picker__trigger" type="button" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((current) => !current)}>
            <span className="game-version-picker__trigger-value"><ListFilter size={16} aria-hidden="true" /><span>{selectedSummary}</span></span>
            {value.length > 0 ? <span className="game-version-picker__trigger-count">{text.selectedPrefix} {value.length} {text.selectedSuffix}</span> : null}
          </button>
          {open ? <div className={variant === 'tree' ? 'game-version-picker__popover game-version-picker__popover--tree' : 'game-version-picker__popover'} role={variant === 'list' ? 'listbox' : undefined} aria-label={variant === 'list' ? ariaLabel : undefined}>{pickerContent}</div> : null}
        </>
      ) : pickerContent}
    </div>
  );
}
