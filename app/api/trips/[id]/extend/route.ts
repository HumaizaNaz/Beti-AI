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
