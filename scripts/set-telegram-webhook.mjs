// Usage: node --env-file=.env.local scripts/set-telegram-webhook.mjs
// Points the bot at <NEXT_PUBLIC_APP_URL>/api/telegram/webhook. The URL must be public HTTPS (the deployed app).
const { TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET, NEXT_PUBLIC_APP_URL } = process.env;
if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_WEBHOOK_SECRET || !NEXT_PUBLIC_APP_URL) {
  console.error('Set TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET and NEXT_PUBLIC_APP_URL first.');
  process.exit(1);
}
const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    url: `${NEXT_PUBLIC_APP_URL}/api/telegram/webhook`,
    secret_token: TELEGRAM_WEBHOOK_SECRET,
    allowed_updates: ['message', 'callback_query', 'my_chat_member'],
  }),
});
console.log(await res.json());
