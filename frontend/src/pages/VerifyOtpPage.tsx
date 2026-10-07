import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  MailCheck,
  Mail,
  ArrowRight,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  Copy,
  Check,
  Clock,
  Terminal,
} from 'lucide-react';
import { AxiosError } from 'axios';

interface VerifyLocationState {
  email?: string;
  devOtp?: string;
  expiresIn?: number;
  cooldown?: number;
}

export const VerifyOtpPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { verifyOtp, resendOtp } = useAuth();

  const state = (location.state as VerifyLocationState) || {};
  const initialEmail = state.email || searchParams.get('email') || '';

  const [email, setEmail] = useState(initialEmail);
  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [devOtp, setDevOtp] = useState<string | null>(state.devOtp || null);
  const [copied, setCopied] = useState(false);

  const [cooldownLeft, setCooldownLeft] = useState<number>(state.devOtp ? state.cooldown || 30 : 0);
  const [ttlLeft, setTtlLeft] = useState<number>(state.devOtp ? state.expiresIn || 300 : 0);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);

  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  // Countdown timers for Redis cooldown and OTP TTL
  useEffect(() => {
    const timer = setInterval(() => {
      setCooldownLeft((prev) => (prev > 0 ? prev - 1 : 0));
      setTtlLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const otpValue = digits.join('');

  const handleDigitChange = (index: number, value: string) => {
    const cleaned = value.replace(/\D/g, '');
    if (!cleaned) {
      const next = [...digits];
      next[index] = '';
      setDigits(next);
      return;
    }

    // Handle multi-digit input or mobile autocomplete
    if (cleaned.length > 1) {
      const chars = cleaned.slice(0, 6).split('');
      const next = [...digits];
      chars.forEach((char, idx) => {
        if (index + idx < 6) {
          next[index + idx] = char;
        }
      });
      setDigits(next);
      const focusIdx = Math.min(index + chars.length, 5);
      inputRefs.current[focusIdx]?.focus();
      return;
    }

    const next = [...digits];
    next[index] = cleaned;
    setDigits(next);

    if (index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;
    const next = ['', '', '', '', '', ''];
    pasted.split('').forEach((ch, i) => {
      next[i] = ch;
    });
    setDigits(next);
    const focusIdx = Math.min(pasted.length, 5);
    inputRefs.current[focusIdx]?.focus();
  };

  const handleAutoFillDevOtp = () => {
    if (!devOtp) return;
    const chars = devOtp.replace(/\D/g, '').slice(0, 6).split('');
    const next = ['', '', '', '', '', ''];
    chars.forEach((c, i) => {
      next[i] = c;
    });
    setDigits(next);
    setErrorMessage(null);
  };

  const handleCopyDevOtp = async () => {
    if (!devOtp) return;
    try {
      await navigator.clipboard.writeText(devOtp);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback if clipboard API blocked
      handleAutoFillDevOtp();
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!email.trim() || !email.includes('@')) {
      setErrorMessage('Please enter a valid email address');
      return;
    }

    if (otpValue.length !== 6) {
      setErrorMessage('Please enter the 6-digit OTP verification code');
      return;
    }

    setIsVerifying(true);
    try {
      const res = await verifyOtp(email, otpValue);
      setSuccessMessage(res.message || 'Email verified successfully! Redirecting to sign in...');
      setTimeout(() => {
        navigate('/login', {
          state: {
            verifiedEmail: email.trim().toLowerCase(),
            verifiedMessage: 'Email verified successfully! You can now sign in.',
          },
        });
      }, 1400);
    } catch (err: unknown) {
      if (err instanceof AxiosError && err.response) {
        const data = err.response.data;
        if (typeof data?.detail === 'string') {
          setErrorMessage(data.detail);
        } else if (data?.detail?.message) {
          setErrorMessage(data.detail.message);
        } else {
          setErrorMessage('Verification failed. Please check your code and try again.');
        }
      } else {
        setErrorMessage('Unable to connect to the backend server.');
      }
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResendOtp = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!email.trim() || !email.includes('@')) {
      setErrorMessage('Please enter your email address first to generate an OTP');
      return;
    }

    setIsResending(true);
    try {
      const res = await resendOtp(email);
      const newOtp = res.dev_otp || res.otp || null;
      setDevOtp(newOtp);
      setDigits(['', '', '', '', '', '']);
      setCooldownLeft(res.cooldown || 30);
      setTtlLeft(res.expires_in || 300);
      setSuccessMessage(res.message || 'New development OTP generated in Redis!');
    } catch (err: unknown) {
      if (err instanceof AxiosError && err.response) {
        const data = err.response.data;
        const retryHeader = err.response.headers?.['retry-after'];
        if (retryHeader) {
          const secs = parseInt(String(retryHeader), 10);
          if (!Number.isNaN(secs)) setCooldownLeft(secs);
        } else if (data?.detail?.retry_after) {
          setCooldownLeft(Number(data.detail.retry_after));
        }

        if (typeof data?.detail === 'string') {
          setErrorMessage(data.detail);
        } else if (data?.detail?.message) {
          setErrorMessage(data.detail.message);
        } else {
          setErrorMessage('Could not resend OTP. Please wait before trying again.');
        }
      } else {
        setErrorMessage('Unable to connect to the backend server.');
      }
    } finally {
      setIsResending(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-12 relative overflow-hidden">
      {/* Ambient background glows */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none animate-glow" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-emerald-600/15 rounded-full blur-3xl pointer-events-none animate-glow" />

      <div className="w-full max-w-md relative z-10">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-500 to-emerald-500 shadow-xl shadow-indigo-500/25 mb-4 ring-1 ring-white/20">
            <MailCheck className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Verify Your Email</h1>
          <p className="mt-2 text-sm text-slate-400">
            Enter the 6-digit verification code stored in Redis
          </p>
        </div>

        {/* Main Card */}
        <div className="bg-slate-900/70 border border-slate-800/80 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
          {/* Development Mode Dummy OTP Display Box */}
          <div className="mb-6 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200">
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-300">
                <Terminal className="w-3.5 h-3.5 text-amber-400" />
                Dev Mode OTP (SMTP Bypassed)
              </span>
              {ttlLeft > 0 && devOtp && (
                <span className="inline-flex items-center gap-1 text-[11px] font-mono text-amber-300/90 bg-amber-500/15 px-2 py-0.5 rounded-md border border-amber-500/20">
                  <Clock className="w-3 h-3" />
                  TTL {formatTime(ttlLeft)}
                </span>
              )}
            </div>

            {devOtp ? (
              <div className="mt-2 flex items-center justify-between gap-3 bg-slate-950/80 border border-amber-500/30 rounded-xl px-4 py-2.5">
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-slate-400 block">
                    Active Redis OTP Code
                  </span>
                  <span className="font-mono text-xl font-extrabold tracking-[0.25em] text-amber-300">
                    {devOtp}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCopyDevOtp}
                    className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 transition-colors cursor-pointer"
                    title="Copy OTP"
                  >
                    {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                  <button
                    type="button"
                    onClick={handleAutoFillDevOtp}
                    className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                    Auto-fill
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-xs text-amber-200/80 flex items-center justify-between gap-2 mt-1">
                <span>No OTP loaded in session yet. Click resend below to generate a Redis OTP.</span>
              </div>
            )}
          </div>

          {/* Error Banner */}
          {errorMessage && (
            <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold text-rose-200">Verification Error</p>
                <p className="text-xs text-rose-300/90 mt-0.5">{errorMessage}</p>
              </div>
            </div>
          )}

          {/* Success Banner */}
          {successMessage && (
            <div className="mb-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold text-emerald-200">Success</p>
                <p className="text-xs text-emerald-300/90 mt-0.5">{successMessage}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleVerify} className="space-y-5">
            {/* Email Input */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Mail className="w-5 h-5" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="john@example.com"
                  className="w-full pl-11 pr-4 py-2.5 rounded-xl bg-slate-950/60 border border-slate-700/80 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
                  required
                />
              </div>
            </div>

            {/* 6-Digit OTP Boxes */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                  6-Digit Verification Code
                </label>
                {digits.some((d) => d !== '') && (
                  <button
                    type="button"
                    onClick={() => setDigits(['', '', '', '', '', ''])}
                    className="text-[11px] text-slate-400 hover:text-slate-200 cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>

              <div className="grid grid-cols-6 gap-2 sm:gap-3">
                {digits.map((digit, index) => (
                  <input
                    key={index}
                    ref={(el) => {
                      inputRefs.current[index] = el;
                    }}
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={digit}
                    onChange={(e) => handleDigitChange(index, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(index, e)}
                    onPaste={handlePaste}
                    className="w-full h-12 sm:h-14 text-center text-lg sm:text-xl font-bold font-mono rounded-xl bg-slate-950/80 border border-slate-700/80 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/60 focus:border-indigo-500 transition-all"
                  />
                ))}
              </div>
            </div>

            {/* Verify Submit Button */}
            <button
              type="submit"
              disabled={isVerifying || otpValue.length !== 6}
              className="w-full py-3 px-4 rounded-xl font-medium text-sm text-white bg-gradient-to-r from-indigo-600 via-indigo-500 to-emerald-600 hover:from-indigo-500 hover:to-emerald-500 shadow-lg shadow-indigo-600/30 hover:shadow-indigo-600/40 active:scale-[0.99] transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
            >
              {isVerifying ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  <span>Verifying with Redis...</span>
                </>
              ) : (
                <>
                  <span>Verify Email</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Resend / Generate OTP Section */}
          <div className="mt-6 pt-5 border-t border-slate-800/80 flex items-center justify-between text-xs">
            <span className="text-slate-400">Didn&apos;t receive or expired?</span>
            <button
              type="button"
              onClick={handleResendOtp}
              disabled={isResending || cooldownLeft > 0}
              className="inline-flex items-center gap-1.5 font-semibold text-indigo-400 hover:text-indigo-300 disabled:text-slate-500 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isResending ? 'animate-spin' : ''}`} />
              {cooldownLeft > 0 ? (
                <span>Resend available in {cooldownLeft}s</span>
              ) : (
                <span>{devOtp ? 'Resend New Dev OTP' : 'Generate Dev OTP'}</span>
              )}
            </button>
          </div>
        </div>

        {/* Footer Navigation */}
        <p className="mt-6 text-center text-sm text-slate-400">
          Already verified?{' '}
          <Link to="/login" className="font-semibold text-indigo-400 hover:text-indigo-300 transition-colors">
            Sign in here
          </Link>
        </p>
      </div>
    </div>
  );
};
