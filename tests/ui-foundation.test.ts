import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AUDIO_NAMES } from '@/lib/audio';
import { errorKey } from '@/lib/client/errors';
import { helpSmsBody, safeSmsBody, smsLink } from '@/lib/client/offline';
import { STRINGS } from '@/lib/i18n';

describe('i18n', () => {
  it('every string has Urdu and English', () => {
    for (const [key, value] of Object.entries(STRINGS)) {
      expect(value.ur.trim(), key).not.toBe('');
      expect(value.en.trim(), key).not.toBe('');
    }
  });

  it('maps API error codes to strings, with a generic fallback', () => {
    expect(errorKey('bad_phone')).toBe('errBadPhone');
    expect(errorKey('wrong_pin')).toBe('wrongPin');
    expect(errorKey('something_new')).toBe('errGeneric');
    expect(errorKey(undefined)).toBe('errGeneric');
  });
});

describe('audio clips', () => {
  it('every clip referenced in code exists in public/audio', () => {
    for (const name of AUDIO_NAMES) {
      expect(existsSync(join(process.cwd(), 'public', 'audio', `${name}.mp3`)), name).toBe(true);
    }
  });
});

describe('offline SMS fallback', () => {
  it('builds an sms: link for several numbers with an encoded body', () => {
    const link = smsLink(['+923007654321', '+923009876543'], helpSmsBody('Ayesha', 24.86, 67));
    expect(link.startsWith('sms:+923007654321,+923009876543?body=')).toBe(true);
    expect(decodeURIComponent(link.split('body=')[1])).toContain('https://maps.google.com/?q=24.86,67');
  });

  it('works without a location', () => {
    expect(helpSmsBody('Ayesha', null, null)).not.toContain('maps');
    expect(safeSmsBody('Ayesha')).toContain('Ayesha');
  });
});
