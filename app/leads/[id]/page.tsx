'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ExternalLink, CheckCircle2, AlertTriangle, ArrowLeft, ShieldCheck, Mail, Sparkles } from 'lucide-react';

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
    return <div className="py-20 text-center font-mono text-sm text-black/40">Loading business evidence...</div>;
  }

  if (!data || !data.business) {
    return <div className="py-20 text-center font-mono text-sm text-black/40">Business not found.</div>;
  }

  const { business, evidence, contacts, score, drafts } = data;

  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      <Link href="/leads" className="mono-btn text-xs text-black/50 hover:text-black flex items-center space-x-1.5 mb-6">
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>BACK TO LEADS</span>
      </Link>

      {/* Header Info Card */}
      <div className="border border-black/[0.08] rounded-[4px] p-8 bg-white mb-8">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div>
            <div className="flex items-center space-x-3 mb-2">
              <span className="mono-eyebrow text-xs bg-black/5 text-black px-2 py-0.5 rounded-[4px]">
                {business.business_type}
              </span>
              <span className="text-xs font-mono text-black/40">
                {business.city}, {business.region}, {business.country_code}
              </span>
            </div>

            <h1 className="text-3xl font-medium tracking-tight text-black mb-2">{business.display_name}</h1>

            <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-black/70">
              {business.official_website_url && (
                <a
                  href={business.official_website_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#ef2cc1] hover:underline flex items-center space-x-1"
                >
                  <span>{business.official_website_url}</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
              {business.public_business_phone && (
                <span>Phone: {business.public_business_phone}</span>
              )}
              {business.general_business_email && (
                <span>Email: {business.general_business_email}</span>
              )}
            </div>
          </div>

          {/* Qualification Score Pill */}
          {score && (
            <div className="bg-[#c8f6f9] p-5 rounded-[4px] min-w-[200px] text-right">
              <span className="mono-eyebrow text-[10px] text-black/60 block">QUALIFICATION SCORE</span>
              <div className="text-4xl font-semibold text-black">{score.final_score} / 100</div>
              <div className="text-xs font-mono text-black/70 mt-1">
                {score.final_score >= 65 ? 'QUALIFIED FOR OUTREACH' : 'REVIEW REQUIRED'}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Empirical Evidence Items */}
        <div className="lg:col-span-2 space-y-6">
          <div className="border border-black/[0.08] rounded-[4px] p-6 bg-white">
            <h3 className="mono-eyebrow text-black/50 mb-4">EMPIRICAL EVIDENCE OBSERVATIONS</h3>
            {evidence.length === 0 ? (
              <p className="text-xs font-mono text-black/50">No evidence items recorded yet.</p>
            ) : (
              <div className="space-y-4">
                {evidence.map((ev: any) => (
                  <div key={ev.id} className="p-4 bg-[#f9f9fa] border border-black/[0.04] rounded-[4px]">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="mono-eyebrow text-xs text-[#ef2cc1]">{ev.finding_type}</span>
                      <span className="text-[10px] font-mono text-black/40">
                        CONFIDENCE: {Math.round(ev.confidence * 100)}%
                      </span>
                    </div>
                    <p className="text-sm text-black/90 mb-2 font-medium">{ev.claim_text}</p>
                    {ev.supporting_excerpt && (
                      <div className="text-xs text-black/60 font-mono bg-white p-2 border border-black/[0.06] rounded-[4px] mb-2">
                        "{ev.supporting_excerpt}"
                      </div>
                    )}
                    <div className="text-[11px] font-mono text-black/40">
                      Source: {ev.source_url} ({new Date(ev.observed_at).toLocaleDateString()})
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Score Component Breakdown */}
          {score && (
            <div className="border border-black/[0.08] rounded-[4px] p-6 bg-white">
              <h3 className="mono-eyebrow text-black/50 mb-4">SCORING BREAKDOWN (100 PTS)</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center font-mono">
                <div className="p-3 bg-[#f9f9fa] border border-black/[0.04] rounded-[4px]">
                  <div className="text-xs text-black/50">BUSINESS FIT</div>
                  <div className="text-xl font-semibold mt-1">{score.fit_score} / 30</div>
                </div>
                <div className="p-3 bg-[#f9f9fa] border border-black/[0.04] rounded-[4px]">
                  <div className="text-xs text-black/50">NEED / PROBLEM</div>
                  <div className="text-xl font-semibold mt-1">{score.need_score} / 35</div>
                </div>
                <div className="p-3 bg-[#f9f9fa] border border-black/[0.04] rounded-[4px]">
                  <div className="text-xs text-black/50">CONTACTABILITY</div>
                  <div className="text-xl font-semibold mt-1">{score.contactability_score} / 15</div>
                </div>
                <div className="p-3 bg-[#f9f9fa] border border-black/[0.04] rounded-[4px]">
                  <div className="text-xs text-black/50">SERVICE MATCH</div>
                  <div className="text-xl font-semibold mt-1">{score.service_match_score} / 20</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: AI Drafts */}
        <div className="space-y-6">
          <div className="border border-black/[0.08] rounded-[4px] p-6 bg-white">
            <h3 className="mono-eyebrow text-black/50 mb-4">AI-GENERATED EMAIL DRAFTS</h3>
            {drafts.length === 0 ? (
              <p className="text-xs font-mono text-black/50">No drafts generated for this lead yet.</p>
            ) : (
              <div className="space-y-4">
                {drafts.map((d: any) => (
                  <div key={d.id} className="border border-black/10 rounded-[4px] p-4 bg-[#f9f9fa]">
                    <div className="flex items-center justify-between mb-2">
                      <span className={`mono-eyebrow text-[10px] px-2 py-0.5 rounded-[4px] ${
                        d.approval_status === 'approved'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        {d.approval_status.toUpperCase()}
                      </span>
                      <span className="text-[10px] font-mono text-black/40">{d.model_provider}</span>
                    </div>

                    <div className="font-semibold text-sm text-black mb-2">{d.subject}</div>
                    <div className="text-xs text-black/80 whitespace-pre-line font-mono bg-white p-3 border border-black/[0.06] rounded-[4px] mb-4">
                      {d.body_text}
                    </div>

                    <Link
                      href="/drafts"
                      className="mono-btn text-xs text-[#ef2cc1] hover:underline block text-right font-semibold"
                    >
                      GO TO APPROVAL QUEUE →
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
