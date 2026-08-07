import { NextRequest } from 'next/server';
import { z } from 'zod';
import { actorOrResponse, mutationAllowed } from '@/lib/api-auth';
import { jsonData, jsonError } from '@/lib/api-errors';
import { issueConfirmation } from '@/lib/admin-auth';
import { CONFIRMATION_ACTIONS, CONFIRMATION_RESOURCE_TYPES, isConfirmationScope } from '@/lib/confirmation-contract';

export const runtime = 'nodejs';

const schema = z.object({
  action: z.enum(CONFIRMATION_ACTIONS),
  resourceType: z.enum(CONFIRMATION_RESOURCE_TYPES),
  resourceId: z.string().trim().min(1).max(120),
  confirmed: z.literal(true)
});

export async function POST(request: NextRequest) {
  const csrfError = mutationAllowed(request);
  if (csrfError) return csrfError;
  const auth = await actorOrResponse(request);
  if ('response' in auth) return auth.response;
  let input: z.infer<typeof schema>;
  try {
    input = schema.parse(await request.json());
  } catch {
    return jsonError('VALIDATION_ERROR', '二次确认请求无效。', 422, request);
  }
  if (!isConfirmationScope(input)) return jsonError('VALIDATION_ERROR', '二次确认资源类型无效。', 422, request);
  const confirmation = await issueConfirmation(auth.db, auth.actor.id, input);
  return jsonData({ token: confirmation.token, expiresAt: confirmation.expiresAt.toISOString() }, request);
}
