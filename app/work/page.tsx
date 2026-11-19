'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, CalendarDays, Check, ChevronDown, CirclePlus, FileText, ListChecks, ListTodo, LoaderCircle, MessageCircle, Paperclip, RefreshCw, Send, ShieldCheck, Trash2 } from 'lucide-react';

type Member = { user_id: string; role: string; display_name: string };
type Account = { id: string; display_name: string };
type WorkItem = {
  id: string; title: string; description: string; work_type: string; status: string; priority: string;
  due_at: string | null; account_id: string | null; account_name: string | null; owner_id: string | null;
  collaborator_ids: string[]; created_by: string;
};
type Comment = { id: string; body: string; author_id: string; author_name: string; created_at: string; mention_ids: string[] };
type ChecklistItem = { id: string; title: string; checklist_name: string; is_complete: boolean };
type Approval = { id: string; status: string; request_note: string; decision_note: string; requested_by_name: string; approver_name: string | null; requested_at: string };
type Attachment = { id: string; file_name: string; file_size: number; content_type: string; uploaded_by: string; created_at: string };
type WorkItemDetails = { comments: Comment[]; checklist: ChecklistItem[]; approvals: Approval[]; userId: string; role: string; attachments: Attachment[] };

const statusLabels: Record<string, string> = { open: 'Open', in_progress: 'In progress', blocked: 'Blocked', completed: 'Completed', cancelled: 'Cancelled' };
const typeLabels: Record<string, string> = { task: 'Task', follow_up: 'Follow up', research: 'Research', approval: 'Approval', handoff: 'Handoff', other: 'Other' };

