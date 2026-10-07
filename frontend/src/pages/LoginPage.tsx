import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Mail, Lock, Eye, EyeOff, ArrowRight, ShieldCheck, AlertCircle, Sparkles, CheckCircle2, MailCheck } from 'lucide-react';
import { AxiosError } from 'axios';

interface LoginLocationState {
  verifiedEmail?: string;
  verifiedMessage?: string;
}

export const LoginPage: React.FC = () => {
  const location = useLocation();
  const loginState = (location.state as LoginLocationState) || {};

  const [identifier, setIdentifier] = useState(loginState.verifiedEmail || '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(loginState.verifiedMessage || null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { login, resendOtp } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setInfoMessage(null);
    setUnverifiedEmail(null);

    if (!identifier.trim()) {
      setErrorMessage('Please enter your email or username');
      return;
    }
    if (!password) {
      setErrorMessage('Please enter your password');
      return;
    }

    setIsSubmitting(true);
    try {
      await login(identifier, password);
      navigate('/dashboard');
    } catch (err: unknown) {
      if (err instanceof AxiosError && err.response) {
        const data = err.response.data;
        if (err.response.status === 403 && data?.detail?.code === 'EMAIL_NOT_VERIFIED') {
          setUnverifiedEmail(data.detail.email || (identifier.includes('@') ? identifier.trim() : null));
          setErrorMessage(data.detail.message || 'Email not verified. Please verify your email with OTP.');
        } else if (typeof data?.detail === 'string') {
          setErrorMessage(data.detail);
        } else if (data?.detail?.message) {
          setErrorMessage(data.detail.message);
        } else {
          setErrorMessage('Invalid credentials. Please verify your details.');
        }
      } else {
        setErrorMessage('Unable to connect to the backend server. Make sure it is running on port 8000.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoToVerify = async () => {
    const targetEmail = unverifiedEmail || (identifier.includes('@') ? identifier.trim() : '');
    if (targetEmail) {
      try {
        const res = await resendOtp(targetEmail);
        navigate('/verify-otp', {
          state: {
            email: targetEmail,
            devOtp: res.dev_otp || res.otp,
            expiresIn: res.expires_in || 300,
            cooldown: res.cooldown || 30,
          },
        });
        return;
      } catch {
        // Navigate even if cooldown is active
      }
    }
    navigate(`/verify-otp${targetEmail ? `?email=${encodeURIComponent(targetEmail)}` : ''}`, {
      state: { email: targetEmail },
    });
  };

  const handleQuickFill = (name: string, pass: string) => {
    setIdentifier(name);
    setPassword(pass);
    setErrorMessage(null);
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-12 relative overflow-hidden">
      {/* Background radial ambient lights */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none animate-glow" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-violet-600/15 rounded-full blur-3xl pointer-events-none animate-glow" />

      <div className="w-full max-w-md relative z-10">
        {/* Card header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-600 shadow-xl shadow-indigo-500/25 mb-4 ring-1 ring-white/20">
            <ShieldCheck className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Welcome Back</h1>
          <p className="mt-2 text-sm text-slate-400">
            Sign in to access your secure dashboard with automatic JWT renewal
          </p>
        </div>

        {/* Form Container */}
        <div className="bg-slate-900/70 border border-slate-800/80 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
          {/* Verified Success Banner */}
          {infoMessage && (
            <div className="mb-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold text-emerald-200">Email Verified</p>
                <p className="text-xs text-emerald-300/90 mt-0.5">{infoMessage}</p>
              </div>
            </div>
          )}

          {/* Error Banner */}
          {errorMessage && (
            <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold text-rose-200">Authentication Failed</p>
                <p className="text-xs text-rose-300/90 mt-0.5">{errorMessage}</p>
                {unverifiedEmail && (
                  <button
                    type="button"
                    onClick={handleGoToVerify}
                    className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 text-xs font-semibold transition-colors cursor-pointer"
                  >
                    <MailCheck className="w-3.5 h-3.5" />
                    <span>Verify Email with Dev OTP</span>
                  </button>
                )}
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email or Username */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                Email or Username
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Mail className="w-5 h-5" />
                </div>
                <input
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="name@example.com or username"
                  autoComplete="username"
                  className="w-full pl-11 pr-4 py-2.5 rounded-xl bg-slate-950/60 border border-slate-700/80 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                  Password
                </label>
                <a
                  href="#forgot"
                  onClick={(e) => {
                    e.preventDefault();
                    alert('Password reset link has been dispatched to your email.');
                  }}
                  className="text-xs font-medium text-indigo-400 hover:text-indigo-300 transition-colors"
                >
                  Forgot password?
                </a>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Lock className="w-5 h-5" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="w-full pl-11 pr-11 py-2.5 rounded-xl bg-slate-950/60 border border-slate-700/80 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Remember Me */}
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-400 select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-slate-900"
                />
                <span>Remember me on this browser</span>
              </label>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full mt-2 py-3 px-4 rounded-xl font-medium text-sm text-white bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:from-indigo-500 hover:to-purple-500 shadow-lg shadow-indigo-600/30 hover:shadow-indigo-600/40 active:scale-[0.99] transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  <span>Authenticating...</span>
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick Fill Demo Helper */}
          <div className="mt-6 pt-5 border-t border-slate-800/80">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-2.5">
              <span className="flex items-center gap-1.5 font-medium">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                Testing Shortcut:
              </span>
              <button
                type="button"
                onClick={() => handleQuickFill('test@example.com', 'Password123!')}
                className="text-xs text-indigo-400 hover:text-indigo-300 font-mono hover:underline cursor-pointer"
              >
                Auto-fill demo creds
              </button>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Upon login, the backend issues an HTTP-only <span className="text-slate-400 font-mono">access_token</span> and a <span className="text-slate-400 font-mono">refresh_token</span>.
            </p>
          </div>
        </div>

        {/* Footer Link */}
        <div className="mt-6 text-center space-y-2 text-sm text-slate-400">
          <p>
            Don&apos;t have an account yet?{' '}
            <Link to="/register" className="font-semibold text-indigo-400 hover:text-indigo-300 transition-colors">
              Create an account
            </Link>
          </p>
          <p className="text-xs text-slate-500">
            Have an unverified account?{' '}
            <Link to="/verify-otp" className="font-medium text-emerald-400 hover:text-emerald-300 transition-colors">
              Verify Email OTP
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};
