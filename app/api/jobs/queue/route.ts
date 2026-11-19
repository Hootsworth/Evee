import { NextRequest, NextResponse } from 'next/server';
import { getQueueMetrics, recoverStaleJobs } from '@/lib/jobs/queue';
import { processBackgroundJobs } from '@/lib/jobs/processor';
import { createAdminClient } from '@/lib/supabase/admin';
import { getUserContext } from '@/lib/auth/context';
import { assertAuthenticated, assertAuthorized } from '@/lib/auth/rbac';

function summarizePayload(payload: Record<string, any> | null) {
  if (!payload) return {};
  const summary: Record<string, string> = {};
  for (const key of ['batchId', 'campaignId', 'businessId', 'companyName', 'company_name', 'businessName']) {
    if (typeof payload[key] === 'string') summary[key] = payload[key];
  }
  if (typeof payload.recipientEmail === 'string') {
    const [name, domain] = payload.recipientEmail.split('@');
    summary.recipient = domain ? `${name.slice(0, 1)}***@${domain}` : 'email recipient';
  }
  return summary;
}

export async function GET(req: NextRequest) {
  try {
    const userCtx = await getUserContext(req);
    assertAuthenticated(userCtx);
    const admin = createAdminClient();
    const orgId = userCtx.organizationId;

    const [metrics, jobsRes, operationsRes] = await Promise.all([
      getQueueMetrics(orgId),
      admin.from('background_jobs')
        .select('id, job_type, status, priority, attempt_count, max_attempts, scheduled_at, locked_at, created_at, updated_at, last_error_code, last_error_summary, payload')
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false })
        .limit(100),
      admin.from('audit_events')
        .select('id, event_type, timestamp, details')
        .eq('organization_id', orgId)
        .in('event_type', ['CSV_IMPORT_COMPLETED', 'CSV_IMPORT_FAILED', 'CSV_EXPORT_CREATED'])
        .order('timestamp', { ascending: false })
        .limit(30),
    ]);

    if (jobsRes.error) return NextResponse.json({ error: jobsRes.error.message }, { status: 500 });
    if (operationsRes.error) return NextResponse.json({ error: operationsRes.error.message }, { status: 500 });

    const jobs = (jobsRes.data || []).map((job) => ({
      id: job.id,
      jobType: job.job_type,
      status: job.status,
      priority: job.priority,
      attemptCount: job.attempt_count,
      maxAttempts: job.max_attempts,
      scheduledAt: job.scheduled_at,
      lockedAt: job.locked_at,
      createdAt: job.created_at,
      updatedAt: job.updated_at,
      lastErrorCode: job.last_error_code,
      lastErrorSummary: job.last_error_summary,
      payloadSummary: summarizePayload(job.payload as Record<string, any> | null),
    }));

    return NextResponse.json({
      metrics,
      jobs,
      operations: operationsRes.data || [],
      role: userCtx.role,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    const status = err.statusCode || (err.message?.includes('Unauthenticated') ? 401 : 500);
    return NextResponse.json({ error: err.message }, { status });
  }
}

