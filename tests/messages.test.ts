import { describe, expect, it } from 'vitest';
import { alertSubject, alertText, familyButtons, inviteShareText, mapsUrl, voicePath } from '@/lib/messages';

const at = new Date('2026-10-01T17:42:00.000Z');

describe('alertText', () => {
  it('includes name, reason, map link and live link', () => {
    const text = alertText({ userName: 'Ayesha', reason: 'timer', at, lat: 24.86, lng: 67.0, shareUrl: 'https://beti.test/t/abc' });
    expect(text).toContain('Ayesha');
    expect(text).toContain('Trip timer ran out');
    expect(text).toContain(mapsUrl(24.86, 67.0));
    expect(text).toContain('https://beti.test/t/abc');
    expect(text).toContain('15');
    expect(text).toMatch(/10:42\sPM/); // ICU may use a narrow no-break space before PM
  });

  it('says when location is missing', () => {
    const text = alertText({ userName: 'Ayesha', reason: 'sos', at, lat: null, lng: null, shareUrl: null });
    expect(text).toContain('Location not available');
    expect(text).not.toContain('Live');
  });

  it('marks test alerts clearly and does not ask to call 15', () => {
    const text = alertText({ userName: 'Ayesha', reason: 'test', at, lat: null, lng: null, shareUrl: null });
    expect(text).toContain('TEST');
    expect(text).not.toContain('dial 15');
  });
});

describe('helpers', () => {
  it('picks the test voice only for test alerts', () => {
    expect(voicePath('test')).toBe('/audio/alert-test.mp3');
    expect(voicePath('duress')).toBe('/audio/alert-help.mp3');
  });
  it('builds two family buttons that fit Telegram callback limits', () => {
    const id = '123e4567-e89b-12d3-a456-426614174000';
    const buttons = familyButtons(id);
    expect(buttons.map((b) => b.data)).toEqual([`going:${id}`, `ok:${id}`]);
    for (const b of buttons) expect(Buffer.byteLength(b.data)).toBeLessThanOrEqual(64);
  });
  it('subject differs for tests', () => {
    expect(alertSubject('Ayesha', 'test')).toContain('Test');
    expect(alertSubject('Ayesha', 'sos')).toContain('Ayesha');
  });
  it('invite text contains the link', () => {
    expect(inviteShareText('Ayesha', 'https://t.me/Bot?start=x')).toContain('https://t.me/Bot?start=x');
  });
});
