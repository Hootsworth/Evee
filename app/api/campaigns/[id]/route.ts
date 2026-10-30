// Evee - Campaign Detail, Pause, Update Handler
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = createAdminClient();

  const { data: campaign, error } = await admin.from('campaigns').select('*').eq('id', id).single();
  if (error || !campaign) {
    return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
  }

  // Get campaign businesses
  const { data: businesses } = await admin
    .from('campaign_businesses')
    .select(`
      campaign_id,
      business_id,
      discovery_status,
      qualification_score,
      qualification_status,
      added_at,
      businesses (*)
    `)
    .eq('campaign_id', id);

  return NextResponse.json({ campaign, businesses: businesses || [] });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const admin = createAdminClient();

  const { data, error } = await admin.from('campaigns').update(body).eq('id', id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ campaign: data });
}
