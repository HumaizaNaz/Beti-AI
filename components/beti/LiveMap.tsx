'use client';

import { useEffect, useRef } from 'react';
import { loadLeaflet } from '@/lib/client/leaflet';

export function LiveMap({ lat, lng }: { lat: number; lng: number }) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null);
  const marker = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;
    loadLeaflet()
      .then((L) => {
        if (cancelled || !container.current) return;
        if (!map.current) {
          map.current = L.map(container.current).setView([lat, lng], 16);
          L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
            maxZoom: 19,
            className: 'map-tiles-dark',
          }).addTo(map.current);
          marker.current = L.circleMarker([lat, lng], {
            radius: 11, color: '#ffffff', weight: 3, fillColor: '#ef4444', fillOpacity: 1,
          }).addTo(map.current);
        } else {
          marker.current.setLatLng([lat, lng]);
          map.current.panTo([lat, lng]);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [lat, lng]);

  useEffect(
    () => () => {
      map.current?.remove();
      map.current = null;
    },
    [],
  );

  return <div ref={container} className="w-full h-72 rounded-3xl overflow-hidden border border-white/10" />;
}
