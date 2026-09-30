import { resolveFromFamily } from '@/lib/alerts';
import type { Deps } from '@/lib/deps';
import { LINK_INVALID_TEXT, welcomeText } from '@/lib/messages';

type Obj = Record<string, any>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === 'object';

async function handleStart(deps: Deps, chatId: string, text: string) {
  const token = text.split(/\s+/)[1]?.trim();
  const contact = token ? await deps.repo.getContactByInviteToken(token) : null;
  // Once linked, an invite (which may sit in a WhatsApp chat or be forwarded) cannot move the contact to another chat.
  if (!contact || (contact.telegramChatId !== null && contact.telegramChatId !== chatId)) {
    await deps.telegram.sendMessage(chatId, LINK_INVALID_TEXT);
    return;
  }
  await deps.repo.updateContact(contact.id, { telegramChatId: chatId, status: 'connected' });
  const profile = await deps.repo.getProfile(contact.userId);
  await deps.telegram.sendMessage(chatId, welcomeText(profile?.name ?? ''));
  try {
    await deps.telegram.sendVoice(chatId, `${deps.appUrl}/audio/welcome-family.mp3`);
  } catch {
    // The text welcome is enough.
  }
}

export async function handleTelegramUpdate(deps: Deps, update: unknown): Promise<void> {
  if (!isObj(update)) return;

  const message = update.message;
  if (isObj(message) && isObj(message.chat) && typeof message.text === 'string' && message.text.startsWith('/start')) {
    await handleStart(deps, String(message.chat.id), message.text);
    return;
  }

  const cq = update.callback_query;
  if (isObj(cq) && typeof cq.id === 'string') {
    const [action, alertId] = String(cq.data ?? '').split(':');
    const chatId = String(cq.message?.chat?.id ?? cq.from?.id ?? '');
    let ok = false;
    if ((action === 'going' || action === 'ok') && alertId && chatId) {
      ok = (await resolveFromFamily(deps, { alertId, chatId, action })).ok;
    }
    await deps.telegram.answerCallback(cq.id, ok ? '✅ شکریہ / Thanks' : '⚠️');
    return;
  }

  const member = update.my_chat_member;
  if (isObj(member) && member.new_chat_member?.status === 'kicked' && isObj(member.chat)) {
    for (const c of await deps.repo.listContactsByChatId(String(member.chat.id))) {
      await deps.repo.updateContact(c.id, { status: 'blocked' });
    }
  }
}
