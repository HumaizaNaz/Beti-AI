import { NextRequest, NextResponse } from 'next/server';
import { betiOrchestrator } from '@/src/core/orchestrator';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { phone = '+923001234567', message = '' } = body;

    if (!message) {
      return NextResponse.json({ error: 'Message cannot be empty' }, { status: 400 });
    }

    const result = betiOrchestrator.processUserMessage(phone, message);
    return NextResponse.json({
      success: true,
      reply: result.reply,
      isEmergencyTriggered: result.isEmergencyTriggered,
      alertId: result.alertId,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
