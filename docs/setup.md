# Beti AI — Free Accounts Setup

Everything here is free. Do these once, then copy `.env.example` to `.env.local` and fill it in.

Generate random secrets with:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## 1. Supabase (database, login, photo storage, timer)
1. Sign up at https://supabase.com → **New project**. Region: nearest to Pakistan (e.g. Mumbai / Singapore).
2. **Project Settings → API**: copy the Project URL, the anon (publishable) key, and the `service_role` key into `.env.local`.
3. **SQL Editor**: paste and run `supabase/migrations/0001_init.sql`.
4. **Authentication → Providers → Google**: enable. Create an OAuth client in Google Cloud Console (APIs & Services → Credentials → OAuth client ID → Web application). Authorised redirect URI: the callback URL Supabase shows on that page. Paste client ID and secret back into Supabase.
5. **Authentication → URL Configuration**: Site URL = your app URL; add Redirect URLs `http://localhost:3000/auth/callback` and `https://YOUR-APP.vercel.app/auth/callback`.
6. Note: a free project pauses after 7 days with no activity. The UptimeRobot check in `docs/deploy.md` keeps it active.

## 2. Telegram bot (family alerts)
1. In Telegram, open **@BotFather** → `/newbot` → choose a name (e.g. *Beti AI*) and a username ending in `bot` (e.g. `BetiAIGuardianBot`).
2. Copy the token into `TELEGRAM_BOT_TOKEN` and the username (without `@`) into `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME`.

## 3. Gmail (email alerts)
1. Google Account → **Security** → turn on **2-Step Verification**.
2. Google Account → **Security → App passwords** → create one named *Beti AI*.
3. Put your Gmail address in `GMAIL_USER` and the 16-letter password (no spaces) in `GMAIL_APP_PASSWORD`.

## 4. Python (one-time, for Urdu voice clips)
Only needed to regenerate `public/audio/*.mp3`: `pip install edge-tts`, then `python scripts/make-audio.py`.
