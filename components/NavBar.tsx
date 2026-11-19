'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import Logo from '@/components/Logo';
import { LogOut, Plus, Moon, Sun, Search, ChevronDown, Menu, X, LayoutDashboard, BriefcaseBusiness, Building2, Settings, Sparkles } from 'lucide-react';
import { useTheme } from '@/components/ThemeProvider';
import QuickSearch from '@/components/QuickSearch';

const primaryLinks = [
  { label: 'Home', href: '/', icon: LayoutDashboard },
  { label: 'Work', href: '/work', icon: BriefcaseBusiness },
  { label: 'Leads', href: '/leads', icon: Building2 },
];
const menuGroups = [
  { label: 'Workspace', icon: Building2, links: [
    { label: 'Revenue', href: '/revenue' }, { label: 'Operations', href: '/operations' },
    { label: 'Partners', href: '/partners' },
  ] },
  { label: 'Tools', icon: Sparkles, links: [
    { label: 'Copilot', href: '/copilot' }, { label: 'Campaigns', href: '/campaigns' },
    { label: 'Drafts', href: '/drafts' }, { label: 'Outreach', href: '/outreach' },
    { label: 'Automations', href: '/workflow-templates' }, { label: 'Jobs & activity', href: '/jobs' },
    { label: 'Developer API', href: '/developers' },
  ] },
];
const isPathActive = (pathname: string, href: string) => pathname === href || pathname.startsWith(`${href}/`);

