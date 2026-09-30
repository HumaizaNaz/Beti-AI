// app/api/contacts/[id]/route.ts
import { removeContact } from '@/lib/account';
import { json, readJson, withUser } from '@/lib/api';
import { getDeps } from '@/lib/server-deps';

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return withUser(async (userId) => {
    const body = await readJson(req);
    await removeContact(getDeps(), userId, id, body.pin);
    return json({ ok: true });
  });
}
