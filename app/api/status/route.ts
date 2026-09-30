import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    status: 'ONLINE',
    systemName: 'Project Beti AI Guardian (Next.js 16 App Router)',
    openclawGateway: {
      status: 'CONFIGURED',
      configFile: 'openclaw.config.json',
      webhookUrl: '/api/openclaw/webhook',
    },
    activeAgents: [
      'Beti-Ingress-Agent',
      'Beti-Trip-Agent',
      'Beti-Watchdog-Agent',
      'Beti-Distress-Agent',
      'Beti-Dispatcher-Agent',
    ],
    framework: 'Next.js 16 (React 19, TypeScript, Tailwind)',
    timestamp: new Date().toISOString(),
  });
}
