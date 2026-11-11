// Evee - Leads CSV Export API Route (Tenant-Isolated)
// Returns RFC 4180 compliant CSV of leads belonging to the authenticated tenant
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getUserContext } from '@/lib/auth/context';
import { assertAuthenticated } from '@/lib/auth/rbac';
import { exportLeadsToCsv } from '@/lib/csv/exporter';

export async function GET(req: NextRequest) {
  try {
    const userCtx = await getUserContext();
    assertAuthenticated(userCtx);

    const admin = createAdminClient();
    const searchParams = req.nextUrl.searchParams;
    const status = searchParams.get('status');
    const city = searchParams.get('city');
    const idsParam = searchParams.get('ids');

    let query = admin
      .from('businesses')
      .select(`
        *,
        contacts (*),
        lead_scores (*)
      `)
      .eq('organization_id', userCtx.organizationId)
      .order('created_at', { ascending: false });

    if (status && status !== 'all') {
      query = query.eq('record_status', status);
    }
    if (city) {
      query = query.ilike('city', `%${city}%`);
    }

    const { data: businesses, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    let records = businesses || [];

    // Filter by specific IDs if provided
    if (idsParam) {
      const idSet = new Set(idsParam.split(',').map((id) => id.trim()).filter(Boolean));
      if (idSet.size > 0) {
        records = records.filter((b) => idSet.has(b.id));
      }
    }

    // Generate CSV string
    const csvContent = exportLeadsToCsv(records);
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `evee-leads-${dateStr}.csv`;

    return new Response(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  } catch (err: any) {
    const status = err.statusCode || (err.message?.includes('Unauthenticated') ? 401 : 500);
    return NextResponse.json({ error: err.message }, { status });
  }
}