export default function WorkPage() {
  const [items, setItems] = useState<WorkItem[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [userId, setUserId] = useState('');
  const [role, setRole] = useState('viewer');
  const [filter, setFilter] = useState<'team' | 'mine'>('team');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [workType, setWorkType] = useState('task');
  const [priority, setPriority] = useState('normal');
  const [dueAt, setDueAt] = useState('');
  const [ownerId, setOwnerId] = useState('');
  const [accountId, setAccountId] = useState('');
  const [collaboratorIds, setCollaboratorIds] = useState<string[]>([]);
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, WorkItemDetails>>({});
  const [commentDraft, setCommentDraft] = useState<Record<string, string>>({});
  const [mentionDraft, setMentionDraft] = useState<Record<string, string[]>>({});
  const [checklistDraft, setChecklistDraft] = useState<Record<string, string>>({});
  const [approvalNote, setApprovalNote] = useState<Record<string, string>>({});
  const [approvalOwner, setApprovalOwner] = useState<Record<string, string>>({});
  const [uploadingItem, setUploadingItem] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError('');
    try {
      const response = await fetch(`/api/work-items${filter === 'mine' ? '?ownerId=me' : ''}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not load work items.');
      setItems(data.items || []);
      setMembers(data.members || []);
      setAccounts(data.accounts || []);
      setUserId(data.userId || '');
      setRole(data.role || 'viewer');
      setOwnerId((current) => current || data.userId || '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load work items.');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { void refresh(); }, [refresh]);

  const createItem = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setNotice('');
    setError('');
    try {
      const response = await fetch('/api/work-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description, workType, priority, dueAt: dueAt || null, ownerId: ownerId || userId, accountId: accountId || null, collaboratorIds }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not create the work item.');
      setTitle(''); setDescription(''); setDueAt(''); setAccountId(''); setCollaboratorIds([]);
      setNotice('Work item created.');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the work item.');
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (item: WorkItem, status: string) => {
    setError(''); setNotice('');
    try {
      const response = await fetch(`/api/work-items/${item.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not update the work item.');
      setNotice(status === 'completed' ? 'Work item completed.' : 'Work item updated.');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update the work item.');
    }
  };

  const loadDetails = async (itemId: string) => {
    const [collaborationResponse, attachmentResponse] = await Promise.all([
      fetch(`/api/work-items/${itemId}/collaboration`),
      fetch(`/api/work-items/${itemId}/attachments`),
    ]);
    const [collaborationData, attachmentData] = await Promise.all([collaborationResponse.json(), attachmentResponse.json()]);
    if (!collaborationResponse.ok) throw new Error(collaborationData.error || 'Could not load work item details.');
    if (!attachmentResponse.ok) throw new Error(attachmentData.error || 'Could not load attachments.');
    setDetails((current) => ({ ...current, [itemId]: { ...collaborationData, attachments: attachmentData.attachments || [] } }));
  };

  const toggleDetails = async (itemId: string) => {
    setError('');
    if (expandedItem === itemId) { setExpandedItem(null); return; }
    setExpandedItem(itemId);
    try { await loadDetails(itemId); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not load work item details.'); }
  };

  const collaborationAction = async (itemId: string, body: Record<string, unknown>) => {
    setError(''); setNotice('');
    try {
      const response = await fetch(`/api/work-items/${itemId}/collaboration`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not update this work item.');
      await loadDetails(itemId);
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update this work item.');
      return null;
    }
  };

  const uploadAttachment = async (itemId: string, file?: File) => {
    if (!file) return;
    setUploadingItem(itemId); setError('');
    try {
      const body = new FormData(); body.set('file', file);
      const response = await fetch(`/api/work-items/${itemId}/attachments`, { method: 'POST', body });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not upload the attachment.');
      await loadDetails(itemId);
      setNotice('Attachment uploaded.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not upload the attachment.');
    } finally { setUploadingItem(null); }
  };

  const removeAttachment = async (itemId: string, attachmentId: string) => {
    setError('');
    try {
      const response = await fetch(`/api/work-items/${itemId}/attachments?attachmentId=${encodeURIComponent(attachmentId)}`, { method: 'DELETE' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not remove the attachment.');
      await loadDetails(itemId);
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not remove the attachment.'); }
  };

  const memberLabel = (id: string | null) => members.find((member) => member.user_id === id)?.display_name || 'Unassigned';
  const isOverdue = (due: string | null, status: string) => due && !['completed', 'cancelled'].includes(status) && new Date(due).getTime() < Date.now();

  return (
    <main className="min-h-screen bg-[#f7f7f5] dark:bg-[#171916] text-[#20211f] dark:text-[#f1f2ee]">
      <div className="max-w-7xl mx-auto px-5 sm:px-8 py-10 sm:py-14">
        <header className="flex flex-wrap items-end justify-between gap-5 border-b border-[#e8e9e5] dark:border-white/[0.08] pb-8">
          <div>
            <p className="text-sm text-[#4f6653] dark:text-[#afc6ad] mb-2">Shared workspace</p>
            <h1 className="text-4xl">Work</h1>
            <p className="text-sm text-[#777a74] dark:text-[#a2a69e] mt-3">Coordinate tasks, follow ups, research, and handoffs around your accounts.</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setFilter('team')} className={`px-3 py-2 rounded-lg border text-sm ${filter === 'team' ? 'bg-[#4f6653] border-[#4f6653] text-white' : 'bg-white dark:bg-[#1e211d] border-[#dfe2dc] dark:border-white/10'}`}>Team queue</button>
            <button onClick={() => setFilter('mine')} className={`px-3 py-2 rounded-lg border text-sm ${filter === 'mine' ? 'bg-[#4f6653] border-[#4f6653] text-white' : 'bg-white dark:bg-[#1e211d] border-[#dfe2dc] dark:border-white/10'}`}>My work</button>
            <button onClick={() => void refresh()} title="Refresh work items" className="p-2.5 rounded-lg border border-[#dfe2dc] dark:border-white/10 bg-white dark:bg-[#1e211d]"><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /></button>
          </div>
        </header>

        {error && <p role="alert" className="mt-5 rounded-lg bg-red-50 dark:bg-red-950/30 px-4 py-3 text-sm text-red-700 dark:text-red-300">{error}</p>}
        {notice && <p role="status" className="mt-5 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-300">{notice}</p>}

        <div className="grid xl:grid-cols-[minmax(0,1fr)_360px] gap-8 mt-8 items-start">
          <section aria-label="Work items">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-lg flex items-center gap-2"><ListTodo className="w-5 h-5 text-[#4f6653]" /> {filter === 'mine' ? 'Assigned to me' : 'Team work'}</h2>
              <span className="text-xs text-[#777a74] dark:text-[#a2a69e]">{items.length} items</span>
            </div>
            {loading ? <div className="py-12 flex justify-center"><LoaderCircle className="w-5 h-5 animate-spin" /></div> : items.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[#d5d9d2] dark:border-white/15 p-10 text-center text-sm text-[#777a74] dark:text-[#a2a69e]">Nothing in this queue yet. Add a work item to give the team a clear next step.</div>
            ) : <div className="space-y-3">{items.map((item) => (
              <article key={item.id} className="rounded-xl border border-[#e3e5e0] dark:border-white/[0.08] bg-white dark:bg-[#1e211d] p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className={`font-medium ${item.status === 'completed' ? 'line-through text-[#858981]' : ''}`}>{item.title}</h3>
                    {item.description && <p className="mt-1.5 text-sm text-[#777a74] dark:text-[#a2a69e] whitespace-pre-wrap">{item.description}</p>}
                  </div>
                  <select aria-label={`Status for ${item.title}`} disabled={role === 'viewer' || (role === 'operator' && item.created_by !== userId && item.owner_id !== userId)} value={item.status} onChange={(event) => void updateStatus(item, event.target.value)} className="rounded-lg border border-[#dfe2dc] dark:border-white/10 bg-transparent px-2.5 py-1.5 text-xs disabled:opacity-60">
                    {Object.entries(statusLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                  </select>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-[#777a74] dark:text-[#a2a69e]">
                  <span className="rounded-full bg-[#f0f2ee] dark:bg-white/[0.06] px-2.5 py-1">{typeLabels[item.work_type] || 'Task'}</span>
                  <span className="capitalize">{item.priority} priority</span>
                  <span>Owner: {memberLabel(item.owner_id)}</span>
                  {item.due_at && <span className={`inline-flex items-center gap-1 ${isOverdue(item.due_at, item.status) ? 'text-red-600 dark:text-red-400 font-medium' : ''}`}><CalendarDays className="w-3.5 h-3.5" />{new Date(item.due_at).toLocaleDateString()}</span>}
                  {item.account_id && <Link href={`/leads/${item.account_id}`} className="inline-flex items-center gap-1 text-[#4f6653] dark:text-[#afc6ad] hover:underline">{item.account_name || 'Account'}<ArrowUpRight className="w-3 h-3" /></Link>}
                  {item.collaborator_ids.length > 0 && <span>{item.collaborator_ids.length} collaborator{item.collaborator_ids.length === 1 ? '' : 's'}</span>}
                </div>
                <button type="button" onClick={() => void toggleDetails(item.id)} className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-[#4f6653] dark:text-[#afc6ad] hover:underline">
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${expandedItem === item.id ? 'rotate-180' : ''}`} />
                  {expandedItem === item.id ? 'Hide details' : 'Comments, checklist & files'}
                </button>

                {expandedItem === item.id && <div className="mt-4 border-t border-[#e8e9e5] dark:border-white/[0.08] pt-4 grid lg:grid-cols-2 gap-6">
                  <section>
                    <h4 className="text-sm font-medium flex items-center gap-2"><MessageCircle className="w-4 h-4 text-[#4f6653]" /> Comments and mentions</h4>
                    <div className="mt-3 space-y-3 max-h-64 overflow-y-auto">
                      {(details[item.id]?.comments || []).map((comment) => <div key={comment.id} className="rounded-lg bg-[#f6f7f4] dark:bg-white/[0.04] p-3">
                        <div className="flex justify-between gap-3 text-xs"><strong>{comment.author_name}</strong><time className="text-[#858981]">{new Date(comment.created_at).toLocaleString()}</time></div>
                        <p className="mt-1.5 text-sm whitespace-pre-wrap">{comment.body}</p>
                        {!!comment.mention_ids.length && <p className="mt-2 text-[11px] text-[#4f6653] dark:text-[#afc6ad]">Mentioned: {comment.mention_ids.map(memberLabel).join(', ')}</p>}
                      </div>)}
                      {!details[item.id]?.comments?.length && <p className="text-xs text-[#858981]">No comments yet.</p>}
                    </div>
                    {role !== 'viewer' && <form onSubmit={(event) => {
                      event.preventDefault();
                      void collaborationAction(item.id, { action: 'comment', body: commentDraft[item.id], mentionIds: mentionDraft[item.id] || [] }).then((result) => { if (result) { setCommentDraft((old) => ({ ...old, [item.id]: '' })); setMentionDraft((old) => ({ ...old, [item.id]: [] })); } });
                    }} className="mt-3 space-y-2">
                      <textarea value={commentDraft[item.id] || ''} onChange={(event) => setCommentDraft((old) => ({ ...old, [item.id]: event.target.value }))} rows={2} maxLength={4000} placeholder="Add a comment" className="w-full rounded-lg border border-[#dfe2dc] dark:border-white/10 bg-transparent px-3 py-2 text-sm" />
                      <div className="flex flex-wrap items-center gap-2">
                        <select multiple aria-label="Mention people" value={mentionDraft[item.id] || []} onChange={(event) => setMentionDraft((old) => ({ ...old, [item.id]: Array.from(event.target.selectedOptions, (option) => option.value) }))} className="min-w-36 flex-1 rounded-lg border border-[#dfe2dc] dark:border-white/10 bg-transparent px-2 py-1.5 text-xs">
                          {members.map((member) => <option key={member.user_id} value={member.user_id}>{member.display_name}</option>)}
                        </select>
                        <button disabled={!commentDraft[item.id]?.trim()} className="inline-flex items-center gap-1 rounded-lg bg-[#4f6653] text-white px-3 py-2 text-xs disabled:opacity-50"><Send className="w-3 h-3" /> Comment</button>
                      </div>
                    </form>}
                  </section>

                  <section>
                    <h4 className="text-sm font-medium flex items-center gap-2"><ListChecks className="w-4 h-4 text-[#4f6653]" /> Checklist</h4>
                    <div className="mt-3 space-y-2">
                      {(details[item.id]?.checklist || []).map((checkItem) => <label key={checkItem.id} className="flex items-start gap-2 text-sm">
                        <input type="checkbox" checked={checkItem.is_complete} disabled={role === 'viewer'} onChange={(event) => void collaborationAction(item.id, { action: 'checklist_toggle', checklistItemId: checkItem.id, isComplete: event.target.checked })} className="mt-0.5 accent-[#4f6653]" />
                        <span className={checkItem.is_complete ? 'line-through text-[#858981]' : ''}>{checkItem.title}</span>
                        {checkItem.checklist_name !== 'Checklist' && <span className="text-[10px] text-[#858981]">{checkItem.checklist_name}</span>}
                      </label>)}
                      {!details[item.id]?.checklist?.length && <p className="text-xs text-[#858981]">No checklist items yet.</p>}
                    </div>
                    {role !== 'viewer' && <form onSubmit={(event) => { event.preventDefault(); void collaborationAction(item.id, { action: 'checklist_add', title: checklistDraft[item.id] }).then((result) => { if (result) setChecklistDraft((old) => ({ ...old, [item.id]: '' })); }); }} className="mt-3 flex gap-2">
                      <input value={checklistDraft[item.id] || ''} onChange={(event) => setChecklistDraft((old) => ({ ...old, [item.id]: event.target.value }))} placeholder="Add a checklist item" maxLength={300} className="min-w-0 flex-1 rounded-lg border border-[#dfe2dc] dark:border-white/10 bg-transparent px-3 py-2 text-sm" />
                      <button disabled={!checklistDraft[item.id]?.trim()} className="rounded-lg border border-[#dfe2dc] dark:border-white/10 px-3 text-xs disabled:opacity-50">Add</button>
                    </form>}

                    <div className="mt-6 border-t border-[#e8e9e5] dark:border-white/[0.08] pt-4">
                      <h4 className="text-sm font-medium flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-[#4f6653]" /> Approval</h4>
                      <div className="mt-2 space-y-2">
                        {(details[item.id]?.approvals || []).map((approval) => <div key={approval.id} className="rounded-lg bg-[#f6f7f4] dark:bg-white/[0.04] p-3 text-xs">
                          <div className="flex items-center justify-between gap-2"><strong className="capitalize">{approval.status}</strong><span className="text-[#858981]">Requested by {approval.requested_by_name}</span></div>
                          {approval.request_note && <p className="mt-1.5 text-sm">{approval.request_note}</p>}
                          {approval.decision_note && <p className="mt-1.5 text-[#777a74]">Decision: {approval.decision_note}</p>}
                          {approval.status === 'pending' && ['admin', 'manager'].includes(role) && <div className="mt-2 flex gap-2">
                            <button type="button" onClick={() => void collaborationAction(item.id, { action: 'approval_decide', approvalId: approval.id, status: 'approved' })} className="rounded bg-emerald-700 text-white px-2.5 py-1.5">Approve</button>
                            <button type="button" onClick={() => void collaborationAction(item.id, { action: 'approval_decide', approvalId: approval.id, status: 'rejected' })} className="rounded bg-red-700 text-white px-2.5 py-1.5">Reject</button>
                          </div>}
                        </div>)}
                        {!details[item.id]?.approvals?.length && <p className="text-xs text-[#858981]">No approval requested.</p>}
                      </div>
                      {role !== 'viewer' && <form onSubmit={(event) => { event.preventDefault(); void collaborationAction(item.id, { action: 'approval_request', approverId: approvalOwner[item.id] || null, requestNote: approvalNote[item.id] || '' }).then((result) => { if (result) { setApprovalNote((old) => ({ ...old, [item.id]: '' })); setNotice('Approval requested.'); } }); }} className="mt-3 space-y-2">
                        <select value={approvalOwner[item.id] || ''} onChange={(event) => setApprovalOwner((old) => ({ ...old, [item.id]: event.target.value }))} className="w-full rounded-lg border border-[#dfe2dc] dark:border-white/10 bg-transparent px-2 py-2 text-xs"><option value="">Any manager can review</option>{members.filter((member) => ['admin', 'manager'].includes(member.role)).map((member) => <option key={member.user_id} value={member.user_id}>{member.display_name}</option>)}</select>
                        <div className="flex gap-2"><input value={approvalNote[item.id] || ''} onChange={(event) => setApprovalNote((old) => ({ ...old, [item.id]: event.target.value }))} maxLength={2000} placeholder="What needs approval?" className="min-w-0 flex-1 rounded-lg border border-[#dfe2dc] dark:border-white/10 bg-transparent px-3 py-2 text-xs" /><button className="rounded-lg border border-[#dfe2dc] dark:border-white/10 px-3 text-xs">Request</button></div>
                      </form>}
                    </div>
                  </section>

                  <section className="lg:col-span-2 border-t border-[#e8e9e5] dark:border-white/[0.08] pt-4">
                    <h4 className="text-sm font-medium flex items-center gap-2"><Paperclip className="w-4 h-4 text-[#4f6653]" /> Attachments</h4>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {(details[item.id]?.attachments || []).map((attachment) => <div key={attachment.id} className="inline-flex items-center gap-2 rounded-lg border border-[#dfe2dc] dark:border-white/10 px-3 py-2 text-xs">
                        <FileText className="w-3.5 h-3.5 text-[#4f6653]" />
                        <a href={`/api/work-items/${item.id}/attachments?attachmentId=${encodeURIComponent(attachment.id)}`} target="_blank" rel="noreferrer" className="max-w-48 truncate hover:underline">{attachment.file_name}</a>
                        <span className="text-[#858981]">{(attachment.file_size / 1024).toFixed(0)} KB</span>
                        {role !== 'viewer' && (['admin', 'manager'].includes(role) || attachment.uploaded_by === userId) && <button type="button" title="Remove attachment" onClick={() => void removeAttachment(item.id, attachment.id)} className="text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>}
                      </div>)}
                      {!details[item.id]?.attachments?.length && <p className="text-xs text-[#858981]">No attachments yet.</p>}
                    </div>
                    {role !== 'viewer' && <label className="mt-3 inline-flex items-center gap-2 rounded-lg border border-[#dfe2dc] dark:border-white/10 px-3 py-2 text-xs cursor-pointer hover:bg-[#f6f7f4] dark:hover:bg-white/[0.04]">
                      <Paperclip className="w-3.5 h-3.5" />{uploadingItem === item.id ? 'Uploading…' : 'Attach file'}
                      <input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.csv,.docx,.xlsx" disabled={uploadingItem === item.id} onChange={(event) => { const file = event.target.files?.[0]; void uploadAttachment(item.id, file); event.currentTarget.value = ''; }} className="sr-only" />
                    </label>}
                    <p className="mt-1 text-[10px] text-[#858981]">Private files, up to 4 MB. Downloads are authorized and links expire after one minute.</p>
                  </section>
                </div>}
              </article>
            ))}</div>}
          </section>

          {role !== 'viewer' && <form onSubmit={createItem} className="rounded-xl border border-[#e3e5e0] dark:border-white/[0.08] bg-white dark:bg-[#1e211d] p-5 space-y-4">
            <h2 className="font-semibold flex items-center gap-2"><CirclePlus className="w-4 h-4 text-[#4f6653]" /> New work item</h2>
            <label className="block text-xs font-medium">Title<input required maxLength={240} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Prepare the account review" className="mt-1.5 w-full rounded-lg border border-[#dfe2dc] dark:border-white/10 bg-transparent px-3 py-2.5 text-sm" /></label>
            <label className="block text-xs font-medium">Description<textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} maxLength={10000} placeholder="Add context or the expected outcome" className="mt-1.5 w-full rounded-lg border border-[#dfe2dc] dark:border-white/10 bg-transparent px-3 py-2.5 text-sm resize-y" /></label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-xs font-medium">Type<select value={workType} onChange={(event) => setWorkType(event.target.value)} className="mt-1.5 w-full rounded-lg border border-[#dfe2dc] dark:border-white/10 bg-transparent px-2 py-2.5 text-sm">{Object.entries(typeLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
              <label className="block text-xs font-medium">Priority<select value={priority} onChange={(event) => setPriority(event.target.value)} className="mt-1.5 w-full rounded-lg border border-[#dfe2dc] dark:border-white/10 bg-transparent px-2 py-2.5 text-sm">{['low', 'normal', 'high', 'urgent'].map((value) => <option key={value} value={value}>{value[0].toUpperCase() + value.slice(1)}</option>)}</select></label>
            </div>
            <label className="block text-xs font-medium">Due date<input type="date" value={dueAt} onChange={(event) => setDueAt(event.target.value)} className="mt-1.5 w-full rounded-lg border border-[#dfe2dc] dark:border-white/10 bg-transparent px-3 py-2.5 text-sm" /></label>
            <label className="block text-xs font-medium">Account<select value={accountId} onChange={(event) => setAccountId(event.target.value)} className="mt-1.5 w-full rounded-lg border border-[#dfe2dc] dark:border-white/10 bg-transparent px-3 py-2.5 text-sm"><option value="">No linked account</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.display_name}</option>)}</select></label>
            <label className="block text-xs font-medium">Owner<select value={ownerId} onChange={(event) => setOwnerId(event.target.value)} className="mt-1.5 w-full rounded-lg border border-[#dfe2dc] dark:border-white/10 bg-transparent px-3 py-2.5 text-sm">{members.map((member) => <option key={member.user_id} value={member.user_id}>{member.display_name}{member.user_id === userId ? ' (you)' : ''} · {member.role}</option>)}</select></label>
            <label className="block text-xs font-medium">Collaborators<select multiple value={collaboratorIds} onChange={(event) => setCollaboratorIds(Array.from(event.target.selectedOptions, (option) => option.value))} className="mt-1.5 w-full rounded-lg border border-[#dfe2dc] dark:border-white/10 bg-transparent px-2 py-2 text-sm min-h-20">{members.filter((member) => member.user_id !== ownerId).map((member) => <option key={member.user_id} value={member.user_id}>{member.display_name} · {member.role}</option>)}</select><span className="block mt-1 text-[11px] text-[#777a74]">Use Ctrl/⌘ to select multiple people.</span></label>
            <button disabled={saving || !title.trim()} className="w-full inline-flex justify-center items-center gap-2 rounded-lg bg-[#4f6653] hover:bg-[#405444] disabled:opacity-50 text-white px-4 py-2.5 text-sm font-medium"><Check className="w-4 h-4" />{saving ? 'Creating…' : 'Create work item'}</button>
          </form>}
        </div>
      </div>
    </main>
  );
}
