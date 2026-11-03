// Evee - Global & Organization Suppression Entries Management
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { normalizeEmail, normalizePhone } from '@/lib/compliance/suppression';
import { getUserContext } from '@/lib/auth/context';
import { assertAuthenticated } from '@/lib/auth/rbac';

export async function GET() {
  try {
    const userCtx = await getUserContext();
    assertAuthenticated(userCtx);

    const admin = createAdminClient();
    let query = admin
      .from('suppression_entries')
      .select('*')
      .order('created_at', { ascending: false });

    if (userCtx.organizationId) {
      query = query.or(`organization_id.eq.${userCtx.organizationId},organization_id.is.null`);
    }

    const { data: entries, error } = await query;
    if (error) return NextResponse.json({ entries: [] });
    return NextResponse.json({ entries });
  } catch (err: any) {
    const status = err.statusCode || (err.message.includes('Unauthenticated') ? 401 : 500);
    return NextResponse.json({ error: err.message }, { status });
  }
}

export async function POST(req: NextRequest) {
  try {
    const userCtx = await getUserContext();
    assertAuthenticated(userCtx);

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
        organization_id: userCtx.organizationId || null,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ entry: data }, { status: 201 });
  } catch (err: any) {
    const status = err.statusCode || (err.message.includes('Unauthenticated') ? 401 : 500);
    return NextResponse.json({ error: err.message }, { status });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const userCtx = await getUserContext();
    assertAuthenticated(userCtx);

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const admin = createAdminClient();
    let query = admin.from('suppression_entries').delete().eq('id', id);

    // Organization scoping: Users can only delete suppression entries belonging to their organization
    if (userCtx.organizationId) {
      query = query.eq('organization_id', userCtx.organizationId);
    }

    const { error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    const status = err.statusCode || (err.message.includes('Unauthenticated') ? 401 : 500);
    return NextResponse.json({ error: err.message }, { status });
  }
}
