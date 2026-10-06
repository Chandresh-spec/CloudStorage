import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';

// Base API instance with credentials enabled for cookie support
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Refresh token state management
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: unknown) => void;
  reject: (reason?: unknown) => void;
}> = [];

// Event listeners for UI notifications (e.g. Toasts, status indicators)
type TokenRefreshCallback = (status: 'refreshing' | 'refreshed' | 'failed') => void;
const tokenListeners = new Set<TokenRefreshCallback>();

export const subscribeToTokenRefresh = (callback: TokenRefreshCallback) => {
  tokenListeners.add(callback);
  return () => {
    tokenListeners.delete(callback);
  };
};

const notifyTokenListeners = (status: 'refreshing' | 'refreshed' | 'failed') => {
  tokenListeners.forEach((listener) => listener(status));
};

const processQueue = (error: Error | null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve();
    }
  });
  failedQueue = [];
};

// Response interceptor to catch 401s and automatically refresh tokens
api.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // If no config or network error with no response, reject
    if (!originalRequest || !error.response) {
      return Promise.reject(error);
    }

    const is401 = error.response.status === 401;
    const isAuthUrl =
      originalRequest.url?.includes('/api/auth/login') ||
      originalRequest.url?.includes('/api/auth/register') ||
      originalRequest.url?.includes('/api/auth/verify-otp') ||
      originalRequest.url?.includes('/api/auth/resend-otp');
    const isRefreshUrl = originalRequest.url?.includes('/api/auth/refresh');

    // 1. If 401 happened during login/register, don't attempt refresh - just return the error
    if (is401 && isAuthUrl) {
      return Promise.reject(error);
    }

    // 2. If 401 happened during /refresh, the refresh token has expired or is invalid
    if (is401 && isRefreshUrl) {
      isRefreshing = false;
      processQueue(new Error('Refresh token expired'));
      notifyTokenListeners('failed');

      // Dispatch session expired event so the auth provider can redirect to login
      window.dispatchEvent(new CustomEvent('auth:session-expired'));
      return Promise.reject(error);
    }

    // 3. If 401 happened on any protected request and hasn't been retried yet
    if (is401 && !originalRequest._retry) {
      if (isRefreshing) {
        // Queue the request until the current refresh finishes
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then(() => {
            return api(originalRequest);
          })
          .catch((err) => {
            return Promise.reject(err);
          });
      }

      originalRequest._retry = true;
      isRefreshing = true;
      notifyTokenListeners('refreshing');

      try {
        // Automatically call the refresh token endpoint with credentials (cookies)
        await api.post('/api/auth/refresh', {}, { withCredentials: true });

        notifyTokenListeners('refreshed');
        processQueue(null);

        // Retry the original failed request
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError as Error);
        notifyTokenListeners('failed');
        window.dispatchEvent(new CustomEvent('auth:session-expired'));
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;
