function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

export interface ServerEnv {
  supabaseUrl: string;
  supabaseServiceKey: string;
  telegramToken: string;
  telegramBotUsername: string;
  telegramWebhookSecret: string;
  cronSecret: string;
  gmailUser: string;
  gmailAppPassword: string;
  appUrl: string;
}

export function serverEnv(): ServerEnv {
  return {
    supabaseUrl: required('NEXT_PUBLIC_SUPABASE_URL'),
    supabaseServiceKey: required('SUPABASE_SERVICE_ROLE_KEY'),
    telegramToken: required('TELEGRAM_BOT_TOKEN'),
    telegramBotUsername: required('NEXT_PUBLIC_TELEGRAM_BOT_USERNAME'),
    telegramWebhookSecret: required('TELEGRAM_WEBHOOK_SECRET'),
    cronSecret: required('CRON_SECRET'),
    gmailUser: required('GMAIL_USER'),
    gmailAppPassword: required('GMAIL_APP_PASSWORD'),
    appUrl: required('NEXT_PUBLIC_APP_URL'),
  };
}
