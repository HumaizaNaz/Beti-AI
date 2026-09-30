'use client';

import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AudioHint } from '@/components/beti/AudioHint';
import { BigButton } from '@/components/beti/BigButton';
import { PinPad } from '@/components/beti/PinPad';
import { useT } from '@/components/beti/Shell';
import { SosPanel } from '@/components/beti/SosPanel';
import { useSos } from '@/components/beti/useSos';
import type { Overview } from '@/lib/account';
import { playAudio } from '@/lib/audio';
import { api } from '@/lib/client/api';
import { clearQueue, loadOfflineInfo, queuePoint, readQueue, safeSmsBody, smsLink, type OfflineInfo } from '@/lib/client/offline';
import type { TripStatus } from '@/lib/types';

type PinMode = null | 'finish' | 'extend';

function formatLeft(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

export default function TripPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { t } = useT();
  const sos = useSos();
  const [trip, setTrip] = useState<{ status: TripStatus; deadlineAt: string } | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [gps, setGps] = useState<'wait' | 'ok' | 'off'>('wait');
  const [online, setOnline] = useState(true);
  const [pinMode, setPinMode] = useState<PinMode>(null);
  const [pinError, setPinError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [offlineFinish, setOfflineFinish] = useState(false);
  const [offline, setOffline] = useState<OfflineInfo | null>(null);
  const pendingFinishPin = useRef<string | null>(null); // memory only, never stored

  const finishSafely = useCallback(() => {
    pendingFinishPin.current = null;
    setOfflineFinish(false);
    setPinMode(null);
    setDone(true);
    setTimeout(() => router.replace('/app'), 2500);
  }, [router]);

  const submitPin = useCallback(
    async (mode: 'finish' | 'extend', pin: string) => {
      setBusy(true);
      setPinError(null);
      const res = await api<{ status: string; deadlineAt?: string }>(`/api/trips/${id}/${mode}`, { body: { pin } });
      setBusy(false);
      if (res.status === 0) {
        setOnline(false);
        if (mode === 'finish') {
          pendingFinishPin.current = pin;
          setOfflineFinish(true);
          setPinMode(null);
        } else {
          setPinError(t('noNet'));
        }
        return;
      }
      const status = res.data?.status;
      if (status === 'wrong') {
        setPinError(t('wrongPin'));
        playAudio('pin-wrong');
      } else if (status === 'locked') {
        setPinError(t('locked'));
      } else if (mode === 'finish' && status === 'safe') {
        finishSafely();
      } else if (mode === 'extend' && status === 'extended' && res.data?.deadlineAt) {
        const deadlineAt = res.data.deadlineAt;
        setTrip((tr) => (tr ? { ...tr, deadlineAt } : tr));
        setPinMode(null);
      } else {
        setPinError(t('errGeneric'));
      }
    },
    [id, t, finishSafely],
  );

  // Initial load: make sure this is the user's open trip.
  useEffect(() => {
    setOffline(loadOfflineInfo());
    api<Overview>('/api/me').then((res) => {
      if (!res.ok || !res.data) return;
      const open = res.data.openTrip;
      if (!open || open.id !== id) router.replace('/app');
      else setTrip({ status: open.status, deadlineAt: open.deadlineAt });
    });
  }, [id, router]);

  // Countdown clock.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // GPS: queue every fix locally; the flush below sends them.
  useEffect(() => {
    if (!('geolocation' in navigator)) {
      setGps('off');
      return;
    }
    const watch = navigator.geolocation.watchPosition(
      (p) => {
        setGps('ok');
        queuePoint(id, {
          lat: p.coords.latitude,
          lng: p.coords.longitude,
          accuracyM: Number.isFinite(p.coords.accuracy) ? p.coords.accuracy : null,
          recordedAt: new Date(p.timestamp).toISOString(),
        });
      },
      () => {
        setGps('off');
        playAudio('gps-help');
      },
      { enableHighAccuracy: true, maximumAge: 10_000 },
    );
    return () => navigator.geolocation.clearWatch(watch);
  }, [id]);

  // Every 20 s: send queued points, learn the server status, retry an offline "safe".
  const flush = useCallback(async () => {
    const points = readQueue(id);
    const res = await api<{ saved: number; status: TripStatus; deadlineAt: string }>(`/api/trips/${id}/location`, { body: { points } });
    if (res.status === 0) {
      setOnline(false);
      return;
    }
    setOnline(true);
    if (!res.ok || !res.data) return;
    clearQueue(id, points.length);
    if (pendingFinishPin.current) {
      await submitPin('finish', pendingFinishPin.current);
      return;
    }
    if (res.data.status === 'safe') {
      router.replace('/app');
      return;
    }
    setTrip({ status: res.data.status, deadlineAt: res.data.deadlineAt });
  }, [id, router, submitPin]);

  useEffect(() => {
    flush();
    const timer = setInterval(flush, 20_000);
    return () => clearInterval(timer);
  }, [flush]);

  // Keep the screen on while the trip runs (where supported).
  useEffect(() => {
    let lock: { release(): Promise<void> } | null = null;
    const request = async () => {
      try {
        lock = await (navigator as Navigator & { wakeLock?: { request(type: 'screen'): Promise<{ release(): Promise<void> }> } })
          .wakeLock?.request('screen') ?? null;
      } catch {}
    };
    request();
    const onVisible = () => {
      if (document.visibilityState === 'visible') request();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      lock?.release().catch(() => {});
    };
  }, []);

  if (done) {
    return (
      <main className="flex flex-col items-center gap-4 pt-16 text-center">
        <p className="text-8xl" aria-hidden>✅</p>
        <p className="text-3xl font-bold text-emerald-300">{t('safeDone')}</p>
      </main>
    );
  }

  if (sos.state.phase !== 'idle') {
    return <main><SosPanel state={sos.state} onClose={sos.reset} /></main>;
  }

  if (pinMode) {
    return (
      <main className="pt-4">
        <PinPad
          title={t('enterPin')}
          audio={pinMode === 'finish' ? 'trip-safe' : 'trip-extend'}
          error={pinError}
          busy={busy}
          onComplete={(pin) => submitPin(pinMode, pin)}
          onCancel={() => {
            setPinMode(null);
            setPinError(null);
          }}
        />
      </main>
    );
  }

  const left = trip ? new Date(trip.deadlineAt).getTime() - now : null;

  return (
    <main className="flex flex-col gap-5">
      <div className="rounded-3xl bg-white/[0.05] border border-white/10 p-6 text-center">
        <p dir="ltr" className={`text-7xl font-bold font-mono ${left !== null && left <= 0 ? 'text-red-400' : 'text-white'}`}>
          {left === null ? '—' : formatLeft(left)}
        </p>
        {left !== null && left <= 0 && <p className="text-xl font-bold text-red-300 mt-2">⏰ {t('timeUp')}</p>}
        <div className="flex justify-center gap-4 mt-4 text-lg">
          <span className={gps === 'off' ? 'text-amber-300' : 'text-emerald-300'}>📍 {t(gps === 'off' ? 'gpsOff' : 'gpsOk')}</span>
          {!online && <span className="text-amber-300">📵 {t('noNet')}</span>}
        </div>
      </div>

      {trip?.status === 'alerted' && (
        <p className="rounded-2xl bg-red-950/60 border border-red-500/40 p-4 text-center text-xl font-bold text-red-200">
          🚨 {t('alertedTrip')}
        </p>
      )}

      {offlineFinish && (
        <div className="rounded-2xl bg-amber-950/50 border border-amber-500/40 p-4 flex flex-col gap-3 text-center">
          <p className="flex items-center justify-center gap-2 text-lg font-bold text-amber-200">
            📵 {t('finishOffline')} <AudioHint name="net-off" />
          </p>
          {offline && offline.phones.length > 0 && (
            <a href={smsLink(offline.phones, safeSmsBody(offline.name))} className="rounded-2xl bg-amber-500 text-black text-xl font-bold py-4">
              💬 {t('sendSms')}
            </a>
          )}
        </div>
      )}

      <BigButton icon="🟢" label={t('reached')} tone="safe" audio="trip-safe" onClick={() => setPinMode('finish')} />
      <BigButton icon="🔴" label={t('help')} tone="danger" audio="home-sos" onClick={sos.trigger} />
      <BigButton icon="⏱️" label={t('extend')} small audio="trip-extend" onClick={() => setPinMode('extend')} />
    </main>
  );
}
