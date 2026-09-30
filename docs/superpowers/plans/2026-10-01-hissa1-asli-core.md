# Hissa 1 — Asli Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the Beti AI demo into a working safety app: real login, family contacts linked over Telegram, a server-side Dead-Man's Switch, real GPS, and real Telegram + email alerts, with a "no reading needed" Urdu-first UI.

**Architecture:** Pure domain logic lives in `lib/` (PIN, trips, alerts, help, account) and talks to storage through a `Repo` interface and to the outside world through `TelegramApi` / `EmailApi` interfaces, bundled in a `Deps` object. Tests run that logic against an in-memory repo and fake channels. Next.js route handlers are thin wrappers that authenticate, parse input, call `lib/`, and return JSON. Supabase provides Postgres, Auth and Storage; Supabase `pg_cron` calls `/api/cron/deadlines` every minute.

**Tech Stack:** Next.js 16.3 (App Router, `proxy.ts`), React 19, TypeScript, Tailwind 3, Supabase (`@supabase/supabase-js`, `@supabase/ssr`), `bcryptjs`, `nodemailer` (Gmail SMTP), Telegram Bot API, Leaflet + OpenStreetMap tiles, Vitest, `edge-tts` (Python, audio generation only).

**Spec:** `docs/superpowers/specs/2026-10-01-hissa1-asli-core-design.md`

## Global Constraints

- Free services only: Vercel Hobby, Supabase Free, Telegram Bot API, Gmail SMTP, UptimeRobot Free. No paid SDKs, no SMS gateway.
- Next.js 16 conventions: `proxy.ts` (not `middleware.ts`); route handler `params` is a `Promise` and must be awaited; `cookies()` is async. Read `node_modules/next/dist/docs/` before using any other Next API.
- PIN is exactly 4 digits. Safe PIN and duress PIN must differ. PINs are stored only as bcrypt hashes and are never written to `localStorage`.
- 3 wrong PINs in a row → `wrong_pin` alert + 15-minute lock (same counter for the app and `/help`).
- Trip durations: 10, 20, 30, 60 minutes. Extend adds 10 minutes and needs the PIN. 🔴 Madad never needs a PIN.
- GPS is sent about every 20 s, only during a trip. Max 100 points per request.
- Live link token is at least 128-bit random; it expires 24 hours after the trip ends.
- Each alert delivery gets at most 3 attempts in total.
- Retention: locations of normal trips deleted after 30 days, of trips that had an alert after 90 days.
- The Supabase service-role key is used only on the server. All six tables have RLS enabled with no policies (server-only access).
- The duress PIN must produce a response identical to the safe PIN.
- Default UI language is Urdu (Nastaliq, RTL) with an English toggle; every main button has a 🔊 audio hint.
- Demo pages (`/`, `/deck`, `/voice`, `/tracker`) and the old demo engine in `src/` stay working and untouched except where a task says otherwise. New code goes in `lib/`, `components/beti/`, `app/app/`, `app/help/`, `app/t/`, `app/login/`, `app/auth/`, and new `app/api/*` routes.
- Every commit message ends with the line `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Odd PIN input** (letters, spaces, 3 or 5 digits) → counted as a wrong attempt, never a 500. Test: Task 2.
2. **Garbage GPS payloads** (NaN, strings, out-of-range values, 500 points, future timestamps) → dropped, capped at 100, or clamped; the request still succeeds. Test: Task 6.
3. **Phone typed in any Pakistani format** (`0300-1234567`, `+92 300 1234567`, `923001234567`) → matches the same user; junk gives `wrong`, not an error. Tests: Task 2 and Task 6.
4. **Nobody reachable** (no connected contact, no email) → `raiseAlert` reports `sent: 0`, and the UI shows the red "Alert nahi gaya — 15 call karein" screen. Tests: Task 5 (logic); the UI mapping lives in `useSos` (Task 10) and is checked in the Task 12 behaviour check and the fire drill (Task 14).
5. **Timer expiry and "Pohanch gayi" in the same minute** → exactly one alert, then a "ghalat alarm" follow-up; and if the timer alert itself crashes, the trip goes back to `active` so the next cron run retries. Tests: Task 6.

---

## File Structure

```
lib/
  env.ts                 server env reader
  types.ts               domain types
  phone.ts               Pakistani phone normalisation
  pin.ts                 PIN hashing + evaluation (pure)
  time.ts                addMinutes, shareExpiry
  token.ts               randomToken (128-bit)
  deps.ts                Deps interface
  repo/types.ts          Repo interface
  repo/memory.ts         in-memory Repo (tests)
  repo/supabase.ts       Supabase Repo
  channels/telegram.ts   TelegramApi (fetch)
  channels/email.ts      EmailApi (nodemailer)
  messages.ts            alert / notice texts (Urdu + English)
  alerts.ts              raiseAlert, retryDeliveries, notifyContacts, resolveFromFamily
  guard.ts               verifyPin (PIN + duress/wrong-pin side effects)
  trips.ts               start, locations, finish, extend, sos, expire, live view
  help.ts                /help logic
  account.ts             profile setup, contacts, overview, test alert
  telegram-webhook.ts    Telegram update handling
  secret.ts              constant-time compare
  api.ts                 route helpers (json, readJson, withUser, errorResponse)
  auth.ts                currentUserId (Supabase session)
  server-deps.ts         getDeps() — real Deps from env
  supabase/server.ts | browser.ts | admin.ts
  i18n.ts  audio.ts  relations.ts
  client/api.ts  client/offline.ts  client/geo.ts  client/errors.ts  client/image.ts  client/leaflet.ts
components/beti/
  Shell.tsx  BigButton.tsx  AudioHint.tsx  PinPad.tsx  SosPanel.tsx  useSos.ts  ContactsManager.tsx  LiveMap.tsx
app/
  login/ auth/callback/ app/ (home, setup, settings, trip/new, trip/[id]) help/ t/[token]/
  api/ me, profile, pin/check, contacts, contacts/[id], alerts/test, trips, trips/[id]/{location,finish,extend},
       sos, help, cron/deadlines, t/[token], telegram/webhook, health
proxy.ts
supabase/migrations/0001_init.sql   supabase/setup-cron.sql
scripts/make-audio.py   scripts/set-telegram-webhook.mjs
public/audio/*.mp3
tests/ *.test.ts   tests/helpers/fakes.ts
docs/setup.md   docs/deploy.md   docs/fire-drill.md
```

---

### Task 1: Tooling, env, domain types, account setup guide

**Files:**
- Modify: `package.json` (scripts, deps)
- Create: `vitest.config.ts`, `lib/env.ts`, `lib/types.ts`, `.env.example`, `docs/setup.md`
- Test: `tests/env.test.ts`

**Interfaces:**
- Produces: `serverEnv(): ServerEnv` (throws `Missing environment variable: NAME`); all domain types in `lib/types.ts` (`Lang`, `AlertReason`, `TripStatus`, `ContactStatus`, `Channel`, `DeliveryStatus`, `Relation`, `PinState`, `Profile`, `Contact`, `Trip`, `LocationPoint`, `Alert`, `Delivery`).

- [ ] **Step 1: Install dependencies**

Run:
```bash
npm install @supabase/supabase-js@^2.117.2 @supabase/ssr@^0.12.7 bcryptjs@^3.0.3 nodemailer@^10.0.13
npm install -D vitest@^5.0.3 @types/nodemailer@^8.0.2
```
Expected: installs without errors.

- [ ] **Step 2: Add test scripts to `package.json`**

In `"scripts"` add:
```json
    "test": "vitest run",
    "test:watch": "vitest",
```

- [ ] **Step 3: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('.', import.meta.url)) } },
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
});
```

- [ ] **Step 4: Write the failing test `tests/env.test.ts`**

```ts
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
```

- [ ] **Step 5: Run it — expect FAIL** (`Cannot find module '@/lib/env'`)

Run: `npm test -- tests/env.test.ts`

- [ ] **Step 6: Create `lib/env.ts`**

```ts
function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

export interface ServerEnv {
  supabaseUrl: string;
  supabaseServiceKey: string;
  telegramToken: string;
  telegramBotUsername: string;
  telegramWebhookSecret: string;
  cronSecret: string;
  gmailUser: string;
  gmailAppPassword: string;
  appUrl: string;
}

export function serverEnv(): ServerEnv {
  return {
    supabaseUrl: required('NEXT_PUBLIC_SUPABASE_URL'),
    supabaseServiceKey: required('SUPABASE_SERVICE_ROLE_KEY'),
    telegramToken: required('TELEGRAM_BOT_TOKEN'),
    telegramBotUsername: required('NEXT_PUBLIC_TELEGRAM_BOT_USERNAME'),
    telegramWebhookSecret: required('TELEGRAM_WEBHOOK_SECRET'),
    cronSecret: required('CRON_SECRET'),
    gmailUser: required('GMAIL_USER'),
    gmailAppPassword: required('GMAIL_APP_PASSWORD'),
    appUrl: required('NEXT_PUBLIC_APP_URL'),
  };
}
```

- [ ] **Step 7: Create `lib/types.ts`**

```ts
export type Lang = 'ur' | 'en';
export type AlertReason = 'timer' | 'sos' | 'duress' | 'wrong_pin' | 'help_page' | 'calculator' | 'test';
export type TripStatus = 'active' | 'safe' | 'alerted';
export type ContactStatus = 'pending' | 'connected' | 'blocked';
export type Channel = 'telegram' | 'email';
export type DeliveryStatus = 'pending' | 'sent' | 'failed';
export type Relation = 'mother' | 'father' | 'brother' | 'sister' | 'husband' | 'friend' | 'other';

export interface PinState {
  failedPinCount: number;
  pinLockedUntil: string | null;
}

export interface Profile extends PinState {
  id: string;
  name: string;
  phone: string;
  safePinHash: string | null;
  duressPinHash: string | null;
  lang: Lang;
}

export interface Contact {
  id: string;
  userId: string;
  name: string;
  relation: Relation;
  phone: string | null;
  email: string | null;
  telegramChatId: string | null;
  inviteToken: string;
  status: ContactStatus;
}

export interface Trip {
  id: string;
  userId: string;
  vehiclePhotoPath: string | null;
  durationMin: number;
  startedAt: string;
  deadlineAt: string;
  status: TripStatus;
  shareToken: string;
  shareExpiresAt: string | null;
}

export interface LocationPoint {
  lat: number;
  lng: number;
  accuracyM: number | null;
  recordedAt: string;
}

export interface Alert {
  id: string;
  userId: string;
  tripId: string | null;
  reason: AlertReason;
  lat: number | null;
  lng: number | null;
  photoPath: string | null;
  createdAt: string;
  resolvedAt: string | null;
  resolvedBy: string | null;
}

export interface Delivery {
  id: string;
  alertId: string;
  contactId: string;
  channel: Channel;
  status: DeliveryStatus;
  attempts: number;
  lastError: string | null;
}
```

- [ ] **Step 8: Run the test — expect PASS**

Run: `npm test -- tests/env.test.ts`

- [ ] **Step 9: Create `.env.example`**

```bash
# Supabase (Project Settings → API)
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-or-publishable-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Telegram (BotFather)
TELEGRAM_BOT_TOKEN=123456:ABC...
NEXT_PUBLIC_TELEGRAM_BOT_USERNAME=BetiAIGuardianBot
TELEGRAM_WEBHOOK_SECRET=generate-a-long-random-string

# Cron (same value goes into supabase/setup-cron.sql)
CRON_SECRET=generate-a-long-random-string

# Gmail SMTP (Google Account → Security → App passwords)
GMAIL_USER=you@gmail.com
GMAIL_APP_PASSWORD=abcdabcdabcdabcd

# Public URL of the app (no trailing slash)
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

- [ ] **Step 10: Create `docs/setup.md`** (the free accounts the owner must create)

````markdown
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
````

- [ ] **Step 11: Commit**

```bash
git add package.json package-lock.json vitest.config.ts lib/env.ts lib/types.ts .env.example docs/setup.md tests/env.test.ts
git commit -m "chore: add vitest, env reader, domain types and setup guide" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Phone numbers and PIN logic

**Files:**
- Create: `lib/phone.ts`, `lib/pin.ts`
- Test: `tests/phone.test.ts`, `tests/pin.test.ts`

**Interfaces:**
- Consumes: `Profile`, `PinState` from `lib/types.ts`.
- Produces:
  - `normalizePkPhone(input: string): string | null` → `'+92XXXXXXXXXX'` or `null`
  - `MAX_WRONG_PINS = 3`, `LOCK_MINUTES = 15`
  - `isValidPin(pin: unknown): pin is string`
  - `hashPin(pin: string): Promise<string>` (throws if not 4 digits)
  - `type PinOutcome = 'safe' | 'duress' | 'wrong' | 'wrong_alert' | 'locked'`
  - `evaluatePin(profile: Pick<Profile,'safePinHash'|'duressPinHash'> & PinState, pin: string, now: Date): Promise<{ outcome: PinOutcome; next: PinState }>` — pure; caller persists `next`.

- [ ] **Step 1: Write failing `tests/phone.test.ts`**

```ts
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
```

- [ ] **Step 2: Write failing `tests/pin.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { evaluatePin, hashPin, isValidPin, LOCK_MINUTES } from '@/lib/pin';

const now = new Date('2026-10-01T10:00:00.000Z');

async function profile(overrides: Partial<{ failedPinCount: number; pinLockedUntil: string | null }> = {}) {
  return {
    safePinHash: await hashPin('1234'),
    duressPinHash: await hashPin('9999'),
    failedPinCount: 0,
    pinLockedUntil: null,
    ...overrides,
  };
}

describe('isValidPin / hashPin', () => {
  it('accepts exactly four digits', () => {
    expect(isValidPin('0420')).toBe(true);
    for (const bad of ['123', '12345', '12a4', ' 1234', '', 1234, null]) expect(isValidPin(bad)).toBe(false);
  });
  it('refuses to hash an invalid PIN', async () => {
    await expect(hashPin('12')).rejects.toThrow('PIN must be exactly 4 digits');
  });
});

describe('evaluatePin', () => {
  it('safe PIN resets the counter', async () => {
    const r = await evaluatePin(await profile({ failedPinCount: 2 }), '1234', now);
    expect(r).toEqual({ outcome: 'safe', next: { failedPinCount: 0, pinLockedUntil: null } });
  });

  it('duress PIN is recognised and resets the counter', async () => {
    const r = await evaluatePin(await profile({ failedPinCount: 1 }), '9999', now);
    expect(r).toEqual({ outcome: 'duress', next: { failedPinCount: 0, pinLockedUntil: null } });
  });

  it('wrong PIN increments the counter', async () => {
    const r = await evaluatePin(await profile(), '0000', now);
    expect(r).toEqual({ outcome: 'wrong', next: { failedPinCount: 1, pinLockedUntil: null } });
  });

  it('malformed input counts as a wrong attempt', async () => {
    for (const bad of ['12a4', ' 123', '12345', '']) {
      const r = await evaluatePin(await profile(), bad, now);
      expect(r.outcome).toBe('wrong');
      expect(r.next.failedPinCount).toBe(1);
    }
  });

  it('third wrong PIN raises wrong_alert and locks for 15 minutes', async () => {
    const r = await evaluatePin(await profile({ failedPinCount: 2 }), '0000', now);
    expect(r.outcome).toBe('wrong_alert');
    expect(r.next.failedPinCount).toBe(0);
    expect(r.next.pinLockedUntil).toBe(new Date(now.getTime() + LOCK_MINUTES * 60_000).toISOString());
  });

  it('while locked even the right PIN is refused', async () => {
    const lockedUntil = new Date(now.getTime() + 5 * 60_000).toISOString();
    const p = await profile({ pinLockedUntil: lockedUntil });
    const r = await evaluatePin(p, '1234', now);
    expect(r).toEqual({ outcome: 'locked', next: { failedPinCount: 0, pinLockedUntil: lockedUntil } });
  });

  it('an expired lock no longer blocks', async () => {
    const r = await evaluatePin(await profile({ pinLockedUntil: '2026-10-01T09:00:00.000Z' }), '1234', now);
    expect(r.outcome).toBe('safe');
  });
});
```

- [ ] **Step 3: Run both — expect FAIL** (modules missing)

Run: `npm test -- tests/phone.test.ts tests/pin.test.ts`

- [ ] **Step 4: Create `lib/phone.ts`**

```ts
/** Normalises Pakistani mobile numbers to +92XXXXXXXXXX. Returns null for anything else. */
export function normalizePkPhone(input: string): string | null {
  let d = input.replace(/[^\d]/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('0')) d = '92' + d.slice(1);
  else if (/^3\d{9}$/.test(d)) d = '92' + d;
  if (!/^923\d{9}$/.test(d)) return null;
  return '+' + d;
}
```

- [ ] **Step 5: Create `lib/pin.ts`**

```ts
import bcrypt from 'bcryptjs';
import type { PinState, Profile } from '@/lib/types';

export const MAX_WRONG_PINS = 3;
export const LOCK_MINUTES = 15;

export type PinOutcome = 'safe' | 'duress' | 'wrong' | 'wrong_alert' | 'locked';

export function isValidPin(pin: unknown): pin is string {
  return typeof pin === 'string' && /^\d{4}$/.test(pin);
}

export async function hashPin(pin: string): Promise<string> {
  if (!isValidPin(pin)) throw new Error('PIN must be exactly 4 digits');
  return bcrypt.hash(pin, 10);
}

export async function evaluatePin(
  profile: Pick<Profile, 'safePinHash' | 'duressPinHash'> & PinState,
  pin: string,
  now: Date,
): Promise<{ outcome: PinOutcome; next: PinState }> {
  const current: PinState = { failedPinCount: profile.failedPinCount, pinLockedUntil: profile.pinLockedUntil };
  if (profile.pinLockedUntil && new Date(profile.pinLockedUntil) > now) {
    return { outcome: 'locked', next: current };
  }
  const cleared: PinState = { failedPinCount: 0, pinLockedUntil: null };
  if (isValidPin(pin)) {
    if (profile.safePinHash && (await bcrypt.compare(pin, profile.safePinHash))) return { outcome: 'safe', next: cleared };
    if (profile.duressPinHash && (await bcrypt.compare(pin, profile.duressPinHash))) return { outcome: 'duress', next: cleared };
  }
  const failed = profile.failedPinCount + 1;
  if (failed >= MAX_WRONG_PINS) {
    return {
      outcome: 'wrong_alert',
      next: { failedPinCount: 0, pinLockedUntil: new Date(now.getTime() + LOCK_MINUTES * 60_000).toISOString() },
    };
  }
  return { outcome: 'wrong', next: { failedPinCount: failed, pinLockedUntil: null } };
}
```

- [ ] **Step 6: Run — expect PASS**

Run: `npm test -- tests/phone.test.ts tests/pin.test.ts`

- [ ] **Step 7: Commit**

```bash
git add lib/phone.ts lib/pin.ts tests/phone.test.ts tests/pin.test.ts
git commit -m "feat: add phone normalisation and PIN evaluation" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Repo interface, in-memory repo, Supabase schema and repo

**Files:**
- Create: `lib/repo/types.ts`, `lib/repo/memory.ts`, `lib/repo/supabase.ts`, `supabase/migrations/0001_init.sql`
- Test: `tests/memory-repo.test.ts`

**Interfaces:**
- Consumes: types from `lib/types.ts`.
- Produces: `Repo`, `NewContact`, `NewTrip`, `NewAlert`, `NewDelivery`, `TripPatch` (`lib/repo/types.ts`); `createMemoryRepo(): MemoryRepo` (a `Repo` plus a `data` field); `createSupabaseRepo(db: SupabaseClient): Repo`.
- Atomic contracts every implementation must keep:
  - `transitionTrip(id, from, to, patch?)` changes the row only if its current status is `from`; returns the updated trip or `null`.
  - `claimDueTrips(now)` flips every `active` trip with `deadlineAt < now` to `alerted` in one statement and returns exactly those trips.
  - `resolveAlert(id, by, at)` succeeds only once per alert (returns `null` if already resolved).
  - `getOpenTrip(userId)` returns the newest trip whose status is `active` or `alerted`.

- [ ] **Step 1: Write failing `tests/memory-repo.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { createMemoryRepo } from '@/lib/repo/memory';
import type { NewTrip } from '@/lib/repo/types';

function trip(overrides: Partial<NewTrip> = {}): NewTrip {
  return {
    userId: 'u1', vehiclePhotoPath: null, durationMin: 20,
    startedAt: '2026-10-01T10:00:00.000Z', deadlineAt: '2026-10-01T10:20:00.000Z',
    status: 'active', shareToken: 'tok', shareExpiresAt: null, ...overrides,
  };
}

describe('memory repo atomic contracts', () => {
  it('transitionTrip only moves from the expected status', async () => {
    const repo = createMemoryRepo();
    const t = await repo.createTrip(trip());
    expect(await repo.transitionTrip(t.id, 'alerted', 'safe')).toBeNull();
    const moved = await repo.transitionTrip(t.id, 'active', 'safe', { shareExpiresAt: '2026-10-02T10:00:00.000Z' });
    expect(moved?.status).toBe('safe');
    expect(moved?.shareExpiresAt).toBe('2026-10-02T10:00:00.000Z');
  });

  it('claimDueTrips claims each due trip exactly once', async () => {
    const repo = createMemoryRepo();
    const due = await repo.createTrip(trip());
    await repo.createTrip(trip({ deadlineAt: '2026-10-01T11:00:00.000Z', shareToken: 't2' }));
    const now = new Date('2026-10-01T10:21:00.000Z');
    expect((await repo.claimDueTrips(now)).map((t) => t.id)).toEqual([due.id]);
    expect(await repo.claimDueTrips(now)).toEqual([]);
  });

  it('getOpenTrip returns the newest active or alerted trip', async () => {
    const repo = createMemoryRepo();
    await repo.createTrip(trip({ status: 'safe', startedAt: '2026-10-01T11:00:00.000Z', shareToken: 'a' }));
    const alerted = await repo.createTrip(trip({ status: 'alerted', shareToken: 'b' }));
    expect((await repo.getOpenTrip('u1'))?.id).toBe(alerted.id);
    expect(await repo.getOpenTrip('someone-else')).toBeNull();
  });

  it('resolveAlert succeeds only once', async () => {
    const repo = createMemoryRepo();
    const a = await repo.createAlert({
      userId: 'u1', tripId: null, reason: 'sos', lat: null, lng: null, photoPath: null,
      createdAt: '2026-10-01T10:00:00.000Z',
    });
    const at = new Date('2026-10-01T10:05:00.000Z');
    expect((await repo.resolveAlert(a.id, 'Ammi', at))?.resolvedBy).toBe('Ammi');
    expect(await repo.resolveAlert(a.id, 'Ali', at)).toBeNull();
    expect(await repo.latestOpenAlert('u1')).toBeNull();
  });

  it('listRetryableDeliveries skips sent and exhausted deliveries', async () => {
    const repo = createMemoryRepo();
    const [retryable] = await repo.createDeliveries([
      { alertId: 'x', contactId: 'c1', channel: 'telegram', status: 'failed', attempts: 1, lastError: 'e' },
      { alertId: 'x', contactId: 'c2', channel: 'email', status: 'sent', attempts: 1, lastError: null },
      { alertId: 'x', contactId: 'c3', channel: 'telegram', status: 'failed', attempts: 3, lastError: 'e' },
    ]);
    expect((await repo.listRetryableDeliveries(3)).map((d) => d.id)).toEqual([retryable.id]);
  });

  it('returns copies, not live references', async () => {
    const repo = createMemoryRepo();
    const t = await repo.createTrip(trip());
    t.status = 'safe';
    expect((await repo.getTrip(t.id))?.status).toBe('active');
  });
});
```

- [ ] **Step 2: Run — expect FAIL** (modules missing)

Run: `npm test -- tests/memory-repo.test.ts`

- [ ] **Step 3: Create `lib/repo/types.ts`**

```ts
import type { Alert, Contact, Delivery, LocationPoint, PinState, Profile, Trip, TripStatus } from '@/lib/types';

export type NewContact = Omit<Contact, 'id'>;
export type NewTrip = Omit<Trip, 'id'>;
export type NewAlert = Omit<Alert, 'id' | 'resolvedAt' | 'resolvedBy'>;
export type NewDelivery = Omit<Delivery, 'id'>;
export type TripPatch = Partial<Pick<Trip, 'shareExpiresAt' | 'deadlineAt'>>;

export interface Repo {
  ping(): Promise<void>;

  getProfile(userId: string): Promise<Profile | null>;
  getProfileByPhone(phone: string): Promise<Profile | null>;
  saveProfile(profile: Profile): Promise<void>;
  updatePinState(userId: string, state: PinState): Promise<void>;

  listContacts(userId: string): Promise<Contact[]>;
  getContact(id: string): Promise<Contact | null>;
  getContactByInviteToken(token: string): Promise<Contact | null>;
  listContactsByChatId(chatId: string): Promise<Contact[]>;
  createContact(contact: NewContact): Promise<Contact>;
  updateContact(id: string, patch: Partial<Pick<Contact, 'telegramChatId' | 'status'>>): Promise<void>;
  deleteContact(userId: string, id: string): Promise<boolean>;

  createTrip(trip: NewTrip): Promise<Trip>;
  getTrip(id: string): Promise<Trip | null>;
  getOpenTrip(userId: string): Promise<Trip | null>;
  getTripByShareToken(token: string): Promise<Trip | null>;
  transitionTrip(id: string, from: TripStatus, to: TripStatus, patch?: TripPatch): Promise<Trip | null>;
  claimDueTrips(now: Date): Promise<Trip[]>;

  addLocations(tripId: string, points: LocationPoint[]): Promise<void>;
  lastLocation(tripId: string): Promise<LocationPoint | null>;

  createAlert(alert: NewAlert): Promise<Alert>;
  getAlert(id: string): Promise<Alert | null>;
  latestOpenAlert(userId: string): Promise<Alert | null>;
  resolveAlert(id: string, resolvedBy: string, at: Date): Promise<Alert | null>;

  createDeliveries(deliveries: NewDelivery[]): Promise<Delivery[]>;
  updateDelivery(id: string, patch: Partial<Pick<Delivery, 'status' | 'attempts' | 'lastError'>>): Promise<void>;
  listRetryableDeliveries(maxAttempts: number): Promise<Delivery[]>;
}
```

- [ ] **Step 4: Create `lib/repo/memory.ts`**

