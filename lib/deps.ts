import type { EmailApi } from '@/lib/channels/email';
import type { TelegramApi } from '@/lib/channels/telegram';
import type { Repo } from '@/lib/repo/types';

export interface Deps {
  repo: Repo;
  telegram: TelegramApi;
  email: EmailApi;
  appUrl: string;
  botUsername: string;
  now: () => Date;
  photoUrl: (path: string) => Promise<string | null>;
}
