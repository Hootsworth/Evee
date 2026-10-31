import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

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
