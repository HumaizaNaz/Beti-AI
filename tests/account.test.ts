import { describe, expect, it } from 'vitest';
import { addContact, checkUserPin, getOverview, removeContact, sendTestAlert, setupProfile } from '@/lib/account';
import { makeDeps, seedUser } from './helpers/fakes';

const valid = { name: ' Ayesha ', phone: '0300-1234567', safePin: '1234', duressPin: '9999' };

describe('setupProfile', () => {
  it('creates a profile with hashed PINs and a normalised phone', async () => {
    const { deps, repo } = makeDeps();
    await setupProfile(deps, 'u1', valid);
    const p = (await repo.getProfile('u1'))!;
    expect(p).toMatchObject({ name: 'Ayesha', phone: '+923001234567', lang: 'ur', failedPinCount: 0 });
    expect(p.safePinHash).not.toBe('1234');
    expect(p.safePinHash).toMatch(/^\$2[aby]\$/);
  });

  it.each([
    [{ ...valid, name: '  ' }, 'bad_name'],
    [{ ...valid, phone: '123' }, 'bad_phone'],
    [{ ...valid, safePin: '12' }, 'bad_pin'],
    [{ ...valid, duressPin: '1234' }, 'same_pins'],
  ])('rejects invalid input %#', async (input, code) => {
    const { deps } = makeDeps();
    await expect(setupProfile(deps, 'u1', input)).rejects.toMatchObject({ code });
  });

  it("rejects another user's phone and refuses to overwrite existing PINs", async () => {
    const { deps, repo } = makeDeps();
    await seedUser(repo);
    await expect(setupProfile(deps, 'u2', valid)).rejects.toMatchObject({ code: 'phone_taken' });
    await expect(setupProfile(deps, 'user-1', { ...valid, phone: '03011111111' })).rejects.toMatchObject({ code: 'pin_required' });
  });
});

describe('contacts', () => {
  it('adds a pending contact with an invite link, only with the PIN', async () => {
    const { deps, repo } = makeDeps();
    const { profile } = await seedUser(repo);
    const input = { pin: '1234', name: 'Sara', relation: 'sister', phone: '03211234567', email: '' };
    await expect(addContact(deps, profile.id, { ...input, pin: '0000' })).rejects.toMatchObject({ code: 'wrong_pin' });
    const c = await addContact(deps, profile.id, input);
    expect(c).toMatchObject({ name: 'Sara', status: 'pending', phone: '+923211234567', email: null, telegramChatId: null });
    const overview = await getOverview(deps, profile.id);
    expect(overview.contacts.find((x) => x.id === c.id)!.inviteLink).toBe(`https://t.me/BetiTestBot?start=${c.inviteToken}`);
  });

  it('validates relation, phone, email and the limit of 5', async () => {
    const { deps, repo } = makeDeps();
    const { profile } = await seedUser(repo);
    const base = { pin: '1234', name: 'X', relation: 'friend', phone: '03211234567', email: '' };
    await expect(addContact(deps, profile.id, { ...base, relation: 'boss' })).rejects.toMatchObject({ code: 'bad_contact' });
    await expect(addContact(deps, profile.id, { ...base, phone: 'x' })).rejects.toMatchObject({ code: 'bad_phone' });
    await expect(addContact(deps, profile.id, { ...base, email: 'not-an-email' })).rejects.toMatchObject({ code: 'bad_contact' });
    await addContact(deps, profile.id, base);
    await addContact(deps, profile.id, base);
    await addContact(deps, profile.id, base);
    await expect(addContact(deps, profile.id, base)).rejects.toMatchObject({ code: 'too_many' });
  });

  it('removes a contact with the PIN', async () => {
    const { deps, repo } = makeDeps();
    const { profile, ali } = await seedUser(repo);
    await expect(removeContact(deps, profile.id, ali.id, '0000')).rejects.toMatchObject({ code: 'wrong_pin' });
    await removeContact(deps, profile.id, ali.id, '1234');
    expect(await repo.getContact(ali.id)).toBeNull();
    await expect(removeContact(deps, profile.id, ali.id, '1234')).rejects.toMatchObject({ code: 'not_found' });
  });
});

describe('checkUserPin / overview / test alert', () => {
  it('duress PIN passes the settings gate but alerts silently', async () => {
    const { deps, repo } = makeDeps();
    const { profile } = await seedUser(repo);
    expect(await checkUserPin(deps, profile.id, '9999')).toBe('ok');
    expect(repo.data.alerts.map((a) => a.reason)).toEqual(['duress']);
  });

  it('overview never exposes PIN hashes', async () => {
    const { deps, repo } = makeDeps();
    const { profile } = await seedUser(repo);
    const o = await getOverview(deps, profile.id);
    expect(o.profile).toEqual({ name: 'Ayesha', phone: '+923001234567', lang: 'ur', hasPin: true });
    expect(JSON.stringify(o)).not.toContain('$2');
    expect(o.openTrip).toBeNull();
  });

  it('test alert reaches everyone', async () => {
    const { deps, repo } = makeDeps();
    const { profile } = await seedUser(repo);
    expect(await sendTestAlert(deps, profile.id)).toEqual({ sent: 3, failed: 0 });
  });
});
