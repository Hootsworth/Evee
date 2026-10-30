// Evee - Health Check Endpoint
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    status: 'healthy',
    service: 'Evee - AI B2B Prospecting & Outreach',
    version: '2.0.0',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    providers: {
      discovery: process.env.DISCOVERY_PROVIDER || 'mock',
      ai: process.env.AI_PROVIDER || 'mock',
      automatedSending: process.env.ENABLE_AUTOMATED_SENDING === 'true',
    },
  });
}
