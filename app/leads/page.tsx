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
} from 'lucide-react';
import { parseAndAnalyzeCsv, CsvColumnMapping } from '@/lib/csv/parser';

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

  // Enrichment state
  const [bulkEnriching, setBulkEnriching] = useState(false);
  const [enrichingId, setEnrichingId] = useState<string | null>(null);
  const [enrichMessage, setEnrichMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // CSV Modal state
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

  // Bulk Enrich Missing
  const handleBulkEnrich = async () => {
    setBulkEnriching(true);
    setEnrichMessage(null);
    try {
      const res = await fetch('/api/leads/enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enrichAllMissing: true }),
      });
      const data = await res.json();
      if (res.ok) {
        setEnrichMessage({
          text: `Enrichment completed: Found and verified ${data.summary?.enriched || 0} emails out of ${data.summary?.total || 0} leads using Explorium & Web Discovery!`,
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

  return (
    <div className="min-h-screen bg-white dark:bg-[#09090b] transition-colors duration-150">
      {/* Top Banner: Flat & Clean */}
      <section className="bg-[#f8fafc] dark:bg-gradient-to-b dark:from-[#0e1017] dark:via-[#0c0d14] dark:to-[#090a0f] border-b border-[#e5e7eb] dark:border-white/[0.08] px-6 py-10">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h1 className="text-3xl font-light tracking-tight text-[#111827] dark:text-white">Lead Explorer</h1>
            <p className="text-sm text-[#6b7280] dark:text-[#a1a1aa] mt-1 max-w-xl font-light">
              Deduplicated small business prospects with multi-tier Explorium enrichment and qualification scores.
            </p>
          </div>

          {/* Action CTAs */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => {
                setShowCsvModal(true);
                setImportResult(null);
              }}
              className="mono-btn bg-white dark:bg-[#18181b] hover:bg-[#f8fafc] dark:hover:bg-[#27272a] border border-[#e5e7eb] dark:border-[#27272a] text-[#111827] dark:text-white px-4 py-2.5 rounded-full text-xs font-normal transition flex items-center space-x-2 shadow-sm active:scale-95"
            >
              <UploadCloud className="w-3.5 h-3.5 text-[#f43f5e]" />
              <span>IMPORT LEADS (CSV)</span>
            </button>

            <button
              onClick={handleBulkEnrich}
              disabled={bulkEnriching || missingEmailCount === 0}
              className="mono-btn bg-[#f43f5e] hover:bg-[#e11d48] text-white px-5 py-2.5 rounded-full text-xs font-normal transition flex items-center space-x-2 shadow-sm active:scale-95 disabled:opacity-50"
            >
              <Sparkles className={`w-3.5 h-3.5 ${bulkEnriching ? 'animate-spin' : ''}`} />
              <span>
                {bulkEnriching
                  ? 'ENRICHING VIA EXPLORIUM...'
                  : missingEmailCount > 0
                  ? `ENRICH ${missingEmailCount} MISSING EMAILS`
                  : 'ALL LEADS ENRICHED'}
              </span>
            </button>
          </div>
        </div>
      </section>

      <main className="max-w-7xl mx-auto px-6 py-10">
        {/* Feedback message banner */}
        {enrichMessage && (
          <div
            className={`mb-6 p-4 rounded-xl border text-xs font-mono flex items-center justify-between ${
              enrichMessage.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                : 'bg-rose-50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300'
            }`}
          >
            <div className="flex items-center space-x-2.5">
              {enrichMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
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

        {/* Filter and Search Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 mb-8">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-[#9ca3af] dark:text-[#71717a] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by business, email, city, or category..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-[#e5e7eb] dark:border-[#27272a] bg-white dark:bg-[#121217] rounded-full text-sm focus:outline-none focus:border-[#f43f5e] focus:ring-1 focus:ring-rose-500/20 transition text-[#111827] dark:text-white font-light"
            />
          </div>

          <div className="flex items-center space-x-2">
            <span className="mono-eyebrow text-[#9ca3af] dark:text-[#71717a] text-xs font-normal mr-1">FILTER:</span>
            {['all', 'active', 'suppressed'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`mono-btn text-xs px-4 py-1.5 rounded-full transition font-normal ${
                  statusFilter === st
                    ? 'bg-[#111827] dark:bg-white text-white dark:text-[#111827] shadow-sm'
                    : 'bg-[#f8fafc] dark:bg-[#18181b] border border-[#e5e7eb] dark:border-[#27272a] text-[#4b5563] dark:text-[#a1a1aa] hover:bg-[#f1f5f9] dark:hover:bg-[#27272a]'
                }`}
              >
                {st.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Lead Table / List */}
        {loading ? (
          <div className="py-20 text-center font-mono text-sm text-[#9ca3af] dark:text-[#71717a]">Loading discovered leads...</div>
        ) : filtered.length === 0 ? (
          <div className="border border-[#e5e7eb] dark:border-[#27272a] rounded-xl p-16 text-center bg-[#f8fafc] dark:bg-[#121217]">
            <p className="text-sm text-[#6b7280] dark:text-[#a1a1aa] font-mono font-light mb-4">No prospects match your search criteria.</p>
            <button
              onClick={() => setShowCsvModal(true)}
              className="mono-btn bg-[#f43f5e] hover:bg-[#e11d48] text-white px-4 py-2 rounded-full text-xs font-normal inline-flex items-center space-x-2"
            >
              <UploadCloud className="w-3.5 h-3.5" />
              <span>IMPORT PROSPECTS FROM CSV</span>
            </button>
          </div>
        ) : (
          <div className="border border-[#e5e7eb] dark:border-[#27272a] rounded-xl overflow-hidden bg-white dark:bg-[#121217] shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-[#f8fafc] dark:bg-[#18181b] border-b border-[#e5e7eb] dark:border-[#27272a] text-[#4b5563] dark:text-[#a1a1aa]">
                  <tr>
                    <th className="py-3.5 px-6 font-normal">BUSINESS NAME</th>
                    <th className="py-3.5 px-6 font-normal">CONTACT & EMAIL</th>
                    <th className="py-3.5 px-6 font-normal">CATEGORY</th>
                    <th className="py-3.5 px-6 font-normal">LOCATION</th>
                    <th className="py-3.5 px-6 font-normal">STATUS</th>
                    <th className="py-3.5 px-6 font-normal text-right">ACTION</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f3f4f6] dark:divide-[#27272a]">
                  {filtered.map((b) => {
                    const hasEmail = Boolean(b.general_business_email);
                    const isEnrichingThis = enrichingId === b.id;
                    const contactName = b.contacts?.[0]?.contact_name;

                    return (
                      <tr key={b.id} className="hover:bg-[#f8fafc] dark:hover:bg-[#18181b] transition group">
                        {/* Business Name */}
                        <td className="py-4 px-6 font-sans">
                          <Link href={`/leads/${b.id}`} className="font-normal text-sm text-[#111827] dark:text-white group-hover:text-[#f43f5e] flex items-center space-x-2">
                            <span>{b.display_name}</span>
                            <ChevronRight className="w-3.5 h-3.5 text-[#9ca3af] group-hover:text-[#f43f5e] transition" />
                          </Link>
                          {b.official_website_url && (
                            <span className="text-[11px] text-[#9ca3af] dark:text-[#71717a] font-mono block mt-0.5 truncate max-w-xs font-light">
                              {b.official_website_url}
                            </span>
                          )}
                        </td>

                        {/* Contact & Email with Enrichment Trigger */}
                        <td className="py-4 px-6 font-mono">
                          {hasEmail ? (
                            <div>
                              <div className="flex items-center space-x-1.5 text-[#111827] dark:text-white font-normal">
                                <Mail className="w-3 h-3 text-[#f43f5e]" />
                                <span>{b.general_business_email}</span>
                              </div>
                              {contactName && (
                                <div className="text-[11px] text-[#6b7280] dark:text-[#a1a1aa] font-light mt-0.5">
                                  {contactName}
                                </div>
                              )}
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleEnrichSingle(b.id)}
                              disabled={isEnrichingThis || bulkEnriching}
                              className="mono-btn px-3 py-1 rounded-full bg-rose-50 dark:bg-rose-950/40 text-[#f43f5e] dark:text-rose-400 border border-rose-200 dark:border-rose-900/50 hover:bg-rose-100 dark:hover:bg-rose-900/40 flex items-center space-x-1.5 text-[11px] font-normal transition active:scale-95 disabled:opacity-50"
                              title="Enrich with verified email using Explorium / Web discovery"
                            >
                              <Sparkles className={`w-3 h-3 ${isEnrichingThis ? 'animate-spin' : ''}`} />
                              <span>{isEnrichingThis ? 'ENRICHING...' : 'FIND EMAIL'}</span>
                            </button>
                          )}
                        </td>

                        {/* Category */}
                        <td className="py-4 px-6 text-[#4b5563] dark:text-[#a1a1aa]">
                          <span className="px-2.5 py-1 rounded-md bg-[#f3f4f6] dark:bg-[#18181b] text-[#111827] dark:text-[#d4d4d8] font-normal text-[11px] border border-transparent dark:border-[#27272a]">
                            {b.business_type}
                          </span>
                        </td>

                        {/* Location */}
                        <td className="py-4 px-6 text-[#6b7280] dark:text-[#a1a1aa] font-light">
                          {b.city}, {b.country_code}
                        </td>

                        {/* Status */}
                        <td className="py-4 px-6">
                          <span
                            className={`px-2.5 py-1 rounded-full font-normal text-[10px] ${
                              b.record_status === 'active'
                                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                                : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                            }`}
                          >
                            {b.record_status.toUpperCase()}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="py-4 px-6 text-right font-sans">
                          <Link
                            href={`/leads/${b.id}`}
                            className="mono-btn bg-[#f8fafc] dark:bg-[#18181b] hover:bg-[#f1f5f9] dark:hover:bg-[#27272a] border border-[#e5e7eb] dark:border-[#27272a] text-[#111827] dark:text-[#e4e4e7] px-3.5 py-1.5 rounded-full text-xs font-normal inline-flex items-center space-x-1 transition"
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

      {/* CSV Import Modal */}
      {showCsvModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#121217] border border-[#e5e7eb] dark:border-[#27272a] rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl p-6 sm:p-8 space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-[#f3f4f6] dark:border-[#1f1f23]">
              <div>
                <h3 className="text-xl font-light text-[#111827] dark:text-white">Import Leads from CSV</h3>
                <p className="text-xs text-[#6b7280] dark:text-[#a1a1aa] font-mono mt-1 font-light">
                  Upload contacts and small business lists with automatic deduplication & enrichment.
                </p>
              </div>
              <button
                onClick={() => setShowCsvModal(false)}
                className="text-[#9ca3af] hover:text-[#111827] dark:hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Success state */}
            {importResult ? (
              <div className="space-y-4 py-4">
                <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs font-mono text-emerald-800 dark:text-emerald-300 space-y-1">
                  <div className="font-normal flex items-center space-x-2 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>CSV Leads Successfully Processed</span>
                  </div>
                  <div className="mt-2 space-y-0.5 text-[11px] font-light">
                    <div>• <strong>{importResult.importedCount}</strong> new business leads added to directory</div>
                    <div>• <strong>{importResult.duplicateCount}</strong> duplicates matched & deduplicated</div>
                    {importResult.enrichedCount > 0 && (
                      <div>• <strong>{importResult.enrichedCount}</strong> contacts enriched with verified emails via Explorium / Web discovery</div>
                    )}
                  </div>
                </div>

                <div className="flex justify-end space-x-3 pt-4 border-t border-[#f3f4f6] dark:border-[#1f1f23]">
                  <button
                    onClick={() => {
                      setShowCsvModal(false);
                      setImportResult(null);
                    }}
                    className="mono-btn bg-[#111827] dark:bg-white text-white dark:text-[#111827] px-5 py-2.5 rounded-full text-xs font-normal"
                  >
                    CLOSE & VIEW LEADS
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Upload Section */}
                {!csvResult ? (
                  <div className="space-y-4">
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed border-[#e5e7eb] dark:border-[#27272a] hover:border-[#f43f5e] dark:hover:border-[#f43f5e] rounded-2xl p-8 text-center cursor-pointer transition bg-[#f8fafc] dark:bg-[#18181b]"
                    >
                      <UploadCloud className="w-8 h-8 text-[#9ca3af] dark:text-[#71717a] mx-auto mb-3" />
                      <div className="text-xs font-normal text-[#111827] dark:text-white">
                        Click to upload CSV or drag and drop
                      </div>
                      <div className="text-[11px] text-[#6b7280] dark:text-[#a1a1aa] font-mono mt-1 font-light">
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
                      <span className="text-[11px] text-[#9ca3af] dark:text-[#71717a] font-mono">OR</span>
                    </div>

                    <button
                      type="button"
                      onClick={handleLoadSampleCsv}
                      className="w-full py-2.5 px-4 rounded-xl border border-[#e5e7eb] dark:border-[#27272a] text-xs font-mono text-[#4b5563] dark:text-[#a1a1aa] hover:bg-[#f8fafc] dark:hover:bg-[#18181b] transition"
                    >
                      Use Sample B2B Prospects CSV
                    </button>
                  </div>
                ) : (
                  <div className="space-y-5">
                    <div className="flex items-center justify-between p-3 bg-[#f8fafc] dark:bg-[#18181b] rounded-xl border border-[#e5e7eb] dark:border-[#27272a] text-xs font-mono">
                      <span className="text-[#111827] dark:text-white truncate max-w-xs">{fileName}</span>
                      <span className="text-[#6b7280] dark:text-[#a1a1aa]">{csvResult.rows.length} rows detected</span>
                    </div>

                    {/* Column Mapping Selectors */}
                    <div>
                      <div className="mono-eyebrow text-[#6b7280] dark:text-[#a1a1aa] text-xs mb-2.5 font-normal">
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
                            <label className="text-[10px] font-mono text-[#6b7280] dark:text-[#a1a1aa]">
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
                                className="w-full appearance-none text-xs font-mono bg-white dark:bg-[#18181b] border border-[#e5e7eb] dark:border-[#27272a] rounded-lg pl-2.5 pr-7 py-1.5 focus:outline-none focus:border-[#f43f5e] text-[#111827] dark:text-white font-light cursor-pointer"
                              >
                                <option value="">-- None --</option>
                                {csvResult.headers.map((h: string) => (
                                  <option key={h} value={h}>
                                    {h}
                                  </option>
                                ))}
                              </select>
                              <ChevronDown className="w-3.5 h-3.5 absolute right-2 top-1/2 -translate-y-1/2 text-[#9ca3af] pointer-events-none" />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Auto-Enrich Toggle */}
                    <div className="p-3.5 rounded-xl bg-gradient-to-r from-rose-500/10 via-amber-500/5 to-transparent border border-rose-500/20 flex items-center justify-between">
                      <div className="flex items-center space-x-2.5">
                        <Sparkles className="w-4 h-4 text-[#f43f5e] shrink-0" />
                        <div>
                          <div className="text-xs font-normal text-[#111827] dark:text-white">
                            Auto-enrich missing emails on import
                          </div>
                          <div className="text-[11px] text-[#6b7280] dark:text-[#a1a1aa] font-mono font-light">
                            Uses Explorium API & Deep Web Discovery to find decision maker emails.
                          </div>
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={autoEnrichOnImport}
                        onChange={(e) => setAutoEnrichOnImport(e.target.checked)}
                        className="w-4 h-4 accent-[#f43f5e] cursor-pointer"
                      />
                    </div>

                    {/* Preview Table */}
                    <div>
                      <div className="mono-eyebrow text-[#6b7280] dark:text-[#a1a1aa] text-xs mb-2 font-normal">
                        PREVIEW (FIRST 3 LEADS)
                      </div>
                      <div className="border border-[#e5e7eb] dark:border-[#27272a] rounded-xl overflow-x-auto text-[11px] font-mono">
                        <table className="w-full text-left">
                          <thead className="bg-[#f8fafc] dark:bg-[#18181b] border-b border-[#e5e7eb] dark:border-[#27272a] text-[#6b7280]">
                            <tr>
                              <th className="py-2 px-3">Company</th>
                              <th className="py-2 px-3">Website</th>
                              <th className="py-2 px-3">Email</th>
                              <th className="py-2 px-3">Contact</th>
                              <th className="py-2 px-3">City</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#f3f4f6] dark:divide-[#27272a]">
                            {csvResult.rows.slice(0, 3).map((r: any, idx: number) => (
                              <tr key={idx} className="text-[#111827] dark:text-zinc-200">
                                <td className="py-2 px-3">{r[mapping.companyName || ''] || '-'}</td>
                                <td className="py-2 px-3">{r[mapping.website || ''] || '-'}</td>
                                <td className="py-2 px-3">{r[mapping.email || ''] || <span className="text-[#9ca3af] italic">Will enrich</span>}</td>
                                <td className="py-2 px-3">{r[mapping.firstName || ''] || '-'}</td>
                                <td className="py-2 px-3">{r[mapping.city || ''] || '-'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center justify-between pt-4 border-t border-[#f3f4f6] dark:border-[#1f1f23]">
                      <button
                        type="button"
                        onClick={() => {
                          setCsvResult(null);
                          setCsvContent('');
                          setFileName('');
                        }}
                        className="text-xs font-mono text-[#6b7280] dark:text-[#a1a1aa] hover:underline"
                      >
                        Choose different file
                      </button>

                      <button
                        type="button"
                        onClick={handleImportLeads}
                        disabled={importing || !mapping.companyName}
                        className="mono-btn bg-[#f43f5e] hover:bg-[#e11d48] text-white px-5 py-2.5 rounded-full text-xs font-normal flex items-center space-x-2 shadow-sm transition active:scale-95 disabled:opacity-50"
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
