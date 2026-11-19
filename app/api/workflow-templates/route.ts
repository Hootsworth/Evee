import { NextRequest, NextResponse } from 'next/server';
import { getUserContext } from '@/lib/auth/context';
import { assertAuthenticated, assertAuthorized } from '@/lib/auth/rbac';
import { createAdminClient } from '@/lib/supabase/admin';
import { validateTemplateDefinition } from '@/lib/workflows/template-engine';

export async function GET(req: NextRequest) {
  try {
    const user = await getUserContext(req);
    assertAuthenticated(user);
    const admin = createAdminClient();
    const [templatesRes, runsRes] = await Promise.all([
      admin.from('workflow_templates').select('*').eq('organization_id', user.organizationId).order('updated_at', { ascending: false }),
      admin.from('workflow_template_runs').select('*').eq('organization_id', user.organizationId).order('created_at', { ascending: false }).limit(50),
    ]);
    if (templatesRes.error) return NextResponse.json({ error: templatesRes.error.message }, { status: 500 });
    if (runsRes.error) return NextResponse.json({ error: runsRes.error.message }, { status: 500 });
    return NextResponse.json({ templates: templatesRes.data || [], runs: runsRes.data || [], role: user.role });
  } catch (err: any) {
    const status = err.statusCode || (err.message?.includes('Unauthenticated') ? 401 : 500);
    return NextResponse.json({ error: err.message }, { status });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUserContext(req);
    assertAuthenticated(user);
    assertAuthorized(user, 'manager');
    const body = await req.json();
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const description = typeof body.description === 'string' ? body.description.trim().slice(0, 1000) : '';
    if (!name || name.length > 160) return NextResponse.json({ error: 'Template name must be between 1 and 160 characters.' }, { status: 400 });
    const definitionError = validateTemplateDefinition({ triggerType: body.triggerType, conditions: body.conditions, actions: body.actions });
    if (definitionError) return NextResponse.json({ error: definitionError }, { status: 400 });
    const action = body.actions[0];
    if (action.ownerId) {
      const admin = createAdminClient();
      const { data: member, error } = await admin.from('organization_members').select('user_id')
        .eq('organization_id', user.organizationId).eq('user_id', action.ownerId).maybeSingle();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      if (!member) return NextResponse.json({ error: 'Action owner must belong to your workspace.' }, { status: 400 });
    }
    const admin = createAdminClient();
    const { data, error } = await admin.from('workflow_templates').insert({
      organization_id: user.organizationId, name, description, trigger_type: body.triggerType,
      conditions: body.conditions, actions: body.actions, status: body.status === 'active' ? 'active' : 'draft',
      created_by: user.userId, updated_by: user.userId,
    }).select('*').single();
    if (error) return NextResponse.json({ error: error.message }, { status: error.code === '23505' ? 409 : 500 });
    await admin.from('audit_events').insert({ organization_id: user.organizationId, event_type: 'WORKFLOW_TEMPLATE_CREATED', entity_type: 'workflow_templates', entity_id: data.id, details: { name, actorName: user.displayName } });
    return NextResponse.json({ template: data }, { status: 201 });
  } catch (err: any) {
    const status = err.statusCode || (err.message?.includes('Unauthenticated') ? 401 : 500);
    return NextResponse.json({ error: err.message }, { status });
  }
}
