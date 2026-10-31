'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import Logo from '@/components/Logo';
import { LogOut, Plus, Moon, Sun } from 'lucide-react';
import { useTheme } from '@/components/ThemeProvider';

export default function NavBar() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const { theme, toggleTheme } = useTheme();

  const [metrics, setMetrics] = useState<any>(null);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    fetch('/api/reports/overview')
      .then((res) => res.json())
      .then((data) => setMetrics(data.metrics))
      .catch(() => {});

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
    { label: 'SETTINGS', href: '/settings' },
  ];

  // Resolve user display name (fallback to email prefix or Operator)
  const displayName =
    user?.user_metadata?.display_name ||
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    (user?.email ? user.email.split('@')[0] : 'Operator');

  return (
    <header className="sticky top-0 z-50 bg-white/95 dark:bg-[#010120]/95 backdrop-blur-md border-b border-[#ebebeb] dark:border-white/[0.08] transition-colors duration-150">
      {/* 2px Signature Together AI Brand Gradient Ribbon */}
      <div className="brand-gradient-h w-full" />

      <div className="max-w-7xl mx-auto px-6 py-2.5 flex items-center justify-between">
        {/* Brand Logo & Clean Monospace Navigation */}
        <div className="flex items-center space-x-8">
          <Logo height={26} showSubtitle={false} />

          {/* Navigation Links with 4px border radius and mono caps */}
          <nav className="hidden md:flex items-center space-x-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`mono-btn text-[11px] px-3 py-1.5 rounded-[4px] transition-all flex items-center space-x-1.5 ${
                    isActive
                      ? 'bg-black dark:bg-white text-white dark:text-black font-semibold'
                      : 'text-[#6b7280] dark:text-[#959494] hover:text-[#000000] dark:hover:text-white hover:bg-[#f3f4f6] dark:hover:bg-white/[0.06]'
                  }`}
                >
                  <span>{item.label}</span>
                  {item.badge !== undefined && (
                    <span
                      className={`ml-1 px-1.5 py-0.5 text-[9px] font-mono font-bold rounded-[3px] ${
                        isActive
                          ? 'bg-[#ef2cc1] text-white'
                          : 'bg-black dark:bg-white text-white dark:text-black'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right Actions: Dark Mode Toggle, New Campaign, User Profile */}
        <div className="flex items-center space-x-3">
          {/* Dark / Light Mode Toggle Button */}
          <button
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            className="p-1.5 rounded-[4px] text-[#6b7280] dark:text-[#959494] hover:text-[#000000] dark:hover:text-white hover:bg-[#f3f4f6] dark:hover:bg-white/[0.08] transition border border-transparent hover:border-[#ebebeb] dark:hover:border-white/[0.08]"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? (
              <Sun className="w-3.5 h-3.5 text-amber-400" />
            ) : (
              <Moon className="w-3.5 h-3.5 text-[#374151]" />
            )}
          </button>

          {/* Primary CTA: Solid black pill in 4px radius as per DESIGN.md */}
          <Link
            href="/campaigns"
            className="mono-btn bg-black dark:bg-white hover:bg-neutral-800 dark:hover:bg-neutral-200 text-white dark:text-black px-3.5 py-1.5 rounded-[4px] text-[11px] font-semibold flex items-center space-x-1.5 transition active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>NEW CAMPAIGN</span>
          </Link>

          {user && (
            <div className="flex items-center space-x-2 pl-3 border-l border-[#ebebeb] dark:border-white/[0.08]">
              {/* User Avatar with 4px radius */}
              <div className="w-6 h-6 rounded-[4px] bg-[#313641] text-white flex items-center justify-center text-[10px] font-mono font-medium">
                {displayName.charAt(0).toUpperCase()}
              </div>

              {/* User Name */}
              <span className="mono-eyebrow text-[11px] text-[#374151] dark:text-[#e4e4e7] max-w-[120px] truncate hidden lg:inline font-normal capitalize">
                {displayName}
              </span>

              <button
                onClick={handleSignOut}
                title="Sign out"
                className="p-1.5 rounded-[4px] text-[#9ca3af] hover:text-[#000000] dark:hover:text-white hover:bg-[#f3f4f6] dark:hover:bg-white/[0.08] transition"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
