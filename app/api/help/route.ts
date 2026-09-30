import { errorResponse, json, readJson } from '@/lib/api';
import { helpFromAnyPhone } from '@/lib/help';
import { clientIp, createRateLimiter } from '@/lib/rate-limit';
import { getDeps } from '@/lib/server-deps';

// Public page: slow down scripted PIN guessing and alarm spamming from one address.
const allow = createRateLimiter(10, 15 * 60_000);

export async function POST(req: Request) {
  if (!allow(clientIp(req))) return json({ error: 'rate_limited' }, 429);
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
