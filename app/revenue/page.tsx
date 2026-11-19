'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, CalendarDays, CirclePlus, LoaderCircle, RefreshCw, Save, Target } from 'lucide-react';

type Account = { id: string; display_name: string; city: string; business_type: string };
type Member = { user_id: string; display_name: string; role: string };
type Contact = { id: string; business_id: string; contact_name: string | null; job_title: string | null; email_address: string | null };
type RecordRow = { id: string; record_type: string; title: string; body: string; status: string; stage: string | null; priority: string; amount: number | null; probability: number | null; currency: string; close_date: string | null; due_at: string | null; meeting_at: string | null; source: string | null; owner_id: string | null; owner_name: string | null; account_id: string | null; account: Account | null; contact_id: string | null; data: Record<string, any>; updated_at: string };
type Tab = 'account_plan' | 'meeting' | 'relationship' | 'inbound_lead' | 'opportunity' | 'proposal' | 'outcome';
const tabLabels: Record<Tab, string> = { account_plan: 'Account plans', meeting: 'Meetings', relationship: 'Relationships', inbound_lead: 'Inbound leads', opportunity: 'Pipeline', proposal: 'Proposals', outcome: 'Outcomes' };
const statusOptions: Record<Tab, string[]> = {
  account_plan: ['draft', 'active', 'review'], meeting: ['scheduled', 'held', 'cancelled'], relationship: ['active', 'inactive'], inbound_lead: ['new', 'qualifying', 'qualified', 'disqualified', 'routed'],
  opportunity: ['discovery', 'qualification', 'demo', 'proposal', 'negotiation', 'closed_won', 'closed_lost', 'paused'], proposal: ['draft', 'pending_approval', 'approved', 'accepted', 'rejected'], outcome: ['won', 'lost', 'no_decision'],
};

