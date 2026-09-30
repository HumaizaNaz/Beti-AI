export type Lang = 'ur' | 'en';
export type AlertReason = 'timer' | 'sos' | 'duress' | 'wrong_pin' | 'help_page' | 'calculator' | 'test';
export type TripStatus = 'active' | 'safe' | 'alerted';
export type ContactStatus = 'pending' | 'connected' | 'blocked';
export type Channel = 'telegram' | 'email';
export type DeliveryStatus = 'pending' | 'sent' | 'failed';
export type Relation = 'mother' | 'father' | 'brother' | 'sister' | 'husband' | 'friend' | 'other';

export interface PinState {
  failedPinCount: number;
  pinLockedUntil: string | null;
}

export interface Profile extends PinState {
  id: string;
  name: string;
  phone: string;
  safePinHash: string | null;
  duressPinHash: string | null;
  lang: Lang;
}

export interface Contact {
  id: string;
  userId: string;
  name: string;
  relation: Relation;
  phone: string | null;
  email: string | null;
  telegramChatId: string | null;
  inviteToken: string;
  status: ContactStatus;
}

export interface Trip {
  id: string;
  userId: string;
  vehiclePhotoPath: string | null;
  durationMin: number;
  startedAt: string;
  deadlineAt: string;
  status: TripStatus;
  shareToken: string;
  shareExpiresAt: string | null;
}

export interface LocationPoint {
  lat: number;
  lng: number;
  accuracyM: number | null;
  recordedAt: string;
}

export interface Alert {
  id: string;
  userId: string;
  tripId: string | null;
  reason: AlertReason;
  lat: number | null;
  lng: number | null;
  photoPath: string | null;
  createdAt: string;
  resolvedAt: string | null;
  resolvedBy: string | null;
}

export interface Delivery {
  id: string;
  alertId: string;
  contactId: string;
  channel: Channel;
  status: DeliveryStatus;
  attempts: number;
  lastError: string | null;
}
