'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Search, Filter, ExternalLink, ShieldCheck, AlertCircle, FileText, ChevronRight } from 'lucide-react';

export default function LeadsPage() {
  const [businesses, setBusinesses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    fetch('/api/businesses')
      .then((res) => res.json())
      .then((data) => setBusinesses(data.businesses || []))
      .catch((e) => console.error(e))
      .finally(() => setLoading(false));
  }, []);

  const filtered = businesses.filter((b) => {
    const matchesSearch =
      b.display_name.toLowerCase().includes(search.toLowerCase()) ||
      b.city.toLowerCase().includes(search.toLowerCase()) ||
      b.business_type.toLowerCase().includes(search.toLowerCase());

    if (statusFilter === 'all') return matchesSearch;
    return matchesSearch && b.record_status === statusFilter;
  });

  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 pb-6 border-b border-black/[0.08]">
        <div>
          <div className="mono-eyebrow text-black/50 mb-1">PROSPECT REPOSITORY</div>
          <h1 className="text-3xl font-medium tracking-tight text-black">Lead Explorer</h1>
          <p className="text-sm text-black/60 mt-1">
            Deduplicated small business prospects with empirical research and deterministic qualification.
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-black/40 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by business name, city, or category..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-black/15 rounded-[4px] text-sm focus:outline-none focus:border-black"
          />
        </div>

        <div className="flex items-center space-x-2">
          <span className="mono-eyebrow text-black/40 text-xs">FILTER:</span>
          {['all', 'active', 'suppressed'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`mono-btn text-xs px-3 py-1.5 rounded-[4px] transition ${
                statusFilter === st
                  ? 'bg-black text-white'
                  : 'bg-black/5 text-black/70 hover:bg-black/10'
              }`}
            >
              {st.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Leads Table */}
      {loading ? (
        <div className="py-20 text-center font-mono text-sm text-black/40">Loading prospects...</div>
      ) : filtered.length === 0 ? (
        <div className="border border-black/[0.08] rounded-[4px] p-16 text-center bg-[#f9f9fa]">
          <p className="text-sm text-black/60 font-mono">No prospects matching current criteria.</p>
        </div>
      ) : (
        <div className="border border-black/[0.08] rounded-[4px] overflow-hidden bg-white">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-black/[0.08] bg-[#f9f9fa] text-xs font-mono text-black/50">
                <th className="py-3 px-4 font-normal">BUSINESS</th>
                <th className="py-3 px-4 font-normal">LOCATION</th>
                <th className="py-3 px-4 font-normal">CONTACT ELIGIBILITY</th>
                <th className="py-3 px-4 font-normal">QUALIFICATION SCORE</th>
                <th className="py-3 px-4 font-normal">ACTION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.06] text-sm">
              {filtered.map((b) => {
                const score = b.lead_scores?.[0]?.final_score ?? null;
                const draft = b.email_drafts?.[0];
                return (
                  <tr key={b.id} className="hover:bg-black/[0.015] transition">
                    <td className="py-4 px-4">
                      <div className="font-medium text-black">{b.display_name}</div>
                      <div className="text-xs text-black/50 flex items-center space-x-2 mt-0.5">
                        <span>{b.business_type}</span>
                        {b.official_website_url && (
                          <a
                            href={b.official_website_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#ef2cc1] hover:underline flex items-center space-x-0.5"
                          >
                            <span>website</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        )}
                      </div>
                    </td>

                    <td className="py-4 px-4 text-xs font-mono text-black/70">
                      {b.city}, {b.country_code}
                    </td>

                    <td className="py-4 px-4">
                      {b.general_business_email || b.contacts?.[0]?.email_address ? (
                        <div className="text-xs font-mono text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-[4px] inline-flex items-center space-x-1">
                          <ShieldCheck className="w-3 h-3 text-emerald-600" />
                          <span>{b.contacts?.[0]?.email_address || b.general_business_email}</span>
                        </div>
                      ) : (
                        <div className="text-xs font-mono text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-[4px] inline-flex items-center space-x-1">
                          <AlertCircle className="w-3 h-3 text-amber-600" />
                          <span>REVIEW REQUIRED</span>
                        </div>
                      )}
                    </td>

                    <td className="py-4 px-4">
                      {score !== null ? (
                        <div className="flex items-center space-x-2">
                          <span
                            className={`mono-btn text-xs px-2 py-0.5 rounded-[4px] ${
                              score >= 65
                                ? 'bg-[#c8f6f9] text-black font-semibold'
                                : 'bg-black/5 text-black/60'
                            }`}
                          >
                            {score} / 100
                          </span>
                          <span className="text-xs text-black/40 font-mono">
                            {score >= 65 ? 'QUALIFIED' : 'REVIEW'}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-black/40 font-mono">PENDING SCORE</span>
                      )}
                    </td>

                    <td className="py-4 px-4">
                      <Link
                        href={`/leads/${b.id}`}
                        className="mono-btn text-xs text-black hover:text-[#ef2cc1] flex items-center space-x-1 transition"
                      >
                        <span>EVIDENCE & DRAFT</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
