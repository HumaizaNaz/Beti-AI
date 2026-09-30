'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import type { AudioName } from '@/lib/audio';
import { AudioHint } from './AudioHint';

const TONES = {
  go: 'bg-gradient-to-br from-brand-violet to-indigo-600 text-white shadow-lg shadow-indigo-900/40',
  danger: 'bg-red-600 text-white shadow-lg shadow-red-900/50',
  safe: 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/40',
  neutral: 'bg-white/[0.06] border border-white/10 text-slate-100',
} as const;

interface Props {
  icon: ReactNode;
  label: string;
  tone?: keyof typeof TONES;
  audio?: AudioName;
  onClick?: () => void;
  href?: string;
  disabled?: boolean;
  small?: boolean;
}

export function BigButton({ icon, label, tone = 'neutral', audio, onClick, href, disabled, small }: Props) {
  const className = `w-full flex items-center gap-4 rounded-3xl font-bold transition active:scale-[0.98] disabled:opacity-50 ${
    small ? 'px-5 py-4 text-lg' : 'px-6 py-7 text-2xl'
  } ${TONES[tone]}`;
  const body = (
    <>
      <span aria-hidden className={small ? 'text-2xl' : 'text-4xl'}>{icon}</span>
      <span className="flex-1 text-start">{label}</span>
      {audio && <AudioHint name={audio} />}
    </>
  );
  if (href && !disabled) {
    return <Link href={href} className={className}>{body}</Link>;
  }
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={className}>
      {body}
    </button>
  );
}
