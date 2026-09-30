import { describe, expect, it } from 'vitest';
import { raiseAlert, resolveFromFamily, retryDeliveries } from '@/lib/alerts';
import { makeDeps, seedUser } from './helpers/fakes';

describe('raiseAlert', () => {
  it('sends voice, location and text with buttons on Telegram, plus email', async () => {
    const { deps, repo, tg, mail } = makeDeps();
    const { profile } = await seedUser(repo);
    const r = await raiseAlert(deps, { userId: profile.id, tripId: null, reason: 'sos', lat: 24.86, lng: 67.0 });

    expect(r).toMatchObject({ sent: 3, failed: 0 });
    expect(tg.texts('111')[0]).toContain('Ayesha');
    expect(tg.texts('222')).toHaveLength(1);
    const message = tg.calls.find((c) => c.method === 'sendMessage' && c.chatId === '111')!;
    expect(message.args[1]).toHaveLength(2);
    expect(tg.calls.find((c) => c.method === 'sendVoice')!.args[0]).toBe('https://beti.test/audio/alert-help.mp3');
    expect(tg.calls.find((c) => c.method === 'sendLocation')!.args).toEqual([24.86, 67.0]);
    expect(mail.sent.map((m) => m.to)).toEqual(['ammi@example.com']);
    expect(repo.data.alerts[0]).toMatchObject({ reason: 'sos', lat: 24.86, lng: 67.0 });
  });

  it('skips pending and blocked contacts', async () => {
    const { deps, repo, tg } = makeDeps();
    const { profile } = await seedUser(repo);
    await repo.createContact({
      userId: profile.id, name: 'Pending', relation: 'sister', phone: null, email: null,
      telegramChatId: null, inviteToken: 'p', status: 'pending',
    });
    await repo.createContact({
      userId: profile.id, name: 'Blocked', relation: 'friend', phone: null, email: 'b@example.com',
      telegramChatId: '333', inviteToken: 'b', status: 'blocked',
    });
    await raiseAlert(deps, { userId: profile.id, tripId: null, reason: 'sos' });
    expect(tg.calls.some((c) => c.chatId === '333')).toBe(false);
  });

  it('uses the trip photo, the last trip location and the live link', async () => {
    const { deps, repo, tg } = makeDeps();
    const { profile } = await seedUser(repo);
    const trip = await repo.createTrip({
      userId: profile.id, vehiclePhotoPath: 'user-1/p.jpg', durationMin: 20,
      startedAt: '2026-10-01T10:00:00.000Z', deadlineAt: '2026-10-01T10:20:00.000Z',
      status: 'alerted', shareToken: 'share123', shareExpiresAt: null,
    });
    await repo.addLocations(trip.id, [
      { lat: 24.1, lng: 67.1, accuracyM: 5, recordedAt: '2026-10-01T10:05:00.000Z' },
      { lat: 24.2, lng: 67.2, accuracyM: 5, recordedAt: '2026-10-01T10:10:00.000Z' },
    ]);
    await raiseAlert(deps, { userId: profile.id, tripId: trip.id, reason: 'timer' });
    expect(tg.calls.find((c) => c.method === 'sendLocation')!.args).toEqual([24.2, 67.2]);
    expect(tg.calls.find((c) => c.method === 'sendPhoto')!.args[0]).toBe('https://files.test/user-1/p.jpg');
    expect(tg.texts('111')[0]).toContain('https://beti.test/t/share123');
  });

  it('records a failed channel without blocking the others', async () => {
    const { deps, repo, tg } = makeDeps();
    const { profile } = await seedUser(repo);
    tg.failing.add('222');
    const r = await raiseAlert(deps, { userId: profile.id, tripId: null, reason: 'sos' });
    expect(r).toMatchObject({ sent: 2, failed: 1 });
    const failed = repo.data.deliveries.find((d) => d.status === 'failed')!;
    expect(failed).toMatchObject({ channel: 'telegram', attempts: 1 });
    expect(failed.lastError).toContain('failed');
  });

  it('still counts as delivered when only the voice note fails', async () => {
    const { deps, repo, tg } = makeDeps();
    const { profile } = await seedUser(repo);
    tg.failing.add('sendVoice');
    expect((await raiseAlert(deps, { userId: profile.id, tripId: null, reason: 'sos' })).sent).toBe(3);
  });

  it('reports sent 0 when nobody can be reached', async () => {
    const { deps, repo } = makeDeps();
    await repo.saveProfile({
      id: 'lonely', name: 'Sana', phone: '+923111111111', safePinHash: null, duressPinHash: null,
      failedPinCount: 0, pinLockedUntil: null, lang: 'ur',
    });
    expect(await raiseAlert(deps, { userId: 'lonely', tripId: null, reason: 'sos' })).toMatchObject({ sent: 0, failed: 0 });
  });

  it('test alerts use the test voice and have no family buttons', async () => {
    const { deps, repo, tg } = makeDeps();
    const { profile } = await seedUser(repo);
    await raiseAlert(deps, { userId: profile.id, tripId: null, reason: 'test' });
    expect(tg.calls.find((c) => c.method === 'sendVoice')!.args[0]).toBe('https://beti.test/audio/alert-test.mp3');
    expect(tg.calls.find((c) => c.method === 'sendMessage')!.args[1]).toBeUndefined();
  });
});

