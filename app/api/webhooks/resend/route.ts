import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(req: Request) {
  try {
    const payload = await req.json();
    const eventType = payload.type || payload.event;
    const data = payload.data || {};

    const recipient = data.to?.[0] || data.email;
    const emailId = data.email_id || data.id;

    if (!eventType) {
      return NextResponse.json({ error: 'Missing event type' }, { status: 400 });
    }

    const supabase = createAdminClient();

    // 1. Hard Bounce Event: Auto-Suppress Email Address
    if (eventType === 'email.bounced') {
      const bounceReason = data.bounce_type || 'Hard bounce from provider';

      if (recipient) {
        try {
          await supabase.from('suppression_list').upsert(
            {
              email_address: recipient.toLowerCase(),
              reason: 'bounced',
              notes: `Auto-suppressed via Resend webhook: ${bounceReason}`,
              created_at: new Date().toISOString(),
            },
            { onConflict: 'email_address' }
          );
        } catch {
          // Graceful fallback if suppression table not available
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
          await supabase.from('suppression_list').upsert(
            {
              email_address: recipient.toLowerCase(),
              reason: 'spam_complaint',
              notes: 'Auto-suppressed via Resend webhook spam complaint.',
              created_at: new Date().toISOString(),
            },
            { onConflict: 'email_address' }
          );
        } catch {}
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
