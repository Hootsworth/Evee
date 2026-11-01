'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Search,
  Filter,
  ExternalLink,
  ShieldCheck,
  AlertCircle,
  FileText,
  ChevronRight,
  Sparkles,
  UploadCloud,
  CheckCircle2,
  RefreshCw,
  X,
  ChevronDown,
  Mail,
  User,
  Phone,
  Building,
  Send,
  CheckSquare,
  Square,
  ArrowRight,
  ArrowLeft,
  Eye,
  AlertTriangle,
  Info,
  Archive,
  RotateCcw,
  Building2,
  Globe,
  MapPin,
  MailCheck,
  PenLine,
  Layers,
  Cpu,
  Hash,
  Server,
  ShieldAlert,
  Users,
} from 'lucide-react';
import { parseAndAnalyzeCsv, CsvColumnMapping, replaceTemplateVariables } from '@/lib/csv/parser';

const SAMPLE_LEADS_CSV = `Company Name,Website,Contact Name,Email,Phone,City,Category
Artisan Flour Bakery,artisanflour.com,Siddharth Rao,,+91 98765 43210,Bengaluru,Artisan Bakery
Roast & Ground Cafe,roastground.in,Ananya Iyer,,+91 98450 11223,Bengaluru,Specialty Coffee
Dr. Sharma Dental Studio,sharmadental.in,Dr. Vivek Sharma,,+91 98200 55443,Mumbai,Healthcare
Apex Legal Advisory,apexlegal.in,Meera Sen,,+91 98110 99887,Delhi,Legal Services
Zenith Robotics,zenithrobotics.io,Rohan Verma,,+91 99000 77665,Bengaluru,Technology`;

