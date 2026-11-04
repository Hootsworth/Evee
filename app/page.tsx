'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, FileSpreadsheet, Play, RefreshCw, Search, ShieldCheck } from 'lucide-react';

type Metrics = {
  totalDiscovered: number;
  activeLeads: number;
  qualifiedLeadsMonth: number;
  monthlyTarget: number;
  targetProgressPercentage: number;
  pendingDrafts: number;
  sentEmails: number;
  queuedEmails: number;
  activeJobs: number;
};

const emptyMetrics: Metrics = {
  totalDiscovered: 0,
  activeLeads: 0,
  qualifiedLeadsMonth: 0,
  monthlyTarget: 100,
  targetProgressPercentage: 0,
  pendingDrafts: 0,
  sentEmails: 0,
  queuedEmails: 0,
  activeJobs: 0,
};

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<Metrics>(emptyMetrics);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch('/api/reports/overview');
      const data = await response.json();
      if (response.ok && data.metrics) setMetrics({ ...emptyMetrics, ...data.metrics });
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    // Live auto-refresh every 8s so dispatched emails and goal counters update in real time
    const interval = setInterval(() => {
      void refresh();
    }, 8000);
    return () => clearInterval(interval);
  }, [refresh]);

  const processQueue = async () => {
    setProcessing(true);
    setNotice(null);
    try {
      const response = await fetch('/api/jobs/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batchSize: 5 }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not process the queue');
      const count = data.result?.succeeded || 0;
      setNotice(
        count > 0
          ? `${count} ${count === 1 ? 'email' : 'emails'} dispatched successfully!`
          : 'Background queue processed. Waiting for next send cadence tick.'
      );
      await refresh();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not process the queue');
    } finally {
      setProcessing(false);
    }
  };

  const stats = [
    {
      label: 'Active leads',
      value: metrics.activeLeads || metrics.totalDiscovered,
      href: '/leads',
      sublabel: undefined,
    },
    {
      label: 'Qualified this month',
      value: metrics.qualifiedLeadsMonth,
      href: '/leads',
      sublabel: `${metrics.targetProgressPercentage}% of goal`,
    },
    {
      label: 'Drafts to review',
      value: metrics.pendingDrafts,
      href: '/drafts',
      sublabel: metrics.pendingDrafts > 0 ? `${metrics.pendingDrafts} pending` : undefined,
    },
    {
      label: 'Emails sent',
      value: metrics.sentEmails,
      href: '/leads?tab=sent',
      sublabel: metrics.queuedEmails > 0 ? `${metrics.queuedEmails} in flight` : undefined,
    },
  ];

  return (
    <div className="min-h-screen bg-[#f7f7f5] dark:bg-[#171916] text-[#20211f] dark:text-[#f1f2ee]">
      <main className="max-w-7xl mx-auto px-5 sm:px-8 py-10 sm:py-14">
        <section className="flex flex-col lg:flex-row lg:items-end justify-between gap-8 pb-9 border-b border-[#e8e9e5] dark:border-white/[0.08]">
          <div className="max-w-2xl">
            <p className="text-sm font-medium text-[#4f6653] dark:text-[#afc6ad] mb-3">Workspace overview</p>
            <h1 className="text-4xl sm:text-5xl leading-tight">Find the right people.<br className="hidden sm:block" /> Make every conversation count.</h1>
            <p className="mt-4 text-base text-[#777a74] dark:text-[#a2a69e] max-w-xl leading-relaxed">Manage prospects, review tailored messages, and keep outreach moving from one place.</p>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <button
              onClick={() => void refresh()}
              disabled={loading}
              title="Refresh metrics"
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#dfe2dc] dark:border-white/10 bg-white dark:bg-[#1e211d] px-3 py-2.5 text-sm font-medium hover:border-[#aab4a6] transition text-[#777a74] dark:text-[#a2a69e] hover:text-black dark:hover:text-white"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <button onClick={processQueue} disabled={processing} className="inline-flex items-center gap-2 rounded-lg bg-[#4f6653] hover:bg-[#405444] disabled:opacity-60 text-white px-4 py-2.5 text-sm font-medium transition">
              {processing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              {processing ? 'Working…' : 'Process queue'}
            </button>
            <Link href="/campaigns" className="inline-flex items-center gap-2 rounded-lg border border-[#dfe2dc] dark:border-white/10 bg-white dark:bg-[#1e211d] px-4 py-2.5 text-sm font-medium hover:border-[#aab4a6] transition">
              <span>New campaign</span><ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </section>

        {notice && <div role="status" className="mt-5 text-sm text-[#4f6653] dark:text-[#afc6ad]">{notice}</div>}

        <section aria-label="Performance" className="grid grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-6 py-8 border-b border-[#e8e9e5] dark:border-white/[0.08]">
          {stats.map((stat) => (
            <Link key={stat.label} href={stat.href} className="group">
              <div className="flex items-center justify-between text-sm text-[#777a74] dark:text-[#a2a69e]">
                <span>{stat.label}</span>
                {stat.sublabel && (
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 font-medium">
                    {stat.sublabel}
                  </span>
                )}
              </div>
              <div className="mt-2 text-3xl font-semibold tracking-tight">{loading ? '—' : stat.value.toLocaleString()}</div>
              <div className="mt-3 h-px bg-[#e8e9e5] dark:bg-white/10 group-hover:bg-[#8a9d83] transition-colors" />
            </Link>
          ))}
        </section>

        <section className="grid lg:grid-cols-[1.4fr_1fr] gap-12 py-9">
          <div>
            <div className="flex items-baseline justify-between gap-4 mb-5">
              <div><p className="text-sm text-[#777a74] dark:text-[#a2a69e]">Monthly goal</p><h2 className="text-xl mt-1">Qualified prospects</h2></div>
              <span className="text-sm font-medium">{metrics.qualifiedLeadsMonth} <span className="text-[#777a74] dark:text-[#a2a69e]">/ {metrics.monthlyTarget}</span></span>
            </div>
            <div className="h-2 rounded-full bg-[#e7e9e4] dark:bg-white/10 overflow-hidden"><div className="h-full rounded-full bg-[#71866e] transition-all duration-500" style={{ width: `${Math.min(metrics.targetProgressPercentage || 0, 100)}%` }} /></div>
            <div className="mt-2 flex items-center justify-between text-xs text-[#777a74] dark:text-[#a2a69e]">
              <span>{metrics.targetProgressPercentage || 0}% of your monthly target</span>
              {metrics.sentEmails > 0 && (
                <span className="text-emerald-700 dark:text-emerald-400 font-medium">
                  {metrics.sentEmails} outreach emails dispatched
                </span>
              )}
            </div>
            <div className="mt-9 flex items-center gap-2 text-sm text-[#777a74] dark:text-[#a2a69e]"><ShieldCheck className="w-4 h-4 text-[#4f6653] dark:text-[#afc6ad]" /> Outreach stays in review until approved.</div>
          </div>

          <div className="lg:border-l lg:border-[#e8e9e5] lg:dark:border-white/[0.08] lg:pl-10">
            <p className="text-sm text-[#777a74] dark:text-[#a2a69e] mb-4">Get started</p>
            <div className="divide-y divide-[#e8e9e5] dark:divide-white/[0.08]">
              <Link href="/leads" className="py-4 flex items-center justify-between group"><span><strong className="block text-sm font-medium">Browse leads</strong><span className="text-sm text-[#777a74] dark:text-[#a2a69e]">Search and organize your prospects</span></span><Search className="w-4 h-4 text-[#777a74] group-hover:text-[#4f6653]" /></Link>
              <Link href="/campaigns/csv" className="py-4 flex items-center justify-between group"><span><strong className="block text-sm font-medium">Import a list</strong><span className="text-sm text-[#777a74] dark:text-[#a2a69e]">Bring in prospects from a spreadsheet</span></span><FileSpreadsheet className="w-4 h-4 text-[#777a74] group-hover:text-[#4f6653]" /></Link>
              <Link href="/drafts" className="py-4 flex items-center justify-between group"><span><strong className="block text-sm font-medium">Review messages</strong><span className="text-sm text-[#777a74] dark:text-[#a2a69e]">{metrics.pendingDrafts} waiting for your review</span></span><ArrowRight className="w-4 h-4 text-[#777a74] group-hover:text-[#4f6653]" /></Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
