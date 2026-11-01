'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Target, Plus, Play, CheckCircle, RefreshCw, Layers, AlertCircle, Copy, Check, ExternalLink, FileSpreadsheet, ArrowRight, ShieldCheck } from 'lucide-react';

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [triggering, setTriggering] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [copiedSql, setCopiedSql] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [geography, setGeography] = useState('Bengaluru');
  const [industry, setIndustry] = useState('Cafes & Restaurants');
  const [keywords, setKeywords] = useState('bakery, cafe, bistro, restaurant');
  const [monthlyTarget, setMonthlyTarget] = useState(100);
  const [threshold, setThreshold] = useState(65);

  const fetchCampaigns = async () => {
    try {
      const res = await fetch('/api/campaigns');
      const data = await res.json();
      setCampaigns(data.campaigns || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setModalError(null);

    try {
      const res = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          targetGeographies: [geography],
          targetIndustries: [industry],
          searchTerms: keywords.split(',').map((k) => k.trim()),
          servicesToPromote: ['Digital QR Menu', 'Online Booking Workflow', 'Mobile-Friendly Website'],
          monthlyTarget: Number(monthlyTarget),
          qualificationThreshold: Number(threshold),
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setShowModal(false);
        setName('');
        setModalError(null);
        fetchCampaigns();
      } else {
        setModalError(data.error || 'Failed to create campaign (Status ' + res.status + ')');
      }
    } catch (err: any) {
      setModalError(err.message || 'Network error creating campaign');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopySchemaSql = async () => {
    try {
      const res = await fetch('/api/setup/schema');
      const sqlText = await res.text();
      await navigator.clipboard.writeText(sqlText);
      setCopiedSql(true);
      setTimeout(() => setCopiedSql(false), 3000);
    } catch (err) {
      console.error(err);
    }
  };

  const handleTriggerDiscovery = async (campaignId: string) => {
    setTriggering(campaignId);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/discover`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        alert(`Discovery completed: ${data.message || 'Leads queued for qualification'}`);
        fetchCampaigns();
      } else {
        alert(`Error: ${data.error || 'Discovery failed'}`);
      }
    } catch (err: any) {
      alert(`Error triggering discovery: ${err.message}`);
    } finally {
      setTriggering(null);
    }
  };

  return (
    <div className="flex flex-col bg-white dark:bg-[#010120] text-[#000000] dark:text-[#ffffff] min-h-screen transition-colors duration-150">
      {/* 2px Signature Brand Gradient Ribbon */}
      <div className="brand-gradient-h w-full" />

      {/* Hero Band: Canvas Dark #010120 */}
      <section className="bg-[#010120] text-white pt-8 pb-10 px-6 border-b border-white/[0.08] relative overflow-hidden v2-grid-bg">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-end justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center space-x-2 text-[10px] font-mono tracking-widest text-[#959494] uppercase mb-1">
              <span>TARGETING // CAMPAIGN MANAGER</span>
              <span>•</span>
              <span className="v2-badge text-emerald-400 bg-emerald-500/10 border-emerald-500/20">
                v2.0 MESH
              </span>
            </div>
            <h1 className="text-3xl font-medium tracking-tight text-white mb-1">
              Campaigns Hub
            </h1>
            <p className="text-xs text-[#959494] max-w-xl font-normal">
              Manage discrete outbound target segments. Discovery adapters pull fresh leads, perform automated web inspections, and draft personalized outreach.
            </p>
          </div>

          <div className="flex items-center space-x-2.5">
            <Link
              href="/campaigns/csv"
              className="mono-btn bg-[#313641] hover:bg-[#313641]/80 text-white border border-white/[0.08] px-3.5 py-2 rounded-[4px] text-xs font-semibold flex items-center space-x-1.5 transition"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>IMPORT CSV OUTREACH</span>
            </Link>

            <button
              onClick={() => setShowModal(true)}
              className="mono-btn bg-white hover:bg-neutral-200 text-black px-4 py-2 rounded-[4px] text-xs font-semibold flex items-center space-x-1.5 transition active:scale-95"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>NEW CAMPAIGN</span>
            </button>
          </div>
        </div>
      </section>

      {/* Main Campaign Grid */}
      <main className="max-w-7xl mx-auto px-6 py-8 w-full flex-1">
        {loading ? (
          <div className="py-24 text-center font-mono text-xs text-[#959494] flex items-center justify-center space-x-2">
            <RefreshCw className="w-4 h-4 animate-spin text-[#ef2cc1]" />
            <span>LOADING CAMPAIGNS...</span>
          </div>
        ) : campaigns.length === 0 ? (
          <div className="border border-[#ebebeb] dark:border-white/[0.08] rounded-[4px] p-16 text-center bg-[#f8fafc] dark:bg-[#313641]/20">
            <Target className="w-10 h-10 text-[#959494] mx-auto mb-3" />
            <h3 className="text-sm font-mono uppercase tracking-wider font-semibold text-black dark:text-white mb-1">
              No Campaigns Configured
            </h3>
            <p className="text-xs text-[#6b7280] dark:text-[#959494] mb-4 max-w-md mx-auto">
              Create an automated discovery campaign by target city and industry, or import an existing CSV file.
            </p>
            <button
              onClick={() => setShowModal(true)}
              className="mono-btn px-4 py-2 bg-black dark:bg-white text-white dark:text-black rounded-[4px] text-xs font-semibold inline-flex items-center space-x-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>CREATE FIRST CAMPAIGN</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {campaigns.map((camp) => (
              <div
                key={camp.id}
                className="border border-[#ebebeb] dark:border-white/[0.08] rounded-[4px] p-5 bg-white dark:bg-[#010120] flex flex-col justify-between transition hover:border-black dark:hover:border-white/[0.2]"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="px-2 py-0.5 rounded-[2px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[9px] font-mono font-semibold uppercase">
                      {camp.status || 'ACTIVE'}
                    </span>
                    <span className="text-[10px] font-mono text-[#959494]">
                      TARGET: {camp.monthly_target || 100} / MO
                    </span>
                  </div>

                  <h3 className="text-base font-semibold text-black dark:text-white mb-1.5">
                    {camp.name}
                  </h3>

                  <div className="space-y-1.5 text-xs text-[#6b7280] dark:text-[#959494] font-mono mb-4">
                    <div>City: {camp.target_geographies?.join(', ') || 'All Cities'}</div>
                    <div>Industry: {camp.target_industries?.join(', ') || 'General SMB'}</div>
                    <div>Threshold: {camp.qualification_threshold || 65}% Lead Score</div>
                  </div>
                </div>

                <div className="pt-4 border-t border-[#ebebeb] dark:border-white/[0.08] flex items-center justify-between">
                  <Link
                    href={`/leads`}
                    className="text-xs font-mono text-black dark:text-white hover:text-[#ef2cc1] flex items-center space-x-1"
                  >
                    <span>VIEW LEADS</span>
                    <ArrowRight className="w-3 h-3" />
                  </Link>

                  <button
                    onClick={() => handleTriggerDiscovery(camp.id)}
                    disabled={triggering === camp.id}
                    className="mono-btn px-3 py-1.5 bg-black dark:bg-white text-white dark:text-black rounded-[4px] text-[11px] font-semibold flex items-center space-x-1 hover:bg-neutral-800 transition"
                  >
                    {triggering === camp.id ? (
                      <RefreshCw className="w-3 h-3 animate-spin" />
                    ) : (
                      <Play className="w-3 h-3 fill-current" />
                    )}
                    <span>{triggering === camp.id ? 'RUNNING...' : 'DISCOVER NOW'}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* New Campaign Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white dark:bg-[#010120] border border-[#ebebeb] dark:border-white/[0.08] rounded-[4px] overflow-hidden shadow-2xl">
            <div className="brand-gradient-h w-full" />
            <div className="p-5 border-b border-[#ebebeb] dark:border-white/[0.08] flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-black dark:text-white">
                  Create Autonomous Campaign
                </h3>
                <p className="text-xs text-[#959494] font-mono">
                  Set target geography, industry keywords, and qualification thresholds.
                </p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-[#959494] hover:text-black dark:hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateCampaign} className="p-5 space-y-4 text-xs font-mono">
              {modalError && (
                <div className="p-2.5 rounded-[4px] bg-rose-500/10 border border-rose-500/20 text-rose-600 text-xs">
                  {modalError}
                </div>
              )}

              <div>
                <label className="block text-[#959494] uppercase mb-1">Campaign Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Bangalore Cafes & Bistros"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full p-2.5 rounded-[4px] border border-[#ebebeb] dark:border-white/[0.08] bg-white dark:bg-[#010120] text-black dark:text-white focus:outline-none focus:border-black dark:focus:border-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#959494] uppercase mb-1">Target City</label>
                  <input
                    type="text"
                    required
                    value={geography}
                    onChange={(e) => setGeography(e.target.value)}
                    className="w-full p-2.5 rounded-[4px] border border-[#ebebeb] dark:border-white/[0.08] bg-white dark:bg-[#010120] text-black dark:text-white focus:outline-none focus:border-black dark:focus:border-white"
                  />
                </div>
                <div>
                  <label className="block text-[#959494] uppercase mb-1">Target Industry</label>
                  <input
                    type="text"
                    required
                    value={industry}
                    onChange={(e) => setIndustry(e.target.value)}
                    className="w-full p-2.5 rounded-[4px] border border-[#ebebeb] dark:border-white/[0.08] bg-white dark:bg-[#010120] text-black dark:text-white focus:outline-none focus:border-black dark:focus:border-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[#959494] uppercase mb-1">Keywords (Comma Separated)</label>
                <input
                  type="text"
                  required
                  value={keywords}
                  onChange={(e) => setKeywords(e.target.value)}
                  className="w-full p-2.5 rounded-[4px] border border-[#ebebeb] dark:border-white/[0.08] bg-white dark:bg-[#010120] text-black dark:text-white focus:outline-none focus:border-black dark:focus:border-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#959494] uppercase mb-1">Monthly Target</label>
                  <input
                    type="number"
                    min={1}
                    max={1000}
                    value={monthlyTarget}
                    onChange={(e) => setMonthlyTarget(Number(e.target.value))}
                    className="w-full p-2.5 rounded-[4px] border border-[#ebebeb] dark:border-white/[0.08] bg-white dark:bg-[#010120] text-black dark:text-white focus:outline-none focus:border-black dark:focus:border-white"
                  />
                </div>
                <div>
                  <label className="block text-[#959494] uppercase mb-1">Min Lead Score (%)</label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={threshold}
                    onChange={(e) => setThreshold(Number(e.target.value))}
                    className="w-full p-2.5 rounded-[4px] border border-[#ebebeb] dark:border-white/[0.08] bg-white dark:bg-[#010120] text-black dark:text-white focus:outline-none focus:border-black dark:focus:border-white"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-[#ebebeb] dark:border-white/[0.08] flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="mono-btn px-3.5 py-2 rounded-[4px] border border-[#ebebeb] dark:border-white/[0.08] text-[#959494] hover:text-black dark:hover:text-white"
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="mono-btn px-4 py-2 rounded-[4px] bg-black dark:bg-white text-white dark:text-black font-semibold"
                >
                  {submitting ? 'CREATING...' : 'LAUNCH CAMPAIGN'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
