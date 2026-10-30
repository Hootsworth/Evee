// Evee - Workflows API Handler
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET() {
  const admin = createAdminClient();
  const { data: workflows, error } = await admin
    .from('outreach_workflows')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ workflows: [] });
  }

  return NextResponse.json({ workflows });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const admin = createAdminClient();

  const { data: workflow, error } = await admin
    .from('outreach_workflows')
    .insert({
      name: body.name || 'Default Controlled Outreach',
      version: 1,
      status: 'pending_approval',
      configuration: body.configuration || {
        daily_limit: 5,
        monthly_limit: 100,
        followup_intervals_days: [4, 9],
        require_manual_review_for_uncertain_evidence: true,
        require_contact_verification: true,
        auto_send_enabled: false,
      },
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ workflow }, { status: 201 });
}
