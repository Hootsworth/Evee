// Evee - Overview Reports & Dashboard Aggregates (Tenant-Isolated)
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getUserContext } from '@/lib/auth/context';
import { assertAuthenticated } from '@/lib/auth/rbac';

export async function GET() {
  try {
    const userCtx = await getUserContext();
    assertAuthenticated(userCtx);

    const admin = createAdminClient();
    const orgId = userCtx.organizationId;

    const [
      businessesRes,
      campaignsRes,
      draftsRes,
      messagesRes,
      suppressionRes,
      jobsRes,
      credsRes,
    ] = await Promise.all([
      admin.from('businesses').select('id, record_status, created_at, general_business_email').eq('organization_id', orgId),
      admin.from('campaigns').select('id, status, monthly_target').eq('organization_id', orgId),
      admin.from('email_drafts').select('id, approval_status, business_id, created_at').eq('organization_id', orgId),
      admin.from('outreach_messages').select('id, status, sent_at, created_at, business_id').eq('organization_id', orgId),
      admin.from('suppression_entries').select('id').or(`organization_id.eq.${orgId},organization_id.is.null`),
      admin.from('background_jobs').select('id, status, job_type, payload, created_at, updated_at').eq('organization_id', orgId),
      admin.from('oauth_credentials').select('provider, account_email, encrypted_access_token, encrypted_refresh_token, scopes').eq('organization_id', orgId),
    ]);

    const businesses = businessesRes.data || [];
    const drafts = draftsRes.data || [];
    const messages = messagesRes.data || [];
    const jobs = jobsRes.data || [];
    const creds = credsRes.data || [];

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    // 1. Sent & Queued Emails (Aggregation of Direct CSV Outreach Jobs + Workflow Outreach Messages)
    const sentCsvJobs = jobs.filter(
      (j) => j.job_type === 'csv_email_dispatch' && j.status === 'succeeded'
    ).length;
    const sentWorkflowMessages = messages.filter((m) => m.status === 'sent').length;
    const totalSentEmails = sentWorkflowMessages + sentCsvJobs;

    const queuedCsvJobs = jobs.filter(
      (j) => j.job_type === 'csv_email_dispatch' && (j.status === 'queued' || j.status === 'running')
    ).length;
    const queuedWorkflowMessages = messages.filter(
      (m) => m.status === 'queued' || m.status === 'sending'
    ).length;
    const totalQueuedEmails = queuedWorkflowMessages + queuedCsvJobs;

    // 2. Monthly Target from Active Campaigns (default 100)
    const activeCampaigns = (campaignsRes.data || []).filter((c) => c.status !== 'archived');
    const monthlyTarget =
      activeCampaigns.length > 0 && activeCampaigns[0].monthly_target
        ? Number(activeCampaigns[0].monthly_target)
        : 100;

    // 3. Qualified Prospects This Month (Active prospects with verified email, drafts generated, or outreach dispatched this month)
    const activeBusinessesWithEmail = businesses.filter(
      (b) => b.record_status === 'active' && Boolean(b.general_business_email?.trim())
    );

    const qualifiedSet = new Set<string>();

    // Businesses created or active this month with verified email
    for (const b of activeBusinessesWithEmail) {
      if (b.created_at >= startOfMonth) {
        qualifiedSet.add(b.id);
      }
    }

    // Prospects engaged via direct CSV outreach this month
    for (const j of jobs) {
      if (
        j.job_type === 'csv_email_dispatch' &&
        (j.created_at >= startOfMonth || j.updated_at >= startOfMonth)
      ) {
        const email = (j.payload?.recipientEmail || '').trim().toLowerCase();
        if (email) qualifiedSet.add(email);
      }
    }

    // Prospects engaged via workflow outreach messages this month
    for (const m of messages) {
      if (m.sent_at >= startOfMonth || m.created_at >= startOfMonth) {
        if (m.business_id) qualifiedSet.add(m.business_id);
      }
    }

    // Prospects with AI drafts created this month
    for (const d of drafts) {
      if (d.created_at >= startOfMonth && d.business_id) {
        qualifiedSet.add(d.business_id);
      }
    }

    // Baseline qualified leads count: at least the active qualified contacts in the current pipeline
    const qualifiedLeadsCount = Math.max(
      qualifiedSet.size,
      activeBusinessesWithEmail.length
    );
    const targetProgress = Math.min(
      Math.round((qualifiedLeadsCount / monthlyTarget) * 100),
      100
    );

    const activeBusinessesCount = businesses.filter((b) => b.record_status === 'active').length;
    const archivedBusinessesCount = businesses.filter((b) => b.record_status === 'archived').length;

    const pendingDrafts = drafts.filter((d) => !d.approval_status || d.approval_status === 'pending').length;
    const approvedDrafts = drafts.filter((d) => d.approval_status === 'approved').length;
    const failedJobs = jobs.filter((j) => j.status === 'failed').length;
    const activeJobs = jobs.filter((j) => j.status === 'running' || j.status === 'queued').length;

    // Determine Discovery Provider status for this organization
    const placesCred = creds.find(
      (c) => c.provider === 'google_places_config' && c.encrypted_access_token
    );
    const placesEnvKey =
      process.env.DISCOVERY_API_KEY ||
      process.env.GOOGLE_PLACES_API_KEY ||
      process.env.GOOGLE_MAPS_API_KEY ||
      process.env.PLACES_API_KEY;

    let discoveryProvider = 'mock';
    if (placesCred || placesEnvKey) {
      discoveryProvider = 'google_places';
    } else if (process.env.DISCOVERY_PROVIDER && process.env.DISCOVERY_PROVIDER !== 'mock') {
      discoveryProvider = process.env.DISCOVERY_PROVIDER;
    }

    // Determine AI Provider status for this organization
    const aiCred = creds.find(
      (c) => c.provider === 'ai_provider_config' && c.encrypted_access_token
    );
    const aiEnvKey =
      process.env.AI_API_KEY ||
      process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_API_KEY ||
      process.env.OPENAI_API_KEY;

    let aiProviderName = 'mock';
    if (aiCred) {
      const meta = aiCred.scopes as any;
      const prov = meta?.provider || aiCred.account_email || 'gemini';
      const model = meta?.model || 'gemini-2.5-flash';
      aiProviderName = `${prov} (${model})`;
    } else if (aiEnvKey) {
      const prov = process.env.AI_PROVIDER || (process.env.OPENAI_API_KEY ? 'openai' : 'gemini');
      const model = process.env.AI_MODEL || (prov === 'openai' ? 'gpt-4o-mini' : 'gemini-2.5-flash');
      aiProviderName = `${prov} (${model})`;
    } else if (process.env.AI_PROVIDER && process.env.AI_PROVIDER !== 'mock') {
      aiProviderName = process.env.AI_PROVIDER;
    }

    // Determine Outbound Email Provider status for this organization
    const smtpCred = creds.find(
      (c) => c.provider === 'smtp_app_password' && c.encrypted_refresh_token
    );
    const googleOAuthCred = creds.find(
      (c) => c.provider === 'google' && c.encrypted_refresh_token
    );

    let emailProviderName = 'mock';
    if (smtpCred) {
      emailProviderName = `smtp (${smtpCred.account_email || 'configured'})`;
    } else if (googleOAuthCred) {
      emailProviderName = `gmail oauth (${googleOAuthCred.account_email || 'connected'})`;
    }

    return NextResponse.json({
      metrics: {
        totalDiscovered: businesses.length,
        activeLeads: activeBusinessesCount,
        archivedLeads: archivedBusinessesCount,
        qualifiedLeadsMonth: qualifiedLeadsCount,
        monthlyTarget,
        targetProgressPercentage: targetProgress,
        pendingDrafts,
        approvedDrafts,
        sentEmails: totalSentEmails,
        queuedEmails: totalQueuedEmails,
        suppressionCount: suppressionRes.data?.length || 0,
        activeJobs,
        failedJobs,
        estimatedCostInr: 0.0,
        monthlySpendCapInr: 0.0,
      },
      systemStatus: {
        automatedSending: process.env.ENABLE_AUTOMATED_SENDING === 'true',
        aiProvider: aiProviderName,
        discoveryProvider,
        emailProvider: emailProviderName,
        isAiConfigured: Boolean(aiCred || aiEnvKey),
        isDiscoveryConfigured: Boolean(placesCred || placesEnvKey),
        isEmailConfigured: Boolean(smtpCred || googleOAuthCred),
      },
    });
  } catch (err: any) {
    const status = err.statusCode || (err.message?.includes('Unauthenticated') ? 401 : 500);
    return NextResponse.json({ error: err.message }, { status });
  }
}
