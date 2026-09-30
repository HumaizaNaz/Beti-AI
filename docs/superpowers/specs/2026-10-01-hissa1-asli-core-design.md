# Hissa 1 — Asli Core: Design Spec

- **Tareekh:** 2026-10-01
- **Status:** Review ke liye (approve hone ke baad implementation plan banega)
- **Tareeqa:** 1 — Hybrid Free MVP

---

## 1. Maqsad

Beti AI ko pitch demo se **asli chalne wali safety app** banana jo Pakistan mein aam public istemal kar sake.

**Kamyabi ka matlab:** jab koi beti musibat mein ho — chahe phone chheen liya jaye, toot jaye ya battery khatam ho jaye — family tak alert **har haal mein** pohanche, location ke saath.

**Faislay jo user ne kiye:**
- Target: public launch (hackathon nahi). Baad mein clients, investors, Pakistan govt aur international safety programs ko pitch.
- Budget: jitna ho sake **free**. Hissa 1 mein koi paid service nahi.
- App **bina parhe** istemal ho sake (bohat se users parhe likhe nahi).
- Phone chori hone ki soorat ka hal zaroori hai.

**Ghair-maqsad (Hissa 1 mein nahi):**
- WhatsApp alerts → Hissa 2 (OpenClaw)
- "Kya aap theek hain?" check-in, secret phrase ki awaaz se detection, audio recording → Hissa 3
- PWA install, privacy policy ka final legal text, pitch deck update → Hissa 4
- Screen band hone par background GPS / hands-free awaaz → Hissa 5 (Android app)
- SMS gateway (paid)

---

## 2. Free services

| Service | Kaam | Note |
|---|---|---|
| Vercel (Hobby) | Next.js hosting | Free plan non-commercial hai; tijarati istemal par Pro ya Cloudflare/Netlify |
| Supabase (Free) | Postgres, Auth (Google + Email), Storage (photos), `pg_cron` + `pg_net` (timer) | 7 din ghair-faal rahe to pause; roz ki activity + uptime monitor |
| Telegram Bot API | Family alerts (voice, location pin, photo, buttons) | Poora free |
| Gmail SMTP (App Password) | Email alerts | Free, roz ki limit kaafi |
| UptimeRobot (Free) | `/api/status` monitor, admin ko email | Free |

Hata diye gaye: Upstash QStash (→ `pg_cron`), Resend (apne domain ke baghair family ko email nahi bhej sakta → Gmail SMTP).

**User ko banana hoga:** Supabase account, Telegram bot (BotFather se token), Gmail App Password, UptimeRobot account.

---

## 3. Architecture

```
 👩 User (phone browser)                         👨‍👩‍👧 Family
   │ Login → Trip shuru → GPS har ~20s             ▲ Telegram + Email
   ▼                                               │ + live tracking link
 ┌──────────── Next.js (Vercel) ──────────────┐    │
 │  /app/*         user screens               │    │
 │  /help          kisi bhi phone se          │    │
 │  /t/[token]     family ka live map         │    │
 │  /api/trips, /api/trips/[id]/location      │    │
 │  /api/trips/[id]/finish  (PIN)             │    │
 │  /api/sos, /api/help                       │────┘
 │  /api/cron/deadlines  ◄── pg_cron (1/min)  │
 │  /api/telegram/webhook ◄── Telegram        │
 └──────────────┬─────────────────────────────┘
                ▼
        Supabase (Postgres + Auth + Storage)
```

### 3.1 Units (har ek ka ek kaam)

| Unit | Kaam | Depend karta hai |
|---|---|---|
| `lib/db` | Supabase clients (browser: anon key; server: service key) | Supabase |
| `lib/pin` | PIN hash/verify, duress check, ghalat koshishon ki ginti | bcryptjs, db |
| `lib/trips` | Trip banana, location save, finish, extend; **atomic** status change | db |
| `lib/alerts` | Alert banana + har channel par bhejna + retry + log | channels, db |
| `lib/channels/telegram` | sendVoice, sendLocation, sendPhoto, message + buttons | Telegram API |
| `lib/channels/email` | Email bhejna | nodemailer (Gmail SMTP) |
| `lib/messages` | Alert ka text/voice chunna (Urdu + English) | — |
| API routes | Auth check → sahi unit call | units |

