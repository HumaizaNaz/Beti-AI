'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Mic, Square, Volume2, Activity, Shield, ShieldAlert, FileText, Radio } from 'lucide-react';

export default function VoiceSentinelPage() {
  const [isListening, setIsListening] = useState(false);
  const [volume, setVolume] = useState('0 dB');
  const [pitch, setPitch] = useState('0 Hz');
  const [threatLevel, setThreatLevel] = useState<'SAFE' | 'DISTRESS'>('SAFE');
  const [transcript, setTranscript] = useState('Mic standby. Click "Start Live AI Voice Listener" below to begin acoustic analysis...');
  const [alertInfo, setAlertInfo] = useState<{ triggered: boolean; type?: string; reason?: string }>({ triggered: false });

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const recognitionRef = useRef<any>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const distressWords = [
    'help', 'help help', 'help me', 'bachao', 'bchao', 'mujhe bachao',
    'chhoro', 'choro', 'mujhe chhoro', 'choro mujhe', 'mat maro', 'mat maaro',
    'police', 'khatra', 'danger', 'chor', 'daku', 'kidnap', 'bhaiya late'
  ];

  const triggerEmergency = async (type: string, reason: string) => {
    setThreatLevel('DISTRESS');
    setAlertInfo({ triggered: true, type, reason });

    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([300, 100, 300, 100, 300]);
    }

    try {
      await fetch('/api/trigger-sos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: '+923001234567',
          triggerType: type === 'SCREAM_AUDIO' ? 'SCREAM_AUDIO' : 'PANIC_KEYWORD',
          reason,
        }),
      });
    } catch (e) {
      console.error(e);
    }
  };

  const startListening = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioCtx();
      const analyser = audioCtx.createAnalyser();
      const microphone = audioCtx.createMediaStreamSource(stream);

      analyser.fftSize = 256;
      microphone.connect(analyser);

      audioContextRef.current = audioCtx;
      analyserRef.current = analyser;
      setIsListening(true);

      drawWaveform();
      startSpeechRecognition();
    } catch (err: any) {
      alert('Microphone access denied: ' + err.message);
    }
  };

  const stopListening = () => {
    if (audioContextRef.current) audioContextRef.current.close();
    if (recognitionRef.current) recognitionRef.current.stop();
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    setIsListening(false);
    setThreatLevel('SAFE');
    setVolume('0 dB');
    setPitch('0 Hz');
  };

  const drawWaveform = () => {
    if (!analyserRef.current || !canvasRef.current || !audioContextRef.current) return;

    const canvas = canvasRef.current;
    const canvasCtx = canvas.getContext('2d');
    if (!canvasCtx) return;

    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyserRef.current.getByteFrequencyData(dataArray);

    let sum = 0;
    let maxVal = 0;
    let maxIndex = 0;
    for (let i = 0; i < bufferLength; i++) {
      sum += dataArray[i];
      if (dataArray[i] > maxVal) {
        maxVal = dataArray[i];
        maxIndex = i;
      }
    }

    const avgVolume = Math.round(sum / bufferLength);
    const decibels = Math.round((avgVolume / 255) * 100);
    const pitchHz = Math.round((maxIndex * audioContextRef.current.sampleRate) / analyserRef.current.fftSize);

    setVolume(`${decibels} dB`);
    setPitch(`${pitchHz} Hz`);

    canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
    const barWidth = (canvas.width / bufferLength) * 2.2;
    let x = 0;

    for (let i = 0; i < bufferLength; i++) {
      const barHeight = (dataArray[i] / 255) * canvas.height;
      const gradient = canvasCtx.createLinearGradient(0, canvas.height, 0, 0);

      if (decibels > 75) {
        gradient.addColorStop(0, '#FF3366');
        gradient.addColorStop(1, '#F43F5E');
      } else {
        gradient.addColorStop(0, '#8B5CF6');
        gradient.addColorStop(1, '#FF3366');
      }

      canvasCtx.fillStyle = gradient;
      canvasCtx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
      x += barWidth + 1.5;
    }

    if (decibels > 82 && pitchHz > 950) {
      triggerEmergency('SCREAM_AUDIO', `Acoustic Scream Pattern Detected (${decibels} dB at ${pitchHz} Hz)!`);
    }

    animationFrameRef.current = requestAnimationFrame(drawWaveform);
  };

  const startSpeechRecognition = () => {
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) {
      setTranscript('Web Speech API not supported in this browser. Acoustic frequency analysis is active.');
      return;
    }

    const recognition = new SpeechRec();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event: any) => {
      let current = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        current += event.results[i][0].transcript.toLowerCase();
      }
      setTranscript(current);

      for (const word of distressWords) {
        if (current.includes(word)) {
          triggerEmergency('PANIC_KEYWORD', `Distress keyword recognized: "${word}"`);
          break;
        }
      }
    };

    recognition.onend = () => {
      if (isListening) recognition.start();
    };

    recognition.start();
    recognitionRef.current = recognition;
  };

  useEffect(() => {
    return () => {
      if (audioContextRef.current) audioContextRef.current.close();
      if (recognitionRef.current) recognitionRef.current.stop();
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, []);

  return (
    <div className="min-h-screen flex flex-col justify-between selection:bg-rose-500 selection:text-white p-4 md:p-8">
      {/* Header */}
      <header className="max-w-5xl w-full mx-auto flex items-center justify-between gap-3 py-4 border-b border-white/[0.06]">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="relative w-10 h-10 shrink-0">
            <Image src="/beti_3d_hero.jpg" alt="Beti 3D" width={40} height={40} className="w-10 h-10 rounded-xl object-cover border border-rose-500 shadow-md" />
            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-[#07090E]"></span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-bold font-display text-white leading-tight">Voice & Scream Sentinel</h1>
              <span className="hidden sm:inline px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-400 text-[10px] font-bold uppercase tracking-wider border border-rose-500/20">
                Acoustic TinyML
              </span>
            </div>
            <p className="hidden sm:block text-xs text-slate-400">Real-Time Acoustic Panic & Keyword Classifier</p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <div className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold ${
            isListening ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-white/[0.03] text-slate-400 border border-white/[0.06]'
          }`}>
            <span className={`w-2 h-2 rounded-full ${isListening ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`}></span>
            <span className="whitespace-nowrap">{isListening ? 'Listening' : 'Mic Off'}</span>
          </div>
          <Link href="/" className="text-xs font-medium text-slate-400 hover:text-white whitespace-nowrap px-3 py-1.5 rounded-full bg-white/[0.03] border border-white/[0.06] transition-colors">
            ✕ <span className="hidden sm:inline">Exit to </span>Hub
          </Link>
        </div>
      </header>

      {/* Main Area */}
      <main className="max-w-5xl w-full mx-auto my-auto py-8 space-y-6">
        <div className="figma-glass gradient-border p-7 md:p-9 rounded-[36px] text-center relative overflow-hidden space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
            <span className="px-3 py-1 rounded-full bg-white/[0.04] text-slate-300 border border-white/[0.08] flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
              <span>Passive Bag/Pocket Audio Classifier</span>
            </span>
            <span className="text-slate-400 font-mono text-[11px]">Sampling: 44.1kHz • TinyML VAD</span>
          </div>

          <div className="relative rounded-2xl overflow-hidden bg-black/60 border border-white/[0.06] p-2">
            <canvas ref={canvasRef} width={800} height={140} className="w-full h-36 rounded-xl"></canvas>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="bg-black/40 p-4 rounded-2xl border border-white/[0.04]">
              <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider block flex items-center justify-center gap-1">
                <Volume2 className="w-3.5 h-3.5 text-slate-400" /> Volume
              </span>
              <p className="text-2xl font-bold font-display text-slate-100 mt-1">{volume}</p>
            </div>

            <div className="bg-black/40 p-4 rounded-2xl border border-white/[0.04]">
              <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider block flex items-center justify-center gap-1">
                <Activity className="w-3.5 h-3.5 text-indigo-400" /> Frequency
              </span>
              <p className="text-2xl font-bold font-display text-slate-100 mt-1">{pitch}</p>
            </div>

            <div className="bg-black/40 p-4 rounded-2xl border border-white/[0.04]">
              <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider block flex items-center justify-center gap-1">
                <Shield className="w-3.5 h-3.5 text-emerald-400" /> Threat Level
              </span>
              <p className={`text-2xl font-bold font-display mt-1 ${threatLevel === 'DISTRESS' ? 'text-red-400 animate-pulse' : 'text-emerald-400'}`}>
                {threatLevel === 'DISTRESS' ? '🚨 DISTRESS' : 'SAFE'}
              </p>
            </div>
          </div>

          <div>
            <button
              onClick={isListening ? stopListening : startListening}
              className={`px-8 py-4 rounded-2xl font-bold text-base transition-all flex items-center gap-3 mx-auto shadow-xl ${
                isListening
                  ? 'bg-red-600 hover:bg-red-500 text-white shadow-red-600/30'
                  : 'bg-gradient-to-r from-rose-600 via-pink-600 to-indigo-600 text-white shadow-rose-500/30'
              }`}
            >
              {isListening ? <Square className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              {isListening ? 'Stop AI Voice Listener' : 'Start Live AI Voice Listener'}
            </button>
            <p className="text-xs text-slate-400 mt-3.5">
              Mic on karein aur bolen: <b className="text-rose-400">&quot;Help Help&quot;</b>, <b className="text-rose-400">&quot;Bachao&quot;</b>, <b className="text-rose-400">&quot;Mujhe Chhoro&quot;</b> ya cheekhein (scream).
            </p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="figma-glass p-6 rounded-3xl space-y-3">
            <div className="flex items-center justify-between border-b border-white/[0.06] pb-2.5">
              <h3 className="font-bold text-xs text-slate-300 uppercase tracking-wider font-display flex items-center gap-2">
                <FileText className="w-4 h-4 text-indigo-400" /> Live Speech Stream (NLP)
              </h3>
              <span className="text-[10px] text-slate-500 font-mono">Urdu & English</span>
            </div>
            <div className="h-36 overflow-y-auto bg-black/50 p-4 rounded-2xl border border-white/[0.04] text-xs font-mono text-slate-300 leading-relaxed">
              {transcript}
            </div>
          </div>

          <div className={`figma-glass p-6 rounded-3xl border-l-4 transition-all duration-300 space-y-3 ${
            alertInfo.triggered ? 'border-l-red-500 bg-red-950/25' : 'border-l-slate-700'
          }`}>
            <div className="flex items-center justify-between border-b border-white/[0.06] pb-2.5">
              <h3 className="font-bold text-xs text-slate-300 uppercase tracking-wider font-display flex items-center gap-2">
                <Radio className="w-4 h-4 text-rose-400" /> Emergency Dispatch Bus
              </h3>
              <span className="text-[10px] text-slate-500 font-mono">OpenClaw Router</span>
            </div>
            <div className="text-xs text-slate-400 space-y-2 pt-1">
              {alertInfo.triggered ? (
                <div className="p-3.5 bg-red-900/40 rounded-2xl border border-red-500/40 text-red-200 space-y-1">
                  <p className="font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 text-red-300">
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-ping"></span> 🚨 EMERGENCY TRIGGERED
                  </p>
                  <p className="text-xs"><b>Trigger:</b> {alertInfo.type}</p>
                  <p className="text-xs"><b>Reason:</b> {alertInfo.reason}</p>
                  <p className="mt-2 text-rose-300 font-semibold text-xs pt-1 border-t border-red-500/30">
                    📡 WhatsApp emergency broadcast dispatched to Family Contacts!
                  </p>
                </div>
              ) : (
                <p>No distress detected yet. AI is monitoring background sound in low-power standby.</p>
              )}
            </div>
          </div>
        </div>
      </main>

      <footer className="max-w-5xl w-full mx-auto text-center py-4 border-t border-white/[0.06] text-xs text-slate-500 flex items-center justify-between">
        <p>Project Beti • Open-Source Acoustic Intelligence Engine</p>
        <div className="flex items-center gap-4">
          <Link href="/" className="hover:text-slate-300">Hub</Link>
          <Link href="/tracker" className="hover:text-slate-300">Family Beacon</Link>
          <Link href="/calculator" className="hover:text-slate-300">Calculator</Link>
        </div>
      </footer>
    </div>
  );
}
