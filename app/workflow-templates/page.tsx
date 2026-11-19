'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Check, CirclePlay, LoaderCircle, Pause, Play, RefreshCw, ShieldCheck } from 'lucide-react';

type Member = { user_id: string; display_name: string; role: string };
type Template = { id: string; name: string; description: string; trigger_type: string; conditions: any[]; actions: any[]; status: string; version: number };
type Run = { id: string; template_id: string; trigger_type: string; trigger_payload: Record<string, unknown>; condition_results: any[]; proposed_actions: any[]; status: string; error_summary: string | null; created_at: string; decision_note: string };

const triggerLabels: Record<string, string> = {
  manual: 'Run manually', work_item_created: 'Work item created', work_item_status_changed: 'Work item status changes',
  lead_received: 'Inbound lead received', opportunity_stage_changed: 'Opportunity stage changes',
};

export default function WorkflowTemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [role, setRole] = useState('viewer');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [runInput, setRunInput] = useState<Record<string, string>>({});
  const [templateName, setTemplateName] = useState('');
  const [description, setDescription] = useState('');
  const [triggerType, setTriggerType] = useState('manual');
  const [conditionField, setConditionField] = useState('');
  const [conditionOperator, setConditionOperator] = useState('equals');
  const [conditionValue, setConditionValue] = useState('');
  const [actionTitle, setActionTitle] = useState('Follow up with {{accountName}}');
  const [actionDescription, setActionDescription] = useState('');
  const [workType, setWorkType] = useState('task');
  const [priority, setPriority] = useState('normal');
  const [dueInDays, setDueInDays] = useState('3');
  const [ownerId, setOwnerId] = useState('');
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError('');
    try {
      const [templateResponse, memberResponse] = await Promise.all([fetch('/api/workflow-templates'), fetch('/api/work-items')]);
      const [templateData, memberData] = await Promise.all([templateResponse.json(), memberResponse.json()]);
      if (!templateResponse.ok) throw new Error(templateData.error || 'Could not load workflow templates.');
      if (!memberResponse.ok) throw new Error(memberData.error || 'Could not load workspace members.');
      setTemplates(templateData.templates || []);
      setRuns(templateData.runs || []);
      setRole(templateData.role || 'viewer');
      setMembers(memberData.members || []);
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not load workflows.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const createTemplate = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true); setError(''); setNotice('');
    const conditions = conditionField.trim() ? [{ field: conditionField.trim(), operator: conditionOperator, value: conditionValue }] : [];
    const actions = [{ type: 'create_work_item', title: actionTitle, description: actionDescription, workType, priority, dueInDays: Number(dueInDays), ...(ownerId ? { ownerId } : {}) }];
    try {
      const response = await fetch('/api/workflow-templates', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: templateName, description, triggerType, conditions, actions, status: 'active' }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not create the template.');
      setNotice('Workflow template created and activated. Every run waits for manager review.');
      setTemplateName(''); setDescription('');
      await refresh();
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not create the template.'); }
    finally { setSaving(false); }
  };

  const updateTemplate = async (template: Template, status: string) => {
    setError('');
    try {
      const response = await fetch(`/api/workflow-templates/${template.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not update the template.');
      await refresh();
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not update the template.'); }
  };

  const runTemplate = async (template: Template) => {
    setError(''); setNotice('');
    try {
      let input: Record<string, unknown> = {};
      if (runInput[template.id]?.trim()) {
        const parsed = JSON.parse(runInput[template.id]);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Trigger data must be a JSON object.');
        input = parsed;
      }
      const response = await fetch(`/api/workflow-templates/${template.id}/run`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ input }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not run the template.');
      setNotice(data.run.status === 'skipped' ? 'Conditions did not match; the run was recorded as skipped.' : 'Run proposed. A manager must approve it before it creates work.');
      await refresh();
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not run the template.'); }
  };

  const reviewRun = async (run: Run, decision: 'approve' | 'reject') => {
    setError(''); setNotice('');
    try {
      const response = await fetch(`/api/workflow-runs/${run.id}/review`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ decision }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not review the workflow.');
      setNotice(decision === 'approve' ? 'Approved action applied.' : 'Workflow run rejected.');
      await refresh();
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not review the workflow.'); }
  };

  const templateNameFor = (templateId: string) => templates.find((template) => template.id === templateId)?.name || 'Workflow';
  const inputExamples: Record<string, string> = {
    manual: '{\n  "accountId": "<account-id>",\n  "accountName": "Acme"\n}',
    work_item_created: '{\n  "title": "Account review",\n  "workType": "task"\n}',
    work_item_status_changed: '{\n  "statusFrom": "open",\n  "statusTo": "completed"\n}',
    lead_received: '{\n  "accountName": "Acme",\n  "source": "website"\n}',
    opportunity_stage_changed: '{\n  "accountName": "Acme",\n  "stageFrom": "Discovery",\n  "stageTo": "Proposal"\n}',
  };

  return <main className="min-h-screen bg-[#f7f7f5] dark:bg-[#171916] text-[#20211f] dark:text-[#f1f2ee]">
    <div className="max-w-7xl mx-auto px-5 sm:px-8 py-10 sm:py-14">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-[#e8e9e5] dark:border-white/[0.08] pb-8">
        <div><p className="text-sm text-[#4f6653] dark:text-[#afc6ad] mb-2">Automation, with review</p><h1 className="text-4xl">Workflow templates</h1><p className="mt-3 text-sm text-[#777a74] dark:text-[#a2a69e]">Rules create proposed work items. A manager reviews every run before it changes the workspace.</p></div>
        <button onClick={() => void refresh()} className="rounded-lg border border-[#dfe2dc] dark:border-white/10 bg-white dark:bg-[#1e211d] p-2.5" title="Refresh"><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /></button>
      </header>

      {error && <p role="alert" className="mt-5 rounded-lg bg-red-50 dark:bg-red-950/30 px-4 py-3 text-sm text-red-700 dark:text-red-300">{error}</p>}
      {notice && <p role="status" className="mt-5 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-300">{notice}</p>}

      {['admin', 'manager'].includes(role) && <form onSubmit={createTemplate} className="mt-8 rounded-xl border border-[#e3e5e0] dark:border-white/[0.08] bg-white dark:bg-[#1e211d] p-5 sm:p-6">
        <h2 className="text-lg font-semibold">Create a template</h2>
        <p className="text-xs text-[#777a74] dark:text-[#a2a69e] mt-1">The first action is a proposed work item. Email sends and other external actions are not run automatically.</p>
        <div className="grid md:grid-cols-2 gap-4 mt-5">
          <label className="text-xs font-medium">Name<input required maxLength={160} value={templateName} onChange={(event) => setTemplateName(event.target.value)} placeholder="New lead follow-up" className="mt-1.5 w-full rounded-lg border border-[#dfe2dc] dark:border-white/10 bg-transparent px-3 py-2.5 text-sm" /></label>
          <label className="text-xs font-medium">Trigger<select value={triggerType} onChange={(event) => setTriggerType(event.target.value)} className="mt-1.5 w-full rounded-lg border border-[#dfe2dc] dark:border-white/10 bg-transparent px-3 py-2.5 text-sm">{Object.entries(triggerLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
          <label className="md:col-span-2 text-xs font-medium">Description<textarea rows={2} maxLength={1000} value={description} onChange={(event) => setDescription(event.target.value)} className="mt-1.5 w-full rounded-lg border border-[#dfe2dc] dark:border-white/10 bg-transparent px-3 py-2.5 text-sm" placeholder="When this happens, propose a follow-up for the account owner." /></label>
        </div>
        <div className="mt-5 p-4 rounded-lg bg-[#f7f8f5] dark:bg-white/[0.03]">
          <h3 className="text-sm font-medium">Optional condition (one rule, all rules must match)</h3>
          <div className="grid sm:grid-cols-[1fr_160px_1fr] gap-3 mt-3">
            <input value={conditionField} onChange={(event) => setConditionField(event.target.value)} placeholder="Payload field, e.g. statusTo" className="rounded-lg border border-[#dfe2dc] dark:border-white/10 bg-transparent px-3 py-2 text-sm" />
            <select value={conditionOperator} onChange={(event) => setConditionOperator(event.target.value)} className="rounded-lg border border-[#dfe2dc] dark:border-white/10 bg-transparent px-3 py-2 text-sm"><option value="equals">equals</option><option value="not_equals">does not equal</option><option value="contains">contains</option><option value="exists">exists</option></select>
            {conditionOperator !== 'exists' && <input value={conditionValue} onChange={(event) => setConditionValue(event.target.value)} placeholder="Value" className="rounded-lg border border-[#dfe2dc] dark:border-white/10 bg-transparent px-3 py-2 text-sm" />}
          </div>
        </div>
        <div className="mt-5 p-4 rounded-lg border border-[#e8e9e5] dark:border-white/[0.08]">
          <h3 className="text-sm font-medium">Proposed action</h3>
          <div className="grid md:grid-cols-2 gap-3 mt-3">
            <label className="text-xs">Work item title<input required maxLength={240} value={actionTitle} onChange={(event) => setActionTitle(event.target.value)} className="mt-1 w-full rounded-lg border border-[#dfe2dc] dark:border-white/10 bg-transparent px-3 py-2 text-sm" /></label>
            <label className="text-xs">Description<input maxLength={4000} value={actionDescription} onChange={(event) => setActionDescription(event.target.value)} placeholder="Optional context" className="mt-1 w-full rounded-lg border border-[#dfe2dc] dark:border-white/10 bg-transparent px-3 py-2 text-sm" /></label>
            <label className="text-xs">Type<select value={workType} onChange={(event) => setWorkType(event.target.value)} className="mt-1 w-full rounded-lg border border-[#dfe2dc] dark:border-white/10 bg-transparent px-3 py-2 text-sm">{[['task', 'Task'], ['follow_up', 'Follow up'], ['research', 'Research'], ['approval', 'Approval'], ['handoff', 'Handoff'], ['other', 'Other']].map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label className="text-xs">Priority<select value={priority} onChange={(event) => setPriority(event.target.value)} className="mt-1 w-full rounded-lg border border-[#dfe2dc] dark:border-white/10 bg-transparent px-3 py-2 text-sm">{['low', 'normal', 'high', 'urgent'].map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
            <label className="text-xs">Due in days<input type="number" min="0" max="365" value={dueInDays} onChange={(event) => setDueInDays(event.target.value)} className="mt-1 w-full rounded-lg border border-[#dfe2dc] dark:border-white/10 bg-transparent px-3 py-2 text-sm" /></label>
            <label className="text-xs">Owner<select value={ownerId} onChange={(event) => setOwnerId(event.target.value)} className="mt-1 w-full rounded-lg border border-[#dfe2dc] dark:border-white/10 bg-transparent px-3 py-2 text-sm"><option value="">Approving manager</option>{members.filter((member) => member.role !== 'viewer').map((member) => <option key={member.user_id} value={member.user_id}>{member.display_name}</option>)}</select></label>
          </div>
          <p className="mt-2 text-[11px] text-[#777a74]">Use {'{{accountName}}'} or another simple trigger field in the title or description.</p>
        </div>
        <button disabled={saving || !templateName.trim()} className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[#4f6653] hover:bg-[#405444] disabled:opacity-50 px-4 py-2.5 text-sm font-medium text-white"><Check className="w-4 h-4" />{saving ? 'Saving…' : 'Create active template'}</button>
      </form>}

      <section className="mt-10">
        <h2 className="text-lg font-semibold mb-4">Templates</h2>
        {loading ? <div className="py-10 flex justify-center"><LoaderCircle className="w-5 h-5 animate-spin" /></div> : templates.length === 0 ? <p className="rounded-xl border border-dashed border-[#d5d9d2] dark:border-white/15 p-8 text-sm text-[#777a74]">No workflow templates yet.</p> : <div className="grid lg:grid-cols-2 gap-4">{templates.map((template) => <article key={template.id} className="rounded-xl border border-[#e3e5e0] dark:border-white/[0.08] bg-white dark:bg-[#1e211d] p-5">
          <div className="flex justify-between gap-3"><div><h3 className="font-semibold">{template.name}</h3><p className="text-xs text-[#777a74] mt-1">{template.description || 'No description'} · v{template.version}</p></div><span className={`h-fit rounded-full px-2.5 py-1 text-[10px] uppercase ${template.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-[#f0f2ee] dark:bg-white/[0.08]'}`}>{template.status}</span></div>
          <div className="mt-4 text-xs space-y-1"><p><strong>Trigger:</strong> {triggerLabels[template.trigger_type] || template.trigger_type}</p><p><strong>Conditions:</strong> {template.conditions.length ? template.conditions.map((condition) => `${condition.field} ${condition.operator} ${condition.value ?? ''}`).join(' AND ') : 'Always'}</p><p><strong>Action:</strong> Create work item “{template.actions[0]?.title}”</p></div>
          {template.status === 'active' && template.trigger_type === 'manual' && <div className="mt-4 border-t border-[#e8e9e5] dark:border-white/[0.08] pt-3"><label className="text-[11px] text-[#777a74]">Trigger data (JSON, optional)<textarea rows={3} value={runInput[template.id] ?? inputExamples.manual} onChange={(event) => setRunInput((old) => ({ ...old, [template.id]: event.target.value }))} className="mt-1 w-full rounded-lg border border-[#dfe2dc] dark:border-white/10 bg-transparent px-3 py-2 font-mono text-xs" /></label><button onClick={() => void runTemplate(template)} className="mt-2 inline-flex items-center gap-2 rounded-lg bg-[#4f6653] px-3 py-2 text-xs text-white"><CirclePlay className="w-3.5 h-3.5" /> Propose run</button></div>}
          {['admin', 'manager'].includes(role) && <button onClick={() => void updateTemplate(template, template.status === 'active' ? 'paused' : 'active')} className="mt-4 inline-flex items-center gap-1.5 text-xs text-[#4f6653] dark:text-[#afc6ad]">{template.status === 'active' ? <><Pause className="w-3.5 h-3.5" />Pause template</> : <><Play className="w-3.5 h-3.5" />Activate template</>}</button>}
        </article>)}</div>}
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold flex items-center gap-2 mb-4"><ShieldCheck className="w-5 h-5 text-[#4f6653]" /> Review queue</h2>
        {runs.length === 0 ? <p className="rounded-xl border border-dashed border-[#d5d9d2] dark:border-white/15 p-8 text-sm text-[#777a74]">No workflow runs yet.</p> : <div className="space-y-3">{runs.map((run) => <article key={run.id} className="rounded-xl border border-[#e3e5e0] dark:border-white/[0.08] bg-white dark:bg-[#1e211d] p-5">
          <div className="flex flex-wrap justify-between gap-3"><div><h3 className="font-medium">{templateNameFor(run.template_id)}</h3><p className="text-xs text-[#777a74] mt-1">{triggerLabels[run.trigger_type] || run.trigger_type} · {new Date(run.created_at).toLocaleString()}</p></div><span className="rounded-full bg-[#f0f2ee] dark:bg-white/[0.08] px-2.5 py-1 h-fit text-[10px] uppercase">{run.status.replace('_', ' ')}</span></div>
          <div className="mt-3 text-xs"><p><strong>Proposed:</strong> {run.proposed_actions[0]?.title || 'Create work item'}</p><p><strong>Condition result:</strong> {run.status === 'skipped' ? 'Did not match' : `${run.condition_results.filter((condition) => condition.matched).length}/${run.condition_results.length} matched`}</p>{run.error_summary && <p className="mt-1 text-red-600">{run.error_summary}</p>}</div>
          {run.status === 'pending_review' && ['admin', 'manager'].includes(role) && <div className="mt-4 flex gap-2"><button onClick={() => void reviewRun(run, 'approve')} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 text-white px-3 py-2 text-xs"><Check className="w-3.5 h-3.5" />Approve and create work</button><button onClick={() => void reviewRun(run, 'reject')} className="rounded-lg border border-[#dfe2dc] dark:border-white/10 px-3 py-2 text-xs">Reject</button></div>}
        </article>)}</div>}
      </section>
    </div>
  </main>;
}
