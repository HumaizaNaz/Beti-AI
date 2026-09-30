import type { Alert, Contact, Delivery, LocationPoint, PinState, Profile, Trip, TripStatus } from '@/lib/types';

export type NewContact = Omit<Contact, 'id'>;
export type NewTrip = Omit<Trip, 'id' | 'duressAt' | 'timerClaimedAt' | 'timerAlertId'>;
export type NewAlert = Omit<Alert, 'id' | 'resolvedAt' | 'resolvedBy'>;
export type NewDelivery = Omit<Delivery, 'id'>;
export type TripPatch = Partial<Pick<Trip, 'shareExpiresAt' | 'deadlineAt' | 'duressAt'>>;

/** A claimed trip is re-offered if no timer alert was recorded within this time. */
export const TIMER_RECLAIM_MS = 2 * 60_000;

export interface Repo {
  ping(): Promise<void>;

  getProfile(userId: string): Promise<Profile | null>;
  getProfileByPhone(phone: string): Promise<Profile | null>;
  saveProfile(profile: Profile): Promise<void>;
  updatePinState(userId: string, state: PinState): Promise<void>;
  /**
   * Atomically takes one PIN attempt: increments failedPinCount only if the account is not locked
   * and fewer than `max` attempts are in use. Returns the attempt number, or allowed=false.
   */
  reservePinAttempt(userId: string, now: Date, max: number): Promise<{ allowed: boolean; attempt: number }>;

  listContacts(userId: string): Promise<Contact[]>;
  getContact(id: string): Promise<Contact | null>;
  getContactByInviteToken(token: string): Promise<Contact | null>;
  listContactsByChatId(chatId: string): Promise<Contact[]>;
  createContact(contact: NewContact): Promise<Contact>;
  updateContact(id: string, patch: Partial<Pick<Contact, 'telegramChatId' | 'status'>>): Promise<void>;
  deleteContact(userId: string, id: string): Promise<boolean>;

  createTrip(trip: NewTrip): Promise<Trip>;
  getTrip(id: string): Promise<Trip | null>;
  /** Newest trip that is active, or alerted without a duress mark (duress trips look finished on the phone). */
  getOpenTrip(userId: string): Promise<Trip | null>;
  getTripByShareToken(token: string): Promise<Trip | null>;
  transitionTrip(id: string, from: TripStatus, to: TripStatus, patch?: TripPatch): Promise<Trip | null>;
  /**
   * Atomically claims overdue active trips (-> alerted, timerClaimedAt = now), plus alerted trips whose
   * claim is older than TIMER_RECLAIM_MS and never got a timer alert (the previous run crashed).
   */
  claimDueTrips(now: Date): Promise<Trip[]>;
  markTimerAlert(tripId: string, alertId: string): Promise<void>;

  addLocations(tripId: string, points: LocationPoint[]): Promise<void>;
  lastLocation(tripId: string): Promise<LocationPoint | null>;

  createAlert(alert: NewAlert): Promise<Alert>;
  getAlert(id: string): Promise<Alert | null>;
  /** Newest unresolved alert of the user, ignoring test alerts. */
  latestOpenAlert(userId: string): Promise<Alert | null>;
  listOpenAlertsForTrip(tripId: string): Promise<Alert[]>;
  resolveAlert(id: string, resolvedBy: string, at: Date): Promise<Alert | null>;

  createDeliveries(deliveries: NewDelivery[]): Promise<Delivery[]>;
  updateDelivery(id: string, patch: Partial<Pick<Delivery, 'status' | 'attempts' | 'lastError'>>): Promise<void>;
  listRetryableDeliveries(maxAttempts: number): Promise<Delivery[]>;
}
