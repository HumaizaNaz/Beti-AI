'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AudioHint } from '@/components/beti/AudioHint';
import { BigButton } from '@/components/beti/BigButton';
import { ContactsManager } from '@/components/beti/ContactsManager';
import { PinPad } from '@/components/beti/PinPad';
import { useT } from '@/components/beti/Shell';
import type { Overview } from '@/lib/account';
import { api } from '@/lib/client/api';
import { errorKey } from '@/lib/client/errors';

type Step = 'loading' | 'consent' | 'identity' | 'safe' | 'safe2' | 'duress' | 'duress2' | 'gate' | 'contacts' | 'test';

export default function SetupPage() {
  const { t } = useT();
  const router = useRouter();
  const [step, setStep] = useState<Step>('loading');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [safePin, setSafePin] = useState('');
  const [duressPin, setDuressPin] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [testSent, setTestSent] = useState<number | null>(null);

  useEffect(() => {
    api<Overview>('/api/me').then((res) => setStep(res.data?.profile?.hasPin ? 'gate' : 'consent'));
  }, []);

  const go = (next: Step) => {
    setError(null);
    setStep(next);
  };

  const saveProfile = async (confirmedDuress: string) => {
    setBusy(true);
    const res = await api('/api/profile', { body: { name, phone, safePin, duressPin: confirmedDuress } });
    setBusy(false);
    if (!res.ok) {
      const code = res.data?.error;
      setStep(code === 'bad_phone' || code === 'bad_name' || code === 'phone_taken' ? 'identity' : 'safe');
      setError(t(errorKey(code)));
      return;
    }
    setPin(safePin);
    go('contacts');
  };

  const checkGate = async (entered: string) => {
    setBusy(true);
    const res = await api<{ status: string }>('/api/pin/check', { body: { pin: entered } });
    setBusy(false);
    if (res.data?.status === 'ok') {
      setPin(entered);
      go('contacts');
    } else {
      setError(t(res.data?.status === 'locked' ? 'locked' : 'wrongPin'));
    }
  };

  const sendTest = async () => {
    setBusy(true);
    const res = await api<{ sent: number }>('/api/alerts/test', { body: {} });
    setBusy(false);
    setTestSent(res.data?.sent ?? 0);
  };

  if (step === 'loading') return <p className="text-center text-slate-300">{t('loading')}</p>;

  return (
    <main className="flex flex-col gap-5">
      <h1 className="flex items-center gap-2 text-3xl font-bold text-white">
        {t('setupTitle')} <AudioHint name="setup-intro" />
      </h1>

      {step === 'consent' && (
        <>
          <div className="rounded-3xl bg-white/[0.05] border border-white/10 p-5">
            <h2 className="text-xl font-bold text-white mb-2">🔒 {t('consentTitle')}</h2>
            <p className="text-lg text-slate-200">{t('consentBody')}</p>
          </div>
          <BigButton icon="✅" label={t('agree')} tone="safe" onClick={() => go('identity')} />
        </>
      )}

      {step === 'identity' && (
        <>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('name')}
            className="w-full rounded-2xl bg-black/40 border border-white/10 px-4 py-4 text-xl text-white"
          />
          <input
            dir="ltr"
            inputMode="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="03XX-XXXXXXX"
            aria-label={t('phone')}
            className="w-full rounded-2xl bg-black/40 border border-white/10 px-4 py-4 text-xl text-white"
          />
          {error && <p className="text-red-400 font-bold">{error}</p>}
          <BigButton icon="➡️" label={t('next')} tone="go" small disabled={!name.trim() || !phone.trim()} onClick={() => go('safe')} />
        </>
      )}

      {step === 'safe' && (
        <PinPad title={t('safePin')} audio="setup-pin" error={error} onComplete={(p) => { setSafePin(p); go('safe2'); }} />
      )}
      {step === 'safe2' && (
        <PinPad
          title={t('pinAgain')}
          audio="setup-pin"
          error={error}
          onComplete={(p) => (p === safePin ? go('duress') : (setError(t('pinMismatch')), setStep('safe')))}
        />
      )}
      {step === 'duress' && (
        <PinPad
          title={t('duressPin')}
          audio="setup-duress"
          error={error}
          onComplete={(p) => (p === safePin ? setError(t('pinsMustDiffer')) : (setDuressPin(p), go('duress2')))}
        />
      )}
      {step === 'duress2' && (
        <PinPad
          title={t('pinAgain')}
          audio="setup-duress"
          error={error}
          busy={busy}
          onComplete={(p) => (p === duressPin ? saveProfile(p) : (setError(t('pinMismatch')), setStep('duress')))}
        />
      )}

      {step === 'gate' && <PinPad title={t('enterPin')} error={error} busy={busy} onComplete={checkGate} />}

      {step === 'contacts' && (
        <>
          <ContactsManager pin={pin} />
          <BigButton icon="➡️" label={t('next')} tone="go" small onClick={() => go('test')} />
        </>
      )}

      {step === 'test' && (
        <>
          <BigButton icon="🧪" label={t('testAlert')} tone="neutral" disabled={busy} onClick={sendTest} />
          {testSent !== null && (
            <p className={`text-xl font-bold text-center ${testSent > 0 ? 'text-emerald-300' : 'text-red-400'}`}>
              {testSent > 0 ? `✅ ${t('testSent')}: ${testSent}` : `❌ ${t('alertFailed')}`}
            </p>
          )}
          <BigButton icon="🏠" label={t('done')} tone="safe" small onClick={() => router.replace('/app')} />
        </>
      )}
    </main>
  );
}
