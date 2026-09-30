import { afterEach, describe, expect, it } from 'vitest';
import { serverEnv } from '@/lib/env';

const KEYS = [
  'NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'TELEGRAM_BOT_TOKEN',
  'NEXT_PUBLIC_TELEGRAM_BOT_USERNAME', 'TELEGRAM_WEBHOOK_SECRET', 'CRON_SECRET',
  'GMAIL_USER', 'GMAIL_APP_PASSWORD', 'NEXT_PUBLIC_APP_URL',
];
const saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));

afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

describe('serverEnv', () => {
  it('names the missing variable', () => {
    for (const k of KEYS) process.env[k] = 'x';
    delete process.env.CRON_SECRET;
    expect(() => serverEnv()).toThrow('Missing environment variable: CRON_SECRET');
  });

  it('returns all values when present', () => {
    for (const k of KEYS) process.env[k] = `v-${k}`;
    const env = serverEnv();
    expect(env.cronSecret).toBe('v-CRON_SECRET');
    expect(env.appUrl).toBe('v-NEXT_PUBLIC_APP_URL');
    expect(env.telegramBotUsername).toBe('v-NEXT_PUBLIC_TELEGRAM_BOT_USERNAME');
  });
});