```ts
import { randomUUID } from 'node:crypto';
import type { Alert, Contact, Delivery, LocationPoint, Profile, Trip } from '@/lib/types';
import type { Repo } from './types';

export interface MemoryData {
  profiles: Map<string, Profile>;
  contacts: Contact[];
  trips: Trip[];
  locations: Map<string, LocationPoint[]>;
  alerts: Alert[];
  deliveries: Delivery[];
}

export type MemoryRepo = Repo & { data: MemoryData };

const copy = <T>(value: T): T => structuredClone(value);

function newest<T>(list: T[], key: (item: T) => string): T | undefined {
  return [...list].sort((a, b) => key(b).localeCompare(key(a)))[0];
}

export function createMemoryRepo(): MemoryRepo {
  const data: MemoryData = {
    profiles: new Map(), contacts: [], trips: [], locations: new Map(), alerts: [], deliveries: [],
  };

  return {
    data,
    async ping() {},

    async getProfile(id) {
      const p = data.profiles.get(id);
      return p ? copy(p) : null;
    },
    async getProfileByPhone(phone) {
      for (const p of data.profiles.values()) if (p.phone === phone) return copy(p);
      return null;
    },
    async saveProfile(profile) {
      data.profiles.set(profile.id, copy(profile));
    },
    async updatePinState(userId, state) {
      const p = data.profiles.get(userId);
      if (p) Object.assign(p, state);
    },

    async listContacts(userId) {
      return data.contacts.filter((c) => c.userId === userId).map(copy);
    },
    async getContact(id) {
      const c = data.contacts.find((x) => x.id === id);
      return c ? copy(c) : null;
    },
    async getContactByInviteToken(token) {
      const c = data.contacts.find((x) => x.inviteToken === token);
      return c ? copy(c) : null;
    },
    async listContactsByChatId(chatId) {
      return data.contacts.filter((c) => c.telegramChatId === chatId).map(copy);
    },
    async createContact(contact) {
      const row: Contact = { ...copy(contact), id: randomUUID() };
      data.contacts.push(row);
      return copy(row);
    },
    async updateContact(id, patch) {
      const c = data.contacts.find((x) => x.id === id);
      if (c) Object.assign(c, patch);
    },
    async deleteContact(userId, id) {
      const i = data.contacts.findIndex((c) => c.id === id && c.userId === userId);
      if (i < 0) return false;
      data.contacts.splice(i, 1);
      return true;
    },

    async createTrip(trip) {
      const row: Trip = { ...copy(trip), id: randomUUID() };
      data.trips.push(row);
      return copy(row);
    },
    async getTrip(id) {
      const t = data.trips.find((x) => x.id === id);
      return t ? copy(t) : null;
    },
    async getOpenTrip(userId) {
      const t = newest(data.trips.filter((x) => x.userId === userId && x.status !== 'safe'), (x) => x.startedAt);
      return t ? copy(t) : null;
    },
    async getTripByShareToken(token) {
      const t = data.trips.find((x) => x.shareToken === token);
      return t ? copy(t) : null;
    },
    async transitionTrip(id, from, to, patch = {}) {
      const t = data.trips.find((x) => x.id === id);
      if (!t || t.status !== from) return null;
      Object.assign(t, patch, { status: to });
      return copy(t);
    },
    async claimDueTrips(now) {
      const due = data.trips.filter((t) => t.status === 'active' && new Date(t.deadlineAt) < now);
      for (const t of due) t.status = 'alerted';
      return due.map(copy);
    },

    async addLocations(tripId, points) {
      const list = data.locations.get(tripId) ?? [];
      list.push(...points.map(copy));
      data.locations.set(tripId, list);
    },
    async lastLocation(tripId) {
      const p = newest(data.locations.get(tripId) ?? [], (x) => x.recordedAt);
      return p ? copy(p) : null;
    },

    async createAlert(alert) {
      const row: Alert = { ...copy(alert), id: randomUUID(), resolvedAt: null, resolvedBy: null };
      data.alerts.push(row);
      return copy(row);
    },
    async getAlert(id) {
      const a = data.alerts.find((x) => x.id === id);
      return a ? copy(a) : null;
    },
    async latestOpenAlert(userId) {
      const a = newest(data.alerts.filter((x) => x.userId === userId && !x.resolvedAt), (x) => x.createdAt);
      return a ? copy(a) : null;
    },
    async resolveAlert(id, resolvedBy, at) {
      const a = data.alerts.find((x) => x.id === id);
      if (!a || a.resolvedAt) return null;
      a.resolvedAt = at.toISOString();
      a.resolvedBy = resolvedBy;
      return copy(a);
    },

    async createDeliveries(deliveries) {
      const rows: Delivery[] = deliveries.map((d) => ({ ...copy(d), id: randomUUID() }));
      data.deliveries.push(...rows);
      return rows.map(copy);
    },
    async updateDelivery(id, patch) {
      const d = data.deliveries.find((x) => x.id === id);
      if (d) Object.assign(d, patch);
    },
    async listRetryableDeliveries(maxAttempts) {
      return data.deliveries.filter((d) => d.status !== 'sent' && d.attempts < maxAttempts).map(copy);
    },
  };
}
```

- [ ] **Step 5: Run — expect PASS**

Run: `npm test -- tests/memory-repo.test.ts`

- [ ] **Step 6: Create `supabase/migrations/0001_init.sql`**

```sql
-- Beti AI — Hissa 1 schema. Run once in the Supabase SQL editor.
create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  phone text not null unique,
  safe_pin_hash text,
  duress_pin_hash text,
  failed_pin_count int not null default 0,
  pin_locked_until timestamptz,
  lang text not null default 'ur' check (lang in ('ur', 'en')),
  created_at timestamptz not null default now()
);

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  relation text not null,
  phone text,
  email text,
  telegram_chat_id text,
  invite_token text not null unique,
  status text not null default 'pending' check (status in ('pending', 'connected', 'blocked')),
  created_at timestamptz not null default now()
);
create index contacts_user_idx on public.contacts(user_id);
create index contacts_chat_idx on public.contacts(telegram_chat_id);

create table public.trips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  vehicle_photo_path text,
  duration_min int not null,
  started_at timestamptz not null,
  deadline_at timestamptz not null,
  status text not null check (status in ('active', 'safe', 'alerted')),
  share_token text not null unique,
  share_expires_at timestamptz
);
create index trips_due_idx on public.trips(deadline_at) where status = 'active';
create index trips_user_idx on public.trips(user_id, started_at desc);

create table public.locations (
  id bigint generated always as identity primary key,
  trip_id uuid not null references public.trips(id) on delete cascade,
  lat double precision not null,
  lng double precision not null,
  accuracy_m double precision,
  recorded_at timestamptz not null
);
create index locations_trip_idx on public.locations(trip_id, recorded_at desc);

create table public.alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  trip_id uuid references public.trips(id) on delete set null,
  reason text not null check (reason in ('timer', 'sos', 'duress', 'wrong_pin', 'help_page', 'calculator', 'test')),
  lat double precision,
  lng double precision,
  photo_path text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by text
);
create index alerts_user_idx on public.alerts(user_id, created_at desc);

create table public.alert_deliveries (
  id uuid primary key default gen_random_uuid(),
  alert_id uuid not null references public.alerts(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  channel text not null check (channel in ('telegram', 'email')),
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  attempts int not null default 0,
  last_error text
);
create index deliveries_retry_idx on public.alert_deliveries(status) where status <> 'sent';

-- RLS on, no policies: only the server (service_role) can read or write.
alter table public.profiles enable row level security;
alter table public.contacts enable row level security;
alter table public.trips enable row level security;
alter table public.locations enable row level security;
alter table public.alerts enable row level security;
alter table public.alert_deliveries enable row level security;

-- Private bucket for vehicle photos. Users may upload only into their own folder: <user_id>/<file>.
insert into storage.buckets (id, name, public) values ('vehicle-photos', 'vehicle-photos', false)
on conflict (id) do nothing;

create policy "users upload own vehicle photos" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'vehicle-photos' and (storage.foldername(name))[1] = auth.uid()::text);
```

- [ ] **Step 7: Create `lib/repo/supabase.ts`**

```ts
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Alert, Contact, Delivery, LocationPoint, Profile, Trip } from '@/lib/types';
import type { Repo } from './types';

type Row = Record<string, any>;

function must<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

const toProfile = (r: Row): Profile => ({
  id: r.id, name: r.name, phone: r.phone, safePinHash: r.safe_pin_hash, duressPinHash: r.duress_pin_hash,
  failedPinCount: r.failed_pin_count, pinLockedUntil: r.pin_locked_until, lang: r.lang,
});
const toContact = (r: Row): Contact => ({
  id: r.id, userId: r.user_id, name: r.name, relation: r.relation, phone: r.phone, email: r.email,
  telegramChatId: r.telegram_chat_id, inviteToken: r.invite_token, status: r.status,
});
const toTrip = (r: Row): Trip => ({
  id: r.id, userId: r.user_id, vehiclePhotoPath: r.vehicle_photo_path, durationMin: r.duration_min,
  startedAt: r.started_at, deadlineAt: r.deadline_at, status: r.status, shareToken: r.share_token,
  shareExpiresAt: r.share_expires_at,
});
const toLocation = (r: Row): LocationPoint => ({
  lat: r.lat, lng: r.lng, accuracyM: r.accuracy_m, recordedAt: r.recorded_at,
});
const toAlert = (r: Row): Alert => ({
  id: r.id, userId: r.user_id, tripId: r.trip_id, reason: r.reason, lat: r.lat, lng: r.lng,
  photoPath: r.photo_path, createdAt: r.created_at, resolvedAt: r.resolved_at, resolvedBy: r.resolved_by,
});
const toDelivery = (r: Row): Delivery => ({
  id: r.id, alertId: r.alert_id, contactId: r.contact_id, channel: r.channel, status: r.status,
  attempts: r.attempts, lastError: r.last_error,
});

export function createSupabaseRepo(db: SupabaseClient): Repo {
  return {
    async ping() {
      must(await db.from('profiles').select('id').limit(1));
    },

    async getProfile(id) {
      const r = must(await db.from('profiles').select('*').eq('id', id).maybeSingle());
      return r ? toProfile(r) : null;
    },
    async getProfileByPhone(phone) {
      const r = must(await db.from('profiles').select('*').eq('phone', phone).maybeSingle());
      return r ? toProfile(r) : null;
    },
    async saveProfile(p) {
      must(await db.from('profiles').upsert({
        id: p.id, name: p.name, phone: p.phone, safe_pin_hash: p.safePinHash, duress_pin_hash: p.duressPinHash,
        failed_pin_count: p.failedPinCount, pin_locked_until: p.pinLockedUntil, lang: p.lang,
      }));
    },
    async updatePinState(userId, s) {
      must(await db.from('profiles')
        .update({ failed_pin_count: s.failedPinCount, pin_locked_until: s.pinLockedUntil })
        .eq('id', userId));
    },

    async listContacts(userId) {
      const rows = must(await db.from('contacts').select('*').eq('user_id', userId).order('created_at'));
      return (rows ?? []).map(toContact);
    },
    async getContact(id) {
      const r = must(await db.from('contacts').select('*').eq('id', id).maybeSingle());
      return r ? toContact(r) : null;
    },
    async getContactByInviteToken(token) {
      const r = must(await db.from('contacts').select('*').eq('invite_token', token).maybeSingle());
      return r ? toContact(r) : null;
    },
    async listContactsByChatId(chatId) {
      const rows = must(await db.from('contacts').select('*').eq('telegram_chat_id', chatId));
      return (rows ?? []).map(toContact);
    },
    async createContact(c) {
      const r = must(await db.from('contacts').insert({
        user_id: c.userId, name: c.name, relation: c.relation, phone: c.phone, email: c.email,
        telegram_chat_id: c.telegramChatId, invite_token: c.inviteToken, status: c.status,
      }).select().single());
      return toContact(r);
    },
    async updateContact(id, patch) {
      const row: Row = {};
      if (patch.telegramChatId !== undefined) row.telegram_chat_id = patch.telegramChatId;
      if (patch.status !== undefined) row.status = patch.status;
      must(await db.from('contacts').update(row).eq('id', id));
    },
    async deleteContact(userId, id) {
      const rows = must(await db.from('contacts').delete().eq('id', id).eq('user_id', userId).select('id'));
      return (rows ?? []).length > 0;
    },

    async createTrip(t) {
      const r = must(await db.from('trips').insert({
        user_id: t.userId, vehicle_photo_path: t.vehiclePhotoPath, duration_min: t.durationMin,
        started_at: t.startedAt, deadline_at: t.deadlineAt, status: t.status, share_token: t.shareToken,
        share_expires_at: t.shareExpiresAt,
      }).select().single());
      return toTrip(r);
    },
    async getTrip(id) {
      const r = must(await db.from('trips').select('*').eq('id', id).maybeSingle());
      return r ? toTrip(r) : null;
    },
    async getOpenTrip(userId) {
      const r = must(await db.from('trips').select('*').eq('user_id', userId).in('status', ['active', 'alerted'])
        .order('started_at', { ascending: false }).limit(1).maybeSingle());
      return r ? toTrip(r) : null;
    },
    async getTripByShareToken(token) {
      const r = must(await db.from('trips').select('*').eq('share_token', token).maybeSingle());
      return r ? toTrip(r) : null;
    },
    async transitionTrip(id, from, to, patch = {}) {
      const row: Row = { status: to };
      if (patch.shareExpiresAt !== undefined) row.share_expires_at = patch.shareExpiresAt;
      if (patch.deadlineAt !== undefined) row.deadline_at = patch.deadlineAt;
      const r = must(await db.from('trips').update(row).eq('id', id).eq('status', from).select().maybeSingle());
      return r ? toTrip(r) : null;
    },
    async claimDueTrips(now) {
      const rows = must(await db.from('trips').update({ status: 'alerted' })
        .eq('status', 'active').lt('deadline_at', now.toISOString()).select());
      return (rows ?? []).map(toTrip);
    },

    async addLocations(tripId, points) {
      if (points.length === 0) return;
      must(await db.from('locations').insert(points.map((p) => ({
        trip_id: tripId, lat: p.lat, lng: p.lng, accuracy_m: p.accuracyM, recorded_at: p.recordedAt,
      }))));
    },
    async lastLocation(tripId) {
      const r = must(await db.from('locations').select('*').eq('trip_id', tripId)
        .order('recorded_at', { ascending: false }).limit(1).maybeSingle());
      return r ? toLocation(r) : null;
    },

    async createAlert(a) {
      const r = must(await db.from('alerts').insert({
        user_id: a.userId, trip_id: a.tripId, reason: a.reason, lat: a.lat, lng: a.lng,
        photo_path: a.photoPath, created_at: a.createdAt,
      }).select().single());
      return toAlert(r);
    },
    async getAlert(id) {
      const r = must(await db.from('alerts').select('*').eq('id', id).maybeSingle());
      return r ? toAlert(r) : null;
    },
    async latestOpenAlert(userId) {
      const r = must(await db.from('alerts').select('*').eq('user_id', userId).is('resolved_at', null)
        .order('created_at', { ascending: false }).limit(1).maybeSingle());
      return r ? toAlert(r) : null;
    },
    async resolveAlert(id, resolvedBy, at) {
      const r = must(await db.from('alerts').update({ resolved_at: at.toISOString(), resolved_by: resolvedBy })
        .eq('id', id).is('resolved_at', null).select().maybeSingle());
      return r ? toAlert(r) : null;
    },

    async createDeliveries(deliveries) {
      if (deliveries.length === 0) return [];
      const rows = must(await db.from('alert_deliveries').insert(deliveries.map((d) => ({
        alert_id: d.alertId, contact_id: d.contactId, channel: d.channel, status: d.status,
        attempts: d.attempts, last_error: d.lastError,
      }))).select());
      return (rows ?? []).map(toDelivery);
    },
    async updateDelivery(id, patch) {
      const row: Row = {};
      if (patch.status !== undefined) row.status = patch.status;
      if (patch.attempts !== undefined) row.attempts = patch.attempts;
      if (patch.lastError !== undefined) row.last_error = patch.lastError;
      must(await db.from('alert_deliveries').update(row).eq('id', id));
    },
    async listRetryableDeliveries(maxAttempts) {
      const rows = must(await db.from('alert_deliveries').select('*').neq('status', 'sent').lt('attempts', maxAttempts));
      return (rows ?? []).map(toDelivery);
    },
  };
}
```

- [ ] **Step 8: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add lib/repo supabase/migrations tests/memory-repo.test.ts
git commit -m "feat: add repo interface, memory and Supabase repos, and schema" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---


### Task 4: Alert texts and delivery channels

**Files:**
- Create: `lib/messages.ts`, `lib/channels/telegram.ts`, `lib/channels/email.ts`
- Test: `tests/messages.test.ts`, `tests/telegram.test.ts`

**Interfaces:**
- Consumes: `AlertReason` from `lib/types.ts`.
- Produces:
  - `lib/channels/telegram.ts`: `interface TelegramButton { text: string; data: string }`, `interface TelegramApi { sendMessage(chatId, text, buttons?): Promise<void>; sendVoice(chatId, url): Promise<void>; sendLocation(chatId, lat, lng): Promise<void>; sendPhoto(chatId, url): Promise<void>; answerCallback(callbackId, text): Promise<void>; setWebhook(url, secret): Promise<void> }`, `createTelegram(token: string, fetchImpl?: typeof fetch): TelegramApi`. Every method throws on a non-OK Telegram response.
  - `lib/channels/email.ts`: `interface EmailApi { send(to: string, subject: string, text: string): Promise<void> }`, `createEmail(user: string, pass: string): EmailApi`.
  - `lib/messages.ts`: `mapsUrl(lat, lng)`, `interface AlertTextInput { userName; reason; at: Date; lat: number|null; lng: number|null; shareUrl: string|null }`, `alertText(input): string`, `alertSubject(userName, reason): string`, `voicePath(reason): string`, `familyButtons(alertId): TelegramButton[]`, `safeText(userName, afterAlert: boolean)`, `phoneLostText(userName, callbackNumber: string|null)`, `familyUpdateText(userName, contactName, action: 'going'|'ok')`, `welcomeText(userName)`, `LINK_INVALID_TEXT`, `inviteShareText(userName, link)`.

- [ ] **Step 1: Write failing `tests/messages.test.ts`**

```ts
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
```

- [ ] **Step 2: Write failing `tests/telegram.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { createTelegram } from '@/lib/channels/telegram';

function fakeFetch(reply: { status?: number; body: unknown }) {
  const calls: { url: string; body: any }[] = [];
  const impl = (async (url: string, init?: RequestInit) => {
    calls.push({ url, body: JSON.parse(String(init?.body)) });
    return new Response(JSON.stringify(reply.body), { status: reply.status ?? 200 });
  }) as unknown as typeof fetch;
  return { impl, calls };
}

describe('createTelegram', () => {
  it('sends a message with inline buttons', async () => {
    const f = fakeFetch({ body: { ok: true } });
    const tg = createTelegram('TOKEN', f.impl);
    await tg.sendMessage('42', 'hello', [{ text: 'OK', data: 'ok:1' }]);
    expect(f.calls[0].url).toBe('https://api.telegram.org/botTOKEN/sendMessage');
    expect(f.calls[0].body).toEqual({
      chat_id: '42', text: 'hello', disable_web_page_preview: true,
      reply_markup: { inline_keyboard: [[{ text: 'OK', callback_data: 'ok:1' }]] },
    });
  });

  it('sends location with numbers', async () => {
    const f = fakeFetch({ body: { ok: true } });
    await createTelegram('T', f.impl).sendLocation('42', 24.8, 67.0);
    expect(f.calls[0].body).toEqual({ chat_id: '42', latitude: 24.8, longitude: 67.0 });
  });

  it('throws with the Telegram description on failure', async () => {
    const f = fakeFetch({ status: 403, body: { ok: false, description: 'Forbidden: bot was blocked by the user' } });
    await expect(createTelegram('T', f.impl).sendMessage('42', 'x')).rejects.toThrow('bot was blocked');
  });
});
```

- [ ] **Step 3: Run — expect FAIL** (modules missing)

Run: `npm test -- tests/messages.test.ts tests/telegram.test.ts`

- [ ] **Step 4: Create `lib/channels/telegram.ts`**

```ts
export interface TelegramButton {
  text: string;
  data: string;
}

export interface TelegramApi {
  sendMessage(chatId: string, text: string, buttons?: TelegramButton[]): Promise<void>;
  sendVoice(chatId: string, url: string): Promise<void>;
  sendLocation(chatId: string, lat: number, lng: number): Promise<void>;
  sendPhoto(chatId: string, url: string): Promise<void>;
  answerCallback(callbackId: string, text: string): Promise<void>;
  setWebhook(url: string, secret: string): Promise<void>;
}

export function createTelegram(token: string, fetchImpl: typeof fetch = fetch): TelegramApi {
  async function call(method: string, body: Record<string, unknown>): Promise<void> {
    const res = await fetchImpl(`https://api.telegram.org/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = (await res.json().catch(() => ({}))) as { ok?: boolean; description?: string };
    if (!res.ok || !json.ok) throw new Error(`Telegram ${method} failed: ${json.description ?? res.status}`);
  }

  return {
    sendMessage: (chatId, text, buttons) =>
      call('sendMessage', {
        chat_id: chatId,
        text,
        disable_web_page_preview: true,
        ...(buttons?.length
          ? { reply_markup: { inline_keyboard: buttons.map((b) => [{ text: b.text, callback_data: b.data }]) } }
          : {}),
      }),
    sendVoice: (chatId, url) => call('sendVoice', { chat_id: chatId, voice: url }),
    sendLocation: (chatId, lat, lng) => call('sendLocation', { chat_id: chatId, latitude: lat, longitude: lng }),
    sendPhoto: (chatId, url) => call('sendPhoto', { chat_id: chatId, photo: url }),
    answerCallback: (callbackId, text) => call('answerCallbackQuery', { callback_query_id: callbackId, text }),
    setWebhook: (url, secret) =>
      call('setWebhook', {
        url,
        secret_token: secret,
        allowed_updates: ['message', 'callback_query', 'my_chat_member'],
      }),
  };
}
```

- [ ] **Step 5: Create `lib/channels/email.ts`**

```ts
import nodemailer from 'nodemailer';

export interface EmailApi {
  send(to: string, subject: string, text: string): Promise<void>;
}

/** Gmail SMTP with an App Password — free, no own domain needed. */
export function createEmail(user: string, pass: string): EmailApi {
  const transport = nodemailer.createTransport({ service: 'gmail', auth: { user, pass } });
  return {
    async send(to, subject, text) {
      await transport.sendMail({ from: `Beti AI <${user}>`, to, subject, text });
    },
  };
}
```

- [ ] **Step 6: Create `lib/messages.ts`**

```ts
import type { TelegramButton } from '@/lib/channels/telegram';
import type { AlertReason } from '@/lib/types';

const REASONS: Record<AlertReason, { ur: string; en: string }> = {
  timer: { ur: 'سفر کا وقت ختم ہو گیا اور کوئی جواب نہیں آیا', en: 'Trip timer ran out with no check-in' },
  sos: { ur: 'اس نے مدد کا بٹن دبایا', en: 'She pressed the help button' },
  duress: { ur: 'خاموش خطرے کا اشارہ', en: 'Silent danger signal' },
  wrong_pin: { ur: 'کسی نے بار بار غلط PIN ڈالا', en: 'Someone entered a wrong PIN repeatedly' },
  help_page: { ur: 'اس نے کسی اور فون سے مدد مانگی', en: 'She asked for help from another phone' },
  calculator: { ur: 'خاموش خطرے کا اشارہ', en: 'Silent danger signal' },
  test: { ur: 'یہ صرف ٹیسٹ ہے، پریشان نہ ہوں', en: 'This is only a test' },
};

export function mapsUrl(lat: number, lng: number): string {
  return `https://maps.google.com/?q=${lat},${lng}`;
}

export interface AlertTextInput {
  userName: string;
  reason: AlertReason;
  at: Date;
  lat: number | null;
  lng: number | null;
  shareUrl: string | null;
}

function pkTime(at: Date): string {
  return at.toLocaleString('en-US', {
    timeZone: 'Asia/Karachi', hour: 'numeric', minute: '2-digit', day: 'numeric', month: 'short',
  });
}

export function alertText(i: AlertTextInput): string {
  const isTest = i.reason === 'test';
  const lines = [
    isTest ? '🧪 Beti AI — ٹیسٹ / TEST' : `🚨 ${i.userName} کو مدد چاہیے! / ${i.userName} needs help!`,
    `📌 ${REASONS[i.reason].ur}`,
    `📌 ${REASONS[i.reason].en}`,
    `🕐 ${pkTime(i.at)}`,
    i.lat !== null && i.lng !== null ? `📍 ${mapsUrl(i.lat, i.lng)}` : '📍 مقام نہیں ملا / Location not available',
  ];
  if (i.shareUrl) lines.push(`🔗 لائیو / Live: ${i.shareUrl}`);
  if (!isTest) lines.push('📞 فوراً رابطہ کریں یا 15 پر کال کریں / Call her now or dial 15');
  return lines.join('\n');
}

export function alertSubject(userName: string, reason: AlertReason): string {
  return reason === 'test' ? 'Beti AI — Test alert' : `🚨 ${userName} needs help — Beti AI`;
}

export function voicePath(reason: AlertReason): string {
  return reason === 'test' ? '/audio/alert-test.mp3' : '/audio/alert-help.mp3';
}

export function familyButtons(alertId: string): TelegramButton[] {
  return [
    { text: '🏃 میں جا رہا ہوں / Going', data: `going:${alertId}` },
    { text: '✅ سب ٹھیک ہے / All OK', data: `ok:${alertId}` },
  ];
}

export function safeText(userName: string, afterAlert: boolean): string {
  return afterAlert
    ? `✅ غلط الارم تھا — ${userName} ٹھیک ہے۔\n✅ False alarm — ${userName} is safe.`
    : `✅ ${userName} خیریت سے پہنچ گئی۔\n✅ ${userName} reached safely.`;
}

export function phoneLostText(userName: string, callbackNumber: string | null): string {
  const base = `ℹ️ ${userName} ٹھیک ہے، اس کا فون چوری ہو گیا ہے۔\nℹ️ ${userName} is OK — her phone was stolen.`;
  return callbackNumber ? `${base}\n📞 ${callbackNumber}` : base;
}

export function familyUpdateText(userName: string, contactName: string, action: 'going' | 'ok'): string {
  return action === 'going'
    ? `🏃 ${contactName} ${userName} کی طرف جا رہے ہیں۔\n🏃 ${contactName} is going to ${userName}.`
    : `✅ ${contactName} نے تصدیق کی: ${userName} ٹھیک ہے۔\n✅ ${contactName} confirmed ${userName} is OK.`;
}

export function welcomeText(userName: string): string {
  return `✅ آپ ${userName} کے ایمرجنسی رابطہ بن گئے ہیں۔ خطرے میں آپ کو یہاں اطلاع ملے گی۔\n✅ You are now ${userName}'s emergency contact. Alerts will arrive here.`;
}

export const LINK_INVALID_TEXT =
  '⚠️ یہ لنک درست نہیں۔ نیا لنک منگوائیں۔\n⚠️ This link is not valid. Please ask for a new one.';

export function inviteShareText(userName: string, link: string): string {
  return `السلام علیکم! ${userName} نے آپ کو Beti AI پر اپنا ایمرجنسی رابطہ بنایا ہے۔ یہ لنک کھول کر Start دبائیں:\nAssalam o Alaikum! ${userName} added you as an emergency contact on Beti AI. Open this link and press Start:\n${link}`;
}
```

- [ ] **Step 7: Run — expect PASS**

Run: `npm test -- tests/messages.test.ts tests/telegram.test.ts`

- [ ] **Step 8: Commit**

```bash
git add lib/messages.ts lib/channels tests/messages.test.ts tests/telegram.test.ts
git commit -m "feat: add bilingual alert texts and Telegram/email channels" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---


### Task 5: Alert engine (raise, deliver, retry, family replies)

**Files:**
- Create: `lib/deps.ts`, `lib/alerts.ts`, `tests/helpers/fakes.ts`
- Test: `tests/alerts.test.ts`

**Interfaces:**
- Consumes: `Repo` (Task 3), `TelegramApi`, `EmailApi`, message helpers (Task 4), `hashPin` (Task 2).
- Produces:
  - `lib/deps.ts`: `interface Deps { repo: Repo; telegram: TelegramApi; email: EmailApi; appUrl: string; botUsername: string; now: () => Date; photoUrl: (path: string) => Promise<string | null> }`
  - `lib/alerts.ts`:
    - `MAX_ATTEMPTS = 3`
    - `interface RaiseInput { userId: string; tripId: string | null; reason: AlertReason; lat?: number | null; lng?: number | null }`
    - `interface RaiseResult { alert: Alert; sent: number; failed: number }`
    - `raiseAlert(deps, input): Promise<RaiseResult>`
    - `retryDeliveries(deps): Promise<{ retried: number; sent: number }>`
    - `notifyContacts(deps, userId, text, exceptContactId?): Promise<number>` (best effort, never throws)
    - `resolveFromFamily(deps, { alertId, chatId, action: 'going' | 'ok' }): Promise<{ ok: boolean }>`
  - `tests/helpers/fakes.ts`: `fakeTelegram()`, `fakeEmail()`, `makeDeps(start?)`, `seedUser(repo, opts?)` — reused by Tasks 6–9.
- Delivery rules: Telegram only for contacts with `status === 'connected'` and a chat id; email for any non-blocked contact with an email. For Telegram the voice, location and photo are best effort; the text message decides success.

- [ ] **Step 1: Create `lib/deps.ts`**

```ts
import type { EmailApi } from '@/lib/channels/email';
import type { TelegramApi } from '@/lib/channels/telegram';
import type { Repo } from '@/lib/repo/types';

export interface Deps {
  repo: Repo;
  telegram: TelegramApi;
  email: EmailApi;
  appUrl: string;
  botUsername: string;
  now: () => Date;
  photoUrl: (path: string) => Promise<string | null>;
}
```

- [ ] **Step 2: Create `tests/helpers/fakes.ts`**

