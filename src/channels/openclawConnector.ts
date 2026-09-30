import { betiOrchestrator, MessageProcessResult } from '../core/orchestrator';

export interface OpenClawIncomingMessage {
  channel: 'whatsapp' | 'telegram' | 'sms';
  senderId: string; // e.g. Phone number "+923001234567"
  text: string;
  timestamp: string;
  hasAudioAttachment?: boolean;
  audioUrl?: string;
}

export interface OpenClawOutgoingResponse {
  channel: 'whatsapp' | 'telegram' | 'sms';
  recipientId: string;
  replyText: string;
  isEmergencyAlert: boolean;
  alertDetails?: any;
}

export class OpenClawConnector {
  readonly connectorName = 'OpenClaw-Beti-Bridge';

  /**
   * Receives incoming messages from OpenClaw's WhatsApp/Telegram Gateway
   * and routes them to Beti Multi-Agent Swarm.
   */
  async handleOpenClawWebhook(payload: OpenClawIncomingMessage): Promise<OpenClawOutgoingResponse> {
    console.log(`\n[OpenClaw Gateway Event] Channel: ${payload.channel.toUpperCase()} | From: ${payload.senderId}`);
    console.log(`[OpenClaw Gateway Message]: "${payload.text}"`);

    // Process through Beti Multi-Agent Swarm
    const result: MessageProcessResult = betiOrchestrator.processUserMessage(
      payload.senderId,
      payload.text
    );

    return {
      channel: payload.channel,
      recipientId: payload.senderId,
      replyText: result.reply,
      isEmergencyAlert: result.isEmergencyTriggered,
      alertDetails: result.alertId ? { alertId: result.alertId } : undefined
    };
  }
}

export const openClawConnector = new OpenClawConnector();
