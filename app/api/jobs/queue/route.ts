import { NextResponse } from 'next/server';
import { getQueueMetrics, recoverStaleJobs } from '@/lib/jobs/queue';
import { processBackgroundJobs } from '@/lib/jobs/processor';

export async function GET() {
  try {
    const metrics = await getQueueMetrics();
    return NextResponse.json({
      status: 'ok',
      metrics,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action || 'process';

    if (action === 'recover') {
      const recovered = await recoverStaleJobs(body.timeoutMinutes || 5);
      return NextResponse.json({
        status: 'ok',
        recovered,
        message: `Recovered ${recovered} stale jobs back to queued state.`,
      });
    }

    const batchSize = Number(body.batchSize) || 5;
    const result = await processBackgroundJobs(batchSize);

    return NextResponse.json({
      status: 'ok',
      result,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
