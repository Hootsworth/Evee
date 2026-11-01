// Evee - Lead Archival & Status Management Endpoint
// Enables single, batch, or automated no-email lead archival
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { ids, allMissingEmail, action = 'archive' } = body as {
      ids?: string[];
      allMissingEmail?: boolean;
      action?: 'archive' | 'unarchive';
    };

    const admin = createAdminClient();
    const targetStatus = action === 'unarchive' ? 'active' : 'archived';

    let targetIds: string[] = [];

    if (allMissingEmail) {
      // Find all active businesses without an email address
      const { data: missing, error: fetchErr } = await admin
        .from('businesses')
        .select('id, general_business_email')
        .eq('record_status', 'active');

      if (fetchErr) {
        return NextResponse.json({ error: fetchErr.message }, { status: 500 });
      }

      targetIds = (missing || [])
        .filter((b) => !b.general_business_email || b.general_business_email.trim() === '')
        .map((b) => b.id);
    } else if (Array.isArray(ids) && ids.length > 0) {
      targetIds = ids;
    }

    if (targetIds.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No leads matched criteria for update.',
        count: 0,
      });
    }

    // Batch update businesses
    const { error: updateErr } = await admin
      .from('businesses')
      .update({
        record_status: targetStatus,
        updated_at: new Date().toISOString(),
      })
      .in('id', targetIds);

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    // Log audit event for compliance and traceability
    try {
      await admin.from('audit_events').insert({
        event_type: action === 'unarchive' ? 'LEADS_UNARCHIVED' : 'LEADS_ARCHIVED',
        entity_type: 'businesses',
        entity_id: targetIds[0],
        details: {
          count: targetIds.length,
          action: targetStatus,
          allMissingEmail: Boolean(allMissingEmail),
          targetIds,
        },
      });
    } catch (auditErr) {
      console.warn('Failed to record audit log for archival:', auditErr);
    }

    return NextResponse.json({
      success: true,
      count: targetIds.length,
      action: targetStatus,
      targetIds,
    });
  } catch (error: any) {
    console.error('Lead archive error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to update lead status' },
      { status: 500 }
    );
  }
}
