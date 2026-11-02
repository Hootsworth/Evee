// Evee - AI & Rule Email Audit & Cleanup Endpoint
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { scanLeadsEmailQuality } from '@/lib/services/email-quality';

export async function GET(req: NextRequest) {
  try {
    const admin = createAdminClient();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || 'active'; // Default scan active leads

    let query = admin.from('businesses').select('*');
    if (status !== 'all') {
      query = query.eq('record_status', status);
    }

    const { data: businesses, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const report = scanLeadsEmailQuality(businesses || []);
    return NextResponse.json(report);
  } catch (error: any) {
    console.error('Email audit error:', error);
    return NextResponse.json({ error: error?.message || 'Failed to scan leads' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      leadIds,
      action = 'archive', // 'archive' | 'delete'
      archiveAllFlagged = false,
      filterCategory,
    } = body as {
      leadIds?: string[];
      action?: 'archive' | 'delete';
      archiveAllFlagged?: boolean;
      filterCategory?: string;
    };

    const admin = createAdminClient();

    let targetIds: string[] = [];

    if (archiveAllFlagged) {
      // Fetch active businesses and scan them
      const { data: businesses, error } = await admin
        .from('businesses')
        .select('*')
        .eq('record_status', 'active');

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      const report = scanLeadsEmailQuality(businesses || []);
      let matched = report.flaggedLeads;
      if (filterCategory) {
        matched = matched.filter((item) => item.flag.category === filterCategory);
      }
      targetIds = matched.map((item) => item.leadId);
    } else if (Array.isArray(leadIds) && leadIds.length > 0) {
      targetIds = leadIds;
    }

    if (targetIds.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No leads matched criteria.',
        count: 0,
      });
    }

    if (action === 'delete') {
      // Cascading deletion for clean integrity
      await admin.from('outreach_jobs').delete().in('business_id', targetIds);
      await admin.from('email_drafts').delete().in('business_id', targetIds);
      await admin.from('lead_scores').delete().in('business_id', targetIds);
      await admin.from('evidence_items').delete().in('business_id', targetIds);
      await admin.from('research_runs').delete().in('business_id', targetIds);
      await admin.from('contacts').delete().in('business_id', targetIds);
      const { error: delErr } = await admin.from('businesses').delete().in('id', targetIds);
      if (delErr) {
        return NextResponse.json({ error: delErr.message }, { status: 500 });
      }
    } else {
      // Archive action
      const { error: updateErr } = await admin
        .from('businesses')
        .update({
          record_status: 'archived',
          updated_at: new Date().toISOString(),
        })
        .in('id', targetIds);

      if (updateErr) {
        return NextResponse.json({ error: updateErr.message }, { status: 500 });
      }
    }

    // Log to audit table
    try {
      await admin.from('audit_events').insert({
        event_type: action === 'delete' ? 'LEADS_DELETED_EMAIL_AUDIT' : 'LEADS_ARCHIVED_EMAIL_AUDIT',
        entity_type: 'businesses',
        entity_id: targetIds[0],
        details: {
          count: targetIds.length,
          action,
          archiveAllFlagged,
          filterCategory,
          targetIds,
        },
      });
    } catch (auditErr) {
      console.warn('Failed to record audit event:', auditErr);
    }

    return NextResponse.json({
      success: true,
      count: targetIds.length,
      action,
      targetIds,
    });
  } catch (error: any) {
    console.error('Email audit action error:', error);
    return NextResponse.json({ error: error?.message || 'Operation failed' }, { status: 500 });
  }
}
