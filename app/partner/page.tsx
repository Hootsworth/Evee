'use client';

import { useState, useEffect, useMemo, useRef, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import {
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
  Sun,
  Moon,
} from 'lucide-react';
import { parseAndAnalyzeCsv, CsvColumnMapping, replaceTemplateVariables } from '@/lib/csv/parser';

// Evee's 4-Spoke Radial Spark Mark
function EveeStar({ className = 'w-4 h-4 text-[#cc785c]' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12 2C12.4 7.2 16.8 11.6 22 12C16.8 12.4 12.4 16.8 12 22C11.6 16.8 7.2 12.4 2 12C7.2 11.6 11.6 7.2 12 2Z" />
    </svg>
  );
}

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

  // Dark Mode State (Persisted in localStorage & html class)
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('evee_partner_theme');
      if (saved) return saved === 'dark';
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('evee_partner_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('evee_partner_theme', 'light');
    }
  }, [darkMode]);

  const toggleDarkMode = () => setDarkMode((prev) => !prev);

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
    subject: 'Strategic partnership opportunity for {{company_name}}',
    bodyText:
      'Hi {{first_name}},\n\nI came across {{company_name}} and was really impressed with your expansion in {{city}}. I wanted to connect directly to see if collaborating could support your current initiatives.\n\nWould you be open to a quick 10-minute introductory conversation next week?\n\nWarm regards,\n{{partner_name}}\n{{partner_company}}',
  });
  const [cadence, setCadence] = useState<'human' | 'fast'>('human');
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [testEmailOverride, setTestEmailOverride] = useState('');
  const [sendingTest, setSendingTest] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [dispatchingLive, setDispatchingLive] = useState(false);
  const [dispatchResults, setDispatchResults] = useState<any | null>(null);

  // 1. Verify session or URL key
  const verifySession = async (keyOverride?: string) => {
    setAuthChecking(true);
    setAuthError(null);
    try {
      const urlKey = keyOverride || searchParams.get('key');
      if (urlKey) {
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

      const res = await fetch('/api/partner/auth');
      const data = await res.json();
      if (res.ok && data.authenticated && data.partner) {
        setPartner(data.partner);
        loadPartnerData();
      } else {
        setPartner(null);
      }
    } catch (err: any) {
      console.error('[partner portal] session error:', err);
      setPartner(null);
    } finally {
      setAuthChecking(false);
    }
  };

  useEffect(() => {
    verifySession();
  }, []);

  // 2. Load Partner Leads & Sent History
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
      console.error('[partner portal] data error:', err);
    } finally {
      setLoadingData(false);
    }
  };

  // 3. Login
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
        setAuthError(data.error || 'Invalid partner access key. Please verify with your workspace administrator.');
      }
    } catch (err: any) {
      setAuthError(`Connection error: ${err.message}`);
    } finally {
      setIsLoggingIn(false);
    }
  };

  // 4. Logout
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
    return new Set(sentMessages.map((m) => m.business_id).filter(Boolean));
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

  // Select all / toggle
  const isAllFilteredSelected = filteredLeads.length > 0 && filteredLeads.every((l) => selectedIds.has(l.id));

  const handleToggleSelectAll = () => {
    if (isAllFilteredSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (const l of filteredLeads) next.delete(l.id);
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (const l of filteredLeads) next.add(l.id);
        return next;
      });
    }
  };

  const handleToggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  // Add Single Lead
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

  // Manual Contact Edit
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
    try {
      const body = targetId ? { businessId: targetId } : { enrichAllMissing: true };
      const res = await fetch('/api/partner/leads/enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok) {
        setBanner({
          message: data.summary?.enriched
            ? `AI verified emails for ${data.summary.enriched} leads.`
            : 'Enrichment run complete.',
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

  // Candidates for Outreach Studio
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

  // Test Send
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
          message: data.error || 'Test email failed to deliver.',
        });
      }
    } catch (err: any) {
      setTestResult({ success: false, message: `Error: ${err.message}` });
    } finally {
      setSendingTest(false);
    }
  };

  // Live Bulk Dispatch
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
  // RENDER: Loading State
  // ----------------------------------------------------
  if (authChecking) {
    return (
      <div className="min-h-screen bg-[#faf9f5] dark:bg-[#141413] flex items-center justify-center p-6 text-[#141413] dark:text-[#faf9f5]">
        <div className="flex flex-col items-center space-y-3">
          <EveeStar className="w-8 h-8 text-[#cc785c] animate-pulse" />
          <p className="text-xs font-serif tracking-wide text-[#6c6a64] dark:text-[#a09d96]">
            Connecting to Partner Workspace...
          </p>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------
  // RENDER: Evee Editorial Sign-In Screen
  // ----------------------------------------------------
  if (!partner) {
    return (
      <div className="min-h-screen bg-[#faf9f5] dark:bg-[#141413] flex flex-col justify-between p-6 sm:p-10 text-[#141413] dark:text-[#faf9f5] font-sans transition-colors duration-150">
        {/* Top bar with Evee Star and Theme Switcher */}
        <div className="flex items-center justify-between max-w-5xl mx-auto w-full">
          <div className="flex items-center space-x-2.5">
            <EveeStar className="w-5 h-5 text-[#cc785c]" />
            <span className="font-serif text-base tracking-tight font-normal text-[#141413] dark:text-[#faf9f5]">
              Evee | Partner
            </span>
          </div>

          <button
            onClick={toggleDarkMode}
            title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            className="p-2 rounded-lg border border-[#e6dfd8] dark:border-white/10 hover:bg-[#f5f0e8] dark:hover:bg-[#1f1e1b] text-[#6c6a64] dark:text-[#a09d96] transition"
          >
            {darkMode ? <Sun className="w-4 h-4 text-[#e8a55a]" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>

        {/* Center Login Card */}
        <div className="w-full max-w-md mx-auto my-auto bg-white dark:bg-[#1f1e1b] rounded-xl border border-[#e6dfd8] dark:border-white/10 p-8 sm:p-10 shadow-[0_1px_3px_rgba(20,20,19,0.06)] space-y-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono bg-[#cc785c]/10 text-[#cc785c] dark:bg-[#cc785c]/20 dark:text-[#e89a80] border border-[#cc785c]/25">
              <span>PARTNER WORKSPACE</span>
            </div>
            <h1 className="text-3xl font-serif font-normal tracking-tight text-[#141413] dark:text-[#faf9f5]">
              Welcome back
            </h1>
            <p className="text-xs text-[#6c6a64] dark:text-[#a09d96] leading-relaxed">
              Enter your designated access key to manage your allotted leads, AI enrichment pipelines, and bespoke outreach.
            </p>
          </div>

          {authError && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-800 dark:text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{authError}</span>
            </div>
          )}

          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-[#6c6a64] dark:text-[#a09d96] mb-1.5">
                Partner Access Key
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-[#8e8b82] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  placeholder="e.g. prt_key_..."
                  value={accessKeyInput}
                  onChange={(e) => setAccessKeyInput(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 text-sm rounded-lg border border-[#e6dfd8] dark:border-white/10 bg-[#faf9f5] dark:bg-[#181715] text-[#141413] dark:text-[#faf9f5] placeholder-[#8e8b82] focus:outline-none focus:ring-1 focus:ring-[#cc785c] focus:border-[#cc785c] transition"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoggingIn || !accessKeyInput.trim()}
              className="w-full py-2.5 rounded-lg bg-[#cc785c] hover:bg-[#a9583e] text-white font-medium text-xs transition shadow-sm disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isLoggingIn ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Verifying key...</span>
                </>
              ) : (
                <>
                  <span>Enter Workspace</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </form>

          <div className="pt-4 border-t border-[#e6dfd8] dark:border-white/10 text-center">
            <p className="text-[11px] text-[#8e8b82]">
              Need an access key? Contact your workspace admin to receive your magic portal invite link.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="max-w-5xl mx-auto w-full text-center text-[11px] text-[#8e8b82]">
          Evee.ai • Partner Portal
        </div>
      </div>
    );
  }

  // ----------------------------------------------------
  // RENDER: Authenticated Evee Partner Workspace
  // ----------------------------------------------------
  return (
    <div className="min-h-screen bg-[#faf9f5] dark:bg-[#141413] text-[#141413] dark:text-[#faf9f5] font-sans antialiased pb-24 transition-colors duration-150">
      {/* Top Editorial Navigation Bar */}
      <header className="sticky top-0 z-40 bg-[#faf9f5]/95 dark:bg-[#141413]/95 backdrop-blur-md border-b border-[#e6dfd8] dark:border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3.5">
            <div className="w-8 h-8 rounded-lg bg-[#cc785c] text-white flex items-center justify-center shadow-sm">
              <EveeStar className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-serif text-base tracking-tight font-normal text-[#141413] dark:text-[#faf9f5]">
                  Evee | Partner
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-[#cc785c]/10 text-[#cc785c] dark:bg-[#cc785c]/20 dark:text-[#e89a80] border border-[#cc785c]/25">
                  PORTAL
                </span>
              </div>
              <p className="text-[11px] text-[#6c6a64] dark:text-[#a09d96] truncate max-w-xs font-sans">
                {partner.name} • {partner.company || 'Dedicated Sub-Portal'}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2.5">
            {/* Theme Toggle Button */}
            <button
              onClick={toggleDarkMode}
              title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              className="p-2 rounded-lg border border-[#e6dfd8] dark:border-white/10 hover:bg-[#f5f0e8] dark:hover:bg-[#1f1e1b] text-[#6c6a64] dark:text-[#a09d96] transition"
            >
              {darkMode ? <Sun className="w-4 h-4 text-[#e8a55a]" /> : <Moon className="w-4 h-4" />}
            </button>

            <div className="hidden sm:flex flex-col text-right pl-2 border-l border-[#e6dfd8] dark:border-white/10">
              <span className="text-xs font-medium text-[#141413] dark:text-[#faf9f5]">{partner.name}</span>
              <span className="text-[11px] text-[#6c6a64] dark:text-[#a09d96] font-mono">{partner.email}</span>
            </div>

            <button
              onClick={handleLogout}
              title="Sign Out of Partner Portal"
              className="p-2 rounded-lg border border-[#e6dfd8] dark:border-white/10 hover:bg-[#f5f0e8] dark:hover:bg-[#1f1e1b] text-[#6c6a64] dark:text-[#a09d96] hover:text-[#c64545] dark:hover:text-[#c64545] transition"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-7">
        {/* Banner Alert */}
        {banner && (
          <div
            className={`p-3.5 rounded-xl border text-xs flex items-center justify-between shadow-sm ${
              banner.type === 'success'
                ? 'bg-[#5db872]/10 border-[#5db872]/20 text-[#2d7a3f] dark:text-[#78d68f]'
                : 'bg-[#c64545]/10 border-[#c64545]/20 text-[#c64545]'
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

        {/* Editorial Heading & Subtitle */}
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-serif font-normal tracking-tight text-[#141413] dark:text-[#faf9f5]">
            Outreach & Partner Workspace
          </h1>
          <p className="text-xs text-[#6c6a64] dark:text-[#a09d96]">
            Inspect your allotted lead pool, enrich verified contact profiles, and launch bespoke 1-to-1 campaigns.
          </p>
        </div>

        {/* KPI Strip in Editorial Card Aesthetic */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-[#1f1e1b] p-5 rounded-xl border border-[#e6dfd8] dark:border-white/10 shadow-[0_1px_3px_rgba(20,20,19,0.04)]">
            <div className="flex items-center justify-between text-xs text-[#6c6a64] dark:text-[#a09d96] mb-1 font-medium">
              <span>Allotted Leads</span>
              <EveeStar className="w-3.5 h-3.5 text-[#cc785c]" />
            </div>
            <div className="text-3xl font-serif font-normal text-[#141413] dark:text-[#faf9f5]">{leads.length}</div>
            <div className="text-[11px] text-[#8e8b82] mt-1">Assigned to your sub-portal</div>
          </div>

          <div className="bg-white dark:bg-[#1f1e1b] p-5 rounded-xl border border-[#e6dfd8] dark:border-white/10 shadow-[0_1px_3px_rgba(20,20,19,0.04)]">
            <div className="flex items-center justify-between text-xs text-[#6c6a64] dark:text-[#a09d96] mb-1 font-medium">
              <span>Ready for Outreach</span>
              <span className="w-2 h-2 rounded-full bg-[#5db872]" />
            </div>
            <div className="text-3xl font-serif font-normal text-[#141413] dark:text-[#faf9f5]">{readyLeads.length}</div>
            <div className="text-[11px] text-[#2d7a3f] dark:text-[#78d68f] mt-1">Verified email ready</div>
          </div>

          <div className="bg-white dark:bg-[#1f1e1b] p-5 rounded-xl border border-[#e6dfd8] dark:border-white/10 shadow-[0_1px_3px_rgba(20,20,19,0.04)]">
            <div className="flex items-center justify-between text-xs text-[#6c6a64] dark:text-[#a09d96] mb-1 font-medium">
              <span>Needs Enrichment</span>
              <span className="w-2 h-2 rounded-full bg-[#e8a55a]" />
            </div>
            <div className="text-3xl font-serif font-normal text-[#141413] dark:text-[#faf9f5]">
              {missingEmailLeads.length}
            </div>
            <div className="text-[11px] text-[#9a6020] dark:text-[#f0ba7a] mt-1">Crawlable via Gemini AI</div>
          </div>

          <div className="bg-white dark:bg-[#1f1e1b] p-5 rounded-xl border border-[#e6dfd8] dark:border-white/10 shadow-[0_1px_3px_rgba(20,20,19,0.04)]">
            <div className="flex items-center justify-between text-xs text-[#6c6a64] dark:text-[#a09d96] mb-1 font-medium">
              <span>Outreach Sent</span>
              <span className="w-2 h-2 rounded-full bg-[#5db8a6]" />
            </div>
            <div className="text-3xl font-serif font-normal text-[#141413] dark:text-[#faf9f5]">
              {contactedLeads.length}
            </div>
            <div className="text-[11px] text-[#1e6b5d] dark:text-[#78d5c3] mt-1">Contacted & protected</div>
          </div>
        </div>

        {/* Action Toolbar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-1">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setShowAddLeadModal(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#cc785c] hover:bg-[#a9583e] text-white text-xs font-medium transition shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Lead</span>
            </button>

            <button
              onClick={() => setShowImportModal(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[#e6dfd8] dark:border-white/10 bg-white dark:bg-[#1f1e1b] hover:bg-[#f5f0e8] dark:hover:bg-[#252320] text-xs font-medium text-[#141413] dark:text-[#faf9f5] transition shadow-sm"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-[#6c6a64] dark:text-[#a09d96]" />
              <span>Import CSV</span>
            </button>

            <button
              onClick={() => handleAiEnrichMissing()}
              disabled={isEnrichingAi || missingEmailLeads.length === 0}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[#e8a55a]/30 bg-[#e8a55a]/10 hover:bg-[#e8a55a]/20 text-xs font-medium text-[#9a6020] dark:text-[#f0ba7a] transition shadow-sm disabled:opacity-50"
              title="Crawl official websites and inspect with Gemini AI"
            >
              <Sparkles className={`w-3.5 h-3.5 text-[#e8a55a] ${isEnrichingAi ? 'animate-spin' : ''}`} />
              <span>{isEnrichingAi ? 'Enriching...' : `AI Enrich (${missingEmailLeads.length})`}</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setOutreachStep('recipients');
                setTestResult(null);
                setDispatchResults(null);
                setShowOutreachModal(true);
              }}
              disabled={readyLeads.length === 0 && selectedIds.size === 0}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#cc785c] hover:bg-[#a9583e] text-white text-xs font-medium transition shadow-sm disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Start Outreach</span>
              {selectedIds.size > 0 ? (
                <span className="px-1.5 py-0.2 rounded-full bg-white/20 text-white font-mono text-[10px]">
                  {selectedIds.size}
                </span>
              ) : readyLeads.length > 0 ? (
                <span className="px-1.5 py-0.2 rounded-full bg-white/20 text-white font-mono text-[10px]">
                  {readyLeads.length}
                </span>
              ) : null}
            </button>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-[#8e8b82] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search companies, domains, emails, cities..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-xs rounded-lg border border-[#e6dfd8] dark:border-white/10 bg-white dark:bg-[#1f1e1b] text-[#141413] dark:text-[#faf9f5] placeholder-[#8e8b82] focus:outline-none focus:ring-1 focus:ring-[#cc785c] focus:border-[#cc785c] transition"
            />
          </div>

          {/* Category Tabs */}
          <div className="inline-flex items-center gap-1 p-1 bg-[#efe9de] dark:bg-[#1f1e1b] rounded-lg border border-[#e6dfd8] dark:border-white/10 overflow-x-auto no-scrollbar">
            {[
              { id: 'all', label: 'All Allotted', count: leads.length },
              { id: 'ready', label: 'Ready to Contact', count: readyLeads.length },
              { id: 'missing', label: 'Needs Email', count: missingEmailLeads.length },
              { id: 'sent', label: 'Contacted', count: contactedLeads.length },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id as any)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs transition whitespace-nowrap ${
                  statusFilter === tab.id
                    ? 'bg-white dark:bg-[#252320] text-[#141413] dark:text-[#faf9f5] font-medium shadow-sm'
                    : 'text-[#6c6a64] dark:text-[#a09d96] hover:text-[#141413] dark:hover:text-[#faf9f5]'
                }`}
              >
                <span>{tab.label}</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full font-mono bg-[#cc785c]/10 text-[#cc785c] dark:bg-[#cc785c]/20 dark:text-[#e89a80]">
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Leads Table Container */}
        <div className="bg-white dark:bg-[#1f1e1b] rounded-xl border border-[#e6dfd8] dark:border-white/10 overflow-hidden shadow-[0_1px_3px_rgba(20,20,19,0.04)]">
          {loadingData ? (
            <div className="py-20 flex flex-col items-center justify-center space-y-2 text-[#6c6a64] dark:text-[#a09d96]">
              <RefreshCw className="w-5 h-5 animate-spin text-[#cc785c]" />
              <p className="text-xs">Loading allotted leads...</p>
            </div>
          ) : filteredLeads.length === 0 ? (
            <div className="py-20 text-center px-4">
              <Building2 className="w-9 h-9 text-[#8e8b82] mx-auto mb-2 opacity-60" />
              <h3 className="font-serif font-normal text-base mb-1 text-[#141413] dark:text-[#faf9f5]">
                No leads found
              </h3>
              <p className="text-xs text-[#6c6a64] dark:text-[#a09d96] max-w-sm mx-auto mb-4">
                {search
                  ? `No leads matched "${search}". Try clearing your search.`
                  : 'You do not have any leads under this filter. Add your own leads or import a CSV to begin.'}
              </p>
              <button
                onClick={() => setShowAddLeadModal(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#cc785c] text-white text-xs font-medium transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Your First Lead</span>
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#e6dfd8] dark:border-white/10 text-[11px] font-medium uppercase tracking-wider text-[#6c6a64] dark:text-[#a09d96] bg-[#f5f0e8] dark:bg-[#252320]">
                    <th className="py-3 px-4 w-10">
                      <input
                        type="checkbox"
                        checked={isAllFilteredSelected}
                        onChange={handleToggleSelectAll}
                        className="rounded text-[#cc785c] focus:ring-0 w-3.5 h-3.5 cursor-pointer"
                      />
                    </th>
                    <th className="py-3 px-4">Company</th>
                    <th className="py-3 px-4">Contact & Email</th>
                    <th className="py-3 px-4">Location</th>
                    <th className="py-3 px-4">Outreach Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e6dfd8]/60 dark:divide-white/5">
                  {filteredLeads.map((lead) => {
                    const hasEmail = Boolean(lead.general_business_email || lead.contacts?.[0]?.email_address);
                    const email = lead.general_business_email || lead.contacts?.[0]?.email_address;
                    const contactName = lead.contacts?.[0]?.contact_name;
                    const sent = isLeadSent(lead);

                    return (
                      <tr
                        key={lead.id}
                        className={`hover:bg-[#faf9f5] dark:hover:bg-white/[0.02] transition ${
                          selectedIds.has(lead.id) ? 'bg-[#cc785c]/5 dark:bg-[#cc785c]/10' : ''
                        }`}
                      >
                        <td className="py-3.5 px-4">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(lead.id)}
                            onChange={() => handleToggleSelect(lead.id)}
                            className="rounded text-[#cc785c] focus:ring-0 w-3.5 h-3.5 cursor-pointer"
                          />
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 rounded-lg bg-[#efe9de] dark:bg-[#252320] text-[#cc785c] font-serif font-normal text-xs flex items-center justify-center shrink-0">
                              {lead.display_name?.slice(0, 2).toUpperCase() || 'CO'}
                            </div>
                            <div className="min-w-0">
                              <div className="font-medium text-xs text-[#141413] dark:text-[#faf9f5] truncate">
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
                                  className="text-[11px] text-[#8e8b82] hover:text-[#cc785c] flex items-center gap-1 mt-0.5 truncate max-w-xs transition"
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
                              <div className="flex items-center space-x-1.5 text-xs text-[#141413] dark:text-[#faf9f5]">
                                <Mail className="w-3 h-3 text-[#cc785c] shrink-0" />
                                <span className="font-mono text-[11px]">{email}</span>
                              </div>
                              {contactName && (
                                <div className="text-[11px] text-[#6c6a64] dark:text-[#a09d96] mt-0.5">
                                  {contactName}
                                </div>
                              )}
                            </div>
                          ) : (
                            <button
                              onClick={() => handleAiEnrichMissing(lead.id)}
                              disabled={isEnrichingAi}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-[#e8a55a]/30 bg-[#e8a55a]/10 hover:bg-[#e8a55a]/20 text-[#9a6020] dark:text-[#f0ba7a] text-[11px] font-medium transition"
                            >
                              <Sparkles className="w-3 h-3 text-[#e8a55a]" />
                              <span>Find Email with AI</span>
                            </button>
                          )}
                        </td>

                        <td className="py-3.5 px-4 text-[#6c6a64] dark:text-[#a09d96] text-[11px]">
                          <div className="flex items-center gap-1">
                            <MapPin className="w-3 h-3 opacity-60 shrink-0" />
                            <span>{lead.city || 'Unknown'}</span>
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          {sent ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-[#5db8a6]/15 text-[#1e6b5d] dark:text-[#78d5c3] border border-[#5db8a6]/30">
                              <MailCheck className="w-3 h-3 text-[#5db8a6]" />
                              <span>CONTACTED</span>
                            </span>
                          ) : hasEmail ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-[#5db872]/15 text-[#2d7a3f] dark:text-[#78d68f] border border-[#5db872]/30">
                              <Check className="w-3 h-3 text-[#5db872]" />
                              <span>READY</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-[#e8a55a]/15 text-[#9a6020] dark:text-[#f0ba7a] border border-[#e8a55a]/30">
                              <Clock className="w-3 h-3 text-[#e8a55a]" />
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
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-[#e6dfd8] dark:border-white/10 hover:bg-[#f5f0e8] dark:hover:bg-[#252320] text-xs font-medium text-[#6c6a64] dark:text-[#a09d96] hover:text-[#141413] dark:hover:text-[#faf9f5] transition"
                            title="Edit contact manually"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#1f1e1b] border border-[#e6dfd8] dark:border-white/10 rounded-xl w-full max-w-lg p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#e6dfd8] dark:border-white/10">
              <div className="flex items-center space-x-2">
                <EveeStar className="w-5 h-5 text-[#cc785c]" />
                <div>
                  <h3 className="font-serif font-normal text-lg text-[#141413] dark:text-[#faf9f5]">
                    Add Lead to My Portal
                  </h3>
                  <p className="text-xs text-[#6c6a64] dark:text-[#a09d96]">
                    Save a new prospect automatically allotted to your workspace.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowAddLeadModal(false)}
                className="p-1.5 text-[#8e8b82] hover:text-[#141413] dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveSingleLead} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-xs font-medium text-[#6c6a64] dark:text-[#a09d96] mb-1">
                  Company Name <span className="text-[#c64545]">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Apex Legal Consulting"
                  value={newLead.companyName}
                  onChange={(e) => setNewLead({ ...newLead, companyName: e.target.value })}
                  className="w-full text-xs rounded-lg border border-[#e6dfd8] dark:border-white/10 bg-[#faf9f5] dark:bg-[#181715] px-3 py-2 text-[#141413] dark:text-[#faf9f5] focus:outline-none focus:ring-1 focus:ring-[#cc785c]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#6c6a64] dark:text-[#a09d96] mb-1">
                    Official Website
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. https://apexlegal.com"
                    value={newLead.website}
                    onChange={(e) => setNewLead({ ...newLead, website: e.target.value })}
                    className="w-full text-xs rounded-lg border border-[#e6dfd8] dark:border-white/10 bg-[#faf9f5] dark:bg-[#181715] px-3 py-2 text-[#141413] dark:text-[#faf9f5] focus:outline-none focus:ring-1 focus:ring-[#cc785c]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#6c6a64] dark:text-[#a09d96] mb-1">
                    City / Region
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Bengaluru"
                    value={newLead.city}
                    onChange={(e) => setNewLead({ ...newLead, city: e.target.value })}
                    className="w-full text-xs rounded-lg border border-[#e6dfd8] dark:border-white/10 bg-[#faf9f5] dark:bg-[#181715] px-3 py-2 text-[#141413] dark:text-[#faf9f5] focus:outline-none focus:ring-1 focus:ring-[#cc785c]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#6c6a64] dark:text-[#a09d96] mb-1">
                    Contact Person Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Ramesh Sharma"
                    value={newLead.contactName}
                    onChange={(e) => setNewLead({ ...newLead, contactName: e.target.value })}
                    className="w-full text-xs rounded-lg border border-[#e6dfd8] dark:border-white/10 bg-[#faf9f5] dark:bg-[#181715] px-3 py-2 text-[#141413] dark:text-[#faf9f5] focus:outline-none focus:ring-1 focus:ring-[#cc785c]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#6c6a64] dark:text-[#a09d96] mb-1">
                    Contact Email Address
                  </label>
                  <input
                    type="email"
                    placeholder="e.g. ramesh@apexlegal.com"
                    value={newLead.email}
                    onChange={(e) => setNewLead({ ...newLead, email: e.target.value })}
                    className="w-full text-xs rounded-lg border border-[#e6dfd8] dark:border-white/10 bg-[#faf9f5] dark:bg-[#181715] px-3 py-2 text-[#141413] dark:text-[#faf9f5] focus:outline-none focus:ring-1 focus:ring-[#cc785c]"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#e6dfd8] dark:border-white/10">
                <button
                  type="button"
                  onClick={() => setShowAddLeadModal(false)}
                  className="px-3.5 py-1.5 rounded-lg border border-[#e6dfd8] dark:border-white/10 hover:bg-[#f5f0e8] dark:hover:bg-[#252320] text-xs font-medium transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingLead || !newLead.companyName.trim()}
                  className="px-4 py-1.5 rounded-lg bg-[#cc785c] hover:bg-[#a9583e] text-white text-xs font-medium transition disabled:opacity-50 flex items-center gap-1.5"
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
      {/* MODAL: Manual Edit Contact */}
      {/* ---------------------------------------------------- */}
      {showManualEnrichModal && enrichTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#1f1e1b] border border-[#e6dfd8] dark:border-white/10 rounded-xl w-full max-w-lg p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#e6dfd8] dark:border-white/10">
              <div className="flex items-center space-x-2">
                <Edit3 className="w-4 h-4 text-[#cc785c]" />
                <div>
                  <h3 className="font-serif font-normal text-lg text-[#141413] dark:text-[#faf9f5]">
                    Edit Contact Details
                  </h3>
                  <p className="text-xs text-[#6c6a64] dark:text-[#a09d96] truncate max-w-xs">
                    {enrichTarget.display_name}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowManualEnrichModal(false);
                  setEnrichTarget(null);
                }}
                className="p-1.5 text-[#8e8b82] hover:text-[#141413] dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveManualEnrich} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-xs font-medium text-[#6c6a64] dark:text-[#a09d96] mb-1">
                  Contact Person Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Priya Nair"
                  value={enrichForm.contactName}
                  onChange={(e) => setEnrichForm({ ...enrichForm, contactName: e.target.value })}
                  className="w-full text-xs rounded-lg border border-[#e6dfd8] dark:border-white/10 bg-[#faf9f5] dark:bg-[#181715] px-3 py-2 text-[#141413] dark:text-[#faf9f5] focus:outline-none focus:ring-1 focus:ring-[#cc785c]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#6c6a64] dark:text-[#a09d96] mb-1">
                  Verified Email Address
                </label>
                <input
                  type="email"
                  placeholder="e.g. priya@company.com"
                  value={enrichForm.email}
                  onChange={(e) => setEnrichForm({ ...enrichForm, email: e.target.value })}
                  className="w-full text-xs rounded-lg border border-[#e6dfd8] dark:border-white/10 bg-[#faf9f5] dark:bg-[#181715] px-3 py-2 text-[#141413] dark:text-[#faf9f5] focus:outline-none focus:ring-1 focus:ring-[#cc785c]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#6c6a64] dark:text-[#a09d96] mb-1">
                    Phone Number
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. +91 98765 43210"
                    value={enrichForm.phone}
                    onChange={(e) => setEnrichForm({ ...enrichForm, phone: e.target.value })}
                    className="w-full text-xs rounded-lg border border-[#e6dfd8] dark:border-white/10 bg-[#faf9f5] dark:bg-[#181715] px-3 py-2 text-[#141413] dark:text-[#faf9f5] focus:outline-none focus:ring-1 focus:ring-[#cc785c]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#6c6a64] dark:text-[#a09d96] mb-1">Website</label>
                  <input
                    type="text"
                    placeholder="e.g. https://domain.com"
                    value={enrichForm.website}
                    onChange={(e) => setEnrichForm({ ...enrichForm, website: e.target.value })}
                    className="w-full text-xs rounded-lg border border-[#e6dfd8] dark:border-white/10 bg-[#faf9f5] dark:bg-[#181715] px-3 py-2 text-[#141413] dark:text-[#faf9f5] focus:outline-none focus:ring-1 focus:ring-[#cc785c]"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#e6dfd8] dark:border-white/10">
                <button
                  type="button"
                  onClick={() => {
                    setShowManualEnrichModal(false);
                    setEnrichTarget(null);
                  }}
                  className="px-3.5 py-1.5 rounded-lg border border-[#e6dfd8] dark:border-white/10 hover:bg-[#f5f0e8] dark:hover:bg-[#252320] text-xs font-medium transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEnrichment}
                  className="px-4 py-1.5 rounded-lg bg-[#cc785c] hover:bg-[#a9583e] text-white text-xs font-medium transition disabled:opacity-50 flex items-center gap-1.5"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#1f1e1b] border border-[#e6dfd8] dark:border-white/10 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#e6dfd8] dark:border-white/10">
              <div className="flex items-center space-x-2">
                <FileSpreadsheet className="w-4 h-4 text-[#cc785c]" />
                <div>
                  <h3 className="font-serif font-normal text-lg text-[#141413] dark:text-[#faf9f5]">
                    Import CSV Leads
                  </h3>
                  <p className="text-xs text-[#6c6a64] dark:text-[#a09d96]">
                    Uploaded leads will be automatically allotted exclusively to your portal.
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowImportModal(false);
                  setCsvFile(null);
                  setCsvResult(null);
                }}
                className="p-1.5 text-[#8e8b82] hover:text-[#141413] dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {!csvResult ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-[#e6dfd8] dark:border-white/10 hover:border-[#cc785c] rounded-xl p-8 text-center cursor-pointer transition bg-[#faf9f5] dark:bg-[#181715]"
              >
                <UploadCloud className="w-8 h-8 text-[#cc785c] mx-auto mb-2 opacity-80" />
                <p className="text-xs font-medium mb-1 text-[#141413] dark:text-[#faf9f5]">
                  Click to select or drop CSV file
                </p>
                <p className="text-[11px] text-[#8e8b82]">
                  Recognizes standard columns: Company, Website, Contact Name, Email, City
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
                <div className="p-3 bg-[#cc785c]/10 border border-[#cc785c]/20 rounded-lg text-xs flex items-center justify-between text-[#cc785c] dark:text-[#e89a80]">
                  <span>
                    Detected <strong>{csvResult.rows.length} records</strong> in {csvFile?.name}
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
                  <span className="text-[11px] font-medium uppercase tracking-wider text-[#6c6a64] dark:text-[#a09d96]">
                    Map Columns
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="block text-[#6c6a64] dark:text-[#a09d96] mb-1 font-medium">
                        Company Name <span className="text-[#c64545]">*</span>
                      </label>
                      <select
                        value={mapping.companyName || ''}
                        onChange={(e) => setMapping({ ...mapping, companyName: e.target.value })}
                        className="w-full text-xs rounded-lg border border-[#e6dfd8] dark:border-white/10 bg-[#faf9f5] dark:bg-[#181715] p-2 text-[#141413] dark:text-[#faf9f5]"
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
                      <label className="block text-[#6c6a64] dark:text-[#a09d96] mb-1 font-medium">Email</label>
                      <select
                        value={mapping.email || ''}
                        onChange={(e) => setMapping({ ...mapping, email: e.target.value })}
                        className="w-full text-xs rounded-lg border border-[#e6dfd8] dark:border-white/10 bg-[#faf9f5] dark:bg-[#181715] p-2 text-[#141413] dark:text-[#faf9f5]"
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
                      <label className="block text-[#6c6a64] dark:text-[#a09d96] mb-1 font-medium">Contact Name</label>
                      <select
                        value={mapping.contactName || ''}
                        onChange={(e) => setMapping({ ...mapping, contactName: e.target.value })}
                        className="w-full text-xs rounded-lg border border-[#e6dfd8] dark:border-white/10 bg-[#faf9f5] dark:bg-[#181715] p-2 text-[#141413] dark:text-[#faf9f5]"
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
                      <label className="block text-[#6c6a64] dark:text-[#a09d96] mb-1 font-medium">Website</label>
                      <select
                        value={mapping.website || ''}
                        onChange={(e) => setMapping({ ...mapping, website: e.target.value })}
                        className="w-full text-xs rounded-lg border border-[#e6dfd8] dark:border-white/10 bg-[#faf9f5] dark:bg-[#181715] p-2 text-[#141413] dark:text-[#faf9f5]"
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

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#e6dfd8] dark:border-white/10">
                  <button
                    type="button"
                    onClick={() => {
                      setShowImportModal(false);
                      setCsvResult(null);
                    }}
                    className="px-3.5 py-1.5 rounded-lg border border-[#e6dfd8] dark:border-white/10 hover:bg-[#f5f0e8] dark:hover:bg-[#252320] text-xs font-medium transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleExecuteCsvImport}
                    disabled={importingCsv || !mapping.companyName}
                    className="px-4 py-1.5 rounded-lg bg-[#cc785c] hover:bg-[#a9583e] text-white text-xs font-medium transition disabled:opacity-50 flex items-center gap-1.5"
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
      {/* MODAL: Outreach Studio (Editorial 4 Steps) */}
      {/* ---------------------------------------------------- */}
      {showOutreachModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#1f1e1b] border border-[#e6dfd8] dark:border-white/10 rounded-xl w-full max-w-3xl max-h-[92vh] overflow-y-auto p-6 space-y-5 shadow-2xl">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[#e6dfd8] dark:border-white/10 gap-2">
              <div className="flex items-center space-x-2">
                <EveeStar className="w-4 h-4 text-[#cc785c]" />
                <div>
                  <h3 className="font-serif font-normal text-lg text-[#141413] dark:text-[#faf9f5]">
                    Direct Outreach Studio
                  </h3>
                  <p className="text-xs text-[#6c6a64] dark:text-[#a09d96]">
                    Bespoke 1-to-1 outreach strictly scoped to your allotted leads.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowOutreachModal(false)}
                className="p-1.5 text-[#8e8b82] hover:text-[#141413] dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Step Indicator */}
            <div className="flex items-center justify-between border-b border-[#e6dfd8] dark:border-white/10 pb-2.5 text-xs">
              {[
                { id: 'recipients', label: '1. Prospects', count: candidateRecipients.length },
                { id: 'compose', label: '2. Compose', count: null },
                { id: 'test', label: '3. Test Send', count: null },
                { id: 'dispatch', label: '4. Live Dispatch', count: null },
              ].map((step) => (
                <button
                  key={step.id}
                  onClick={() => setOutreachStep(step.id as any)}
                  className={`font-medium flex items-center gap-1.5 transition ${
                    outreachStep === step.id
                      ? 'text-[#cc785c] font-semibold'
                      : 'text-[#8e8b82] hover:text-[#141413] dark:hover:text-white'
                  }`}
                >
                  <span>{step.label}</span>
                  {step.count !== null && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full font-mono bg-[#cc785c]/10 text-[#cc785c]">
                      {step.count}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* STEP 1: Candidate Prospects */}
            {outreachStep === 'recipients' && (
              <div className="space-y-3.5">
                <div className="p-3 rounded-lg bg-[#efe9de] dark:bg-[#252320] border border-[#e6dfd8] dark:border-white/10 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-medium text-[#141413] dark:text-[#faf9f5]">
                      {candidateRecipients.length} candidate prospects selected.
                    </span>
                    <span className="text-[11px] text-[#6c6a64] dark:text-[#a09d96] block">
                      All recipients belong strictly to your partner allocation.
                    </span>
                  </div>
                  <button
                    onClick={() => setOutreachStep('compose')}
                    className="px-3 py-1.5 rounded-lg bg-[#cc785c] hover:bg-[#a9583e] text-white text-xs font-medium flex items-center gap-1.5 shadow-sm"
                  >
                    <span>Next: Compose</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="max-h-60 overflow-y-auto rounded-lg border border-[#e6dfd8] dark:border-white/10 divide-y divide-[#e6dfd8]/60 dark:divide-white/5 text-xs">
                  {candidateRecipients.map((c, i) => (
                    <div key={i} className="p-2.5 flex items-center justify-between">
                      <div>
                        <span className="font-medium text-[#141413] dark:text-[#faf9f5]">{c.company_name}</span>
                        <span className="text-[11px] text-[#8e8b82] ml-2 font-mono">{c.email}</span>
                      </div>
                      <span className="text-[11px] text-[#8e8b82]">{c.city}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* STEP 2: Compose Template with AI Variable Tokens */}
            {outreachStep === 'compose' && (
              <div className="space-y-3.5 text-xs">
                <div className="flex flex-wrap gap-1 p-2 bg-[#efe9de] dark:bg-[#252320] rounded-lg border border-[#e6dfd8] dark:border-white/10 text-[11px]">
                  <span className="font-medium text-[#6c6a64] dark:text-[#a09d96] self-center mr-1">Insert Tokens:</span>
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
                      className="px-2 py-0.5 rounded bg-white dark:bg-[#181715] border border-[#e6dfd8] dark:border-white/10 font-mono text-[10px] hover:border-[#cc785c]"
                    >
                      {tok}
                    </button>
                  ))}
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#6c6a64] dark:text-[#a09d96] mb-1">
                    Subject Line
                  </label>
                  <input
                    type="text"
                    value={template.subject}
                    onChange={(e) => setTemplate({ ...template, subject: e.target.value })}
                    className="w-full text-xs rounded-lg border border-[#e6dfd8] dark:border-white/10 bg-[#faf9f5] dark:bg-[#181715] px-3 py-2 text-[#141413] dark:text-[#faf9f5] focus:outline-none focus:ring-1 focus:ring-[#cc785c]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#6c6a64] dark:text-[#a09d96] mb-1">
                    Message Body
                  </label>
                  <textarea
                    rows={8}
                    value={template.bodyText}
                    onChange={(e) => setTemplate({ ...template, bodyText: e.target.value })}
                    className="w-full text-xs rounded-lg border border-[#e6dfd8] dark:border-white/10 bg-[#faf9f5] dark:bg-[#181715] p-3 font-sans leading-relaxed text-[#141413] dark:text-[#faf9f5] focus:outline-none focus:ring-1 focus:ring-[#cc785c]"
                  />
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-[#e6dfd8] dark:border-white/10">
                  <button
                    onClick={() => setOutreachStep('recipients')}
                    className="px-3.5 py-1.5 rounded-lg border border-[#e6dfd8] dark:border-white/10 hover:bg-[#f5f0e8] dark:hover:bg-[#252320] text-xs font-medium"
                  >
                    Back to Prospects
                  </button>
                  <button
                    onClick={() => setOutreachStep('test')}
                    className="px-4 py-1.5 rounded-lg bg-[#cc785c] hover:bg-[#a9583e] text-white text-xs font-medium flex items-center gap-1.5"
                  >
                    <span>Next: Test Send</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3: Test Send to Self */}
            {outreachStep === 'test' && (
              <div className="space-y-4 text-xs">
                <div className="p-3.5 rounded-lg bg-[#cc785c]/10 border border-[#cc785c]/20 text-[#cc785c] dark:text-[#e89a80]">
                  <span className="font-semibold block mb-0.5">Test Verification</span>
                  <p className="text-[11px] leading-relaxed opacity-90">
                    Dispatch a real verification email to yourself to confirm copywriting and token formatting before live sending.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#6c6a64] dark:text-[#a09d96] mb-1">
                    Send Test To:
                  </label>
                  <input
                    type="email"
                    placeholder={`Your email (${partner.email})`}
                    value={testEmailOverride}
                    onChange={(e) => setTestEmailOverride(e.target.value)}
                    className="w-full text-xs rounded-lg border border-[#e6dfd8] dark:border-white/10 bg-[#faf9f5] dark:bg-[#181715] px-3 py-2 text-[#141413] dark:text-[#faf9f5]"
                  />
                </div>

                {testResult && (
                  <div
                    className={`p-3 rounded-lg border text-xs flex items-center gap-2 ${
                      testResult.success
                        ? 'bg-[#5db872]/10 border-[#5db872]/20 text-[#2d7a3f] dark:text-[#78d68f]'
                        : 'bg-[#c64545]/10 border-[#c64545]/20 text-[#c64545]'
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

                <div className="flex items-center justify-between pt-2 border-t border-[#e6dfd8] dark:border-white/10">
                  <button
                    onClick={() => setOutreachStep('compose')}
                    className="px-3.5 py-1.5 rounded-lg border border-[#e6dfd8] dark:border-white/10 text-xs font-medium"
                  >
                    Back to Compose
                  </button>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleSendTestEmail}
                      disabled={sendingTest}
                      className="px-3.5 py-1.5 rounded-lg border border-[#cc785c] text-[#cc785c] hover:bg-[#cc785c]/10 text-xs font-medium flex items-center gap-1.5 transition disabled:opacity-50"
                    >
                      {sendingTest ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                      <span>{sendingTest ? 'Sending...' : 'Send Test'}</span>
                    </button>
                    <button
                      onClick={() => setOutreachStep('dispatch')}
                      className="px-4 py-1.5 rounded-lg bg-[#cc785c] hover:bg-[#a9583e] text-white text-xs font-medium flex items-center gap-1.5"
                    >
                      <span>Proceed to Live</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 4: Live Dispatch */}
            {outreachStep === 'dispatch' && (
              <div className="space-y-4 text-xs">
                {!dispatchResults ? (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="p-3.5 rounded-lg border border-[#e6dfd8] dark:border-white/10 bg-[#faf9f5] dark:bg-[#181715] space-y-1.5">
                        <label className="text-[11px] font-medium uppercase tracking-wider text-[#6c6a64] dark:text-[#a09d96] block">
                          Sending Cadence
                        </label>
                        <select
                          value={cadence}
                          onChange={(e) => setCadence(e.target.value as any)}
                          className="w-full text-xs rounded-lg border border-[#e6dfd8] dark:border-white/10 bg-white dark:bg-[#252320] p-2 text-[#141413] dark:text-[#faf9f5]"
                        >
                          <option value="human">Human Pace (45-90s delays)</option>
                          <option value="fast">Fast (10s delays)</option>
                        </select>
                        <p className="text-[10px] text-[#8e8b82]">
                          Mimics human dispatch intervals for maximum inbox deliverability.
                        </p>
                      </div>

                      <div className="p-3.5 rounded-lg border border-[#e6dfd8] dark:border-white/10 bg-[#faf9f5] dark:bg-[#181715] space-y-1.5">
                        <label className="text-[11px] font-medium uppercase tracking-wider text-[#6c6a64] dark:text-[#a09d96] block">
                          Anti-Duplicate Protection
                        </label>
                        <label className="flex items-center space-x-2 text-xs cursor-pointer pt-1">
                          <input
                            type="checkbox"
                            checked={skipDuplicates}
                            onChange={(e) => setSkipDuplicates(e.target.checked)}
                            className="rounded text-[#cc785c] focus:ring-0 w-3.5 h-3.5"
                          />
                          <span className="font-medium text-[#141413] dark:text-[#faf9f5]">
                            Skip previously contacted leads
                          </span>
                        </label>
                        <p className="text-[10px] text-[#8e8b82]">
                          Guarantees companies already contacted by you or your team are protected.
                        </p>
                      </div>
                    </div>

                    <div className="p-3.5 bg-[#5db872]/10 border border-[#5db872]/20 rounded-lg text-xs text-[#2d7a3f] dark:text-[#78d68f] flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <ShieldCheck className="w-4 h-4 shrink-0" />
                        <div>
                          <span className="font-medium">Ready for live dispatch</span>
                          <p className="text-[11px] opacity-80">
                            {candidateRecipients.length} messages queued from {partner.name} &lt;{partner.email}&gt;.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-[#e6dfd8] dark:border-white/10">
                      <button
                        onClick={() => setOutreachStep('test')}
                        className="px-3.5 py-1.5 rounded-lg border border-[#e6dfd8] dark:border-white/10 text-xs font-medium"
                      >
                        Back to Test
                      </button>
                      <button
                        onClick={handleLaunchLiveDispatch}
                        disabled={dispatchingLive || candidateRecipients.length === 0}
                        className="px-5 py-2 rounded-lg bg-[#cc785c] hover:bg-[#a9583e] text-white text-xs font-medium flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                      >
                        {dispatchingLive ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            <span>Dispatching...</span>
                          </>
                        ) : (
                          <>
                            <Send className="w-3.5 h-3.5" />
                            <span>Confirm & Launch ({candidateRecipients.length})</span>
                          </>
                        )}
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="space-y-3 text-center py-5">
                    <div className="w-10 h-10 rounded-full bg-[#5db872]/10 text-[#5db872] mx-auto flex items-center justify-center">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <h3 className="font-serif font-normal text-lg text-[#141413] dark:text-[#faf9f5]">
                      Campaign Dispatch Complete
                    </h3>
                    <p className="text-xs text-[#6c6a64] dark:text-[#a09d96] max-w-sm mx-auto">
                      Sent {dispatchResults.summary?.sent} emails. {dispatchResults.summary?.skipped} skipped (duplicate protected or suppressed).
                    </p>

                    <button
                      onClick={() => {
                        setShowOutreachModal(false);
                        setDispatchResults(null);
                      }}
                      className="px-4 py-1.5 rounded-lg bg-[#cc785c] text-white text-xs font-medium shadow-sm"
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
        <div className="min-h-screen bg-[#faf9f5] dark:bg-[#141413] flex items-center justify-center p-6 text-[#141413] dark:text-[#faf9f5]">
          <div className="flex flex-col items-center space-y-3">
            <EveeStar className="w-8 h-8 text-[#cc785c] animate-pulse" />
            <p className="text-xs font-serif text-[#6c6a64] dark:text-[#a09d96]">Loading Partner Workspace...</p>
          </div>
        </div>
      }
    >
      <PartnerPortalContent />
    </Suspense>
  );
}
