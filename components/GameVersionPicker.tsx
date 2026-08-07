'use client';

import { Check, LoaderCircle, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSiteLanguage } from '@/components/SiteLanguageContext';
import type { GameVersionOption } from '@/lib/game-versions';

type Props = {
  value: string[];
  onChange: (versions: string[]) => void;
  ariaLabel: string;
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
    searchPlaceholder: '筛选版本号',
    noMatches: '没有匹配的游戏版本',
    allVersions: '列出所有版本'
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
    searchPlaceholder: 'Filter versions',
    noMatches: 'No matching game versions',
    allVersions: 'List all versions'
  }
} as const;

export function GameVersionPicker({ value, onChange, ariaLabel }: Props) {
  const language = useSiteLanguage();
  const text = copy[language];
  const [options, setOptions] = useState<GameVersionOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const [query, setQuery] = useState('');
  const [showAllVersions, setShowAllVersions] = useState(false);

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

  const optionMap = useMemo(() => new Map(options.map((option) => [option.value, option])), [options]);
  const listedOptions = useMemo(() => [
    ...options,
    ...value.filter((version) => !optionMap.has(version)).map((version) => ({ value: version, channel: 'stable' as const, latest: false, saved: true }))
  ], [optionMap, options, value]);
  const visibleOptions = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return listedOptions.filter((option) => {
      const selected = value.includes(option.value);
      if (!showAllVersions && option.channel === 'unstable' && !selected) return false;
      return !keyword || option.value.toLowerCase().includes(keyword);
    });
  }, [listedOptions, query, showAllVersions, value]);

  const toggleVersion = useCallback((version: string) => {
    if (value.includes(version)) {
      onChange(value.filter((current) => current !== version));
      return;
    }
    if (value.length < 32) onChange([...value, version]);
  }, [onChange, value]);

  return (
    <div className="game-version-picker" role="group" aria-label={ariaLabel} aria-busy={loading}>
      <div className="game-version-picker__search">
        <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={text.searchPlaceholder} aria-label={text.searchPlaceholder} />
      </div>
      <div className="game-version-picker__list">
        {visibleOptions.map((option) => {
          const selected = value.includes(option.value);
          const saved = 'saved' in option && option.saved;
          const disabled = !selected && value.length >= 32;
          return (
            <button className={selected ? 'game-version-picker__option game-version-picker__option--selected' : 'game-version-picker__option'} key={option.value} type="button" disabled={disabled} title={disabled ? text.maximum : undefined} aria-pressed={selected} onClick={() => toggleVersion(option.value)}>
              <span className="game-version-picker__value">{option.value}</span>
              <span className={option.channel === 'unstable' ? 'game-version-picker__channel game-version-picker__channel--unstable' : 'game-version-picker__channel'}>{saved ? text.saved : option.channel === 'unstable' ? text.unstable : text.stable}</span>
              {option.latest ? <span className="game-version-picker__latest">{text.latest}</span> : null}
              <span className="game-version-picker__check" aria-hidden="true"><Check size={13} strokeWidth={2.6} /></span>
            </button>
          );
        })}
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
    </div>
  );
}
