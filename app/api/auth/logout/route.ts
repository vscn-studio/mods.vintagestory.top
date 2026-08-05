import { NextResponse } from 'next/server';
import { clearAccountSession } from '@/lib/auth-server';

export const runtime = 'nodejs';

export async function POST() {
  const response = NextResponse.json({ ok: true });
  clearAccountSession(response);
  return response;
}
