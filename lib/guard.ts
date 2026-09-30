import { raiseAlert } from '@/lib/alerts';
import type { Deps } from '@/lib/deps';
import { LOCK_MINUTES, MAX_WRONG_PINS, matchPin } from '@/lib/pin';
import { addMinutes } from '@/lib/time';
import type { Profile } from '@/lib/types';

export type GuardResult = 'ok' | 'duress' | 'wrong' | 'locked';

export interface GuardOutcome {
  result: GuardResult;
  /** How many deliveries the duress alert reached (duress only). */
  sent?: number;
}

/** Silent alert; the open trip is marked so the family sees danger while the phone looks normal. */
async function raiseDuress(deps: Deps, profile: Profile): Promise<number> {
  const open = await deps.repo.getOpenTrip(profile.id);
  if (open && !open.duressAt) {
    await deps.repo.transitionTrip(open.id, open.status, open.status, { duressAt: deps.now().toISOString() });
  }
  const { sent } = await raiseAlert(deps, { userId: profile.id, tripId: open?.id ?? null, reason: 'duress' });
  return sent;
}

/**
 * Checks a PIN with an atomically reserved attempt (parallel guesses cannot bypass the lock) and
 * performs the safety side effects:
 * - duress: silent `duress` alert — even while locked, so a lockout can never silence it;
 * - third wrong PIN: 15-minute lock, open active trip → alerted, one `wrong_pin` alert.
 */
export async function verifyPin(deps: Deps, profile: Profile, pin: string): Promise<GuardOutcome> {
  const now = deps.now();
  const slot = await deps.repo.reservePinAttempt(profile.id, now, MAX_WRONG_PINS);
  const match = await matchPin(profile, pin);

  if (!slot.allowed) {
    if (match === 'duress') await raiseDuress(deps, profile);
    return { result: 'locked' };
  }
  if (match !== 'wrong') {
    await deps.repo.updatePinState(profile.id, { failedPinCount: 0, pinLockedUntil: null });
    if (match === 'safe') return { result: 'ok' };
    return { result: 'duress', sent: await raiseDuress(deps, profile) };
  }
  if (slot.attempt < MAX_WRONG_PINS) return { result: 'wrong' };

  await deps.repo.updatePinState(profile.id, {
    failedPinCount: 0,
    pinLockedUntil: addMinutes(now, LOCK_MINUTES).toISOString(),
  });
  const open = await deps.repo.getOpenTrip(profile.id);
  if (open?.status === 'active') await deps.repo.transitionTrip(open.id, 'active', 'alerted');
  await raiseAlert(deps, { userId: profile.id, tripId: open?.id ?? null, reason: 'wrong_pin' });
  return { result: 'locked' };
}
