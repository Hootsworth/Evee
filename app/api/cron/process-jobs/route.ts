// Evee - Cron Job Endpoint
// Secured by Authorization: Bearer <CRON_SECRET> header

import { NextRequest, NextResponse } from 'next/server';
import { processBackgroundJobs } from '@/lib/jobs/processor';

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
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
