'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  ShieldCheck,
  Calculator,
  Mic,
  MapPin,
  Presentation,
  Navigation,
  CircleDot,
  Car,
  Shield,
  Battery,
  CarTaxiFront,
  CheckCircle,
  Key,
  AlertTriangle,
  MoreVertical,
  Send,
  BatteryCharging,
  Mic2,
  MessageSquare
} from 'lucide-react';

interface ChatMessage {
  id: string;
  sender: string;
  text: string;
  time: string;
  isUser: boolean;
}

const navLinks = [
  { href: '/app', label: 'Open App', Icon: ShieldCheck, color: 'text-emerald-400' },
  { href: '/calculator', label: 'Calculator PWA', Icon: Calculator, color: 'text-amber-400' },
  { href: '/voice', label: 'Voice Sentinel', Icon: Mic, color: 'text-brand-rose' },
  { href: '/tracker', label: 'Family Beacon', Icon: MapPin, color: 'text-brand-violet' },
  { href: '/deck', label: 'Pitch Deck', Icon: Presentation, color: 'text-pink-400' },
];

export default function MasterHubPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      sender: 'Beti AI',
      text: 'Assalam-o-Alaikum Ayesha! 🌸 Main hoon Beti AI. Safar shuru karte waqt gaadi ka number aur time bhej dein:\n👉 "Rickshaw KHI-4521 to Home 20 mins"',
      time: '10:00 PM',
      isUser: false,
    },
    {
      id: '2',
      sender: 'Beti AI',
      text: '🛡️ Main aapka safar track karungi:\n✅ Pohnch kar "Safe" likhein\n🔑 Khatre mein apna secret code bolein\n🚨 "Help" ya "Bachao" — foran family ko alert',
      time: '10:00 PM',
      isUser: false,
    },
  ]);
  const [inputVal, setInputVal] = useState('');
  const [statusBadge, setStatusBadge] = useState({ text: '● Active Monitoring', isEmergency: false, isArrived: false });
  const [destStatus, setDestStatus] = useState('Safe (Normal)');

  const sendMsg = async (text: string) => {
    if (!text.trim()) return;

    const userTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const newMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: 'Ayesha',
      text,
      time: userTime,
      isUser: true,
    };

    setMessages((prev) => [...prev, newMsg]);
    setInputVal('');

    try {
      const res = await fetch('/api/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: '+923001234567', message: text }),
      });
      const data = await res.json();
      const botTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          sender: 'Beti AI',
          text: data.reply || 'Message received.',
          time: botTime,
          isUser: false,
        },
      ]);

      if (data.isEmergencyTriggered) {
        setStatusBadge({ text: '🚨 EMERGENCY TRIGGERED', isEmergency: true, isArrived: false });
        setDestStatus('⚠️ EMERGENCY ACTIVE');
      } else if (text.toLowerCase().includes('rickshaw') || text.toLowerCase().includes('uber') || text.toLowerCase().includes('careem')) {
        setStatusBadge({ text: '● Active Monitoring', isEmergency: false, isArrived: false });
        setDestStatus('In Transit');
      } else if (text.toLowerCase().includes('safe')) {
        setStatusBadge({ text: 'Safe & Completed', isEmergency: false, isArrived: true });
        setDestStatus('Arrived Safely');
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          sender: 'System Error',
          text: 'Connection Error: ' + err.message,
          time: '',
          isUser: false,
        },
      ]);
    }
  };

  const handlePreset = (type: string) => {
    if (type === 'trip') sendMsg('Rickshaw KHI-4521 mein baith gayi hoon, 20 mins to Home');
    else if (type === 'safe') sendMsg('Safe pohnch gayi');
    else if (type === 'secret') sendMsg('Bhaiya late ho raha hai gaadi tej chalao');
    else if (type === 'scream') sendMsg('Help Help mujhe bachao');
  };

  return (
    <div className="min-h-screen flex flex-col justify-between selection:bg-brand-rose selection:text-white">
      {/* 🌟 Top Navigation Bar */}
      <header className="w-full sticky top-0 z-50 bg-[#07090E]/85 backdrop-blur-2xl border-b border-white/[0.06]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 sm:h-20 flex items-center justify-between gap-3">
          {/* Logo & 3D Mascot Avatar */}
          <div className="flex items-center gap-3.5">
            <div className="relative w-11 h-11">
              <Image
                src="/beti_3d_hero.jpg"
                alt="Beti 3D Mascot"
                width={44}
                height={44}
                className="w-11 h-11 rounded-2xl object-cover border-2 border-brand-rose shadow-lg shadow-brand-rose/30"
              />
              <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-brand-emerald border-2 border-[#07090E]"></span>
            </div>
            <div>
              <span className="text-xl font-bold font-display tracking-tight text-white">Beti AI</span>
              <p className="hidden sm:block text-xs text-slate-300">Zero-Touch Women Safety Ecosystem</p>
            </div>
          </div>

          {/* Center Navigation Pills */}
          <nav className="hidden md:flex items-center gap-1.5 figma-pill px-2 py-1.5 rounded-full">
            {navLinks.map(({ href, label, Icon, color }) => (
              <Link key={href} href={href} className="px-4 py-1.5 rounded-full text-xs font-semibold text-slate-300 hover:text-white hover:bg-white/[0.08] transition-all flex items-center gap-2">
                <Icon className={`w-3.5 h-3.5 ${color}`} /> {label}
              </Link>
            ))}
          </nav>

          {/* Right Status */}
          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-brand-emerald/10 border border-brand-emerald/20 text-brand-emerald text-xs font-semibold">
            <span className="relative flex w-2 h-2">
              <span className="absolute inline-flex w-full h-full rounded-full bg-brand-emerald opacity-75 animate-ping"></span>
              <span className="relative inline-flex w-2 h-2 rounded-full bg-brand-emerald shadow-[0_0_6px_#10B981]"></span>
            </span>
            <span className="whitespace-nowrap"><span className="hidden sm:inline">5 Agents </span>Active</span>
          </div>
        </div>

        {/* Mobile Navigation */}
        <nav className="md:hidden flex gap-2 overflow-x-auto px-4 pb-3 [scrollbar-width:none]">
          {navLinks.map(({ href, label, Icon, color }) => (
            <Link key={href} href={href} className="shrink-0 px-3.5 py-2 rounded-full bg-white/[0.04] border border-white/[0.08] text-xs font-semibold text-slate-200 flex items-center gap-1.5">
              <Icon className={`w-3.5 h-3.5 ${color}`} /> {label}
            </Link>
          ))}
        </nav>
      </header>

      {/* 🌟 Main Content */}
      <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 flex-1 space-y-10">
        {/* Hero Banner with 3D Mascot */}
        <div className="grid lg:grid-cols-12 gap-8 items-center figma-glass gradient-border rounded-[36px] p-6 sm:p-8 md:p-10 relative overflow-hidden">
          <div className="lg:col-span-7 space-y-5 relative z-10">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.08] text-xs font-medium text-slate-300 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-brand-rose animate-pulse"></span>
              <span>Zero-Touch AI Protection for Every Daughter</span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold font-display tracking-tight text-white leading-[1.15]">
              Fearless freedom, <br />
              <span className="bg-gradient-to-r from-brand-rose via-rose-400 to-brand-violet bg-clip-text text-transparent">
                without ever touching your phone.
              </span>
            </h1>

            <p className="text-base sm:text-lg font-semibold text-rose-200/90 font-display">
              Beti ki hifazat — bina phone chhue, har safar mein. 🌸
            </p>

            <p className="text-sm sm:text-base text-slate-300 max-w-xl leading-relaxed">
              No apps to download. Runs natively on <b>WhatsApp</b> with hands-free Urdu/English voice distress detection and a cloud <b>Dead-Man&apos;s Switch</b> that triggers even if the phone battery dies.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <div className="px-3.5 py-2 rounded-2xl bg-black/40 border border-white/[0.06] flex items-center gap-2 text-xs">
                <BatteryCharging className="w-4 h-4 text-emerald-400" />
                <span className="text-slate-300"><b>&lt; 3% Battery</b> per Day</span>
              </div>
              <div className="px-3.5 py-2 rounded-2xl bg-black/40 border border-white/[0.06] flex items-center gap-2 text-xs">
                <Mic2 className="w-4 h-4 text-brand-rose" />
                <span className="text-slate-300"><b>Hands-Free</b> Scream AI</span>
              </div>
              <div className="px-3.5 py-2 rounded-2xl bg-black/40 border border-white/[0.06] flex items-center gap-2 text-xs">
                <MessageSquare className="w-4 h-4 text-indigo-400" />
                <span className="text-slate-300"><b>0-Install</b> WhatsApp</span>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 flex justify-center relative">
            <div className="relative animate-float">
              <div className="absolute -inset-4 rounded-full bg-gradient-to-tr from-brand-rose/40 to-brand-violet/40 blur-2xl opacity-75"></div>
              <div className="relative w-64 h-64 sm:w-80 sm:h-80 rounded-[32px] overflow-hidden border-2 border-white/20 shadow-2xl p-1 bg-gradient-to-b from-white/10 to-transparent backdrop-blur-md">
                <Image
                  src="/beti_3d_hero.jpg"
                  alt="Beti 3D AI Guardian"
                  width={320}
                  height={320}
                  className="w-full h-full object-cover rounded-[28px] transform hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute bottom-3 left-3 right-3 py-2 px-3 rounded-2xl bg-black/70 border border-white/10 backdrop-blur-xl flex items-center justify-between text-xs">
                  <span className="font-bold text-white flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-brand-rose animate-ping"></span> Beti AI Sentinel
                  </span>
                  <span className="text-[10px] text-emerald-400 font-mono">3D ACTIVE SHIELD</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Workspace Grid */}
        <div className="grid lg:grid-cols-12 gap-8 items-start">
          {/* Left: Ride Sentinel Telemetry */}
          <div className="lg:col-span-7 space-y-6">
            <div className="figma-glass rounded-[32px] p-5 sm:p-7 space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] pb-4">
                <div className="flex items-center gap-3.5">
                  <div className="w-11 h-11 rounded-2xl bg-brand-violet/15 border border-brand-violet/30 flex items-center justify-center text-brand-violet">
                    <Navigation className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-white font-display">Active Ride Sentinel</h3>
                      <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 text-[10px] font-bold tracking-wider">LIVE</span>
                    </div>
                    <p className="text-xs text-slate-300">Autonomous AI Guardian monitoring travel</p>
                  </div>
                </div>

                <div
                  className={`px-3.5 py-1.5 rounded-full text-xs font-bold tracking-wide ${
                    statusBadge.isEmergency
                      ? 'bg-red-500/20 border border-red-500/40 text-red-400 animate-pulse'
                      : statusBadge.isArrived
                      ? 'bg-slate-800 border border-slate-700 text-slate-400'
                      : 'bg-indigo-500/15 border border-indigo-500/30 text-indigo-400'
                  }`}
                >
                  {statusBadge.text}
                </div>
              </div>

              {/* Progress track */}
              <div className="p-4 rounded-2xl bg-black/40 border border-white/[0.04] space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold">
                  <span className="text-slate-400 flex items-center gap-1.5">
                    <CircleDot className="w-3.5 h-3.5 text-brand-rose" /> Origin: IBA Main Campus
                  </span>
                  <span className="text-slate-200 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-emerald-400" /> Dest: Clifton, Karachi
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden relative">
                  <div className="h-full bg-gradient-to-r from-brand-rose via-brand-violet to-emerald-400 w-3/4 rounded-full"></div>
                </div>
                <div className="flex flex-wrap justify-between gap-x-4 gap-y-1 text-[11px] text-slate-400 font-mono">
                  <span>Speed: 32 km/h</span>
                  <span className="text-brand-rose font-bold">Dead-Man Timer: 14m remaining</span>
                  <span>GPS: 24.8607, 67.0011</span>
                </div>
              </div>

              {/* Telemetry stats */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
                <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/[0.04]">
                  <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block flex items-center gap-1.5">
                    <Car className="w-3.5 h-3.5 text-slate-400" /> Vehicle
                  </span>
                  <span className="text-sm font-bold text-slate-100 mt-1 block font-mono">KHI-4521 <span className="text-slate-400 font-normal">Rickshaw</span></span>
                </div>

                <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/[0.04]">
                  <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-emerald-400" /> Status
                  </span>
                  <span className="text-sm font-bold text-emerald-400 mt-1 block">{destStatus}</span>
                </div>

                <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/[0.04]">
                  <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block flex items-center gap-1.5">
                    <Battery className="w-3.5 h-3.5 text-rose-400" /> Battery
                  </span>
                  <span className="text-sm font-bold text-rose-400 mt-1 block font-mono">18% (Low)</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div>
                <span className="text-[11px] text-slate-400 uppercase font-bold tracking-wider block mb-2.5">
                  Test Multi-Agent Scenarios Live:
                </span>
                <div className="flex flex-wrap gap-2.5">
                  <button
                    onClick={() => handlePreset('trip')}
                    className="px-4 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.09] text-xs font-semibold text-slate-200 border border-white/[0.08] transition-all flex items-center gap-2 shadow-sm"
                  >
                    <CarTaxiFront className="w-4 h-4 text-brand-violet" /> 1. Start Trip
                  </button>
                  <button
                    onClick={() => handlePreset('safe')}
                    className="px-4 py-2.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-xs font-semibold text-emerald-300 border border-emerald-500/30 transition-all flex items-center gap-2"
                  >
                    <CheckCircle className="w-4 h-4 text-emerald-400" /> 2. Safe Arrival PIN
                  </button>
                  <button
                    onClick={() => handlePreset('secret')}
                    className="px-4 py-2.5 rounded-xl bg-brand-rose/10 hover:bg-brand-rose/20 text-xs font-semibold text-rose-300 border border-brand-rose/30 transition-all flex items-center gap-2"
                  >
                    <Key className="w-4 h-4 text-brand-rose" /> 3. Speak Secret Code
                  </button>
                </div>
                <button
                  onClick={() => handlePreset('scream')}
                  className="mt-3 w-full px-4 py-3.5 rounded-xl bg-red-600 hover:bg-red-500 text-sm font-bold text-white border border-red-400/60 transition-all flex items-center justify-center gap-2 shadow-lg shadow-red-600/30"
                >
                  <AlertTriangle className="w-5 h-5" /> 4. Panic &quot;Help Help&quot; — Emergency SOS
                </button>
              </div>
            </div>
          </div>

          {/* Right: iPhone 16 Pro WhatsApp Frame */}
          <div className="lg:col-span-5 flex justify-center">
            <div className="w-full max-w-[370px] bg-[#0E1318] rounded-[44px] p-3 border-4 border-[#242D35] shadow-[0_25px_70px_rgba(0,0,0,0.8)] flex flex-col h-[560px] lg:h-[620px] relative overflow-hidden">
              <div className="absolute top-5 left-1/2 -translate-x-1/2 w-28 h-6 bg-black rounded-full z-30 flex items-center justify-between px-2.5">
                <div className="w-2.5 h-2.5 rounded-full bg-brand-rose/80 animate-pulse"></div>
                <span className="text-[9px] font-mono text-slate-400">Beti AI</span>
                <div className="w-2 h-2 rounded-full bg-slate-800"></div>
              </div>

              <div className="w-full h-full bg-[#111B21] rounded-[34px] flex flex-col overflow-hidden pt-7 border border-white/[0.04]">
                <div className="bg-[#202C33] px-4 py-3 flex items-center justify-between border-b border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-brand-rose to-brand-violet flex items-center justify-center text-white shadow-md">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white font-display">Beti AI Guardian</h4>
                      <p className="text-[10px] text-emerald-400 flex items-center gap-1 font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> Online & Monitoring
                      </p>
                    </div>
                  </div>
                  <div className="text-slate-400">
                    <MoreVertical className="w-4 h-4" />
                  </div>
                </div>

                <div className="flex-1 p-3.5 overflow-y-auto space-y-3 text-xs bg-[#0B141A]">
                  <div className="text-center my-1">
                    <span className="px-3 py-1 rounded-lg bg-[#182229] text-[10px] text-slate-400 font-semibold tracking-wide">TODAY</span>
                  </div>

                  {messages.map((m) => (
                    <div key={m.id} className={`flex ${m.isUser ? 'justify-end' : 'justify-start'}`}>
                      <div className={`${m.isUser ? 'chat-bubble-user' : 'chat-bubble-ai'} p-3 max-w-[88%] shadow-md`}>
                        <p className="leading-relaxed whitespace-pre-line">{m.text}</p>
                        <span className={`text-[9px] ${m.isUser ? 'text-emerald-200' : 'text-slate-400'} float-right mt-1 ml-3 flex items-center gap-1 font-mono`}>
                          {m.time} {m.isUser && <span>✓✓</span>}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    sendMsg(inputVal);
                  }}
                  className="bg-[#202C33] p-2.5 flex items-center gap-2 border-t border-slate-800"
                >
                  <input
                    type="text"
                    value={inputVal}
                    onChange={(e) => setInputVal(e.target.value)}
                    placeholder="Type a message or preset..."
                    className="flex-1 bg-[#2A3942] rounded-full px-4 py-2.5 text-xs text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-brand-rose"
                  />
                  <button type="submit" className="w-9 h-9 rounded-full bg-brand-rose hover:bg-rose-600 text-white flex items-center justify-center shadow-lg shadow-brand-rose/30 transition-all">
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>

        {/* Bento Modules */}
        <div className="grid sm:grid-cols-3 gap-4">
          <Link href="/calculator" className="figma-glass p-5 rounded-3xl block group hover:border-amber-500/40 transition-all">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/15 text-amber-400 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
              <Calculator className="w-5 h-5" />
            </div>
            <h4 className="text-sm font-bold text-white font-display group-hover:text-amber-400 transition-colors">Stealth Calculator</h4>
            <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">Disguised math tool with secret PIN trigger (`9999=`).</p>
          </Link>

          <Link href="/voice" className="figma-glass p-5 rounded-3xl block group hover:border-brand-rose/40 transition-all">
            <div className="w-10 h-10 rounded-2xl bg-brand-rose/15 text-brand-rose flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
              <Mic className="w-5 h-5" />
            </div>
            <h4 className="text-sm font-bold text-white font-display group-hover:text-brand-rose transition-colors">Voice Sentinel</h4>
            <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">Real mic acoustic scream & Urdu distress classifier.</p>
          </Link>

          <Link href="/tracker" className="figma-glass p-5 rounded-3xl block group hover:border-brand-violet/40 transition-all">
            <div className="w-10 h-10 rounded-2xl bg-brand-violet/15 text-brand-violet flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
              <MapPin className="w-5 h-5" />
            </div>
            <h4 className="text-sm font-bold text-white font-display group-hover:text-brand-violet transition-colors">Live Family Beacon</h4>
            <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">Real-time GPS incident telemetry & audio vault.</p>
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 border-t border-white/[0.06] flex flex-wrap items-center justify-between text-xs text-slate-400 gap-4">
        <div className="flex items-center gap-2">
          <Image src="/beti_3d_hero.jpg" alt="Beti 3D" width={20} height={20} className="w-5 h-5 rounded-md object-cover" />
          <p>Project Beti • Open-Source Autonomous AI Women Safety</p>
        </div>
        <div className="flex items-center gap-5">
          <Link href="/deck" className="hover:text-slate-300 transition-colors">Pitch Deck</Link>
          <Link href="/calculator" className="hover:text-slate-300 transition-colors">Stealth PWA</Link>
          <Link href="/voice" className="hover:text-slate-300 transition-colors">Voice Sentinel</Link>
          <Link href="/tracker" className="hover:text-slate-300 transition-colors">Emergency Map</Link>
        </div>
      </footer>
    </div>
  );
}
