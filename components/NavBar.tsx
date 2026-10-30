'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import Logo from '@/components/Logo';
import { ShieldAlert, Zap, Globe, Mail, Sparkles, Sliders, FileText, CheckCircle2, User, LogOut } from 'lucide-react';

export default function NavBar() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  const [metrics, setMetrics] = useState<any>(null);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    // 1. Fetch metrics
    fetch('/api/reports/overview')
      .then((res) => res.json())
      .then((data) => setMetrics(data.metrics))
      .catch(() => {});

    // 2. Check session state
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [pathname]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    router.push('/auth');
    router.refresh();
  };

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
        {/* Brand Logo & Navigation */}
        <div className="flex items-center space-x-8">
          <Logo theme="dark" height={26} />

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

        {/* Global Safety & User State Pill */}
        <div className="flex items-center space-x-3">
          <div className="hidden sm:flex items-center space-x-2 px-2.5 py-1 rounded-[4px] bg-white/5 border border-white/10">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="mono-eyebrow text-[10px] text-white/80">FAIL-CLOSED</span>
          </div>

          {user ? (
            <div className="flex items-center space-x-2">
              <span className="mono-eyebrow text-[11px] text-white/70 max-w-[140px] truncate hidden lg:inline">
                {user.email}
              </span>
              <button
                onClick={handleSignOut}
                title="Sign out"
                className="mono-btn bg-white/10 hover:bg-white/20 text-white/80 hover:text-white p-1.5 rounded-[4px] transition"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <Link
              href="/auth"
              className="mono-btn bg-white text-black hover:bg-white/90 px-3.5 py-1.5 rounded-[4px] text-xs transition flex items-center space-x-1.5"
            >
              <User className="w-3.5 h-3.5" />
              <span>SIGN IN</span>
            </Link>
          )}

          <Link
            href="/campaigns"
            className="mono-btn bg-[#c8f6f9] text-[#000000] hover:bg-[#aef0f5] px-3.5 py-1.5 rounded-[4px] text-xs transition hidden sm:inline-block"
          >
            + NEW CAMPAIGN
          </Link>
        </div>
      </div>
    </header>
  );
}
