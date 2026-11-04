// Evee - Partner Leads API
// Strictly scoped to the authenticated partner's allotted leads.

import { NextRequest, NextResponse } from 'next/server';
import { resolvePartnerContext } from '@/lib/auth/partner-context';
import { getPartnerAllottedLeadIds, allotLeadsToPartner } from '@/lib/services/partner-store';
import { createAdminClient } from '@/lib/supabase/admin';
import { normalizeBusinessName, extractCanonicalDomain } from '@/lib/normalization/deduplication';
import { normalizeEmail } from '@/lib/compliance/suppression';

export async function GET(req: NextRequest) {
  try {
    const partner = await resolvePartnerContext(req);
    if (!partner) {
      return NextResponse.json({ error: 'Unauthenticated partner' }, { status: 401 });
    }

    const allottedIds = await getPartnerAllottedLeadIds(partner.id);
    if (allottedIds.length === 0) {
      return NextResponse.json({ businesses: [], partner });
    }

    const admin = createAdminClient();
    const { data: businesses, error } = await admin
      .from('businesses')
      .select(`
        *,
        contacts (*)
      `)
      .in('id', allottedIds)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      businesses: businesses || [],
      partner: {
        id: partner.id,
        name: partner.name,
        email: partner.email,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const partner = await resolvePartnerContext(req);
    if (!partner) {
      return NextResponse.json({ error: 'Unauthenticated partner' }, { status: 401 });
    }

    const body = await req.json();
    const { leads } = body as { leads: Array<Record<string, any>> };

    if (!Array.isArray(leads) || leads.length === 0) {
      return NextResponse.json({ error: 'No leads provided' }, { status: 400 });
    }

    const admin = createAdminClient();
    // Default organization for the workspace
    const { data: org } = await admin
      .from('organizations')
      .select('id')
      .eq('slug', 'primary-workspace')
      .maybeSingle();

    const orgId = org?.id || undefined;
    const insertedIds: string[] = [];

    for (const item of leads) {
      const name = item.companyName || item.name || item.display_name;
      if (!name || !name.trim()) continue;

      const website = item.website || item.official_website_url || '';
      const email = item.email || item.general_business_email || '';
      const phone = item.phone || item.public_business_phone || '';
      const city = item.city || 'Bengaluru';
      const category = item.category || item.business_type || 'Commercial Services';
      const contactName = item.contactName || item.firstName || '';

      const { data: newBiz, error } = await admin
        .from('businesses')
        .insert({
          organization_id: orgId,
          normalized_name: normalizeBusinessName(name),
          display_name: name.trim(),
          business_type: category.trim(),
          country_code: 'IN',
          region: 'Karnataka',
          city: city.trim(),
          official_website_url: website.trim() || null,
          canonical_domain: extractCanonicalDomain(website),
          public_business_phone: phone.trim() || null,
          general_business_email: email && email.includes('@') ? normalizeEmail(email) : null,
          identity_confidence: 1.0,
          record_status: 'active',
        })
        .select()
        .single();

      if (!error && newBiz) {
        insertedIds.push(newBiz.id);

        if (email && email.includes('@')) {
          await admin.from('contacts').insert({
            business_id: newBiz.id,
            contact_name: contactName || `${name} Contact`,
            email_address: email,
            email_normalized: normalizeEmail(email),
            contact_channel: 'email',
            contact_type: 'user_provided',
            verification_status: 'syntax_valid',
            contact_eligibility: 'eligible',
          });
        }
      }
    }

    // Automatically allot all newly created leads to this partner!
    if (insertedIds.length > 0) {
      await allotLeadsToPartner(insertedIds, partner.id, partner.name, orgId);
    }

    return NextResponse.json({
      success: true,
      addedCount: insertedIds.length,
      leadIds: insertedIds,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const partner = await resolvePartnerContext(req);
    if (!partner) {
      return NextResponse.json({ error: 'Unauthenticated partner' }, { status: 401 });
    }

    const body = await req.json();
    const { businessId, general_business_email, contact_name, official_website_url, public_business_phone } = body;

    if (!businessId) {
      return NextResponse.json({ error: 'businessId is required' }, { status: 400 });
    }

    // Security check: verify this lead is allotted to this partner
    const allottedIds = await getPartnerAllottedLeadIds(partner.id);
    if (!allottedIds.includes(businessId)) {
      return NextResponse.json({ error: 'Unauthorized: Lead is not allotted to your account' }, { status: 403 });
    }

    const admin = createAdminClient();
    const updateData: Record<string, any> = {};

    if (general_business_email !== undefined) {
      updateData.general_business_email = general_business_email ? normalizeEmail(general_business_email) : null;
    }
    if (official_website_url !== undefined) {
      updateData.official_website_url = official_website_url;
      updateData.canonical_domain = extractCanonicalDomain(official_website_url);
    }
    if (public_business_phone !== undefined) {
      updateData.public_business_phone = public_business_phone;
    }

    const { data: updated, error } = await admin
      .from('businesses')
      .update(updateData)
      .eq('id', businessId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // If contact name or email provided, update/insert contact
    if (general_business_email && general_business_email.includes('@')) {
      const normEmail = normalizeEmail(general_business_email);
      const { data: existingContact } = await admin
        .from('contacts')
        .select('id')
        .eq('business_id', businessId)
        .maybeSingle();

      if (existingContact) {
        await admin
          .from('contacts')
          .update({
            email_address: general_business_email,
            email_normalized: normEmail,
            contact_name: contact_name || undefined,
          })
          .eq('id', existingContact.id);
      } else {
        await admin.from('contacts').insert({
          business_id: businessId,
          contact_name: contact_name || `${updated.display_name} Contact`,
          email_address: general_business_email,
          email_normalized: normEmail,
          contact_channel: 'email',
          contact_type: 'user_provided',
          verification_status: 'syntax_valid',
          contact_eligibility: 'eligible',
        });
      }
    }

    return NextResponse.json({ success: true, business: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
