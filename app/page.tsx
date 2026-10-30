'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Target, Search, CheckCircle, Mail, AlertTriangle, ArrowRight, ShieldCheck, Play, Sparkles } from 'lucide-react';

export default function DashboardPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [cronRunning, setCronRunning] = useState(false);
  const [cronStatus, setCronStatus] = useState<string | null>(null);

  const fetchOverview = async () => {
    try {
      const res = await fetch('/api/reports/overview');
      const json = await res.json();
      setData(json);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOverview();
  }, []);

  const triggerJobProcessing = async () => {
    setCronRunning(true);
    setCronStatus('Processing queue...');
    try {
      const res = await fetch('/api/cron/process-jobs', { method: 'POST' });
      const json = await res.json();
      setCronStatus(`Processed ${json.processed?.claimedJobs || 0} jobs (${json.processed?.succeeded || 0} succeeded)`);
      fetchOverview();
    } catch (err: any) {
      setCronStatus(`Error: ${err.message}`);
    } finally {
      setCronRunning(false);
    }
  };

  const metrics = data?.metrics || {
    totalDiscovered: 0,
    qualifiedLeadsMonth: 0,
    monthlyTarget: 100,
    targetProgressPercentage: 0,
    pendingDrafts: 0,
    approvedDrafts: 0,
    sentEmails: 0,
    queuedEmails: 0,
    suppressionCount: 0,
    activeJobs: 0,
    failedJobs: 0,
    estimatedCostInr: 0,
    monthlySpendCapInr: 0,
  };

  return (
    <div className="flex flex-col bg-white dark:bg-[#09090b] min-h-screen transition-colors duration-150">
      {/* Top Hero Band: Flat, Crisp, Clean Editorial Canvas */}
      <section className="bg-[#f8fafc] dark:bg-[#121217] text-[#111827] dark:text-[#f4f4f5] pt-12 pb-14 px-6 border-b border-[#e5e7eb] dark:border-[#27272a]">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-10">
            <div className="max-w-2xl">
              <h1 className="text-3xl md:text-5xl font-light tracking-tight text-[#111827] dark:text-white mb-3 leading-[1.15]">
                Evidence-backed outreach for modern small businesses.
              </h1>
              <p className="text-[#6b7280] dark:text-[#a1a1aa] text-base leading-relaxed font-light">
                Evee inspects public business websites, discovers concrete automation opportunities, scores qualification deterministically, and prepares personalized drafts requiring explicit operator approval.
              </p>
            </div>

            {/* Quick Action Buttons */}
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={triggerJobProcessing}
                disabled={cronRunning}
                className="mono-btn bg-[#f43f5e] hover:bg-[#e11d48] text-white px-5 py-2.5 rounded-full text-xs font-normal transition flex items-center space-x-2 shadow-sm active:scale-95"
              >
                <Play className="w-3.5 h-3.5 fill-white" />
                <span>{cronRunning ? 'PROCESSING...' : 'TRIGGER WORKER'}</span>
              </button>

              <Link
                href="/campaigns"
                className="mono-btn bg-white dark:bg-[#18181b] hover:bg-[#f3f4f6] dark:hover:bg-[#27272a] text-[#374151] dark:text-[#e4e4e7] border border-[#e5e7eb] dark:border-[#27272a] px-5 py-2.5 rounded-full text-xs font-normal transition shadow-sm"
              >
                VIEW CAMPAIGNS
              </Link>
            </div>
          </div>

          {cronStatus && (
            <div className="mb-6 p-3.5 rounded-xl bg-white dark:bg-[#18181b] border border-[#e5e7eb] dark:border-[#27272a] text-xs font-mono text-[#111827] dark:text-[#e4e4e7] shadow-sm font-normal">
              {cronStatus}
            </div>
          )}

          {/* Metric Cards: Flat Clean Solid Tiles */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-[#18181b] border border-[#e5e7eb] dark:border-[#27272a] p-6 rounded-xl shadow-sm flex flex-col justify-between">
              <div>
                <span className="mono-eyebrow text-[#9ca3af] dark:text-[#71717a] font-normal block mb-1">MONTHLY QUALIFIED TARGET</span>
                <div className="text-3xl font-light tracking-tight text-[#111827] dark:text-white">
                  {metrics.qualifiedLeadsMonth} <span className="text-xl font-extralight text-[#9ca3af] dark:text-[#71717a]">/ {metrics.monthlyTarget}</span>
                </div>
              </div>
              <div className="mt-5">
                <div className="flex justify-between text-xs font-mono mb-1.5 text-[#6b7280] dark:text-[#a1a1aa]">
                  <span>PROGRESS</span>
                  <span className="font-normal text-[#f43f5e]">{metrics.targetProgressPercentage}%</span>
                </div>
                <div className="w-full bg-[#f3f4f6] dark:bg-[#27272a] rounded-full h-1.5 overflow-hidden">
                  <div className="bg-[#f43f5e] h-full rounded-full transition-all" style={{ width: `${metrics.targetProgressPercentage}%` }}></div>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-[#18181b] border border-[#e5e7eb] dark:border-[#27272a] p-6 rounded-xl shadow-sm flex flex-col justify-between">
              <span className="mono-eyebrow text-[#9ca3af] dark:text-[#71717a] font-normal block mb-1">DISCOVERED BUSINESSES</span>
              <div className="text-3xl font-light tracking-tight text-[#111827] dark:text-white">
                {metrics.totalDiscovered}
              </div>
              <div className="mt-4 text-xs text-[#9ca3af] dark:text-[#71717a] font-mono">
                Across enabled discovery queries
              </div>
            </div>

            <div className="bg-white dark:bg-[#18181b] border border-[#e5e7eb] dark:border-[#27272a] p-6 rounded-xl shadow-sm flex flex-col justify-between">
              <span className="mono-eyebrow text-[#9ca3af] dark:text-[#71717a] font-normal block mb-1">DRAFTS AWAITING APPROVAL</span>
              <div className="text-3xl font-light tracking-tight text-[#f43f5e]">
                {metrics.pendingDrafts}
              </div>
              <div className="mt-4 text-xs font-mono">
                <Link href="/drafts" className="text-[#f43f5e] hover:underline flex items-center space-x-1 font-normal">
                  <span>Open queue</span>
                  <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </div>

            <div className="bg-white dark:bg-[#18181b] border border-[#e5e7eb] dark:border-[#27272a] p-6 rounded-xl shadow-sm flex flex-col justify-between">
              <span className="mono-eyebrow text-[#9ca3af] dark:text-[#71717a] font-normal block mb-1">APPROVED / SENT OUTREACH</span>
              <div className="text-3xl font-light tracking-tight text-[#111827] dark:text-white">
                {metrics.sentEmails} <span className="text-lg font-extralight text-[#9ca3af] dark:text-[#71717a]">sent</span>
              </div>
              <div className="mt-4 text-xs text-[#9ca3af] dark:text-[#71717a] font-mono">
                {metrics.queuedEmails} queued in database
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Operating Surface */}
      <section className="max-w-7xl mx-auto px-6 py-12 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Column 1: Pipeline Lifecycle */}
          <div className="lg:col-span-2 space-y-6">
            <div className="border border-[#e5e7eb] dark:border-[#27272a] rounded-xl p-6 bg-white dark:bg-[#121217] shadow-sm">
              <h3 className="mono-eyebrow text-[#111827] dark:text-white font-normal mb-4">4-STAGE RIGID PIPELINE</h3>

              <div className="space-y-3">
                <div className="flex items-center justify-between p-4 bg-[#f8fafc] dark:bg-[#18181b] border border-[#e5e7eb] dark:border-[#27272a] rounded-xl">
                  <div className="flex items-center space-x-3.5">
                    <div className="w-7 h-7 rounded-full bg-[#111827] dark:bg-white text-white dark:text-[#111827] flex items-center justify-center font-mono text-xs font-normal">1</div>
                    <div>
                      <div className="text-sm font-normal text-[#111827] dark:text-white">Google Places Discovery Adapter</div>
                      <div className="text-xs text-[#6b7280] dark:text-[#a1a1aa] font-light">Targeting cafe, bakery, and retail small businesses in designated cities</div>
                    </div>
                  </div>
                  <span className="mono-eyebrow text-xs text-[#6b7280] dark:text-[#a1a1aa] font-normal">AUTOMATIC</span>
                </div>

                <div className="flex items-center justify-between p-4 bg-[#f8fafc] dark:bg-[#18181b] border border-[#e5e7eb] dark:border-[#27272a] rounded-xl">
                  <div className="flex items-center space-x-3.5">
                    <div className="w-7 h-7 rounded-full bg-[#111827] dark:bg-white text-white dark:text-[#111827] flex items-center justify-center font-mono text-xs font-normal">2</div>
                    <div>
                      <div className="text-sm font-normal text-[#111827] dark:text-white">Safe Webpage Inspection & Evidence</div>
                      <div className="text-xs text-[#6b7280] dark:text-[#a1a1aa] font-light">SSRF-protected fetching, parsing menu, booking & responsive elements</div>
                    </div>
                  </div>
                  <span className="mono-eyebrow text-xs text-emerald-600 dark:text-emerald-400 font-normal">AUTOMATIC</span>
                </div>

                <div className="flex items-center justify-between p-4 bg-[#f8fafc] dark:bg-[#18181b] border border-[#e5e7eb] dark:border-[#27272a] rounded-xl">
                  <div className="flex items-center space-x-3.5">
                    <div className="w-7 h-7 rounded-full bg-[#111827] dark:bg-white text-white dark:text-[#111827] flex items-center justify-center font-mono text-xs font-normal">3</div>
                    <div>
                      <div className="text-sm font-normal text-[#111827] dark:text-white">Explainable Qualification & AI Drafting</div>
                      <div className="text-xs text-[#6b7280] dark:text-[#a1a1aa] font-light">4-component deterministic score + grounded email draft generation</div>
                    </div>
                  </div>
                  <span className="mono-eyebrow text-xs text-[#6b7280] dark:text-[#a1a1aa] font-normal">{metrics.qualifiedLeadsMonth} QUALIFIED</span>
                </div>

                <div className="flex items-center justify-between p-4 bg-[#f8fafc] dark:bg-[#18181b] border border-[#e5e7eb] dark:border-[#27272a] rounded-xl">
                  <div className="flex items-center space-x-3.5">
                    <div className="w-7 h-7 rounded-full bg-[#f43f5e] text-white flex items-center justify-center font-mono text-xs font-normal">4</div>
                    <div>
                      <div className="text-sm font-normal text-[#111827] dark:text-white">Explicit Operator Approval Queue</div>
                      <div className="text-xs text-[#6b7280] dark:text-[#a1a1aa] font-light">Human-in-the-loop validation of recipient, claims, and subject</div>
                    </div>
                  </div>
                  <Link href="/drafts" className="mono-btn text-xs text-[#f43f5e] hover:underline font-normal">
                    {metrics.pendingDrafts} TO APPROVE →
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* Provider status sidebar */}
          <div className="space-y-6">
            <div className="border border-[#e5e7eb] dark:border-[#27272a] rounded-xl p-6 bg-white dark:bg-[#121217] shadow-sm">
              <h3 className="mono-eyebrow text-[#111827] dark:text-white font-normal mb-4">SYSTEM LEDGER</h3>
              <div className="space-y-4 text-xs font-mono">
                <div className="flex justify-between items-center py-2 border-b border-[#f3f4f6] dark:border-[#1f1f23]">
                  <span className="text-[#6b7280] dark:text-[#a1a1aa]">DISCOVERY PROVIDER</span>
                  <span className="bg-[#f3f4f6] dark:bg-[#18181b] px-2.5 py-1 rounded-md font-normal text-[#111827] dark:text-white">{data?.systemStatus?.discoveryProvider || 'mock'}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-[#f3f4f6] dark:border-[#1f1f23]">
                  <span className="text-[#6b7280] dark:text-[#a1a1aa]">AI PROVIDER</span>
                  <span className="bg-[#f3f4f6] dark:bg-[#18181b] px-2.5 py-1 rounded-md font-normal text-[#111827] dark:text-white">{data?.systemStatus?.aiProvider || 'mock'}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-[#f3f4f6] dark:border-[#1f1f23]">
                  <span className="text-[#6b7280] dark:text-[#a1a1aa]">AUTO-SENDING ACTIVE</span>
                  <span className={`px-2.5 py-1 rounded-md font-normal ${data?.systemStatus?.automatedSending ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300' : 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300'}`}>
                    {data?.systemStatus?.automatedSending ? 'ENABLED' : 'DISABLED (SAFE)'}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-[#f3f4f6] dark:border-[#1f1f23]">
                  <span className="text-[#6b7280] dark:text-[#a1a1aa]">SPEND TO DATE</span>
                  <span className="font-normal text-[#111827] dark:text-white">₹{metrics.estimatedCostInr} / ₹{metrics.monthlySpendCapInr}</span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-[#6b7280] dark:text-[#a1a1aa]">DURABLE QUEUE</span>
                  <span className="font-normal text-[#111827] dark:text-white">{metrics.activeJobs} jobs active</span>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-[#f3f4f6] dark:border-[#1f1f23]">
                <Link
                  href="/settings"
                  className="mono-btn w-full block text-center bg-[#f8fafc] dark:bg-[#18181b] hover:bg-[#f1f5f9] dark:hover:bg-[#27272a] text-[#374151] dark:text-[#e4e4e7] font-normal py-2.5 rounded-full text-xs border border-[#e5e7eb] dark:border-[#27272a] transition"
                >
                  CONFIGURE PROVIDERS & KEYS
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
