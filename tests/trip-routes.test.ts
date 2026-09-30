import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Deps } from '@/lib/deps';
import type { MemoryRepo } from '@/lib/repo/memory';
import { makeDeps, seedUser } from './helpers/fakes';

const state = vi.hoisted(() => ({ deps: null as Deps | null, userId: null as string | null }));
vi.mock('@/lib/server-deps', () => ({ getDeps: () => state.deps }));
vi.mock('@/lib/auth', () => ({ currentUserId: async () => state.userId }));
vi.mock('@/lib/env', () => ({ serverEnv: () => ({ cronSecret: 'cron-secret', telegramWebhookSecret: 'tg-secret' }) }));

const post = (body: unknown, headers: Record<string, string> = {}) =>
  new Request('http://test/api', {
    method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body),
  });
const params = <T>(value: T) => ({ params: Promise.resolve(value) });

let repo: MemoryRepo;

beforeEach(async () => {
  const made = makeDeps();
  repo = made.repo;
  await seedUser(repo);
  await seedUser(repo, { id: 'user-2', name: 'Hina', phone: '+923331112222' });
  state.deps = made.deps;
  state.userId = 'user-1';
});

async function startTripFor(userId: string) {
  state.userId = userId;
  const { POST } = await import('@/app/api/trips/route');
  const res = await POST(post({ durationMin: 20, vehiclePhotoPath: null }));
  expect(res.status).toBe(201);
  return (await res.json()).trip.id as string;
}

describe('trip routes', () => {
  it('rejects a trip without a session and with a bad duration', async () => {
    const { POST } = await import('@/app/api/trips/route');
    state.userId = null;
    expect((await POST(post({ durationMin: 20 }))).status).toBe(401);
    state.userId = 'user-1';
    const res = await POST(post({ durationMin: 'lots' }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'invalid_duration' });
  });

  it('duress finish is indistinguishable from a safe finish', async () => {
    const { POST } = await import('@/app/api/trips/[id]/finish/route');
    const duressTrip = await startTripFor('user-1');
    const duress = await POST(post({ pin: '9999' }), params({ id: duressTrip }));
    const safeTrip = await startTripFor('user-2');
    const safe = await POST(post({ pin: '1234' }), params({ id: safeTrip }));
    expect(duress.status).toBe(safe.status);
    expect(await duress.json()).toEqual(await safe.json());
    expect(repo.data.alerts.map((a) => a.reason)).toEqual(['duress']);
  });

  it("returns 404 for another user's trip", async () => {
    const tripId = await startTripFor('user-1');
    state.userId = 'user-2';
    const { POST } = await import('@/app/api/trips/[id]/location/route');
    expect((await POST(post({ points: [] }), params({ id: tripId }))).status).toBe(404);
  });

  it('location route accepts garbage without failing', async () => {
    const tripId = await startTripFor('user-1');
    const { POST } = await import('@/app/api/trips/[id]/location/route');
    const res = await POST(post({ points: [{ lat: 'x' }, { lat: 24, lng: 67 }] }), params({ id: tripId }));
    expect(await res.json()).toMatchObject({ saved: 1, status: 'active' });
  });

  it('sos alerts with the given location', async () => {
    const { POST } = await import('@/app/api/sos/route');
    const res = await POST(post({ lat: 24.8, lng: 67.1, reason: 'calculator' }));
    expect(await res.json()).toEqual({ sent: 3, failed: 0 });
    expect(repo.data.alerts[0]).toMatchObject({ reason: 'calculator', lat: 24.8, lng: 67.1 });
  });
});

describe('public routes', () => {
  it('help answers wrong for junk without a session and never 500s', async () => {
    state.userId = null;
    const { POST } = await import('@/app/api/help/route');
    const res = await POST(post({ phone: 42, pin: null, action: 'dance' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'wrong' });
  });

  it('help is rate limited per IP', async () => {
    const { POST } = await import('@/app/api/help/route');
    const req = () => post({ phone: '03009999999', pin: '0000', action: 'help' }, { 'x-forwarded-for': '203.0.113.9' });
    const statuses: number[] = [];
    for (let i = 0; i < 11; i++) statuses.push((await POST(req())).status);
    expect(statuses.slice(0, 10).every((s) => s === 200)).toBe(true);
    expect(statuses[10]).toBe(429);
  });

  it('cron needs the secret', async () => {
    const { POST } = await import('@/app/api/cron/deadlines/route');
    expect((await POST(post({}))).status).toBe(401);
    expect((await POST(post({}, { 'x-cron-secret': 'wrong' }))).status).toBe(401);
    const ok = await POST(post({}, { 'x-cron-secret': 'cron-secret' }));
    expect(await ok.json()).toEqual({ expired: 0, retried: 0 });
  });

  it('live view 404s for unknown tokens', async () => {
    const { GET } = await import('@/app/api/t/[token]/route');
    expect((await GET(new Request('http://test'), params({ token: 'nope' }))).status).toBe(404);
  });
});
