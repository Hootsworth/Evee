// Evee - Admin Partners API
// List and create partners with aggregated allotment stats.

import { NextRequest, NextResponse } from 'next/server';
import { getAllPartners, createPartner, getAllotments } from '@/lib/services/partner-store';
import { getUserContext } from '@/lib/auth/context';
import { assertAuthenticated } from '@/lib/auth/rbac';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET() {
  try {
    const userCtx = await getUserContext();
    assertAuthenticated(userCtx);

    const orgId = userCtx.organizationId;
    const [partners, allotments] = await Promise.all([
      getAllPartners(orgId),
      getAllotments(orgId),
    ]);

    // Calculate lead counts per partner
    const countsMap: Record<string, number> = {};
    for (const assignment of Object.values(allotments)) {
      countsMap[assignment.partnerId] = (countsMap[assignment.partnerId] || 0) + 1;
    }

    // Also fetch sent count per partner if outreach_messages or jobs record sender
    const admin = createAdminClient();
    const { data: sentMessages } = await admin
      .from('outreach_messages')
      .select('id, metadata')
      .eq('organization_id', orgId);

    const sentCountsMap: Record<string, number> = {};
    for (const msg of sentMessages || []) {
      const pId = (msg.metadata as any)?.partnerId;
      if (pId) {
        sentCountsMap[pId] = (sentCountsMap[pId] || 0) + 1;
      }
    }

    const enrichedPartners = partners.map((p) => ({
      ...p,
      allottedLeadsCount: countsMap[p.id] || 0,
      sentEmailsCount: sentCountsMap[p.id] || 0,
    }));

    return NextResponse.json({
      success: true,
      partners: enrichedPartners,
      totalPartners: partners.length,
      allotments,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to fetch partners' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const userCtx = await getUserContext();
    assertAuthenticated(userCtx);

    const body = await req.json();
    const { name, email, accessKey, role, notes } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Partner name is required' }, { status: 400 });
    }
    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Valid partner email is required' }, { status: 400 });
    }

    const orgId = userCtx.organizationId;
    const newPartner = await createPartner(
      {
        name,
        email,
        accessKey,
        role,
        notes,
      },
      orgId
    );

    return NextResponse.json({
      success: true,
      partner: newPartner,
      portalUrl: `/partner?key=${encodeURIComponent(newPartner.accessKey)}`,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to create partner' }, { status: 500 });
  }
}
