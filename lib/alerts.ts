import type { Deps } from '@/lib/deps';
import { alertSubject, alertText, familyButtons, familyUpdateText, voicePath } from '@/lib/messages';
import type { NewDelivery } from '@/lib/repo/types';
import type { Alert, AlertReason, Contact, Delivery, Profile, Trip } from '@/lib/types';

export const MAX_ATTEMPTS = 3;

export interface RaiseInput {
  userId: string;
  tripId: string | null;
  reason: AlertReason;
  lat?: number | null;
  lng?: number | null;
}

export interface RaiseResult {
  alert: Alert;
  sent: number;
  failed: number;
}

interface AlertContext {
  alert: Alert;
  profile: Profile;
  trip: Trip | null;
}

const errorMessage = (err: unknown) => (err instanceof Error ? err.message : String(err));

function reachable(contacts: Contact[]): Contact[] {
  return contacts.filter((c) => c.status !== 'blocked');
}

function buildText(deps: Deps, ctx: AlertContext): string {
  return alertText({
    userName: ctx.profile.name,
    reason: ctx.alert.reason,
    at: new Date(ctx.alert.createdAt),
    lat: ctx.alert.lat,
    lng: ctx.alert.lng,
    shareUrl: ctx.trip ? `${deps.appUrl}/t/${ctx.trip.shareToken}` : null,
  });
}

async function sendTelegramAlert(deps: Deps, chatId: string, ctx: AlertContext): Promise<void> {
  const { alert } = ctx;
  const bestEffort = async (fn: () => Promise<void>) => {
    try {
      await fn();
    } catch {
      // Extras must never stop the text alert.
    }
  };
  await bestEffort(() => deps.telegram.sendVoice(chatId, `${deps.appUrl}${voicePath(alert.reason)}`));
  if (alert.lat !== null && alert.lng !== null) {
    const { lat, lng } = alert;
    await bestEffort(() => deps.telegram.sendLocation(chatId, lat, lng));
  }
  if (alert.photoPath) {
    const url = await deps.photoUrl(alert.photoPath).catch(() => null);
    if (url) await bestEffort(() => deps.telegram.sendPhoto(chatId, url));
  }
  const buttons = alert.reason === 'test' ? undefined : familyButtons(alert.id);
  await deps.telegram.sendMessage(chatId, buildText(deps, ctx), buttons);
}

async function sendEmailAlert(deps: Deps, to: string, ctx: AlertContext): Promise<void> {
  let text = buildText(deps, ctx);
  if (ctx.alert.photoPath) {
    const url = await deps.photoUrl(ctx.alert.photoPath).catch(() => null);
    if (url) text += `\n📷 ${url}`;
  }
  await deps.email.send(to, alertSubject(ctx.profile.name, ctx.alert.reason), text);
}

async function attemptDelivery(deps: Deps, delivery: Delivery, contact: Contact | undefined, ctx: AlertContext) {
  try {
    if (!contact) throw new Error('contact no longer exists');
    if (delivery.channel === 'telegram') {
      if (!contact.telegramChatId || contact.status !== 'connected') throw new Error('telegram not connected');
      await sendTelegramAlert(deps, contact.telegramChatId, ctx);
    } else {
      if (!contact.email) throw new Error('no email');
      await sendEmailAlert(deps, contact.email, ctx);
    }
    await deps.repo.updateDelivery(delivery.id, { status: 'sent', attempts: delivery.attempts + 1, lastError: null });
    return true;
  } catch (err) {
    await deps.repo.updateDelivery(delivery.id, {
      status: 'failed', attempts: delivery.attempts + 1, lastError: errorMessage(err),
    });
    return false;
  }
}

