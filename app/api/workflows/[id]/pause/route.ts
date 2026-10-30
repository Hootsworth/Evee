// Evee - Global Outreach Pause & Resume Action
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = createAdminClient();

  const { data: updated, error } = await admin
    .from('outreach_workflows')
    .update({
      status: 'paused',
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await admin.from('audit_events').insert({
    event_type: 'WORKFLOW_PAUSED',
    entity_type: 'outreach_workflows',
    entity_id: id,
    details: { paused_at: new Date().toISOString() },
  });

  return NextResponse.json({ success: true, workflow: updated });
}
