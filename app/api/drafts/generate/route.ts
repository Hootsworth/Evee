// Evee - On-Demand AI Drafts Generation Endpoint (Tenant-Isolated)
// Crafts bespoke, handcrafted email drafts for qualified leads in the user's workspace
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getUserContext } from '@/lib/auth/context';
import { assertAuthenticated, assertAuthorized } from '@/lib/auth/rbac';
import { getDynamicAiProvider } from '@/lib/providers/ai';

export async function POST(req: NextRequest) {
  try {
    const userCtx = await getUserContext();
    assertAuthenticated(userCtx);
    assertAuthorized(userCtx, 'operator');

    const admin = createAdminClient();
    const orgId = userCtx.organizationId;
    const body = await req.json().catch(() => ({}));
    const targetBusinessIds: string[] | undefined = body.businessIds;
    const limit = Math.min(Number(body.limit) || 15, 30);

    // 1. Find existing business IDs that already have drafts in this organization
    const { data: existingDrafts } = await admin
      .from('email_drafts')
      .select('business_id')
      .eq('organization_id', orgId);

    const draftedBusinessIds = new Set((existingDrafts || []).map((d) => d.business_id));

    // 2. Query target businesses
    let bizQuery = admin
      .from('businesses')
      .select('id, display_name, business_type, city, general_business_email, official_website_url')
      .eq('organization_id', orgId);

    if (targetBusinessIds && targetBusinessIds.length > 0) {
      bizQuery = bizQuery.in('id', targetBusinessIds);
    }

    const { data: allBusinesses, error: bizErr } = await bizQuery.limit(limit * 2);
    if (bizErr) {
      return NextResponse.json({ error: bizErr.message }, { status: 500 });
    }

    // Filter to businesses that don't have drafts yet
    const candidates = (allBusinesses || [])
      .filter((b) => !draftedBusinessIds.has(b.id))
      .slice(0, limit);

    if (candidates.length === 0) {
      return NextResponse.json({
        success: true,
        generated: 0,
        message: 'All available leads in this workspace already have drafts generated.',
      });
    }

    const ai = await getDynamicAiProvider(orgId);
    const draftsToInsert: any[] = [];

    for (const biz of candidates) {
      // Find contact if available
      const { data: contact } = await admin
        .from('contacts')
        .select('*')
        .eq('business_id', biz.id)
        .maybeSingle();

      // Find evidence items if available
      const { data: evidence } = await admin
        .from('evidence_items')
        .select('*')
        .eq('business_id', biz.id)
        .limit(3);

      const draftOutput = await ai.createEmailDraft(
        {
          name: biz.display_name,
          category: biz.business_type || 'local business',
          city: biz.city || 'your area',
        },
        evidence || [],
        'digital customer booking and direct inquiry workflows',
        { tone: 'respectful, direct, helpful' }
      );

      draftsToInsert.push({
        organization_id: orgId,
        business_id: biz.id,
        contact_id: contact?.id || null,
        subject: draftOutput.subject,
        body_text: draftOutput.bodyText,
        body_html: draftOutput.bodyHtml || null,
        personalization_summary: draftOutput.personalizationSummary,
        evidence_item_ids: draftOutput.evidenceIds || [],
        model_provider: ai.name,
        model_name: 'multi-llm',
        prompt_version: 'v2-handcrafted',
        validation_status: 'valid',
        approval_status: 'pending',
      });
    }

    const { data: inserted, error: insErr } = await admin
      .from('email_drafts')
      .insert(draftsToInsert)
      .select(`
        *,
        business:businesses (*),
        contact:contacts (*)
      `);

    if (insErr) {
      console.error('Failed to insert generated drafts:', insErr);
      return NextResponse.json({ error: `Database error: ${insErr.message}` }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      generated: inserted?.length || 0,
      drafts: inserted || [],
    });
  } catch (err: any) {
    console.error('Draft generation error:', err);
    return NextResponse.json({ error: err.message || 'Failed to generate drafts' }, { status: 500 });
  }
}
