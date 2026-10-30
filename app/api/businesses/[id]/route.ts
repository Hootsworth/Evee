// Evee - Business Detail & Research Endpoint
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = createAdminClient();

  const { data: business, error } = await admin.from('businesses').select('*').eq('id', id).single();
  if (error || !business) {
    return NextResponse.json({ error: 'Business not found' }, { status: 404 });
  }

  const [evidenceRes, contactsRes, scoreRes, draftsRes, runsRes] = await Promise.all([
    admin.from('evidence_items').select('*').eq('business_id', id).order('observed_at', { ascending: false }),
    admin.from('contacts').select('*').eq('business_id', id),
    admin.from('lead_scores').select('*').eq('business_id', id).order('created_at', { ascending: false }).limit(1),
    admin.from('email_drafts').select('*').eq('business_id', id).order('created_at', { ascending: false }),
    admin.from('research_runs').select('*').eq('business_id', id).order('created_at', { ascending: false }),
  ]);

  return NextResponse.json({
    business,
    evidence: evidenceRes.data || [],
    contacts: contactsRes.data || [],
    score: scoreRes.data?.[0] || null,
    drafts: draftsRes.data || [],
    researchRuns: runsRes.data || [],
  });
}
