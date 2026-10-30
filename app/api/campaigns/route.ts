// Evee - Campaigns API Handler
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET() {
  const supabase = await createClient();
  const { data: campaigns, error } = await supabase
    .from('campaigns')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    // If table doesn't exist yet or connection pending, return empty list gracefully
    return NextResponse.json({ campaigns: [] });
  }

  return NextResponse.json({ campaigns });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const admin = createAdminClient();

    const { data: campaign, error } = await admin
      .from('campaigns')
      .insert({
        name: body.name || 'Unnamed Campaign',
        target_geographies: body.targetGeographies || ['Bengaluru'],
        target_industries: body.targetIndustries || ['Cafes & Restaurants'],
        search_terms: body.searchTerms || ['bakery', 'cafe', 'bistro'],
        services_to_promote: body.servicesToPromote || ['Digital QR Menu', 'Online Booking Workflow'],
        monthly_target: body.monthlyTarget || 100,
        daily_discovery_limit: body.dailyDiscoveryLimit || 20,
        qualification_threshold: body.qualificationThreshold || 65,
        status: 'active',
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Automatically enqueue discovery job for this campaign
    await admin.from('background_jobs').insert({
      job_type: 'discover_businesses',
      payload: {
        campaignId: campaign.id,
        geography: campaign.target_geographies[0] || 'Bengaluru',
        categories: campaign.target_industries,
        keywords: campaign.search_terms,
        limit: 10,
      },
      idempotency_key: `init-discovery-${campaign.id}`,
    });

    return NextResponse.json({ campaign }, { status: 201 });
  } catch (err: unknown) {
    const error = err as Error;
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
