import { describe, expect, it } from 'vitest';
import { createRateLimiter } from '@/lib/rate-limit';

describe('createRateLimiter', () => {
  it('allows `limit` hits per window per key, then refuses until the window passes', () => {
    const allow = createRateLimiter(3, 60_000);
    expect([allow('ip', 0), allow('ip', 1), allow('ip', 2), allow('ip', 3)]).toEqual([true, true, true, false]);
    expect(allow('other-ip', 3)).toBe(true);
    expect(allow('ip', 60_001)).toBe(true);
  });
});
