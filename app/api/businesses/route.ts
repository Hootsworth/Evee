// Evee - Businesses API Handler (Tenant-Isolated)
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
    const city = searchParams.get('city');

    let query = admin
      .from('businesses')
      .select(`
        *,
        contacts (*),
        lead_scores (*),
        email_drafts (*)
      `)
      .eq('organization_id', userCtx.organizationId)
      .order('created_at', { ascending: false });

    if (status) query = query.eq('record_status', status);
    if (city) query = query.ilike('city', `%${city}%`);

    const { data: businesses, error } = await query;
    if (error) {
      return NextResponse.json({ businesses: [] });
    }

    return NextResponse.json({ businesses });
  } catch (err: any) {
    const status = err.statusCode || (err.message?.includes('Unauthenticated') ? 401 : 500);
    return NextResponse.json({ error: err.message }, { status });
  }
}
