'use client';

import { useCallback, useEffect, useState } from 'react';
import { Clock3, RefreshCw, RotateCcw, Workflow } from 'lucide-react';

type Job = {
  id: string;
  jobType: string;
  status: string;
  priority: number;
  attemptCount: number;
  maxAttempts: number;
  scheduledAt: string;
  lockedAt: string | null;
  createdAt: string;
  updatedAt: string;
  lastErrorCode: string | null;
  lastErrorSummary: string | null;
  payloadSummary: Record<string, string>;
};

type Operation = { id: string; event_type: string; timestamp: string; details: Record<string, any> };
type Metrics = { queued: number; processing: number; succeeded: number; failed: number; manualReview: number; cancelled: number; total: number };

const emptyMetrics: Metrics = { queued: 0, processing: 0, succeeded: 0, failed: 0, manualReview: 0, cancelled: 0, total: 0 };

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

function statusStyle(status: string) {
  if (status === 'succeeded') return 'text-emerald-700 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-950/40';
  if (status === 'failed' || status === 'manual_review') return 'text-rose-700 bg-rose-50 dark:text-rose-300 dark:bg-rose-950/40';
  if (status === 'running' || status === 'processing') return 'text-blue-700 bg-blue-50 dark:text-blue-300 dark:bg-blue-950/40';
  return 'text-amber-700 bg-amber-50 dark:text-amber-300 dark:bg-amber-950/40';
}