```ts
import type { EmailApi } from '@/lib/channels/email';
import type { TelegramApi } from '@/lib/channels/telegram';
import type { Deps } from '@/lib/deps';
import { hashPin } from '@/lib/pin';
import { createMemoryRepo, type MemoryRepo } from '@/lib/repo/memory';
import type { Profile } from '@/lib/types';

export interface TgCall {
  method: string;
  chatId: string;
  args: unknown[];
}

/** Fails any call whose method name or chat id is in `failing`. */
export function fakeTelegram() {
  const calls: TgCall[] = [];
  const failing = new Set<string>();
  const record = (method: string) => async (chatId: string, ...args: unknown[]) => {
    calls.push({ method, chatId, args });
    if (failing.has(method) || failing.has(chatId)) throw new Error(`${method} failed for ${chatId}`);
  };
  const api: TelegramApi = {
    sendMessage: record('sendMessage') as TelegramApi['sendMessage'],
    sendVoice: record('sendVoice') as TelegramApi['sendVoice'],
    sendLocation: record('sendLocation') as TelegramApi['sendLocation'],
    sendPhoto: record('sendPhoto') as TelegramApi['sendPhoto'],
    answerCallback: record('answerCallback') as TelegramApi['answerCallback'],
    setWebhook: record('setWebhook') as TelegramApi['setWebhook'],
  };
  const texts = (chatId?: string) =>
    calls.filter((c) => c.method === 'sendMessage' && (!chatId || c.chatId === chatId)).map((c) => String(c.args[0]));
  return { api, calls, failing, texts };
}

export function fakeEmail() {
  const sent: { to: string; subject: string; text: string }[] = [];
  const failing = new Set<string>();
  const api: EmailApi = {
    async send(to, subject, text) {
      sent.push({ to, subject, text });
      if (failing.has(to)) throw new Error(`email failed for ${to}`);
    },
  };
  return { api, sent, failing };
}

export function makeDeps(start = '2026-10-01T10:00:00.000Z') {
  const repo: MemoryRepo = createMemoryRepo();
  const tg = fakeTelegram();
  const mail = fakeEmail();
  const clock = { now: new Date(start) };
  const deps: Deps = {
    repo,
    telegram: tg.api,
    email: mail.api,
    appUrl: 'https://beti.test',
    botUsername: 'BetiTestBot',
    now: () => new Date(clock.now),
    photoUrl: async (path) => `https://files.test/${path}`,
  };
  const advance = (minutes: number) => {
    clock.now = new Date(clock.now.getTime() + minutes * 60_000);
  };
  return { deps, repo, tg, mail, clock, advance };
}

/** Ayesha (safe PIN 1234, duress PIN 9999) with Ammi (Telegram 111 + email) and Ali (Telegram 222). */
export async function seedUser(repo: MemoryRepo, opts: { id?: string; name?: string; phone?: string } = {}) {
  const profile: Profile = {
    id: opts.id ?? 'user-1',
    name: opts.name ?? 'Ayesha',
    phone: opts.phone ?? '+923001234567',
    safePinHash: await hashPin('1234'),
    duressPinHash: await hashPin('9999'),
    failedPinCount: 0,
    pinLockedUntil: null,
    lang: 'ur',
  };
  await repo.saveProfile(profile);
  const ammi = await repo.createContact({
    userId: profile.id, name: 'Ammi', relation: 'mother', phone: '+923007654321', email: 'ammi@example.com',
    telegramChatId: '111', inviteToken: `tok-ammi-${profile.id}`, status: 'connected',
  });
  const ali = await repo.createContact({
    userId: profile.id, name: 'Ali', relation: 'brother', phone: '+923009876543', email: null,
    telegramChatId: '222', inviteToken: `tok-ali-${profile.id}`, status: 'connected',
  });
  return { profile, ammi, ali };
}
```

- [ ] **Step 3: Write failing `tests/alerts.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { raiseAlert, resolveFromFamily, retryDeliveries } from '@/lib/alerts';
import { makeDeps, seedUser } from './helpers/fakes';

describe('raiseAlert', () => {
  it('sends voice, location and text with buttons on Telegram, plus email', async () => {
    const { deps, repo, tg, mail } = makeDeps();
    const { profile } = await seedUser(repo);
    const r = await raiseAlert(deps, { userId: profile.id, tripId: null, reason: 'sos', lat: 24.86, lng: 67.0 });

    expect(r).toMatchObject({ sent: 3, failed: 0 });
    expect(tg.texts('111')[0]).toContain('Ayesha');
    expect(tg.texts('222')).toHaveLength(1);
    const message = tg.calls.find((c) => c.method === 'sendMessage' && c.chatId === '111')!;
    expect(message.args[1]).toHaveLength(2);
    expect(tg.calls.find((c) => c.method === 'sendVoice')!.args[0]).toBe('https://beti.test/audio/alert-help.mp3');
    expect(tg.calls.find((c) => c.method === 'sendLocation')!.args).toEqual([24.86, 67.0]);
    expect(mail.sent.map((m) => m.to)).toEqual(['ammi@example.com']);
    expect(repo.data.alerts[0]).toMatchObject({ reason: 'sos', lat: 24.86, lng: 67.0 });
  });

  it('skips pending and blocked contacts', async () => {
    const { deps, repo, tg } = makeDeps();
    const { profile } = await seedUser(repo);
    await repo.createContact({
      userId: profile.id, name: 'Pending', relation: 'sister', phone: null, email: null,
      telegramChatId: null, inviteToken: 'p', status: 'pending',
    });
    await repo.createContact({
      userId: profile.id, name: 'Blocked', relation: 'friend', phone: null, email: 'b@example.com',
      telegramChatId: '333', inviteToken: 'b', status: 'blocked',
    });
    await raiseAlert(deps, { userId: profile.id, tripId: null, reason: 'sos' });
    expect(tg.calls.some((c) => c.chatId === '333')).toBe(false);
  });

  it('uses the trip photo, the last trip location and the live link', async () => {
    const { deps, repo, tg } = makeDeps();
    const { profile } = await seedUser(repo);
    const trip = await repo.createTrip({
      userId: profile.id, vehiclePhotoPath: 'user-1/p.jpg', durationMin: 20,
      startedAt: '2026-10-01T10:00:00.000Z', deadlineAt: '2026-10-01T10:20:00.000Z',
      status: 'alerted', shareToken: 'share123', shareExpiresAt: null,
    });
    await repo.addLocations(trip.id, [
      { lat: 24.1, lng: 67.1, accuracyM: 5, recordedAt: '2026-10-01T10:05:00.000Z' },
      { lat: 24.2, lng: 67.2, accuracyM: 5, recordedAt: '2026-10-01T10:10:00.000Z' },
    ]);
    await raiseAlert(deps, { userId: profile.id, tripId: trip.id, reason: 'timer' });
    expect(tg.calls.find((c) => c.method === 'sendLocation')!.args).toEqual([24.2, 67.2]);
    expect(tg.calls.find((c) => c.method === 'sendPhoto')!.args[0]).toBe('https://files.test/user-1/p.jpg');
    expect(tg.texts('111')[0]).toContain('https://beti.test/t/share123');
  });

  it('records a failed channel without blocking the others', async () => {
    const { deps, repo, tg } = makeDeps();
    const { profile } = await seedUser(repo);
    tg.failing.add('222');
    const r = await raiseAlert(deps, { userId: profile.id, tripId: null, reason: 'sos' });
    expect(r).toMatchObject({ sent: 2, failed: 1 });
    const failed = repo.data.deliveries.find((d) => d.status === 'failed')!;
    expect(failed).toMatchObject({ channel: 'telegram', attempts: 1 });
    expect(failed.lastError).toContain('failed');
  });

  it('still counts as delivered when only the voice note fails', async () => {
    const { deps, repo, tg } = makeDeps();
    const { profile } = await seedUser(repo);
    tg.failing.add('sendVoice');
    expect((await raiseAlert(deps, { userId: profile.id, tripId: null, reason: 'sos' })).sent).toBe(3);
  });

  it('reports sent 0 when nobody can be reached', async () => {
    const { deps, repo } = makeDeps();
    await repo.saveProfile({
      id: 'lonely', name: 'Sana', phone: '+923111111111', safePinHash: null, duressPinHash: null,
      failedPinCount: 0, pinLockedUntil: null, lang: 'ur',
    });
    expect(await raiseAlert(deps, { userId: 'lonely', tripId: null, reason: 'sos' })).toMatchObject({ sent: 0, failed: 0 });
  });

  it('test alerts use the test voice and have no family buttons', async () => {
    const { deps, repo, tg } = makeDeps();
    const { profile } = await seedUser(repo);
    await raiseAlert(deps, { userId: profile.id, tripId: null, reason: 'test' });
    expect(tg.calls.find((c) => c.method === 'sendVoice')!.args[0]).toBe('https://beti.test/audio/alert-test.mp3');
    expect(tg.calls.find((c) => c.method === 'sendMessage')!.args[1]).toBeUndefined();
  });
});

describe('retryDeliveries', () => {
  it('retries failed deliveries until they succeed', async () => {
    const { deps, repo, tg } = makeDeps();
    const { profile } = await seedUser(repo);
    tg.failing.add('222');
    await raiseAlert(deps, { userId: profile.id, tripId: null, reason: 'sos' });
    tg.failing.clear();
    expect(await retryDeliveries(deps)).toEqual({ retried: 1, sent: 1 });
    expect(repo.data.deliveries.every((d) => d.status === 'sent')).toBe(true);
    expect(await retryDeliveries(deps)).toEqual({ retried: 0, sent: 0 });
  });

  it('gives up after three attempts in total', async () => {
    const { deps, repo, tg } = makeDeps();
    const { profile } = await seedUser(repo);
    tg.failing.add('222');
    await raiseAlert(deps, { userId: profile.id, tripId: null, reason: 'sos' });
    await retryDeliveries(deps);
    await retryDeliveries(deps);
    expect(await retryDeliveries(deps)).toEqual({ retried: 0, sent: 0 });
    expect(repo.data.deliveries.find((d) => d.status === 'failed')!.attempts).toBe(3);
  });
});

describe('resolveFromFamily', () => {
  it('"ok" resolves the alert and tells the other contacts', async () => {
    const { deps, repo, tg } = makeDeps();
    const { profile } = await seedUser(repo);
    const { alert } = await raiseAlert(deps, { userId: profile.id, tripId: null, reason: 'sos' });
    const before = tg.texts('222').length;

    expect(await resolveFromFamily(deps, { alertId: alert.id, chatId: '222', action: 'ok' })).toEqual({ ok: true });
    expect((await repo.getAlert(alert.id))!.resolvedBy).toBe('Ali');
    expect(tg.texts('111').at(-1)).toContain('Ali');
    expect(tg.texts('222')).toHaveLength(before);
  });

  it('"going" tells others but keeps the alert open', async () => {
    const { deps, repo, tg } = makeDeps();
    const { profile } = await seedUser(repo);
    const { alert } = await raiseAlert(deps, { userId: profile.id, tripId: null, reason: 'sos' });
    await resolveFromFamily(deps, { alertId: alert.id, chatId: '111', action: 'going' });
    expect((await repo.getAlert(alert.id))!.resolvedAt).toBeNull();
    expect(tg.texts('222').at(-1)).toContain('Ammi');
  });

  it('ignores chats that are not contacts of that user', async () => {
    const { deps, repo } = makeDeps();
    const { profile } = await seedUser(repo);
    const { alert } = await raiseAlert(deps, { userId: profile.id, tripId: null, reason: 'sos' });
    expect(await resolveFromFamily(deps, { alertId: alert.id, chatId: '999', action: 'ok' })).toEqual({ ok: false });
    expect(await resolveFromFamily(deps, { alertId: 'nope', chatId: '111', action: 'ok' })).toEqual({ ok: false });
  });
});
```

- [ ] **Step 4: Run — expect FAIL** (`Cannot find module '@/lib/alerts'`)

Run: `npm test -- tests/alerts.test.ts`

- [ ] **Step 5: Create `lib/alerts.ts`**

```ts
import type { Deps } from '@/lib/deps';
import { alertSubject, alertText, familyButtons, familyUpdateText, voicePath } from '@/lib/messages';
import type { NewDelivery } from '@/lib/repo/types';
import type { Alert, AlertReason, Contact, Delivery, Profile, Trip } from '@/lib/types';

export const MAX_ATTEMPTS = 3;

export interface RaiseInput {
  userId: string;
  tripId: string | null;
  reason: AlertReason;
  lat?: number | null;
  lng?: number | null;
}

export interface RaiseResult {
  alert: Alert;
  sent: number;
  failed: number;
}

interface AlertContext {
  alert: Alert;
  profile: Profile;
  trip: Trip | null;
}

const errorMessage = (err: unknown) => (err instanceof Error ? err.message : String(err));

function reachable(contacts: Contact[]): Contact[] {
  return contacts.filter((c) => c.status !== 'blocked');
}

function buildText(deps: Deps, ctx: AlertContext): string {
  return alertText({
    userName: ctx.profile.name,
    reason: ctx.alert.reason,
    at: new Date(ctx.alert.createdAt),
    lat: ctx.alert.lat,
    lng: ctx.alert.lng,
    shareUrl: ctx.trip ? `${deps.appUrl}/t/${ctx.trip.shareToken}` : null,
  });
}

async function sendTelegramAlert(deps: Deps, chatId: string, ctx: AlertContext): Promise<void> {
  const { alert } = ctx;
  const bestEffort = async (fn: () => Promise<void>) => {
    try {
      await fn();
    } catch {
      // Extras must never stop the text alert.
    }
  };
  await bestEffort(() => deps.telegram.sendVoice(chatId, `${deps.appUrl}${voicePath(alert.reason)}`));
  if (alert.lat !== null && alert.lng !== null) {
    const { lat, lng } = alert;
    await bestEffort(() => deps.telegram.sendLocation(chatId, lat, lng));
  }
  if (alert.photoPath) {
    const url = await deps.photoUrl(alert.photoPath).catch(() => null);
    if (url) await bestEffort(() => deps.telegram.sendPhoto(chatId, url));
  }
  const buttons = alert.reason === 'test' ? undefined : familyButtons(alert.id);
  await deps.telegram.sendMessage(chatId, buildText(deps, ctx), buttons);
}

async function sendEmailAlert(deps: Deps, to: string, ctx: AlertContext): Promise<void> {
  let text = buildText(deps, ctx);
  if (ctx.alert.photoPath) {
    const url = await deps.photoUrl(ctx.alert.photoPath).catch(() => null);
    if (url) text += `\n📷 ${url}`;
  }
  await deps.email.send(to, alertSubject(ctx.profile.name, ctx.alert.reason), text);
}

async function attemptDelivery(deps: Deps, delivery: Delivery, contact: Contact | undefined, ctx: AlertContext) {
  try {
    if (!contact) throw new Error('contact no longer exists');
    if (delivery.channel === 'telegram') {
      if (!contact.telegramChatId || contact.status !== 'connected') throw new Error('telegram not connected');
      await sendTelegramAlert(deps, contact.telegramChatId, ctx);
    } else {
      if (!contact.email) throw new Error('no email');
      await sendEmailAlert(deps, contact.email, ctx);
    }
    await deps.repo.updateDelivery(delivery.id, { status: 'sent', attempts: delivery.attempts + 1, lastError: null });
    return true;
  } catch (err) {
    await deps.repo.updateDelivery(delivery.id, {
      status: 'failed', attempts: delivery.attempts + 1, lastError: errorMessage(err),
    });
    return false;
  }
}

export async function raiseAlert(deps: Deps, input: RaiseInput): Promise<RaiseResult> {
  const profile = await deps.repo.getProfile(input.userId);
  if (!profile) throw new Error(`Profile not found: ${input.userId}`);
  const trip = input.tripId ? await deps.repo.getTrip(input.tripId) : null;

  let lat = input.lat ?? null;
  let lng = input.lng ?? null;
  if ((lat === null || lng === null) && trip) {
    const last = await deps.repo.lastLocation(trip.id);
    if (last) ({ lat, lng } = last);
  }

  const alert = await deps.repo.createAlert({
    userId: profile.id,
    tripId: trip?.id ?? null,
    reason: input.reason,
    lat,
    lng,
    photoPath: trip?.vehiclePhotoPath ?? null,
    createdAt: deps.now().toISOString(),
  });

  const contacts = reachable(await deps.repo.listContacts(profile.id));
  const planned: NewDelivery[] = [];
  for (const c of contacts) {
    const base = { alertId: alert.id, contactId: c.id, status: 'pending' as const, attempts: 0, lastError: null };
    if (c.telegramChatId && c.status === 'connected') planned.push({ ...base, channel: 'telegram' });
    if (c.email) planned.push({ ...base, channel: 'email' });
  }
  const deliveries = await deps.repo.createDeliveries(planned);

  const ctx: AlertContext = { alert, profile, trip };
  const results = await Promise.all(
    deliveries.map((d) => attemptDelivery(deps, d, contacts.find((c) => c.id === d.contactId), ctx)),
  );
  const sent = results.filter(Boolean).length;
  return { alert, sent, failed: results.length - sent };
}

export async function retryDeliveries(deps: Deps): Promise<{ retried: number; sent: number }> {
  const pending = await deps.repo.listRetryableDeliveries(MAX_ATTEMPTS);
  let sent = 0;
  const contexts = new Map<string, AlertContext | null>();
  for (const d of pending) {
    if (!contexts.has(d.alertId)) {
      const alert = await deps.repo.getAlert(d.alertId);
      const profile = alert ? await deps.repo.getProfile(alert.userId) : null;
      const trip = alert?.tripId ? await deps.repo.getTrip(alert.tripId) : null;
      contexts.set(d.alertId, alert && profile ? { alert, profile, trip } : null);
    }
    const ctx = contexts.get(d.alertId);
    if (!ctx) continue;
    const contact = (await deps.repo.getContact(d.contactId)) ?? undefined;
    if (await attemptDelivery(deps, d, contact, ctx)) sent++;
  }
  return { retried: pending.length, sent };
}

/** Plain notice to every reachable contact. Best effort: never throws. Returns how many sends worked. */
export async function notifyContacts(deps: Deps, userId: string, text: string, exceptContactId?: string): Promise<number> {
  const contacts = reachable(await deps.repo.listContacts(userId)).filter((c) => c.id !== exceptContactId);
  const sends: Promise<void>[] = [];
  for (const c of contacts) {
    if (c.telegramChatId && c.status === 'connected') sends.push(deps.telegram.sendMessage(c.telegramChatId, text));
    if (c.email) sends.push(deps.email.send(c.email, 'Beti AI', text));
  }
  const results = await Promise.allSettled(sends);
  return results.filter((r) => r.status === 'fulfilled').length;
}

export async function resolveFromFamily(
  deps: Deps,
  input: { alertId: string; chatId: string; action: 'going' | 'ok' },
): Promise<{ ok: boolean }> {
  const alert = await deps.repo.getAlert(input.alertId);
  if (!alert) return { ok: false };
  const contact = (await deps.repo.listContactsByChatId(input.chatId)).find((c) => c.userId === alert.userId);
  if (!contact) return { ok: false };
  const profile = await deps.repo.getProfile(alert.userId);
  if (!profile) return { ok: false };
  if (input.action === 'ok') await deps.repo.resolveAlert(alert.id, contact.name, deps.now());
  await notifyContacts(deps, alert.userId, familyUpdateText(profile.name, contact.name, input.action), contact.id);
  return { ok: true };
}
```

- [ ] **Step 6: Run — expect PASS**

Run: `npm test -- tests/alerts.test.ts`

- [ ] **Step 7: Commit**

```bash
git add lib/deps.ts lib/alerts.ts tests/helpers/fakes.ts tests/alerts.test.ts
git commit -m "feat: add alert engine with per-channel delivery, retry and family replies" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---


### Task 6: Trips, PIN guard, Dead-Man's Switch and `/help` logic

**Files:**
- Create: `lib/durations.ts`, `lib/time.ts`, `lib/token.ts`, `lib/guard.ts`, `lib/trips.ts`, `lib/help.ts`
- Test: `tests/trips.test.ts`, `tests/help.test.ts`

**Interfaces:**
- Consumes: `Deps` (Task 5), `raiseAlert`, `notifyContacts`, `retryDeliveries` (Task 5), `evaluatePin` (Task 2), `normalizePkPhone` (Task 2), `safeText`, `phoneLostText` (Task 4).
- Produces:
  - `lib/durations.ts`: `TRIP_DURATIONS = [10, 20, 30, 60] as const` (client-safe; `lib/trips.ts` re-exports it)
  - `lib/time.ts`: `SHARE_TTL_HOURS = 24`, `addMinutes(date, minutes): Date`, `shareExpiry(now): string`
  - `lib/token.ts`: `randomToken(): string` (16 random bytes, base64url)
  - `lib/guard.ts`: `type GuardResult = 'ok' | 'duress' | 'wrong' | 'locked'`; `verifyPin(deps, profile, pin): Promise<GuardResult>`. Side effects: duress → open trip becomes `safe` (share link kept 24 h) and a `duress` alert is raised; third wrong PIN → open `active` trip becomes `alerted`, a `wrong_pin` alert is raised, result `'locked'`.
  - `lib/trips.ts`:
    - `TRIP_DURATIONS = [10, 20, 30, 60]`, `EXTEND_MINUTES = 10`, `MAX_POINTS_PER_BATCH = 100`
    - `class TripError extends Error { code: 'invalid_duration' | 'trip_open' | 'not_found' | 'bad_photo' | 'not_active' }`
    - `parseCoord(value: unknown, limit: number): number | null`
    - `startTrip(deps, userId, { durationMin: number; vehiclePhotoPath: string | null }): Promise<Trip>`
    - `recordLocations(deps, userId, tripId, points: unknown): Promise<{ saved: number; status: TripStatus; deadlineAt: string }>`
    - `finishTrip(deps, userId, tripId, pin): Promise<{ status: 'safe' | 'wrong' | 'locked' }>`
    - `extendTrip(deps, userId, tripId, pin): Promise<{ status: 'extended'; deadlineAt: string } | { status: 'wrong' | 'locked' }>`
    - `sendSos(deps, userId, { reason: 'sos' | 'calculator'; lat: number | null; lng: number | null }): Promise<RaiseResult>`
    - `expireDueTrips(deps): Promise<{ expired: number; retried: number }>`
    - `interface LiveView { name: string; status: TripStatus; deadlineAt: string; last: LocationPoint | null }`; `getLiveView(deps, token): Promise<LiveView | null>`
  - `lib/help.ts`: `type HelpAction = 'help' | 'ok'`; `helpFromAnyPhone(deps, { phone: string; pin: string; action: HelpAction; callbackNumber: string | null }): Promise<{ status: 'done' | 'wrong' | 'locked' }>`

- [ ] **Step 1: Write failing `tests/trips.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import {
  expireDueTrips, extendTrip, finishTrip, getLiveView, recordLocations, sendSos, startTrip, TripError,
} from '@/lib/trips';
import { makeDeps, seedUser } from './helpers/fakes';

async function setup() {
  const ctx = makeDeps();
  const seeded = await seedUser(ctx.repo);
  const trip = await startTrip(ctx.deps, seeded.profile.id, { durationMin: 20, vehiclePhotoPath: null });
  return { ...ctx, ...seeded, trip };
}

describe('startTrip', () => {
  it('sets the deadline and a 128-bit share token', async () => {
    const { trip } = await setup();
    expect(trip.status).toBe('active');
    expect(trip.deadlineAt).toBe('2026-10-01T10:20:00.000Z');
    expect(trip.shareToken).toMatch(/^[A-Za-z0-9_-]{22}$/);
  });

  it('rejects durations that are not offered', async () => {
    const { deps, repo } = makeDeps();
    const { profile } = await seedUser(repo);
    await expect(startTrip(deps, profile.id, { durationMin: 15, vehiclePhotoPath: null })).rejects.toThrow(TripError);
  });

  it('rejects a second trip while one is open', async () => {
    const { deps, profile } = await setup();
    await expect(startTrip(deps, profile.id, { durationMin: 10, vehiclePhotoPath: null })).rejects.toThrow('trip_open');
  });

  it("rejects someone else's photo path", async () => {
    const { deps, repo } = makeDeps();
    const { profile } = await seedUser(repo);
    await expect(startTrip(deps, profile.id, { durationMin: 10, vehiclePhotoPath: 'other-user/x.jpg' })).rejects.toThrow('bad_photo');
  });
});

describe('recordLocations', () => {
  it('keeps valid points and drops garbage', async () => {
    const { deps, repo, profile, trip } = await setup();
    const r = await recordLocations(deps, profile.id, trip.id, [
      { lat: 24.86, lng: 67.0, accuracyM: 8, recordedAt: '2026-10-01T10:01:00.000Z' },
      { lat: 'x', lng: 67 },
      { lat: 95, lng: 67 },
      { lat: Number.NaN, lng: 67 },
      null,
      { lat: 24.9, lng: 67.1, accuracyM: -3, recordedAt: '2099-01-01T00:00:00.000Z' },
    ]);
    expect(r).toEqual({ saved: 2, status: 'active', deadlineAt: trip.deadlineAt });
    const stored = repo.data.locations.get(trip.id)!;
    expect(stored[1]).toEqual({ lat: 24.9, lng: 67.1, accuracyM: null, recordedAt: '2026-10-01T10:00:00.000Z' });
  });

  it('caps a batch at 100 points and ignores non-arrays', async () => {
    const { deps, profile, trip } = await setup();
    const many = Array.from({ length: 500 }, () => ({ lat: 24, lng: 67 }));
    expect((await recordLocations(deps, profile.id, trip.id, many)).saved).toBe(100);
    expect((await recordLocations(deps, profile.id, trip.id, 'nope')).saved).toBe(0);
  });

  it("refuses another user's trip", async () => {
    const { deps, trip } = await setup();
    await expect(recordLocations(deps, 'intruder', trip.id, [])).rejects.toThrow('not_found');
  });
});

describe('finishTrip', () => {
  it('safe PIN ends the trip and tells the family', async () => {
    const { deps, repo, tg, profile, trip } = await setup();
    expect(await finishTrip(deps, profile.id, trip.id, '1234')).toEqual({ status: 'safe' });
    const t = (await repo.getTrip(trip.id))!;
    expect(t.status).toBe('safe');
    expect(t.shareExpiresAt).toBe('2026-10-02T10:00:00.000Z');
    expect(tg.texts('111').at(-1)).toContain('reached safely');
    expect(repo.data.alerts).toHaveLength(0);
  });

  it('duress PIN looks exactly like safe but raises a silent alert', async () => {
    const { deps, repo, profile, trip } = await setup();
    expect(await finishTrip(deps, profile.id, trip.id, '9999')).toEqual({ status: 'safe' });
    expect((await repo.getTrip(trip.id))!.status).toBe('safe');
    expect(repo.data.alerts.map((a) => a.reason)).toEqual(['duress']);
    expect(repo.data.alerts[0].tripId).toBe(trip.id);
  });

  it('third wrong PIN alerts the family and locks', async () => {
    const { deps, repo, profile, trip } = await setup();
    expect(await finishTrip(deps, profile.id, trip.id, '0000')).toEqual({ status: 'wrong' });
    expect(await finishTrip(deps, profile.id, trip.id, '1111')).toEqual({ status: 'wrong' });
    expect(await finishTrip(deps, profile.id, trip.id, '2222')).toEqual({ status: 'locked' });
    expect(repo.data.alerts.map((a) => a.reason)).toEqual(['wrong_pin']);
    expect((await repo.getTrip(trip.id))!.status).toBe('alerted');
    expect(await finishTrip(deps, profile.id, trip.id, '1234')).toEqual({ status: 'locked' });
  });

  it('after a timer alert, finishing sends a false-alarm follow-up and resolves the alert', async () => {
    const { deps, repo, tg, profile, trip, advance } = await setup();
    advance(21);
    await expireDueTrips(deps);
    expect(await finishTrip(deps, profile.id, trip.id, '1234')).toEqual({ status: 'safe' });
    expect((await repo.getTrip(trip.id))!.status).toBe('safe');
    expect(repo.data.alerts[0].resolvedBy).toBe('Ayesha');
    expect(tg.texts('111').at(-1)).toContain('False alarm');
  });
});

describe('expireDueTrips (Dead-Man\'s Switch)', () => {
  it('does nothing before the deadline', async () => {
    const { deps, repo, advance } = await setup();
    advance(19);
    expect(await expireDueTrips(deps)).toEqual({ expired: 0, retried: 0 });
    expect(repo.data.alerts).toHaveLength(0);
  });

  it('alerts exactly once after the deadline', async () => {
    const { deps, repo, trip, advance } = await setup();
    advance(21);
    expect((await expireDueTrips(deps)).expired).toBe(1);
    expect((await expireDueTrips(deps)).expired).toBe(0);
    expect(repo.data.alerts.map((a) => a.reason)).toEqual(['timer']);
    expect((await repo.getTrip(trip.id))!.status).toBe('alerted');
  });

  it('timer and "safe" in the same minute produce one alert plus a follow-up', async () => {
    const { deps, repo, tg, profile, trip, advance } = await setup();
    advance(21);
    const [cron, finish] = await Promise.all([expireDueTrips(deps), finishTrip(deps, profile.id, trip.id, '1234')]);
    expect(finish).toEqual({ status: 'safe' });
    expect(repo.data.alerts.length).toBe(cron.expired);
    expect((await repo.getTrip(trip.id))!.status).toBe('safe');
    if (cron.expired === 1) expect(tg.texts('111').at(-1)).toContain('False alarm');
  });

  it('puts the trip back to active if raising the alert crashes, so the next run retries', async () => {
    const { deps, repo, trip, advance } = await setup();
    advance(21);
    const original = repo.createAlert;
    repo.createAlert = async () => {
      throw new Error('db down');
    };
    expect((await expireDueTrips(deps)).expired).toBe(1);
    expect((await repo.getTrip(trip.id))!.status).toBe('active');
    repo.createAlert = original;
    expect((await expireDueTrips(deps)).expired).toBe(1);
    expect(repo.data.alerts.map((a) => a.reason)).toEqual(['timer']);
  });
});

describe('extendTrip', () => {
  it('adds 10 minutes with the right PIN', async () => {
    const { deps, profile, trip } = await setup();
    expect(await extendTrip(deps, profile.id, trip.id, '1234')).toEqual({
      status: 'extended', deadlineAt: '2026-10-01T10:30:00.000Z',
    });
  });

  it('refuses without the right PIN', async () => {
    const { deps, profile, trip } = await setup();
    expect(await extendTrip(deps, profile.id, trip.id, '0000')).toEqual({ status: 'wrong' });
  });
});

describe('sendSos', () => {
  it('alerts immediately and marks the open trip alerted', async () => {
    const { deps, repo, profile, trip } = await setup();
    const r = await sendSos(deps, profile.id, { reason: 'sos', lat: 24.8, lng: 67.1 });
    expect(r.sent).toBe(3);
    expect((await repo.getTrip(trip.id))!.status).toBe('alerted');
    expect(repo.data.alerts[0]).toMatchObject({ reason: 'sos', lat: 24.8, lng: 67.1, tripId: trip.id });
  });
});

describe('getLiveView', () => {
  it('shows the last point and expires 24h after the trip ends', async () => {
    const { deps, profile, trip, advance } = await setup();
    await recordLocations(deps, profile.id, trip.id, [{ lat: 24.86, lng: 67.0 }]);
    expect(await getLiveView(deps, trip.shareToken)).toMatchObject({ name: 'Ayesha', status: 'active', last: { lat: 24.86 } });
    await finishTrip(deps, profile.id, trip.id, '1234');
    advance(24 * 60 + 1);
    expect(await getLiveView(deps, trip.shareToken)).toBeNull();
    expect(await getLiveView(deps, 'unknown')).toBeNull();
  });
});
```

