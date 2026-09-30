import { describe, expect, it } from 'vitest';
import { createMemoryRepo } from '@/lib/repo/memory';
import type { NewTrip } from '@/lib/repo/types';

function trip(overrides: Partial<NewTrip> = {}): NewTrip {
  return {
    userId: 'u1', vehiclePhotoPath: null, durationMin: 20,
    startedAt: '2026-10-01T10:00:00.000Z', deadlineAt: '2026-10-01T10:20:00.000Z',
    status: 'active', shareToken: 'tok', shareExpiresAt: null, ...overrides,
  };
}

describe('memory repo atomic contracts', () => {
  it('transitionTrip only moves from the expected status', async () => {
    const repo = createMemoryRepo();
    const t = await repo.createTrip(trip());
    expect(await repo.transitionTrip(t.id, 'alerted', 'safe')).toBeNull();
    const moved = await repo.transitionTrip(t.id, 'active', 'safe', { shareExpiresAt: '2026-10-02T10:00:00.000Z' });
    expect(moved?.status).toBe('safe');
    expect(moved?.shareExpiresAt).toBe('2026-10-02T10:00:00.000Z');
  });

  it('claimDueTrips claims each due trip exactly once', async () => {
    const repo = createMemoryRepo();
    const due = await repo.createTrip(trip());
    await repo.createTrip(trip({ deadlineAt: '2026-10-01T11:00:00.000Z', shareToken: 't2' }));
    const now = new Date('2026-10-01T10:21:00.000Z');
    expect((await repo.claimDueTrips(now)).map((t) => t.id)).toEqual([due.id]);
    expect(await repo.claimDueTrips(now)).toEqual([]);
  });

  it('getOpenTrip returns the newest active or alerted trip', async () => {
    const repo = createMemoryRepo();
    await repo.createTrip(trip({ status: 'safe', startedAt: '2026-10-01T11:00:00.000Z', shareToken: 'a' }));
    const alerted = await repo.createTrip(trip({ status: 'alerted', shareToken: 'b' }));
    expect((await repo.getOpenTrip('u1'))?.id).toBe(alerted.id);
    expect(await repo.getOpenTrip('someone-else')).toBeNull();
  });

  it('resolveAlert succeeds only once', async () => {
    const repo = createMemoryRepo();
    const a = await repo.createAlert({
      userId: 'u1', tripId: null, reason: 'sos', lat: null, lng: null, photoPath: null,
      createdAt: '2026-10-01T10:00:00.000Z',
    });
    const at = new Date('2026-10-01T10:05:00.000Z');
    expect((await repo.resolveAlert(a.id, 'Ammi', at))?.resolvedBy).toBe('Ammi');
    expect(await repo.resolveAlert(a.id, 'Ali', at)).toBeNull();
    expect(await repo.latestOpenAlert('u1')).toBeNull();
  });

  it('listRetryableDeliveries skips sent and exhausted deliveries', async () => {
    const repo = createMemoryRepo();
    const [retryable] = await repo.createDeliveries([
      { alertId: 'x', contactId: 'c1', channel: 'telegram', status: 'failed', attempts: 1, lastError: 'e' },
      { alertId: 'x', contactId: 'c2', channel: 'email', status: 'sent', attempts: 1, lastError: null },
      { alertId: 'x', contactId: 'c3', channel: 'telegram', status: 'failed', attempts: 3, lastError: 'e' },
    ]);
    expect((await repo.listRetryableDeliveries(3)).map((d) => d.id)).toEqual([retryable.id]);
  });

  it('returns copies, not live references', async () => {
    const repo = createMemoryRepo();
    const t = await repo.createTrip(trip());
    t.status = 'safe';
    expect((await repo.getTrip(t.id))?.status).toBe('active');
  });
});
