import bcrypt from 'bcryptjs';
import type { Profile } from '@/lib/types';

export const MAX_WRONG_PINS = 3;
export const LOCK_MINUTES = 15;

export type PinMatch = 'safe' | 'duress' | 'wrong';

export function isValidPin(pin: unknown): pin is string {
  return typeof pin === 'string' && /^\d{4}$/.test(pin);
}

export async function hashPin(pin: string): Promise<string> {
  if (!isValidPin(pin)) throw new Error('PIN must be exactly 4 digits');
  return bcrypt.hash(pin, 10);
}

/** Pure comparison. Lock and attempt counting live in lib/guard.ts (atomic via the repo). */
export async function matchPin(
  profile: Pick<Profile, 'safePinHash' | 'duressPinHash'>,
  pin: string,
): Promise<PinMatch> {
  if (!isValidPin(pin)) return 'wrong';
  if (profile.safePinHash && (await bcrypt.compare(pin, profile.safePinHash))) return 'safe';
  if (profile.duressPinHash && (await bcrypt.compare(pin, profile.duressPinHash))) return 'duress';
  return 'wrong';
}
