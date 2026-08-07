import { NextRequest } from 'next/server';
import { actorOrResponse, mutationAllowed } from '@/lib/api-auth';
import { jsonData, jsonError, parsePage } from '@/lib/api-errors';

export const runtime = 'nodejs';

function payloadRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function projectHref(type: string, slug: string): string {
  return type === 'MODPACK' ? `/modpack/${encodeURIComponent(slug)}` : `/mod/${encodeURIComponent(slug)}`;
}

function notificationDescription(type: string, payload: Record<string, unknown>): string {
  const reason = typeof payload.reason === 'string' ? payload.reason.trim() : '';
  if (type === 'project.comment') return '项目收到了一条新评论。';
  if (type === 'release.published') return '项目版本已通过审核并发布。';
  if (type === 'release.rejected') return reason ? `项目版本未通过审核：${reason}` : '项目版本未通过审核。';
  return '你有一条新的站内通知。';
}

export async function GET(request: NextRequest) {
  const auth = await actorOrResponse(request);
  if ('response' in auth) return auth.response;
  const { page, pageSize } = parsePage(request);
  const [total, notifications] = await Promise.all([
    auth.db.notification.count({ where: { accountId: auth.actor.id } }),
    auth.db.notification.findMany({ where: { accountId: auth.actor.id }, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize })
  ]);
  const payloads = notifications.map((notification) => payloadRecord(notification.payload));
  const projectIds = [...new Set(payloads.map((payload) => typeof payload.projectId === 'string' ? payload.projectId : '').filter(Boolean))];
  const releaseIds = [...new Set(payloads.map((payload) => typeof payload.releaseId === 'string' ? payload.releaseId : '').filter(Boolean))];
  const [projects, releases, unread] = await Promise.all([
    projectIds.length ? auth.db.project.findMany({ where: { id: { in: projectIds } }, select: { id: true, slug: true, name: true, type: true } }) : [],
    releaseIds.length ? auth.db.release.findMany({ where: { id: { in: releaseIds } }, select: { id: true, version: true, project: { select: { id: true, slug: true, name: true, type: true } } } }) : [],
    auth.db.notification.count({ where: { accountId: auth.actor.id, readAt: null } })
  ]);
  const projectById = new Map(projects.map((project) => [project.id, project]));
  const releaseById = new Map(releases.map((release) => [release.id, release]));
  return jsonData(notifications.map((notification, index) => {
    const payload = payloads[index];
    const release = typeof payload.releaseId === 'string' ? releaseById.get(payload.releaseId) : undefined;
    const project = release?.project ?? (typeof payload.projectId === 'string' ? projectById.get(payload.projectId) : undefined);
    return {
      id: notification.id,
      type: notification.type,
      payload: notification.payload,
      read: Boolean(notification.readAt),
      createdAt: notification.createdAt.toISOString(),
      title: project ? `${project.name}${release ? ` · v${release.version}` : ''}` : 'VSCN Mod DB',
      description: notificationDescription(notification.type, payload),
      href: project ? projectHref(project.type, project.slug) : null
    };
  }), request, { page, pageSize, total, unread });
}

export async function PATCH(request: NextRequest) {
  const csrfError = mutationAllowed(request);
  if (csrfError) return csrfError;
  const auth = await actorOrResponse(request);
  if ('response' in auth) return auth.response;
  const body = await request.json().catch(() => ({})) as { id?: string; all?: boolean };
  if (body.all) {
    await auth.db.notification.updateMany({ where: { accountId: auth.actor.id, readAt: null }, data: { readAt: new Date() } });
    return jsonData({ updated: true }, request);
  }
  if (!body.id) return jsonError('VALIDATION_ERROR', '通知 ID 无效。', 422, request);
  const updated = await auth.db.notification.updateMany({ where: { id: body.id, accountId: auth.actor.id }, data: { readAt: new Date() } });
  if (!updated.count) return jsonError('NOT_FOUND', '通知不存在。', 404, request);
  return jsonData({ updated: true }, request);
}
