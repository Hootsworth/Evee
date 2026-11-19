import { NextRequest, NextResponse } from 'next/server';
import { getUserContext } from '@/lib/auth/context';
import { assertAuthenticated, assertAuthorized } from '@/lib/auth/rbac';
import { createAdminClient } from '@/lib/supabase/admin';
import { validateTemplateDefinition } from '@/lib/workflows/template-engine';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUserContext(req);
    assertAuthenticated(user);
    assertAuthorized(user, 'manager');
    const { id } = await params;
    const body = await req.json();
    const admin = createAdminClient();
    const { data: existing, error: loadError } = await admin.from('workflow_templates').select('*')
      .eq('id', id).eq('organization_id', user.organizationId).maybeSingle();
    if (loadError) return NextResponse.json({ error: loadError.message }, { status: 500 });
    if (!existing) return NextResponse.json({ error: 'Workflow template not found.' }, { status: 404 });

    const definition = {
      triggerType: body.triggerType ?? existing.trigger_type,
      conditions: body.conditions ?? existing.conditions,
      actions: body.actions ?? existing.actions,
    };
    const definitionError = validateTemplateDefinition(definition);
    if (definitionError) return NextResponse.json({ error: definitionError }, { status: 400 });
    const action = (definition.actions as any[])[0];
    if (action.ownerId) {
      const { data: member, error } = await admin.from('organization_members').select('user_id')
        .eq('organization_id', user.organizationId).eq('user_id', action.ownerId).maybeSingle();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      if (!member) return NextResponse.json({ error: 'Action owner must belong to your workspace.' }, { status: 400 });
    }
    const nextStatus = body.status ?? existing.status;
    if (!['draft', 'active', 'paused'].includes(nextStatus)) return NextResponse.json({ error: 'Invalid template status.' }, { status: 400 });
    const name = body.name === undefined ? existing.name : typeof body.name === 'string' ? body.name.trim() : '';
    if (!name || name.length > 160) return NextResponse.json({ error: 'Template name must be between 1 and 160 characters.' }, { status: 400 });
    const description = body.description === undefined ? existing.description : typeof body.description === 'string' ? body.description.trim().slice(0, 1000) : '';
    const { data, error } = await admin.from('workflow_templates').update({
      name, description, trigger_type: definition.triggerType, conditions: definition.conditions, actions: definition.actions,
      status: nextStatus, version: existing.version + 1, updated_by: user.userId,
    }).eq('id', id).eq('organization_id', user.organizationId).eq('version', existing.version).select('*').maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: error.code === '23505' ? 409 : 500 });
    if (!data) return NextResponse.json({ error: 'Template changed while you were editing it. Refresh and try again.' }, { status: 409 });
    await admin.from('audit_events').insert({ organization_id: user.organizationId, event_type: 'WORKFLOW_TEMPLATE_UPDATED', entity_type: 'workflow_templates', entity_id: id, details: { version: data.version, status: data.status, actorName: user.displayName } });
    return NextResponse.json({ template: data });
  } catch (err: any) {
    const status = err.statusCode || (err.message?.includes('Unauthenticated') ? 401 : 500);
    return NextResponse.json({ error: err.message }, { status });
  }
}
