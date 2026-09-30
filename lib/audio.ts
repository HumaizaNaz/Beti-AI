// lib/audio.ts
export const AUDIO_NAMES = [
  'home-start', 'home-sos', 'trip-photo', 'trip-time', 'trip-go', 'trip-safe', 'trip-extend',
  'pin-enter', 'pin-wrong', 'gps-help', 'net-off', 'alert-help', 'alert-test', 'welcome-family',
  'setup-intro', 'setup-pin', 'setup-duress', 'setup-contacts', 'help-page',
] as const;

export type AudioName = (typeof AUDIO_NAMES)[number];

export function playAudio(name: AudioName): void {
  try {
    void new Audio(`/audio/${name}.mp3`).play().catch(() => {});
  } catch {
    // Audio is a hint only.
  }
}
