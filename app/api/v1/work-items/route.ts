import { NextRequest, NextResponse } from 'next/server';
import { authenticateWorkspaceApiKey, apiError } from '@/lib/api-keys';

export async function GET(req: NextRequest) {
  try {
    const { organizationId, admin } = await authenticateWorkspaceApiKey(req, 'work:read');
    const { data, error } = await admin.from('work_items').select('id, title, description, work_type, status, priority, due_at, account_id, owner_id, created_at, updated_at')
      .eq('organization_id', organizationId).order('created_at', { ascending: false }).limit(200);
    if (error) throw error;
    return NextResponse.json({ workItems: data || [] });
  } catch (err: any) { const result = apiError(err); return NextResponse.json({ error: result.error }, { status: result.status }); }
}
