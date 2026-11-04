// Evee - Lead Allotment API
// Handles allotting and unallotting prospect businesses to partners.

import { NextRequest, NextResponse } from 'next/server';
import { allotLeadsToPartner, getAllotments, getAllPartners } from '@/lib/services/partner-store';
import { getUserContext } from '@/lib/auth/context';
import { assertAuthenticated } from '@/lib/auth/rbac';

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

    if (!Array.isArray(businessIds) || businessIds.length === 0) {
      return NextResponse.json({ error: 'businessIds array is required' }, { status: 400 });
    }

    const orgId = userCtx.organizationId;
    const result = await allotLeadsToPartner(
      businessIds,
      partnerId || null,
      userCtx.displayName || 'Admin',
      orgId
    );

    return NextResponse.json({
      success: true,
      allottedCount: result.allottedCount,
      partnerId: partnerId || null,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
