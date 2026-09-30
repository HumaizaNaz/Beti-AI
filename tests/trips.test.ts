import { describe, expect, it } from 'vitest';
import {
  expireDueTrips, extendTrip, finishTrip, getLiveView, recordLocations, sendSos, startTrip, TripError,
} from '@/lib/trips';
import { makeDeps, seedUser } from './helpers/fakes';

async function setup() {
  const ctx = makeDeps();
  const seeded = await seedUser(ctx.repo);
  const trip = await startTrip(ctx.deps, seeded.profile.id, { durationMin: 20, vehiclePhotoPath: null });
  return { ...ctx, ...seeded, trip };
}

describe('startTrip', () => {
  it('sets the deadline and a 128-bit share token', async () => {
    const { trip } = await setup();
    expect(trip.status).toBe('active');
    expect(trip.deadlineAt).toBe('2026-10-01T10:20:00.000Z');
    expect(trip.shareToken).toMatch(/^[A-Za-z0-9_-]{22}$/);
  });

  it('rejects durations that are not offered', async () => {
    const { deps, repo } = makeDeps();
    const { profile } = await seedUser(repo);
    await expect(startTrip(deps, profile.id, { durationMin: 15, vehiclePhotoPath: null })).rejects.toThrow(TripError);
  });

  it('rejects a second trip while one is open', async () => {
    const { deps, profile } = await setup();
    await expect(startTrip(deps, profile.id, { durationMin: 10, vehiclePhotoPath: null })).rejects.toThrow('trip_open');
  });

  it("rejects someone else's photo path", async () => {
    const { deps, repo } = makeDeps();
    const { profile } = await seedUser(repo);
    await expect(startTrip(deps, profile.id, { durationMin: 10, vehiclePhotoPath: 'other-user/x.jpg' })).rejects.toThrow('bad_photo');
  });
});

describe('recordLocations', () => {
  it('keeps valid points and drops garbage', async () => {
    const { deps, repo, profile, trip } = await setup();
    const r = await recordLocations(deps, profile.id, trip.id, [
      { lat: 24.86, lng: 67.0, accuracyM: 8, recordedAt: '2026-10-01T10:01:00.000Z' },
      { lat: 'x', lng: 67 },
      { lat: 95, lng: 67 },
      { lat: Number.NaN, lng: 67 },
      null,
      { lat: 24.9, lng: 67.1, accuracyM: -3, recordedAt: '2099-01-01T00:00:00.000Z' },
    ]);
    expect(r).toEqual({ saved: 2, status: 'active', deadlineAt: trip.deadlineAt });
    const stored = repo.data.locations.get(trip.id)!;
    expect(stored[1]).toEqual({ lat: 24.9, lng: 67.1, accuracyM: null, recordedAt: '2026-10-01T10:00:00.000Z' });
  });

  it('caps a batch at 100 points and ignores non-arrays', async () => {
    const { deps, profile, trip } = await setup();
    const many = Array.from({ length: 500 }, () => ({ lat: 24, lng: 67 }));
    expect((await recordLocations(deps, profile.id, trip.id, many)).saved).toBe(100);
    expect((await recordLocations(deps, profile.id, trip.id, 'nope')).saved).toBe(0);
  });

  it("refuses another user's trip", async () => {
    const { deps, trip } = await setup();
    await expect(recordLocations(deps, 'intruder', trip.id, [])).rejects.toThrow('not_found');
  });
});

describe('finishTrip', () => {
  it('safe PIN ends the trip and tells the family', async () => {
    const { deps, repo, tg, profile, trip } = await setup();
    expect(await finishTrip(deps, profile.id, trip.id, '1234')).toEqual({ status: 'safe' });
    const t = (await repo.getTrip(trip.id))!;
    expect(t.status).toBe('safe');
    expect(t.shareExpiresAt).toBe('2026-10-02T10:00:00.000Z');
    expect(tg.texts('111').at(-1)).toContain('reached safely');
    expect(repo.data.alerts).toHaveLength(0);
  });

  it('duress PIN looks exactly like safe but raises a silent alert', async () => {
    const { deps, repo, profile, trip } = await setup();
    expect(await finishTrip(deps, profile.id, trip.id, '9999')).toEqual({ status: 'safe' });
    expect((await repo.getTrip(trip.id))!.status).toBe('safe');
    expect(repo.data.alerts.map((a) => a.reason)).toEqual(['duress']);
    expect(repo.data.alerts[0].tripId).toBe(trip.id);
  });

  it('third wrong PIN alerts the family and locks', async () => {
    const { deps, repo, profile, trip } = await setup();
    expect(await finishTrip(deps, profile.id, trip.id, '0000')).toEqual({ status: 'wrong' });
    expect(await finishTrip(deps, profile.id, trip.id, '1111')).toEqual({ status: 'wrong' });
    expect(await finishTrip(deps, profile.id, trip.id, '2222')).toEqual({ status: 'locked' });
    expect(repo.data.alerts.map((a) => a.reason)).toEqual(['wrong_pin']);
    expect((await repo.getTrip(trip.id))!.status).toBe('alerted');
    expect(await finishTrip(deps, profile.id, trip.id, '1234')).toEqual({ status: 'locked' });
  });

  it('after a timer alert, finishing sends a false-alarm follow-up and resolves the alert', async () => {
    const { deps, repo, tg, profile, trip, advance } = await setup();
    advance(21);
    await expireDueTrips(deps);
    expect(await finishTrip(deps, profile.id, trip.id, '1234')).toEqual({ status: 'safe' });
    expect((await repo.getTrip(trip.id))!.status).toBe('safe');
    expect(repo.data.alerts[0].resolvedBy).toBe('Ayesha');
    expect(tg.texts('111').at(-1)).toContain('False alarm');
  });
});

