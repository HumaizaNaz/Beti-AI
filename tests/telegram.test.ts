import { describe, expect, it } from 'vitest';
import { createTelegram } from '@/lib/channels/telegram';

function fakeFetch(reply: { status?: number; body: unknown }) {
  const calls: { url: string; body: any }[] = [];
  const impl = (async (url: string, init?: RequestInit) => {
    calls.push({ url, body: JSON.parse(String(init?.body)) });
    return new Response(JSON.stringify(reply.body), { status: reply.status ?? 200 });
  }) as unknown as typeof fetch;
  return { impl, calls };
}

describe('createTelegram', () => {
  it('sends a message with inline buttons', async () => {
    const f = fakeFetch({ body: { ok: true } });
    const tg = createTelegram('TOKEN', f.impl);
    await tg.sendMessage('42', 'hello', [{ text: 'OK', data: 'ok:1' }]);
    expect(f.calls[0].url).toBe('https://api.telegram.org/botTOKEN/sendMessage');
    expect(f.calls[0].body).toEqual({
      chat_id: '42', text: 'hello', disable_web_page_preview: true,
      reply_markup: { inline_keyboard: [[{ text: 'OK', callback_data: 'ok:1' }]] },
    });
  });

  it('sends location with numbers', async () => {
    const f = fakeFetch({ body: { ok: true } });
    await createTelegram('T', f.impl).sendLocation('42', 24.8, 67.0);
    expect(f.calls[0].body).toEqual({ chat_id: '42', latitude: 24.8, longitude: 67.0 });
  });

  it('throws with the Telegram description on failure', async () => {
    const f = fakeFetch({ status: 403, body: { ok: false, description: 'Forbidden: bot was blocked by the user' } });
    await expect(createTelegram('T', f.impl).sendMessage('42', 'x')).rejects.toThrow('bot was blocked');
  });
});
