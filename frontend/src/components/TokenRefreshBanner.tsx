import React from 'react';
import { useAuth } from '../context/AuthContext';
import { RefreshCw, CheckCircle2, AlertTriangle, ShieldCheck } from 'lucide-react';

export const TokenRefreshBanner: React.FC = () => {
  const { tokenRefreshStatus, lastRefreshTime, refreshCount } = useAuth();

  if (tokenRefreshStatus === 'idle' && refreshCount === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 transition-all duration-300 ease-out max-w-md">
      {tokenRefreshStatus === 'refreshing' && (
        <div className="flex items-center gap-3 bg-amber-950/90 border border-amber-500/50 text-amber-200 px-4 py-3 rounded-xl shadow-2xl backdrop-blur-md animate-pulse">
          <RefreshCw className="w-5 h-5 animate-spin text-amber-400 shrink-0" />
          <div className="text-sm">
            <p className="font-semibold text-amber-300">Access Token Expired</p>
            <p className="text-amber-200/80 text-xs">
              Axios interceptor is silently calling <code className="bg-amber-900/60 px-1 py-0.5 rounded">/api/auth/refresh</code>...
            </p>
          </div>
        </div>
      )}

      {tokenRefreshStatus === 'refreshed' && (
        <div className="flex items-center gap-3 bg-emerald-950/90 border border-emerald-500/50 text-emerald-200 px-4 py-3 rounded-xl shadow-2xl backdrop-blur-md">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <div className="text-sm">
            <p className="font-semibold text-emerald-300">Token Refreshed Automatically!</p>
            <p className="text-emerald-200/80 text-xs">
              New access token issued at {lastRefreshTime} (Auto-refreshed: {refreshCount}x)
            </p>
          </div>
        </div>
      )}

      {tokenRefreshStatus === 'failed' && (
        <div className="flex items-center gap-3 bg-rose-950/90 border border-rose-500/50 text-rose-200 px-4 py-3 rounded-xl shadow-2xl backdrop-blur-md">
          <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
          <div className="text-sm">
            <p className="font-semibold text-rose-300">Session Expired</p>
            <p className="text-rose-200/80 text-xs">
              Refresh token is invalid or expired. Please sign in again.
            </p>
          </div>
        </div>
      )}

      {tokenRefreshStatus === 'idle' && refreshCount > 0 && (
        <div className="hidden md:flex items-center gap-2 bg-slate-900/80 border border-slate-700/60 text-slate-300 px-3 py-1.5 rounded-lg shadow-lg backdrop-blur-sm text-xs">
          <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
          <span>Auto-refresh active (Refreshed {refreshCount}x, last at {lastRefreshTime})</span>
        </div>
      )}
    </div>
  );
};
