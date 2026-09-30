'use client';

import { useState } from 'react';
import { api } from '@/lib/client/api';
import { currentPosition } from '@/lib/client/geo';

export type SosState =
  | { phase: 'idle' }
  | { phase: 'sending' }
  | { phase: 'sent'; sent: number }
  | { phase: 'failed' }
  | { phase: 'offline'; lat: number | null; lng: number | null };

export function useSos() {
  const [state, setState] = useState<SosState>({ phase: 'idle' });

  const trigger = async () => {
    setState({ phase: 'sending' });
    const pos = await currentPosition();
    const lat = pos?.lat ?? null;
    const lng = pos?.lng ?? null;
    const res = await api<{ sent: number; failed: number }>('/api/sos', { body: { reason: 'sos', lat, lng } });
    if (res.status === 0) setState({ phase: 'offline', lat, lng });
    else if (!res.ok || !res.data || res.data.sent === 0) setState({ phase: 'failed' });
    else setState({ phase: 'sent', sent: res.data.sent });
  };

  return { state, trigger, reset: () => setState({ phase: 'idle' }) };
}
