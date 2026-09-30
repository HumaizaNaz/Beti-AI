import { describe, expect, it } from 'vitest';
import { getOverview } from '@/lib/account';
import { raiseAlert, retryDeliveries } from '@/lib/alerts';
import { helpFromAnyPhone } from '@/lib/help';
import { handleTelegramUpdate } from '@/lib/telegram-webhook';
import { expireDueTrips, extendTrip, finishTrip, getLiveView, recordLocations, sendSos, startTrip } from '@/lib/trips';
import { makeDeps, seedUser } from './helpers/fakes';

async function setup() {
  const ctx = makeDeps();
  const seeded = await seedUser(ctx.repo);
  const trip = await startTrip(ctx.deps, seeded.profile.id, { durationMin: 10, vehiclePhotoPath: null });
  return { ...ctx, ...seeded, trip };
}

describe('C1: a claimed timer trip is never stranded without an alert', () => {
  it('re-alerts a claimed trip whose alert crashed, even when the revert also fails', async () => {
    const { deps, repo, trip, advance } = await setup();
    advance(11);
    const createAlert = repo.createAlert;
    const transitionTrip = repo.transitionTrip;
    repo.createAlert = async () => {
      throw new Error('db down');
    };
    repo.transitionTrip = async () => {
      throw new Error('db down');
    };
    await expireDueTrips(deps);
    repo.createAlert = createAlert;
    repo.transitionTrip = transitionTrip;
    advance(3);
    await expireDueTrips(deps);
    expect(repo.data.alerts.filter((a) => a.tripId === trip.id).map((a) => a.reason)).toEqual(['timer']);
  });

  it('a crash on one trip does not stop the other trips', async () => {
    const { deps, repo, advance } = makeDeps();
    await seedUser(repo, { id: 'a', phone: '+923001111111' });
    await seedUser(repo, { id: 'b', phone: '+923002222222' });
    await startTrip(deps, 'a', { durationMin: 10, vehiclePhotoPath: null });
    const tripB = await startTrip(deps, 'b', { durationMin: 10, vehiclePhotoPath: null });
    advance(11);
    const createAlert = repo.createAlert;
    let calls = 0;
    repo.createAlert = async (a) => {
      calls++;
      if (calls === 1) throw new Error('db blip');
      return createAlert(a);
    };
    repo.transitionTrip = async () => {
      throw new Error('db down');
    };
    await expireDueTrips(deps);
    expect(repo.data.alerts.map((a) => a.tripId)).toEqual([tripB.id]);
  });

  it('does not re-alert a trip whose timer alert was sent', async () => {
    const { deps, repo, advance } = await setup();
    advance(11);
    await expireDueTrips(deps);
    advance(5);
    await expireDueTrips(deps);
    expect(repo.data.alerts).toHaveLength(1);
  });
});

describe('C2: duress stays indistinguishable, and the family still sees danger', () => {
  it('duress on +10 min really extends and keeps the trip on screen', async () => {
    const { deps, repo, profile, trip } = await setup();
    const r = await extendTrip(deps, profile.id, trip.id, '9999');
    expect(r).toEqual({ status: 'extended', deadlineAt: '2026-10-01T10:20:00.000Z' });
    const loc = await recordLocations(deps, profile.id, trip.id, [{ lat: 24, lng: 67 }]);
    expect(loc).toMatchObject({ status: 'active', deadlineAt: '2026-10-01T10:20:00.000Z' });
    expect((await getOverview(deps, profile.id)).openTrip?.id).toBe(trip.id);
    expect(repo.data.alerts.map((a) => a.reason)).toEqual(['duress']);
    expect((await getLiveView(deps, trip.shareToken))?.status).toBe('alerted');
  });

  it('duress on "Pohanch gayi" hides the trip on the phone but shows danger on the live link', async () => {
    const { deps, profile, trip } = await setup();
    expect(await finishTrip(deps, profile.id, trip.id, '9999')).toEqual({ status: 'safe' });
    expect((await getOverview(deps, profile.id)).openTrip).toBeNull();
    expect((await recordLocations(deps, profile.id, trip.id, [])).status).toBe('safe');
    expect((await getLiveView(deps, trip.shareToken))?.status).toBe('alerted');
    await expect(startTrip(deps, profile.id, { durationMin: 10, vehiclePhotoPath: null })).resolves.toMatchObject({ status: 'active' });
  });
});

