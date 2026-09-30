import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Deps } from '@/lib/deps';
import { makeDeps, seedUser } from './helpers/fakes';

const state = vi.hoisted(() => ({ deps: null as Deps | null, userId: null as string | null }));
vi.mock('@/lib/server-deps', () => ({ getDeps: () => state.deps }));
vi.mock('@/lib/auth', () => ({ currentUserId: async () => state.userId }));

const post = (body: unknown) =>
  new Request('http://test/api', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

describe('account routes', () => {
  beforeEach(async () => {
    const { deps, repo } = makeDeps();
    await seedUser(repo);
    state.deps = deps;
    state.userId = 'user-1';
  });

  it('returns 401 without a session', async () => {
    state.userId = null;
    const { GET } = await import('@/app/api/me/route');
    expect((await GET()).status).toBe(401);
  });

  it('GET /api/me returns the overview', async () => {
    const { GET } = await import('@/app/api/me/route');
    const res = await GET();
    expect(res.status).toBe(200);
    expect((await res.json()).profile.hasPin).toBe(true);
  });

  it('POST /api/contacts maps a wrong PIN to 403 and bad input to 400', async () => {
    const { POST } = await import('@/app/api/contacts/route');
    const base = { pin: '1234', name: 'Sara', relation: 'sister', phone: '03211234567' };
    expect((await POST(post({ ...base, pin: '0000' }))).status).toBe(403);
    const bad = await POST(post({ ...base, phone: 'x' }));
    expect(bad.status).toBe(400);
    expect(await bad.json()).toEqual({ error: 'bad_phone' });
    expect((await POST(post(base))).status).toBe(201);
  });

  it('POST /api/profile survives a non-JSON body', async () => {
    state.userId = 'new-user';
    const { POST } = await import('@/app/api/profile/route');
    const res = await POST(new Request('http://test/api', { method: 'POST', body: 'not json' }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'bad_name' });
  });
});
