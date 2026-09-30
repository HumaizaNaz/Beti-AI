'use client';

import { playAudio, type AudioName } from '@/lib/audio';

/** 🔊 hint. A span (not a button) so it can sit inside links and buttons. */
export function AudioHint({ name }: { name: AudioName }) {
  const play = (e: { preventDefault(): void; stopPropagation(): void }) => {
    e.preventDefault();
    e.stopPropagation();
    playAudio(name);
  };
  return (
    <span
      role="button"
      tabIndex={0}
      aria-label="سنیں / Listen"
      onClick={play}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') play(e);
      }}
      className="inline-flex items-center justify-center w-11 h-11 rounded-full bg-black/25 text-xl shrink-0"
    >
      🔊
    </span>
  );
}
