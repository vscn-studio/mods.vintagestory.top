import { NextRequest } from 'next/server';
import { actorOrResponse, mutationAllowed } from '@/lib/api-auth';
import { jsonData, jsonError } from '@/lib/api-errors';
import { writeAudit } from '@/lib/audit';
import { requireConfirmation } from '@/lib/admin-auth';
import { effectiveOrganizationRole } from '@/lib/authorization';

export const runtime = 'nodejs';
type Params = { params: Promise<{ slug: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const csrfError = mutationAllowed(request); if (csrfError) return csrfError;
  const { slug } = await params; const auth = await actorOrResponse(request); if ('response' in auth) return auth.response;
  const organization = await auth.db.organization.findUnique({ where: { slug }, include: { members: true } });
  const role = organization ? effectiveOrganizationRole(auth.actor, organization) : null;
  if (!organization || role !== 'OWNER') return jsonError('FORBIDDEN', '只有组织 Owner 可以归档组织。', 403, request);
  const confirmationError = await requireConfirmation(request, auth.db, auth.actor.id, { action: 'organization.archive', resourceType: 'organization', resourceId: organization.id });
  if (confirmationError) return confirmationError;
  const updated = await auth.db.organization.update({ where: { id: organization.id }, data: { archivedAt: new Date() } });
  await writeAudit(auth.db, request, { actorId: auth.actor.id, action: 'organization.archive', resourceType: 'organization', resourceId: organization.id, before: { archivedAt: organization.archivedAt }, after: { archivedAt: updated.archivedAt } });
  return jsonData({ id: updated.id, slug: updated.slug, archived: true }, request);
}
