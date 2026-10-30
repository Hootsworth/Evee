'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Target, Plus, Play, CheckCircle, RefreshCw, Layers, AlertCircle, Copy, Check, ExternalLink } from 'lucide-react';

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
      setTimeout(() => setCopiedSql(false), 2500);
    } catch (err) {
      alert('Failed to copy SQL: ' + err);
    }
  };

  const handleTriggerDiscovery = async (campaignId: string) => {
    setTriggering(campaignId);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/discover`, { method: 'POST' });
      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || 'Discovery failed');
      }
      await fetch('/api/cron/process-jobs', { method: 'POST' });
      alert('Discovery triggered and background worker processed candidates!');
      fetchCampaigns();
    } catch (err: any) {
      alert(`Discovery Error: ${err.message}`);
    } finally {
      setTriggering(null);
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-[#09090b] transition-colors duration-150">
      {/* Top Banner: Flat & Clean */}
      <section className="bg-[#f8fafc] dark:bg-[#121217] border-b border-[#e5e7eb] dark:border-[#27272a] px-6 py-10">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-light tracking-tight text-[#111827] dark:text-white">Campaign Manager</h1>
            <p className="text-sm text-[#6b7280] dark:text-[#a1a1aa] mt-1 max-w-xl font-light">
              Configure geographic and vertical target criteria for continuous lead discovery and empirical qualification.
            </p>
          </div>

          <button
            onClick={() => {
              setModalError(null);
              setShowModal(true);
            }}
            className="mono-btn bg-[#f43f5e] hover:bg-[#e11d48] text-white px-5 py-2.5 rounded-full text-xs font-normal transition flex items-center space-x-2 shadow-sm active:scale-95 self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>CREATE CAMPAIGN</span>
          </button>
        </div>
      </section>

      {/* Campaigns Grid */}
      <main className="max-w-7xl mx-auto px-6 py-10">
        {loading ? (
          <div className="py-20 text-center font-mono text-sm text-[#9ca3af] dark:text-[#71717a]">Loading campaigns...</div>
        ) : campaigns.length === 0 ? (
          <div className="border border-[#e5e7eb] dark:border-[#27272a] rounded-xl p-16 text-center bg-[#f8fafc] dark:bg-[#121217]">
            <Layers className="w-12 h-12 text-[#9ca3af] dark:text-[#52525b] mx-auto mb-4" />
            <h3 className="text-lg font-light text-[#111827] dark:text-white mb-2">No campaigns yet</h3>
            <p className="text-sm text-[#6b7280] dark:text-[#a1a1aa] max-w-md mx-auto mb-6 font-light">
              Create your first prospecting campaign to configure geography, industry, and automated research criteria.
            </p>
            <button
              onClick={() => {
                setModalError(null);
                setShowModal(true);
              }}
              className="mono-btn bg-[#f43f5e] hover:bg-[#e11d48] text-white px-5 py-2.5 rounded-full text-xs font-normal shadow-sm"
            >
              CREATE FIRST CAMPAIGN
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {campaigns.map((camp) => (
              <div
                key={camp.id}
                className="border border-[#e5e7eb] dark:border-[#27272a] hover:border-[#cbd5e1] dark:hover:border-[#3f3f46] rounded-xl p-6 bg-white dark:bg-[#121217] shadow-sm flex flex-col justify-between transition"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="mono-eyebrow text-xs px-3 py-1 rounded-full bg-[#f8fafc] dark:bg-[#18181b] border border-[#e5e7eb] dark:border-[#27272a] text-[#111827] dark:text-white font-normal">
                      {camp.status.toUpperCase()}
                    </span>
                    <span className="mono-eyebrow text-xs text-[#6b7280] dark:text-[#a1a1aa] font-mono">
                      TARGET: {camp.monthly_target}/MO
                    </span>
                  </div>

                  <h3 className="text-xl font-light text-[#111827] dark:text-white mb-3">{camp.name}</h3>

                  <div className="space-y-2 text-xs font-mono text-[#4b5563] dark:text-[#a1a1aa] mb-6 font-light">
                    <div><span className="text-[#9ca3af] dark:text-[#71717a]">GEO:</span> {camp.target_geographies?.join(', ') || 'Global'}</div>
                    <div><span className="text-[#9ca3af] dark:text-[#71717a]">INDUSTRY:</span> {camp.target_industries?.join(', ') || 'All'}</div>
                    <div><span className="text-[#9ca3af] dark:text-[#71717a]">MIN SCORE:</span> <span className="text-[#111827] dark:text-white font-normal">{camp.qualification_threshold} pts</span></div>
                  </div>
                </div>

                <div className="pt-4 border-t border-[#f3f4f6] dark:border-[#1f1f23] flex items-center justify-between">
                  <button
                    onClick={() => handleTriggerDiscovery(camp.id)}
                    disabled={triggering === camp.id}
                    className="mono-btn text-xs bg-[#f8fafc] dark:bg-[#18181b] hover:bg-[#f1f5f9] dark:hover:bg-[#27272a] border border-[#e5e7eb] dark:border-[#27272a] text-[#111827] dark:text-white px-4 py-2 rounded-full flex items-center space-x-1.5 transition font-normal"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${triggering === camp.id ? 'animate-spin' : ''}`} />
                    <span>{triggering === camp.id ? 'RUNNING...' : 'RUN DISCOVERY'}</span>
                  </button>

                  <Link
                    href={`/leads?campaign=${camp.id}`}
                    className="mono-btn text-xs text-[#f43f5e] hover:underline font-normal flex items-center space-x-1"
                  >
                    <span>VIEW LEADS →</span>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Modal Dialog */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#121217] rounded-2xl max-w-lg w-full p-8 border border-[#e5e7eb] dark:border-[#27272a] shadow-2xl">
            <h2 className="text-2xl font-light text-[#111827] dark:text-white mb-1">New Prospecting Campaign</h2>
            <p className="text-xs text-[#6b7280] dark:text-[#a1a1aa] mb-6 font-mono font-light">
              Define the vertical segment and location target for the discovery crawler.
            </p>

            {modalError && (
              <div className="mb-6 p-4 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200 text-xs font-mono space-y-3">
                <div className="flex items-start space-x-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                  <div className="flex-1 font-sans leading-relaxed">
                    <div className="font-semibold text-rose-900 dark:text-rose-100 mb-1">
                      {modalError.includes('schema') || modalError.includes('campaigns')
                        ? 'Supabase Database Schema Not Initialized'
                        : 'Campaign Creation Failed'}
                    </div>
                    <p className="text-xs text-rose-800 dark:text-rose-300">
                      {modalError}
                    </p>
                  </div>
                </div>

                {(modalError.includes('schema') || modalError.includes('campaigns') || modalError.includes('cache')) && (
                  <div className="pt-2 border-t border-rose-200 dark:border-rose-900/50 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={handleCopySchemaSql}
                      className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-white dark:bg-[#18181b] border border-rose-300 dark:border-rose-800 rounded-lg text-xs font-mono text-rose-900 dark:text-rose-200 hover:bg-rose-100 transition"
                    >
                      {copiedSql ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedSql ? 'SQL Copied!' : 'Copy SQL Schema Migration'}</span>
                    </button>

                    <a
                      href="https://supabase.com/dashboard/project/fflnixsmerahqnvwakrn/sql/new"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-[#f43f5e] text-white rounded-lg text-xs font-mono font-medium hover:bg-[#e11d48] transition"
                    >
                      <span>Open Supabase SQL Editor</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}
              </div>
            )}

            <form onSubmit={handleCreateCampaign} className="space-y-4">
              <div>
                <label className="mono-eyebrow text-[#6b7280] dark:text-[#a1a1aa] font-normal block mb-1">CAMPAIGN NAME</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Bengaluru Specialty Cafes"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full text-sm border border-[#e5e7eb] dark:border-[#27272a] bg-white dark:bg-[#18181b] rounded-xl p-2.5 focus:outline-none focus:border-[#f43f5e] focus:ring-1 focus:ring-rose-500/20 text-[#111827] dark:text-white font-light"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mono-eyebrow text-[#6b7280] dark:text-[#a1a1aa] font-normal block mb-1">GEOGRAPHY (CITY)</label>
                  <input
                    type="text"
                    required
                    value={geography}
                    onChange={(e) => setGeography(e.target.value)}
                    className="w-full text-sm border border-[#e5e7eb] dark:border-[#27272a] bg-white dark:bg-[#18181b] rounded-xl p-2.5 focus:outline-none focus:border-[#f43f5e] text-[#111827] dark:text-white font-light"
                  />
                </div>

                <div>
                  <label className="mono-eyebrow text-[#6b7280] dark:text-[#a1a1aa] font-normal block mb-1">TARGET INDUSTRY</label>
                  <input
                    type="text"
                    required
                    value={industry}
                    onChange={(e) => setIndustry(e.target.value)}
                    className="w-full text-sm border border-[#e5e7eb] dark:border-[#27272a] bg-white dark:bg-[#18181b] rounded-xl p-2.5 focus:outline-none focus:border-[#f43f5e] text-[#111827] dark:text-white font-light"
                  />
                </div>
              </div>

              <div>
                <label className="mono-eyebrow text-[#6b7280] dark:text-[#a1a1aa] font-normal block mb-1">SEARCH KEYWORDS (COMMA-SEPARATED)</label>
                <input
                  type="text"
                  required
                  value={keywords}
                  onChange={(e) => setKeywords(e.target.value)}
                  className="w-full text-sm border border-[#e5e7eb] dark:border-[#27272a] bg-white dark:bg-[#18181b] rounded-xl p-2.5 focus:outline-none focus:border-[#f43f5e] text-[#111827] dark:text-white font-light"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mono-eyebrow text-[#6b7280] dark:text-[#a1a1aa] font-normal block mb-1">MONTHLY TARGET</label>
                  <input
                    type="number"
                    value={monthlyTarget}
                    onChange={(e) => setMonthlyTarget(Number(e.target.value))}
                    className="w-full text-sm border border-[#e5e7eb] dark:border-[#27272a] bg-white dark:bg-[#18181b] rounded-xl p-2.5 focus:outline-none focus:border-[#f43f5e] text-[#111827] dark:text-white font-light"
                  />
                </div>

                <div>
                  <label className="mono-eyebrow text-[#6b7280] dark:text-[#a1a1aa] font-normal block mb-1">MIN SCORE (PTS)</label>
                  <input
                    type="number"
                    value={threshold}
                    onChange={(e) => setThreshold(Number(e.target.value))}
                    className="w-full text-sm border border-[#e5e7eb] dark:border-[#27272a] bg-white dark:bg-[#18181b] rounded-xl p-2.5 focus:outline-none focus:border-[#f43f5e] text-[#111827] dark:text-white font-light"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-[#f3f4f6] dark:border-[#27272a]">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="mono-btn text-xs text-[#6b7280] dark:text-[#a1a1aa] hover:text-[#111827] dark:hover:text-white px-4 py-2 rounded-full font-normal"
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="mono-btn bg-[#f43f5e] hover:bg-[#e11d48] text-white px-5 py-2.5 rounded-full text-xs font-normal shadow-sm disabled:opacity-50"
                >
                  {submitting ? 'LAUNCHING...' : 'LAUNCH CAMPAIGN'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