export async function raiseAlert(deps: Deps, input: RaiseInput): Promise<RaiseResult> {
  const profile = await deps.repo.getProfile(input.userId);
  if (!profile) throw new Error(`Profile not found: ${input.userId}`);
  const trip = input.tripId ? await deps.repo.getTrip(input.tripId) : null;

  let lat = input.lat ?? null;
  let lng = input.lng ?? null;
  if ((lat === null || lng === null) && trip) {
    const last = await deps.repo.lastLocation(trip.id);
    if (last) ({ lat, lng } = last);
  }

  const alert = await deps.repo.createAlert({
    userId: profile.id,
    tripId: trip?.id ?? null,
    reason: input.reason,
    lat,
    lng,
    photoPath: trip?.vehiclePhotoPath ?? null,
    createdAt: deps.now().toISOString(),
  });

  const contacts = reachable(await deps.repo.listContacts(profile.id));
  const planned: NewDelivery[] = [];
  for (const c of contacts) {
    const base = { alertId: alert.id, contactId: c.id, status: 'pending' as const, attempts: 0, lastError: null };
    if (c.telegramChatId && c.status === 'connected') planned.push({ ...base, channel: 'telegram' });
    if (c.email) planned.push({ ...base, channel: 'email' });
  }
  const deliveries = await deps.repo.createDeliveries(planned);

  const ctx: AlertContext = { alert, profile, trip };
  const results = await Promise.all(
    deliveries.map((d) => attemptDelivery(deps, d, contacts.find((c) => c.id === d.contactId), ctx)),
  );
  const sent = results.filter(Boolean).length;
  return { alert, sent, failed: results.length - sent };
}

export async function retryDeliveries(deps: Deps): Promise<{ retried: number; sent: number }> {
  const pending = await deps.repo.listRetryableDeliveries(MAX_ATTEMPTS);
  let sent = 0;
  const contexts = new Map<string, AlertContext | null>();
  for (const d of pending) {
    if (!contexts.has(d.alertId)) {
      const alert = await deps.repo.getAlert(d.alertId);
      const profile = alert ? await deps.repo.getProfile(alert.userId) : null;
      const trip = alert?.tripId ? await deps.repo.getTrip(alert.tripId) : null;
      contexts.set(d.alertId, alert && profile ? { alert, profile, trip } : null);
    }
    const ctx = contexts.get(d.alertId);
    if (!ctx) continue;
    const contact = (await deps.repo.getContact(d.contactId)) ?? undefined;
    if (await attemptDelivery(deps, d, contact, ctx)) sent++;
  }
  return { retried: pending.length, sent };
}

/** Plain notice to every reachable contact. Best effort: never throws. Returns how many sends worked. */
export async function notifyContacts(deps: Deps, userId: string, text: string, exceptContactId?: string): Promise<number> {
  const contacts = reachable(await deps.repo.listContacts(userId)).filter((c) => c.id !== exceptContactId);
  const sends: Promise<void>[] = [];
  for (const c of contacts) {
    if (c.telegramChatId && c.status === 'connected') sends.push(deps.telegram.sendMessage(c.telegramChatId, text));
    if (c.email) sends.push(deps.email.send(c.email, 'Beti AI', text));
  }
  const results = await Promise.allSettled(sends);
  return results.filter((r) => r.status === 'fulfilled').length;
}

export async function resolveFromFamily(
  deps: Deps,
  input: { alertId: string; chatId: string; action: 'going' | 'ok' },
): Promise<{ ok: boolean }> {
  const alert = await deps.repo.getAlert(input.alertId);
  if (!alert) return { ok: false };
  const contact = (await deps.repo.listContactsByChatId(input.chatId)).find((c) => c.userId === alert.userId);
  if (!contact) return { ok: false };
  const profile = await deps.repo.getProfile(alert.userId);
  if (!profile) return { ok: false };
  if (input.action === 'ok') await deps.repo.resolveAlert(alert.id, contact.name, deps.now());
  await notifyContacts(deps, alert.userId, familyUpdateText(profile.name, contact.name, input.action), contact.id);
  return { ok: true };
}
