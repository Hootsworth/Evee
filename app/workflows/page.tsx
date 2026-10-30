'use client';

import { useState, useEffect } from 'react';
import { ShieldCheck, Pause, Play, CheckCircle, RefreshCw, AlertTriangle } from 'lucide-react';

export default function WorkflowsPage() {
  const [workflows, setWorkflows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchWorkflows = async () => {
    try {
      const res = await fetch('/api/workflows');
      const data = await res.json();
      setWorkflows(data.workflows || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkflows();
  }, []);

  const handleCreateDefaultWorkflow = async () => {
    setActionLoading(true);
    try {
      await fetch('/api/workflows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Conservative Small Business Pipeline',
          configuration: {
            daily_limit: 5,
            monthly_limit: 100,
            followup_intervals_days: [4, 9],
            require_manual_review_for_uncertain_evidence: true,
            require_contact_verification: true,
            auto_send_enabled: false,
          },
        }),
      });
      fetchWorkflows();
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleApproveWorkflow = async (workflowId: string) => {
    setActionLoading(true);
    try {
      await fetch(`/api/workflows/${workflowId}/approve`, { method: 'POST' });
      fetchWorkflows();
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  const handlePauseWorkflow = async (workflowId: string) => {
    setActionLoading(true);
    try {
      await fetch(`/api/workflows/${workflowId}/pause`, { method: 'POST' });
      fetchWorkflows();
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 pb-6 border-b border-black/[0.08]">
        <div>
          <div className="mono-eyebrow text-black/50 mb-1">POLICY & GOVERNANCE</div>
          <h1 className="text-3xl font-medium tracking-tight text-black">Outreach Workflows & Approvals</h1>
          <p className="text-sm text-black/60 mt-1">
            Version-controlled workflow specifications. Modifying policies invalidates previous approvals.
          </p>
        </div>

        {workflows.length === 0 && (
          <button
            onClick={handleCreateDefaultWorkflow}
            disabled={actionLoading}
            className="mono-btn bg-black text-white hover:bg-black/80 px-4 py-2.5 rounded-[4px] text-xs transition self-start sm:self-auto"
          >
            CREATE STANDARD WORKFLOW
          </button>
        )}
      </div>

      {loading ? (
        <div className="py-20 text-center font-mono text-sm text-black/40">Loading workflows...</div>
      ) : workflows.length === 0 ? (
        <div className="border border-black/[0.08] rounded-[4px] p-16 text-center bg-[#f9f9fa]">
          <ShieldCheck className="w-12 h-12 text-black/20 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-black mb-2">No active workflow specification</h3>
          <p className="text-sm text-black/60 max-w-md mx-auto mb-6">
            An approved outreach workflow is mandatory before any automated sending or queue processing can occur.
          </p>
          <button
            onClick={handleCreateDefaultWorkflow}
            className="mono-btn bg-black text-white hover:bg-black/80 px-4 py-2 rounded-[4px] text-xs"
          >
            CREATE STANDARD WORKFLOW
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {workflows.map((wf) => {
            const isApproved = wf.status === 'approved';
            const isPaused = wf.status === 'paused';

            return (
              <div key={wf.id} className="border border-black/[0.08] rounded-[4px] p-8 bg-white">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-black/[0.06]">
                  <div>
                    <div className="flex items-center space-x-3 mb-1">
                      <h3 className="text-xl font-medium text-black">{wf.name}</h3>
                      <span className="mono-eyebrow text-xs bg-black/5 text-black px-2 py-0.5 rounded-[4px]">
                        VERSION {wf.version}
                      </span>
                    </div>
                    <span className="text-xs font-mono text-black/50">
                      Created: {new Date(wf.created_at).toLocaleDateString()}
                    </span>
                  </div>

                  <div className="flex items-center space-x-3">
                    <span
                      className={`mono-eyebrow text-xs px-2.5 py-1 rounded-[4px] font-semibold ${
                        isApproved
                          ? 'bg-emerald-100 text-emerald-800'
                          : isPaused
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-black/5 text-black/60'
                      }`}
                    >
                      {wf.status.toUpperCase()}
                    </span>

                    {!isApproved && (
                      <button
                        onClick={() => handleApproveWorkflow(wf.id)}
                        disabled={actionLoading}
                        className="mono-btn bg-black text-white hover:bg-black/80 px-4 py-1.5 rounded-[4px] text-xs flex items-center space-x-1.5"
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        <span>APPROVE WORKFLOW</span>
                      </button>
                    )}

                    {isApproved && (
                      <button
                        onClick={() => handlePauseWorkflow(wf.id)}
                        disabled={actionLoading}
                        className="mono-btn bg-amber-600 text-white hover:bg-amber-700 px-4 py-1.5 rounded-[4px] text-xs flex items-center space-x-1.5"
                      >
                        <Pause className="w-3.5 h-3.5" />
                        <span>PAUSE PIPELINE</span>
                      </button>
                    )}

                    {isPaused && (
                      <button
                        onClick={() => handleApproveWorkflow(wf.id)}
                        disabled={actionLoading}
                        className="mono-btn bg-emerald-600 text-white hover:bg-emerald-700 px-4 py-1.5 rounded-[4px] text-xs flex items-center space-x-1.5"
                      >
                        <Play className="w-3.5 h-3.5" />
                        <span>RESUME PIPELINE</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Configuration Specs */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-mono">
                  <div className="p-4 bg-[#f9f9fa] border border-black/[0.04] rounded-[4px]">
                    <div className="text-black/50 mb-1">DAILY MAX SEND</div>
                    <div className="text-base font-semibold text-black">{wf.configuration?.daily_limit || 5} emails</div>
                  </div>
                  <div className="p-4 bg-[#f9f9fa] border border-black/[0.04] rounded-[4px]">
                    <div className="text-black/50 mb-1">MONTHLY MAX SEND</div>
                    <div className="text-base font-semibold text-black">{wf.configuration?.monthly_limit || 100} emails</div>
                  </div>
                  <div className="p-4 bg-[#f9f9fa] border border-black/[0.04] rounded-[4px]">
                    <div className="text-black/50 mb-1">FOLLOW-UPS</div>
                    <div className="text-base font-semibold text-black">{wf.configuration?.followup_intervals_days?.join(' & ') || 'Day 4 & 9'}</div>
                  </div>
                  <div className="p-4 bg-[#f9f9fa] border border-black/[0.04] rounded-[4px]">
                    <div className="text-black/50 mb-1">CONTACT VERIFICATION</div>
                    <div className="text-base font-semibold text-emerald-700">MANDATORY</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
