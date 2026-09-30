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