describe('expireDueTrips (Dead-Man\'s Switch)', () => {
  it('does nothing before the deadline', async () => {
    const { deps, repo, advance } = await setup();
    advance(19);
    expect(await expireDueTrips(deps)).toEqual({ expired: 0, retried: 0 });
    expect(repo.data.alerts).toHaveLength(0);
  });

  it('alerts exactly once after the deadline', async () => {
    const { deps, repo, trip, advance } = await setup();
    advance(21);
    expect((await expireDueTrips(deps)).expired).toBe(1);
    expect((await expireDueTrips(deps)).expired).toBe(0);
    expect(repo.data.alerts.map((a) => a.reason)).toEqual(['timer']);
    expect((await repo.getTrip(trip.id))!.status).toBe('alerted');
  });

  it('timer and "safe" in the same minute produce one alert plus a follow-up', async () => {
    const { deps, repo, tg, profile, trip, advance } = await setup();
    advance(21);
    const [cron, finish] = await Promise.all([expireDueTrips(deps), finishTrip(deps, profile.id, trip.id, '1234')]);
    expect(finish).toEqual({ status: 'safe' });
    expect(repo.data.alerts.length).toBe(cron.expired);
    expect((await repo.getTrip(trip.id))!.status).toBe('safe');
    if (cron.expired === 1) expect(tg.texts('111').at(-1)).toContain('False alarm');
  });

  it('puts the trip back to active if raising the alert crashes, so the next run retries', async () => {
    const { deps, repo, trip, advance } = await setup();
    advance(21);
    const original = repo.createAlert;
    repo.createAlert = async () => {
      throw new Error('db down');
    };
    expect((await expireDueTrips(deps)).expired).toBe(1);
    expect((await repo.getTrip(trip.id))!.status).toBe('active');
    repo.createAlert = original;
    expect((await expireDueTrips(deps)).expired).toBe(1);
    expect(repo.data.alerts.map((a) => a.reason)).toEqual(['timer']);
  });
});

describe('extendTrip', () => {
  it('adds 10 minutes with the right PIN', async () => {
    const { deps, profile, trip } = await setup();
    expect(await extendTrip(deps, profile.id, trip.id, '1234')).toEqual({
      status: 'extended', deadlineAt: '2026-10-01T10:30:00.000Z',
    });
  });

  it('refuses without the right PIN', async () => {
    const { deps, profile, trip } = await setup();
    expect(await extendTrip(deps, profile.id, trip.id, '0000')).toEqual({ status: 'wrong' });
  });
});

describe('sendSos', () => {
  it('alerts immediately and marks the open trip alerted', async () => {
    const { deps, repo, profile, trip } = await setup();
    const r = await sendSos(deps, profile.id, { reason: 'sos', lat: 24.8, lng: 67.1 });
    expect(r.sent).toBe(3);
    expect((await repo.getTrip(trip.id))!.status).toBe('alerted');
    expect(repo.data.alerts[0]).toMatchObject({ reason: 'sos', lat: 24.8, lng: 67.1, tripId: trip.id });
  });
});

describe('getLiveView', () => {
  it('shows the last point and expires 24h after the trip ends', async () => {
    const { deps, profile, trip, advance } = await setup();
    await recordLocations(deps, profile.id, trip.id, [{ lat: 24.86, lng: 67.0 }]);
    expect(await getLiveView(deps, trip.shareToken)).toMatchObject({ name: 'Ayesha', status: 'active', last: { lat: 24.86 } });
    await finishTrip(deps, profile.id, trip.id, '1234');
    advance(24 * 60 + 1);
    expect(await getLiveView(deps, trip.shareToken)).toBeNull();
    expect(await getLiveView(deps, 'unknown')).toBeNull();
  });
});
