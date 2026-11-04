// Evee - Partner Sent Outreach Registry API
// Retrieves sent history specifically for partner's allotted leads.

import { NextRequest, NextResponse } from 'next/server';
import { resolvePartnerContext } from '@/lib/auth/partner-context';
import { getPartnerAllottedLeadIds } from '@/lib/services/partner-store';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(req: NextRequest) {
  try {
    const partner = await resolvePartnerContext(req);
    if (!partner) {
      return NextResponse.json({ error: 'Unauthenticated partner' }, { status: 401 });
    }

    const allottedIds = await getPartnerAllottedLeadIds(partner.id);
    const admin = createAdminClient();

    // Fetch messages where either metadata.partnerId === partner.id OR business_id in allottedIds
    const { data: messages } = await admin
      .from('outreach_messages')
      .select('id, business_id, recipient_email, subject, sent_at, delivery_status, metadata')
      .order('sent_at', { ascending: false });

    const partnerSentRecords = (messages || []).filter((m) => {
      const pId = (m.metadata as any)?.partnerId;
      if (pId === partner.id) return true;
      if (m.business_id && allottedIds.includes(m.business_id)) return true;
      return false;
    });

    const sentEmails = Array.from(new Set(partnerSentRecords.map((r) => r.recipient_email?.toLowerCase().trim()).filter(Boolean)));
    const sentBusinessIds = Array.from(new Set(partnerSentRecords.map((r) => r.business_id).filter(Boolean)));

    return NextResponse.json({
      success: true,
      sentRecords: partnerSentRecords,
      sentEmails,
      sentBusinessIds,
      totalSent: partnerSentRecords.length,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
