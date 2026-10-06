import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import {
  loginApi,
  registerApi,
  logoutApi,
  refreshApi,
  verifyOtpApi,
  resendOtpApi,
  type LoginPayload,
  type RegisterPayload,
  type AuthResponse,
} from '../api/auth';
import { subscribeToTokenRefresh } from '../api/axios';

export interface User {
  name: string;
  email: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  tokenRefreshStatus: 'idle' | 'refreshing' | 'refreshed' | 'failed';
  lastRefreshTime: string | null;
  refreshCount: number;
  login: (identifier: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<AuthResponse>;
  verifyOtp: (email: string, otp: string) => Promise<AuthResponse>;
  resendOtp: (email: string) => Promise<AuthResponse>;
  logout: () => Promise<void>;
  manualRefreshToken: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const USER_STORAGE_KEY = 'chat_app_user';

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem(USER_STORAGE_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return null;
      }
    }
    return null;
  });

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [tokenRefreshStatus, setTokenRefreshStatus] = useState<'idle' | 'refreshing' | 'refreshed' | 'failed'>('idle');
  const [lastRefreshTime, setLastRefreshTime] = useState<string | null>(null);
  const [refreshCount, setRefreshCount] = useState<number>(0);

  // Subscribe to Axios automatic token refresh events
  useEffect(() => {
    const unsubscribe = subscribeToTokenRefresh((status) => {
      setTokenRefreshStatus(status);
      if (status === 'refreshed') {
        setLastRefreshTime(new Date().toLocaleTimeString());
        setRefreshCount((prev) => prev + 1);
        setTimeout(() => setTokenRefreshStatus('idle'), 4000);
      } else if (status === 'failed') {
        setTimeout(() => setTokenRefreshStatus('idle'), 5000);
      }
    });

    // Listen for session expiry event from Axios interceptor
    const handleSessionExpired = () => {
      setUser(null);
      localStorage.removeItem(USER_STORAGE_KEY);
    };

    window.addEventListener('auth:session-expired', handleSessionExpired);

    return () => {
      unsubscribe();
      window.removeEventListener('auth:session-expired', handleSessionExpired);
    };
  }, []);

  const login = async (identifier: string, password: string) => {
    setIsLoading(true);
    try {
      const payload: LoginPayload = { password };
      if (identifier.includes('@')) {
        payload.email = identifier.trim();
      } else {
        payload.name = identifier.trim();
      }

      const res = await loginApi(payload);

      // Successfully logged in - backend set access_token and refresh_token cookies
      const userData: User = {
        name: res.user?.name || payload.name || identifier.split('@')[0],
        email: res.user?.email || payload.email || `${identifier}@example.com`,
      };

      setUser(userData);
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(userData));
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (name: string, email: string, password: string): Promise<AuthResponse> => {
    setIsLoading(true);
    try {
      const payload: RegisterPayload = {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
      };

      return await registerApi(payload);
    } finally {
      setIsLoading(false);
    }
  };

  const verifyOtp = async (email: string, otp: string): Promise<AuthResponse> => {
    setIsLoading(true);
    try {
      return await verifyOtpApi({
        email: email.trim().toLowerCase(),
        otp: otp.trim(),
      });
    } finally {
      setIsLoading(false);
    }
  };

  const resendOtp = async (email: string): Promise<AuthResponse> => {
    setIsLoading(true);
    try {
      return await resendOtpApi({
        email: email.trim().toLowerCase(),
      });
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await logoutApi();
    } catch (err) {
      console.warn('Backend logout error, clearing local session anyway:', err);
    } finally {
      setUser(null);
      localStorage.removeItem(USER_STORAGE_KEY);
      setIsLoading(false);
    }
  };

  const manualRefreshToken = async () => {
    setTokenRefreshStatus('refreshing');
    try {
      await refreshApi();
      setTokenRefreshStatus('refreshed');
      setLastRefreshTime(new Date().toLocaleTimeString());
      setRefreshCount((prev) => prev + 1);
      setTimeout(() => setTokenRefreshStatus('idle'), 4000);
    } catch (err) {
      setTokenRefreshStatus('failed');
      setTimeout(() => setTokenRefreshStatus('idle'), 5000);
      throw err;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        tokenRefreshStatus,
        lastRefreshTime,
        refreshCount,
        login,
        register,
        verifyOtp,
        resendOtp,
        logout,
        manualRefreshToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
