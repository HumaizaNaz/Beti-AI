// app/api/me/route.ts
import { getOverview } from '@/lib/account';
import { json, withUser } from '@/lib/api';
import { getDeps } from '@/lib/server-deps';

export async function GET() {
  return withUser(async (userId) => json(await getOverview(getDeps(), userId)));
}
