'use client';

import { useState, useEffect } from 'react';
import { Check, X, ShieldAlert, Sparkles, Send, ExternalLink, ArrowRight, ShieldCheck } from 'lucide-react';

export default function DraftsApprovalPage() {
  const [drafts, setDrafts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [workflows, setWorkflows] = useState<any[]>([]);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchDrafts = async () => {
    try {
      const [draftsRes, wfRes] = await Promise.all([
        fetch('/api/drafts'),
        fetch('/api/workflows'),
      ]);
      const draftsData = await draftsRes.json();
      const wfData = await wfRes.json();
      setDrafts(draftsData.drafts || []);
      setWorkflows(wfData.workflows || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDrafts();
  }, []);

  const handleApprove = async (draftId: string) => {
    setActionLoading(draftId);
    try {
      const res = await fetch(`/api/drafts/${draftId}/approve`, { method: 'POST' });
      if (res.ok) {
        fetchDrafts();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (draftId: string) => {
    setActionLoading(draftId);
    try {
      const res = await fetch(`/api/drafts/${draftId}/reject`, { method: 'POST' });
      if (res.ok) {
        fetchDrafts();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleQueueForSend = async (draft: any) => {
    const approvedWorkflow = workflows.find((w) => w.status === 'approved');
    if (!approvedWorkflow) {
      alert('Cannot send: No approved outreach workflow found. Please approve a workflow in the WORKFLOWS page first.');
      return;
    }

    setActionLoading(draft.id);
    try {
      const res = await fetch('/api/outreach/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          draftId: draft.id,
          workflowId: approvedWorkflow.id,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        alert('Email queued for outbound dispatch!');
        fetchDrafts();
      } else {
        alert(`Error: ${data.error || 'Failed to queue outreach'}`);
      }
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#ffffff]">
      {/* Top Banner with Fresh Pink Gradient */}
      <section className="bg-gradient-to-b from-[#fff5f6] via-[#fff1f2]/70 to-[#ffffff] border-b border-[#ffe4e6] px-6 py-10 relative overflow-hidden">
        <div className="absolute -top-16 -right-16 w-80 h-80 rounded-full bg-[#fecdd3]/50 blur-3xl pointer-events-none"></div>
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-white border border-[#fecdd3] text-[#f43f5e] shadow-sm mb-3">
            <span className="w-2 h-2 rounded-full bg-[#f43f5e]"></span>
            <span className="mono-eyebrow text-xs font-bold">HUMAN-IN-THE-LOOP SAFETY GATE</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-[#111827]">Draft Approval Queue</h1>
          <p className="text-sm text-[#4b5563] mt-1 max-w-xl">
            Review personalized outreach drafts. Automated dispatch remains strictly blocked until explicit operator approval.
          </p>
        </div>
      </section>

      <main className="max-w-7xl mx-auto px-6 py-10">
        {loading ? (
          <div className="py-20 text-center font-mono text-sm text-[#9ca3af]">Loading drafts...</div>
        ) : drafts.length === 0 ? (
          <div className="border border-[#e5e7eb] rounded-2xl p-16 text-center bg-[#fff5f6]/50">
            <ShieldCheck className="w-12 h-12 text-[#f43f5e]/40 mx-auto mb-3" />
            <p className="text-sm text-[#6b7280] font-mono">No drafts generated yet. Trigger a discovery run in Campaigns.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {drafts.map((draft) => {
              const isApproved = draft.approval_status === 'approved';
              const isRejected = draft.approval_status === 'rejected';

              return (
                <div
                  key={draft.id}
                  className={`border rounded-2xl p-6 bg-white shadow-sm transition ${
                    isApproved
                      ? 'border-emerald-300 bg-emerald-50/10'
                      : isRejected
                      ? 'border-rose-200 bg-rose-50/10 opacity-60'
                      : 'border-[#e5e7eb] hover:border-[#fecdd3]'
                  }`}
                >
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-4">
                    <div>
                      <div className="flex items-center space-x-2 mb-1">
                        <span className="font-bold text-base text-[#111827]">
                          {draft.business?.display_name || 'Prospect Business'}
                        </span>
                        <span className="text-xs text-[#9ca3af] font-mono">
                          ({draft.business?.city || 'India'})
                        </span>
                      </div>
                      <div className="text-xs text-[#4b5563] font-mono">
                        To: {draft.contact?.email_address || draft.business?.general_business_email || 'No email discovered'}
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <span
                        className={`mono-eyebrow text-xs px-3 py-1 rounded-full font-bold ${
                          isApproved
                            ? 'bg-emerald-100 text-emerald-800'
                            : isRejected
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {draft.approval_status.toUpperCase()}
                      </span>
                    </div>
                  </div>

                  {/* Email Subject & Body Preview */}
                  <div className="bg-[#f9fafb] border border-[#f3f4f6] rounded-xl p-4 mb-4">
                    <div className="text-xs font-mono text-[#9ca3af] mb-1 font-bold">SUBJECT:</div>
                    <div className="text-sm font-bold text-[#111827] mb-3">{draft.subject}</div>

                    <div className="text-xs font-mono text-[#9ca3af] mb-1 font-bold">BODY TEXT:</div>
                    <div className="text-xs font-mono text-[#374151] whitespace-pre-line leading-relaxed bg-white p-4 border border-[#e5e7eb] rounded-xl">
                      {draft.body_text}
                    </div>
                  </div>

                  {/* Grounded Evidence Reference */}
                  {draft.evidence_used && draft.evidence_used.length > 0 && (
                    <div className="mb-4 text-xs font-mono">
                      <span className="text-[#9ca3af] block mb-1">FACTUAL CITATIONS:</span>
                      <div className="flex flex-wrap gap-2">
                        {draft.evidence_used.map((ev: string, idx: number) => (
                          <span key={idx} className="bg-[#fff1f2] text-[#f43f5e] px-2.5 py-1 rounded-full text-[11px] font-semibold border border-[#fecdd3]">
                            {ev}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Action Bar */}
                  <div className="pt-4 border-t border-[#f3f4f6] flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center space-x-2">
                      {!isApproved && (
                        <button
                          onClick={() => handleApprove(draft.id)}
                          disabled={actionLoading === draft.id}
                          className="mono-btn bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-full text-xs font-semibold flex items-center space-x-1.5 transition active:scale-95"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>APPROVE</span>
                        </button>
                      )}

                      {!isRejected && (
                        <button
                          onClick={() => handleReject(draft.id)}
                          disabled={actionLoading === draft.id}
                          className="mono-btn bg-[#f3f4f6] hover:bg-[#e5e7eb] text-[#374151] px-4 py-2 rounded-full text-xs font-semibold flex items-center space-x-1.5 transition active:scale-95"
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>REJECT</span>
                        </button>
                      )}
                    </div>

                    {isApproved && (
                      <button
                        onClick={() => handleQueueForSend(draft)}
                        disabled={actionLoading === draft.id}
                        className="mono-btn bg-[#f43f5e] hover:bg-[#e11d48] text-white px-5 py-2 rounded-full text-xs font-semibold flex items-center space-x-2 shadow-sm shadow-rose-500/20 transition active:scale-95"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>QUEUE FOR OUTBOUND DISPATCH</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
