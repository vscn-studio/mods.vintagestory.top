import { NextRequest } from 'next/server';
import { databaseOrResponse } from '@/lib/api-auth';
import { jsonData } from '@/lib/api-errors';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const database = await databaseOrResponse(request); if ('response' in database) return database.response;
  const [gameVersions, categories, environments, tags] = await Promise.all([
    database.db.gameVersion.findMany({ orderBy: { value: 'desc' }, take: 100, select: { value: true } }),
    database.db.category.findMany({ orderBy: { name: 'asc' }, take: 100, select: { slug: true, name: true, nameEn: true } }),
    database.db.environment.findMany({ orderBy: { name: 'asc' }, take: 100, select: { slug: true, name: true, nameEn: true } }),
    database.db.tag.findMany({ orderBy: { name: 'asc' }, take: 200, select: { slug: true, name: true, nameEn: true } })
  ]);
  return jsonData({ gameVersions: gameVersions.map((item) => item.value), categories, environments, tags }, request);
}
