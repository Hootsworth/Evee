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
        setMessage({ text: 'All provider credentials and settings saved securely.', type: 'success' });
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
          value: newSuppressionEmail,
          type: 'email',
          reason: 'Manual operator suppression via settings console',
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

  return (
    <div className="min-h-screen bg-[#ffffff]">
      {/* Top Banner: Flat & Clean (Zero Gradients, Thinner Typography) */}
      <section className="bg-[#f8fafc] border-b border-[#e5e7eb] px-6 py-10">
        <div className="max-w-7xl mx-auto">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-white border border-[#e5e7eb] text-[#374151] shadow-sm mb-3">
            <span className="w-1.5 h-1.5 rounded-full bg-[#f43f5e]"></span>
            <span className="mono-eyebrow text-xs font-normal">SYSTEM CONFIGURATION</span>
          </div>
          <h1 className="text-3xl font-light tracking-tight text-[#111827]">Credentials & Governance</h1>
          <p className="text-sm text-[#6b7280] mt-1 max-w-xl font-light">
            Configure Google App Passwords, AI reasoning keys, Places API tokens, and enforce fail-closed global suppression lists.
          </p>
        </div>
      </section>

      <main className="max-w-4xl mx-auto px-6 py-10">
        {message && (
          <div
            className={`mb-6 p-4 rounded-xl border text-xs font-mono flex items-center space-x-2.5 ${
              message.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}
          >
            {message.type === 'success' ? (
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{message.text}</span>
          </div>
        )}

        <form onSubmit={handleSaveProviders} className="space-y-6">
          {/* Section 1: Live Email Sending via App Passwords */}
          <div className="border border-[#e5e7eb] rounded-xl p-6 bg-white shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2.5">
                <Mail className="w-5 h-5 text-[#111827]" />
                <h3 className="text-base font-normal text-[#111827]">Live Email Sending (Google App Passwords)</h3>
              </div>
              <span className={`mono-eyebrow text-[10px] px-3 py-1 rounded-full font-normal ${
                smtpConfigured ? 'bg-emerald-100 text-emerald-800' : 'bg-[#f8fafc] border border-[#e5e7eb] text-[#6b7280]'
              }`}>
                {smtpConfigured ? 'CONNECTED' : 'NOT CONFIGURED'}
              </span>
            </div>

            <p className="text-xs text-[#6b7280] mb-4 leading-relaxed font-mono font-light">
              Use a Google 16-character App Password (Google Account → Security → 2-Step Verification → App passwords).
            </p>

            <div className="space-y-3">
              <div>
                <label className="mono-eyebrow text-[#6b7280] font-normal block mb-1">GMAIL / SENDER ADDRESS</label>
                <input
                  type="email"
                  placeholder="your-name@gmail.com"
                  value={smtpEmail}
                  onChange={(e) => setSmtpEmail(e.target.value)}
                  className="w-full text-xs font-mono border border-[#e5e7eb] rounded-xl p-2.5 focus:outline-none focus:border-[#f43f5e] focus:ring-1 focus:ring-rose-500/20 text-[#111827] font-light"
                />
              </div>

              <div>
                <label className="mono-eyebrow text-[#6b7280] font-normal block mb-1">GOOGLE APP PASSWORD (16 CHARACTERS)</label>
                <input
                  type="password"
                  placeholder={smtpConfigured ? '•••••••••••••••• (Leave blank to keep existing)' : 'abcd efgh ijkl mnop'}
                  value={smtpAppPassword}
                  onChange={(e) => setSmtpAppPassword(e.target.value)}
                  className="w-full text-xs font-mono border border-[#e5e7eb] rounded-xl p-2.5 focus:outline-none focus:border-[#f43f5e] focus:ring-1 focus:ring-rose-500/20 text-[#111827] font-light"
                />
              </div>
            </div>
          </div>

          {/* Section 2: AI Provider & Model Selection */}
          <div className="border border-[#e5e7eb] rounded-xl p-6 bg-white shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2.5">
                <Sparkles className="w-5 h-5 text-[#111827]" />
                <h3 className="text-base font-normal text-[#111827]">AI Reasoning & Copywriting</h3>
              </div>
              <span className={`mono-eyebrow text-[10px] px-3 py-1 rounded-full font-normal ${
                aiKeyConfigured ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
              }`}>
                {aiKeyConfigured ? 'API KEY ACTIVE' : 'KEY REQUIRED'}
              </span>
            </div>

            <p className="text-xs text-[#6b7280] mb-4 font-mono font-light">
              Choose your LLM provider and model for research analysis and personalized draft generation.
            </p>

            <div className="space-y-4">
              <div>
                <label className="mono-eyebrow text-[#6b7280] font-normal block mb-1.5">PROVIDER</label>
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
                      className={`mono-btn text-xs py-2.5 rounded-full border transition font-normal ${
                        aiProvider === p.id
                          ? 'bg-[#111827] text-white border-[#111827] shadow-sm'
                          : 'bg-[#f8fafc] text-[#4b5563] border-[#e5e7eb] hover:bg-[#f1f5f9]'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mono-eyebrow text-[#6b7280] font-normal block mb-1">MODEL SPECIFICATION</label>
                <input
                  type="text"
                  value={aiModel}
                  onChange={(e) => setAiModel(e.target.value)}
                  className="w-full text-xs font-mono border border-[#e5e7eb] rounded-xl p-2.5 focus:outline-none focus:border-[#f43f5e] text-[#111827] font-light"
                />
              </div>

              <div>
                <label className="mono-eyebrow text-[#6b7280] font-normal block mb-1">API KEY (AES-256-GCM ENCRYPTED)</label>
                <input
                  type="password"
                  placeholder={aiKeyConfigured ? '•••••••••••••••• (Leave blank to keep existing)' : 'Enter API Key'}
                  value={aiApiKey}
                  onChange={(e) => setAiApiKey(e.target.value)}
                  className="w-full text-xs font-mono border border-[#e5e7eb] rounded-xl p-2.5 focus:outline-none focus:border-[#f43f5e] text-[#111827] font-light"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Google Places Discovery */}
          <div className="border border-[#e5e7eb] rounded-xl p-6 bg-white shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2.5">
                <Key className="w-5 h-5 text-[#111827]" />
                <h3 className="text-base font-normal text-[#111827]">Google Places Discovery API</h3>
              </div>
              <span className={`mono-eyebrow text-[10px] px-3 py-1 rounded-full font-normal ${
                placesKeyConfigured ? 'bg-emerald-100 text-emerald-800' : 'bg-[#f8fafc] border border-[#e5e7eb] text-[#6b7280]'
              }`}>
                {placesKeyConfigured ? 'KEY ACTIVE' : 'MOCK PROVIDER ACTIVE'}
              </span>
            </div>

            <p className="text-xs text-[#6b7280] mb-4 font-mono font-light">
              Required for continuous real-world business discovery. (Falls back safely to synthetic simulation if omitted).
            </p>

            <div>
              <label className="mono-eyebrow text-[#6b7280] font-normal block mb-1">PLACES API KEY</label>
              <input
                type="password"
                placeholder={placesKeyConfigured ? '•••••••••••••••• (Leave blank to keep existing)' : 'AIzaSy...'}
                value={placesApiKey}
                onChange={(e) => setPlacesApiKey(e.target.value)}
                className="w-full text-xs font-mono border border-[#e5e7eb] rounded-xl p-2.5 focus:outline-none focus:border-[#f43f5e] text-[#111827] font-light"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="mono-btn bg-[#f43f5e] hover:bg-[#e11d48] text-white px-6 py-3 rounded-full text-xs font-normal flex items-center justify-center space-x-2 shadow-sm transition active:scale-95 w-full tracking-wider"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'ENCRYPTING & PERSISTING...' : 'SAVE PROVIDER CREDENTIALS'}</span>
          </button>
        </form>

        {/* Global Suppression List */}
        <div className="mt-12 pt-8 border-t border-[#f3f4f6]">
          <div className="flex items-center space-x-2.5 mb-2">
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
            <h3 className="text-lg font-normal text-[#111827]">Global Suppression Registry</h3>
          </div>
          <p className="text-xs text-[#6b7280] mb-6 font-mono font-light">
            Unconditional opt-outs and blocked contacts. Outbound dispatches are strictly pre-checked against this list before transmission.
          </p>

          <form onSubmit={handleAddSuppression} className="flex gap-3 mb-6">
            <input
              type="text"
              placeholder="operator@do-not-contact.com or domain.com"
              value={newSuppressionEmail}
              onChange={(e) => setNewSuppressionEmail(e.target.value)}
              className="flex-1 text-xs font-mono border border-[#e5e7eb] rounded-full px-4 py-2.5 focus:outline-none focus:border-[#f43f5e] text-[#111827] font-light"
            />
            <button
              type="submit"
              className="mono-btn bg-[#111827] hover:bg-[#1f2937] text-white px-5 py-2.5 rounded-full text-xs font-normal flex items-center space-x-1.5 shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>SUPPRESS</span>
            </button>
          </form>

          <div className="border border-[#e5e7eb] rounded-xl overflow-hidden bg-white shadow-sm">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-[#f8fafc] border-b border-[#e5e7eb] text-[#4b5563]">
                <tr>
                  <th className="py-3 px-4 font-normal">TYPE</th>
                  <th className="py-3 px-4 font-normal">VALUE</th>
                  <th className="py-3 px-4 font-normal">REASON</th>
                  <th className="py-3 px-4 font-normal">DATE</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f3f4f6]">
                {suppressions.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-[#9ca3af] font-light">No suppression entries recorded yet.</td>
                  </tr>
                ) : (
                  suppressions.map((s) => (
                    <tr key={s.id}>
                      <td className="py-3 px-4 font-normal text-[#111827]">{s.suppression_type}</td>
                      <td className="py-3 px-4 text-[#111827] font-normal">{s.normalized_value}</td>
                      <td className="py-3 px-4 text-[#6b7280] font-light">{s.reason || 'Unspecified'}</td>
                      <td className="py-3 px-4 text-[#9ca3af] font-light">{new Date(s.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
