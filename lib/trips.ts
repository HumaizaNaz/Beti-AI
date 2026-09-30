import { notifyContacts, raiseAlert, retryDeliveries, type RaiseResult } from '@/lib/alerts';
import type { Deps } from '@/lib/deps';
import { TRIP_DURATIONS } from '@/lib/durations';
import { verifyPin } from '@/lib/guard';
import { safeText } from '@/lib/messages';
import { addMinutes, shareExpiry } from '@/lib/time';
import { randomToken } from '@/lib/token';
import type { LocationPoint, Profile, Trip, TripStatus } from '@/lib/types';

export { TRIP_DURATIONS };
export const EXTEND_MINUTES = 10;
export const MAX_POINTS_PER_BATCH = 100;

export type TripErrorCode = 'invalid_duration' | 'trip_open' | 'not_found' | 'bad_photo' | 'not_active';

export class TripError extends Error {
  constructor(public code: TripErrorCode) {
    super(code);
  }
}

export function parseCoord(value: unknown, limit: number): number | null {
  return typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= limit ? value : null;
}

async function ownTrip(deps: Deps, userId: string, tripId: string): Promise<Trip> {
  const trip = await deps.repo.getTrip(tripId);
  if (!trip || trip.userId !== userId) throw new TripError('not_found');
  return trip;
}

async function requireProfile(deps: Deps, userId: string): Promise<Profile> {
  const profile = await deps.repo.getProfile(userId);
  if (!profile) throw new TripError('not_found');
  return profile;
}

/** What the phone is allowed to see: a duress-closed trip looks finished. */
function phoneStatus(trip: Trip): TripStatus {
  return trip.duressAt && trip.status === 'alerted' ? 'safe' : trip.status;
}

/** Resolves this trip's open alerts and tells the family she is safe. */
async function closeAsFalseAlarm(deps: Deps, trip: Trip, profile: Profile): Promise<void> {
  for (const alert of await deps.repo.listOpenAlertsForTrip(trip.id)) {
    await deps.repo.resolveAlert(alert.id, profile.name, deps.now());
  }
  await notifyContacts(deps, profile.id, safeText(profile.name, true));
}

export async function startTrip(
  deps: Deps,
  userId: string,
  input: { durationMin: number; vehiclePhotoPath: string | null },
): Promise<Trip> {
  if (!(TRIP_DURATIONS as readonly number[]).includes(input.durationMin)) throw new TripError('invalid_duration');
  if (input.vehiclePhotoPath && !input.vehiclePhotoPath.startsWith(`${userId}/`)) throw new TripError('bad_photo');
  await requireProfile(deps, userId);
  if (await deps.repo.getOpenTrip(userId)) throw new TripError('trip_open');
  const now = deps.now();
  return deps.repo.createTrip({
    userId,
    vehiclePhotoPath: input.vehiclePhotoPath,
    durationMin: input.durationMin,
    startedAt: now.toISOString(),
    deadlineAt: addMinutes(now, input.durationMin).toISOString(),
    status: 'active',
    shareToken: randomToken(),
    shareExpiresAt: null,
  });
}

export async function recordLocations(
  deps: Deps,
  userId: string,
  tripId: string,
  points: unknown,
): Promise<{ saved: number; status: TripStatus; deadlineAt: string }> {
  const trip = await ownTrip(deps, userId, tripId);
  const result = { saved: 0, status: phoneStatus(trip), deadlineAt: trip.deadlineAt };
  if (trip.status === 'safe' || !Array.isArray(points)) return result;

  const now = deps.now();
  const clean: LocationPoint[] = [];
  for (const raw of points.slice(-MAX_POINTS_PER_BATCH)) {
    if (!raw || typeof raw !== 'object') continue;
    const p = raw as Record<string, unknown>;
    const lat = parseCoord(p.lat, 90);
    const lng = parseCoord(p.lng, 180);
    if (lat === null || lng === null) continue;
    const accuracyM =
      typeof p.accuracyM === 'number' && Number.isFinite(p.accuracyM) && p.accuracyM >= 0 ? p.accuracyM : null;
    const when = typeof p.recordedAt === 'string' ? new Date(p.recordedAt) : null;
    const recordedAt = when && !Number.isNaN(when.getTime()) && when <= now ? when.toISOString() : now.toISOString();
    clean.push({ lat, lng, accuracyM, recordedAt });
  }
  await deps.repo.addLocations(trip.id, clean);
  return { ...result, saved: clean.length };
}