Mojooda `src/agents/*` ka structure naam ke taur par barqarar rahega (Trip, Watchdog, Dispatcher), lekin memory wala `stateStore` aur `console.log` broadcast hat kar upar wale units aayenge. Demo pages (`/`, `/deck`, `/voice`, `/tracker`) waise hi rahenge; `/calculator` ka `9999=` asli SOS bhejega.

### 3.2 Database

| Table | Columns (ahem) |
|---|---|
| `profiles` | `id` (auth user), `name`, `phone`, `photo_path`, `safe_pin_hash`, `duress_pin_hash`, `failed_pin_count`, `pin_locked_until`, `lang` |
| `contacts` | `id`, `user_id`, `name`, `relation`, `phone`, `email`, `telegram_chat_id`, `invite_token`, `status` (`pending`/`connected`/`blocked`) |
| `trips` | `id`, `user_id`, `vehicle_photo_path`, `duration_min`, `started_at`, `deadline_at`, `status` (`active`/`safe`/`alerted`), `share_token`, `share_expires_at` |
| `locations` | `id`, `trip_id`, `lat`, `lng`, `accuracy_m`, `recorded_at` |
| `alerts` | `id`, `user_id`, `trip_id`, `reason` (`timer`/`sos`/`duress`/`wrong_pin`/`help_page`/`calculator`/`test`), `created_at`, `resolved_at`, `resolved_by` |
| `alert_deliveries` | `id`, `alert_id`, `contact_id`, `channel` (`telegram`/`email`), `status` (`pending`/`sent`/`failed`), `attempts`, `last_error` |

RLS: har user sirf apni rows dekhe. Server routes service key use karte hain; service key kabhi browser mein nahi.

### 3.3 Dead-Man's Switch

1. Trip shuru → `deadline_at = now + duration`.
2. Supabase `pg_cron` har minute `pg_net` se `POST /api/cron/deadlines` (secret header ke saath).
3. Route: `UPDATE trips SET status='alerted' WHERE status='active' AND deadline_at < now() RETURNING *` — **atomic**, is liye har trip ka alert sirf ek dafa.
4. Har returned trip ke liye alert bhejo. Isi route mein `failed`/`pending` deliveries ka retry bhi (max 3 attempts per delivery total).

"Pohanch gayi" bhi atomic: `UPDATE … SET status='safe' WHERE id=? AND status='active'`. Agar trip pehle hi `alerted` thi → family ko "Ghalat alarm tha, woh theek hai" follow-up.

### 3.4 Family ko Telegram se jorna

Contact add → `invite_token` → link `t.me/<bot>?start=<token>` → "WhatsApp par bhejo" button (`wa.me/?text=` share). Family Start dabaye → webhook token match kare → `telegram_chat_id` save, `status=connected` → bot Urdu voice + text mein welcome.

---

## 4. Screens aur flow ("bina parhe" usool)

**Usool:** har screen par ek bara kaam; icons + rang (🟢 safe, 🔴 madad); har button par 🔊 (pehle se record Urdu audio); default Urdu (Nastaliq), English toggle.

### 4.1 Setup — Madadgar mode (ek dafa)
1. Google/Email login
2. Naam + photo (optional)
3. Safe PIN (2 dafa) + Duress PIN (alag hona zaroori)
4. Contacts: naam, rishte ka icon, phone, email (optional) → invite link WhatsApp se share → ✅ jab connect ho
5. 🧪 Test alert — family confirm kare

### 4.2 Home (`/app`)
- 🚗 **Safar shuru** (bara)
- 🔴 **MADAD** (bara)
- 👨‍👩‍👧 contacts ka status (✅ / ⚠️ rabta toot gaya)
- ⚙️ settings — PIN ke baghair nahi khulti

### 4.3 Trip shuru
- 📷 gaadi / number plate ki photo (skip ho sakti hai)
- ⏱️ [10] [20] [30] [60] min
- ▶ Shuru → location ijazat (awaaz se samjhaya jaye)

