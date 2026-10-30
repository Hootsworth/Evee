'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Mail, KeyRound, ArrowRight, ShieldCheck, CheckCircle2, AlertCircle } from 'lucide-react';

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

  // 1. Send OTP via Supabase Auth
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setLoading(true);
    setMessage(null);

    try {
      const { data, error } = await supabase.auth.signInWithOtp({
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
          text: `Verification code sent to ${email}. Check your inbox or spam.`,
          type: 'success',
        });
      }
    } catch (err: any) {
      setMessage({ text: err.message || 'Failed to send OTP code', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // 2. Verify OTP code
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
        setMessage({ text: 'Authentication successful! Redirecting...', type: 'success' });
        setTimeout(() => {
          router.push('/');
          router.refresh();
        }, 1000);
      }
    } catch (err: any) {
      setMessage({ text: err.message || 'Invalid verification code', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex flex-col justify-center items-center px-6 py-16 bg-[#ffffff]">
      {/* Background ambient glow matching Together AI brand ribbon */}
      <div className="absolute w-[500px] h-[500px] brand-gradient opacity-10 blur-[120px] rounded-full pointer-events-none -top-20"></div>

      <div className="w-full max-w-md relative z-10">
        {/* Header Branding */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center space-x-2 group mb-3">
            <span className="font-extrabold tracking-tight text-2xl text-black">EVEE</span>
            <span className="w-2.5 h-2.5 rounded-full brand-gradient inline-block shadow-sm"></span>
            <span className="mono-eyebrow text-xs text-black/40 tracking-widest pl-1">PLATFORM</span>
          </Link>
          <h1 className="text-2xl font-medium tracking-tight text-black">
            {mode === 'signup'
              ? 'Create your operator account'
              : mode === 'forgot'
              ? 'Recover your account'
              : 'Sign in to Evee'}
          </h1>
          <p className="text-xs text-black/50 mt-1.5 font-mono">
            {step === 'otp'
              ? 'Enter the 6-digit one-time code sent to your email.'
              : 'Passwordless OTP verification for maximum credential security.'}
          </p>
        </div>

        {/* Auth Card (Together AI Card aesthetic: clean border, 4px rounded, mono labels) */}
        <div className="border border-black/[0.12] rounded-[4px] bg-white p-8 shadow-sm">
          {message && (
            <div
              className={`mb-6 p-3 rounded-[4px] text-xs font-mono flex items-start space-x-2 ${
                message.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-rose-50 text-rose-800 border border-rose-200'
              }`}
            >
              {message.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              )}
              <span>{message.text}</span>
            </div>
          )}

          {step === 'email' ? (
            <form onSubmit={handleSendOtp} className="space-y-4">
              {mode === 'signup' && (
                <div>
                  <label className="mono-eyebrow text-black/60 block mb-1">YOUR NAME</label>
                  <input
                    type="text"
                    required
                    placeholder="Aditya Dixit"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full text-xs font-mono border border-black/20 rounded-[4px] p-2.5 focus:outline-none focus:border-black"
                  />
                </div>
              )}

              <div>
                <label className="mono-eyebrow text-black/60 block mb-1">EMAIL ADDRESS</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-black/40 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    placeholder="operator@singulr.tech"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 text-xs font-mono border border-black/20 rounded-[4px] focus:outline-none focus:border-black"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="mono-btn w-full bg-black text-white hover:bg-black/85 py-3 rounded-[4px] text-xs flex items-center justify-center space-x-2 transition mt-2"
              >
                <span>{loading ? 'SENDING CODE...' : 'CONTINUE WITH OTP'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="mono-eyebrow text-black/60">6-DIGIT VERIFICATION CODE</label>
                  <button
                    type="button"
                    onClick={() => setStep('email')}
                    className="mono-eyebrow text-[10px] text-black/40 hover:text-black underline"
                  >
                    Change Email
                  </button>
                </div>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-black/40 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    maxLength={6}
                    autoFocus
                    placeholder="123456"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 text-sm font-mono tracking-widest border border-black/20 rounded-[4px] focus:outline-none focus:border-black"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="mono-btn w-full bg-black text-white hover:bg-black/85 py-3 rounded-[4px] text-xs flex items-center justify-center space-x-2 transition mt-2"
              >
                <ShieldCheck className="w-4 h-4 text-[#c8f6f9]" />
                <span>{loading ? 'VERIFYING...' : 'VERIFY & ENTER'}</span>
              </button>

              <button
                type="button"
                onClick={handleSendOtp}
                disabled={loading}
                className="mono-eyebrow w-full text-center text-[10px] text-black/50 hover:text-black block pt-2"
              >
                Didn't receive code? Resend
              </button>
            </form>
          )}

          {/* Mode switch tabs */}
          <div className="mt-8 pt-6 border-t border-black/[0.08] flex justify-between items-center text-xs font-mono">
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
                  Lost access?
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
                ← Back to sign in
              </button>
            )}
          </div>
        </div>

        {/* Security Disclosures */}
        <div className="mt-8 text-center text-[11px] font-mono text-black/40 flex items-center justify-center space-x-2">
          <ShieldCheck className="w-3.5 h-3.5 text-black/40" />
          <span>Evee uses Supabase Auth with PKCE and rate-limited OTP tokens.</span>
        </div>
      </div>
    </div>
  );
}
