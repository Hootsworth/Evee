import { NextRequest, NextResponse } from 'next/server';
import { resolvePartnerContext } from '@/lib/auth/partner-context';
import { getPartnerAllottedLeadIds } from '@/lib/services/partner-store';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(req: NextRequest) {
  try {
    const partner = await resolvePartnerContext(req);
    if (!partner) return NextResponse.json({ error: 'Unauthenticated partner' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const recordCount = Number(body.recordCount);
    if (!Number.isInteger(recordCount) || recordCount < 0 || recordCount > 100000) {
      return NextResponse.json({ error: 'recordCount must be a valid non-negative integer.' }, { status: 400 });
    }

    const allottedIds = await getPartnerAllottedLeadIds(partner.id, partner.organizationId);
    if (recordCount > allottedIds.length) {
      return NextResponse.json({ error: 'Export count exceeds the partner lead allotment.' }, { status: 400 });
    }

    if (partner.organizationId) {
      const admin = createAdminClient();
      const { error } = await admin.from('audit_events').insert({
        organization_id: partner.organizationId,
        event_type: 'CSV_EXPORT_CREATED',
        entity_type: 'csv_exports',
        entity_id: `partner_export_${Date.now()}`,
        details: { recordCount, scope: 'partner_allotment', actorName: partner.name, partnerId: partner.id },
      });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Could not record partner export.' }, { status: 500 });
  }
}
