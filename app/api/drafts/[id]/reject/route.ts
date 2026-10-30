// Evee - Draft Rejection Action
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = createAdminClient();

  const { data: updated, error } = await admin
    .from('email_drafts')
    .update({
      approval_status: 'rejected',
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await admin.from('audit_events').insert({
    event_type: 'DRAFT_REJECTED',
    entity_type: 'email_drafts',
    entity_id: id,
    details: { rejected_at: new Date().toISOString() },
  });

  return NextResponse.json({ success: true, draft: updated });
}
