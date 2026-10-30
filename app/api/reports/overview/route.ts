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
    credsRes,
  ] = await Promise.all([
    admin.from('businesses').select('id, record_status, created_at'),
    admin.from('campaigns').select('id, status, monthly_target'),
    admin.from('email_drafts').select('id, approval_status'),
    admin.from('outreach_messages').select('id, status, sent_at'),
    admin.from('suppression_entries').select('id'),
    admin.from('background_jobs').select('id, status, job_type'),
    admin.from('oauth_credentials').select('provider, account_email, encrypted_access_token, encrypted_refresh_token, scopes'),
  ]);

  const businesses = businessesRes.data || [];
  const drafts = draftsRes.data || [];
  const messages = messagesRes.data || [];
  const jobs = jobsRes.data || [];
  const creds = credsRes.data || [];

  const qualifiedLeadsCount = drafts.length; // leads that reached draft generation
  const monthlyTarget = 100;
  const targetProgress = Math.min(Math.round((qualifiedLeadsCount / monthlyTarget) * 100), 100);

  const pendingDrafts = drafts.filter((d) => d.approval_status === 'pending').length;
  const approvedDrafts = drafts.filter((d) => d.approval_status === 'approved').length;
  const sentMessages = messages.filter((m) => m.status === 'sent').length;
  const queuedMessages = messages.filter((m) => m.status === 'queued').length;
  const failedJobs = jobs.filter((j) => j.status === 'failed').length;
  const activeJobs = jobs.filter((j) => j.status === 'running' || j.status === 'queued').length;

  // Determine Discovery Provider status (Check DB stored credentials + Environment fallbacks)
  const placesCred = creds.find(
    (c) => c.provider === 'google_places_config' && c.encrypted_access_token
  );
  const placesEnvKey =
    process.env.DISCOVERY_API_KEY ||
    process.env.GOOGLE_PLACES_API_KEY ||
    process.env.GOOGLE_MAPS_API_KEY ||
    process.env.PLACES_API_KEY;

  let discoveryProvider = 'mock';
  if (placesCred) {
    discoveryProvider = 'google_places';
  } else if (placesEnvKey) {
    discoveryProvider = 'google_places';
  } else if (process.env.DISCOVERY_PROVIDER && process.env.DISCOVERY_PROVIDER !== 'mock') {
    discoveryProvider = process.env.DISCOVERY_PROVIDER;
  }

  // Determine AI Provider status (Check DB stored credentials + Environment fallbacks)
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

  // Determine Outbound Email Provider status (Check SMTP app password + Google OAuth)
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
      aiProvider: aiProviderName,
      discoveryProvider,
      emailProvider: emailProviderName,
      isAiConfigured: Boolean(aiCred || aiEnvKey),
      isDiscoveryConfigured: Boolean(placesCred || placesEnvKey),
      isEmailConfigured: Boolean(smtpCred || googleOAuthCred),
    },
  });
}
