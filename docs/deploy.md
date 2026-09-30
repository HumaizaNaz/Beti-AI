# Beti AI — Deploy (free)

Prerequisite: every account in `docs/setup.md` exists and `.env.local` works locally.

## 1. Vercel
1. https://vercel.com → sign in with GitHub → **Add New → Project** → import `HumaizaNaz/Beti-AI`.
2. **Environment Variables**: add every variable from `.env.example` with real values. Set `NEXT_PUBLIC_APP_URL` to the Vercel URL, e.g. `https://beti-ai.vercel.app`.
3. **Deploy**. Every push to `main` redeploys automatically.
4. Note: the free Hobby plan is for non-commercial use. When the project starts charging clients, move to Vercel Pro or a free Cloudflare/Netlify plan.

## 2. Supabase URLs
Authentication → URL Configuration: Site URL = the Vercel URL; Redirect URLs include `https://<your-app>.vercel.app/auth/callback`.

## 3. Telegram webhook
```bash
node --env-file=.env.production.local scripts/set-telegram-webhook.mjs
```
(Create `.env.production.local` with the production values — it is git-ignored.) Expected output: `{ ok: true, result: true, description: 'Webhook was set' }`.

## 4. Timer (pg_cron)
Open `supabase/setup-cron.sql`, replace the URL and secret, run it in the SQL editor. Then check `select * from cron.job_run_details order by start_time desc limit 5;` shows `succeeded` every minute.

## 5. Uptime monitor
https://uptimerobot.com → **New monitor** → HTTP(s) → URL `https://<your-app>.vercel.app/api/health` → every 5 minutes → alert contact: your email. This also keeps the free Supabase project from pausing.

## 6. Fire drill
Run every item in `docs/fire-drill.md` before telling anyone to rely on the app.

## Local development note (Windows)
Start `npm run dev` from PowerShell or a normal terminal. Launched from a Git Bash background job, Turbopack's CSS worker can fail with `0xc0000142`. Pages under `/app` need `.env.local` filled in, because `proxy.ts` talks to Supabase.
