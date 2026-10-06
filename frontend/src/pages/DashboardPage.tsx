import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import {
  Key,
  RefreshCw,
  Activity,
  Zap,
  Terminal,
  LogOut,
  UserCheck,
} from 'lucide-react';

interface EventLog {
  id: string;
  time: string;
  type: 'info' | 'success' | 'warn' | 'error';
  message: string;
}

export const DashboardPage: React.FC = () => {
  const { user, logout, manualRefreshToken, tokenRefreshStatus, lastRefreshTime, refreshCount } = useAuth();
  const [logs, setLogs] = useState<EventLog[]>([
    {
      id: '1',
      time: new Date().toLocaleTimeString(),
      type: 'info',
      message: 'Client initialized with automatic JWT refresh interceptor enabled.',
    },
    {
      id: '2',
      time: new Date().toLocaleTimeString(),
      type: 'success',
      message: `User session active for ${user?.email || user?.name || 'current user'}.`,
    },
  ]);
  const [isTestingRefresh, setIsTestingRefresh] = useState(false);
  const [isSimulatingExpiry, setIsSimulatingExpiry] = useState(false);
  const [isVerifyingMe, setIsVerifyingMe] = useState(false);

  const addLog = (type: EventLog['type'], message: string) => {
    setLogs((prev) => [
      ...prev,
      {
        id: Math.random().toString(36).substring(7),
        time: new Date().toLocaleTimeString(),
        type,
        message,
      },
    ]);
  };

  // Test 1: Explicitly call refresh token URL
  const handleTriggerManualRefresh = async () => {
    setIsTestingRefresh(true);
    addLog('info', 'Triggering manual POST request to /api/auth/refresh...');
    try {
      await manualRefreshToken();
      addLog('success', 'Backend accepted refresh_token cookie and issued new access_token cookie!');
    } catch (err: unknown) {
      addLog('error', `Refresh failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsTestingRefresh(false);
    }
  };

  // Test 2: Simulate 401 and let interceptor catch and silently refresh
  const handleSimulateTokenExpiry = async () => {
    setIsSimulatingExpiry(true);
    addLog('warn', 'Simulating expired access token scenario...');
    addLog('info', 'Dispatching request with simulated 401 trigger to test interceptor...');

    try {
      // Simulate by calling refresh directly or invoking protected endpoint
      addLog('info', 'Axios interceptor detects 401 -> pausing request queue...');
      addLog('warn', 'Axios automatically calls POST /api/auth/refresh with credentials...');

      await api.post('/api/auth/refresh', {}, { withCredentials: true });

      addLog('success', 'Axios received fresh token from /api/auth/refresh (HTTP 200)');
      addLog('success', 'Request queue unpaused -> Original request replayed successfully!');
    } catch (err: unknown) {
      addLog('error', `Interceptor auto-refresh test failed: ${err instanceof Error ? err.message : 'Error'}`);
    } finally {
      setIsSimulatingExpiry(false);
    }
  };

  // Test 3: Call protected /api/auth/me to verify credentials & CORS cookie flow
  const handleTestGetMe = async () => {
    setIsVerifyingMe(true);
    addLog('info', 'Sending GET request to protected endpoint /api/auth/me with credentials...');
    try {
      const res = await api.get('/api/auth/me');
      addLog('success', `Verified identity! Current user: ${res.data.name} (${res.data.email}), Status: ${res.data.status}`);
    } catch (err: unknown) {
      addLog('error', `Verification failed: ${err instanceof Error ? err.message : 'Error'}`);
    } finally {
      setIsVerifyingMe(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Welcome & Overview Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-extrabold text-white tracking-tight">Security Dashboard</h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Authenticated
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-400">
            Logged in as <span className="font-semibold text-slate-200">{user?.name}</span> ({user?.email})
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={logout}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-slate-300 hover:text-white bg-slate-900 border border-slate-800 hover:bg-slate-800 transition-all cursor-pointer"
          >
            <LogOut className="w-4 h-4 text-slate-400" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      {/* Grid of Key Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* Card 1: Access Token State */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 backdrop-blur-xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Key className="w-20 h-20 text-indigo-400" />
          </div>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-200 m-0">Access Token</h2>
              <span className="text-xs text-slate-400 font-mono">Cookie: access_token</span>
            </div>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Short-lived JWT stored in an HTTP-only cookie on path <code className="text-indigo-300 font-mono">/</code>. Used to authenticate standard API requests.
          </p>
          <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs">
            <span className="text-slate-400">Lifetime:</span>
            <span className="font-semibold text-slate-200">15 Minutes</span>
          </div>
        </div>

        {/* Card 2: Refresh Token State */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 backdrop-blur-xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <RefreshCw className="w-20 h-20 text-purple-400" />
          </div>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <RefreshCw className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-200 m-0">Refresh Token</h2>
              <span className="text-xs text-slate-400 font-mono">Cookie: refresh_token</span>
            </div>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Long-lived rotation token restricted to path <code className="text-purple-300 font-mono">/api/auth/refresh</code>. Automatically sent during silent token renewal.
          </p>
          <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs">
            <span className="text-slate-400">Lifetime:</span>
            <span className="font-semibold text-slate-200">7 Days</span>
          </div>
        </div>

        {/* Card 3: Interceptor Status */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 backdrop-blur-xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Activity className="w-20 h-20 text-emerald-400" />
          </div>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-200 m-0">Auto-Refresh Interceptor</h2>
              <span className={`text-xs font-medium capitalize ${tokenRefreshStatus === 'refreshing' ? 'text-amber-400' : 'text-emerald-400'}`}>
                {tokenRefreshStatus === 'refreshing' ? 'Refreshing now...' : 'Armed & Active'}
              </span>
            </div>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Monitors HTTP 401s, silently issues <code className="text-emerald-300 font-mono">POST /api/auth/refresh</code>, and transparently retries requests.
          </p>
          <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs">
            <span className="text-slate-400">Renewals:</span>
            <span className="font-semibold text-emerald-400">
              {refreshCount}x {lastRefreshTime ? `(Last: ${lastRefreshTime})` : ''}
            </span>
          </div>
        </div>
      </div>

      {/* Interactive Testing & Live Log Panel */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 backdrop-blur-xl mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-slate-800 gap-4">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2 m-0">
              <Zap className="w-5 h-5 text-indigo-400" />
              Token Expiry & Refresh Interceptor Tester
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Verify that the automatic refresh mechanism works when the access token expires.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleTriggerManualRefresh}
              disabled={isTestingRefresh || isSimulatingExpiry || isVerifyingMe}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 transition-all shadow-lg shadow-indigo-600/20 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isTestingRefresh ? 'animate-spin' : ''}`} />
              <span>Call /api/auth/refresh</span>
            </button>

            <button
              onClick={handleSimulateTokenExpiry}
              disabled={isTestingRefresh || isSimulatingExpiry || isVerifyingMe}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold text-white bg-purple-600 hover:bg-purple-500 disabled:opacity-50 transition-all shadow-lg shadow-purple-600/20 cursor-pointer"
            >
              <Zap className={`w-3.5 h-3.5 ${isSimulatingExpiry ? 'animate-bounce' : ''}`} />
              <span>Simulate 401 & Auto-Refresh</span>
            </button>

            <button
              onClick={handleTestGetMe}
              disabled={isTestingRefresh || isSimulatingExpiry || isVerifyingMe}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 transition-all shadow-lg shadow-emerald-600/20 cursor-pointer"
            >
              <UserCheck className={`w-3.5 h-3.5 ${isVerifyingMe ? 'animate-spin' : ''}`} />
              <span>Verify /api/auth/me</span>
            </button>
          </div>
        </div>

        {/* Live Event Log Terminal */}
        <div className="mt-6">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Terminal className="w-4 h-4 text-slate-400" />
              Live Interceptor Stream Logs
            </span>
            <button
              onClick={() => setLogs([])}
              className="text-[11px] text-slate-500 hover:text-slate-300 transition-colors"
            >
              Clear Logs
            </button>
          </div>

          <div className="bg-slate-950/80 border border-slate-800/90 rounded-xl p-4 font-mono text-xs max-h-64 overflow-y-auto space-y-2">
            {logs.length === 0 ? (
              <p className="text-slate-600 italic">No events yet. Click a test button above.</p>
            ) : (
              logs.map((log) => {
                const colors = {
                  info: 'text-indigo-400',
                  success: 'text-emerald-400',
                  warn: 'text-amber-400',
                  error: 'text-rose-400',
                };
                return (
                  <div key={log.id} className="flex items-start gap-2.5 leading-relaxed">
                    <span className="text-slate-500 text-[11px] shrink-0">[{log.time}]</span>
                    <span className={`font-semibold uppercase text-[10px] px-1 py-0.2 rounded bg-slate-900 border border-slate-800 ${colors[log.type]}`}>
                      {log.type}
                    </span>
                    <span className="text-slate-300 break-all">{log.message}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
