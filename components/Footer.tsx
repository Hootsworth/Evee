import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="bg-white border-t border-black/[0.08] pt-16 pb-12 overflow-hidden">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-16">
          <div>
            <h4 className="mono-eyebrow text-black/40 mb-4">PLATFORM</h4>
            <ul className="space-y-2 text-sm text-black/70">
              <li><Link href="/campaigns" className="hover:text-black transition">Campaign Engine</Link></li>
              <li><Link href="/leads" className="hover:text-black transition">Lead Explorer</Link></li>
              <li><Link href="/drafts" className="hover:text-black transition">Draft Approvals</Link></li>
              <li><Link href="/outreach" className="hover:text-black transition">Controlled Sending</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="mono-eyebrow text-black/40 mb-4">COMPLIANCE & SAFETY</h4>
            <ul className="space-y-2 text-sm text-black/70">
              <li><Link href="/settings" className="hover:text-black transition">Global Suppression</Link></li>
              <li><Link href="/workflows" className="hover:text-black transition">Versioned Approvals</Link></li>
              <li><span className="text-black/50">DPDP Act (India) Readiness</span></li>
              <li><span className="text-black/50">SSRF Bounded Inspection</span></li>
            </ul>
          </div>
          <div>
            <h4 className="mono-eyebrow text-black/40 mb-4">PROVIDERS</h4>
            <ul className="space-y-2 text-sm text-black/70">
              <li><Link href="/settings" className="hover:text-black transition">Google Places Discovery</Link></li>
              <li><Link href="/settings" className="hover:text-black transition">Gmail REST API</Link></li>
              <li><Link href="/settings" className="hover:text-black transition">Structured LLM Inference</Link></li>
              <li><Link href="/settings" className="hover:text-black transition">Budget Ledger (₹0 Default)</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="mono-eyebrow text-black/40 mb-4">OPERATIONAL TARGET</h4>
            <p className="text-sm text-black/60 leading-relaxed mb-3">
              Calibrated to discover and qualify ~100 high-intent small business prospects per month with empirical proof before outreach.
            </p>
            <div className="mono-eyebrow text-[10px] text-black/40">EVEE ARCHITECTURE V2.0</div>
          </div>
        </div>

        {/* Massive Together-inspired Watermark Banner */}
        <div className="pt-8 border-t border-black/[0.06] select-none text-center">
          <div className="text-[72px] md:text-[120px] font-extrabold tracking-tighter text-black/[0.04] leading-none uppercase">
            evee.ai
          </div>
          <div className="text-xs text-black/40 mt-2 font-mono flex items-center justify-center space-x-2">
            <span>© 2026 EVEE</span>
            <span>•</span>
            <span>BUILT WITH NEXT.JS + SUPABASE + VERCEL</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
