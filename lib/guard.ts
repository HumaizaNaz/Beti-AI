import { raiseAlert } from '@/lib/alerts';
import type { Deps } from '@/lib/deps';
import { evaluatePin } from '@/lib/pin';
import { shareExpiry } from '@/lib/time';
import type { Profile } from '@/lib/types';

export type GuardResult = 'ok' | 'duress' | 'wrong' | 'locked';

/**
 * Checks a PIN and performs the safety side effects:
 * - duress: the open trip looks finished, but a silent `duress` alert goes out;
 * - third wrong PIN: the open trip is marked alerted and a `wrong_pin` alert goes out.
 */
export async function verifyPin(deps: Deps, profile: Profile, pin: string): Promise<GuardResult> {
  const now = deps.now();
  const { outcome, next } = await evaluatePin(profile, pin, now);
  if (outcome === 'locked') return 'locked';
  await deps.repo.updatePinState(profile.id, next);
  if (outcome === 'safe') return 'ok';
  if (outcome === 'wrong') return 'wrong';

  const open = await deps.repo.getOpenTrip(profile.id);
  if (outcome === 'duress') {
    if (open) await deps.repo.transitionTrip(open.id, open.status, 'safe', { shareExpiresAt: shareExpiry(now) });
    await raiseAlert(deps, { userId: profile.id, tripId: open?.id ?? null, reason: 'duress' });
    return 'duress';
  }

  if (open?.status === 'active') await deps.repo.transitionTrip(open.id, 'active', 'alerted');
  await raiseAlert(deps, { userId: profile.id, tripId: open?.id ?? null, reason: 'wrong_pin' });
  return 'locked';
}
