'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { ShieldAlert, Zap, Globe, Mail, Sparkles, Sliders, FileText, CheckCircle2 } from 'lucide-react';

export default function NavBar() {
  const pathname = usePathname();
  const [metrics, setMetrics] = useState<any>(null);

  useEffect(() => {
    fetch('/api/reports/overview')
      .then((res) => res.json())
      .then((data) => setMetrics(data.metrics))
      .catch(() => {});
  }, [pathname]);

  const navItems = [
    { label: 'DASHBOARD', href: '/' },
    { label: 'CAMPAIGNS', href: '/campaigns' },
    { label: 'LEADS', href: '/leads' },
    {
      label: 'DRAFTS',
      href: '/drafts',
      badge: metrics?.pendingDrafts > 0 ? metrics.pendingDrafts : undefined,
    },
    { label: 'OUTREACH', href: '/outreach' },
    { label: 'WORKFLOWS', href: '/workflows' },
    { label: 'SETTINGS', href: '/settings' },
  ];

  return (
    <header className="sticky top-0 z-50 bg-[#010120] text-white border-b border-white/10 px-6 py-3.5">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Brand Wordmark & Gradient Ribbon Dot */}
        <div className="flex items-center space-x-8">
          <Link href="/" className="flex items-center space-x-2 group">
            <span className="font-bold tracking-tight text-xl text-white">EVEE</span>
            <span className="w-2.5 h-2.5 rounded-full brand-gradient inline-block shadow-sm"></span>
            <span className="mono-eyebrow text-[10px] text-white/50 tracking-widest pl-1">PROSPECTING</span>
          </Link>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center space-x-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`mono-btn text-xs px-3 py-1.5 rounded-[4px] transition-colors flex items-center space-x-1.5 ${
                    isActive
                      ? 'bg-white/15 text-white font-semibold'
                      : 'text-white/70 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <span>{item.label}</span>
                  {item.badge !== undefined && (
                    <span className="ml-1 px-1.5 py-0.2 bg-[#ef2cc1] text-white text-[10px] font-bold rounded-full">
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Global Safety & State Pill */}
        <div className="flex items-center space-x-3">
          <div className="hidden sm:flex items-center space-x-2 px-2.5 py-1 rounded-[4px] bg-white/5 border border-white/10">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="mono-eyebrow text-[10px] text-white/80">SAFETY: FAIL-CLOSED</span>
          </div>

          <Link
            href="/campaigns"
            className="mono-btn bg-[#c8f6f9] text-[#000000] hover:bg-[#aef0f5] px-3.5 py-1.5 rounded-[4px] text-xs transition"
          >
            + NEW CAMPAIGN
          </Link>
        </div>
      </div>
    </header>
  );
}
