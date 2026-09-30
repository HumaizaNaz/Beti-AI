import { NextRequest, NextResponse } from 'next/server';
import { openClawConnector } from '@/src/channels/openclawConnector';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { channel = 'whatsapp', senderId = '+923001234567', text = '' } = body;
    const response = await openClawConnector.handleOpenClawWebhook({
      channel,
      senderId,
      text,
      timestamp: new Date().toISOString(),
    });
    return NextResponse.json({ success: true, response });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
