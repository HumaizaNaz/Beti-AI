'use client';

import React, { useEffect, useRef } from 'react';
import Link from 'next/link';
import { PhoneCall, ArrowLeft, Radio, AlertTriangle, Car, MapPin, Share2 } from 'lucide-react';

export default function TrackerPage() {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<any>(null);

  useEffect(() => {
    // Dynamically load Leaflet on client side
    if (typeof window === 'undefined' || !mapContainerRef.current) return;

    // Load Leaflet CSS
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    const initMap = () => {
      const L = (window as any).L;
      if (!L || mapInstanceRef.current || !mapContainerRef.current) return;
      const lat = 24.8607;
      const lng = 67.0011;
      const map = L.map(mapContainerRef.current, { zoomControl: false }).setView([lat, lng], 15);
      mapInstanceRef.current = map;

      // OSM tiles need no API key; darkened via the .map-tiles-dark CSS filter
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
        className: 'map-tiles-dark',
      }).addTo(map);

      const pulseIcon = L.divIcon({
        className: 'relative',
        html: `
          <div style="position: relative;">
            <div style="border: 3px solid #ef4444; border-radius: 50%; height: 36px; width: 36px; position: absolute; left: -6px; top: -6px; animation: pulsate 1.8s ease-out infinite; opacity: 0;"></div>
            <div style="background: #ef4444; border: 2.5px solid #ffffff; border-radius: 50%; height: 24px; width: 24px; box-shadow: 0 0 15px rgba(239, 68, 68, 0.8);"></div>
          </div>
        `,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });

      const marker = L.marker([lat, lng], { icon: pulseIcon }).addTo(map);
      marker
        .bindPopup(`
          <div style="color: #0f172a; font-family: sans-serif; font-size: 11px; padding: 4px;">
            <b style="color: #ef4444;">🚨 Active SOS Incident</b><br/>
            Ayesha (+92 300 1234567)<br/>
            Ride: Careem (BK-9988)<br/>
            Speed: 28 km/h
          </div>
        `)
        .openPopup();
    };

    // Load Leaflet JS once (effects run twice in dev Strict Mode)
    if ((window as any).L) {
      initMap();
    } else {
      let script = document.getElementById('leaflet-js') as HTMLScriptElement | null;
      if (!script) {
        script = document.createElement('script');
        script.id = 'leaflet-js';
        script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
        script.async = true;
        document.head.appendChild(script);
      }
      script.addEventListener('load', initMap);
    }

    return () => {
      document.getElementById('leaflet-js')?.removeEventListener('load', initMap);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  const shareLink = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      alert('📋 Live Incident GPS Link copied to clipboard!');
    }
  };

  const disarmPrompt = () => {
    const pin = prompt('Enter 4-Digit Safe PIN to disarm:');
    if (pin === '1234') {
      alert('✅ Emergency Incident resolved safely.');
      window.location.href = '/';
    } else if (pin) {
      alert('❌ Invalid PIN. Tracking remains active.');
    }
  };

  return (
    <div className="h-screen w-screen overflow-hidden relative flex flex-col justify-between selection:bg-rose-500 selection:text-white">
      {/* Fullscreen Leaflet Map Container */}
      <div ref={mapContainerRef} className="absolute inset-0 z-0"></div>

      {/* Header */}
      <header className="relative z-10 p-4 md:p-6 max-w-6xl w-full mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3 pointer-events-none">
        <div className="figma-glass self-start px-4 py-2.5 rounded-2xl flex items-center gap-3 pointer-events-auto shadow-2xl">
          <div className="shrink-0 w-3 h-3 rounded-full bg-red-500 animate-ping"></div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-red-400 uppercase tracking-wider flex items-center gap-1">
                <Radio className="w-3 h-3 text-red-400" /> Live SOS Incident
              </span>
              <span className="text-[10px] text-slate-400">• Just now</span>
            </div>
            <h1 className="text-sm font-bold text-white font-display">Ayesha (+92 300 1234567)</h1>
          </div>
        </div>

        <div className="flex items-center gap-2.5 pointer-events-auto">
          <a
            href="tel:15"
            className="flex-1 sm:flex-none justify-center whitespace-nowrap px-5 py-2.5 rounded-2xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold shadow-xl shadow-red-600/30 transition-all flex items-center gap-2"
          >
            <PhoneCall className="w-3.5 h-3.5" /> Call Police (15)
          </a>
          <Link
            href="/"
            className="figma-glass whitespace-nowrap px-4 py-2.5 rounded-2xl text-xs font-medium text-slate-300 hover:text-white hover:bg-white/[0.08] transition-all flex items-center gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Hub
          </Link>
        </div>
      </header>

      {/* Footer Details Card */}
      <footer className="relative z-10 p-4 md:p-6 max-w-6xl w-full mx-auto pointer-events-none">
        <div className="figma-glass rounded-3xl p-5 md:p-6 shadow-2xl pointer-events-auto border border-white/[0.08] grid md:grid-cols-12 gap-6 items-center">
          <div className="md:col-span-5 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold text-rose-400 uppercase tracking-wider flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" /> Trigger Reason
              </span>
            </div>
            <p className="text-xs font-medium text-slate-200 bg-red-500/10 border border-red-500/20 p-2.5 rounded-xl">
              Secret phrase detected: &quot;bhaiya late ho raha hai&quot;
            </p>
            <div className="flex items-center gap-4 text-xs text-slate-400 pt-1">
              <span className="flex items-center gap-1"><Car className="w-3 h-3 text-slate-400" /> BK-9988 (Careem)</span>
              <span className="flex items-center gap-1"><MapPin className="w-3 h-3 text-slate-400" /> Clifton</span>
            </div>
          </div>

          <div className="md:col-span-4 space-y-1.5 border-t md:border-t-0 md:border-l border-white/[0.08] md:pl-6 pt-3 md:pt-0">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Estimated Address:</span>
            <p className="text-xs text-white font-medium leading-relaxed">
              Shahrah-e-Faisal, near FTC Building, Karachi
            </p>
            <span className="text-[11px] text-emerald-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span> GPS Accuracy: 5 meters
            </span>
          </div>

          <div className="md:col-span-3 flex flex-col gap-2 border-t md:border-t-0 md:border-l border-white/[0.08] md:pl-6 pt-3 md:pt-0">
            <button
              onClick={shareLink}
              className="w-full py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-xs font-semibold text-slate-200 border border-white/[0.08] transition-all flex items-center justify-center gap-1.5"
            >
              <Share2 className="w-3.5 h-3.5" /> Copy GPS Link
            </button>
            <button
              onClick={disarmPrompt}
              className="w-full py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-xs font-semibold text-emerald-300 border border-emerald-500/30 transition-all"
            >
              Disarm with PIN (1234)
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