export default function LeadsPage() {
  const router = useRouter();
  const [businesses, setBusinesses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'active' | 'all' | 'missing_email' | 'archived' | 'suppressed'>('active');
  const [archiving, setArchiving] = useState(false);

  // Multi-selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Enrichment state
  const [bulkEnriching, setBulkEnriching] = useState(false);
  const [enrichingId, setEnrichingId] = useState<string | null>(null);
  const [enrichMessage, setEnrichMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Unified 4-Step Outreach Wizard state (Strictly matching CSV Direct Outreach)
  const [showOutreachModal, setShowOutreachModal] = useState(false);
  const [outreachStep, setOutreachStep] = useState<'recipients' | 'template' | 'test_sent' | 'dispatched'>('recipients');
  const [outreachSubject, setOutreachSubject] = useState('Personalized idea for {company_name}');
  const [outreachBody, setOutreachBody] = useState(
    'Hi {first_name},\n\nI was looking into {company_name} in {city} and wanted to reach out specifically regarding your {company_type} operations.\n\n{personalized_pitch}\n\nMany {company_type} teams experience friction around {pain_point}. We recently implemented {value_prop} for similar businesses to streamline this completely.\n\nWould you be open to a brief 5-minute chat this week?\n\nBest regards,\nOperator'
  );
  const [operatorEmail, setOperatorEmail] = useState('');
  const [previewLeadIdx, setPreviewLeadIdx] = useState(0);
  const [testSending, setTestSending] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);
  const [testError, setTestError] = useState<string | null>(null);
  const [dispatching, setDispatching] = useState(false);
  const [dispatchSummary, setDispatchSummary] = useState<any>(null);
  const [dispatchResults, setDispatchResults] = useState<any[]>([]);
  const [aiEnrichingModal, setAiEnrichingModal] = useState(false);
  const [aiEnrichedModal, setAiEnrichedModal] = useState(false);
  const [aiMetaModal, setAiMetaModal] = useState<{
    source: 'live' | 'ai_synthetic';
    provider: string;
    model: string;
    error?: string;
  } | null>(null);
  const outreachTextareaRef = useRef<HTMLTextAreaElement>(null);

  // CSV Import Modal state
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [csvContent, setCsvContent] = useState('');
  const [fileName, setFileName] = useState('');
  const [csvResult, setCsvResult] = useState<any>(null);
  const [mapping, setMapping] = useState<CsvColumnMapping>({
    companyName: null,
    website: null,
    email: null,
    firstName: null,
    lastName: null,
    city: null,
    phone: null,
    category: null,
  });
  const [autoEnrichOnImport, setAutoEnrichOnImport] = useState(true);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchBusinesses = async () => {
    try {
      const res = await fetch('/api/businesses');
      const data = await res.json();
      setBusinesses(data.businesses || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBusinesses();
    fetch('/api/settings/providers')
      .then((res) => res.json())
      .then((data) => {
        if (data.settings?.smtpUser) {
          setOperatorEmail(data.settings.smtpUser);
        }
      })
      .catch(() => {});
  }, []);

  // Filtered list
  const filtered = businesses.filter((b) => {
    const matchesSearch =
      b.display_name.toLowerCase().includes(search.toLowerCase()) ||
      b.city.toLowerCase().includes(search.toLowerCase()) ||
      b.business_type.toLowerCase().includes(search.toLowerCase()) ||
      (b.general_business_email && b.general_business_email.toLowerCase().includes(search.toLowerCase()));

    if (!matchesSearch) return false;

    if (statusFilter === 'all') return true;
    if (statusFilter === 'missing_email') {
      return (!b.general_business_email || b.general_business_email.trim() === '') && b.record_status === 'active';
    }
    if (statusFilter === 'archived') {
      return b.record_status === 'archived';
    }
    if (statusFilter === 'suppressed') {
      return b.record_status === 'suppressed';
    }
    return b.record_status === 'active';
  });

  const activeBusinesses = businesses.filter((b) => b.record_status === 'active');
  const missingEmailCount = activeBusinesses.filter((b) => !b.general_business_email || b.general_business_email.trim() === '').length;
  const archivedCount = businesses.filter((b) => b.record_status === 'archived').length;

  // Archival handlers
  const handleArchive = async (ids: string[]) => {
    if (ids.length === 0) return;
    setArchiving(true);
    try {
      const res = await fetch('/api/leads/archive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids, action: 'archive' }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setEnrichMessage({
          text: `Archived ${data.count} ${data.count === 1 ? 'lead' : 'leads'}.`,
          type: 'success',
        });
        setSelectedIds((prev) => {
          const next = new Set(prev);
          ids.forEach((id) => next.delete(id));
          return next;
        });
        fetchBusinesses();
      } else {
        setEnrichMessage({ text: data.error || 'Failed to archive leads', type: 'error' });
      }
    } catch (e: any) {
      setEnrichMessage({ text: e.message || 'Network error while archiving', type: 'error' });
    } finally {
      setArchiving(false);
    }
  };

  const handleUnarchive = async (ids: string[]) => {
    if (ids.length === 0) return;
    setArchiving(true);
    try {
      const res = await fetch('/api/leads/archive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids, action: 'unarchive' }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setEnrichMessage({
          text: `Restored ${data.count} ${data.count === 1 ? 'lead' : 'leads'} to active list.`,
          type: 'success',
        });
        setSelectedIds((prev) => {
          const next = new Set(prev);
          ids.forEach((id) => next.delete(id));
          return next;
        });
        fetchBusinesses();
      } else {
        setEnrichMessage({ text: data.error || 'Failed to restore leads', type: 'error' });
      }
    } catch (e: any) {
      setEnrichMessage({ text: e.message || 'Network error while restoring', type: 'error' });
    } finally {
      setArchiving(false);
    }
  };

  const handleArchiveAllMissingEmail = async () => {
    if (missingEmailCount === 0) return;
    if (!confirm(`Archive all ${missingEmailCount} active leads that currently lack an email address? They can be viewed and restored from the 'Archived' tab anytime.`)) {
      return;
    }
    setArchiving(true);
    try {
      const res = await fetch('/api/leads/archive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ allMissingEmail: true, action: 'archive' }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setEnrichMessage({
          text: `Archived ${data.count} leads with missing emails. Outreach directory refined!`,
          type: 'success',
        });
        setSelectedIds(new Set());
        fetchBusinesses();
      } else {
        setEnrichMessage({ text: data.error || 'Failed to archive leads', type: 'error' });
      }
    } catch (e: any) {
      setEnrichMessage({ text: e.message || 'Network error while archiving', type: 'error' });
    } finally {
      setArchiving(false);
    }
  };

  // Selection handlers
  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((b) => b.id)));
    }
  };

  const handleClearSelection = () => {
    setSelectedIds(new Set());
  };

  // Selected businesses array
  const selectedBusinesses = businesses.filter((b) => selectedIds.has(b.id));
  const selectedReadyToEmail = selectedBusinesses.filter((b) => Boolean(b.general_business_email));
  const selectedMissingEmail = selectedBusinesses.filter((b) => !b.general_business_email);

  // Outreach Candidates: selected leads, or filtered leads if none explicitly selected
  const activeCandidatesList = selectedBusinesses.length > 0 ? selectedBusinesses : filtered;
  const outreachCandidates = activeCandidatesList.map((b) => ({
    id: b.id,
    email: b.general_business_email || b.contacts?.[0]?.contact_email || '',
    company_name: b.display_name,
    first_name: b.contacts?.[0]?.contact_name?.split(' ')[0] || 'there',
    website: b.official_website_url || '',
    city: b.city || '',
    company_type: b.ai_company_type || b.business_type || 'growing business',
    personalized_pitch: b.ai_personalized_pitch || '',
    pain_point: b.ai_pain_point || '',
    value_prop: b.ai_value_prop || '',
    industry: b.business_type || 'Commercial Services',
    ai_company_type: b.ai_company_type || b.business_type,
    ai_personalized_pitch: b.ai_personalized_pitch,
    ai_pain_point: b.ai_pain_point,
    ai_value_prop: b.ai_value_prop,
    ai_industry: b.business_type,
  }));
  const activeRecipients = outreachCandidates.filter((c) => Boolean(c.email && c.email.includes('@')));
  const sampleCandidate = activeRecipients[previewLeadIdx] || activeRecipients[0] || {};
  const renderedSubject = replaceTemplateVariables(outreachSubject, sampleCandidate);
  const renderedBody = replaceTemplateVariables(outreachBody, sampleCandidate);

  // Single Lead Enrich
  const handleEnrichSingle = async (businessId: string) => {
    setEnrichingId(businessId);
    setEnrichMessage(null);
    try {
      const res = await fetch('/api/leads/enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessId }),
      });
      const data = await res.json();
      if (res.ok && data.enriched?.[0]) {
        const item = data.enriched[0];
        if (item.status === 'enriched') {
          setEnrichMessage({
            text: `Discovered verified email (${item.email}) for ${item.businessName} via ${item.source}!`,
            type: 'success',
          });
          fetchBusinesses();
        } else {
          setEnrichMessage({
            text: `No email found on public directories or web pages for ${item.businessName}.`,
            type: 'error',
          });
        }
      } else {
        setEnrichMessage({ text: data.error || 'Failed to enrich lead', type: 'error' });
      }
    } catch (err: any) {
      setEnrichMessage({ text: err.message || 'Network error enriching lead', type: 'error' });
    } finally {
      setEnrichingId(null);
    }
  };

  // Bulk Enrich Missing (or Selected Missing)
  const handleBulkEnrich = async (targetIds?: string[]) => {
    setBulkEnriching(true);
    setEnrichMessage(null);
    try {
      const res = await fetch('/api/leads/enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(targetIds && targetIds.length > 0 ? { businessIds: targetIds } : { enrichAllMissing: true }),
      });
      const data = await res.json();
      if (res.ok) {
        setEnrichMessage({
          text: `Enrichment completed: Verified ${data.summary?.enriched || 0} emails using Deep Web Inspection, Gemini AI & MX verification!`,
          type: 'success',
        });
        fetchBusinesses();
      } else {
        setEnrichMessage({ text: data.error || 'Failed to execute bulk enrichment', type: 'error' });
      }
    } catch (err: any) {
      setEnrichMessage({ text: err.message || 'Network error during bulk enrichment', type: 'error' });
    } finally {
      setBulkEnriching(false);
    }
  };

  // Handle CSV Selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setCsvContent(text);
      const parsed = parseAndAnalyzeCsv(text);
      setCsvResult(parsed);
      setMapping(parsed.detectedMapping);
    };
    reader.readAsText(file);
  };

  const handleLoadSampleCsv = () => {
    setFileName('sample_b2b_leads.csv');
    setCsvContent(SAMPLE_LEADS_CSV);
    const parsed = parseAndAnalyzeCsv(SAMPLE_LEADS_CSV);
    setCsvResult(parsed);
    setMapping(parsed.detectedMapping);
  };

  // Handle Lead Import
  const handleImportLeads = async () => {
    if (!csvResult || csvResult.rows.length === 0) return;
    setImporting(true);
    setImportResult(null);

    try {
      const res = await fetch('/api/leads/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leads: csvResult.rows,
          mapping,
          autoEnrich: autoEnrichOnImport,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setImportResult(data);
        fetchBusinesses();
      } else {
        alert(data.error || 'Failed to import leads');
      }
    } catch (err: any) {
      alert(`Network error importing leads: ${err.message}`);
    } finally {
      setImporting(false);
    }
  };

  // Helper to insert a variable chip into the outreachBody at the current cursor position
  const handleInsertVariable = (tokenName: string) => {
    const token = `{${tokenName}}`;
    const textarea = outreachTextareaRef.current;
    if (!textarea) {
      setOutreachBody((prev) => prev + ' ' + token);
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = outreachBody;
    const before = text.substring(0, start);
    const after = text.substring(end, text.length);
    setOutreachBody(before + token + after);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + token.length, start + token.length);
    }, 0);
  };

  // Trigger AI enrichment on candidate leads
  const handleEnrichModalWithAi = async () => {
    if (activeRecipients.length === 0) return;
    setAiEnrichingModal(true);

    try {
      const res = await fetch('/api/csv-outreach/enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prospects: activeRecipients,
          mapping: {
            email: 'email',
            companyName: 'company_name',
            firstName: 'first_name',
            website: 'website',
            city: 'city',
          },
        }),
      });

      const data = await res.json();
      if (res.ok && data.enrichedProspects) {
        const enrichedMap = new Map<string, any>();
        data.enrichedProspects.forEach((ep: any) => {
          if (ep.id) enrichedMap.set(ep.id, ep);
        });

        setBusinesses((prev) =>
          prev.map((b) => {
            const ep = enrichedMap.get(b.id);
            if (ep) {
              return {
                ...b,
                ai_company_type: ep.ai_company_type || ep.company_type || b.ai_company_type,
                ai_personalized_pitch: ep.ai_personalized_pitch || ep.personalized_pitch || b.ai_personalized_pitch,
                ai_pain_point: ep.ai_pain_point || ep.pain_point || b.ai_pain_point,
                ai_value_prop: ep.ai_value_prop || ep.value_prop || b.ai_value_prop,
              };
            }
            return b;
          })
        );
        setAiEnrichedModal(true);
        setAiMetaModal(data.meta || null);
      } else {
        alert(`AI Enrichment Error: ${data.error || 'Failed to enrich prospects.'}`);
      }
    } catch (err: any) {
      alert(`Network error during AI enrichment: ${err.message}`);
    } finally {
      setAiEnrichingModal(false);
    }
  };

  // 1. Safety Gate: Send Test Email to Myself
  const handleSendTestToSelf = async () => {
    if (activeRecipients.length === 0) return;
    setTestSending(true);
    setTestError(null);

    const sample = activeRecipients[previewLeadIdx] || activeRecipients[0];
    try {
      const res = await fetch('/api/csv-outreach/test-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template: { subject: outreachSubject, bodyText: outreachBody },
          sampleProspect: sample,
          recipientOverride: operatorEmail,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setTestResult(data);
        setOutreachStep('test_sent');
      } else {
        setTestError(data.error || 'Failed to dispatch verification email.');
      }
    } catch (err: any) {
      setTestError(err.message || 'Network error sending test email.');
    } finally {
      setTestSending(false);
    }
  };

  // 2. Full Live Bulk Dispatch
  const handleDispatchOutreach = async () => {
    if (activeRecipients.length === 0) return;
    setDispatching(true);

    try {
      const res = await fetch('/api/csv-outreach/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template: { subject: outreachSubject, bodyText: outreachBody },
          recipients: activeRecipients,
          mapping: {
            email: 'email',
            companyName: 'company_name',
            firstName: 'first_name',
            website: 'website',
            city: 'city',
          },
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setDispatchSummary(data.summary);
        setDispatchResults(data.results || []);
        setOutreachStep('dispatched');
        fetchBusinesses();
      } else {
        alert(`Bulk dispatch error: ${data.error}`);
      }
    } catch (err: any) {
      alert(`Network error during dispatch: ${err.message}`);
    } finally {
      setDispatching(false);
    }
  };

  // Navigate to full-screen CSV outreach pipeline with preloaded leads
  const handleOpenInFullCsvOutreach = () => {
    try {
      sessionStorage.setItem('evee_outreach_leads', JSON.stringify(activeRecipients));
    } catch (e) {
      console.error(e);
    }
    router.push('/campaigns/csv');
  };

  return (
    <div className="min-h-screen bg-white dark:bg-[#090a0f] text-[#000000] dark:text-[#ffffff] transition-colors duration-150">
      {/* Brand 3-Color Ribbon Accent (DESIGN.md) */}
      <div className="brand-gradient-h w-full" />

      {/* Hero Band: Together AI style Canvas Dark (#010120) */}
      <section className="bg-[#010120] text-white border-b border-white/[0.08] px-6 py-12 sm:py-16 relative overflow-hidden v2-grid-bg">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-end justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center space-x-2 text-[10px] font-mono tracking-widest text-[#959494] uppercase mb-2">
              <span>PROSPECT INTELLIGENCE & DISPATCH</span>
              <span>•</span>
              <span className="v2-badge text-emerald-400 bg-emerald-500/10 border-emerald-500/20">
                v2.0 DIRECTORY
              </span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-medium tracking-tight text-white">
              Lead Explorer
            </h1>
            <p className="text-sm text-[#959494] mt-2 max-w-xl font-normal leading-relaxed">
              Deduplicated small business directory with multi-tier contact extraction, Free Gemini 1.5 Flash inference, and live email outreach execution.
            </p>
          </div>

          {/* Action CTAs: Button-primary (Solid Black/White), Button-outline (Hairline), Button-secondary-mint */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => {
                setShowCsvModal(true);
                setImportResult(null);
              }}
              className="mono-btn bg-[#313641] hover:bg-[#3d4352] text-white border border-white/[0.12] px-4 py-2 rounded-[4px] text-xs font-mono font-medium uppercase tracking-[0.05em] transition flex items-center space-x-2"
            >
              <UploadCloud className="w-3.5 h-3.5 text-[#bdbbff]" />
              <span>IMPORT CSV</span>
            </button>

            <button
              onClick={() => handleBulkEnrich()}
              disabled={bulkEnriching || missingEmailCount === 0}
              className="mono-btn bg-[#c8f6f9] hover:bg-[#b2f0f4] text-[#010120] px-4 py-2 rounded-[4px] text-xs font-mono font-medium uppercase tracking-[0.05em] transition flex items-center space-x-2 disabled:opacity-50"
            >
              <Sparkles className={`w-3.5 h-3.5 ${bulkEnriching ? 'animate-spin' : ''}`} />
              <span>
                {bulkEnriching
                  ? 'ENRICHING...'
                  : missingEmailCount > 0
                  ? `ENRICH (${missingEmailCount})`
                  : 'ALL ENRICHED'}
              </span>
            </button>

            {missingEmailCount > 0 && (
              <button
                onClick={handleArchiveAllMissingEmail}
                disabled={archiving}
                title="Archive active leads that don't have an email address"
                className="mono-btn bg-[#313641] hover:bg-[#3d4352] text-white border border-white/[0.12] px-3.5 py-2 rounded-[4px] text-xs font-mono font-medium uppercase tracking-[0.05em] transition flex items-center space-x-2 disabled:opacity-50"
              >
                <Archive className={`w-3.5 h-3.5 text-[#ef2cc1] ${archiving ? 'animate-spin' : ''}`} />
                <span>ARCHIVE NO-EMAIL ({missingEmailCount})</span>
              </button>
            )}

            <button
              onClick={() => {
                if (selectedIds.size === 0) {
                  // Select all filtered by default if none selected
                  setSelectedIds(new Set(filtered.map((b) => b.id)));
                }
                setOutreachStep('recipients');
                setPreviewLeadIdx(0);
                setTestResult(null);
                setTestError(null);
                setDispatchSummary(null);
                setDispatchResults([]);
                setShowOutreachModal(true);
              }}
              className="mono-btn bg-white hover:bg-[#ebebeb] text-[#010120] px-5 py-2 rounded-[4px] text-xs font-mono font-medium uppercase tracking-[0.05em] transition flex items-center space-x-2"
            >
              <Send className="w-3.5 h-3.5 text-[#010120]" />
              <span>{selectedIds.size > 0 ? `START OUTREACH (${selectedIds.size})` : 'START OUTREACH'}</span>
            </button>
          </div>
        </div>
      </section>

      {/* Main Canvas Body: Clean hairline borders, 4px radius */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Feedback message banner */}
        {enrichMessage && (
          <div
            className={`mb-6 p-4 rounded-[4px] border text-xs font-mono flex items-center justify-between ${
              enrichMessage.type === 'success'
                ? 'bg-[#c8f6f9]/20 border-[#c8f6f9]/60 text-emerald-800 dark:text-[#c8f6f9]'
                : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300'
            }`}
          >
            <div className="flex items-center space-x-2.5">
              {enrichMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-[#c8f6f9] shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
              )}
              <span>{enrichMessage.text}</span>
            </div>
            <button onClick={() => setEnrichMessage(null)} className="text-current opacity-60 hover:opacity-100">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Filter, Search & Selection Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-[#959494] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Filter by company, email, city, category..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-[#ebebeb] dark:border-white/[0.08] bg-white dark:bg-[#0f1017] rounded-[4px] text-xs font-mono focus:outline-none focus:border-[#000000] dark:focus:border-white transition text-[#000000] dark:text-white"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mono-eyebrow text-[#959494] text-[11px] font-mono mr-1">STATUS:</span>
            {[
              { id: 'active', label: `ACTIVE (${activeBusinesses.length})` },
              { id: 'missing_email', label: `NO EMAIL (${missingEmailCount})` },
              { id: 'archived', label: `ARCHIVED (${archivedCount})` },
              { id: 'all', label: `ALL (${businesses.length})` },
              { id: 'suppressed', label: 'SUPPRESSED' },
            ].map((st) => (
              <button
                key={st.id}
                onClick={() => setStatusFilter(st.id as any)}
                className={`mono-btn text-xs px-3 py-1.5 rounded-[4px] transition font-mono uppercase tracking-wider ${
                  statusFilter === st.id
                    ? 'bg-[#000000] dark:bg-white text-white dark:text-[#000000] font-semibold'
                    : 'bg-white dark:bg-[#14161f] border border-[#ebebeb] dark:border-white/[0.08] text-[#959494] hover:text-[#000000] dark:hover:text-white'
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>
        </div>

        {/* Lead Table / List: Canonical Together AI data-table style */}
        {loading ? (
          <div className="py-20 text-center font-mono text-xs text-[#959494]">Loading discovered leads...</div>
        ) : filtered.length === 0 ? (
          <div className="border border-[#ebebeb] dark:border-white/[0.08] rounded-[4px] p-16 text-center bg-white dark:bg-[#0f1017]">
            <p className="text-xs text-[#959494] font-mono mb-4">No prospects match your search criteria.</p>
            <button
              onClick={() => setShowCsvModal(true)}
              className="mono-btn bg-[#000000] dark:bg-white text-white dark:text-[#000000] px-4 py-2 rounded-[4px] text-xs font-mono uppercase tracking-wider inline-flex items-center space-x-2"
            >
              <UploadCloud className="w-3.5 h-3.5" />
              <span>IMPORT PROSPECTS FROM CSV</span>
            </button>
          </div>
        ) : (
          <div className="border border-[#ebebeb] dark:border-white/[0.08] rounded-[4px] overflow-hidden bg-white dark:bg-[#0f1017]">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                {/* data-table-header */}
                <thead className="bg-[#f4f4f5] dark:bg-[#14161f] border-b border-[#ebebeb] dark:border-white/[0.08] text-[#959494]">
                  <tr>
                    <th className="py-3 px-4 w-10">
                      <button
                        type="button"
                        onClick={handleSelectAll}
                        className="text-[#959494] hover:text-[#000000] dark:hover:text-white flex items-center"
                        title={selectedIds.size === filtered.length ? 'Deselect all' : 'Select all'}
                      >
                        {selectedIds.size === filtered.length && filtered.length > 0 ? (
                          <CheckSquare className="w-4 h-4 text-[#000000] dark:text-white" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                    </th>
                    <th className="py-3 px-4 font-medium tracking-[0.55px] uppercase">BUSINESS NAME</th>
                    <th className="py-3 px-4 font-medium tracking-[0.55px] uppercase">CONTACT & EMAIL</th>
                    <th className="py-3 px-4 font-medium tracking-[0.55px] uppercase">CATEGORY</th>
                    <th className="py-3 px-4 font-medium tracking-[0.55px] uppercase">LOCATION</th>
                    <th className="py-3 px-4 font-medium tracking-[0.55px] uppercase">STATUS</th>
                    <th className="py-3 px-4 font-medium tracking-[0.55px] uppercase text-right">ACTION</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#ebebeb] dark:divide-white/[0.06]">
                  {filtered.map((b) => {
                    const isSelected = selectedIds.has(b.id);
                    const hasEmail = Boolean(b.general_business_email);
                    const isEnrichingThis = enrichingId === b.id;
                    const contactName = b.contacts?.[0]?.contact_name;

                    return (
                      <tr
                        key={b.id}
                        className={`transition group ${
                          isSelected
                            ? 'bg-[#c8f6f9]/10 dark:bg-white/[0.03]'
                            : 'hover:bg-[#f8fafc] dark:hover:bg-[#14161f]'
                        }`}
                      >
                        {/* Checkbox */}
                        <td className="py-3.5 px-4">
                          <button
                            type="button"
                            onClick={() => handleToggleSelect(b.id)}
                            className="text-[#959494] hover:text-[#000000] dark:hover:text-white flex items-center"
                          >
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-[#000000] dark:text-white" />
                            ) : (
                              <Square className="w-4 h-4" />
                            )}
                          </button>
                        </td>

                        {/* Business Name */}
                        <td className="py-3.5 px-4 font-sans">
                          <Link
                            href={`/leads/${b.id}`}
                            className="font-medium text-sm text-[#000000] dark:text-white hover:underline flex items-center space-x-1.5"
                          >
                            <span>{b.display_name}</span>
                            <ChevronRight className="w-3.5 h-3.5 text-[#959494] group-hover:translate-x-0.5 transition-transform" />
                          </Link>
                          {b.official_website_url && (
                            <span className="text-[11px] text-[#959494] font-mono block mt-0.5 truncate max-w-xs">
                              {b.official_website_url}
                            </span>
                          )}
                        </td>

                        {/* Contact & Email with Live Free AI/Web Discovery */}
                        <td className="py-3.5 px-4 font-mono">
                          {hasEmail ? (
                            <div>
                              <div className="flex items-center space-x-1.5 text-[#000000] dark:text-white font-normal">
                                <Mail className="w-3 h-3 text-[#959494]" />
                                <span>{b.general_business_email}</span>
                              </div>
                              {contactName && (
                                <div className="text-[11px] text-[#959494] mt-0.5">
                                  {contactName}
                                </div>
                              )}
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleEnrichSingle(b.id)}
                              disabled={isEnrichingThis || bulkEnriching}
                              className="mono-btn px-2.5 py-1 rounded-[4px] bg-white dark:bg-[#14161f] border border-[#ebebeb] dark:border-white/[0.12] text-[#000000] dark:text-white hover:bg-[#f4f4f5] dark:hover:bg-[#1c1d27] flex items-center space-x-1.5 text-[11px] font-mono tracking-wider uppercase transition disabled:opacity-50"
                              title="Crawl contact pages, infer via Gemini AI, and verify MX"
                            >
                              <Sparkles className={`w-3 h-3 ${isEnrichingThis ? 'animate-spin' : ''}`} />
                              <span>{isEnrichingThis ? 'FINDING...' : 'FIND EMAIL'}</span>
                            </button>
                          )}
                        </td>

                        {/* Category */}
                        <td className="py-3.5 px-4 text-[#959494]">
                          <span className="px-2 py-0.5 rounded-[4px] bg-[#f4f4f5] dark:bg-[#14161f] text-[#000000] dark:text-white text-[11px] font-mono border border-[#ebebeb] dark:border-white/[0.08]">
                            {b.business_type}
                          </span>
                        </td>

                        {/* Location */}
                        <td className="py-3.5 px-4 text-[#959494]">
                          {b.city}, {b.country_code}
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-[4px] font-mono text-[10px] uppercase tracking-wider ${
                              b.record_status === 'active'
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                                : b.record_status === 'archived'
                                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                                : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                            }`}
                          >
                            {b.record_status}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 text-right font-mono">
                          <div className="inline-flex items-center space-x-1.5">
                            {b.record_status === 'archived' ? (
                              <button
                                type="button"
                                onClick={() => handleUnarchive([b.id])}
                                disabled={archiving}
                                title="Restore lead to active directory"
                                className="mono-btn bg-white dark:bg-[#14161f] hover:bg-emerald-50 dark:hover:bg-emerald-950/20 border border-[#ebebeb] dark:border-white/[0.08] text-emerald-600 dark:text-emerald-400 px-2.5 py-1 rounded-[4px] text-[11px] font-mono inline-flex items-center space-x-1 transition"
                              >
                                <RotateCcw className="w-3 h-3" />
                                <span>RESTORE</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleArchive([b.id])}
                                disabled={archiving}
                                title="Archive lead (removes from active outreach)"
                                className="mono-btn bg-white dark:bg-[#14161f] hover:bg-amber-50 dark:hover:bg-amber-950/20 border border-[#ebebeb] dark:border-white/[0.08] text-[#959494] hover:text-amber-600 dark:hover:text-amber-400 px-2.5 py-1 rounded-[4px] text-[11px] font-mono inline-flex items-center space-x-1 transition"
                              >
                                <Archive className="w-3 h-3" />
                                <span>ARCHIVE</span>
                              </button>
                            )}

                            <Link
                              href={`/leads/${b.id}`}
                              className="mono-btn bg-white dark:bg-[#14161f] hover:bg-[#f4f4f5] dark:hover:bg-[#1c1d27] border border-[#ebebeb] dark:border-white/[0.08] text-[#000000] dark:text-white px-3 py-1 rounded-[4px] text-[11px] font-mono inline-flex items-center space-x-1"
                            >
                              <span>EVIDENCE</span>
                              <ChevronRight className="w-3 h-3" />
                            </Link>
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

      {/* Floating Action Bar when Leads are selected (DESIGN.md Level 3 Elevation) */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-[#010120] text-white border border-white/[0.16] rounded-[4px] px-5 py-3 shadow-2xl flex items-center space-x-4 animate-in fade-in slide-in-from-bottom-4">
          <div className="font-mono text-xs flex items-center space-x-2">
            <span>
              <strong>{selectedIds.size}</strong> {selectedIds.size === 1 ? 'LEAD' : 'LEADS'} SELECTED
            </span>
          </div>

          <div className="h-4 w-px bg-white/20" />

          {selectedMissingEmail.length > 0 && (
            <button
              onClick={() => handleBulkEnrich(selectedMissingEmail.map((b) => b.id))}
              disabled={bulkEnriching}
              className="mono-btn bg-[#313641] hover:bg-[#3d4352] text-white border border-white/[0.12] px-3 py-1.5 rounded-[4px] text-xs font-mono font-medium uppercase tracking-wider flex items-center space-x-1.5 transition disabled:opacity-50"
            >
              <Sparkles className="w-3 h-3 text-[#bdbbff]" />
              <span>ENRICH ({selectedMissingEmail.length})</span>
            </button>
          )}

          {statusFilter === 'archived' ? (
            <button
              onClick={() => handleUnarchive(Array.from(selectedIds))}
              disabled={archiving}
              className="mono-btn bg-[#313641] hover:bg-emerald-950/40 text-emerald-300 border border-emerald-500/30 px-3 py-1.5 rounded-[4px] text-xs font-mono font-medium uppercase tracking-wider flex items-center space-x-1.5 transition disabled:opacity-50"
            >
              <RotateCcw className="w-3 h-3" />
              <span>RESTORE ({selectedIds.size})</span>
            </button>
          ) : (
            <button
              onClick={() => handleArchive(Array.from(selectedIds))}
              disabled={archiving}
              className="mono-btn bg-[#313641] hover:bg-rose-950/40 text-rose-300 border border-rose-500/30 px-3 py-1.5 rounded-[4px] text-xs font-mono font-medium uppercase tracking-wider flex items-center space-x-1.5 transition disabled:opacity-50"
            >
              <Archive className="w-3 h-3 text-[#ef2cc1]" />
              <span>ARCHIVE ({selectedIds.size})</span>
            </button>
          )}

          <button
            onClick={() => {
              setOutreachStep('recipients');
              setPreviewLeadIdx(0);
              setTestResult(null);
              setTestError(null);
              setDispatchSummary(null);
              setDispatchResults([]);
              setShowOutreachModal(true);
            }}
            className="mono-btn bg-white hover:bg-[#ebebeb] text-[#010120] px-4 py-1.5 rounded-[4px] text-xs font-mono font-medium uppercase tracking-wider flex items-center space-x-1.5 transition"
          >
            <Send className="w-3 h-3 text-[#010120]" />
            <span>START OUTREACH</span>
          </button>

          <button
            onClick={handleClearSelection}
            className="text-xs font-mono text-[#959494] hover:text-white transition"
          >
            CLEAR
          </button>
        </div>
      )}

      {/* Outreach Dispatch Modal: Strictly unified with CSV Direct Outreach */}
      {showOutreachModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#010120] border border-[#ebebeb] dark:border-white/[0.12] rounded-[4px] w-full max-w-5xl max-h-[92vh] overflow-y-auto p-6 sm:p-8 space-y-6">
            <div className="brand-gradient-h -mx-6 -mt-6 sm:-mx-8 sm:-mt-8 mb-6" />

            <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-[#ebebeb] dark:border-white/[0.08] gap-4">
              <div>
                <div className="flex items-center gap-2 text-[10px] font-mono tracking-wider uppercase mb-1 whitespace-nowrap">
                  <span className="inline-flex items-center gap-1 text-[#959494] font-medium">
                    <Send className="w-2.5 h-2.5 text-[#ef2cc1]" />
                    OUTREACH PIPELINE
                  </span>
                  <span className="text-[#959494]/40">•</span>
                  <span className="inline-flex items-center gap-1 text-[#ef2cc1] font-semibold">
                    <Sparkles className="w-2.5 h-2.5" />
                    AI ENGINE
                  </span>
                </div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h3 className="text-xl font-medium tracking-tight text-black dark:text-white whitespace-nowrap">
                    Direct Outreach to Leads
                  </h3>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-[#f8fafc] dark:bg-white/[0.06] border border-[#ebebeb] dark:border-white/[0.08] text-[#959494] inline-flex items-center gap-1 whitespace-nowrap">
                    <Users className="w-3 h-3 text-[#959494]" />
                    {activeRecipients.length} ready
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 sm:gap-3 flex-wrap sm:flex-nowrap">
                {/* Stepper Pill Indicator with Icons */}
                <div className="flex items-center space-x-1 bg-[#f8fafc] dark:bg-[#313641]/40 border border-[#ebebeb] dark:border-white/[0.08] rounded-[4px] p-1 text-xs font-mono">
                  {[
                    { id: 'recipients', icon: Users, label: 'Candidates' },
                    { id: 'template', icon: PenLine, label: 'Compose' },
                    { id: 'test_sent', icon: ShieldCheck, label: 'Test' },
                    { id: 'dispatched', icon: Send, label: 'Dispatched' },
                  ].map((s) => {
                    const active = outreachStep === s.id;
                    const StepIcon = s.icon;
                    return (
                      <span
                        key={s.id}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[3px] text-[11px] font-mono whitespace-nowrap transition ${
                          active
                            ? 'bg-black dark:bg-white text-white dark:text-black font-semibold shadow-sm'
                            : 'text-[#959494]'
                        }`}
                      >
                        <StepIcon className="w-3 h-3 shrink-0" />
                        <span>{s.label}</span>
                      </span>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={handleOpenInFullCsvOutreach}
                  title="Open in Full-Screen CSV Outreach Page"
                  className="mono-btn hidden md:inline-flex items-center gap-1 text-xs text-[#ef2cc1] hover:underline font-mono px-2 py-1 rounded hover:bg-[#ef2cc1]/10 transition whitespace-nowrap"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Full Page</span>
                </button>

                <button
                  onClick={() => setShowOutreachModal(false)}
                  className="text-[#959494] hover:text-black dark:hover:text-white p-1 rounded hover:bg-neutral-100 dark:hover:bg-white/[0.08] transition"
                  aria-label="Close dialog"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* STEP 1: CANDIDATES & AI CLASSIFICATION */}
            {outreachStep === 'recipients' && (
              <div className="space-y-5 font-mono text-xs">
                {/* Stats Breakdown */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-3 bg-[#f8fafc] dark:bg-[#313641]/20 border border-[#ebebeb] dark:border-white/[0.08] rounded-[4px]">
                    <div className="flex items-center justify-between text-[#959494] text-[10px] uppercase font-semibold">
                      <span className="flex items-center gap-1.5">
                        <Users className="w-3 h-3 text-[#959494]" />
                        Candidates
                      </span>
                    </div>
                    <div className="text-xl font-semibold text-black dark:text-white mt-1">
                      {outreachCandidates.length}
                    </div>
                  </div>
                  <div className="p-3 bg-[#f8fafc] dark:bg-[#313641]/20 border border-[#ebebeb] dark:border-white/[0.08] rounded-[4px]">
                    <div className="flex items-center justify-between text-[#959494] text-[10px] uppercase font-semibold">
                      <span className="flex items-center gap-1.5">
                        <MailCheck className="w-3 h-3 text-emerald-500" />
                        Valid Emails
                      </span>
                    </div>
                    <div className="text-xl font-semibold text-emerald-600 dark:text-emerald-400 mt-1">
                      {activeRecipients.length}
                    </div>
                  </div>
                  <div className="p-3 bg-[#f8fafc] dark:bg-[#313641]/20 border border-[#ebebeb] dark:border-white/[0.08] rounded-[4px]">
                    <div className="flex items-center justify-between text-[#959494] text-[10px] uppercase font-semibold">
                      <span className="flex items-center gap-1.5">
                        <AlertCircle className="w-3 h-3 text-amber-500" />
                        Missing Email
                      </span>
                    </div>
                    <div className="text-xl font-semibold text-amber-600 dark:text-amber-400 mt-1 flex items-center justify-between">
                      <span>{outreachCandidates.length - activeRecipients.length}</span>
                      {outreachCandidates.length - activeRecipients.length > 0 && (
                        <button
                          onClick={() => handleBulkEnrich(selectedMissingEmail.map((b) => b.id))}
                          disabled={bulkEnriching}
                          className="mono-btn text-[10px] px-2 py-0.5 rounded-[3px] bg-black dark:bg-white text-white dark:text-black uppercase font-semibold disabled:opacity-50 inline-flex items-center gap-1 whitespace-nowrap"
                        >
                          <Sparkles className="w-2.5 h-2.5" />
                          <span>{bulkEnriching ? 'Enriching...' : 'Enrich'}</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Flat Technical AI Reasoning & Adaptation Bar (Together AI Aesthetic) */}
                <div className="ai-flat-container overflow-hidden">
                  {/* Active Linear Scanner when Enriching, otherwise static 2px brand ribbon */}
                  {aiEnrichingModal ? (
                    <div className="w-full h-[2px] bg-neutral-200 dark:bg-white/[0.08] overflow-hidden relative">
                      <div className="w-1/3 h-full bg-gradient-to-r from-[#fc4c02] via-[#ef2cc1] to-[#bdbbff] animate-flat-scan" />
                    </div>
                  ) : (
                    <div className="brand-gradient-h w-full" />
                  )}

                  <div className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="mono-eyebrow text-[#959494] text-[10px] tracking-[0.55px] uppercase font-semibold flex items-center gap-1.5">
                          <Sparkles className="w-3 h-3 text-[#ef2cc1]" />
                          AI REASONING & COPY ADAPTATION
                        </span>
                        {aiEnrichingModal && (
                          <span className="ai-flat-pill text-black dark:text-white border-[#ebebeb] dark:border-white/[0.12] inline-flex items-center gap-1">
                            <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                            <span>SYNTHESIZING...</span>
                          </span>
                        )}
                      </div>

                      <div className="text-xs font-mono text-black dark:text-white leading-relaxed">
                        {aiEnrichingModal
                          ? `Evaluating ${activeRecipients.length} candidate businesses: deducing operating verticals, friction points, and bespoke angles...`
                          : aiEnrichedModal
                          ? `All ${activeRecipients.length} candidate businesses enriched with tailored value propositions.`
                          : 'Uses neural reasoning to deduce company verticals, friction points, and bespoke value props per prospect.'}
                      </div>

                      <div className="text-[11px] text-[#959494] font-mono flex flex-wrap items-center gap-2 pt-0.5">
                        <span className="inline-flex items-center gap-1">
                          <Users className="w-3 h-3 text-[#959494]" />
                          {activeRecipients.length} prospects
                        </span>
                        <span>•</span>
                        <span className="inline-flex items-center gap-1 text-[#ef2cc1] font-semibold">
                          <Cpu className="w-3 h-3" />
                          Deduces:
                        </span>
                        {['vertical', 'pain_point', 'value_prop', 'pitch'].map((tag) => (
                          <span
                            key={tag}
                            className="px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/[0.06] text-[10px] font-mono text-black dark:text-white whitespace-nowrap"
                          >
                            +{tag}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Flat Technical Action Button */}
                    <div className="shrink-0 self-start md:self-auto">
                      <button
                        type="button"
                        onClick={handleEnrichModalWithAi}
                        disabled={aiEnrichingModal || activeRecipients.length === 0}
                        className={`mono-btn px-4 py-2 rounded-[4px] text-xs font-mono font-medium uppercase tracking-wider flex items-center space-x-2 transition whitespace-nowrap ${
                          aiEnrichingModal
                            ? 'bg-neutral-100 dark:bg-white/[0.08] text-neutral-400 cursor-not-allowed border border-[#ebebeb] dark:border-white/[0.08]'
                            : aiEnrichedModal
                            ? 'bg-white dark:bg-[#14161f] text-black dark:text-white border border-[#ebebeb] dark:border-white/[0.16] hover:border-black dark:hover:border-white'
                            : 'bg-black dark:bg-white text-white dark:text-black hover:bg-neutral-800 dark:hover:bg-neutral-200'
                        }`}
                      >
                        {aiEnrichingModal ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            <span>INFERRING...</span>
                          </>
                        ) : aiEnrichedModal ? (
                          <>
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>RE-ENRICH ALL</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-3.5 h-3.5 text-[#ef2cc1]" />
                            <span>ENRICH ALL WITH AI</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Candidate Preview Table */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="mono-eyebrow text-[#6b7280] dark:text-[#959494] font-semibold text-[11px] flex items-center gap-1.5">
                      <Layers className="w-3 h-3 text-[#959494]" />
                      CANDIDATE LEADS PREVIEW
                    </span>
                    <span className="text-[11px] text-[#959494] flex items-center gap-1 font-mono">
                      <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                      {activeRecipients.length} valid email recipients
                    </span>
                  </div>

                  <div className="border border-[#ebebeb] dark:border-white/[0.08] rounded-[4px] overflow-hidden overflow-x-auto max-h-56">
                    <table className="w-full text-left text-xs font-mono">
                      <thead className="bg-[#f8fafc] dark:bg-[#313641]/30 border-b border-[#ebebeb] dark:border-white/[0.08] text-[#959494] sticky top-0 bg-opacity-95">
                        <tr>
                          <th className="py-2 px-3 whitespace-nowrap">#</th>
                          <th className="py-2 px-3 text-[#ef2cc1] whitespace-nowrap">
                            <span className="inline-flex items-center gap-1">
                              <Sparkles className="w-3 h-3" />
                              AI TYPE
                            </span>
                          </th>
                          <th className="py-2 px-3 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1">
                              <Building2 className="w-3 h-3 text-[#959494]" />
                              COMPANY
                            </span>
                          </th>
                          <th className="py-2 px-3 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1">
                              <Mail className="w-3 h-3 text-[#959494]" />
                              EMAIL
                            </span>
                          </th>
                          <th className="py-2 px-3 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="w-3 h-3 text-[#959494]" />
                              CITY
                            </span>
                          </th>
                          <th className="py-2 px-3 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1">
                              <Globe className="w-3 h-3 text-[#959494]" />
                              WEBSITE
                            </span>
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#ebebeb] dark:divide-white/[0.06]">
                        {outreachCandidates.slice(0, 15).map((row, idx) => (
                          <tr key={idx} className="hover:bg-[#f8fafc] dark:hover:bg-white/[0.02]">
                            <td className="py-2 px-3 text-[#959494] whitespace-nowrap">{idx + 1}</td>
                            <td className="py-2 px-3 whitespace-nowrap">
                              <span className="ai-flat-pill animate-ios-swish text-[10px]">
                                <span className="w-1 h-1 rounded-[1px] bg-[#ef2cc1]" />
                                <span>{row.ai_company_type || row.company_type || 'Commercial Enterprise'}</span>
                              </span>
                            </td>
                            <td className="py-2 px-3 text-black dark:text-white font-medium whitespace-nowrap truncate max-w-[160px]">
                              {row.company_name}
                            </td>
                            <td className="py-2 px-3 whitespace-nowrap">
                              {row.email ? (
                                <span className="text-emerald-600 dark:text-emerald-400">{row.email}</span>
                              ) : (
                                <span className="text-rose-500 text-[10px] inline-flex items-center gap-1">
                                  <AlertCircle className="w-2.5 h-2.5" />
                                  Missing Email
                                </span>
                              )}
                            </td>
                            <td className="py-2 px-3 text-[#959494] whitespace-nowrap">{row.city || '—'}</td>
                            <td className="py-2 px-3 text-[#959494] truncate max-w-xs whitespace-nowrap">{row.website || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Footer Controls */}
                <div className="flex items-center justify-between pt-4 border-t border-[#ebebeb] dark:border-white/[0.08]">
                  <button
                    type="button"
                    onClick={() => setShowOutreachModal(false)}
                    className="text-xs font-mono text-[#959494] hover:text-black dark:hover:text-white inline-flex items-center gap-1"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Cancel</span>
                  </button>

                  <button
                    onClick={() => setOutreachStep('template')}
                    disabled={activeRecipients.length === 0}
                    className="mono-btn bg-black dark:bg-white text-white dark:text-black px-5 py-2.5 rounded-[4px] text-xs font-semibold flex items-center space-x-1.5 shadow-sm transition active:scale-95 disabled:opacity-50 whitespace-nowrap"
                  >
                    <span>Compose Template ({activeRecipients.length})</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 2: COMPOSE TEMPLATE & REAL-TIME PREVIEW */}
            {outreachStep === 'template' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  {/* Left Column: Editor & Variables Toolbar */}
                  <div className="lg:col-span-7 bg-white dark:bg-[#010120] border border-[#ebebeb] dark:border-white/[0.08] rounded-[4px] p-5 space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-[#ebebeb] dark:border-white/[0.08]">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <PenLine className="w-3.5 h-3.5 text-[#ef2cc1]" />
                          <h4 className="text-sm font-semibold text-black dark:text-white">
                            Compose Outreach Template
                          </h4>
                        </div>
                        <p className="text-[11px] text-[#959494] font-mono mt-0.5">
                          Click dynamic chips to insert personalized tokens
                        </p>
                      </div>
                      <button
                        onClick={() => setOutreachStep('recipients')}
                        className="mono-btn text-xs text-[#6b7280] dark:text-[#959494] hover:text-black dark:hover:text-white flex items-center space-x-1 whitespace-nowrap"
                      >
                        <ArrowLeft className="w-3 h-3" />
                        <span>Back</span>
                      </button>
                    </div>

                    {/* Flat Technical AI Variable Tokens */}
                    <div className="ai-flat-container overflow-hidden">
                      <div className="brand-gradient-h w-full" />
                      <div className="p-3.5 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-1.5 text-black dark:text-white font-mono text-xs font-semibold">
                            <Sparkles className="w-3 h-3 text-[#ef2cc1]" />
                            <span>AI ADAPTATION TOKENS</span>
                          </div>
                          <span className="text-[10px] font-mono text-[#959494] hidden sm:inline">
                            Dynamically evaluated per lead
                          </span>
                        </div>

                        <div className="flex flex-wrap gap-1.5">
                          {[
                            { token: 'company_type', label: 'company_type', desc: 'Identified Business Type' },
                            { token: 'personalized_pitch', label: 'pitch', desc: 'Tailored Industry Pitch' },
                            { token: 'pain_point', label: 'pain_point', desc: 'Industry Specific Bottleneck' },
                            { token: 'value_prop', label: 'value_prop', desc: 'Tailored Solution' },
                            { token: 'industry', label: 'industry', desc: 'High-Level Industry' },
                          ].map((v) => (
                            <button
                              key={v.token}
                              type="button"
                              onClick={() => handleInsertVariable(v.token)}
                              className="mono-btn text-[11px] font-mono px-2.5 py-1 rounded-[3px] bg-[#f8fafc] dark:bg-[#14161f] border border-[#ebebeb] dark:border-white/[0.12] text-black dark:text-white hover:border-[#ef2cc1] transition inline-flex items-center gap-1 whitespace-nowrap"
                              title={v.desc}
                            >
                              <Sparkles className="w-2.5 h-2.5 text-[#ef2cc1]" />
                              <span>+{`{${v.token}}`}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Standard Contact Variables */}
                    <div>
                      <div className="mono-eyebrow text-[#6b7280] dark:text-[#959494] mb-1.5 text-[10px] font-semibold flex items-center gap-1">
                        <Users className="w-2.5 h-2.5 text-[#959494]" />
                        <span>STANDARD CONTACT VARIABLES</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {[
                          { token: 'first_name', icon: User },
                          { token: 'company_name', icon: Building2 },
                          { token: 'website', icon: Globe },
                          { token: 'city', icon: MapPin },
                          { token: 'email', icon: Mail },
                        ].map((v) => {
                          const VIcon = v.icon;
                          return (
                            <button
                              key={v.token}
                              type="button"
                              onClick={() => handleInsertVariable(v.token)}
                              className="mono-btn text-[11px] px-2 py-0.5 rounded-[3px] bg-[#f8fafc] dark:bg-[#313641]/30 border border-[#ebebeb] dark:border-white/[0.08] text-black dark:text-white hover:border-black dark:hover:border-white transition inline-flex items-center gap-1 whitespace-nowrap"
                            >
                              <VIcon className="w-2.5 h-2.5 text-[#959494]" />
                              <span>+{`{${v.token}}`}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Subject Line Input */}
                    <div>
                      <label className="mono-eyebrow text-[#6b7280] dark:text-[#959494] flex items-center gap-1 mb-1 text-[11px]">
                        <Mail className="w-3 h-3 text-[#959494]" />
                        <span>SUBJECT LINE</span>
                      </label>
                      <input
                        type="text"
                        value={outreachSubject}
                        onChange={(e) => setOutreachSubject(e.target.value)}
                        placeholder="e.g. Quick question regarding {company_name}"
                        className="w-full text-xs font-mono border border-[#ebebeb] dark:border-white/[0.08] bg-white dark:bg-[#010120] rounded-[4px] p-2.5 text-black dark:text-white focus:outline-none focus:border-black dark:focus:border-white"
                      />
                    </div>

                    {/* Body Textarea */}
                    <div>
                      <label className="mono-eyebrow text-[#6b7280] dark:text-[#959494] flex items-center gap-1 mb-1 text-[11px]">
                        <FileText className="w-3 h-3 text-[#959494]" />
                        <span>EMAIL BODY TEMPLATE</span>
                      </label>
                      <textarea
                        ref={outreachTextareaRef}
                        rows={8}
                        value={outreachBody}
                        onChange={(e) => setOutreachBody(e.target.value)}
                        placeholder="Hi {first_name},\n\nWrite your message here..."
                        className="w-full text-xs font-mono leading-relaxed border border-[#ebebeb] dark:border-white/[0.08] bg-white dark:bg-[#010120] rounded-[4px] p-3 text-black dark:text-white focus:outline-none focus:border-black dark:focus:border-white"
                      />
                    </div>

                    {/* Test Error Alert */}
                    {testError && (
                      <div className="p-3 rounded-[4px] border border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs font-mono flex items-center space-x-2">
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                        <span>{testError}</span>
                      </div>
                    )}

                    {/* Send Test to Myself Safety Gate */}
                    <div className="pt-3 border-t border-[#ebebeb] dark:border-white/[0.08] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      <div className="text-xs font-mono text-[#6b7280] dark:text-[#959494] flex items-center space-x-1.5 whitespace-nowrap">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        <span>Pre-flight verification required</span>
                      </div>

                      <button
                        onClick={handleSendTestToSelf}
                        disabled={testSending || !outreachSubject || !outreachBody}
                        className="mono-btn bg-black dark:bg-white text-white dark:text-black hover:bg-neutral-800 dark:hover:bg-neutral-200 px-4 py-2 rounded-[4px] text-xs font-semibold flex items-center space-x-2 shadow-sm transition active:scale-95 disabled:opacity-50 whitespace-nowrap"
                      >
                        {testSending ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            <span>SENDING TEST...</span>
                          </>
                        ) : (
                          <>
                            <Mail className="w-3.5 h-3.5" />
                            <span>SEND TEST TO MYSELF</span>
                            <ArrowRight className="w-3 h-3" />
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Right Column: Live Variable Preview Sidebar */}
                  <div className="lg:col-span-5 bg-white dark:bg-[#010120] border border-[#ebebeb] dark:border-white/[0.08] rounded-[4px] p-5 space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-[#ebebeb] dark:border-white/[0.08]">
                      <div className="flex items-center space-x-2">
                        <Eye className="w-3.5 h-3.5 text-[#ef2cc1]" />
                        <span className="mono-eyebrow text-black dark:text-white font-semibold text-[11px]">
                          LIVE PREVIEW
                        </span>
                      </div>

                      {/* Prospect Selector */}
                      {activeRecipients.length > 0 && (
                        <div className="relative inline-flex items-center">
                          <select
                            value={previewLeadIdx}
                            onChange={(e) => setPreviewLeadIdx(Number(e.target.value))}
                            className="appearance-none text-[11px] font-mono border border-[#ebebeb] dark:border-white/[0.08] bg-white dark:bg-[#010120] rounded-[3px] pl-2.5 pr-7 py-1 text-black dark:text-white focus:outline-none focus:border-black cursor-pointer max-w-[180px] truncate"
                          >
                            {activeRecipients.slice(0, 20).map((r, i) => (
                              <option key={i} value={i}>
                                #{i + 1} {r.company_name}
                              </option>
                            ))}
                          </select>
                          <ChevronDown className="w-3 h-3 absolute right-2 text-[#959494] pointer-events-none" />
                        </div>
                      )}
                    </div>

                    {/* Flat AI Synthesized Profile Card */}
                    <div className="ai-flat-container overflow-hidden">
                      <div className="brand-gradient-h w-full" />
                      <div className="p-3.5 space-y-2">
                        <div className="flex items-center justify-between pb-2 border-b border-[#ebebeb] dark:border-white/[0.06]">
                          <div className="flex items-center space-x-1.5 text-black dark:text-white text-xs font-mono font-semibold">
                            <Sparkles className="w-3 h-3 text-[#ef2cc1]" />
                            <span>AI PROFILE</span>
                          </div>
                          <span className="ai-flat-pill text-[9px] truncate max-w-[140px]">
                            {sampleCandidate.ai_industry || sampleCandidate.industry || 'Commercial Services'}
                          </span>
                        </div>
                        <div>
                          <span className="text-[9px] font-mono uppercase text-[#959494] flex items-center gap-1">
                            <Building2 className="w-2.5 h-2.5" />
                            VERTICAL
                          </span>
                          <div className="text-xs font-semibold text-black dark:text-white font-mono mt-0.5">
                            {sampleCandidate.ai_company_type || sampleCandidate.company_type || 'Growing Business'}
                          </div>
                        </div>
                        {sampleCandidate.ai_pain_point && (
                          <div className="pt-1.5 border-t border-[#ebebeb] dark:border-white/[0.06]">
                            <span className="text-[9px] font-mono uppercase text-[#959494] flex items-center gap-1">
                              <AlertTriangle className="w-2.5 h-2.5 text-amber-500" />
                              OPERATIONAL FRICTION
                            </span>
                            <div className="text-[11px] font-mono text-black dark:text-white leading-snug mt-0.5">
                              {sampleCandidate.ai_pain_point}
                            </div>
                          </div>
                        )}
                        {sampleCandidate.ai_personalized_pitch && (
                          <div className="pt-1.5 border-t border-[#ebebeb] dark:border-white/[0.06]">
                            <span className="text-[9px] font-mono uppercase text-[#959494] flex items-center gap-1">
                              <Sparkles className="w-2.5 h-2.5 text-[#ef2cc1]" />
                              BESPOKE PITCH
                            </span>
                            <div className="text-[11px] font-mono text-black dark:text-white leading-snug mt-0.5">
                              {sampleCandidate.ai_personalized_pitch}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="bg-[#f8fafc] dark:bg-[#313641]/20 rounded-[4px] border border-[#ebebeb] dark:border-white/[0.08] p-3.5 text-xs font-mono space-y-2.5">
                      <div className="flex items-center gap-1.5 truncate">
                        <Mail className="w-3 h-3 text-[#959494] shrink-0" />
                        <span className="text-[#959494] text-[10px] font-semibold">TO:</span>
                        <span className="text-black dark:text-white truncate">
                          {sampleCandidate.email || 'recipient@domain.com'}
                        </span>
                      </div>

                      <div className="pt-2 border-t border-[#ebebeb] dark:border-white/[0.06]">
                        <span className="text-[#959494] block text-[10px] font-semibold mb-0.5">SUBJECT:</span>
                        <span className="text-black dark:text-white font-medium">{renderedSubject}</span>
                      </div>

                      <div className="pt-2 border-t border-[#ebebeb] dark:border-white/[0.06]">
                        <span className="text-[#959494] block text-[10px] font-semibold mb-1">BODY:</span>
                        <div className="whitespace-pre-line leading-relaxed text-[#374151] dark:text-[#d4d4d8]">
                          {renderedBody}
                        </div>
                      </div>
                    </div>

                    <div className="p-2.5 bg-[#f8fafc] dark:bg-[#313641]/20 border border-[#ebebeb] dark:border-white/[0.08] rounded-[4px] text-[11px] font-mono text-[#6b7280] dark:text-[#959494] flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 truncate">
                        <Info className="w-3.5 h-3.5 text-[#959494] shrink-0" />
                        <span className="text-[#959494] whitespace-nowrap">Test destination:</span>
                        <strong className="text-black dark:text-white truncate">
                          {operatorEmail || 'logged-in email'}
                        </strong>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 3: PRE-FLIGHT TEST VERIFICATION REVIEW */}
            {outreachStep === 'test_sent' && (
              <div className="max-w-2xl mx-auto space-y-5 font-mono text-xs">
                <div className="border border-[#ebebeb] dark:border-white/[0.08] bg-white dark:bg-[#010120] rounded-[4px] p-6 space-y-5">
                  <div className="flex items-start space-x-3.5 mb-2">
                    <div className="w-8 h-8 rounded-[4px] bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 flex items-center justify-center shrink-0">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-base font-semibold text-black dark:text-white">
                        Test Email Dispatched Successfully
                      </h4>
                      <p className="text-xs text-[#959494] font-mono mt-0.5">
                        Delivered rendered copy to <strong className="text-black dark:text-white">{operatorEmail}</strong>
                      </p>
                    </div>
                  </div>

                  <div className="bg-[#f8fafc] dark:bg-[#313641]/20 rounded-[4px] border border-[#ebebeb] dark:border-white/[0.08] p-3.5 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-[#959494] flex items-center gap-1.5">
                        <Server className="w-3.5 h-3.5 text-[#959494]" />
                        PROVIDER
                      </span>
                      <span className="text-black dark:text-white font-semibold">AUTHENTICATED SMTP</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[#959494] flex items-center gap-1.5">
                        <Hash className="w-3.5 h-3.5 text-[#959494]" />
                        MESSAGE ID
                      </span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-mono">
                        {testResult?.messageId || 'smtp_verified'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[#959494] flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-[#959494]" />
                        SAMPLE LEAD
                      </span>
                      <span className="text-black dark:text-white font-semibold">{sampleCandidate.company_name}</span>
                    </div>
                  </div>

                  <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-[4px] text-amber-700 dark:text-amber-400 space-y-1">
                    <div className="font-semibold flex items-center space-x-1.5">
                      <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-500" />
                      <span>Ready for Live Dispatch</span>
                    </div>
                    <p className="text-[11px] leading-relaxed">
                      Confirming will immediately queue and transmit emails to all{' '}
                      <strong>{activeRecipients.length}</strong> selected businesses.
                    </p>
                  </div>

                  <div className="pt-4 border-t border-[#ebebeb] dark:border-white/[0.08] flex items-center justify-between">
                    <button
                      onClick={() => setOutreachStep('template')}
                      className="mono-btn text-xs text-[#959494] hover:text-black dark:hover:text-white flex items-center gap-1"
                    >
                      <ArrowLeft className="w-3 h-3" />
                      <span>Edit Template</span>
                    </button>

                    <button
                      onClick={handleDispatchOutreach}
                      disabled={dispatching}
                      className="mono-btn bg-black dark:bg-white text-white dark:text-black hover:bg-neutral-800 dark:hover:bg-neutral-200 px-5 py-2.5 rounded-[4px] text-xs font-semibold flex items-center space-x-2 shadow-md transition active:scale-95 disabled:opacity-50 whitespace-nowrap"
                    >
                      <Send className={`w-3.5 h-3.5 ${dispatching ? 'animate-spin' : ''}`} />
                      <span>
                        {dispatching
                          ? 'DISPATCHING LIVE...'
                          : `APPROVE & DISPATCH (${activeRecipients.length})`}
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 4: DISPATCHED SUMMARY */}
            {outreachStep === 'dispatched' && (
              <div className="max-w-2xl mx-auto space-y-5 font-mono text-xs">
                <div className="border border-[#ebebeb] dark:border-white/[0.08] bg-white dark:bg-[#010120] rounded-[4px] p-6 space-y-5">
                  <div className="flex items-center space-x-3 mb-2">
                    <div className="w-8 h-8 rounded-[4px] bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 flex items-center justify-center shrink-0">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-base font-semibold text-black dark:text-white">
                        Live Outreach Sequence Completed
                      </h4>
                      <p className="text-xs text-[#959494] mt-0.5">
                        Transmitted live personalized emails to the selected leads.
                      </p>
                    </div>
                  </div>

                  {/* Summary Metric Cards */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-3 rounded-[4px] bg-[#f8fafc] dark:bg-[#313641]/20 border border-[#ebebeb] dark:border-white/[0.08]">
                      <span className="text-[#959494] flex items-center gap-1 text-[10px] whitespace-nowrap">
                        <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                        DISPATCHED
                      </span>
                      <span className="text-base font-semibold text-emerald-600 dark:text-emerald-400 mt-1 block">
                        {dispatchSummary?.sent || 0}
                      </span>
                    </div>
                    <div className="p-3 rounded-[4px] bg-[#f8fafc] dark:bg-[#313641]/20 border border-[#ebebeb] dark:border-white/[0.08]">
                      <span className="text-[#959494] flex items-center gap-1 text-[10px] whitespace-nowrap">
                        <ShieldAlert className="w-3 h-3 text-amber-500" />
                        SUPPRESSED
                      </span>
                      <span className="text-base font-semibold text-amber-600 dark:text-amber-400 mt-1 block">
                        {dispatchSummary?.suppressed || 0}
                      </span>
                    </div>
                    <div className="p-3 rounded-[4px] bg-[#f8fafc] dark:bg-[#313641]/20 border border-[#ebebeb] dark:border-white/[0.08]">
                      <span className="text-[#959494] flex items-center gap-1 text-[10px] whitespace-nowrap">
                        <AlertTriangle className="w-3 h-3 text-rose-500" />
                        FAILED
                      </span>
                      <span className="text-base font-semibold text-rose-600 dark:text-rose-400 mt-1 block">
                        {dispatchSummary?.failed || 0}
                      </span>
                    </div>
                  </div>

                  {/* Itemized Recipient Table */}
                  {dispatchResults.length > 0 && (
                    <div className="border border-[#ebebeb] dark:border-white/[0.08] rounded-[4px] overflow-hidden max-h-56 overflow-y-auto">
                      <table className="w-full text-left text-xs font-mono">
                        <thead className="bg-[#f8fafc] dark:bg-[#313641]/30 border-b border-[#ebebeb] dark:border-white/[0.08] text-[#959494]">
                          <tr>
                            <th className="py-2 px-3 whitespace-nowrap">
                              <span className="flex items-center gap-1">
                                <Mail className="w-3 h-3" />
                                RECIPIENT
                              </span>
                            </th>
                            <th className="py-2 px-3 text-[#ef2cc1] whitespace-nowrap">
                              <span className="flex items-center gap-1">
                                <Sparkles className="w-3 h-3" />
                                AI TYPE
                              </span>
                            </th>
                            <th className="py-2 px-3 whitespace-nowrap">STATUS</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#ebebeb] dark:divide-white/[0.06]">
                          {dispatchResults.map((r, i) => (
                            <tr key={i}>
                              <td className="py-2 px-3 text-black dark:text-white whitespace-nowrap">{r.email}</td>
                              <td className="py-2 px-3 whitespace-nowrap">
                                <span className="ai-flat-pill text-[10px]">
                                  {r.companyType || 'Classified'}
                                </span>
                              </td>
                              <td className="py-2 px-3 whitespace-nowrap">
                                <span
                                  className={`px-1.5 py-0.5 rounded-[2px] text-[10px] font-semibold uppercase ${
                                    r.status === 'sent'
                                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                      : r.status === 'suppressed'
                                      ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                                      : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                                  }`}
                                >
                                  {r.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  <div className="pt-3 border-t border-[#ebebeb] dark:border-white/[0.08] flex items-center justify-between">
                    <Link
                      href="/outreach"
                      className="mono-btn px-4 py-2 bg-black dark:bg-white text-white dark:text-black rounded-[4px] text-xs font-semibold inline-flex items-center space-x-1.5"
                    >
                      <span>VIEW LOGS</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>

                    <button
                      type="button"
                      onClick={() => {
                        setShowOutreachModal(false);
                        setOutreachStep('recipients');
                        setSelectedIds(new Set());
                      }}
                      className="mono-btn text-xs text-[#959494] hover:text-black dark:hover:text-white"
                    >
                      Done / Close
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* CSV Import Modal: Strictly matching DESIGN.md */}
      {showCsvModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#0f1017] border border-[#ebebeb] dark:border-white/[0.12] rounded-[4px] w-full max-w-2xl max-h-[92vh] overflow-y-auto p-6 sm:p-8 space-y-6">
            <div className="brand-gradient-h -mx-6 -mt-6 sm:-mx-8 sm:-mt-8 mb-6" />

            <div className="flex items-center justify-between pb-4 border-b border-[#ebebeb] dark:border-white/[0.08]">
              <div>
                <div className="mono-eyebrow text-[#959494] font-mono text-[11px] font-medium tracking-[0.55px] uppercase">
                  DATA INGESTION
                </div>
                <h3 className="text-xl font-medium tracking-tight text-[#000000] dark:text-white mt-1">
                  Import Prospects from CSV
                </h3>
              </div>
              <button
                onClick={() => setShowCsvModal(false)}
                className="text-[#959494] hover:text-[#000000] dark:hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Success state */}
            {importResult ? (
              <div className="space-y-4 py-2 font-mono text-xs">
                <div className="p-4 rounded-[4px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300 space-y-1">
                  <div className="font-medium flex items-center space-x-2 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    <span>CSV Leads Successfully Ingested</span>
                  </div>
                  <div className="mt-2 space-y-0.5 text-[11px]">
                    <div>• <strong>{importResult.importedCount}</strong> new leads added to directory</div>
                    <div>• <strong>{importResult.duplicateCount}</strong> duplicates deduplicated</div>
                    {importResult.enrichedCount > 0 && (
                      <div>• <strong>{importResult.enrichedCount}</strong> contacts enriched via Web Inspection & Gemini AI</div>
                    )}
                  </div>
                </div>

                <div className="flex justify-end pt-4 border-t border-[#ebebeb] dark:border-white/[0.08]">
                  <button
                    onClick={() => {
                      setShowCsvModal(false);
                      setImportResult(null);
                    }}
                    className="mono-btn bg-[#000000] dark:bg-white text-white dark:text-[#000000] px-5 py-2 rounded-[4px] text-xs font-mono uppercase font-medium"
                  >
                    CLOSE & VIEW LEADS
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {!csvResult ? (
                  <div className="space-y-4">
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="border border-dashed border-[#ebebeb] dark:border-white/[0.12] hover:border-[#000000] dark:hover:border-white rounded-[4px] p-8 text-center cursor-pointer transition bg-[#f8fafc] dark:bg-[#14161f]"
                    >
                      <UploadCloud className="w-8 h-8 text-[#959494] mx-auto mb-3" />
                      <div className="text-xs font-mono font-medium text-[#000000] dark:text-white">
                        CLICK TO UPLOAD CSV OR DRAG AND DROP
                      </div>
                      <div className="text-[11px] text-[#959494] font-mono mt-1">
                        Requires Company Name. Email, Website, Phone, and City are auto-detected.
                      </div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".csv,text/csv"
                        onChange={handleFileChange}
                        className="hidden"
                      />
                    </div>

                    <div className="text-center">
                      <span className="text-[11px] text-[#959494] font-mono uppercase tracking-wider">OR</span>
                    </div>

                    <button
                      type="button"
                      onClick={handleLoadSampleCsv}
                      className="w-full py-2.5 px-4 rounded-[4px] border border-[#ebebeb] dark:border-white/[0.08] text-xs font-mono text-[#000000] dark:text-white hover:bg-[#f8fafc] dark:hover:bg-[#14161f] transition uppercase tracking-wider"
                    >
                      Use Sample B2B Prospects CSV
                    </button>
                  </div>
                ) : (
                  <div className="space-y-5">
                    <div className="flex items-center justify-between p-3 bg-[#f8fafc] dark:bg-[#14161f] rounded-[4px] border border-[#ebebeb] dark:border-white/[0.08] text-xs font-mono">
                      <span className="text-[#000000] dark:text-white truncate max-w-xs">{fileName}</span>
                      <span className="text-[#959494]">{csvResult.rows.length} rows detected</span>
                    </div>

                    {/* Mapping Selectors */}
                    <div>
                      <div className="mono-eyebrow text-[#959494] text-[11px] mb-2 font-mono">
                        COLUMN MAPPING (AUTO-DETECTED)
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {[
                          { key: 'companyName', label: 'Company Name*', required: true },
                          { key: 'website', label: 'Website / Domain' },
                          { key: 'email', label: 'Email (Optional)' },
                          { key: 'firstName', label: 'Contact Name' },
                          { key: 'phone', label: 'Phone' },
                          { key: 'city', label: 'City / Location' },
                        ].map((field) => (
                          <div key={field.key} className="space-y-1">
                            <label className="text-[10px] font-mono text-[#959494]">
                              {field.label}
                            </label>
                            <div className="relative">
                              <select
                                value={mapping[field.key as keyof CsvColumnMapping] || ''}
                                onChange={(e) =>
                                  setMapping({
                                    ...mapping,
                                    [field.key]: e.target.value || null,
                                  })
                                }
                                className="w-full appearance-none text-xs font-mono bg-white dark:bg-[#14161f] border border-[#ebebeb] dark:border-white/[0.08] rounded-[4px] pl-2.5 pr-7 py-1.5 focus:outline-none focus:border-[#000000] dark:focus:border-white text-[#000000] dark:text-white cursor-pointer"
                              >
                                <option value="">-- None --</option>
                                {csvResult.headers.map((h: string) => (
                                  <option key={h} value={h}>
                                    {h}
                                  </option>
                                ))}
                              </select>
                              <ChevronDown className="w-3.5 h-3.5 absolute right-2 top-1/2 -translate-y-1/2 text-[#959494] pointer-events-none" />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Auto-Enrich Toggle */}
                    <div className="p-3 bg-[#f8fafc] dark:bg-[#14161f] border border-[#ebebeb] dark:border-white/[0.08] rounded-[4px] flex items-center justify-between">
                      <div className="flex items-center space-x-2.5">
                        <Sparkles className="w-4 h-4 text-[#bdbbff] shrink-0" />
                        <div>
                          <div className="text-xs font-mono text-[#000000] dark:text-white font-medium">
                            Auto-enrich missing emails on import
                          </div>
                          <div className="text-[11px] text-[#959494] font-mono">
                            Uses Deep Web Crawler & Free Gemini AI with DNS MX checks.
                          </div>
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={autoEnrichOnImport}
                        onChange={(e) => setAutoEnrichOnImport(e.target.checked)}
                        className="w-4 h-4 accent-[#000000] dark:accent-white cursor-pointer"
                      />
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center justify-between pt-4 border-t border-[#ebebeb] dark:border-white/[0.08]">
                      <button
                        type="button"
                        onClick={() => {
                          setCsvResult(null);
                          setCsvContent('');
                          setFileName('');
                        }}
                        className="text-xs font-mono text-[#959494] hover:underline"
                      >
                        Choose different file
                      </button>

                      <button
                        type="button"
                        onClick={handleImportLeads}
                        disabled={importing || !mapping.companyName}
                        className="mono-btn bg-[#000000] dark:bg-white text-white dark:text-[#000000] px-5 py-2.5 rounded-[4px] text-xs font-mono uppercase font-medium flex items-center space-x-2 disabled:opacity-50"
                      >
                        <UploadCloud className={`w-3.5 h-3.5 ${importing ? 'animate-spin' : ''}`} />
                        <span>{importing ? 'IMPORTING & ENRICHING...' : `IMPORT ${csvResult.rows.length} LEADS`}</span>
                      </button>
                    </div>
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
