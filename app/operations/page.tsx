'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, CalendarDays, CirclePlus, ClipboardCheck, LoaderCircle, RefreshCw, Wrench } from 'lucide-react';

type Account = { id: string; display_name: string };
type Member = { user_id: string; display_name: string; role: string };
type Partner = { id: string; name: string };
type Task = { id: string; title: string; status: string };
type OpsRecord = { id: string; record_type: string; title: string; body: string; status: string; priority: string; due_at: string | null; owner_id: string | null; owner_name: string | null; account_id: string | null; account: Account | null; partner_id: string | null; data: Record<string, any>; updated_at: string };
type OpsType = 'onboarding' | 'renewal' | 'health_review' | 'escalation' | 'vendor' | 'procurement' | 'service_request' | 'success_plan';
const typeLabels: Record<OpsType, string> = { onboarding: 'Onboarding', renewal: 'Renewals', health_review: 'Health reviews', escalation: 'Escalations', vendor: 'Vendors', procurement: 'Procurement', service_request: 'Service requests', success_plan: 'Success plans' };
const statuses: Record<OpsType, string[]> = {
  onboarding: ['open', 'in_progress', 'blocked', 'completed', 'cancelled'], renewal: ['open', 'in_progress', 'blocked', 'completed', 'cancelled'],
  health_review: ['open', 'in_progress', 'completed', 'cancelled'], escalation: ['open', 'in_progress', 'blocked', 'completed', 'cancelled'],
  vendor: ['open', 'active', 'paused', 'completed', 'cancelled'], procurement: ['open', 'in_progress', 'pending_approval', 'approved', 'completed', 'cancelled'],
  service_request: ['open', 'in_progress', 'blocked', 'completed', 'cancelled'], success_plan: ['draft', 'active', 'review', 'completed', 'cancelled'],
};