- [ ] **Step 2: Write failing `tests/help.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { helpFromAnyPhone } from '@/lib/help';
import { startTrip } from '@/lib/trips';
import { makeDeps, seedUser } from './helpers/fakes';

describe('helpFromAnyPhone', () => {
  it('answers "wrong" for unknown or junk phone numbers', async () => {
    const { deps, repo } = makeDeps();
    await seedUser(repo);
    for (const phone of ['', 'abc', '03339999999']) {
      expect(await helpFromAnyPhone(deps, { phone, pin: '1234', action: 'help', callbackNumber: null })).toEqual({ status: 'wrong' });
    }
    expect(repo.data.alerts).toHaveLength(0);
  });

  it('"help" raises a help_page alert (any phone format works)', async () => {
    const { deps, repo } = makeDeps();
    await seedUser(repo);
    const r = await helpFromAnyPhone(deps, { phone: '0300-1234567', pin: '1234', action: 'help', callbackNumber: null });
    expect(r).toEqual({ status: 'done' });
    expect(repo.data.alerts.map((a) => a.reason)).toEqual(['help_page']);
  });

  it('"ok" ends the open trip, resolves alerts and shares the callback number', async () => {
    const { deps, repo, tg } = makeDeps();
    const { profile } = await seedUser(repo);
    const trip = await startTrip(deps, profile.id, { durationMin: 10, vehiclePhotoPath: null });
    const r = await helpFromAnyPhone(deps, {
      phone: '+92 300 1234567', pin: '1234', action: 'ok', callbackNumber: '0321-5555555 <script>',
    });
    expect(r).toEqual({ status: 'done' });
    expect((await repo.getTrip(trip.id))!.status).toBe('safe');
    const last = tg.texts('111').at(-1)!;
    expect(last).toContain('phone was stolen');
    expect(last).toContain('0321-5555555');
    expect(last).not.toContain('<script>');
  });

  it('duress PIN answers "done" but raises a duress alert', async () => {
    const { deps, repo } = makeDeps();
    await seedUser(repo);
    const r = await helpFromAnyPhone(deps, { phone: '03001234567', pin: '9999', action: 'ok', callbackNumber: null });
    expect(r).toEqual({ status: 'done' });
    expect(repo.data.alerts.map((a) => a.reason)).toEqual(['duress']);
  });

  it('locks after three wrong PINs', async () => {
    const { deps, repo } = makeDeps();
    await seedUser(repo);
    const input = { phone: '03001234567', pin: '0000', action: 'help' as const, callbackNumber: null };
    await helpFromAnyPhone(deps, input);
    await helpFromAnyPhone(deps, input);
    expect(await helpFromAnyPhone(deps, input)).toEqual({ status: 'locked' });
    expect(await helpFromAnyPhone(deps, { ...input, pin: '1234' })).toEqual({ status: 'locked' });
    expect(repo.data.alerts.map((a) => a.reason)).toEqual(['wrong_pin']);
  });
});
```

- [ ] **Step 3: Run — expect FAIL** (modules missing)

Run: `npm test -- tests/trips.test.ts tests/help.test.ts`

- [ ] **Step 4: Create `lib/durations.ts`, `lib/time.ts` and `lib/token.ts`**

```ts
// lib/durations.ts — no imports, safe to use in client components.
export const TRIP_DURATIONS = [10, 20, 30, 60] as const;
```

```ts
// lib/time.ts
export const SHARE_TTL_HOURS = 24;

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

/** When a finished trip's live link stops working. */
export function shareExpiry(now: Date): string {
  return addMinutes(now, SHARE_TTL_HOURS * 60).toISOString();
}
```

```ts
// lib/token.ts
import { randomBytes } from 'node:crypto';

/** 128-bit random, URL-safe. */
export function randomToken(): string {
  return randomBytes(16).toString('base64url');
}
```

- [ ] **Step 5: Create `lib/guard.ts`**

```ts
import { raiseAlert } from '@/lib/alerts';
import type { Deps } from '@/lib/deps';
import { evaluatePin } from '@/lib/pin';
import { shareExpiry } from '@/lib/time';
import type { Profile } from '@/lib/types';

export type GuardResult = 'ok' | 'duress' | 'wrong' | 'locked';

/**
 * Checks a PIN and performs the safety side effects:
 * - duress: the open trip looks finished, but a silent `duress` alert goes out;
 * - third wrong PIN: the open trip is marked alerted and a `wrong_pin` alert goes out.
 */
export async function verifyPin(deps: Deps, profile: Profile, pin: string): Promise<GuardResult> {
  const now = deps.now();
  const { outcome, next } = await evaluatePin(profile, pin, now);
  if (outcome === 'locked') return 'locked';
  await deps.repo.updatePinState(profile.id, next);
  if (outcome === 'safe') return 'ok';
  if (outcome === 'wrong') return 'wrong';

  const open = await deps.repo.getOpenTrip(profile.id);
  if (outcome === 'duress') {
    if (open) await deps.repo.transitionTrip(open.id, open.status, 'safe', { shareExpiresAt: shareExpiry(now) });
    await raiseAlert(deps, { userId: profile.id, tripId: open?.id ?? null, reason: 'duress' });
    return 'duress';
  }

  if (open?.status === 'active') await deps.repo.transitionTrip(open.id, 'active', 'alerted');
  await raiseAlert(deps, { userId: profile.id, tripId: open?.id ?? null, reason: 'wrong_pin' });
  return 'locked';
}
```

- [ ] **Step 6: Create `lib/trips.ts`**

```ts
import { notifyContacts, raiseAlert, retryDeliveries, type RaiseResult } from '@/lib/alerts';
import type { Deps } from '@/lib/deps';
import { TRIP_DURATIONS } from '@/lib/durations';
import { verifyPin } from '@/lib/guard';
import { safeText } from '@/lib/messages';
import { addMinutes, shareExpiry } from '@/lib/time';
import { randomToken } from '@/lib/token';
import type { LocationPoint, Profile, Trip, TripStatus } from '@/lib/types';

export { TRIP_DURATIONS };
export const EXTEND_MINUTES = 10;
export const MAX_POINTS_PER_BATCH = 100;

export type TripErrorCode = 'invalid_duration' | 'trip_open' | 'not_found' | 'bad_photo' | 'not_active';

export class TripError extends Error {
  constructor(public code: TripErrorCode) {
    super(code);
  }
}

export function parseCoord(value: unknown, limit: number): number | null {
  return typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= limit ? value : null;
}

async function ownTrip(deps: Deps, userId: string, tripId: string): Promise<Trip> {
  const trip = await deps.repo.getTrip(tripId);
  if (!trip || trip.userId !== userId) throw new TripError('not_found');
  return trip;
}

async function requireProfile(deps: Deps, userId: string): Promise<Profile> {
  const profile = await deps.repo.getProfile(userId);
  if (!profile) throw new TripError('not_found');
  return profile;
}

export async function startTrip(
  deps: Deps,
  userId: string,
  input: { durationMin: number; vehiclePhotoPath: string | null },
): Promise<Trip> {
  if (!(TRIP_DURATIONS as readonly number[]).includes(input.durationMin)) throw new TripError('invalid_duration');
  if (input.vehiclePhotoPath && !input.vehiclePhotoPath.startsWith(`${userId}/`)) throw new TripError('bad_photo');
  await requireProfile(deps, userId);
  if (await deps.repo.getOpenTrip(userId)) throw new TripError('trip_open');
  const now = deps.now();
  return deps.repo.createTrip({
    userId,
    vehiclePhotoPath: input.vehiclePhotoPath,
    durationMin: input.durationMin,
    startedAt: now.toISOString(),
    deadlineAt: addMinutes(now, input.durationMin).toISOString(),
    status: 'active',
    shareToken: randomToken(),
    shareExpiresAt: null,
  });
}

export async function recordLocations(
  deps: Deps,
  userId: string,
  tripId: string,
  points: unknown,
): Promise<{ saved: number; status: TripStatus; deadlineAt: string }> {
  const trip = await ownTrip(deps, userId, tripId);
  const result = { saved: 0, status: trip.status, deadlineAt: trip.deadlineAt };
  if (trip.status === 'safe' || !Array.isArray(points)) return result;

  const now = deps.now();
  const clean: LocationPoint[] = [];
  for (const raw of points.slice(-MAX_POINTS_PER_BATCH)) {
    if (!raw || typeof raw !== 'object') continue;
    const p = raw as Record<string, unknown>;
    const lat = parseCoord(p.lat, 90);
    const lng = parseCoord(p.lng, 180);
    if (lat === null || lng === null) continue;
    const accuracyM =
      typeof p.accuracyM === 'number' && Number.isFinite(p.accuracyM) && p.accuracyM >= 0 ? p.accuracyM : null;
    const when = typeof p.recordedAt === 'string' ? new Date(p.recordedAt) : null;
    const recordedAt = when && !Number.isNaN(when.getTime()) && when <= now ? when.toISOString() : now.toISOString();
    clean.push({ lat, lng, accuracyM, recordedAt });
  }
  await deps.repo.addLocations(trip.id, clean);
  return { ...result, saved: clean.length };
}

export async function finishTrip(
  deps: Deps,
  userId: string,
  tripId: string,
  pin: string,
): Promise<{ status: 'safe' | 'wrong' | 'locked' }> {
  const trip = await ownTrip(deps, userId, tripId);
  const profile = await requireProfile(deps, userId);
  const guard = await verifyPin(deps, profile, pin);
  if (guard === 'wrong' || guard === 'locked') return { status: guard };
  if (guard === 'duress') return { status: 'safe' };

  const expires = shareExpiry(deps.now());
  if (await deps.repo.transitionTrip(trip.id, 'active', 'safe', { shareExpiresAt: expires })) {
    await notifyContacts(deps, userId, safeText(profile.name, false));
  } else if (await deps.repo.transitionTrip(trip.id, 'alerted', 'safe', { shareExpiresAt: expires })) {
    const open = await deps.repo.latestOpenAlert(userId);
    if (open) await deps.repo.resolveAlert(open.id, profile.name, deps.now());
    await notifyContacts(deps, userId, safeText(profile.name, true));
  }
  return { status: 'safe' };
}

export async function extendTrip(
  deps: Deps,
  userId: string,
  tripId: string,
  pin: string,
): Promise<{ status: 'extended'; deadlineAt: string } | { status: 'wrong' | 'locked' }> {
  const trip = await ownTrip(deps, userId, tripId);
  const profile = await requireProfile(deps, userId);
  const guard = await verifyPin(deps, profile, pin);
  if (guard === 'wrong' || guard === 'locked') return { status: guard };

  const base = Math.max(new Date(trip.deadlineAt).getTime(), deps.now().getTime());
  const deadlineAt = addMinutes(new Date(base), EXTEND_MINUTES).toISOString();
  if (guard === 'duress') return { status: 'extended', deadlineAt };

  const updated = await deps.repo.transitionTrip(trip.id, 'active', 'active', { deadlineAt });
  if (!updated) throw new TripError('not_active');
  return { status: 'extended', deadlineAt: new Date(updated.deadlineAt).toISOString() };
}

export async function sendSos(
  deps: Deps,
  userId: string,
  input: { reason: 'sos' | 'calculator'; lat: number | null; lng: number | null },
): Promise<RaiseResult> {
  const open = await deps.repo.getOpenTrip(userId);
  if (open?.status === 'active') await deps.repo.transitionTrip(open.id, 'active', 'alerted');
  return raiseAlert(deps, { userId, tripId: open?.id ?? null, reason: input.reason, lat: input.lat, lng: input.lng });
}

/** Runs every minute from Supabase pg_cron. */
export async function expireDueTrips(deps: Deps): Promise<{ expired: number; retried: number }> {
  const retry = await retryDeliveries(deps);
  const due = await deps.repo.claimDueTrips(deps.now());
  for (const trip of due) {
    try {
      await raiseAlert(deps, { userId: trip.userId, tripId: trip.id, reason: 'timer' });
    } catch (err) {
      console.error('timer alert failed; will retry next run', trip.id, err);
      await deps.repo.transitionTrip(trip.id, 'alerted', 'active');
    }
  }
  return { expired: due.length, retried: retry.retried };
}

export interface LiveView {
  name: string;
  status: TripStatus;
  deadlineAt: string;
  last: LocationPoint | null;
}

export async function getLiveView(deps: Deps, token: string): Promise<LiveView | null> {
  const trip = await deps.repo.getTripByShareToken(token);
  if (!trip) return null;
  if (trip.shareExpiresAt && new Date(trip.shareExpiresAt) < deps.now()) return null;
  const profile = await deps.repo.getProfile(trip.userId);
  if (!profile) return null;
  return {
    name: profile.name,
    status: trip.status,
    deadlineAt: trip.deadlineAt,
    last: await deps.repo.lastLocation(trip.id),
  };
}
```

- [ ] **Step 7: Create `lib/help.ts`**

```ts
import { notifyContacts, raiseAlert } from '@/lib/alerts';
import type { Deps } from '@/lib/deps';
import { verifyPin } from '@/lib/guard';
import { phoneLostText } from '@/lib/messages';
import { normalizePkPhone } from '@/lib/phone';
import { shareExpiry } from '@/lib/time';

export type HelpAction = 'help' | 'ok';

function cleanCallback(value: string | null): string | null {
  if (!value) return null;
  const cleaned = value.replace(/[^\d+ -]/g, '').trim().slice(0, 20);
  return cleaned || null;
}

/** The /help page: works from any phone with the user's number + PIN. */
export async function helpFromAnyPhone(
  deps: Deps,
  input: { phone: string; pin: string; action: HelpAction; callbackNumber: string | null },
): Promise<{ status: 'done' | 'wrong' | 'locked' }> {
  const phone = normalizePkPhone(input.phone);
  const profile = phone ? await deps.repo.getProfileByPhone(phone) : null;
  if (!profile) return { status: 'wrong' };

  const guard = await verifyPin(deps, profile, input.pin);
  if (guard === 'wrong' || guard === 'locked') return { status: guard };
  if (guard === 'duress') return { status: 'done' };

  const open = await deps.repo.getOpenTrip(profile.id);
  if (input.action === 'help') {
    if (open?.status === 'active') await deps.repo.transitionTrip(open.id, 'active', 'alerted');
    await raiseAlert(deps, { userId: profile.id, tripId: open?.id ?? null, reason: 'help_page' });
    return { status: 'done' };
  }

  if (open) await deps.repo.transitionTrip(open.id, open.status, 'safe', { shareExpiresAt: shareExpiry(deps.now()) });
  const alert = await deps.repo.latestOpenAlert(profile.id);
  if (alert) await deps.repo.resolveAlert(alert.id, profile.name, deps.now());
  await notifyContacts(deps, profile.id, phoneLostText(profile.name, cleanCallback(input.callbackNumber)));
  return { status: 'done' };
}
```

- [ ] **Step 8: Run — expect PASS**

Run: `npm test -- tests/trips.test.ts tests/help.test.ts`

- [ ] **Step 9: Run the whole suite**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 10: Commit**

```bash
git add lib/durations.ts lib/time.ts lib/token.ts lib/guard.ts lib/trips.ts lib/help.ts tests/trips.test.ts tests/help.test.ts
git commit -m "feat: add trips, dead-man's switch, PIN guard and /help logic" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---


### Task 7: Account logic, Supabase auth wiring, account API routes

**Files:**
- Create: `lib/relations.ts`, `lib/account.ts`, `lib/supabase/server.ts`, `lib/supabase/browser.ts`, `lib/supabase/admin.ts`, `lib/auth.ts`, `lib/server-deps.ts`, `lib/api.ts`, `proxy.ts`, `app/auth/callback/route.ts`, `app/api/me/route.ts`, `app/api/profile/route.ts`, `app/api/pin/check/route.ts`, `app/api/contacts/route.ts`, `app/api/contacts/[id]/route.ts`, `app/api/alerts/test/route.ts`
- Test: `tests/account.test.ts`, `tests/account-routes.test.ts`

**Interfaces:**
- Consumes: Tasks 2–6.
- Produces:
  - `lib/relations.ts`: `RELATIONS: { id: Relation; icon: string; ur: string; en: string }[]`
  - `lib/account.ts`:
    - `class AccountError extends Error { code: AccountErrorCode }` with codes `'bad_name' | 'bad_phone' | 'bad_pin' | 'same_pins' | 'phone_taken' | 'pin_required' | 'wrong_pin' | 'locked' | 'bad_contact' | 'too_many' | 'not_found'`
    - `MAX_CONTACTS = 5`
    - `setupProfile(deps, userId, { name, phone, safePin, duressPin }: Record<string, unknown>): Promise<void>`
    - `checkUserPin(deps, userId, pin: string): Promise<'ok' | 'wrong' | 'locked'>` (duress maps to `'ok'`)
    - `addContact(deps, userId, input: Record<string, unknown>): Promise<Contact>` (needs `pin`)
    - `removeContact(deps, userId, contactId, pin: unknown): Promise<void>`
    - `interface Overview { profile: { name; phone; lang; hasPin } | null; contacts: { id; name; relation; phone; email; status; inviteLink }[]; openTrip: { id; status; deadlineAt; durationMin; startedAt } | null }`
    - `getOverview(deps, userId): Promise<Overview>`
    - `sendTestAlert(deps, userId): Promise<{ sent: number; failed: number }>`
  - `lib/api.ts`: `json(data, status?)`, `readJson(req): Promise<Record<string, unknown>>`, `errorResponse(err): Response`, `withUser(handler: (userId: string) => Promise<Response>): Promise<Response>`
  - `lib/auth.ts`: `currentUserId(): Promise<string | null>`
  - `lib/server-deps.ts`: `getDeps(): Deps`
  - `lib/supabase/browser.ts`: `createSupabaseBrowser()`; `lib/supabase/server.ts`: `createSupabaseServer()`; `lib/supabase/admin.ts`: `createSupabaseAdmin()`
  - HTTP: `GET /api/me` → `Overview`; `POST /api/profile`; `POST /api/pin/check` → `{ status }`; `POST /api/contacts` → `{ contact: { id } }`; `DELETE /api/contacts/[id]` (body `{ pin }`); `POST /api/alerts/test` → `{ sent, failed }`. Errors are `{ error: code }` with 400 (validation), 401 (no session), 403 (`wrong_pin`), 404 (`not_found`), 423 (`locked`), 500 (`server_error`).

- [ ] **Step 1: Create `lib/relations.ts`**

```ts
import type { Relation } from '@/lib/types';

export const RELATIONS: { id: Relation; icon: string; ur: string; en: string }[] = [
  { id: 'mother', icon: '👩', ur: 'امی', en: 'Mother' },
  { id: 'father', icon: '👨', ur: 'ابو', en: 'Father' },
  { id: 'brother', icon: '🧑', ur: 'بھائی', en: 'Brother' },
  { id: 'sister', icon: '👧', ur: 'بہن', en: 'Sister' },
  { id: 'husband', icon: '🤵', ur: 'شوہر', en: 'Husband' },
  { id: 'friend', icon: '🤝', ur: 'دوست', en: 'Friend' },
  { id: 'other', icon: '👤', ur: 'دیگر', en: 'Other' },
];
```

- [ ] **Step 2: Write failing `tests/account.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { addContact, checkUserPin, getOverview, removeContact, sendTestAlert, setupProfile } from '@/lib/account';
import { makeDeps, seedUser } from './helpers/fakes';

const valid = { name: ' Ayesha ', phone: '0300-1234567', safePin: '1234', duressPin: '9999' };

describe('setupProfile', () => {
  it('creates a profile with hashed PINs and a normalised phone', async () => {
    const { deps, repo } = makeDeps();
    await setupProfile(deps, 'u1', valid);
    const p = (await repo.getProfile('u1'))!;
    expect(p).toMatchObject({ name: 'Ayesha', phone: '+923001234567', lang: 'ur', failedPinCount: 0 });
    expect(p.safePinHash).not.toBe('1234');
    expect(p.safePinHash).toMatch(/^\$2[aby]\$/);
  });

  it.each([
    [{ ...valid, name: '  ' }, 'bad_name'],
    [{ ...valid, phone: '123' }, 'bad_phone'],
    [{ ...valid, safePin: '12' }, 'bad_pin'],
    [{ ...valid, duressPin: '1234' }, 'same_pins'],
  ])('rejects invalid input %#', async (input, code) => {
    const { deps } = makeDeps();
    await expect(setupProfile(deps, 'u1', input)).rejects.toMatchObject({ code });
  });

  it("rejects another user's phone and refuses to overwrite existing PINs", async () => {
    const { deps, repo } = makeDeps();
    await seedUser(repo);
    await expect(setupProfile(deps, 'u2', valid)).rejects.toMatchObject({ code: 'phone_taken' });
    await expect(setupProfile(deps, 'user-1', { ...valid, phone: '03011111111' })).rejects.toMatchObject({ code: 'pin_required' });
  });
});

describe('contacts', () => {
  it('adds a pending contact with an invite link, only with the PIN', async () => {
    const { deps, repo } = makeDeps();
    const { profile } = await seedUser(repo);
    const input = { pin: '1234', name: 'Sara', relation: 'sister', phone: '03211234567', email: '' };
    await expect(addContact(deps, profile.id, { ...input, pin: '0000' })).rejects.toMatchObject({ code: 'wrong_pin' });
    const c = await addContact(deps, profile.id, input);
    expect(c).toMatchObject({ name: 'Sara', status: 'pending', phone: '+923211234567', email: null, telegramChatId: null });
    const overview = await getOverview(deps, profile.id);
    expect(overview.contacts.find((x) => x.id === c.id)!.inviteLink).toBe(`https://t.me/BetiTestBot?start=${c.inviteToken}`);
  });

  it('validates relation, phone, email and the limit of 5', async () => {
    const { deps, repo } = makeDeps();
    const { profile } = await seedUser(repo);
    const base = { pin: '1234', name: 'X', relation: 'friend', phone: '03211234567', email: '' };
    await expect(addContact(deps, profile.id, { ...base, relation: 'boss' })).rejects.toMatchObject({ code: 'bad_contact' });
    await expect(addContact(deps, profile.id, { ...base, phone: 'x' })).rejects.toMatchObject({ code: 'bad_phone' });
    await expect(addContact(deps, profile.id, { ...base, email: 'not-an-email' })).rejects.toMatchObject({ code: 'bad_contact' });
    await addContact(deps, profile.id, base);
    await addContact(deps, profile.id, base);
    await addContact(deps, profile.id, base);
    await expect(addContact(deps, profile.id, base)).rejects.toMatchObject({ code: 'too_many' });
  });

  it('removes a contact with the PIN', async () => {
    const { deps, repo } = makeDeps();
    const { profile, ali } = await seedUser(repo);
    await expect(removeContact(deps, profile.id, ali.id, '0000')).rejects.toMatchObject({ code: 'wrong_pin' });
    await removeContact(deps, profile.id, ali.id, '1234');
    expect(await repo.getContact(ali.id)).toBeNull();
    await expect(removeContact(deps, profile.id, ali.id, '1234')).rejects.toMatchObject({ code: 'not_found' });
  });
});

describe('checkUserPin / overview / test alert', () => {
  it('duress PIN passes the settings gate but alerts silently', async () => {
    const { deps, repo } = makeDeps();
    const { profile } = await seedUser(repo);
    expect(await checkUserPin(deps, profile.id, '9999')).toBe('ok');
    expect(repo.data.alerts.map((a) => a.reason)).toEqual(['duress']);
  });

  it('overview never exposes PIN hashes', async () => {
    const { deps, repo } = makeDeps();
    const { profile } = await seedUser(repo);
    const o = await getOverview(deps, profile.id);
    expect(o.profile).toEqual({ name: 'Ayesha', phone: '+923001234567', lang: 'ur', hasPin: true });
    expect(JSON.stringify(o)).not.toContain('$2');
    expect(o.openTrip).toBeNull();
  });

  it('test alert reaches everyone', async () => {
    const { deps, repo } = makeDeps();
    const { profile } = await seedUser(repo);
    expect(await sendTestAlert(deps, profile.id)).toEqual({ sent: 3, failed: 0 });
  });
});
```

- [ ] **Step 3: Run — expect FAIL** (`Cannot find module '@/lib/account'`)

Run: `npm test -- tests/account.test.ts`

- [ ] **Step 4: Create `lib/account.ts`**

```ts
import { raiseAlert } from '@/lib/alerts';
import type { Deps } from '@/lib/deps';
import { verifyPin } from '@/lib/guard';
import { normalizePkPhone } from '@/lib/phone';
import { hashPin, isValidPin } from '@/lib/pin';
import { RELATIONS } from '@/lib/relations';
import { randomToken } from '@/lib/token';
import type { Contact, ContactStatus, Lang, Relation, TripStatus } from '@/lib/types';

export type AccountErrorCode =
  | 'bad_name' | 'bad_phone' | 'bad_pin' | 'same_pins' | 'phone_taken' | 'pin_required'
  | 'wrong_pin' | 'locked' | 'bad_contact' | 'too_many' | 'not_found';

export class AccountError extends Error {
  constructor(public code: AccountErrorCode) {
    super(code);
  }
}

export const MAX_CONTACTS = 5;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

export async function setupProfile(deps: Deps, userId: string, input: Record<string, unknown>): Promise<void> {
  const existing = await deps.repo.getProfile(userId);
  if (existing?.safePinHash) throw new AccountError('pin_required');

  const name = text(input.name);
  if (name.length < 1 || name.length > 60) throw new AccountError('bad_name');
  const phone = normalizePkPhone(text(input.phone));
  if (!phone) throw new AccountError('bad_phone');
  const { safePin, duressPin } = input;
  if (!isValidPin(safePin) || !isValidPin(duressPin)) throw new AccountError('bad_pin');
  if (safePin === duressPin) throw new AccountError('same_pins');
  const owner = await deps.repo.getProfileByPhone(phone);
  if (owner && owner.id !== userId) throw new AccountError('phone_taken');

  await deps.repo.saveProfile({
    id: userId,
    name,
    phone,
    safePinHash: await hashPin(safePin),
    duressPinHash: await hashPin(duressPin),
    failedPinCount: 0,
    pinLockedUntil: null,
    lang: existing?.lang ?? 'ur',
  });
}

