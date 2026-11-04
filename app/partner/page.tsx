'use client';

import { useState, useEffect, useMemo, useRef, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Users,
  Search,
  Plus,
  UploadCloud,
  Sparkles,
  Send,
  MailCheck,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Mail,
  Building2,
  MapPin,
  RefreshCw,
  LogOut,
  KeyRound,
  ShieldCheck,
  Edit3,
  X,
  FileSpreadsheet,
  Check,
  Clock,
  ArrowRight,
  ArrowLeft,
  ChevronRight,
  UserCheck,
} from 'lucide-react';
import { parseAndAnalyzeCsv, CsvColumnMapping, replaceTemplateVariables } from '@/lib/csv/parser';

interface Partner {
  id: string;
  name: string;
  email: string;
  accessKey: string;
  role?: string;
  company?: string;
  status: 'active' | 'paused';
}

interface LeadRecord {
  id: string;
  display_name: string;
  official_website_url?: string | null;
  canonical_domain?: string | null;
  general_business_email?: string | null;
  public_business_phone?: string | null;
  city?: string | null;
  country_code?: string | null;
  business_type?: string | null;
  record_status: string;
  created_at: string;
  contacts?: Array<{
    id: string;
    contact_name?: string;
    email_address?: string;
    phone_number?: string;
  }>;
}

interface SentMessage {
  id: string;
  recipient_email: string;
  subject: string;
  sent_at: string;
  business_id?: string;
  delivery_status: string;
  businesses?: {
    display_name?: string;
  };
}

function PartnerPortalContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // Auth State
  const [partner, setPartner] = useState<Partner | null>(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [accessKeyInput, setAccessKeyInput] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Leads & Sent Data
  const [leads, setLeads] = useState<LeadRecord[]>([]);
  const [sentMessages, setSentMessages] = useState<SentMessage[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'ready' | 'missing' | 'sent'>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Notification Banner
  const [banner, setBanner] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Add Single Lead Modal
  const [showAddLeadModal, setShowAddLeadModal] = useState(false);
  const [savingLead, setSavingLead] = useState(false);
  const [newLead, setNewLead] = useState({
    companyName: '',
    website: '',
    contactName: '',
    email: '',
    city: '',
    phone: '',
    businessType: 'B2B Client',
  });

  // Manual Enrich / Edit Contact Modal
  const [showManualEnrichModal, setShowManualEnrichModal] = useState(false);
  const [enrichTarget, setEnrichTarget] = useState<LeadRecord | null>(null);
  const [enrichForm, setEnrichForm] = useState({
    email: '',
    contactName: '',
    phone: '',
    website: '',
  });
  const [savingEnrichment, setSavingEnrichment] = useState(false);

  // AI Bulk Enrichment State
  const [isEnrichingAi, setIsEnrichingAi] = useState(false);
  const [enrichResultsSummary, setEnrichResultsSummary] = useState<{
    total: number;
    enriched: number;
    notFound: number;
  } | null>(null);

  // CSV Import Modal
  const [showImportModal, setShowImportModal] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvResult, setCsvResult] = useState<any | null>(null);
  const [mapping, setMapping] = useState<Partial<CsvColumnMapping>>({});
  const [importingCsv, setImportingCsv] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Outreach Studio Modal
  const [showOutreachModal, setShowOutreachModal] = useState(false);
  const [outreachStep, setOutreachStep] = useState<'recipients' | 'compose' | 'test' | 'dispatch'>('recipients');
  const [template, setTemplate] = useState({
    subject: 'Strategic collaboration for {{company_name}}',
    bodyText:
      'Hi {{first_name}},\n\nI noticed the impressive work {{company_name}} is doing in {{city}}. I wanted to reach out directly to see if exploring a high-impact partnership would align with your current expansion goals.\n\nWould you be open to a brief 10-minute introductory call next week?\n\nBest regards,\n{{partner_name}}\n{{partner_company}}',
  });
  const [cadence, setCadence] = useState<'human' | 'fast'>('human');
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [testEmailOverride, setTestEmailOverride] = useState('');
  const [sendingTest, setSendingTest] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [dispatchingLive, setDispatchingLive] = useState(false);
  const [dispatchResults, setDispatchResults] = useState<any | null>(null);

  // 1. Check existing session or URL magic key parameter
  const verifySession = async (keyOverride?: string) => {
    setAuthChecking(true);
    setAuthError(null);
    try {
      const urlKey = keyOverride || searchParams.get('key');
      if (urlKey) {
        // Authenticate via URL key directly
        const res = await fetch('/api/partner/auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accessKey: urlKey }),
        });
        const data = await res.json();
        if (res.ok && data.partner) {
          setPartner(data.partner);
          loadPartnerData();
          return;
        }
      }

      // Check existing cookie session
      const res = await fetch('/api/partner/auth');
      const data = await res.json();
      if (res.ok && data.authenticated && data.partner) {
        setPartner(data.partner);
        loadPartnerData();
      } else {
        setPartner(null);
      }
    } catch (err: any) {
      console.error('[partner portal] session check error:', err);
      setPartner(null);
    } finally {
      setAuthChecking(false);
    }
  };

  useEffect(() => {
    verifySession();
  }, []);

  // 2. Fetch partner leads and sent messages
  const loadPartnerData = async () => {
    setLoadingData(true);
    try {
      const [leadsRes, sentRes] = await Promise.all([
        fetch('/api/partner/leads'),
        fetch('/api/partner/outreach/sent'),
      ]);

      if (leadsRes.ok) {
        const leadsData = await leadsRes.json();
        setLeads(leadsData.leads || []);
      }
      if (sentRes.ok) {
        const sentData = await sentRes.json();
        setSentMessages(sentData.messages || []);
      }
    } catch (err: any) {
      console.error('[partner portal] failed to load data:', err);
    } finally {
      setLoadingData(false);
    }
  };

  // 3. Login handler
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessKeyInput.trim()) return;
    setIsLoggingIn(true);
    setAuthError(null);
    try {
      const res = await fetch('/api/partner/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessKey: accessKeyInput.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.partner) {
        setPartner(data.partner);
        setAccessKeyInput('');
        loadPartnerData();
      } else {
        setAuthError(data.error || 'Invalid partner access key. Please verify with your admin.');
      }
    } catch (err: any) {
      setAuthError(`Connection error: ${err.message}`);
    } finally {
      setIsLoggingIn(false);
    }
  };

  // 4. Logout handler
  const handleLogout = async () => {
    try {
      await fetch('/api/partner/auth', { method: 'DELETE' });
    } catch (e) {
      console.error(e);
    }
    setPartner(null);
    setLeads([]);
    setSentMessages([]);
    router.replace('/partner');
  };

  // Sent lookup sets
  const sentEmailsSet = useMemo(() => {
    return new Set(
      sentMessages
        .map((m) => (m.recipient_email || '').toLowerCase().trim())
        .filter(Boolean)
    );
  }, [sentMessages]);

  const sentBizIdsSet = useMemo(() => {
    return new Set(
      sentMessages.map((m) => m.business_id).filter(Boolean)
    );
  }, [sentMessages]);

  const isLeadSent = (lead: LeadRecord) => {
    if (lead.id && sentBizIdsSet.has(lead.id)) return true;
    const email = lead.general_business_email?.toLowerCase().trim();
    if (email && sentEmailsSet.has(email)) return true;
    if (lead.contacts && lead.contacts.length > 0) {
      for (const c of lead.contacts) {
        const cEmail = c.email_address?.toLowerCase().trim();
        if (cEmail && sentEmailsSet.has(cEmail)) return true;
      }
    }
    return false;
  };

  // Counts
  const readyLeads = useMemo(() => {
    return leads.filter((l) => (l.general_business_email || l.contacts?.[0]?.email_address) && !isLeadSent(l));
  }, [leads, sentBizIdsSet, sentEmailsSet]);

  const missingEmailLeads = useMemo(() => {
    return leads.filter((l) => !l.general_business_email && (!l.contacts || l.contacts.length === 0));
  }, [leads]);

  const contactedLeads = useMemo(() => {
    return leads.filter((l) => isLeadSent(l));
  }, [leads, sentBizIdsSet, sentEmailsSet]);

  // Filtered Leads
  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      // Search match
      const query = search.toLowerCase().trim();
      if (query) {
        const matchesName = lead.display_name?.toLowerCase().includes(query);
        const matchesEmail = lead.general_business_email?.toLowerCase().includes(query);
        const matchesCity = lead.city?.toLowerCase().includes(query);
        const matchesDomain = lead.canonical_domain?.toLowerCase().includes(query);
        const matchesContact = lead.contacts?.some(
          (c) => c.contact_name?.toLowerCase().includes(query) || c.email_address?.toLowerCase().includes(query)
        );
        if (!matchesName && !matchesEmail && !matchesCity && !matchesDomain && !matchesContact) {
          return false;
        }
      }

      // Tab Filter
      if (statusFilter === 'ready') {
        return (lead.general_business_email || lead.contacts?.[0]?.email_address) && !isLeadSent(lead);
      }
      if (statusFilter === 'missing') {
        return !lead.general_business_email && (!lead.contacts || lead.contacts.length === 0);
      }
      if (statusFilter === 'sent') {
        return isLeadSent(lead);
      }

      return true;
    });
  }, [leads, search, statusFilter, sentBizIdsSet, sentEmailsSet]);

  // Select all / toggle handlers
  const handleToggleSelectAll = () => {
    if (selectedIds.size === filteredLeads.length && filteredLeads.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredLeads.map((l) => l.id)));
    }
  };

  const handleToggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  // Add Single Lead Submission
  const handleSaveSingleLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLead.companyName.trim()) return;
    setSavingLead(true);
    try {
      const res = await fetch('/api/partner/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newLead),
      });
      const data = await res.json();
      if (res.ok) {
        setBanner({ message: `Successfully added ${newLead.companyName} to your allotted leads.`, type: 'success' });
        setShowAddLeadModal(false);
        setNewLead({
          companyName: '',
          website: '',
          contactName: '',
          email: '',
          city: '',
          phone: '',
          businessType: 'B2B Client',
        });
        loadPartnerData();
      } else {
        alert(data.error || 'Failed to add lead');
      }
    } catch (err: any) {
      alert(`Error saving lead: ${err.message}`);
    } finally {
      setSavingLead(false);
    }
  };

  // Manual Contact Edit / Enrich Submission
  const handleSaveManualEnrich = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!enrichTarget) return;
    setSavingEnrichment(true);
    try {
      const res = await fetch('/api/partner/leads', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId: enrichTarget.id,
          email: enrichForm.email,
          contactName: enrichForm.contactName,
          phone: enrichForm.phone,
          website: enrichForm.website,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setBanner({ message: `Contact details updated for ${enrichTarget.display_name}`, type: 'success' });
        setShowManualEnrichModal(false);
        setEnrichTarget(null);
        loadPartnerData();
      } else {
        alert(data.error || 'Failed to update contact');
      }
    } catch (err: any) {
      alert(`Error updating: ${err.message}`);
    } finally {
      setSavingEnrichment(false);
    }
  };

  // AI Bulk Enrichment
  const handleAiEnrichMissing = async (targetId?: string) => {
    setIsEnrichingAi(true);
    setEnrichResultsSummary(null);
    try {
      const body = targetId ? { businessId: targetId } : { enrichAllMissing: true };
      const res = await fetch('/api/partner/leads/enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok) {
        setEnrichResultsSummary(data.summary || null);
        setBanner({
          message: data.summary?.enriched
            ? `AI successfully found verified emails for ${data.summary.enriched} leads.`
            : 'Enrichment complete.',
          type: 'success',
        });
        loadPartnerData();
      } else {
        alert(data.error || 'Enrichment failed');
      }
    } catch (err: any) {
      alert(`Error in AI enrichment: ${err.message}`);
    } finally {
      setIsEnrichingAi(false);
    }
  };

  // CSV File Handler
  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFile(file);
    const reader = new FileReader();
    reader.onload = (evt) => {
      const content = evt.target?.result as string;
      const parsed = parseAndAnalyzeCsv(content);
      setCsvResult(parsed);
      setMapping(parsed.detectedMapping || {});
    };
    reader.readAsText(file);
  };

  // CSV Import Submission
  const handleExecuteCsvImport = async () => {
    if (!csvResult || !csvResult.rows || csvResult.rows.length === 0) return;
    setImportingCsv(true);
    try {
      const companyCol = mapping.companyName || 'company';
      const emailCol = mapping.email || 'email';
      const websiteCol = mapping.website || 'website';
      const nameCol = mapping.contactName || 'name';
      const cityCol = mapping.city || 'city';
      const phoneCol = mapping.phone || 'phone';

      const payloadLeads = csvResult.rows.map((row: any) => ({
        companyName: row[companyCol] || row.company_name || 'Imported Lead',
        website: row[websiteCol] || '',
        contactName: row[nameCol] || '',
        email: row[emailCol] || '',
        city: row[cityCol] || '',
        phone: row[phoneCol] || '',
      }));

      const res = await fetch('/api/partner/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leads: payloadLeads }),
      });
      const data = await res.json();
      if (res.ok) {
        setBanner({
          message: `Successfully imported ${data.count} leads directly into your partner allotment.`,
          type: 'success',
        });
        setShowImportModal(false);
        setCsvFile(null);
        setCsvResult(null);
        loadPartnerData();
      } else {
        alert(data.error || 'Failed to import CSV');
      }
    } catch (err: any) {
      alert(`Import error: ${err.message}`);
    } finally {
      setImportingCsv(false);
    }
  };

  // Recipients for Outreach Studio
  const candidateRecipients = useMemo(() => {
    const baseList = selectedIds.size > 0 ? leads.filter((l) => selectedIds.has(l.id)) : readyLeads;
    return baseList.map((lead) => {
      const email = lead.general_business_email || lead.contacts?.[0]?.email_address || '';
      const contactName = lead.contacts?.[0]?.contact_name || '';
      const firstName = contactName ? contactName.split(' ')[0] : 'there';
      return {
        id: lead.id,
        email,
        company_name: lead.display_name,
        contact_name: contactName,
        first_name: firstName,
        city: lead.city || 'your area',
        partner_name: partner?.name || 'Partner',
        partner_company: partner?.company || 'Partner Office',
      };
    });
  }, [leads, selectedIds, readyLeads, partner]);

  // Test Send Handler
  const handleSendTestEmail = async () => {
    setSendingTest(true);
    setTestResult(null);
    try {
      const sample = candidateRecipients[0] || {
        first_name: partner?.name.split(' ')[0] || 'Partner',
        company_name: 'Acme Enterprises',
        city: 'Bengaluru',
        partner_name: partner?.name || 'Partner',
        partner_company: partner?.company || 'Partner Office',
      };

      const res = await fetch('/api/partner/outreach/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template,
          recipients: [sample],
          isTest: true,
          recipientOverride: testEmailOverride.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setTestResult({
          success: true,
          message: `Test email dispatched to ${data.sentTo}. Please check your inbox.`,
        });
      } else {
        setTestResult({
          success: false,
          message: data.error || 'Test email failed to deliver. Please verify settings.',
        });
      }
    } catch (err: any) {
      setTestResult({ success: false, message: `Error: ${err.message}` });
    } finally {
      setSendingTest(false);
    }
  };

  // Live Bulk Dispatch Handler
  const handleLaunchLiveDispatch = async () => {
    if (candidateRecipients.length === 0) return;
    setDispatchingLive(true);
    setDispatchResults(null);
    try {
      const res = await fetch('/api/partner/outreach/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template,
          recipients: candidateRecipients,
          cadence,
          skipPreviouslyContacted: skipDuplicates,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setDispatchResults(data);
        loadPartnerData();
      } else {
        alert(data.error || 'Dispatch failed');
      }
    } catch (err: any) {
      alert(`Error during dispatch: ${err.message}`);
    } finally {
      setDispatchingLive(false);
    }
  };

  // ----------------------------------------------------
  // RENDER: Loading or Unauthenticated State
  // ----------------------------------------------------
  if (authChecking) {
    return (
      <div className="min-h-screen bg-[#f7f7f5] dark:bg-[#171916] flex items-center justify-center p-6 text-[#20211f] dark:text-[#f1f2ee]">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-[#4f6653]/10 dark:bg-white/10 flex items-center justify-center text-[#4f6653] dark:text-[#afc6ad] animate-pulse">
            <Users className="w-6 h-6" />
          </div>
          <p className="text-sm font-medium opacity-80">Connecting to Partner Portal...</p>
        </div>
      </div>
    );
  }

  // Login Screen if Unauthenticated
  if (!partner) {
    return (
      <div className="min-h-screen bg-[#f7f7f5] dark:bg-[#171916] flex items-center justify-center p-6 text-[#20211f] dark:text-[#f1f2ee]">
        <div className="w-full max-w-md bg-white dark:bg-[#1e211d] rounded-2xl border border-[#dfe2dc] dark:border-white/10 p-8 shadow-xl space-y-6">
          <div className="flex flex-col items-center text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center mb-1">
              <Users className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-serif font-bold tracking-tight">Evee Partner Portal</h1>
            <p className="text-xs text-[#777a74] dark:text-[#a2a69e] max-w-xs">
              Sign in with your private access key to access your allotted lead directory, AI enrichment tools, and outreach suite.
            </p>
          </div>

          {authError && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{authError}</span>
            </div>
          )}

          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#777a74] dark:text-[#a2a69e] mb-1.5">
                Partner Access Key
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-[#777a74] dark:text-[#a2a69e] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  placeholder="e.g. prt_key_..."
                  value={accessKeyInput}
                  onChange={(e) => setAccessKeyInput(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-[#dfe2dc] dark:border-white/10 bg-white dark:bg-[#252824] text-[#20211f] dark:text-[#f1f2ee] placeholder-[#959494] focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoggingIn || !accessKeyInput.trim()}
              className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-medium text-sm transition shadow-sm disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isLoggingIn ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Verifying Credentials...</span>
                </>
              ) : (
                <>
                  <span>Sign In to Partner Portal</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="pt-4 border-t border-[#dfe2dc] dark:border-white/10 text-center">
            <p className="text-[11px] text-[#777a74] dark:text-[#a2a69e]">
              Need access or lost your key? Contact your workspace administrator to receive your one-click invite link.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------
  // RENDER: Authenticated Partner Portal Workspace
  // ----------------------------------------------------
  return (
    <div className="min-h-screen bg-[#f7f7f5] dark:bg-[#171916] text-[#20211f] dark:text-[#f1f2ee] font-sans antialiased pb-24">
      {/* Dedicated Partner Portal Header */}
      <header className="sticky top-0 z-40 bg-[#f7f7f5]/95 dark:bg-[#171916]/95 backdrop-blur-md border-b border-[#e8e9e5] dark:border-white/[0.08]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3.5">
            <div className="w-9 h-9 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-sm">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-serif font-bold text-base tracking-tight">Evee</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20">
                  PARTNER PORTAL
                </span>
              </div>
              <p className="text-[11px] text-[#777a74] dark:text-[#a2a69e] truncate max-w-xs">
                {partner.name} • {partner.company || 'Dedicated Sub-Portal'}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <div className="hidden sm:flex flex-col text-right">
              <span className="text-xs font-semibold">{partner.name}</span>
              <span className="text-[11px] text-[#777a74] dark:text-[#a2a69e] font-mono">{partner.email}</span>
            </div>
            <button
              onClick={handleLogout}
              title="Sign Out of Partner Portal"
              className="p-2 rounded-xl border border-[#dfe2dc] dark:border-white/10 hover:bg-white dark:hover:bg-[#252824] text-[#777a74] dark:text-[#a2a69e] hover:text-rose-600 transition"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Workspace Body */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-8">
        {/* Banner Alert if any */}
        {banner && (
          <div
            className={`p-4 rounded-2xl border text-xs flex items-center justify-between shadow-sm ${
              banner.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-800 dark:text-emerald-200'
                : 'bg-rose-500/10 border-rose-500/20 text-rose-800 dark:text-rose-200'
            }`}
          >
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span className="font-medium">{banner.message}</span>
            </div>
            <button onClick={() => setBanner(null)} className="opacity-70 hover:opacity-100">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Welcome & KPI Strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-[#1e211d] p-5 rounded-2xl border border-[#dfe2dc] dark:border-white/10 shadow-sm">
            <div className="flex items-center justify-between text-xs text-[#777a74] dark:text-[#a2a69e] mb-1.5 font-medium">
              <span>Allotted Leads</span>
              <Users className="w-4 h-4 text-purple-500" />
            </div>
            <div className="text-2xl font-bold font-mono text-[#20211f] dark:text-[#f1f2ee]">{leads.length}</div>
            <div className="text-[11px] text-[#777a74] dark:text-[#a2a69e] mt-1">Assigned to your portal</div>
          </div>

          <div className="bg-white dark:bg-[#1e211d] p-5 rounded-2xl border border-[#dfe2dc] dark:border-white/10 shadow-sm">
            <div className="flex items-center justify-between text-xs text-[#777a74] dark:text-[#a2a69e] mb-1.5 font-medium">
              <span>Ready for Outreach</span>
              <MailCheck className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="text-2xl font-bold font-mono text-[#20211f] dark:text-[#f1f2ee]">{readyLeads.length}</div>
            <div className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1">Verified contact email ready</div>
          </div>

          <div className="bg-white dark:bg-[#1e211d] p-5 rounded-2xl border border-[#dfe2dc] dark:border-white/10 shadow-sm">
            <div className="flex items-center justify-between text-xs text-[#777a74] dark:text-[#a2a69e] mb-1.5 font-medium">
              <span>Needs Enrichment</span>
              <Sparkles className="w-4 h-4 text-amber-500" />
            </div>
            <div className="text-2xl font-bold font-mono text-[#20211f] dark:text-[#f1f2ee]">
              {missingEmailLeads.length}
            </div>
            <div className="text-[11px] text-amber-600 dark:text-amber-400 mt-1">Auto-crawlable via Gemini AI</div>
          </div>

          <div className="bg-white dark:bg-[#1e211d] p-5 rounded-2xl border border-[#dfe2dc] dark:border-white/10 shadow-sm">
            <div className="flex items-center justify-between text-xs text-[#777a74] dark:text-[#a2a69e] mb-1.5 font-medium">
              <span>Outreach Sent</span>
              <Send className="w-4 h-4 text-blue-500" />
            </div>
            <div className="text-2xl font-bold font-mono text-[#20211f] dark:text-[#f1f2ee]">
              {contactedLeads.length}
            </div>
            <div className="text-[11px] text-blue-600 dark:text-blue-400 mt-1">Contacted & protected</div>
          </div>
        </div>

        {/* Action Toolbar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => setShowAddLeadModal(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold transition shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Add Lead</span>
            </button>

            <button
              onClick={() => setShowImportModal(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-[#dfe2dc] dark:border-white/10 bg-white dark:bg-[#1e211d] hover:bg-[#f4f5f2] dark:hover:bg-white/[0.05] text-xs font-semibold text-[#20211f] dark:text-[#f1f2ee] transition shadow-sm"
            >
              <FileSpreadsheet className="w-4 h-4 text-[#777a74] dark:text-[#a2a69e]" />
              <span>Import CSV</span>
            </button>

            <button
              onClick={() => handleAiEnrichMissing()}
              disabled={isEnrichingAi || missingEmailLeads.length === 0}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-xs font-semibold text-amber-800 dark:text-amber-200 transition shadow-sm disabled:opacity-50"
              title="Automatically crawl official websites, inspect contact records with Gemini AI, and verify MX"
            >
              <Sparkles className={`w-4 h-4 text-amber-600 ${isEnrichingAi ? 'animate-spin' : ''}`} />
              <span>{isEnrichingAi ? 'Enriching with AI...' : `AI Enrich (${missingEmailLeads.length})`}</span>
            </button>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setOutreachStep('recipients');
                setTestResult(null);
                setDispatchResults(null);
                setShowOutreachModal(true);
              }}
              disabled={readyLeads.length === 0 && selectedIds.size === 0}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#4f6653] hover:bg-[#405444] text-white text-xs font-semibold transition shadow-sm disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              <span>Start Outreach</span>
              {selectedIds.size > 0 ? (
                <span className="px-2 py-0.5 rounded-full bg-white/20 text-white font-mono text-[10px]">
                  {selectedIds.size}
                </span>
              ) : readyLeads.length > 0 ? (
                <span className="px-2 py-0.5 rounded-full bg-white/20 text-white font-mono text-[10px]">
                  {readyLeads.length}
                </span>
              ) : null}
            </button>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-[#777a74] dark:text-[#a2a69e] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search companies, emails, cities..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm rounded-xl border border-[#dfe2dc] dark:border-white/10 bg-white dark:bg-[#1e211d] text-[#20211f] dark:text-[#f1f2ee] placeholder-[#959494] focus:outline-none focus:ring-1 focus:ring-purple-500"
            />
          </div>

          <div className="inline-flex items-center gap-1 p-1 bg-[#edebe8] dark:bg-[#252824] rounded-xl border border-[#dfe2dc]/70 dark:border-white/5 overflow-x-auto no-scrollbar">
            {[
              { id: 'all', label: 'All Allotted', count: leads.length },
              { id: 'ready', label: 'Ready to Contact', count: readyLeads.length },
              { id: 'missing', label: 'Needs Email', count: missingEmailLeads.length },
              { id: 'sent', label: 'Contacted', count: contactedLeads.length },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id as any)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition whitespace-nowrap ${
                  statusFilter === tab.id
                    ? 'bg-white dark:bg-[#1e211d] text-[#20211f] dark:text-white shadow-sm font-semibold'
                    : 'text-[#777a74] dark:text-[#a2a69e] hover:text-[#20211f] dark:hover:text-white'
                }`}
              >
                <span>{tab.label}</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full font-mono bg-purple-500/10 text-purple-700 dark:text-purple-300">
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Leads Table Container */}
        <div className="bg-white dark:bg-[#1e211d] rounded-2xl border border-[#dfe2dc] dark:border-white/10 overflow-hidden shadow-sm">
          {loadingData ? (
            <div className="py-20 flex flex-col items-center justify-center space-y-3 text-[#777a74] dark:text-[#a2a69e]">
              <RefreshCw className="w-6 h-6 animate-spin text-purple-600" />
              <p className="text-xs">Loading allotted leads...</p>
            </div>
          ) : filteredLeads.length === 0 ? (
            <div className="py-20 text-center px-4">
              <Building2 className="w-10 h-10 text-[#959494] mx-auto mb-3 opacity-60" />
              <h3 className="font-semibold text-base mb-1">No leads found</h3>
              <p className="text-xs text-[#777a74] dark:text-[#a2a69e] max-w-sm mx-auto mb-4">
                {search
                  ? `No leads matched "${search}". Try clearing your search filter.`
                  : 'You do not have any leads in this filter. Add your own leads or import a CSV to begin.'}
              </p>
              <button
                onClick={() => setShowAddLeadModal(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600 text-white text-xs font-semibold transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Your First Lead</span>
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[#e8e9e5] dark:border-white/[0.08] text-[11px] font-semibold uppercase tracking-wider text-[#777a74] dark:text-[#a2a69e] bg-[#fbfbfa] dark:bg-white/[0.02]">
                    <th className="py-3 px-4 w-10">
                      <input
                        type="checkbox"
                        checked={selectedIds.size === filteredLeads.length && filteredLeads.length > 0}
                        onChange={handleToggleSelectAll}
                        className="rounded text-purple-600 focus:ring-0 w-3.5 h-3.5"
                      />
                    </th>
                    <th className="py-3 px-4">Company</th>
                    <th className="py-3 px-4">Contact & Email</th>
                    <th className="py-3 px-4">Location</th>
                    <th className="py-3 px-4">Outreach Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e8e9e5] dark:divide-white/[0.05]">
                  {filteredLeads.map((lead) => {
                    const hasEmail = Boolean(lead.general_business_email || lead.contacts?.[0]?.email_address);
                    const email = lead.general_business_email || lead.contacts?.[0]?.email_address;
                    const contactName = lead.contacts?.[0]?.contact_name;
                    const sent = isLeadSent(lead);

                    return (
                      <tr
                        key={lead.id}
                        className={`hover:bg-[#f7f7f5]/80 dark:hover:bg-white/[0.02] transition ${
                          selectedIds.has(lead.id) ? 'bg-purple-500/[0.04]' : ''
                        }`}
                      >
                        <td className="py-3.5 px-4">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(lead.id)}
                            onChange={() => handleToggleSelect(lead.id)}
                            className="rounded text-purple-600 focus:ring-0 w-3.5 h-3.5"
                          />
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-700 dark:text-purple-300 font-bold text-xs flex items-center justify-center shrink-0">
                              {lead.display_name?.slice(0, 2).toUpperCase() || 'CO'}
                            </div>
                            <div className="min-w-0">
                              <div className="font-semibold text-sm text-[#20211f] dark:text-[#f1f2ee] truncate">
                                {lead.display_name}
                              </div>
                              {lead.official_website_url && (
                                <a
                                  href={
                                    lead.official_website_url.startsWith('http')
                                      ? lead.official_website_url
                                      : `https://${lead.official_website_url}`
                                  }
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-[#777a74] dark:text-[#a2a69e] hover:underline flex items-center gap-1 mt-0.5 truncate max-w-xs"
                                >
                                  <span>{lead.official_website_url.replace(/^https?:\/\//, '')}</span>
                                  <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                                </a>
                              )}
                            </div>
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          {hasEmail ? (
                            <div>
                              <div className="flex items-center space-x-1.5 text-xs text-[#20211f] dark:text-[#f1f2ee]">
                                <Mail className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                                <span className="font-mono">{email}</span>
                              </div>
                              {contactName && (
                                <div className="text-[11px] text-[#777a74] dark:text-[#a2a69e] mt-0.5">
                                  {contactName}
                                </div>
                              )}
                            </div>
                          ) : (
                            <button
                              onClick={() => handleAiEnrichMissing(lead.id)}
                              disabled={isEnrichingAi}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-800 dark:text-amber-200 text-xs font-medium transition"
                            >
                              <Sparkles className="w-3 h-3 text-amber-500" />
                              <span>Find Email with AI</span>
                            </button>
                          )}
                        </td>

                        <td className="py-3.5 px-4 text-xs text-[#777a74] dark:text-[#a2a69e]">
                          <div className="flex items-center gap-1">
                            <MapPin className="w-3 h-3 opacity-60 shrink-0" />
                            <span>{lead.city || 'Unknown'}</span>
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          {sent ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20">
                              <MailCheck className="w-3 h-3 text-blue-500" />
                              <span>CONTACTED</span>
                            </span>
                          ) : hasEmail ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                              <Check className="w-3 h-3 text-emerald-500" />
                              <span>READY</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20">
                              <Clock className="w-3 h-3 text-amber-500" />
                              <span>NEEDS EMAIL</span>
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <button
                            onClick={() => {
                              setEnrichTarget(lead);
                              setEnrichForm({
                                email: email || '',
                                contactName: contactName || '',
                                phone: lead.public_business_phone || '',
                                website: lead.official_website_url || '',
                              });
                              setShowManualEnrichModal(true);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-[#dfe2dc] dark:border-white/10 hover:bg-[#f4f5f2] dark:hover:bg-white/[0.05] text-xs font-medium text-[#777a74] dark:text-[#a2a69e] hover:text-[#20211f] dark:hover:text-white transition"
                            title="Edit contact person and email manually"
                          >
                            <Edit3 className="w-3 h-3" />
                            <span>Edit</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* ---------------------------------------------------- */}
      {/* MODAL: Add Single Lead */}
      {/* ---------------------------------------------------- */}
      {showAddLeadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#1e211d] border border-[#e8e9e5] dark:border-white/10 rounded-2xl w-full max-w-lg p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#e8e9e5] dark:border-white/[0.08]">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-600 flex items-center justify-center">
                  <Plus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-semibold text-base">Add Lead to My Portal</h3>
                  <p className="text-xs text-[#777a74] dark:text-[#a2a69e]">
                    Save a new prospect automatically allotted to your workspace.
                  </p>
                </div>
              </div>
              <button onClick={() => setShowAddLeadModal(false)} className="p-1.5 text-[#959494] hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveSingleLead} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#777a74] dark:text-[#a2a69e] mb-1">
                  Company Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Apex Legal Consulting"
                  value={newLead.companyName}
                  onChange={(e) => setNewLead({ ...newLead, companyName: e.target.value })}
                  className="w-full text-sm rounded-xl border border-[#dfe2dc] dark:border-white/10 bg-white dark:bg-[#252824] px-3.5 py-2 text-[#20211f] dark:text-[#f1f2ee] focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#777a74] dark:text-[#a2a69e] mb-1">
                    Official Website
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. https://apexlegal.com"
                    value={newLead.website}
                    onChange={(e) => setNewLead({ ...newLead, website: e.target.value })}
                    className="w-full text-sm rounded-xl border border-[#dfe2dc] dark:border-white/10 bg-white dark:bg-[#252824] px-3.5 py-2 text-[#20211f] dark:text-[#f1f2ee] focus:outline-none focus:ring-1 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#777a74] dark:text-[#a2a69e] mb-1">
                    City / Region
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Bengaluru"
                    value={newLead.city}
                    onChange={(e) => setNewLead({ ...newLead, city: e.target.value })}
                    className="w-full text-sm rounded-xl border border-[#dfe2dc] dark:border-white/10 bg-white dark:bg-[#252824] px-3.5 py-2 text-[#20211f] dark:text-[#f1f2ee] focus:outline-none focus:ring-1 focus:ring-purple-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#777a74] dark:text-[#a2a69e] mb-1">
                    Contact Person Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Ramesh Sharma"
                    value={newLead.contactName}
                    onChange={(e) => setNewLead({ ...newLead, contactName: e.target.value })}
                    className="w-full text-sm rounded-xl border border-[#dfe2dc] dark:border-white/10 bg-white dark:bg-[#252824] px-3.5 py-2 text-[#20211f] dark:text-[#f1f2ee] focus:outline-none focus:ring-1 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#777a74] dark:text-[#a2a69e] mb-1">
                    Contact Email Address
                  </label>
                  <input
                    type="email"
                    placeholder="e.g. ramesh@apexlegal.com"
                    value={newLead.email}
                    onChange={(e) => setNewLead({ ...newLead, email: e.target.value })}
                    className="w-full text-sm rounded-xl border border-[#dfe2dc] dark:border-white/10 bg-white dark:bg-[#252824] px-3.5 py-2 text-[#20211f] dark:text-[#f1f2ee] focus:outline-none focus:ring-1 focus:ring-purple-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#e8e9e5] dark:border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => setShowAddLeadModal(false)}
                  className="px-3.5 py-2 rounded-xl border border-[#dfe2dc] dark:border-white/10 hover:bg-[#f4f5f2] dark:hover:bg-white/[0.05] text-xs font-medium transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingLead || !newLead.companyName.trim()}
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold transition disabled:opacity-50 flex items-center gap-1.5"
                >
                  {savingLead ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  <span>Save Lead</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* MODAL: Manual Enrich / Edit Contact */}
      {/* ---------------------------------------------------- */}
      {showManualEnrichModal && enrichTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#1e211d] border border-[#e8e9e5] dark:border-white/10 rounded-2xl w-full max-w-lg p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#e8e9e5] dark:border-white/[0.08]">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-600 flex items-center justify-center">
                  <Edit3 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-semibold text-base">Edit Contact Details</h3>
                  <p className="text-xs text-[#777a74] dark:text-[#a2a69e] truncate max-w-xs">
                    {enrichTarget.display_name}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowManualEnrichModal(false);
                  setEnrichTarget(null);
                }}
                className="p-1.5 text-[#959494] hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveManualEnrich} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#777a74] dark:text-[#a2a69e] mb-1">
                  Contact Person Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Priya Nair"
                  value={enrichForm.contactName}
                  onChange={(e) => setEnrichForm({ ...enrichForm, contactName: e.target.value })}
                  className="w-full text-sm rounded-xl border border-[#dfe2dc] dark:border-white/10 bg-white dark:bg-[#252824] px-3.5 py-2 text-[#20211f] dark:text-[#f1f2ee] focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#777a74] dark:text-[#a2a69e] mb-1">
                  Verified Email Address
                </label>
                <input
                  type="email"
                  placeholder="e.g. priya@company.com"
                  value={enrichForm.email}
                  onChange={(e) => setEnrichForm({ ...enrichForm, email: e.target.value })}
                  className="w-full text-sm rounded-xl border border-[#dfe2dc] dark:border-white/10 bg-white dark:bg-[#252824] px-3.5 py-2 text-[#20211f] dark:text-[#f1f2ee] focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#777a74] dark:text-[#a2a69e] mb-1">
                    Phone Number
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. +91 98765 43210"
                    value={enrichForm.phone}
                    onChange={(e) => setEnrichForm({ ...enrichForm, phone: e.target.value })}
                    className="w-full text-sm rounded-xl border border-[#dfe2dc] dark:border-white/10 bg-white dark:bg-[#252824] px-3.5 py-2 text-[#20211f] dark:text-[#f1f2ee] focus:outline-none focus:ring-1 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#777a74] dark:text-[#a2a69e] mb-1">Website</label>
                  <input
                    type="text"
                    placeholder="e.g. https://domain.com"
                    value={enrichForm.website}
                    onChange={(e) => setEnrichForm({ ...enrichForm, website: e.target.value })}
                    className="w-full text-sm rounded-xl border border-[#dfe2dc] dark:border-white/10 bg-white dark:bg-[#252824] px-3.5 py-2 text-[#20211f] dark:text-[#f1f2ee] focus:outline-none focus:ring-1 focus:ring-purple-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#e8e9e5] dark:border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => {
                    setShowManualEnrichModal(false);
                    setEnrichTarget(null);
                  }}
                  className="px-3.5 py-2 rounded-xl border border-[#dfe2dc] dark:border-white/10 hover:bg-[#f4f5f2] dark:hover:bg-white/[0.05] text-xs font-medium transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEnrichment}
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold transition disabled:opacity-50 flex items-center gap-1.5"
                >
                  {savingEnrichment ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Check className="w-3.5 h-3.5" />
                  )}
                  <span>Save Contact</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* MODAL: CSV Import */}
      {/* ---------------------------------------------------- */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#1e211d] border border-[#e8e9e5] dark:border-white/10 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#e8e9e5] dark:border-white/[0.08]">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-600 flex items-center justify-center">
                  <FileSpreadsheet className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-semibold text-base">Import CSV to Partner Portal</h3>
                  <p className="text-xs text-[#777a74] dark:text-[#a2a69e]">
                    Uploaded leads will be automatically allotted to your workspace.
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowImportModal(false);
                  setCsvFile(null);
                  setCsvResult(null);
                }}
                className="p-1.5 text-[#959494] hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {!csvResult ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-[#dfe2dc] dark:border-white/10 hover:border-purple-500 rounded-2xl p-8 text-center cursor-pointer transition bg-[#fbfbfa] dark:bg-white/[0.02]"
              >
                <UploadCloud className="w-10 h-10 text-purple-600 mx-auto mb-2 opacity-80" />
                <p className="text-sm font-semibold mb-1">Click to select or drop CSV file</p>
                <p className="text-xs text-[#777a74] dark:text-[#a2a69e]">
                  Supports standard columns like Company, Website, Contact Name, Email, City
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileSelected}
                  className="hidden"
                />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-xl text-xs flex items-center justify-between text-purple-900 dark:text-purple-200">
                  <span>
                    Detected <strong>{csvResult.rows.length} records</strong> across{' '}
                    <strong>{csvResult.headers.length} columns</strong> in {csvFile?.name}
                  </span>
                  <button
                    onClick={() => {
                      setCsvResult(null);
                      setCsvFile(null);
                    }}
                    className="text-xs underline hover:opacity-80"
                  >
                    Change file
                  </button>
                </div>

                <div className="space-y-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-[#777a74] dark:text-[#a2a69e]">
                    Map CSV Columns
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="block text-[#777a74] dark:text-[#a2a69e] mb-1 font-medium">
                        Company Name <span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={mapping.companyName || ''}
                        onChange={(e) => setMapping({ ...mapping, companyName: e.target.value })}
                        className="w-full text-xs rounded-xl border border-[#dfe2dc] dark:border-white/10 bg-white dark:bg-[#252824] p-2"
                      >
                        <option value="">-- Choose Column --</option>
                        {csvResult.headers.map((h: string) => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[#777a74] dark:text-[#a2a69e] mb-1 font-medium">
                        Email Address
                      </label>
                      <select
                        value={mapping.email || ''}
                        onChange={(e) => setMapping({ ...mapping, email: e.target.value })}
                        className="w-full text-xs rounded-xl border border-[#dfe2dc] dark:border-white/10 bg-white dark:bg-[#252824] p-2"
                      >
                        <option value="">-- Choose Column --</option>
                        {csvResult.headers.map((h: string) => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[#777a74] dark:text-[#a2a69e] mb-1 font-medium">Contact Person</label>
                      <select
                        value={mapping.contactName || ''}
                        onChange={(e) => setMapping({ ...mapping, contactName: e.target.value })}
                        className="w-full text-xs rounded-xl border border-[#dfe2dc] dark:border-white/10 bg-white dark:bg-[#252824] p-2"
                      >
                        <option value="">-- Choose Column --</option>
                        {csvResult.headers.map((h: string) => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[#777a74] dark:text-[#a2a69e] mb-1 font-medium">
                        Website Domain
                      </label>
                      <select
                        value={mapping.website || ''}
                        onChange={(e) => setMapping({ ...mapping, website: e.target.value })}
                        className="w-full text-xs rounded-xl border border-[#dfe2dc] dark:border-white/10 bg-white dark:bg-[#252824] p-2"
                      >
                        <option value="">-- Choose Column --</option>
                        {csvResult.headers.map((h: string) => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[#777a74] dark:text-[#a2a69e] mb-1 font-medium">City</label>
                      <select
                        value={mapping.city || ''}
                        onChange={(e) => setMapping({ ...mapping, city: e.target.value })}
                        className="w-full text-xs rounded-xl border border-[#dfe2dc] dark:border-white/10 bg-white dark:bg-[#252824] p-2"
                      >
                        <option value="">-- Choose Column --</option>
                        {csvResult.headers.map((h: string) => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#e8e9e5] dark:border-white/[0.08]">
                  <button
                    type="button"
                    onClick={() => {
                      setShowImportModal(false);
                      setCsvResult(null);
                    }}
                    className="px-3.5 py-2 rounded-xl border border-[#dfe2dc] dark:border-white/10 hover:bg-[#f4f5f2] dark:hover:bg-white/[0.05] text-xs font-medium transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleExecuteCsvImport}
                    disabled={importingCsv || !mapping.companyName}
                    className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold transition disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {importingCsv ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <UploadCloud className="w-3.5 h-3.5" />
                    )}
                    <span>Import {csvResult.rows.length} Leads</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* MODAL: Outreach Studio (4 Steps) */}
      {/* ---------------------------------------------------- */}
      {showOutreachModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#1e211d] border border-[#e8e9e5] dark:border-white/10 rounded-2xl w-full max-w-3xl max-h-[92vh] overflow-y-auto p-6 space-y-6 shadow-2xl">
            {/* Header with Steps */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[#e8e9e5] dark:border-white/[0.08] gap-3">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#4f6653]/10 text-[#4f6653] dark:text-[#afc6ad] flex items-center justify-center">
                  <Send className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-semibold text-base">Direct Outreach Studio</h3>
                  <p className="text-xs text-[#777a74] dark:text-[#a2a69e]">
                    Personalized 1-to-1 email outreach to your allotted leads.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowOutreachModal(false)}
                className="p-1.5 text-[#959494] hover:text-white rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Step Indicator */}
            <div className="flex items-center justify-between border-b border-[#e8e9e5] dark:border-white/[0.08] pb-3 text-xs">
              {[
                { id: 'recipients', label: '1. Prospects', count: candidateRecipients.length },
                { id: 'compose', label: '2. Compose', count: null },
                { id: 'test', label: '3. Test Send', count: null },
                { id: 'dispatch', label: '4. Live Dispatch', count: null },
              ].map((step, idx) => (
                <button
                  key={step.id}
                  onClick={() => setOutreachStep(step.id as any)}
                  className={`font-semibold flex items-center gap-1.5 ${
                    outreachStep === step.id
                      ? 'text-[#4f6653] dark:text-[#afc6ad]'
                      : 'text-[#959494] hover:text-[#20211f] dark:hover:text-white'
                  }`}
                >
                  <span>{step.label}</span>
                  {step.count !== null && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full font-mono bg-[#4f6653]/10">
                      {step.count}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* STEP 1: Candidate Prospects */}
            {outreachStep === 'recipients' && (
              <div className="space-y-4">
                <div className="p-3.5 rounded-xl bg-[#f7f7f5] dark:bg-white/[0.02] border border-[#dfe2dc] dark:border-white/5 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-semibold">
                      {candidateRecipients.length} target prospects selected for this outreach run.
                    </span>
                    <span className="text-[11px] text-[#777a74] dark:text-[#a2a69e] block">
                      All prospects belong strictly to your partner allocation.
                    </span>
                  </div>
                  <button
                    onClick={() => setOutreachStep('compose')}
                    className="px-4 py-1.5 rounded-lg bg-[#4f6653] hover:bg-[#405444] text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm"
                  >
                    <span>Next: Compose</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="max-h-60 overflow-y-auto rounded-xl border border-[#dfe2dc] dark:border-white/10 divide-y divide-[#dfe2dc] dark:divide-white/5 text-xs">
                  {candidateRecipients.map((c, i) => (
                    <div key={i} className="p-3 flex items-center justify-between">
                      <div>
                        <span className="font-semibold">{c.company_name}</span>
                        <span className="text-[11px] text-[#777a74] dark:text-[#a2a69e] ml-2 font-mono">
                          {c.email}
                        </span>
                      </div>
                      <span className="text-[11px] text-[#777a74] dark:text-[#a2a69e]">{c.city}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* STEP 2: Compose Template with AI Variable Tokens */}
            {outreachStep === 'compose' && (
              <div className="space-y-4">
                <div className="flex flex-wrap gap-1.5 text-[11px] p-2.5 bg-[#f7f7f5] dark:bg-white/[0.03] rounded-xl border border-[#dfe2dc] dark:border-white/5">
                  <span className="font-semibold opacity-70">Insert Variable Tokens:</span>
                  {[
                    '{{company_name}}',
                    '{{first_name}}',
                    '{{contact_name}}',
                    '{{city}}',
                    '{{partner_name}}',
                    '{{partner_company}}',
                  ].map((tok) => (
                    <button
                      key={tok}
                      type="button"
                      onClick={() => setTemplate({ ...template, bodyText: template.bodyText + ' ' + tok })}
                      className="px-2 py-0.5 rounded-md bg-white dark:bg-[#252824] border border-[#dfe2dc] dark:border-white/10 font-mono text-[10px] hover:border-purple-500"
                    >
                      {tok}
                    </button>
                  ))}
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#777a74] dark:text-[#a2a69e] mb-1">
                    Email Subject
                  </label>
                  <input
                    type="text"
                    value={template.subject}
                    onChange={(e) => setTemplate({ ...template, subject: e.target.value })}
                    className="w-full text-sm rounded-xl border border-[#dfe2dc] dark:border-white/10 bg-white dark:bg-[#252824] px-3.5 py-2 font-medium focus:outline-none focus:ring-1 focus:ring-[#4f6653]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#777a74] dark:text-[#a2a69e] mb-1">
                    Email Message Body
                  </label>
                  <textarea
                    rows={8}
                    value={template.bodyText}
                    onChange={(e) => setTemplate({ ...template, bodyText: e.target.value })}
                    className="w-full text-sm rounded-xl border border-[#dfe2dc] dark:border-white/10 bg-white dark:bg-[#252824] p-3.5 font-sans leading-relaxed focus:outline-none focus:ring-1 focus:ring-[#4f6653]"
                  />
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-[#e8e9e5] dark:border-white/[0.08]">
                  <button
                    onClick={() => setOutreachStep('recipients')}
                    className="px-3.5 py-2 rounded-xl border border-[#dfe2dc] dark:border-white/10 text-xs font-medium"
                  >
                    Back to Prospects
                  </button>
                  <button
                    onClick={() => setOutreachStep('test')}
                    className="px-4 py-2 rounded-xl bg-[#4f6653] hover:bg-[#405444] text-white text-xs font-semibold flex items-center gap-1.5"
                  >
                    <span>Next: Test Send</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3: Test Send to Self */}
            {outreachStep === 'test' && (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/20 text-xs text-purple-900 dark:text-purple-200">
                  <span className="font-semibold block mb-1">Verify Your Email Formatting</span>
                  <p>
                    Send a safe test email to yourself or a colleague before dispatching to your allotted leads.
                    All tokens will be rendered with sample prospect details.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#777a74] dark:text-[#a2a69e] mb-1">
                    Send Test Email To:
                  </label>
                  <input
                    type="email"
                    placeholder={`Your email (${partner.email})`}
                    value={testEmailOverride}
                    onChange={(e) => setTestEmailOverride(e.target.value)}
                    className="w-full text-sm rounded-xl border border-[#dfe2dc] dark:border-white/10 bg-white dark:bg-[#252824] px-3.5 py-2"
                  />
                </div>

                {testResult && (
                  <div
                    className={`p-3.5 rounded-xl border text-xs flex items-center gap-2 ${
                      testResult.success
                        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-800 dark:text-emerald-200'
                        : 'bg-rose-500/10 border-rose-500/20 text-rose-800 dark:text-rose-200'
                    }`}
                  >
                    {testResult.success ? (
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 shrink-0" />
                    )}
                    <span>{testResult.message}</span>
                  </div>
                )}

                <div className="flex items-center justify-between pt-3 border-t border-[#e8e9e5] dark:border-white/[0.08]">
                  <button
                    onClick={() => setOutreachStep('compose')}
                    className="px-3.5 py-2 rounded-xl border border-[#dfe2dc] dark:border-white/10 text-xs font-medium"
                  >
                    Back to Compose
                  </button>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleSendTestEmail}
                      disabled={sendingTest}
                      className="px-4 py-2 rounded-xl border border-[#4f6653] text-[#4f6653] dark:text-[#afc6ad] hover:bg-[#4f6653]/10 text-xs font-semibold flex items-center gap-1.5 transition disabled:opacity-50"
                    >
                      {sendingTest ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                      <span>{sendingTest ? 'Sending Test...' : 'Send Test to Me'}</span>
                    </button>
                    <button
                      onClick={() => setOutreachStep('dispatch')}
                      className="px-4 py-2 rounded-xl bg-[#4f6653] hover:bg-[#405444] text-white text-xs font-semibold flex items-center gap-1.5"
                    >
                      <span>Proceed to Live Dispatch</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 4: Live Dispatch Configuration */}
            {outreachStep === 'dispatch' && (
              <div className="space-y-5">
                {!dispatchResults ? (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="p-4 rounded-xl border border-[#dfe2dc] dark:border-white/10 bg-[#fbfbfa] dark:bg-white/[0.02] space-y-2">
                        <label className="text-xs font-semibold uppercase tracking-wider text-[#777a74] dark:text-[#a2a69e] block">
                          Sending Cadence
                        </label>
                        <select
                          value={cadence}
                          onChange={(e) => setCadence(e.target.value as any)}
                          className="w-full text-xs rounded-xl border border-[#dfe2dc] dark:border-white/10 bg-white dark:bg-[#252824] p-2"
                        >
                          <option value="human">Human Pace (45-90s delays - High Deliverability)</option>
                          <option value="fast">Fast (10s delays)</option>
                        </select>
                        <p className="text-[11px] text-[#777a74] dark:text-[#a2a69e]">
                          Human cadence mimics manual sending, preventing mailbox provider spam flags.
                        </p>
                      </div>

                      <div className="p-4 rounded-xl border border-[#dfe2dc] dark:border-white/10 bg-[#fbfbfa] dark:bg-white/[0.02] space-y-2">
                        <label className="text-xs font-semibold uppercase tracking-wider text-[#777a74] dark:text-[#a2a69e] block">
                          Duplicate Protection
                        </label>
                        <label className="flex items-center space-x-2 text-xs cursor-pointer pt-1">
                          <input
                            type="checkbox"
                            checked={skipDuplicates}
                            onChange={(e) => setSkipDuplicates(e.target.checked)}
                            className="rounded text-purple-600 focus:ring-0 w-4 h-4"
                          />
                          <span className="font-medium">Skip previously contacted leads</span>
                        </label>
                        <p className="text-[11px] text-[#777a74] dark:text-[#a2a69e]">
                          Guarantees that companies you or your workspace already emailed will not be sent duplicate outreach.
                        </p>
                      </div>
                    </div>

                    <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-900 dark:text-emerald-200 flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
                        <div>
                          <span className="font-semibold">Ready to launch outreach campaign</span>
                          <p className="text-[11px] opacity-80">
                            {candidateRecipients.length} emails queued for dispatch from {partner.name} &lt;
                            {partner.email}&gt;.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-[#e8e9e5] dark:border-white/[0.08]">
                      <button
                        onClick={() => setOutreachStep('test')}
                        className="px-3.5 py-2 rounded-xl border border-[#dfe2dc] dark:border-white/10 text-xs font-medium"
                      >
                        Back to Test
                      </button>
                      <button
                        onClick={handleLaunchLiveDispatch}
                        disabled={dispatchingLive || candidateRecipients.length === 0}
                        className="px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold flex items-center gap-2 shadow-lg disabled:opacity-50"
                      >
                        {dispatchingLive ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            <span>Dispatching Emails...</span>
                          </>
                        ) : (
                          <>
                            <Send className="w-4 h-4" />
                            <span>Confirm & Launch Dispatch ({candidateRecipients.length})</span>
                          </>
                        )}
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="space-y-4 text-center py-6">
                    <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-600 mx-auto flex items-center justify-center">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <h3 className="font-bold text-lg">Campaign Dispatch Completed!</h3>
                    <p className="text-xs text-[#777a74] dark:text-[#a2a69e] max-w-sm mx-auto">
                      Delivered {dispatchResults.summary?.sent} emails. {dispatchResults.summary?.skipped} skipped
                      (duplicate protected or suppressed).
                    </p>

                    <button
                      onClick={() => {
                        setShowOutreachModal(false);
                        setDispatchResults(null);
                      }}
                      className="px-5 py-2 rounded-xl bg-purple-600 text-white text-xs font-semibold shadow-sm"
                    >
                      Return to Workspace
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function PartnerPortalPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#f7f7f5] dark:bg-[#171916] flex items-center justify-center p-6 text-[#20211f] dark:text-[#f1f2ee]">
          <div className="flex flex-col items-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-purple-500/10 text-purple-600 flex items-center justify-center animate-pulse">
              <Users className="w-6 h-6" />
            </div>
            <p className="text-sm font-medium opacity-80">Loading Partner Portal...</p>
          </div>
        </div>
      }
    >
      <PartnerPortalContent />
    </Suspense>
  );
}
