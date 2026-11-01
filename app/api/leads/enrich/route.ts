// Evee - Lead Enrichment Endpoint (Explorium & Multi-Tier Contact Discovery)
// Enriches single or batch leads with verified emails, executive names, and phone numbers

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getDynamicEnrichmentProvider } from '@/lib/providers/enrichment';
import { normalizeEmail } from '@/lib/compliance/suppression';
import { calculateLeadScore } from '@/lib/scoring/engine';
import { detectTechStack } from '@/lib/enrichment/tech-detector';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { businessId, businessIds, enrichAllMissing } = body as {
      businessId?: string;
      businessIds?: string[];
      enrichAllMissing?: boolean;
    };

    const admin = createAdminClient();

    // Determine target business IDs
    let targetIds: string[] = [];

    if (businessId) {
      targetIds = [businessId];
    } else if (Array.isArray(businessIds) && businessIds.length > 0) {
      targetIds = businessIds;
    } else if (enrichAllMissing) {
      // Find all active businesses without a verified general business email
      const { data: missing } = await admin
        .from('businesses')
        .select('id')
        .is('general_business_email', null)
        .limit(50);

      targetIds = (missing || []).map((b) => b.id);
    }

    if (targetIds.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No leads required enrichment.',
        enriched: [],
        summary: { total: 0, enriched: 0, notFound: 0 },
      });
    }

    const provider = await getDynamicEnrichmentProvider();
    const results: Array<{
      businessId: string;
      businessName: string;
      email?: string;
      contactName?: string;
      source: string;
      status: 'enriched' | 'already_has_email' | 'not_found';
    }> = [];

    let enrichedCount = 0;
    let notFoundCount = 0;

    for (const bId of targetIds) {
      const { data: business } = await admin
        .from('businesses')
        .select('*')
        .eq('id', bId)
        .maybeSingle();

      if (!business) continue;

      // Run enrichment
      const enrichedOutput = await provider.enrichBusiness({
        name: business.display_name,
        website: business.official_website_url,
        domain: business.canonical_domain,
        city: business.city,
        phone: business.public_business_phone,
        category: business.business_type,
      });

      const discoveredEmail = enrichedOutput.generalEmail || enrichedOutput.contacts[0]?.email;
      const primaryContact = enrichedOutput.contacts[0];

      if (discoveredEmail) {
        // 1. Update business if missing email or phone
        const updatePayload: Record<string, any> = {
          last_verified_at: new Date().toISOString(),
        };

        if (!business.general_business_email) {
          updatePayload.general_business_email = discoveredEmail;
        }
        if (!business.public_business_phone && enrichedOutput.phone) {
          updatePayload.public_business_phone = enrichedOutput.phone;
        }

        await admin.from('businesses').update(updatePayload).eq('id', bId);

        // 2. Insert discovered contacts into contacts table
        for (const contact of enrichedOutput.contacts) {
          const norm = normalizeEmail(contact.email);

          // Check if contact already exists
          const { data: existingContact } = await admin
            .from('contacts')
            .select('id')
            .eq('business_id', bId)
            .eq('email_normalized', norm)
            .maybeSingle();

          if (!existingContact) {
            await admin.from('contacts').insert({
              business_id: bId,
              contact_name: contact.fullName || `${business.display_name} Contact`,
              job_title: contact.jobTitle || 'Executive Contact',
              email_address: contact.email,
              email_normalized: norm,
              contact_channel: 'email',
              contact_type: contact.type,
              verification_status: contact.verificationStatus,
              contact_eligibility: 'eligible',
              consent_status: 'unknown',
              last_verified_at: new Date().toISOString(),
            });
          }
        }

        // Tech stack discovery & empirical evidence generation
        if (business.official_website_url) {
          try {
            const techResult = detectTechStack(
              `${business.display_name} ${business.business_type} ${business.official_website_url}`,
              business.official_website_url
            );
            for (const f of techResult.findings) {
              await admin.from('evidence_items').insert({
                business_id: bId,
                finding_type: f.type,
                claim_text: f.claim,
                confidence: 0.9,
                source_url: business.official_website_url,
                observed_at: new Date().toISOString(),
              });
            }
          } catch {}
        }

        // 3. Recalculate lead score with new contactability point
        const { data: evidence } = await admin
          .from('evidence_items')
          .select('*')
          .eq('business_id', bId);

        const scoreInput = {
          business: { ...business, ...updatePayload },
          evidence: evidence || [],
          contact: {
            id: 'temp',
            business_id: bId,
            contact_name: primaryContact?.fullName || null,
            job_title: primaryContact?.jobTitle || null,
            email_address: discoveredEmail,
            email_normalized: normalizeEmail(discoveredEmail),
            contact_channel: 'email' as const,
            contact_source_url: null,
            contact_type: primaryContact?.type || 'general_business',
            verification_status: primaryContact?.verificationStatus || 'provider_verified',
            contact_eligibility: 'eligible' as const,
            consent_status: 'unknown' as const,
            last_verified_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          servicesPromoted: ['Outreach & Inbound Booking Automation'],
        };

        const scoreRes = calculateLeadScore(scoreInput);

        await admin.from('lead_scores').upsert(
          {
            business_id: bId,
            score_version: '2.0-enriched',
            fit_score: scoreRes.fitScore,
            need_score: scoreRes.needScore,
            contactability_score: scoreRes.contactabilityScore,
            service_match_score: scoreRes.serviceMatchScore,
            evidence_confidence: scoreRes.evidenceConfidence,
            final_score: scoreRes.finalScore,
            reason_codes: scoreRes.reasonCodes,
          },
          { onConflict: 'business_id' }
        );

        enrichedCount++;
        results.push({
          businessId: bId,
          businessName: business.display_name,
          email: discoveredEmail,
          contactName: primaryContact?.fullName,
          source: primaryContact?.source || enrichedOutput.sourceProvider,
          status: 'enriched',
        });
      } else {
        notFoundCount++;
        results.push({
          businessId: bId,
          businessName: business.display_name,
          source: enrichedOutput.sourceProvider,
          status: 'not_found',
        });
      }
    }

    return NextResponse.json({
      success: true,
      provider: provider.name,
      enriched: results,
      summary: {
        total: targetIds.length,
        enriched: enrichedCount,
        notFound: notFoundCount,
      },
    });
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Lead enrichment route error:', error);
    return NextResponse.json({ error: error.message || 'Failed to enrich leads' }, { status: 500 });
  }
}
