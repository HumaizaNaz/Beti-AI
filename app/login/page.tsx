'use client';

import { useState } from 'react';
import { useT } from '@/components/beti/Shell';
import { createSupabaseBrowser } from '@/lib/supabase/browser';

export default function LoginPage() {
  const { t } = useT();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const redirectTo = () => `${window.location.origin}/auth/callback`;

  // Created on click, not during render, so prerendering works without Supabase env vars.
  const google = async () => {
    const { error } = await createSupabaseBrowser().auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: redirectTo() },
    });
    if (error) setError(t('errGeneric'));
  };

  const magicLink = async () => {
    const { error } = await createSupabaseBrowser().auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: redirectTo() },
    });
    if (error) setError(t('errGeneric'));
    else setSent(true);
  };

  return (
    <main className="flex flex-col gap-6 pt-6">
      <div className="text-center">
        <p className="text-6xl" aria-hidden>🛡️</p>
        <h1 className="text-3xl font-bold text-white mt-2">{t('appName')}</h1>
      </div>
      <button type="button" onClick={google} className="w-full rounded-3xl bg-white text-slate-900 text-xl font-bold py-5">
        G &nbsp;{t('loginGoogle')}
      </button>
      <div className="flex flex-col gap-3 rounded-3xl bg-white/[0.04] border border-white/10 p-4">
        <input
          type="email"
          dir="ltr"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="name@gmail.com"
          className="w-full rounded-2xl bg-black/40 border border-white/10 px-4 py-3 text-lg text-white"
        />
        <button
          type="button"
          onClick={magicLink}
          disabled={!email.includes('@')}
          className="w-full rounded-2xl bg-white/10 text-white text-lg font-bold py-3 disabled:opacity-40"
        >
          ✉️ {t('loginEmail')}
        </button>
        {sent && <p className="text-emerald-300 text-center font-bold">{t('checkEmail')}</p>}
      </div>
      {error && <p className="text-red-400 text-center font-bold">{error}</p>}
    </main>
  );
}
