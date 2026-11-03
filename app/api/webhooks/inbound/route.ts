// Evee - Inbound Email Webhook Handler (Fail-Closed Cryptographic Verification)
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { dispatchHotLeadAlert } from '@/lib/notifications/dispatcher';
import { verifyInboundWebhook } from '@/lib/compliance/webhooks';
import { normalizeEmail } from '@/lib/compliance/suppression';

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();

    // 1. Fail-closed: Inbound webhook secret MUST be configured
    const webhookSecret = process.env.INBOUND_WEBHOOK_SECRET;
    if (!webhookSecret || webhookSecret.trim() === '') {
      return NextResponse.json(
        { error: 'Webhook misconfigured: INBOUND_WEBHOOK_SECRET is not configured on the server.' },
        { status: 500 }
      );
    }

    // 2. Authenticate inbound webhook credentials
    const signature = req.headers.get('x-webhook-signature') || req.headers.get('x-inbound-signature');
    const secretToken = req.headers.get('x-webhook-secret');

    const isValid = verifyInboundWebhook(rawBody, { signature, secretToken }, webhookSecret);
    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid or missing inbound webhook credentials' },
        { status: 401 }
      );
    }

    let payload: any;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: 'Malformed JSON payload' }, { status: 400 });
    }

    const fromAddress = payload.from || payload.sender || payload.from_email || '';
    const subject = payload.subject || '';
    const textBody = payload.text || payload.body || payload.html || '';

    if (!fromAddress) {
      return NextResponse.json({ error: 'Missing sender address' }, { status: 400 });
    }

    const rawEmail = fromAddress.match(/<([^>]+)>/)?.[1] || fromAddress.trim();
    const cleanEmail = normalizeEmail(rawEmail);

    // Analyze reply sentiment
    let sentiment: 'INTERESTED' | 'NOT_INTERESTED' | 'UNSUBSCRIBE' | 'OUT_OF_OFFICE' | 'NEUTRAL' = 'NEUTRAL';
    let rationale = '';

    const lower = (textBody + ' ' + subject).toLowerCase();

    // Robust rule-based sentiment classifier with high precision
    if (
      lower.includes('unsubscribe') ||
      lower.includes('remove me') ||
      lower.includes('stop emailing') ||
      lower.includes('opt out') ||
      lower.includes('take me off')
    ) {
      sentiment = 'UNSUBSCRIBE';
      rationale = 'Prospect requested unsubscription or removal from list.';
    } else if (
      lower.includes('out of office') ||
      lower.includes('auto-reply') ||
      lower.includes('on leave') ||
      lower.includes('away from my desk') ||
      lower.includes('vacation')
    ) {
      sentiment = 'OUT_OF_OFFICE';
      rationale = 'Automated absence or vacation autoreply detected.';
    } else if (
      lower.includes('not interested') ||
      lower.includes('no thanks') ||
      lower.includes('not looking') ||
      lower.includes('we already have') ||
      lower.includes('pass on this')
    ) {
      sentiment = 'NOT_INTERESTED';
      rationale = 'Prospect explicitly declined the offer.';
    } else if (
      lower.includes('interested') ||
      lower.includes('tell me more') ||
      lower.includes('pricing') ||
      lower.includes('call me') ||
      lower.includes('schedule') ||
      lower.includes('sounds good') ||
      lower.includes('send details') ||
      lower.includes('meeting')
    ) {
      sentiment = 'INTERESTED';
      rationale = 'High interest detected; prospect requested further discussion or pricing.';
    } else {
      sentiment = 'NEUTRAL';
      rationale = 'Generic response; queued for operator review.';
    }

    const supabase = createAdminClient();

    // Find matching business if exists to link organization and business IDs
    let businessName: string | undefined;
    let businessId: string | null = null;
    let organizationId: string | null = null;

    try {
      const { data: business } = await supabase
        .from('businesses')
        .select('id, organization_id, display_name')
        .ilike('general_business_email', cleanEmail)
        .maybeSingle();

      if (business) {
        businessName = business.display_name;
        businessId = business.id;
        organizationId = business.organization_id || null;
      }
    } catch {}

    // Auto-suppress if UNSUBSCRIBE or NOT_INTERESTED into suppression_entries
    if (sentiment === 'UNSUBSCRIBE' || sentiment === 'NOT_INTERESTED') {
      try {
        await supabase.from('suppression_entries').insert({
          normalized_email: cleanEmail,
          reason: 'opt_out',
          source: 'inbound_reply',
          channel: 'email',
          business_id: businessId,
          organization_id: organizationId,
        });
      } catch (err) {
        console.warn('Failed to insert opt-out into suppression_entries:', err);
      }
    }

    // Trigger instant Slack / Discord / Zapier alerts for Hot Leads
    if (sentiment === 'INTERESTED') {
      try {
        await dispatchHotLeadAlert({
          prospectEmail: cleanEmail,
          businessName,
          sentiment,
          subject,
          replySnippet: textBody,
          rationale,
        });
      } catch (alertErr) {
        console.warn('Hot lead alert dispatch failed:', alertErr);
      }
    }

    // Record audit event
    try {
      await supabase.from('audit_events').insert({
        event_type: `INBOUND_REPLY_${sentiment}`,
        entity_type: 'inbound_replies',
        organization_id: organizationId,
        details: {
          sender: cleanEmail,
          businessName,
          subject,
          sentiment,
          rationale,
        },
      });
    } catch {}

    return NextResponse.json({
      status: 'processed',
      sender: cleanEmail,
      sentiment,
      rationale,
      actionTaken:
        sentiment === 'UNSUBSCRIBE' || sentiment === 'NOT_INTERESTED'
          ? 'SUPPRESSED_FROM_FUTURE_OUTREACH'
          : sentiment === 'INTERESTED'
          ? 'FLAGGED_HOT_LEAD'
          : 'LOGGED',
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
