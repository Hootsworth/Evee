// Evee - Global Suppression Entries Management
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { normalizeEmail, normalizePhone } from '@/lib/compliance/suppression';

export async function GET() {
  const admin = createAdminClient();
  const { data: entries, error } = await admin
    .from('suppression_entries')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ entries: [] });
  return NextResponse.json({ entries });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const admin = createAdminClient();

  const { data, error } = await admin
    .from('suppression_entries')
    .insert({
      normalized_email: body.email ? normalizeEmail(body.email) : null,
      normalized_phone: body.phone ? normalizePhone(body.phone) : null,
      reason: body.reason || 'manual_block',
      source: body.source || 'operator_action',
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ entry: data }, { status: 201 });
}
