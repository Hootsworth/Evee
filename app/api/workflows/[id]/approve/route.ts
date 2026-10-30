// Evee - Workflow Approval Endpoint
// Required before automated sending can be activated
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = createAdminClient();

  const { data: updated, error } = await admin
    .from('outreach_workflows')
    .update({
      status: 'approved',
      approved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await admin.from('audit_events').insert({
    event_type: 'WORKFLOW_APPROVED',
    entity_type: 'outreach_workflows',
    entity_id: id,
    details: { version: updated.version, approved_at: new Date().toISOString() },
  });

  return NextResponse.json({ success: true, workflow: updated });
}
