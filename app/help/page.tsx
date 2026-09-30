'use client';

import { useState } from 'react';
import { AudioHint } from '@/components/beti/AudioHint';
import { BigButton } from '@/components/beti/BigButton';
import { PinPad } from '@/components/beti/PinPad';
import { useT } from '@/components/beti/Shell';
import { api } from '@/lib/client/api';

type Action = 'help' | 'ok';
type Step = 'choose' | 'form' | 'pin' | 'done';

export default function HelpPage() {
  const { t } = useT();
  const [step, setStep] = useState<Step>('choose');
  const [action, setAction] = useState<Action>('help');
  const [phone, setPhone] = useState('');
  const [callback, setCallback] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(0);

  const choose = (a: Action) => {
    setAction(a);
    setError(null);
    setStep('form');
  };

  const submit = async (pin: string) => {
    setBusy(true);
    setError(null);
    const res = await api<{ status: string; sent?: number }>('/api/help', {
      body: { phone, pin, action, callbackNumber: callback || null },
    });
    setBusy(false);
    const status = res.data?.status;
    if (res.status === 0) setError(t('noNet'));
    else if (status === 'done') {
      setSent(res.data?.sent ?? 0);
      setStep('done');
    } else if (status === 'locked' || res.status === 429) setError(t('locked'));
    else if (status === 'wrong') setError(t('wrongPin'));
    else setError(t('alertFailed')); // server error: never let her think it worked
  };

  return (
    <main className="flex flex-col gap-5">
      <h1 className="flex items-center gap-2 text-2xl font-bold text-white">
        🛡️ {t('appName')} <AudioHint name="help-page" />
      </h1>

      {step === 'choose' && (
        <>
          <BigButton icon="🔴" label={t('needHelp')} tone="danger" onClick={() => choose('help')} />
          <BigButton icon="✅" label={t('imOkPhoneGone')} tone="safe" onClick={() => choose('ok')} />
          <a href="tel:15" className="rounded-3xl bg-white/10 text-white text-xl font-bold py-4 text-center">📞 {t('call15')}</a>
        </>
      )}

      {step === 'form' && (
        <>
          <input
            dir="ltr"
            inputMode="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="03XX-XXXXXXX"
            aria-label={t('phone')}
            className="w-full rounded-2xl bg-black/40 border border-white/10 px-4 py-4 text-xl text-white"
          />
          {action === 'ok' && (
            <input
              dir="ltr"
              inputMode="tel"
              value={callback}
              onChange={(e) => setCallback(e.target.value)}
              placeholder={t('callbackNumber')}
              className="w-full rounded-2xl bg-black/40 border border-white/10 px-4 py-4 text-xl text-white"
            />
          )}
          <BigButton icon="➡️" label={t('next')} tone="go" small disabled={!phone.trim()} onClick={() => setStep('pin')} />
          <button type="button" onClick={() => setStep('choose')} className="text-slate-300 underline">{t('back')}</button>
        </>
      )}

      {step === 'pin' && (
        <PinPad title={t('enterPin')} error={error} busy={busy} onComplete={submit} onCancel={() => setStep('form')} />
      )}

      {step === 'done' && (
        <div className="flex flex-col gap-4 text-center pt-6">
          {sent > 0 ? (
            <>
              <p className="text-7xl" aria-hidden>{action === 'help' ? '🚨' : '✅'}</p>
              <p className="text-2xl font-bold text-emerald-300">{t(action === 'help' ? 'alertSent' : 'helpDone')} ({sent})</p>
            </>
          ) : (
            <>
              <p className="text-7xl" aria-hidden>❌</p>
              <p className="text-2xl font-bold text-red-300">{t('alertFailed')}</p>
            </>
          )}
          <a href="tel:15" className="rounded-3xl bg-red-600 text-white text-2xl font-bold py-5">📞 {t('call15')}</a>
        </div>
      )}
    </main>
  );
}
