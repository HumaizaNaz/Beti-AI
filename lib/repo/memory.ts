import { randomUUID } from 'node:crypto';
import type { Alert, Contact, Delivery, LocationPoint, Profile, Trip } from '@/lib/types';
import type { Repo } from './types';

export interface MemoryData {
  profiles: Map<string, Profile>;
  contacts: Contact[];
  trips: Trip[];
  locations: Map<string, LocationPoint[]>;
  alerts: Alert[];
  deliveries: Delivery[];
}

export type MemoryRepo = Repo & { data: MemoryData };

const copy = <T>(value: T): T => structuredClone(value);

function newest<T>(list: T[], key: (item: T) => string): T | undefined {
  return [...list].sort((a, b) => key(b).localeCompare(key(a)))[0];
}

export function createMemoryRepo(): MemoryRepo {
  const data: MemoryData = {
    profiles: new Map(), contacts: [], trips: [], locations: new Map(), alerts: [], deliveries: [],
  };

  return {
    data,
    async ping() {},

    async getProfile(id) {
      const p = data.profiles.get(id);
      return p ? copy(p) : null;
    },
    async getProfileByPhone(phone) {
      for (const p of data.profiles.values()) if (p.phone === phone) return copy(p);
      return null;
    },
    async saveProfile(profile) {
      data.profiles.set(profile.id, copy(profile));
    },
    async updatePinState(userId, state) {
      const p = data.profiles.get(userId);
      if (p) Object.assign(p, state);
    },

    async listContacts(userId) {
      return data.contacts.filter((c) => c.userId === userId).map(copy);
    },
    async getContact(id) {
      const c = data.contacts.find((x) => x.id === id);
      return c ? copy(c) : null;
    },
    async getContactByInviteToken(token) {
      const c = data.contacts.find((x) => x.inviteToken === token);
      return c ? copy(c) : null;
    },
    async listContactsByChatId(chatId) {
      return data.contacts.filter((c) => c.telegramChatId === chatId).map(copy);
    },
    async createContact(contact) {
      const row: Contact = { ...copy(contact), id: randomUUID() };
      data.contacts.push(row);
      return copy(row);
    },
    async updateContact(id, patch) {
      const c = data.contacts.find((x) => x.id === id);
      if (c) Object.assign(c, patch);
    },
    async deleteContact(userId, id) {
      const i = data.contacts.findIndex((c) => c.id === id && c.userId === userId);
      if (i < 0) return false;
      data.contacts.splice(i, 1);
      return true;
    },

    async createTrip(trip) {
      const row: Trip = { ...copy(trip), id: randomUUID() };
      data.trips.push(row);
      return copy(row);
    },
    async getTrip(id) {
      const t = data.trips.find((x) => x.id === id);
      return t ? copy(t) : null;
    },
    async getOpenTrip(userId) {
      const t = newest(data.trips.filter((x) => x.userId === userId && x.status !== 'safe'), (x) => x.startedAt);
      return t ? copy(t) : null;
    },
    async getTripByShareToken(token) {
      const t = data.trips.find((x) => x.shareToken === token);
      return t ? copy(t) : null;
    },
    async transitionTrip(id, from, to, patch = {}) {
      const t = data.trips.find((x) => x.id === id);
      if (!t || t.status !== from) return null;
      Object.assign(t, patch, { status: to });
      return copy(t);
    },
    async claimDueTrips(now) {
      const due = data.trips.filter((t) => t.status === 'active' && new Date(t.deadlineAt) < now);
      for (const t of due) t.status = 'alerted';
      return due.map(copy);
    },

    async addLocations(tripId, points) {
      const list = data.locations.get(tripId) ?? [];
      list.push(...points.map(copy));
      data.locations.set(tripId, list);
    },
    async lastLocation(tripId) {
      const p = newest(data.locations.get(tripId) ?? [], (x) => x.recordedAt);
      return p ? copy(p) : null;
    },

    async createAlert(alert) {
      const row: Alert = { ...copy(alert), id: randomUUID(), resolvedAt: null, resolvedBy: null };
      data.alerts.push(row);
      return copy(row);
    },
    async getAlert(id) {
      const a = data.alerts.find((x) => x.id === id);
      return a ? copy(a) : null;
    },
    async latestOpenAlert(userId) {
      const a = newest(data.alerts.filter((x) => x.userId === userId && !x.resolvedAt), (x) => x.createdAt);
      return a ? copy(a) : null;
    },
    async resolveAlert(id, resolvedBy, at) {
      const a = data.alerts.find((x) => x.id === id);
      if (!a || a.resolvedAt) return null;
      a.resolvedAt = at.toISOString();
      a.resolvedBy = resolvedBy;
      return copy(a);
    },

    async createDeliveries(deliveries) {
      const rows: Delivery[] = deliveries.map((d) => ({ ...copy(d), id: randomUUID() }));
      data.deliveries.push(...rows);
      return rows.map(copy);
    },
    async updateDelivery(id, patch) {
      const d = data.deliveries.find((x) => x.id === id);
      if (d) Object.assign(d, patch);
    },
    async listRetryableDeliveries(maxAttempts) {
      return data.deliveries.filter((d) => d.status !== 'sent' && d.attempts < maxAttempts).map(copy);
    },
  };
}