export default function OperationsPage() {
  const [tab, setTab] = useState<OpsType>('onboarding');
  const [records, setRecords] = useState<OpsRecord[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [role, setRole] = useState('viewer');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [accountId, setAccountId] = useState('');
  const [partnerId, setPartnerId] = useState('');
  const [ownerId, setOwnerId] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [priority, setPriority] = useState('normal');
  const [dataText, setDataText] = useState('');
  const [taskTitle, setTaskTitle] = useState<Record<string, string>>({});
  const [taskBlocker, setTaskBlocker] = useState<Record<string, string>>({});

  const refresh = useCallback(async () => {
    setError('');
    try {
      const [recordsResponse, tasksResponse] = await Promise.all([fetch('/api/workspace-records'), fetch('/api/work-items')]);
      const [data, taskData] = await Promise.all([recordsResponse.json(), tasksResponse.json()]);
      if (!recordsResponse.ok) throw new Error(data.error || 'Could not load operations records.');
      if (!tasksResponse.ok) throw new Error(taskData.error || 'Could not load work items.');
      setRecords(data.records || []); setAccounts(data.accounts || []); setMembers(data.members || []); setPartners(data.partners || []); setRole(data.role || 'viewer'); setTasks(taskData.items || []);
      setOwnerId((current) => current || data.members?.[0]?.user_id || '');
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not load operations.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  const visible = useMemo(() => records.filter((record) => record.record_type === tab), [records, tab]);
  const createRecord = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true); setError(''); setNotice('');
    let data: Record<string, unknown> = {};
    if (dataText.trim()) {
      try { data = JSON.parse(dataText); if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Details must be a JSON object.'); }
      catch (err) { setError(err instanceof Error ? err.message : 'Details must be valid JSON.'); setSaving(false); return; }
    }
    try {
      const response = await fetch('/api/workspace-records', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ recordType: tab, title, body, accountId: accountId || null, partnerId: partnerId || null, ownerId, dueAt: dueAt ? new Date(dueAt).toISOString() : null, priority, data }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not create the record.');
      setNotice(`${typeLabels[tab].slice(0, -1)} record created.`); setTitle(''); setBody(''); setAccountId(''); setPartnerId(''); setDueAt(''); setDataText(''); setShowForm(false);
      await refresh();
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not create the record.'); }
    finally { setSaving(false); }
  };

  const updateStatus = async (record: OpsRecord, status: string) => {
    setError('');
    try {
      const response = await fetch(`/api/workspace-records/${record.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not update the record.');
      await refresh();
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not update the record.'); }
  };

  const createTask = async (record: OpsRecord) => {
    if (!taskTitle[record.id]?.trim()) return;
    setError(''); setNotice('');
    try {
      const response = await fetch('/api/work-items', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
        title: taskTitle[record.id], description: `Milestone for ${typeLabels[tab].toLowerCase()}: ${record.title}`,
        workType: tab === 'renewal' ? 'follow_up' : 'task', priority: record.priority, dueAt: record.due_at,
        ownerId: record.owner_id, accountId: record.account_id, parentRecordId: record.id,
        blockedByWorkItemId: taskBlocker[record.id] || null,
      }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not add the milestone.');
      setTaskTitle((current) => ({ ...current, [record.id]: '' }));
      setTaskBlocker((current) => ({ ...current, [record.id]: '' }));
      setNotice('Milestone added to the shared work queue.'); await refresh();
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not add the milestone.'); }
  };

  const memberName = (userId: string | null) => members.find((member) => member.user_id === userId)?.display_name || 'Unassigned';
  const partnerName = (id: string | null) => partners.find((partner) => partner.id === id)?.name;

  return <main className="min-h-screen bg-[#f7f7f5] dark:bg-[#171916] text-[#20211f] dark:text-[#f1f2ee]"><div className="max-w-7xl mx-auto px-5 sm:px-8 py-10 sm:py-14">
    <header className="flex flex-wrap items-end justify-between gap-4 border-b border-[#e8e9e5] dark:border-white/[0.08] pb-8"><div><p className="text-sm text-[#4f6653] dark:text-[#afc6ad] mb-2">Cross-functional operations</p><h1 className="text-4xl">Operations</h1><p className="mt-3 text-sm text-[#777a74] dark:text-[#a2a69e]">Onboarding, renewals, account health, vendors, procurement, and customer service on the shared work queue.</p></div><div className="flex gap-2"><button onClick={() => void refresh()} className="rounded-lg border border-[#dfe2dc] dark:border-white/10 bg-white dark:bg-[#1e211d] p-2.5"><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /></button>{role !== 'viewer' && <button onClick={() => setShowForm((value) => !value)} className="inline-flex items-center gap-2 rounded-lg bg-[#4f6653] text-white px-4 py-2.5 text-sm"><CirclePlus className="w-4 h-4" /> New operations record</button>}</div></header>
    {error && <p role="alert" className="mt-5 rounded-lg bg-red-50 dark:bg-red-950/30 px-4 py-3 text-sm text-red-700 dark:text-red-300">{error}</p>}{notice && <p role="status" className="mt-5 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-300">{notice}</p>}

    {showForm && <form onSubmit={createRecord} className="mt-7 rounded-xl border border-[#e3e5e0] dark:border-white/[0.08] bg-white dark:bg-[#1e211d] p-5 sm:p-6"><h2 className="font-semibold">New {typeLabels[tab].toLowerCase().replace(/s$/, '')}</h2><div className="mt-4 grid md:grid-cols-2 gap-4">
      <label className="text-xs font-medium">Title<input required maxLength={240} value={title} onChange={(event) => setTitle(event.target.value)} className="mt-1.5 w-full rounded-lg border border-[#dfe2dc] dark:border-white/10 bg-transparent px-3 py-2.5 text-sm" placeholder={`${typeLabels[tab].replace(/s$/, '')} name`} /></label>
      <label className="text-xs font-medium">Account<select value={accountId} onChange={(event) => setAccountId(event.target.value)} className="mt-1.5 w-full rounded-lg border border-[#dfe2dc] dark:border-white/10 bg-transparent px-3 py-2.5 text-sm"><option value="">No linked account</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.display_name}</option>)}</select></label>
      {['vendor', 'procurement'].includes(tab) && <label className="text-xs font-medium">Partner or vendor<select value={partnerId} onChange={(event) => setPartnerId(event.target.value)} className="mt-1.5 w-full rounded-lg border border-[#dfe2dc] dark:border-white/10 bg-transparent px-3 py-2.5 text-sm"><option value="">No partner</option>{partners.map((partner) => <option key={partner.id} value={partner.id}>{partner.name}</option>)}</select></label>}
      <label className="text-xs font-medium">Owner<select value={ownerId} onChange={(event) => setOwnerId(event.target.value)} className="mt-1.5 w-full rounded-lg border border-[#dfe2dc] dark:border-white/10 bg-transparent px-3 py-2.5 text-sm">{members.filter((member) => member.role !== 'viewer').map((member) => <option key={member.user_id} value={member.user_id}>{member.display_name}</option>)}</select></label>
      <label className="text-xs font-medium">Due date<input type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} className="mt-1.5 w-full rounded-lg border border-[#dfe2dc] dark:border-white/10 bg-transparent px-3 py-2.5 text-sm" /></label>
      <label className="text-xs font-medium">Priority<select value={priority} onChange={(event) => setPriority(event.target.value)} className="mt-1.5 w-full rounded-lg border border-[#dfe2dc] dark:border-white/10 bg-transparent px-3 py-2.5 text-sm">{['low', 'normal', 'high', 'urgent'].map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
      <label className="md:col-span-2 text-xs font-medium">Plan notes<textarea rows={3} value={body} onChange={(event) => setBody(event.target.value)} placeholder="Scope, checklist, customer-facing steps, risk, or handoff details" className="mt-1.5 w-full rounded-lg border border-[#dfe2dc] dark:border-white/10 bg-transparent px-3 py-2.5 text-sm" /></label>
      <label className="md:col-span-2 text-xs font-medium">Structured details (optional JSON)<textarea rows={3} value={dataText} onChange={(event) => setDataText(event.target.value)} placeholder={'{"milestones":["Kickoff","Configuration","Launch"],"health":"green"}'} className="mt-1.5 w-full rounded-lg border border-[#dfe2dc] dark:border-white/10 bg-transparent px-3 py-2.5 font-mono text-xs" /></label>
    </div><div className="mt-3 text-xs text-[#777a74]">Use work items as milestones, checklists, and dependent steps. Link each task to this record from the card below.</div><button disabled={saving || !title.trim()} className="mt-4 rounded-lg bg-[#4f6653] text-white px-4 py-2.5 text-sm disabled:opacity-50">{saving ? 'Saving…' : 'Create record'}</button></form>}

    <nav className="mt-8 flex gap-1 overflow-x-auto border-b border-[#e8e9e5] dark:border-white/[0.08]">{(Object.keys(typeLabels) as OpsType[]).map((value) => <button key={value} onClick={() => { setTab(value); setShowForm(false); }} className={`whitespace-nowrap px-3 py-3 text-sm border-b-2 ${tab === value ? 'border-[#4f6653] text-[#4f6653] dark:text-[#afc6ad] font-medium' : 'border-transparent text-[#777a74]'}`}>{typeLabels[value]}</button>)}</nav>
    <section className="mt-5">{loading ? <div className="py-12 flex justify-center"><LoaderCircle className="w-5 h-5 animate-spin" /></div> : visible.length === 0 ? <div className="rounded-xl border border-dashed border-[#d5d9d2] dark:border-white/15 p-10 text-center text-sm text-[#777a74]">No {typeLabels[tab].toLowerCase()} records yet.</div> : <div className="space-y-3">{visible.map((record) => {
      const recordTasks = tasks.filter((task: any) => task.parent_record_id === record.id);
      return <article key={record.id} className="rounded-xl border border-[#e3e5e0] dark:border-white/[0.08] bg-white dark:bg-[#1e211d] p-5"><div className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold">{record.title}</h2><span className="rounded-full bg-[#f0f2ee] dark:bg-white/[0.08] px-2.5 py-1 text-[10px] uppercase">{record.status.replaceAll('_', ' ')}</span><span className="text-xs capitalize text-[#777a74]">{record.priority} priority</span></div><p className="mt-1 text-xs text-[#777a74]">{record.account?.display_name || 'No linked account'} · {memberName(record.owner_id)}{partnerName(record.partner_id) ? ` · ${partnerName(record.partner_id)}` : ''}{record.due_at ? ` · Due ${new Date(record.due_at).toLocaleDateString()}` : ''}</p></div>{role !== 'viewer' && <select aria-label={`Update ${record.title}`} value={record.status} onChange={(event) => void updateStatus(record, event.target.value)} className="rounded-lg border border-[#dfe2dc] dark:border-white/10 bg-transparent px-2 py-1.5 text-xs">{statuses[tab].map((value) => <option key={value} value={value}>{value.replaceAll('_', ' ')}</option>)}</select>}</div>
        {record.body && <p className="mt-4 whitespace-pre-wrap text-sm text-[#565a54] dark:text-[#c0c4bb]">{record.body}</p>}
        {!!Object.keys(record.data || {}).length && <pre className="mt-3 overflow-x-auto rounded-lg bg-[#f6f7f4] dark:bg-white/[0.04] p-3 text-[11px] text-[#62675f] dark:text-[#afb5ab]">{JSON.stringify(record.data, null, 2)}</pre>}
        {record.account_id && <a href={`/leads/${record.account_id}`} className="mt-3 inline-flex items-center gap-1 text-xs text-[#4f6653] dark:text-[#afc6ad]">Open linked account<ArrowUpRight className="w-3 h-3" /></a>}
        <div className="mt-4 border-t border-[#e8e9e5] dark:border-white/[0.08] pt-3"><h3 className="text-xs font-medium flex items-center gap-2"><ClipboardCheck className="w-3.5 h-3.5 text-[#4f6653]" /> Milestones and dependent work</h3>{recordTasks.map((task) => <p key={task.id} className="mt-2 pl-5 text-xs">{task.title} <span className="text-[#858981]">· {task.status}</span></p>)}{role !== 'viewer' && <div className="mt-3 grid sm:grid-cols-[1fr_1fr_auto] gap-2"><input value={taskTitle[record.id] || ''} onChange={(event) => setTaskTitle((old) => ({ ...old, [record.id]: event.target.value }))} placeholder="Add a milestone or next step" className="rounded-lg border border-[#dfe2dc] dark:border-white/10 bg-transparent px-3 py-2 text-xs" /><select value={taskBlocker[record.id] || ''} onChange={(event) => setTaskBlocker((old) => ({ ...old, [record.id]: event.target.value }))} className="rounded-lg border border-[#dfe2dc] dark:border-white/10 bg-transparent px-3 py-2 text-xs"><option value="">No dependency</option>{tasks.map((task) => <option key={task.id} value={task.id}>After: {task.title}</option>)}</select><button type="button" onClick={() => void createTask(record)} disabled={!taskTitle[record.id]?.trim()} className="rounded-lg bg-[#4f6653] px-3 py-2 text-xs text-white disabled:opacity-50"><Wrench className="inline w-3 h-3 mr-1" />Add task</button></div>}</div>
      </article>;
    })}</div>}</section>
    <div className="mt-8 rounded-lg bg-[#edf0ea] dark:bg-white/[0.04] px-4 py-3 text-xs text-[#5f665d] dark:text-[#aeb5a9] flex gap-2"><CalendarDays className="w-4 h-4 shrink-0" /> Owners, due dates, dependencies, checklists, approvals, and attachments all use the shared work queue and history.</div>
  </div></main>;
}
