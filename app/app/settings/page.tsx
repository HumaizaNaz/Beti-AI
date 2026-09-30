'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { BigButton } from '@/components/beti/BigButton';
import { ContactsManager } from '@/components/beti/ContactsManager';
import { PinPad } from '@/components/beti/PinPad';
import { useT } from '@/components/beti/Shell';
import { api } from '@/lib/client/api';
import { createSupabaseBrowser } from '@/lib/supabase/browser';

export default function SettingsPage() {
  const { t } = useT();
  const router = useRouter();
  const [pin, setPin] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [testSent, setTestSent] = useState<number | null>(null);

  const check = async (entered: string) => {
    setBusy(true);
    const res = await api<{ status: string }>('/api/pin/check', { body: { pin: entered } });
    setBusy(false);
    if (res.data?.status === 'ok') setPin(entered);
    else setError(t(res.data?.status === 'locked' ? 'locked' : 'wrongPin'));
  };

  const sendTest = async () => {
    setBusy(true);
    const res = await api<{ sent: number }>('/api/alerts/test', { body: {} });
    setBusy(false);
    setTestSent(res.data?.sent ?? 0);
  };

  const logout = async () => {
    await createSupabaseBrowser().auth.signOut();
    router.replace('/login');
  };

  if (!pin) {
    return (
      <main className="flex flex-col gap-6">
        <h1 className="text-3xl font-bold text-white">⚙️ {t('settings')}</h1>
        <PinPad title={t('enterPin')} error={error} busy={busy} onComplete={check} onCancel={() => router.replace('/app')} />
      </main>
    );
  }

  return (
    <main className="flex flex-col gap-6">
      <h1 className="text-3xl font-bold text-white">⚙️ {t('settings')}</h1>
      <ContactsManager pin={pin} />
      <BigButton icon="🧪" label={t('testAlert')} disabled={busy} onClick={sendTest} small />
      {testSent !== null && (
        <p className={`text-xl font-bold text-center ${testSent > 0 ? 'text-emerald-300' : 'text-red-400'}`}>
          {testSent > 0 ? `✅ ${t('testSent')}: ${testSent}` : `❌ ${t('alertFailed')}`}
        </p>
      )}
      <BigButton icon="🏠" label={t('back')} href="/app" small />
      <button type="button" onClick={logout} className="text-slate-400 underline">{t('logout')}</button>
    </main>
  );
}
