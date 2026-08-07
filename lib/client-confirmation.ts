import type { ConfirmationAction, ConfirmationResourceType } from '@/lib/confirmation-contract';

export function csrfToken(): string | undefined {
  return document.cookie.split('; ').find((item) => item.startsWith('vscn_csrf='))?.slice('vscn_csrf='.length);
}

/** Ensure the double-submit cookie exists before the first client mutation. */
export async function ensureCsrfToken(): Promise<string | undefined> {
  let token = csrfToken();
  if (token) return token;
  await fetch('/api/auth/me', { cache: 'no-store', credentials: 'same-origin' }).catch(() => undefined);
  token = csrfToken();
  return token;
}

async function csrfHeaders(): Promise<Record<string, string>> {
  const token = await ensureCsrfToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'x-csrf-token': decodeURIComponent(token) } : {})
  };
}

export async function mutationHeaders(): Promise<Record<string, string>> {
  return csrfHeaders();
}

export async function requestConfirmation(action: ConfirmationAction, resourceType: ConfirmationResourceType, resourceId: string): Promise<Record<string, string>> {
  const response = await fetch('/api/v1/confirmations', {
    method: 'POST',
    headers: await csrfHeaders(),
    body: JSON.stringify({ action, resourceType, resourceId, confirmed: true })
  });
  const payload = await response.json().catch(() => ({})) as { data?: { token?: string }; error?: { message?: string } };
  if (!response.ok || !payload.data?.token) throw new Error(payload.error?.message ?? 'Unable to confirm this action.');
  return { 'x-confirmation-token': payload.data.token };
}
