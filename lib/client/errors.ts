// lib/client/errors.ts
import type { StringKey } from '@/lib/i18n';

const MAP: Record<string, StringKey> = {
  bad_phone: 'errBadPhone',
  phone_taken: 'errPhoneTaken',
  bad_name: 'errBadName',
  bad_contact: 'errBadContact',
  too_many: 'errTooMany',
  bad_pin: 'errBadPin',
  same_pins: 'pinsMustDiffer',
  wrong_pin: 'wrongPin',
  locked: 'locked',
};

export function errorKey(code: unknown): StringKey {
  return (typeof code === 'string' && MAP[code]) || 'errGeneric';
}
