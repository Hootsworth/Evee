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
    <div className="flex flex-col bg-[#ffffff] min-h-screen">
      {/* Top Hero Band: Fresh, Bright, Rose & Clean Studio Canvas */}
      <section className="bg-gradient-to-b from-[#fff5f6] via-[#fff1f2]/70 to-[#ffffff] text-[#111827] pt-12 pb-16 px-6 border-b border-[#ffe4e6] relative overflow-hidden">
        {/* Soft Ambient Blobs */}
        <div className="absolute -top-20 -right-20 w-[420px] h-[420px] rounded-full bg-[#fecdd3]/60 blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 right-1/4 w-[360px] h-[360px] rounded-full bg-[#bae6fd]/40 blur-3xl pointer-events-none"></div>

        <div className="max-w-7xl mx-auto relative z-10">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-10">
            <div className="max-w-2xl">
              <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-white border border-[#fecdd3] text-[#f43f5e] shadow-sm mb-4">
                <span className="w-2 h-2 rounded-full bg-[#f43f5e]"></span>
                <span className="mono-eyebrow text-xs font-bold">CONTROLLED PROSPECTING ENGINE</span>
              </div>
              <h1 className="text-3xl md:text-5xl font-bold tracking-tight text-[#111827] mb-3">
                Evidence-backed outreach for modern small businesses.
              </h1>
              <p className="text-[#4b5563] text-base leading-relaxed">
                Evee inspects public business websites, discovers concrete automation opportunities, scores qualification deterministically, and prepares personalized drafts requiring explicit operator approval.
              </p>
            </div>

            {/* Quick Action Buttons */}
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={triggerJobProcessing}
                disabled={cronRunning}
                className="mono-btn bg-[#f43f5e] hover:bg-[#e11d48] text-white px-5 py-2.5 rounded-full text-xs font-semibold transition flex items-center space-x-2 shadow-sm shadow-rose-500/20 active:scale-95"
              >
                <Play className="w-3.5 h-3.5 fill-white" />
                <span>{cronRunning ? 'PROCESSING...' : 'TRIGGER WORKER'}</span>
              </button>

              <Link
                href="/campaigns"
                className="mono-btn bg-white hover:bg-[#fff1f2] text-[#f43f5e] border border-[#fecdd3] px-5 py-2.5 rounded-full text-xs font-semibold transition shadow-sm"
              >
                VIEW CAMPAIGNS
              </Link>
            </div>
          </div>

          {cronStatus && (
            <div className="mb-6 p-3.5 rounded-xl bg-white border border-[#fecdd3] text-xs font-mono text-[#f43f5e] shadow-sm">
              {cronStatus}
            </div>
          )}

          {/* Metric Cards: Bright & Clean Tiles */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-[#ffffff] border border-[#fecdd3] p-6 rounded-2xl shadow-sm flex flex-col justify-between hover:border-[#f43f5e] transition">
              <div>
                <span className="mono-eyebrow text-[#f43f5e] font-bold block mb-1">MONTHLY QUALIFIED TARGET</span>
                <div className="text-4xl font-bold tracking-tight text-[#111827]">
                  {metrics.qualifiedLeadsMonth} <span className="text-2xl font-normal text-[#9ca3af]">/ {metrics.monthlyTarget}</span>
                </div>
              </div>
              <div className="mt-5">
                <div className="flex justify-between text-xs font-mono mb-1.5 text-[#6b7280]">
                  <span>PROGRESS</span>
                  <span className="font-bold text-[#f43f5e]">{metrics.targetProgressPercentage}%</span>
                </div>
                <div className="w-full bg-[#f3f4f6] rounded-full h-2 overflow-hidden">
                  <div className="bg-[#f43f5e] h-full rounded-full transition-all" style={{ width: `${metrics.targetProgressPercentage}%` }}></div>
                </div>
              </div>
            </div>

            <div className="bg-[#ffffff] border border-[#e5e7eb] p-6 rounded-2xl shadow-sm flex flex-col justify-between hover:border-[#fecdd3] transition">
              <span className="mono-eyebrow text-[#6b7280] font-semibold block mb-1">DISCOVERED BUSINESSES</span>
              <div className="text-4xl font-bold tracking-tight text-[#111827]">
                {metrics.totalDiscovered}
              </div>
              <div className="mt-4 text-xs text-[#9ca3af] font-mono">
                Across enabled discovery queries
              </div>
            </div>

            <div className="bg-[#ffffff] border border-[#e5e7eb] p-6 rounded-2xl shadow-sm flex flex-col justify-between hover:border-[#fecdd3] transition">
              <span className="mono-eyebrow text-[#6b7280] font-semibold block mb-1">DRAFTS AWAITING APPROVAL</span>
              <div className="text-4xl font-bold tracking-tight text-[#f43f5e]">
                {metrics.pendingDrafts}
              </div>
              <div className="mt-4 text-xs font-mono">
                <Link href="/drafts" className="text-[#f43f5e] hover:underline flex items-center space-x-1 font-semibold">
                  <span>Open queue</span>
                  <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </div>

            <div className="bg-[#ffffff] border border-[#e5e7eb] p-6 rounded-2xl shadow-sm flex flex-col justify-between hover:border-[#fecdd3] transition">
              <span className="mono-eyebrow text-[#6b7280] font-semibold block mb-1">APPROVED / SENT OUTREACH</span>
              <div className="text-4xl font-bold tracking-tight text-[#111827]">
                {metrics.sentEmails} <span className="text-xl font-normal text-[#9ca3af]">sent</span>
              </div>
              <div className="mt-4 text-xs text-[#9ca3af] font-mono">
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
            <div className="border border-[#e5e7eb] rounded-2xl p-6 bg-white shadow-sm">
              <h3 className="mono-eyebrow text-[#f43f5e] font-bold mb-4">4-STAGE RIGID PIPELINE</h3>

              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-[#fff5f6] border border-[#ffe4e6] rounded-xl">
                  <div className="flex items-center space-x-3.5">
                    <div className="w-8 h-8 rounded-full bg-[#f43f5e] text-white flex items-center justify-center font-mono text-xs font-bold">1</div>
                    <div>
                      <div className="text-sm font-semibold text-[#111827]">Google Places Discovery Adapter</div>
                      <div className="text-xs text-[#6b7280]">Targeting cafe, bakery, and retail small businesses in designated cities</div>
                    </div>
                  </div>
                  <span className="mono-eyebrow text-xs text-[#f43f5e] font-bold">AUTOMATIC</span>
                </div>

                <div className="flex items-center justify-between p-4 bg-[#f9fafb] border border-[#f3f4f6] rounded-xl">
                  <div className="flex items-center space-x-3.5">
                    <div className="w-8 h-8 rounded-full bg-[#111827] text-white flex items-center justify-center font-mono text-xs font-bold">2</div>
                    <div>
                      <div className="text-sm font-semibold text-[#111827]">Safe Webpage Inspection & Evidence</div>
                      <div className="text-xs text-[#6b7280]">SSRF-protected fetching, parsing menu, booking & responsive elements</div>
                    </div>
                  </div>
                  <span className="mono-eyebrow text-xs text-emerald-600 font-bold">AUTOMATIC</span>
                </div>

                <div className="flex items-center justify-between p-4 bg-[#f9fafb] border border-[#f3f4f6] rounded-xl">
                  <div className="flex items-center space-x-3.5">
                    <div className="w-8 h-8 rounded-full bg-[#111827] text-white flex items-center justify-center font-mono text-xs font-bold">3</div>
                    <div>
                      <div className="text-sm font-semibold text-[#111827]">Explainable Qualification & AI Drafting</div>
                      <div className="text-xs text-[#6b7280]">4-component deterministic score + grounded email draft generation</div>
                    </div>
                  </div>
                  <span className="mono-eyebrow text-xs text-[#6b7280] font-bold">{metrics.qualifiedLeadsMonth} QUALIFIED</span>
                </div>

                <div className="flex items-center justify-between p-4 bg-[#fff1f2] border border-[#fecdd3] rounded-xl">
                  <div className="flex items-center space-x-3.5">
                    <div className="w-8 h-8 rounded-full bg-[#f43f5e] text-white flex items-center justify-center font-mono text-xs font-bold">4</div>
                    <div>
                      <div className="text-sm font-semibold text-[#111827]">Explicit Operator Approval Queue</div>
                      <div className="text-xs text-[#6b7280]">Human-in-the-loop validation of recipient, claims, and subject</div>
                    </div>
                  </div>
                  <Link href="/drafts" className="mono-btn text-xs text-[#f43f5e] hover:underline font-bold">
                    {metrics.pendingDrafts} TO APPROVE →
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* Provider status sidebar */}
          <div className="space-y-6">
            <div className="border border-[#e5e7eb] rounded-2xl p-6 bg-white shadow-sm">
              <h3 className="mono-eyebrow text-[#f43f5e] font-bold mb-4">SYSTEM LEDGER</h3>
              <div className="space-y-4 text-xs font-mono">
                <div className="flex justify-between items-center py-2 border-b border-[#f3f4f6]">
                  <span className="text-[#6b7280]">DISCOVERY PROVIDER</span>
                  <span className="bg-[#f3f4f6] px-2.5 py-1 rounded-full font-semibold text-[#111827]">{data?.systemStatus?.discoveryProvider || 'mock'}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-[#f3f4f6]">
                  <span className="text-[#6b7280]">AI PROVIDER</span>
                  <span className="bg-[#f3f4f6] px-2.5 py-1 rounded-full font-semibold text-[#111827]">{data?.systemStatus?.aiProvider || 'mock'}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-[#f3f4f6]">
                  <span className="text-[#6b7280]">AUTO-SENDING ACTIVE</span>
                  <span className={`px-2.5 py-1 rounded-full font-semibold ${data?.systemStatus?.automatedSending ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                    {data?.systemStatus?.automatedSending ? 'ENABLED' : 'DISABLED (SAFE)'}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-[#f3f4f6]">
                  <span className="text-[#6b7280]">SPEND TO DATE</span>
                  <span className="font-semibold text-[#111827]">₹{metrics.estimatedCostInr} / ₹{metrics.monthlySpendCapInr}</span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-[#6b7280]">DURABLE QUEUE</span>
                  <span className="font-semibold text-[#111827]">{metrics.activeJobs} jobs active</span>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-[#f3f4f6]">
                <Link
                  href="/settings"
                  className="mono-btn w-full block text-center bg-[#fff1f2] hover:bg-[#ffe4e6] text-[#f43f5e] font-bold py-2.5 rounded-full text-xs transition"
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
