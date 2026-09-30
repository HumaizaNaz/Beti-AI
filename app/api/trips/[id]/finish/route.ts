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
