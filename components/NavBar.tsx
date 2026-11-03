'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import Logo from '@/components/Logo';
import { LogOut, Plus, Moon, Sun, Search } from 'lucide-react';
import { useTheme } from '@/components/ThemeProvider';
import QuickSearch from '@/components/QuickSearch';

export default function NavBar() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const { theme, toggleTheme } = useTheme();

  const [metrics, setMetrics] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

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
    { label: 'Overview', href: '/' },
    { label: 'Campaigns', href: '/campaigns' },
    { label: 'Leads', href: '/leads' },
    {
      label: 'Drafts',
      href: '/drafts',
      badge: metrics?.pendingDrafts > 0 ? metrics.pendingDrafts : undefined,
    },
    { label: 'Settings', href: '/settings' },
  ];

  // Resolve user display name (fallback to email prefix or Operator)
  const displayName =
    user?.user_metadata?.display_name ||
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    (user?.email ? user.email.split('@')[0] : 'Operator');

  return (
    <header className="sticky top-0 z-50 bg-[#f7f7f5]/95 dark:bg-[#171916]/95 backdrop-blur-md border-b border-[#e8e9e5] dark:border-white/[0.08] transition-colors duration-150">
      <div className="max-w-7xl mx-auto px-5 sm:px-8 py-3 flex items-center justify-between gap-4">
        {/* Brand Logo & Clean Monospace Navigation */}
        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-2">
            <Logo height={26} showSubtitle={false} />
          </div>

          {/* Navigation Links with 4px border radius and mono caps */}
          <nav className="hidden md:flex items-center space-x-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`text-sm px-3 py-2 rounded-lg transition-all flex items-center space-x-1.5 ${
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
                          ? 'bg-[#71866e] text-white'
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

        {/* Right Actions: Quick Find, Dark Mode Toggle, New Campaign, User Profile */}
        <div className="flex items-center space-x-2.5">
          <button
            onClick={() => setSearchOpen(true)}
            className="flex items-center space-x-2 px-2.5 py-1.5 rounded-[4px] bg-[#f8fafc] dark:bg-white/[0.04] border border-[#ebebeb] dark:border-white/[0.08] text-[#959494] hover:text-black dark:hover:text-white transition text-[10px] font-mono cursor-pointer active:scale-95"
            title="Search leads and campaigns (Press ⌘K)"
          >
            <Search className="w-3 h-3 text-[#71866e]" />
            <span className="hidden sm:inline">Search</span>
            <kbd className="px-1 py-0.2 rounded-[2px] bg-black/5 dark:bg-white/10 text-[9px] font-mono">⌘K</kbd>
          </button>

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
            className="bg-[#4f6653] hover:bg-[#405444] text-white px-3.5 py-2 rounded-lg text-sm font-medium flex items-center space-x-1.5 transition active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New campaign</span>
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

      {/* Global Quick Search & Command Palette Modal */}
      <QuickSearch isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
    </header>
  );
}
