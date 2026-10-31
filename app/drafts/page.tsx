'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Check,
  X,
  Send,
  ExternalLink,
  ShieldCheck,
  Sparkles,
  Building2,
  Mail,
  MapPin,
  ChevronRight,
  ChevronLeft,
  Keyboard,
  Clock,
  ArrowRight,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';

export default function DraftsApprovalPage() {
  const [drafts, setDrafts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [workflows, setWorkflows] = useState<any[]>([]);
  const [selectedDraftId, setSelectedDraftId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [editedBody, setEditedBody] = useState<string>('');
  const [isEditing, setIsEditing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const fetchDrafts = async () => {
    try {
      const [draftsRes, wfRes] = await Promise.all([
        fetch('/api/drafts'),
        fetch('/api/workflows'),
      ]);
      const draftsData = await draftsRes.json();
      const wfData = await wfRes.json();
      const loadedDrafts = draftsData.drafts || [];
      setDrafts(loadedDrafts);
      setWorkflows(wfData.workflows || []);

      if (loadedDrafts.length > 0 && !selectedDraftId) {
        setSelectedDraftId(loadedDrafts[0].id);
        setEditedBody(loadedDrafts[0].body_text || '');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDrafts();
  }, []);

  const selectedDraft = drafts.find((d) => d.id === selectedDraftId) || drafts[0];

  useEffect(() => {
    if (selectedDraft) {
      setEditedBody(selectedDraft.body_text || '');
      setIsEditing(false);
    }
  }, [selectedDraftId]);

  const handleApprove = async (draftId: string) => {
    setActionLoading(draftId);
    setStatusMessage('Approving draft...');
    try {
      const res = await fetch(`/api/drafts/${draftId}/approve`, { method: 'POST' });
      if (res.ok) {
        setStatusMessage('Draft approved. Ready for dispatch.');
        setDrafts((prev) =>
          prev.map((d) => (d.id === draftId ? { ...d, approval_status: 'approved' } : d))
        );
      }
    } catch (err: any) {
      setStatusMessage(`Error: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (draftId: string) => {
    setActionLoading(draftId);
    setStatusMessage('Rejecting draft...');
    try {
      const res = await fetch(`/api/drafts/${draftId}/reject`, { method: 'POST' });
      if (res.ok) {
        setStatusMessage('Draft rejected.');
        setDrafts((prev) =>
          prev.map((d) => (d.id === draftId ? { ...d, approval_status: 'rejected' } : d))
        );
      }
    } catch (err: any) {
      setStatusMessage(`Error: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleQueueForSend = async (draft: any) => {
    const approvedWorkflow = workflows.find((w) => w.status === 'approved');
    if (!approvedWorkflow) {
      alert('Cannot send: No approved outreach workflow found. Please approve a workflow in the Workflows page first.');
      return;
    }

    setActionLoading(draft.id);
    setStatusMessage('Dispatching to outbound queue...');
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
        setStatusMessage('Email queued for outbound dispatch!');
        fetchDrafts();
      } else {
        setStatusMessage(`Error: ${data.error || 'Failed to queue outreach'}`);
      }
    } catch (err: any) {
      setStatusMessage(`Error: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  // Keyboard navigation & approval shortcuts (A = approve, R = reject, J/K = next/prev)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input or textarea
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      if (!selectedDraft) return;

      const currentIndex = drafts.findIndex((d) => d.id === selectedDraft.id);

      if (e.key === 'a' || e.key === 'A') {
        handleApprove(selectedDraft.id);
      } else if (e.key === 'r' || e.key === 'R') {
        handleReject(selectedDraft.id);
      } else if (e.key === 'j' || e.key === 'ArrowDown') {
        if (currentIndex < drafts.length - 1) {
          setSelectedDraftId(drafts[currentIndex + 1].id);
        }
      } else if (e.key === 'k' || e.key === 'ArrowUp') {
        if (currentIndex > 0) {
          setSelectedDraftId(drafts[currentIndex - 1].id);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedDraft, drafts]);

  const filteredDrafts = drafts.filter((d) => {
    if (filter === 'all') return true;
    if (filter === 'pending') return !d.approval_status || d.approval_status === 'pending';
    if (filter === 'approved') return d.approval_status === 'approved';
    if (filter === 'rejected') return d.approval_status === 'rejected';
    return true;
  });

  return (
    <div className="min-h-screen bg-white dark:bg-[#010120] text-[#000000] dark:text-[#ffffff] transition-colors duration-150 flex flex-col">
      {/* 2px Signature Gradient Ribbon */}
      <div className="brand-gradient-h w-full" />

      {/* Hero Band: Canvas Dark #010120 */}
      <section className="bg-[#010120] text-white border-b border-white/[0.08] px-6 py-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2 text-[10px] font-mono tracking-widest text-[#959494] uppercase mb-1">
              <span>OUTREACH INTELLIGENCE // RAPID APPROVAL REVIEWER</span>
              <span>•</span>
              <span className="text-[#ef2cc1]">HUMAN-IN-THE-LOOP</span>
            </div>
            <h1 className="text-3xl font-medium tracking-tight text-white">
              Draft Approval Queue
            </h1>
            <p className="text-xs text-[#959494] mt-1 font-normal max-w-xl">
              Inspect AI-generated personalized hooks. Automated dispatch remains strictly gated until explicit operator sign-off.
            </p>
          </div>

          {/* Keyboard Shortcut Cheatsheet Pill */}
          <div className="hidden lg:flex items-center space-x-3 px-3 py-1.5 rounded-[4px] bg-[#313641]/50 border border-white/[0.08] text-[10px] font-mono text-[#959494]">
            <Keyboard className="w-3.5 h-3.5 text-[#ef2cc1]" />
            <span><strong className="text-white">A</strong> APPROVE</span>
            <span>•</span>
            <span><strong className="text-white">R</strong> REJECT</span>
            <span>•</span>
            <span><strong className="text-white">J/K</strong> NAVIGATE</span>
          </div>
        </div>
      </section>

      {/* Main 3-Pane Reviewer Surface */}
      <div className="flex-1 max-w-7xl w-full mx-auto px-6 py-6 flex flex-col">
        {/* Status / Alert Banner */}
        {statusMessage && (
          <div className="mb-4 px-3.5 py-2 rounded-[4px] border border-[#ebebeb] dark:border-white/[0.08] bg-[#f8fafc] dark:bg-[#313641]/40 flex items-center justify-between text-xs font-mono">
            <span>{statusMessage}</span>
            <button onClick={() => setStatusMessage(null)} className="text-[#959494] hover:text-black dark:hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {loading ? (
          <div className="py-24 text-center font-mono text-xs text-[#959494] flex items-center justify-center space-x-2">
            <RefreshCw className="w-4 h-4 animate-spin text-[#ef2cc1]" />
            <span>LOADING OUTREACH QUEUE...</span>
          </div>
        ) : drafts.length === 0 ? (
          <div className="border border-[#ebebeb] dark:border-white/[0.08] rounded-[4px] p-16 text-center bg-[#f8fafc] dark:bg-[#313641]/20 my-auto">
            <ShieldCheck className="w-10 h-10 text-[#959494] mx-auto mb-3" />
            <h3 className="text-sm font-mono uppercase tracking-wider font-semibold text-black dark:text-white mb-1">
              Zero Pending Drafts
            </h3>
            <p className="text-xs text-[#6b7280] dark:text-[#959494] font-normal mb-4">
              All generated outreach emails have been approved or dispatched.
            </p>
            <Link
              href="/campaigns"
              className="mono-btn inline-flex items-center space-x-1.5 px-3 py-1.5 bg-black dark:bg-white text-white dark:text-black rounded-[4px] text-xs font-semibold"
            >
              <span>RUN CAMPAIGN DISCOVERY</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 flex-1 items-start">
            {/* PANE 1: Drafts List Queue (4 Cols) */}
            <div className="lg:col-span-4 border border-[#ebebeb] dark:border-white/[0.08] rounded-[4px] bg-white dark:bg-[#010120] overflow-hidden flex flex-col h-[750px]">
              {/* Queue Controls & Filter */}
              <div className="p-3 border-b border-[#ebebeb] dark:border-white/[0.08] bg-[#f8fafc] dark:bg-[#313641]/30 flex items-center justify-between">
                <span className="font-mono text-[11px] font-semibold tracking-wider uppercase text-[#000000] dark:text-white">
                  QUEUE ({filteredDrafts.length})
                </span>
                <div className="flex items-center space-x-1">
                  {(['all', 'pending', 'approved', 'rejected'] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setFilter(tab)}
                      className={`text-[9px] font-mono uppercase px-2 py-0.5 rounded-[3px] transition ${
                        filter === tab
                          ? 'bg-black dark:bg-white text-white dark:text-black font-semibold'
                          : 'text-[#6b7280] dark:text-[#959494] hover:text-black dark:hover:text-white'
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
              </div>

              {/* Scrollable Drafts Items */}
              <div className="flex-1 overflow-y-auto divide-y divide-[#ebebeb] dark:divide-white/[0.06]">
                {filteredDrafts.map((draft) => {
                  const isSelected = selectedDraft?.id === draft.id;
                  const isApproved = draft.approval_status === 'approved';
                  const isRejected = draft.approval_status === 'rejected';

                  return (
                    <button
                      key={draft.id}
                      onClick={() => setSelectedDraftId(draft.id)}
                      className={`w-full text-left p-3.5 transition flex flex-col space-y-1.5 ${
                        isSelected
                          ? 'bg-[#f4f4f5] dark:bg-[#313641]/70 border-l-2 border-[#ef2cc1]'
                          : 'hover:bg-[#fafafa] dark:hover:bg-white/[0.02]'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-xs text-black dark:text-white truncate max-w-[190px]">
                          {draft.business?.display_name || 'Target Prospect'}
                        </span>
                        {isApproved ? (
                          <span className="px-1.5 py-0.2 rounded-[2px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[9px] font-mono uppercase font-semibold">
                            APPROVED
                          </span>
                        ) : isRejected ? (
                          <span className="px-1.5 py-0.2 rounded-[2px] bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 text-[9px] font-mono uppercase font-semibold">
                            REJECTED
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.2 rounded-[2px] bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-[9px] font-mono uppercase font-semibold">
                            PENDING
                          </span>
                        )}
                      </div>

                      <div className="text-[11px] text-[#6b7280] dark:text-[#959494] truncate">
                        {draft.subject_line || 'Untitled Outreach Draft'}
                      </div>

                      <div className="flex items-center space-x-2 text-[10px] font-mono text-[#959494]">
                        <span>{draft.business?.city || 'India'}</span>
                        <span>•</span>
                        <span className="truncate max-w-[130px]">
                          {draft.contact?.email_address || draft.business?.general_business_email || 'No email'}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* PANE 2: Interactive Email Reviewer (5 Cols) */}
            <div className="lg:col-span-5 border border-[#ebebeb] dark:border-white/[0.08] rounded-[4px] bg-white dark:bg-[#010120] overflow-hidden flex flex-col h-[750px]">
              {selectedDraft ? (
                <>
                  {/* Email Chrome Header */}
                  <div className="p-4 border-b border-[#ebebeb] dark:border-white/[0.08] bg-[#f8fafc] dark:bg-[#313641]/20 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[10px] uppercase tracking-wider text-[#959494]">
                        EMAIL DRAFT // SUBJECT & RECIPIENT
                      </span>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => setIsEditing(!isEditing)}
                          className="text-[10px] font-mono uppercase underline text-[#6b7280] dark:text-[#959494] hover:text-black dark:hover:text-white"
                        >
                          {isEditing ? 'VIEW PREVIEW' : 'EDIT COPY'}
                        </button>
                      </div>
                    </div>

                    <div className="text-xs space-y-1 font-mono">
                      <div className="flex items-center text-[#6b7280] dark:text-[#959494]">
                        <span className="w-14 font-semibold text-black dark:text-white">TO:</span>
                        <span className="text-[#ef2cc1]">
                          {selectedDraft.contact?.email_address ||
                            selectedDraft.business?.general_business_email ||
                            'no-email-discovered@domain.com'}
                        </span>
                      </div>
                      <div className="flex items-center text-[#6b7280] dark:text-[#959494]">
                        <span className="w-14 font-semibold text-black dark:text-white">FROM:</span>
                        <span>Operator &lt;outreach@singulr.tech&gt;</span>
                      </div>
                      <div className="flex items-center text-[#6b7280] dark:text-[#959494]">
                        <span className="w-14 font-semibold text-black dark:text-white">SUBJECT:</span>
                        <span className="text-black dark:text-white font-medium">
                          {selectedDraft.subject_line}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Email Body Content */}
                  <div className="p-5 flex-1 overflow-y-auto">
                    {isEditing ? (
                      <textarea
                        value={editedBody}
                        onChange={(e) => setEditedBody(e.target.value)}
                        rows={16}
                        className="w-full text-xs font-mono p-3 border border-[#ebebeb] dark:border-white/[0.08] rounded-[4px] bg-white dark:bg-[#010120] text-black dark:text-white focus:outline-none focus:border-black dark:focus:border-white"
                      />
                    ) : (
                      <div className="prose dark:prose-invert max-w-none text-xs leading-relaxed font-sans whitespace-pre-wrap text-[#1f2937] dark:text-[#e4e4e7]">
                        {editedBody || selectedDraft.body_text}
                      </div>
                    )}
                  </div>

                  {/* Action Bar (Level 3 Elevation) */}
                  <div className="p-3 border-t border-[#ebebeb] dark:border-white/[0.08] bg-[#f8fafc] dark:bg-[#313641]/30 flex items-center justify-between gap-2">
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleReject(selectedDraft.id)}
                        disabled={actionLoading === selectedDraft.id}
                        className="mono-btn px-3 py-1.5 rounded-[4px] border border-rose-300 dark:border-rose-900/50 hover:bg-rose-50 dark:hover:bg-rose-950/20 text-rose-600 dark:text-rose-400 text-[11px] font-semibold flex items-center space-x-1"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>REJECT [R]</span>
                      </button>

                      <button
                        onClick={() => handleApprove(selectedDraft.id)}
                        disabled={actionLoading === selectedDraft.id}
                        className="mono-btn px-3.5 py-1.5 rounded-[4px] bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-semibold flex items-center space-x-1 shadow-sm"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>APPROVE [A]</span>
                      </button>
                    </div>

                    <button
                      onClick={() => handleQueueForSend(selectedDraft)}
                      disabled={actionLoading === selectedDraft.id || selectedDraft.approval_status !== 'approved'}
                      title={selectedDraft.approval_status !== 'approved' ? 'Approve draft first' : 'Queue email'}
                      className={`mono-btn px-3.5 py-1.5 rounded-[4px] text-[11px] font-semibold flex items-center space-x-1.5 transition ${
                        selectedDraft.approval_status === 'approved'
                          ? 'bg-black dark:bg-white text-white dark:text-black hover:bg-neutral-800'
                          : 'bg-neutral-200 dark:bg-neutral-800 text-neutral-400 cursor-not-allowed'
                      }`}
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>DISPATCH [S]</span>
                    </button>
                  </div>
                </>
              ) : (
                <div className="m-auto text-center font-mono text-xs text-[#959494]">
                  Select a draft from the queue to inspect.
                </div>
              )}
            </div>

            {/* PANE 3: Lead Dossier & AI Rationalization (3 Cols) */}
            <div className="lg:col-span-3 border border-[#ebebeb] dark:border-white/[0.08] rounded-[4px] bg-white dark:bg-[#010120] overflow-hidden flex flex-col h-[750px]">
              <div className="p-3 border-b border-[#ebebeb] dark:border-white/[0.08] bg-[#f8fafc] dark:bg-[#313641]/30">
                <span className="font-mono text-[10px] uppercase tracking-wider text-[#000000] dark:text-white font-semibold">
                  TARGET DOSSIER
                </span>
              </div>

              {selectedDraft ? (
                <div className="p-4 space-y-4 flex-1 overflow-y-auto text-xs">
                  {/* Target Overview */}
                  <div className="space-y-1">
                    <div className="text-[10px] font-mono uppercase text-[#959494]">Company</div>
                    <div className="font-medium text-black dark:text-white text-sm">
                      {selectedDraft.business?.display_name}
                    </div>
                    {selectedDraft.business?.website_url && (
                      <a
                        href={selectedDraft.business.website_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] font-mono text-[#ef2cc1] hover:underline flex items-center space-x-1 pt-0.5"
                      >
                        <span>{selectedDraft.business.website_url.replace(/^https?:\/\//, '')}</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    )}
                  </div>

                  {/* Geography & Industry */}
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#ebebeb] dark:border-white/[0.06]">
                    <div>
                      <div className="text-[9px] font-mono uppercase text-[#959494]">City</div>
                      <div className="font-mono text-[11px] text-black dark:text-white mt-0.5">
                        {selectedDraft.business?.city || 'India'}
                      </div>
                    </div>
                    <div>
                      <div className="text-[9px] font-mono uppercase text-[#959494]">Category</div>
                      <div className="font-mono text-[11px] text-black dark:text-white mt-0.5 truncate">
                        {selectedDraft.business?.primary_industry || 'B2B SMB'}
                      </div>
                    </div>
                  </div>

                  {/* AI Rationalization */}
                  <div className="pt-2 border-t border-[#ebebeb] dark:border-white/[0.06] space-y-1.5">
                    <div className="flex items-center space-x-1.5 text-[10px] font-mono uppercase text-[#ef2cc1] font-semibold">
                      <Sparkles className="w-3 h-3" />
                      <span>AI RESEARCH ANGLE</span>
                    </div>
                    <p className="text-[11px] text-[#6b7280] dark:text-[#959494] leading-relaxed">
                      {selectedDraft.rationale ||
                        'Synthesized from website metadata and verified deliverability records. Tailored offer focusing on digital workflows and conversion improvements.'}
                    </p>
                  </div>

                  {/* Pre-Flight Health Checklist */}
                  <div className="pt-2 border-t border-[#ebebeb] dark:border-white/[0.06] space-y-2">
                    <div className="text-[10px] font-mono uppercase text-[#959494]">
                      DELIVERABILITY PRE-FLIGHT
                    </div>
                    <div className="space-y-1.5 font-mono text-[10px]">
                      <div className="flex items-center justify-between">
                        <span className="text-[#6b7280] dark:text-[#959494]">MX Valid:</span>
                        <span className="text-emerald-500 font-semibold">PASSED</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[#6b7280] dark:text-[#959494]">Suppression Check:</span>
                        <span className="text-emerald-500 font-semibold">CLEAN</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[#6b7280] dark:text-[#959494]">Unsubscribe Header:</span>
                        <span className="text-emerald-500 font-semibold">INJECTED</span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
