import { describe, expect, it } from 'vitest';
import { hashPin, isValidPin, matchPin } from '@/lib/pin';

async function profile() {
  return { safePinHash: await hashPin('1234'), duressPinHash: await hashPin('9999') };
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

describe('matchPin', () => {
  it('recognises safe, duress and wrong PINs', async () => {
    const p = await profile();
    expect(await matchPin(p, '1234')).toBe('safe');
    expect(await matchPin(p, '9999')).toBe('duress');
    expect(await matchPin(p, '0000')).toBe('wrong');
  });

  it('treats malformed input as wrong', async () => {
    const p = await profile();
    for (const bad of ['12a4', ' 123', '12345', '']) expect(await matchPin(p, bad)).toBe('wrong');
  });
});
