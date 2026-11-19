// Evee - Partner Sent Outreach Registry API
// Retrieves sent history specifically for partner's allotted leads.

import { NextRequest, NextResponse } from 'next/server';
import { resolvePartnerContext } from '@/lib/auth/partner-context';
import { getPartnerAllottedLeadIds } from '@/lib/services/partner-store';
import { createAdminClient } from '@/lib/supabase/admin';
import type { PartnerOutreachHistoryResponse, PartnerOutreachRecord } from '@/lib/types';

export async function GET(req: NextRequest) {
  try {
    const partner = await resolvePartnerContext(req);
    if (!partner) {
      return NextResponse.json({ error: 'Unauthenticated partner' }, { status: 401 });
    }

    const allottedIds = await getPartnerAllottedLeadIds(partner.id, partner.organizationId);
    const admin = createAdminClient();

    // Fetch messages where either metadata.partnerId === partner.id OR business_id in allottedIds
    let messagesQuery = admin
      .from('outreach_messages')
      .select('id, business_id, recipient_email, subject, sent_at, delivery_status, metadata')
      .order('sent_at', { ascending: false });
    if (partner.organizationId) messagesQuery = messagesQuery.eq('organization_id', partner.organizationId);
    const { data: messages } = await messagesQuery;

    const partnerSentRecords = (messages || []).filter((m) => {
      const pId = (m.metadata as any)?.partnerId;
      if (pId === partner.id) return true;
      if (m.business_id && allottedIds.includes(m.business_id)) return true;
      return false;
    });

    const sentEmails = Array.from(new Set(partnerSentRecords.map((r) => r.recipient_email?.toLowerCase().trim()).filter(Boolean)));
    const sentBusinessIds = Array.from(new Set(partnerSentRecords.map((r) => r.business_id).filter(Boolean)));

    const typedRecords = partnerSentRecords as PartnerOutreachRecord[];
    const response: PartnerOutreachHistoryResponse = {
      success: true,
      messages: typedRecords,
      sentRecords: typedRecords,
      sentEmails,
      sentBusinessIds,
      totalSent: partnerSentRecords.length,
    };
    return NextResponse.json(response);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