export async function finishTrip(
  deps: Deps,
  userId: string,
  tripId: string,
  pin: string,
): Promise<{ status: 'safe' | 'wrong' | 'locked' }> {
  const trip = await ownTrip(deps, userId, tripId);
  const profile = await requireProfile(deps, userId);
  const { result } = await verifyPin(deps, profile, pin);
  if (result === 'wrong' || result === 'locked') return { status: result };
  if (result === 'duress') {
    // Looks finished on the phone; stays "alerted" (with the duress mark) for the family.
    await deps.repo.transitionTrip(trip.id, 'active', 'alerted');
    return { status: 'safe' };
  }

  const expires = shareExpiry(deps.now());
  if (await deps.repo.transitionTrip(trip.id, 'active', 'safe', { shareExpiresAt: expires })) {
    await notifyContacts(deps, userId, safeText(profile.name, false));
  } else {
    const closed = await deps.repo.transitionTrip(trip.id, 'alerted', 'safe', { shareExpiresAt: expires });
    if (closed) await closeAsFalseAlarm(deps, closed, profile);
  }
  return { status: 'safe' };
}

export async function extendTrip(
  deps: Deps,
  userId: string,
  tripId: string,
  pin: string,
): Promise<{ status: 'extended'; deadlineAt: string } | { status: 'wrong' | 'locked' }> {
  const trip = await ownTrip(deps, userId, tripId);
  const profile = await requireProfile(deps, userId);
  const { result } = await verifyPin(deps, profile, pin);
  if (result === 'wrong' || result === 'locked') return { status: result };

  // Duress extends for real too, so the phone behaves exactly as with the safe PIN.
  const base = Math.max(new Date(trip.deadlineAt).getTime(), deps.now().getTime());
  const deadlineAt = addMinutes(new Date(base), EXTEND_MINUTES).toISOString();
  const updated = await deps.repo.transitionTrip(trip.id, 'active', 'active', { deadlineAt });
  if (!updated) throw new TripError('not_active');
  return { status: 'extended', deadlineAt: new Date(updated.deadlineAt).toISOString() };
}

export async function sendSos(
  deps: Deps,
  userId: string,
  input: { reason: 'sos' | 'calculator'; lat: number | null; lng: number | null },
): Promise<RaiseResult> {
  const open = await deps.repo.getOpenTrip(userId);
  if (open && input.reason === 'calculator') {
    // Silent: mark the trip for the family, but leave the phone screen unchanged.
    await deps.repo.transitionTrip(open.id, open.status, open.status, { duressAt: deps.now().toISOString() });
  } else if (open?.status === 'active') {
    await deps.repo.transitionTrip(open.id, 'active', 'alerted');
  }
  return raiseAlert(deps, { userId, tripId: open?.id ?? null, reason: input.reason, lat: input.lat, lng: input.lng });
}

/** Runs every minute from Supabase pg_cron. */
export async function expireDueTrips(deps: Deps): Promise<{ expired: number; retried: number }> {
  // Timer alerts first: nothing else may delay or block the Dead-Man's Switch.
  const due = await deps.repo.claimDueTrips(deps.now());
  for (const trip of due) {
    try {
      const { alert } = await raiseAlert(deps, { userId: trip.userId, tripId: trip.id, reason: 'timer' });
      await deps.repo.markTimerAlert(trip.id, alert.id);
      // She may have pressed "Pohanch gayi" while the alert was going out: make the false alarm the last word.
      const now = await deps.repo.getTrip(trip.id);
      const profile = now?.status === 'safe' ? await deps.repo.getProfile(trip.userId) : null;
      if (now && profile) await closeAsFalseAlarm(deps, now, profile);
    } catch (err) {
      // No revert needed: an unfinished claim is re-offered by claimDueTrips after TIMER_RECLAIM_MS.
      console.error('timer alert failed; will retry', trip.id, err);
    }
  }
  let retried = 0;
  try {
    retried = (await retryDeliveries(deps)).retried;
  } catch (err) {
    console.error('delivery retry failed', err);
  }
  return { expired: due.length, retried };
}

export interface LiveView {
  name: string;
  status: TripStatus;
  deadlineAt: string;
  last: LocationPoint | null;
}

export async function getLiveView(deps: Deps, token: string): Promise<LiveView | null> {
  const trip = await deps.repo.getTripByShareToken(token);
  if (!trip) return null;
  if (trip.shareExpiresAt && new Date(trip.shareExpiresAt) < deps.now()) return null;
  const profile = await deps.repo.getProfile(trip.userId);
  if (!profile) return null;
  return {
    name: profile.name,
    status: trip.duressAt ? 'alerted' : trip.status,
    deadlineAt: trip.deadlineAt,
    last: await deps.repo.lastLocation(trip.id),
  };
}
