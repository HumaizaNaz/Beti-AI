import bcrypt from 'bcryptjs';
import type { PinState, Profile } from '@/lib/types';

export const MAX_WRONG_PINS = 3;
export const LOCK_MINUTES = 15;

export type PinOutcome = 'safe' | 'duress' | 'wrong' | 'wrong_alert' | 'locked';

export function isValidPin(pin: unknown): pin is string {
  return typeof pin === 'string' && /^\d{4}$/.test(pin);
}

export async function hashPin(pin: string): Promise<string> {
  if (!isValidPin(pin)) throw new Error('PIN must be exactly 4 digits');
  return bcrypt.hash(pin, 10);
}

export async function evaluatePin(
  profile: Pick<Profile, 'safePinHash' | 'duressPinHash'> & PinState,
  pin: string,
  now: Date,
): Promise<{ outcome: PinOutcome; next: PinState }> {
  const current: PinState = { failedPinCount: profile.failedPinCount, pinLockedUntil: profile.pinLockedUntil };
  if (profile.pinLockedUntil && new Date(profile.pinLockedUntil) > now) {
    return { outcome: 'locked', next: current };
  }
  const cleared: PinState = { failedPinCount: 0, pinLockedUntil: null };
  if (isValidPin(pin)) {
    if (profile.safePinHash && (await bcrypt.compare(pin, profile.safePinHash))) return { outcome: 'safe', next: cleared };
    if (profile.duressPinHash && (await bcrypt.compare(pin, profile.duressPinHash))) return { outcome: 'duress', next: cleared };
  }
  const failed = profile.failedPinCount + 1;
  if (failed >= MAX_WRONG_PINS) {
    return {
      outcome: 'wrong_alert',
      next: { failedPinCount: 0, pinLockedUntil: new Date(now.getTime() + LOCK_MINUTES * 60_000).toISOString() },
    };
  }
  return { outcome: 'wrong', next: { failedPinCount: failed, pinLockedUntil: null } };
}
