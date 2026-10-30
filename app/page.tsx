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
    <div className="flex flex-col">
      {/* Hero Band Dark (Together AI Design Style) */}
      <section className="bg-[#010120] text-white pt-16 pb-20 px-6 border-b border-white/10 relative overflow-hidden">
        {/* Ribbon Gradient Glow Element */}
        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-96 h-96 brand-gradient opacity-20 blur-3xl rounded-full pointer-events-none"></div>

        <div className="max-w-7xl mx-auto relative z-10">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-12">
            <div className="max-w-2xl">
              <div className="inline-flex items-center space-x-2 px-2.5 py-1 rounded-[4px] bg-white/5 border border-white/15 mb-4">
                <span className="w-1.5 h-1.5 rounded-full bg-[#c8f6f9]"></span>
                <span className="mono-eyebrow text-white/80">CONTROLLED AI PROSPECTING</span>
              </div>
              <h1 className="text-4xl md:text-5xl font-medium tracking-tight text-white mb-4">
                Evidence-backed outreach for modern small businesses.
              </h1>
              <p className="text-white/60 text-lg leading-relaxed">
                Evee inspects public business websites, discovers concrete automation opportunities, scores qualification deterministically, and prepares personalized drafts requiring explicit operator approval.
              </p>
            </div>

            {/* Quick Action Group */}
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={triggerJobProcessing}
                disabled={cronRunning}
                className="mono-btn bg-[#c8f6f9] text-black hover:bg-[#aef0f5] px-4 py-2.5 rounded-[4px] transition flex items-center space-x-2 text-xs"
              >
                <Play className="w-3.5 h-3.5 fill-black" />
                <span>{cronRunning ? 'PROCESSING...' : 'TRIGGER WORKER'}</span>
              </button>

              <Link
                href="/campaigns"
                className="mono-btn bg-white/10 text-white hover:bg-white/20 border border-white/20 px-4 py-2.5 rounded-[4px] transition text-xs"
              >
                VIEW CAMPAIGNS
              </Link>
            </div>
          </div>

          {cronStatus && (
            <div className="mb-8 p-3 rounded-[4px] bg-white/10 border border-white/20 text-xs font-mono text-white/90">
              {cronStatus}
            </div>
          )}

          {/* Primary Metric Tile: Monthly Target Progress */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-[#c8f6f9] text-black p-6 rounded-[4px] relative overflow-hidden flex flex-col justify-between">
              <div>
                <span className="mono-eyebrow text-black/60 block mb-1">MONTHLY QUALIFIED TARGET</span>
                <div className="text-4xl font-semibold tracking-tight">
                  {metrics.qualifiedLeadsMonth} <span className="text-2xl font-normal text-black/50">/ {metrics.monthlyTarget}</span>
                </div>
              </div>
              <div className="mt-6">
                <div className="flex justify-between text-xs font-mono mb-1 text-black/70">
                  <span>PROGRESS</span>
                  <span>{metrics.targetProgressPercentage}%</span>
                </div>
                <div className="w-full bg-black/10 rounded-full h-1.5 overflow-hidden">
                  <div className="bg-black h-full rounded-full transition-all" style={{ width: `${metrics.targetProgressPercentage}%` }}></div>
                </div>
              </div>
            </div>

            <div className="bg-white/5 border border-white/10 p-6 rounded-[4px] flex flex-col justify-between">
              <span className="mono-eyebrow text-white/50 block mb-1">DISCOVERED BUSINESSES</span>
              <div className="text-4xl font-semibold tracking-tight text-white">
                {metrics.totalDiscovered}
              </div>
              <div className="mt-4 text-xs text-white/50 font-mono">
                Across enabled geography queries
              </div>
            </div>

            <div className="bg-white/5 border border-white/10 p-6 rounded-[4px] flex flex-col justify-between">
              <span className="mono-eyebrow text-white/50 block mb-1">DRAFTS AWAITING APPROVAL</span>
              <div className="text-4xl font-semibold tracking-tight text-[#ef2cc1]">
                {metrics.pendingDrafts}
              </div>
              <div className="mt-4 flex items-center justify-between text-xs font-mono text-white/50">
                <span>{metrics.approvedDrafts} approved</span>
                <Link href="/drafts" className="text-[#c8f6f9] hover:underline flex items-center space-x-1">
                  <span>REVIEW</span>
                  <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </div>

            <div className="bg-white/5 border border-white/10 p-6 rounded-[4px] flex flex-col justify-between">
              <span className="mono-eyebrow text-white/50 block mb-1">OUTBOUND DISPATCH</span>
              <div className="text-4xl font-semibold tracking-tight text-white">
                {metrics.sentEmails} <span className="text-xl text-white/40 font-normal">sent</span>
              </div>
              <div className="mt-4 flex items-center justify-between text-xs font-mono text-white/50">
                <span>{metrics.queuedEmails} queued</span>
                <span className="text-white/40">Safety cap: 5/day</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content Section (White Background - Together AI Content Band) */}
      <section className="py-16 px-6 max-w-7xl mx-auto w-full">
        {/* Core Architectural Guarantees Pill Grid */}
        <div className="mb-12">
          <div className="mono-eyebrow text-black/50 mb-3">SYSTEM INTEGRITY & SAFETY GATES</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 border border-black/[0.08] rounded-[4px] bg-white">
              <div className="flex items-center space-x-2 text-black font-semibold text-sm mb-1">
                <CheckCircle className="w-4 h-4 text-emerald-600" />
                <span>Deterministic Scoring</span>
              </div>
              <p className="text-xs text-black/60">
                100-pt evidence-quality caps prevent false positives; unverified items capped at 30 pts.
              </p>
            </div>

            <div className="p-4 border border-black/[0.08] rounded-[4px] bg-white">
              <div className="flex items-center space-x-2 text-black font-semibold text-sm mb-1">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Fail-Closed Approvals</span>
              </div>
              <p className="text-xs text-black/60">
                Outbound emails require human review. Unapproved workflows strictly block dispatcher execution.
              </p>
            </div>

            <div className="p-4 border border-black/[0.08] rounded-[4px] bg-white">
              <div className="flex items-center space-x-2 text-black font-semibold text-sm mb-1">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span>Pre-Send Suppression</span>
              </div>
              <p className="text-xs text-black/60">
                Global suppression and opt-out list is re-verified immediately before every Gmail API send.
              </p>
            </div>

            <div className="p-4 border border-black/[0.08] rounded-[4px] bg-white">
              <div className="flex items-center space-x-2 text-black font-semibold text-sm mb-1">
                <Sparkles className="w-4 h-4 text-blue-600" />
                <span>Zero Hallucination</span>
              </div>
              <p className="text-xs text-black/60">
                Drafts quote only validated evidence item IDs extracted from verified public web pages.
              </p>
            </div>
          </div>
        </div>

        {/* Operational Overview Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Column 1: Quick Navigation Cards */}
          <div className="md:col-span-2 space-y-6">
            <div className="border border-black/[0.08] rounded-[4px] p-6 bg-white">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold tracking-tight text-black">Active Prospecting Pipeline</h3>
                  <p className="text-sm text-black/60">End-to-end workflow status from discovery to verified outreach.</p>
                </div>
                <Link
                  href="/leads"
                  className="mono-btn bg-black text-white hover:bg-black/80 px-3.5 py-1.5 rounded-[4px] text-xs transition"
                >
                  EXPLORE LEADS
                </Link>
              </div>

              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between p-3 bg-[#f9f9fa] border border-black/[0.04] rounded-[4px]">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-full bg-black text-white flex items-center justify-center font-mono text-xs">1</div>
                    <div>
                      <div className="text-sm font-medium">Business Discovery</div>
                      <div className="text-xs text-black/50">Google Places API / Verified Directory listings</div>
                    </div>
                  </div>
                  <span className="mono-eyebrow text-xs text-black/60">{metrics.totalDiscovered} DISCOVERED</span>
                </div>

                <div className="flex items-center justify-between p-3 bg-[#f9f9fa] border border-black/[0.04] rounded-[4px]">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-full bg-black text-white flex items-center justify-center font-mono text-xs">2</div>
                    <div>
                      <div className="text-sm font-medium">Safe Webpage Inspection & Evidence</div>
                      <div className="text-xs text-black/50">SSRF-protected fetching, parsing menu, booking & responsive elements</div>
                    </div>
                  </div>
                  <span className="mono-eyebrow text-xs text-emerald-600 font-semibold">AUTOMATIC</span>
                </div>

                <div className="flex items-center justify-between p-3 bg-[#f9f9fa] border border-black/[0.04] rounded-[4px]">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-full bg-black text-white flex items-center justify-center font-mono text-xs">3</div>
                    <div>
                      <div className="text-sm font-medium">Explainable Qualification & AI Drafting</div>
                      <div className="text-xs text-black/50">4-component deterministic score + grounded email draft generation</div>
                    </div>
                  </div>
                  <span className="mono-eyebrow text-xs text-black/60">{metrics.qualifiedLeadsMonth} QUALIFIED</span>
                </div>

                <div className="flex items-center justify-between p-3 bg-[#f9f9fa] border border-black/[0.04] rounded-[4px]">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-full bg-[#ef2cc1] text-white flex items-center justify-center font-mono text-xs">4</div>
                    <div>
                      <div className="text-sm font-medium">Explicit Operator Approval Queue</div>
                      <div className="text-xs text-black/50">Human-in-the-loop validation of recipient, claims, and subject</div>
                    </div>
                  </div>
                  <Link href="/drafts" className="mono-btn text-xs text-[#ef2cc1] hover:underline font-semibold">
                    {metrics.pendingDrafts} TO APPROVE →
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* Column 2: System Health & Provider Usage */}
          <div className="space-y-6">
            <div className="border border-black/[0.08] rounded-[4px] p-6 bg-white">
              <h3 className="mono-eyebrow text-black/50 mb-4">PROVIDER STATUS</h3>
              <div className="space-y-4 text-xs font-mono">
                <div className="flex justify-between items-center py-2 border-b border-black/[0.06]">
                  <span className="text-black/60">DISCOVERY PROVIDER</span>
                  <span className="bg-black/5 px-2 py-0.5 rounded-[4px] font-semibold">{data?.systemStatus?.discoveryProvider || 'mock'}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-black/[0.06]">
                  <span className="text-black/60">AI PROVIDER</span>
                  <span className="bg-black/5 px-2 py-0.5 rounded-[4px] font-semibold">{data?.systemStatus?.aiProvider || 'mock'}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-black/[0.06]">
                  <span className="text-black/60">AUTO-SENDING ACTIVE</span>
                  <span className={`px-2 py-0.5 rounded-[4px] font-semibold ${data?.systemStatus?.automatedSending ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                    {data?.systemStatus?.automatedSending ? 'ENABLED' : 'DISABLED (SAFE)'}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-black/[0.06]">
                  <span className="text-black/60">SPEND TO DATE</span>
                  <span className="font-semibold">₹{metrics.estimatedCostInr} / ₹{metrics.monthlySpendCapInr}</span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-black/60">DURABLE QUEUE</span>
                  <span className="font-semibold">{metrics.activeJobs} jobs active ({metrics.failedJobs} failed)</span>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-black/[0.06]">
                <Link
                  href="/settings"
                  className="mono-btn w-full block text-center bg-black/5 hover:bg-black/10 text-black py-2 rounded-[4px] text-xs transition"
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
