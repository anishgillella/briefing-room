/**
 * Authentication API client
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export interface RecruiterInfo {
  id: string;
  name: string;
  email: string;
  role: string;
}

export interface OrganizationInfo {
  id: string;
  name: string;
  slug: string;
}

export interface AuthResponse {
  token: string;
  recruiter: RecruiterInfo;
  organization: OrganizationInfo;
}

export interface SignupData {
  name: string;
  email: string;
  password: string;
}

export interface LoginData {
  email: string;
  password: string;
}

/**
 * Sign up a new recruiter
 */
export async function signup(data: SignupData): Promise<AuthResponse> {
  const response = await fetch(`${API_URL}/api/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Signup failed');
  }

  return response.json();
}

/**
 * Log in an existing recruiter
 */
export async function login(data: LoginData): Promise<AuthResponse> {
  const response = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Login failed');
  }

  return response.json();
}

/**
 * Get current user info
 */
export async function getCurrentUser(token: string): Promise<RecruiterInfo> {
  const response = await fetch(`${API_URL}/api/auth/me`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error('Failed to get user info');
  }

  return response.json();
}

/**
 * Get stored auth token
 */
export function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('auth_token');
}

/**
 * Store auth token
 */
export function storeToken(token: string): void {
  localStorage.setItem('auth_token', token);
}

/**
 * Remove auth token
 */
export function removeToken(): void {
  localStorage.removeItem('auth_token');
}

/**
 * Get auth header for API requests
 */
export function getAuthHeader(): Record<string, string> {
  const token = getStoredToken();
  if (!token) return {};
  return { 'Authorization': `Bearer ${token}` };
}
