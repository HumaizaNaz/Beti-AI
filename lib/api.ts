// lib/api.ts
import { NextResponse } from 'next/server';
import { AccountError } from '@/lib/account';
import { currentUserId } from '@/lib/auth';
import { TripError } from '@/lib/trips';

export function json(data: unknown, status = 200): Response {
  return NextResponse.json(data, { status });
}

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const body = await req.json();
    return body && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

const ACCOUNT_STATUS: Partial<Record<AccountError['code'], number>> = { wrong_pin: 403, locked: 423, not_found: 404 };

export function errorResponse(err: unknown): Response {
  if (err instanceof TripError) return json({ error: err.code }, err.code === 'not_found' ? 404 : 400);
  if (err instanceof AccountError) return json({ error: err.code }, ACCOUNT_STATUS[err.code] ?? 400);
  console.error(err);
  return json({ error: 'server_error' }, 500);
}

export async function withUser(handler: (userId: string) => Promise<Response>): Promise<Response> {
  const userId = await currentUserId();
  if (!userId) return json({ error: 'unauthorized' }, 401);
  try {
    return await handler(userId);
  } catch (err) {
    return errorResponse(err);
  }
}
