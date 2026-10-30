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
      <div className="min-h-screen bg-white py-24 text-center font-mono text-sm text-[#9ca3af]">
        Loading business evidence...
      </div>
    );
  }

  if (!data || !data.business) {
    return (
      <div className="min-h-screen bg-white py-24 text-center font-mono text-sm text-[#9ca3af]">
        Business not found.
      </div>
    );
  }

  const { business, evidence, contacts, score, drafts } = data;

  return (
    <div className="min-h-screen bg-[#ffffff]">
      {/* Top Banner with Fresh Pink Gradient */}
      <section className="bg-gradient-to-b from-[#fff5f6] via-[#fff1f2]/70 to-[#ffffff] border-b border-[#ffe4e6] px-6 py-8 relative overflow-hidden">
        <div className="max-w-7xl mx-auto relative z-10">
          <Link
            href="/leads"
            className="mono-btn text-xs text-[#f43f5e] hover:underline flex items-center space-x-1.5 mb-4 font-bold"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>BACK TO LEADS</span>
          </Link>

          <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
            <div>
              <div className="flex items-center space-x-3 mb-2">
                <span className="mono-eyebrow text-xs bg-[#fff1f2] border border-[#fecdd3] text-[#f43f5e] px-3 py-0.5 rounded-full font-bold">
                  {business.business_type}
                </span>
                <span className="text-xs font-mono text-[#6b7280]">
                  {business.city}, {business.region}, {business.country_code}
                </span>
              </div>

              <h1 className="text-3xl font-bold tracking-tight text-[#111827] mb-2">{business.display_name}</h1>

              <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-[#4b5563]">
                {business.official_website_url && (
                  <a
                    href={business.official_website_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#f43f5e] hover:underline flex items-center space-x-1 font-bold"
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
              <div className="bg-white border border-[#fecdd3] rounded-2xl p-5 shadow-sm text-center min-w-[160px]">
                <div className="text-4xl font-bold text-[#f43f5e]">{score.total_score}</div>
                <div className="mono-eyebrow text-[10px] text-[#9ca3af] mt-1 font-bold">QUALIFICATION SCORE</div>
                <div className="mt-2 text-[10px] font-mono text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full font-bold border border-emerald-200 inline-block">
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
            <div className="border border-[#e5e7eb] rounded-2xl p-6 bg-white shadow-sm">
              <div className="flex items-center space-x-2 mb-4">
                <CheckCircle2 className="w-4 h-4 text-[#f43f5e]" />
                <h3 className="mono-eyebrow text-[#f43f5e] font-bold text-xs">EMPIRICAL EVIDENCE ITEMS</h3>
              </div>

              {!evidence || evidence.length === 0 ? (
                <p className="text-xs text-[#9ca3af] font-mono">No evidence gathered yet for this prospect.</p>
              ) : (
                <div className="space-y-4">
                  {evidence.map((item: any) => (
                    <div key={item.id} className="border border-[#f3f4f6] rounded-xl p-4 bg-[#f9fafb]">
                      <div className="flex items-center justify-between mb-2">
                        <span className="mono-eyebrow text-xs text-[#111827] font-bold">{item.category}</span>
                        <span className="mono-eyebrow text-[10px] text-[#9ca3af]">{item.source_type}</span>
                      </div>
                      <p className="text-xs text-[#4b5563] leading-relaxed mb-2 font-mono">
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
            <div className="border border-[#e5e7eb] rounded-2xl p-6 bg-white shadow-sm">
              <div className="flex items-center space-x-2 mb-4">
                <Mail className="w-4 h-4 text-[#f43f5e]" />
                <h3 className="mono-eyebrow text-[#f43f5e] font-bold text-xs">PREPARED DRAFTS</h3>
              </div>

              {!drafts || drafts.length === 0 ? (
                <p className="text-xs text-[#9ca3af] font-mono">No drafts generated yet.</p>
              ) : (
                <div className="space-y-4">
                  {drafts.map((d: any) => (
                    <div key={d.id} className="border border-[#ffe4e6] rounded-xl p-4 bg-[#fff5f6]">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-[#111827]">{d.subject}</span>
                        <span className="text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-[#f43f5e] text-white">
                          {d.approval_status.toUpperCase()}
                        </span>
                      </div>
                      <div className="text-xs text-[#4b5563] font-mono whitespace-pre-line leading-relaxed bg-white p-3 rounded-lg border border-[#fecdd3]">
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
              <div className="border border-[#e5e7eb] rounded-2xl p-6 bg-white shadow-sm">
                <h3 className="mono-eyebrow text-[#f43f5e] font-bold text-xs mb-4">SCORE BREAKDOWN</h3>
                <div className="space-y-3 text-xs font-mono">
                  <div className="flex justify-between items-center py-1.5 border-b border-[#f3f4f6]">
                    <span className="text-[#6b7280]">IDENTITY CONFIDENCE</span>
                    <span className="font-bold text-[#111827]">{score.identity_confidence_score} / 25</span>
                  </div>
                  <div className="flex justify-between items-center py-1.5 border-b border-[#f3f4f6]">
                    <span className="text-[#6b7280]">EVIDENCE CERTAINTY</span>
                    <span className="font-bold text-[#111827]">{score.evidence_certainty_score} / 25</span>
                  </div>
                  <div className="flex justify-between items-center py-1.5 border-b border-[#f3f4f6]">
                    <span className="text-[#6b7280]">OFFERING FIT</span>
                    <span className="font-bold text-[#111827]">{score.offering_fit_score} / 25</span>
                  </div>
                  <div className="flex justify-between items-center py-1.5">
                    <span className="text-[#6b7280]">DISPATCH READINESS</span>
                    <span className="font-bold text-[#111827]">{score.dispatch_readiness_score} / 25</span>
                  </div>
                </div>
              </div>
            )}

            {/* Discovered Contacts */}
            <div className="border border-[#e5e7eb] rounded-2xl p-6 bg-white shadow-sm">
              <h3 className="mono-eyebrow text-[#f43f5e] font-bold text-xs mb-4">DISCOVERED CONTACTS</h3>
              {!contacts || contacts.length === 0 ? (
                <p className="text-xs text-[#9ca3af] font-mono">No direct contacts discovered.</p>
              ) : (
                <div className="space-y-3">
                  {contacts.map((c: any) => (
                    <div key={c.id} className="p-3 bg-[#f9fafb] rounded-xl text-xs font-mono">
                      <div className="font-semibold text-[#111827]">{c.full_name || 'Contact'}</div>
                      <div className="text-[#f43f5e] font-bold mt-0.5">{c.email_address}</div>
                      {c.role_title && <div className="text-[#9ca3af] text-[11px] mt-0.5">{c.role_title}</div>}
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