describe('C3: an invite link cannot be reused to hijack a connected contact', () => {
  it('refuses /start from a different chat once connected', async () => {
    const { deps, repo, tg } = makeDeps();
    const { profile } = await seedUser(repo);
    const sara = await repo.createContact({
      userId: profile.id, name: 'Sara', relation: 'sister', phone: null, email: null,
      telegramChatId: null, inviteToken: 'invite-sara', status: 'pending',
    });
    await handleTelegramUpdate(deps, { message: { chat: { id: 555 }, text: '/start invite-sara' } });
    await handleTelegramUpdate(deps, { message: { chat: { id: 666 }, text: '/start invite-sara' } });
    expect((await repo.getContact(sara.id))!.telegramChatId).toBe('555');
    expect(tg.texts('666')[0]).toContain('not valid');
  });
});

describe('C4: parallel PIN guesses cannot bypass the lock', () => {
  it('a burst of wrong PINs gets at most three real tries and one family alert', async () => {
    const { deps, repo, profile, trip } = await setup();
    const results = await Promise.all(
      Array.from({ length: 12 }, (_, i) => finishTrip(deps, profile.id, trip.id, String(1000 + i * 7).padStart(4, '0'))),
    );
    expect(results.filter((r) => r.status === 'wrong').length).toBeLessThanOrEqual(2);
    expect(repo.data.alerts.filter((a) => a.reason === 'wrong_pin')).toHaveLength(1);
    expect(await finishTrip(deps, profile.id, trip.id, '1234')).toEqual({ status: 'locked' });
  }, 20_000); // 12 parallel bcrypt compares are CPU-bound when the whole suite runs
});

describe('I1: timer alert racing "Pohanch gayi"', () => {
  it('if she finishes while the timer alert is being sent, the family gets the false-alarm message last', async () => {
    const { deps, repo, tg, profile, trip, advance } = await setup();
    advance(11);
    const createAlert = repo.createAlert;
    repo.createAlert = async (a) => {
      const created = await createAlert(a);
      await finishTrip(deps, profile.id, trip.id, '1234');
      return created;
    };
    await expireDueTrips(deps);
    expect(tg.texts('111').at(-1)).toContain('False alarm');
    expect(repo.data.alerts.find((a) => a.reason === 'timer')!.resolvedAt).not.toBeNull();
  });

  it('finishing an alerted trip resolves that trip\'s alert, not an unrelated test alert', async () => {
    const { deps, repo, profile, trip, advance } = await setup();
    advance(11);
    await expireDueTrips(deps);
    advance(1);
    await raiseAlert(deps, { userId: profile.id, tripId: null, reason: 'test' });
    await finishTrip(deps, profile.id, trip.id, '1234');
    expect(repo.data.alerts.find((a) => a.reason === 'timer')!.resolvedAt).not.toBeNull();
    expect(repo.data.alerts.find((a) => a.reason === 'test')!.resolvedAt).toBeNull();
  });
});

describe('I2: a contact who blocked the bot still gets email', () => {
  it('sends email to a blocked contact that has an email address', async () => {
    const { deps, repo, mail } = makeDeps();
    const { profile, ammi } = await seedUser(repo);
    await repo.updateContact(ammi.id, { status: 'blocked' });
    const r = await raiseAlert(deps, { userId: profile.id, tripId: null, reason: 'sos' });
    expect(mail.sent.map((m) => m.to)).toEqual(['ammi@example.com']);
    expect(r.sent).toBe(2);
  });
});

