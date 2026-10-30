// Evee - Send Verification Test Email to Operator
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { replaceTemplateVariables } from '@/lib/csv/parser';
import { sendEmailWithSafetyChecks } from '@/lib/providers/email/sender';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: authData } = await supabase.auth.getUser();

    const body = await req.json();
    const { template, sampleProspect, mapping, recipientOverride } = body;

    // Operator email priority: override -> authenticated user email -> configured fallback
    const operatorEmail = recipientOverride || authData?.user?.email;

    if (!operatorEmail) {
      return NextResponse.json(
        { error: 'Could not determine operator email. Please sign in or specify an email address.' },
        { status: 400 }
      );
    }

    if (!template?.subject || !template?.bodyText) {
      return NextResponse.json(
        { error: 'Template subject and body text are required.' },
        { status: 400 }
      );
    }

    // Replace variables using the sample prospect data
    const personalizedSubject = `[TEST EMAIL] ${replaceTemplateVariables(template.subject, sampleProspect || {}, mapping)}`;
    
    const banner = `------------------------------------------------------------\n⚠️ [EVEE AI TEST EMAIL PREVIEW]\nThis test was dispatched to verify formatting and variable rendering before bulk send.\nSample Recipient: ${sampleProspect?.email || 'sample@prospect.com'} | Company: ${sampleProspect?.company_name || sampleProspect?.company || 'Sample Company'}\n------------------------------------------------------------\n\n`;
    
    const personalizedBodyText = banner + replaceTemplateVariables(template.bodyText, sampleProspect || {}, mapping);

    const result = await sendEmailWithSafetyChecks({
      to: operatorEmail,
      subject: personalizedSubject,
      bodyText: personalizedBodyText,
      bodyHtml: template.bodyHtml ? `<div style="background:#fef2f2;border:1px solid #fecdd3;padding:12px;margin-bottom:16px;border-radius:6px;font-family:sans-serif;font-size:12px;color:#991b1b;"><strong>⚠️ [EVEE AI TEST EMAIL PREVIEW]</strong><br/>Dispatched to verify formatting before bulk broadcast.</div>${replaceTemplateVariables(template.bodyHtml, sampleProspect || {}, mapping)}` : undefined,
      isTestSend: true,
    });

    if (result.success) {
      return NextResponse.json({
        success: true,
        sentTo: operatorEmail,
        provider: result.provider,
        providerMessageId: result.providerMessageId,
        preview: {
          subject: personalizedSubject,
          bodyText: personalizedBodyText,
        },
      });
    } else {
      return NextResponse.json(
        {
          error: result.error || 'Failed to dispatch test email',
          provider: result.provider,
        },
        { status: 500 }
      );
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
