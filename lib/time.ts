// lib/time.ts
export const SHARE_TTL_HOURS = 24;

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

/** When a finished trip's live link stops working. */
export function shareExpiry(now: Date): string {
  return addMinutes(now, SHARE_TTL_HOURS * 60).toISOString();
}
