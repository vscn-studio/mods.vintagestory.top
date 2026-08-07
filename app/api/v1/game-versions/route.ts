import { NextRequest } from 'next/server';
import { jsonData, jsonError } from '@/lib/api-errors';
import { parseGameVersionCatalog } from '@/lib/game-versions';

const catalogUrl = 'https://cdn.vintagestory.top/stable-unstable.json';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const response = await fetch(catalogUrl, {
      headers: { Accept: 'application/json' },
      next: { revalidate: 3600 }
    });
    if (!response.ok) throw new Error(`Vintage Story catalog returned ${response.status}`);

    const versions = parseGameVersionCatalog(await response.json());
    if (!versions.length) throw new Error('Vintage Story catalog did not contain any versions');
    return jsonData(versions, request);
  } catch {
    return jsonError('INTERNAL_ERROR', '游戏版本目录暂时不可用，请稍后重试。', 503, request);
  }
}