describe('I3: /help reports how many people were reached', () => {
  it('returns sent 0 when nobody can be reached', async () => {
    const { deps, repo } = makeDeps();
    await repo.saveProfile({ ...(await seedUser(repo)).profile });
    for (const c of await repo.listContacts('user-1')) await repo.deleteContact('user-1', c.id);
    expect(await helpFromAnyPhone(deps, { phone: '03001234567', pin: '1234', action: 'help', callbackNumber: null }))
      .toEqual({ status: 'done', sent: 0 });
  });

  it('returns the real count for help and for duress', async () => {
    const { deps, repo } = makeDeps();
    await seedUser(repo);
    expect(await helpFromAnyPhone(deps, { phone: '03001234567', pin: '1234', action: 'help', callbackNumber: null }))
      .toEqual({ status: 'done', sent: 3 });
    expect(await helpFromAnyPhone(deps, { phone: '03001234567', pin: '9999', action: 'ok', callbackNumber: null }))
      .toEqual({ status: 'done', sent: 3 });
  });
});

describe('I6: the Dead-Man\'s Switch is not blocked or duplicated by retries', () => {
  it('a failing retry step does not stop timer alerts', async () => {
    const { deps, repo, advance } = await setup();
    advance(11);
    repo.listRetryableDeliveries = async () => {
      throw new Error('db blip');
    };
    expect((await expireDueTrips(deps)).expired).toBe(1);
    expect(repo.data.alerts.map((a) => a.reason)).toEqual(['timer']);
  });

  it('does not retry deliveries of an alert that is still being sent', async () => {
    const { deps, repo } = makeDeps();
    const { profile } = await seedUser(repo);
    const alert = await repo.createAlert({
      userId: profile.id, tripId: null, reason: 'sos', lat: null, lng: null, photoPath: null,
      createdAt: deps.now().toISOString(),
    });
    await repo.createDeliveries([
      { alertId: alert.id, contactId: repo.data.contacts[0].id, channel: 'telegram', status: 'pending', attempts: 0, lastError: null },
    ]);
    expect(await retryDeliveries(deps)).toEqual({ retried: 0, sent: 0 });
  });
});

describe('I7: a lock cannot silence the duress PIN', () => {
  it('duress PIN while locked still alerts the family (and looks locked)', async () => {
    const { deps, repo } = makeDeps();
    await seedUser(repo);
    const wrong = { phone: '03001234567', pin: '0000', action: 'help' as const, callbackNumber: null };
    await helpFromAnyPhone(deps, wrong);
    await helpFromAnyPhone(deps, wrong);
    await helpFromAnyPhone(deps, wrong);
    const r = await helpFromAnyPhone(deps, { ...wrong, pin: '9999' });
    expect(r).toEqual({ status: 'locked' });
    expect(repo.data.alerts.map((a) => a.reason)).toEqual(['wrong_pin', 'duress']);
  });

  it('a silent calculator SOS does not flip the trip screen to "alerted"', async () => {
    const { deps, profile, trip } = await setup();
    await sendSos(deps, profile.id, { reason: 'calculator', lat: null, lng: null });
    expect((await recordLocations(deps, profile.id, trip.id, [])).status).toBe('active');
    expect((await getOverview(deps, profile.id)).openTrip?.status).toBe('active');
  });
});

describe('lock expiry (regression guard for the removed evaluatePin tests)', () => {
  it('the right PIN works again after the 15-minute lock', async () => {
    const { deps, profile, trip, advance } = await setup();
    for (const pin of ['0000', '1111', '2222']) await finishTrip(deps, profile.id, trip.id, pin);
    expect(await finishTrip(deps, profile.id, trip.id, '1234')).toEqual({ status: 'locked' });
    advance(16);
    expect(await finishTrip(deps, profile.id, trip.id, '1234')).toEqual({ status: 'safe' });
  });
});
