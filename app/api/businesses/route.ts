// Evee - Businesses API Handler
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(req: NextRequest) {
  const admin = createAdminClient();
  const searchParams = req.nextUrl.searchParams;
  const status = searchParams.get('status');
  const city = searchParams.get('city');

  let query = admin
    .from('businesses')
    .select(`
      *,
      contacts (*),
      lead_scores (*),
      email_drafts (*)
    `)
    .order('created_at', { ascending: false });

  if (status) query = query.eq('record_status', status);
  if (city) query = query.ilike('city', `%${city}%`);

  const { data: businesses, error } = await query;
  if (error) {
    return NextResponse.json({ businesses: [] });
  }

  return NextResponse.json({ businesses });
}
