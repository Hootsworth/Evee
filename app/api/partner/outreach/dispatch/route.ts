// Evee - Partner Direct Outreach Dispatch Endpoint
// Handles bespoke 1-to-1 outreach for partner's allotted leads with cadence and deduplication.

import { NextRequest, NextResponse } from 'next/server';
import { resolvePartnerContext } from '@/lib/auth/partner-context';
import { getPartnerAllottedLeadIds } from '@/lib/services/partner-store';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendEmailWithSafetyChecks, isSuppressed } from '@/lib/providers/email/sender';
import { replaceTemplateVariables } from '@/lib/csv/parser';
import { normalizeEmail } from '@/lib/compliance/suppression';

export async function POST(req: NextRequest) {
  try {
    const partner = await resolvePartnerContext(req);
    if (!partner) {
      return NextResponse.json({ error: 'Unauthenticated partner' }, { status: 401 });
    }

    const body = await req.json();
    const { template, recipients, isTest, recipientOverride, cadence, skipPreviouslyContacted = true } = body;

    if (!template || !template.subject || !template.bodyText) {
      return NextResponse.json({ error: 'Template with subject and bodyText is required' }, { status: 400 });
    }

    // 1. If Test Send mode
    if (isTest) {
      const targetEmail = recipientOverride || partner.email;
      const sample = recipients?.[0] || {
        first_name: partner.name.split(' ')[0] || 'Partner',
        company_name: 'Sample Enterprise',
        city: 'Bengaluru',
        company_type: 'Commercial Services',
      };

      const renderedSubj = `[TEST FOR ${partner.name.toUpperCase()}] ` + replaceTemplateVariables(template.subject, sample);
      const renderedBody = replaceTemplateVariables(template.bodyText, sample) +
        `\n\n---\nDispatched from Evee Partner Portal (${partner.name} <${partner.email}>)`;

      const sendRes = await sendEmailWithSafetyChecks({
        to: targetEmail,
        subject: renderedSubj,
        bodyText: renderedBody,
        isTestSend: true,
        organizationId: partner.organizationId,
      });

      return NextResponse.json({
        success: sendRes.success,
        isTest: true,
        sentTo: targetEmail,
        providerMessageId: sendRes.providerMessageId,
        error: sendRes.error,
      });
    }

    // 2. Live Bulk Dispatch to Allotted Leads
    if (!Array.isArray(recipients) || recipients.length === 0) {
      return NextResponse.json({ error: 'Recipients array is required for live dispatch' }, { status: 400 });
    }

    const allottedIds = new Set(await getPartnerAllottedLeadIds(partner.id));
    const admin = createAdminClient();

    // Check sent emails to avoid duplicates
    const { data: previousSends } = await admin
      .from('outreach_messages')
      .select('recipient_email, business_id');

    const sentEmailsSet = new Set(
      (previousSends || []).map((s) => s.recipient_email?.toLowerCase().trim()).filter(Boolean)
    );
    const sentBizIdsSet = new Set(
      (previousSends || []).map((s) => s.business_id).filter(Boolean)
    );

    const results: any[] = [];
    let sentCount = 0;
    let skippedCount = 0;
    let failedCount = 0;

    for (const prospect of recipients) {
      const email = prospect.email || prospect.general_business_email;
      const bizId = prospect.id;

      if (!email || !email.includes('@')) {
        results.push({ email: 'None', status: 'skipped', reason: 'Missing email' });
        skippedCount++;
        continue;
      }

      const normEmail = normalizeEmail(email);

      // Verify lead is allotted to this partner
      if (bizId && !allottedIds.has(bizId)) {
        results.push({ email: normEmail, status: 'skipped', reason: 'Not allotted to this partner' });
        skippedCount++;
        continue;
      }

      // Check anti-duplicate protections
      if (skipPreviouslyContacted && (sentEmailsSet.has(normEmail) || (bizId && sentBizIdsSet.has(bizId)))) {
        results.push({ email: normEmail, status: 'skipped', reason: 'Previously contacted (Protected from duplicates)' });
        skippedCount++;
        continue;
      }

      // Check suppression list
      if (await isSuppressed({ email: normEmail }, partner.organizationId)) {
        results.push({ email: normEmail, status: 'suppressed', reason: 'Email is in suppression list' });
        skippedCount++;
        continue;
      }

      const renderedSubject = replaceTemplateVariables(template.subject, prospect);
      const renderedBody = replaceTemplateVariables(template.bodyText, prospect);

      try {
        const sendRes = await sendEmailWithSafetyChecks({
          to: normEmail,
          subject: renderedSubject,
          bodyText: renderedBody,
          organizationId: partner.organizationId,
        });

        if (sendRes.success) {
          // Record in outreach_messages with partner tag
          await admin.from('outreach_messages').insert({
            business_id: bizId || null,
            recipient_email: normEmail,
            subject: renderedSubject,
            body_text: renderedBody,
            delivery_status: 'succeeded',
            sent_at: new Date().toISOString(),
            metadata: {
              partnerId: partner.id,
              partnerName: partner.name,
              partnerEmail: partner.email,
              cadence: cadence || 'human',
            },
          });

          sentEmailsSet.add(normEmail);
          if (bizId) sentBizIdsSet.add(bizId);

          sentCount++;
          results.push({
            email: normEmail,
            company: prospect.company_name || prospect.display_name,
            status: 'succeeded',
            messageId: sendRes.providerMessageId,
          });
        } else {
          failedCount++;
          results.push({
            email: normEmail,
            status: 'failed',
            error: sendRes.error || 'Dispatch rejected by email provider',
          });
        }
      } catch (err: any) {
        failedCount++;
        results.push({
          email: normEmail,
          status: 'failed',
          error: err.message,
        });
      }
    }

    return NextResponse.json({
      success: true,
      summary: {
        total: recipients.length,
        sent: sentCount,
        skipped: skippedCount,
        failed: failedCount,
      },
      results,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
