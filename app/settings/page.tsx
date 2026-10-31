'use client';

import { useState, useEffect } from 'react';
import {
  Mail,
  Sparkles,
  Key,
  ShieldCheck,
  Check,
  AlertCircle,
  Save,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Search,
  ChevronDown,
  Globe,
  Radio,
  RefreshCw,
  ExternalLink,
  Copy,
  ScrollText,
} from 'lucide-react';

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'smtp' | 'ai' | 'places' | 'enrichment' | 'suppression' | 'dns' | 'webhooks' | 'audit'>('smtp');
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Show/Hide password toggles
  const [showSmtpPass, setShowSmtpPass] = useState(false);
  const [showAiKey, setShowAiKey] = useState(false);
  const [showPlacesKey, setShowPlacesKey] = useState(false);
  const [showEnrichmentKey, setShowEnrichmentKey] = useState(false);

  // SMTP App Password state
  const [smtpEmail, setSmtpEmail] = useState('');
  const [smtpAppPassword, setSmtpAppPassword] = useState('');
  const [smtpConfigured, setSmtpConfigured] = useState(false);

  // AI Provider & Model state
  const [aiProvider, setAiProvider] = useState<'openai' | 'gemini' | 'meta'>('gemini');
  const [aiModel, setAiModel] = useState('Gemini 1.5 flash');
  const [aiApiKey, setAiApiKey] = useState('');
  const [aiKeyConfigured, setAiKeyConfigured] = useState(false);

  // Google Places Discovery key state
  const [placesApiKey, setPlacesApiKey] = useState('');
  const [placesKeyConfigured, setPlacesKeyConfigured] = useState(false);

  // Lead Enrichment state
  const [enrichmentProvider, setEnrichmentProvider] = useState<'built_in' | 'explorium' | 'hunter'>('built_in');
  const [enrichmentApiKey, setEnrichmentApiKey] = useState('');
  const [enrichmentKeyConfigured, setEnrichmentKeyConfigured] = useState(false);

  // Global suppression state
  const [suppressions, setSuppressions] = useState<any[]>([]);
  const [newSuppressionEmail, setNewSuppressionEmail] = useState('');
  const [newSuppressionReason, setNewSuppressionReason] = useState('manual_block');
  const [suppressionSearch, setSuppressionSearch] = useState('');

  // DNS Pre-Flight Auditor state
  const [dnsDomain, setDnsDomain] = useState('evee.ai');
  const [dnsAuditing, setDnsAuditing] = useState(false);
  const [dnsResults, setDnsResults] = useState<any>(null);
  const [copiedWebhook, setCopiedWebhook] = useState<string | null>(null);

  // Audit Logs state
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);

  const fetchSettings = async () => {
    try {
      const [settingsRes, supRes] = await Promise.all([
        fetch('/api/settings/providers'),
        fetch('/api/suppression'),
      ]);

      if (settingsRes.ok) {
        const sData = await settingsRes.json();
        if (sData.settings) {
          setSmtpConfigured(sData.settings.smtpConfigured);
          if (sData.settings.smtpUser) setSmtpEmail(sData.settings.smtpUser);
          setAiProvider(sData.settings.aiProvider || 'gemini');
          setAiKeyConfigured(sData.settings.aiKeyConfigured);
          setPlacesKeyConfigured(sData.settings.discoveryKeyConfigured);
          setEnrichmentKeyConfigured(Boolean(sData.settings.enrichmentKeyConfigured));
          if (sData.settings.enrichmentProvider) setEnrichmentProvider(sData.settings.enrichmentProvider);
        }
      }

      if (supRes.ok) {
        const supData = await supRes.json();
        setSuppressions(supData.suppressionList || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchAuditLogs = async () => {
    setLoadingAudit(true);
    try {
      const res = await fetch('/api/audit-logs?limit=40');
      const data = await res.json();
      setAuditLogs(data.logs || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingAudit(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  useEffect(() => {
    if (activeTab === 'audit') {
      fetchAuditLogs();
    }
  }, [activeTab]);

  const handleSaveProviders = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const payload: any = {
        aiProvider,
        aiModel,
      };

      if (smtpEmail && smtpAppPassword) {
        payload.smtpEmail = smtpEmail;
        payload.smtpAppPassword = smtpAppPassword;
      }

      if (aiApiKey) {
        payload.aiApiKey = aiApiKey;
      }

      if (placesApiKey) {
        payload.placesApiKey = placesApiKey;
      }

      if (enrichmentApiKey) {
        payload.exploriumApiKey = enrichmentApiKey;
        payload.enrichmentProvider = enrichmentProvider;
      }

      const res = await fetch('/api/settings/providers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok) {
        setMessage({ text: 'Provider configurations and encryption tokens updated.', type: 'success' });
        setSmtpAppPassword('');
        setAiApiKey('');
        setPlacesApiKey('');
        setEnrichmentApiKey('');
        fetchSettings();

        // Record audit event
        fetch('/api/audit-logs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'API_KEY_UPDATED',
            entityType: 'PROVIDER_SETTINGS',
            metadata: { aiProvider, smtpUser: smtpEmail },
          }),
        }).catch(() => {});
      } else {
        setMessage({ text: data.error || 'Failed to update settings', type: 'error' });
      }
    } catch (err: any) {
      setMessage({ text: err.message || 'Network error saving settings', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleAddSuppression = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSuppressionEmail) return;

    try {
      const res = await fetch('/api/suppression', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'email',
          value: newSuppressionEmail,
          reason: newSuppressionReason,
        }),
      });

      if (res.ok) {
        setNewSuppressionEmail('');
        fetchSettings();

        fetch('/api/audit-logs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'SUPPRESSION_ADDED',
            entityType: 'SUPPRESSION_LIST',
            metadata: { value: newSuppressionEmail, reason: newSuppressionReason },
          }),
        }).catch(() => {});
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteSuppression = async (id: string) => {
    try {
      const res = await fetch(`/api/suppression?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchSettings();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const runDnsAudit = async () => {
    if (!dnsDomain) return;
    setDnsAuditing(true);
    try {
      const res = await fetch('/api/settings/dns-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: dnsDomain }),
      });
      const data = await res.json();
      setDnsResults(data);

      fetch('/api/audit-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'DNS_AUDITED',
          entityType: 'DELIVERABILITY_CHECK',
          metadata: { domain: dnsDomain, score: data.score },
        }),
      }).catch(() => {});
    } catch (err: any) {
      setMessage({ text: `DNS audit error: ${err.message}`, type: 'error' });
    } finally {
      setDnsAuditing(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedWebhook(label);
    setTimeout(() => setCopiedWebhook(null), 2500);
  };

  const filteredSuppressions = suppressions.filter((s) => {
    const val = s.normalized_email || s.normalized_phone || s.normalized_value || '';
    return val.toLowerCase().includes(suppressionSearch.toLowerCase());
  });

  const tabs = [
    { id: 'smtp', label: 'Outbound Mailer', icon: Mail, badge: smtpConfigured ? 'Connected' : 'Setup' },
    { id: 'dns', label: 'DNS & Deliverability', icon: Globe, badge: 'Pre-Flight' },
    { id: 'webhooks', label: 'Webhooks & Inbound', icon: Radio, badge: 'Automated' },
    { id: 'ai', label: 'AI Reasoning', icon: Sparkles, badge: aiKeyConfigured ? 'Active' : 'Key Required' },
    { id: 'places', label: 'Places Discovery', icon: Key, badge: placesKeyConfigured ? 'Live API' : 'Simulation' },
    { id: 'enrichment', label: 'Lead Enrichment (Free AI)', icon: Search, badge: '100% Free' },
    { id: 'suppression', label: 'Suppression Registry', icon: ShieldCheck, count: suppressions.length },
    { id: 'audit', label: 'Audit Trail', icon: ScrollText, badge: 'Telemetry' },
  ];

  return (
    <div className="min-h-screen bg-white dark:bg-[#010120] text-[#000000] dark:text-[#ffffff] transition-colors duration-150 flex flex-col">
      {/* 2px Signature Gradient Ribbon */}
      <div className="brand-gradient-h w-full" />

      {/* Hero Band: Canvas Dark #010120 */}
      <section className="bg-[#010120] text-white border-b border-white/[0.08] px-6 py-8">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2 text-[10px] font-mono tracking-widest text-[#959494] uppercase mb-1">
              <span>SYSTEM CONFIGURATION // HARDENED CREDENTIALS</span>
              <span>•</span>
              <span className="text-[#ef2cc1]">AES-256-GCM ENCRYPTED</span>
            </div>
            <h1 className="text-3xl font-medium tracking-tight text-white">
              Settings & Deliverability
            </h1>
            <p className="text-xs text-[#959494] mt-1 max-w-xl font-normal">
              Manage authenticated outbound mailers, DNS pre-flight verification, LLM reasoning keys, webhooks, and immutable audit logs.
            </p>
          </div>

          <button
            onClick={() => handleSaveProviders()}
            disabled={saving}
            className="mono-btn bg-white hover:bg-neutral-200 text-black px-4 py-2 rounded-[4px] text-xs font-semibold transition flex items-center space-x-2 shadow-sm active:scale-95"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{saving ? 'ENCRYPTING...' : 'SAVE ALL CHANGES'}</span>
          </button>
        </div>
      </section>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-6 py-8 w-full flex-1">
        {/* Feedback message banner */}
        {message && (
          <div
            className={`mb-6 p-3 rounded-[4px] border text-xs font-mono flex items-center space-x-2.5 ${
              message.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                : 'bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400'
            }`}
          >
            {message.type === 'success' ? (
              <Check className="w-4 h-4 text-emerald-500 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
            )}
            <span>{message.text}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Navigation Sidebar */}
          <aside className="lg:col-span-3 space-y-1 bg-white dark:bg-[#010120] p-2 rounded-[4px] border border-[#ebebeb] dark:border-white/[0.08]">
            {tabs.map((t) => {
              const Icon = t.icon;
              const isActive = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id as any)}
                  className={`w-full text-left px-3 py-2 rounded-[4px] text-xs font-mono transition-all flex items-center justify-between ${
                    isActive
                      ? 'bg-black dark:bg-white text-white dark:text-black font-semibold'
                      : 'text-[#6b7280] dark:text-[#959494] hover:bg-[#f8fafc] dark:hover:bg-white/[0.05]'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    <span>{t.label}</span>
                  </div>

                  {t.badge && (
                    <span
                      className={`text-[9px] font-mono px-1.5 py-0.2 rounded-[2px] ${
                        isActive
                          ? 'bg-neutral-800 text-white dark:bg-neutral-200 dark:text-black font-semibold'
                          : 'bg-[#f3f4f6] dark:bg-white/[0.08] text-[#6b7280] dark:text-[#959494]'
                      }`}
                    >
                      {t.badge}
                    </span>
                  )}

                  {t.count !== undefined && (
                    <span
                      className={`text-[9px] font-mono px-1.5 py-0.2 rounded-[2px] ${
                        isActive
                          ? 'bg-neutral-800 text-white dark:bg-neutral-200 dark:text-black font-semibold'
                          : 'bg-[#f3f4f6] dark:bg-white/[0.08] text-[#6b7280] dark:text-[#959494]'
                      }`}
                    >
                      {t.count}
                    </span>
                  )}
                </button>
              );
            })}

            <div className="pt-3 mt-3 border-t border-[#ebebeb] dark:border-white/[0.06] px-2 pb-1 text-[10px] font-mono text-[#959494] space-y-1">
              <div className="flex items-center space-x-1 text-emerald-500 font-semibold">
                <ShieldCheck className="w-3 h-3 shrink-0" />
                <span>AES-256-GCM VAULT</span>
              </div>
              <p className="leading-tight">
                All credentials stored encrypted at rest.
              </p>
            </div>
          </aside>

          {/* Tab Content Panel */}
          <section className="lg:col-span-9 space-y-6">
            {/* TAB 1: Outbound Mailer */}
            {activeTab === 'smtp' && (
              <div className="bg-white dark:bg-[#010120] border border-[#ebebeb] dark:border-white/[0.08] rounded-[4px] p-6">
                <div className="flex items-center justify-between pb-4 border-b border-[#ebebeb] dark:border-white/[0.08] mb-5">
                  <div>
                    <h2 className="text-base font-semibold text-black dark:text-white">Outbound SMTP Mailer</h2>
                    <p className="text-xs text-[#959494] font-mono mt-0.5">
                      Configure your authenticated SMTP sender address and Google Workspace app password.
                    </p>
                  </div>
                  <span
                    className={`text-[10px] font-mono px-2.5 py-0.5 rounded-[3px] font-semibold uppercase ${
                      smtpConfigured
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                        : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                    }`}
                  >
                    {smtpConfigured ? 'SMTP CONNECTED' : 'ACTION REQUIRED'}
                  </span>
                </div>

                <form onSubmit={handleSaveProviders} className="space-y-4 text-xs font-mono">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[#959494] uppercase mb-1">
                        SENDER EMAIL ADDRESS
                      </label>
                      <input
                        type="email"
                        placeholder="operator@company.com"
                        value={smtpEmail}
                        onChange={(e) => setSmtpEmail(e.target.value)}
                        className="w-full text-xs font-mono border border-[#ebebeb] dark:border-white/[0.08] bg-white dark:bg-[#010120] rounded-[4px] p-2.5 text-black dark:text-white focus:outline-none focus:border-black dark:focus:border-white"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-[#959494] uppercase">
                          APP PASSWORD
                        </label>
                        <button
                          type="button"
                          onClick={() => setShowSmtpPass(!showSmtpPass)}
                          className="text-[10px] text-[#ef2cc1] hover:underline flex items-center space-x-1"
                        >
                          {showSmtpPass ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                          <span>{showSmtpPass ? 'HIDE' : 'SHOW'}</span>
                        </button>
                      </div>
                      <input
                        type={showSmtpPass ? 'text' : 'password'}
                        placeholder={smtpConfigured ? '•••••••••••••••• (Leave blank to keep existing)' : '16-character app password'}
                        value={smtpAppPassword}
                        onChange={(e) => setSmtpAppPassword(e.target.value)}
                        className="w-full text-xs font-mono border border-[#ebebeb] dark:border-white/[0.08] bg-white dark:bg-[#010120] rounded-[4px] p-2.5 text-black dark:text-white focus:outline-none focus:border-black dark:focus:border-white"
                      />
                    </div>
                  </div>

                  <div className="pt-3 border-t border-[#ebebeb] dark:border-white/[0.08] flex justify-end">
                    <button
                      type="submit"
                      disabled={saving}
                      className="mono-btn bg-black dark:bg-white text-white dark:text-black px-4 py-2 rounded-[4px] text-xs font-semibold"
                    >
                      {saving ? 'SAVING...' : 'SAVE MAILER CONFIG'}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* TAB: DNS & Deliverability Pre-Flight Auditor */}
            {activeTab === 'dns' && (
              <div className="bg-white dark:bg-[#010120] border border-[#ebebeb] dark:border-white/[0.08] rounded-[4px] p-6 space-y-6">
                <div className="flex items-center justify-between pb-4 border-b border-[#ebebeb] dark:border-white/[0.08]">
                  <div>
                    <h2 className="text-base font-semibold text-black dark:text-white">
                      DNS & Deliverability Pre-Flight Auditor
                    </h2>
                    <p className="text-xs text-[#959494] font-mono mt-0.5">
                      Verify SPF, DKIM, DMARC, and MX records to avoid spam filters before launching outreach.
                    </p>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-[2px] bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 font-semibold uppercase">
                    RFC 7208 / 7489 COMPLIANT
                  </span>
                </div>

                {/* Audit Input Form */}
                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    value={dnsDomain}
                    onChange={(e) => setDnsDomain(e.target.value)}
                    placeholder="e.g. yourcompany.com"
                    className="flex-1 text-xs font-mono border border-[#ebebeb] dark:border-white/[0.08] bg-white dark:bg-[#010120] rounded-[4px] p-2.5 text-black dark:text-white focus:outline-none focus:border-black dark:focus:border-white"
                  />
                  <button
                    onClick={runDnsAudit}
                    disabled={dnsAuditing}
                    className="mono-btn px-4 py-2.5 bg-black dark:bg-white text-white dark:text-black rounded-[4px] text-xs font-semibold flex items-center space-x-1.5"
                  >
                    {dnsAuditing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Globe className="w-3.5 h-3.5" />}
                    <span>{dnsAuditing ? 'AUDITING DNS...' : 'RUN DNS AUDIT'}</span>
                  </button>
                </div>

                {/* DNS Results Grid */}
                {dnsResults && (
                  <div className="space-y-4 pt-2">
                    <div className="flex items-center justify-between p-3.5 rounded-[4px] bg-[#f8fafc] dark:bg-[#313641]/30 border border-[#ebebeb] dark:border-white/[0.08]">
                      <div>
                        <span className="font-mono text-xs uppercase font-semibold text-black dark:text-white">
                          OVERALL DELIVERABILITY SCORE: {dnsResults.score}%
                        </span>
                        <div className="text-[11px] text-[#959494] font-mono mt-0.5">
                          Domain: {dnsResults.domain}
                        </div>
                      </div>
                      <div className="w-24 h-2 bg-neutral-200 dark:bg-white/[0.1] rounded-[2px] overflow-hidden">
                        <div
                          className="bg-emerald-500 h-full rounded-[2px]"
                          style={{ width: `${dnsResults.score}%` }}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 text-xs font-mono">
                      {/* MX Check */}
                      <div className="p-3.5 rounded-[4px] border border-[#ebebeb] dark:border-white/[0.08] bg-white dark:bg-[#010120] space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-black dark:text-white">MX RECORDS</span>
                          <span className={`text-[9px] uppercase px-1.5 py-0.2 rounded-[2px] font-bold ${dnsResults.mx.valid ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                            {dnsResults.mx.valid ? 'PASSED' : 'MISSING'}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#959494]">{dnsResults.mx.message}</p>
                      </div>

                      {/* SPF Check */}
                      <div className="p-3.5 rounded-[4px] border border-[#ebebeb] dark:border-white/[0.08] bg-white dark:bg-[#010120] space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-black dark:text-white">SPF (v=spf1)</span>
                          <span className={`text-[9px] uppercase px-1.5 py-0.2 rounded-[2px] font-bold ${dnsResults.spf.valid ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                            {dnsResults.spf.valid ? 'PASSED' : 'ACTION REQUIRED'}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#959494]">{dnsResults.spf.message}</p>
                      </div>

                      {/* DMARC Check */}
                      <div className="p-3.5 rounded-[4px] border border-[#ebebeb] dark:border-white/[0.08] bg-white dark:bg-[#010120] space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-black dark:text-white">DMARC (_dmarc)</span>
                          <span className={`text-[9px] uppercase px-1.5 py-0.2 rounded-[2px] font-bold ${dnsResults.dmarc.valid ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                            {dnsResults.dmarc.valid ? 'PASSED' : 'ACTION REQUIRED'}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#959494]">{dnsResults.dmarc.message}</p>
                      </div>

                      {/* DKIM Check */}
                      <div className="p-3.5 rounded-[4px] border border-[#ebebeb] dark:border-white/[0.08] bg-white dark:bg-[#010120] space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-black dark:text-white">DKIM (resend._domainkey)</span>
                          <span className={`text-[9px] uppercase px-1.5 py-0.2 rounded-[2px] font-bold ${dnsResults.dkim.valid ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                            {dnsResults.dkim.valid ? 'PASSED' : 'CHECK PROVIDER'}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#959494]">{dnsResults.dkim.message}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB: Webhooks & Inbound Automated Handlers */}
            {activeTab === 'webhooks' && (
              <div className="bg-white dark:bg-[#010120] border border-[#ebebeb] dark:border-white/[0.08] rounded-[4px] p-6 space-y-5 text-xs font-mono">
                <div className="pb-4 border-b border-[#ebebeb] dark:border-white/[0.08]">
                  <h2 className="text-base font-semibold text-black dark:text-white">
                    Webhook Endpoints & Inbound Reply Handlers
                  </h2>
                  <p className="text-[#959494] mt-0.5">
                    Connect Resend and email providers to automate hard-bounce suppression, spam complaint blocks, and AI sentiment analysis.
                  </p>
                </div>

                {/* Resend Webhook */}
                <div className="p-4 rounded-[4px] border border-[#ebebeb] dark:border-white/[0.08] bg-white dark:bg-[#010120] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-black dark:text-white uppercase">
                      RESEND DELIVERY & BOUNCE WEBHOOK
                    </span>
                    <button
                      onClick={() => copyToClipboard('/api/webhooks/resend', 'resend')}
                      className="text-[10px] text-[#ef2cc1] hover:underline flex items-center space-x-1"
                    >
                      <Copy className="w-3 h-3" />
                      <span>{copiedWebhook === 'resend' ? 'COPIED!' : 'COPY PATH'}</span>
                    </button>
                  </div>
                  <code className="block p-2 bg-[#f8fafc] dark:bg-[#313641]/30 rounded-[3px] text-[#6b7280] dark:text-[#959494]">
                    https://your-domain.com/api/webhooks/resend
                  </code>
                  <p className="text-[11px] text-[#959494]">
                    Events handled: <strong className="text-black dark:text-white">email.bounced</strong> (auto-suppress), <strong className="text-black dark:text-white">email.complained</strong> (auto-block), <strong className="text-black dark:text-white">email.delivered</strong>.
                  </p>
                </div>

                {/* Inbound Reply Webhook */}
                <div className="p-4 rounded-[4px] border border-[#ebebeb] dark:border-white/[0.08] bg-white dark:bg-[#010120] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-black dark:text-white uppercase">
                      INBOUND PROSPECT REPLY WEBHOOK (AI SENTIMENT)
                    </span>
                    <button
                      onClick={() => copyToClipboard('/api/webhooks/inbound', 'inbound')}
                      className="text-[10px] text-[#ef2cc1] hover:underline flex items-center space-x-1"
                    >
                      <Copy className="w-3 h-3" />
                      <span>{copiedWebhook === 'inbound' ? 'COPIED!' : 'COPY PATH'}</span>
                    </button>
                  </div>
                  <code className="block p-2 bg-[#f8fafc] dark:bg-[#313641]/30 rounded-[3px] text-[#6b7280] dark:text-[#959494]">
                    https://your-domain.com/api/webhooks/inbound
                  </code>
                  <p className="text-[11px] text-[#959494]">
                    Uses Gemini 1.5 Flash to classify replies into <strong className="text-black dark:text-white">INTERESTED</strong> (hot lead alert), <strong className="text-black dark:text-white">UNSUBSCRIBE</strong> (auto-block), or <strong className="text-black dark:text-white">OUT_OF_OFFICE</strong>.
                  </p>
                </div>
              </div>
            )}

            {/* TAB: Audit Trail Stream */}
            {activeTab === 'audit' && (
              <div className="bg-white dark:bg-[#010120] border border-[#ebebeb] dark:border-white/[0.08] rounded-[4px] p-6 space-y-5 text-xs font-mono">
                <div className="flex items-center justify-between pb-4 border-b border-[#ebebeb] dark:border-white/[0.08]">
                  <div>
                    <h2 className="text-base font-semibold text-black dark:text-white">
                      Immutable Audit Trail
                    </h2>
                    <p className="text-[#959494] mt-0.5">
                      Cryptographically-ordered log recording all dispatch actions, approvals, API modifications, and system events.
                    </p>
                  </div>
                  <button
                    onClick={fetchAuditLogs}
                    className="text-[10px] text-[#ef2cc1] hover:underline flex items-center space-x-1"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>REFRESH</span>
                  </button>
                </div>

                {loadingAudit ? (
                  <div className="py-12 text-center text-[#959494]">Loading audit log stream...</div>
                ) : auditLogs.length === 0 ? (
                  <div className="py-12 text-center text-[#959494] border border-[#ebebeb] dark:border-white/[0.06] rounded-[4px]">
                    No audit records logged yet. Actions like approvals, settings updates, and dispatches will stream here.
                  </div>
                ) : (
                  <div className="border border-[#ebebeb] dark:border-white/[0.08] rounded-[4px] overflow-hidden">
                    <table className="w-full text-left">
                      <thead className="bg-[#f8fafc] dark:bg-[#313641]/30 border-b border-[#ebebeb] dark:border-white/[0.08] text-[#959494]">
                        <tr>
                          <th className="py-2.5 px-3 font-semibold">ACTION</th>
                          <th className="py-2.5 px-3 font-semibold">ACTOR</th>
                          <th className="py-2.5 px-3 font-semibold">ENTITY</th>
                          <th className="py-2.5 px-3 text-right font-semibold">TIMESTAMP</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#ebebeb] dark:divide-white/[0.06]">
                        {auditLogs.map((log) => (
                          <tr key={log.id} className="hover:bg-[#f8fafc] dark:hover:bg-white/[0.02] transition">
                            <td className="py-2.5 px-3">
                              <span className="px-1.5 py-0.5 rounded-[2px] bg-black dark:bg-white text-white dark:text-black font-semibold text-[10px]">
                                {log.action}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-black dark:text-white">
                              {log.actorEmail}
                            </td>
                            <td className="py-2.5 px-3 text-[#959494]">
                              {log.entityType}
                            </td>
                            <td className="py-2.5 px-3 text-right text-[#959494]">
                              {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* TAB: AI Reasoning */}
            {activeTab === 'ai' && (
              <div className="bg-white dark:bg-[#010120] border border-[#ebebeb] dark:border-white/[0.08] rounded-[4px] p-6 space-y-4 text-xs font-mono">
                <div className="flex items-center justify-between pb-4 border-b border-[#ebebeb] dark:border-white/[0.08]">
                  <div>
                    <h2 className="text-base font-semibold text-black dark:text-white">AI Reasoning Engine</h2>
                    <p className="text-[#959494] mt-0.5">
                      Gemini 1.5 Flash generates tailored outreach hooks and analyzes prospect sentiment.
                    </p>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-[2px] bg-emerald-500/10 text-emerald-500 font-semibold uppercase">
                    ACTIVE
                  </span>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-[#959494] uppercase mb-1">AI MODEL</label>
                    <select
                      value={aiModel}
                      onChange={(e) => setAiModel(e.target.value)}
                      className="w-full text-xs font-mono border border-[#ebebeb] dark:border-white/[0.08] bg-white dark:bg-[#010120] rounded-[4px] p-2.5 text-black dark:text-white"
                    >
                      <option value="gemini-1.5-flash">Gemini 1.5 Flash (Ultra-Fast & Free Tier Included)</option>
                      <option value="gemini-1.5-pro">Gemini 1.5 Pro (Deep Research)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[#959494] uppercase mb-1">API KEY</label>
                    <input
                      type="password"
                      placeholder={aiKeyConfigured ? '•••••••••••••••• (Configured via env or vault)' : 'AIzaSy...'}
                      value={aiApiKey}
                      onChange={(e) => setAiApiKey(e.target.value)}
                      className="w-full text-xs font-mono border border-[#ebebeb] dark:border-white/[0.08] bg-white dark:bg-[#010120] rounded-[4px] p-2.5 text-black dark:text-white"
                    />
                  </div>
                </div>

                <div className="pt-3 border-t border-[#ebebeb] dark:border-white/[0.08] flex justify-end">
                  <button
                    onClick={() => handleSaveProviders()}
                    className="mono-btn bg-black dark:bg-white text-white dark:text-black px-4 py-2 rounded-[4px] text-xs font-semibold"
                  >
                    SAVE AI SETTINGS
                  </button>
                </div>
              </div>
            )}

            {/* TAB: Lead Enrichment */}
            {activeTab === 'enrichment' && (
              <div className="bg-white dark:bg-[#010120] border border-[#ebebeb] dark:border-white/[0.08] rounded-[4px] p-6 space-y-4 text-xs font-mono">
                <div className="flex items-center justify-between pb-4 border-b border-[#ebebeb] dark:border-white/[0.08]">
                  <div>
                    <h2 className="text-base font-semibold text-black dark:text-white">Lead Enrichment Engine</h2>
                    <p className="text-[#959494] mt-0.5">
                      100% Free multi-method pipeline probing public pages, Gemini classification, and DNS MX deliverability.
                    </p>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-[2px] bg-emerald-500/10 text-emerald-500 font-semibold uppercase">
                    100% FREE DEFAULT
                  </span>
                </div>

                <div className="p-3.5 rounded-[4px] bg-[#f8fafc] dark:bg-[#313641]/20 border border-[#ebebeb] dark:border-white/[0.08] space-y-2">
                  <span className="font-semibold text-black dark:text-white uppercase">
                    ACTIVE ENRICHMENT PIPELINE
                  </span>
                  <div className="space-y-1 text-[#6b7280] dark:text-[#959494]">
                    <div>✓ Method 1: Deep Web Crawler probing /contact, /about, /team, /privacy-policy</div>
                    <div>✓ Method 3: Gemini 1.5 Flash AI Pattern Deduction</div>
                    <div>✓ Method 4: DNS MX Deliverability & Catch-All Verification</div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB: Suppression Registry */}
            {activeTab === 'suppression' && (
              <div className="bg-white dark:bg-[#010120] border border-[#ebebeb] dark:border-white/[0.08] rounded-[4px] p-6 space-y-5 text-xs font-mono">
                <div className="flex items-center justify-between pb-4 border-b border-[#ebebeb] dark:border-white/[0.08]">
                  <div>
                    <h2 className="text-base font-semibold text-black dark:text-white">Global Suppression Registry</h2>
                    <p className="text-[#959494] mt-0.5">
                      Mandatory suppression list blocking unwanted domains, unsubscriptions, and hard bounces.
                    </p>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-[2px] bg-black dark:bg-white text-white dark:text-black font-semibold uppercase">
                    {suppressions.length} BLOCKED
                  </span>
                </div>

                {/* Add Block Form */}
                <form onSubmit={handleAddSuppression} className="flex gap-2">
                  <input
                    type="text"
                    required
                    placeholder="email@example.com or @domain.com"
                    value={newSuppressionEmail}
                    onChange={(e) => setNewSuppressionEmail(e.target.value)}
                    className="flex-1 p-2.5 rounded-[4px] border border-[#ebebeb] dark:border-white/[0.08] bg-white dark:bg-[#010120] text-black dark:text-white"
                  />
                  <button
                    type="submit"
                    className="mono-btn bg-black dark:bg-white text-white dark:text-black px-4 py-2.5 rounded-[4px] font-semibold"
                  >
                    ADD BLOCK
                  </button>
                </form>

                {/* Table */}
                <div className="border border-[#ebebeb] dark:border-white/[0.08] rounded-[4px] overflow-hidden">
                  <table className="w-full text-left">
                    <thead className="bg-[#f8fafc] dark:bg-[#313641]/30 border-b border-[#ebebeb] dark:border-white/[0.08] text-[#959494]">
                      <tr>
                        <th className="py-2 px-3 font-semibold">ENTRY</th>
                        <th className="py-2 px-3 font-semibold">REASON</th>
                        <th className="py-2 px-3 text-right font-semibold">ACTION</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#ebebeb] dark:divide-white/[0.06]">
                      {filteredSuppressions.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="py-6 text-center text-[#959494]">
                            No suppression entries found.
                          </td>
                        </tr>
                      ) : (
                        filteredSuppressions.map((s) => (
                          <tr key={s.id}>
                            <td className="py-2.5 px-3 text-black dark:text-white">
                              {s.normalized_email || s.normalized_value}
                            </td>
                            <td className="py-2.5 px-3 text-[#959494]">
                              {s.reason || 'manual_block'}
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <button
                                onClick={() => handleDeleteSuppression(s.id)}
                                className="text-rose-500 hover:underline"
                              >
                                REMOVE
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
