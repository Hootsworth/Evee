'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Users,
  UserPlus,
  Send,
  ExternalLink,
  Copy,
  Check,
  Trash2,
  Edit2,
  RefreshCw,
  Search,
  Sparkles,
  Layers,
  Building2,
  ShieldCheck,
  AlertCircle,
  X,
  MailCheck,
  CheckCircle2,
  ArrowRight,
  KeyRound,
  Pause,
  Play,
} from 'lucide-react';

interface Partner {
  id: string;
  name: string;
  email: string;
  accessKey: string;
  role?: string;
  status: 'active' | 'paused';
  notes?: string;
  allottedLeadsCount: number;
  sentEmailsCount: number;
  createdAt: string;
}

export default function PartnersPage() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Add Partner Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [addName, setAddName] = useState('');
  const [addEmail, setAddEmail] = useState('');
  const [addKey, setAddKey] = useState('');
  const [addRole, setAddRole] = useState('Outreach Associate');
  const [addNotes, setAddNotes] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Allotment Modal State
  const [showAllotModal, setShowAllotModal] = useState(false);
  const [selectedPartner, setSelectedPartner] = useState<Partner | null>(null);
  const [allBusinesses, setAllBusinesses] = useState<any[]>([]);
  const [allotmentsMap, setAllotmentsMap] = useState<Record<string, any>>({});
  const [selectedBizIds, setSelectedBizIds] = useState<Set<string>>(new Set());
  const [allotFilter, setAllotFilter] = useState<'unassigned' | 'all'>('unassigned');
  const [allotSearch, setAllotSearch] = useState('');
  const [allotting, setAllotting] = useState(false);
  const [allotMessage, setAllotMessage] = useState<string | null>(null);

  const fetchPartners = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/partners');
      const data = await res.json();
      if (res.ok && data.partners) {
        setPartners(data.partners);
        setAllotmentsMap(data.allotments || {});
      }
    } catch (err) {
      console.error('Failed to load partners:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchBusinesses = async () => {
    try {
      const res = await fetch('/api/businesses');
      const data = await res.json();
      if (res.ok && data.businesses) {
        setAllBusinesses(data.businesses);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchPartners();
    fetchBusinesses();
  }, []);

  const handleCreatePartner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addName.trim() || !addEmail.trim()) {
      setCreateError('Partner name and email are required');
      return;
    }

    setCreating(true);
    setCreateError(null);

    try {
      const res = await fetch('/api/partners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: addName.trim(),
          email: addEmail.trim(),
          accessKey: addKey.trim() || undefined,
          role: addRole.trim(),
          notes: addNotes.trim(),
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setShowAddModal(false);
        setAddName('');
        setAddEmail('');
        setAddKey('');
        setAddRole('Outreach Associate');
        setAddNotes('');
        await fetchPartners();
      } else {
        setCreateError(data.error || 'Failed to create partner');
      }
    } catch (err: any) {
      setCreateError(err.message || 'Network error');
    } finally {
      setCreating(false);
    }
  };

  const handleDeletePartner = async (partnerId: string, name: string) => {
    if (!confirm(`Are you sure you want to remove partner "${name}"? Any leads allotted to them will be returned to the unassigned directory.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/partners/${partnerId}`, { method: 'DELETE' });
      if (res.ok) {
        await fetchPartners();
      } else {
        alert('Failed to remove partner');
      }
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleToggleStatus = async (partner: Partner) => {
    const newStatus = partner.status === 'active' ? 'paused' : 'active';
    try {
      const res = await fetch(`/api/partners/${partner.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        fetchPartners();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCopyPortalLink = (accessKey: string) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const portalUrl = `${origin}/partner?key=${encodeURIComponent(accessKey)}`;
    navigator.clipboard.writeText(portalUrl);
    setCopiedKey(accessKey);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const openAllotModal = (partner: Partner) => {
    setSelectedPartner(partner);
    setAllotMessage(null);

    // Preselect leads currently assigned to this partner
    const currentlyAssigned = new Set<string>();
    for (const [bizId, assignment] of Object.entries(allotmentsMap)) {
      if (assignment.partnerId === partner.id) {
        currentlyAssigned.add(bizId);
      }
    }
    setSelectedBizIds(currentlyAssigned);
    setShowAllotModal(true);
  };

  const handleSaveAllotment = async () => {
    if (!selectedPartner) return;
    setAllotting(true);
    setAllotMessage(null);

    try {
      const res = await fetch('/api/partners/allot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessIds: Array.from(selectedBizIds),
          partnerId: selectedPartner.id,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setAllotMessage(`Successfully allotted ${data.allottedCount} leads to ${selectedPartner.name}!`);
        await fetchPartners();
        setTimeout(() => {
          setShowAllotModal(false);
          setAllotMessage(null);
        }, 1200);
      } else {
        alert(data.error || 'Failed to update lead allotments');
      }
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setAllotting(false);
    }
  };

  // Filtered partners
  const filteredPartners = partners.filter((p) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      p.email.toLowerCase().includes(q) ||
      (p.role && p.role.toLowerCase().includes(q))
    );
  });

  // Calculate high-level metrics
  const totalAllotted = partners.reduce((sum, p) => sum + (p.allottedLeadsCount || 0), 0);
  const totalSentByPartners = partners.reduce((sum, p) => sum + (p.sentEmailsCount || 0), 0);
  const activePartnersCount = partners.filter((p) => p.status === 'active').length;

  return (
    <div className="min-h-screen bg-[#f7f7f5] dark:bg-[#171916] text-[#20211f] dark:text-[#f1f2ee] transition-colors duration-150">
      {/* Page Header */}
      <header className="border-b border-[#e8e9e5] dark:border-white/[0.08] px-5 sm:px-8 py-8 sm:py-10">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="max-w-2xl">
            <div className="flex items-center space-x-2 text-xs font-medium text-[#4f6653] dark:text-[#afc6ad] mb-2.5">
              <span>Partner & sub-portal management</span>
              <span>•</span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#4f6653]/10 text-[#4f6653] dark:text-[#afc6ad]">
                DELEGATED OUTREACH
              </span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-[#20211f] dark:text-[#f1f2ee]">
              Partners
            </h1>
            <p className="text-sm text-[#777a74] dark:text-[#a2a69e] mt-2 leading-relaxed">
              Create sub-portals for team members and external partners. Allot specific leads for them to enrich, view, and send outreach from their dedicated Partner Portal.
            </p>
          </div>

          {/* Action CTAs */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <Link
              href="/partner"
              target="_blank"
              className="inline-flex items-center gap-2 rounded-lg border border-[#dfe2dc] dark:border-white/10 bg-white dark:bg-[#1e211d] px-4 py-2 text-sm font-medium text-[#20211f] dark:text-[#f1f2ee] hover:border-[#aab4a6] transition shadow-sm"
            >
              <ExternalLink className="w-4 h-4 text-[#777a74] dark:text-[#a2a69e]" />
              <span>Preview Partner Portal</span>
            </Link>

            <button
              onClick={() => {
                setShowAddModal(true);
                setCreateError(null);
                setAddKey(`key-${Math.floor(1000 + Math.random() * 9000)}`);
              }}
              className="inline-flex items-center gap-2 rounded-lg bg-[#4f6653] hover:bg-[#405444] text-white px-4 py-2 text-sm font-medium transition shadow-sm"
            >
              <UserPlus className="w-4 h-4" />
              <span>+ Add New Partner</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Canvas */}
      <main className="max-w-7xl mx-auto px-5 sm:px-8 py-8 space-y-8">
        {/* KPI Metric Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <div className="p-5 rounded-2xl bg-white dark:bg-[#1e211d] border border-[#e8e9e5] dark:border-white/[0.08] shadow-sm">
            <div className="flex items-center justify-between text-xs font-medium text-[#777a74] dark:text-[#a2a69e] uppercase tracking-wider">
              <span>Active Partners</span>
              <Users className="w-4 h-4 text-[#4f6653] dark:text-[#afc6ad]" />
            </div>
            <div className="text-3xl font-semibold text-[#20211f] dark:text-[#f1f2ee] mt-2">
              {activePartnersCount}
              <span className="text-xs font-normal text-[#777a74] dark:text-[#a2a69e] ml-2">
                / {partners.length} total
              </span>
            </div>
            <div className="text-xs text-[#777a74] dark:text-[#a2a69e] mt-1">
              Team members with active sub-portals
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-white dark:bg-[#1e211d] border border-[#e8e9e5] dark:border-white/[0.08] shadow-sm">
            <div className="flex items-center justify-between text-xs font-medium text-[#777a74] dark:text-[#a2a69e] uppercase tracking-wider">
              <span>Leads Allotted</span>
              <Layers className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="text-3xl font-semibold text-emerald-700 dark:text-emerald-400 mt-2">
              {totalAllotted}
            </div>
            <div className="text-xs text-[#777a74] dark:text-[#a2a69e] mt-1">
              Prospects assigned to partner accounts
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-white dark:bg-[#1e211d] border border-[#e8e9e5] dark:border-white/[0.08] shadow-sm">
            <div className="flex items-center justify-between text-xs font-medium text-[#777a74] dark:text-[#a2a69e] uppercase tracking-wider">
              <span>Partner Dispatches</span>
              <MailCheck className="w-4 h-4 text-blue-500" />
            </div>
            <div className="text-3xl font-semibold text-blue-700 dark:text-blue-400 mt-2">
              {totalSentByPartners}
            </div>
            <div className="text-xs text-[#777a74] dark:text-[#a2a69e] mt-1">
              Emails dispatched by sub-portal associates
            </div>
          </div>
        </div>

        {/* Toolbar & Search */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-[#777a74] dark:text-[#a2a69e] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search partners by name, email, role..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm rounded-xl border border-[#dfe2dc] dark:border-white/10 bg-white dark:bg-[#1e211d] text-[#20211f] dark:text-[#f1f2ee] placeholder-[#959494] focus:outline-none focus:ring-1 focus:ring-[#4f6653] focus:border-[#4f6653] transition shadow-sm"
            />
          </div>

          <button
            onClick={() => fetchPartners()}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#dfe2dc] dark:border-white/10 bg-white dark:bg-[#1e211d] text-xs font-medium text-[#777a74] hover:text-[#20211f] dark:hover:text-white transition shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>

        {/* Partners Table Card */}
        {loading ? (
          <div className="py-24 text-center text-sm text-[#777a74] dark:text-[#a2a69e] flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-[#4f6653]" />
            <span>Loading partner accounts...</span>
          </div>
        ) : filteredPartners.length === 0 ? (
          <div className="rounded-2xl border border-[#e8e9e5] dark:border-white/[0.08] p-16 text-center bg-white dark:bg-[#1e211d] shadow-sm">
            <Users className="w-10 h-10 text-[#777a74] mx-auto mb-3 opacity-60" />
            <h3 className="text-base font-semibold text-[#20211f] dark:text-[#f1f2ee] mb-1.5">
              No partners added yet
            </h3>
            <p className="text-xs text-[#777a74] dark:text-[#a2a69e] max-w-md mx-auto mb-6 leading-relaxed">
              Add sub-portal partners so they can log into their own dedicated portal, enrich leads, and launch outreach campaigns.
            </p>
            <button
              onClick={() => {
                setShowAddModal(true);
                setCreateError(null);
                setAddKey(`key-${Math.floor(1000 + Math.random() * 9000)}`);
              }}
              className="inline-flex items-center gap-2 rounded-lg bg-[#4f6653] hover:bg-[#405444] text-white px-4 py-2 text-sm font-medium transition shadow-sm"
            >
              <UserPlus className="w-4 h-4" />
              <span>Add your first partner</span>
            </button>
          </div>
        ) : (
          <div className="rounded-2xl border border-[#e8e9e5] dark:border-white/[0.08] overflow-hidden bg-white dark:bg-[#1e211d] shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-[#fafaf8] dark:bg-[#232622] border-b border-[#e8e9e5] dark:border-white/[0.08] text-[11px] font-semibold text-[#777a74] dark:text-[#a2a69e] uppercase tracking-wider">
                  <tr>
                    <th className="py-3.5 px-5">PARTNER</th>
                    <th className="py-3.5 px-4">PORTAL ACCESS KEY</th>
                    <th className="py-3.5 px-4">ALLOTTED LEADS</th>
                    <th className="py-3.5 px-4">STATUS</th>
                    <th className="py-3.5 px-5 text-right">ACTIONS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e8e9e5] dark:divide-white/[0.06]">
                  {filteredPartners.map((p) => {
                    const portalUrl = `/partner?key=${encodeURIComponent(p.accessKey)}`;

                    return (
                      <tr key={p.id} className="hover:bg-[#f9faf8] dark:hover:bg-[#262a25] transition-colors">
                        {/* Partner Name & Email */}
                        <td className="py-4 px-5">
                          <div className="flex items-center space-x-3">
                            <div className="w-9 h-9 rounded-xl bg-[#4f6653]/10 text-[#4f6653] dark:text-[#afc6ad] font-semibold flex items-center justify-center shrink-0 text-xs">
                              {p.name.slice(0, 2).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <div className="font-medium text-sm text-[#20211f] dark:text-[#f1f2ee]">
                                {p.name}
                              </div>
                              <div className="text-xs text-[#777a74] dark:text-[#a2a69e] flex items-center gap-1.5 mt-0.5">
                                <span>{p.email}</span>
                                {p.role && (
                                  <>
                                    <span>•</span>
                                    <span className="italic">{p.role}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Portal Access Key & Copy Link */}
                        <td className="py-4 px-4">
                          <div className="flex items-center space-x-2">
                            <span className="font-mono text-xs px-2.5 py-1 rounded-md bg-[#fafaf8] dark:bg-[#252824] border border-[#dfe2dc] dark:border-white/10 text-[#20211f] dark:text-[#f1f2ee]">
                              {p.accessKey}
                            </span>
                            <button
                              onClick={() => handleCopyPortalLink(p.accessKey)}
                              title="Copy 1-Click Portal Login Link"
                              className="p-1.5 rounded-lg border border-[#dfe2dc] dark:border-white/10 hover:bg-[#f4f5f2] dark:hover:bg-white/[0.05] text-[#777a74] hover:text-[#20211f] dark:hover:text-white transition"
                            >
                              {copiedKey === p.accessKey ? (
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                            <Link
                              href={portalUrl}
                              target="_blank"
                              title="Open Partner Portal as this partner"
                              className="p-1.5 rounded-lg border border-[#dfe2dc] dark:border-white/10 hover:bg-[#f4f5f2] dark:hover:bg-white/[0.05] text-[#777a74] hover:text-[#4f6653] dark:hover:text-[#afc6ad] transition"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </Link>
                          </div>
                        </td>

                        {/* Allotted Leads & Sent Metrics */}
                        <td className="py-4 px-4">
                          <div className="flex items-center space-x-2">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#4f6653]/10 text-[#4f6653] dark:text-[#afc6ad]">
                              {p.allottedLeadsCount} leads
                            </span>
                            {p.sentEmailsCount > 0 && (
                              <span className="text-xs text-[#777a74] dark:text-[#a2a69e] flex items-center gap-1 font-mono">
                                <MailCheck className="w-3 h-3 text-blue-500" />
                                <span>{p.sentEmailsCount} sent</span>
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Status */}
                        <td className="py-4 px-4">
                          <button
                            onClick={() => handleToggleStatus(p)}
                            className={`px-2.5 py-0.5 rounded-full text-xs font-medium inline-flex items-center gap-1 transition ${
                              p.status === 'active'
                                ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20'
                                : 'bg-neutral-200 dark:bg-white/10 text-neutral-600 dark:text-neutral-400'
                            }`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${p.status === 'active' ? 'bg-emerald-500' : 'bg-neutral-400'}`} />
                            <span className="capitalize">{p.status}</span>
                          </button>
                        </td>

                        {/* Actions */}
                        <td className="py-4 px-5 text-right">
                          <div className="inline-flex items-center gap-2">
                            <button
                              onClick={() => openAllotModal(p)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#dfe2dc] dark:border-white/10 hover:border-[#aab4a6] bg-white dark:bg-[#1e211d] text-xs font-medium text-[#20211f] dark:text-[#f1f2ee] transition shadow-sm"
                            >
                              <Layers className="w-3.5 h-3.5 text-[#4f6653] dark:text-[#afc6ad]" />
                              <span>Allot Leads</span>
                            </button>

                            <button
                              onClick={() => handleDeletePartner(p.id, p.name)}
                              title="Delete partner"
                              className="p-1.5 rounded-lg text-[#777a74] hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* Add Partner Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#1e211d] border border-[#e8e9e5] dark:border-white/10 rounded-2xl w-full max-w-lg p-6 sm:p-8 space-y-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-[#e8e9e5] dark:border-white/[0.08]">
              <div>
                <div className="text-xs font-medium text-[#4f6653] dark:text-[#afc6ad] uppercase tracking-wider">
                  Partner Access
                </div>
                <h3 className="text-xl font-semibold tracking-tight text-[#20211f] dark:text-[#f1f2ee] mt-0.5">
                  Add New Partner
                </h3>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-[#777a74] hover:text-[#20211f] dark:hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {createError && (
              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-800 dark:text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{createError}</span>
              </div>
            )}

            <form onSubmit={handleCreatePartner} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-[#777a74] dark:text-[#a2a69e] block mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Rahul Verma"
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  className="w-full text-sm p-2.5 rounded-xl border border-[#dfe2dc] dark:border-white/10 bg-white dark:bg-[#171916] text-[#20211f] dark:text-[#f1f2ee] focus:outline-none focus:ring-1 focus:ring-[#4f6653] focus:border-[#4f6653]"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-[#777a74] dark:text-[#a2a69e] block mb-1">
                  Partner Email *
                </label>
                <input
                  type="email"
                  required
                  placeholder="e.g. rahul@consulting.in"
                  value={addEmail}
                  onChange={(e) => setAddEmail(e.target.value)}
                  className="w-full text-sm p-2.5 rounded-xl border border-[#dfe2dc] dark:border-white/10 bg-white dark:bg-[#171916] text-[#20211f] dark:text-[#f1f2ee] focus:outline-none focus:ring-1 focus:ring-[#4f6653] focus:border-[#4f6653]"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-[#777a74] dark:text-[#a2a69e] block mb-1">
                  Portal Access Key
                </label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="e.g. rahul-2026"
                    value={addKey}
                    onChange={(e) => setAddKey(e.target.value)}
                    className="w-full text-sm font-mono p-2.5 pl-9 rounded-xl border border-[#dfe2dc] dark:border-white/10 bg-white dark:bg-[#171916] text-[#20211f] dark:text-[#f1f2ee] focus:outline-none focus:ring-1 focus:ring-[#4f6653] focus:border-[#4f6653]"
                  />
                  <KeyRound className="w-4 h-4 text-[#777a74] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
                <p className="text-[11px] text-[#777a74] dark:text-[#a2a69e] mt-1">
                  The partner will enter this key to log into the Partner Portal at <code>/partner</code>.
                </p>
              </div>

              <div>
                <label className="text-xs font-medium text-[#777a74] dark:text-[#a2a69e] block mb-1">
                  Role / Designation
                </label>
                <input
                  type="text"
                  placeholder="e.g. Regional Outreach Associate"
                  value={addRole}
                  onChange={(e) => setAddRole(e.target.value)}
                  className="w-full text-sm p-2.5 rounded-xl border border-[#dfe2dc] dark:border-white/10 bg-white dark:bg-[#171916] text-[#20211f] dark:text-[#f1f2ee] focus:outline-none focus:ring-1 focus:ring-[#4f6653] focus:border-[#4f6653]"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-[#777a74] dark:text-[#a2a69e] block mb-1">
                  Internal Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Focuses on Dental and Healthcare clinics in Mumbai"
                  value={addNotes}
                  onChange={(e) => setAddNotes(e.target.value)}
                  className="w-full text-sm p-2.5 rounded-xl border border-[#dfe2dc] dark:border-white/10 bg-white dark:bg-[#171916] text-[#20211f] dark:text-[#f1f2ee] focus:outline-none focus:ring-1 focus:ring-[#4f6653] focus:border-[#4f6653]"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-[#e8e9e5] dark:border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-[#777a74] hover:text-[#20211f] dark:hover:text-white transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#4f6653] hover:bg-[#405444] text-white px-5 py-2 text-sm font-medium transition shadow-sm disabled:opacity-50"
                >
                  <UserPlus className={`w-4 h-4 ${creating ? 'animate-spin' : ''}`} />
                  <span>{creating ? 'Creating...' : 'Create Partner'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Allot Leads Modal */}
      {showAllotModal && selectedPartner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#1e211d] border border-[#e8e9e5] dark:border-white/10 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6 sm:p-8 space-y-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-[#e8e9e5] dark:border-white/[0.08]">
              <div>
                <div className="text-xs font-medium text-[#4f6653] dark:text-[#afc6ad] uppercase tracking-wider">
                  Lead Allotment
                </div>
                <h3 className="text-xl font-semibold tracking-tight text-[#20211f] dark:text-[#f1f2ee] mt-0.5">
                  Allot Leads to {selectedPartner.name}
                </h3>
              </div>
              <button
                onClick={() => setShowAllotModal(false)}
                className="text-[#777a74] hover:text-[#20211f] dark:hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {allotMessage && (
              <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                <span>{allotMessage}</span>
              </div>
            )}

            {/* Filter & Search Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-[#777a74] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filter candidate leads by name, city, email..."
                  value={allotSearch}
                  onChange={(e) => setAllotSearch(e.target.value)}
                  className="w-full text-xs pl-9 pr-3 py-2 rounded-xl border border-[#dfe2dc] dark:border-white/10 bg-white dark:bg-[#171916] text-[#20211f] dark:text-[#f1f2ee]"
                />
              </div>

              <div className="inline-flex p-1 bg-[#edebe8] dark:bg-[#252824] rounded-lg text-xs">
                <button
                  type="button"
                  onClick={() => setAllotFilter('unassigned')}
                  className={`px-3 py-1 rounded-md font-medium transition ${
                    allotFilter === 'unassigned'
                      ? 'bg-white dark:bg-[#1e211d] text-[#20211f] dark:text-white shadow-sm'
                      : 'text-[#777a74]'
                  }`}
                >
                  Unassigned Only
                </button>
                <button
                  type="button"
                  onClick={() => setAllotFilter('all')}
                  className={`px-3 py-1 rounded-md font-medium transition ${
                    allotFilter === 'all'
                      ? 'bg-white dark:bg-[#1e211d] text-[#20211f] dark:text-white shadow-sm'
                      : 'text-[#777a74]'
                  }`}
                >
                  All Directory Leads
                </button>
              </div>
            </div>

            {/* Candidate Leads List */}
            <div className="border border-[#e8e9e5] dark:border-white/[0.08] rounded-xl overflow-hidden max-h-72 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#fafaf8] dark:bg-[#232622] border-b border-[#e8e9e5] dark:border-white/[0.08] text-[#777a74] sticky top-0">
                  <tr>
                    <th className="py-2.5 px-3 w-10">
                      <input
                        type="checkbox"
                        checked={
                          selectedBizIds.size > 0 &&
                          allBusinesses.every((b) => selectedBizIds.has(b.id))
                        }
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedBizIds(new Set(allBusinesses.map((b) => b.id)));
                          } else {
                            setSelectedBizIds(new Set());
                          }
                        }}
                        className="rounded text-[#4f6653] focus:ring-0"
                      />
                    </th>
                    <th className="py-2.5 px-3">Company Name</th>
                    <th className="py-2.5 px-3">Location</th>
                    <th className="py-2.5 px-3">Email</th>
                    <th className="py-2.5 px-3">Current Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e8e9e5] dark:divide-white/[0.06]">
                  {allBusinesses
                    .filter((b) => {
                      if (allotSearch) {
                        const q = allotSearch.toLowerCase();
                        if (
                          !b.display_name?.toLowerCase().includes(q) &&
                          !b.city?.toLowerCase().includes(q) &&
                          !b.general_business_email?.toLowerCase().includes(q)
                        ) {
                          return false;
                        }
                      }
                      if (allotFilter === 'unassigned') {
                        const existing = allotmentsMap[b.id];
                        // Show if unassigned OR already assigned to this partner
                        return !existing || existing.partnerId === selectedPartner.id;
                      }
                      return true;
                    })
                    .map((b) => {
                      const isChecked = selectedBizIds.has(b.id);
                      const currentAssignment = allotmentsMap[b.id];

                      return (
                        <tr
                          key={b.id}
                          onClick={() => {
                            const next = new Set(selectedBizIds);
                            if (next.has(b.id)) next.delete(b.id);
                            else next.add(b.id);
                            setSelectedBizIds(next);
                          }}
                          className={`cursor-pointer transition-colors ${
                            isChecked
                              ? 'bg-[#4f6653]/10 dark:bg-white/[0.04]'
                              : 'hover:bg-[#f9faf8] dark:hover:bg-[#262a25]'
                          }`}
                        >
                          <td className="py-2.5 px-3">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {}}
                              className="rounded text-[#4f6653] focus:ring-0"
                            />
                          </td>
                          <td className="py-2.5 px-3 font-medium text-[#20211f] dark:text-[#f1f2ee]">
                            {b.display_name}
                          </td>
                          <td className="py-2.5 px-3 text-[#777a74]">{b.city || 'India'}</td>
                          <td className="py-2.5 px-3 font-mono text-[11px]">
                            {b.general_business_email || <span className="text-amber-500 italic">No email</span>}
                          </td>
                          <td className="py-2.5 px-3">
                            {currentAssignment ? (
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                                  currentAssignment.partnerId === selectedPartner.id
                                    ? 'bg-[#4f6653]/10 text-[#4f6653] dark:text-[#afc6ad]'
                                    : 'bg-amber-500/10 text-amber-700 dark:text-amber-300'
                                }`}
                              >
                                {currentAssignment.partnerId === selectedPartner.id
                                  ? 'Allotted to this partner'
                                  : 'Assigned to other partner'}
                              </span>
                            ) : (
                              <span className="text-[#777a74] text-[11px]">Unassigned</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-[#e8e9e5] dark:border-white/[0.08]">
              <div className="text-xs text-[#777a74] dark:text-[#a2a69e]">
                <strong>{selectedBizIds.size}</strong> leads selected for {selectedPartner.name}
              </div>

              <div className="flex items-center space-x-3">
                <button
                  type="button"
                  onClick={() => setShowAllotModal(false)}
                  className="px-4 py-2 rounded-lg text-xs font-medium text-[#777a74] hover:text-[#20211f] dark:hover:text-white transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveAllotment}
                  disabled={allotting}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#4f6653] hover:bg-[#405444] text-white px-5 py-2 text-xs font-medium transition shadow-sm disabled:opacity-50"
                >
                  <Layers className={`w-3.5 h-3.5 ${allotting ? 'animate-spin' : ''}`} />
                  <span>{allotting ? 'Allotting...' : `Save Allotment (${selectedBizIds.size})`}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
