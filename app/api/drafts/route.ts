// Evee - Email Drafts List Handler (Tenant-Isolated)
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getUserContext } from '@/lib/auth/context';
import { assertAuthenticated } from '@/lib/auth/rbac';

export async function GET(req: NextRequest) {
  try {
    const userCtx = await getUserContext();
    assertAuthenticated(userCtx);

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
      .eq('organization_id', userCtx.organizationId)
      .order('created_at', { ascending: false });

    if (status) query = query.eq('approval_status', status);

    const { data: drafts, error } = await query;
    if (error) {
      return NextResponse.json({ drafts: [] });
    }

    return NextResponse.json({ drafts });
  } catch (err: any) {
    const status = err.statusCode || (err.message?.includes('Unauthenticated') ? 401 : 500);
    return NextResponse.json({ error: err.message }, { status });
  }
}
