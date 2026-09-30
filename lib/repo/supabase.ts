import type { SupabaseClient } from '@supabase/supabase-js';
import type { Alert, Contact, Delivery, LocationPoint, Profile, Trip } from '@/lib/types';
import type { Repo } from './types';

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
      const r = must(await db.from('trips').select('*').eq('user_id', userId).in('status', ['active', 'alerted'])
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
      const r = must(await db.from('trips').update(row).eq('id', id).eq('status', from).select().maybeSingle());
      return r ? toTrip(r) : null;
    },
    async claimDueTrips(now) {
      const rows = must(await db.from('trips').update({ status: 'alerted' })
        .eq('status', 'active').lt('deadline_at', now.toISOString()).select());
      return (rows ?? []).map(toTrip);
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
        .order('created_at', { ascending: false }).limit(1).maybeSingle());
      return r ? toAlert(r) : null;
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
