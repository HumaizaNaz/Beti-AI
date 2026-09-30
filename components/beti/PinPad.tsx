'use client';

import { useState } from 'react';
import type { AudioName } from '@/lib/audio';
import { AudioHint } from './AudioHint';

interface Props {
  title: string;
  onComplete: (pin: string) => void;
  error?: string | null;
  busy?: boolean;
  audio?: AudioName;
  onCancel?: () => void;
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'del', '0', 'cancel'] as const;

export function PinPad({ title, onComplete, error, busy, audio = 'pin-enter', onCancel }: Props) {
  const [pin, setPin] = useState('');

  const press = (digit: string) => {
    if (busy || pin.length >= 4) return;
    const next = pin + digit;
    setPin(next);
    if (next.length === 4) {
      onComplete(next);
      setTimeout(() => setPin(''), 250);
    }
  };

  const keyClass = 'h-20 rounded-2xl bg-white/[0.07] border border-white/10 text-3xl font-bold text-white active:bg-white/20';

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="flex items-center gap-2 text-xl font-bold text-white">
        {title}
        <AudioHint name={audio} />
      </div>
      <div dir="ltr" className="flex gap-4" aria-label={`${pin.length} of 4`}>
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={`w-5 h-5 rounded-full ${i < pin.length ? 'bg-white' : 'bg-white/15'}`} />
        ))}
      </div>
      {error && <p className="text-lg font-bold text-red-400">{error}</p>}
      <div dir="ltr" className="grid grid-cols-3 gap-3 w-full max-w-xs">
        {KEYS.map((k) => {
          if (k === 'del') {
            return (
              <button key={k} type="button" aria-label="Delete" className={keyClass} onClick={() => setPin((p) => p.slice(0, -1))}>
                ⌫
              </button>
            );
          }
          if (k === 'cancel') {
            return onCancel ? (
              <button key={k} type="button" aria-label="Cancel" className={keyClass} onClick={onCancel}>
                ✕
              </button>
            ) : (
              <span key={k} />
            );
          }
          return (
            <button key={k} type="button" className={keyClass} onClick={() => press(k)} disabled={busy}>
              {k}
            </button>
          );
        })}
      </div>
    </div>
  );
}
