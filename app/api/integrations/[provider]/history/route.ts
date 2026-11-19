import { NextRequest, NextResponse } from 'next/server';
import { getUserContext } from '@/lib/auth/context';
import { assertAuthenticated } from '@/lib/auth/rbac';
import { createAdminClient, isSupabaseConfigured } from '@/lib/supabase/admin';
import { INTEGRATION_REGISTRY } from '@/lib/integrations/registry';

export async function GET(req: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  try {
    const user = await getUserContext(req);
    assertAuthenticated(user);
    const { provider } = await params;
    if (!INTEGRATION_REGISTRY.some((item) => item.id === provider)) return NextResponse.json({ error: 'Unknown provider.' }, { status: 404 });
    if (!isSupabaseConfigured()) return NextResponse.json({ runs: [] });
    const { data, error } = await createAdminClient().from('integration_sync_runs').select('id, status, total_count, synced_count, failed_count, errors, started_at, finished_at')
      .eq('organization_id', user.organizationId).eq('provider_id', provider).order('started_at', { ascending: false }).limit(20);
    if (error) throw error;
    return NextResponse.json({ runs: data || [] });
  } catch (err: any) { return NextResponse.json({ error: err.message || 'Unable to load sync history' }, { status: err.statusCode || 500 }); }
}
