import type { Alert, Contact, Delivery, LocationPoint, PinState, Profile, Trip, TripStatus } from '@/lib/types';

export type NewContact = Omit<Contact, 'id'>;
export type NewTrip = Omit<Trip, 'id'>;
export type NewAlert = Omit<Alert, 'id' | 'resolvedAt' | 'resolvedBy'>;
export type NewDelivery = Omit<Delivery, 'id'>;
export type TripPatch = Partial<Pick<Trip, 'shareExpiresAt' | 'deadlineAt'>>;

export interface Repo {
  ping(): Promise<void>;

  getProfile(userId: string): Promise<Profile | null>;
  getProfileByPhone(phone: string): Promise<Profile | null>;
  saveProfile(profile: Profile): Promise<void>;
  updatePinState(userId: string, state: PinState): Promise<void>;

  listContacts(userId: string): Promise<Contact[]>;
  getContact(id: string): Promise<Contact | null>;
  getContactByInviteToken(token: string): Promise<Contact | null>;
  listContactsByChatId(chatId: string): Promise<Contact[]>;
  createContact(contact: NewContact): Promise<Contact>;
  updateContact(id: string, patch: Partial<Pick<Contact, 'telegramChatId' | 'status'>>): Promise<void>;
  deleteContact(userId: string, id: string): Promise<boolean>;

  createTrip(trip: NewTrip): Promise<Trip>;
  getTrip(id: string): Promise<Trip | null>;
  getOpenTrip(userId: string): Promise<Trip | null>;
  getTripByShareToken(token: string): Promise<Trip | null>;
  transitionTrip(id: string, from: TripStatus, to: TripStatus, patch?: TripPatch): Promise<Trip | null>;
  claimDueTrips(now: Date): Promise<Trip[]>;

  addLocations(tripId: string, points: LocationPoint[]): Promise<void>;
  lastLocation(tripId: string): Promise<LocationPoint | null>;

  createAlert(alert: NewAlert): Promise<Alert>;
  getAlert(id: string): Promise<Alert | null>;
  latestOpenAlert(userId: string): Promise<Alert | null>;
  resolveAlert(id: string, resolvedBy: string, at: Date): Promise<Alert | null>;

  createDeliveries(deliveries: NewDelivery[]): Promise<Delivery[]>;
  updateDelivery(id: string, patch: Partial<Pick<Delivery, 'status' | 'attempts' | 'lastError'>>): Promise<void>;
  listRetryableDeliveries(maxAttempts: number): Promise<Delivery[]>;
}
