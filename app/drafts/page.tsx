'use client';

import { useState, useEffect } from 'react';
import { Check, X, ShieldAlert, Sparkles, Send, ExternalLink, ArrowRight } from 'lucide-react';

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

      if (res.ok) {
        alert('Email queued for controlled sending! Background worker will process with suppression & safety checks.');
        fetchDrafts();
      } else {
        const json = await res.json();
        alert(`Error queuing: ${json.error}`);
      }
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 pb-6 border-b border-black/[0.08]">
        <div>
          <div className="mono-eyebrow text-black/50 mb-1">HUMAN-IN-THE-LOOP SAFETY GATE</div>
          <h1 className="text-3xl font-medium tracking-tight text-black">Draft Approval Queue</h1>
          <p className="text-sm text-black/60 mt-1">
            Review personalized outreach drafts. Automated dispatch remains strictly blocked until explicit operator approval.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="py-20 text-center font-mono text-sm text-black/40">Loading drafts...</div>
      ) : drafts.length === 0 ? (
        <div className="border border-black/[0.08] rounded-[4px] p-16 text-center bg-[#f9f9fa]">
          <p className="text-sm text-black/60 font-mono">No drafts generated yet. Trigger a discovery run in Campaigns.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {drafts.map((draft) => {
            const isApproved = draft.approval_status === 'approved';
            const isRejected = draft.approval_status === 'rejected';

            return (
              <div
                key={draft.id}
                className={`border rounded-[4px] p-6 bg-white transition ${
                  isApproved
                    ? 'border-emerald-300 bg-emerald-50/10'
                    : isRejected
                    ? 'border-rose-200 bg-rose-50/10 opacity-60'
                    : 'border-black/[0.12]'
                }`}
              >
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-4">
                  <div>
                    <div className="flex items-center space-x-2 mb-1">
                      <span className="font-semibold text-base text-black">
                        {draft.business?.display_name || 'Prospect Business'}
                      </span>
                      <span className="text-xs text-black/40 font-mono">
                        ({draft.business?.city || 'India'})
                      </span>
                    </div>
                    <div className="text-xs text-black/60 font-mono">
                      To: {draft.contact?.email_address || draft.business?.general_business_email || 'No email discovered'}
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <span
                      className={`mono-eyebrow text-xs px-2.5 py-1 rounded-[4px] font-semibold ${
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
                <div className="bg-[#f9f9fa] border border-black/[0.06] rounded-[4px] p-4 mb-4">
                  <div className="text-xs font-mono text-black/50 mb-1">SUBJECT:</div>
                  <div className="text-sm font-semibold text-black mb-3">{draft.subject}</div>

                  <div className="text-xs font-mono text-black/50 mb-1">BODY TEXT:</div>
                  <div className="text-xs font-mono text-black/80 whitespace-pre-line leading-relaxed bg-white p-3 border border-black/[0.04] rounded-[4px]">
                    {draft.body_text}
                  </div>
                </div>

                {/* Grounding & Evidence Summary */}
                <div className="flex items-center justify-between text-xs text-black/60 font-mono mb-6">
                  <div>
                    <span className="text-black/40">EVIDENCE GROUNDING:</span> {draft.personalization_summary}
                  </div>
                </div>

                {/* Action Controls */}
                <div className="flex items-center justify-end space-x-3 pt-3 border-t border-black/[0.06]">
                  {!isApproved && !isRejected && (
                    <>
                      <button
                        onClick={() => handleReject(draft.id)}
                        disabled={actionLoading === draft.id}
                        className="mono-btn text-xs text-rose-700 hover:bg-rose-50 border border-rose-200 px-3 py-1.5 rounded-[4px] transition flex items-center space-x-1"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>REJECT</span>
                      </button>

                      <button
                        onClick={() => handleApprove(draft.id)}
                        disabled={actionLoading === draft.id}
                        className="mono-btn text-xs bg-black text-white hover:bg-black/80 px-4 py-1.5 rounded-[4px] transition flex items-center space-x-1.5"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>APPROVE DRAFT</span>
                      </button>
                    </>
                  )}

                  {isApproved && (
                    <button
                      onClick={() => handleQueueForSend(draft)}
                      disabled={actionLoading === draft.id}
                      className="mono-btn text-xs bg-[#c8f6f9] text-black hover:bg-[#aef0f5] px-4 py-1.5 rounded-[4px] transition flex items-center space-x-1.5 font-semibold"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>QUEUE FOR CONTROLLED SEND</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
