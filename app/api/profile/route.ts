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
