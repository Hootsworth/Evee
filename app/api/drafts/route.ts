// Evee - Email Drafts List Handler
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(req: NextRequest) {
  const admin = createAdminClient();
  const searchParams = req.nextUrl.searchParams;
  const status = searchParams.get('status');

  let query = admin
    .from('email_drafts')
    .select(`
      *,
      business:businesses (*),
      contact:contacts (*)
    `)
    .order('created_at', { ascending: false });

  if (status) query = query.eq('approval_status', status);

  const { data: drafts, error } = await query;
  if (error) {
    return NextResponse.json({ drafts: [] });
  }

  return NextResponse.json({ drafts });
}
