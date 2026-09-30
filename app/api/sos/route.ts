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
