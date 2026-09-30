# 🛡️ Project Beti AI — Autonomous Women & Family Safety Ecosystem
> **An Open-Source, Zero-Install, Multi-Agent Guardian powered by OpenClaw, WhatsApp, and Acoustic Voice AI.**

[![License: MIT](https://img.shields.io/badge/License-MIT-rose.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-v20%2B-green.svg)](https://nodejs.org/)
[![OpenClaw Ready](https://img.shields.io/badge/OpenClaw-Compatible-orange.svg)](https://openclaw.ai)
[![PRs Welcome](https://img.shields.io/badge/PRs-Welcome-brightgreen.svg)](#contributing)

---

## 📌 Vision & Mission
Millions of women and vulnerable individuals face fear during daily commutes, rideshares, and walking alone. While hundreds of "SOS safety apps" exist, **over 95% fail in real-life crises** because:
1. **The "Unlock & Press" Delusion:** A victim cannot unlock their phone and hold a button while being attacked. Phones are snatched in seconds.
2. **The "Dead Phone" Vulnerability:** If the phone battery dies (0%) or is smashed by an attacker, all traditional tracking apps go completely silent.
3. **Severe Battery Drain & OS Killing:** 24/7 background listening drains batteries in 2–3 hours.

**Project Beti** solves this with an autonomous, multi-agent AI system that works through channels people already use (**WhatsApp, Telegram, and a Camouflaged Web PWA**) with zero battery drain, hands-free voice distress detection, and a server-side **Dead-Man's Switch**.

---

## 🌟 Core Innovations

| Innovation | How It Works |
| :--- | :--- |
| 💬 **0-Install on WhatsApp** | Users and family don't need to install any new apps. Runs natively on WhatsApp via **OpenClaw**. |
| 🎙️ **Hands-Free Voice & Scream AI** | Detects *"Help"*, *"Bachao"*, *"Chhoro"*, and panic screams from inside bags without unlocking the screen. |
| ⏱️ **Server-Side Dead-Man's Switch** | If a user starts a 20-min trip and the phone is smashed or battery dies, the cloud server automatically alerts family. |
| 🔢 **Stealth Calculator PWA** | A secondary web tool disguised as a standard calculator with secret PIN triggers (`9999=`). |
| 🗺️ **Family Live Incident Portal** | Instant Leaflet.js real-time GPS map with vehicle details, police (15) call buttons, and encrypted audio evidence vault. |
| 🔋 **Ultra-Low Battery** | 3-tier sleep architecture consumes **< 3% battery per day**. |

---

## 🏛️ System Architecture

```mermaid
flowchart TD
    subgraph Channels ["User & Family Ingress"]
        U1["👩 User (WhatsApp / Voice Notes)"]
        U2["📱 Stealth Calculator PWA"]
        F1["👨‍👩‍👧 Emergency Family Group"]
    end

    subgraph Gateway ["OpenClaw Hub & Session Router"]
        OC["🦞 OpenClaw Channel Gateway"]
        SessionStore["🗄️ State & Emergency Contact DB"]
    end

    subgraph MultiAgentCore ["🛡️ Beti Multi-Agent Swarm"]
        A1["1. Beti-Ingress-Agent (Front Desk & WhatsApp)"]
        A2["2. Beti-Trip-Agent (NLP Vehicle & Route Parser)"]
        A3["3. Beti-Watchdog-Agent (Dead-Man's Timer Engine)"]
        A4["4. Beti-Distress-Agent (Voice & Scream Classifier)"]
        A5["5. Beti-Dispatcher-Agent (Emergency Broadcaster)"]
    end

    subgraph Output ["Emergency Dispatch & Evidence"]
        WA_Alert["💬 WhatsApp Emergency Broadcast"]
        SMS_Alert["📱 Cellular SMS Fallback"]
        Vault["🔒 Encrypted Evidence Vault"]
    end

    U1 --> OC
    U2 --> OC
    OC --> SessionStore
    OC --> A1
    A1 --> A2 --> A3
    A1 --> A4
    A3 -->|Timer Expired (Unsafe)| A5
    A4 -->|Distress Confirmed| A5
    A5 --> WA_Alert --> F1
    A5 --> SMS_Alert --> F1
    A5 --> Vault
```

---

## 🚀 Quick Start (Local Setup)

### Prerequisites
* **Node.js** (v18 or higher)
* **npm** or **yarn**

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/YOUR_USERNAME/beti-ai.git
cd beti-ai
npm install
```

### 2. Start the Unified Server & Web Portals
```bash
npm start
```

Open your browser and navigate to:
* 🌐 **Master Hub:** [http://localhost:3000](http://localhost:3000)
* 🗺️ **Live Family Tracker:** [http://localhost:3000/tracker](http://localhost:3000/tracker)
* 🎙️ **Voice & Scream Sentinel:** [http://localhost:3000/voice](http://localhost:3000/voice)
* 🔢 **Stealth Calculator PWA:** [http://localhost:3000/calculator](http://localhost:3000/calculator)
* 📊 **Pitch Deck Presentation:** [http://localhost:3000/deck](http://localhost:3000/deck)

### 3. Run the Multi-Agent Test Simulator
To test all 3 real-world safety scenarios (`Normal Trip`, `Secret Phrase Panic`, and `Dead-Man's Switch Timeout`):
```bash
npm run simulate
```

---

## 📂 Project Structure

```text
beti/
├── src/
│   ├── agents/
│   │   ├── ingressAgent.ts        # User conversational front-desk
│   │   ├── tripAgent.ts           # Journey NLP & status manager
│   │   ├── watchdogAgent.ts       # Dead-Man's Switch & cron timers
│   │   ├── distressAgent.ts       # Voice distress & keyword evaluator
│   │   └── dispatcherAgent.ts     # Emergency family broadcaster
│   ├── skills/
│   │   ├── contactManagerSkill.ts # Emergency contacts manager
│   │   ├── tripParserSkill.ts     # NLP entity extractor for vehicles & ETAs
│   │   ├── timerEngineSkill.ts    # Server-side safety timers
│   │   ├── voiceDistressSkill.ts  # Acoustic scream & Urdu/English distress lexicon
│   │   └── broadcastSkill.ts      # WhatsApp / SMS dispatcher
│   ├── channels/
│   │   └── openclawConnector.ts   # OpenClaw webhook connector
│   ├── core/
│   │   ├── orchestrator.ts        # Swarm coordinator & event bus
│   │   ├── stateStore.ts          # Encrypted state & active trip store
│   │   └── types.ts               # Data models & interfaces
│   ├── test/
│   │   └── simulate_journey.ts    # CLI simulator for 3 real-world scenarios
│   └── server.ts                  # Express API & static server
├── public/
│   ├── index.html                 # Apple-grade Master Hub & Chat Simulator
│   └── tracker.html               # Live Family GPS Telemetry Portal (Leaflet.js)
├── calculator_stealth.html        # Disguised Calculator Web PWA
├── voice_listener_demo.html       # Real microphone scream & keyword visualizer
├── pitch_deck.html                # Interactive HTML presentation deck
├── openclaw.config.json           # OpenClaw gateway configuration
├── PROJECT_HIFAZAT_PITCH_AND_DOCS.md # Comprehensive PRD & whitepaper
├── SOCIAL_MEDIA_POSTS_AND_COMMUNITY_LAUNCH.md # Launch kit for LinkedIn/FB/Twitter
├── MASTER_VIDEO_PRODUCTION_BLUEPRINT_AND_PURPOSE.md # AI video production guide
└── package.json
```

---

## 🤝 Contributing & Community Call
Project Beti is **100% Free and Open-Source**. We welcome contributions from:
* 👩 **Khawateen & Women Advocates:** Feedback on real-life safety gaps & UI/UX.
* 👨‍💻 **Developers & AI Engineers:** OpenClaw modules, Baileys WhatsApp bridges, and TinyML on-device audio models.

### How to Contribute:
1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License
Distributed under the **MIT License**. Free for public welfare, community deployment, and non-profit use.

---

<p align="center">
  <b>Built with ❤️ for the safety and fearless freedom of every daughter & sister.</b>
</p>
