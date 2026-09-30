// app/api/help/route.ts
import { errorResponse, json, readJson } from '@/lib/api';
import { helpFromAnyPhone } from '@/lib/help';
import { getDeps } from '@/lib/server-deps';

export async function POST(req: Request) {
  try {
    const body = await readJson(req);
    const result = await helpFromAnyPhone(getDeps(), {
      phone: typeof body.phone === 'string' ? body.phone : '',
      pin: typeof body.pin === 'string' ? body.pin : '',
      action: body.action === 'ok' ? 'ok' : 'help',
      callbackNumber: typeof body.callbackNumber === 'string' ? body.callbackNumber : null,
    });
    return json(result);
  } catch (err) {
    return errorResponse(err);
  }
}