export async function checkUserPin(deps: Deps, userId: string, pin: string): Promise<'ok' | 'wrong' | 'locked'> {
  const profile = await deps.repo.getProfile(userId);
  if (!profile) throw new AccountError('not_found');
  const result = await verifyPin(deps, profile, pin);
  return result === 'duress' ? 'ok' : result;
}

async function requirePin(deps: Deps, userId: string, pin: unknown): Promise<void> {
  const result = await checkUserPin(deps, userId, typeof pin === 'string' ? pin : '');
  if (result === 'wrong') throw new AccountError('wrong_pin');
  if (result === 'locked') throw new AccountError('locked');
}

export async function addContact(deps: Deps, userId: string, input: Record<string, unknown>): Promise<Contact> {
  await requirePin(deps, userId, input.pin);
  const name = text(input.name);
  if (name.length < 1 || name.length > 40) throw new AccountError('bad_contact');
  const relation = RELATIONS.find((r) => r.id === input.relation)?.id as Relation | undefined;
  if (!relation) throw new AccountError('bad_contact');
  const phone = normalizePkPhone(text(input.phone));
  if (!phone) throw new AccountError('bad_phone');
  const email = text(input.email) || null;
  if (email && !EMAIL_RE.test(email)) throw new AccountError('bad_contact');
  if ((await deps.repo.listContacts(userId)).length >= MAX_CONTACTS) throw new AccountError('too_many');

  return deps.repo.createContact({
    userId, name, relation, phone, email, telegramChatId: null, inviteToken: randomToken(), status: 'pending',
  });
}

export async function removeContact(deps: Deps, userId: string, contactId: string, pin: unknown): Promise<void> {
  await requirePin(deps, userId, pin);
  if (!(await deps.repo.deleteContact(userId, contactId))) throw new AccountError('not_found');
}

export interface Overview {
  profile: { name: string; phone: string; lang: Lang; hasPin: boolean } | null;
  contacts: {
    id: string;
    name: string;
    relation: Relation;
    phone: string | null;
    email: string | null;
    status: ContactStatus;
    inviteLink: string;
  }[];
  openTrip: { id: string; status: TripStatus; deadlineAt: string; durationMin: number; startedAt: string } | null;
}

export async function getOverview(deps: Deps, userId: string): Promise<Overview> {
  const [profile, contacts, trip] = await Promise.all([
    deps.repo.getProfile(userId),
    deps.repo.listContacts(userId),
    deps.repo.getOpenTrip(userId),
  ]);
  return {
    profile: profile ? { name: profile.name, phone: profile.phone, lang: profile.lang, hasPin: !!profile.safePinHash } : null,
    contacts: contacts.map((c) => ({
      id: c.id, name: c.name, relation: c.relation, phone: c.phone, email: c.email, status: c.status,
      inviteLink: `https://t.me/${deps.botUsername}?start=${c.inviteToken}`,
    })),
    openTrip: trip
      ? { id: trip.id, status: trip.status, deadlineAt: trip.deadlineAt, durationMin: trip.durationMin, startedAt: trip.startedAt }
      : null,
  };
}

export async function sendTestAlert(deps: Deps, userId: string): Promise<{ sent: number; failed: number }> {
  const { sent, failed } = await raiseAlert(deps, { userId, tripId: null, reason: 'test' });
  return { sent, failed };
}
```

- [ ] **Step 5: Run — expect PASS**

Run: `npm test -- tests/account.test.ts`

- [ ] **Step 6: Create the Supabase clients**

```ts
// lib/supabase/browser.ts
import { createBrowserClient } from '@supabase/ssr';

export function createSupabaseBrowser() {
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}
```

```ts
// lib/supabase/server.ts
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createSupabaseServer() {
  const cookieStore = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component: proxy.ts refreshes the session instead.
        }
      },
    },
  });
}
```

```ts
// lib/supabase/admin.ts — server only: uses the service-role key.
import { createClient } from '@supabase/supabase-js';
import { serverEnv } from '@/lib/env';

export function createSupabaseAdmin() {
  const env = serverEnv();
  return createClient(env.supabaseUrl, env.supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
```

- [ ] **Step 7: Create `lib/auth.ts`, `lib/server-deps.ts`, `lib/api.ts`**

```ts
// lib/auth.ts
import { createSupabaseServer } from '@/lib/supabase/server';

export async function currentUserId(): Promise<string | null> {
  const supabase = await createSupabaseServer();
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}
```

```ts
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
```

```ts
// lib/api.ts
import { NextResponse } from 'next/server';
import { AccountError } from '@/lib/account';
import { currentUserId } from '@/lib/auth';
import { TripError } from '@/lib/trips';

export function json(data: unknown, status = 200): Response {
  return NextResponse.json(data, { status });
}

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const body = await req.json();
    return body && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

const ACCOUNT_STATUS: Partial<Record<AccountError['code'], number>> = { wrong_pin: 403, locked: 423, not_found: 404 };

export function errorResponse(err: unknown): Response {
  if (err instanceof TripError) return json({ error: err.code }, err.code === 'not_found' ? 404 : 400);
  if (err instanceof AccountError) return json({ error: err.code }, ACCOUNT_STATUS[err.code] ?? 400);
  console.error(err);
  return json({ error: 'server_error' }, 500);
}

export async function withUser(handler: (userId: string) => Promise<Response>): Promise<Response> {
  const userId = await currentUserId();
  if (!userId) return json({ error: 'unauthorized' }, 401);
  try {
    return await handler(userId);
  } catch (err) {
    return errorResponse(err);
  }
}
```

- [ ] **Step 8: Create `proxy.ts`** (Next 16 renamed middleware → proxy; see `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`)

```ts
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/** Keeps the Supabase session fresh and sends signed-out visitors of /app to /login. */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  const { data } = await supabase.auth.getUser();
  if (!data.user && request.nextUrl.pathname.startsWith('/app')) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  matcher: ['/app/:path*', '/api/me', '/api/profile', '/api/pin/:path*', '/api/contacts/:path*', '/api/alerts/:path*', '/api/trips/:path*', '/api/sos'],
};
```

- [ ] **Step 9: Create `app/auth/callback/route.ts`**

```ts
import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  if (code) {
    const supabase = await createSupabaseServer();
    await supabase.auth.exchangeCodeForSession(code);
  }
  return NextResponse.redirect(new URL('/app', url.origin));
}
```

- [ ] **Step 10: Create the account routes**

```ts
// app/api/me/route.ts
import { getOverview } from '@/lib/account';
import { json, withUser } from '@/lib/api';
import { getDeps } from '@/lib/server-deps';

export async function GET() {
  return withUser(async (userId) => json(await getOverview(getDeps(), userId)));
}
```

```ts
// app/api/profile/route.ts
import { setupProfile } from '@/lib/account';
import { json, readJson, withUser } from '@/lib/api';
import { getDeps } from '@/lib/server-deps';

export async function POST(req: Request) {
  return withUser(async (userId) => {
    await setupProfile(getDeps(), userId, await readJson(req));
    return json({ ok: true });
  });
}
```

```ts
// app/api/pin/check/route.ts
import { checkUserPin } from '@/lib/account';
import { json, readJson, withUser } from '@/lib/api';
import { getDeps } from '@/lib/server-deps';

export async function POST(req: Request) {
  return withUser(async (userId) => {
    const body = await readJson(req);
    return json({ status: await checkUserPin(getDeps(), userId, String(body.pin ?? '')) });
  });
}
```

```ts
// app/api/contacts/route.ts
import { addContact } from '@/lib/account';
import { json, readJson, withUser } from '@/lib/api';
import { getDeps } from '@/lib/server-deps';

export async function POST(req: Request) {
  return withUser(async (userId) => {
    const contact = await addContact(getDeps(), userId, await readJson(req));
    return json({ contact: { id: contact.id } }, 201);
  });
}
```

```ts
// app/api/contacts/[id]/route.ts
import { removeContact } from '@/lib/account';
import { json, readJson, withUser } from '@/lib/api';
import { getDeps } from '@/lib/server-deps';

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return withUser(async (userId) => {
    const body = await readJson(req);
    await removeContact(getDeps(), userId, id, body.pin);
    return json({ ok: true });
  });
}
```

```ts
// app/api/alerts/test/route.ts
import { sendTestAlert } from '@/lib/account';
import { json, withUser } from '@/lib/api';
import { getDeps } from '@/lib/server-deps';

export async function POST() {
  return withUser(async (userId) => json(await sendTestAlert(getDeps(), userId)));
}
```

- [ ] **Step 11: Write `tests/account-routes.test.ts`**

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Deps } from '@/lib/deps';
import { makeDeps, seedUser } from './helpers/fakes';

const state = vi.hoisted(() => ({ deps: null as Deps | null, userId: null as string | null }));
vi.mock('@/lib/server-deps', () => ({ getDeps: () => state.deps }));
vi.mock('@/lib/auth', () => ({ currentUserId: async () => state.userId }));

const post = (body: unknown) =>
  new Request('http://test/api', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

describe('account routes', () => {
  beforeEach(async () => {
    const { deps, repo } = makeDeps();
    await seedUser(repo);
    state.deps = deps;
    state.userId = 'user-1';
  });

  it('returns 401 without a session', async () => {
    state.userId = null;
    const { GET } = await import('@/app/api/me/route');
    expect((await GET()).status).toBe(401);
  });

  it('GET /api/me returns the overview', async () => {
    const { GET } = await import('@/app/api/me/route');
    const res = await GET();
    expect(res.status).toBe(200);
    expect((await res.json()).profile.hasPin).toBe(true);
  });

  it('POST /api/contacts maps a wrong PIN to 403 and bad input to 400', async () => {
    const { POST } = await import('@/app/api/contacts/route');
    const base = { pin: '1234', name: 'Sara', relation: 'sister', phone: '03211234567' };
    expect((await POST(post({ ...base, pin: '0000' }))).status).toBe(403);
    const bad = await POST(post({ ...base, phone: 'x' }));
    expect(bad.status).toBe(400);
    expect(await bad.json()).toEqual({ error: 'bad_phone' });
    expect((await POST(post(base))).status).toBe(201);
  });

  it('POST /api/profile survives a non-JSON body', async () => {
    state.userId = 'new-user';
    const { POST } = await import('@/app/api/profile/route');
    const res = await POST(new Request('http://test/api', { method: 'POST', body: 'not json' }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'bad_name' });
  });
});
```

- [ ] **Step 12: Run — expect PASS**

Run: `npm test -- tests/account.test.ts tests/account-routes.test.ts`

- [ ] **Step 13: Type-check and build**

Run: `npx tsc --noEmit && npm run build`
Expected: no type errors; the build lists the new `/api/*` routes and `ƒ Proxy`.

- [ ] **Step 14: Commit**

```bash
git add lib/relations.ts lib/account.ts lib/supabase lib/auth.ts lib/server-deps.ts lib/api.ts proxy.ts app/auth app/api/me app/api/profile app/api/pin app/api/contacts app/api/alerts tests/account.test.ts tests/account-routes.test.ts
git commit -m "feat: add account logic, Supabase auth wiring and account API" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---


### Task 8: Trip, SOS, help, cron, live-view and health routes

**Files:**
- Create: `lib/secret.ts`, `app/api/trips/route.ts`, `app/api/trips/[id]/location/route.ts`, `app/api/trips/[id]/finish/route.ts`, `app/api/trips/[id]/extend/route.ts`, `app/api/sos/route.ts`, `app/api/help/route.ts`, `app/api/cron/deadlines/route.ts`, `app/api/t/[token]/route.ts`, `app/api/health/route.ts`
- Test: `tests/trip-routes.test.ts`

**Interfaces:**
- Consumes: `lib/trips.ts`, `lib/help.ts` (Task 6); `json`, `readJson`, `withUser`, `errorResponse` (Task 7); `serverEnv` (Task 1).
- Produces:
  - `lib/secret.ts`: `safeEqual(given: string | null | undefined, expected: string): boolean` (constant time)
  - HTTP (all JSON):
    - `POST /api/trips` `{ durationMin, vehiclePhotoPath }` → 201 `{ trip: { id, status, deadlineAt } }`
    - `POST /api/trips/[id]/location` `{ points }` → `{ saved, status, deadlineAt }`
    - `POST /api/trips/[id]/finish` `{ pin }` → 200 `{ status: 'safe' | 'wrong' | 'locked' }` (duress returns the exact same body as safe)
    - `POST /api/trips/[id]/extend` `{ pin }` → 200 `{ status: 'extended', deadlineAt } | { status: 'wrong' | 'locked' }`
    - `POST /api/sos` `{ reason?: 'sos' | 'calculator', lat?, lng? }` → `{ sent, failed }`
    - `POST /api/help` (no login) `{ phone, pin, action: 'help' | 'ok', callbackNumber? }` → 200 `{ status: 'done' | 'wrong' | 'locked' }`
    - `POST /api/cron/deadlines` header `x-cron-secret` → `{ expired, retried }`; 401 without the right secret
    - `GET /api/t/[token]` (no login) → `LiveView` or 404 `{ error: 'not_found' }`
    - `GET /api/health` → `{ ok: true }` or 503 `{ ok: false }`

- [ ] **Step 1: Write failing `tests/trip-routes.test.ts`**

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Deps } from '@/lib/deps';
import type { MemoryRepo } from '@/lib/repo/memory';
import { makeDeps, seedUser } from './helpers/fakes';

const state = vi.hoisted(() => ({ deps: null as Deps | null, userId: null as string | null }));
vi.mock('@/lib/server-deps', () => ({ getDeps: () => state.deps }));
vi.mock('@/lib/auth', () => ({ currentUserId: async () => state.userId }));
vi.mock('@/lib/env', () => ({ serverEnv: () => ({ cronSecret: 'cron-secret', telegramWebhookSecret: 'tg-secret' }) }));

const post = (body: unknown, headers: Record<string, string> = {}) =>
  new Request('http://test/api', {
    method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body),
  });
const params = <T>(value: T) => ({ params: Promise.resolve(value) });

let repo: MemoryRepo;

beforeEach(async () => {
  const made = makeDeps();
  repo = made.repo;
  await seedUser(repo);
  await seedUser(repo, { id: 'user-2', name: 'Hina', phone: '+923331112222' });
  state.deps = made.deps;
  state.userId = 'user-1';
});

async function startTripFor(userId: string) {
  state.userId = userId;
  const { POST } = await import('@/app/api/trips/route');
  const res = await POST(post({ durationMin: 20, vehiclePhotoPath: null }));
  expect(res.status).toBe(201);
  return (await res.json()).trip.id as string;
}

describe('trip routes', () => {
  it('rejects a trip without a session and with a bad duration', async () => {
    const { POST } = await import('@/app/api/trips/route');
    state.userId = null;
    expect((await POST(post({ durationMin: 20 }))).status).toBe(401);
    state.userId = 'user-1';
    const res = await POST(post({ durationMin: 'lots' }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'invalid_duration' });
  });

  it('duress finish is indistinguishable from a safe finish', async () => {
    const { POST } = await import('@/app/api/trips/[id]/finish/route');
    const duressTrip = await startTripFor('user-1');
    const duress = await POST(post({ pin: '9999' }), params({ id: duressTrip }));
    const safeTrip = await startTripFor('user-2');
    const safe = await POST(post({ pin: '1234' }), params({ id: safeTrip }));
    expect(duress.status).toBe(safe.status);
    expect(await duress.json()).toEqual(await safe.json());
    expect(repo.data.alerts.map((a) => a.reason)).toEqual(['duress']);
  });

  it("returns 404 for another user's trip", async () => {
    const tripId = await startTripFor('user-1');
    state.userId = 'user-2';
    const { POST } = await import('@/app/api/trips/[id]/location/route');
    expect((await POST(post({ points: [] }), params({ id: tripId }))).status).toBe(404);
  });

  it('location route accepts garbage without failing', async () => {
    const tripId = await startTripFor('user-1');
    const { POST } = await import('@/app/api/trips/[id]/location/route');
    const res = await POST(post({ points: [{ lat: 'x' }, { lat: 24, lng: 67 }] }), params({ id: tripId }));
    expect(await res.json()).toMatchObject({ saved: 1, status: 'active' });
  });

  it('sos alerts with the given location', async () => {
    const { POST } = await import('@/app/api/sos/route');
    const res = await POST(post({ lat: 24.8, lng: 67.1, reason: 'calculator' }));
    expect(await res.json()).toEqual({ sent: 3, failed: 0 });
    expect(repo.data.alerts[0]).toMatchObject({ reason: 'calculator', lat: 24.8, lng: 67.1 });
  });
});

describe('public routes', () => {
  it('help answers wrong for junk without a session and never 500s', async () => {
    state.userId = null;
    const { POST } = await import('@/app/api/help/route');
    const res = await POST(post({ phone: 42, pin: null, action: 'dance' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'wrong' });
  });

  it('cron needs the secret', async () => {
    const { POST } = await import('@/app/api/cron/deadlines/route');
    expect((await POST(post({}))).status).toBe(401);
    expect((await POST(post({}, { 'x-cron-secret': 'wrong' }))).status).toBe(401);
    const ok = await POST(post({}, { 'x-cron-secret': 'cron-secret' }));
    expect(await ok.json()).toEqual({ expired: 0, retried: 0 });
  });

  it('live view 404s for unknown tokens', async () => {
    const { GET } = await import('@/app/api/t/[token]/route');
    expect((await GET(new Request('http://test'), params({ token: 'nope' }))).status).toBe(404);
  });
});
```

- [ ] **Step 2: Run — expect FAIL** (route modules missing)

Run: `npm test -- tests/trip-routes.test.ts`

- [ ] **Step 3: Create `lib/secret.ts`**

```ts
import { timingSafeEqual } from 'node:crypto';

export function safeEqual(given: string | null | undefined, expected: string): boolean {
  if (!given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
```

- [ ] **Step 4: Create the signed-in trip routes**

```ts
// app/api/trips/route.ts
import { json, readJson, withUser } from '@/lib/api';
import { getDeps } from '@/lib/server-deps';
import { startTrip } from '@/lib/trips';

export async function POST(req: Request) {
  return withUser(async (userId) => {
    const body = await readJson(req);
    const trip = await startTrip(getDeps(), userId, {
      durationMin: Number(body.durationMin),
      vehiclePhotoPath: typeof body.vehiclePhotoPath === 'string' ? body.vehiclePhotoPath : null,
    });
    return json({ trip: { id: trip.id, status: trip.status, deadlineAt: trip.deadlineAt } }, 201);
  });
}
```

```ts
// app/api/trips/[id]/location/route.ts
import { json, readJson, withUser } from '@/lib/api';
import { getDeps } from '@/lib/server-deps';
import { recordLocations } from '@/lib/trips';

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return withUser(async (userId) => {
    const body = await readJson(req);
    return json(await recordLocations(getDeps(), userId, id, body.points));
  });
}
```

```ts
// app/api/trips/[id]/finish/route.ts
import { json, readJson, withUser } from '@/lib/api';
import { getDeps } from '@/lib/server-deps';
import { finishTrip } from '@/lib/trips';

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return withUser(async (userId) => {
    const body = await readJson(req);
    return json(await finishTrip(getDeps(), userId, id, String(body.pin ?? '')));
  });
}
```

```ts
// app/api/trips/[id]/extend/route.ts
import { json, readJson, withUser } from '@/lib/api';
import { getDeps } from '@/lib/server-deps';
import { extendTrip } from '@/lib/trips';

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return withUser(async (userId) => {
    const body = await readJson(req);
    return json(await extendTrip(getDeps(), userId, id, String(body.pin ?? '')));
  });
}
```

```ts
// app/api/sos/route.ts
import { json, readJson, withUser } from '@/lib/api';
import { getDeps } from '@/lib/server-deps';
import { parseCoord, sendSos } from '@/lib/trips';

export async function POST(req: Request) {
  return withUser(async (userId) => {
    const body = await readJson(req);
    const { sent, failed } = await sendSos(getDeps(), userId, {
      reason: body.reason === 'calculator' ? 'calculator' : 'sos',
      lat: parseCoord(body.lat, 90),
      lng: parseCoord(body.lng, 180),
    });
    return json({ sent, failed });
  });
}
```

- [ ] **Step 5: Create the public routes**

```ts
// app/api/help/route.ts
import { errorResponse, json, readJson } from '@/lib/api';
import { helpFromAnyPhone } from '@/lib/help';
import { getDeps } from '@/lib/server-deps';

export async function POST(req: Request) {
  try {
    const body = await readJson(req);
    const result = await helpFromAnyPhone(getDeps(), {
      phone: typeof body.phone === 'string' ? body.phone : '',
      pin: typeof body.pin === 'string' ? body.pin : '',
      action: body.action === 'ok' ? 'ok' : 'help',
      callbackNumber: typeof body.callbackNumber === 'string' ? body.callbackNumber : null,
    });
    return json(result);
  } catch (err) {
    return errorResponse(err);
  }
}
```

```ts
// app/api/cron/deadlines/route.ts
import { errorResponse, json } from '@/lib/api';
import { serverEnv } from '@/lib/env';
import { safeEqual } from '@/lib/secret';
import { getDeps } from '@/lib/server-deps';
import { expireDueTrips } from '@/lib/trips';

/** Called every minute by Supabase pg_cron (see supabase/setup-cron.sql). */
export async function POST(req: Request) {
  if (!safeEqual(req.headers.get('x-cron-secret'), serverEnv().cronSecret)) {
    return json({ error: 'unauthorized' }, 401);
  }
  try {
    return json(await expireDueTrips(getDeps()));
  } catch (err) {
    return errorResponse(err);
  }
}
```

```ts
// app/api/t/[token]/route.ts
import { errorResponse, json } from '@/lib/api';
import { getDeps } from '@/lib/server-deps';
import { getLiveView } from '@/lib/trips';

export async function GET(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  try {
    const view = await getLiveView(getDeps(), token);
    return view ? json(view) : json({ error: 'not_found' }, 404);
  } catch (err) {
    return errorResponse(err);
  }
}
```

```ts
// app/api/health/route.ts
import { json } from '@/lib/api';
import { getDeps } from '@/lib/server-deps';

/** Polled by UptimeRobot; the DB query also keeps the free Supabase project awake. */
export async function GET() {
  try {
    await getDeps().repo.ping();
    return json({ ok: true });
  } catch (err) {
    console.error('health check failed', err);
    return json({ ok: false }, 503);
  }
}
```

- [ ] **Step 6: Run — expect PASS**

Run: `npm test -- tests/trip-routes.test.ts`

- [ ] **Step 7: Full suite + build**

Run: `npm test && npm run build`
Expected: all tests pass; build succeeds.

- [ ] **Step 8: Commit**

```bash
git add lib/secret.ts app/api/trips app/api/sos app/api/help app/api/cron app/api/t app/api/health tests/trip-routes.test.ts
git commit -m "feat: add trip, SOS, help, cron, live-view and health routes" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Telegram webhook (family linking, buttons, blocks)

**Files:**
- Create: `lib/telegram-webhook.ts`, `app/api/telegram/webhook/route.ts`, `scripts/set-telegram-webhook.mjs`
- Test: `tests/telegram-webhook.test.ts`

**Interfaces:**
- Consumes: `Deps`, `resolveFromFamily` (Task 5), `welcomeText`, `LINK_INVALID_TEXT` (Task 4), `safeEqual` (Task 8), `serverEnv` (Task 1).
- Produces:
  - `handleTelegramUpdate(deps, update: unknown): Promise<void>` — handles `/start <token>`, `callback_query` with `going:<alertId>` / `ok:<alertId>`, and `my_chat_member` → `kicked`.
  - `POST /api/telegram/webhook` — checks header `x-telegram-bot-api-secret-token`; always answers 200 `{ ok: true }` after a valid secret so Telegram does not retry forever; 401 otherwise.

- [ ] **Step 1: Write failing `tests/telegram-webhook.test.ts`**

```ts
import { describe, expect, it, vi } from 'vitest';
import { raiseAlert } from '@/lib/alerts';
import type { Deps } from '@/lib/deps';
import { handleTelegramUpdate } from '@/lib/telegram-webhook';
import { makeDeps, seedUser } from './helpers/fakes';

const state = vi.hoisted(() => ({ deps: null as Deps | null }));
vi.mock('@/lib/server-deps', () => ({ getDeps: () => state.deps }));
vi.mock('@/lib/env', () => ({ serverEnv: () => ({ telegramWebhookSecret: 'tg-secret' }) }));

const start = (chatId: number, text: string) => ({ message: { chat: { id: chatId }, text } });

describe('handleTelegramUpdate', () => {
  it('links a contact on /start <token> and welcomes them', async () => {
    const { deps, repo, tg } = makeDeps();
    const { profile } = await seedUser(repo);
    const sara = await repo.createContact({
      userId: profile.id, name: 'Sara', relation: 'sister', phone: null, email: null,
      telegramChatId: null, inviteToken: 'invite-sara', status: 'pending',
    });
    await handleTelegramUpdate(deps, start(555, '/start invite-sara'));
    expect(await repo.getContact(sara.id)).toMatchObject({ telegramChatId: '555', status: 'connected' });
    expect(tg.texts('555')[0]).toContain('Ayesha');
    expect(tg.calls.some((c) => c.method === 'sendVoice' && c.chatId === '555')).toBe(true);
  });

  it('answers politely for unknown or missing tokens', async () => {
    const { deps, tg } = makeDeps();
    await handleTelegramUpdate(deps, start(556, '/start nope'));
    await handleTelegramUpdate(deps, start(557, '/start'));
    expect(tg.texts('556')[0]).toContain('not valid');
    expect(tg.texts('557')[0]).toContain('not valid');
  });

  it('family button "ok" resolves the alert and answers the callback', async () => {
    const { deps, repo, tg } = makeDeps();
    const { profile } = await seedUser(repo);
    const { alert } = await raiseAlert(deps, { userId: profile.id, tripId: null, reason: 'sos' });
    await handleTelegramUpdate(deps, {
      callback_query: { id: 'cb1', from: { id: 222 }, message: { chat: { id: 222 } }, data: `ok:${alert.id}` },
    });
    expect((await repo.getAlert(alert.id))!.resolvedBy).toBe('Ali');
    expect(tg.calls.some((c) => c.method === 'answerCallback' && c.chatId === 'cb1')).toBe(true);
  });

  it('marks contacts blocked when they block the bot', async () => {
    const { deps, repo } = makeDeps();
    const { ammi } = await seedUser(repo);
    await handleTelegramUpdate(deps, { my_chat_member: { chat: { id: 111 }, new_chat_member: { status: 'kicked' } } });
    expect((await repo.getContact(ammi.id))!.status).toBe('blocked');
  });

  it('ignores junk updates', async () => {
    const { deps, tg } = makeDeps();
    for (const junk of [null, 42, {}, { message: {} }, { callback_query: { id: 'x', data: 'weird' } }]) {
      await handleTelegramUpdate(deps, junk);
    }
    expect(tg.calls.filter((c) => c.method !== 'answerCallback')).toHaveLength(0);
  });
});

