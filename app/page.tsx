'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Target, Search, CheckCircle, Mail, AlertTriangle, ArrowRight, ShieldCheck, Play, Sparkles, RefreshCw } from 'lucide-react';

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
    setCronStatus('Processing background queue...');
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
    <div className="flex flex-col bg-white dark:bg-[#010120] text-[#000000] dark:text-[#ffffff] min-h-screen transition-colors duration-150">
      {/* 2px Signature Together AI Brand Gradient Ribbon */}
      <div className="brand-gradient-h w-full" />

      {/* Hero Band: Canvas Dark #010120 */}
      <section className="bg-[#010120] text-white pt-10 pb-12 px-6 border-b border-white/[0.08]">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
            <div className="max-w-2xl">
              <div className="flex items-center space-x-2 text-[10px] font-mono tracking-widest text-[#959494] uppercase mb-1">
                <span>SYSTEM OVERVIEW // LIVE PIPELINE</span>
                <span>•</span>
                <span className="text-[#ef2cc1]">AUTONOMOUS ENGINE</span>
              </div>
              <h1 className="text-3xl md:text-5xl font-medium tracking-tight text-white mb-2 leading-[1.12]">
                Evidence-backed outreach for modern small businesses.
              </h1>
              <p className="text-[#959494] text-xs md:text-sm leading-relaxed font-normal">
                Evee inspects public business websites, discovers concrete automation opportunities, scores qualification deterministically, and prepares personalized drafts requiring explicit operator approval.
              </p>
            </div>

            {/* Quick Action Buttons: Canonical 4px Radius */}
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                onClick={triggerJobProcessing}
                disabled={cronRunning}
                className="mono-btn bg-white hover:bg-neutral-200 text-black px-4 py-2 rounded-[4px] text-xs font-semibold transition flex items-center space-x-2 active:scale-95"
              >
                {cronRunning ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Play className="w-3.5 h-3.5 fill-black" />
                )}
                <span>{cronRunning ? 'PROCESSING...' : 'TRIGGER WORKER'}</span>
              </button>

              <Link
                href="/campaigns"
                className="mono-btn bg-[#313641] hover:bg-[#313641]/80 text-white border border-white/[0.08] px-4 py-2 rounded-[4px] text-xs font-semibold transition"
              >
                VIEW CAMPAIGNS
              </Link>
            </div>
          </div>

          {cronStatus && (
            <div className="mb-6 p-3 rounded-[4px] bg-[#313641]/60 border border-white/[0.08] text-xs font-mono text-white flex items-center justify-between">
              <span>{cronStatus}</span>
              <button onClick={() => setCronStatus(null)} className="text-[#959494] hover:text-white">✕</button>
            </div>
          )}

          {/* Metric Cards: Hairline Grid with Canonical 4px Radius */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3.5">
            <div className="bg-[#313641]/30 border border-white/[0.08] p-5 rounded-[4px] flex flex-col justify-between">
              <div>
                <span className="mono-eyebrow text-[#959494] text-[10px] block mb-1">
                  MONTHLY QUALIFIED TARGET
                </span>
                <div className="text-3xl font-medium tracking-tight text-white">
                  {metrics.qualifiedLeadsMonth} <span className="text-lg font-normal text-[#959494]">/ {metrics.monthlyTarget}</span>
                </div>
              </div>
              <div className="mt-4">
                <div className="flex justify-between text-[11px] font-mono mb-1 text-[#959494]">
                  <span>PROGRESS</span>
                  <span className="font-semibold text-white">{metrics.targetProgressPercentage}%</span>
                </div>
                <div className="w-full bg-white/[0.08] rounded-[2px] h-1.5 overflow-hidden">
                  <div
                    className="bg-[#ef2cc1] h-full rounded-[2px] transition-all"
                    style={{ width: `${Math.min(metrics.targetProgressPercentage, 100)}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="bg-[#313641]/30 border border-white/[0.08] p-5 rounded-[4px] flex flex-col justify-between">
              <span className="mono-eyebrow text-[#959494] text-[10px] block mb-1">
                DISCOVERED BUSINESSES
              </span>
              <div className="text-3xl font-medium tracking-tight text-white">
                {metrics.totalDiscovered}
              </div>
              <div className="mt-4 text-[11px] text-[#959494] font-mono">
                Across active campaigns
              </div>
            </div>

            <div className="bg-[#313641]/30 border border-white/[0.08] p-5 rounded-[4px] flex flex-col justify-between">
              <span className="mono-eyebrow text-[#959494] text-[10px] block mb-1">
                DRAFTS AWAITING APPROVAL
              </span>
              <div className="text-3xl font-medium tracking-tight text-[#ef2cc1]">
                {metrics.pendingDrafts}
              </div>
              <div className="mt-4 text-[11px] font-mono">
                <Link href="/drafts" className="text-white hover:text-[#ef2cc1] flex items-center space-x-1 font-semibold">
                  <span>OPEN REVIEWER</span>
                  <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </div>

            <div className="bg-[#313641]/30 border border-white/[0.08] p-5 rounded-[4px] flex flex-col justify-between">
              <span className="mono-eyebrow text-[#959494] text-[10px] block mb-1">
                APPROVED / SENT OUTREACH
              </span>
              <div className="text-3xl font-medium tracking-tight text-white">
                {metrics.sentEmails} <span className="text-sm font-normal text-[#959494]">sent</span>
              </div>
              <div className="mt-4 text-[11px] text-[#959494] font-mono">
                {metrics.queuedEmails} queued in queue
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Operating Surface: Clean White / Dark Contrast */}
      <section className="max-w-7xl mx-auto px-6 py-10 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Column 1 & 2: Pipeline Lifecycle */}
          <div className="lg:col-span-2 space-y-4">
            <div className="border border-[#ebebeb] dark:border-white/[0.08] rounded-[4px] p-6 bg-white dark:bg-[#010120]">
              <div className="flex items-center justify-between mb-4">
                <h3 className="mono-eyebrow text-black dark:text-white text-xs font-semibold">
                  4-STAGE OUTBOUND PIPELINE
                </h3>
                <span className="text-[10px] font-mono text-[#959494] uppercase">
                  DETERMINISTIC VERIFICATION
                </span>
              </div>

              <div className="space-y-2.5">
                <div className="flex items-center justify-between p-3.5 bg-[#f8fafc] dark:bg-[#313641]/20 border border-[#ebebeb] dark:border-white/[0.06] rounded-[4px]">
                  <div className="flex items-center space-x-3">
                    <div className="w-6 h-6 rounded-[3px] bg-black dark:bg-white text-white dark:text-black flex items-center justify-center font-mono text-xs font-bold">1</div>
                    <div>
                      <div className="text-xs font-medium text-black dark:text-white">Discovery Adapter</div>
                      <div className="text-[11px] text-[#6b7280] dark:text-[#959494]">Targeting local businesses across designated cities</div>
                    </div>
                  </div>
                  <span className="mono-eyebrow text-[10px] text-[#6b7280] dark:text-[#959494]">AUTOMATIC</span>
                </div>

                <div className="flex items-center justify-between p-3.5 bg-[#f8fafc] dark:bg-[#313641]/20 border border-[#ebebeb] dark:border-white/[0.06] rounded-[4px]">
                  <div className="flex items-center space-x-3">
                    <div className="w-6 h-6 rounded-[3px] bg-black dark:bg-white text-white dark:text-black flex items-center justify-center font-mono text-xs font-bold">2</div>
                    <div>
                      <div className="text-xs font-medium text-black dark:text-white">Safe Webpage Inspection & Evidence</div>
                      <div className="text-[11px] text-[#6b7280] dark:text-[#959494]">Safe crawling probing contact, booking & responsive elements</div>
                    </div>
                  </div>
                  <span className="mono-eyebrow text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">AUTOMATIC</span>
                </div>

                <div className="flex items-center justify-between p-3.5 bg-[#f8fafc] dark:bg-[#313641]/20 border border-[#ebebeb] dark:border-white/[0.06] rounded-[4px]">
                  <div className="flex items-center space-x-3">
                    <div className="w-6 h-6 rounded-[3px] bg-black dark:bg-white text-white dark:text-black flex items-center justify-center font-mono text-xs font-bold">3</div>
                    <div>
                      <div className="text-xs font-medium text-black dark:text-white">Explainable Qualification & AI Drafting</div>
                      <div className="text-[11px] text-[#6b7280] dark:text-[#959494]">Deterministic qualification score + research-backed draft</div>
                    </div>
                  </div>
                  <span className="mono-eyebrow text-[10px] text-black dark:text-white font-semibold">{metrics.qualifiedLeadsMonth} QUALIFIED</span>
                </div>

                <div className="flex items-center justify-between p-3.5 bg-[#f8fafc] dark:bg-[#313641]/20 border border-[#ebebeb] dark:border-white/[0.06] rounded-[4px]">
                  <div className="flex items-center space-x-3">
                    <div className="w-6 h-6 rounded-[3px] bg-[#ef2cc1] text-white flex items-center justify-center font-mono text-xs font-bold">4</div>
                    <div>
                      <div className="text-xs font-medium text-black dark:text-white">Explicit Operator Approval Queue</div>
                      <div className="text-[11px] text-[#6b7280] dark:text-[#959494]">Human-in-the-loop validation of recipient, claims, and subject</div>
                    </div>
                  </div>
                  <Link href="/drafts" className="mono-btn text-xs text-[#ef2cc1] hover:underline font-semibold">
                    {metrics.pendingDrafts} TO APPROVE →
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* Column 3: System Ledger */}
          <div className="space-y-4">
            <div className="border border-[#ebebeb] dark:border-white/[0.08] rounded-[4px] p-6 bg-white dark:bg-[#010120]">
              <h3 className="mono-eyebrow text-black dark:text-white text-xs font-semibold mb-4">
                SYSTEM LEDGER
              </h3>
              <div className="space-y-3 text-xs font-mono">
                <div className="flex justify-between items-center py-1.5 border-b border-[#ebebeb] dark:border-white/[0.06]">
                  <span className="text-[#6b7280] dark:text-[#959494]">AI INFERENCE</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold">GEMINI 1.5 FLASH</span>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-[#ebebeb] dark:border-white/[0.06]">
                  <span className="text-[#6b7280] dark:text-[#959494]">EMAIL DISPATCH</span>
                  <span className="text-black dark:text-white font-semibold">RESEND SMTP</span>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-[#ebebeb] dark:border-white/[0.06]">
                  <span className="text-[#6b7280] dark:text-[#959494]">DATA PERSISTENCE</span>
                  <span className="text-black dark:text-white font-semibold">SUPABASE POSTGRES</span>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-[#ebebeb] dark:border-white/[0.06]">
                  <span className="text-[#6b7280] dark:text-[#959494]">DAILY SEND CAP</span>
                  <span className="text-black dark:text-white font-semibold">50 / DAY</span>
                </div>
                <div className="flex justify-between items-center py-1.5">
                  <span className="text-[#6b7280] dark:text-[#959494]">SUPPRESSION LIST</span>
                  <span className="text-black dark:text-white font-semibold">{metrics.suppressionCount} BLOCKED</span>
                </div>
              </div>

              <div className="mt-5 pt-4 border-t border-[#ebebeb] dark:border-white/[0.08]">
                <Link
                  href="/settings"
                  className="mono-btn w-full block text-center py-2 bg-black dark:bg-white text-white dark:text-black rounded-[4px] text-xs font-semibold hover:bg-neutral-800 dark:hover:bg-neutral-200 transition"
                >
                  CONFIGURE SETTINGS
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
