// app/api/contacts/route.ts
import { addContact } from '@/lib/account';
import { json, readJson, withUser } from '@/lib/api';
import { getDeps } from '@/lib/server-deps';

export async function POST(req: Request) {
  return withUser(async (userId) => {
    const contact = await addContact(getDeps(), userId, await readJson(req));
    return json({ contact: { id: contact.id } }, 201);
  });
}
