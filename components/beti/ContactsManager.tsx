'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Overview } from '@/lib/account';
import { api } from '@/lib/client/api';
import { errorKey } from '@/lib/client/errors';
import { inviteShareText } from '@/lib/messages';
import { RELATIONS } from '@/lib/relations';
import type { Relation } from '@/lib/types';
import { AudioHint } from './AudioHint';
import { useT } from './Shell';

const EMPTY = { name: '', relation: 'mother' as Relation, phone: '', email: '' };

export function ContactsManager({ pin }: { pin: string }) {
  const { t, lang } = useT();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await api<Overview>('/api/me');
    if (res.ok && res.data) setOverview(res.data);
  }, []);

  // Poll so a contact turns ✅ as soon as they press Start in Telegram.
  useEffect(() => {
    load();
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, [load]);

  const add = async () => {
    setBusy(true);
    setError(null);
    const res = await api('/api/contacts', { body: { ...form, pin } });
    setBusy(false);
    if (!res.ok) {
      setError(t(errorKey(res.data?.error)));
      return;
    }
    setForm(EMPTY);
    load();
  };

  const remove = async (id: string) => {
    await api(`/api/contacts/${id}`, { method: 'DELETE', body: { pin } });
    load();
  };

  const statusLabel = (status: string) =>
    status === 'connected' ? `✅ ${t('connected')}` : status === 'blocked' ? `⚠️ ${t('blocked')}` : `⏳ ${t('waiting')}`;

  return (
    <section className="flex flex-col gap-4">
      <h2 className="flex items-center gap-2 text-2xl font-bold text-white">
        👨‍👩‍👧 {t('contactsTitle')} <AudioHint name="setup-contacts" />
      </h2>

      {overview?.contacts.map((c) => {
        const relation = RELATIONS.find((r) => r.id === c.relation);
        return (
          <div key={c.id} className="rounded-3xl bg-white/[0.05] border border-white/10 p-4 flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <span className="text-4xl" aria-hidden>{relation?.icon}</span>
              <div className="flex-1">
                <p className="text-xl font-bold text-white">{c.name}</p>
                <p className="text-sm text-slate-300">{statusLabel(c.status)}</p>
              </div>
              <button type="button" onClick={() => remove(c.id)} aria-label={t('remove')} className="text-2xl">🗑️</button>
            </div>
            {c.status !== 'connected' && overview.profile && (
              <a
                href={`https://wa.me/?text=${encodeURIComponent(inviteShareText(overview.profile.name, c.inviteLink))}`}
                target="_blank"
                rel="noreferrer"
                className="rounded-2xl bg-emerald-600 text-white text-lg font-bold py-3 text-center"
              >
                🟢 {t('shareWhatsApp')}
              </a>
            )}
          </div>
        );
      })}

      <div className="rounded-3xl bg-white/[0.03] border border-dashed border-white/15 p-4 flex flex-col gap-3">
        <input
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder={t('name')}
          className="w-full rounded-2xl bg-black/40 border border-white/10 px-4 py-3 text-lg text-white"
        />
        <div className="grid grid-cols-4 gap-2">
          {RELATIONS.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setForm({ ...form, relation: r.id })}
              className={`rounded-2xl py-2 flex flex-col items-center text-sm ${
                form.relation === r.id ? 'bg-brand-violet text-white' : 'bg-white/[0.06] text-slate-200'
              }`}
            >
              <span className="text-2xl" aria-hidden>{r.icon}</span>
              {r[lang]}
            </button>
          ))}
        </div>
        <input
          dir="ltr"
          inputMode="tel"
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
          placeholder="03XX-XXXXXXX"
          aria-label={t('phone')}
          className="w-full rounded-2xl bg-black/40 border border-white/10 px-4 py-3 text-lg text-white"
        />
        <input
          dir="ltr"
          type="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          placeholder={t('email')}
          className="w-full rounded-2xl bg-black/40 border border-white/10 px-4 py-3 text-lg text-white"
        />
        {error && <p className="text-red-400 font-bold">{error}</p>}
        <button
          type="button"
          onClick={add}
          disabled={busy || !form.name.trim() || !form.phone.trim()}
          className="rounded-2xl bg-brand-violet text-white text-lg font-bold py-3 disabled:opacity-40"
        >
          ➕ {t('addContact')}
        </button>
      </div>
    </section>
  );
}
