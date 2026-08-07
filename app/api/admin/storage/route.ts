import { NextRequest } from 'next/server';
import { adminMutationError, adminOrResponse } from '@/lib/admin-auth';
import { writeAudit } from '@/lib/audit';
import { jsonData, jsonError } from '@/lib/api-errors';
import { storageStatus, testStorageConnection } from '@/lib/storage';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const auth = await adminOrResponse(request);
  if ('response' in auth) return auth.response;
  const [objects, aggregate] = await Promise.all([
    auth.db.storageObject.count({ where: { deletedAt: null } }),
    auth.db.storageObject.aggregate({ where: { deletedAt: null }, _sum: { size: true } })
  ]);
  return jsonData({ ...storageStatus(), objects, bytes: Number(aggregate._sum.size ?? BigInt(0)) }, request);
}

export async function POST(request: NextRequest) {
  const csrfError = adminMutationError(request);
  if (csrfError) return csrfError;
  const auth = await adminOrResponse(request);
  if ('response' in auth) return auth.response;
  try {
    const status = await testStorageConnection();
    await writeAudit(auth.db, request, { actorId: auth.actor.id, action: 'storage.connection.test', resourceType: 'storage', resourceId: status.provider, after: { driver: status.driver, provider: status.provider, bucket: status.bucket, endpoint: status.endpoint } });
    return jsonData({ ...status, connected: true }, request);
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 300) : '存储连接测试失败。';
    return jsonError('STORAGE_CONNECTION_FAILED', message, 503, request);
  }
}