### 4.4 Trip jari
- Bara countdown, 📍 GPS status, 👨‍👩‍👧 contacts status
- GPS har ~20s bheji jaye; net na ho to phone mein jama, baad mein bhejo
- Screen Wake Lock (support ho to)
- 🟢 **Pohanch gayi** → PIN pad
- 🔴 **MADAD** → foran alert, koi PIN nahi
- **+10 min** → PIN zaroori

### 4.5 PIN pad
- Bare numbers + awaaz
- Sahi safe PIN → trip `safe` → family ko "✅ pohanch gayi"
- Duress PIN → screen par ✅ safe, chupke se alert (`duress`)
- 3 ghalat → alert (`wrong_pin`), aur 15 min lock

### 4.6 `/help` — kisi bhi phone se
- Phone number + PIN
- 🔴 **Madad chahiye** → alert (`help_page`)
- ✅ **Main theek hoon, sirf phone gaya** + "is number par rabta" → family ko message; active trip ho to `safe`
- 3 ghalat → 15 min lock (phone number ke hisaab se)

### 4.7 Family alert (Telegram)
Order: 🔊 voice note → 📍 location pin → 📷 photo (agar ho) → text (naam, wajah, waqt, live link `/t/<token>`) + buttons **🏃 Main ja raha hoon** / **✅ Sab theek hai**. Button dabane par baaqi sab contacts ko update. Email mein yahi text, Google Maps link aur photo link.

### 4.8 Live map (`/t/[token]`)
Bina login, sirf token se; har ~20s refresh; trip khatam hone ke 24 ghante baad expire.

---

## 5. Jab kuch fail ho

| Soorat | Rawaiya |
|---|---|
| Net nahi + 🔴 Madad | `sms:` link — contacts ke number + aakhri location pehle se likhe (phone mein cached); 📞 15 call button |
| Trip ke dauran net gaya | Server timer chalta rahe; GPS phone mein jama; ⚠️ + awaaz |
| Net nahi + Pohanch gayi | SMS app "Main pohanch gayi ✅" ke saath; net aate hi server update; alert ja chuka ho to follow-up |
| GPS nahi | Trip chale; alert mein "location nahi mili" / aakhri location |
| Ek channel fail | Doosra phir bhi; har delivery 3 attempts; cron retry |
| Sab channels fail | Screen par laal: "Alert nahi gaya — 15 call karein" |
| Double alert | Atomic status update se naamumkin |
| Bot block | Contact `blocked`, home par ⚠️ |
| Supabase/Server down | UptimeRobot admin ko email |

---

## 6. Security aur privacy

- PIN: bcrypt hash; 4 hindse; 3 ghalat → alert + 15 min lock.
- Supabase RLS; service key sirf server par (Vercel env).
- `share_token`: kam az kam 128-bit random; 24 ghante baad expire.
- Photos: private Storage bucket, signed URLs (alert ke waqt 7 din wala link).
- Retention: normal trips ki locations 30 din baad delete; alert wali trips 90 din (`pg_cron` job).
- Location sirf trip ke dauran.
- Webhooks: Telegram `secret_token` header; cron route alag secret header.
- Setup mein ijazat screen (Urdu + awaaz): kya data, kyun, kitni der.

---

## 7. Testing

1. **Unit (Vitest):** `lib/pin` (safe/duress/lock), trip status transitions, double-alert guard, `lib/messages`.
2. **API tests:** har route; Telegram/email mock.
3. **Fire drill (asli):** 1 min trip → kuch na dabao → asli Telegram + email par voice, pin, photo aaye. Phir duress PIN, 3 ghalat PIN, `/help` dono buttons, net band karke SMS fallback, family button updates.
4. **Launch checklist:** sasta Android + Chrome par har flow 3 dafa.
5. **In-app 🧪 Test alert** — user khud kabhi bhi check kare.

---

## 8. Khule sawal (implementation se pehle)

- Urdu voice clips kaun record karega? (Default: shuru mein TTS se bana kar files mein rakhein, baad mein insani awaaz se badlein.)
- Bot ka naam / username (jaise `@BetiAIGuardianBot`) — user BotFather mein banayega.
