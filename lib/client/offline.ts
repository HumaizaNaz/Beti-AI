// lib/client/offline.ts — phone-side cache so help works without internet. Never stores PINs.
const INFO_KEY = 'beti-offline';
const queueKey = (tripId: string) => `beti-gps-${tripId}`;

export interface OfflineInfo {
  name: string;
  phones: string[];
}

export interface QueuedPoint {
  lat: number;
  lng: number;
  accuracyM: number | null;
  recordedAt: string;
}

export function saveOfflineInfo(info: OfflineInfo): void {
  try {
    localStorage.setItem(INFO_KEY, JSON.stringify(info));
  } catch {}
}

export function loadOfflineInfo(): OfflineInfo | null {
  try {
    const raw = localStorage.getItem(INFO_KEY);
    return raw ? (JSON.parse(raw) as OfflineInfo) : null;
  } catch {
    return null;
  }
}

export function smsLink(phones: string[], body: string): string {
  return `sms:${phones.join(',')}?body=${encodeURIComponent(body)}`;
}

export function helpSmsBody(name: string, lat: number | null, lng: number | null): string {
  const where = lat !== null && lng !== null ? ` https://maps.google.com/?q=${lat},${lng}` : '';
  return `🚨 ${name}: مجھے مدد چاہیے! / I need help!${where}`;
}

export function safeSmsBody(name: string): string {
  return `✅ ${name}: میں خیریت سے پہنچ گئی / I reached safely`;
}

export function readQueue(tripId: string): QueuedPoint[] {
  try {
    return JSON.parse(localStorage.getItem(queueKey(tripId)) ?? '[]') as QueuedPoint[];
  } catch {
    return [];
  }
}

export function queuePoint(tripId: string, point: QueuedPoint): void {
  try {
    localStorage.setItem(queueKey(tripId), JSON.stringify([...readQueue(tripId), point].slice(-200)));
  } catch {}
}

/** Drops the first `count` points (the ones just sent). */
export function clearQueue(tripId: string, count: number): void {
  try {
    const rest = readQueue(tripId).slice(count);
    if (rest.length) localStorage.setItem(queueKey(tripId), JSON.stringify(rest));
    else localStorage.removeItem(queueKey(tripId));
  } catch {}
}
