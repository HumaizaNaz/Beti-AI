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
