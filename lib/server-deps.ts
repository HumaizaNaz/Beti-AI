// lib/server-deps.ts
import { createEmail } from '@/lib/channels/email';
import { createTelegram } from '@/lib/channels/telegram';
import type { Deps } from '@/lib/deps';
import { serverEnv } from '@/lib/env';
import { createSupabaseRepo } from '@/lib/repo/supabase';
import { createSupabaseAdmin } from '@/lib/supabase/admin';

const PHOTO_LINK_SECONDS = 7 * 24 * 60 * 60;
let cached: Deps | null = null;

export function getDeps(): Deps {
  if (cached) return cached;
  const env = serverEnv();
  const admin = createSupabaseAdmin();
  cached = {
    repo: createSupabaseRepo(admin),
    telegram: createTelegram(env.telegramToken),
    email: createEmail(env.gmailUser, env.gmailAppPassword),
    appUrl: env.appUrl,
    botUsername: env.telegramBotUsername,
    now: () => new Date(),
    photoUrl: async (path) => {
      const { data } = await admin.storage.from('vehicle-photos').createSignedUrl(path, PHOTO_LINK_SECONDS);
      return data?.signedUrl ?? null;
    },
  };
  return cached;
}
