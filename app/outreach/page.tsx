'use client';

import { useState, useEffect } from 'react';
import { Send, AlertTriangle, ShieldCheck, RefreshCw, Pause, Play, CheckCircle } from 'lucide-react';

export default function OutreachPage() {
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchOutreach = async () => {
    try {
      const adminRes = await fetch('/api/reports/overview');
      // In full implementation, outreach messages are retrieved
      setLoading(false);
    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOutreach();
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 pb-6 border-b border-black/[0.08]">
        <div>
          <div className="mono-eyebrow text-black/50 mb-1">CONTROLLED OUTBOUND PIPELINE</div>
          <h1 className="text-3xl font-medium tracking-tight text-black">Outreach Dispatch & Tracking</h1>
          <p className="text-sm text-black/60 mt-1">
            Real-time status of approved message dispatches, follow-up timers, and delivery states.
          </p>
        </div>
      </div>

      {/* Safety Guardrails Card */}
      <div className="bg-[#f9f9fa] border border-black/[0.08] rounded-[4px] p-6 mb-8">
        <h3 className="mono-eyebrow text-black/50 mb-3">DISPATCH SAFEGUARDS IN FORCE</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono text-black/70">
          <div className="p-3 bg-white border border-black/[0.06] rounded-[4px]">
            <span className="text-black/40 block mb-1">DAILY SEND LIMIT</span>
            <span className="text-base font-semibold text-black">5 messages / day</span>
          </div>
          <div className="p-3 bg-white border border-black/[0.06] rounded-[4px]">
            <span className="text-black/40 block mb-1">FOLLOW-UP CADENCE</span>
            <span className="text-base font-semibold text-black">Day 4 & Day 9</span>
          </div>
          <div className="p-3 bg-white border border-black/[0.06] rounded-[4px]">
            <span className="text-black/40 block mb-1">PRE-DISPATCH CHECK</span>
            <span className="text-base font-semibold text-emerald-700">Suppression + Idempotency</span>
          </div>
        </div>
      </div>

      <div className="border border-black/[0.08] rounded-[4px] p-12 text-center bg-white">
        <Send className="w-10 h-10 text-black/20 mx-auto mb-3" />
        <h3 className="text-base font-medium text-black mb-1">No Active Dispatches in Transit</h3>
        <p className="text-xs text-black/60 max-w-md mx-auto mb-4 font-mono">
          Approved drafts queued from the Drafts tab will appear here with idempotency keys, delivery outcomes, and automated follow-up schedules.
        </p>
      </div>
    </div>
  );
}
