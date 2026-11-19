import { NextRequest, NextResponse } from 'next/server';
import { authenticateWorkspaceApiKey, apiError } from '@/lib/api-keys';

export async function GET(req: NextRequest) {
  try {
    const { organizationId, admin } = await authenticateWorkspaceApiKey(req, 'accounts:read');
    const { data, error } = await admin.from('businesses').select('id, display_name, city, business_type, official_website_url, general_business_email, record_status, created_at')
      .eq('organization_id', organizationId).order('display_name').limit(200);
    if (error) throw error;
    return NextResponse.json({ accounts: data || [] });
  } catch (err: any) { const result = apiError(err); return NextResponse.json({ error: result.error }, { status: result.status }); }
}
