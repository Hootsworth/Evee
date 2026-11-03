// Evee - Resend Webhook Handler (Fail-Closed Cryptographic Verification)
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifyResendWebhookSignature } from '@/lib/compliance/webhooks';
import { normalizeEmail } from '@/lib/compliance/suppression';

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();

    // 1. Fail-closed: Webhook secret MUST be configured
    const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;
    if (!webhookSecret || webhookSecret.trim() === '') {
      return NextResponse.json(
        { error: 'Webhook misconfigured: RESEND_WEBHOOK_SECRET is not configured on the server.' },
        { status: 500 }
      );
    }

    // 2. Verify Svix cryptographic signature
    const svixId = req.headers.get('svix-id');
    const svixTimestamp = req.headers.get('svix-timestamp');
    const svixSignature = req.headers.get('svix-signature');

    const isValid = verifyResendWebhookSignature(
      rawBody,
      {
        id: svixId,
        timestamp: svixTimestamp,
        signature: svixSignature,
      },
      webhookSecret
    );

    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid or missing Svix webhook signature' },
        { status: 401 }
      );
    }

    let payload: any;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: 'Malformed JSON payload' }, { status: 400 });
    }

    const eventType = payload.type || payload.event;
    const data = payload.data || {};

    const rawRecipient = data.to?.[0] || data.email;
    const recipient = rawRecipient ? normalizeEmail(rawRecipient) : null;
    const emailId = data.email_id || data.id;

    if (!eventType) {
      return NextResponse.json({ error: 'Missing event type' }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Identify tenant organization if linked to an existing outreach job
    let orgId: string | null = null;
    let businessId: string | null = null;

    if (emailId) {
      try {
        const { data: job } = await supabase
          .from('outreach_jobs')
          .select('organization_id, business_id')
          .eq('provider_message_id', emailId)
          .maybeSingle();

        if (job) {
          orgId = job.organization_id || null;
          businessId = job.business_id || null;
        }
      } catch {
        // Continue if lookup fails
      }
    }

    // 1. Hard Bounce Event: Auto-Suppress Email Address
    if (eventType === 'email.bounced') {
      const bounceReason = data.bounce_type || 'Hard bounce from provider';

      if (recipient) {
        try {
          await supabase.from('suppression_entries').insert({
            normalized_email: recipient,
            reason: 'hard_bounce',
            source: 'resend_webhook',
            channel: 'email',
            organization_id: orgId,
            business_id: businessId,
          });
        } catch (supErr) {
          console.warn('Failed to insert hard bounce into suppression_entries:', supErr);
        }
      }

      // Update outreach job status to failed
      if (emailId) {
        try {
          await supabase
            .from('outreach_jobs')
            .update({
              status: 'failed',
              last_error: `Email bounced: ${bounceReason}`,
              updated_at: new Date().toISOString(),
            })
            .eq('provider_message_id', emailId);
        } catch {}
      }

      return NextResponse.json({
        status: 'suppressed',
        message: `Recipient ${recipient} suppressed due to bounce.`,
      });
    }

    // 2. Spam Complaint: Immediate Mandatory Auto-Suppression
    if (eventType === 'email.complained') {
      if (recipient) {
        try {
          await supabase.from('suppression_entries').insert({
            normalized_email: recipient,
            reason: 'complaint',
            source: 'resend_webhook',
            channel: 'email',
            organization_id: orgId,
            business_id: businessId,
          });
        } catch (supErr) {
          console.warn('Failed to insert spam complaint into suppression_entries:', supErr);
        }
      }

      return NextResponse.json({
        status: 'suppressed',
        message: `Recipient ${recipient} suppressed due to spam complaint.`,
      });
    }

    // 3. Delivery Confirmation
    if (eventType === 'email.delivered') {
      if (emailId) {
        try {
          await supabase
            .from('outreach_jobs')
            .update({
              status: 'succeeded',
              delivered_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('provider_message_id', emailId);
        } catch {}
      }

      return NextResponse.json({ status: 'delivered', id: emailId });
    }

    // 4. Open / Click Engagement Telemetry
    if (eventType === 'email.opened' || eventType === 'email.clicked') {
      return NextResponse.json({ status: 'tracked', event: eventType });
    }

    return NextResponse.json({ status: 'received', event: eventType });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
