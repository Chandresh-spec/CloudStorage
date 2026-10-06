import api from './axios';

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
}

export interface LoginPayload {
  name?: string | null;
  email?: string | null;
  password: string;
}

export interface VerifyOtpPayload {
  email: string;
  otp: string;
}

export interface ResendOtpPayload {
  email: string;
}

export interface AuthResponse {
  status_code?: number;
  status?: string;
  detail?: string | { field?: string; code?: string; email?: string; retry_after?: number; message?: string };
  message?: string;
  requires_verification?: boolean;
  email?: string;
  otp?: string;
  dev_otp?: string;
  expires_in?: number;
  cooldown?: number;
  user?: {
    id: string;
    name: string;
    email: string;
    status?: string;
    is_verified?: boolean;
  };
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  status: string;
}

/**
 * Register a new user
 * Backend endpoint: POST /api/auth/register
 * Issues a Redis OTP and returns dev_otp in development mode
 */
export const registerApi = async (payload: RegisterPayload): Promise<AuthResponse> => {
  const response = await api.post<AuthResponse>('/api/auth/register', payload);
  return response.data;
};

/**
 * Verify email OTP code stored in Redis
 * Backend endpoint: POST /api/auth/verify-otp
 */
export const verifyOtpApi = async (payload: VerifyOtpPayload): Promise<AuthResponse> => {
  const response = await api.post<AuthResponse>('/api/auth/verify-otp', payload);
  return response.data;
};

/**
 * Resend email OTP code via Redis
 * Backend endpoint: POST /api/auth/resend-otp
 */
export const resendOtpApi = async (payload: ResendOtpPayload): Promise<AuthResponse> => {
  const response = await api.post<AuthResponse>('/api/auth/resend-otp', payload);
  return response.data;
};

/**
 * Login user
 * Backend endpoint: POST /api/auth/login
 * Backend sets HTTP-only cookies: access_token and refresh_token
 */
export const loginApi = async (payload: LoginPayload): Promise<AuthResponse> => {
  const response = await api.post<AuthResponse>('/api/auth/login', payload);
  return response.data;
};

/**
 * Refresh access token
 * Backend endpoint: POST /api/auth/refresh
 * Sends refresh_token cookie automatically and receives new access_token cookie
 */
export const refreshApi = async (): Promise<AuthResponse> => {
  const response = await api.post<AuthResponse>('/api/auth/refresh', {});
  return response.data;
};

/**
 * Logout user
 * Backend endpoint: POST /api/auth/logout
 * Deletes authentication cookies
 */
export const logoutApi = async (): Promise<AuthResponse> => {
  const response = await api.post<AuthResponse>('/api/auth/logout');
  return response.data;
};

/**
 * Get current authenticated user profile
 * Backend endpoint: GET /api/auth/me
 * Protected with access_token cookie
 */
export const getMeApi = async (): Promise<UserProfile> => {
  const response = await api.get<UserProfile>('/api/auth/me');
  return response.data;
};

