import { describe, expect, it, vi } from 'vitest';
import { raiseAlert } from '@/lib/alerts';
import type { Deps } from '@/lib/deps';
import { handleTelegramUpdate } from '@/lib/telegram-webhook';
import { makeDeps, seedUser } from './helpers/fakes';

const state = vi.hoisted(() => ({ deps: null as Deps | null }));
vi.mock('@/lib/server-deps', () => ({ getDeps: () => state.deps }));
vi.mock('@/lib/env', () => ({ serverEnv: () => ({ telegramWebhookSecret: 'tg-secret' }) }));

const start = (chatId: number, text: string) => ({ message: { chat: { id: chatId }, text } });

describe('handleTelegramUpdate', () => {
  it('links a contact on /start <token> and welcomes them', async () => {
    const { deps, repo, tg } = makeDeps();
    const { profile } = await seedUser(repo);
    const sara = await repo.createContact({
      userId: profile.id, name: 'Sara', relation: 'sister', phone: null, email: null,
      telegramChatId: null, inviteToken: 'invite-sara', status: 'pending',
    });
    await handleTelegramUpdate(deps, start(555, '/start invite-sara'));
    expect(await repo.getContact(sara.id)).toMatchObject({ telegramChatId: '555', status: 'connected' });
    expect(tg.texts('555')[0]).toContain('Ayesha');
    expect(tg.calls.some((c) => c.method === 'sendVoice' && c.chatId === '555')).toBe(true);
  });

  it('answers politely for unknown or missing tokens', async () => {
    const { deps, tg } = makeDeps();
    await handleTelegramUpdate(deps, start(556, '/start nope'));
    await handleTelegramUpdate(deps, start(557, '/start'));
    expect(tg.texts('556')[0]).toContain('not valid');
    expect(tg.texts('557')[0]).toContain('not valid');
  });

  it('family button "ok" resolves the alert and answers the callback', async () => {
    const { deps, repo, tg } = makeDeps();
    const { profile } = await seedUser(repo);
    const { alert } = await raiseAlert(deps, { userId: profile.id, tripId: null, reason: 'sos' });
    await handleTelegramUpdate(deps, {
      callback_query: { id: 'cb1', from: { id: 222 }, message: { chat: { id: 222 } }, data: `ok:${alert.id}` },
    });
    expect((await repo.getAlert(alert.id))!.resolvedBy).toBe('Ali');
    expect(tg.calls.some((c) => c.method === 'answerCallback' && c.chatId === 'cb1')).toBe(true);
  });

  it('marks contacts blocked when they block the bot', async () => {
    const { deps, repo } = makeDeps();
    const { ammi } = await seedUser(repo);
    await handleTelegramUpdate(deps, { my_chat_member: { chat: { id: 111 }, new_chat_member: { status: 'kicked' } } });
    expect((await repo.getContact(ammi.id))!.status).toBe('blocked');
  });

  it('ignores junk updates', async () => {
    const { deps, tg } = makeDeps();
    for (const junk of [null, 42, {}, { message: {} }, { callback_query: { id: 'x', data: 'weird' } }]) {
      await handleTelegramUpdate(deps, junk);
    }
    expect(tg.calls.filter((c) => c.method !== 'answerCallback')).toHaveLength(0);
  });
});

describe('POST /api/telegram/webhook', () => {
  it('rejects a wrong secret and accepts the right one', async () => {
    state.deps = makeDeps().deps;
    const { POST } = await import('@/app/api/telegram/webhook/route');
    const req = (secret?: string) =>
      new Request('http://test', {
        method: 'POST',
        headers: secret ? { 'x-telegram-bot-api-secret-token': secret } : {},
        body: JSON.stringify(start(1, '/start x')),
      });
    expect((await POST(req())).status).toBe(401);
    expect((await POST(req('nope'))).status).toBe(401);
    expect((await POST(req('tg-secret'))).status).toBe(200);
  });
});
