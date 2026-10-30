'use client';

import { useState, useEffect } from 'react';
import { Mail, Sparkles, Key, ShieldCheck, Check, AlertCircle, Save, Plus } from 'lucide-react';

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

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

  const handleSaveProviders = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch('/api/settings/providers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          smtpEmail: smtpEmail || undefined,
          smtpAppPassword: smtpAppPassword || undefined,
          aiProvider,
          aiModel,
          aiApiKey: aiApiKey || undefined,
          placesApiKey: placesApiKey || undefined,
        }),
      });

      const json = await res.json();
      if (res.ok) {
        setMessage({ text: 'Configuration saved & encrypted at rest successfully.', type: 'success' });
        setSmtpAppPassword('');
        setAiApiKey('');
        setPlacesApiKey('');
        fetchSettings();
      } else {
        setMessage({ text: json.error || 'Failed to save configuration', type: 'error' });
      }
    } catch (err: any) {
      setMessage({ text: `Network error: ${err.message}`, type: 'error' });
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
        body: JSON.stringify({ email: newSuppressionEmail, reason: 'manual_block' }),
      });
      if (res.ok) {
        setNewSuppressionEmail('');
        fetchSettings();
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      {/* Header */}
      <div className="mb-8 pb-6 border-b border-black/[0.08]">
        <div className="mono-eyebrow text-black/50 mb-1">CONFIGURATION & SECURITY VAULT</div>
        <h1 className="text-3xl font-medium tracking-tight text-black">Settings & Provider Integrations</h1>
        <p className="text-sm text-black/60 mt-1">
          Configure Google App Passwords for live outreach, live AI models (Gemini / OpenAI / Meta), and API keys. All keys are encrypted at rest with AES-256-GCM.
        </p>
      </div>

      {message && (
        <div className={`mb-8 p-4 rounded-[4px] text-xs font-mono flex items-center justify-between ${
          message.type === 'success' ? 'bg-black text-white' : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          <span>{message.text}</span>
          <button onClick={() => setMessage(null)} className="ml-4 opacity-70 hover:opacity-100">✕</button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Column: Live Integrations Form */}
        <form onSubmit={handleSaveProviders} className="space-y-6">
          {/* Section 1: Live Email Sending via App Passwords */}
          <div className="border border-black/[0.08] rounded-[4px] p-6 bg-white">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <Mail className="w-5 h-5 text-[#ef2cc1]" />
                <h3 className="text-base font-semibold text-black">Live Email Sending (Google App Passwords)</h3>
              </div>
              <span className={`mono-eyebrow text-[10px] px-2 py-0.5 rounded-[4px] ${
                smtpConfigured ? 'bg-emerald-100 text-emerald-800' : 'bg-black/5 text-black/50'
              }`}>
                {smtpConfigured ? 'CONNECTED' : 'NOT CONFIGURED'}
              </span>
            </div>

            <p className="text-xs text-black/60 mb-4 leading-relaxed">
              Use a Google 16-character App Password (from Google Account → Security → 2-Step Verification → App passwords).
            </p>

            <div className="space-y-3">
              <div>
                <label className="mono-eyebrow text-black/60 block mb-1">GMAIL / SENDER ADDRESS</label>
                <input
                  type="email"
                  placeholder="your-name@gmail.com"
                  value={smtpEmail}
                  onChange={(e) => setSmtpEmail(e.target.value)}
                  className="w-full text-xs font-mono border border-black/20 rounded-[4px] p-2.5 focus:outline-none focus:border-black"
                />
              </div>

              <div>
                <label className="mono-eyebrow text-black/60 block mb-1">GOOGLE APP PASSWORD (16 CHARACTERS)</label>
                <input
                  type="password"
                  placeholder={smtpConfigured ? '•••••••••••••••• (Leave blank to keep existing)' : 'abcd efgh ijkl mnop'}
                  value={smtpAppPassword}
                  onChange={(e) => setSmtpAppPassword(e.target.value)}
                  className="w-full text-xs font-mono border border-black/20 rounded-[4px] p-2.5 focus:outline-none focus:border-black"
                />
              </div>
            </div>
          </div>

          {/* Section 2: AI Provider & Model Selection */}
          <div className="border border-black/[0.08] rounded-[4px] p-6 bg-white">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <Sparkles className="w-5 h-5 text-[#fc4c02]" />
                <h3 className="text-base font-semibold text-black">AI Reasoning & Copywriting</h3>
              </div>
              <span className={`mono-eyebrow text-[10px] px-2 py-0.5 rounded-[4px] ${
                aiKeyConfigured ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
              }`}>
                {aiKeyConfigured ? 'API KEY ACTIVE' : 'KEY REQUIRED'}
              </span>
            </div>

            <p className="text-xs text-black/60 mb-4">
              Choose your LLM provider and model for research analysis and personalized draft generation.
            </p>

            <div className="space-y-4">
              <div>
                <label className="mono-eyebrow text-black/60 block mb-1">PROVIDER</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'gemini', label: 'Google Gemini' },
                    { id: 'openai', label: 'OpenAI' },
                    { id: 'meta', label: 'Meta (Llama)' },
                  ].map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setAiProvider(p.id as any);
                        if (p.id === 'gemini') setAiModel('Gemini 3.6 flash');
                        else if (p.id === 'openai') setAiModel('ChatGPT 5.6 Mini');
                        else setAiModel('Meta Muse Spark 1.3 Contributor');
                      }}
                      className={`mono-btn text-xs py-2 rounded-[4px] border transition ${
                        aiProvider === p.id
                          ? 'bg-black text-white border-black'
                          : 'bg-white text-black/70 border-black/20 hover:bg-black/5'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mono-eyebrow text-black/60 block mb-1">MODEL</label>
                <select
                  value={aiModel}
                  onChange={(e) => setAiModel(e.target.value)}
                  className="w-full text-xs font-mono border border-black/20 rounded-[4px] p-2.5 bg-white focus:outline-none focus:border-black"
                >
                  {aiProvider === 'gemini' && (
                    <>
                      <option value="Gemini 3.6 flash">Gemini 3.6 flash (Fast, Low Latency)</option>
                      <option value="gemini-2.5-pro">Gemini 2.5 Pro (Deep Research)</option>
                    </>
                  )}
                  {aiProvider === 'openai' && (
                    <>
                      <option value="ChatGPT 5.6 Mini">ChatGPT 5.6 Mini (Standard)</option>
                      <option value="gpt-4o">GPT-4o (High Precision)</option>
                    </>
                  )}
                  {aiProvider === 'meta' && (
                    <>
                      <option value="Meta Muse Spark 1.3 Contributor">Meta Muse Spark 1.3 Contributor</option>
                      <option value="meta-llama/Llama-3.3-70B-Instruct-Turbo">Llama 3.3 70B Instruct Turbo</option>
                    </>
                  )}
                </select>
              </div>

              <div>
                <label className="mono-eyebrow text-black/60 block mb-1">{aiProvider.toUpperCase()} API KEY</label>
                <input
                  type="password"
                  placeholder={aiKeyConfigured ? '•••••••••••••••• (Leave blank to keep existing)' : 'Paste API Key here'}
                  value={aiApiKey}
                  onChange={(e) => setAiApiKey(e.target.value)}
                  className="w-full text-xs font-mono border border-black/20 rounded-[4px] p-2.5 focus:outline-none focus:border-black"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Google Places API Key */}
          <div className="border border-black/[0.08] rounded-[4px] p-6 bg-white">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <Key className="w-5 h-5 text-blue-600" />
                <h3 className="text-base font-semibold text-black">Google Places API (Live Discovery)</h3>
              </div>
              <span className={`mono-eyebrow text-[10px] px-2 py-0.5 rounded-[4px] ${
                placesKeyConfigured ? 'bg-emerald-100 text-emerald-800' : 'bg-black/5 text-black/50'
              }`}>
                {placesKeyConfigured ? 'CONFIGURED' : 'OPTIONAL / PENDING'}
              </span>
            </div>

            <p className="text-xs text-black/60 mb-4">
              Google Cloud API key with <strong>Places API (New)</strong> enabled for live small business discovery.
            </p>

            <div>
              <label className="mono-eyebrow text-black/60 block mb-1">GOOGLE PLACES API KEY</label>
              <input
                type="password"
                placeholder={placesKeyConfigured ? '•••••••••••••••• (Leave blank to keep existing)' : 'AIzaSy...'}
                value={placesApiKey}
                onChange={(e) => setPlacesApiKey(e.target.value)}
                className="w-full text-xs font-mono border border-black/20 rounded-[4px] p-2.5 focus:outline-none focus:border-black"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="mono-btn w-full bg-black text-white hover:bg-black/80 py-3 rounded-[4px] text-xs flex items-center justify-center space-x-2 transition"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'ENCRYPTING & SAVING...' : 'SAVE CONFIGURATION'}</span>
          </button>
        </form>

        {/* Right Column: Global Suppression List */}
        <div className="border border-black/[0.08] rounded-[4px] p-6 bg-white h-fit">
          <div className="flex items-center space-x-2 mb-2">
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
            <h3 className="text-base font-semibold text-black">Global Suppression & Opt-Out List</h3>
          </div>
          <p className="text-xs text-black/60 mb-6">
            Recipients who opt out or are manually suppressed. Checked immediately before every live dispatch.
          </p>

          <form onSubmit={handleAddSuppression} className="flex gap-2 mb-6">
            <input
              type="email"
              required
              placeholder="exclude@example.com"
              value={newSuppressionEmail}
              onChange={(e) => setNewSuppressionEmail(e.target.value)}
              className="flex-1 text-xs border border-black/20 rounded-[4px] px-3 py-2 font-mono focus:outline-none focus:border-black"
            />
            <button
              type="submit"
              className="mono-btn text-xs bg-black text-white hover:bg-black/80 px-3 py-2 rounded-[4px] flex items-center space-x-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>BLOCK</span>
            </button>
          </form>

          <div className="border border-black/[0.06] rounded-[4px] divide-y divide-black/[0.06] max-h-80 overflow-y-auto">
            {suppressions.length === 0 ? (
              <div className="p-4 text-center text-xs font-mono text-black/40">
                No suppression entries.
              </div>
            ) : (
              suppressions.map((entry) => (
                <div key={entry.id} className="p-3 flex items-center justify-between text-xs font-mono">
                  <div>
                    <div className="font-semibold text-black">{entry.normalized_email || 'Phone Record'}</div>
                    <div className="text-[10px] text-black/40">
                      Reason: {entry.reason} • {new Date(entry.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <span className="mono-eyebrow text-[9px] bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.5 rounded-[4px]">
                    SUPPRESSED
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
