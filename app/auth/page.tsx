'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Logo from '@/components/Logo';
import { Mail, KeyRound, ArrowRight, CheckCircle2, AlertCircle } from 'lucide-react';

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
          text: `Verification code sent to ${email}`,
          type: 'success',
        });
      }
    } catch (err: any) {
      setMessage({ text: err.message || 'Failed to send code', type: 'error' });
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
        setMessage({ text: 'Success! Logging you in...', type: 'success' });
        setTimeout(() => {
          router.push('/');
          router.refresh();
        }, 500);
      }
    } catch (err: any) {
      setMessage({ text: err.message || 'Invalid passcode', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col justify-center items-center px-6 py-12 bg-[#090a16]">
      {/* Centered Minimal Container */}
      <div className="w-full max-w-[420px]">
        {/* Brand Logo Header */}
        <div className="flex flex-col items-center justify-center mb-8">
          <Logo theme="dark" height={44} showSubtitle={false} />
          <p className="text-sm text-white/50 mt-3 font-medium">
            AI B2B Prospecting & Outreach
          </p>
        </div>

        {/* Flat Color Block Card */}
        <div className="bg-[#121324] border border-[#23253b] rounded-xl p-8 shadow-2xl">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-white tracking-tight">
              {mode === 'signup'
                ? 'Create your account'
                : mode === 'forgot'
                ? 'Reset access'
                : 'Welcome back'}
            </h2>
            <p className="text-xs text-white/50 mt-1">
              {step === 'otp'
                ? 'Enter the 6-digit code sent to your email.'
                : 'Enter your email to sign in with an instant passcode.'}
            </p>
          </div>

          {/* Feedback Message */}
          {message && (
            <div
              className={`mb-5 p-3 rounded-lg text-xs flex items-center space-x-2 ${
                message.type === 'success'
                  ? 'bg-[#0f2e22] text-[#4ade80] border border-[#166534]'
                  : 'bg-[#2e1218] text-[#f87171] border border-[#991b1b]'
              }`}
            >
              {message.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0" />
              )}
              <span>{message.text}</span>
            </div>
          )}

          {step === 'email' ? (
            <form onSubmit={handleSendOtp} className="space-y-4">
              {mode === 'signup' && (
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-white/60 block mb-1.5">
                    Your Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Aditya Dixit"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full text-sm bg-[#1a1c30] text-white placeholder-white/30 border border-[#2a2d48] rounded-lg px-3.5 py-2.5 focus:outline-none focus:border-[#6366f1] focus:ring-1 focus:ring-[#6366f1] transition"
                  />
                </div>
              )}

              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-white/60 block mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-white/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    autoFocus
                    placeholder="name@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-3.5 py-2.5 text-sm bg-[#1a1c30] text-white placeholder-white/30 border border-[#2a2d48] rounded-lg focus:outline-none focus:border-[#6366f1] focus:ring-1 focus:ring-[#6366f1] transition"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 bg-[#6366f1] hover:bg-[#4f46e5] text-white font-medium py-2.5 rounded-lg text-sm flex items-center justify-center space-x-2 transition shadow-lg shadow-indigo-500/20 active:scale-[0.99]"
              >
                <span>{loading ? 'Sending code...' : 'Continue with Email'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-white/60">
                    6-Digit Code
                  </label>
                  <button
                    type="button"
                    onClick={() => setStep('email')}
                    className="text-xs text-[#a5b4fc] hover:underline"
                  >
                    Change email
                  </button>
                </div>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-white/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    maxLength={6}
                    autoFocus
                    placeholder="123456"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    className="w-full pl-10 pr-3.5 py-2.5 text-base tracking-[0.25em] font-mono font-bold bg-[#1a1c30] text-white placeholder-white/20 border border-[#2a2d48] rounded-lg focus:outline-none focus:border-[#6366f1] focus:ring-1 focus:ring-[#6366f1] transition"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 bg-[#10b981] hover:bg-[#059669] text-white font-medium py-2.5 rounded-lg text-sm flex items-center justify-center space-x-2 transition shadow-lg shadow-emerald-500/20 active:scale-[0.99]"
              >
                <span>{loading ? 'Verifying...' : 'Sign In'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={handleSendOtp}
                disabled={loading}
                className="w-full text-center text-xs text-white/50 hover:text-white pt-2 transition"
              >
                Didn't get a code? Resend
              </button>
            </form>
          )}

          {/* Mode Navigation */}
          <div className="mt-6 pt-5 border-t border-[#23253b] flex items-center justify-between text-xs text-white/60">
            {mode === 'signin' ? (
              <>
                <span>Don't have an account?</span>
                <button
                  type="button"
                  onClick={() => {
                    setMode('signup');
                    setStep('email');
                    setMessage(null);
                  }}
                  className="text-[#a5b4fc] hover:text-white font-medium hover:underline"
                >
                  Sign up
                </button>
              </>
            ) : (
              <>
                <span>Already registered?</span>
                <button
                  type="button"
                  onClick={() => {
                    setMode('signin');
                    setStep('email');
                    setMessage(null);
                  }}
                  className="text-[#a5b4fc] hover:text-white font-medium hover:underline"
                >
                  Sign in
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
