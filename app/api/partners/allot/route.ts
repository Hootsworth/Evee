// Evee - Lead Allotment API
// Handles allotting and unallotting prospect businesses to partners.

import { NextRequest, NextResponse } from 'next/server';
import { allotLeadsToPartner, getAllotments, getAllPartners } from '@/lib/services/partner-store';
import { getUserContext } from '@/lib/auth/context';
import { assertAuthenticated } from '@/lib/auth/rbac';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET() {
  try {
    const userCtx = await getUserContext();
    assertAuthenticated(userCtx);

    const orgId = userCtx.organizationId;
    const [allotments, partners] = await Promise.all([
      getAllotments(orgId),
      getAllPartners(orgId),
    ]);

    const partnerMap = new Map<string, string>();
    for (const p of partners) {
      partnerMap.set(p.id, p.name);
    }

    const enrichedAllotments: Record<string, any> = {};
    for (const [bizId, assignment] of Object.entries(allotments)) {
      enrichedAllotments[bizId] = {
        ...assignment,
        partnerName: partnerMap.get(assignment.partnerId) || 'Unknown Partner',
      };
    }

    return NextResponse.json({
      success: true,
      allotments: enrichedAllotments,
      totalAllotted: Object.keys(allotments).length,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const userCtx = await getUserContext();
    assertAuthenticated(userCtx);

    const body = await req.json();
    const { businessIds, partnerId } = body;

    if (!Array.isArray(businessIds) || businessIds.length === 0 || businessIds.some((id: unknown) => typeof id !== 'string')) {
      return NextResponse.json({ error: 'businessIds array is required' }, { status: 400 });
    }
    const uniqueBusinessIds = [...new Set(businessIds as string[])];

    const orgId = userCtx.organizationId;
    const admin = createAdminClient();
    const { data: ownedBusinesses, error: businessError } = await admin
      .from('businesses')
      .select('id')
      .eq('organization_id', orgId)
      .in('id', uniqueBusinessIds);
    if (businessError) return NextResponse.json({ error: businessError.message }, { status: 500 });
    const ownedIds = new Set((ownedBusinesses || []).map((business) => business.id));
    if (ownedIds.size !== uniqueBusinessIds.length) {
      return NextResponse.json({ error: 'One or more accounts are outside your organization.' }, { status: 403 });
    }

    const [partners, previousAllotments] = await Promise.all([
      getAllPartners(orgId),
      getAllotments(orgId),
    ]);
    const selectedPartner = partnerId ? partners.find((partner) => partner.id === partnerId) : null;
    if (partnerId && !selectedPartner) {
      return NextResponse.json({ error: 'Partner not found in this organization.' }, { status: 404 });
    }

    const result = await allotLeadsToPartner(
      uniqueBusinessIds,
      partnerId || null,
      userCtx.displayName || 'Admin',
      orgId
    );

    const auditRows = uniqueBusinessIds.map((businessId: string) => {
      const previousPartnerId = previousAllotments[businessId]?.partnerId;
      const previousPartner = partners.find((partner) => partner.id === previousPartnerId);
      return {
        organization_id: orgId,
        event_type: partnerId ? 'LEAD_ASSIGNED' : 'LEAD_UNASSIGNED',
        entity_type: 'businesses',
        entity_id: businessId,
        details: {
          partnerId: partnerId || previousPartnerId || null,
          partnerName: selectedPartner?.name || previousPartner?.name || null,
          actorName: userCtx.displayName || 'Admin',
        },
      };
    });
    const { error: auditError } = await admin.from('audit_events').insert(auditRows);
    if (auditError) console.warn('[partners/allot] Could not record assignment activity:', auditError.message);

    return NextResponse.json({
      success: true,
      allottedCount: result.allottedCount,
      partnerId: partnerId || null,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
