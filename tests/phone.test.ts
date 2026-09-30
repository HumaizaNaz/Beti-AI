import { describe, expect, it } from 'vitest';
import { normalizePkPhone } from '@/lib/phone';

describe('normalizePkPhone', () => {
  it.each([
    ['03001234567', '+923001234567'],
    ['0300-1234567', '+923001234567'],
    ['+92 300 1234567', '+923001234567'],
    ['923001234567', '+923001234567'],
    ['00923001234567', '+923001234567'],
    ['3001234567', '+923001234567'],
  ])('normalises %s', (input, expected) => {
    expect(normalizePkPhone(input)).toBe(expected);
  });

  it.each(['', 'abc', '12345', '0300123456', '+14155550000', '030012345678'])('rejects %s', (input) => {
    expect(normalizePkPhone(input)).toBeNull();
  });
});
