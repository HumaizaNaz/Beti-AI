// app/api/t/[token]/route.ts
import { errorResponse, json } from '@/lib/api';
import { getDeps } from '@/lib/server-deps';
import { getLiveView } from '@/lib/trips';

export async function GET(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  try {
    const view = await getLiveView(getDeps(), token);
    return view ? json(view) : json({ error: 'not_found' }, 404);
  } catch (err) {
    return errorResponse(err);
  }
}
