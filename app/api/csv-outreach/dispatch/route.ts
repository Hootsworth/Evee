// Evee - Bulk CSV Direct Outreach Dispatch Handler (Durable Background Queue)
// Validates template & recipients, scopes to organization, and enqueues durable background dispatch jobs.
import { NextRequest, NextResponse } from 'next/server';
import { replaceTemplateVariables } from '@/lib/csv/parser';
import {
  classifyProspectBatchWithAi,
  applyAiAnalysisToProspect,
} from '@/lib/csv/classifier';
import { createAdminClient } from '@/lib/supabase/admin';
import { getUserContext } from '@/lib/auth/context';
import { assertAuthenticated, assertAuthorized } from '@/lib/auth/rbac';
import { processBackgroundJobs } from '@/lib/jobs/processor';

export async function POST(req: NextRequest) {
  try {
    const userCtx = await getUserContext();
    assertAuthenticated(userCtx);
    assertAuthorized(userCtx, 'operator');

    const body = await req.json();
    const { template, recipients, mapping, cadence = 'human', skipPreviouslyContacted = true } = body;

    if (!template?.subject || !template?.bodyText) {
      return NextResponse.json({ error: 'Subject and body template are required.' }, { status: 400 });
    }

    if (!Array.isArray(recipients) || recipients.length === 0) {
      return NextResponse.json({ error: 'No recipients provided.' }, { status: 400 });
    }

    const orgId = userCtx.organizationId;
    const admin = createAdminClient();

    // Deduplication Protection: Find all previously contacted or queued emails for this tenant
    const contactedEmails = new Set<string>();
    if (skipPreviouslyContacted) {
      const { data: existingJobs } = await admin
        .from('background_jobs')
        .select('payload')
        .eq('organization_id', orgId)
        .eq('job_type', 'csv_email_dispatch')
        .in('status', ['succeeded', 'queued', 'running']);

      if (existingJobs) {
        for (const j of existingJobs) {
          const em = (j.payload?.recipientEmail || '').trim().toLowerCase();
          if (em) contactedEmails.add(em);
        }
      }

      const { data: existingMessages } = await admin
        .from('outreach_messages')
        .select(`
          status,
          businesses (general_business_email),
          contacts (email)
        `)
        .eq('organization_id', orgId)
        .in('status', ['sent', 'sending', 'queued']);

      if (existingMessages) {
        for (const m of existingMessages) {
          const em1 = ((m as any).contacts?.email || '').trim().toLowerCase();
          const em2 = ((m as any).businesses?.general_business_email || '').trim().toLowerCase();
          if (em1) contactedEmails.add(em1);
          if (em2) contactedEmails.add(em2);
        }
      }
    }

    const emailCol = mapping?.email || 'email';
    const companyCol = mapping?.companyName || 'company_name';
    const websiteCol = mapping?.website || 'website';
    const cityCol = mapping?.city || 'city';

    // Ensure all recipients have AI company classification applied if needed
    const needsEnrichment = recipients.some(
      (r) => !r.ai_company_type && !r.company_type
    );
    let processedRecipients = recipients;

    if (needsEnrichment) {
      const formatted = recipients.map((p) => ({
        companyName:
          p[companyCol] || p.company_name || p.company || p.business_name || 'Business',
        website: p[websiteCol] || p.website || '',
        city: p[cityCol] || p.city || '',
      }));

      const { analyses } = await classifyProspectBatchWithAi(formatted);
      processedRecipients = recipients.map((p, idx) =>
        applyAiAnalysisToProspect(p, analyses[idx])
      );
    }

    const batchId = `csv-batch-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const jobsToInsert: any[] = [];
    const clientResults: Array<{
      email: string;
      status: 'queued' | 'failed' | 'skipped';
      companyType?: string;
      error?: string;
      idempotencyKey?: string;
      scheduledAt?: string;
    }> = [];

    let queuedCount = 0;
    let failedCount = 0;
    let skippedCount = 0;

    for (let idx = 0; idx < processedRecipients.length; idx++) {
      const prospect = processedRecipients[idx];
      const email = (prospect[emailCol] || prospect.email || '').trim().toLowerCase();

      if (!email || !email.includes('@')) {
        clientResults.push({ email: email || 'unknown', status: 'failed', error: 'Invalid email address' });
        failedCount++;
        continue;
      }

      const companyType = prospect.ai_company_type || prospect.company_type || 'General Business';

      // Duplicate Prevention: Skip if already contacted or queued in a previous dispatch or earlier in this batch
      if (skipPreviouslyContacted && contactedEmails.has(email)) {
        clientResults.push({
          email,
          status: 'skipped',
          companyType,
          error: 'Skipped: recipient was already contacted or queued previously',
        });
        skippedCount++;
        continue;
      }
      contactedEmails.add(email);
      const personalizedSubject = replaceTemplateVariables(template.subject, prospect, mapping);
      const personalizedBodyText = replaceTemplateVariables(template.bodyText, prospect, mapping);
      const personalizedBodyHtml = template.bodyHtml
        ? replaceTemplateVariables(template.bodyHtml, prospect, mapping)
        : undefined;

      const idempotencyKey = `csv-${batchId}-${idx}-${email}`;

      // Calculate staggered schedule to prevent spam flags and simulate natural human sending rhythm
      let scheduledAtDate = new Date();
      if (cadence === 'fast') {
        // Fast Pace: ~15 seconds apart
        scheduledAtDate = new Date(Date.now() + idx * 15 * 1000);
      } else if (cadence === 'human') {
        // Human Drip (Anti-Spam Default): 45-75 seconds between each email with randomized jitter
        const jitter = Math.floor(Math.random() * 25);
        const cumulativeDelaySeconds = idx * 50 + jitter;
        scheduledAtDate = new Date(Date.now() + cumulativeDelaySeconds * 1000);
      } else {
        // Immediate
        scheduledAtDate = new Date();
      }

      jobsToInsert.push({
        organization_id: orgId,
        job_type: 'csv_email_dispatch',
        status: 'queued',
        priority: 100, // HIGH PRIORITY: user-initiated outreach dispatches take precedence
        scheduled_at: scheduledAtDate.toISOString(),
        payload: {
          batchId,
          recipientEmail: email,
          personalizedSubject,
          personalizedBodyText,
          personalizedBodyHtml,
          companyType,
          organizationId: orgId,
          idempotencyKey,
          cadence,
          scheduledFor: scheduledAtDate.toISOString(),
        },
        idempotency_key: idempotencyKey,
      });

      clientResults.push({
        email,
        status: 'queued',
        companyType,
        idempotencyKey,
        scheduledAt: scheduledAtDate.toISOString(),
      });
      queuedCount++;
    }

    // Persist durable background jobs into database
    if (jobsToInsert.length > 0) {
      const { error: insertErr } = await admin
        .from('background_jobs')
        .insert(jobsToInsert);

      if (insertErr) {
        console.error('Failed to enqueue durable CSV dispatch jobs:', insertErr);
        return NextResponse.json({ error: `Database error while enqueuing dispatch: ${insertErr.message}` }, { status: 500 });
      }

      // Automatically kick off initial queue processing immediately so ready emails dispatch without delay
      try {
        processBackgroundJobs(Math.min(jobsToInsert.length, 10)).catch((procErr) => {
          console.error('[dispatch] Background processor kickoff notice:', procErr);
        });
      } catch {}
    }

    // Record audit event
    try {
      await admin.from('audit_events').insert({
        organization_id: orgId,
        event_type: 'CSV_OUTREACH_DISPATCH_QUEUED',
        entity_type: 'campaigns',
        details: {
          batchId,
          totalRecipients: recipients.length,
          queuedCount,
          skippedCount,
          failedCount,
          operatorId: userCtx.userId,
        },
      });
    } catch {}

    // Return HTTP 202 Accepted
    return NextResponse.json(
      {
        success: true,
        status: 'queued',
        batchId,
        summary: {
          total: recipients.length,
          queued: queuedCount,
          skipped: skippedCount,
          sent: 0,
          suppressed: 0,
          failed: failedCount,
        },
        results: clientResults,
      },
      { status: 202 }
    );
  } catch (err: any) {
    const status = err.statusCode || (err.message?.includes('Unauthenticated') ? 401 : err.message?.includes('Unauthorized') ? 403 : 500);
    return NextResponse.json({ error: err.message || 'Dispatch error' }, { status });
  }
}
