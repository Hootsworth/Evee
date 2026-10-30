'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Logo from '@/components/Logo';
import { Mail, ArrowRight, ShieldCheck, CheckCircle2, AlertCircle } from 'lucide-react';

export default function AuthPage() {
  const router = useRouter();
  const supabase = createClient();

  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot'>('signin');
  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Dynamic digit inputs (supports 6, 8, or variable length OTP)
  // Defaulting to 8 digit boxes to match your Supabase OTP template
  const OTP_LENGTH = 8;
  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Auto-focus first digit input when transitioning to OTP step
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
    // If pasted full string (e.g. 8 digits or 6 digits)
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
      } else if (data.session) {
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
    const code = digits.join('');
    verifyCode(code);
  };

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-[#080915] text-white select-none">
      {/* LEFT COLUMN: Flat Artistic Studio Edition */}
      <div className="hidden lg:flex lg:w-7/12 flex-col justify-between p-16 relative border-r border-white/[0.08] bg-[#0c0d1c] overflow-hidden">
        {/* Flat Abstract Geometric Art Background */}
        <div className="absolute inset-0 pointer-events-none opacity-40">
          <div className="absolute -top-24 -left-20 w-[420px] h-[420px] rounded-full bg-[#f43f5e] opacity-25 filter blur-[90px]"></div>
          <div className="absolute top-1/2 -right-16 w-[360px] h-[360px] rounded-full bg-[#38bdf8] opacity-20 filter blur-[100px]"></div>
          <div className="absolute -bottom-20 left-1/3 w-[380px] h-[380px] rounded-full bg-[#a855f7] opacity-20 filter blur-[90px]"></div>

          <svg className="absolute inset-0 w-full h-full opacity-15" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="art-grid" width="48" height="48" patternUnits="userSpaceOnUse">
                <circle cx="2" cy="2" r="1" fill="#ffffff" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#art-grid)" />
          </svg>
        </div>

        {/* Brand Header */}
        <div className="relative z-10 flex items-center">
          <Logo theme="dark" height={38} showSubtitle={true} />
        </div>

        {/* Narrative & Editorial Centerpiece */}
        <div className="relative z-10 max-w-xl my-auto py-10">
          <div className="inline-flex items-center space-x-2.5 px-3 py-1 rounded-full bg-white/[0.06] border border-white/10 mb-8 backdrop-blur-sm">
            <span className="w-2 h-2 rounded-full bg-[#f43f5e]"></span>
            <span className="w-2 h-2 rounded-full bg-[#38bdf8]"></span>
            <span className="w-2 h-2 rounded-full bg-[#c084fc]"></span>
            <span className="text-[11px] font-mono tracking-wider text-white/80 pl-1 uppercase">
              STUDIO EDITION
            </span>
          </div>

          <h2 className="text-4xl xl:text-5xl font-medium tracking-tight text-white leading-[1.2] mb-6 font-serif">
            Outreach crafted like an editorial piece, grounded in observation.
          </h2>

          <p className="text-white/65 text-base leading-relaxed mb-10 font-normal">
            Evee observes public business surfaces, notices missing customer workflows, and composes bespoke correspondence with human precision.
          </p>

          <div className="grid grid-cols-3 gap-3.5 pt-2">
            <div className="bg-[#15172b] border border-[#262842] rounded-lg p-4">
              <div className="w-3 h-3 rounded-full bg-[#f43f5e] mb-2.5"></div>
              <div className="text-xs font-semibold text-white">Observation</div>
              <div className="text-[11px] text-white/50 mt-1 font-mono">Empirical facts</div>
            </div>

            <div className="bg-[#15172b] border border-[#262842] rounded-lg p-4">
              <div className="w-3 h-3 rounded-full bg-[#38bdf8] mb-2.5"></div>
              <div className="text-xs font-semibold text-white">Qualification</div>
              <div className="text-[11px] text-white/50 mt-1 font-mono">100-pt evidence</div>
            </div>

            <div className="bg-[#15172b] border border-[#262842] rounded-lg p-4">
              <div className="w-3 h-3 rounded-full bg-[#c084fc] mb-2.5"></div>
              <div className="text-xs font-semibold text-white">Governance</div>
              <div className="text-[11px] text-white/50 mt-1 font-mono">Fail-closed gate</div>
            </div>
          </div>
        </div>

        {/* Footer Signature */}
        <div className="relative z-10 flex items-center justify-between text-xs font-mono text-white/40 pt-6 border-t border-white/[0.08]">
          <span>EVEE PLATFORM • SINGULR TECH</span>
          <span>EST. 2026</span>
        </div>
      </div>

      {/* RIGHT COLUMN: The High-Contrast Authentication Form with 8-Digit Box Design */}
      <div className="w-full lg:w-5/12 flex flex-col justify-center items-center px-4 sm:px-10 py-16 bg-white text-black min-h-screen">
        <div className="w-full max-w-md">
          {/* Mobile-only brand logo */}
          <div className="lg:hidden text-center mb-8 flex justify-center">
            <Logo theme="light" height={32} showSubtitle={true} />
          </div>

          {/* Form Header */}
          <div className="mb-8">
            <span className="mono-eyebrow text-black/40 block mb-1">OPERATOR ACCESS</span>
            <h3 className="text-2xl font-medium tracking-tight text-black">
              {step === 'otp'
                ? 'Enter verification code'
                : mode === 'signup'
                ? 'Create an account'
                : 'Sign in to Console'}
            </h3>
            <p className="text-xs text-black/60 mt-1 font-mono">
              {step === 'otp'
                ? `Enter the 8-digit code sent to ${email}`
                : 'Enter your email to receive an instant verification passcode.'}
            </p>
          </div>

          {/* Feedback message banner */}
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
            <form onSubmit={handleFormSubmit} className="space-y-6">
              <div>
                <div className="flex justify-between items-center mb-3">
                  <label className="mono-eyebrow text-black/60">8-DIGIT PASSCODE</label>
                  <button
                    type="button"
                    onClick={() => {
                      setStep('email');
                      setMessage(null);
                    }}
                    className="mono-eyebrow text-[10px] text-black/40 hover:text-black underline"
                  >
                    Change Email
                  </button>
                </div>

                {/* 8 Individual Digit Boxes */}
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
                      className={`h-12 text-center text-lg font-mono font-bold border rounded-md focus:outline-none transition-all ${
                        digit
                          ? 'border-black bg-black/[0.02] text-black shadow-sm'
                          : 'border-black/20 bg-white text-black/90 focus:border-black focus:ring-2 focus:ring-black/10'
                      }`}
                    />
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || digits.join('').length !== OTP_LENGTH}
                className="mono-btn w-full bg-black text-white hover:bg-black/85 disabled:opacity-50 disabled:cursor-not-allowed py-3.5 rounded-[4px] text-xs flex items-center justify-center space-x-2 transition tracking-wider"
              >
                <ShieldCheck className="w-4 h-4 text-[#c8f6f9]" />
                <span>{loading ? 'AUTHENTICATING...' : 'VERIFY & SIGN IN'}</span>
              </button>

              <button
                type="button"
                onClick={() => handleSendOtp()}
                disabled={loading}
                className="mono-eyebrow w-full text-center text-[11px] text-black/50 hover:text-black block transition"
              >
                Resend verification code
              </button>
            </form>
          )}

          {/* Mode Switcher */}
          <div className="mt-8 pt-6 border-t border-black/[0.08] flex items-center justify-between text-xs font-mono">
            {step === 'email' && mode === 'signin' ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setMode('signup');
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
                  setStep('email');
                  setMode('signin');
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