export default function NavBar() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const { theme, toggleTheme } = useTheme();
  const [metrics, setMetrics] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); setSearchOpen(true); }
      if (event.key === 'Escape') { setOpenGroup(null); setMobileOpen(false); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    fetch('/api/reports/overview').then((res) => res.json()).then((data) => setMetrics(data.metrics)).catch(() => {});
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null));
    return () => listener.subscription.unsubscribe();
  }, [supabase]);

  const signOut = async () => { await supabase.auth.signOut(); setUser(null); router.push('/auth'); router.refresh(); };
  if (pathname.startsWith('/partner') && pathname !== '/partners') return null;
  const displayName = user?.user_metadata?.display_name || user?.user_metadata?.full_name || user?.user_metadata?.name || (user?.email ? user.email.split('@')[0] : 'Workspace');

  const linkClass = (active: boolean) => `inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition ${active ? 'bg-[#eaf0e8] text-[#334b37] dark:bg-white/[0.10] dark:text-white font-semibold' : 'text-[#62685f] hover:bg-black/[0.04] hover:text-[#20211f] dark:text-[#a2a69e] dark:hover:bg-white/[0.06] dark:hover:text-white'}`;
  return <>
    <header className="sticky top-0 z-50 border-b border-[var(--line)] bg-[color-mix(in_srgb,var(--canvas)_92%,transparent)] backdrop-blur-xl">
      <div className="mx-auto flex h-[68px] max-w-[1440px] items-center gap-5 px-4 sm:px-6 lg:px-8">
        <Link href="/" aria-label="Evee home" className="shrink-0"><Logo height={28} showSubtitle={false} /></Link>
        <div className="hidden h-8 w-px bg-[var(--line)] lg:block" />
        <nav aria-label="Primary navigation" className="hidden items-center gap-1 lg:flex">
          {primaryLinks.map((item) => {
            const active = isPathActive(pathname, item.href);
            const Icon = item.icon;
            return <Link href={item.href} key={item.href} className={linkClass(active)}><Icon className="h-4 w-4"/><span>{item.label}</span>{item.href === '/work' && metrics?.openWorkItems > 0 && <span className="rounded-full bg-white px-1.5 py-0.5 text-[10px] dark:bg-black/30">{metrics.openWorkItems}</span>}</Link>;
          })}
          {menuGroups.map((group) => {
            const Icon = group.icon;
            const active = group.links.some((item) => isPathActive(pathname, item.href));
            const isOpen = openGroup === group.label;
            return <div key={group.label} className="relative">
              <button type="button" aria-expanded={isOpen} onClick={() => setOpenGroup(isOpen ? null : group.label)} className={linkClass(active || isOpen)}><Icon className="h-4 w-4"/><span>{group.label}</span><ChevronDown className={`h-3.5 w-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`}/></button>
              {isOpen && <><button aria-label="Close menu" className="fixed inset-0 z-40 cursor-default" onClick={() => setOpenGroup(null)}/><div className="absolute left-0 top-full z-50 mt-2 w-56 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-2 shadow-xl">{group.links.map((item) => <Link key={item.href} href={item.href} onClick={() => setOpenGroup(null)} className={`flex items-center justify-between rounded-lg px-3 py-2.5 text-sm hover:bg-black/[0.04] dark:hover:bg-white/[0.06] ${isPathActive(pathname, item.href) ? 'font-semibold text-[var(--accent)]' : 'text-[var(--ink)]'}`}><span>{item.label}</span>{item.href === '/drafts' && metrics?.pendingDrafts > 0 && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] text-amber-800 dark:bg-amber-400/10 dark:text-amber-300">{metrics.pendingDrafts}</span>}</Link>)}</div></>}
            </div>;
          })}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => setSearchOpen(true)} aria-label="Search workspace" className="inline-flex h-9 items-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 text-xs text-[var(--muted)] hover:text-[var(--ink)]"><Search className="h-4 w-4 text-[var(--accent)]"/><span className="hidden sm:inline">Search</span><kbd className="hidden rounded bg-black/[0.04] px-1.5 py-0.5 text-[10px] dark:bg-white/[0.08] sm:inline">⌘K</kbd></button>
          <button onClick={toggleTheme} title={theme === 'dark' ? 'Use light theme' : 'Use dark theme'} aria-label="Toggle theme" className="grid h-9 w-9 place-items-center rounded-lg text-[var(--muted)] hover:bg-black/[0.04] dark:hover:bg-white/[0.06]">{theme === 'dark' ? <Sun className="h-4 w-4"/> : <Moon className="h-4 w-4"/>}</button>
          <Link href="/campaigns" className="hidden h-9 items-center gap-2 rounded-lg bg-[var(--accent)] px-3 text-sm font-medium text-white transition hover:opacity-90 sm:inline-flex"><Plus className="h-4 w-4"/><span className="hidden xl:inline">New campaign</span></Link>
          <Link href="/settings" aria-label="Settings" className={`grid h-9 w-9 place-items-center rounded-lg hover:bg-black/[0.04] dark:hover:bg-white/[0.06] ${pathname.startsWith('/settings') ? 'text-[var(--accent)]' : 'text-[var(--muted)]'}`}><Settings className="h-4 w-4"/></Link>
          {user && <div className="hidden items-center gap-2 border-l border-[var(--line)] pl-3 sm:flex"><div className="grid h-8 w-8 place-items-center rounded-full bg-[#eaf0e8] text-xs font-semibold text-[#334b37] dark:bg-white/10 dark:text-white">{displayName.charAt(0).toUpperCase()}</div><span className="hidden max-w-24 truncate text-xs font-medium capitalize lg:inline">{displayName}</span><button onClick={signOut} aria-label="Sign out" className="grid h-8 w-8 place-items-center rounded-lg text-[var(--muted)] hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"><LogOut className="h-4 w-4"/></button></div>}
          <button className="grid h-9 w-9 place-items-center rounded-lg text-[var(--ink)] lg:hidden" onClick={() => setMobileOpen(!mobileOpen)} aria-label={mobileOpen ? 'Close navigation' : 'Open navigation'}>{mobileOpen ? <X className="h-5 w-5"/> : <Menu className="h-5 w-5"/>}</button>
        </div>
      </div>
      {mobileOpen && <div className="border-t border-[var(--line)] bg-[var(--surface)] px-4 py-3 lg:hidden"><div className="mx-auto max-w-3xl space-y-4">{primaryLinks.map((item) => <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)} className={linkClass(isPathActive(pathname, item.href))}>{item.label}</Link>)}{menuGroups.map((group) => <section key={group.label}><h2 className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">{group.label}</h2><div className="grid grid-cols-2 gap-1">{group.links.map((item) => <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)} className={linkClass(isPathActive(pathname, item.href))}>{item.label}</Link>)}</div></section>)}{user && <button onClick={signOut} className="flex items-center gap-2 px-3 py-2 text-sm text-[var(--muted)]"><LogOut className="h-4 w-4"/>Sign out</button>}</div></div>}
    </header>
    <QuickSearch isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
  </>;
}
