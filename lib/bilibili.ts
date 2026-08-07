function positivePage(value: string | null): string {
  const page = Number.parseInt(value ?? '1', 10);
  return String(Number.isSafeInteger(page) && page > 0 && page <= 999 ? page : 1);
}

function playerUrl(identifier: { bvid?: string; aid?: string }, page: string): string | null {
  if (identifier.bvid && /^BV[0-9A-Za-z]+$/i.test(identifier.bvid)) {
    return `https://player.bilibili.com/player.html?bvid=${encodeURIComponent(identifier.bvid)}&page=${page}&high_quality=1&danmaku=0`;
  }
  if (identifier.aid && /^\d{1,20}$/.test(identifier.aid)) {
    return `https://player.bilibili.com/player.html?aid=${identifier.aid}&page=${page}&high_quality=1&danmaku=0`;
  }
  return null;
}

/** Converts public Bilibili video links to the only iframe source we permit. */
export function bilibiliEmbedUrl(value: string): string | null {
  try {
    const url = new URL(value.trim());
    const host = url.hostname.toLowerCase();
    const page = positivePage(url.searchParams.get('p') ?? url.searchParams.get('page'));
    if (host === 'player.bilibili.com' && url.pathname === '/player.html') {
      return playerUrl({ bvid: url.searchParams.get('bvid') ?? undefined, aid: url.searchParams.get('aid') ?? undefined }, page);
    }
    if (host === 'www.bilibili.com' || host === 'bilibili.com') {
      const match = url.pathname.match(/^\/video\/(BV[0-9A-Za-z]+|av\d+)\/?$/i);
      if (!match) return null;
      const identifier = match[1];
      return identifier.toLowerCase().startsWith('av')
        ? playerUrl({ aid: identifier.slice(2) }, page)
        : playerUrl({ bvid: identifier }, page);
    }
  } catch {
    return null;
  }
  return null;
}

export function bilibiliEmbedHtml(value: string): string | null {
  const src = bilibiliEmbedUrl(value);
  return src ? `<iframe src="${src}" width="100%" height="520" frameborder="0" allowfullscreen="true" allow="autoplay; fullscreen" loading="lazy"></iframe>` : null;
}
