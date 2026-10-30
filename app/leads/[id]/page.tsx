'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ExternalLink, CheckCircle2, AlertTriangle, ArrowLeft, ShieldCheck, Mail, Sparkles, ChevronRight } from 'lucide-react';

export default function BusinessDetailPage() {
  const { id } = useParams();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/businesses/${id}`)
      .then((res) => res.json())
      .then((res) => setData(res))
      .catch((e) => console.error(e))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-[#09090b] py-24 text-center font-mono text-sm text-[#9ca3af] dark:text-[#71717a] font-light">
        Loading business evidence...
      </div>
    );
  }

  if (!data || !data.business) {
    return (
      <div className="min-h-screen bg-white dark:bg-[#09090b] py-24 text-center font-mono text-sm text-[#9ca3af] dark:text-[#71717a] font-light">
        Business not found.
      </div>
    );
  }

  const { business, evidence, contacts, score, drafts } = data;

  return (
    <div className="min-h-screen bg-white dark:bg-[#09090b] transition-colors duration-150">
      {/* Top Banner: Flat & Clean */}
      <section className="bg-[#f8fafc] dark:bg-gradient-to-b dark:from-[#0e1017] dark:via-[#0c0d14] dark:to-[#090a0f] border-b border-[#e5e7eb] dark:border-white/[0.08] px-6 py-8">
        <div className="max-w-7xl mx-auto">
          <Link
            href="/leads"
            className="mono-btn text-xs text-[#f43f5e] hover:underline flex items-center space-x-1.5 mb-4 font-normal"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>BACK TO LEADS</span>
          </Link>

          <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
            <div>
              <div className="flex items-center space-x-3 mb-2">
                <span className="mono-eyebrow text-xs bg-white dark:bg-[#18181b] border border-[#e5e7eb] dark:border-[#27272a] text-[#111827] dark:text-white px-3 py-0.5 rounded-full font-normal">
                  {business.business_type}
                </span>
                <span className="text-xs font-mono text-[#6b7280] dark:text-[#a1a1aa]">
                  {business.city}, {business.region}, {business.country_code}
                </span>
              </div>

              <h1 className="text-3xl font-light tracking-tight text-[#111827] dark:text-white mb-2">{business.display_name}</h1>

              <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-[#4b5563] dark:text-[#a1a1aa] font-light">
                {business.official_website_url && (
                  <a
                    href={business.official_website_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#f43f5e] hover:underline flex items-center space-x-1"
                  >
                    <span>{business.official_website_url}</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
                {business.phone_number && (
                  <span>Phone: {business.phone_number}</span>
                )}
                {business.general_business_email && (
                  <span>Email: {business.general_business_email}</span>
                )}
              </div>
            </div>

            {/* Score Card Callout */}
            {score && (
              <div className="bg-white dark:bg-[#18181b] border border-[#e5e7eb] dark:border-[#27272a] rounded-xl p-5 shadow-sm text-center min-w-[160px]">
                <div className="text-4xl font-light text-[#111827] dark:text-white">{score.total_score}</div>
                <div className="mono-eyebrow text-[10px] text-[#9ca3af] dark:text-[#71717a] mt-1 font-normal">QUALIFICATION SCORE</div>
                <div className="mt-2 text-[10px] font-mono text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-0.5 rounded-full font-normal border border-emerald-200 dark:border-emerald-800 inline-block">
                  {score.tier?.toUpperCase() || 'QUALIFIED'}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      <main className="max-w-7xl mx-auto px-6 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Empirical Evidence Column */}
          <div className="lg:col-span-2 space-y-6">
            <div className="border border-[#e5e7eb] dark:border-[#27272a] rounded-xl p-6 bg-white dark:bg-[#121217] shadow-sm">
              <div className="flex items-center space-x-2 mb-4">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <h3 className="mono-eyebrow text-[#111827] dark:text-white font-normal text-xs">EMPIRICAL EVIDENCE ITEMS</h3>
              </div>

              {!evidence || evidence.length === 0 ? (
                <p className="text-xs text-[#9ca3af] dark:text-[#71717a] font-mono font-light">No evidence gathered yet for this prospect.</p>
              ) : (
                <div className="space-y-3">
                  {evidence.map((item: any) => (
                    <div key={item.id} className="border border-[#e5e7eb] dark:border-[#27272a] rounded-xl p-4 bg-[#f8fafc] dark:bg-[#18181b]">
                      <div className="flex items-center justify-between mb-2">
                        <span className="mono-eyebrow text-xs text-[#111827] dark:text-white font-normal">{item.category}</span>
                        <span className="mono-eyebrow text-[10px] text-[#9ca3af] dark:text-[#71717a] font-light">{item.source_type}</span>
                      </div>
                      <p className="text-xs text-[#4b5563] dark:text-[#a1a1aa] leading-relaxed mb-2 font-mono font-light">
                        {item.observation_summary}
                      </p>
                      {item.evidence_url && (
                        <a
                          href={item.evidence_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] font-mono text-[#f43f5e] hover:underline flex items-center space-x-1"
                        >
                          <span>Source URL: {item.evidence_url}</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Generated AI Drafts */}
            <div className="border border-[#e5e7eb] dark:border-[#27272a] rounded-xl p-6 bg-white dark:bg-[#121217] shadow-sm">
              <div className="flex items-center space-x-2 mb-4">
                <Mail className="w-4 h-4 text-[#111827] dark:text-white" />
                <h3 className="mono-eyebrow text-[#111827] dark:text-white font-normal text-xs">PREPARED DRAFTS</h3>
              </div>

              {!drafts || drafts.length === 0 ? (
                <p className="text-xs text-[#9ca3af] dark:text-[#71717a] font-mono font-light">No drafts generated yet.</p>
              ) : (
                <div className="space-y-4">
                  {drafts.map((d: any) => (
                    <div key={d.id} className="border border-[#e5e7eb] dark:border-[#27272a] rounded-xl p-4 bg-[#f8fafc] dark:bg-[#18181b]">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-normal text-[#111827] dark:text-white">{d.subject}</span>
                        <span className="text-[10px] font-mono font-normal px-2.5 py-0.5 rounded-full bg-[#111827] dark:bg-white text-white dark:text-[#111827]">
                          {d.approval_status.toUpperCase()}
                        </span>
                      </div>
                      <div className="text-xs text-[#4b5563] dark:text-[#a1a1aa] font-mono whitespace-pre-line leading-relaxed bg-white dark:bg-[#121217] p-3 rounded-lg border border-[#e5e7eb] dark:border-[#27272a] font-light">
                        {d.body_text}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Score Breakdown & Contacts */}
          <div className="space-y-6">
            {/* Score Components */}
            {score && (
              <div className="border border-[#e5e7eb] dark:border-[#27272a] rounded-xl p-6 bg-white dark:bg-[#121217] shadow-sm">
                <h3 className="mono-eyebrow text-[#111827] dark:text-white font-normal text-xs mb-4">SCORE BREAKDOWN</h3>
                <div className="space-y-3 text-xs font-mono">
                  <div className="flex justify-between items-center py-1.5 border-b border-[#f3f4f6] dark:border-[#1f1f23]">
                    <span className="text-[#6b7280] dark:text-[#a1a1aa]">IDENTITY CONFIDENCE</span>
                    <span className="font-normal text-[#111827] dark:text-white">{score.identity_confidence_score} / 25</span>
                  </div>
                  <div className="flex justify-between items-center py-1.5 border-b border-[#f3f4f6] dark:border-[#1f1f23]">
                    <span className="text-[#6b7280] dark:text-[#a1a1aa]">EVIDENCE CERTAINTY</span>
                    <span className="font-normal text-[#111827] dark:text-white">{score.evidence_certainty_score} / 25</span>
                  </div>
                  <div className="flex justify-between items-center py-1.5 border-b border-[#f3f4f6] dark:border-[#1f1f23]">
                    <span className="text-[#6b7280] dark:text-[#a1a1aa]">OFFERING FIT</span>
                    <span className="font-normal text-[#111827] dark:text-white">{score.offering_fit_score} / 25</span>
                  </div>
                  <div className="flex justify-between items-center py-1.5">
                    <span className="text-[#6b7280] dark:text-[#a1a1aa]">DISPATCH READINESS</span>
                    <span className="font-normal text-[#111827] dark:text-white">{score.dispatch_readiness_score} / 25</span>
                  </div>
                </div>
              </div>
            )}

            {/* Discovered Contacts */}
            <div className="border border-[#e5e7eb] dark:border-[#27272a] rounded-xl p-6 bg-white dark:bg-[#121217] shadow-sm">
              <h3 className="mono-eyebrow text-[#111827] dark:text-white font-normal text-xs mb-4">DISCOVERED CONTACTS</h3>
              {!contacts || contacts.length === 0 ? (
                <p className="text-xs text-[#9ca3af] dark:text-[#71717a] font-mono font-light">No direct contacts discovered.</p>
              ) : (
                <div className="space-y-3">
                  {contacts.map((c: any) => (
                    <div key={c.id} className="p-3 bg-[#f8fafc] dark:bg-[#18181b] rounded-xl text-xs font-mono border border-[#e5e7eb] dark:border-[#27272a]">
                      <div className="font-normal text-[#111827] dark:text-white">{c.full_name || 'Contact'}</div>
                      <div className="text-[#f43f5e] font-normal mt-0.5">{c.email_address}</div>
                      {c.role_title && <div className="text-[#9ca3af] dark:text-[#71717a] text-[11px] mt-0.5 font-light">{c.role_title}</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
