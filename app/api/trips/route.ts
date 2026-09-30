// app/api/trips/route.ts
import { json, readJson, withUser } from '@/lib/api';
import { getDeps } from '@/lib/server-deps';
import { startTrip } from '@/lib/trips';

export async function POST(req: Request) {
  return withUser(async (userId) => {
    const body = await readJson(req);
    const trip = await startTrip(getDeps(), userId, {
      durationMin: Number(body.durationMin),
      vehiclePhotoPath: typeof body.vehiclePhotoPath === 'string' ? body.vehiclePhotoPath : null,
    });
    return json({ trip: { id: trip.id, status: trip.status, deadlineAt: trip.deadlineAt } }, 201);
  });
}
