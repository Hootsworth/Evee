'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
  Upload,
  FileSpreadsheet,
  ArrowRight,
  ArrowLeft,
  Mail,
  Send,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Sparkles,
  Eye,
  Check,
  ShieldCheck,
  Trash2,
  Table,
  Columns,
  Info,
} from 'lucide-react';
import {
  parseAndAnalyzeCsv,
  ParsedCsvResult,
  CsvColumnMapping,
  replaceTemplateVariables,
} from '@/lib/csv/parser';

export default function CsvOutreachPage() {
  const router = useRouter();
  const supabase = createClient();

  // Wizard Steps: 1: upload -> 2: template -> 3: test_sent -> 4: dispatching / complete
  const [step, setStep] = useState<'upload' | 'template' | 'test_sent' | 'dispatched'>('upload');

  // Authenticated user
  const [operatorEmail, setOperatorEmail] = useState('');

  // CSV Data State
  const [csvText, setCsvText] = useState('');
  const [fileName, setFileName] = useState('');
  const [csvResult, setCsvResult] = useState<ParsedCsvResult | null>(null);
  const [mapping, setMapping] = useState<CsvColumnMapping>({
    email: null,
    companyName: null,
    firstName: null,
    lastName: null,
    website: null,
    city: null,
  });

  // Template State
  const [subject, setSubject] = useState('Personalized idea for {company_name}');
  const [bodyText, setBodyText] = useState(
    'Hi {first_name},\n\nI was looking into {company_name} and noticed an opportunity to streamline your customer booking and digital workflows on {website}.\n\nWe recently helped similar businesses in {city} improve online conversion with a dedicated, zero-friction booking system.\n\nWould you be open to a brief 5-minute chat this week?\n\nBest regards,\nOperator'
  );

  // Preview State
  const [previewContactIdx, setPreviewContactIdx] = useState(0);

  // Test send state
  const [testSending, setTestSending] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);
  const [testError, setTestError] = useState<string | null>(null);

  // Bulk dispatch state
  const [dispatching, setDispatching] = useState(false);
  const [dispatchSummary, setDispatchSummary] = useState<any>(null);
  const [dispatchResults, setDispatchResults] = useState<any[]>([]);

  // Textarea ref for variable token insertion
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user?.email) {
        setOperatorEmail(data.user.email);
      }
    });
  }, []);

  // Handle CSV file selection
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setCsvText(content);
        processCsvContent(content);
      }
    };
    reader.readAsText(file);
  };

  // Sample CSV Loader
  const handleLoadSampleCsv = () => {
    const sample = `email,company_name,first_name,website,city
sunita@artisanbakes.in,Artisan Bakes,Sunita,artisanbakes.in,Bengaluru
rahul@urbanroast.in,Urban Roast Cafe,Rahul,urbanroast.in,Mumbai
contact@blueheroncoffee.com,Blue Heron Coffee,Marcus,blueheroncoffee.com,London
dr.mehta@smilecare.in,SmileCare Dental,Dr. Mehta,smilecare.in,Delhi`;
    setFileName('sample_prospects.csv');
    setCsvText(sample);
    processCsvContent(sample);
  };

  const processCsvContent = (content: string) => {
    const result = parseAndAnalyzeCsv(content);
    setCsvResult(result);
    setMapping(result.detectedMapping);
  };

  // Insert variable into active editor
  const handleInsertVariable = (varName: string) => {
    const token = `{${varName}}`;
    if (!textareaRef.current) {
      setBodyText((prev) => prev + ' ' + token);
      return;
    }

    const textarea = textareaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newText = bodyText.substring(0, start) + token + bodyText.substring(end);
    setBodyText(newText);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + token.length, start + token.length);
    }, 50);
  };

  // 1. Send Test Email to Operator
  const handleSendTestToSelf = async () => {
    if (!csvResult || csvResult.rows.length === 0) {
      alert('Please upload a valid CSV first.');
      return;
    }

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
    <div className="min-h-screen bg-white dark:bg-[#09090b] transition-colors duration-150">
      {/* Top Banner: Flat & Clean */}
      <section className="bg-[#f8fafc] dark:bg-[#121217] border-b border-[#e5e7eb] dark:border-[#27272a] px-6 py-8">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <Link
              href="/campaigns"
              className="mono-btn text-xs text-[#f43f5e] hover:underline flex items-center space-x-1.5 mb-2 font-normal"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>BACK TO CAMPAIGNS</span>
            </Link>
            <h1 className="text-3xl font-light tracking-tight text-[#111827] dark:text-white">CSV Direct Outreach</h1>
            <p className="text-sm text-[#6b7280] dark:text-[#a1a1aa] mt-1 max-w-xl font-light">
              Import prospect spreadsheets, compose dynamic templates with dynamic tags, test on yourself, and dispatch with human approval.
            </p>
          </div>

          {/* Stepper Pill Indicator */}
          <div className="flex items-center space-x-2 bg-white dark:bg-[#18181b] border border-[#e5e7eb] dark:border-[#27272a] rounded-full p-1.5 self-start sm:self-auto text-xs font-mono">
            {[
              { id: 'upload', label: '1. CSV' },
              { id: 'template', label: '2. Compose' },
              { id: 'test_sent', label: '3. Verify Self' },
              { id: 'dispatched', label: '4. Dispatched' },
            ].map((s, idx) => {
              const active = step === s.id;
              return (
                <span
                  key={s.id}
                  className={`px-3 py-1 rounded-full transition ${
                    active
                      ? 'bg-[#111827] dark:bg-white text-white dark:text-[#111827] font-medium'
                      : 'text-[#6b7280] dark:text-[#a1a1aa]'
                  }`}
                >
                  {s.label}
                </span>
              );
            })}
          </div>
        </div>
      </section>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-6 py-10">
        {/* STEP 1: Upload CSV & Auto-Detect Columns */}
        {step === 'upload' && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Upload Card */}
              <div className="lg:col-span-1 border border-[#e5e7eb] dark:border-[#27272a] rounded-2xl p-6 bg-white dark:bg-[#121217] shadow-sm flex flex-col justify-between">
                <div>
                  <h2 className="text-lg font-light text-[#111827] dark:text-white mb-1">Import Spreadsheet</h2>
                  <p className="text-xs text-[#6b7280] dark:text-[#a1a1aa] font-mono mb-6 font-light">
                    Upload any .csv file with contacts. Evee auto-detects emails, names, and companies.
                  </p>

                  <label className="border-2 border-dashed border-[#e5e7eb] dark:border-[#27272a] hover:border-[#f43f5e] dark:hover:border-[#f43f5e] rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition bg-[#f8fafc] dark:bg-[#18181b] group">
                    <Upload className="w-8 h-8 text-[#9ca3af] group-hover:text-[#f43f5e] transition mb-3" />
                    <span className="text-xs font-normal text-[#111827] dark:text-white">
                      {fileName ? fileName : 'Click to select CSV file'}
                    </span>
                    <span className="text-[11px] text-[#9ca3af] font-mono mt-1 font-light">
                      Supports RFC 4180 format (.csv)
                    </span>
                    <input type="file" accept=".csv,text/csv" onChange={handleFileUpload} className="hidden" />
                  </label>

                  <div className="mt-4 pt-4 border-t border-[#f3f4f6] dark:border-[#27272a] flex items-center justify-between">
                    <span className="text-xs text-[#6b7280] dark:text-[#a1a1aa] font-mono font-light">
                      Don't have a CSV handy?
                    </span>
                    <button
                      type="button"
                      onClick={handleLoadSampleCsv}
                      className="mono-btn text-xs text-[#f43f5e] hover:underline font-normal"
                    >
                      Load Sample Demo CSV
                    </button>
                  </div>
                </div>

                {csvResult && csvResult.rows.length > 0 && (
                  <div className="mt-6 pt-4 border-t border-[#f3f4f6] dark:border-[#27272a]">
                    <button
                      onClick={() => setStep('template')}
                      className="mono-btn w-full bg-[#f43f5e] hover:bg-[#e11d48] text-white py-3 rounded-full text-xs font-normal flex items-center justify-center space-x-2 shadow-sm transition active:scale-95"
                    >
                      <span>CONTINUE TO TEMPLATE COMPOSER</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {/* Detected Mapping & Preview */}
              <div className="lg:col-span-2 border border-[#e5e7eb] dark:border-[#27272a] rounded-2xl p-6 bg-white dark:bg-[#121217] shadow-sm">
                <div className="flex items-center justify-between pb-4 border-b border-[#f3f4f6] dark:border-[#27272a] mb-6">
                  <div>
                    <h2 className="text-lg font-light text-[#111827] dark:text-white">Auto-Detected Field Mapping</h2>
                    <p className="text-xs text-[#6b7280] dark:text-[#a1a1aa] font-mono font-light mt-0.5">
                      Verify which CSV columns map to standard outreach parameters.
                    </p>
                  </div>
                  {csvResult && (
                    <span className="text-xs font-mono px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                      {csvResult.validEmailCount} Valid Emails Detected
                    </span>
                  )}
                </div>

                {!csvResult ? (
                  <div className="py-20 text-center font-mono text-xs text-[#9ca3af] dark:text-[#71717a] font-light">
                    Upload or select a sample CSV to view auto-detected columns and rows.
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Mapping Selectors */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {[
                        { key: 'email', label: 'Email Address *', required: true },
                        { key: 'companyName', label: 'Company / Business Name' },
                        { key: 'firstName', label: 'First Name / Contact' },
                        { key: 'website', label: 'Website URL' },
                        { key: 'city', label: 'City / Location' },
                      ].map((field) => (
                        <div key={field.key} className="p-3 bg-[#f8fafc] dark:bg-[#18181b] rounded-xl border border-[#e5e7eb] dark:border-[#27272a]">
                          <label className="mono-eyebrow text-[#6b7280] dark:text-[#a1a1aa] font-normal block mb-1">
                            {field.label}
                          </label>
                          <select
                            value={(mapping as any)[field.key] || ''}
                            onChange={(e) => setMapping({ ...mapping, [field.key]: e.target.value || null })}
                            className="w-full text-xs font-mono bg-white dark:bg-[#121217] border border-[#e5e7eb] dark:border-[#27272a] rounded-lg p-2 focus:outline-none focus:border-[#f43f5e] text-[#111827] dark:text-white"
                          >
                            <option value="">(None / Skip)</option>
                            {csvResult.headers.map((h) => (
                              <option key={h} value={h}>
                                {h}
                              </option>
                            ))}
                          </select>
                        </div>
                      ))}
                    </div>

                    {/* Preview Table */}
                    <div>
                      <h3 className="mono-eyebrow text-[#6b7280] dark:text-[#a1a1aa] font-normal mb-2">
                        FIRST 4 IMPORTED CANDIDATES
                      </h3>
                      <div className="border border-[#e5e7eb] dark:border-[#27272a] rounded-xl overflow-hidden overflow-x-auto">
                        <table className="w-full text-left text-xs font-mono">
                          <thead className="bg-[#f8fafc] dark:bg-[#18181b] border-b border-[#e5e7eb] dark:border-[#27272a] text-[#4b5563] dark:text-[#a1a1aa]">
                            <tr>
                              <th className="py-2.5 px-3 font-normal">#</th>
                              {csvResult.headers.map((h) => (
                                <th key={h} className="py-2.5 px-3 font-normal">
                                  {h}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#f3f4f6] dark:divide-[#27272a]">
                            {csvResult.rows.slice(0, 4).map((row, idx) => (
                              <tr key={idx} className="hover:bg-[#f8fafc] dark:hover:bg-[#18181b]">
                                <td className="py-2.5 px-3 text-[#9ca3af]">{idx + 1}</td>
                                {csvResult.headers.map((h) => (
                                  <td key={h} className="py-2.5 px-3 text-[#111827] dark:text-white max-w-xs truncate">
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
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* Left Column: Editor & Variables Toolbar */}
              <div className="lg:col-span-7 bg-white dark:bg-[#121217] border border-[#e5e7eb] dark:border-[#27272a] rounded-2xl p-6 shadow-sm space-y-6">
                <div className="flex items-center justify-between pb-4 border-b border-[#f3f4f6] dark:border-[#27272a]">
                  <div>
                    <h2 className="text-xl font-light text-[#111827] dark:text-white">Compose Outreach Template</h2>
                    <p className="text-xs text-[#6b7280] dark:text-[#a1a1aa] font-mono mt-0.5 font-light">
                      Click dynamic variable chips to insert personalized tokens into your message.
                    </p>
                  </div>
                  <button
                    onClick={() => setStep('upload')}
                    className="mono-btn text-xs text-[#6b7280] hover:text-[#111827] dark:hover:text-white font-normal"
                  >
                    ← Back to CSV
                  </button>
                </div>

                {/* Variable Insertion Pills */}
                <div>
                  <div className="flex items-center space-x-1.5 mb-2">
                    <Sparkles className="w-3.5 h-3.5 text-[#f43f5e]" />
                    <span className="mono-eyebrow text-[#6b7280] dark:text-[#a1a1aa] font-normal">
                      CLICK TO INSERT DYNAMIC VARIABLES
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {['first_name', 'company_name', 'website', 'city', 'email'].map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => handleInsertVariable(v)}
                        className="mono-btn text-xs px-3 py-1 rounded-full bg-[#f8fafc] dark:bg-[#18181b] border border-[#e5e7eb] dark:border-[#27272a] text-[#111827] dark:text-white hover:border-[#f43f5e] hover:text-[#f43f5e] transition font-normal"
                      >
                        +{`{${v}}`}
                      </button>
                    ))}

                    {/* Any custom headers detected in CSV */}
                    {csvResult?.headers
                      .filter((h) => !['first_name', 'company_name', 'website', 'city', 'email'].includes(h.toLowerCase()))
                      .map((customHeader) => (
                        <button
                          key={customHeader}
                          type="button"
                          onClick={() => handleInsertVariable(customHeader)}
                          className="mono-btn text-xs px-2.5 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:border-[#f43f5e] hover:text-[#f43f5e] transition font-normal"
                        >
                          +{`{${customHeader}}`}
                        </button>
                      ))}
                  </div>
                </div>

                {/* Subject Line Input */}
                <div>
                  <label className="mono-eyebrow text-[#6b7280] dark:text-[#a1a1aa] font-normal block mb-1.5">
                    SUBJECT LINE
                  </label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="e.g. Quick question regarding {company_name}"
                    className="w-full text-sm font-light border border-[#e5e7eb] dark:border-[#27272a] bg-white dark:bg-[#18181b] rounded-xl p-3 focus:outline-none focus:border-[#f43f5e] focus:ring-1 focus:ring-rose-500/20 text-[#111827] dark:text-white"
                  />
                </div>

                {/* Body Textarea */}
                <div>
                  <label className="mono-eyebrow text-[#6b7280] dark:text-[#a1a1aa] font-normal block mb-1.5">
                    EMAIL BODY TEMPLATE
                  </label>
                  <textarea
                    ref={textareaRef}
                    rows={10}
                    value={bodyText}
                    onChange={(e) => setBodyText(e.target.value)}
                    placeholder="Hi {first_name},\n\nWrite your message here..."
                    className="w-full text-xs font-mono font-light leading-relaxed border border-[#e5e7eb] dark:border-[#27272a] bg-white dark:bg-[#18181b] rounded-xl p-4 focus:outline-none focus:border-[#f43f5e] focus:ring-1 focus:ring-rose-500/20 text-[#111827] dark:text-white"
                  />
                </div>

                {/* Test error alert */}
                {testError && (
                  <div className="p-3.5 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200 text-xs font-mono flex items-center space-x-2">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>{testError}</span>
                  </div>
                )}

                {/* Send Test to Myself Button */}
                <div className="pt-4 border-t border-[#f3f4f6] dark:border-[#27272a] flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="text-xs font-mono text-[#6b7280] dark:text-[#a1a1aa] flex items-center space-x-1.5 font-light">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span>Safety Gate: Tests must be verified by you first</span>
                  </div>

                  <button
                    onClick={handleSendTestToSelf}
                    disabled={testSending || !subject || !bodyText}
                    className="mono-btn bg-[#f43f5e] hover:bg-[#e11d48] text-white px-6 py-3 rounded-full text-xs font-normal flex items-center space-x-2 shadow-sm transition active:scale-95 disabled:opacity-50"
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
              <div className="lg:col-span-5 bg-[#f8fafc] dark:bg-[#121217] border border-[#e5e7eb] dark:border-[#27272a] rounded-2xl p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-[#e5e7eb] dark:border-[#27272a]">
                  <div className="flex items-center space-x-2">
                    <Eye className="w-4 h-4 text-[#f43f5e]" />
                    <span className="mono-eyebrow text-[#111827] dark:text-white font-normal">
                      LIVE RENDERED PREVIEW
                    </span>
                  </div>

                  {/* Prospect Selector */}
                  {csvResult && csvResult.rows.length > 0 && (
                    <select
                      value={previewContactIdx}
                      onChange={(e) => setPreviewContactIdx(Number(e.target.value))}
                      className="text-[11px] font-mono border border-[#e5e7eb] dark:border-[#27272a] bg-white dark:bg-[#18181b] rounded-lg px-2 py-1 text-[#111827] dark:text-white"
                    >
                      {csvResult.rows.slice(0, 10).map((r, i) => (
                        <option key={i} value={i}>
                          Contact #{i + 1} ({r[mapping.companyName || ''] || r[mapping.email || ''] || 'Prospect'})
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="bg-white dark:bg-[#18181b] rounded-xl border border-[#e5e7eb] dark:border-[#27272a] p-4 text-xs font-mono space-y-3">
                  <div>
                    <span className="text-[#9ca3af] block font-light text-[10px]">TO RECIPIENT:</span>
                    <span className="text-[#111827] dark:text-white font-normal">
                      {sampleProspect[mapping.email || 'email'] || 'recipient@domain.com'}
                    </span>
                  </div>

                  <div className="pt-2 border-t border-[#f3f4f6] dark:border-[#27272a]">
                    <span className="text-[#9ca3af] block font-light text-[10px]">SUBJECT:</span>
                    <span className="text-[#111827] dark:text-white font-medium">{renderedSubject}</span>
                  </div>

                  <div className="pt-2 border-t border-[#f3f4f6] dark:border-[#27272a]">
                    <span className="text-[#9ca3af] block font-light text-[10px] mb-1">BODY:</span>
                    <div className="whitespace-pre-line leading-relaxed text-[#374151] dark:text-[#d4d4d8] font-light">
                      {renderedBody}
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-white dark:bg-[#18181b] border border-[#e5e7eb] dark:border-[#27272a] rounded-xl text-[11px] font-mono text-[#6b7280] dark:text-[#a1a1aa] space-y-1">
                  <div className="flex items-center space-x-1.5 text-zinc-900 dark:text-white font-medium">
                    <Info className="w-3.5 h-3.5" />
                    <span>Test Destination</span>
                  </div>
                  <p className="font-light">
                    Test dispatch will be delivered to your account email:{' '}
                    <strong className="text-[#f43f5e]">{operatorEmail || 'your logged-in email'}</strong>.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: Test Verification Review */}
        {step === 'test_sent' && (
          <div className="max-w-3xl mx-auto space-y-6">
            <div className="border border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/30 rounded-2xl p-6 sm:p-8 shadow-sm">
              <div className="flex items-start space-x-4 mb-6">
                <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-light text-emerald-950 dark:text-emerald-100">
                    Test Email Dispatched to You!
                  </h2>
                  <p className="text-xs text-emerald-800 dark:text-emerald-300 font-mono mt-1 font-light">
                    Sent to: <strong className="font-semibold">{testResult?.sentTo || operatorEmail}</strong>
                  </p>
                  <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-2 font-sans leading-relaxed font-light">
                    Please open your inbox now and double-check variable replacements, line spacing, and tone. Once
                    you're satisfied, click below to approve and broadcast to all{' '}
                    <strong>{csvResult?.totalRows}</strong> recipients in your CSV.
                  </p>
                </div>
              </div>

              {/* Exact Preview of what was sent */}
              <div className="bg-white dark:bg-[#121217] rounded-xl border border-emerald-200 dark:border-emerald-900/60 p-4 text-xs font-mono space-y-3 mb-6">
                <div className="text-[11px] font-semibold text-emerald-900 dark:text-emerald-300">
                  SUBJECT: {testResult?.preview?.subject || renderedSubject}
                </div>
                <div className="pt-2 border-t border-emerald-100 dark:border-emerald-950 text-[#374151] dark:text-[#d4d4d8] whitespace-pre-line leading-relaxed font-light">
                  {testResult?.preview?.bodyText || renderedBody}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-emerald-200 dark:border-emerald-900/50">
                <button
                  type="button"
                  onClick={() => setStep('template')}
                  className="mono-btn text-xs text-[#4b5563] dark:text-[#a1a1aa] hover:text-[#111827] dark:hover:text-white px-4 py-2 rounded-full font-normal"
                >
                  ← Make Adjustments to Draft
                </button>

                <button
                  type="button"
                  onClick={handleBulkDispatch}
                  disabled={dispatching}
                  className="mono-btn bg-[#f43f5e] hover:bg-[#e11d48] text-white px-6 py-3 rounded-full text-xs font-normal flex items-center space-x-2 shadow-sm transition active:scale-95 disabled:opacity-50"
                >
                  {dispatching ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>DISPATCHING TO ALL RECIPIENTS...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>I APPROVE — DISPATCH TO ALL {csvResult?.totalRows} RECIPIENTS →</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 4: Dispatched Summary & Ledger */}
        {step === 'dispatched' && (
          <div className="max-w-3xl mx-auto space-y-6">
            <div className="bg-white dark:bg-[#121217] border border-[#e5e7eb] dark:border-[#27272a] rounded-2xl p-6 sm:p-8 shadow-sm">
              <div className="text-center pb-6 border-b border-[#f3f4f6] dark:border-[#27272a] mb-6">
                <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600 dark:text-emerald-300 flex items-center justify-center mx-auto mb-3">
                  <Check className="w-6 h-6" />
                </div>
                <h2 className="text-2xl font-light text-[#111827] dark:text-white">Batch Outreach Completed</h2>
                <p className="text-xs text-[#6b7280] dark:text-[#a1a1aa] font-mono mt-1 font-light">
                  Your personalized emails have been processed through the safety mailer.
                </p>
              </div>

              {/* Metric Badges */}
              <div className="grid grid-cols-3 gap-4 mb-6 text-center font-mono">
                <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl">
                  <div className="text-2xl font-light text-emerald-700 dark:text-emerald-300">
                    {dispatchSummary?.sent || 0}
                  </div>
                  <div className="text-[10px] uppercase text-emerald-800 dark:text-emerald-400 mt-1">Delivered</div>
                </div>

                <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl">
                  <div className="text-2xl font-light text-amber-700 dark:text-amber-300">
                    {dispatchSummary?.suppressed || 0}
                  </div>
                  <div className="text-[10px] uppercase text-amber-800 dark:text-amber-400 mt-1">Suppressed</div>
                </div>

                <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl">
                  <div className="text-2xl font-light text-rose-700 dark:text-rose-300">
                    {dispatchSummary?.failed || 0}
                  </div>
                  <div className="text-[10px] uppercase text-rose-800 dark:text-rose-400 mt-1">Failed</div>
                </div>
              </div>

              {/* Itemized Table */}
              <div className="border border-[#e5e7eb] dark:border-[#27272a] rounded-xl overflow-hidden mb-6">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-[#f8fafc] dark:bg-[#18181b] border-b border-[#e5e7eb] dark:border-[#27272a] text-[#4b5563] dark:text-[#a1a1aa]">
                    <tr>
                      <th className="py-2.5 px-4 font-normal">RECIPIENT</th>
                      <th className="py-2.5 px-4 font-normal">DISPATCH STATUS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f3f4f6] dark:divide-[#27272a]">
                    {dispatchResults.map((r, i) => (
                      <tr key={i}>
                        <td className="py-2.5 px-4 text-[#111827] dark:text-white font-light">{r.email}</td>
                        <td className="py-2.5 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-normal ${
                              r.status === 'sent'
                                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                                : r.status === 'suppressed'
                                ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300'
                                : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300'
                            }`}
                          >
                            {r.status.toUpperCase()}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-[#f3f4f6] dark:border-[#27272a]">
                <Link
                  href="/campaigns"
                  className="mono-btn text-xs text-[#6b7280] dark:text-[#a1a1aa] hover:text-[#111827] dark:hover:text-white font-normal"
                >
                  ← Return to Campaigns
                </Link>

                <button
                  type="button"
                  onClick={() => {
                    setStep('upload');
                    setFileName('');
                    setCsvResult(null);
                    setDispatchSummary(null);
                  }}
                  className="mono-btn bg-[#f43f5e] hover:bg-[#e11d48] text-white px-5 py-2.5 rounded-full text-xs font-normal"
                >
                  Start New CSV Outreach
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