export default function JobsPage() {
  const [metrics, setMetrics] = useState<Metrics>(emptyMetrics);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [operations, setOperations] = useState<Operation[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ text: string; error?: boolean } | null>(null);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch('/api/jobs/queue');
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not load queue activity.');
      setMetrics({ ...emptyMetrics, ...data.metrics });
      setJobs(data.jobs || []);
      setOperations(data.operations || []);
      setCanManage(data.role === 'admin' || data.role === 'operator');
    } catch (error) {
      setNotice({ text: error instanceof Error ? error.message : 'Could not load queue activity.', error: true });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = setInterval(() => void refresh(), 15000);
    return () => clearInterval(timer);
  }, [refresh]);

  const runAction = async (body: Record<string, unknown>, successMessage: string) => {
    setBusy(true);
    setNotice(null);
    try {
      const response = await fetch('/api/jobs/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Queue action failed.');
      setNotice({ text: successMessage });
      await refresh();
    } catch (error) {
      setNotice({ text: error instanceof Error ? error.message : 'Queue action failed.', error: true });
    } finally {
      setBusy(false);
    }
  };

  const retryJob = (job: Job) => {
    const isEmail = ['send_email', 'csv_email_dispatch'].includes(job.jobType);
    if (isEmail && !window.confirm('Check the sending mailbox first. Confirm the provider did not deliver this message before retrying; retrying a delivered message can create a duplicate.')) return;
    void runAction({ action: 'retry', jobId: job.id, confirmNoSend: isEmail || job.status === 'manual_review' }, 'Job returned to the queue.');
  };

  const resolveJob = (job: Job, outcome: 'delivered' | 'not_delivered') => {
    const explanation = outcome === 'delivered'
      ? 'Confirm that the provider shows this message as delivered. The job will be marked complete.'
      : 'Confirm that the provider shows this message was not delivered. The job will become retryable.';
    if (!window.confirm(explanation)) return;
    void runAction({ action: 'resolve', jobId: job.id, outcome }, outcome === 'delivered' ? 'Job marked complete.' : 'Job marked not delivered and can be retried.');
  };

  const cards = [
    { label: 'Queued', value: metrics.queued },
    { label: 'Running', value: metrics.processing },
    { label: 'Failed', value: metrics.failed },
    { label: 'Needs review', value: metrics.manualReview },
    { label: 'Completed', value: metrics.succeeded },
  ];

  return (
    <div className="max-w-7xl mx-auto px-5 sm:px-8 py-10 w-full">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
        <div>
          <div className="mono-eyebrow text-black/45 dark:text-white/45 mb-1">OPERATIONS</div>
          <h1 className="text-3xl font-medium tracking-tight">Jobs & activity</h1>
          <p className="text-sm text-black/60 dark:text-white/60 mt-1">Inspect background work, review failures, and recover safe retries.</p>
        </div>
        {canManage && (
          <div className="flex flex-wrap gap-2">
            <button disabled={busy} onClick={() => void runAction({ action: 'recover', timeoutMinutes: 5 }, 'Stale jobs checked. Ambiguous sends were held for review.')} className="flex items-center gap-2 px-3 py-2 border border-black/10 dark:border-white/10 rounded-lg text-xs disabled:opacity-50">
              <RotateCcw className="w-3.5 h-3.5" /> Recover stale jobs
            </button>
            <button disabled={busy} onClick={() => void runAction({ action: 'process', batchSize: 5 }, 'Queue batch processed.')} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#4f6653] text-white text-xs disabled:opacity-50">
              <Workflow className="w-3.5 h-3.5" /> Process queue
            </button>
          </div>
        )}
      </div>

      {notice && (
        <div className={`mb-5 p-3 rounded-lg border text-sm ${notice.error ? 'border-rose-300 bg-rose-50 text-rose-800 dark:bg-rose-950/30 dark:text-rose-200' : 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200'}`}>
          {notice.text}
        </div>
      )}

      <section className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8">
        {cards.map((card) => (
          <div key={card.label} className="border border-black/[0.08] dark:border-white/[0.08] rounded-xl bg-white dark:bg-[#121217] p-4">
            <p className="text-[10px] uppercase tracking-wider text-black/45 dark:text-white/45">{card.label}</p>
            <p className="text-2xl font-medium mt-1">{card.value}</p>
          </div>
        ))}
      </section>

      <section className="border border-black/[0.08] dark:border-white/[0.08] rounded-xl bg-white dark:bg-[#121217] overflow-hidden mb-8">
        <div className="px-5 py-4 border-b border-black/[0.06] dark:border-white/[0.08] flex items-center justify-between">
          <h2 className="font-medium">Recent jobs</h2>
          <button onClick={() => void refresh()} disabled={loading} className="text-xs flex items-center gap-1.5 text-black/55 dark:text-white/55"><RefreshCw className="w-3 h-3" /> Refresh</button>
        </div>
        {loading ? <p className="p-8 text-sm text-black/50 dark:text-white/50">Loading queue…</p> : jobs.length === 0 ? (
          <div className="p-10 text-center text-sm text-black/50 dark:text-white/50">No background jobs yet.</div>
        ) : (
          <div className="divide-y divide-black/[0.06] dark:divide-white/[0.06]">
            {jobs.map((job) => {
              const needsReview = job.status === 'manual_review';
              const canRetry = canManage && ['failed', 'manual_review'].includes(job.status);
              const isEmailJob = ['send_email', 'csv_email_dispatch'].includes(job.jobType);
              return (
                <article key={job.id} className="px-5 py-4 flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-sm">{job.jobType.replaceAll('_', ' ')}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase ${statusStyle(job.status)}`}>{job.status.replaceAll('_', ' ')}</span>
                      <span className="text-[10px] text-black/40 dark:text-white/40">Attempt {job.attemptCount}/{job.maxAttempts}</span>
                    </div>
                    <p className="font-mono text-[10px] text-black/40 dark:text-white/40 mt-1 break-all">{job.id}</p>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-[11px] text-black/55 dark:text-white/55">
                      {Object.entries(job.payloadSummary).map(([key, value]) => <span key={key}>{key}: {value}</span>)}
                      <span>Updated {formatDate(job.updatedAt)}</span>
                    </div>
                    {job.lastErrorSummary && (
                      <div className="mt-3 p-3 rounded-lg bg-rose-50 dark:bg-rose-950/25 text-xs text-rose-800 dark:text-rose-200">
                        <span className="font-mono text-[10px] uppercase">{job.lastErrorCode || 'Job error'}</span>
                        <p className="mt-1 whitespace-pre-wrap">{job.lastErrorSummary}</p>
                      </div>
                    )}
                    {needsReview && <p className="mt-2 text-[11px] text-amber-700 dark:text-amber-300">Check the provider’s sent folder before resolving or retrying this send.</p>}
                  </div>
                  {canRetry && (
                    <div className="flex shrink-0 flex-wrap gap-2">
                      {needsReview && (
                        <button disabled={busy} onClick={() => resolveJob(job, 'delivered')} className="px-3 py-2 border border-emerald-300 text-emerald-800 dark:text-emerald-200 rounded-lg text-[11px] disabled:opacity-50">Confirm delivered</button>
                      )}
                      <button disabled={busy} onClick={() => retryJob(job)} className="px-3 py-2 border border-black/10 dark:border-white/10 rounded-lg text-[11px] disabled:opacity-50">{isEmailJob || needsReview ? 'Confirm not sent & retry' : 'Retry job'}</button>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="border border-black/[0.08] dark:border-white/[0.08] rounded-xl bg-white dark:bg-[#121217] overflow-hidden">
        <div className="px-5 py-4 border-b border-black/[0.06] dark:border-white/[0.08] flex items-center gap-2">
          <Clock3 className="w-4 h-4" />
          <h2 className="font-medium">Recent CSV operations</h2>
        </div>
        {operations.length === 0 ? <p className="p-6 text-sm text-black/50 dark:text-white/50">CSV import and export activity will appear here.</p> : (
          <div className="divide-y divide-black/[0.06] dark:divide-white/[0.06]">
            {operations.map((operation) => (
              <div key={operation.id} className="px-5 py-3 flex flex-col sm:flex-row sm:justify-between gap-1 text-xs">
                <div>
                  <span className="font-medium">{operation.event_type === 'CSV_IMPORT_COMPLETED' ? 'CSV import' : 'CSV export'}</span>
                  <span className="text-black/55 dark:text-white/55 ml-2">
                    {operation.event_type === 'CSV_IMPORT_COMPLETED'
                      ? `${operation.details?.importedCount || 0} imported · ${operation.details?.duplicateCount || 0} duplicates · ${operation.details?.failedCount || 0} failed`
                      : `${operation.details?.recordCount || 0} accounts exported`}
                  </span>
                </div>
                <time className="text-black/40 dark:text-white/40">{formatDate(operation.timestamp)}</time>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
