import { NextResponse } from 'next/server';
import { globalStore } from '@/src/core/stateStore';

export async function GET() {
  return NextResponse.json({
    success: true,
    alerts: globalStore.getAlerts(),
  });
}
