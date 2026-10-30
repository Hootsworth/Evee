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
    <div className="min-h-screen bg-white dark:bg-[#09090b] transition-colors duration-150">
      {/* Top Banner: Flat & Clean */}
      <section className="bg-[#f8fafc] dark:bg-gradient-to-b dark:from-[#0e1017] dark:via-[#0c0d14] dark:to-[#090a0f] border-b border-[#e5e7eb] dark:border-white/[0.08] px-6 py-10">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-light tracking-tight text-[#111827] dark:text-white">Lead Explorer</h1>
          <p className="text-sm text-[#6b7280] dark:text-[#a1a1aa] mt-1 max-w-xl font-light">
            Deduplicated small business prospects with empirical research and deterministic qualification scoring.
          </p>
        </div>
      </section>

      <main className="max-w-7xl mx-auto px-6 py-10">
        {/* Filter and Search Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 mb-8">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-[#9ca3af] dark:text-[#71717a] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by business name, city, or category..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-[#e5e7eb] dark:border-[#27272a] bg-white dark:bg-[#121217] rounded-full text-sm focus:outline-none focus:border-[#f43f5e] focus:ring-1 focus:ring-rose-500/20 transition text-[#111827] dark:text-white font-light"
            />
          </div>

          <div className="flex items-center space-x-2">
            <span className="mono-eyebrow text-[#9ca3af] dark:text-[#71717a] text-xs font-normal mr-1">FILTER:</span>
            {['all', 'active', 'suppressed'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`mono-btn text-xs px-4 py-1.5 rounded-full transition font-normal ${
                  statusFilter === st
                    ? 'bg-[#111827] dark:bg-white text-white dark:text-[#111827] shadow-sm'
                    : 'bg-[#f8fafc] dark:bg-[#18181b] border border-[#e5e7eb] dark:border-[#27272a] text-[#4b5563] dark:text-[#a1a1aa] hover:bg-[#f1f5f9] dark:hover:bg-[#27272a]'
                }`}
              >
                {st.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Lead Table / List */}
        {loading ? (
          <div className="py-20 text-center font-mono text-sm text-[#9ca3af] dark:text-[#71717a]">Loading discovered leads...</div>
        ) : filtered.length === 0 ? (
          <div className="border border-[#e5e7eb] dark:border-[#27272a] rounded-xl p-16 text-center bg-[#f8fafc] dark:bg-[#121217]">
            <p className="text-sm text-[#6b7280] dark:text-[#a1a1aa] font-mono font-light">No prospects match your search criteria.</p>
          </div>
        ) : (
          <div className="border border-[#e5e7eb] dark:border-[#27272a] rounded-xl overflow-hidden bg-white dark:bg-[#121217] shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-[#f8fafc] dark:bg-[#18181b] border-b border-[#e5e7eb] dark:border-[#27272a] text-[#4b5563] dark:text-[#a1a1aa]">
                  <tr>
                    <th className="py-3.5 px-6 font-normal">BUSINESS NAME</th>
                    <th className="py-3.5 px-6 font-normal">CATEGORY</th>
                    <th className="py-3.5 px-6 font-normal">LOCATION</th>
                    <th className="py-3.5 px-6 font-normal">DISCOVERY SOURCE</th>
                    <th className="py-3.5 px-6 font-normal">STATUS</th>
                    <th className="py-3.5 px-6 font-normal text-right">ACTION</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f3f4f6] dark:divide-[#27272a]">
                  {filtered.map((b) => (
                    <tr key={b.id} className="hover:bg-[#f8fafc] dark:hover:bg-[#18181b] transition group">
                      <td className="py-4 px-6 font-sans">
                        <Link href={`/leads/${b.id}`} className="font-normal text-sm text-[#111827] dark:text-white group-hover:text-[#f43f5e] flex items-center space-x-2">
                          <span>{b.display_name}</span>
                          <ChevronRight className="w-3.5 h-3.5 text-[#9ca3af] group-hover:text-[#f43f5e] transition" />
                        </Link>
                        {b.official_website_url && (
                          <span className="text-[11px] text-[#9ca3af] dark:text-[#71717a] font-mono block mt-0.5 truncate max-w-xs font-light">
                            {b.official_website_url}
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-6 text-[#4b5563] dark:text-[#a1a1aa]">
                        <span className="px-2.5 py-1 rounded-md bg-[#f3f4f6] dark:bg-[#18181b] text-[#111827] dark:text-[#d4d4d8] font-normal text-[11px] border border-transparent dark:border-[#27272a]">
                          {b.business_type}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-[#6b7280] dark:text-[#a1a1aa] font-light">{b.city}, {b.country_code}</td>
                      <td className="py-4 px-6 text-[#9ca3af] dark:text-[#71717a] font-light">{b.discovery_source}</td>
                      <td className="py-4 px-6">
                        <span
                          className={`px-2.5 py-1 rounded-full font-normal text-[10px] ${
                            b.record_status === 'active'
                              ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                              : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                          }`}
                        >
                          {b.record_status.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-right font-sans">
                        <Link
                          href={`/leads/${b.id}`}
                          className="mono-btn bg-[#f8fafc] dark:bg-[#18181b] hover:bg-[#f1f5f9] dark:hover:bg-[#27272a] border border-[#e5e7eb] dark:border-[#27272a] text-[#111827] dark:text-[#e4e4e7] px-3.5 py-1.5 rounded-full text-xs font-normal inline-flex items-center space-x-1 transition"
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
