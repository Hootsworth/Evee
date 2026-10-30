'use client';

import { useState, useEffect } from 'react';
import { Mail, Sparkles, Key, ShieldCheck, Check, AlertCircle, Save, Plus, Trash2, Eye, EyeOff, Search } from 'lucide-react';

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'smtp' | 'ai' | 'places' | 'suppression'>('smtp');
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Show/Hide password toggles
  const [showSmtpPass, setShowSmtpPass] = useState(false);
  const [showAiKey, setShowAiKey] = useState(false);
  const [showPlacesKey, setShowPlacesKey] = useState(false);

  // SMTP App Password state
  const [smtpEmail, setSmtpEmail] = useState('');
  const [smtpAppPassword, setSmtpAppPassword] = useState('');
  const [smtpConfigured, setSmtpConfigured] = useState(false);

  // AI Provider & Model state
  const [aiProvider, setAiProvider] = useState<'openai' | 'gemini' | 'meta'>('gemini');
  const [aiModel, setAiModel] = useState('Gemini 3.6 flash');
  const [aiApiKey, setAiApiKey] = useState('');
  const [aiKeyConfigured, setAiKeyConfigured] = useState(false);

  // Google Places Discovery key state
  const [placesApiKey, setPlacesApiKey] = useState('');
  const [placesKeyConfigured, setPlacesKeyConfigured] = useState(false);

  // Global suppression state
  const [suppressions, setSuppressions] = useState<any[]>([]);
  const [newSuppressionEmail, setNewSuppressionEmail] = useState('');
  const [newSuppressionReason, setNewSuppressionReason] = useState('manual_block');
  const [suppressionSearch, setSuppressionSearch] = useState('');

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
        }
      }

      if (supRes.ok) {
        const supData = await supRes.json();
        setSuppressions(supData.entries || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

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
        fetchSettings();
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
          value: newSuppressionEmail.trim().toLowerCase(),
          type: 'email',
          reason: newSuppressionReason,
        }),
      });

      if (res.ok) {
        setNewSuppressionEmail('');
        fetchSettings();
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

  const filteredSuppressions = suppressions.filter((s) => {
    const val = s.normalized_email || s.normalized_phone || s.normalized_value || '';
    return val.toLowerCase().includes(suppressionSearch.toLowerCase());
  });

  const tabs = [
    { id: 'smtp', label: 'Outbound Mailer', icon: Mail, badge: smtpConfigured ? 'Connected' : 'Setup' },
    { id: 'ai', label: 'AI Reasoning', icon: Sparkles, badge: aiKeyConfigured ? 'Active' : 'Key Required' },
    { id: 'places', label: 'Places Discovery', icon: Key, badge: placesKeyConfigured ? 'Live API' : 'Simulation' },
    { id: 'suppression', label: 'Suppression Registry', icon: ShieldCheck, count: suppressions.length },
  ];

  return (
    <div className="min-h-screen bg-white dark:bg-[#09090b] transition-colors duration-150">
      {/* Top Banner: Flat & Clean */}
      <section className="bg-[#f8fafc] dark:bg-gradient-to-b dark:from-[#0e1017] dark:via-[#0c0d14] dark:to-[#090a0f] border-b border-[#e5e7eb] dark:border-white/[0.08] px-6 py-10">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-light tracking-tight text-[#111827] dark:text-white">Settings & Credentials</h1>
            <p className="text-sm text-[#6b7280] dark:text-[#a1a1aa] mt-1 max-w-xl font-light">
              Manage your authenticated outbound mailer, LLM providers, Places discovery keys, and global suppression rules.
            </p>
          </div>

          <button
            onClick={() => handleSaveProviders()}
            disabled={saving}
            className="mono-btn bg-[#f43f5e] hover:bg-[#e11d48] text-white px-5 py-2.5 rounded-full text-xs font-normal transition flex items-center space-x-2 shadow-sm active:scale-95 self-start sm:self-auto"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{saving ? 'ENCRYPTING...' : 'SAVE ALL CHANGES'}</span>
          </button>
        </div>
      </section>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-6 py-10">
        {/* Feedback message banner */}
        {message && (
          <div
            className={`mb-6 p-4 rounded-xl border text-xs font-mono flex items-center space-x-2.5 ${
              message.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                : 'bg-rose-50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300'
            }`}
          >
            {message.type === 'success' ? (
              <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
            )}
            <span>{message.text}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Navigation Sidebar */}
          <aside className="lg:col-span-3 space-y-1 bg-white dark:bg-[#121217] p-2 rounded-2xl border border-[#e5e7eb] dark:border-[#27272a] shadow-sm">
            {tabs.map((t) => {
              const Icon = t.icon;
              const isActive = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id as any)}
                  className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-normal transition-all flex items-center justify-between ${
                    isActive
                      ? 'bg-[#111827] dark:bg-white text-white dark:text-[#111827] shadow-sm'
                      : 'text-[#4b5563] dark:text-[#a1a1aa] hover:bg-[#f8fafc] dark:hover:bg-[#18181b]'
                  }`}
                >
                  <div className="flex items-center space-x-2.5">
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{t.label}</span>
                  </div>

                  {t.badge && (
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
                        isActive
                          ? 'bg-white/20 dark:bg-[#111827]/15 text-white dark:text-[#111827]'
                          : t.badge === 'Connected' || t.badge === 'Active'
                          ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                          : 'bg-[#f3f4f6] dark:bg-[#18181b] text-[#6b7280] dark:text-[#a1a1aa]'
                      }`}
                    >
                      {t.badge}
                    </span>
                  )}

                  {t.count !== undefined && (
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
                        isActive
                          ? 'bg-white/20 dark:bg-[#111827]/15 text-white dark:text-[#111827]'
                          : 'bg-[#f3f4f6] dark:bg-[#18181b] text-[#6b7280] dark:text-[#a1a1aa]'
                      }`}
                    >
                      {t.count}
                    </span>
                  )}
                </button>
              );
            })}

            <div className="pt-4 mt-4 border-t border-[#f3f4f6] dark:border-[#1f1f23] px-3 pb-2 text-[11px] font-mono text-[#9ca3af] dark:text-[#71717a] space-y-1">
              <div className="flex items-center space-x-1.5 text-emerald-600 dark:text-emerald-400">
                <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                <span>AES-256-GCM VAULT</span>
              </div>
              <p className="text-[10px] leading-relaxed">
                Tokens & passwords are encrypted at rest with hardware-accelerated GCM ciphers.
              </p>
            </div>
          </aside>

          {/* Main Content Area */}
          <section className="lg:col-span-9 space-y-6">
            {/* TAB 1: Outbound Mailer (Google App Passwords) */}
            {activeTab === 'smtp' && (
              <div className="bg-white dark:bg-[#121217] border border-[#e5e7eb] dark:border-[#27272a] rounded-2xl p-6 sm:p-8 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-6 border-b border-[#f3f4f6] dark:border-[#1f1f23] mb-6">
                  <div>
                    <h2 className="text-xl font-light text-[#111827] dark:text-white">Outbound Email Dispatch</h2>
                    <p className="text-xs text-[#6b7280] dark:text-[#a1a1aa] font-mono mt-1 font-light">
                      Transmit personalized outreach directly from your Google Workspace or Gmail inbox.
                    </p>
                  </div>
                  <span
                    className={`self-start sm:self-auto text-[10px] font-mono px-3 py-1 rounded-full font-normal ${
                      smtpConfigured
                        ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                        : 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                    }`}
                  >
                    {smtpConfigured ? 'SMTP CONNECTED' : 'ACTION REQUIRED'}
                  </span>
                </div>

                <form onSubmit={handleSaveProviders} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="mono-eyebrow text-[#6b7280] dark:text-[#a1a1aa] font-normal block mb-1.5">
                        SENDER EMAIL ADDRESS
                      </label>
                      <input
                        type="email"
                        placeholder="operator@company.com"
                        value={smtpEmail}
                        onChange={(e) => setSmtpEmail(e.target.value)}
                        className="w-full text-xs font-mono border border-[#e5e7eb] dark:border-[#27272a] bg-white dark:bg-[#18181b] rounded-xl p-3 focus:outline-none focus:border-[#f43f5e] focus:ring-1 focus:ring-rose-500/20 text-[#111827] dark:text-white font-light"
                      />
                      <p className="text-[11px] text-[#9ca3af] dark:text-[#71717a] mt-1.5 font-mono">
                        The "From" address verified on your email account.
                      </p>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="mono-eyebrow text-[#6b7280] dark:text-[#a1a1aa] font-normal">
                          GOOGLE 16-CHAR APP PASSWORD
                        </label>
                        <button
                          type="button"
                          onClick={() => setShowSmtpPass(!showSmtpPass)}
                          className="text-[10px] font-mono text-[#f43f5e] hover:underline flex items-center space-x-1"
                        >
                          {showSmtpPass ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                          <span>{showSmtpPass ? 'HIDE' : 'SHOW'}</span>
                        </button>
                      </div>
                      <div className="relative">
                        <input
                          type={showSmtpPass ? 'text' : 'password'}
                          placeholder={smtpConfigured ? '•••••••••••••••• (Leave blank to keep existing)' : 'abcd efgh ijkl mnop'}
                          value={smtpAppPassword}
                          onChange={(e) => setSmtpAppPassword(e.target.value)}
                          className="w-full text-xs font-mono border border-[#e5e7eb] dark:border-[#27272a] bg-white dark:bg-[#18181b] rounded-xl p-3 focus:outline-none focus:border-[#f43f5e] focus:ring-1 focus:ring-rose-500/20 text-[#111827] dark:text-white font-light"
                        />
                      </div>
                      <p className="text-[11px] text-[#9ca3af] dark:text-[#71717a] mt-1.5 font-mono">
                        Generated in Google Account → Security → 2-Step Verification → App Passwords.
                      </p>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-[#f3f4f6] dark:border-[#1f1f23] flex justify-end">
                    <button
                      type="submit"
                      disabled={saving}
                      className="mono-btn bg-[#111827] dark:bg-white text-white dark:text-[#111827] hover:bg-black dark:hover:bg-zinc-200 px-5 py-2.5 rounded-full text-xs font-normal shadow-sm transition active:scale-95"
                    >
                      {saving ? 'ENCRYPTING & PERSISTING...' : 'SAVE MAILER CONFIG'}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* TAB 2: AI Reasoning & Inference */}
            {activeTab === 'ai' && (
              <div className="bg-white dark:bg-[#121217] border border-[#e5e7eb] dark:border-[#27272a] rounded-2xl p-6 sm:p-8 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-6 border-b border-[#f3f4f6] dark:border-[#1f1f23] mb-6">
                  <div>
                    <h2 className="text-xl font-light text-[#111827] dark:text-white">AI Reasoning & Copywriting</h2>
                    <p className="text-xs text-[#6b7280] dark:text-[#a1a1aa] font-mono mt-1 font-light">
                      LLM providers used for analyzing website observations and drafting personalized proposals.
                    </p>
                  </div>
                  <span
                    className={`self-start sm:self-auto text-[10px] font-mono px-3 py-1 rounded-full font-normal ${
                      aiKeyConfigured
                        ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                        : 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                    }`}
                  >
                    {aiKeyConfigured ? 'API KEY PRESENT' : 'KEY REQUIRED'}
                  </span>
                </div>

                <form onSubmit={handleSaveProviders} className="space-y-6">
                  {/* Provider Radio Cards */}
                  <div>
                    <label className="mono-eyebrow text-[#6b7280] dark:text-[#a1a1aa] font-normal block mb-2.5">
                      ACTIVE PROVIDER
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {[
                        { id: 'gemini', name: 'Google Gemini', defaultModel: 'Gemini 3.6 flash', desc: 'Fast, structured, multimodal' },
                        { id: 'openai', name: 'OpenAI', defaultModel: 'ChatGPT 5.6 Mini', desc: 'Reasoning, crisp prose' },
                        { id: 'meta', name: 'Meta Llama', defaultModel: 'Meta Muse Spark 1.3', desc: 'Open architecture, high speed' },
                      ].map((p) => {
                        const isSelected = aiProvider === p.id;
                        return (
                          <div
                            key={p.id}
                            onClick={() => {
                              setAiProvider(p.id as any);
                              setAiModel(p.defaultModel);
                            }}
                            className={`cursor-pointer rounded-xl p-4 border transition-all ${
                              isSelected
                                ? 'border-[#f43f5e] bg-[#fff1f2]/30 dark:bg-[#f43f5e]/10 shadow-sm'
                                : 'border-[#e5e7eb] dark:border-[#27272a] hover:bg-[#f8fafc] dark:hover:bg-[#18181b]'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className={`text-xs font-normal ${isSelected ? 'text-[#f43f5e] font-medium' : 'text-[#111827] dark:text-white'}`}>
                                {p.name}
                              </span>
                              <div
                                className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                                  isSelected ? 'border-[#f43f5e] bg-[#f43f5e]' : 'border-[#d1d5db] dark:border-[#3f3f46]'
                                }`}
                              >
                                {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                              </div>
                            </div>
                            <p className="text-[11px] text-[#6b7280] dark:text-[#a1a1aa] font-light">{p.desc}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Model spec & API Key */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="mono-eyebrow text-[#6b7280] dark:text-[#a1a1aa] font-normal block mb-1.5">
                        MODEL IDENTIFIER
                      </label>
                      <input
                        type="text"
                        value={aiModel}
                        onChange={(e) => setAiModel(e.target.value)}
                        className="w-full text-xs font-mono border border-[#e5e7eb] dark:border-[#27272a] bg-white dark:bg-[#18181b] rounded-xl p-3 focus:outline-none focus:border-[#f43f5e] focus:ring-1 focus:ring-rose-500/20 text-[#111827] dark:text-white font-light"
                      />
                      <p className="text-[11px] text-[#9ca3af] dark:text-[#71717a] mt-1.5 font-mono">
                        Target model version used for prompt chains.
                      </p>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="mono-eyebrow text-[#6b7280] dark:text-[#a1a1aa] font-normal">
                          API TOKEN (AES-256-GCM)
                        </label>
                        <button
                          type="button"
                          onClick={() => setShowAiKey(!showAiKey)}
                          className="text-[10px] font-mono text-[#f43f5e] hover:underline flex items-center space-x-1"
                        >
                          {showAiKey ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                          <span>{showAiKey ? 'HIDE' : 'SHOW'}</span>
                        </button>
                      </div>
                      <div className="relative">
                        <input
                          type={showAiKey ? 'text' : 'password'}
                          placeholder={aiKeyConfigured ? '•••••••••••••••• (Leave blank to keep existing)' : 'Enter API Key'}
                          value={aiApiKey}
                          onChange={(e) => setAiApiKey(e.target.value)}
                          className="w-full text-xs font-mono border border-[#e5e7eb] dark:border-[#27272a] bg-white dark:bg-[#18181b] rounded-xl p-3 focus:outline-none focus:border-[#f43f5e] focus:ring-1 focus:ring-rose-500/20 text-[#111827] dark:text-white font-light"
                        />
                      </div>
                      <p className="text-[11px] text-[#9ca3af] dark:text-[#71717a] mt-1.5 font-mono">
                        Your proprietary provider key. Stored encrypted at rest.
                      </p>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-[#f3f4f6] dark:border-[#1f1f23] flex justify-end">
                    <button
                      type="submit"
                      disabled={saving}
                      className="mono-btn bg-[#111827] dark:bg-white text-white dark:text-[#111827] hover:bg-black dark:hover:bg-zinc-200 px-5 py-2.5 rounded-full text-xs font-normal shadow-sm transition active:scale-95"
                    >
                      {saving ? 'ENCRYPTING & PERSISTING...' : 'SAVE AI CONFIG'}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* TAB 3: Google Places Discovery */}
            {activeTab === 'places' && (
              <div className="bg-white dark:bg-[#121217] border border-[#e5e7eb] dark:border-[#27272a] rounded-2xl p-6 sm:p-8 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-6 border-b border-[#f3f4f6] dark:border-[#1f1f23] mb-6">
                  <div>
                    <h2 className="text-xl font-light text-[#111827] dark:text-white">Google Places Discovery Engine</h2>
                    <p className="text-xs text-[#6b7280] dark:text-[#a1a1aa] font-mono mt-1 font-light">
                      Crawls real-world small business listings, verified phone numbers, and official domains.
                    </p>
                  </div>
                  <span
                    className={`self-start sm:self-auto text-[10px] font-mono px-3 py-1 rounded-full font-normal ${
                      placesKeyConfigured
                        ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                        : 'bg-[#f3f4f6] dark:bg-[#18181b] text-[#6b7280] dark:text-[#a1a1aa]'
                    }`}
                  >
                    {placesKeyConfigured ? 'LIVE DISCOVERY ACTIVE' : 'MOCK PROVIDER ACTIVE'}
                  </span>
                </div>

                <form onSubmit={handleSaveProviders} className="space-y-6">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="mono-eyebrow text-[#6b7280] dark:text-[#a1a1aa] font-normal">
                        GOOGLE CLOUD PLACES API KEY
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowPlacesKey(!showPlacesKey)}
                        className="text-[10px] font-mono text-[#f43f5e] hover:underline flex items-center space-x-1"
                      >
                        {showPlacesKey ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                        <span>{showPlacesKey ? 'HIDE' : 'SHOW'}</span>
                      </button>
                    </div>
                    <div className="relative">
                      <input
                        type={showPlacesKey ? 'text' : 'password'}
                        placeholder={placesKeyConfigured ? '•••••••••••••••• (Leave blank to keep existing)' : 'AIzaSy...'}
                        value={placesApiKey}
                        onChange={(e) => setPlacesApiKey(e.target.value)}
                        className="w-full text-xs font-mono border border-[#e5e7eb] dark:border-[#27272a] bg-white dark:bg-[#18181b] rounded-xl p-3 focus:outline-none focus:border-[#f43f5e] focus:ring-1 focus:ring-rose-500/20 text-[#111827] dark:text-white font-light"
                      />
                    </div>
                    <p className="text-[11px] text-[#9ca3af] dark:text-[#71717a] mt-1.5 font-mono">
                      Obtained from Google Cloud Console with Places API (New) enabled. If blank, Evee safely simulates candidates.
                    </p>
                  </div>

                  <div className="pt-4 border-t border-[#f3f4f6] dark:border-[#1f1f23] flex justify-end">
                    <button
                      type="submit"
                      disabled={saving}
                      className="mono-btn bg-[#111827] dark:bg-white text-white dark:text-[#111827] hover:bg-black dark:hover:bg-zinc-200 px-5 py-2.5 rounded-full text-xs font-normal shadow-sm transition active:scale-95"
                    >
                      {saving ? 'ENCRYPTING & PERSISTING...' : 'SAVE PLACES KEY'}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* TAB 4: Suppression Registry */}
            {activeTab === 'suppression' && (
              <div className="bg-white dark:bg-[#121217] border border-[#e5e7eb] dark:border-[#27272a] rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-6 border-b border-[#f3f4f6] dark:border-[#1f1f23]">
                  <div>
                    <h2 className="text-xl font-light text-[#111827] dark:text-white">Global Suppression Registry</h2>
                    <p className="text-xs text-[#6b7280] dark:text-[#a1a1aa] font-mono mt-1 font-light">
                      Enforce unconditional opt-outs. Automated sending fails closed against these entries.
                    </p>
                  </div>
                  <span className="self-start sm:self-auto text-[10px] font-mono px-3 py-1 rounded-full font-normal bg-[#f3f4f6] dark:bg-[#18181b] text-[#111827] dark:text-white border border-[#e5e7eb] dark:border-[#27272a]">
                    {suppressions.length} BLOCKED CONTACTS
                  </span>
                </div>

                {/* Quick Add Form */}
                <form onSubmit={handleAddSuppression} className="flex flex-col sm:flex-row gap-3">
                  <input
                    type="text"
                    required
                    placeholder="email@example.com or domain.com"
                    value={newSuppressionEmail}
                    onChange={(e) => setNewSuppressionEmail(e.target.value)}
                    className="flex-1 text-xs font-mono border border-[#e5e7eb] dark:border-[#27272a] bg-white dark:bg-[#18181b] rounded-full px-4 py-2.5 focus:outline-none focus:border-[#f43f5e] text-[#111827] dark:text-white font-light"
                  />
                  <select
                    value={newSuppressionReason}
                    onChange={(e) => setNewSuppressionReason(e.target.value)}
                    className="text-xs font-mono border border-[#e5e7eb] dark:border-[#27272a] bg-white dark:bg-[#18181b] rounded-full px-3 py-2.5 focus:outline-none focus:border-[#f43f5e] text-[#111827] dark:text-white font-light"
                  >
                    <option value="manual_block">Manual Operator Block</option>
                    <option value="user_optout">Recipient Unsubscribed</option>
                    <option value="competitor">Competitor Exclude</option>
                    <option value="bounce">Hard Bounced</option>
                  </select>
                  <button
                    type="submit"
                    className="mono-btn bg-[#f43f5e] hover:bg-[#e11d48] text-white px-5 py-2.5 rounded-full text-xs font-normal flex items-center justify-center space-x-1.5 shadow-sm active:scale-95"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>ADD BLOCK</span>
                  </button>
                </form>

                {/* Filter and Table */}
                <div className="space-y-3 pt-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-[#9ca3af] dark:text-[#71717a] absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Filter suppression list..."
                      value={suppressionSearch}
                      onChange={(e) => setSuppressionSearch(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 text-xs font-mono border border-[#e5e7eb] dark:border-[#27272a] bg-white dark:bg-[#18181b] rounded-full focus:outline-none focus:border-[#f43f5e] text-[#111827] dark:text-white font-light"
                    />
                  </div>

                  <div className="border border-[#e5e7eb] dark:border-[#27272a] rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs font-mono">
                      <thead className="bg-[#f8fafc] dark:bg-[#18181b] border-b border-[#e5e7eb] dark:border-[#27272a] text-[#6b7280] dark:text-[#a1a1aa]">
                        <tr>
                          <th className="py-2.5 px-4 font-normal">ENTRY</th>
                          <th className="py-2.5 px-4 font-normal">REASON</th>
                          <th className="py-2.5 px-4 font-normal">DATE ADDED</th>
                          <th className="py-2.5 px-4 font-normal text-right">ACTION</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#f3f4f6] dark:divide-[#27272a]">
                        {filteredSuppressions.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="py-6 text-center text-[#9ca3af] dark:text-[#71717a] font-light">
                              No entries match your search criteria.
                            </td>
                          </tr>
                        ) : (
                          filteredSuppressions.map((s) => (
                            <tr key={s.id} className="hover:bg-[#f8fafc] dark:hover:bg-[#18181b] transition">
                              <td className="py-3 px-4 font-normal text-[#111827] dark:text-white">
                                {s.normalized_email || s.normalized_phone || s.normalized_value}
                              </td>
                              <td className="py-3 px-4 text-[#6b7280] dark:text-[#a1a1aa] font-light">
                                <span className="bg-[#f3f4f6] dark:bg-[#27272a] px-2 py-0.5 rounded text-[10px]">
                                  {s.reason || 'manual_block'}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-[#9ca3af] dark:text-[#71717a] font-light">
                                {new Date(s.created_at).toLocaleDateString()}
                              </td>
                              <td className="py-3 px-4 text-right">
                                <button
                                  onClick={() => handleDeleteSuppression(s.id)}
                                  title="Remove from suppression"
                                  className="text-[#9ca3af] hover:text-[#f43f5e] p-1 transition"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
