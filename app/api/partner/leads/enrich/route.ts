// Evee - Partner Lead AI Enrichment Endpoint
// Allows partners to discover and verify emails for their allotted leads via Gemini AI & Deep Web Crawling.

import { NextRequest, NextResponse } from 'next/server';
import { resolvePartnerContext } from '@/lib/auth/partner-context';
import { getPartnerAllottedLeadIds } from '@/lib/services/partner-store';
import { createAdminClient } from '@/lib/supabase/admin';
import { getDynamicEnrichmentProvider } from '@/lib/providers/enrichment';
import { normalizeEmail } from '@/lib/compliance/suppression';

export async function POST(req: NextRequest) {
  try {
    const partner = await resolvePartnerContext(req);
    if (!partner) {
      return NextResponse.json({ error: 'Unauthenticated partner' }, { status: 401 });
    }

    const body = await req.json();
    const { businessId, enrichAllMissing } = body;

    const allottedIds = await getPartnerAllottedLeadIds(partner.id);
    if (allottedIds.length === 0) {
      return NextResponse.json({ error: 'No leads allotted to your account' }, { status: 400 });
    }

    const admin = createAdminClient();
    let targetBusinesses: any[] = [];

    if (businessId) {
      if (!allottedIds.includes(businessId)) {
        return NextResponse.json({ error: 'Unauthorized: Lead not allotted to your account' }, { status: 403 });
      }
      const { data: b } = await admin
        .from('businesses')
        .select('id, display_name, official_website_url, city, general_business_email')
        .eq('id', businessId)
        .single();
      if (b) targetBusinesses.push(b);
    } else if (enrichAllMissing) {
      const { data: bList } = await admin
        .from('businesses')
        .select('id, display_name, official_website_url, city, general_business_email')
        .in('id', allottedIds)
        .is('general_business_email', null);
      targetBusinesses = bList || [];
    }

    if (targetBusinesses.length === 0) {
      return NextResponse.json({ message: 'No candidate leads require email enrichment', enriched: [] });
    }

    const provider = await getDynamicEnrichmentProvider(partner.organizationId);
    const results: any[] = [];
    let enrichedCount = 0;

    for (const b of targetBusinesses) {
      try {
        const enrichedOutput = await provider.enrichBusiness({
          name: b.display_name,
          website: b.official_website_url || undefined,
          city: b.city || undefined,
        });

        const discoveredEmail = enrichedOutput.generalEmail || enrichedOutput.contacts[0]?.email;
        const primaryContact = enrichedOutput.contacts[0];

        if (discoveredEmail && discoveredEmail.includes('@')) {
          const normEmail = normalizeEmail(discoveredEmail);

          await admin
            .from('businesses')
            .update({ general_business_email: normEmail })
            .eq('id', b.id);

          await admin.from('contacts').insert({
            business_id: b.id,
            contact_name: primaryContact?.fullName || `${b.display_name} Contact`,
            email_address: discoveredEmail,
            email_normalized: normEmail,
            contact_channel: 'email',
            contact_type: 'automated_research',
            verification_status: 'syntax_valid',
            contact_eligibility: 'eligible',
          });

          enrichedCount++;
          results.push({
            businessId: b.id,
            businessName: b.display_name,
            email: discoveredEmail,
            status: 'enriched',
            confidence: primaryContact?.confidence || 0.85,
          });
        } else {
          results.push({
            businessId: b.id,
            businessName: b.display_name,
            status: 'not_found',
          });
        }
      } catch (err: any) {
        results.push({
          businessId: b.id,
          businessName: b.display_name,
          status: 'error',
          error: err.message,
        });
      }
    }

    return NextResponse.json({
      success: true,
      enriched: results,
      summary: {
        totalTargeted: targetBusinesses.length,
        enriched: enrichedCount,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
