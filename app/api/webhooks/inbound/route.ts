import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { dispatchHotLeadAlert } from '@/lib/notifications/dispatcher';

export async function POST(req: Request) {
  try {
    const payload = await req.json();

    const fromAddress = payload.from || payload.sender || payload.from_email || '';
    const subject = payload.subject || '';
    const textBody = payload.text || payload.body || payload.html || '';

    if (!fromAddress) {
      return NextResponse.json({ error: 'Missing sender address' }, { status: 400 });
    }

    const cleanEmail = fromAddress.match(/<([^>]+)>/)?.[1] || fromAddress.trim();

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

    // Find matching business if exists
    let businessName: string | undefined;
    try {
      const { data: business } = await supabase
        .from('businesses')
        .select('display_name')
        .ilike('general_business_email', cleanEmail)
        .maybeSingle();
      if (business) businessName = business.display_name;
    } catch {}

    // Auto-suppress if UNSUBSCRIBE or NOT_INTERESTED
    if (sentiment === 'UNSUBSCRIBE' || sentiment === 'NOT_INTERESTED') {
      try {
        await supabase.from('suppression_list').upsert(
          {
            email_address: cleanEmail.toLowerCase(),
            reason: sentiment === 'UNSUBSCRIBE' ? 'unsubscribed' : 'opt_out',
            notes: `Inbound reply classification: ${rationale}`,
            created_at: new Date().toISOString(),
          },
          { onConflict: 'email_address' }
        );
      } catch {}
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
