// Evee - Bulk CSV Direct Outreach Dispatch Handler
// Iterates through parsed recipients, applies template variables, verifies suppression, and dispatches

import { NextRequest, NextResponse } from 'next/server';
import { replaceTemplateVariables } from '@/lib/csv/parser';
import { sendEmailWithSafetyChecks } from '@/lib/providers/email/sender';

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
    const results: Array<{
      email: string;
      status: 'sent' | 'suppressed' | 'failed';
      error?: string;
      providerMessageId?: string;
    }> = [];

    let sentCount = 0;
    let suppressedCount = 0;
    let failedCount = 0;

    for (const prospect of recipients) {
      const email = (prospect[emailCol] || prospect.email || '').trim().toLowerCase();

      if (!email || !email.includes('@')) {
        results.push({ email: email || 'unknown', status: 'failed', error: 'Invalid email address' });
        failedCount++;
        continue;
      }

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
        results.push({ email, status: 'sent', providerMessageId: res.providerMessageId });
      } else if (res.suppressed) {
        suppressedCount++;
        results.push({ email, status: 'suppressed', error: res.error });
      } else {
        failedCount++;
        results.push({ email, status: 'failed', error: res.error });
      }
    }

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
