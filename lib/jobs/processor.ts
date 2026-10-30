// Evee - Background Job Dispatcher & Claim Service
// Aligned with ARCHITECTURE.MD Part H Section 18
// Durable PostgreSQL queue with atomic SKIP LOCKED claiming and Vercel Cron processing

import { createAdminClient } from '@/lib/supabase/admin';
import { BackgroundJob } from '@/lib/types';
import { getDynamicDiscoveryProvider } from '@/lib/providers/discovery';
import { getDynamicAiProvider } from '@/lib/providers/ai';
import { getEmailProvider } from '@/lib/providers/email';
import { decryptSecret } from '@/lib/compliance/encryption';
import { checkSuppression, normalizeEmail } from '@/lib/compliance/suppression';
import { calculateLeadScore } from '@/lib/scoring/engine';
import { inspectWebsite } from '@/lib/research/inspector';
import { findDuplicateBusiness, normalizeBusinessName, extractCanonicalDomain } from '@/lib/normalization/deduplication';

export interface JobProcessingResult {
  claimedJobs: number;
  succeeded: number;
  failed: number;
  errors: Array<{ jobId: string; error: string }>;
}

export async function processBackgroundJobs(batchSize = 5): Promise<JobProcessingResult> {
  const supabase = createAdminClient();
  const workerId = `vercel-worker-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

  // Claim batch using PostgreSQL SKIP LOCKED function or fallback query
  const { data: claimed, error: claimErr } = await supabase.rpc('claim_background_jobs', {
    p_worker_id: workerId,
    p_batch_size: batchSize,
    p_lock_timeout_seconds: 300,
  });

  const jobs: BackgroundJob[] = claimed || [];

  const summary: JobProcessingResult = {
    claimedJobs: jobs.length,
    succeeded: 0,
    failed: 0,
    errors: [],
  };

  for (const job of jobs) {
    try {
      await executeSingleJob(job, supabase);

      // Mark succeeded
      await supabase
        .from('background_jobs')
        .update({
          status: 'succeeded',
          locked_at: null,
          locked_by: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', job.id);

      summary.succeeded++;
    } catch (err: unknown) {
      const error = err as Error;
      summary.failed++;
      summary.errors.push({ jobId: job.id, error: error.message });

      const nextStatus = job.attempt_count + 1 >= job.max_attempts ? 'failed' : 'queued';

      await supabase
        .from('background_jobs')
        .update({
          status: nextStatus,
          last_error_code: 'JOB_EXECUTION_ERROR',
          last_error_summary: error.message.slice(0, 500),
          locked_at: null,
          locked_by: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', job.id);
    }
  }

  return summary;
}

async function executeSingleJob(job: BackgroundJob, supabase: any): Promise<void> {
  const payload = job.payload as any;

  switch (job.job_type) {
    case 'discover_businesses': {
      const { campaignId, geography, categories, keywords, limit } = payload;
      const provider = await getDynamicDiscoveryProvider();
      const candidates = await provider.search({
        geography: geography || 'Bengaluru',
        categories: categories || ['Small Business'],
        keywords: keywords || [],
        limit: limit || 10,
      });

      // Fetch existing businesses for deduplication
      const { data: existingBusinesses } = await supabase
        .from('businesses')
        .select('id, normalized_name, canonical_domain, city, public_business_phone');

      for (const cand of candidates) {
        const duplicate = findDuplicateBusiness(
          {
            name: cand.name,
            website: cand.officialWebsite,
            city: cand.city,
            phone: cand.publicPhone,
          },
          existingBusinesses || []
        );

        let businessId: string;

        if (duplicate) {
          businessId = duplicate.id;
        } else {
          // Insert new business
          const { data: inserted, error: insErr } = await supabase
            .from('businesses')
            .insert({
              normalized_name: normalizeBusinessName(cand.name),
              display_name: cand.name,
              business_type: cand.category || 'General',
              country_code: cand.countryCode || 'IN',
              region: cand.region || 'State',
              city: cand.city || geography,
              official_website_url: cand.officialWebsite || null,
              canonical_domain: extractCanonicalDomain(cand.officialWebsite),
              public_business_phone: cand.publicPhone || null,
              general_business_email: cand.publicContact || null,
              identity_confidence: 1.0,
            })
            .select()
            .single();

          if (insErr || !inserted) throw new Error(`Failed to insert business: ${insErr?.message}`);
          businessId = inserted.id;

          // Record source
          await supabase.from('business_sources').insert({
            business_id: businessId,
            provider_name: cand.provider,
            provider_record_id: cand.providerId || null,
            source_url: cand.sourceUrl || null,
            source_type: cand.provider === 'google_places' ? 'official_api' : 'directory',
          });

          // Insert contact if available
          if (cand.publicContact) {
            await supabase.from('contacts').insert({
              business_id: businessId,
              email_address: cand.publicContact,
              email_normalized: normalizeEmail(cand.publicContact),
              contact_channel: 'email',
              contact_type: 'general_business',
              contact_eligibility: 'eligible',
            });
          }
        }

        // Link to campaign if provided
        if (campaignId) {
          await supabase.from('campaign_businesses').upsert(
            {
              campaign_id: campaignId,
              business_id: businessId,
              discovery_status: 'discovered',
              qualification_status: 'pending',
            },
            { onConflict: 'campaign_id,business_id' }
          );

          // Enqueue research job automatically
          await supabase.from('background_jobs').insert({
            job_type: 'research_business',
            payload: { businessId, campaignId },
            idempotency_key: `research-${campaignId}-${businessId}`,
          });
        }
      }
      break;
    }

    case 'research_business': {
      const { businessId, campaignId } = payload;
      const { data: business } = await supabase.from('businesses').select('*').eq('id', businessId).single();
      if (!business) return;

      if (!business.official_website_url) {
        // Fallback evidence if website is missing
        await supabase.from('evidence_items').insert({
          business_id: businessId,
          source_url: 'none',
          source_type: 'directory_listing',
          finding_type: 'MISSING_OFFICIAL_WEBSITE',
          claim_text: 'No official website discovered for business; operates on local listings only.',
          confidence: 0.95,
          verification_status: 'verified',
        });
      } else {
        const inspection = await inspectWebsite(business.official_website_url, 5);

        // Store evidence items
        for (const ev of inspection.evidence) {
          await supabase.from('evidence_items').insert({
            business_id: businessId,
            source_url: ev.sourceUrl,
            source_type: 'website_inspection',
            finding_type: ev.findingType,
            claim_text: ev.claimText,
            supporting_excerpt: ev.supportingExcerpt || null,
            confidence: ev.confidence,
            verification_status: 'verified',
          });
        }

        // Update contacts if new email found
        if (inspection.contactEmail && !business.general_business_email) {
          await supabase.from('businesses').update({ general_business_email: inspection.contactEmail }).eq('id', businessId);
          await supabase.from('contacts').insert({
            business_id: businessId,
            email_address: inspection.contactEmail,
            email_normalized: normalizeEmail(inspection.contactEmail),
            contact_channel: 'email',
            contact_type: 'general_business',
            contact_eligibility: 'eligible',
          });
        }
      }

      // Next step: Score lead
      await supabase.from('background_jobs').insert({
        job_type: 'score_lead',
        payload: { businessId, campaignId },
        idempotency_key: `score-${campaignId}-${businessId}`,
      });
      break;
    }

    case 'score_lead': {
      const { businessId, campaignId } = payload;
      const { data: business } = await supabase.from('businesses').select('*').eq('id', businessId).single();
      const { data: evidence } = await supabase.from('evidence_items').select('*').eq('id', businessId);
      const { data: contact } = await supabase.from('contacts').select('*').eq('business_id', businessId).maybeSingle();
      const { data: suppressions } = await supabase.from('suppression_entries').select('*');

      const isSuppressed = checkSuppression(
        { email: contact?.email_address || business.general_business_email },
        suppressions || []
      ).isSuppressed;

      const scoreResult = calculateLeadScore({
        business,
        evidence: evidence || [],
        contact,
        servicesPromoted: ['Digital QR Menu', 'Online Booking Workflow', 'Mobile-Friendly Website', 'AI FAQ Assistant'],
        isSuppressed,
      });

      await supabase.from('lead_scores').insert({
        business_id: businessId,
        campaign_id: campaignId || null,
        fit_score: scoreResult.fitScore,
        need_score: scoreResult.needScore,
        contactability_score: scoreResult.contactabilityScore,
        service_match_score: scoreResult.serviceMatchScore,
        evidence_confidence: scoreResult.evidenceConfidence,
        final_score: scoreResult.finalScore,
        reason_codes: scoreResult.reasonCodes,
      });

      if (campaignId) {
        await supabase
          .from('campaign_businesses')
          .update({
            qualification_score: scoreResult.finalScore,
            qualification_status: scoreResult.qualificationStatus,
            discovery_status: 'scored',
          })
          .match({ campaign_id: campaignId, business_id: businessId });

        // If qualified, generate draft
        if (scoreResult.qualificationStatus === 'qualified') {
          await supabase.from('background_jobs').insert({
            job_type: 'generate_draft',
            payload: { businessId, campaignId },
            idempotency_key: `draft-${campaignId}-${businessId}`,
          });
        }
      }
      break;
    }

    case 'generate_draft': {
      const { businessId, campaignId } = payload;
      const { data: business } = await supabase.from('businesses').select('*').eq('id', businessId).single();
      const { data: evidence } = await supabase.from('evidence_items').select('*').eq('business_id', businessId);
      const { data: contact } = await supabase.from('contacts').select('*').eq('business_id', businessId).maybeSingle();

      const ai = await getDynamicAiProvider();
      const draftOutput = await ai.createEmailDraft(
        { name: business.display_name, category: business.business_type, city: business.city },
        evidence || [],
        'digital ordering & customer inquiry automation'
      );

      await supabase.from('email_drafts').insert({
        business_id: businessId,
        contact_id: contact?.id || null,
        campaign_id: campaignId || null,
        subject: draftOutput.subject,
        body_text: draftOutput.bodyText,
        body_html: draftOutput.bodyHtml || null,
        personalization_summary: draftOutput.personalizationSummary,
        evidence_item_ids: draftOutput.evidenceIds,
        model_provider: ai.name,
        model_name: 'gpt-4o-mini',
        prompt_version: 'v1',
        validation_status: 'valid',
        approval_status: 'pending', // MUST remain pending approval!
      });
      break;
    }

    case 'send_email': {
      const { messageId } = payload;
      const { data: message } = await supabase.from('outreach_messages').select('*').eq('id', messageId).single();
      if (!message || message.status !== 'queued') return;

      const { data: draft } = await supabase.from('email_drafts').select('*').eq('id', message.draft_id).single();
      const { data: contact } = await supabase.from('contacts').select('*').eq('id', message.contact_id).single();
      const { data: workflow } = await supabase.from('outreach_workflows').select('*').eq('id', message.workflow_id).single();
      const { data: suppressions } = await supabase.from('suppression_entries').select('*');

      // Safety check 1: Workflow must be approved and version match
      if (!workflow || workflow.status !== 'approved' || workflow.version !== message.workflow_version) {
        throw new Error('Outreach blocked: Workflow is not approved or version mismatch');
      }

      // Safety check 2: Draft must be approved
      if (!draft || draft.approval_status !== 'approved') {
        throw new Error('Outreach blocked: Draft has not received human approval');
      }

      // Safety check 3: Contact eligibility & suppression immediately before send
      const recipientEmail = contact?.email_address;
      if (!recipientEmail) throw new Error('Outreach blocked: Contact has no email address');

      const isSuppressed = checkSuppression({ email: recipientEmail }, suppressions || []).isSuppressed;
      if (isSuppressed) {
        await supabase.from('outreach_messages').update({ status: 'cancelled', failure_code: 'CONTACT_SUPPRESSED' }).eq('id', messageId);
        return;
      }

      // Mark sending
      await supabase.from('outreach_messages').update({ status: 'sending', attempted_at: new Date().toISOString() }).eq('id', messageId);

      // Retrieve credentials (prefer SMTP App Password, fallback to OAuth)
      const { data: smtpCreds } = await supabase
        .from('oauth_credentials')
        .select('*')
        .eq('provider', 'smtp_app_password')
        .maybeSingle();

      let emailProvider;

      if (smtpCreds && smtpCreds.encrypted_refresh_token) {
        const appPassword = decryptSecret(smtpCreds.encrypted_refresh_token);
        emailProvider = getEmailProvider({
          type: 'smtp',
          user: smtpCreds.account_email,
          pass: appPassword,
          host: smtpCreds.encrypted_access_token || 'smtp.gmail.com',
          port: Number(smtpCreds.scopes?.[0]) || 465,
        });
      } else {
        const { data: oauthCreds } = await supabase
          .from('oauth_credentials')
          .select('*')
          .eq('provider', 'google')
          .maybeSingle();

        if (oauthCreds?.encrypted_refresh_token) {
          const refreshToken = decryptSecret(oauthCreds.encrypted_refresh_token);
          emailProvider = getEmailProvider({ refreshToken });
        } else {
          emailProvider = getEmailProvider();
        }
      }

      const sendResult = await emailProvider.sendEmail({
        to: recipientEmail,
        subject: draft.subject,
        bodyText: draft.bodyText,
        idempotencyKey: message.idempotency_key,
      });

      if (sendResult.status === 'sent') {
        await supabase
          .from('outreach_messages')
          .update({
            status: 'sent',
            sent_at: new Date().toISOString(),
            provider_message_id: sendResult.providerMessageId,
          })
          .eq('id', messageId);

        // Schedule first follow-up task 4 days out
        const dueAt = new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString();
        await supabase.from('follow_up_tasks').insert({
          business_id: message.business_id,
          contact_id: message.contact_id,
          related_message_id: message.id,
          task_type: 'email_follow_up',
          due_at: dueAt,
          status: 'pending',
        });
      } else if (sendResult.status === 'unknown_outcome') {
        await supabase
          .from('outreach_messages')
          .update({
            status: 'unknown_outcome',
            failure_detail: sendResult.error,
          })
          .eq('id', messageId);
      } else {
        await supabase
          .from('outreach_messages')
          .update({
            status: 'failed',
            failure_code: 'DISPATCH_ERROR',
            failure_detail: sendResult.error,
          })
          .eq('id', messageId);
      }
      break;
    }

    default:
      throw new Error(`Unhandled job type: ${job.job_type}`);
  }
}
