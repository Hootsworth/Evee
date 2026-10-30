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
    <div className="min-h-screen bg-[#ffffff]">
      {/* Top Banner: Flat & Clean (Zero Gradients) */}
      <section className="bg-[#f8fafc] border-b border-[#e5e7eb] px-6 py-10">
        <div className="max-w-7xl mx-auto">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-white border border-[#e5e7eb] text-[#374151] shadow-sm mb-3">
            <span className="w-2 h-2 rounded-full bg-[#f43f5e]"></span>
            <span className="mono-eyebrow text-xs font-semibold">PROSPECT REPOSITORY</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-[#111827]">Lead Explorer</h1>
          <p className="text-sm text-[#4b5563] mt-1 max-w-xl">
            Deduplicated small business prospects with empirical research and deterministic qualification scoring.
          </p>
        </div>
      </section>

      <main className="max-w-7xl mx-auto px-6 py-10">
        {/* Filter and Search Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 mb-8">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-[#9ca3af] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by business name, city, or category..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-[#e5e7eb] rounded-full text-sm focus:outline-none focus:border-[#f43f5e] focus:ring-1 focus:ring-rose-500/20 transition text-[#111827]"
            />
          </div>

          <div className="flex items-center space-x-2">
            <span className="mono-eyebrow text-[#9ca3af] text-xs font-semibold mr-1">FILTER:</span>
            {['all', 'active', 'suppressed'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`mono-btn text-xs px-4 py-1.5 rounded-full transition font-semibold ${
                  statusFilter === st
                    ? 'bg-[#111827] text-white shadow-sm'
                    : 'bg-[#f8fafc] border border-[#e5e7eb] text-[#4b5563] hover:bg-[#f1f5f9]'
                }`}
              >
                {st.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Lead Table / List */}
        {loading ? (
          <div className="py-20 text-center font-mono text-sm text-[#9ca3af]">Loading discovered leads...</div>
        ) : filtered.length === 0 ? (
          <div className="border border-[#e5e7eb] rounded-xl p-16 text-center bg-[#f8fafc]">
            <p className="text-sm text-[#6b7280] font-mono">No prospects match your search criteria.</p>
          </div>
        ) : (
          <div className="border border-[#e5e7eb] rounded-xl overflow-hidden bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-[#f8fafc] border-b border-[#e5e7eb] text-[#4b5563]">
                  <tr>
                    <th className="py-3.5 px-6 font-bold">BUSINESS NAME</th>
                    <th className="py-3.5 px-6 font-bold">CATEGORY</th>
                    <th className="py-3.5 px-6 font-bold">LOCATION</th>
                    <th className="py-3.5 px-6 font-bold">DISCOVERY SOURCE</th>
                    <th className="py-3.5 px-6 font-bold">STATUS</th>
                    <th className="py-3.5 px-6 font-bold text-right">ACTION</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f3f4f6]">
                  {filtered.map((b) => (
                    <tr key={b.id} className="hover:bg-[#f8fafc] transition group">
                      <td className="py-4 px-6 font-sans">
                        <Link href={`/leads/${b.id}`} className="font-semibold text-sm text-[#111827] group-hover:text-[#f43f5e] flex items-center space-x-2">
                          <span>{b.display_name}</span>
                          <ChevronRight className="w-3.5 h-3.5 text-[#9ca3af] group-hover:text-[#f43f5e] transition" />
                        </Link>
                        {b.official_website_url && (
                          <span className="text-[11px] text-[#9ca3af] font-mono block mt-0.5 truncate max-w-xs">
                            {b.official_website_url}
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-6 text-[#4b5563]">
                        <span className="px-2.5 py-1 rounded-md bg-[#f3f4f6] text-[#111827] font-semibold text-[11px]">
                          {b.business_type}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-[#6b7280]">{b.city}, {b.country_code}</td>
                      <td className="py-4 px-6 text-[#9ca3af]">{b.discovery_source}</td>
                      <td className="py-4 px-6">
                        <span
                          className={`px-2.5 py-1 rounded-full font-bold text-[10px] ${
                            b.record_status === 'active'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}
                        >
                          {b.record_status.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-right font-sans">
                        <Link
                          href={`/leads/${b.id}`}
                          className="mono-btn bg-[#f8fafc] hover:bg-[#f1f5f9] border border-[#e5e7eb] text-[#111827] px-3.5 py-1.5 rounded-full text-xs font-semibold inline-flex items-center space-x-1 transition"
                        >
                          <span>EVIDENCE</span>
                          <ChevronRight className="w-3 h-3" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