export default function RevenuePage() {
  const [tab, setTab] = useState<Tab>('inbound_lead');
  const [records, setRecords] = useState<RecordRow[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [role, setRole] = useState('viewer');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [accountId, setAccountId] = useState('');
  const [contactId, setContactId] = useState('');
  const [ownerId, setOwnerId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [meetingDate, setMeetingDate] = useState('');
  const [closeDate, setCloseDate] = useState('');
  const [source, setSource] = useState('');
  const [amount, setAmount] = useState('');
  const [probability, setProbability] = useState('');
  const [stage, setStage] = useState('discovery');
  const [formDataText, setFormDataText] = useState('');
  const [nextStepTitle, setNextStepTitle] = useState<Record<string, string>>({});

  const refresh = useCallback(async () => {
    setError('');
    try {
      const response = await fetch('/api/workspace-records');
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not load account workspace records.');
      setRecords(data.records || []); setAccounts(data.accounts || []); setMembers(data.members || []); setContacts(data.contacts || []); setRole(data.role || 'viewer');
      setOwnerId((current) => current || data.members?.[0]?.user_id || '');
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not load workspace records.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  const visibleRecords = useMemo(() => records.filter((record) => record.record_type === tab), [records, tab]);
  const opportunities = records.filter((record) => record.record_type === 'opportunity');
  const forecast = opportunities.reduce((sum, item) => sum + Number(item.amount || 0) * Number(item.probability || 0) / 100, 0);
  const closedWon = opportunities.filter((item) => item.status === 'closed_won').reduce((sum, item) => sum + Number(item.amount || 0), 0);

  const createRecord = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true); setError(''); setNotice('');
    let data: Record<string, unknown> = {};
    if (formDataText.trim()) {
      try { data = JSON.parse(formDataText); if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Details must be a JSON object.'); }
      catch (err) { setError(err instanceof Error ? err.message : 'Details must be valid JSON.'); setSaving(false); return; }
    }
    const payload: Record<string, unknown> = { recordType: tab, title, body, accountId: accountId || null, ownerId: ownerId || null, dueAt: dueDate ? new Date(dueDate).toISOString() : null, meetingAt: meetingDate ? new Date(meetingDate).toISOString() : null, closeDate: closeDate || null, source: source || null, amount: amount || null, probability: probability || null, data };
    if (tab === 'relationship') payload.contactId = contactId || null;
    if (tab === 'opportunity') { payload.stage = stage; payload.status = stage; }
    if (tab === 'outcome') payload.status = stage;
    if (tab === 'meeting' && !payload.meetingAt) payload.meetingAt = dueDate || null;
    try {
      const response = await fetch('/api/workspace-records', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not create the record.');
      setNotice(tab === 'inbound_lead' ? `Lead received${result.followUpCreated ? '; follow-up added to the SLA queue.' : '.'}` : `${tabLabels[tab].slice(0, -1)} created.`);
      setTitle(''); setBody(''); setSource(''); setAmount(''); setProbability(''); setDueDate(''); setMeetingDate(''); setCloseDate(''); setFormDataText(''); setShowForm(false);
      await refresh();
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not create the record.'); }
    finally { setSaving(false); }
  };

  const updateRecord = async (record: RecordRow, updates: Record<string, unknown>) => {
    setError(''); setNotice('');
    try {
      const response = await fetch(`/api/workspace-records/${record.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updates) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not update record.');
      await refresh();
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not update record.'); }
  };

  const createNextStep = async (record: RecordRow) => {
    const nextTitle = nextStepTitle[record.id]?.trim();
    if (!nextTitle) return;
    setError('');
    try {
      const response = await fetch('/api/work-items', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
        title: nextTitle, workType: record.record_type === 'meeting' || record.record_type === 'inbound_lead' ? 'follow_up' : 'task',
        accountId: record.account_id, ownerId: record.owner_id, parentRecordId: record.id,
      }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not add the next step.');
      setNextStepTitle((old) => ({ ...old, [record.id]: '' }));
      setNotice('Next step added to the shared work queue.');
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not add the next step.'); }
  };

  const labelFor = (record: RecordRow) => record.account?.display_name || record.data?.companyName || 'Unlinked account';
  const manager = ['admin', 'manager'].includes(role);
  const showsRevenueFields = ['opportunity', 'proposal', 'outcome'].includes(tab);
  const titlePlaceholder: Record<Tab, string> = {
    account_plan: 'FY27 enterprise account plan', meeting: 'Quarterly review', relationship: 'Economic buyer', inbound_lead: 'New website inquiry',
    opportunity: 'Expansion opportunity', proposal: 'Implementation proposal', outcome: 'Q4 expansion outcome',
  };

  return <main className="min-h-screen bg-[#f7f7f5] dark:bg-[#171916] text-[#20211f] dark:text-[#f1f2ee]">
    <div className="max-w-7xl mx-auto px-5 sm:px-8 py-10 sm:py-14">
      <header className="flex flex-wrap justify-between items-end gap-4 border-b border-[#e8e9e5] dark:border-white/[0.08] pb-8">
        <div><p className="text-sm text-[#4f6653] dark:text-[#afc6ad] mb-2">Accounts and revenue</p><h1 className="text-4xl">Revenue workspace</h1><p className="mt-3 text-sm text-[#777a74] dark:text-[#a2a69e]">Plans, relationships, lead routing, opportunities, proposals, and outcomes in one account-linked record.</p></div>
        <div className="flex gap-2"><button onClick={() => void refresh()} className="rounded-lg border border-[#dfe2dc] dark:border-white/10 bg-white dark:bg-[#1e211d] p-2.5" title="Refresh"><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /></button>{role !== 'viewer' && <button onClick={() => setShowForm((value) => !value)} className="inline-flex items-center gap-2 rounded-lg bg-[#4f6653] text-white px-4 py-2.5 text-sm"><CirclePlus className="w-4 h-4" /> New record</button>}</div>
      </header>
      {error && <p role="alert" className="mt-5 rounded-lg bg-red-50 dark:bg-red-950/30 px-4 py-3 text-sm text-red-700 dark:text-red-300">{error}</p>}
      {notice && <p role="status" className="mt-5 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-300">{notice}</p>}

      <section className="mt-7 grid sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-[#e3e5e0] dark:border-white/[0.08] bg-white dark:bg-[#1e211d] p-5"><p className="text-xs text-[#777a74]">Open opportunities</p><p className="mt-2 text-2xl font-semibold">{opportunities.filter((item) => !['closed_won', 'closed_lost'].includes(item.status)).length}</p></div>
        <div className="rounded-xl border border-[#e3e5e0] dark:border-white/[0.08] bg-white dark:bg-[#1e211d] p-5"><p className="text-xs text-[#777a74]">Weighted forecast</p><p className="mt-2 text-2xl font-semibold">{forecast.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}</p></div>
        <div className="rounded-xl border border-[#e3e5e0] dark:border-white/[0.08] bg-white dark:bg-[#1e211d] p-5"><p className="text-xs text-[#777a74]">Closed won</p><p className="mt-2 text-2xl font-semibold">{closedWon.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}</p></div>
      </section>

      {showForm && <form onSubmit={createRecord} className="mt-7 rounded-xl border border-[#e3e5e0] dark:border-white/[0.08] bg-white dark:bg-[#1e211d] p-5 sm:p-6">
        <div className="flex items-center justify-between"><h2 className="font-semibold">New {tabLabels[tab].replace(/s$/, '').toLowerCase()}</h2><button type="button" onClick={() => setShowForm(false)} className="text-xs text-[#777a74]">Close</button></div>
        <div className="grid md:grid-cols-2 gap-4 mt-5">
          <label className="text-xs font-medium">Title<input required maxLength={240} value={title} onChange={(event) => setTitle(event.target.value)} placeholder={titlePlaceholder[tab]} className="mt-1.5 w-full rounded-lg border border-[#dfe2dc] dark:border-white/10 bg-transparent px-3 py-2.5 text-sm" /></label>
          <label className="text-xs font-medium">Account<select value={accountId} onChange={(event) => { setAccountId(event.target.value); setContactId(''); }} className="mt-1.5 w-full rounded-lg border border-[#dfe2dc] dark:border-white/10 bg-transparent px-3 py-2.5 text-sm"><option value="">No linked account</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.display_name}</option>)}</select></label>
          {tab === 'relationship' && <label className="text-xs font-medium">Contact<select required value={contactId} onChange={(event) => setContactId(event.target.value)} className="mt-1.5 w-full rounded-lg border border-[#dfe2dc] dark:border-white/10 bg-transparent px-3 py-2.5 text-sm"><option value="">Choose account contact</option>{contacts.filter((contact) => contact.business_id === accountId).map((contact) => <option key={contact.id} value={contact.id}>{contact.contact_name || contact.email_address || 'Contact'}{contact.job_title ? ` · ${contact.job_title}` : ''}</option>)}</select></label>}
          <label className="text-xs font-medium">Owner<select value={ownerId} onChange={(event) => setOwnerId(event.target.value)} className="mt-1.5 w-full rounded-lg border border-[#dfe2dc] dark:border-white/10 bg-transparent px-3 py-2.5 text-sm">{members.filter((member) => member.role !== 'viewer').map((member) => <option key={member.user_id} value={member.user_id}>{member.display_name}</option>)}</select></label>
          {tab === 'inbound_lead' && <><label className="text-xs font-medium">Lead source<input value={source} onChange={(event) => setSource(event.target.value)} placeholder="Website, referral, event" className="mt-1.5 w-full rounded-lg border border-[#dfe2dc] dark:border-white/10 bg-transparent px-3 py-2.5 text-sm" /></label><label className="text-xs font-medium">Response due<input type="datetime-local" value={dueDate} onChange={(event) => setDueDate(event.target.value)} className="mt-1.5 w-full rounded-lg border border-[#dfe2dc] dark:border-white/10 bg-transparent px-3 py-2.5 text-sm" /><span className="block mt-1 text-[10px] text-[#777a74]">Defaults to a 24-hour response SLA.</span></label></>}
          {tab === 'meeting' && <label className="text-xs font-medium">Meeting time<input type="datetime-local" value={meetingDate} onChange={(event) => setMeetingDate(event.target.value)} className="mt-1.5 w-full rounded-lg border border-[#dfe2dc] dark:border-white/10 bg-transparent px-3 py-2.5 text-sm" /></label>}
          {showsRevenueFields && <><label className="text-xs font-medium">Amount<input type="number" min="0" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} className="mt-1.5 w-full rounded-lg border border-[#dfe2dc] dark:border-white/10 bg-transparent px-3 py-2.5 text-sm" /></label><label className="text-xs font-medium">Probability (%)<input type="number" min="0" max="100" value={probability} onChange={(event) => setProbability(event.target.value)} className="mt-1.5 w-full rounded-lg border border-[#dfe2dc] dark:border-white/10 bg-transparent px-3 py-2.5 text-sm" /></label></>}
          {tab === 'opportunity' && <><label className="text-xs font-medium">Stage<select value={stage} onChange={(event) => setStage(event.target.value)} className="mt-1.5 w-full rounded-lg border border-[#dfe2dc] dark:border-white/10 bg-transparent px-3 py-2.5 text-sm">{statusOptions.opportunity.map((value) => <option key={value} value={value}>{value.replaceAll('_', ' ')}</option>)}</select></label><label className="text-xs font-medium">Expected close date<input type="date" value={closeDate} onChange={(event) => setCloseDate(event.target.value)} className="mt-1.5 w-full rounded-lg border border-[#dfe2dc] dark:border-white/10 bg-transparent px-3 py-2.5 text-sm" /></label></>}
          {['account_plan', 'proposal', 'outcome'].includes(tab) && <label className="md:col-span-2 text-xs font-medium">{tab === 'proposal' ? 'Scope or executive summary' : tab === 'outcome' ? 'Outcome notes' : 'Plan summary, objectives, and risks'}<textarea rows={4} value={body} onChange={(event) => setBody(event.target.value)} placeholder="Add the approved account context and next steps." className="mt-1.5 w-full rounded-lg border border-[#dfe2dc] dark:border-white/10 bg-transparent px-3 py-2.5 text-sm" /></label>}
          {['meeting', 'inbound_lead', 'relationship'].includes(tab) && <label className="md:col-span-2 text-xs font-medium">{tab === 'meeting' ? 'Meeting notes and next steps' : tab === 'relationship' ? 'Relationship notes' : 'Lead details and qualification notes'}<textarea rows={4} value={body} onChange={(event) => setBody(event.target.value)} className="mt-1.5 w-full rounded-lg border border-[#dfe2dc] dark:border-white/10 bg-transparent px-3 py-2.5 text-sm" /></label>}
          {['account_plan', 'relationship'].includes(tab) && <label className="md:col-span-2 text-xs font-medium">Structured details (JSON, optional)<textarea rows={3} value={formDataText} onChange={(event) => setFormDataText(event.target.value)} placeholder={tab === 'relationship' ? '{"influence":"high","buyingRole":"champion"}' : '{"objectives":["..."],"risks":["..."],"nextSteps":["..."]}'} className="mt-1.5 w-full rounded-lg border border-[#dfe2dc] dark:border-white/10 bg-transparent px-3 py-2.5 font-mono text-xs" /></label>}
        </div>
        {tab === 'proposal' && <p className="mt-3 text-xs text-[#777a74]">Evee creates a proposal draft from the linked account’s approved name and location, plus this scope. A manager must approve it before it can be marked ready to share.</p>}
        {tab === 'opportunity' && <p className="mt-3 text-xs text-[#777a74]">Closing an opportunity as won or lost requires manager approval. Forecast is amount multiplied by probability.</p>}
        <button disabled={saving || !title.trim()} className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[#4f6653] text-white px-4 py-2.5 text-sm disabled:opacity-50"><Save className="w-4 h-4" />{saving ? 'Saving…' : 'Create record'}</button>
      </form>}

      <nav aria-label="Revenue workspace sections" className="mt-8 flex gap-1 overflow-x-auto border-b border-[#e8e9e5] dark:border-white/[0.08]">{(Object.keys(tabLabels) as Tab[]).map((value) => <button key={value} onClick={() => { setTab(value); setShowForm(false); }} className={`whitespace-nowrap px-3 py-3 text-sm border-b-2 ${tab === value ? 'border-[#4f6653] text-[#4f6653] dark:text-[#afc6ad] font-medium' : 'border-transparent text-[#777a74]'}`}>{tabLabels[value]}</button>)}</nav>
      <section className="mt-5">
        {loading ? <div className="py-12 flex justify-center"><LoaderCircle className="w-5 h-5 animate-spin" /></div> : visibleRecords.length === 0 ? <div className="rounded-xl border border-dashed border-[#d5d9d2] dark:border-white/15 p-10 text-center text-sm text-[#777a74]">No {tabLabels[tab].toLowerCase()} yet.</div> : <div className="space-y-3">{visibleRecords.map((record) => <article key={record.id} className="rounded-xl border border-[#e3e5e0] dark:border-white/[0.08] bg-white dark:bg-[#1e211d] p-5">
          <div className="flex flex-wrap items-start justify-between gap-4"><div className="min-w-0"><div className="flex items-center gap-2"><h2 className="font-semibold">{record.title}</h2><span className="rounded-full bg-[#f0f2ee] dark:bg-white/[0.08] px-2.5 py-1 text-[10px] uppercase">{record.status.replaceAll('_', ' ')}</span></div><p className="mt-1 text-xs text-[#777a74] dark:text-[#a2a69e]">{labelFor(record)} · {record.owner_name || 'Unassigned'} · Updated {new Date(record.updated_at).toLocaleDateString()}</p></div>
            {(tab === 'inbound_lead' || tab === 'account_plan' || tab === 'meeting' || tab === 'relationship') && role !== 'viewer' && <select aria-label={`Update ${record.title}`} value={record.status} onChange={(event) => void updateRecord(record, { status: event.target.value })} className="rounded-lg border border-[#dfe2dc] dark:border-white/10 bg-transparent px-2 py-1.5 text-xs">{statusOptions[tab].map((value) => <option key={value} value={value}>{value.replaceAll('_', ' ')}</option>)}</select>}
            {tab === 'opportunity' && role !== 'viewer' && <select aria-label={`Update stage for ${record.title}`} value={record.stage || record.status} onChange={(event) => void updateRecord(record, { stage: event.target.value.replaceAll('_', ' '), status: event.target.value })} className="rounded-lg border border-[#dfe2dc] dark:border-white/10 bg-transparent px-2 py-1.5 text-xs">{statusOptions.opportunity.filter((value) => manager || !['closed_won', 'closed_lost'].includes(value)).map((value) => <option key={value} value={value}>{value.replaceAll('_', ' ')}</option>)}</select>}
            {tab === 'proposal' && role !== 'viewer' && <select aria-label={`Update proposal ${record.title}`} value={record.status} disabled={!manager && ['approved', 'accepted'].includes(record.status)} onChange={(event) => void updateRecord(record, { status: event.target.value })} className="rounded-lg border border-[#dfe2dc] dark:border-white/10 bg-transparent px-2 py-1.5 text-xs">{statusOptions.proposal.filter((value) => manager || !['approved', 'accepted'].includes(value)).map((value) => <option key={value} value={value}>{value.replaceAll('_', ' ')}</option>)}</select>}
          </div>
          {record.body && <p className="mt-4 whitespace-pre-wrap text-sm text-[#565a54] dark:text-[#c0c4bb]">{record.body}</p>}
          <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs text-[#777a74] dark:text-[#a2a69e]">{record.stage && <span className="capitalize">Stage: {record.stage}</span>}{record.amount !== null && <span>{Number(record.amount).toLocaleString(undefined, { style: 'currency', currency: record.currency || 'USD', maximumFractionDigits: 0 })} · {record.probability ?? 0}%</span>}{record.close_date && <span className="inline-flex items-center gap-1"><CalendarDays className="w-3.5 h-3.5" />Close {new Date(record.close_date).toLocaleDateString()}</span>}{record.due_at && <span className="inline-flex items-center gap-1"><CalendarDays className="w-3.5 h-3.5" />Due {new Date(record.due_at).toLocaleString()}</span>}{record.source && <span>Source: {record.source}</span>}{record.account_id && <a href={`/leads/${record.account_id}`} className="inline-flex items-center gap-1 text-[#4f6653] dark:text-[#afc6ad]">Open account<ArrowUpRight className="w-3 h-3" /></a>}</div>
          {record.record_type === 'relationship' && <p className="mt-2 text-xs text-[#777a74]">{record.data?.buyingRole || 'Relationship'}{record.data?.influence ? ` · ${record.data.influence} influence` : ''}</p>}
          {role !== 'viewer' && <form onSubmit={(event) => { event.preventDefault(); void createNextStep(record); }} className="mt-4 flex gap-2 border-t border-[#e8e9e5] dark:border-white/[0.08] pt-3"><input value={nextStepTitle[record.id] || ''} onChange={(event) => setNextStepTitle((old) => ({ ...old, [record.id]: event.target.value }))} placeholder="Add an account next step" className="min-w-0 flex-1 rounded-lg border border-[#dfe2dc] dark:border-white/10 bg-transparent px-3 py-2 text-xs" /><button disabled={!nextStepTitle[record.id]?.trim()} className="rounded-lg border border-[#dfe2dc] dark:border-white/10 px-3 py-2 text-xs disabled:opacity-50">Add to work queue</button></form>}
        </article>)}</div>}
      </section>
      <div className="mt-8 rounded-lg bg-[#edf0ea] dark:bg-white/[0.04] px-4 py-3 text-xs text-[#5f665d] dark:text-[#aeb5a9] flex gap-2"><Target className="w-4 h-4 shrink-0" /> Records are tenant-scoped. Proposal content starts as a draft; opportunity closure and proposal approval require a manager.</div>
    </div>
  </main>;
}
