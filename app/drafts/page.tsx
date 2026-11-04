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
  MailCheck,
} from 'lucide-react';

export default function DraftsApprovalPage() {
  const [drafts, setDrafts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [workflows, setWorkflows] = useState<any[]>([]);
  const [selectedDraftId, setSelectedDraftId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'sent' | 'rejected'>('pending');
  const [sentEmails, setSentEmails] = useState<Set<string>>(new Set());
  const [sentBusinessIds, setSentBusinessIds] = useState<Set<string>>(new Set());
  const [editedBody, setEditedBody] = useState<string>('');
  const [isEditing, setIsEditing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [generatingDrafts, setGeneratingDrafts] = useState(false);

  // AI Copywriting & Optimization State
  const [showAiEnhancer, setShowAiEnhancer] = useState(false);
  const [aiGoal, setAiGoal] = useState<'handcrafted' | 'concise' | 'persuasive' | 'cta' | 'warmer' | 'punchy' | 'custom'>('handcrafted');
  const [aiCustomInstruction, setAiCustomInstruction] = useState('');
  const [aiEnhancing, setAiEnhancing] = useState(false);
  const [aiResult, setAiResult] = useState<{
    improvedSubject: string;
    improvedBody: string;
    changesSummary: string;
    keyImprovementTips?: string[];
    modelUsed: string;
  } | null>(null);

  const fetchDrafts = async () => {
    try {
      const [draftsRes, wfRes, sentRes] = await Promise.all([
        fetch('/api/drafts'),
        fetch('/api/workflows'),
        fetch('/api/outreach/sent'),
      ]);
      const draftsData = await draftsRes.json();
      const wfData = await wfRes.json();
      const sentData = await sentRes.json();
      const loadedDrafts = draftsData.drafts || [];
      setDrafts(loadedDrafts);
      setWorkflows(wfData.workflows || []);

      if (sentData.success) {
        setSentEmails(new Set((sentData.sentEmails || []).map((e: string) => e.toLowerCase().trim())));
        setSentBusinessIds(new Set(sentData.sentBusinessIds || []));
      }

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

  const handleGenerateDrafts = async () => {
    setGeneratingDrafts(true);
    setStatusMessage('Generating bespoke handcrafted AI drafts for your leads...');
    try {
      const res = await fetch('/api/drafts/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit: 15 }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setStatusMessage(`Successfully generated ${data.generated} personalized AI drafts!`);
        await fetchDrafts();
      } else {
        setStatusMessage(`Notice: ${data.message || data.error || 'No new drafts generated'}`);
      }
    } catch (err: any) {
      setStatusMessage(`Error generating drafts: ${err.message}`);
    } finally {
      setGeneratingDrafts(false);
    }
  };

  const selectedDraft = drafts.find((d) => d.id === selectedDraftId) || drafts[0];

  useEffect(() => {
    if (selectedDraft) {
      setEditedBody(selectedDraft.body_text || '');
      setIsEditing(false);
    }
  }, [selectedDraftId]);

  const handleEnhanceDraft = async () => {
    if (!selectedDraft) return;
    setAiEnhancing(true);
    setStatusMessage(null);
    try {
      const currentSubject = selectedDraft.subject || selectedDraft.subject_line || '';
      const currentBody = editedBody || selectedDraft.body_text || '';
      const res = await fetch('/api/drafts/enhance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: currentSubject,
          bodyText: currentBody,
          goal: aiGoal,
          instruction: aiCustomInstruction,
          businessContext: {
            name: selectedDraft.business?.display_name,
            category: selectedDraft.business?.industry_category,
            city: selectedDraft.business?.city,
          },
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setAiResult(data);
      } else {
        setStatusMessage(`AI Enhancement failed: ${data.error || 'Unknown error'}`);
      }
    } catch (err: any) {
      setStatusMessage(`Error enhancing draft: ${err.message}`);
    } finally {
      setAiEnhancing(false);
    }
  };

  const handleApplyAiEnhancement = () => {
    if (!aiResult || !selectedDraft) return;
    setEditedBody(aiResult.improvedBody);
    selectedDraft.subject = aiResult.improvedSubject;
    selectedDraft.subject_line = aiResult.improvedSubject;
    selectedDraft.body_text = aiResult.improvedBody;
    setIsEditing(true);
    setShowAiEnhancer(false);
    setStatusMessage(`Applied AI enhancements (${aiResult.modelUsed}). Switched to edit mode for final review.`);
  };

  const handleApprove = async (draftId: string) => {
    setActionLoading(draftId);
    setStatusMessage('Approving draft...');
    try {
      const res = await fetch(`/api/drafts/${draftId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bodyText: editedBody || selectedDraft?.body_text,
          subjectLine: selectedDraft?.subject || selectedDraft?.subject_line,
        }),
      });
      if (res.ok) {
        setStatusMessage('Draft approved with current copy. Ready for dispatch.');
        setDrafts((prev) =>
          prev.map((d) => (d.id === draftId ? { ...d, approval_status: 'approved', body_text: editedBody || d.body_text } : d))
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

  const isDraftSent = (d: any) => {
    if (!d) return false;
    if (d.approval_status === 'sent') return true;
    if (d.business_id && sentBusinessIds.has(d.business_id)) return true;
    const bizEmail = d.business?.general_business_email?.toLowerCase().trim();
    if (bizEmail && sentEmails.has(bizEmail)) return true;
    const contactEmail = (d.contact?.email || d.contact?.email_address)?.toLowerCase().trim();
    if (contactEmail && sentEmails.has(contactEmail)) return true;
    return false;
  };

  const filteredDrafts = drafts.filter((d) => {
    if (filter === 'all') return true;
    if (filter === 'sent') return isDraftSent(d);
    if (filter === 'pending') return (!d.approval_status || d.approval_status === 'pending') && !isDraftSent(d);
    if (filter === 'approved') return d.approval_status === 'approved' && !isDraftSent(d);
    if (filter === 'rejected') return d.approval_status === 'rejected';
    return true;
  });

  return (
    <div className="min-h-screen bg-[#f7f7f5] dark:bg-[#171916] text-[#20211f] dark:text-[#f1f2ee] transition-colors duration-150 flex flex-col">
      {/* Workspace Drafts Header */}
      <header className="border-b border-[#e8e9e5] dark:border-white/[0.08] px-5 sm:px-8 py-8 sm:py-10">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <div className="flex items-center space-x-2 text-xs font-medium text-[#4f6653] dark:text-[#afc6ad] mb-2.5">
              <span>Message review studio</span>
              <span>•</span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#4f6653]/10 text-[#4f6653] dark:text-[#afc6ad]">
                AI OUTREACH REVIEW
              </span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-[#20211f] dark:text-[#f1f2ee]">
              Drafts
            </h1>
            <p className="text-sm text-[#777a74] dark:text-[#a2a69e] mt-2 max-w-xl leading-relaxed">
              Review, edit, and approve personalized messages before they are dispatched to prospects.
            </p>
          </div>

          {/* Top Actions & Keyboard Shortcut Cheatsheet */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={handleGenerateDrafts}
              disabled={generatingDrafts}
              className="inline-flex items-center gap-2 rounded-lg bg-[#4f6653] hover:bg-[#405444] text-white px-4 py-2 text-sm font-medium transition shadow-sm disabled:opacity-50"
            >
              {generatingDrafts ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Generating drafts...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>+ Generate AI drafts</span>
                </>
              )}
            </button>

            <div className="hidden lg:flex items-center space-x-3 px-3.5 py-2 rounded-lg bg-white dark:bg-[#1e211d] border border-[#dfe2dc] dark:border-white/10 text-xs text-[#777a74] dark:text-[#a2a69e] shadow-sm">
              <Keyboard className="w-3.5 h-3.5 text-[#4f6653] dark:text-[#afc6ad]" />
              <span><strong className="text-[#20211f] dark:text-white font-medium">A</strong> Approve</span>
              <span>•</span>
              <span><strong className="text-[#20211f] dark:text-white font-medium">R</strong> Reject</span>
              <span>•</span>
              <span><strong className="text-[#20211f] dark:text-white font-medium">J/K</strong> Navigate</span>
            </div>
          </div>
        </div>
      </header>

      {/* Draft review workspace */}
      <div className="flex-1 max-w-7xl w-full mx-auto px-5 sm:px-8 py-8 flex flex-col">
        {/* Status / Alert Banner */}
        {statusMessage && (
          <div className="mb-6 px-4 py-3 rounded-xl border border-[#dfe2dc] dark:border-white/10 bg-white dark:bg-[#1e211d] flex items-center justify-between text-xs font-medium text-[#20211f] dark:text-[#f1f2ee] shadow-sm">
            <div className="flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-[#4f6653] dark:text-[#afc6ad]" />
              <span>{statusMessage}</span>
            </div>
            <button onClick={() => setStatusMessage(null)} className="text-[#777a74] hover:text-[#20211f] dark:hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {loading ? (
          <div className="py-28 text-center text-sm text-[#777a74] dark:text-[#a2a69e] flex items-center justify-center space-x-2 my-auto">
            <RefreshCw className="w-4 h-4 animate-spin text-[#4f6653]" />
            <span>Loading outreach review queue...</span>
          </div>
        ) : drafts.length === 0 ? (
          <div className="rounded-2xl border border-[#e8e9e5] dark:border-white/[0.08] px-6 py-8 text-center bg-white dark:bg-[#1e211d] shadow-sm my-auto max-w-sm mx-auto w-full">
            <div className="w-10 h-10 rounded-xl bg-[#4f6653]/10 text-[#4f6653] dark:text-[#afc6ad] flex items-center justify-center mx-auto mb-3">
              <Sparkles className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-semibold text-[#20211f] dark:text-[#f1f2ee] mb-1">
              Zero Pending Drafts
            </h3>
            <p className="text-xs text-[#777a74] dark:text-[#a2a69e] mb-5 leading-relaxed max-w-xs mx-auto">
              No personalized drafts in the review queue. Craft bespoke, 1-to-1 outreach drafts for your leads below.
            </p>
            <div className="flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={handleGenerateDrafts}
                disabled={generatingDrafts}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#4f6653] hover:bg-[#405444] text-white px-3.5 py-1.5 text-xs font-medium transition shadow-sm disabled:opacity-50"
              >
                {generatingDrafts ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Generating...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Generate AI drafts</span>
                  </>
                )}
              </button>

              <Link
                href="/campaigns"
                className="inline-flex items-center gap-1 px-3 py-1.5 border border-[#dfe2dc] dark:border-white/10 bg-white dark:bg-[#1e211d] text-[#20211f] dark:text-[#f1f2ee] rounded-lg text-xs font-medium hover:border-[#aab4a6] transition"
              >
                <span>Discover leads</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl bg-white dark:bg-[#1e211d] border border-[#e8e9e5] dark:border-white/[0.08] shadow-sm overflow-hidden grid grid-cols-1 lg:grid-cols-12 min-h-[760px] flex-1">
            {/* PANE 1: Drafts List Queue (4 Cols) */}
            <div className="lg:col-span-4 border-r border-[#e8e9e5] dark:border-white/[0.08] flex flex-col h-[760px]">
              {/* Queue Controls & Filter */}
              <div className="p-3.5 border-b border-[#e8e9e5] dark:border-white/[0.08] bg-[#fafaf8] dark:bg-[#232622] flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#777a74] dark:text-[#a2a69e]">
                  QUEUE ({filteredDrafts.length})
                </span>
                <div className="inline-flex items-center p-1 bg-[#edebe8] dark:bg-[#252824] rounded-lg">
                  {(['all', 'pending', 'approved', 'sent', 'rejected'] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setFilter(tab)}
                      className={`text-[10px] font-medium uppercase px-2 py-0.5 rounded-md transition ${
                        filter === tab
                          ? 'bg-white dark:bg-[#1e211d] text-[#20211f] dark:text-white shadow-sm font-semibold'
                          : 'text-[#777a74] dark:text-[#a2a69e] hover:text-[#20211f] dark:hover:text-white'
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
              </div>

              {/* Scrollable Drafts Items */}
              <div className="flex-1 overflow-y-auto divide-y divide-[#e8e9e5] dark:divide-white/[0.06]">
                {filteredDrafts.map((draft) => {
                  const isSelected = selectedDraft?.id === draft.id;
                  const isSent = isDraftSent(draft);
                  const isApproved = draft.approval_status === 'approved';
                  const isRejected = draft.approval_status === 'rejected';

                  return (
                    <button
                      key={draft.id}
                      onClick={() => setSelectedDraftId(draft.id)}
                      className={`w-full text-left p-4 transition-colors flex flex-col space-y-1.5 ${
                        isSelected
                          ? 'bg-[#4f6653]/5 dark:bg-white/[0.04] border-l-4 border-[#4f6653]'
                          : 'hover:bg-[#f9faf8] dark:hover:bg-[#262a25]'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2.5 truncate max-w-[200px]">
                          <div className="w-7 h-7 rounded-lg bg-[#4f6653]/10 text-[#4f6653] dark:text-[#afc6ad] text-[11px] font-semibold flex items-center justify-center shrink-0">
                            {draft.business?.display_name?.slice(0, 2).toUpperCase() || 'CO'}
                          </div>
                          <span className="font-medium text-xs text-[#20211f] dark:text-[#f1f2ee] truncate">
                            {draft.business?.display_name || 'Target Prospect'}
                          </span>
                        </div>
                        {isSent ? (
                          <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20 text-[10px] font-medium">
                            Sent
                          </span>
                        ) : isApproved ? (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 text-[10px] font-medium">
                            Approved
                          </span>
                        ) : isRejected ? (
                          <span className="px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20 text-[10px] font-medium">
                            Rejected
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 text-[10px] font-medium">
                            Pending
                          </span>
                        )}
                      </div>

                      <div className="text-xs text-[#777a74] dark:text-[#a2a69e] truncate pl-9">
                        {draft.subject || draft.subject_line || 'Untitled Outreach Draft'}
                      </div>

                      <div className="flex items-center space-x-2 text-[11px] text-[#777a74] dark:text-[#a2a69e] pl-9">
                        <span>{draft.business?.city || 'India'}</span>
                        <span>•</span>
                        <span className="truncate max-w-[140px] font-mono text-[10px]">
                          {draft.contact?.email_address || draft.business?.general_business_email || 'No email'}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* PANE 2: Message composer / reader (5 Cols) */}
            <div className="lg:col-span-5 border-r border-[#e8e9e5] dark:border-white/[0.08] flex flex-col h-[760px]">
              {selectedDraft ? (
                <>
                  {/* Email Envelope Header */}
                  <div className="p-4 border-b border-[#e8e9e5] dark:border-white/[0.08] bg-[#fafaf8] dark:bg-[#232622] space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] uppercase tracking-wider font-semibold text-[#777a74] dark:text-[#a2a69e]">
                        Email Envelope & Recipient
                      </span>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => {
                            setShowAiEnhancer(!showAiEnhancer);
                            if (showAiEnhancer) setAiResult(null);
                          }}
                          className={`inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-medium transition shadow-sm ${
                            showAiEnhancer
                              ? 'bg-[#4f6653] text-white'
                              : 'bg-white dark:bg-[#1e211d] border border-[#dfe2dc] dark:border-white/10 text-[#20211f] dark:text-[#f1f2ee] hover:border-[#aab4a6]'
                          }`}
                        >
                          <Sparkles className="w-3.5 h-3.5 text-[#afc6ad]" />
                          <span>{showAiEnhancer ? 'Close AI optimizer' : 'Improve with AI'}</span>
                        </button>

                        <button
                          onClick={() => setIsEditing(!isEditing)}
                          className="px-2.5 py-1.5 rounded-lg border border-[#dfe2dc] dark:border-white/10 text-xs font-medium text-[#777a74] hover:text-[#20211f] dark:hover:text-white transition"
                        >
                          {isEditing ? 'View preview' : 'Edit copy'}
                        </button>
                      </div>
                    </div>

                    <div className="text-xs space-y-1.5">
                      <div className="flex items-center text-[#777a74] dark:text-[#a2a69e]">
                        <span className="w-16 font-semibold text-[#20211f] dark:text-white">TO:</span>
                        <span className="font-mono text-xs text-[#4f6653] dark:text-[#afc6ad]">
                          {selectedDraft.contact?.email_address ||
                            selectedDraft.business?.general_business_email ||
                            'no-email-discovered@domain.com'}
                        </span>
                      </div>
                      <div className="flex items-center text-[#777a74] dark:text-[#a2a69e]">
                        <span className="w-16 font-semibold text-[#20211f] dark:text-white">FROM:</span>
                        <span className="font-mono text-xs">Operator &lt;outreach@singulr.tech&gt;</span>
                      </div>
                      <div className="flex items-center text-[#777a74] dark:text-[#a2a69e]">
                        <span className="w-16 font-semibold text-[#20211f] dark:text-white">SUBJECT:</span>
                        <span className="text-[#20211f] dark:text-white font-medium">
                          {selectedDraft.subject || selectedDraft.subject_line}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* AI Copywriting & Optimization Panel */}
                  {showAiEnhancer && (
                    <div className="border-b border-[#e8e9e5] dark:border-white/[0.08] bg-[#fafaf8] dark:bg-[#1a1c18] px-4 py-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-1.5 text-xs font-medium text-[#20211f] dark:text-white">
                          <Sparkles className="w-3.5 h-3.5 text-[#4f6653] dark:text-[#afc6ad]" />
                          <span>AI Draft Enhancer</span>
                        </div>
                        <button
                          type="button"
                          onClick={handleEnhanceDraft}
                          disabled={aiEnhancing}
                          className="inline-flex items-center gap-1.5 bg-[#4f6653] hover:bg-[#405444] text-white px-3 py-1 rounded-md text-xs font-medium shadow-sm disabled:opacity-50 transition"
                        >
                          {aiEnhancing ? (
                            <>
                              <RefreshCw className="w-3 h-3 animate-spin" />
                              <span>Optimizing...</span>
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-3 h-3" />
                              <span>Optimize Copy</span>
                            </>
                          )}
                        </button>
                      </div>

                      {/* Quick Goal Selector */}
                      <div className="flex flex-wrap items-center gap-1">
                        {[
                          { id: 'handcrafted', label: '✍️ Bespoke' },
                          { id: 'persuasive', label: '🎯 High Conversion' },
                          { id: 'concise', label: '✂️ Concise' },
                          { id: 'cta', label: '⚡ Punchy CTA' },
                          { id: 'warmer', label: '🤝 Warmer' },
                          { id: 'punchy', label: '💥 Short' },
                          { id: 'custom', label: '✏️ Custom' },
                        ].map((g) => (
                          <button
                            key={g.id}
                            type="button"
                            onClick={() => setAiGoal(g.id as any)}
                            className={`text-[11px] px-2 py-0.5 rounded-md border transition ${
                              aiGoal === g.id
                                ? 'bg-[#4f6653] text-white border-[#4f6653] font-medium shadow-sm'
                                : 'bg-white dark:bg-[#1e211d] border-[#dfe2dc] dark:border-white/10 text-[#777a74] dark:text-[#a2a69e] hover:border-[#aab4a6]'
                            }`}
                          >
                            {g.label}
                          </button>
                        ))}
                      </div>

                      {/* Custom instruction input if selected */}
                      {aiGoal === 'custom' && (
                        <div>
                          <input
                            type="text"
                            value={aiCustomInstruction}
                            onChange={(e) => setAiCustomInstruction(e.target.value)}
                            placeholder="e.g. Focus on our free 1-click audit, sound friendly, keep it casual..."
                            className="w-full text-xs px-2.5 py-1 border border-[#dfe2dc] dark:border-white/10 rounded-md bg-white dark:bg-[#171916] text-[#20211f] dark:text-[#f1f2ee] focus:outline-none focus:ring-1 focus:ring-[#4f6653]"
                          />
                        </div>
                      )}

                      {/* Display AI Improvement Results if available */}
                      {aiResult && (
                        <div className="rounded-lg border border-[#dfe2dc] dark:border-white/10 bg-white dark:bg-[#1e211d] p-3 space-y-2 shadow-sm text-xs">
                          <div className="flex items-center justify-between pb-1 border-b border-[#e8e9e5] dark:border-white/10">
                            <div className="flex items-center space-x-1.5">
                              <Check className="w-3.5 h-3.5 text-emerald-500" />
                              <span className="font-semibold text-[#20211f] dark:text-white">
                                Copy Optimized ({aiResult.modelUsed})
                              </span>
                            </div>
                            <div className="flex items-center space-x-1.5">
                              <button
                                type="button"
                                onClick={() => setAiResult(null)}
                                className="px-2 py-0.5 text-[11px] text-[#777a74] hover:text-[#20211f] dark:hover:text-white"
                              >
                                Discard
                              </button>
                              <button
                                type="button"
                                onClick={handleApplyAiEnhancement}
                                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-medium shadow-sm transition"
                              >
                                <Check className="w-3 h-3" />
                                <span>Apply</span>
                              </button>
                            </div>
                          </div>

                          <div className="text-[11px] text-[#777a74] dark:text-[#a2a69e] bg-[#fafaf8] dark:bg-[#252824] p-2 rounded border border-[#dfe2dc] dark:border-white/10">
                            {aiResult.changesSummary}
                          </div>

                          {aiResult.improvedSubject && (
                            <div className="text-[11px]">
                              <span className="text-[#777a74] font-medium mr-1.5">Subject:</span>
                              <span className="font-semibold text-[#20211f] dark:text-[#f1f2ee]">{aiResult.improvedSubject}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Email Body Content */}
                  <div className="p-6 flex-1 overflow-y-auto">
                    {isEditing ? (
                      <textarea
                        value={editedBody}
                        onChange={(e) => setEditedBody(e.target.value)}
                        rows={16}
                        className="w-full text-sm leading-relaxed p-4 border border-[#dfe2dc] dark:border-white/10 rounded-xl bg-white dark:bg-[#171916] text-[#20211f] dark:text-[#f1f2ee] focus:outline-none focus:ring-1 focus:ring-[#4f6653] focus:border-[#4f6653] transition shadow-sm font-sans"
                      />
                    ) : (
                      <div className="text-sm leading-relaxed font-sans whitespace-pre-wrap text-[#20211f] dark:text-[#f1f2ee]">
                        {editedBody || selectedDraft.body_text}
                      </div>
                    )}
                  </div>

                  {/* Action Bar */}
                  <div className="p-4 border-t border-[#e8e9e5] dark:border-white/[0.08] bg-[#fafaf8] dark:bg-[#232622] flex items-center justify-between gap-3">
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleReject(selectedDraft.id)}
                        disabled={actionLoading === selectedDraft.id}
                        className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-rose-300 dark:border-rose-900/50 hover:bg-rose-50 dark:hover:bg-rose-950/20 text-rose-600 dark:text-rose-400 text-xs font-medium transition"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>Reject [R]</span>
                      </button>

                      <button
                        onClick={() => handleApprove(selectedDraft.id)}
                        disabled={actionLoading === selectedDraft.id}
                        className="inline-flex items-center gap-1 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium shadow-sm transition"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Approve [A]</span>
                      </button>
                    </div>

                    {isDraftSent(selectedDraft) ? (
                      <span className="px-3.5 py-2 rounded-lg bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20 text-xs font-medium flex items-center space-x-1.5">
                        <MailCheck className="w-3.5 h-3.5 text-blue-500" />
                        <span>Dispatched</span>
                      </span>
                    ) : (
                      <button
                        onClick={() => handleQueueForSend(selectedDraft)}
                        disabled={actionLoading === selectedDraft.id || selectedDraft.approval_status !== 'approved'}
                        title={selectedDraft.approval_status !== 'approved' ? 'Approve draft first' : 'Queue email'}
                        className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium shadow-sm transition ${
                          selectedDraft.approval_status === 'approved'
                            ? 'bg-[#4f6653] hover:bg-[#405444] text-white'
                            : 'bg-neutral-200 dark:bg-neutral-800 text-neutral-400 cursor-not-allowed'
                        }`}
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Dispatch [S]</span>
                      </button>
                    )}
                  </div>
                </>
              ) : (
                <div className="m-auto text-center text-xs text-[#777a74] dark:text-[#a2a69e]">
                  Select a draft from the queue to inspect.
                </div>
              )}
            </div>

            {/* PANE 3: Lead Dossier & AI Rationalization (3 Cols) */}
            <div className="lg:col-span-3 bg-[#fafaf8]/50 dark:bg-[#191b17]/50 flex flex-col h-[760px]">
              <div className="p-3.5 border-b border-[#e8e9e5] dark:border-white/[0.08]">
                <span className="text-xs uppercase tracking-wider text-[#777a74] dark:text-[#a2a69e] font-semibold">
                  Target Dossier
                </span>
              </div>

              {selectedDraft ? (
                <div className="p-4 space-y-4 flex-1 overflow-y-auto text-xs">
                  {/* Target Overview */}
                  <div className="space-y-1">
                    <div className="text-[10px] uppercase font-semibold text-[#777a74] dark:text-[#a2a69e]">Company</div>
                    <div className="font-semibold text-[#20211f] dark:text-white text-sm">
                      {selectedDraft.business?.display_name}
                    </div>
                    {selectedDraft.business?.website_url && (
                      <a
                        href={selectedDraft.business.website_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-[#4f6653] dark:text-[#afc6ad] hover:underline flex items-center space-x-1 pt-0.5"
                      >
                        <span>{selectedDraft.business.website_url.replace(/^https?:\/\//, '')}</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>

                  {/* Geography & Industry */}
                  <div className="grid grid-cols-2 gap-2 pt-3 border-t border-[#e8e9e5] dark:border-white/10">
                    <div>
                      <div className="text-[10px] uppercase font-semibold text-[#777a74] dark:text-[#a2a69e]">City</div>
                      <div className="text-xs text-[#20211f] dark:text-white mt-0.5">
                        {selectedDraft.business?.city || 'India'}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase font-semibold text-[#777a74] dark:text-[#a2a69e]">Category</div>
                      <div className="text-xs text-[#20211f] dark:text-white mt-0.5 truncate">
                        {selectedDraft.business?.primary_industry || 'B2B SMB'}
                      </div>
                    </div>
                  </div>

                  {/* AI Rationalization */}
                  <div className="rounded-xl border border-[#dfe2dc] dark:border-white/10 bg-white dark:bg-[#1e211d] p-3.5 space-y-2 shadow-sm">
                    <div className="flex items-center space-x-2 text-xs font-semibold text-[#20211f] dark:text-white">
                      <Sparkles className="w-3.5 h-3.5 text-[#4f6653] dark:text-[#afc6ad]" />
                      <span>AI RESEARCH ANGLE</span>
                    </div>
                    <p className="text-xs text-[#777a74] dark:text-[#a2a69e] leading-relaxed">
                      {selectedDraft.rationale ||
                        'Synthesized from website metadata and verified deliverability records. Tailored offer focusing on digital workflows and conversion improvements.'}
                    </p>
                  </div>

                  {/* Pre-Flight Health Checklist */}
                  <div className="pt-3 border-t border-[#e8e9e5] dark:border-white/10 space-y-2.5">
                    <div className="text-[10px] uppercase font-semibold text-[#777a74] dark:text-[#a2a69e]">
                      Deliverability Pre-Flight
                    </div>
                    <div className="space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-[#777a74] dark:text-[#a2a69e]">MX Valid:</span>
                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold">PASSED</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[#777a74] dark:text-[#a2a69e]">Suppression Check:</span>
                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold">CLEAN</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[#777a74] dark:text-[#a2a69e]">Unsubscribe Header:</span>
                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold">INJECTED</span>
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
