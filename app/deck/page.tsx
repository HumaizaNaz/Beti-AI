'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Lock,
  BatteryWarning,
  BellOff,
  SmartphoneNfc,
  MessageSquare,
  Timer,
  Mic,
  BatteryCharging,
  Scale,
  Radio,
  Cpu,
  Brain,
  Share2,
  ShieldAlert,
  RotateCcw,
  Home,
  AlertCircle,
  Layers,
  Map
} from 'lucide-react';

export default function DeckPage() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const totalSlides = 8;

  const nextSlide = () => {
    if (currentSlide < totalSlides - 1) setCurrentSlide((prev) => prev + 1);
  };

  const prevSlide = () => {
    if (currentSlide > 0) setCurrentSlide((prev) => prev - 1);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') nextSlide();
      else if (e.key === 'ArrowLeft') prevSlide();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentSlide]);

  return (
    <div className="flex flex-col min-h-screen justify-between p-4 md:p-8 selection:bg-rose-500 selection:text-white">
      {/* Header */}
      <header className="max-w-6xl w-full mx-auto flex items-center justify-between gap-3 py-4 border-b border-white/[0.06]">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="relative w-10 h-10 shrink-0">
            <Image src="/beti_3d_hero.jpg" alt="Beti 3D" width={40} height={40} className="w-10 h-10 rounded-xl object-cover border border-rose-500 shadow-md" />
            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-[#07090E]"></span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-bold font-heading text-white leading-tight">Project Beti</h1>
              <span className="hidden sm:inline px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-400 text-[10px] font-bold uppercase tracking-wider border border-rose-500/20">
                Pitch Deck
              </span>
            </div>
            <p className="hidden sm:block text-xs text-slate-400">Autonomous AI Women Safety Ecosystem</p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <span className="whitespace-nowrap text-xs font-semibold px-3.5 py-1.5 rounded-full bg-white/[0.04] text-rose-400 border border-white/[0.08]">
            {currentSlide + 1} / {totalSlides}
          </span>
          <Link href="/" className="text-xs font-medium text-slate-400 hover:text-white whitespace-nowrap px-3 py-1.5 rounded-full bg-white/[0.03] border border-white/[0.06] transition-colors">
            ✕ <span className="hidden sm:inline">Exit to </span>Hub
          </Link>
        </div>
      </header>

      {/* Slide Container */}
      <main className="max-w-6xl w-full mx-auto my-auto py-6">
        {/* SLIDE 1 */}
        {currentSlide === 0 && (
          <div className="flex flex-col lg:flex-row items-center justify-between gap-10 py-6 animate-fadeIn">
            <div className="flex-1 space-y-5 text-center lg:text-left">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-semibold uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5" /> Next-Gen AI Safety Pitch
              </div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight font-heading leading-[1.15]">
                Zero-Touch <br />
                <span className="gradient-text">AI Guardian For Every Daughter</span>
              </h1>
              <p className="text-base text-slate-300 max-w-lg mx-auto lg:mx-0 leading-relaxed">
                Turning ordinary smartphones into autonomous, zero-install lifelines. Protecting women during daily transit without app downloads, battery drain, or manual button presses.
              </p>
              <div className="pt-2">
                <button
                  onClick={nextSlide}
                  className="px-8 py-3.5 rounded-2xl bg-gradient-to-r from-rose-600 via-pink-600 to-indigo-600 text-white font-bold hover:shadow-xl hover:shadow-rose-500/25 transition-all flex items-center gap-2 mx-auto lg:mx-0"
                >
                  Explore Pitch Deck <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 flex justify-center relative">
              <div className="relative animate-float">
                <div className="absolute -inset-4 rounded-full bg-gradient-to-tr from-rose-500/40 to-indigo-600/40 blur-2xl opacity-70"></div>
                <div className="relative w-64 h-64 sm:w-80 sm:h-80 rounded-[36px] overflow-hidden border-2 border-white/20 shadow-2xl p-1 bg-gradient-to-b from-white/10 to-transparent backdrop-blur-md">
                  <Image src="/beti_3d_hero.jpg" alt="3D Beti AI Guardian" width={320} height={320} className="w-full h-full object-cover rounded-[32px]" />
                  <div className="absolute bottom-3 left-3 right-3 py-2 px-3 rounded-2xl bg-black/75 border border-white/10 backdrop-blur-xl flex items-center justify-between text-xs">
                    <span className="font-bold text-white flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping"></span> Project Beti
                    </span>
                    <span className="text-[10px] text-emerald-400 font-mono">3D AI MESH</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SLIDE 2: Problem */}
        {currentSlide === 1 && (
          <div className="flex flex-col justify-center py-6 animate-fadeIn space-y-6">
            <div className="text-rose-400 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5" /> The Harsh Reality
            </div>
            <h2 className="text-3xl md:text-5xl font-bold font-heading">
              Why 95% of Safety Apps <span className="text-red-400">Fail in Real Crises</span>
            </h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="figma-card p-6 rounded-3xl border-l-4 border-l-red-500">
                <div className="text-red-400 mb-3"><Lock className="w-6 h-6" /></div>
                <h3 className="text-lg font-bold text-white mb-2 font-heading">The &quot;Unlock &amp; Press&quot; Delusion</h3>
                <p className="text-slate-300 text-xs leading-relaxed">Attackers snatch phones instantly. Victims rarely have the 5–10 seconds required to unlock their screen, find an app, and hold a panic button.</p>
              </div>
              <div className="figma-card p-6 rounded-3xl border-l-4 border-l-amber-500">
                <div className="text-amber-400 mb-3"><BatteryWarning className="w-6 h-6" /></div>
                <h3 className="text-lg font-bold text-white mb-2 font-heading">Severe Battery Drain &amp; OS Killing</h3>
                <p className="text-slate-300 text-xs leading-relaxed">Continuous 24/7 background GPS and mic listening drains phone batteries in 2–3 hours, causing Android and iOS to forcefully kill the app.</p>
              </div>
              <div className="figma-card p-6 rounded-3xl border-l-4 border-l-orange-500">
                <div className="text-orange-400 mb-3"><BellOff className="w-6 h-6" /></div>
                <h3 className="text-lg font-bold text-white mb-2 font-heading">High False Alarms (Alarm Fatigue)</h3>
                <p className="text-slate-300 text-xs leading-relaxed">Dumb volume sensors trigger alarms on car horns and street laughter. Frustrated parents and users end up uninstalling the app.</p>
              </div>
              <div className="figma-card p-6 rounded-3xl border-l-4 border-l-rose-600">
                <div className="text-rose-400 mb-3"><SmartphoneNfc className="w-6 h-6" /></div>
                <h3 className="text-lg font-bold text-white mb-2 font-heading">The &quot;Dead Phone&quot; Blindspot</h3>
                <p className="text-slate-300 text-xs leading-relaxed">If the phone is smashed or battery hits 0%, traditional apps go completely offline. No automated backup alarms exist.</p>
              </div>
            </div>
          </div>
        )}

        {/* SLIDE 3: Solution */}
        {currentSlide === 2 && (
          <div className="flex flex-col justify-center py-6 animate-fadeIn space-y-6">
            <div className="text-indigo-400 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" /> The Innovation
            </div>
            <h2 className="text-3xl md:text-5xl font-bold font-heading">
              Introducing <span className="gradient-text">Project Beti</span>
            </h2>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="figma-card p-6 rounded-3xl text-center">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center mb-4">
                  <MessageSquare className="w-7 h-7" />
                </div>
                <h3 className="text-base font-bold text-white mb-2 font-heading">0-Install on WhatsApp</h3>
                <p className="text-slate-300 text-xs leading-relaxed">No app download needed. Works directly via WhatsApp for both the girl and her family.</p>
              </div>
              <div className="figma-card p-6 rounded-3xl text-center">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-indigo-500/15 text-indigo-400 flex items-center justify-center mb-4">
                  <Timer className="w-7 h-7" />
                </div>
                <h3 className="text-base font-bold text-white mb-2 font-heading">Dead-Man&apos;s Switch</h3>
                <p className="text-slate-300 text-xs leading-relaxed">Server-side trip countdown. If phone dies (0% battery) or is broken, the cloud automatically alerts family.</p>
              </div>
              <div className="figma-card p-6 rounded-3xl text-center">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-rose-500/15 text-rose-400 flex items-center justify-center mb-4">
                  <Mic className="w-7 h-7" />
                </div>
                <h3 className="text-base font-bold text-white mb-2 font-heading">Hands-Free AI Voice</h3>
                <p className="text-slate-300 text-xs leading-relaxed">Recognizes secret phrases and panic screams from inside bags without unlocking the screen.</p>
              </div>
            </div>
            <div className="mt-6 figma-card p-4 rounded-2xl flex items-center justify-between flex-wrap gap-4 border border-indigo-500/30">
              <div className="flex items-center gap-3 text-slate-200 text-xs font-medium">
                <BatteryCharging className="w-5 h-5 text-emerald-400" />
                <span><b>Ultra-Low Power:</b> 3-Tier Sleep Engine uses &lt; 3% battery per full day</span>
              </div>
              <span className="text-[11px] px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 font-bold">100% Free &amp; Open-Source</span>
            </div>
          </div>
        )}

        {/* SLIDE 4: Steps */}
        {currentSlide === 3 && (
          <div className="flex flex-col justify-center py-6 animate-fadeIn space-y-6">
            <div className="text-rose-400 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5" /> The Experience
            </div>
            <h2 className="text-3xl md:text-5xl font-bold font-heading">
              How It Works in <span className="gradient-text">3 Simple Steps</span>
            </h2>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="figma-card p-6 rounded-3xl">
                <div className="text-xs font-bold text-rose-400 uppercase mb-2">Step 1</div>
                <h3 className="text-base font-bold text-white mb-2 font-heading">30-Sec WhatsApp Onboarding</h3>
                <p className="text-slate-300 text-xs leading-relaxed">Save the Guardian WhatsApp number. Send &quot;Start&quot; and enter 2 emergency family numbers. You are fully configured.</p>
              </div>
              <div className="figma-card p-6 rounded-3xl">
                <div className="text-xs font-bold text-indigo-400 uppercase mb-2">Step 2</div>
                <h3 className="text-base font-bold text-white mb-2 font-heading">Natural Trip Logging</h3>
                <p className="text-slate-300 text-xs leading-relaxed">Send a text or voice note: <i>&quot;Rickshaw KHI-1234, 20 mins to Home&quot;</i>. OpenClaw AI automatically extracts details and sets safety timers.</p>
              </div>
              <div className="figma-card p-6 rounded-3xl">
                <div className="text-xs font-bold text-emerald-400 uppercase mb-2">Step 3</div>
                <h3 className="text-base font-bold text-white mb-2 font-heading">Autonomous Emergency Trigger</h3>
                <p className="text-slate-300 text-xs leading-relaxed">If secret distress phrase is spoken or timer expires without safe PIN, instant WhatsApp alerts with live maps &amp; audio are broadcast.</p>
              </div>
            </div>
          </div>
        )}

        {/* SLIDE 5: Matrix */}
        {currentSlide === 4 && (
          <div className="flex flex-col justify-center py-6 animate-fadeIn space-y-6">
            <div className="text-indigo-400 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
              <Scale className="w-3.5 h-3.5" /> Market Comparison
            </div>
            <h2 className="text-3xl md:text-5xl font-bold font-heading">
              Why Project Beti <span className="gradient-text">Dominates</span>
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300 figma-card rounded-3xl overflow-hidden">
                <thead className="bg-black/60 text-[11px] uppercase text-slate-400 border-b border-white/[0.06]">
                  <tr>
                    <th className="p-4">Key Criteria</th>
                    <th className="p-4">Traditional SOS Apps</th>
                    <th className="p-4">bSafe / Noonlight</th>
                    <th className="p-4 text-rose-400 font-bold bg-rose-500/10">Project Beti (Ours)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  <tr>
                    <td className="p-4 font-semibold text-white">App Download</td>
                    <td className="p-4 text-red-400">Mandatory</td>
                    <td className="p-4 text-red-400">Mandatory</td>
                    <td className="p-4 text-emerald-400 font-bold bg-rose-500/5">0-Install (WhatsApp)</td>
                  </tr>
                  <tr>
                    <td className="p-4 font-semibold text-white">Trigger Mode</td>
                    <td className="p-4 text-red-400">Manual Screen Tap</td>
                    <td className="p-4 text-amber-400">Hold Button / Voice</td>
                    <td className="p-4 text-emerald-400 font-bold bg-rose-500/5">Zero-Touch Voice AI</td>
                  </tr>
                  <tr>
                    <td className="p-4 font-semibold text-white">Phone Dead / 0% Battery</td>
                    <td className="p-4 text-red-400">Fails Completely</td>
                    <td className="p-4 text-red-400">Fails Completely</td>
                    <td className="p-4 text-emerald-400 font-bold bg-rose-500/5">Auto Dead-Man Alert</td>
                  </tr>
                  <tr>
                    <td className="p-4 font-semibold text-white">Battery Impact</td>
                    <td className="p-4 text-red-400">High (Drains in hours)</td>
                    <td className="p-4 text-red-400">High</td>
                    <td className="p-4 text-emerald-400 font-bold bg-rose-500/5">&lt; 3% per day</td>
                  </tr>
                  <tr>
                    <td className="p-4 font-semibold text-white">Monthly Cost</td>
                    <td className="p-4">Free with Ads</td>
                    <td className="p-4 text-amber-400">$5 – $15 / month</td>
                    <td className="p-4 text-emerald-400 font-bold bg-rose-500/5">100% Free &amp; Open</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* SLIDE 6: Architecture */}
        {currentSlide === 5 && (
          <div className="flex flex-col justify-center py-6 animate-fadeIn space-y-6">
            <div className="text-rose-400 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5" /> Under The Hood
            </div>
            <h2 className="text-3xl md:text-5xl font-bold font-heading">
              Robust, Self-Hosted <span className="gradient-text">Architecture</span>
            </h2>
            <div className="grid md:grid-cols-4 gap-4 text-center">
              <div className="figma-card p-5 rounded-3xl">
                <div className="text-rose-400 mx-auto mb-2 flex justify-center"><Radio className="w-6 h-6" /></div>
                <h3 className="font-bold text-white mb-1 font-heading text-sm">1. Channels</h3>
                <p className="text-[11px] text-slate-300">WhatsApp Gateway, Telegram Bot, Calculator PWA</p>
              </div>
              <div className="figma-card p-5 rounded-3xl">
                <div className="text-indigo-400 mx-auto mb-2 flex justify-center"><Cpu className="w-6 h-6" /></div>
                <h3 className="font-bold text-white mb-1 font-heading text-sm">2. OpenClaw Hub</h3>
                <p className="text-[11px] text-slate-300">Autonomous Agent Core, State Store, Dead-Man Timers</p>
              </div>
              <div className="figma-card p-5 rounded-3xl">
                <div className="text-purple-400 mx-auto mb-2 flex justify-center"><Brain className="w-6 h-6" /></div>
                <h3 className="font-bold text-white mb-1 font-heading text-sm">3. AI Engine</h3>
                <p className="text-[11px] text-slate-300">Whisper-Tiny VAD, NLP Trip Entity Extraction</p>
              </div>
              <div className="figma-card p-5 rounded-3xl">
                <div className="text-emerald-400 mx-auto mb-2 flex justify-center"><Share2 className="w-6 h-6" /></div>
                <h3 className="font-bold text-white mb-1 font-heading text-sm">4. Dispatcher</h3>
                <p className="text-[11px] text-slate-300">Family WhatsApp Broadcaster, SMS Bridge, Vault</p>
              </div>
            </div>
            <div className="mt-6 figma-card p-4 rounded-2xl text-xs text-slate-300 flex items-center gap-3">
              <ShieldAlert className="w-5 h-5 text-rose-400" />
              <span><b>Privacy Guarantee:</b> Zero raw voice retention. Ephemeral location logs automatically deleted upon safe arrival. End-to-end encryption on all emergency evidence clips.</span>
            </div>
          </div>
        )}

        {/* SLIDE 7: Roadmap */}
        {currentSlide === 6 && (
          <div className="flex flex-col justify-center py-6 animate-fadeIn space-y-6">
            <div className="text-indigo-400 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
              <Map className="w-3.5 h-3.5" /> Execution Plan
            </div>
            <h2 className="text-3xl md:text-5xl font-bold font-heading">
              Phased <span className="gradient-text">Development Roadmap</span>
            </h2>
            <div className="grid md:grid-cols-4 gap-4">
              <div className="figma-card p-5 rounded-3xl border-t-4 border-t-rose-500">
                <span className="text-xs font-bold text-rose-400">Phase 1</span>
                <h3 className="font-bold text-white my-1 font-heading text-sm">Core Gateway</h3>
                <p className="text-xs text-slate-300">OpenClaw setup, WhatsApp connector &amp; contact onboarding.</p>
              </div>
              <div className="figma-card p-5 rounded-3xl border-t-4 border-t-indigo-500">
                <span className="text-xs font-bold text-indigo-400">Phase 2</span>
                <h3 className="font-bold text-white my-1 font-heading text-sm">Trip &amp; Timers</h3>
                <p className="text-xs text-slate-300">NLP trip logging + Automated Dead-Man&apos;s switch countdowns.</p>
              </div>
              <div className="figma-card p-5 rounded-3xl border-t-4 border-t-purple-500">
                <span className="text-xs font-bold text-purple-400">Phase 3</span>
                <h3 className="font-bold text-white my-1 font-heading text-sm">Voice AI &amp; NLP</h3>
                <p className="text-xs text-slate-300">Hands-free distress classifier &amp; secret keyword spotter.</p>
              </div>
              <div className="figma-card p-5 rounded-3xl border-t-4 border-t-emerald-500">
                <span className="text-xs font-bold text-emerald-400">Phase 4</span>
                <h3 className="font-bold text-white my-1 font-heading text-sm">Stealth &amp; Rollout</h3>
                <p className="text-xs text-slate-300">Camouflaged Calculator PWA, offline SMS fallback &amp; field pilot.</p>
              </div>
            </div>
          </div>
        )}

        {/* SLIDE 8: Vision */}
        {currentSlide === 7 && (
          <div className="flex flex-col items-center justify-center text-center py-10 space-y-5 animate-fadeIn">
            <div className="relative animate-float">
              <div className="absolute -inset-3 rounded-full bg-gradient-to-tr from-rose-500/50 to-indigo-600/50 blur-xl opacity-75"></div>
              <Image src="/beti_3d_hero.jpg" alt="Beti 3D" width={96} height={96} className="w-24 h-24 rounded-full object-cover border-2 border-white shadow-2xl relative z-10" />
            </div>

            <h2 className="text-4xl md:text-6xl font-extrabold font-heading leading-tight">
              Every Daughter Deserves <br />
              <span className="gradient-text">Fearless Freedom</span>
            </h2>

            <p className="text-slate-300 text-sm md:text-base max-w-xl mx-auto leading-relaxed">
              We are building an open-source, community-driven safety ecosystem that protects lives without barriers. Let&apos;s make every journey safe.
            </p>

            <div className="flex gap-4 justify-center pt-2">
              <button
                onClick={() => setCurrentSlide(0)}
                className="px-6 py-3 rounded-2xl bg-white/[0.06] hover:bg-white/[0.12] text-slate-200 font-semibold text-xs border border-white/[0.08] transition-all flex items-center gap-2"
              >
                <RotateCcw className="w-4 h-4" /> Restart Presentation
              </button>
              <Link
                href="/"
                className="px-6 py-3 rounded-2xl bg-gradient-to-r from-rose-600 to-indigo-600 hover:from-rose-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-rose-500/25 transition-all flex items-center gap-2"
              >
                <Home className="w-4 h-4" /> Back to Main Hub
              </Link>
            </div>
          </div>
        )}
      </main>

      {/* Footer Controls */}
      <footer className="max-w-6xl w-full mx-auto flex items-center justify-between py-4 border-t border-white/[0.06] text-xs text-slate-400">
        <div className="hidden sm:flex items-center gap-2">
          <span>Use</span>
          <kbd className="px-2 py-1 rounded bg-white/[0.04] border border-white/[0.08] text-slate-300 font-mono">←</kbd>
          <span>and</span>
          <kbd className="px-2 py-1 rounded bg-white/[0.04] border border-white/[0.08] text-slate-300 font-mono">→</kbd>
          <span>keys to navigate</span>
        </div>

        <div className="flex items-center gap-3 mx-auto sm:mx-0">
          <button
            onClick={prevSlide}
            disabled={currentSlide === 0}
            className="px-4 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] disabled:opacity-30 text-slate-200 font-semibold text-xs border border-white/[0.06] transition-all flex items-center gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Previous
          </button>
          <button
            onClick={nextSlide}
            disabled={currentSlide === totalSlides - 1}
            className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-30 text-white font-semibold text-xs shadow-lg shadow-rose-600/20 transition-all flex items-center gap-1.5"
          >
            Next <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </footer>
    </div>
  );
}
