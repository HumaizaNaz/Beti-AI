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
