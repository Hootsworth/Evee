'use client';

import { useState } from 'react';

type Task = { title: string; description: string; priority: string; accountId: string | null; dueAt: string | null };

export default function CopilotPage() {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [applied, setApplied] = useState<number[]>([]);

  async function ask(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setNotice(''); setApplied([]);
    try {
      const response = await fetch('/api/copilot', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Copilot request failed.');
      setAnswer(data.answer); setTasks(data.proposedTasks || []);
    } catch (error: any) { setNotice(error.message); }
    finally { setBusy(false); }
  }

  async function createTask(task: Task, index: number) {
    setBusy(true); setNotice('');
    try {
      const response = await fetch('/api/work-items', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...task, workType: 'task' }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not create task.');
      setApplied((current) => [...current, index]);
    } catch (error: any) { setNotice(error.message); }
    finally { setBusy(false); }
  }

  return <main className="max-w-4xl mx-auto p-6 md:p-10 space-y-8">
    <header><p className="text-xs uppercase tracking-widest text-[#71866e] font-mono">Workspace assistant</p><h1 className="text-3xl font-semibold mt-2">Evee Copilot</h1><p className="text-sm text-[#777] mt-2">Ask about your accounts, active work, and operational records. Suggested tasks stay in draft until you apply them.</p></header>
    <form onSubmit={ask} className="space-y-3"><textarea value={question} onChange={(event) => setQuestion(event.target.value)} rows={4} maxLength={2000} placeholder="Which accounts have overdue follow-up? What should we do next for the open renewals?" className="w-full rounded border border-black/15 dark:border-white/15 bg-transparent p-4 text-sm"/><button disabled={busy || !question.trim()} className="rounded bg-black text-white dark:bg-white dark:text-black px-4 py-2 text-sm disabled:opacity-40">{busy ? 'Thinking…' : 'Ask Evee'}</button></form>
    {notice && <p role="status" className="text-sm text-rose-600">{notice}</p>}
    {answer && <section className="rounded border border-black/10 dark:border-white/10 p-5 space-y-5"><div><h2 className="text-sm font-semibold uppercase tracking-wide">Answer</h2><p className="text-sm leading-6 whitespace-pre-wrap mt-3">{answer}</p></div>{tasks.length > 0 && <div className="space-y-3"><h2 className="text-sm font-semibold uppercase tracking-wide">Proposed tasks</h2>{tasks.map((task, index) => <article key={`${task.title}-${index}`} className="flex items-start justify-between gap-4 rounded bg-black/[0.03] dark:bg-white/[0.04] p-4"><div><h3 className="text-sm font-medium">{task.title}</h3><p className="text-xs text-[#777] mt-1">{task.description}</p><p className="text-[10px] uppercase text-[#777] mt-2">{task.priority}{task.dueAt ? ` · Due ${new Date(task.dueAt).toLocaleDateString()}` : ''}</p></div><button disabled={busy || applied.includes(index)} onClick={() => createTask(task, index)} className="shrink-0 rounded border border-black/20 dark:border-white/20 px-3 py-2 text-xs disabled:opacity-40">{applied.includes(index) ? 'Added' : 'Add task'}</button></article>)}</div>}</section>}
  </main>;
}
