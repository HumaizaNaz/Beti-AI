import type { EmailApi } from '@/lib/channels/email';
import type { TelegramApi } from '@/lib/channels/telegram';
import type { Deps } from '@/lib/deps';
import { hashPin } from '@/lib/pin';
import { createMemoryRepo, type MemoryRepo } from '@/lib/repo/memory';
import type { Profile } from '@/lib/types';

export interface TgCall {
  method: string;
  chatId: string;
  args: unknown[];
}

/** Fails any call whose method name or chat id is in `failing`. */
export function fakeTelegram() {
  const calls: TgCall[] = [];
  const failing = new Set<string>();
  const record = (method: string) => async (chatId: string, ...args: unknown[]) => {
    calls.push({ method, chatId, args });
    if (failing.has(method) || failing.has(chatId)) throw new Error(`${method} failed for ${chatId}`);
  };
  const api: TelegramApi = {
    sendMessage: record('sendMessage') as TelegramApi['sendMessage'],
    sendVoice: record('sendVoice') as TelegramApi['sendVoice'],
    sendLocation: record('sendLocation') as TelegramApi['sendLocation'],
    sendPhoto: record('sendPhoto') as TelegramApi['sendPhoto'],
    answerCallback: record('answerCallback') as TelegramApi['answerCallback'],
    setWebhook: record('setWebhook') as TelegramApi['setWebhook'],
  };
  const texts = (chatId?: string) =>
    calls.filter((c) => c.method === 'sendMessage' && (!chatId || c.chatId === chatId)).map((c) => String(c.args[0]));
  return { api, calls, failing, texts };
}

export function fakeEmail() {
  const sent: { to: string; subject: string; text: string }[] = [];
  const failing = new Set<string>();
  const api: EmailApi = {
    async send(to, subject, text) {
      sent.push({ to, subject, text });
      if (failing.has(to)) throw new Error(`email failed for ${to}`);
    },
  };
  return { api, sent, failing };
}

export function makeDeps(start = '2026-10-01T10:00:00.000Z') {
  const repo: MemoryRepo = createMemoryRepo();
  const tg = fakeTelegram();
  const mail = fakeEmail();
  const clock = { now: new Date(start) };
  const deps: Deps = {
    repo,
    telegram: tg.api,
    email: mail.api,
    appUrl: 'https://beti.test',
    botUsername: 'BetiTestBot',
    now: () => new Date(clock.now),
    photoUrl: async (path) => `https://files.test/${path}`,
  };
  const advance = (minutes: number) => {
    clock.now = new Date(clock.now.getTime() + minutes * 60_000);
  };
  return { deps, repo, tg, mail, clock, advance };
}

/** Ayesha (safe PIN 1234, duress PIN 9999) with Ammi (Telegram 111 + email) and Ali (Telegram 222). */
export async function seedUser(repo: MemoryRepo, opts: { id?: string; name?: string; phone?: string } = {}) {
  const profile: Profile = {
    id: opts.id ?? 'user-1',
    name: opts.name ?? 'Ayesha',
    phone: opts.phone ?? '+923001234567',
    safePinHash: await hashPin('1234'),
    duressPinHash: await hashPin('9999'),
    failedPinCount: 0,
    pinLockedUntil: null,
    lang: 'ur',
  };
  await repo.saveProfile(profile);
  const ammi = await repo.createContact({
    userId: profile.id, name: 'Ammi', relation: 'mother', phone: '+923007654321', email: 'ammi@example.com',
    telegramChatId: '111', inviteToken: `tok-ammi-${profile.id}`, status: 'connected',
  });
  const ali = await repo.createContact({
    userId: profile.id, name: 'Ali', relation: 'brother', phone: '+923009876543', email: null,
    telegramChatId: '222', inviteToken: `tok-ali-${profile.id}`, status: 'connected',
  });
  return { profile, ammi, ali };
}