describe('retryDeliveries', () => {
  it('retries failed deliveries until they succeed', async () => {
    const { deps, repo, tg } = makeDeps();
    const { profile } = await seedUser(repo);
    tg.failing.add('222');
    await raiseAlert(deps, { userId: profile.id, tripId: null, reason: 'sos' });
    tg.failing.clear();
    expect(await retryDeliveries(deps)).toEqual({ retried: 1, sent: 1 });
    expect(repo.data.deliveries.every((d) => d.status === 'sent')).toBe(true);
    expect(await retryDeliveries(deps)).toEqual({ retried: 0, sent: 0 });
  });

  it('gives up after three attempts in total', async () => {
    const { deps, repo, tg } = makeDeps();
    const { profile } = await seedUser(repo);
    tg.failing.add('222');
    await raiseAlert(deps, { userId: profile.id, tripId: null, reason: 'sos' });
    await retryDeliveries(deps);
    await retryDeliveries(deps);
    expect(await retryDeliveries(deps)).toEqual({ retried: 0, sent: 0 });
    expect(repo.data.deliveries.find((d) => d.status === 'failed')!.attempts).toBe(3);
  });
});

describe('resolveFromFamily', () => {
  it('"ok" resolves the alert and tells the other contacts', async () => {
    const { deps, repo, tg } = makeDeps();
    const { profile } = await seedUser(repo);
    const { alert } = await raiseAlert(deps, { userId: profile.id, tripId: null, reason: 'sos' });
    const before = tg.texts('222').length;

    expect(await resolveFromFamily(deps, { alertId: alert.id, chatId: '222', action: 'ok' })).toEqual({ ok: true });
    expect((await repo.getAlert(alert.id))!.resolvedBy).toBe('Ali');
    expect(tg.texts('111').at(-1)).toContain('Ali');
    expect(tg.texts('222')).toHaveLength(before);
  });

  it('"going" tells others but keeps the alert open', async () => {
    const { deps, repo, tg } = makeDeps();
    const { profile } = await seedUser(repo);
    const { alert } = await raiseAlert(deps, { userId: profile.id, tripId: null, reason: 'sos' });
    await resolveFromFamily(deps, { alertId: alert.id, chatId: '111', action: 'going' });
    expect((await repo.getAlert(alert.id))!.resolvedAt).toBeNull();
    expect(tg.texts('222').at(-1)).toContain('Ammi');
  });

  it('ignores chats that are not contacts of that user', async () => {
    const { deps, repo } = makeDeps();
    const { profile } = await seedUser(repo);
    const { alert } = await raiseAlert(deps, { userId: profile.id, tripId: null, reason: 'sos' });
    expect(await resolveFromFamily(deps, { alertId: alert.id, chatId: '999', action: 'ok' })).toEqual({ ok: false });
    expect(await resolveFromFamily(deps, { alertId: 'nope', chatId: '111', action: 'ok' })).toEqual({ ok: false });
  });
});
