import { describe, expect, it } from 'vitest';
import { helpFromAnyPhone } from '@/lib/help';
import { startTrip } from '@/lib/trips';
import { makeDeps, seedUser } from './helpers/fakes';

describe('helpFromAnyPhone', () => {
  it('answers "wrong" for unknown or junk phone numbers', async () => {
    const { deps, repo } = makeDeps();
    await seedUser(repo);
    for (const phone of ['', 'abc', '03339999999']) {
      expect(await helpFromAnyPhone(deps, { phone, pin: '1234', action: 'help', callbackNumber: null })).toEqual({ status: 'wrong' });
    }
    expect(repo.data.alerts).toHaveLength(0);
  });

  it('"help" raises a help_page alert (any phone format works)', async () => {
    const { deps, repo } = makeDeps();
    await seedUser(repo);
    const r = await helpFromAnyPhone(deps, { phone: '0300-1234567', pin: '1234', action: 'help', callbackNumber: null });
    expect(r).toEqual({ status: 'done', sent: 3 });
    expect(repo.data.alerts.map((a) => a.reason)).toEqual(['help_page']);
  });

  it('"ok" ends the open trip, resolves alerts and shares the callback number', async () => {
    const { deps, repo, tg } = makeDeps();
    const { profile } = await seedUser(repo);
    const trip = await startTrip(deps, profile.id, { durationMin: 10, vehiclePhotoPath: null });
    const r = await helpFromAnyPhone(deps, {
      phone: '+92 300 1234567', pin: '1234', action: 'ok', callbackNumber: '0321-5555555 <script>',
    });
    expect(r).toEqual({ status: 'done', sent: 3 });
    expect((await repo.getTrip(trip.id))!.status).toBe('safe');
    const last = tg.texts('111').at(-1)!;
    expect(last).toContain('phone was stolen');
    expect(last).toContain('0321-5555555');
    expect(last).not.toContain('<script>');
  });

  it('duress PIN answers "done" but raises a duress alert', async () => {
    const { deps, repo } = makeDeps();
    await seedUser(repo);
    const r = await helpFromAnyPhone(deps, { phone: '03001234567', pin: '9999', action: 'ok', callbackNumber: null });
    expect(r).toEqual({ status: 'done', sent: 3 });
    expect(repo.data.alerts.map((a) => a.reason)).toEqual(['duress']);
  });

  it('locks after three wrong PINs', async () => {
    const { deps, repo } = makeDeps();
    await seedUser(repo);
    const input = { phone: '03001234567', pin: '0000', action: 'help' as const, callbackNumber: null };
    await helpFromAnyPhone(deps, input);
    await helpFromAnyPhone(deps, input);
    expect(await helpFromAnyPhone(deps, input)).toEqual({ status: 'locked' });
    expect(await helpFromAnyPhone(deps, { ...input, pin: '1234' })).toEqual({ status: 'locked' });
    expect(repo.data.alerts.map((a) => a.reason)).toEqual(['wrong_pin']);
  });
});
