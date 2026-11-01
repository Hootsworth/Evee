'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import {
  Upload,
  Sparkles,
  Mail,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Send,
  Eye,
  ChevronDown,
  ArrowRight,
  ShieldCheck,
  FileSpreadsheet,
  ArrowLeft,
  Info,
  Check,
  X,
  Users,
  PenLine,
} from 'lucide-react';
import {
  parseCsvFile,
  parseCsvString,
  autoDetectMapping,
  replaceTemplateVariables,
  SAMPLE_PROSPECTS_CSV,
  CsvParseResult,
  CsvColumnMapping,
} from '@/lib/csv/parser';

export default function CsvOutreachPage() {
  // Stepper state: 'upload' -> 'template' -> 'test_sent' -> 'dispatched'
  const [step, setStep] = useState<'upload' | 'template' | 'test_sent' | 'dispatched'>('upload');

  // CSV Data State
  const [csvResult, setCsvResult] = useState<CsvParseResult | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [mapping, setMapping] = useState<CsvColumnMapping>({
    email: 'email',
    companyName: null,
    firstName: null,
    lastName: null,
    website: null,
    city: null,
  });

  // Template State
  const [subject, setSubject] = useState('Personalized idea for {company_name}');
  const [bodyText, setBodyText] = useState(
    'Hi {first_name},\n\nI was looking into {company_name} in {city} and wanted to reach out specifically regarding your {company_type} operations.\n\n{personalized_pitch}\n\nMany {company_type} teams experience friction around {pain_point}. We recently implemented {value_prop} for similar businesses to streamline this completely.\n\nWould you be open to a brief 5-minute chat this week?\n\nBest regards,\nOperator'
  );

  // AI Enrichment state
  const [enriching, setEnriching] = useState(false);
  const [enriched, setEnriched] = useState(false);
  const [aiMeta, setAiMeta] = useState<{
    source: 'live' | 'ai_synthetic';
    provider: string;
    model: string;
    error?: string;
  } | null>(null);

  // Preview State
  const [previewContactIdx, setPreviewContactIdx] = useState(0);

  // Test send state
  const [testSending, setTestSending] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);
  const [testError, setTestError] = useState<string | null>(null);

  // AI Template Optimizer State
  const [showAiEnhancer, setShowAiEnhancer] = useState(false);
  const [aiGoal, setAiGoal] = useState<'concise' | 'persuasive' | 'cta' | 'warmer' | 'punchy' | 'custom'>('persuasive');
  const [aiCustomInstruction, setAiCustomInstruction] = useState('');
  const [aiEnhancing, setAiEnhancing] = useState(false);
  const [aiResult, setAiResult] = useState<{
    improvedSubject: string;
    improvedBody: string;
    changesSummary: string;
    keyImprovementTips?: string[];
    modelUsed: string;
  } | null>(null);

  // Bulk dispatch state
  const [dispatching, setDispatching] = useState(false);
  const [dispatchSummary, setDispatchSummary] = useState<any>(null);
  const [dispatchResults, setDispatchResults] = useState<any[]>([]);

  // Current logged in user email for self test
  const [operatorEmail, setOperatorEmail] = useState('');

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Fetch operator's email on mount and check for pre-loaded leads
  useEffect(() => {
    fetch('/api/settings/providers')
      .then((res) => res.json())
      .then((data) => {
        if (data.settings?.smtpUser) {
          setOperatorEmail(data.settings.smtpUser);
        }
      })
      .catch(() => {});

    // Check for pre-loaded leads passed from Leads tab
    try {
      const cached = sessionStorage.getItem('evee_outreach_leads');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const headers = ['email', 'company_name', 'first_name', 'city', 'website', 'company_type'];
          setCsvResult({
            headers,
            rows: parsed,
            detectedMapping: {
              email: 'email',
              companyName: 'company_name',
              firstName: 'first_name',
              lastName: null,
              website: 'website',
              city: 'city',
            },
            totalRows: parsed.length,
            validEmailCount: parsed.filter((r: any) => r.email && r.email.includes('@')).length,
          });
          setFileName(`leads_outreach_${parsed.length}.csv`);
          setMapping({
            email: 'email',
            companyName: 'company_name',
            firstName: 'first_name',
            lastName: null,
            website: 'website',
            city: 'city',
          });
          sessionStorage.removeItem('evee_outreach_leads');
        }
      }
    } catch {}
  }, []);

  // Handle local CSV upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    try {
      const parsed = await parseCsvFile(file);
      setCsvResult(parsed);
      const detected = autoDetectMapping(parsed.headers);
      setMapping(detected);
    } catch (err: any) {
      alert(`CSV parsing error: ${err.message}`);
    }
  };

  // Load sample CSV for instant testing
  const handleLoadSampleCsv = () => {
    setFileName('bangalore_cafes_and_bakeries.csv');
    const parsed = parseCsvString(SAMPLE_PROSPECTS_CSV);
    setCsvResult(parsed);
    const detected = autoDetectMapping(parsed.headers);
    setMapping(detected);
  };

  // Trigger AI enrichment on CSV rows
  const handleEnrichWithAi = async () => {
    if (!csvResult || csvResult.rows.length === 0) return;

    setEnriching(true);

    try {
      const res = await fetch('/api/csv-outreach/enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prospects: csvResult.rows,
          mapping,
        }),
      });

      const data = await res.json();
      if (res.ok && data.enrichedProspects) {
        setCsvResult({
          ...csvResult,
          rows: data.enrichedProspects,
        });
        setEnriched(true);
        setAiMeta(data.meta || null);
      } else {
        alert(`AI Enrichment Error: ${data.error || 'Failed to enrich prospects.'}`);
      }
    } catch (err: any) {
      alert(`Network error during AI enrichment: ${err.message}`);
    } finally {
      setEnriching(false);
    }
  };

  // AI Email Template Optimization
  const handleEnhanceTemplate = async () => {
    if (!bodyText) return;
    setAiEnhancing(true);
    setTestError(null);
    try {
      const res = await fetch('/api/drafts/enhance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject,
          bodyText,
          goal: aiGoal,
          instruction: aiCustomInstruction,
          businessContext: {
            name: '{company_name}',
            category: '{company_type}',
            city: '{city}',
          },
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setAiResult(data);
      } else {
        setTestError(`AI template enhancement failed: ${data.error || 'Unknown error'}`);
      }
    } catch (err: any) {
      setTestError(`Error enhancing template: ${err.message}`);
    } finally {
      setAiEnhancing(false);
    }
  };

  const handleApplyAiTemplate = () => {
    if (!aiResult) return;
    if (aiResult.improvedSubject) setSubject(aiResult.improvedSubject);
    if (aiResult.improvedBody) setBodyText(aiResult.improvedBody);
    setShowAiEnhancer(false);
    setAiResult(null);
  };

  // Helper to insert a variable chip into the bodyText at the current cursor position
  const handleInsertVariable = (tokenName: string) => {
    const token = `{${tokenName}}`;
    const textarea = textareaRef.current;
    if (!textarea) {
      setBodyText((prev) => prev + ' ' + token);
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const nextBody = bodyText.substring(0, start) + token + bodyText.substring(end);
    setBodyText(nextBody);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + token.length, start + token.length);
    }, 0);
  };

  // 1. Safety Gate: Send Test Email to Myself
  const handleSendTestToSelf = async () => {
    if (!csvResult || csvResult.rows.length === 0) return;

    setTestSending(true);
    setTestError(null);

    const sampleRow = csvResult.rows[previewContactIdx] || csvResult.rows[0];

    try {
      const res = await fetch('/api/csv-outreach/test-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template: { subject, bodyText },
          sampleProspect: sampleRow,
          mapping,
          recipientOverride: operatorEmail,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setTestResult(data);
        setStep('test_sent');
      } else {
        setTestError(data.error || 'Failed to dispatch test email.');
      }
    } catch (err: any) {
      setTestError(err.message || 'Network error sending test email.');
    } finally {
      setTestSending(false);
    }
  };

  // 2. Final Approval: Bulk Dispatch to All Prospects
  const handleBulkDispatch = async () => {
    if (!csvResult || csvResult.rows.length === 0) return;

    setDispatching(true);

    try {
      const res = await fetch('/api/csv-outreach/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template: { subject, bodyText },
          recipients: csvResult.rows,
          mapping,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setDispatchSummary(data.summary);
        setDispatchResults(data.results || []);
        setStep('dispatched');
      } else {
        alert(`Bulk dispatch error: ${data.error}`);
      }
    } catch (err: any) {
      alert(`Network error during dispatch: ${err.message}`);
    } finally {
      setDispatching(false);
    }
  };

  const sampleProspect = csvResult?.rows[previewContactIdx] || csvResult?.rows[0] || {};
  const renderedSubject = replaceTemplateVariables(subject, sampleProspect, mapping);
  const renderedBody = replaceTemplateVariables(bodyText, sampleProspect, mapping);

  return (
    <div className="min-h-screen bg-white dark:bg-[#010120] text-[#000000] dark:text-[#ffffff] transition-colors duration-150 flex flex-col">
      {/* 2px Signature Brand Gradient Ribbon */}
      <div className="brand-gradient-h w-full" />

      {/* Hero Band: Canvas Dark #010120 */}
      <section className="bg-[#010120] text-white border-b border-white/[0.08] px-6 py-8">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <Link
              href="/campaigns"
              className="mono-btn text-xs text-[#959494] hover:text-white flex items-center space-x-1.5 mb-2 font-normal"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>BACK TO CAMPAIGNS</span>
            </Link>
            <div className="flex items-center space-x-2 text-[10px] font-mono tracking-widest text-[#959494] uppercase mb-1">
              <span>CSV PIPELINE // DYNAMIC OUTREACH</span>
              <span>•</span>
              <span className="text-[#ef2cc1]">AI ADAPTATION ENGINE</span>
            </div>
            <h1 className="text-3xl font-medium tracking-tight text-white">
              CSV Direct Outreach
            </h1>
            <p className="text-xs text-[#959494] mt-1 max-w-xl font-normal">
              Import prospect spreadsheets, analyze companies with AI reasoning, test pre-flight on yourself, and dispatch with human sign-off.
            </p>
          </div>

          {/* Stepper Pill Indicator */}
          <div className="flex items-center space-x-1 bg-[#313641]/40 border border-white/[0.08] rounded-[4px] p-1 text-xs font-mono">
            {[
              { id: 'upload', icon: Users, label: 'Mapping' },
              { id: 'template', icon: PenLine, label: 'Compose' },
              { id: 'test_sent', icon: ShieldCheck, label: 'Test' },
              { id: 'dispatched', icon: Send, label: 'Dispatched' },
            ].map((s) => {
              const active = step === s.id;
              const StepIcon = s.icon;
              return (
                <span
                  key={s.id}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[3px] transition whitespace-nowrap ${
                    active
                      ? 'bg-black dark:bg-white text-white dark:text-black font-semibold'
                      : 'text-[#959494]'
                  }`}
                >
                  <StepIcon className="w-3 h-3 shrink-0" />
                  <span>{s.label}</span>
                </span>
              );
            })}
          </div>
        </div>
      </section>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-6 py-8 w-full flex-1">
        {/* STEP 1: Upload CSV & Auto-Detect Columns */}
        {step === 'upload' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Upload Card */}
              <div className="lg:col-span-1 border border-[#ebebeb] dark:border-white/[0.08] rounded-[4px] p-5 bg-white dark:bg-[#010120] flex flex-col justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-black dark:text-white uppercase font-mono mb-1">
                    Import Spreadsheet
                  </h2>
                  <p className="text-xs text-[#6b7280] dark:text-[#959494] font-mono mb-5">
                    Upload any .csv file with contacts. Evee auto-detects emails, names, and companies.
                  </p>

                  <label className="border-2 border-dashed border-[#ebebeb] dark:border-white/[0.1] hover:border-black dark:hover:border-white rounded-[4px] p-8 flex flex-col items-center justify-center text-center cursor-pointer transition bg-[#f8fafc] dark:bg-[#313641]/20 group">
                    <Upload className="w-7 h-7 text-[#9ca3af] group-hover:text-black dark:group-hover:text-white transition mb-2.5" />
                    <span className="text-xs font-medium text-black dark:text-white">
                      {fileName ? fileName : 'Click to select CSV file'}
                    </span>
                    <span className="text-[10px] text-[#959494] font-mono mt-1">
                      RFC 4180 format (.csv)
                    </span>
                    <input type="file" accept=".csv,text/csv" onChange={handleFileUpload} className="hidden" />
                  </label>

                  <div className="mt-4 pt-4 border-t border-[#ebebeb] dark:border-white/[0.06] flex items-center justify-between">
                    <span className="text-xs text-[#6b7280] dark:text-[#959494] font-mono">
                      Don't have a CSV handy?
                    </span>
                    <button
                      type="button"
                      onClick={handleLoadSampleCsv}
                      className="mono-btn text-xs text-[#ef2cc1] hover:underline font-semibold"
                    >
                      Load Sample CSV →
                    </button>
                  </div>
                </div>

                {csvResult && (
                  <div className="mt-6 pt-4 border-t border-[#ebebeb] dark:border-white/[0.08]">
                    <div className="flex justify-between text-xs font-mono mb-3">
                      <span className="text-[#6b7280] dark:text-[#959494]">TOTAL ROWS:</span>
                      <span className="font-semibold text-black dark:text-white">{csvResult.totalRows}</span>
                    </div>
                    <div className="flex justify-between text-xs font-mono mb-4">
                      <span className="text-[#6b7280] dark:text-[#959494]">VALID EMAILS:</span>
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                        {csvResult.validEmailCount}
                      </span>
                    </div>

                    <button
                      onClick={() => setStep('template')}
                      className="mono-btn w-full bg-black dark:bg-white text-white dark:text-black py-2.5 rounded-[4px] text-xs font-semibold flex items-center justify-center space-x-1.5 shadow-sm transition active:scale-95"
                    >
                      <span>NEXT: COMPOSE TEMPLATE</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {/* Column Mapping & AI Card */}
              <div className="lg:col-span-2 border border-[#ebebeb] dark:border-white/[0.08] rounded-[4px] p-5 bg-white dark:bg-[#010120] space-y-5">
                <div className="flex items-center justify-between pb-3 border-b border-[#ebebeb] dark:border-white/[0.08]">
                  <div>
                    <h2 className="text-sm font-semibold text-black dark:text-white font-mono uppercase">
                      Auto-Detected Field Mapping
                    </h2>
                    <p className="text-xs text-[#959494] font-mono mt-0.5">
                      Verify which CSV columns map to outreach fields.
                    </p>
                  </div>
                  {csvResult && (
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded-[2px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-semibold">
                      {csvResult.validEmailCount} VALID EMAILS
                    </span>
                  )}
                </div>

                {!csvResult ? (
                  <div className="py-20 text-center font-mono text-xs text-[#959494]">
                    Upload or select a sample CSV to view auto-detected columns and rows.
                  </div>
                ) : (
                  <div className="space-y-5">
                    {/* Flat Technical AI Reasoning & Adaptation Bar (Together AI Aesthetic) */}
                    <div className="ai-flat-container overflow-hidden">
                      {/* Active Linear Scanner when Enriching, otherwise static 2px brand ribbon */}
                      {enriching ? (
                        <div className="w-full h-[2px] bg-neutral-200 dark:bg-white/[0.08] overflow-hidden relative">
                          <div className="w-1/3 h-full bg-gradient-to-r from-[#fc4c02] via-[#ef2cc1] to-[#bdbbff] animate-flat-scan" />
                        </div>
                      ) : (
                        <div className="brand-gradient-h w-full" />
                      )}

                      <div className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="space-y-1.5 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="mono-eyebrow text-[#959494] text-[10px] tracking-[0.55px] uppercase font-semibold">
                              AI REASONING & COPY ADAPTATION
                            </span>
                            {enriching && (
                              <span className="ai-flat-pill text-black dark:text-white border-[#ebebeb] dark:border-white/[0.12]">
                                <span>SYNTHESIZING PROFILES...</span>
                              </span>
                            )}
                          </div>

                          <div className="text-xs font-mono text-black dark:text-white leading-relaxed">
                            {enriching
                              ? `Evaluating ${csvResult.rows.length} businesses: deducing operating verticals, operational friction points, and bespoke angles...`
                              : enriched
                              ? `All ${csvResult.rows.length} businesses classified with high-confidence industry verticals and personalized value propositions.`
                              : 'Automatically analyzes websites and business names with multi-provider LLMs to generate personalized outreach angles.'}
                          </div>

                          <div className="text-[11px] text-[#959494] font-mono flex items-center space-x-3 pt-0.5">
                            <span>INPUT: {csvResult.totalRows} PROSPECTS</span>
                            <span>•</span>
                            <span>OUTPUT: {`{company_type}, {pain_point}, {value_prop}, {personalized_pitch}`}</span>
                          </div>
                        </div>

                        {/* Flat Technical Action Button */}
                        <div className="shrink-0 self-start md:self-auto">
                          <button
                            type="button"
                            onClick={handleEnrichWithAi}
                            disabled={enriching}
                            className={`mono-btn px-4 py-2 rounded-[4px] text-xs font-mono font-medium uppercase tracking-wider flex items-center space-x-2 transition ${
                              enriching
                                ? 'bg-neutral-100 dark:bg-white/[0.08] text-neutral-400 cursor-not-allowed border border-[#ebebeb] dark:border-white/[0.08]'
                                : enriched
                                ? 'bg-white dark:bg-[#14161f] text-black dark:text-white border border-[#ebebeb] dark:border-white/[0.16] hover:border-black dark:hover:border-white'
                                : 'bg-black dark:bg-white text-white dark:text-black hover:bg-neutral-800 dark:hover:bg-neutral-200'
                            }`}
                          >
                            {enriching ? (
                              <span>INFERENCE IN PROGRESS...</span>
                            ) : enriched ? (
                              <>
                                <span>RE-RUN AI ENRICHMENT</span>
                                <span>↺</span>
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

                    {/* Mapping Selectors */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {[
                        { key: 'email', label: 'Email Address *', required: true },
                        { key: 'companyName', label: 'Company / Business Name' },
                        { key: 'firstName', label: 'First Name / Contact' },
                        { key: 'website', label: 'Website URL' },
                        { key: 'city', label: 'City / Location' },
                      ].map((field) => (
                        <div key={field.key} className="p-3 bg-[#f8fafc] dark:bg-[#313641]/20 rounded-[4px] border border-[#ebebeb] dark:border-white/[0.08]">
                          <label className="mono-eyebrow text-[#6b7280] dark:text-[#959494] block mb-1">
                            {field.label}
                          </label>
                          <div className="relative">
                            <select
                              value={(mapping as any)[field.key] || ''}
                              onChange={(e) => setMapping({ ...mapping, [field.key]: e.target.value || null })}
                              className="appearance-none w-full text-xs font-mono bg-white dark:bg-[#010120] border border-[#ebebeb] dark:border-white/[0.08] rounded-[3px] pl-2.5 pr-7 py-1.5 focus:outline-none focus:border-black dark:focus:border-white text-black dark:text-white cursor-pointer"
                            >
                              <option value="">(None / Skip)</option>
                              {csvResult.headers.map((h) => (
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

                    {/* Preview Table */}
                    <div>
                      <h3 className="mono-eyebrow text-[#6b7280] dark:text-[#959494] mb-2 font-semibold">
                        FIRST 4 IMPORTED CANDIDATES WITH AI CLASSIFICATION
                      </h3>
                      <div className="border border-[#ebebeb] dark:border-white/[0.08] rounded-[4px] overflow-hidden overflow-x-auto">
                        <table className="w-full text-left text-xs font-mono">
                          <thead className="bg-[#f8fafc] dark:bg-[#313641]/30 border-b border-[#ebebeb] dark:border-white/[0.08] text-[#959494]">
                            <tr>
                              <th className="py-2 px-3">#</th>
                              <th className="py-2 px-3 text-[#ef2cc1]">AI IDENTIFIED TYPE</th>
                              {csvResult.headers.map((h) => (
                                <th key={h} className="py-2 px-3">
                                  {h}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#ebebeb] dark:divide-white/[0.06]">
                            {csvResult.rows.slice(0, 4).map((row, idx) => (
                              <tr key={idx} className="hover:bg-[#f8fafc] dark:hover:bg-white/[0.02]">
                                <td className="py-2.5 px-3 text-[#959494]">{idx + 1}</td>
                                <td className="py-2.5 px-3">
                                  <span className="ai-flat-pill animate-ios-swish text-[10px]">
                                    <span className="w-1 h-1 rounded-[1px] bg-[#ef2cc1]" />
                                    <span>{row.ai_company_type || row.company_type || 'AI Synthesizing...'}</span>
                                  </span>
                                </td>
                                {csvResult.headers.map((h) => (
                                  <td key={h} className="py-2.5 px-3 text-black dark:text-white max-w-xs truncate">
                                    {row[h] || '—'}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: Email Template Composer & Dynamic Variables */}
        {step === 'template' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left Column: Editor & Variables Toolbar */}
              <div className="lg:col-span-7 bg-white dark:bg-[#010120] border border-[#ebebeb] dark:border-white/[0.08] rounded-[4px] p-6 space-y-5">
                <div className="flex items-center justify-between pb-3 border-b border-[#ebebeb] dark:border-white/[0.08]">
                  <div>
                    <h2 className="text-base font-semibold text-black dark:text-white">
                      Compose Outreach Template
                    </h2>
                    <p className="text-xs text-[#959494] font-mono mt-0.5">
                      Click dynamic variable chips to insert personalized tokens into your message.
                    </p>
                  </div>
                  <button
                    onClick={() => setStep('upload')}
                    className="mono-btn text-xs text-[#6b7280] dark:text-[#959494] hover:text-black dark:hover:text-white"
                  >
                    ← Back to CSV
                  </button>
                </div>

                {/* Flat Technical AI Variable Tokens */}
                <div className="ai-flat-container overflow-hidden">
                  <div className="brand-gradient-h w-full" />
                  <div className="p-3.5 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2 text-black dark:text-white font-mono text-xs font-semibold">
                        <span className="w-1.5 h-1.5 rounded-[1px] bg-[#ef2cc1]" />
                        <span>AI ADAPTATION TOKENS</span>
                      </div>
                      <span className="text-[10px] font-mono text-[#959494]">
                        Dynamically evaluated per prospect
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { token: 'company_type', label: '{company_type}', desc: 'Identified Business Type' },
                        { token: 'personalized_pitch', label: '{personalized_pitch}', desc: 'Tailored Industry Pitch' },
                        { token: 'pain_point', label: '{pain_point}', desc: 'Industry Specific Bottleneck' },
                        { token: 'value_prop', label: '{value_prop}', desc: 'Tailored Solution' },
                        { token: 'industry', label: '{industry}', desc: 'High-Level Industry' },
                      ].map((v) => (
                        <button
                          key={v.token}
                          type="button"
                          onClick={() => handleInsertVariable(v.token)}
                          className="mono-btn text-[11px] font-mono px-2.5 py-1 rounded-[3px] bg-[#f8fafc] dark:bg-[#14161f] border border-[#ebebeb] dark:border-white/[0.12] text-black dark:text-white hover:border-black dark:hover:border-white transition flex items-center space-x-1.5"
                          title={v.desc}
                        >
                          <span>+{v.label}</span>
                          <span className="text-[9px] text-[#ef2cc1] font-mono uppercase font-semibold">[AI]</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Standard Variable Insertion Pills */}
                <div>
                  <div className="mono-eyebrow text-[#6b7280] dark:text-[#959494] mb-2 font-semibold">
                    STANDARD CSV CONTACT VARIABLES
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {['first_name', 'company_name', 'website', 'city', 'email'].map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => handleInsertVariable(v)}
                        className="mono-btn text-xs px-2.5 py-1 rounded-[3px] bg-[#f8fafc] dark:bg-[#313641]/30 border border-[#ebebeb] dark:border-white/[0.08] text-black dark:text-white hover:border-black dark:hover:border-white transition"
                      >
                        +{`{${v}}`}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Subject Line Input */}
                <div>
                  <label className="mono-eyebrow text-[#6b7280] dark:text-[#959494] block mb-1">
                    SUBJECT LINE
                  </label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="e.g. Quick question regarding {company_name}"
                    className="w-full text-xs font-mono border border-[#ebebeb] dark:border-white/[0.08] bg-white dark:bg-[#010120] rounded-[4px] p-2.5 text-black dark:text-white focus:outline-none focus:border-black dark:focus:border-white"
                  />
                </div>

                {/* Body Textarea with AI Enhancer Toggle */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="mono-eyebrow text-[#6b7280] dark:text-[#959494] block">
                      EMAIL BODY TEMPLATE
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setShowAiEnhancer(!showAiEnhancer);
                        if (showAiEnhancer) setAiResult(null);
                      }}
                      className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-[3px] border text-[10px] font-mono font-semibold transition ${
                        showAiEnhancer
                          ? 'bg-[#ef2cc1] border-[#ef2cc1] text-white'
                          : 'bg-black dark:bg-white text-white dark:text-black border-transparent hover:opacity-90'
                      }`}
                    >
                      <Sparkles className="w-3 h-3 text-[#ef2cc1]" />
                      <span>{showAiEnhancer ? 'CLOSE AI OPTIMIZER' : 'IMPROVE COPY WITH AI'}</span>
                    </button>
                  </div>

                  {/* AI Copywriting & Optimization Panel */}
                  {showAiEnhancer && (
                    <div className="ai-flat-container overflow-hidden space-y-3">
                      {aiEnhancing ? (
                        <div className="w-full h-[2px] bg-neutral-200 dark:bg-white/[0.08] overflow-hidden relative">
                          <div className="w-1/3 h-full bg-gradient-to-r from-[#fc4c02] via-[#ef2cc1] to-[#bdbbff] animate-flat-scan" />
                        </div>
                      ) : (
                        <div className="brand-gradient-h w-full" />
                      )}

                      <div className="p-3.5 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <Sparkles className="w-3.5 h-3.5 text-[#ef2cc1]" />
                            <span className="font-mono text-xs font-semibold uppercase text-black dark:text-white">
                              AI Template Optimizer
                            </span>
                          </div>
                          <span className="text-[10px] font-mono text-[#959494]">
                            Preserves dynamic tokens ({'{company_name}'}, {'{first_name}'}, etc.)
                          </span>
                        </div>

                        {/* Quick Goal Selector */}
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-mono uppercase text-[#959494] block">
                            Select Enhancement Goal:
                          </label>
                          <div className="flex flex-wrap gap-1.5">
                            {[
                              { id: 'persuasive', label: '🎯 Higher Conversion Hook' },
                              { id: 'concise', label: '✂️ More Concise (<85 words)' },
                              { id: 'cta', label: '⚡ Low-Friction CTA' },
                              { id: 'warmer', label: '🤝 Warmer Advisory Tone' },
                              { id: 'punchy', label: '💥 Short & Punchy' },
                              { id: 'custom', label: '✏️ Custom Instruction' },
                            ].map((g) => (
                              <button
                                key={g.id}
                                type="button"
                                onClick={() => setAiGoal(g.id as any)}
                                className={`text-[10px] font-mono px-2 py-0.5 rounded-[3px] border transition ${
                                  aiGoal === g.id
                                    ? 'bg-black dark:bg-white text-white dark:text-black border-black dark:border-white font-semibold'
                                    : 'bg-white dark:bg-[#14161f] border-[#ebebeb] dark:border-white/[0.1] text-[#6b7280] dark:text-[#959494] hover:text-black dark:hover:text-white'
                                }`}
                              >
                                {g.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        {aiGoal === 'custom' && (
                          <input
                            type="text"
                            value={aiCustomInstruction}
                            onChange={(e) => setAiCustomInstruction(e.target.value)}
                            placeholder="e.g. Focus on our free 1-click audit, sound friendly, keep it casual..."
                            className="w-full text-xs font-mono p-2 border border-[#ebebeb] dark:border-white/[0.08] rounded-[3px] bg-white dark:bg-[#010120] text-black dark:text-white focus:outline-none focus:border-black dark:focus:border-white"
                          />
                        )}

                        <div className="flex justify-end pt-1">
                          <button
                            type="button"
                            onClick={handleEnhanceTemplate}
                            disabled={aiEnhancing}
                            className="mono-btn bg-black dark:bg-white text-white dark:text-black px-3.5 py-1.5 rounded-[3px] text-xs font-mono font-semibold flex items-center space-x-1.5 hover:opacity-90 disabled:opacity-50 transition"
                          >
                            {aiEnhancing ? (
                              <>
                                <RefreshCw className="w-3 h-3 animate-spin" />
                                <span>OPTIMIZING TEMPLATE...</span>
                              </>
                            ) : (
                              <>
                                <Sparkles className="w-3 h-3 text-[#ef2cc1]" />
                                <span>GENERATE IMPROVED TEMPLATE</span>
                              </>
                            )}
                          </button>
                        </div>

                        {/* Results Box */}
                        {aiResult && (
                          <div className="border border-[#ebebeb] dark:border-white/[0.08] rounded-[4px] bg-white dark:bg-[#010120] p-3 space-y-2.5 mt-2">
                            <div className="flex items-center justify-between pb-1.5 border-b border-[#ebebeb] dark:border-white/[0.06]">
                              <div className="flex items-center space-x-1.5 text-xs font-mono font-semibold text-black dark:text-white">
                                <Check className="w-3.5 h-3.5 text-emerald-500" />
                                <span>OPTIMIZED COPY READY</span>
                              </div>
                              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-[2px] bg-black/5 dark:bg-white/10 text-black dark:text-white">
                                {aiResult.modelUsed}
                              </span>
                            </div>

                            <div className="text-xs font-sans text-[#4b5563] dark:text-[#9ca3af] bg-[#f8fafc] dark:bg-[#14161f] p-2 rounded-[3px]">
                              {aiResult.changesSummary}
                            </div>

                            <div className="space-y-1">
                              <span className="text-[10px] font-mono text-[#959494] uppercase block">Preview Subject:</span>
                              <div className="text-xs font-mono font-medium text-black dark:text-white">{aiResult.improvedSubject}</div>
                            </div>

                            <div className="space-y-1">
                              <span className="text-[10px] font-mono text-[#959494] uppercase block">Preview Body:</span>
                              <div className="text-xs font-mono whitespace-pre-wrap bg-[#f8fafc] dark:bg-[#14161f] p-2.5 rounded-[3px] border border-[#ebebeb] dark:border-white/[0.06] text-black dark:text-white max-h-36 overflow-y-auto">
                                {aiResult.improvedBody}
                              </div>
                            </div>

                            <div className="flex items-center justify-end space-x-2 pt-1 border-t border-[#ebebeb] dark:border-white/[0.06]">
                              <button
                                type="button"
                                onClick={() => setAiResult(null)}
                                className="mono-btn text-[11px] font-mono text-[#6b7280] dark:text-[#959494] px-2 py-1"
                              >
                                DISCARD
                              </button>
                              <button
                                type="button"
                                onClick={handleApplyAiTemplate}
                                className="mono-btn px-3 py-1.5 rounded-[3px] bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-mono font-semibold flex items-center space-x-1 shadow-sm"
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>APPLY TO TEMPLATE</span>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <textarea
                    ref={textareaRef}
                    rows={10}
                    value={bodyText}
                    onChange={(e) => setBodyText(e.target.value)}
                    placeholder="Hi {first_name},\n\nWrite your message here..."
                    className="w-full text-xs font-mono leading-relaxed border border-[#ebebeb] dark:border-white/[0.08] bg-white dark:bg-[#010120] rounded-[4px] p-3 text-black dark:text-white focus:outline-none focus:border-black dark:focus:border-white"
                  />
                </div>

                {/* Test error alert */}
                {testError && (
                  <div className="p-3 rounded-[4px] border border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs font-mono flex items-center space-x-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{testError}</span>
                  </div>
                )}

                {/* Send Test to Myself Button */}
                <div className="pt-3 border-t border-[#ebebeb] dark:border-white/[0.08] flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="text-xs font-mono text-[#6b7280] dark:text-[#959494] flex items-center space-x-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-500" />
                    <span>Safety Gate: Tests must be verified by you first</span>
                  </div>

                  <button
                    onClick={handleSendTestToSelf}
                    disabled={testSending || !subject || !bodyText}
                    className="mono-btn bg-black dark:bg-white text-white dark:text-black hover:bg-neutral-800 dark:hover:bg-neutral-200 px-5 py-2.5 rounded-[4px] text-xs font-semibold flex items-center space-x-2 shadow-sm transition active:scale-95 disabled:opacity-50"
                  >
                    {testSending ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>DISPATCHING TEST TO YOU...</span>
                      </>
                    ) : (
                      <>
                        <Mail className="w-3.5 h-3.5" />
                        <span>SEND TEST EMAIL TO MYSELF →</span>
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
                    <span className="mono-eyebrow text-black dark:text-white font-semibold">
                      LIVE RENDERED PREVIEW
                    </span>
                  </div>

                  {/* Prospect Selector */}
                  {csvResult && csvResult.rows.length > 0 && (
                    <div className="relative inline-flex items-center">
                      <select
                        value={previewContactIdx}
                        onChange={(e) => setPreviewContactIdx(Number(e.target.value))}
                        className="appearance-none text-[11px] font-mono border border-[#ebebeb] dark:border-white/[0.08] bg-white dark:bg-[#010120] rounded-[3px] pl-2.5 pr-7 py-1 text-black dark:text-white focus:outline-none focus:border-black cursor-pointer"
                      >
                        {csvResult.rows.slice(0, 20).map((r, i) => (
                          <option key={i} value={i}>
                            Contact #{i + 1} ({r[mapping.companyName || ''] || r[mapping.email || ''] || 'Prospect'})
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
                      <div className="flex items-center space-x-2 text-black dark:text-white text-xs font-mono font-semibold">
                        <span className="w-1.5 h-1.5 rounded-[1px] bg-[#ef2cc1]" />
                        <span>AI INFERENCE PROFILE</span>
                      </div>
                      <span className="ai-flat-pill text-[9px]">
                        {sampleProspect.ai_industry || sampleProspect.industry || 'Commercial Services'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[9px] font-mono uppercase text-[#959494] block">IDENTIFIED VERTICAL</span>
                      <div className="text-xs font-semibold text-black dark:text-white font-mono">
                        {sampleProspect.ai_company_type || sampleProspect.company_type || 'Modern Enterprise'}
                      </div>
                    </div>
                    {sampleProspect.ai_pain_point && (
                      <div className="pt-1.5 border-t border-[#ebebeb] dark:border-white/[0.06]">
                        <span className="text-[9px] font-mono uppercase text-[#959494] block">OPERATIONAL FRICTION</span>
                        <div className="text-[11px] font-mono text-black dark:text-white leading-snug">
                          {sampleProspect.ai_pain_point}
                        </div>
                      </div>
                    )}
                    {sampleProspect.ai_personalized_pitch && (
                      <div className="pt-1.5 border-t border-[#ebebeb] dark:border-white/[0.06]">
                        <span className="text-[9px] font-mono uppercase text-[#959494] block">BESPOKE PITCH ANGLE</span>
                        <div className="text-[11px] font-mono text-black dark:text-white leading-snug">
                          {sampleProspect.ai_personalized_pitch}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-[#f8fafc] dark:bg-[#313641]/20 rounded-[4px] border border-[#ebebeb] dark:border-white/[0.08] p-3.5 text-xs font-mono space-y-2.5">
                  <div>
                    <span className="text-[#959494] block text-[10px] font-semibold">TO RECIPIENT:</span>
                    <span className="text-black dark:text-white">
                      {sampleProspect[mapping.email || 'email'] || 'recipient@domain.com'}
                    </span>
                  </div>

                  <div className="pt-2 border-t border-[#ebebeb] dark:border-white/[0.06]">
                    <span className="text-[#959494] block text-[10px] font-semibold">SUBJECT:</span>
                    <span className="text-black dark:text-white font-medium">{renderedSubject}</span>
                  </div>

                  <div className="pt-2 border-t border-[#ebebeb] dark:border-white/[0.06]">
                    <span className="text-[#959494] block text-[10px] font-semibold mb-1">BODY:</span>
                    <div className="whitespace-pre-line leading-relaxed text-[#374151] dark:text-[#d4d4d8]">
                      {renderedBody}
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-[#f8fafc] dark:bg-[#313641]/20 border border-[#ebebeb] dark:border-white/[0.08] rounded-[4px] text-[11px] font-mono text-[#6b7280] dark:text-[#959494] space-y-1">
                  <div className="flex items-center space-x-1.5 text-black dark:text-white font-semibold">
                    <Info className="w-3.5 h-3.5" />
                    <span>Pre-Flight Destination</span>
                  </div>
                  <p>
                    Test email will be sent to:{' '}
                    <strong className="text-black dark:text-white">{operatorEmail || 'your logged-in email'}</strong>.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: Test Verification Review */}
        {step === 'test_sent' && (
          <div className="max-w-3xl mx-auto space-y-6">
            <div className="border border-[#ebebeb] dark:border-white/[0.08] bg-white dark:bg-[#010120] rounded-[4px] p-6 space-y-5">
              <div className="flex items-start space-x-3.5 mb-4">
                <div className="w-8 h-8 rounded-[4px] bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-black dark:text-white">
                    Test Email Dispatched to You!
                  </h2>
                  <p className="text-xs text-[#959494] font-mono mt-0.5">
                    Sent to: <strong className="text-black dark:text-white">{testResult?.sentTo || operatorEmail}</strong>
                  </p>
                  <p className="text-xs text-[#6b7280] dark:text-[#959494] mt-2 leading-relaxed">
                    Please open your inbox now and double-check variable replacements, line spacing, and tone. Once
                    you're satisfied, click below to approve and broadcast to all{' '}
                    <strong className="text-black dark:text-white">{csvResult?.totalRows}</strong> recipients in your CSV.
                  </p>
                </div>
              </div>

              {/* Exact Preview of what was sent */}
              <div className="bg-[#f8fafc] dark:bg-[#313641]/20 rounded-[4px] border border-[#ebebeb] dark:border-white/[0.08] p-4 text-xs font-mono space-y-2.5 mb-6">
                <div className="text-[11px] font-semibold text-black dark:text-white">
                  SUBJECT: {testResult?.preview?.subject || renderedSubject}
                </div>
                <div className="pt-2 border-t border-[#ebebeb] dark:border-white/[0.06] text-[#374151] dark:text-[#d4d4d8] whitespace-pre-line leading-relaxed">
                  {testResult?.preview?.bodyText || renderedBody}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-3 border-t border-[#ebebeb] dark:border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => setStep('template')}
                  className="mono-btn text-xs text-[#6b7280] dark:text-[#959494] hover:text-black dark:hover:text-white px-3 py-1.5 rounded-[4px]"
                >
                  ← Make Adjustments to Draft
                </button>

                <button
                  type="button"
                  onClick={handleBulkDispatch}
                  disabled={dispatching}
                  className="mono-btn bg-black dark:bg-white hover:bg-neutral-800 dark:hover:bg-neutral-200 text-white dark:text-black px-5 py-2.5 rounded-[4px] text-xs font-semibold flex items-center space-x-2 shadow-sm transition active:scale-95 disabled:opacity-50"
                >
                  {dispatching ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>DISPATCHING OUTREACH...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>APPROVE & DISPATCH TO ALL ({csvResult?.totalRows})</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 4: Dispatched Summary */}
        {step === 'dispatched' && (
          <div className="max-w-3xl mx-auto space-y-6">
            <div className="border border-[#ebebeb] dark:border-white/[0.08] bg-white dark:bg-[#010120] rounded-[4px] p-6 space-y-5">
              <div className="flex items-start space-x-3.5">
                <div className="w-8 h-8 rounded-[4px] bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-black dark:text-white">
                    Outreach Dispatch Completed!
                  </h2>
                  <p className="text-xs text-[#959494] font-mono mt-0.5">
                    Your campaign batch has been successfully queued and processed.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 text-xs font-mono">
                <div className="p-3 rounded-[4px] bg-[#f8fafc] dark:bg-[#313641]/20 border border-[#ebebeb] dark:border-white/[0.08]">
                  <span className="text-[#959494] block text-[10px]">TOTAL TARGETS</span>
                  <span className="text-base font-semibold text-black dark:text-white">
                    {dispatchSummary?.total || 0}
                  </span>
                </div>
                <div className="p-3 rounded-[4px] bg-[#f8fafc] dark:bg-[#313641]/20 border border-[#ebebeb] dark:border-white/[0.08]">
                  <span className="text-[#959494] block text-[10px]">DISPATCHED</span>
                  <span className="text-base font-semibold text-emerald-600 dark:text-emerald-400">
                    {dispatchSummary?.sent || 0}
                  </span>
                </div>
                <div className="p-3 rounded-[4px] bg-[#f8fafc] dark:bg-[#313641]/20 border border-[#ebebeb] dark:border-white/[0.08]">
                  <span className="text-[#959494] block text-[10px]">SUPPRESSED / ERRORS</span>
                  <span className="text-base font-semibold text-rose-600 dark:text-rose-400">
                    {dispatchSummary?.suppressed || dispatchSummary?.errors || 0}
                  </span>
                </div>
              </div>

              <div className="pt-3 border-t border-[#ebebeb] dark:border-white/[0.08] flex items-center justify-between">
                <Link
                  href="/outreach"
                  className="mono-btn px-4 py-2 bg-black dark:bg-white text-white dark:text-black rounded-[4px] text-xs font-semibold inline-flex items-center space-x-1.5"
                >
                  <span>VIEW OUTREACH LOGS</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>

                <button
                  type="button"
                  onClick={() => {
                    setCsvResult(null);
                    setFileName(null);
                    setStep('upload');
                  }}
                  className="mono-btn text-xs text-[#959494] hover:text-black dark:hover:text-white"
                >
                  Start Another CSV Import
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
