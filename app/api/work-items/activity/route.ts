import { NextRequest, NextResponse } from 'next/server';
import { getUserContext } from '@/lib/auth/context';
import { assertAuthenticated } from '@/lib/auth/rbac';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(req: NextRequest) {
  try {
    const user = await getUserContext(req);
    assertAuthenticated(user);
    const limit = Math.max(1, Math.min(Number(req.nextUrl.searchParams.get('limit')) || 40, 100));
    const admin = createAdminClient();
    const { data, error } = await admin.from('audit_events')
      .select('id, event_type, entity_type, entity_id, details, timestamp')
      .eq('organization_id', user.organizationId)
      .order('timestamp', { ascending: false })
      .limit(limit);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ events: data || [] });
  } catch (err: any) {
    const status = err.statusCode || (err.message?.includes('Unauthenticated') ? 401 : 500);
    return NextResponse.json({ error: err.message }, { status });
  }
}
