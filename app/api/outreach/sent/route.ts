// Evee - Sent Outreach & Contacted Companies Registry (Tenant-Isolated)
// Returns all businesses, contacts, and email addresses that have already received outreach.
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getUserContext } from '@/lib/auth/context';
import { assertAuthenticated } from '@/lib/auth/rbac';

export async function GET(req: NextRequest) {
  try {
    const userCtx = await getUserContext();
    assertAuthenticated(userCtx);

    const admin = createAdminClient();
    const orgId = userCtx.organizationId;

    // 1. Fetch all completed or in-flight CSV email dispatch jobs
    const { data: jobs, error: jobsErr } = await admin
      .from('background_jobs')
      .select('id, status, payload, created_at, updated_at')
      .eq('organization_id', orgId)
      .eq('job_type', 'csv_email_dispatch')
      .in('status', ['succeeded', 'queued', 'running'])
      .order('updated_at', { ascending: false });

    if (jobsErr) {
      console.error('[outreach/sent] Error querying background_jobs:', jobsErr);
    }

    // 2. Fetch all completed or in-flight outreach messages
    const { data: messages, error: msgErr } = await admin
      .from('outreach_messages')
      .select(`
        id,
        business_id,
        contact_id,
        status,
        sent_at,
        created_at,
        businesses (id, display_name, general_business_email),
        contacts (id, email, contact_name),
        email_drafts (id, subject)
      `)
      .eq('organization_id', orgId)
      .in('status', ['sent', 'sending', 'queued'])
      .order('sent_at', { ascending: false });

    if (msgErr) {
      console.error('[outreach/sent] Error querying outreach_messages:', msgErr);
    }

    // 3. Build unified sent registry
    const sentEmailSet = new Set<string>();
    const sentBusinessIdSet = new Set<string>();
    const recordsMap = new Map<string, {
      id: string;
      email: string;
      companyName: string;
      subject: string;
      sentAt: string;
      status: 'sent' | 'succeeded' | 'queued';
      source: 'csv_dispatch' | 'workflow' | 'direct';
      businessId?: string;
    }>();

    // Process background jobs (CSV outreach)
    if (jobs) {
      for (const job of jobs) {
        const payload = job.payload || {};
        const email = (payload.recipientEmail || '').trim().toLowerCase();
        if (!email || !email.includes('@')) continue;

        sentEmailSet.add(email);
        const companyName = payload.companyName || payload.companyType || 'Prospect';
        const subject = payload.personalizedSubject || 'Direct Outreach';
        const sentAt = job.updated_at || job.created_at;

        // Keep the latest record for each email
        if (!recordsMap.has(email)) {
          recordsMap.set(email, {
            id: job.id,
            email,
            companyName,
            subject,
            sentAt,
            status: job.status as any,
            source: 'csv_dispatch',
          });
        }
      }
    }

    // Process outreach_messages (Workflow outreach)
    if (messages) {
      for (const msg of messages) {
        const biz = (msg as any).businesses;
        const contact = (msg as any).contacts;
        const draft = (msg as any).email_drafts;

        if (msg.business_id) {
          sentBusinessIdSet.add(msg.business_id);
        }

        const email = (contact?.email || biz?.general_business_email || '').trim().toLowerCase();
        if (email && email.includes('@')) {
          sentEmailSet.add(email);
          const companyName = biz?.display_name || 'Business Lead';
          const subject = draft?.subject || 'Outreach Campaign';
          const sentAt = msg.sent_at || msg.created_at;

          if (!recordsMap.has(email)) {
            recordsMap.set(email, {
              id: msg.id,
              email,
              companyName,
              subject,
              sentAt,
              status: msg.status === 'sent' ? 'sent' : 'queued',
              source: 'workflow',
              businessId: msg.business_id,
            });
          }
        }
      }
    }

    // Also match sent emails to businesses table to populate sentBusinessIdSet
    const allSentEmails = Array.from(sentEmailSet);
    if (allSentEmails.length > 0) {
      const { data: matchedBiz } = await admin
        .from('businesses')
        .select('id, general_business_email')
        .eq('organization_id', orgId);

      if (matchedBiz) {
        for (const b of matchedBiz) {
          const bizEmail = (b.general_business_email || '').trim().toLowerCase();
          if (bizEmail && sentEmailSet.has(bizEmail)) {
            sentBusinessIdSet.add(b.id);
            // Also enrich the recordsMap with businessId
            const rec = recordsMap.get(bizEmail);
            if (rec && !rec.businessId) {
              rec.businessId = b.id;
            }
          }
        }
      }
    }

    const records = Array.from(recordsMap.values()).sort(
      (a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime()
    );

    return NextResponse.json({
      success: true,
      sentEmails: allSentEmails,
      sentBusinessIds: Array.from(sentBusinessIdSet),
      records,
      totalSent: allSentEmails.length,
    });
  } catch (err: any) {
    const status = err.statusCode || (err.message?.includes('Unauthenticated') ? 401 : 500);
    return NextResponse.json({ error: err.message }, { status });
  }
}
