export interface TelegramButton {
  text: string;
  data: string;
}

export interface TelegramApi {
  sendMessage(chatId: string, text: string, buttons?: TelegramButton[]): Promise<void>;
  sendVoice(chatId: string, url: string): Promise<void>;
  sendLocation(chatId: string, lat: number, lng: number): Promise<void>;
  sendPhoto(chatId: string, url: string): Promise<void>;
  answerCallback(callbackId: string, text: string): Promise<void>;
  setWebhook(url: string, secret: string): Promise<void>;
}

export function createTelegram(token: string, fetchImpl: typeof fetch = fetch): TelegramApi {
  async function call(method: string, body: Record<string, unknown>): Promise<void> {
    const res = await fetchImpl(`https://api.telegram.org/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = (await res.json().catch(() => ({}))) as { ok?: boolean; description?: string };
    if (!res.ok || !json.ok) throw new Error(`Telegram ${method} failed: ${json.description ?? res.status}`);
  }

  return {
    sendMessage: (chatId, text, buttons) =>
      call('sendMessage', {
        chat_id: chatId,
        text,
        disable_web_page_preview: true,
        ...(buttons?.length
          ? { reply_markup: { inline_keyboard: buttons.map((b) => [{ text: b.text, callback_data: b.data }]) } }
          : {}),
      }),
    sendVoice: (chatId, url) => call('sendVoice', { chat_id: chatId, voice: url }),
    sendLocation: (chatId, lat, lng) => call('sendLocation', { chat_id: chatId, latitude: lat, longitude: lng }),
    sendPhoto: (chatId, url) => call('sendPhoto', { chat_id: chatId, photo: url }),
    answerCallback: (callbackId, text) => call('answerCallbackQuery', { callback_query_id: callbackId, text }),
    setWebhook: (url, secret) =>
      call('setWebhook', {
        url,
        secret_token: secret,
        allowed_updates: ['message', 'callback_query', 'my_chat_member'],
      }),
  };
}
