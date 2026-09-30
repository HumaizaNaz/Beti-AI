import { describe, expect, it } from 'vitest';
import { evaluatePin, hashPin, isValidPin, LOCK_MINUTES } from '@/lib/pin';

const now = new Date('2026-10-01T10:00:00.000Z');

async function profile(overrides: Partial<{ failedPinCount: number; pinLockedUntil: string | null }> = {}) {
  return {
    safePinHash: await hashPin('1234'),
    duressPinHash: await hashPin('9999'),
    failedPinCount: 0,
    pinLockedUntil: null,
    ...overrides,
  };
}

describe('isValidPin / hashPin', () => {
  it('accepts exactly four digits', () => {
    expect(isValidPin('0420')).toBe(true);
    for (const bad of ['123', '12345', '12a4', ' 1234', '', 1234, null]) expect(isValidPin(bad)).toBe(false);
  });
  it('refuses to hash an invalid PIN', async () => {
    await expect(hashPin('12')).rejects.toThrow('PIN must be exactly 4 digits');
  });
});

describe('evaluatePin', () => {
  it('safe PIN resets the counter', async () => {
    const r = await evaluatePin(await profile({ failedPinCount: 2 }), '1234', now);
    expect(r).toEqual({ outcome: 'safe', next: { failedPinCount: 0, pinLockedUntil: null } });
  });

  it('duress PIN is recognised and resets the counter', async () => {
    const r = await evaluatePin(await profile({ failedPinCount: 1 }), '9999', now);
    expect(r).toEqual({ outcome: 'duress', next: { failedPinCount: 0, pinLockedUntil: null } });
  });

  it('wrong PIN increments the counter', async () => {
    const r = await evaluatePin(await profile(), '0000', now);
    expect(r).toEqual({ outcome: 'wrong', next: { failedPinCount: 1, pinLockedUntil: null } });
  });

  it('malformed input counts as a wrong attempt', async () => {
    for (const bad of ['12a4', ' 123', '12345', '']) {
      const r = await evaluatePin(await profile(), bad, now);
      expect(r.outcome).toBe('wrong');
      expect(r.next.failedPinCount).toBe(1);
    }
  });

  it('third wrong PIN raises wrong_alert and locks for 15 minutes', async () => {
    const r = await evaluatePin(await profile({ failedPinCount: 2 }), '0000', now);
    expect(r.outcome).toBe('wrong_alert');
    expect(r.next.failedPinCount).toBe(0);
    expect(r.next.pinLockedUntil).toBe(new Date(now.getTime() + LOCK_MINUTES * 60_000).toISOString());
  });

  it('while locked even the right PIN is refused', async () => {
    const lockedUntil = new Date(now.getTime() + 5 * 60_000).toISOString();
    const p = await profile({ pinLockedUntil: lockedUntil });
    const r = await evaluatePin(p, '1234', now);
    expect(r).toEqual({ outcome: 'locked', next: { failedPinCount: 0, pinLockedUntil: lockedUntil } });
  });

  it('an expired lock no longer blocks', async () => {
    const r = await evaluatePin(await profile({ pinLockedUntil: '2026-10-01T09:00:00.000Z' }), '1234', now);
    expect(r.outcome).toBe('safe');
  });
});
