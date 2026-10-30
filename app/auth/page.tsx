'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Logo from '@/components/Logo';
import { Mail, ArrowRight, ShieldCheck, CheckCircle2, AlertCircle, Sparkles, Target, Zap } from 'lucide-react';

export default function AuthPage() {
  const router = useRouter();
  const supabase = createClient();

  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot'>('signin');
  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // 8 digit individual boxes matching Supabase OTP template
  const OTP_LENGTH = 8;
  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Auto-focus first digit box when moving to OTP step
  useEffect(() => {
    if (step === 'otp') {
      setTimeout(() => {
        inputRefs.current[0]?.focus();
      }, 100);
    }
  }, [step]);

  // 1. Send OTP
  const handleSendOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!email) return;

    setLoading(true);
    setMessage(null);

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: {
          shouldCreateUser: true,
          data: displayName ? { display_name: displayName.trim() } : undefined,
        },
      });

      if (error) {
        setMessage({ text: error.message, type: 'error' });
      } else {
        setStep('otp');
        setDigits(Array(OTP_LENGTH).fill(''));
        setMessage({
          text: `Verification code was sent to ${email}`,
          type: 'success',
        });
      }
    } catch (err: any) {
      setMessage({ text: err.message || 'Failed to dispatch verification code', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // 2. Handle OTP digit input changes, auto-advance, and paste
  const handleDigitChange = (index: number, value: string) => {
    if (value.length > 1) {
      const pasted = value.replace(/\D/g, '').slice(0, OTP_LENGTH);
      if (pasted.length > 0) {
        const newDigits = Array(OTP_LENGTH).fill('');
        for (let i = 0; i < pasted.length; i++) {
          newDigits[i] = pasted[i] || '';
        }
        setDigits(newDigits);
        const focusIdx = Math.min(pasted.length, OTP_LENGTH - 1);
        inputRefs.current[focusIdx]?.focus();

        if (pasted.length === OTP_LENGTH) {
          verifyCode(pasted);
        }
      }
      return;
    }

    const cleaned = value.replace(/\D/g, '');
    const newDigits = [...digits];
    newDigits[index] = cleaned;
    setDigits(newDigits);

    // Auto-advance to next box if filled
    if (cleaned && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit if all digits are filled
    const fullCode = newDigits.join('');
    if (fullCode.length === OTP_LENGTH && !newDigits.includes('')) {
      verifyCode(fullCode);
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  // 3. Verify OTP
  const verifyCode = async (codeToVerify: string) => {
    const trimmed = codeToVerify.trim();
    if (!trimmed) return;

    setLoading(true);
    setMessage(null);

    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token: trimmed,
        type: 'email',
      });

      if (error) {
        setMessage({ text: error.message, type: 'error' });
      } else {
        setMessage({ text: 'Access granted. Initializing session...', type: 'success' });
        setTimeout(() => {
          router.push('/');
          router.refresh();
        }, 600);
      }
    } catch (err: any) {
      setMessage({ text: err.message || 'Invalid or expired verification code', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    verifyCode(digits.join(''));
  };

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-[#ffffff] text-[#111827] select-none">
      {/* LEFT COLUMN: Bright, Fresh & Flat Pink Artistic Studio Canvas */}
      <div className="hidden lg:flex lg:w-7/12 flex-col justify-between p-16 relative border-r border-[#ffe4e6] bg-gradient-to-br from-[#fff5f6] via-[#fff1f2]/80 to-[#fdf2f8] overflow-hidden">
        {/* Soft, Artistic Abstract Blobs */}
        <div className="absolute -top-24 -left-20 w-[460px] h-[460px] rounded-full bg-[#fecdd3]/70 blur-3xl pointer-events-none"></div>
        <div className="absolute top-1/2 -right-20 w-[400px] h-[400px] rounded-full bg-[#bae6fd]/50 blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-24 left-1/4 w-[420px] h-[420px] rounded-full bg-[#fbcfe8]/60 blur-3xl pointer-events-none"></div>

        {/* Brand Header */}
        <div className="relative z-10 flex items-center">
          <Logo theme="light" height={36} showSubtitle={false} />
          <span className="mono-eyebrow text-xs text-[#f43f5e] font-bold tracking-widest pl-3 ml-3 border-l border-[#fecdd3]">
            PROSPECTING STUDIO
          </span>
        </div>

        {/* Narrative & Editorial Centerpiece */}
        <div className="relative z-10 max-w-xl my-auto py-10">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-[#ffffff] border border-[#fecdd3] text-[#f43f5e] shadow-sm mb-6">
            <span className="w-2 h-2 rounded-full bg-[#f43f5e]"></span>
            <span className="text-[11px] font-mono font-semibold tracking-wider uppercase">
              EMPIRICAL AI PROSPECTING
            </span>
          </div>

          <h2 className="text-4xl xl:text-5xl font-semibold tracking-tight text-[#111827] leading-[1.2] mb-6">
            High-intent outreach, grounded in verified business observations.
          </h2>

          <p className="text-[#4b5563] text-base leading-relaxed mb-10">
            Evee inspects public business web presence, extracts concrete operational gaps, and drafts personalized emails with mandatory operator approval.
          </p>

          {/* Crisp, Flat Color Tiles */}
          <div className="grid grid-cols-3 gap-3.5 pt-2">
            <div className="bg-[#ffffff] border border-[#fecdd3] rounded-2xl p-4 shadow-sm hover:border-[#f43f5e] transition">
              <div className="w-3 h-3 rounded-full bg-[#f43f5e] mb-2.5"></div>
              <div className="text-xs font-bold text-[#111827]">Observation</div>
              <div className="text-[11px] text-[#6b7280] mt-1 font-mono">Empirical proof</div>
            </div>

            <div className="bg-[#ffffff] border border-[#bae6fd] rounded-2xl p-4 shadow-sm hover:border-[#0284c7] transition">
              <div className="w-3 h-3 rounded-full bg-[#0284c7] mb-2.5"></div>
              <div className="text-xs font-bold text-[#111827]">100-Pt Scoring</div>
              <div className="text-[11px] text-[#6b7280] mt-1 font-mono">Deterministic caps</div>
            </div>

            <div className="bg-[#ffffff] border border-[#fbcfe8] rounded-2xl p-4 shadow-sm hover:border-[#db2777] transition">
              <div className="w-3 h-3 rounded-full bg-[#db2777] mb-2.5"></div>
              <div className="text-xs font-bold text-[#111827]">Fail-Closed</div>
              <div className="text-[11px] text-[#6b7280] mt-1 font-mono">Operator control</div>
            </div>
          </div>
        </div>

        {/* Footer Signature */}
        <div className="relative z-10 flex items-center justify-between text-xs font-mono text-[#9ca3af] pt-6 border-t border-[#fecdd3]">
          <span>EVEE PLATFORM • SINGULR TECH</span>
          <span>ENTERPRISE EDITION</span>
        </div>
      </div>

      {/* RIGHT COLUMN: Clean White Auth Panel */}
      <div className="w-full lg:w-5/12 flex flex-col justify-center items-center px-6 sm:px-12 py-16 bg-[#ffffff] min-h-screen">
        <div className="w-full max-w-sm">
          {/* Mobile-only logo */}
          <div className="lg:hidden text-center mb-8 flex justify-center">
            <Logo theme="light" height={32} showSubtitle={false} />
          </div>

          <div className="mb-8">
            <span className="mono-eyebrow text-[#f43f5e] font-bold block mb-1">OPERATOR CONSOLE</span>
            <h3 className="text-2xl font-bold tracking-tight text-[#111827]">
              {step === 'otp'
                ? 'Enter verification code'
                : mode === 'signup'
                ? 'Create your account'
                : 'Welcome back'}
            </h3>
            <p className="text-xs text-[#6b7280] mt-1 font-mono">
              {step === 'otp'
                ? `Enter the 8-digit code sent to ${email}`
                : 'Enter your email to receive an instant verification passcode.'}
            </p>
          </div>

          {/* Feedback message banner */}
          {message && (
            <div
              className={`mb-6 p-3.5 rounded-xl border text-xs font-mono flex items-start space-x-2.5 ${
                message.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-rose-50 border-rose-200 text-rose-800'
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
                  <label className="mono-eyebrow text-[#4b5563] font-semibold block mb-1.5">OPERATOR NAME</label>
                  <input
                    type="text"
                    placeholder="Aditya Dixit"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm border border-[#e5e7eb] rounded-xl focus:outline-none focus:border-[#f43f5e] focus:ring-2 focus:ring-rose-500/10 transition text-[#111827]"
                  />
                </div>
              )}

              <div>
                <label className="mono-eyebrow text-[#4b5563] font-semibold block mb-1.5">WORK EMAIL</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-[#9ca3af] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    placeholder="operator@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-3.5 py-2.5 text-sm border border-[#e5e7eb] rounded-xl focus:outline-none focus:border-[#f43f5e] focus:ring-2 focus:ring-rose-500/10 transition text-[#111827]"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#f43f5e] hover:bg-[#e11d48] text-white font-semibold py-3 rounded-full text-xs flex items-center justify-center space-x-2 transition mt-2 shadow-sm shadow-rose-500/20 active:scale-[0.99] tracking-wider"
              >
                <span>{loading ? 'SENDING CODE...' : 'CONTINUE WITH PASSCODE'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </form>
          ) : (
            <form onSubmit={handleFormSubmit} className="space-y-6">
              <div>
                <div className="flex justify-between items-center mb-3">
                  <label className="mono-eyebrow text-[#4b5563] font-semibold">8-DIGIT PASSCODE</label>
                  <button
                    type="button"
                    onClick={() => {
                      setStep('email');
                      setMessage(null);
                    }}
                    className="mono-eyebrow text-[10px] text-[#f43f5e] hover:underline"
                  >
                    Change Email
                  </button>
                </div>

                {/* 8 Digit Boxes with Auto-Advance */}
                <div className="grid grid-cols-8 gap-1.5 sm:gap-2">
                  {digits.map((digit, index) => (
                    <input
                      key={index}
                      ref={(el) => {
                        inputRefs.current[index] = el;
                      }}
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={OTP_LENGTH}
                      value={digit}
                      onChange={(e) => handleDigitChange(index, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(index, e)}
                      className={`h-12 text-center text-lg font-mono font-bold border rounded-xl focus:outline-none transition-all ${
                        digit
                          ? 'border-[#f43f5e] bg-[#fff1f2] text-[#f43f5e] shadow-sm'
                          : 'border-[#e5e7eb] bg-white text-[#111827] focus:border-[#f43f5e] focus:ring-2 focus:ring-rose-500/10'
                      }`}
                    />
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || digits.join('').length !== OTP_LENGTH}
                className="w-full bg-[#f43f5e] hover:bg-[#e11d48] text-white font-semibold py-3 rounded-full text-xs flex items-center justify-center space-x-2 transition shadow-sm shadow-rose-500/20 disabled:opacity-50 disabled:cursor-not-allowed tracking-wider"
              >
                <ShieldCheck className="w-4 h-4 text-white" />
                <span>{loading ? 'AUTHENTICATING...' : 'VERIFY & SIGN IN'}</span>
              </button>

              <button
                type="button"
                onClick={() => handleSendOtp()}
                disabled={loading}
                className="mono-eyebrow w-full text-center text-[11px] text-[#6b7280] hover:text-[#f43f5e] block transition"
              >
                Resend verification code
              </button>
            </form>
          )}

          {/* Mode Switcher */}
          <div className="mt-8 pt-6 border-t border-[#f3f4f6] flex items-center justify-between text-xs font-mono">
            {step === 'email' && mode === 'signin' ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setMode('signup');
                    setMessage(null);
                  }}
                  className="text-[#f43f5e] hover:underline"
                >
                  Create account
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('forgot');
                    setMessage(null);
                  }}
                  className="text-[#9ca3af] hover:text-[#4b5563]"
                >
                  Need help?
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setStep('email');
                  setMode('signin');
                  setMessage(null);
                }}
                className="text-[#f43f5e] hover:underline w-full text-center"
              >
                Back to Sign In
              </button>
            )}
          </div>

          {/* Compliance & Security Tag */}
          <div className="mt-12 text-center text-[10px] font-mono text-[#9ca3af] flex items-center justify-center space-x-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>PROTECTED BY SUPABASE ROW LEVEL SECURITY</span>
          </div>
        </div>
      </div>
    </div>
  );
}
