// Evee - Cron Job Endpoint
// Secured by Authorization: Bearer <CRON_SECRET> header (Fails closed)

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { processBackgroundJobs } from '@/lib/jobs/processor';

export async function POST(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;

  // Fail closed if CRON_SECRET is missing or empty
  if (!cronSecret || cronSecret.trim().length === 0) {
    return NextResponse.json(
      { error: 'Server misconfiguration: CRON_SECRET is unconfigured' },
      { status: 500 }
    );
  }

  const authHeader = req.headers.get('authorization');
  const expectedHeader = `Bearer ${cronSecret.trim()}`;

  if (!authHeader) {
    return NextResponse.json({ error: 'Unauthorized: Missing authorization header' }, { status: 401 });
  }

  const expectedBuffer = Buffer.from(expectedHeader, 'utf8');
  const actualBuffer = Buffer.from(authHeader, 'utf8');

  if (
    expectedBuffer.length !== actualBuffer.length ||
    !crypto.timingSafeEqual(expectedBuffer, actualBuffer)
  ) {
    return NextResponse.json({ error: 'Unauthorized: Invalid cron secret' }, { status: 401 });
  }

  try {
    const result = await processBackgroundJobs(5);
    return NextResponse.json({
      success: true,
      processed: result,
      timestamp: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const error = err as Error;
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}
