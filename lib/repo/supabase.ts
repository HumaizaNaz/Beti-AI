import type { SupabaseClient } from '@supabase/supabase-js';
import type { Alert, Contact, Delivery, LocationPoint, Profile, Trip } from '@/lib/types';
import { TIMER_RECLAIM_MS, type Repo } from './types';

type Row = Record<string, any>;

function must<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

const toProfile = (r: Row): Profile => ({
  id: r.id, name: r.name, phone: r.phone, safePinHash: r.safe_pin_hash, duressPinHash: r.duress_pin_hash,
  failedPinCount: r.failed_pin_count, pinLockedUntil: r.pin_locked_until, lang: r.lang,
});
const toContact = (r: Row): Contact => ({
  id: r.id, userId: r.user_id, name: r.name, relation: r.relation, phone: r.phone, email: r.email,
  telegramChatId: r.telegram_chat_id, inviteToken: r.invite_token, status: r.status,
});
const toTrip = (r: Row): Trip => ({
  id: r.id, userId: r.user_id, vehiclePhotoPath: r.vehicle_photo_path, durationMin: r.duration_min,
  startedAt: r.started_at, deadlineAt: r.deadline_at, status: r.status, shareToken: r.share_token,
  shareExpiresAt: r.share_expires_at,
  duressAt: r.duress_at, timerClaimedAt: r.timer_claimed_at, timerAlertId: r.timer_alert_id,
});
const toLocation = (r: Row): LocationPoint => ({
  lat: r.lat, lng: r.lng, accuracyM: r.accuracy_m, recordedAt: r.recorded_at,
});
const toAlert = (r: Row): Alert => ({
  id: r.id, userId: r.user_id, tripId: r.trip_id, reason: r.reason, lat: r.lat, lng: r.lng,
  photoPath: r.photo_path, createdAt: r.created_at, resolvedAt: r.resolved_at, resolvedBy: r.resolved_by,
});
const toDelivery = (r: Row): Delivery => ({
  id: r.id, alertId: r.alert_id, contactId: r.contact_id, channel: r.channel, status: r.status,
  attempts: r.attempts, lastError: r.last_error,
});

