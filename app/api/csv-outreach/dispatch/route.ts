// Evee - Bulk CSV Direct Outreach Dispatch Handler
// Iterates through parsed recipients, applies template variables, verifies suppression, and dispatches

import { NextRequest, NextResponse } from 'next/server';
import { replaceTemplateVariables } from '@/lib/csv/parser';
import { sendEmailWithSafetyChecks } from '@/lib/providers/email/sender';
import {
  classifyProspectBatchWithAi,
  applyAiAnalysisToProspect,
} from '@/lib/csv/classifier';
import { dispatchCampaignFinishedAlert } from '@/lib/notifications/dispatcher';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { template, recipients, mapping } = body;

    if (!template?.subject || !template?.bodyText) {
      return NextResponse.json({ error: 'Subject and body template are required.' }, { status: 400 });
    }

    if (!Array.isArray(recipients) || recipients.length === 0) {
      return NextResponse.json({ error: 'No recipients provided.' }, { status: 400 });
    }

    const emailCol = mapping?.email || 'email';
    const companyCol = mapping?.companyName || 'company_name';
    const websiteCol = mapping?.website || 'website';
    const cityCol = mapping?.city || 'city';

    // Ensure all recipients have AI company classification & adjustments applied
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

    const results: Array<{
      email: string;
      status: 'sent' | 'suppressed' | 'failed';
      companyType?: string;
      error?: string;
      providerMessageId?: string;
    }> = [];

    let sentCount = 0;
    let suppressedCount = 0;
    let failedCount = 0;

    for (const prospect of processedRecipients) {
      const email = (prospect[emailCol] || prospect.email || '').trim().toLowerCase();

      if (!email || !email.includes('@')) {
        results.push({ email: email || 'unknown', status: 'failed', error: 'Invalid email address' });
        failedCount++;
        continue;
      }

      const companyType = prospect.ai_company_type || prospect.company_type || 'General Business';
      const personalizedSubject = replaceTemplateVariables(template.subject, prospect, mapping);
      const personalizedBodyText = replaceTemplateVariables(template.bodyText, prospect, mapping);
      const personalizedBodyHtml = template.bodyHtml
        ? replaceTemplateVariables(template.bodyHtml, prospect, mapping)
        : undefined;

      const res = await sendEmailWithSafetyChecks({
        to: email,
        subject: personalizedSubject,
        bodyText: personalizedBodyText,
        bodyHtml: personalizedBodyHtml,
        isTestSend: false,
      });

      if (res.success) {
        sentCount++;
        results.push({ email, status: 'sent', companyType, providerMessageId: res.providerMessageId });
      } else if (res.suppressed) {
        suppressedCount++;
        results.push({ email, status: 'suppressed', companyType, error: res.error });
      } else {
        failedCount++;
        results.push({ email, status: 'failed', companyType, error: res.error });
      }
    }

    // Dispatch Slack / Discord alert on campaign completion
    try {
      const validRate = recipients.length > 0 ? `${Math.round((sentCount / recipients.length) * 100)}%` : '100%';
      await dispatchCampaignFinishedAlert({
        campaignName: template.subject,
        dispatchedCount: sentCount,
        validRate,
      });
    } catch {}

    return NextResponse.json({
      success: true,
      summary: {
        total: recipients.length,
        sent: sentCount,
        suppressed: suppressedCount,
        failed: failedCount,
      },
      results,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Dispatch error' }, { status: 500 });
  }
}