export async function POST(req: NextRequest) {
  try {
    const userCtx = await getUserContext(req);
    assertAuthenticated(userCtx);
    assertAuthorized(userCtx, 'operator');

    const body = await req.json().catch(() => ({}));
    const action = body.action || 'process';
    const orgId = userCtx.organizationId;

    if (action === 'recover') {
      const timeoutMinutes = Math.max(5, Math.min(Number(body.timeoutMinutes) || 5, 60));
      const recovery = await recoverStaleJobs(timeoutMinutes, orgId);
      return NextResponse.json({ status: 'ok', ...recovery, timestamp: new Date().toISOString() });
    }

    if (action === 'process') {
      const batchSize = Math.max(1, Math.min(Number(body.batchSize) || 5, 20));
      const result = await processBackgroundJobs(batchSize, orgId);
      return NextResponse.json({ status: 'ok', result, timestamp: new Date().toISOString() });
    }

    const admin = createAdminClient();
    if (action === 'retry' || action === 'resolve') {
      if (typeof body.jobId !== 'string' || !body.jobId) {
        return NextResponse.json({ error: 'jobId is required.' }, { status: 400 });
      }

      const { data: job, error: jobError } = await admin.from('background_jobs')
        .select('id, job_type, status, payload')
        .eq('id', body.jobId)
        .eq('organization_id', orgId)
        .maybeSingle();
      if (jobError) return NextResponse.json({ error: jobError.message }, { status: 500 });
      if (!job) return NextResponse.json({ error: 'Job not found.' }, { status: 404 });

      const isEmailJob = ['send_email', 'csv_email_dispatch'].includes(job.job_type);
      if (action === 'retry') {
        if (!['failed', 'manual_review'].includes(job.status)) {
          return NextResponse.json({ error: 'Only failed or manual-review jobs can be retried.' }, { status: 409 });
        }
        if ((isEmailJob || job.status === 'manual_review') && body.confirmNoSend !== true) {
          return NextResponse.json({ error: 'Confirm that the provider did not deliver this message before retrying.' }, { status: 409 });
        }
        const { data: updated, error } = await admin.from('background_jobs').update({
          status: 'queued',
          attempt_count: 0,
          scheduled_at: new Date().toISOString(),
          locked_at: null,
          locked_by: null,
          heartbeat_at: null,
          last_error_code: null,
          last_error_summary: null,
          updated_at: new Date().toISOString(),
        }).eq('id', job.id).eq('organization_id', orgId).eq('status', job.status).select('id').maybeSingle();
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        if (!updated) return NextResponse.json({ error: 'Job changed while retrying. Refresh and try again.' }, { status: 409 });
      } else {
        if (job.status !== 'manual_review' || !['delivered', 'not_delivered'].includes(body.outcome)) {
          return NextResponse.json({ error: 'Resolve requires a manual-review job and a delivered/not_delivered outcome.' }, { status: 409 });
        }
        if (body.outcome === 'delivered' && job.job_type === 'send_email') {
          const messageId = (job.payload as any)?.messageId;
          if (messageId) {
            const { error: messageError } = await admin.from('outreach_messages').update({
              status: 'sent',
              sent_at: new Date().toISOString(),
              failure_code: null,
              failure_detail: null,
            }).eq('id', messageId).eq('organization_id', orgId);
            if (messageError) return NextResponse.json({ error: messageError.message }, { status: 500 });
          }
        }
        const { error } = await admin.from('background_jobs').update({
          status: body.outcome === 'delivered' ? 'succeeded' : 'failed',
          last_error_code: body.outcome === 'delivered' ? null : 'CONFIRMED_NOT_DELIVERED',
          last_error_summary: body.outcome === 'delivered' ? null : 'Operator confirmed the provider did not deliver this message.',
          locked_at: null,
          locked_by: null,
          updated_at: new Date().toISOString(),
        }).eq('id', job.id).eq('organization_id', orgId).eq('status', 'manual_review');
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      }

      await admin.from('audit_events').insert({
        organization_id: orgId,
        event_type: action === 'retry' ? 'BACKGROUND_JOB_RETRIED' : 'BACKGROUND_JOB_RECONCILED',
        entity_type: 'background_jobs',
        entity_id: job.id,
        details: { actorName: userCtx.displayName, outcome: body.outcome || null },
      });
      return NextResponse.json({ success: true, action, jobId: job.id });
    }

    return NextResponse.json({ error: `Unsupported queue action: ${action}` }, { status: 400 });
  } catch (err: any) {
    const status = err.statusCode || (err.message?.includes('Unauthenticated') ? 401 : err.message?.includes('Unauthorized') ? 403 : 500);
    return NextResponse.json({ error: err.message }, { status });
  }
}
