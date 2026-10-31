// Evee - CSV Leads Import Endpoint
// Ingests CSV leads into the database with deduplication, contact creation, and optional auto-enrichment

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { CsvColumnMapping } from '@/lib/csv/parser';
import {
  normalizeBusinessName,
  extractCanonicalDomain,
  findDuplicateBusiness,
} from '@/lib/normalization/deduplication';
import { normalizeEmail } from '@/lib/compliance/suppression';
import { calculateLeadScore } from '@/lib/scoring/engine';
import { getDynamicEnrichmentProvider } from '@/lib/providers/enrichment';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { leads, mapping, autoEnrich } = body as {
      leads: Array<Record<string, any>>;
      mapping?: CsvColumnMapping;
      autoEnrich?: boolean;
    };

    if (!Array.isArray(leads) || leads.length === 0) {
      return NextResponse.json({ error: 'No leads provided in import payload.' }, { status: 400 });
    }

    const admin = createAdminClient();

    // Fetch existing businesses for deduplication
    const { data: existingBusinesses } = await admin
      .from('businesses')
      .select('id, normalized_name, canonical_domain, city, public_business_phone');

    const companyCol = mapping?.companyName || 'company_name';
    const websiteCol = mapping?.website || 'website';
    const emailCol = mapping?.email || 'email';
    const contactCol = mapping?.firstName || mapping?.name || 'name';
    const phoneCol = mapping?.phone || 'phone';
    const cityCol = mapping?.city || 'city';
    const categoryCol = mapping?.category || 'category';

    let importedCount = 0;
    let duplicateCount = 0;
    const insertedIdsForEnrichment: string[] = [];

    for (const row of leads) {
      const name =
        row[companyCol] ||
        row.company_name ||
        row.company ||
        row.business_name ||
        row.business ||
        '';

      if (!name || !name.trim()) continue;

      const website = row[websiteCol] || row.website || row.url || '';
      const email = row[emailCol] || row.email || row.mail || '';
      const contactName =
        row[contactCol] ||
        [row.first_name || row.firstName, row.last_name || row.lastName].filter(Boolean).join(' ') ||
        '';
      const phone = row[phoneCol] || row.phone || row.mobile || '';
      const city = row[cityCol] || row.city || row.location || 'Bengaluru';
      const category = row[categoryCol] || row.category || row.industry || 'Small Business';

      const duplicate = findDuplicateBusiness(
        {
          name,
          website: website || undefined,
          city,
          phone: phone || undefined,
        },
        existingBusinesses || []
      );

      if (duplicate) {
        duplicateCount++;
        // If existing record has no email but imported row has email, backfill it
        if (email && email.includes('@')) {
          const normEmail = normalizeEmail(email);
          await admin
            .from('businesses')
            .update({ general_business_email: normEmail })
            .eq('id', duplicate.id)
            .is('general_business_email', null);

          const { data: hasContact } = await admin
            .from('contacts')
            .select('id')
            .eq('business_id', duplicate.id)
            .eq('email_normalized', normEmail)
            .maybeSingle();

          if (!hasContact) {
            await admin.from('contacts').insert({
              business_id: duplicate.id,
              contact_name: contactName || `${name} Contact`,
              email_address: email,
              email_normalized: normEmail,
              contact_channel: 'email',
              contact_type: 'user_provided',
              verification_status: 'syntax_valid',
              contact_eligibility: 'eligible',
            });
          }
        }
        continue;
      }

      // Insert new business
      const canonicalDomain = extractCanonicalDomain(website);
      const { data: newBusiness, error: insErr } = await admin
        .from('businesses')
        .insert({
          normalized_name: normalizeBusinessName(name),
          display_name: name.trim(),
          business_type: category.trim(),
          country_code: 'IN',
          region: 'Karnataka',
          city: city.trim(),
          official_website_url: website.trim() || null,
          canonical_domain: canonicalDomain,
          public_business_phone: phone.trim() || null,
          general_business_email: email && email.includes('@') ? normalizeEmail(email) : null,
          identity_confidence: 1.0,
          record_status: 'active',
        })
        .select()
        .single();

      if (insErr || !newBusiness) {
        console.error('Failed to insert lead business:', insErr);
        continue;
      }

      importedCount++;

      // Insert contact if available
      if (email && email.includes('@')) {
        await admin.from('contacts').insert({
          business_id: newBusiness.id,
          contact_name: contactName || `${name} Contact`,
          email_address: email,
          email_normalized: normalizeEmail(email),
          contact_channel: 'email',
          contact_type: 'user_provided',
          verification_status: 'syntax_valid',
          contact_eligibility: 'eligible',
        });
      } else if (autoEnrich) {
        // Tag for auto-enrichment if no email was present
        insertedIdsForEnrichment.push(newBusiness.id);
      }

      // Initial baseline score
      const scoreRes = calculateLeadScore({
        business: newBusiness,
        evidence: [],
        contact: email ? {
          id: 'temp',
          business_id: newBusiness.id,
          contact_name: contactName || null,
          job_title: null,
          email_address: email,
          email_normalized: normalizeEmail(email),
          contact_channel: 'email',
          contact_source_url: null,
          contact_type: 'user_provided',
          verification_status: 'syntax_valid',
          contact_eligibility: 'eligible',
          consent_status: 'unknown',
          last_verified_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } : null,
        servicesPromoted: ['Outreach Automation'],
      });

      await admin.from('lead_scores').insert({
        business_id: newBusiness.id,
        score_version: '2.0-imported',
        fit_score: scoreRes.fitScore,
        need_score: scoreRes.needScore,
        contactability_score: scoreRes.contactabilityScore,
        service_match_score: scoreRes.serviceMatchScore,
        evidence_confidence: scoreRes.evidenceConfidence,
        final_score: scoreRes.finalScore,
        reason_codes: scoreRes.reasonCodes,
      });
    }

    // Auto-enrich missing emails if requested
    let enrichedCount = 0;
    if (autoEnrich && insertedIdsForEnrichment.length > 0) {
      const provider = await getDynamicEnrichmentProvider();
      for (const bId of insertedIdsForEnrichment.slice(0, 20)) {
        const { data: b } = await admin.from('businesses').select('*').eq('id', bId).single();
        if (b) {
          const res = await provider.enrichBusiness({
            name: b.display_name,
            website: b.official_website_url,
            domain: b.canonical_domain,
            city: b.city,
            category: b.business_type,
          });

          if (res.generalEmail) {
            await admin.from('businesses').update({ general_business_email: res.generalEmail }).eq('id', bId);
            await admin.from('contacts').insert({
              business_id: bId,
              contact_name: res.contacts[0]?.fullName || `${b.display_name} Contact`,
              email_address: res.generalEmail,
              email_normalized: normalizeEmail(res.generalEmail),
              contact_channel: 'email',
              contact_type: res.contacts[0]?.type || 'licensed_enrichment',
              verification_status: res.contacts[0]?.verificationStatus || 'provider_verified',
              contact_eligibility: 'eligible',
            });
            enrichedCount++;
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      importedCount,
      duplicateCount,
      enrichedCount,
      totalReceived: leads.length,
    });
  } catch (err: unknown) {
    const error = err as Error;
    console.error('CSV Leads import error:', error);
    return NextResponse.json({ error: error.message || 'Failed to import CSV leads' }, { status: 500 });
  }
}
