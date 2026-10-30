// Evee - Overview Reports & Dashboard Aggregates
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET() {
  const admin = createAdminClient();

  const [
    businessesRes,
    campaignsRes,
    draftsRes,
    messagesRes,
    suppressionRes,
    jobsRes,
  ] = await Promise.all([
    admin.from('businesses').select('id, record_status, created_at'),
    admin.from('campaigns').select('id, status, monthly_target'),
    admin.from('email_drafts').select('id, approval_status'),
    admin.from('outreach_messages').select('id, status, sent_at'),
    admin.from('suppression_entries').select('id'),
    admin.from('background_jobs').select('id, status, job_type'),
  ]);

  const businesses = businessesRes.data || [];
  const drafts = draftsRes.data || [];
  const messages = messagesRes.data || [];
  const jobs = jobsRes.data || [];

  const qualifiedLeadsCount = drafts.length; // leads that reached draft generation
  const monthlyTarget = 100;
  const targetProgress = Math.min(Math.round((qualifiedLeadsCount / monthlyTarget) * 100), 100);

  const pendingDrafts = drafts.filter((d) => d.approval_status === 'pending').length;
  const approvedDrafts = drafts.filter((d) => d.approval_status === 'approved').length;
  const sentMessages = messages.filter((m) => m.status === 'sent').length;
  const queuedMessages = messages.filter((m) => m.status === 'queued').length;
  const failedJobs = jobs.filter((j) => j.status === 'failed').length;
  const activeJobs = jobs.filter((j) => j.status === 'running' || j.status === 'queued').length;

  return NextResponse.json({
    metrics: {
      totalDiscovered: businesses.length,
      qualifiedLeadsMonth: qualifiedLeadsCount,
      monthlyTarget,
      targetProgressPercentage: targetProgress,
      pendingDrafts,
      approvedDrafts,
      sentEmails: sentMessages,
      queuedEmails: queuedMessages,
      suppressionCount: suppressionRes.data?.length || 0,
      activeJobs,
      failedJobs,
      estimatedCostInr: 0.0,
      monthlySpendCapInr: 0.0,
    },
    systemStatus: {
      automatedSending: process.env.ENABLE_AUTOMATED_SENDING === 'true',
      aiProvider: process.env.AI_PROVIDER || 'mock',
      discoveryProvider: process.env.DISCOVERY_PROVIDER || 'mock',
    },
  });
}
