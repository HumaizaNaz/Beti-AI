import express, { Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import { betiOrchestrator } from './core/orchestrator';
import { globalStore } from './core/stateStore';
import { dispatcherAgent } from './agents/dispatcherAgent';
import { openClawConnector } from './channels/openclawConnector';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Root route -> Master Hub
app.get('/', (req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Route: Stealth Calculator PWA
app.get('/calculator', (req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '../calculator_stealth.html'));
});

// Route: Live Voice & Scream Sentinel
app.get('/voice', (req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '../voice_listener_demo.html'));
});

// Route: Interactive Pitch Deck
app.get('/deck', (req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '../pitch_deck.html'));
});

// Route: Live Family Emergency Tracker
app.get('/tracker', (req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '../public/tracker.html'));
});

// ==========================================
// 🔌 REST API & OPENCLAW WEBHOOK ENDPOINTS
// ==========================================

// 1. Process WhatsApp / Web Chat Message
app.post('/api/message', (req: Request, res: Response) => {
  const { phone = '+923001234567', message = '' } = req.body;
  if (!message) {
    return res.status(400).json({ error: 'Message cannot be empty' });
  }

  const result = betiOrchestrator.processUserMessage(phone, message);
  res.json({
    success: true,
    reply: result.reply,
    isEmergencyTriggered: result.isEmergencyTriggered,
    alertId: result.alertId
  });
});

// 2. OpenClaw Webhook Ingress (For Real WhatsApp/Telegram Bridges)
app.post('/api/openclaw/webhook', async (req: Request, res: Response) => {
  try {
    const { channel = 'whatsapp', senderId = '+923001234567', text = '' } = req.body;
    const response = await openClawConnector.handleOpenClawWebhook({
      channel,
      senderId,
      text,
      timestamp: new Date().toISOString()
    });
    res.json({ success: true, response });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. Direct Stealth SOS Trigger (From Calculator or Voice)
app.post('/api/trigger-sos', (req: Request, res: Response) => {
  const { phone = '+923001234567', triggerType = 'PANIC_KEYWORD', reason = 'Direct SOS triggered by user' } = req.body;
  const user = globalStore.getUser(phone);

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const alert = dispatcherAgent.triggerEmergency(
    user,
    triggerType,
    reason
  );

  res.json({
    success: true,
    message: 'Emergency Broadcast Dispatched to Family Contacts!',
    alert
  });
});

// 4. Get All Recorded Alerts
app.get('/api/alerts', (req: Request, res: Response) => {
  res.json({
    success: true,
    alerts: globalStore.getAlerts()
  });
});

// 5. System Health Status & OpenClaw Gateway Info
app.get('/api/status', (req: Request, res: Response) => {
  res.json({
    status: 'ONLINE',
    systemName: 'Project Beti AI Guardian',
    openclawGateway: {
      status: 'CONFIGURED',
      configFile: 'openclaw.config.json',
      webhookUrl: `http://localhost:${PORT}/api/openclaw/webhook`
    },
    activeAgents: [
      'Beti-Ingress-Agent',
      'Beti-Trip-Agent',
      'Beti-Watchdog-Agent',
      'Beti-Distress-Agent',
      'Beti-Dispatcher-Agent'
    ],
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log('\n=============================================================');
  console.log(`🛡️  PROJECT BETI AI - UNIFIED SERVER & OPENCLAW GATEWAY RUNNING`);
  console.log('=============================================================');
  console.log(`🌐 Master Hub Portal:        http://localhost:${PORT}`);
  console.log(`🦞 OpenClaw Webhook Ingress: http://localhost:${PORT}/api/openclaw/webhook`);
  console.log(`🔢 Stealth Calculator PWA:   http://localhost:${PORT}/calculator`);
  console.log(`🎙️ Voice & Scream Sentinel:  http://localhost:${PORT}/voice`);
  console.log(`🗺️ Family Incident Tracker:  http://localhost:${PORT}/tracker`);
  console.log(`📊 Pitch Deck Presentation:  http://localhost:${PORT}/deck`);
  console.log('=============================================================\n');
});
