import { NextRequest, NextResponse } from 'next/server';
import { getUserContext } from '@/lib/auth/context';
import { assertAuthenticated, assertAuthorized } from '@/lib/auth/rbac';
import { createAdminClient } from '@/lib/supabase/admin';
import { renderTriggerText, validateTemplateDefinition, TemplateAction } from '@/lib/workflows/template-engine';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUserContext(req);
    assertAuthenticated(user);
    assertAuthorized(user, 'manager');
    const { id } = await params;
    const body = await req.json();
    if (!['approve', 'reject'].includes(body.decision)) return NextResponse.json({ error: 'Choose approve or reject.' }, { status: 400 });
    const admin = createAdminClient();
    const { data: run, error: loadError } = await admin.from('workflow_template_runs').select('*')
      .eq('id', id).eq('organization_id', user.organizationId).maybeSingle();
    if (loadError) return NextResponse.json({ error: loadError.message }, { status: 500 });
    if (!run) return NextResponse.json({ error: 'Workflow run not found.' }, { status: 404 });
    if (body.decision === 'reject') {
      if (run.status !== 'pending_review') return NextResponse.json({ error: 'Only a pending run can be rejected.' }, { status: 409 });
      const { data, error } = await admin.from('workflow_template_runs').update({
        status: 'rejected', approved_by: user.userId, decision_note: typeof body.note === 'string' ? body.note.trim().slice(0, 2000) : '', completed_at: new Date().toISOString(),
      }).eq('id', id).eq('organization_id', user.organizationId).eq('status', 'pending_review').select('*').maybeSingle();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      if (!data) return NextResponse.json({ error: 'Run changed while reviewing it.' }, { status: 409 });
      await admin.from('audit_events').insert({ organization_id: user.organizationId, event_type: 'WORKFLOW_RUN_REJECTED', entity_type: 'workflow_template_runs', entity_id: id, details: { actorName: user.displayName, note: data.decision_note } });
      return NextResponse.json({ run: data });
    }

    if (run.status === 'executed') return NextResponse.json({ run });
    if (!['pending_review', 'approved', 'failed'].includes(run.status)) return NextResponse.json({ error: 'This run cannot be approved in its current state.' }, { status: 409 });
    const definitionError = validateTemplateDefinition({ triggerType: run.trigger_type, conditions: [], actions: run.proposed_actions });
    if (definitionError) return NextResponse.json({ error: `Run contains an unsupported action: ${definitionError}` }, { status: 409 });

    if (run.status !== 'approved') {
      const { data: approved, error } = await admin.from('workflow_template_runs').update({
        status: 'approved', approved_by: user.userId, decision_note: typeof body.note === 'string' ? body.note.trim().slice(0, 2000) : '', error_summary: null,
      }).eq('id', id).eq('organization_id', user.organizationId).eq('status', run.status).select('*').maybeSingle();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      if (!approved) return NextResponse.json({ error: 'Run changed while reviewing it.' }, { status: 409 });
    }

    const action = (run.proposed_actions as TemplateAction[])[0];
    try {
      let item = null as any;
      const { data: existingItem, error: existingError } = await admin.from('work_items').select('*')
        .eq('organization_id', user.organizationId).eq('source_workflow_run_id', id).maybeSingle();
      if (existingError) throw existingError;
      item = existingItem;
      if (!item) {
        const payload = run.trigger_payload as Record<string, unknown>;
        const field = action.accountIdField || 'accountId';
        const rawAccountId = payload[field];
        const accountId = typeof rawAccountId === 'string' ? rawAccountId : null;
        if (accountId) {
          const { data: account, error } = await admin.from('businesses').select('id').eq('id', accountId).eq('organization_id', user.organizationId).maybeSingle();
          if (error) throw error;
          if (!account) throw new Error('Trigger account is no longer available in this workspace.');
        }
        const ownerId = action.ownerId || user.userId;
        const { data: owner, error: ownerError } = await admin.from('organization_members').select('user_id').eq('organization_id', user.organizationId).eq('user_id', ownerId).maybeSingle();
        if (ownerError) throw ownerError;
        if (!owner) throw new Error('Workflow owner is no longer a workspace member.');
        const title = renderTriggerText(action.title, payload).trim();
        if (!title) throw new Error('Workflow output produced an empty work item title.');
        const dueAt = action.dueInDays === undefined ? null : new Date(Date.now() + action.dueInDays * 86400000).toISOString();
        const { data, error } = await admin.from('work_items').insert({
          organization_id: user.organizationId,
          title: title.slice(0, 240),
          description: renderTriggerText(action.description || '', payload).slice(0, 10000),
          work_type: action.workType || 'task', priority: action.priority || 'normal', due_at: dueAt,
          account_id: accountId, owner_id: ownerId, created_by: run.requested_by || user.userId, source_workflow_run_id: id,
        }).select('*').single();
        if (error) {
          if (error.code !== '23505') throw error;
          const { data: racedItem, error: raceError } = await admin.from('work_items').select('*').eq('source_workflow_run_id', id).maybeSingle();
          if (raceError || !racedItem) throw raceError || error;
          item = racedItem;
        } else item = data;
      }
      const { data: completedRun, error: completeError } = await admin.from('workflow_template_runs').update({ status: 'executed', error_summary: null, completed_at: new Date().toISOString() })
        .eq('id', id).eq('organization_id', user.organizationId).eq('status', 'approved').select('*').maybeSingle();
      if (completeError) throw completeError;
      if (!completedRun) return NextResponse.json({ error: 'Work was created, but the run state changed. Refresh before retrying.' }, { status: 409 });
      await admin.from('audit_events').insert({ organization_id: user.organizationId, event_type: 'WORKFLOW_RUN_EXECUTED', entity_type: 'workflow_template_runs', entity_id: id, details: { workItemId: item.id, actorName: user.displayName } });
      return NextResponse.json({ run: completedRun, workItem: item });
    } catch (executionError: any) {
      await admin.from('workflow_template_runs').update({ status: 'failed', error_summary: String(executionError.message || 'Workflow action failed').slice(0, 1000) })
        .eq('id', id).eq('organization_id', user.organizationId).eq('status', 'approved');
      return NextResponse.json({ error: executionError.message || 'Workflow action failed.' }, { status: 500 });
    }
  } catch (err: any) {
    const status = err.statusCode || (err.message?.includes('Unauthenticated') ? 401 : 500);
    return NextResponse.json({ error: err.message }, { status });
  }
}
