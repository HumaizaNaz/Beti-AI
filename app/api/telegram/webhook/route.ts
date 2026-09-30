import { json } from '@/lib/api';
import { serverEnv } from '@/lib/env';
import { safeEqual } from '@/lib/secret';
import { getDeps } from '@/lib/server-deps';
import { handleTelegramUpdate } from '@/lib/telegram-webhook';

export async function POST(req: Request) {
  if (!safeEqual(req.headers.get('x-telegram-bot-api-secret-token'), serverEnv().telegramWebhookSecret)) {
    return json({ error: 'unauthorized' }, 401);
  }
  try {
    await handleTelegramUpdate(getDeps(), await req.json().catch(() => null));
  } catch (err) {
    console.error('telegram update failed', err);
  }
  return json({ ok: true });
}
