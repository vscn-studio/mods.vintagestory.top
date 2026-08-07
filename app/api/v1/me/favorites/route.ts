import { NextRequest } from 'next/server';
import { actorOrResponse } from '@/lib/api-auth';
import { jsonData, parsePage } from '@/lib/api-errors';
import { projectInclude, serializeProject } from '@/lib/project-service';
import { canReadProject } from '@/lib/authorization';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const auth = await actorOrResponse(request);
  if ('response' in auth) return auth.response;
  const { page, pageSize } = parsePage(request);
  const where = auth.actor.siteRoles.includes('ADMIN')
    ? { accountId: auth.actor.id }
    : {
        accountId: auth.actor.id,
        project: {
          status: 'ACTIVE' as const,
          AND: [
            { OR: [{ ownerOrganizationId: null }, { ownerOrganization: { is: { archivedAt: null } } }] },
            { OR: [{ visibility: 'PUBLIC' as const }, { ownerAccountId: auth.actor.id }, { members: { some: { accountId: auth.actor.id } } }, { ownerOrganization: { members: { some: { accountId: auth.actor.id } } } }] }
          ]
        }
      };
  const [total, favorites] = await Promise.all([
    auth.db.favorite.count({ where }),
    auth.db.favorite.findMany({ where, include: { project: { include: projectInclude } }, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize })
  ]);
  return jsonData(favorites.filter((favorite) => canReadProject(auth.actor, favorite.project as never)).map((favorite) => serializeProject(favorite.project, { includePrivate: true })), request, { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) });
}
