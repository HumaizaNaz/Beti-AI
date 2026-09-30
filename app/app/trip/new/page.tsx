'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { AudioHint } from '@/components/beti/AudioHint';
import { BigButton } from '@/components/beti/BigButton';
import { useT } from '@/components/beti/Shell';
import { api } from '@/lib/client/api';
import { compressImage } from '@/lib/client/image';
import { TRIP_DURATIONS } from '@/lib/durations';
import { createSupabaseBrowser } from '@/lib/supabase/browser';

export default function NewTripPage() {
  const { t } = useT();
  const router = useRouter();
  const [preview, setPreview] = useState<string | null>(null);
  const [photoPath, setPhotoPath] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [duration, setDuration] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onPhoto = async (file: File | undefined) => {
    if (!file) return;
    setPreview(URL.createObjectURL(file));
    setUploading(true);
    setError(null);
    try {
      const supabase = createSupabaseBrowser();
      const { data } = await supabase.auth.getUser();
      if (!data.user) throw new Error('signed out');
      const path = `${data.user.id}/${crypto.randomUUID()}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from('vehicle-photos')
        .upload(path, await compressImage(file), { contentType: 'image/jpeg' });
      if (uploadError) throw uploadError;
      setPhotoPath(path);
    } catch {
      setPhotoPath(null);
      setError(t('photoFailed'));
    } finally {
      setUploading(false);
    }
  };

  const start = async () => {
    if (!duration) return;
    setBusy(true);
    const res = await api<{ trip: { id: string } }>('/api/trips', { body: { durationMin: duration, vehiclePhotoPath: photoPath } });
    setBusy(false);
    if (res.ok && res.data) router.replace(`/app/trip/${res.data.trip.id}`);
    else if (res.data?.error === 'trip_open') router.replace('/app');
    else setError(t(res.status === 0 ? 'noNet' : 'errGeneric'));
  };

  return (
    <main className="flex flex-col gap-5">
      <label className="relative flex flex-col items-center justify-center gap-2 rounded-3xl bg-white/[0.05] border-2 border-dashed border-white/20 h-48 overflow-hidden cursor-pointer">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="" className="absolute inset-0 w-full h-full object-cover opacity-80" />
        ) : (
          <span className="text-6xl" aria-hidden>📷</span>
        )}
        <span className="relative z-10 flex items-center gap-2 text-xl font-bold text-white bg-black/50 rounded-full px-4 py-1">
          {uploading ? '⏳' : '📷'} {t('takePhoto')} <AudioHint name="trip-photo" />
        </span>
        <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => onPhoto(e.target.files?.[0])} />
      </label>

      <h2 className="flex items-center gap-2 text-2xl font-bold text-white">
        ⏱️ {t('howLong')} <AudioHint name="trip-time" />
      </h2>
      <div dir="ltr" className="grid grid-cols-2 gap-3">
        {TRIP_DURATIONS.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setDuration(m)}
            className={`rounded-3xl py-6 text-3xl font-bold ${duration === m ? 'bg-brand-violet text-white ring-4 ring-white/60' : 'bg-white/[0.06] text-slate-100'}`}
          >
            {m} <span className="text-lg">{t('minutes')}</span>
          </button>
        ))}
      </div>

      {error && <p className="text-amber-300 font-bold text-center">{error}</p>}
      <BigButton icon="▶️" label={t('go')} tone="go" audio="trip-go" disabled={!duration || uploading || busy} onClick={start} />
    </main>
  );
}
