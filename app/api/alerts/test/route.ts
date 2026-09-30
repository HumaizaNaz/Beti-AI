// app/api/alerts/test/route.ts
import { sendTestAlert } from '@/lib/account';
import { json, withUser } from '@/lib/api';
import { getDeps } from '@/lib/server-deps';

export async function POST() {
  return withUser(async (userId) => json(await sendTestAlert(getDeps(), userId)));
}
