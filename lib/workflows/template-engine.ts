import { createAdminClient } from '@/lib/supabase/admin';

export type TemplateTrigger = 'manual' | 'work_item_created' | 'work_item_status_changed' | 'lead_received' | 'opportunity_stage_changed';
export type TemplateCondition = { field: string; operator: 'equals' | 'not_equals' | 'contains' | 'exists'; value?: string | number | boolean };
export type TemplateAction = {
  type: 'create_work_item';
  title: string;
  description?: string;
  workType?: 'task' | 'follow_up' | 'research' | 'approval' | 'handoff' | 'other';
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  dueInDays?: number;
  ownerId?: string;
  accountIdField?: string;
};

const fieldPattern = /^[A-Za-z][A-Za-z0-9_]{0,63}$/;
const workTypes = new Set(['task', 'follow_up', 'research', 'approval', 'handoff', 'other']);
const priorities = new Set(['low', 'normal', 'high', 'urgent']);
const triggers = new Set<TemplateTrigger>(['manual', 'work_item_created', 'work_item_status_changed', 'lead_received', 'opportunity_stage_changed']);

export function validateTemplateDefinition(input: { triggerType: unknown; conditions: unknown; actions: unknown }): string | null {
  if (typeof input.triggerType !== 'string' || !triggers.has(input.triggerType as TemplateTrigger)) return 'Choose a supported trigger.';
  if (!Array.isArray(input.conditions) || input.conditions.length > 20) return 'Conditions must be a list with no more than 20 rules.';
  for (const condition of input.conditions as any[]) {
    if (!condition || typeof condition !== 'object' || !fieldPattern.test(condition.field || '') || !['equals', 'not_equals', 'contains', 'exists'].includes(condition.operator)) return 'Each condition needs a supported field and operator.';
    if (condition.operator !== 'exists' && !['string', 'number', 'boolean'].includes(typeof condition.value)) return 'Condition values must be text, numbers, or booleans.';
    if (typeof condition.value === 'string' && condition.value.length > 500) return 'Condition text values are limited to 500 characters.';
  }
  if (!Array.isArray(input.actions) || input.actions.length !== 1) return 'A template must define exactly one proposed action.';
  const action = input.actions[0] as any;
  if (!action || action.type !== 'create_work_item' || typeof action.title !== 'string' || !action.title.trim() || action.title.length > 240) return 'The supported action is creating a work item with a title.';
  if (action.description !== undefined && (typeof action.description !== 'string' || action.description.length > 4000)) return 'Action descriptions are limited to 4,000 characters.';
  if (action.workType && !workTypes.has(action.workType)) return 'Choose a supported work item type.';
  if (action.priority && !priorities.has(action.priority)) return 'Choose a supported priority.';
  if (action.dueInDays !== undefined && (!Number.isInteger(action.dueInDays) || action.dueInDays < 0 || action.dueInDays > 365)) return 'Due dates must be 0 to 365 days after approval.';
  if (action.ownerId !== undefined && (typeof action.ownerId !== 'string' || !/^[0-9a-f-]{36}$/i.test(action.ownerId))) return 'Owner must be a workspace member ID.';
  if (action.accountIdField !== undefined && (typeof action.accountIdField !== 'string' || !fieldPattern.test(action.accountIdField))) return 'Account reference must be a simple payload field name.';
  return null;
}

function evaluateConditions(conditions: TemplateCondition[], payload: Record<string, unknown>) {
  return conditions.map((condition) => {
    const actual = payload[condition.field];
    const exists = actual !== undefined && actual !== null;
    let matched = false;
    if (condition.operator === 'exists') matched = exists;
    else if (condition.operator === 'equals') matched = String(actual ?? '').toLowerCase() === String(condition.value ?? '').toLowerCase();
    else if (condition.operator === 'not_equals') matched = String(actual ?? '').toLowerCase() !== String(condition.value ?? '').toLowerCase();
    else if (condition.operator === 'contains') matched = exists && String(actual).toLowerCase().includes(String(condition.value ?? '').toLowerCase());
    return { field: condition.field, operator: condition.operator, actual: exists ? actual : null, value: condition.value ?? null, matched };
  });
}

async function createRun(
  organizationId: string,
  template: Record<string, any>,
  triggerType: TemplateTrigger,
  triggerEntityId: string | null,
  payload: Record<string, unknown>,
  requestedBy: string | null
) {
  const size = JSON.stringify(payload).length;
  if (size > 20000) throw new Error('Workflow trigger payload is too large.');
  const conditionResults = evaluateConditions(template.conditions || [], payload);
  const matches = conditionResults.every((condition: { matched: boolean }) => condition.matched);
  const admin = createAdminClient();
  const { data, error } = await admin.from('workflow_template_runs').insert({
    organization_id: organizationId,
    template_id: template.id,
    trigger_type: triggerType,
    trigger_entity_id: triggerEntityId,
    trigger_payload: payload,
    condition_results: conditionResults,
    proposed_actions: template.actions,
    status: matches ? 'pending_review' : 'skipped',
    requested_by: requestedBy,
    completed_at: matches ? null : new Date().toISOString(),
  }).select('*').single();
  if (error) throw error;
  await admin.from('audit_events').insert({
    organization_id: organizationId,
    event_type: matches ? 'WORKFLOW_RUN_PROPOSED' : 'WORKFLOW_RUN_SKIPPED',
    entity_type: 'workflow_template_runs',
    entity_id: data.id,
    details: { templateId: template.id, templateName: template.name, triggerType },
  });
  return data;
}

export async function runTemplateManually(
  organizationId: string,
  templateId: string,
  payload: Record<string, unknown>,
  requestedBy: string
) {
  const admin = createAdminClient();
  const { data: template, error } = await admin.from('workflow_templates').select('*')
    .eq('id', templateId).eq('organization_id', organizationId).maybeSingle();
  if (error) throw error;
  if (!template || template.status !== 'active') throw new Error('Active workflow template not found.');
  if (template.trigger_type !== 'manual') throw new Error('This workflow is started by its event trigger.');
  return createRun(organizationId, template, 'manual', null, payload, requestedBy);
}

export async function dispatchWorkflowTrigger(
  organizationId: string,
  triggerType: TemplateTrigger,
  triggerEntityId: string,
  payload: Record<string, unknown>,
  requestedBy: string | null
) {
  try {
    const admin = createAdminClient();
    const { data: templates, error } = await admin.from('workflow_templates').select('*')
      .eq('organization_id', organizationId).eq('trigger_type', triggerType).eq('status', 'active');
    if (error) throw error;
    for (const template of templates || []) await createRun(organizationId, template, triggerType, triggerEntityId, payload, requestedBy);
  } catch (error) {
    console.error(`[workflow-templates] Could not dispatch ${triggerType} trigger:`, error);
  }
}

export function renderTriggerText(template: string, payload: Record<string, unknown>) {
  return template.replace(/\{\{\s*([A-Za-z][A-Za-z0-9_]*)\s*\}\}/g, (_match, key: string) => {
    const value = payload[key];
    return typeof value === 'string' || typeof value === 'number' ? String(value) : '';
  });
}