describe('POST /api/telegram/webhook', () => {
  it('rejects a wrong secret and accepts the right one', async () => {
    state.deps = makeDeps().deps;
    const { POST } = await import('@/app/api/telegram/webhook/route');
    const req = (secret?: string) =>
      new Request('http://test', {
        method: 'POST',
        headers: secret ? { 'x-telegram-bot-api-secret-token': secret } : {},
        body: JSON.stringify(start(1, '/start x')),
      });
    expect((await POST(req())).status).toBe(401);
    expect((await POST(req('nope'))).status).toBe(401);
    expect((await POST(req('tg-secret'))).status).toBe(200);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `npm test -- tests/telegram-webhook.test.ts`

- [ ] **Step 3: Create `lib/telegram-webhook.ts`**

```ts
import { resolveFromFamily } from '@/lib/alerts';
import type { Deps } from '@/lib/deps';
import { LINK_INVALID_TEXT, welcomeText } from '@/lib/messages';

type Obj = Record<string, any>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === 'object';

async function handleStart(deps: Deps, chatId: string, text: string) {
  const token = text.split(/\s+/)[1]?.trim();
  const contact = token ? await deps.repo.getContactByInviteToken(token) : null;
  if (!contact) {
    await deps.telegram.sendMessage(chatId, LINK_INVALID_TEXT);
    return;
  }
  await deps.repo.updateContact(contact.id, { telegramChatId: chatId, status: 'connected' });
  const profile = await deps.repo.getProfile(contact.userId);
  await deps.telegram.sendMessage(chatId, welcomeText(profile?.name ?? ''));
  try {
    await deps.telegram.sendVoice(chatId, `${deps.appUrl}/audio/welcome-family.mp3`);
  } catch {
    // The text welcome is enough.
  }
}

export async function handleTelegramUpdate(deps: Deps, update: unknown): Promise<void> {
  if (!isObj(update)) return;

  const message = update.message;
  if (isObj(message) && isObj(message.chat) && typeof message.text === 'string' && message.text.startsWith('/start')) {
    await handleStart(deps, String(message.chat.id), message.text);
    return;
  }

  const cq = update.callback_query;
  if (isObj(cq) && typeof cq.id === 'string') {
    const [action, alertId] = String(cq.data ?? '').split(':');
    const chatId = String(cq.message?.chat?.id ?? cq.from?.id ?? '');
    let ok = false;
    if ((action === 'going' || action === 'ok') && alertId && chatId) {
      ok = (await resolveFromFamily(deps, { alertId, chatId, action })).ok;
    }
    await deps.telegram.answerCallback(cq.id, ok ? '✅ شکریہ / Thanks' : '⚠️');
    return;
  }

  const member = update.my_chat_member;
  if (isObj(member) && member.new_chat_member?.status === 'kicked' && isObj(member.chat)) {
    for (const c of await deps.repo.listContactsByChatId(String(member.chat.id))) {
      await deps.repo.updateContact(c.id, { status: 'blocked' });
    }
  }
}
```

- [ ] **Step 4: Create `app/api/telegram/webhook/route.ts`**

```ts
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
```

- [ ] **Step 5: Create `scripts/set-telegram-webhook.mjs`**

```js
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
```

- [ ] **Step 6: Run — expect PASS**

Run: `npm test -- tests/telegram-webhook.test.ts`

- [ ] **Step 7: Commit**

```bash
git add lib/telegram-webhook.ts app/api/telegram scripts/set-telegram-webhook.mjs tests/telegram-webhook.test.ts
git commit -m "feat: add Telegram webhook for family linking, replies and blocks" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---


### Task 10: UI foundation — Urdu strings, voice clips, shared components

**Files:**
- Create: `lib/i18n.ts`, `lib/audio.ts`, `lib/client/api.ts`, `lib/client/offline.ts`, `lib/client/geo.ts`, `lib/client/errors.ts`, `lib/client/image.ts`, `components/beti/Shell.tsx`, `components/beti/AudioHint.tsx`, `components/beti/BigButton.tsx`, `components/beti/PinPad.tsx`, `components/beti/useSos.ts`, `components/beti/SosPanel.tsx`, `scripts/make-audio.py`, `public/audio/*.mp3` (generated)
- Modify: `app/layout.tsx` (add Urdu font variable), `tailwind.config.ts` (add `urdu` font family)
- Test: `tests/ui-foundation.test.ts`

**Interfaces:**
- Consumes: `Lang` (Task 1), `Overview` type (Task 7).
- Produces:
  - `lib/i18n.ts`: `STRINGS` (every key has `ur` and `en`), `type StringKey`
  - `lib/audio.ts`: `AUDIO_NAMES`, `type AudioName`, `playAudio(name)`
  - `lib/client/api.ts`: `interface ApiResult<T> { ok: boolean; status: number; data: (T & { error?: string }) | null }`; `api<T>(url, init?: { method?: string; body?: unknown }): Promise<ApiResult<T>>` — `status === 0` means no network
  - `lib/client/offline.ts`: `interface OfflineInfo { name: string; phones: string[] }`, `saveOfflineInfo`, `loadOfflineInfo`, `smsLink(phones, body)`, `helpSmsBody(name, lat, lng)`, `safeSmsBody(name)`, `interface QueuedPoint`, `queuePoint(tripId, point)`, `readQueue(tripId)`, `clearQueue(tripId, count)`
  - `lib/client/geo.ts`: `currentPosition(timeoutMs?): Promise<{ lat: number; lng: number } | null>`
  - `lib/client/errors.ts`: `errorKey(code: unknown): StringKey`
  - `lib/client/image.ts`: `compressImage(file: File, maxSide?: number): Promise<Blob>`
  - `components/beti/Shell.tsx`: `Shell` (language context, RTL, toggle) and `useT(): { lang; setLang; t(key) }`
  - `components/beti/AudioHint.tsx`: `AudioHint({ name })` (a `span role="button"`, safe inside links/buttons)
  - `components/beti/BigButton.tsx`: `BigButton({ icon, label, tone?: 'go'|'danger'|'safe'|'neutral', audio?, onClick?, href?, disabled?, small? })`
  - `components/beti/PinPad.tsx`: `PinPad({ title, onComplete(pin), error?, busy?, audio?, onCancel? })` — auto-submits at 4 digits
  - `components/beti/useSos.ts`: `type SosState`, `useSos(): { state; trigger(); reset() }`
  - `components/beti/SosPanel.tsx`: `SosPanel({ state, onClose })` — sent / failed (`sent === 0`) / offline (SMS link) + 📞 15

- [ ] **Step 1: Write failing `tests/ui-foundation.test.ts`**

```ts
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AUDIO_NAMES } from '@/lib/audio';
import { errorKey } from '@/lib/client/errors';
import { helpSmsBody, safeSmsBody, smsLink } from '@/lib/client/offline';
import { STRINGS } from '@/lib/i18n';

describe('i18n', () => {
  it('every string has Urdu and English', () => {
    for (const [key, value] of Object.entries(STRINGS)) {
      expect(value.ur.trim(), key).not.toBe('');
      expect(value.en.trim(), key).not.toBe('');
    }
  });

  it('maps API error codes to strings, with a generic fallback', () => {
    expect(errorKey('bad_phone')).toBe('errBadPhone');
    expect(errorKey('wrong_pin')).toBe('wrongPin');
    expect(errorKey('something_new')).toBe('errGeneric');
    expect(errorKey(undefined)).toBe('errGeneric');
  });
});

describe('audio clips', () => {
  it('every clip referenced in code exists in public/audio', () => {
    for (const name of AUDIO_NAMES) {
      expect(existsSync(join(process.cwd(), 'public', 'audio', `${name}.mp3`)), name).toBe(true);
    }
  });
});

describe('offline SMS fallback', () => {
  it('builds an sms: link for several numbers with an encoded body', () => {
    const link = smsLink(['+923007654321', '+923009876543'], helpSmsBody('Ayesha', 24.86, 67));
    expect(link.startsWith('sms:+923007654321,+923009876543?body=')).toBe(true);
    expect(decodeURIComponent(link.split('body=')[1])).toContain('https://maps.google.com/?q=24.86,67');
  });

  it('works without a location', () => {
    expect(helpSmsBody('Ayesha', null, null)).not.toContain('maps');
    expect(safeSmsBody('Ayesha')).toContain('Ayesha');
  });
});
```

- [ ] **Step 2: Run — expect FAIL** (modules missing)

Run: `npm test -- tests/ui-foundation.test.ts`

- [ ] **Step 3: Create `lib/i18n.ts`**

```ts
import type { Lang } from '@/lib/types';

export const STRINGS = {
  appName: { ur: 'بیٹی AI', en: 'Beti AI' },
  loading: { ur: 'لوڈ ہو رہا ہے…', en: 'Loading…' },
  startTrip: { ur: 'سفر شروع', en: 'Start trip' },
  help: { ur: 'مدد', en: 'HELP' },
  contactsReady: { ur: 'رابطے تیار', en: 'contacts ready' },
  contactBroken: { ur: 'رابطہ ٹوٹ گیا', en: 'disconnected' },
  settings: { ur: 'ترتیبات', en: 'Settings' },
  takePhoto: { ur: 'گاڑی کی تصویر', en: 'Vehicle photo' },
  photoFailed: { ur: 'تصویر نہیں گئی — بغیر تصویر چلیں', en: 'Photo failed — continue without it' },
  howLong: { ur: 'کتنی دیر؟', en: 'How long?' },
  minutes: { ur: 'منٹ', en: 'min' },
  go: { ur: 'شروع', en: 'Start' },
  reached: { ur: 'پہنچ گئی', en: "I'm safe" },
  extend: { ur: '+10 منٹ', en: '+10 min' },
  enterPin: { ur: 'PIN ڈالیں', en: 'Enter PIN' },
  wrongPin: { ur: 'غلط PIN', en: 'Wrong PIN' },
  locked: { ur: '15 منٹ کے لیے بند', en: 'Locked for 15 minutes' },
  safeDone: { ur: 'سفر خیریت سے ختم', en: 'Trip ended safely' },
  sending: { ur: 'اطلاع جا رہی ہے…', en: 'Sending alert…' },
  alertSent: { ur: 'گھر والوں کو اطلاع چلی گئی', en: 'Family has been alerted' },
  alertFailed: { ur: 'اطلاع نہیں گئی — 15 پر کال کریں', en: 'Alert not sent — call 15' },
  call15: { ur: '15 پر کال', en: 'Call 15' },
  noNet: { ur: 'انٹرنیٹ نہیں ہے', en: 'No internet' },
  sendSms: { ur: 'SMS بھیجیں', en: 'Send SMS' },
  finishOffline: { ur: 'نیٹ نہیں — گھر والوں کو SMS سے بتائیں', en: 'No internet — tell your family by SMS' },
  gpsOk: { ur: 'مقام مل رہا ہے', en: 'Location on' },
  gpsOff: { ur: 'مقام بند ہے', en: 'Location off' },
  alertedTrip: { ur: 'گھر والوں کو اطلاع جا چکی ہے', en: 'Your family has been alerted' },
  timeUp: { ur: 'وقت ختم', en: 'Time is up' },
  back: { ur: 'واپس', en: 'Back' },
  next: { ur: 'آگے', en: 'Next' },
  save: { ur: 'محفوظ کریں', en: 'Save' },
  done: { ur: 'ہو گیا', en: 'Done' },
  remove: { ur: 'ہٹائیں', en: 'Remove' },
  logout: { ur: 'لاگ آؤٹ', en: 'Log out' },
  setupTitle: { ur: 'سیٹ اپ', en: 'Setup' },
  name: { ur: 'نام', en: 'Name' },
  phone: { ur: 'فون نمبر', en: 'Phone number' },
  email: { ur: 'ای میل (اختیاری)', en: 'Email (optional)' },
  safePin: { ur: 'حفاظتی PIN بنائیں', en: 'Create your safe PIN' },
  duressPin: { ur: 'خطرے والا PIN بنائیں', en: 'Create your danger PIN' },
  pinAgain: { ur: 'دوبارہ ڈالیں', en: 'Enter it again' },
  pinsMustDiffer: { ur: 'دونوں PIN الگ ہوں', en: 'The two PINs must be different' },
  pinMismatch: { ur: 'PIN میل نہیں کھاتا', en: 'PINs do not match' },
  contactsTitle: { ur: 'گھر والے', en: 'Family contacts' },
  addContact: { ur: 'رابطہ شامل کریں', en: 'Add contact' },
  shareWhatsApp: { ur: 'واٹس ایپ پر بھیجیں', en: 'Send on WhatsApp' },
  connected: { ur: 'جڑ گئے', en: 'Connected' },
  waiting: { ur: 'انتظار', en: 'Waiting' },
  blocked: { ur: 'رابطہ ٹوٹ گیا', en: 'Blocked' },
  testAlert: { ur: 'ٹیسٹ اطلاع', en: 'Test alert' },
  testSent: { ur: 'ٹیسٹ پہنچ گیا', en: 'Test delivered to' },
  consentTitle: { ur: 'آپ کا ڈیٹا', en: 'Your data' },
  consentBody: {
    ur: 'ہم صرف سفر کے دوران آپ کا مقام لیتے ہیں اور صرف آپ کے گھر والوں کو بھیجتے ہیں۔ عام سفر کا مقام 30 دن بعد، اور خطرے والے سفر کا 90 دن بعد مٹا دیا جاتا ہے۔',
    en: 'We take your location only during a trip and share it only with your family. Normal trip locations are deleted after 30 days; alert trips after 90 days.',
  },
  agree: { ur: 'میں راضی ہوں', en: 'I agree' },
  loginGoogle: { ur: 'گوگل سے لاگ ان', en: 'Sign in with Google' },
  loginEmail: { ur: 'ای میل پر لنک بھیجیں', en: 'Email me a link' },
  checkEmail: { ur: 'اپنی ای میل دیکھیں', en: 'Check your email' },
  needHelp: { ur: 'مجھے مدد چاہیے', en: 'I need help' },
  imOkPhoneGone: { ur: 'میں ٹھیک ہوں، صرف فون گیا', en: "I'm OK, only my phone is gone" },
  callbackNumber: { ur: 'اس نمبر پر رابطہ کریں', en: 'Reach me at this number' },
  helpDone: { ur: 'گھر والوں کو بتا دیا گیا', en: 'Your family has been told' },
  liveTitle: { ur: 'لائیو مقام', en: 'Live location' },
  linkExpired: { ur: 'یہ لنک ختم ہو چکا ہے', en: 'This link has expired' },
  lastSeen: { ur: 'آخری بار', en: 'Last seen' },
  openMaps: { ur: 'گوگل میپ میں کھولیں', en: 'Open in Google Maps' },
  statusActive: { ur: 'سفر جاری', en: 'On the way' },
  statusAlerted: { ur: 'خطرہ', en: 'Danger' },
  statusSafe: { ur: 'محفوظ', en: 'Safe' },
  errBadPhone: { ur: 'فون نمبر درست نہیں', en: 'Phone number is not valid' },
  errPhoneTaken: { ur: 'یہ نمبر پہلے سے استعمال میں ہے', en: 'This number is already registered' },
  errBadName: { ur: 'نام لکھیں', en: 'Please enter a name' },
  errBadContact: { ur: 'معلومات درست نہیں', en: 'Please check the details' },
  errTooMany: { ur: 'زیادہ سے زیادہ 5 رابطے', en: 'Maximum 5 contacts' },
  errBadPin: { ur: 'PIN چار ہندسوں کا ہو', en: 'PIN must be 4 digits' },
  errGeneric: { ur: 'کچھ غلط ہو گیا، دوبارہ کوشش کریں', en: 'Something went wrong, please try again' },
} satisfies Record<string, Record<Lang, string>>;

export type StringKey = keyof typeof STRINGS;
```

- [ ] **Step 4: Create `lib/audio.ts` and `lib/client/errors.ts`**

```ts
// lib/audio.ts
export const AUDIO_NAMES = [
  'home-start', 'home-sos', 'trip-photo', 'trip-time', 'trip-go', 'trip-safe', 'trip-extend',
  'pin-enter', 'pin-wrong', 'gps-help', 'net-off', 'alert-help', 'alert-test', 'welcome-family',
  'setup-intro', 'setup-pin', 'setup-duress', 'setup-contacts', 'help-page',
] as const;

export type AudioName = (typeof AUDIO_NAMES)[number];

export function playAudio(name: AudioName): void {
  try {
    void new Audio(`/audio/${name}.mp3`).play().catch(() => {});
  } catch {
    // Audio is a hint only.
  }
}
```

```ts
// lib/client/errors.ts
import type { StringKey } from '@/lib/i18n';

const MAP: Record<string, StringKey> = {
  bad_phone: 'errBadPhone',
  phone_taken: 'errPhoneTaken',
  bad_name: 'errBadName',
  bad_contact: 'errBadContact',
  too_many: 'errTooMany',
  bad_pin: 'errBadPin',
  same_pins: 'pinsMustDiffer',
  wrong_pin: 'wrongPin',
  locked: 'locked',
};

export function errorKey(code: unknown): StringKey {
  return (typeof code === 'string' && MAP[code]) || 'errGeneric';
}
```

- [ ] **Step 5: Create `lib/client/api.ts`, `lib/client/offline.ts`, `lib/client/geo.ts`, `lib/client/image.ts`**

```ts
// lib/client/api.ts
export interface ApiResult<T> {
  ok: boolean;
  /** 0 means the request never reached the server (offline). */
  status: number;
  data: (T & { error?: string }) | null;
}

export async function api<T = unknown>(url: string, init: { method?: string; body?: unknown } = {}): Promise<ApiResult<T>> {
  const hasBody = init.body !== undefined;
  try {
    const res = await fetch(url, {
      method: init.method ?? (hasBody ? 'POST' : 'GET'),
      headers: hasBody ? { 'content-type': 'application/json' } : undefined,
      body: hasBody ? JSON.stringify(init.body) : undefined,
      cache: 'no-store',
    });
    const data = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, data };
  } catch {
    return { ok: false, status: 0, data: null };
  }
}
```

```ts
// lib/client/offline.ts — phone-side cache so help works without internet. Never stores PINs.
const INFO_KEY = 'beti-offline';
const queueKey = (tripId: string) => `beti-gps-${tripId}`;

export interface OfflineInfo {
  name: string;
  phones: string[];
}

export interface QueuedPoint {
  lat: number;
  lng: number;
  accuracyM: number | null;
  recordedAt: string;
}

export function saveOfflineInfo(info: OfflineInfo): void {
  try {
    localStorage.setItem(INFO_KEY, JSON.stringify(info));
  } catch {}
}

export function loadOfflineInfo(): OfflineInfo | null {
  try {
    const raw = localStorage.getItem(INFO_KEY);
    return raw ? (JSON.parse(raw) as OfflineInfo) : null;
  } catch {
    return null;
  }
}

export function smsLink(phones: string[], body: string): string {
  return `sms:${phones.join(',')}?body=${encodeURIComponent(body)}`;
}

export function helpSmsBody(name: string, lat: number | null, lng: number | null): string {
  const where = lat !== null && lng !== null ? ` https://maps.google.com/?q=${lat},${lng}` : '';
  return `🚨 ${name}: مجھے مدد چاہیے! / I need help!${where}`;
}

export function safeSmsBody(name: string): string {
  return `✅ ${name}: میں خیریت سے پہنچ گئی / I reached safely`;
}

export function readQueue(tripId: string): QueuedPoint[] {
  try {
    return JSON.parse(localStorage.getItem(queueKey(tripId)) ?? '[]') as QueuedPoint[];
  } catch {
    return [];
  }
}

export function queuePoint(tripId: string, point: QueuedPoint): void {
  try {
    localStorage.setItem(queueKey(tripId), JSON.stringify([...readQueue(tripId), point].slice(-200)));
  } catch {}
}

/** Drops the first `count` points (the ones just sent). */
export function clearQueue(tripId: string, count: number): void {
  try {
    const rest = readQueue(tripId).slice(count);
    if (rest.length) localStorage.setItem(queueKey(tripId), JSON.stringify(rest));
    else localStorage.removeItem(queueKey(tripId));
  } catch {}
}
```

```ts
// lib/client/geo.ts
export function currentPosition(timeoutMs = 5000): Promise<{ lat: number; lng: number } | null> {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 60_000 },
    );
  });
}
```

```ts
// lib/client/image.ts — shrink photos before upload (slow mobile networks).
export async function compressImage(file: File, maxSide = 1024): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('compress failed'))), 'image/jpeg', 0.75),
  );
}
```

- [ ] **Step 6: Create `scripts/make-audio.py` and generate the clips**

```python
# Generates the Urdu voice hints in public/audio with Microsoft Edge TTS (free).
# Usage: pip install edge-tts && python scripts/make-audio.py
# Replace any file later with a real human recording of the same name.
import asyncio
import pathlib

import edge_tts

VOICE = "ur-PK-UzmaNeural"
CLIPS = {
    "home-start": "سفر شروع کرنے کے لیے یہ بٹن دبائیں۔",
    "home-sos": "خطرہ ہو تو یہ لال بٹن دبائیں۔ آپ کے گھر والوں کو فوراً اطلاع جائے گی۔",
    "trip-photo": "گاڑی یا نمبر پلیٹ کی تصویر لیں۔ چاہیں تو چھوڑ بھی سکتی ہیں۔",
    "trip-time": "بتائیں سفر میں کتنی دیر لگے گی۔",
    "trip-go": "سفر شروع کرنے کے لیے یہ بٹن دبائیں اور مقام کی اجازت دیں۔",
    "trip-safe": "منزل پر پہنچ کر یہ ہرا بٹن دبائیں اور اپنا پن ڈالیں۔",
    "trip-extend": "مزید دس منٹ چاہییں تو یہ بٹن دبائیں اور پن ڈالیں۔",
    "pin-enter": "اپنا چار ہندسوں والا پن ڈالیں۔",
    "pin-wrong": "پن غلط ہے۔ دوبارہ کوشش کریں۔",
    "gps-help": "آپ کا مقام بند ہے۔ فون کی سیٹنگ میں لوکیشن آن کریں۔",
    "net-off": "انٹرنیٹ نہیں ہے۔ خطرہ ہو تو ایس ایم ایس کا بٹن دبائیں یا پندرہ پر کال کریں۔",
    "alert-help": "خطرے کی اطلاع! جس نے آپ کو رابطہ بنایا ہے اسے مدد چاہیے۔ نیچے اس کا مقام ہے۔ فوراً رابطہ کریں۔",
    "alert-test": "یہ صرف ٹیسٹ ہے۔ بیٹی اے آئی ٹھیک کام کر رہا ہے۔ پریشان نہ ہوں۔",
    "welcome-family": "شکریہ۔ آپ ایمرجنسی رابطہ بن گئے ہیں۔ خطرے کی صورت میں آپ کو یہاں اطلاع ملے گی۔",
    "setup-intro": "خوش آمدید۔ یہ سیٹ اپ صرف ایک بار ہوگا۔ کوئی مددگار آپ کی مدد کر سکتا ہے۔",
    "setup-pin": "چار ہندسوں کا حفاظتی پن بنائیں۔ یہ سفر ختم کرنے کے لیے ہے۔",
    "setup-duress": "اب ایک الگ خطرے والا پن بنائیں۔ اگر کوئی زبردستی کرے تو یہ پن ڈالیں۔ فون پر سب ٹھیک دکھے گا، مگر گھر والوں کو چپکے سے اطلاع جائے گی۔",
    "setup-contacts": "اپنے گھر والوں کو شامل کریں اور انہیں واٹس ایپ پر لنک بھیجیں۔",
    "help-page": "اگر آپ کا فون چوری ہو گیا ہے تو یہاں سے مدد مانگیں یا بتائیں کہ آپ ٹھیک ہیں۔",
}


async def main() -> None:
    out = pathlib.Path(__file__).resolve().parent.parent / "public" / "audio"
    out.mkdir(parents=True, exist_ok=True)
    for name, text in CLIPS.items():
        await edge_tts.Communicate(text, VOICE).save(str(out / f"{name}.mp3"))
        print("ok", name)


asyncio.run(main())
```

Run:
```bash
pip install edge-tts
python scripts/make-audio.py
```
Expected: 19 lines `ok <name>` and 19 files in `public/audio/`. The keys in `CLIPS` must match `AUDIO_NAMES` exactly.

- [ ] **Step 7: Run — expect PASS**

Run: `npm test -- tests/ui-foundation.test.ts`

- [ ] **Step 8: Add the Urdu font**

In `app/layout.tsx`, change the font import line and add the Urdu font next to the others:

```tsx
import { Plus_Jakarta_Sans, Space_Grotesk, JetBrains_Mono, Noto_Nastaliq_Urdu } from "next/font/google";
```

```tsx
const urdu = Noto_Nastaliq_Urdu({ subsets: ["arabic"], weight: ["400", "700"], display: "swap", preload: false, variable: "--font-urdu" });
```

and add `${urdu.variable}` to the `<html>` className:

```tsx
    <html lang="en" className={`dark ${sans.variable} ${display.variable} ${mono.variable} ${urdu.variable}`}>
```

In `tailwind.config.ts` `fontFamily`, add:

```ts
        urdu: ['var(--font-urdu)', 'var(--font-sans)', 'serif'],
```

- [ ] **Step 9: Create `components/beti/Shell.tsx`**

```tsx
'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { STRINGS, type StringKey } from '@/lib/i18n';
import type { Lang } from '@/lib/types';

const LangContext = createContext<{ lang: Lang; setLang: (lang: Lang) => void }>({ lang: 'ur', setLang: () => {} });

export function useT() {
  const { lang, setLang } = useContext(LangContext);
  return { lang, setLang, t: (key: StringKey) => STRINGS[key][lang] };
}

export function Shell({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>('ur');

  useEffect(() => {
    try {
      const saved = localStorage.getItem('beti-lang');
      if (saved === 'ur' || saved === 'en') setLangState(saved);
    } catch {}
  }, []);

  const setLang = (next: Lang) => {
    setLangState(next);
    try {
      localStorage.setItem('beti-lang', next);
    } catch {}
  };

  return (
    <LangContext.Provider value={{ lang, setLang }}>
      <div
        dir={lang === 'ur' ? 'rtl' : 'ltr'}
        lang={lang}
        className={`w-full max-w-md mx-auto min-h-screen px-4 py-5 flex flex-col gap-5 ${lang === 'ur' ? 'font-urdu leading-loose' : 'font-sans'}`}
      >
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setLang(lang === 'ur' ? 'en' : 'ur')}
            className="px-3 py-1.5 rounded-full bg-white/[0.06] border border-white/10 text-xs text-slate-200"
          >
            {lang === 'ur' ? 'English' : 'اردو'}
          </button>
        </div>
        {children}
      </div>
    </LangContext.Provider>
  );
}
```

- [ ] **Step 10: Create `components/beti/AudioHint.tsx` and `components/beti/BigButton.tsx`**

```tsx
// components/beti/AudioHint.tsx
'use client';

import { playAudio, type AudioName } from '@/lib/audio';

/** 🔊 hint. A span (not a button) so it can sit inside links and buttons. */
export function AudioHint({ name }: { name: AudioName }) {
  const play = (e: { preventDefault(): void; stopPropagation(): void }) => {
    e.preventDefault();
    e.stopPropagation();
    playAudio(name);
  };
  return (
    <span
      role="button"
      tabIndex={0}
      aria-label="سنیں / Listen"
      onClick={play}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') play(e);
      }}
      className="inline-flex items-center justify-center w-11 h-11 rounded-full bg-black/25 text-xl shrink-0"
    >
      🔊
    </span>
  );
}
```

```tsx
// components/beti/BigButton.tsx
'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import type { AudioName } from '@/lib/audio';
import { AudioHint } from './AudioHint';

const TONES = {
  go: 'bg-gradient-to-br from-brand-violet to-indigo-600 text-white shadow-lg shadow-indigo-900/40',
  danger: 'bg-red-600 text-white shadow-lg shadow-red-900/50',
  safe: 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/40',
  neutral: 'bg-white/[0.06] border border-white/10 text-slate-100',
} as const;

interface Props {
  icon: ReactNode;
  label: string;
  tone?: keyof typeof TONES;
  audio?: AudioName;
  onClick?: () => void;
  href?: string;
  disabled?: boolean;
  small?: boolean;
}

export function BigButton({ icon, label, tone = 'neutral', audio, onClick, href, disabled, small }: Props) {
  const className = `w-full flex items-center gap-4 rounded-3xl font-bold transition active:scale-[0.98] disabled:opacity-50 ${
    small ? 'px-5 py-4 text-lg' : 'px-6 py-7 text-2xl'
  } ${TONES[tone]}`;
  const body = (
    <>
      <span aria-hidden className={small ? 'text-2xl' : 'text-4xl'}>{icon}</span>
      <span className="flex-1 text-start">{label}</span>
      {audio && <AudioHint name={audio} />}
    </>
  );
  if (href && !disabled) {
    return <Link href={href} className={className}>{body}</Link>;
  }
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={className}>
      {body}
    </button>
  );
}
```

- [ ] **Step 11: Create `components/beti/PinPad.tsx`**

```tsx
'use client';

import { useState } from 'react';
import type { AudioName } from '@/lib/audio';
import { AudioHint } from './AudioHint';

interface Props {
  title: string;
  onComplete: (pin: string) => void;
  error?: string | null;
  busy?: boolean;
  audio?: AudioName;
  onCancel?: () => void;
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'del', '0', 'cancel'] as const;

