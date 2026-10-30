'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Logo from '@/components/Logo';
import { Mail, KeyRound, ArrowRight, ShieldCheck, CheckCircle2, AlertCircle, Sparkles, Terminal, Check } from 'lucide-react';

export default function AuthPage() {
  const router = useRouter();
  const supabase = createClient();

  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot'>('signin');
  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // 1. Send OTP
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setLoading(true);
    setMessage(null);

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: {
          shouldCreateUser: mode === 'signup',
          data: mode === 'signup' && displayName ? { display_name: displayName.trim() } : undefined,
        },
      });

      if (error) {
        setMessage({ text: error.message, type: 'error' });
      } else {
        setStep('otp');
        setMessage({
          text: `A 6-digit verification code has been dispatched to ${email}`,
          type: 'success',
        });
      }
    } catch (err: any) {
      setMessage({ text: err.message || 'Failed to dispatch verification code', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // 2. Verify OTP
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp) return;

    setLoading(true);
    setMessage(null);

    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token: otp.trim(),
        type: 'email',
      });

      if (error) {
        setMessage({ text: error.message, type: 'error' });
      } else if (data.session) {
        setMessage({ text: 'Access granted. Initializing session...', type: 'success' });
        setTimeout(() => {
          router.push('/');
          router.refresh();
        }, 800);
      }
    } catch (err: any) {
      setMessage({ text: err.message || 'Invalid or expired passcode', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-[#010120] text-white overflow-hidden select-none">
      {/* LEFT COLUMN: Together AI Immersive Platform Showcase (Desktop) */}
      <div className="hidden lg:flex lg:w-7/12 flex-col justify-between p-16 relative border-r border-white/10 bg-[#010120]">
        {/* Glow ribbon effect */}
        <div className="absolute top-1/4 -left-20 w-96 h-96 brand-gradient opacity-20 blur-[130px] rounded-full pointer-events-none"></div>
        <div className="absolute bottom-10 right-10 w-80 h-80 bg-[#c8f6f9] opacity-10 blur-[140px] rounded-full pointer-events-none"></div>

        {/* Brand Header */}
        <div className="relative z-10 flex items-center">
          <Logo theme="dark" height={36} showSubtitle={true} />
        </div>

        {/* Narrative Hero */}
        <div className="relative z-10 max-w-xl my-auto py-12">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-[4px] bg-white/5 border border-white/15 mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-[#c8f6f9]"></span>
            <span className="mono-eyebrow text-[10px] text-white/90">ENTERPRISE AUDIT & RESEARCH PIPELINE</span>
          </div>

          <h2 className="text-4xl xl:text-5xl font-medium tracking-tight text-white leading-[1.15] mb-6">
            High-intent prospecting, verified by empirical evidence.
          </h2>

          <p className="text-white/60 text-base leading-relaxed mb-10">
            Evee inspects public web infrastructure, extracts concrete operational gaps (broken booking widgets, missing digital menus, viewport bugs), and drafts grounded outreach with mandatory operator approval.
          </p>

          {/* Architectural Pillars */}
          <div className="space-y-4 font-mono text-xs text-white/80">
            <div className="flex items-center space-x-3 bg-white/5 border border-white/10 p-3.5 rounded-[4px]">
              <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                <Check className="w-3.5 h-3.5" />
              </div>
              <span>Deterministic 100-pt qualification scoring with hard evidence caps.</span>
            </div>

            <div className="flex items-center space-x-3 bg-white/5 border border-white/10 p-3.5 rounded-[4px]">
              <div className="w-6 h-6 rounded-full bg-[#ef2cc1]/20 text-[#ef2cc1] flex items-center justify-center shrink-0">
                <Check className="w-3.5 h-3.5" />
              </div>
              <span>Strict fail-closed email sending: 0 automated emails without explicit approval.</span>
            </div>

            <div className="flex items-center space-x-3 bg-white/5 border border-white/10 p-3.5 rounded-[4px]">
              <div className="w-6 h-6 rounded-full bg-[#c8f6f9]/20 text-[#c8f6f9] flex items-center justify-center shrink-0">
                <Check className="w-3.5 h-3.5" />
              </div>
              <span>Anti-spam compliance: instant pre-send global suppression & opt-out checks.</span>
            </div>
          </div>
        </div>

        {/* Footer Info */}
        <div className="relative z-10 flex items-center justify-between text-xs font-mono text-white/40 pt-8 border-t border-white/10">
          <span>SINGULR TECH • ARCHITECTURE V2.0</span>
          <span>AES-256-GCM PROTECTED</span>
        </div>
      </div>

      {/* RIGHT COLUMN: The High-Contrast Authentication Card (White Surface on Mobile / High-Contrast Clean on Desktop) */}
      <div className="w-full lg:w-5/12 flex flex-col justify-center items-center px-6 sm:px-12 py-16 bg-white text-black min-h-screen">
        <div className="w-full max-w-sm">
          {/* Mobile-only header */}
          <div className="lg:hidden text-center mb-8 flex justify-center">
            <Logo theme="light" height={32} showSubtitle={true} />
          </div>

          {/* Form Header */}
          <div className="mb-8">
            <span className="mono-eyebrow text-black/40 block mb-1">OPERATOR ACCESS</span>
            <h3 className="text-2xl font-medium tracking-tight text-black">
              {mode === 'signup'
                ? 'Create an account'
                : mode === 'forgot'
                ? 'Account Recovery'
                : 'Sign in to Console'}
            </h3>
            <p className="text-xs text-black/60 mt-1 font-mono">
              {step === 'otp'
                ? 'Enter the 6-digit code sent to your inbox.'
                : 'Enter your email to receive an instant authentication passcode.'}
            </p>
          </div>

          {/* Banner message */}
          {message && (
            <div
              className={`mb-6 p-3 rounded-[4px] text-xs font-mono flex items-start space-x-2.5 ${
                message.type === 'success'
                  ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
                  : 'bg-rose-50 text-rose-900 border border-rose-200'
              }`}
            >
              {message.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              )}
              <span className="leading-relaxed">{message.text}</span>
            </div>
          )}

          {step === 'email' ? (
            <form onSubmit={handleSendOtp} className="space-y-4">
              {mode === 'signup' && (
                <div>
                  <label className="mono-eyebrow text-black/60 block mb-1.5">FULL NAME</label>
                  <input
                    type="text"
                    required
                    placeholder="Aditya Dixit"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full text-xs font-mono border border-black/20 rounded-[4px] p-3 focus:outline-none focus:border-black transition"
                  />
                </div>
              )}

              <div>
                <label className="mono-eyebrow text-black/60 block mb-1.5">EMAIL ADDRESS</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-black/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    autoFocus
                    placeholder="operator@singulr.tech"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-3 py-3 text-xs font-mono border border-black/20 rounded-[4px] focus:outline-none focus:border-black transition"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="mono-btn w-full bg-black text-white hover:bg-black/85 py-3.5 rounded-[4px] text-xs flex items-center justify-center space-x-2 transition mt-2 tracking-wider"
              >
                <span>{loading ? 'SENDING CODE...' : 'CONTINUE WITH PASSCODE'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="mono-eyebrow text-black/60">6-DIGIT PASSCODE</label>
                  <button
                    type="button"
                    onClick={() => setStep('email')}
                    className="mono-eyebrow text-[10px] text-black/40 hover:text-black underline"
                  >
                    Edit Email
                  </button>
                </div>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-black/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    maxLength={6}
                    autoFocus
                    placeholder="123456"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    className="w-full pl-10 pr-3 py-3 text-sm font-mono tracking-widest font-bold border border-black/20 rounded-[4px] focus:outline-none focus:border-black transition"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="mono-btn w-full bg-black text-white hover:bg-black/85 py-3.5 rounded-[4px] text-xs flex items-center justify-center space-x-2 transition mt-2 tracking-wider"
              >
                <ShieldCheck className="w-4 h-4 text-[#c8f6f9]" />
                <span>{loading ? 'AUTHENTICATING...' : 'VERIFY & SIGN IN'}</span>
              </button>

              <button
                type="button"
                onClick={handleSendOtp}
                disabled={loading}
                className="mono-eyebrow w-full text-center text-[11px] text-black/50 hover:text-black block pt-2"
              >
                Resend verification code
              </button>
            </form>
          )}

          {/* Mode Switcher */}
          <div className="mt-8 pt-6 border-t border-black/[0.08] flex items-center justify-between text-xs font-mono">
            {mode === 'signin' ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setMode('signup');
                    setStep('email');
                    setMessage(null);
                  }}
                  className="text-black/60 hover:text-black underline"
                >
                  Create an account
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('forgot');
                    setStep('email');
                    setMessage(null);
                  }}
                  className="text-black/40 hover:text-black"
                >
                  Help
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setMode('signin');
                  setStep('email');
                  setMessage(null);
                }}
                className="text-black/60 hover:text-black underline w-full text-center"
              >
                ← Return to sign in
              </button>
            )}
          </div>

          {/* Compliance & Security Tag */}
          <div className="mt-12 text-center text-[10px] font-mono text-black/40 flex items-center justify-center space-x-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-black/30" />
            <span>PROTECTED BY SUPABASE ROW LEVEL SECURITY</span>
          </div>
        </div>
      </div>
    </div>
  );
}
