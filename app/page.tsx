'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Target,
  Search,
  CheckCircle,
  Mail,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  Play,
  Sparkles,
  RefreshCw,
  Cpu,
  Zap,
  ArrowUpRight,
  Check,
  Activity,
  Database,
  FileSpreadsheet,
} from 'lucide-react';

export default function DashboardPage() {
  const [data, setData] = useState<any>(null);
  const [providerSettings, setProviderSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [cronRunning, setCronRunning] = useState(false);
  const [cronStatus, setCronStatus] = useState<string | null>(null);

  const fetchOverview = async () => {
    try {
      const [overviewRes, providersRes] = await Promise.all([
        fetch('/api/reports/overview'),
        fetch('/api/settings/providers'),
      ]);
      const json = await overviewRes.json();
      const pJson = await providersRes.json();
      setData(json);
      setProviderSettings(pJson?.settings);
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
      setCronStatus(
        `Processed ${json.processed?.claimedJobs || 0} jobs (${json.processed?.succeeded || 0} succeeded)`
      );
      fetchOverview();
    } catch (err: any) {
      setCronStatus(`Error: ${err.message}`);
    } finally {
      setCronRunning(false);
    }
  };

  const metrics = data?.metrics || {
    totalDiscovered: 0,
    activeLeads: 0,
    archivedLeads: 0,
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
  };

  const activeAiName = providerSettings?.aiProvider ? providerSettings.aiProvider.toUpperCase() : 'GEMINI';
  const activeAiModel = providerSettings?.aiModel || 'gemini-1.5-flash';
  const isSmtpConnected = providerSettings?.smtpConfigured;

  return (
    <div className="flex flex-col bg-white dark:bg-[#010120] text-[#000000] dark:text-[#ffffff] min-h-screen transition-colors duration-150">
      {/* 2px Signature Together AI Brand Gradient Ribbon */}
      <div className="brand-gradient-h w-full" />

      {/* Hero Band: Canvas Dark #010120 with structural developer grid */}
      <section className="bg-[#010120] text-white pt-10 pb-12 px-6 border-b border-white/[0.08] relative overflow-hidden v2-grid-bg">
        <div className="max-w-7xl mx-auto relative z-10">
          {/* Top Eyebrow & Status Telemetry */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
            <div className="max-w-2xl">
              <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono tracking-widest text-[#959494] uppercase mb-2">
                <span>EVEE v2.0 // AUTONOMOUS MULTI-LLM OUTREACH MESH</span>
                <span>•</span>
                <span className="v2-badge text-emerald-400 bg-emerald-500/10 border-emerald-500/20">
                  SYSTEM ACTIVE
                </span>
                <span className="v2-badge text-[#bdbbff] bg-white/5 border-white/10">
                  AES-256 ENCRYPTED
                </span>
              </div>

              <h1 className="text-3xl md:text-5xl font-medium tracking-tight text-white mb-2.5 leading-[1.12]">
                Autonomous Evidence-Backed Outreach & Conversion Mesh.
              </h1>
              <p className="text-[#959494] text-xs md:text-sm leading-relaxed font-normal max-w-xl">
                Deterministic web inspection, multi-tier contact extraction, and multi-LLM reasoning (Meta, Gemini, OpenAI) with two-way CRM sync and automated lead archival.
              </p>

              {/* Live Telemetry Pills */}
              <div className="flex flex-wrap items-center gap-2 mt-4 text-[10px] font-mono text-[#959494]">
                <div className="flex items-center space-x-1.5 px-2 py-0.5 rounded-[3px] bg-white/[0.04] border border-white/[0.08]">
                  <Sparkles className="w-3 h-3 text-[#ef2cc1]" />
                  <span>LLM: {activeAiName} // {activeAiModel.replace(/^meta-llama\//, '')}</span>
                </div>
                <div className="flex items-center space-x-1.5 px-2 py-0.5 rounded-[3px] bg-white/[0.04] border border-white/[0.08]">
                  <Mail className="w-3 h-3 text-[#bdbbff]" />
                  <span>MAILER: {isSmtpConnected ? 'SMTP ACTIVE' : 'RESEND BACKEND'}</span>
                </div>
                <div className="flex items-center space-x-1.5 px-2 py-0.5 rounded-[3px] bg-white/[0.04] border border-white/[0.08]">
                  <Cpu className="w-3 h-3 text-amber-400" />
                  <span>CONNECTORS: 14 REGISTERED</span>
                </div>
              </div>
            </div>

            {/* Quick Action Buttons: 4px Radius per DESIGN.md */}
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                onClick={triggerJobProcessing}
                disabled={cronRunning}
                className="mono-btn bg-white hover:bg-neutral-200 text-black px-4 py-2 rounded-[4px] text-xs font-semibold transition flex items-center space-x-2 active:scale-95 shadow-sm"
              >
                {cronRunning ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Play className="w-3.5 h-3.5 fill-black" />
                )}
                <span>{cronRunning ? 'PROCESSING...' : 'TRIGGER WORKER'}</span>
              </button>

              <Link
                href="/campaigns/csv"
                className="mono-btn bg-[#313641] hover:bg-[#3d4352] text-white border border-white/[0.12] px-4 py-2 rounded-[4px] text-xs font-semibold transition flex items-center space-x-1.5"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-[#ef2cc1]" />
                <span>CSV PIPELINE</span>
              </Link>

              <Link
                href="/leads"
                className="mono-btn bg-[#313641] hover:bg-[#3d4352] text-white border border-white/[0.12] px-4 py-2 rounded-[4px] text-xs font-semibold transition flex items-center space-x-1.5"
              >
                <Search className="w-3.5 h-3.5 text-[#bdbbff]" />
                <span>LEAD EXPLORER</span>
              </Link>
            </div>
          </div>

          {cronStatus && (
            <div className="mb-6 p-3 rounded-[4px] bg-[#313641]/60 border border-white/[0.08] text-xs font-mono text-white flex items-center justify-between">
              <span>{cronStatus}</span>
              <button onClick={() => setCronStatus(null)} className="text-[#959494] hover:text-white">✕</button>
            </div>
          )}

          {/* v2.0 High-Density KPI Grid: 4px Radius, Hairline Dividers */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
            {/* KPI 1: Target Progress */}
            <div className="bg-[#313641]/30 border border-white/[0.08] p-4 rounded-[4px] flex flex-col justify-between">
              <div>
                <span className="mono-eyebrow text-[#959494] text-[10px] block mb-1">
                  MONTHLY TARGET
                </span>
                <div className="text-2xl lg:text-3xl font-medium tracking-tight text-white">
                  {metrics.qualifiedLeadsMonth} <span className="text-base font-normal text-[#959494]">/ {metrics.monthlyTarget}</span>
                </div>
              </div>
              <div className="mt-3">
                <div className="flex justify-between text-[10px] font-mono mb-1 text-[#959494]">
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

            {/* KPI 2: Total Discovered & Status */}
            <div className="bg-[#313641]/30 border border-white/[0.08] p-4 rounded-[4px] flex flex-col justify-between">
              <span className="mono-eyebrow text-[#959494] text-[10px] block mb-1">
                TOTAL PROSPECTS
              </span>
              <div className="text-2xl lg:text-3xl font-medium tracking-tight text-white">
                {metrics.totalDiscovered}
              </div>
              <div className="mt-3 text-[10px] text-[#959494] font-mono flex items-center space-x-2">
                <span className="text-emerald-400">{metrics.activeLeads || metrics.totalDiscovered} Active</span>
                <span>•</span>
                <span>{metrics.archivedLeads || 0} Archived</span>
              </div>
            </div>

            {/* KPI 3: Qualification */}
            <div className="bg-[#313641]/30 border border-white/[0.08] p-4 rounded-[4px] flex flex-col justify-between">
              <span className="mono-eyebrow text-[#959494] text-[10px] block mb-1">
                SCORED & QUALIFIED
              </span>
              <div className="text-2xl lg:text-3xl font-medium tracking-tight text-white">
                {metrics.qualifiedLeadsMonth}
              </div>
              <div className="mt-3 text-[10px] text-[#959494] font-mono">
                Deterministic threshold &gt; 65
              </div>
            </div>

            {/* KPI 4: Pending Approval */}
            <div className="bg-[#313641]/30 border border-white/[0.08] p-4 rounded-[4px] flex flex-col justify-between">
              <span className="mono-eyebrow text-[#959494] text-[10px] block mb-1">
                DRAFTS TO APPROVE
              </span>
              <div className="text-2xl lg:text-3xl font-medium tracking-tight text-[#ef2cc1]">
                {metrics.pendingDrafts}
              </div>
              <div className="mt-3 text-[10px] font-mono">
                <Link href="/drafts" className="text-white hover:text-[#ef2cc1] flex items-center space-x-1 font-semibold">
                  <span>OPEN REVIEWER</span>
                  <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </div>

            {/* KPI 5: Sent Outreach */}
            <div className="bg-[#313641]/30 border border-white/[0.08] p-4 rounded-[4px] flex flex-col justify-between">
              <span className="mono-eyebrow text-[#959494] text-[10px] block mb-1">
                DISPATCHED EMAILS
              </span>
              <div className="text-2xl lg:text-3xl font-medium tracking-tight text-white">
                {metrics.sentEmails} <span className="text-sm font-normal text-[#959494]">sent</span>
              </div>
              <div className="mt-3 text-[10px] text-[#959494] font-mono flex items-center space-x-1.5">
                <ShieldCheck className="w-3 h-3 text-emerald-400" />
                <span>0% Bounce Shield</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Operating Surface: Clean White / Dark Contrast */}
      <section className="max-w-7xl mx-auto px-6 py-10 w-full space-y-8 flex-1">
        {/* v2.0 Modular Command Cards: 3 Pillars */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Pillar 1: Lead Explorer & Ingestion */}
          <div className="v2-surface p-5 flex flex-col justify-between space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="v2-badge text-black dark:text-white">PROSPECT DIRECTORY</span>
                <Link href="/leads" className="text-[#ef2cc1] hover:underline text-[11px] font-mono flex items-center space-x-0.5">
                  <span>EXPLORER</span>
                  <ArrowUpRight className="w-3 h-3" />
                </Link>
              </div>
              <h3 className="text-base font-semibold text-black dark:text-white">
                Lead Intelligence & Archiving
              </h3>
              <p className="text-xs text-[#6b7280] dark:text-[#959494] leading-relaxed">
                Browse deduplicated prospects with verified emails, underlying tech stack tags, and 1-click no-email lead cleanup.
              </p>
            </div>

            <div className="pt-2 border-t border-[#ebebeb] dark:border-white/[0.06] flex items-center justify-between">
              <span className="text-[11px] font-mono text-[#959494]">
                {metrics.totalDiscovered} leads cataloged
              </span>
              <Link
                href="/leads"
                className="mono-btn bg-black dark:bg-white text-white dark:text-black px-3 py-1 rounded-[3px] text-[10px] font-semibold"
              >
                OPEN DIRECTORY →
              </Link>
            </div>
          </div>

          {/* Pillar 2: AI Copywriting & Optimization */}
          <div className="v2-surface p-5 flex flex-col justify-between space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="v2-badge text-[#ef2cc1]">AI COPY ENGINE</span>
                <Link href="/drafts" className="text-[#ef2cc1] hover:underline text-[11px] font-mono flex items-center space-x-0.5">
                  <span>REVIEWER</span>
                  <ArrowUpRight className="w-3 h-3" />
                </Link>
              </div>
              <h3 className="text-base font-semibold text-black dark:text-white">
                Copywriting & Tone Optimizer
              </h3>
              <p className="text-xs text-[#6b7280] dark:text-[#959494] leading-relaxed">
                6 optimization goals: High Conversion Hook, Concise (&lt;85 words), Frictionless CTA, and Consultative Tone with token protection.
              </p>
            </div>

            <div className="pt-2 border-t border-[#ebebeb] dark:border-white/[0.06] flex items-center justify-between">
              <span className="text-[11px] font-mono text-[#ef2cc1] font-semibold">
                {metrics.pendingDrafts} pending approval
              </span>
              <Link
                href="/drafts"
                className="mono-btn bg-black dark:bg-white text-white dark:text-black px-3 py-1 rounded-[3px] text-[10px] font-semibold"
              >
                OPTIMIZE DRAFTS →
              </Link>
            </div>
          </div>

          {/* Pillar 3: Connectors & Integrations Hub */}
          <div className="v2-surface p-5 flex flex-col justify-between space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="v2-badge text-amber-500">CONNECTORS MESH</span>
                <Link href="/settings?tab=connectors" className="text-[#ef2cc1] hover:underline text-[11px] font-mono flex items-center space-x-0.5">
                  <span>SETTINGS</span>
                  <ArrowUpRight className="w-3 h-3" />
                </Link>
              </div>
              <h3 className="text-base font-semibold text-black dark:text-white">
                CRMs, Smartlead & Webhooks
              </h3>
              <p className="text-xs text-[#6b7280] dark:text-[#959494] leading-relaxed">
                Two-way sync with HubSpot, Salesforce, Pipedrive, Instantly, and real-time Hot-Lead reply alerts to Slack and Discord.
              </p>
            </div>

            <div className="pt-2 border-t border-[#ebebeb] dark:border-white/[0.06] flex items-center justify-between">
              <span className="text-[11px] font-mono text-[#959494]">
                14 providers available
              </span>
              <Link
                href="/settings?tab=connectors"
                className="mono-btn bg-black dark:bg-white text-white dark:text-black px-3 py-1 rounded-[3px] text-[10px] font-semibold"
              >
                CONNECT APIS →
              </Link>
            </div>
          </div>
        </div>

        {/* Pipeline & Telemetry Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* Column 1 & 2: 4-Stage Outbound Pipeline */}
          <div className="lg:col-span-2 space-y-4">
            <div className="v2-surface p-6">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#ebebeb] dark:border-white/[0.06]">
                <div>
                  <h3 className="mono-eyebrow text-black dark:text-white text-xs font-semibold">
                    4-STAGE AUTONOMOUS OUTBOUND PIPELINE
                  </h3>
                  <p className="text-[11px] text-[#959494] font-mono mt-0.5">
                    End-to-end verification pipeline from discovery to operator dispatch
                  </p>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-[2px] bg-black/5 dark:bg-white/10 text-black dark:text-white">
                  v2.0 ACTIVE
                </span>
              </div>

              <div className="space-y-2.5">
                <div className="flex items-center justify-between p-3.5 bg-[#f8fafc] dark:bg-[#14161f] border border-[#ebebeb] dark:border-white/[0.06] rounded-[4px]">
                  <div className="flex items-center space-x-3">
                    <div className="w-6 h-6 rounded-[3px] bg-black dark:bg-white text-white dark:text-black flex items-center justify-center font-mono text-xs font-bold">1</div>
                    <div>
                      <div className="text-xs font-medium text-black dark:text-white">Discovery & CSV Ingestion</div>
                      <div className="text-[11px] text-[#6b7280] dark:text-[#959494]">Local business discovery across designated regions or direct CSV prospect mapping</div>
                    </div>
                  </div>
                  <span className="mono-eyebrow text-[10px] text-[#6b7280] dark:text-[#959494]">AUTOMATIC</span>
                </div>

                <div className="flex items-center justify-between p-3.5 bg-[#f8fafc] dark:bg-[#14161f] border border-[#ebebeb] dark:border-white/[0.06] rounded-[4px]">
                  <div className="flex items-center space-x-3">
                    <div className="w-6 h-6 rounded-[3px] bg-black dark:bg-white text-white dark:text-black flex items-center justify-center font-mono text-xs font-bold">2</div>
                    <div>
                      <div className="text-xs font-medium text-black dark:text-white">Tech Stack & Web Inspection</div>
                      <div className="text-[11px] text-[#6b7280] dark:text-[#959494]">Safe probing detecting Shopify, WordPress, booking systems & mobile viewports</div>
                    </div>
                  </div>
                  <span className="mono-eyebrow text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">AUTOMATIC</span>
                </div>

                <div className="flex items-center justify-between p-3.5 bg-[#f8fafc] dark:bg-[#14161f] border border-[#ebebeb] dark:border-white/[0.06] rounded-[4px]">
                  <div className="flex items-center space-x-3">
                    <div className="w-6 h-6 rounded-[3px] bg-black dark:bg-white text-white dark:text-black flex items-center justify-center font-mono text-xs font-bold">3</div>
                    <div>
                      <div className="text-xs font-medium text-black dark:text-white">Deterministic Qualification & AI Drafting</div>
                      <div className="text-[11px] text-[#6b7280] dark:text-[#959494]">Multi-model LLM generation (Meta, Gemini, OpenAI) grounded in empirical findings</div>
                    </div>
                  </div>
                  <span className="mono-eyebrow text-[10px] text-black dark:text-white font-semibold">{metrics.qualifiedLeadsMonth} QUALIFIED</span>
                </div>

                <div className="flex items-center justify-between p-3.5 bg-[#f8fafc] dark:bg-[#14161f] border border-[#ebebeb] dark:border-white/[0.06] rounded-[4px]">
                  <div className="flex items-center space-x-3">
                    <div className="w-6 h-6 rounded-[3px] bg-[#ef2cc1] text-white flex items-center justify-center font-mono text-xs font-bold">4</div>
                    <div>
                      <div className="text-xs font-medium text-black dark:text-white">Operator Review Gate & Dispatch</div>
                      <div className="text-[11px] text-[#6b7280] dark:text-[#959494]">Human-in-the-loop review barrier before outbound sending and CRM update</div>
                    </div>
                  </div>
                  <Link href="/drafts" className="mono-btn text-xs text-[#ef2cc1] hover:underline font-semibold">
                    {metrics.pendingDrafts} TO APPROVE →
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* Column 3: System Ledger & Telemetry */}
          <div className="space-y-4">
            <div className="v2-surface p-6">
              <div className="flex items-center justify-between pb-3 border-b border-[#ebebeb] dark:border-white/[0.06] mb-4">
                <h3 className="mono-eyebrow text-black dark:text-white text-xs font-semibold">
                  SYSTEM LEDGER
                </h3>
                <span className="text-[10px] font-mono text-emerald-500 font-semibold">
                  ENCRYPTED
                </span>
              </div>

              <div className="space-y-3 text-xs font-mono">
                <div className="flex justify-between items-center py-1.5 border-b border-[#ebebeb] dark:border-white/[0.06]">
                  <span className="text-[#6b7280] dark:text-[#959494]">AI ENGINE</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold truncate max-w-[170px]" title={`${activeAiName}: ${activeAiModel}`}>
                    {activeAiName} ({activeAiModel.replace(/^meta-llama\//, '')})
                  </span>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-[#ebebeb] dark:border-white/[0.06]">
                  <span className="text-[#6b7280] dark:text-[#959494]">OUTREACH MAILER</span>
                  <span className="text-black dark:text-white font-semibold">
                    {isSmtpConnected ? 'AUTHENTICATED SMTP' : 'RESEND BACKEND'}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-[#ebebeb] dark:border-white/[0.06]">
                  <span className="text-[#6b7280] dark:text-[#959494]">DATA PERSISTENCE</span>
                  <span className="text-black dark:text-white font-semibold">SUPABASE POSTGRES</span>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-[#ebebeb] dark:border-white/[0.06]">
                  <span className="text-[#6b7280] dark:text-[#959494]">INTEGRATIONS</span>
                  <span className="text-black dark:text-white font-semibold">14 REGISTERED</span>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-[#ebebeb] dark:border-white/[0.06]">
                  <span className="text-[#6b7280] dark:text-[#959494]">BOUNCE SHIELD</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold">&lt; 2% AUTO-GUARD</span>
                </div>
                <div className="flex justify-between items-center py-1.5">
                  <span className="text-[#6b7280] dark:text-[#959494]">SUPPRESSION LIST</span>
                  <span className="text-black dark:text-white font-semibold">{metrics.suppressionCount} BLOCKED</span>
                </div>
              </div>

              <div className="mt-5 pt-4 border-t border-[#ebebeb] dark:border-white/[0.08] space-y-2">
                <Link
                  href="/settings"
                  className="mono-btn w-full block text-center py-2 bg-black dark:bg-white text-white dark:text-black rounded-[4px] text-xs font-semibold hover:bg-neutral-800 dark:hover:bg-neutral-200 transition"
                >
                  SYSTEM SETTINGS →
                </Link>
                <Link
                  href="/settings?tab=connectors"
                  className="mono-btn w-full block text-center py-2 bg-[#f4f4f5] dark:bg-[#14161f] border border-[#ebebeb] dark:border-white/[0.08] text-black dark:text-white rounded-[4px] text-xs font-semibold hover:border-black dark:hover:border-white transition"
                >
                  CONNECTORS & APIS
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