export function PinPad({ title, onComplete, error, busy, audio = 'pin-enter', onCancel }: Props) {
  const [pin, setPin] = useState('');

  const press = (digit: string) => {
    if (busy || pin.length >= 4) return;
    const next = pin + digit;
    setPin(next);
    if (next.length === 4) {
      onComplete(next);
      setTimeout(() => setPin(''), 250);
    }
  };

  const keyClass = 'h-20 rounded-2xl bg-white/[0.07] border border-white/10 text-3xl font-bold text-white active:bg-white/20';

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="flex items-center gap-2 text-xl font-bold text-white">
        {title}
        <AudioHint name={audio} />
      </div>
      <div dir="ltr" className="flex gap-4" aria-label={`${pin.length} of 4`}>
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={`w-5 h-5 rounded-full ${i < pin.length ? 'bg-white' : 'bg-white/15'}`} />
        ))}
      </div>
      {error && <p className="text-lg font-bold text-red-400">{error}</p>}
      <div dir="ltr" className="grid grid-cols-3 gap-3 w-full max-w-xs">
        {KEYS.map((k) => {
          if (k === 'del') {
            return (
              <button key={k} type="button" aria-label="Delete" className={keyClass} onClick={() => setPin((p) => p.slice(0, -1))}>
                ⌫
              </button>
            );
          }
          if (k === 'cancel') {
            return onCancel ? (
              <button key={k} type="button" aria-label="Cancel" className={keyClass} onClick={onCancel}>
                ✕
              </button>
            ) : (
              <span key={k} />
            );
          }
          return (
            <button key={k} type="button" className={keyClass} onClick={() => press(k)} disabled={busy}>
              {k}
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 12: Create `components/beti/useSos.ts` and `components/beti/SosPanel.tsx`**

```ts
// components/beti/useSos.ts
'use client';

import { useState } from 'react';
import { api } from '@/lib/client/api';
import { currentPosition } from '@/lib/client/geo';

export type SosState =
  | { phase: 'idle' }
  | { phase: 'sending' }
  | { phase: 'sent'; sent: number }
  | { phase: 'failed' }
  | { phase: 'offline'; lat: number | null; lng: number | null };

export function useSos() {
  const [state, setState] = useState<SosState>({ phase: 'idle' });

  const trigger = async () => {
    setState({ phase: 'sending' });
    const pos = await currentPosition();
    const lat = pos?.lat ?? null;
    const lng = pos?.lng ?? null;
    const res = await api<{ sent: number; failed: number }>('/api/sos', { body: { reason: 'sos', lat, lng } });
    if (res.status === 0) setState({ phase: 'offline', lat, lng });
    else if (!res.ok || !res.data || res.data.sent === 0) setState({ phase: 'failed' });
    else setState({ phase: 'sent', sent: res.data.sent });
  };

  return { state, trigger, reset: () => setState({ phase: 'idle' }) };
}
```

```tsx
// components/beti/SosPanel.tsx
'use client';

import { useEffect, useState } from 'react';
import { playAudio } from '@/lib/audio';
import { helpSmsBody, loadOfflineInfo, smsLink, type OfflineInfo } from '@/lib/client/offline';
import { useT } from './Shell';
import type { SosState } from './useSos';

export function SosPanel({ state, onClose }: { state: SosState; onClose: () => void }) {
  const { t } = useT();
  const [info, setInfo] = useState<OfflineInfo | null>(null);

  useEffect(() => {
    setInfo(loadOfflineInfo());
  }, []);
  useEffect(() => {
    if (state.phase === 'offline') playAudio('net-off');
  }, [state.phase]);

  return (
    <div className="flex flex-col gap-4 rounded-3xl bg-red-950/60 border border-red-500/40 p-5 text-center">
      {state.phase === 'sending' && <p className="text-2xl font-bold text-white animate-pulse">📡 {t('sending')}</p>}
      {state.phase === 'sent' && <p className="text-2xl font-bold text-emerald-300">✅ {t('alertSent')} ({state.sent})</p>}
      {state.phase === 'failed' && <p className="text-2xl font-bold text-red-300">❌ {t('alertFailed')}</p>}
      {state.phase === 'offline' && (
        <>
          <p className="text-2xl font-bold text-amber-300">📵 {t('noNet')}</p>
          {info && info.phones.length > 0 && (
            <a
              href={smsLink(info.phones, helpSmsBody(info.name, state.lat, state.lng))}
              className="rounded-3xl bg-amber-500 text-black text-2xl font-bold py-5"
            >
              💬 {t('sendSms')}
            </a>
          )}
        </>
      )}
      <a href="tel:15" className="rounded-3xl bg-red-600 text-white text-2xl font-bold py-5">📞 {t('call15')}</a>
      {state.phase !== 'sending' && (
        <button type="button" onClick={onClose} className="text-slate-300 underline">{t('back')}</button>
      )}
    </div>
  );
}
```

- [ ] **Step 13: Full suite + build**

Run: `npm test && npm run build`
Expected: all pass; build succeeds.

- [ ] **Step 14: Commit**

```bash
git add lib/i18n.ts lib/audio.ts lib/client components/beti scripts/make-audio.py public/audio app/layout.tsx tailwind.config.ts tests/ui-foundation.test.ts
git commit -m "feat: add Urdu-first UI foundation, voice hints and shared components" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---


### Task 11: Login, setup wizard ("Madadgar mode"), contacts and settings

**Files:**
- Create: `app/login/layout.tsx`, `app/login/page.tsx`, `app/app/layout.tsx`, `app/app/setup/page.tsx`, `app/app/settings/page.tsx`, `components/beti/ContactsManager.tsx`

**Interfaces:**
- Consumes: `Shell`, `useT`, `BigButton`, `PinPad`, `AudioHint` (Task 10); `api`, `errorKey` (Task 10); `Overview` (Task 7); `RELATIONS` (Task 7); `inviteShareText` (Task 4); `createSupabaseBrowser` (Task 7); routes `/api/me`, `/api/profile`, `/api/pin/check`, `/api/contacts`, `/api/contacts/[id]`, `/api/alerts/test`.
- Produces: pages `/login`, `/app/setup`, `/app/settings`; `ContactsManager({ pin }: { pin: string })`. The confirmed PIN is kept only in React state (never in storage) and sent with contact changes.

- [ ] **Step 1: Create the layouts**

```tsx
// app/login/layout.tsx
import type { ReactNode } from 'react';
import { Shell } from '@/components/beti/Shell';

export default function LoginLayout({ children }: { children: ReactNode }) {
  return <Shell>{children}</Shell>;
}
```

```tsx
// app/app/layout.tsx
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Shell } from '@/components/beti/Shell';

export const metadata: Metadata = { title: 'Beti AI' };

export default function AppLayout({ children }: { children: ReactNode }) {
  return <Shell>{children}</Shell>;
}
```

- [ ] **Step 2: Create `app/login/page.tsx`**

```tsx
'use client';

import { useMemo, useState } from 'react';
import { useT } from '@/components/beti/Shell';
import { createSupabaseBrowser } from '@/lib/supabase/browser';

export default function LoginPage() {
  const { t } = useT();
  const supabase = useMemo(() => createSupabaseBrowser(), []);
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const redirectTo = () => `${window.location.origin}/auth/callback`;

  const google = async () => {
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: redirectTo() } });
    if (error) setError(t('errGeneric'));
  };

  const magicLink = async () => {
    const { error } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: redirectTo() } });
    if (error) setError(t('errGeneric'));
    else setSent(true);
  };

  return (
    <main className="flex flex-col gap-6 pt-6">
      <div className="text-center">
        <p className="text-6xl" aria-hidden>🛡️</p>
        <h1 className="text-3xl font-bold text-white mt-2">{t('appName')}</h1>
      </div>
      <button type="button" onClick={google} className="w-full rounded-3xl bg-white text-slate-900 text-xl font-bold py-5">
        G &nbsp;{t('loginGoogle')}
      </button>
      <div className="flex flex-col gap-3 rounded-3xl bg-white/[0.04] border border-white/10 p-4">
        <input
          type="email"
          dir="ltr"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="name@gmail.com"
          className="w-full rounded-2xl bg-black/40 border border-white/10 px-4 py-3 text-lg text-white"
        />
        <button
          type="button"
          onClick={magicLink}
          disabled={!email.includes('@')}
          className="w-full rounded-2xl bg-white/10 text-white text-lg font-bold py-3 disabled:opacity-40"
        >
          ✉️ {t('loginEmail')}
        </button>
        {sent && <p className="text-emerald-300 text-center font-bold">{t('checkEmail')}</p>}
      </div>
      {error && <p className="text-red-400 text-center font-bold">{error}</p>}
    </main>
  );
}
```

- [ ] **Step 3: Create `components/beti/ContactsManager.tsx`**

```tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Overview } from '@/lib/account';
import { api } from '@/lib/client/api';
import { errorKey } from '@/lib/client/errors';
import { inviteShareText } from '@/lib/messages';
import { RELATIONS } from '@/lib/relations';
import type { Relation } from '@/lib/types';
import { AudioHint } from './AudioHint';
import { useT } from './Shell';

const EMPTY = { name: '', relation: 'mother' as Relation, phone: '', email: '' };

export function ContactsManager({ pin }: { pin: string }) {
  const { t, lang } = useT();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await api<Overview>('/api/me');
    if (res.ok && res.data) setOverview(res.data);
  }, []);

  // Poll so a contact turns ✅ as soon as they press Start in Telegram.
  useEffect(() => {
    load();
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, [load]);

  const add = async () => {
    setBusy(true);
    setError(null);
    const res = await api('/api/contacts', { body: { ...form, pin } });
    setBusy(false);
    if (!res.ok) {
      setError(t(errorKey(res.data?.error)));
      return;
    }
    setForm(EMPTY);
    load();
  };

  const remove = async (id: string) => {
    await api(`/api/contacts/${id}`, { method: 'DELETE', body: { pin } });
    load();
  };

  const statusLabel = (status: string) =>
    status === 'connected' ? `✅ ${t('connected')}` : status === 'blocked' ? `⚠️ ${t('blocked')}` : `⏳ ${t('waiting')}`;

  return (
    <section className="flex flex-col gap-4">
      <h2 className="flex items-center gap-2 text-2xl font-bold text-white">
        👨‍👩‍👧 {t('contactsTitle')} <AudioHint name="setup-contacts" />
      </h2>

      {overview?.contacts.map((c) => {
        const relation = RELATIONS.find((r) => r.id === c.relation);
        return (
          <div key={c.id} className="rounded-3xl bg-white/[0.05] border border-white/10 p-4 flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <span className="text-4xl" aria-hidden>{relation?.icon}</span>
              <div className="flex-1">
                <p className="text-xl font-bold text-white">{c.name}</p>
                <p className="text-sm text-slate-300">{statusLabel(c.status)}</p>
              </div>
              <button type="button" onClick={() => remove(c.id)} aria-label={t('remove')} className="text-2xl">🗑️</button>
            </div>
            {c.status !== 'connected' && overview.profile && (
              <a
                href={`https://wa.me/?text=${encodeURIComponent(inviteShareText(overview.profile.name, c.inviteLink))}`}
                target="_blank"
                rel="noreferrer"
                className="rounded-2xl bg-emerald-600 text-white text-lg font-bold py-3 text-center"
              >
                🟢 {t('shareWhatsApp')}
              </a>
            )}
          </div>
        );
      })}

      <div className="rounded-3xl bg-white/[0.03] border border-dashed border-white/15 p-4 flex flex-col gap-3">
        <input
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder={t('name')}
          className="w-full rounded-2xl bg-black/40 border border-white/10 px-4 py-3 text-lg text-white"
        />
        <div className="grid grid-cols-4 gap-2">
          {RELATIONS.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setForm({ ...form, relation: r.id })}
              className={`rounded-2xl py-2 flex flex-col items-center text-sm ${
                form.relation === r.id ? 'bg-brand-violet text-white' : 'bg-white/[0.06] text-slate-200'
              }`}
            >
              <span className="text-2xl" aria-hidden>{r.icon}</span>
              {r[lang]}
            </button>
          ))}
        </div>
        <input
          dir="ltr"
          inputMode="tel"
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
          placeholder="03XX-XXXXXXX"
          aria-label={t('phone')}
          className="w-full rounded-2xl bg-black/40 border border-white/10 px-4 py-3 text-lg text-white"
        />
        <input
          dir="ltr"
          type="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          placeholder={t('email')}
          className="w-full rounded-2xl bg-black/40 border border-white/10 px-4 py-3 text-lg text-white"
        />
        {error && <p className="text-red-400 font-bold">{error}</p>}
        <button
          type="button"
          onClick={add}
          disabled={busy || !form.name.trim() || !form.phone.trim()}
          className="rounded-2xl bg-brand-violet text-white text-lg font-bold py-3 disabled:opacity-40"
        >
          ➕ {t('addContact')}
        </button>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Create `app/app/setup/page.tsx`**

```tsx
'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AudioHint } from '@/components/beti/AudioHint';
import { BigButton } from '@/components/beti/BigButton';
import { ContactsManager } from '@/components/beti/ContactsManager';
import { PinPad } from '@/components/beti/PinPad';
import { useT } from '@/components/beti/Shell';
import type { Overview } from '@/lib/account';
import { api } from '@/lib/client/api';
import { errorKey } from '@/lib/client/errors';

type Step = 'loading' | 'consent' | 'identity' | 'safe' | 'safe2' | 'duress' | 'duress2' | 'gate' | 'contacts' | 'test';

export default function SetupPage() {
  const { t } = useT();
  const router = useRouter();
  const [step, setStep] = useState<Step>('loading');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [safePin, setSafePin] = useState('');
  const [duressPin, setDuressPin] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [testSent, setTestSent] = useState<number | null>(null);

  useEffect(() => {
    api<Overview>('/api/me').then((res) => setStep(res.data?.profile?.hasPin ? 'gate' : 'consent'));
  }, []);

  const go = (next: Step) => {
    setError(null);
    setStep(next);
  };

  const saveProfile = async (confirmedDuress: string) => {
    setBusy(true);
    const res = await api('/api/profile', { body: { name, phone, safePin, duressPin: confirmedDuress } });
    setBusy(false);
    if (!res.ok) {
      const code = res.data?.error;
      setStep(code === 'bad_phone' || code === 'bad_name' || code === 'phone_taken' ? 'identity' : 'safe');
      setError(t(errorKey(code)));
      return;
    }
    setPin(safePin);
    go('contacts');
  };

  const checkGate = async (entered: string) => {
    setBusy(true);
    const res = await api<{ status: string }>('/api/pin/check', { body: { pin: entered } });
    setBusy(false);
    if (res.data?.status === 'ok') {
      setPin(entered);
      go('contacts');
    } else {
      setError(t(res.data?.status === 'locked' ? 'locked' : 'wrongPin'));
    }
  };

  const sendTest = async () => {
    setBusy(true);
    const res = await api<{ sent: number }>('/api/alerts/test', { body: {} });
    setBusy(false);
    setTestSent(res.data?.sent ?? 0);
  };

  if (step === 'loading') return <p className="text-center text-slate-300">{t('loading')}</p>;

  return (
    <main className="flex flex-col gap-5">
      <h1 className="flex items-center gap-2 text-3xl font-bold text-white">
        {t('setupTitle')} <AudioHint name="setup-intro" />
      </h1>

      {step === 'consent' && (
        <>
          <div className="rounded-3xl bg-white/[0.05] border border-white/10 p-5">
            <h2 className="text-xl font-bold text-white mb-2">🔒 {t('consentTitle')}</h2>
            <p className="text-lg text-slate-200">{t('consentBody')}</p>
          </div>
          <BigButton icon="✅" label={t('agree')} tone="safe" onClick={() => go('identity')} />
        </>
      )}

      {step === 'identity' && (
        <>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('name')}
            className="w-full rounded-2xl bg-black/40 border border-white/10 px-4 py-4 text-xl text-white"
          />
          <input
            dir="ltr"
            inputMode="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="03XX-XXXXXXX"
            aria-label={t('phone')}
            className="w-full rounded-2xl bg-black/40 border border-white/10 px-4 py-4 text-xl text-white"
          />
          {error && <p className="text-red-400 font-bold">{error}</p>}
          <BigButton icon="➡️" label={t('next')} tone="go" small disabled={!name.trim() || !phone.trim()} onClick={() => go('safe')} />
        </>
      )}

      {step === 'safe' && (
        <PinPad title={t('safePin')} audio="setup-pin" error={error} onComplete={(p) => { setSafePin(p); go('safe2'); }} />
      )}
      {step === 'safe2' && (
        <PinPad
          title={t('pinAgain')}
          audio="setup-pin"
          error={error}
          onComplete={(p) => (p === safePin ? go('duress') : (setError(t('pinMismatch')), setStep('safe')))}
        />
      )}
      {step === 'duress' && (
        <PinPad
          title={t('duressPin')}
          audio="setup-duress"
          error={error}
          onComplete={(p) => (p === safePin ? setError(t('pinsMustDiffer')) : (setDuressPin(p), go('duress2')))}
        />
      )}
      {step === 'duress2' && (
        <PinPad
          title={t('pinAgain')}
          audio="setup-duress"
          error={error}
          busy={busy}
          onComplete={(p) => (p === duressPin ? saveProfile(p) : (setError(t('pinMismatch')), setStep('duress')))}
        />
      )}

      {step === 'gate' && <PinPad title={t('enterPin')} error={error} busy={busy} onComplete={checkGate} />}

      {step === 'contacts' && (
        <>
          <ContactsManager pin={pin} />
          <BigButton icon="➡️" label={t('next')} tone="go" small onClick={() => go('test')} />
        </>
      )}

      {step === 'test' && (
        <>
          <BigButton icon="🧪" label={t('testAlert')} tone="neutral" disabled={busy} onClick={sendTest} />
          {testSent !== null && (
            <p className={`text-xl font-bold text-center ${testSent > 0 ? 'text-emerald-300' : 'text-red-400'}`}>
              {testSent > 0 ? `✅ ${t('testSent')}: ${testSent}` : `❌ ${t('alertFailed')}`}
            </p>
          )}
          <BigButton icon="🏠" label={t('done')} tone="safe" small onClick={() => router.replace('/app')} />
        </>
      )}
    </main>
  );
}
```

- [ ] **Step 5: Create `app/app/settings/page.tsx`**

```tsx
'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { BigButton } from '@/components/beti/BigButton';
import { ContactsManager } from '@/components/beti/ContactsManager';
import { PinPad } from '@/components/beti/PinPad';
import { useT } from '@/components/beti/Shell';
import { api } from '@/lib/client/api';
import { createSupabaseBrowser } from '@/lib/supabase/browser';

export default function SettingsPage() {
  const { t } = useT();
  const router = useRouter();
  const [pin, setPin] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [testSent, setTestSent] = useState<number | null>(null);

  const check = async (entered: string) => {
    setBusy(true);
    const res = await api<{ status: string }>('/api/pin/check', { body: { pin: entered } });
    setBusy(false);
    if (res.data?.status === 'ok') setPin(entered);
    else setError(t(res.data?.status === 'locked' ? 'locked' : 'wrongPin'));
  };

  const sendTest = async () => {
    setBusy(true);
    const res = await api<{ sent: number }>('/api/alerts/test', { body: {} });
    setBusy(false);
    setTestSent(res.data?.sent ?? 0);
  };

  const logout = async () => {
    await createSupabaseBrowser().auth.signOut();
    router.replace('/login');
  };

  if (!pin) {
    return (
      <main className="flex flex-col gap-6">
        <h1 className="text-3xl font-bold text-white">⚙️ {t('settings')}</h1>
        <PinPad title={t('enterPin')} error={error} busy={busy} onComplete={check} onCancel={() => router.replace('/app')} />
      </main>
    );
  }

  return (
    <main className="flex flex-col gap-6">
      <h1 className="text-3xl font-bold text-white">⚙️ {t('settings')}</h1>
      <ContactsManager pin={pin} />
      <BigButton icon="🧪" label={t('testAlert')} disabled={busy} onClick={sendTest} small />
      {testSent !== null && (
        <p className={`text-xl font-bold text-center ${testSent > 0 ? 'text-emerald-300' : 'text-red-400'}`}>
          {testSent > 0 ? `✅ ${t('testSent')}: ${testSent}` : `❌ ${t('alertFailed')}`}
        </p>
      )}
      <BigButton icon="🏠" label={t('back')} href="/app" small />
      <button type="button" onClick={logout} className="text-slate-400 underline">{t('logout')}</button>
    </main>
  );
}
```

- [ ] **Step 6: Type-check and build**

Run: `npx tsc --noEmit && npm run build`
Expected: no errors; build lists `/login`, `/app/setup`, `/app/settings`.

- [ ] **Step 7: Visual check (needs Supabase keys in `.env.local`; if not available yet, run only the unauthenticated part)**

Run `npm run dev`. At 390×844:
- `/login` shows the shield, Google button and email box in Urdu; the toggle switches to English and left-to-right.
- `/app/setup` without a session redirects to `/login`.
- With keys: sign in, walk the wizard (consent → name/phone → PIN ×2 → danger PIN ×2 → contacts → test). The WhatsApp button opens `wa.me` with the invite text; after pressing Start in Telegram the contact turns ✅ within 5 s.

- [ ] **Step 8: Commit**

```bash
git add app/login app/app/layout.tsx app/app/setup app/app/settings components/beti/ContactsManager.tsx
git commit -m "feat: add login, setup wizard, contacts manager and settings" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---


### Task 12: Home, trip start and active-trip screens

**Files:**
- Create: `app/app/page.tsx`, `app/app/trip/new/page.tsx`, `app/app/trip/[id]/page.tsx`

**Interfaces:**
- Consumes: `useT`, `BigButton`, `PinPad`, `AudioHint`, `SosPanel`, `useSos` (Task 10); `api`, `saveOfflineInfo`, `loadOfflineInfo`, `smsLink`, `safeSmsBody`, `queuePoint`, `readQueue`, `clearQueue`, `compressImage`, `playAudio` (Task 10); `Overview` (Task 7); `TRIP_DURATIONS` (Task 6); `createSupabaseBrowser` (Task 7); routes `/api/me`, `/api/trips`, `/api/trips/[id]/{location,finish,extend}`, `/api/sos`.
- Produces: `/app` (home), `/app/trip/new`, `/app/trip/[id]`.
- Behaviour rules from the spec: 🔴 never asks for a PIN; `sent === 0` shows the red "call 15" screen; offline 🔴 opens an SMS with numbers and location; GPS flushes every 20 s and queues offline; "Pohanch gayi" offline shows an SMS link and retries in memory; screen wake lock when supported.

- [ ] **Step 1: Create `app/app/page.tsx` (home)**

```tsx
'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { BigButton } from '@/components/beti/BigButton';
import { useT } from '@/components/beti/Shell';
import { SosPanel } from '@/components/beti/SosPanel';
import { useSos } from '@/components/beti/useSos';
import type { Overview } from '@/lib/account';
import { api } from '@/lib/client/api';
import { saveOfflineInfo } from '@/lib/client/offline';

export default function HomePage() {
  const { t } = useT();
  const router = useRouter();
  const sos = useSos();
  const [overview, setOverview] = useState<Overview | null>(null);

  useEffect(() => {
    (async () => {
      const res = await api<Overview>('/api/me');
      if (!res.ok || !res.data) return; // offline: the big buttons still work
      const o = res.data;
      if (!o.profile?.hasPin) {
        router.replace('/app/setup');
        return;
      }
      if (o.openTrip) {
        router.replace(`/app/trip/${o.openTrip.id}`);
        return;
      }
      saveOfflineInfo({ name: o.profile.name, phones: o.contacts.flatMap((c) => (c.phone ? [c.phone] : [])) });
      setOverview(o);
    })();
  }, [router]);

  const ready = overview?.contacts.filter((c) => c.status === 'connected').length ?? 0;
  const broken = overview?.contacts.filter((c) => c.status === 'blocked').length ?? 0;

  return (
    <main className="flex flex-col gap-5">
      <header className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-white">🛡️ {t('appName')}</h1>
        <Link href="/app/settings" aria-label={t('settings')} className="text-3xl">⚙️</Link>
      </header>

      {sos.state.phase !== 'idle' ? (
        <SosPanel state={sos.state} onClose={sos.reset} />
      ) : (
        <>
          <BigButton icon="🚗" label={t('startTrip')} tone="go" audio="home-start" href="/app/trip/new" />
          <BigButton icon="🔴" label={t('help')} tone="danger" audio="home-sos" onClick={sos.trigger} />
          {overview && (
            <p className="text-center text-lg text-slate-200">
              👨‍👩‍👧 {ready} {t('contactsReady')}
              {broken > 0 && <span className="block text-amber-400">⚠️ {broken} {t('contactBroken')}</span>}
            </p>
          )}
        </>
      )}
    </main>
  );
}
```

- [ ] **Step 2: Create `app/app/trip/new/page.tsx`**

```tsx
'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { AudioHint } from '@/components/beti/AudioHint';
import { BigButton } from '@/components/beti/BigButton';
import { useT } from '@/components/beti/Shell';
import { api } from '@/lib/client/api';
import { compressImage } from '@/lib/client/image';
import { TRIP_DURATIONS } from '@/lib/durations';
import { createSupabaseBrowser } from '@/lib/supabase/browser';

