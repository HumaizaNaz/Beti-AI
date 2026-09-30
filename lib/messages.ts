import type { TelegramButton } from '@/lib/channels/telegram';
import type { AlertReason } from '@/lib/types';

const REASONS: Record<AlertReason, { ur: string; en: string }> = {
  timer: { ur: 'سفر کا وقت ختم ہو گیا اور کوئی جواب نہیں آیا', en: 'Trip timer ran out with no check-in' },
  sos: { ur: 'اس نے مدد کا بٹن دبایا', en: 'She pressed the help button' },
  duress: { ur: 'خاموش خطرے کا اشارہ', en: 'Silent danger signal' },
  wrong_pin: { ur: 'کسی نے بار بار غلط PIN ڈالا', en: 'Someone entered a wrong PIN repeatedly' },
  help_page: { ur: 'اس نے کسی اور فون سے مدد مانگی', en: 'She asked for help from another phone' },
  calculator: { ur: 'خاموش خطرے کا اشارہ', en: 'Silent danger signal' },
  test: { ur: 'یہ صرف ٹیسٹ ہے، پریشان نہ ہوں', en: 'This is only a test' },
};

export function mapsUrl(lat: number, lng: number): string {
  return `https://maps.google.com/?q=${lat},${lng}`;
}

export interface AlertTextInput {
  userName: string;
  reason: AlertReason;
  at: Date;
  lat: number | null;
  lng: number | null;
  shareUrl: string | null;
}

function pkTime(at: Date): string {
  return at.toLocaleString('en-US', {
    timeZone: 'Asia/Karachi', hour: 'numeric', minute: '2-digit', day: 'numeric', month: 'short',
  });
}

export function alertText(i: AlertTextInput): string {
  const isTest = i.reason === 'test';
  const lines = [
    isTest ? '🧪 Beti AI — ٹیسٹ / TEST' : `🚨 ${i.userName} کو مدد چاہیے! / ${i.userName} needs help!`,
    `📌 ${REASONS[i.reason].ur}`,
    `📌 ${REASONS[i.reason].en}`,
    `🕐 ${pkTime(i.at)}`,
    i.lat !== null && i.lng !== null ? `📍 ${mapsUrl(i.lat, i.lng)}` : '📍 مقام نہیں ملا / Location not available',
  ];
  if (i.shareUrl) lines.push(`🔗 لائیو / Live: ${i.shareUrl}`);
  if (!isTest) lines.push('📞 فوراً رابطہ کریں یا 15 پر کال کریں / Call her now or dial 15');
  return lines.join('\n');
}

export function alertSubject(userName: string, reason: AlertReason): string {
  return reason === 'test' ? 'Beti AI — Test alert' : `🚨 ${userName} needs help — Beti AI`;
}

export function voicePath(reason: AlertReason): string {
  return reason === 'test' ? '/audio/alert-test.mp3' : '/audio/alert-help.mp3';
}

export function familyButtons(alertId: string): TelegramButton[] {
  return [
    { text: '🏃 میں جا رہا ہوں / Going', data: `going:${alertId}` },
    { text: '✅ سب ٹھیک ہے / All OK', data: `ok:${alertId}` },
  ];
}

export function safeText(userName: string, afterAlert: boolean): string {
  return afterAlert
    ? `✅ غلط الارم تھا — ${userName} ٹھیک ہے۔\n✅ False alarm — ${userName} is safe.`
    : `✅ ${userName} خیریت سے پہنچ گئی۔\n✅ ${userName} reached safely.`;
}

export function phoneLostText(userName: string, callbackNumber: string | null): string {
  const base = `ℹ️ ${userName} ٹھیک ہے، اس کا فون چوری ہو گیا ہے۔\nℹ️ ${userName} is OK — her phone was stolen.`;
  return callbackNumber ? `${base}\n📞 ${callbackNumber}` : base;
}

export function familyUpdateText(userName: string, contactName: string, action: 'going' | 'ok'): string {
  return action === 'going'
    ? `🏃 ${contactName} ${userName} کی طرف جا رہے ہیں۔\n🏃 ${contactName} is going to ${userName}.`
    : `✅ ${contactName} نے تصدیق کی: ${userName} ٹھیک ہے۔\n✅ ${contactName} confirmed ${userName} is OK.`;
}

export function welcomeText(userName: string): string {
  return `✅ آپ ${userName} کے ایمرجنسی رابطہ بن گئے ہیں۔ خطرے میں آپ کو یہاں اطلاع ملے گی۔\n✅ You are now ${userName}'s emergency contact. Alerts will arrive here.`;
}

export const LINK_INVALID_TEXT =
  '⚠️ یہ لنک درست نہیں۔ نیا لنک منگوائیں۔\n⚠️ This link is not valid. Please ask for a new one.';

export function inviteShareText(userName: string, link: string): string {
  return `السلام علیکم! ${userName} نے آپ کو Beti AI پر اپنا ایمرجنسی رابطہ بنایا ہے۔ یہ لنک کھول کر Start دبائیں:\nAssalam o Alaikum! ${userName} added you as an emergency contact on Beti AI. Open this link and press Start:\n${link}`;
}
