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

  const emailVal = body.email || (body.type === 'email' ? body.value : null) || body.value;
  const phoneVal = body.phone || (body.type === 'phone' ? body.value : null);

  const { data, error } = await admin
    .from('suppression_entries')
    .insert({
      normalized_email: emailVal ? normalizeEmail(emailVal) : null,
      normalized_phone: phoneVal ? normalizePhone(phoneVal) : null,
      reason: body.reason || 'manual_block',
      source: body.source || 'operator_action',
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ entry: data }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  const admin = createAdminClient();
  const { error } = await admin.from('suppression_entries').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ success: true });
}