export default function NewTripPage() {
  const { t } = useT();
  const router = useRouter();
  const [preview, setPreview] = useState<string | null>(null);
  const [photoPath, setPhotoPath] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [duration, setDuration] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onPhoto = async (file: File | undefined) => {
    if (!file) return;
    setPreview(URL.createObjectURL(file));
    setUploading(true);
    setError(null);
    try {
      const supabase = createSupabaseBrowser();
      const { data } = await supabase.auth.getUser();
      if (!data.user) throw new Error('signed out');
      const path = `${data.user.id}/${crypto.randomUUID()}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from('vehicle-photos')
        .upload(path, await compressImage(file), { contentType: 'image/jpeg' });
      if (uploadError) throw uploadError;
      setPhotoPath(path);
    } catch {
      setPhotoPath(null);
      setError(t('photoFailed'));
    } finally {
      setUploading(false);
    }
  };

  const start = async () => {
    if (!duration) return;
    setBusy(true);
    const res = await api<{ trip: { id: string } }>('/api/trips', { body: { durationMin: duration, vehiclePhotoPath: photoPath } });
    setBusy(false);
    if (res.ok && res.data) router.replace(`/app/trip/${res.data.trip.id}`);
    else if (res.data?.error === 'trip_open') router.replace('/app');
    else setError(t(res.status === 0 ? 'noNet' : 'errGeneric'));
  };

  return (
    <main className="flex flex-col gap-5">
      <label className="relative flex flex-col items-center justify-center gap-2 rounded-3xl bg-white/[0.05] border-2 border-dashed border-white/20 h-48 overflow-hidden cursor-pointer">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="" className="absolute inset-0 w-full h-full object-cover opacity-80" />
        ) : (
          <span className="text-6xl" aria-hidden>📷</span>
        )}
        <span className="relative z-10 flex items-center gap-2 text-xl font-bold text-white bg-black/50 rounded-full px-4 py-1">
          {uploading ? '⏳' : '📷'} {t('takePhoto')} <AudioHint name="trip-photo" />
        </span>
        <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => onPhoto(e.target.files?.[0])} />
      </label>

      <h2 className="flex items-center gap-2 text-2xl font-bold text-white">
        ⏱️ {t('howLong')} <AudioHint name="trip-time" />
      </h2>
      <div dir="ltr" className="grid grid-cols-2 gap-3">
        {TRIP_DURATIONS.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setDuration(m)}
            className={`rounded-3xl py-6 text-3xl font-bold ${duration === m ? 'bg-brand-violet text-white ring-4 ring-white/60' : 'bg-white/[0.06] text-slate-100'}`}
          >
            {m} <span className="text-lg">{t('minutes')}</span>
          </button>
        ))}
      </div>

      {error && <p className="text-amber-300 font-bold text-center">{error}</p>}
      <BigButton icon="▶️" label={t('go')} tone="go" audio="trip-go" disabled={!duration || uploading || busy} onClick={start} />
    </main>
  );
}
```

Note: the page imports `TRIP_DURATIONS` from `@/lib/durations` (Task 6), never from `@/lib/trips`, so no server code (`node:crypto`, repo) is bundled into the client.

- [ ] **Step 3: Create `app/app/trip/[id]/page.tsx` (active trip)**

```tsx
'use client';

import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AudioHint } from '@/components/beti/AudioHint';
import { BigButton } from '@/components/beti/BigButton';
import { PinPad } from '@/components/beti/PinPad';
import { useT } from '@/components/beti/Shell';
import { SosPanel } from '@/components/beti/SosPanel';
import { useSos } from '@/components/beti/useSos';
import type { Overview } from '@/lib/account';
import { playAudio } from '@/lib/audio';
import { api } from '@/lib/client/api';
import { clearQueue, loadOfflineInfo, queuePoint, readQueue, safeSmsBody, smsLink, type OfflineInfo } from '@/lib/client/offline';
import type { TripStatus } from '@/lib/types';

type PinMode = null | 'finish' | 'extend';

function formatLeft(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

export default function TripPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { t } = useT();
  const sos = useSos();
  const [trip, setTrip] = useState<{ status: TripStatus; deadlineAt: string } | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [gps, setGps] = useState<'wait' | 'ok' | 'off'>('wait');
  const [online, setOnline] = useState(true);
  const [pinMode, setPinMode] = useState<PinMode>(null);
  const [pinError, setPinError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [offlineFinish, setOfflineFinish] = useState(false);
  const [offline, setOffline] = useState<OfflineInfo | null>(null);
  const pendingFinishPin = useRef<string | null>(null); // memory only, never stored

  const finishSafely = useCallback(() => {
    pendingFinishPin.current = null;
    setOfflineFinish(false);
    setPinMode(null);
    setDone(true);
    setTimeout(() => router.replace('/app'), 2500);
  }, [router]);

  const submitPin = useCallback(
    async (mode: 'finish' | 'extend', pin: string) => {
      setBusy(true);
      setPinError(null);
      const res = await api<{ status: string; deadlineAt?: string }>(`/api/trips/${id}/${mode}`, { body: { pin } });
      setBusy(false);
      if (res.status === 0) {
        setOnline(false);
        if (mode === 'finish') {
          pendingFinishPin.current = pin;
          setOfflineFinish(true);
          setPinMode(null);
        } else {
          setPinError(t('noNet'));
        }
        return;
      }
      const status = res.data?.status;
      if (status === 'wrong') {
        setPinError(t('wrongPin'));
        playAudio('pin-wrong');
      } else if (status === 'locked') {
        setPinError(t('locked'));
      } else if (mode === 'finish' && status === 'safe') {
        finishSafely();
      } else if (mode === 'extend' && status === 'extended' && res.data?.deadlineAt) {
        const deadlineAt = res.data.deadlineAt;
        setTrip((tr) => (tr ? { ...tr, deadlineAt } : tr));
        setPinMode(null);
      } else {
        setPinError(t('errGeneric'));
      }
    },
    [id, t, finishSafely],
  );

  // Initial load: make sure this is the user's open trip.
  useEffect(() => {
    setOffline(loadOfflineInfo());
    api<Overview>('/api/me').then((res) => {
      if (!res.ok || !res.data) return;
      const open = res.data.openTrip;
      if (!open || open.id !== id) router.replace('/app');
      else setTrip({ status: open.status, deadlineAt: open.deadlineAt });
    });
  }, [id, router]);

  // Countdown clock.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // GPS: queue every fix locally; the flush below sends them.
  useEffect(() => {
    if (!('geolocation' in navigator)) {
      setGps('off');
      return;
    }
    const watch = navigator.geolocation.watchPosition(
      (p) => {
        setGps('ok');
        queuePoint(id, {
          lat: p.coords.latitude,
          lng: p.coords.longitude,
          accuracyM: Number.isFinite(p.coords.accuracy) ? p.coords.accuracy : null,
          recordedAt: new Date(p.timestamp).toISOString(),
        });
      },
      () => {
        setGps('off');
        playAudio('gps-help');
      },
      { enableHighAccuracy: true, maximumAge: 10_000 },
    );
    return () => navigator.geolocation.clearWatch(watch);
  }, [id]);

  // Every 20 s: send queued points, learn the server status, retry an offline "safe".
  const flush = useCallback(async () => {
    const points = readQueue(id);
    const res = await api<{ saved: number; status: TripStatus; deadlineAt: string }>(`/api/trips/${id}/location`, { body: { points } });
    if (res.status === 0) {
      setOnline(false);
      return;
    }
    setOnline(true);
    if (!res.ok || !res.data) return;
    clearQueue(id, points.length);
    if (pendingFinishPin.current) {
      await submitPin('finish', pendingFinishPin.current);
      return;
    }
    if (res.data.status === 'safe') {
      router.replace('/app');
      return;
    }
    setTrip({ status: res.data.status, deadlineAt: res.data.deadlineAt });
  }, [id, router, submitPin]);

  useEffect(() => {
    flush();
    const timer = setInterval(flush, 20_000);
    return () => clearInterval(timer);
  }, [flush]);

  // Keep the screen on while the trip runs (where supported).
  useEffect(() => {
    let lock: { release(): Promise<void> } | null = null;
    const request = async () => {
      try {
        lock = await (navigator as Navigator & { wakeLock?: { request(type: 'screen'): Promise<{ release(): Promise<void> }> } })
          .wakeLock?.request('screen') ?? null;
      } catch {}
    };
    request();
    const onVisible = () => {
      if (document.visibilityState === 'visible') request();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      lock?.release().catch(() => {});
    };
  }, []);

  if (done) {
    return (
      <main className="flex flex-col items-center gap-4 pt-16 text-center">
        <p className="text-8xl" aria-hidden>✅</p>
        <p className="text-3xl font-bold text-emerald-300">{t('safeDone')}</p>
      </main>
    );
  }

  if (sos.state.phase !== 'idle') {
    return <main><SosPanel state={sos.state} onClose={sos.reset} /></main>;
  }

  if (pinMode) {
    return (
      <main className="pt-4">
        <PinPad
          title={t('enterPin')}
          audio={pinMode === 'finish' ? 'trip-safe' : 'trip-extend'}
          error={pinError}
          busy={busy}
          onComplete={(pin) => submitPin(pinMode, pin)}
          onCancel={() => {
            setPinMode(null);
            setPinError(null);
          }}
        />
      </main>
    );
  }

  const left = trip ? new Date(trip.deadlineAt).getTime() - now : null;

  return (
    <main className="flex flex-col gap-5">
      <div className="rounded-3xl bg-white/[0.05] border border-white/10 p-6 text-center">
        <p dir="ltr" className={`text-7xl font-bold font-mono ${left !== null && left <= 0 ? 'text-red-400' : 'text-white'}`}>
          {left === null ? '—' : formatLeft(left)}
        </p>
        {left !== null && left <= 0 && <p className="text-xl font-bold text-red-300 mt-2">⏰ {t('timeUp')}</p>}
        <div className="flex justify-center gap-4 mt-4 text-lg">
          <span className={gps === 'off' ? 'text-amber-300' : 'text-emerald-300'}>📍 {t(gps === 'off' ? 'gpsOff' : 'gpsOk')}</span>
          {!online && <span className="text-amber-300">📵 {t('noNet')}</span>}
        </div>
      </div>

      {trip?.status === 'alerted' && (
        <p className="rounded-2xl bg-red-950/60 border border-red-500/40 p-4 text-center text-xl font-bold text-red-200">
          🚨 {t('alertedTrip')}
        </p>
      )}

      {offlineFinish && (
        <div className="rounded-2xl bg-amber-950/50 border border-amber-500/40 p-4 flex flex-col gap-3 text-center">
          <p className="flex items-center justify-center gap-2 text-lg font-bold text-amber-200">
            📵 {t('finishOffline')} <AudioHint name="net-off" />
          </p>
          {offline && offline.phones.length > 0 && (
            <a href={smsLink(offline.phones, safeSmsBody(offline.name))} className="rounded-2xl bg-amber-500 text-black text-xl font-bold py-4">
              💬 {t('sendSms')}
            </a>
          )}
        </div>
      )}

      <BigButton icon="🟢" label={t('reached')} tone="safe" audio="trip-safe" onClick={() => setPinMode('finish')} />
      <BigButton icon="🔴" label={t('help')} tone="danger" audio="home-sos" onClick={sos.trigger} />
      <BigButton icon="⏱️" label={t('extend')} small audio="trip-extend" onClick={() => setPinMode('extend')} />
    </main>
  );
}
```

- [ ] **Step 4: Type-check, test and build**

Run: `npx tsc --noEmit && npm test && npm run build`
Expected: no errors; build lists `/app`, `/app/trip/new`, `/app/trip/[id]`.

- [ ] **Step 5: Visual + behaviour check (needs Supabase keys)**

`npm run dev`, 390×844, signed in with a finished setup:
- Home shows 🚗 and 🔴 with 🔊 hints and the contacts count.
- 🔴 → "sending" → ✅ with a count (Telegram test chat gets the alert). With DevTools "Offline", 🔴 shows the SMS button whose `sms:` link lists the contacts' numbers.
- Start a 10-minute trip with a photo → countdown runs; DevTools Network shows `/location` every ~20 s.
- 🟢 + wrong PIN → "غلط PIN"; right PIN → ✅ screen → back home; Telegram gets "reached safely".
- Go offline, press 🟢 + PIN → amber SMS panel; go online → within 20 s the trip finishes and the ✅ screen appears.

- [ ] **Step 6: Commit**

```bash
git add app/app/page.tsx app/app/trip
git commit -m "feat: add home, trip start and active trip screens with offline fallbacks" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---


### Task 13: `/help` page, family live map, calculator SOS, landing link

**Files:**
- Create: `lib/client/leaflet.ts`, `components/beti/LiveMap.tsx`, `app/help/layout.tsx`, `app/help/page.tsx`, `app/t/[token]/layout.tsx`, `app/t/[token]/page.tsx`
- Modify: `app/tracker/page.tsx` (use the shared Leaflet loader), `app/calculator/page.tsx:16-36` (real SOS), `app/page.tsx` (add "Open App" to `navLinks`)

**Interfaces:**
- Consumes: `Shell`, `useT`, `BigButton`, `PinPad`, `AudioHint` (Task 10); `api`, `currentPosition` (Task 10); `LiveView` type (Task 6); routes `/api/help`, `/api/t/[token]`, `/api/sos`.
- Produces: `loadLeaflet(): Promise<any>` (loads CSS + JS once, retries after a failure); `LiveMap({ lat, lng })`; pages `/help`, `/t/[token]`.

- [ ] **Step 1: Create `lib/client/leaflet.ts`**

```ts
// Loads Leaflet from unpkg once per page. Safe under React Strict Mode double effects.
let loading: Promise<any> | null = null;

export function loadLeaflet(): Promise<any> {
  const w = window as unknown as { L?: unknown };
  if (w.L) return Promise.resolve(w.L);
  if (loading) return loading;
  loading = new Promise((resolve, reject) => {
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.async = true;
    script.onload = () => resolve(w.L);
    script.onerror = () => {
      loading = null;
      reject(new Error('Leaflet failed to load'));
    };
    document.head.appendChild(script);
  });
  return loading;
}
```

- [ ] **Step 2: Switch `app/tracker/page.tsx` to the shared loader**

Add the import:

```tsx
import { loadLeaflet } from '@/lib/client/leaflet';
```

Replace the whole `useEffect(() => { ... }, []);` block (Leaflet CSS/JS loading, `initMap`, cleanup) with:

```tsx
  useEffect(() => {
    let cancelled = false;
    loadLeaflet()
      .then((L) => {
        if (cancelled || mapInstanceRef.current || !mapContainerRef.current) return;
        const lat = 24.8607;
        const lng = 67.0011;
        const map = L.map(mapContainerRef.current, { zoomControl: false }).setView([lat, lng], 15);
        mapInstanceRef.current = map;

        // OSM tiles need no API key; darkened via the .map-tiles-dark CSS filter
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          maxZoom: 19,
          className: 'map-tiles-dark',
        }).addTo(map);

        const pulseIcon = L.divIcon({
          className: 'relative',
          html: `
          <div style="position: relative;">
            <div style="border: 3px solid #ef4444; border-radius: 50%; height: 36px; width: 36px; position: absolute; left: -6px; top: -6px; animation: pulsate 1.8s ease-out infinite; opacity: 0;"></div>
            <div style="background: #ef4444; border: 2.5px solid #ffffff; border-radius: 50%; height: 24px; width: 24px; box-shadow: 0 0 15px rgba(239, 68, 68, 0.8);"></div>
          </div>
        `,
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        });

        L.marker([lat, lng], { icon: pulseIcon })
          .addTo(map)
          .bindPopup(`
          <div style="color: #0f172a; font-family: sans-serif; font-size: 11px; padding: 4px;">
            <b style="color: #ef4444;">🚨 Active SOS Incident</b><br/>
            Ayesha (+92 300 1234567)<br/>
            Ride: Careem (BK-9988)<br/>
            Speed: 28 km/h
          </div>
        `)
          .openPopup();
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);
```

Check: open `/tracker` — the dark map, red marker and popup look as before; only one `leaflet.js` script tag exists (`document.querySelectorAll('script[src*=leaflet]').length === 1`).

- [ ] **Step 3: Create `components/beti/LiveMap.tsx`**

```tsx
'use client';

import { useEffect, useRef } from 'react';
import { loadLeaflet } from '@/lib/client/leaflet';

export function LiveMap({ lat, lng }: { lat: number; lng: number }) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null);
  const marker = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;
    loadLeaflet()
      .then((L) => {
        if (cancelled || !container.current) return;
        if (!map.current) {
          map.current = L.map(container.current).setView([lat, lng], 16);
          L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
            maxZoom: 19,
            className: 'map-tiles-dark',
          }).addTo(map.current);
          marker.current = L.circleMarker([lat, lng], {
            radius: 11, color: '#ffffff', weight: 3, fillColor: '#ef4444', fillOpacity: 1,
          }).addTo(map.current);
        } else {
          marker.current.setLatLng([lat, lng]);
          map.current.panTo([lat, lng]);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [lat, lng]);

  useEffect(
    () => () => {
      map.current?.remove();
      map.current = null;
    },
    [],
  );

  return <div ref={container} className="w-full h-72 rounded-3xl overflow-hidden border border-white/10" />;
}
```

- [ ] **Step 4: Create the `/t/[token]` layout and page**

```tsx
// app/t/[token]/layout.tsx
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Shell } from '@/components/beti/Shell';

export const metadata: Metadata = { title: 'Beti AI — Live', robots: { index: false, follow: false } };

export default function LiveLayout({ children }: { children: ReactNode }) {
  return <Shell>{children}</Shell>;
}
```

```tsx
// app/t/[token]/page.tsx
'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { LiveMap } from '@/components/beti/LiveMap';
import { useT } from '@/components/beti/Shell';
import { api } from '@/lib/client/api';
import type { LiveView } from '@/lib/trips';

const BADGE = {
  active: 'bg-indigo-500/20 text-indigo-200 border-indigo-400/40',
  alerted: 'bg-red-600/30 text-red-100 border-red-400/60 animate-pulse',
  safe: 'bg-emerald-600/25 text-emerald-100 border-emerald-400/50',
} as const;

export default function LivePage() {
  const { token } = useParams<{ token: string }>();
  const { t, lang } = useT();
  const [view, setView] = useState<LiveView | null>(null);
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    const load = async () => {
      const res = await api<LiveView>(`/api/t/${token}`);
      if (res.status === 404) setExpired(true);
      else if (res.ok && res.data) setView(res.data);
    };
    load();
    const timer = setInterval(load, 20_000);
    return () => clearInterval(timer);
  }, [token]);

  if (expired) return <p className="pt-16 text-center text-2xl font-bold text-slate-300">⌛ {t('linkExpired')}</p>;
  if (!view) return <p className="pt-16 text-center text-slate-300">{t('loading')}</p>;

  const statusKey = view.status === 'alerted' ? 'statusAlerted' : view.status === 'safe' ? 'statusSafe' : 'statusActive';
  const seen = view.last
    ? new Date(view.last.recordedAt).toLocaleTimeString(lang === 'ur' ? 'ur-PK' : 'en-PK', { hour: 'numeric', minute: '2-digit' })
    : null;

  return (
    <main className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold text-white">📍 {t('liveTitle')} — {view.name}</h1>
      <span className={`self-start rounded-full border px-4 py-1 text-lg font-bold ${BADGE[view.status]}`}>{t(statusKey)}</span>
      {view.last ? (
        <>
          <LiveMap lat={view.last.lat} lng={view.last.lng} />
          <p className="text-slate-300">🕐 {t('lastSeen')}: {seen}</p>
          <a
            href={`https://maps.google.com/?q=${view.last.lat},${view.last.lng}`}
            target="_blank"
            rel="noreferrer"
            className="rounded-3xl bg-white/10 text-white text-xl font-bold py-4 text-center"
          >
            🗺️ {t('openMaps')}
          </a>
        </>
      ) : (
        <p className="text-amber-300 text-lg">📍 {t('gpsOff')}</p>
      )}
      <a href="tel:15" className="rounded-3xl bg-red-600 text-white text-2xl font-bold py-5 text-center">📞 {t('call15')}</a>
    </main>
  );
}
```

- [ ] **Step 5: Create the `/help` layout and page**

```tsx
// app/help/layout.tsx
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Shell } from '@/components/beti/Shell';

export const metadata: Metadata = { title: 'Beti AI — Help' };

export default function HelpLayout({ children }: { children: ReactNode }) {
  return <Shell>{children}</Shell>;
}
```

```tsx
// app/help/page.tsx
'use client';

import { useState } from 'react';
import { AudioHint } from '@/components/beti/AudioHint';
import { BigButton } from '@/components/beti/BigButton';
import { PinPad } from '@/components/beti/PinPad';
import { useT } from '@/components/beti/Shell';
import { api } from '@/lib/client/api';

type Action = 'help' | 'ok';
type Step = 'choose' | 'form' | 'pin' | 'done';

export default function HelpPage() {
  const { t } = useT();
  const [step, setStep] = useState<Step>('choose');
  const [action, setAction] = useState<Action>('help');
  const [phone, setPhone] = useState('');
  const [callback, setCallback] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const choose = (a: Action) => {
    setAction(a);
    setError(null);
    setStep('form');
  };

  const submit = async (pin: string) => {
    setBusy(true);
    setError(null);
    const res = await api<{ status: string }>('/api/help', { body: { phone, pin, action, callbackNumber: callback || null } });
    setBusy(false);
    const status = res.data?.status;
    if (res.status === 0) setError(t('noNet'));
    else if (status === 'done') setStep('done');
    else if (status === 'locked') setError(t('locked'));
    else setError(t('wrongPin'));
  };

  return (
    <main className="flex flex-col gap-5">
      <h1 className="flex items-center gap-2 text-2xl font-bold text-white">
        🛡️ {t('appName')} <AudioHint name="help-page" />
      </h1>

      {step === 'choose' && (
        <>
          <BigButton icon="🔴" label={t('needHelp')} tone="danger" onClick={() => choose('help')} />
          <BigButton icon="✅" label={t('imOkPhoneGone')} tone="safe" onClick={() => choose('ok')} />
          <a href="tel:15" className="rounded-3xl bg-white/10 text-white text-xl font-bold py-4 text-center">📞 {t('call15')}</a>
        </>
      )}

      {step === 'form' && (
        <>
          <input
            dir="ltr"
            inputMode="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="03XX-XXXXXXX"
            aria-label={t('phone')}
            className="w-full rounded-2xl bg-black/40 border border-white/10 px-4 py-4 text-xl text-white"
          />
          {action === 'ok' && (
            <input
              dir="ltr"
              inputMode="tel"
              value={callback}
              onChange={(e) => setCallback(e.target.value)}
              placeholder={t('callbackNumber')}
              className="w-full rounded-2xl bg-black/40 border border-white/10 px-4 py-4 text-xl text-white"
            />
          )}
          <BigButton icon="➡️" label={t('next')} tone="go" small disabled={!phone.trim()} onClick={() => setStep('pin')} />
          <button type="button" onClick={() => setStep('choose')} className="text-slate-300 underline">{t('back')}</button>
        </>
      )}

      {step === 'pin' && (
        <PinPad title={t('enterPin')} error={error} busy={busy} onComplete={submit} onCancel={() => setStep('form')} />
      )}

      {step === 'done' && (
        <div className="flex flex-col gap-4 text-center pt-6">
          <p className="text-7xl" aria-hidden>{action === 'help' ? '🚨' : '✅'}</p>
          <p className="text-2xl font-bold text-emerald-300">{t(action === 'help' ? 'alertSent' : 'helpDone')}</p>
          <a href="tel:15" className="rounded-3xl bg-red-600 text-white text-2xl font-bold py-5">📞 {t('call15')}</a>
        </div>
      )}
    </main>
  );
}
```

- [ ] **Step 6: Wire the calculator's `9999=` to the real SOS**

In `app/calculator/page.tsx` add the import:

```tsx
import { currentPosition } from '@/lib/client/geo';
```

and replace the `try { await fetch('/api/trigger-sos', ...) } catch ...` block inside `triggerStealthEmergency` with:

```tsx
    try {
      const pos = await currentPosition(3000);
      const res = await fetch('/api/sos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'calculator', lat: pos?.lat ?? null, lng: pos?.lng ?? null }),
      });
      if (res.status === 401) {
        // Not signed in: keep the public demo behaviour.
        await fetch('/api/trigger-sos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phone: '+923001234567',
            triggerType: 'PANIC_KEYWORD',
            reason: 'Stealth SOS triggered via Calculator disguise',
          }),
        });
      }
    } catch (e) {
      console.error(e);
    }
```

- [ ] **Step 7: Link the real app from the landing page**

In `app/page.tsx`, add a first entry to `navLinks`:

```tsx
  { href: '/app', label: 'Open App', Icon: ShieldCheck, color: 'text-emerald-400' },
```

(`ShieldCheck` is already imported.)

- [ ] **Step 8: Type-check, test, build**

Run: `npx tsc --noEmit && npm test && npm run build`
Expected: no errors; build lists `/help` and `/t/[token]`.

- [ ] **Step 9: Visual check**

`npm run dev`, 390×844:
- `/help` shows 🔴 / ✅ / 📞 15 in Urdu; entering a junk number and any PIN shows "غلط PIN" (not an error page).
- `/t/does-not-exist` shows "یہ لنک ختم ہو چکا ہے".
- `/tracker` still shows the dark map with one Leaflet script.
- Landing page nav shows "Open App" first.
- With keys: start a trip, open its live link from the Telegram test alert on another phone — the red dot follows the trip every ~20 s.

- [ ] **Step 10: Commit**

```bash
git add lib/client/leaflet.ts components/beti/LiveMap.tsx app/help app/t app/tracker/page.tsx app/calculator/page.tsx app/page.tsx
git commit -m "feat: add /help page, family live map, real calculator SOS and app link" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---


### Task 14: Cron + retention SQL, deploy guide, fire drill

**Files:**
- Create: `supabase/setup-cron.sql`, `docs/deploy.md`, `docs/fire-drill.md`
- Modify: `README.md` (add a "Run the real app" section linking the three docs)

**Interfaces:**
- Consumes: `POST /api/cron/deadlines` + `x-cron-secret` (Task 8), `GET /api/health` (Task 8), `scripts/set-telegram-webhook.mjs` (Task 9), `docs/setup.md` (Task 1).
- Produces: the every-minute Dead-Man's Switch trigger, the daily retention job, and the manual end-to-end checklist that gates launch.

- [ ] **Step 1: Create `supabase/setup-cron.sql`**

```sql
-- Beti AI — scheduled jobs. Run in the Supabase SQL editor AFTER the app is deployed.
-- Before running, replace the two values in the first statement:
--   https://YOUR-APP.vercel.app  → your deployed URL (no trailing slash)
--   YOUR_CRON_SECRET             → the same value as CRON_SECRET in Vercel
create extension if not exists pg_cron;
create extension if not exists pg_net;

create schema if not exists private;
create table if not exists private.app_config (key text primary key, value text not null);
revoke all on schema private from anon, authenticated;

insert into private.app_config (key, value) values
  ('cron_url', 'https://YOUR-APP.vercel.app/api/cron/deadlines'),
  ('cron_secret', 'YOUR_CRON_SECRET')
on conflict (key) do update set value = excluded.value;

-- Every minute: expire overdue trips (Dead-Man's Switch) and retry failed alert deliveries.
select cron.schedule(
  'beti-deadlines',
  '* * * * *',
  $$
  select net.http_post(
    url := (select value from private.app_config where key = 'cron_url'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select value from private.app_config where key = 'cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 25000
  );
  $$
);

-- Daily 03:00 UTC: delete old locations (30 days normal trips, 90 days trips that had an alert).
select cron.schedule(
  'beti-retention',
  '0 3 * * *',
  $$
  delete from public.locations l
  using public.trips t
  where l.trip_id = t.id
    and l.recorded_at < now() - case
      when exists (select 1 from public.alerts a where a.trip_id = t.id) then interval '90 days'
      else interval '30 days'
    end;
  $$
);

-- Check: select jobname, schedule from cron.job;
-- Recent runs: select * from cron.job_run_details order by start_time desc limit 10;
-- HTTP results: select status_code, content from net._http_response order by created desc limit 10;
```

- [ ] **Step 2: Create `docs/deploy.md`**

````markdown
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
````

- [ ] **Step 3: Create `docs/fire-drill.md`**

```markdown
# Beti AI — Fire Drill (before launch and after every release)

Use a real cheap Android phone with Chrome, a second phone as "family" with Telegram, and a test Gmail. Tick every line three times.

## Setup
- [ ] Sign in with Google; the setup wizard runs in Urdu; 🔊 plays on every step.
- [ ] Add 2 contacts; send the invite on WhatsApp; each presses Start in Telegram; both turn ✅ within 5 s.
- [ ] 🧪 Test alert: both Telegram chats get the voice note + text; the email arrives; the app shows the count.

## Dead-Man's Switch
- [ ] Start a 10-min trip with a number-plate photo; do nothing.
- [ ] Within 1–2 minutes after the deadline, family gets: voice note, map pin, photo, text with live link, two buttons.
- [ ] Live link shows the red dot on the map; it moves while the phone moves.
- [ ] Press 🟢 on the phone + safe PIN → family gets "False alarm — she is safe".

## Normal trip
- [ ] Start trip → 🟢 + safe PIN before the deadline → family gets "reached safely"; no alert.
- [ ] +10 min with PIN moves the countdown by 10 minutes.

## Danger paths
- [ ] 🔴 Madad: family alerted within seconds, no PIN asked.
- [ ] Duress PIN at 🟢: phone shows ✅ exactly like normal; family gets the silent alert.
- [ ] Three wrong PINs: family gets "wrong PIN" alert; the 4th try says "locked 15 minutes".
- [ ] Calculator `9999=` while signed in: family alerted.

## Stolen phone
- [ ] From another phone, `/help` → 🔴 + number + PIN → family alerted.
- [ ] `/help` → ✅ "only my phone is gone" + callback number → family gets the message with that number; the open trip ends.
- [ ] Log in on the "stolen" phone: settings and contacts need the PIN.

## Failures
- [ ] Airplane mode + 🔴 → SMS app opens with both numbers and the map link; 📞 15 button works.
- [ ] Airplane mode during a trip for 2 minutes, then back online → the queued GPS points appear on the live map.
- [ ] Airplane mode + 🟢 + PIN → SMS "I reached safely" offered; back online → trip ends within 20 s.
- [ ] One family member blocks the bot → the home screen shows ⚠️ 1 disconnected; alerts still reach the other.
- [ ] Remove all contacts' Telegram + email → 🔴 shows the red "Alert not sent — call 15" screen.
- [ ] UptimeRobot shows the monitor green.
```

- [ ] **Step 4: Add a README section**

Append to `README.md`:

```markdown
## 🚀 Run the real app (Hissa 1)

1. Free accounts and local setup: [`docs/setup.md`](docs/setup.md)
2. Deploy for free: [`docs/deploy.md`](docs/deploy.md)
3. Before launch, run the checklist: [`docs/fire-drill.md`](docs/fire-drill.md)

The real app lives at `/app`; the family live map at `/t/<token>`; the stolen-phone page at `/help`. Tests: `npm test`.
```

- [ ] **Step 5: Final verification**

Run: `npm test && npm run build`
Expected: every test passes; the build succeeds.

- [ ] **Step 6: Commit**

```bash
git add supabase/setup-cron.sql docs/deploy.md docs/fire-drill.md README.md
git commit -m "docs: add cron/retention SQL, deploy guide and fire drill" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Spec coverage

| Spec section | Task |
|---|---|
| §2 Free services, accounts | 1 (setup.md), 14 (deploy.md) |
| §3.2 Database, RLS, storage | 3 |
| §3.3 Dead-Man's Switch (atomic, pg_cron, retry) | 3, 6, 8, 14 |
| §3.4 Telegram linking | 7 (invite links), 9 (webhook), 11 (WhatsApp share) |
| §4.1 Setup / Madadgar mode, consent, test alert | 11 |
| §4.2–4.4 Home, trip start, active trip, wake lock | 12 |
| §4.5 PIN pad, duress, 3 wrong → alert + lock | 2, 6, 10, 12 |
| §4.6 `/help` | 6, 8, 13 |
| §4.7 Family alert order, buttons, updates, email | 4, 5, 9 |
| §4.8 Live map, 24 h expiry | 6, 8, 13 |
| §5 Failure handling (offline SMS, GPS queue, channel retry, `sent: 0`, blocked bot, uptime) | 5, 6, 10, 12, 14 |
| §6 Security (bcrypt, RLS, service key, tokens, signed photo URLs, retention, webhook secrets) | 2, 3, 6, 7, 8, 9, 14 |
| §7 Testing (unit, API, fire drill, in-app test) | 1–9, 14, 11 |
| Calculator `9999=` real SOS | 13 |

Deviation from the spec wording in §3.1: the old demo engine in `src/agents/*` is left untouched (it still powers the landing-page demo); the real logic lives in `lib/` with the same responsibilities (trips ≈ Trip/Watchdog agents, alerts ≈ Dispatcher agent).
