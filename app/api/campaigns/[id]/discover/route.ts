// Evee - Trigger Business Discovery for Campaign
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = createAdminClient();

  const { data: campaign, error } = await admin.from('campaigns').select('*').eq('id', id).single();
  if (error || !campaign) {
    return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
  }

  // Enqueue new discovery job
  const { data: job, error: jobErr } = await admin
    .from('background_jobs')
    .insert({
      job_type: 'discover_businesses',
      payload: {
        campaignId: campaign.id,
        geography: campaign.target_geographies[0] || 'Bengaluru',
        categories: campaign.target_industries,
        keywords: campaign.search_terms,
        limit: campaign.daily_discovery_limit || 10,
      },
      idempotency_key: `manual-discovery-${campaign.id}-${Date.now()}`,
    })
    .select()
    .single();

  if (jobErr) return NextResponse.json({ error: jobErr.message }, { status: 500 });

  return NextResponse.json({ success: true, message: 'Discovery job queued', jobId: job.id });
}