export function createSupabaseRepo(db: SupabaseClient): Repo {
  return {
    async ping() {
      must(await db.from('profiles').select('id').limit(1));
    },

    async getProfile(id) {
      const r = must(await db.from('profiles').select('*').eq('id', id).maybeSingle());
      return r ? toProfile(r) : null;
    },
    async getProfileByPhone(phone) {
      const r = must(await db.from('profiles').select('*').eq('phone', phone).maybeSingle());
      return r ? toProfile(r) : null;
    },
    async saveProfile(p) {
      must(await db.from('profiles').upsert({
        id: p.id, name: p.name, phone: p.phone, safe_pin_hash: p.safePinHash, duress_pin_hash: p.duressPinHash,
        failed_pin_count: p.failedPinCount, pin_locked_until: p.pinLockedUntil, lang: p.lang,
      }));
    },
    async updatePinState(userId, s) {
      must(await db.from('profiles')
        .update({ failed_pin_count: s.failedPinCount, pin_locked_until: s.pinLockedUntil })
        .eq('id', userId));
    },
    async reservePinAttempt(userId, now, max) {
      const rows = must(await db.rpc('beti_reserve_pin_attempt', { p_user: userId, p_now: now.toISOString(), p_max: max }));
      const row = (rows ?? [])[0] as Row | undefined;
      return { allowed: !!row?.allowed, attempt: Number(row?.attempt ?? 0) };
    },

    async listContacts(userId) {
      const rows = must(await db.from('contacts').select('*').eq('user_id', userId).order('created_at'));
      return (rows ?? []).map(toContact);
    },
    async getContact(id) {
      const r = must(await db.from('contacts').select('*').eq('id', id).maybeSingle());
      return r ? toContact(r) : null;
    },
    async getContactByInviteToken(token) {
      const r = must(await db.from('contacts').select('*').eq('invite_token', token).maybeSingle());
      return r ? toContact(r) : null;
    },
    async listContactsByChatId(chatId) {
      const rows = must(await db.from('contacts').select('*').eq('telegram_chat_id', chatId));
      return (rows ?? []).map(toContact);
    },
    async createContact(c) {
      const r = must(await db.from('contacts').insert({
        user_id: c.userId, name: c.name, relation: c.relation, phone: c.phone, email: c.email,
        telegram_chat_id: c.telegramChatId, invite_token: c.inviteToken, status: c.status,
      }).select().single());
      return toContact(r);
    },
    async updateContact(id, patch) {
      const row: Row = {};
      if (patch.telegramChatId !== undefined) row.telegram_chat_id = patch.telegramChatId;
      if (patch.status !== undefined) row.status = patch.status;
      must(await db.from('contacts').update(row).eq('id', id));
    },
    async deleteContact(userId, id) {
      const rows = must(await db.from('contacts').delete().eq('id', id).eq('user_id', userId).select('id'));
      return (rows ?? []).length > 0;
    },

    async createTrip(t) {
      const r = must(await db.from('trips').insert({
        user_id: t.userId, vehicle_photo_path: t.vehiclePhotoPath, duration_min: t.durationMin,
        started_at: t.startedAt, deadline_at: t.deadlineAt, status: t.status, share_token: t.shareToken,
        share_expires_at: t.shareExpiresAt,
      }).select().single());
      return toTrip(r);
    },
    async getTrip(id) {
      const r = must(await db.from('trips').select('*').eq('id', id).maybeSingle());
      return r ? toTrip(r) : null;
    },
    async getOpenTrip(userId) {
      const r = must(await db.from('trips').select('*').eq('user_id', userId)
        .or('status.eq.active,and(status.eq.alerted,duress_at.is.null)')
        .order('started_at', { ascending: false }).limit(1).maybeSingle());
      return r ? toTrip(r) : null;
    },
    async getTripByShareToken(token) {
      const r = must(await db.from('trips').select('*').eq('share_token', token).maybeSingle());
      return r ? toTrip(r) : null;
    },
    async transitionTrip(id, from, to, patch = {}) {
      const row: Row = { status: to };
      if (patch.shareExpiresAt !== undefined) row.share_expires_at = patch.shareExpiresAt;
      if (patch.deadlineAt !== undefined) row.deadline_at = patch.deadlineAt;
      if (patch.duressAt !== undefined) row.duress_at = patch.duressAt;
      const r = must(await db.from('trips').update(row).eq('id', id).eq('status', from).select().maybeSingle());
      return r ? toTrip(r) : null;
    },
    async claimDueTrips(now) {
      const at = now.toISOString();
      const fresh = must(await db.from('trips').update({ status: 'alerted', timer_claimed_at: at })
        .eq('status', 'active').lt('deadline_at', at).select());
      const staleBefore = new Date(now.getTime() - TIMER_RECLAIM_MS).toISOString();
      const stale = must(await db.from('trips').update({ timer_claimed_at: at })
        .eq('status', 'alerted').is('timer_alert_id', null).lt('timer_claimed_at', staleBefore).select());
      return [...(fresh ?? []), ...(stale ?? [])].map(toTrip);
    },
    async markTimerAlert(tripId, alertId) {
      must(await db.from('trips').update({ timer_alert_id: alertId }).eq('id', tripId));
    },

    async addLocations(tripId, points) {
      if (points.length === 0) return;
      must(await db.from('locations').insert(points.map((p) => ({
        trip_id: tripId, lat: p.lat, lng: p.lng, accuracy_m: p.accuracyM, recorded_at: p.recordedAt,
      }))));
    },
    async lastLocation(tripId) {
      const r = must(await db.from('locations').select('*').eq('trip_id', tripId)
        .order('recorded_at', { ascending: false }).limit(1).maybeSingle());
      return r ? toLocation(r) : null;
    },

    async createAlert(a) {
      const r = must(await db.from('alerts').insert({
        user_id: a.userId, trip_id: a.tripId, reason: a.reason, lat: a.lat, lng: a.lng,
        photo_path: a.photoPath, created_at: a.createdAt,
      }).select().single());
      return toAlert(r);
    },
    async getAlert(id) {
      const r = must(await db.from('alerts').select('*').eq('id', id).maybeSingle());
      return r ? toAlert(r) : null;
    },
    async latestOpenAlert(userId) {
      const r = must(await db.from('alerts').select('*').eq('user_id', userId).is('resolved_at', null)
        .neq('reason', 'test').order('created_at', { ascending: false }).limit(1).maybeSingle());
      return r ? toAlert(r) : null;
    },
    async listOpenAlertsForTrip(tripId) {
      const rows = must(await db.from('alerts').select('*').eq('trip_id', tripId).is('resolved_at', null));
      return (rows ?? []).map(toAlert);
    },
    async resolveAlert(id, resolvedBy, at) {
      const r = must(await db.from('alerts').update({ resolved_at: at.toISOString(), resolved_by: resolvedBy })
        .eq('id', id).is('resolved_at', null).select().maybeSingle());
      return r ? toAlert(r) : null;
    },

    async createDeliveries(deliveries) {
      if (deliveries.length === 0) return [];
      const rows = must(await db.from('alert_deliveries').insert(deliveries.map((d) => ({
        alert_id: d.alertId, contact_id: d.contactId, channel: d.channel, status: d.status,
        attempts: d.attempts, last_error: d.lastError,
      }))).select());
      return (rows ?? []).map(toDelivery);
    },
    async updateDelivery(id, patch) {
      const row: Row = {};
      if (patch.status !== undefined) row.status = patch.status;
      if (patch.attempts !== undefined) row.attempts = patch.attempts;
      if (patch.lastError !== undefined) row.last_error = patch.lastError;
      must(await db.from('alert_deliveries').update(row).eq('id', id));
    },
    async listRetryableDeliveries(maxAttempts) {
      const rows = must(await db.from('alert_deliveries').select('*').neq('status', 'sent').lt('attempts', maxAttempts));
      return (rows ?? []).map(toDelivery);
    },
  };
}
