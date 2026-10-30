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
    <header className="sticky top-0 z-50 bg-white dark:bg-[#09090b] border-b border-[#e5e7eb] dark:border-[#27272a] px-6 py-3 transition-colors duration-150">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Brand Logo & Clean Flat Navigation */}
        <div className="flex items-center space-x-10">
          <Logo height={28} showSubtitle={false} />

          {/* Clean Flat Navigation Links */}
          <nav className="hidden md:flex items-center space-x-1.5">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`mono-btn text-xs px-3.5 py-1.5 rounded-full transition-all flex items-center space-x-1.5 ${
                    isActive
                      ? 'bg-[#f43f5e] text-white font-medium shadow-sm'
                      : 'text-[#4b5563] dark:text-[#a1a1aa] hover:text-[#111827] dark:hover:text-white hover:bg-[#f3f4f6] dark:hover:bg-[#18181b]'
                  }`}
                >
                  <span>{item.label}</span>
                  {item.badge !== undefined && (
                    <span
                      className={`ml-1 px-1.5 py-0.2 text-[10px] font-medium rounded-full ${
                        isActive
                          ? 'bg-white text-[#f43f5e]'
                          : 'bg-[#f43f5e] text-white'
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

        {/* Right Actions: Dark Mode Toggle, User Name, New Campaign */}
        <div className="flex items-center space-x-3">
          {/* Dark / Light Mode Toggle Button */}
          <button
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            className="p-1.5 rounded-full text-[#6b7280] dark:text-[#a1a1aa] hover:text-[#111827] dark:hover:text-white hover:bg-[#f3f4f6] dark:hover:bg-[#18181b] transition"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4" />
            )}
          </button>

          <Link
            href="/campaigns"
            className="mono-btn bg-[#f43f5e] hover:bg-[#e11d48] text-white px-4 py-1.5 rounded-full text-xs font-medium flex items-center space-x-1.5 shadow-sm transition active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>NEW CAMPAIGN</span>
          </Link>

          {user && (
            <div className="flex items-center space-x-2.5 pl-3 border-l border-[#e5e7eb] dark:border-[#27272a]">
              {/* Initials circle */}
              <div className="w-6 h-6 rounded-full bg-[#f43f5e]/10 dark:bg-[#f43f5e]/20 text-[#f43f5e] flex items-center justify-center text-[10px] font-mono font-medium">
                {displayName.charAt(0).toUpperCase()}
              </div>

              {/* User Name */}
              <span className="mono-eyebrow text-[11px] text-[#374151] dark:text-[#e4e4e7] max-w-[130px] truncate hidden lg:inline font-normal capitalize">
                {displayName}
              </span>

              <button
                onClick={handleSignOut}
                title="Sign out"
                className="p-1.5 rounded-full text-[#9ca3af] hover:text-[#111827] dark:hover:text-white hover:bg-[#f3f4f6] dark:hover:bg-[#18181b] transition"
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
