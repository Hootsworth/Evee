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
    <div className="min-h-screen bg-white dark:bg-[#09090b] transition-colors duration-150">
      {/* Top Banner: Flat & Clean */}
      <section className="bg-[#f8fafc] dark:bg-[#121217] border-b border-[#e5e7eb] dark:border-[#27272a] px-6 py-10">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-light tracking-tight text-[#111827] dark:text-white">Workflow Governance</h1>
            <p className="text-sm text-[#6b7280] dark:text-[#a1a1aa] mt-1 max-w-xl font-light">
              Strict governance rules and pause controls for outbound prospecting pipelines.
            </p>
          </div>

          <button
            onClick={handleCreateDefaultWorkflow}
            disabled={actionLoading}
            className="mono-btn bg-[#f43f5e] hover:bg-[#e11d48] text-white px-5 py-2.5 rounded-full text-xs font-normal shadow-sm transition active:scale-95"
          >
            CREATE CONSERVATIVE PIPELINE
          </button>
        </div>
      </section>

      <main className="max-w-7xl mx-auto px-6 py-10">
        {loading ? (
          <div className="py-20 text-center font-mono text-sm text-[#9ca3af] dark:text-[#71717a]">Loading workflows...</div>
        ) : workflows.length === 0 ? (
          <div className="border border-[#e5e7eb] dark:border-[#27272a] rounded-xl p-16 text-center bg-[#f8fafc] dark:bg-[#121217]">
            <ShieldCheck className="w-12 h-12 text-[#9ca3af] dark:text-[#52525b] mx-auto mb-4" />
            <h3 className="text-lg font-light text-[#111827] dark:text-white mb-2">No active outreach workflows</h3>
            <p className="text-sm text-[#6b7280] dark:text-[#a1a1aa] max-w-md mx-auto mb-6 font-light">
              Create and approve a governance policy to enable draft queues and outbound dispatch gates.
            </p>
            <button
              onClick={handleCreateDefaultWorkflow}
              className="mono-btn bg-[#f43f5e] hover:bg-[#e11d48] text-white px-5 py-2.5 rounded-full text-xs font-normal shadow-sm"
            >
              CREATE CONSERVATIVE PIPELINE
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {workflows.map((wf) => {
              const isApproved = wf.status === 'approved';
              const isPaused = wf.status === 'paused';

              return (
                <div
                  key={wf.id}
                  className="border border-[#e5e7eb] dark:border-[#27272a] rounded-xl p-6 bg-white dark:bg-[#121217] shadow-sm transition"
                >
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-4">
                    <div>
                      <div className="flex items-center space-x-2.5 mb-1">
                        <h3 className="text-lg font-normal text-[#111827] dark:text-white">{wf.name}</h3>
                        <span
                          className={`mono-eyebrow text-xs px-3 py-0.5 rounded-full font-normal ${
                            isApproved
                              ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'
                              : isPaused
                              ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300'
                              : 'bg-[#f8fafc] dark:bg-[#18181b] text-[#111827] dark:text-white border border-[#e5e7eb] dark:border-[#27272a]'
                          }`}
                        >
                          {wf.status.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-xs text-[#6b7280] dark:text-[#a1a1aa] font-mono font-light">
                        Workflow ID: {wf.id}
                      </p>
                    </div>

                    <div className="flex items-center space-x-2">
                      {!isApproved && (
                        <button
                          onClick={() => handleApproveWorkflow(wf.id)}
                          disabled={actionLoading}
                          className="mono-btn bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-1.5 rounded-full text-xs font-normal flex items-center space-x-1.5 transition active:scale-95"
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                          <span>APPROVE POLICY</span>
                        </button>
                      )}

                      {!isPaused ? (
                        <button
                          onClick={() => handlePauseWorkflow(wf.id)}
                          disabled={actionLoading}
                          className="mono-btn bg-amber-500 hover:bg-amber-600 text-white px-4 py-1.5 rounded-full text-xs font-normal flex items-center space-x-1.5 transition active:scale-95"
                        >
                          <Pause className="w-3.5 h-3.5" />
                          <span>PAUSE</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => handleApproveWorkflow(wf.id)}
                          disabled={actionLoading}
                          className="mono-btn bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-1.5 rounded-full text-xs font-normal flex items-center space-x-1.5 transition active:scale-95"
                        >
                          <Play className="w-3.5 h-3.5" />
                          <span>RESUME</span>
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-[#f8fafc] dark:bg-[#18181b] rounded-xl text-xs font-mono text-[#374151] dark:text-[#d4d4d8]">
                    <div>
                      <span className="text-[#9ca3af] dark:text-[#71717a] block font-light">DAILY CAP</span>
                      <span className="font-normal text-[#111827] dark:text-white">{wf.configuration?.daily_limit || 5} sends/day</span>
                    </div>
                    <div>
                      <span className="text-[#9ca3af] dark:text-[#71717a] block font-light">MONTHLY TARGET</span>
                      <span className="font-normal text-[#111827] dark:text-white">{wf.configuration?.monthly_limit || 100} qualified</span>
                    </div>
                    <div>
                      <span className="text-[#9ca3af] dark:text-[#71717a] block font-light">FOLLOWUP CADENCE</span>
                      <span className="font-normal text-[#111827] dark:text-white">
                        {wf.configuration?.followup_intervals_days ? wf.configuration.followup_intervals_days.join(', ') + ' days' : 'None'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[#9ca3af] dark:text-[#71717a] block font-light">AUTO-DISPATCH</span>
                      <span className={`font-normal ${wf.configuration?.auto_send_enabled ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'}`}>
                        {wf.configuration?.auto_send_enabled ? 'ENABLED' : 'MANUAL APPROVAL ONLY'}
                      </span>
                    </div>
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
