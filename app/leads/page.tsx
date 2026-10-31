'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
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
} from 'lucide-react';
import { parseAndAnalyzeCsv, CsvColumnMapping, replaceTemplateVariables } from '@/lib/csv/parser';

const SAMPLE_LEADS_CSV = `Company Name,Website,Contact Name,Email,Phone,City,Category
Artisan Flour Bakery,artisanflour.com,Siddharth Rao,,+91 98765 43210,Bengaluru,Artisan Bakery
Roast & Ground Cafe,roastground.in,Ananya Iyer,,+91 98450 11223,Bengaluru,Specialty Coffee
Dr. Sharma Dental Studio,sharmadental.in,Dr. Vivek Sharma,,+91 98200 55443,Mumbai,Healthcare
Apex Legal Advisory,apexlegal.in,Meera Sen,,+91 98110 99887,Delhi,Legal Services
Zenith Robotics,zenithrobotics.io,Rohan Verma,,+91 99000 77665,Bengaluru,Technology`;

export default function LeadsPage() {
  const [businesses, setBusinesses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Multi-selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Enrichment state
  const [bulkEnriching, setBulkEnriching] = useState(false);
  const [enrichingId, setEnrichingId] = useState<string | null>(null);
  const [enrichMessage, setEnrichMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Outreach Modal state
  const [showOutreachModal, setShowOutreachModal] = useState(false);
  const [outreachSubject, setOutreachSubject] = useState('Quick question regarding {company_name} operations');
  const [outreachBody, setOutreachBody] = useState(
    'Hi {first_name},\n\nI was researching {company_name} in {city} and wanted to reach out regarding your {company_type} customer conversion workflow.\n\n{personalized_pitch}\n\nWe implemented automated scheduling and inquiries for peer teams, reducing response drop-offs significantly.\n\nWould you be open to a 5-minute conversation this Thursday?\n\nBest regards,\nOperator'
  );
  const [operatorEmail, setOperatorEmail] = useState('');
  const [testSending, setTestSending] = useState(false);
  const [testSuccess, setTestSuccess] = useState<string | null>(null);
  const [dispatching, setDispatching] = useState(false);
  const [dispatchResult, setDispatchResult] = useState<any>(null);

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
  }, []);

  // Filtered list
  const filtered = businesses.filter((b) => {
    const matchesSearch =
      b.display_name.toLowerCase().includes(search.toLowerCase()) ||
      b.city.toLowerCase().includes(search.toLowerCase()) ||
      b.business_type.toLowerCase().includes(search.toLowerCase()) ||
      (b.general_business_email && b.general_business_email.toLowerCase().includes(search.toLowerCase()));

    if (statusFilter === 'all') return matchesSearch;
    return matchesSearch && b.record_status === statusFilter;
  });

  const missingEmailCount = businesses.filter((b) => !b.general_business_email).length;

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

  // Handle Operator Test Send
  const handleTestSend = async () => {
    if (!operatorEmail || !operatorEmail.includes('@')) {
      alert('Please enter your operator email address first to test send.');
      return;
    }
    const sample = selectedReadyToEmail[0] || businesses.find((b) => b.general_business_email) || {
      display_name: 'Sample Business',
      general_business_email: 'sample@business.com',
      city: 'Bengaluru',
      business_type: 'Artisan Bakery',
    };

    setTestSending(true);
    setTestSuccess(null);

    try {
      const res = await fetch('/api/csv-outreach/test-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template: { subject: outreachSubject, bodyText: outreachBody },
          sampleProspect: {
            company_name: sample.display_name,
            email: sample.general_business_email,
            first_name: sample.contacts?.[0]?.contact_name || 'Owner',
            city: sample.city,
            company_type: sample.business_type,
          },
          recipientOverride: operatorEmail.trim(),
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setTestSuccess(`Verification email delivered to ${operatorEmail}! Please inspect it.`);
      } else {
        alert(data.error || 'Test send failed');
      }
    } catch (err: any) {
      alert(`Network error: ${err.message}`);
    } finally {
      setTestSending(false);
    }
  };

  // Handle Full Outreach Dispatch
  const handleDispatchOutreach = async () => {
    if (selectedReadyToEmail.length === 0) {
      alert('None of the selected leads have an email address yet. Please enrich them first.');
      return;
    }
    setDispatching(true);
    setDispatchResult(null);

    const formattedRecipients = selectedReadyToEmail.map((b) => ({
      email: b.general_business_email,
      company_name: b.display_name,
      first_name: b.contacts?.[0]?.contact_name?.split(' ')[0] || 'Owner',
      city: b.city,
      company_type: b.business_type,
      website: b.official_website_url,
    }));

    try {
      const res = await fetch('/api/csv-outreach/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipients: formattedRecipients,
          subjectTemplate: outreachSubject,
          bodyTemplate: outreachBody,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setDispatchResult(data);
      } else {
        alert(data.error || 'Failed to dispatch outreach');
      }
    } catch (err: any) {
      alert(`Network error dispatching outreach: ${err.message}`);
    } finally {
      setDispatching(false);
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-[#090a0f] text-[#000000] dark:text-[#ffffff] transition-colors duration-150">
      {/* Brand 3-Color Ribbon Accent (DESIGN.md) */}
      <div className="brand-gradient-h w-full" />

      {/* Hero Band: Together AI style Canvas Dark (#010120) */}
      <section className="bg-[#010120] text-white border-b border-white/[0.08] px-6 py-12 sm:py-16">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <div className="mono-eyebrow text-[#959494] font-mono text-[11px] font-medium tracking-[0.55px] uppercase mb-2">
              PROSPECT INTELLIGENCE & DISPATCH
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

            <button
              onClick={() => {
                if (selectedIds.size === 0) {
                  // Select all filtered by default if none selected
                  setSelectedIds(new Set(filtered.map((b) => b.id)));
                }
                setShowOutreachModal(true);
                setDispatchResult(null);
                setTestSuccess(null);
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

          <div className="flex items-center space-x-2">
            <span className="mono-eyebrow text-[#959494] text-[11px] font-mono mr-1">STATUS:</span>
            {['all', 'active', 'suppressed'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`mono-btn text-xs px-3.5 py-1.5 rounded-[4px] transition font-mono uppercase tracking-wider ${
                  statusFilter === st
                    ? 'bg-[#000000] dark:bg-white text-white dark:text-[#000000]'
                    : 'bg-white dark:bg-[#14161f] border border-[#ebebeb] dark:border-white/[0.08] text-[#959494] hover:text-[#000000] dark:hover:text-white'
                }`}
              >
                {st}
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
                                : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                            }`}
                          >
                            {b.record_status}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 text-right font-mono">
                          <Link
                            href={`/leads/${b.id}`}
                            className="mono-btn bg-white dark:bg-[#14161f] hover:bg-[#f4f4f5] dark:hover:bg-[#1c1d27] border border-[#ebebeb] dark:border-white/[0.08] text-[#000000] dark:text-white px-3 py-1 rounded-[4px] text-[11px] font-mono inline-flex items-center space-x-1"
                          >
                            <span>EVIDENCE</span>
                            <ChevronRight className="w-3 h-3" />
                          </Link>
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
            <span className="w-2 h-2 rounded-full bg-[#c8f6f9] animate-pulse" />
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

          <button
            onClick={() => {
              setShowOutreachModal(true);
              setDispatchResult(null);
              setTestSuccess(null);
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

      {/* Outreach Dispatch Modal: Together AI Style (Flat, Hairline, 4px radius) */}
      {showOutreachModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#0f1017] border border-[#ebebeb] dark:border-white/[0.12] rounded-[4px] w-full max-w-2xl max-h-[92vh] overflow-y-auto p-6 sm:p-8 space-y-6">
            <div className="brand-gradient-h -mx-6 -mt-6 sm:-mx-8 sm:-mt-8 mb-6" />

            <div className="flex items-center justify-between pb-4 border-b border-[#ebebeb] dark:border-white/[0.08]">
              <div>
                <div className="mono-eyebrow text-[#959494] font-mono text-[11px] font-medium tracking-[0.55px] uppercase">
                  OUTREACH DISPATCH PIPELINE
                </div>
                <h3 className="text-xl font-medium tracking-tight text-[#000000] dark:text-white mt-1">
                  Launch Outreach to Selected Leads
                </h3>
              </div>
              <button
                onClick={() => setShowOutreachModal(false)}
                className="text-[#959494] hover:text-[#000000] dark:hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Recipient breakdown */}
            <div className="grid grid-cols-2 gap-3 text-xs font-mono">
              <div className="p-3 bg-[#f8fafc] dark:bg-[#14161f] border border-[#ebebeb] dark:border-white/[0.08] rounded-[4px]">
                <div className="text-[#959494]">READY TO EMAIL</div>
                <div className="text-lg font-medium text-emerald-600 dark:text-emerald-400 mt-0.5">
                  {selectedReadyToEmail.length}
                </div>
              </div>
              <div className="p-3 bg-[#f8fafc] dark:bg-[#14161f] border border-[#ebebeb] dark:border-white/[0.08] rounded-[4px]">
                <div className="text-[#959494]">MISSING EMAIL</div>
                <div className="text-lg font-medium text-amber-600 dark:text-amber-400 mt-0.5 flex items-center justify-between">
                  <span>{selectedMissingEmail.length}</span>
                  {selectedMissingEmail.length > 0 && (
                    <button
                      onClick={() => handleBulkEnrich(selectedMissingEmail.map((b) => b.id))}
                      disabled={bulkEnriching}
                      className="text-[10px] font-mono px-2 py-0.5 rounded-[4px] bg-[#000000] dark:bg-white text-white dark:text-[#000000] uppercase font-medium disabled:opacity-50"
                    >
                      {bulkEnriching ? 'ENRICHING...' : 'ENRICH NOW'}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Dispatch Results State */}
            {dispatchResult ? (
              <div className="space-y-4 py-2 font-mono text-xs">
                <div className="p-4 rounded-[4px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300 space-y-1">
                  <div className="font-medium flex items-center space-x-2 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    <span>Outreach Sequence Dispatched Successfully</span>
                  </div>
                  <div className="pt-2 text-[11px] space-y-0.5">
                    <div>• <strong>{dispatchResult.sentCount || 0}</strong> emails delivered to inboxes</div>
                    <div>• <strong>{dispatchResult.suppressedCount || 0}</strong> excluded via suppression list</div>
                    {dispatchResult.failedCount > 0 && (
                      <div>• <strong>{dispatchResult.failedCount}</strong> failed (check SMTP settings)</div>
                    )}
                  </div>
                </div>

                <div className="flex justify-end pt-4 border-t border-[#ebebeb] dark:border-white/[0.08]">
                  <button
                    onClick={() => {
                      setShowOutreachModal(false);
                      setDispatchResult(null);
                    }}
                    className="mono-btn bg-[#000000] dark:bg-white text-white dark:text-[#000000] px-5 py-2 rounded-[4px] text-xs font-mono uppercase font-medium"
                  >
                    CLOSE
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                {/* Subject Line */}
                <div className="space-y-1.5">
                  <label className="mono-eyebrow text-[#959494] text-[11px] font-mono block">
                    EMAIL SUBJECT TEMPLATE
                  </label>
                  <input
                    type="text"
                    value={outreachSubject}
                    onChange={(e) => setOutreachSubject(e.target.value)}
                    className="w-full text-xs font-mono border border-[#ebebeb] dark:border-white/[0.08] bg-white dark:bg-[#14161f] rounded-[4px] p-2.5 focus:outline-none focus:border-[#000000] dark:focus:border-white text-[#000000] dark:text-white"
                  />
                </div>

                {/* Email Body & Variables */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="mono-eyebrow text-[#959494] text-[11px] font-mono block">
                      EMAIL BODY
                    </label>
                    <div className="flex items-center space-x-1.5 text-[10px] font-mono text-[#959494]">
                      <span>INSERT:</span>
                      {['company_name', 'first_name', 'city', 'company_type'].map((tok) => (
                        <button
                          key={tok}
                          type="button"
                          onClick={() => setOutreachBody((prev) => prev + ` {${tok}}`)}
                          className="px-1.5 py-0.5 rounded-[4px] bg-[#f4f4f5] dark:bg-[#14161f] border border-[#ebebeb] dark:border-white/[0.08] hover:text-[#000000] dark:hover:text-white"
                        >
                          {`{${tok}}`}
                        </button>
                      ))}
                    </div>
                  </div>
                  <textarea
                    rows={8}
                    value={outreachBody}
                    onChange={(e) => setOutreachBody(e.target.value)}
                    className="w-full text-xs font-mono border border-[#ebebeb] dark:border-white/[0.08] bg-white dark:bg-[#14161f] rounded-[4px] p-3 focus:outline-none focus:border-[#000000] dark:focus:border-white text-[#000000] dark:text-white font-light leading-relaxed"
                  />
                </div>

                {/* Safety Check: Send Test to Myself First */}
                <div className="p-4 rounded-[4px] bg-[#f8fafc] dark:bg-[#14161f] border border-[#ebebeb] dark:border-white/[0.08] space-y-2.5">
                  <div className="flex items-center space-x-2 text-xs font-mono font-medium text-[#000000] dark:text-white">
                    <ShieldCheck className="w-4 h-4 text-[#bdbbff]" />
                    <span>PRE-FLIGHT VERIFICATION (TEST SEND TO OPERATOR)</span>
                  </div>
                  <p className="text-[11px] font-mono text-[#959494]">
                    Verify formatting and spam scoring before sending to real prospect businesses.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="email"
                      placeholder="operator@company.com"
                      value={operatorEmail}
                      onChange={(e) => setOperatorEmail(e.target.value)}
                      className="flex-1 text-xs font-mono border border-[#ebebeb] dark:border-white/[0.08] bg-white dark:bg-[#0f1017] rounded-[4px] px-3 py-2 text-[#000000] dark:text-white"
                    />
                    <button
                      type="button"
                      onClick={handleTestSend}
                      disabled={testSending}
                      className="mono-btn bg-[#000000] dark:bg-white text-white dark:text-[#000000] px-4 py-2 rounded-[4px] text-xs font-mono uppercase font-medium disabled:opacity-50"
                    >
                      {testSending ? 'SENDING TEST...' : 'SEND TEST DRAFT'}
                    </button>
                  </div>
                  {testSuccess && (
                    <div className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 mt-1">
                      ✓ {testSuccess}
                    </div>
                  )}
                </div>

                {/* Dispatch Controls */}
                <div className="flex items-center justify-between pt-4 border-t border-[#ebebeb] dark:border-white/[0.08]">
                  <button
                    type="button"
                    onClick={() => setShowOutreachModal(false)}
                    className="text-xs font-mono text-[#959494] hover:underline"
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    onClick={handleDispatchOutreach}
                    disabled={dispatching || selectedReadyToEmail.length === 0}
                    className="mono-btn bg-[#000000] dark:bg-white text-white dark:text-[#000000] hover:bg-black/90 dark:hover:bg-zinc-200 px-6 py-2.5 rounded-[4px] text-xs font-mono font-medium uppercase tracking-wider flex items-center space-x-2 disabled:opacity-50"
                  >
                    <Send className={`w-3.5 h-3.5 ${dispatching ? 'animate-spin' : ''}`} />
                    <span>
                      {dispatching
                        ? 'DISPATCHING TO INBOXES...'
                        : `APPROVE & DISPATCH (${selectedReadyToEmail.length})`}
                    </span>
                  </button>
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
