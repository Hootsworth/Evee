'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Target, Plus, Play, CheckCircle, RefreshCw, Layers } from 'lucide-react';

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [triggering, setTriggering] = useState<string | null>(null);

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
      if (res.ok) {
        setShowModal(false);
        setName('');
        fetchCampaigns();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleTriggerDiscovery = async (campaignId: string) => {
    setTriggering(campaignId);
    try {
      await fetch(`/api/campaigns/${campaignId}/discover`, { method: 'POST' });
      await fetch('/api/cron/process-jobs', { method: 'POST' });
      alert('Discovery triggered and background worker processed candidates!');
      fetchCampaigns();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setTriggering(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#ffffff]">
      {/* Top Banner: Flat & Clean (Zero Gradients) */}
      <section className="bg-[#f8fafc] border-b border-[#e5e7eb] px-6 py-10">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-white border border-[#e5e7eb] text-[#374151] shadow-sm mb-3">
              <span className="w-2 h-2 rounded-full bg-[#f43f5e]"></span>
              <span className="mono-eyebrow text-xs font-semibold">PROSPECTING PIPELINE</span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-[#111827]">Campaign Manager</h1>
            <p className="text-sm text-[#4b5563] mt-1 max-w-xl">
              Configure geographic and vertical target criteria for continuous lead discovery and empirical qualification.
            </p>
          </div>

          <button
            onClick={() => setShowModal(true)}
            className="mono-btn bg-[#f43f5e] hover:bg-[#e11d48] text-white px-5 py-2.5 rounded-full text-xs font-semibold transition flex items-center space-x-2 shadow-sm active:scale-95 self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>CREATE CAMPAIGN</span>
          </button>
        </div>
      </section>

      {/* Campaigns Grid */}
      <main className="max-w-7xl mx-auto px-6 py-10">
        {loading ? (
          <div className="py-20 text-center font-mono text-sm text-[#9ca3af]">Loading campaigns...</div>
        ) : campaigns.length === 0 ? (
          <div className="border border-[#e5e7eb] rounded-xl p-16 text-center bg-[#f8fafc]">
            <Layers className="w-12 h-12 text-[#9ca3af] mx-auto mb-4" />
            <h3 className="text-lg font-bold text-[#111827] mb-2">No campaigns yet</h3>
            <p className="text-sm text-[#6b7280] max-w-md mx-auto mb-6">
              Create your first prospecting campaign to configure geography, industry, and automated research criteria.
            </p>
            <button
              onClick={() => setShowModal(true)}
              className="mono-btn bg-[#f43f5e] hover:bg-[#e11d48] text-white px-5 py-2.5 rounded-full text-xs font-semibold shadow-sm"
            >
              CREATE FIRST CAMPAIGN
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {campaigns.map((camp) => (
              <div
                key={camp.id}
                className="border border-[#e5e7eb] hover:border-[#cbd5e1] rounded-xl p-6 bg-white shadow-sm flex flex-col justify-between transition"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="mono-eyebrow text-xs px-3 py-1 rounded-full bg-[#f8fafc] border border-[#e5e7eb] text-[#111827] font-semibold">
                      {camp.status.toUpperCase()}
                    </span>
                    <span className="mono-eyebrow text-xs text-[#6b7280] font-mono">
                      TARGET: {camp.monthly_target}/MO
                    </span>
                  </div>

                  <h3 className="text-xl font-bold text-[#111827] mb-3">{camp.name}</h3>

                  <div className="space-y-2 text-xs font-mono text-[#4b5563] mb-6">
                    <div><span className="text-[#9ca3af]">GEO:</span> {camp.target_geographies?.join(', ') || 'Global'}</div>
                    <div><span className="text-[#9ca3af]">INDUSTRY:</span> {camp.target_industries?.join(', ') || 'All'}</div>
                    <div><span className="text-[#9ca3af]">MIN SCORE:</span> <span className="text-[#111827] font-bold">{camp.qualification_threshold} pts</span></div>
                  </div>
                </div>

                <div className="pt-4 border-t border-[#f3f4f6] flex items-center justify-between">
                  <button
                    onClick={() => handleTriggerDiscovery(camp.id)}
                    disabled={triggering === camp.id}
                    className="mono-btn text-xs bg-[#f8fafc] hover:bg-[#f1f5f9] border border-[#e5e7eb] text-[#111827] px-4 py-2 rounded-full flex items-center space-x-1.5 transition font-semibold"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${triggering === camp.id ? 'animate-spin' : ''}`} />
                    <span>{triggering === camp.id ? 'RUNNING...' : 'RUN DISCOVERY'}</span>
                  </button>

                  <Link
                    href={`/leads?campaign=${camp.id}`}
                    className="mono-btn text-xs text-[#f43f5e] hover:underline font-bold flex items-center space-x-1"
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
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-8 border border-[#e5e7eb] shadow-2xl">
            <h2 className="text-2xl font-bold text-[#111827] mb-1">New Prospecting Campaign</h2>
            <p className="text-xs text-[#6b7280] mb-6 font-mono">
              Define the vertical segment and location target for the discovery crawler.
            </p>

            <form onSubmit={handleCreateCampaign} className="space-y-4">
              <div>
                <label className="mono-eyebrow text-[#4b5563] font-semibold block mb-1">CAMPAIGN NAME</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Bengaluru Specialty Cafes"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full text-sm border border-[#e5e7eb] rounded-xl p-2.5 focus:outline-none focus:border-[#f43f5e] focus:ring-1 focus:ring-rose-500/20 text-[#111827]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mono-eyebrow text-[#4b5563] font-semibold block mb-1">GEOGRAPHY (CITY)</label>
                  <input
                    type="text"
                    required
                    value={geography}
                    onChange={(e) => setGeography(e.target.value)}
                    className="w-full text-sm border border-[#e5e7eb] rounded-xl p-2.5 focus:outline-none focus:border-[#f43f5e] text-[#111827]"
                  />
                </div>

                <div>
                  <label className="mono-eyebrow text-[#4b5563] font-semibold block mb-1">TARGET INDUSTRY</label>
                  <input
                    type="text"
                    required
                    value={industry}
                    onChange={(e) => setIndustry(e.target.value)}
                    className="w-full text-sm border border-[#e5e7eb] rounded-xl p-2.5 focus:outline-none focus:border-[#f43f5e] text-[#111827]"
                  />
                </div>
              </div>

              <div>
                <label className="mono-eyebrow text-[#4b5563] font-semibold block mb-1">SEARCH KEYWORDS (COMMA-SEPARATED)</label>
                <input
                  type="text"
                  required
                  value={keywords}
                  onChange={(e) => setKeywords(e.target.value)}
                  className="w-full text-sm border border-[#e5e7eb] rounded-xl p-2.5 focus:outline-none focus:border-[#f43f5e] text-[#111827]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mono-eyebrow text-[#4b5563] font-semibold block mb-1">MONTHLY TARGET</label>
                  <input
                    type="number"
                    value={monthlyTarget}
                    onChange={(e) => setMonthlyTarget(Number(e.target.value))}
                    className="w-full text-sm border border-[#e5e7eb] rounded-xl p-2.5 focus:outline-none focus:border-[#f43f5e] text-[#111827]"
                  />
                </div>

                <div>
                  <label className="mono-eyebrow text-[#4b5563] font-semibold block mb-1">MIN SCORE (PTS)</label>
                  <input
                    type="number"
                    value={threshold}
                    onChange={(e) => setThreshold(Number(e.target.value))}
                    className="w-full text-sm border border-[#e5e7eb] rounded-xl p-2.5 focus:outline-none focus:border-[#f43f5e] text-[#111827]"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-[#f3f4f6]">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="mono-btn text-xs text-[#6b7280] hover:text-[#111827] px-4 py-2 rounded-full"
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  className="mono-btn bg-[#f43f5e] hover:bg-[#e11d48] text-white px-5 py-2.5 rounded-full text-xs font-semibold shadow-sm"
                >
                  LAUNCH CAMPAIGN
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
