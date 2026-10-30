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
    <div className="max-w-7xl mx-auto px-6 py-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 pb-6 border-b border-black/[0.08]">
        <div>
          <div className="mono-eyebrow text-black/50 mb-1">PROSPECTING CAMPAIGNS</div>
          <h1 className="text-3xl font-medium tracking-tight text-black">Campaign Manager</h1>
          <p className="text-sm text-black/60 mt-1">
            Configure geographic and vertical target criteria for continuous lead discovery.
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="mono-btn bg-black text-white hover:bg-black/80 px-4 py-2.5 rounded-[4px] text-xs transition flex items-center space-x-2 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>CREATE CAMPAIGN</span>
        </button>
      </div>

      {/* Campaigns Grid */}
      {loading ? (
        <div className="py-20 text-center font-mono text-sm text-black/40">Loading campaigns...</div>
      ) : campaigns.length === 0 ? (
        <div className="border border-black/[0.08] rounded-[4px] p-16 text-center bg-[#f9f9fa]">
          <Layers className="w-12 h-12 text-black/20 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-black mb-2">No campaigns yet</h3>
          <p className="text-sm text-black/60 max-w-md mx-auto mb-6">
            Create your first prospecting campaign to configure geography, industry, and automated research criteria.
          </p>
          <button
            onClick={() => setShowModal(true)}
            className="mono-btn bg-black text-white hover:bg-black/80 px-4 py-2 rounded-[4px] text-xs"
          >
            CREATE FIRST CAMPAIGN
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {campaigns.map((camp) => (
            <div key={camp.id} className="border border-black/[0.08] rounded-[4px] p-6 bg-white flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="mono-eyebrow text-xs px-2 py-0.5 rounded-[4px] bg-black/5 text-black">
                    {camp.status.toUpperCase()}
                  </span>
                  <span className="mono-eyebrow text-[10px] text-black/40">
                    TARGET: {camp.monthly_target}/MO
                  </span>
                </div>

                <h3 className="text-xl font-medium text-black mb-2">{camp.name}</h3>

                <div className="space-y-2 text-xs font-mono text-black/70 mb-6">
                  <div><span className="text-black/40">GEO:</span> {camp.target_geographies?.join(', ') || 'Global'}</div>
                  <div><span className="text-black/40">INDUSTRY:</span> {camp.target_industries?.join(', ') || 'All'}</div>
                  <div><span className="text-black/40">MIN SCORE:</span> {camp.qualification_threshold} pts</div>
                </div>
              </div>

              <div className="pt-4 border-t border-black/[0.06] flex items-center justify-between">
                <button
                  onClick={() => handleTriggerDiscovery(camp.id)}
                  disabled={triggering === camp.id}
                  className="mono-btn text-xs bg-[#c8f6f9] text-black hover:bg-[#aef0f5] px-3 py-1.5 rounded-[4px] flex items-center space-x-1.5 transition"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${triggering === camp.id ? 'animate-spin' : ''}`} />
                  <span>{triggering === camp.id ? 'RUNNING...' : 'RUN DISCOVERY'}</span>
                </button>

                <Link
                  href={`/leads?campaign=${camp.id}`}
                  className="mono-btn text-xs text-black/70 hover:text-black flex items-center space-x-1"
                >
                  <span>VIEW LEADS →</span>
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Dialog */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-[4px] max-w-lg w-full p-8 border border-black/10 shadow-2xl">
            <h2 className="text-2xl font-medium text-black mb-1">New Prospecting Campaign</h2>
            <p className="text-xs text-black/50 mb-6 font-mono">
              Sets criteria for the automated discovery and research workers.
            </p>

            <form onSubmit={handleCreateCampaign} className="space-y-4">
              <div>
                <label className="mono-eyebrow text-black/60 block mb-1">CAMPAIGN NAME</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Bengaluru Specialty Cafes & Bakeries"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full text-sm border border-black/20 rounded-[4px] p-2.5 focus:outline-none focus:border-black"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mono-eyebrow text-black/60 block mb-1">TARGET GEOGRAPHY</label>
                  <input
                    type="text"
                    required
                    value={geography}
                    onChange={(e) => setGeography(e.target.value)}
                    className="w-full text-sm border border-black/20 rounded-[4px] p-2.5 focus:outline-none focus:border-black"
                  />
                </div>
                <div>
                  <label className="mono-eyebrow text-black/60 block mb-1">INDUSTRY</label>
                  <input
                    type="text"
                    required
                    value={industry}
                    onChange={(e) => setIndustry(e.target.value)}
                    className="w-full text-sm border border-black/20 rounded-[4px] p-2.5 focus:outline-none focus:border-black"
                  />
                </div>
              </div>

              <div>
                <label className="mono-eyebrow text-black/60 block mb-1">SEARCH KEYWORDS (COMMA-SEPARATED)</label>
                <input
                  type="text"
                  required
                  value={keywords}
                  onChange={(e) => setKeywords(e.target.value)}
                  className="w-full text-sm border border-black/20 rounded-[4px] p-2.5 focus:outline-none focus:border-black"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mono-eyebrow text-black/60 block mb-1">MONTHLY LEAD TARGET</label>
                  <input
                    type="number"
                    min={10}
                    max={500}
                    value={monthlyTarget}
                    onChange={(e) => setMonthlyTarget(Number(e.target.value))}
                    className="w-full text-sm border border-black/20 rounded-[4px] p-2.5 focus:outline-none focus:border-black"
                  />
                </div>
                <div>
                  <label className="mono-eyebrow text-black/60 block mb-1">MIN QUALIFICATION SCORE</label>
                  <input
                    type="number"
                    min={40}
                    max={90}
                    value={threshold}
                    onChange={(e) => setThreshold(Number(e.target.value))}
                    className="w-full text-sm border border-black/20 rounded-[4px] p-2.5 focus:outline-none focus:border-black"
                  />
                </div>
              </div>

              <div className="pt-4 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="mono-btn text-xs text-black/60 hover:text-black px-4 py-2"
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  className="mono-btn text-xs bg-black text-white hover:bg-black/80 px-4 py-2.5 rounded-[4px]"
                >
                  SAVE & LAUNCH
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
