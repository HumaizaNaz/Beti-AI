import { NextRequest, NextResponse } from 'next/server';
import { globalStore } from '@/src/core/stateStore';
import { dispatcherAgent } from '@/src/agents/dispatcherAgent';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { phone = '+923001234567', triggerType = 'PANIC_KEYWORD', reason = 'Direct SOS triggered by user' } = body;
    const user = globalStore.getUser(phone);

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const alert = dispatcherAgent.triggerEmergency(user, triggerType, reason);
    return NextResponse.json({
      success: true,
      message: 'Emergency Broadcast Dispatched to Family Contacts!',
      alert,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
