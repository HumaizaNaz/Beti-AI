import { raiseAlert } from '@/lib/alerts';
import type { Deps } from '@/lib/deps';
import { verifyPin } from '@/lib/guard';
import { normalizePkPhone } from '@/lib/phone';
import { hashPin, isValidPin } from '@/lib/pin';
import { RELATIONS } from '@/lib/relations';
import { randomToken } from '@/lib/token';
import type { Contact, ContactStatus, Lang, Relation, TripStatus } from '@/lib/types';

export type AccountErrorCode =
  | 'bad_name' | 'bad_phone' | 'bad_pin' | 'same_pins' | 'phone_taken' | 'pin_required'
  | 'wrong_pin' | 'locked' | 'bad_contact' | 'too_many' | 'not_found';

export class AccountError extends Error {
  constructor(public code: AccountErrorCode) {
    super(code);
  }
}

export const MAX_CONTACTS = 5;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

export async function setupProfile(deps: Deps, userId: string, input: Record<string, unknown>): Promise<void> {
  const existing = await deps.repo.getProfile(userId);
  if (existing?.safePinHash) throw new AccountError('pin_required');

  const name = text(input.name);
  if (name.length < 1 || name.length > 60) throw new AccountError('bad_name');
  const phone = normalizePkPhone(text(input.phone));
  if (!phone) throw new AccountError('bad_phone');
  const { safePin, duressPin } = input;
  if (!isValidPin(safePin) || !isValidPin(duressPin)) throw new AccountError('bad_pin');
  if (safePin === duressPin) throw new AccountError('same_pins');
  const owner = await deps.repo.getProfileByPhone(phone);
  if (owner && owner.id !== userId) throw new AccountError('phone_taken');

  await deps.repo.saveProfile({
    id: userId,
    name,
    phone,
    safePinHash: await hashPin(safePin),
    duressPinHash: await hashPin(duressPin),
    failedPinCount: 0,
    pinLockedUntil: null,
    lang: existing?.lang ?? 'ur',
  });
}

export async function checkUserPin(deps: Deps, userId: string, pin: string): Promise<'ok' | 'wrong' | 'locked'> {
  const profile = await deps.repo.getProfile(userId);
  if (!profile) throw new AccountError('not_found');
  const result = await verifyPin(deps, profile, pin);
  return result === 'duress' ? 'ok' : result;
}

async function requirePin(deps: Deps, userId: string, pin: unknown): Promise<void> {
  const result = await checkUserPin(deps, userId, typeof pin === 'string' ? pin : '');
  if (result === 'wrong') throw new AccountError('wrong_pin');
  if (result === 'locked') throw new AccountError('locked');
}

export async function addContact(deps: Deps, userId: string, input: Record<string, unknown>): Promise<Contact> {
  await requirePin(deps, userId, input.pin);
  const name = text(input.name);
  if (name.length < 1 || name.length > 40) throw new AccountError('bad_contact');
  const relation = RELATIONS.find((r) => r.id === input.relation)?.id as Relation | undefined;
  if (!relation) throw new AccountError('bad_contact');
  const phone = normalizePkPhone(text(input.phone));
  if (!phone) throw new AccountError('bad_phone');
  const email = text(input.email) || null;
  if (email && !EMAIL_RE.test(email)) throw new AccountError('bad_contact');
  if ((await deps.repo.listContacts(userId)).length >= MAX_CONTACTS) throw new AccountError('too_many');

  return deps.repo.createContact({
    userId, name, relation, phone, email, telegramChatId: null, inviteToken: randomToken(), status: 'pending',
  });
}

export async function removeContact(deps: Deps, userId: string, contactId: string, pin: unknown): Promise<void> {
  await requirePin(deps, userId, pin);
  if (!(await deps.repo.deleteContact(userId, contactId))) throw new AccountError('not_found');
}

export interface Overview {
  profile: { name: string; phone: string; lang: Lang; hasPin: boolean } | null;
  contacts: {
    id: string;
    name: string;
    relation: Relation;
    phone: string | null;
    email: string | null;
    status: ContactStatus;
    inviteLink: string;
  }[];
  openTrip: { id: string; status: TripStatus; deadlineAt: string; durationMin: number; startedAt: string } | null;
}

export async function getOverview(deps: Deps, userId: string): Promise<Overview> {
  const [profile, contacts, trip] = await Promise.all([
    deps.repo.getProfile(userId),
    deps.repo.listContacts(userId),
    deps.repo.getOpenTrip(userId),
  ]);
  return {
    profile: profile ? { name: profile.name, phone: profile.phone, lang: profile.lang, hasPin: !!profile.safePinHash } : null,
    contacts: contacts.map((c) => ({
      id: c.id, name: c.name, relation: c.relation, phone: c.phone, email: c.email, status: c.status,
      inviteLink: `https://t.me/${deps.botUsername}?start=${c.inviteToken}`,
    })),
    openTrip: trip
      ? { id: trip.id, status: trip.status, deadlineAt: trip.deadlineAt, durationMin: trip.durationMin, startedAt: trip.startedAt }
      : null,
  };
}

export async function sendTestAlert(deps: Deps, userId: string): Promise<{ sent: number; failed: number }> {
  const { sent, failed } = await raiseAlert(deps, { userId, tripId: null, reason: 'test' });
  return { sent, failed };
}
