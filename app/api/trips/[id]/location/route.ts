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
