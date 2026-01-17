# Phase 3: Frontend Authentication

## Status: PENDING

## Overview

This phase implements the frontend authentication system including login/signup pages, AuthContext for global state, protected routes, and updating the existing RecruiterContext to use authenticated user data.

## File Structure

```
frontend/src/
├── app/
│   ├── login/
│   │   └── page.tsx           # Login page (NEW)
│   ├── signup/
│   │   └── page.tsx           # Signup page (NEW)
│   └── layout.tsx             # Update with AuthProvider
├── contexts/
│   ├── AuthContext.tsx        # Auth state management (NEW)
│   └── RecruiterContext.tsx   # Update to use auth
├── lib/
│   └── authApi.ts             # Auth API calls (NEW)
├── components/
│   └── auth/
│       ├── LoginForm.tsx      # Login form component (NEW)
│       ├── SignupForm.tsx     # Signup form component (NEW)
│       └── ProtectedRoute.tsx # Route guard (NEW)
└── middleware.ts              # Next.js auth middleware (NEW)
```

## Implementation

### 1. Auth API Client (`frontend/src/lib/authApi.ts`)

```typescript
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
```

### 2. Auth Context (`frontend/src/contexts/AuthContext.tsx`)

```typescript
'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import {
  RecruiterInfo,
  OrganizationInfo,
  AuthResponse,
  login as apiLogin,
  signup as apiSignup,
  getCurrentUser,
  getStoredToken,
  storeToken,
  removeToken,
  SignupData,
  LoginData,
} from '@/lib/authApi';

interface AuthContextType {
  user: RecruiterInfo | null;
  organization: OrganizationInfo | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (data: LoginData) => Promise<void>;
  signup: (data: SignupData) => Promise<void>;
  logout: () => void;
  token: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<RecruiterInfo | null>(null);
  const [organization, setOrganization] = useState<OrganizationInfo | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  // Check for existing token on mount
  useEffect(() => {
    const initAuth = async () => {
      const storedToken = getStoredToken();

      if (storedToken) {
        try {
          const userInfo = await getCurrentUser(storedToken);
          setUser(userInfo);
          setToken(storedToken);

          // Get org info from stored data
          const storedOrg = localStorage.getItem('auth_organization');
          if (storedOrg) {
            setOrganization(JSON.parse(storedOrg));
          }
        } catch (error) {
          // Token invalid or expired
          removeToken();
          localStorage.removeItem('auth_organization');
        }
      }

      setIsLoading(false);
    };

    initAuth();
  }, []);

  const handleAuthResponse = (response: AuthResponse) => {
    storeToken(response.token);
    localStorage.setItem('auth_organization', JSON.stringify(response.organization));

    setToken(response.token);
    setUser(response.recruiter);
    setOrganization(response.organization);
  };

  const login = async (data: LoginData) => {
    const response = await apiLogin(data);
    handleAuthResponse(response);
    router.push('/dashboard');
  };

  const signup = async (data: SignupData) => {
    const response = await apiSignup(data);
    handleAuthResponse(response);
    router.push('/dashboard');
  };

  const logout = () => {
    removeToken();
    localStorage.removeItem('auth_organization');
    setToken(null);
    setUser(null);
    setOrganization(null);
    router.push('/login');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        organization,
        isAuthenticated: !!user,
        isLoading,
        login,
        signup,
        logout,
        token,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
```

### 3. Login Page (`frontend/src/app/login/page.tsx`)

```typescript
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { Mail, Lock, LogIn, AlertCircle } from 'lucide-react';

export default function LoginPage() {
  const { login, isLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      await login({ email, password });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo/Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Briefing Room</h1>
          <p className="text-zinc-400">Sign in to your account</p>
        </div>

        {/* Login Form */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Error Message */}
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 flex items-center gap-2 text-red-400">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span className="text-sm">{error}</span>
              </div>
            )}

            {/* Email Field */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-zinc-300 mb-2">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  required
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg pl-10 pr-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-zinc-300 mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg pl-10 pr-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting || isLoading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 text-white font-medium py-3 rounded-lg flex items-center justify-center gap-2 transition-colors"
            >
              {isSubmitting ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <LogIn className="w-5 h-5" />
                  Sign In
                </>
              )}
            </button>
          </form>

          {/* Signup Link */}
          <div className="mt-6 text-center text-sm text-zinc-400">
            Don&apos;t have an account?{' '}
            <Link href="/signup" className="text-blue-400 hover:text-blue-300">
              Sign up
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
```

### 4. Signup Page (`frontend/src/app/signup/page.tsx`)

```typescript
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { Mail, Lock, User, UserPlus, AlertCircle } from 'lucide-react';

export default function SignupPage() {
  const { signup, isLoading } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validate passwords match
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    // Validate password strength
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setIsSubmitting(true);

    try {
      await signup({ name, email, password });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Signup failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo/Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Briefing Room</h1>
          <p className="text-zinc-400">Create your account</p>
        </div>

        {/* Signup Form */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Error Message */}
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 flex items-center gap-2 text-red-400">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span className="text-sm">{error}</span>
              </div>
            )}

            {/* Name Field */}
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-zinc-300 mb-2">
                Full Name
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="John Doe"
                  required
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg pl-10 pr-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Email Field */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-zinc-300 mb-2">
                Work Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  required
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg pl-10 pr-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-zinc-300 mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  required
                  minLength={8}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg pl-10 pr-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Confirm Password Field */}
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-zinc-300 mb-2">
                Confirm Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm your password"
                  required
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg pl-10 pr-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting || isLoading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 text-white font-medium py-3 rounded-lg flex items-center justify-center gap-2 transition-colors"
            >
              {isSubmitting ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <UserPlus className="w-5 h-5" />
                  Create Account
                </>
              )}
            </button>
          </form>

          {/* Login Link */}
          <div className="mt-6 text-center text-sm text-zinc-400">
            Already have an account?{' '}
            <Link href="/login" className="text-blue-400 hover:text-blue-300">
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
```

### 5. Protected Route Component (`frontend/src/components/auth/ProtectedRoute.tsx`)

```typescript
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}
```

### 6. Update Layout (`frontend/src/app/layout.tsx`)

Wrap the app with AuthProvider:

```typescript
import { AuthProvider } from '@/contexts/AuthContext';
import { RecruiterProvider } from '@/contexts/RecruiterContext';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <RecruiterProvider>
            {children}
          </RecruiterProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
```

### 7. Update RecruiterContext to Use Auth

Update `frontend/src/contexts/RecruiterContext.tsx` to use the authenticated user:

```typescript
// In RecruiterContext.tsx, add integration with AuthContext
import { useAuth } from './AuthContext';

export function RecruiterProvider({ children }: { children: React.ReactNode }) {
  const { user, organization, isAuthenticated } = useAuth();

  // When user is authenticated, use their info as current recruiter
  useEffect(() => {
    if (isAuthenticated && user) {
      setCurrentRecruiter({
        id: user.id,
        name: user.name,
        email: user.email,
        // ... map other fields
      });
    }
  }, [isAuthenticated, user]);

  // Rest of existing logic...
}
```

### 8. Add User Menu to Dashboard Nav

Add logout and user info to the navigation:

```typescript
// In DashboardNav or Header component
import { useAuth } from '@/contexts/AuthContext';

function UserMenu() {
  const { user, organization, logout } = useAuth();

  return (
    <div className="flex items-center gap-4">
      <div className="text-right">
        <p className="text-sm font-medium text-white">{user?.name}</p>
        <p className="text-xs text-zinc-400">{organization?.name}</p>
      </div>
      <button
        onClick={logout}
        className="text-zinc-400 hover:text-white transition-colors"
      >
        <LogOut className="w-5 h-5" />
      </button>
    </div>
  );
}
```

## Route Protection Strategy

| Route | Protection | Redirect |
|-------|------------|----------|
| `/login` | Public | → `/dashboard` if authenticated |
| `/signup` | Public | → `/dashboard` if authenticated |
| `/dashboard/*` | Protected | → `/login` if not authenticated |
| `/jobs/*` | Protected | → `/login` if not authenticated |
| `/candidates/*` | Protected | → `/login` if not authenticated |
| `/` | Public | Landing page |

## Testing Checklist

- [ ] Can signup with valid credentials
- [ ] Cannot signup with existing email
- [ ] Can login with correct credentials
- [ ] Cannot login with wrong password
- [ ] Token persists after page refresh
- [ ] Logout clears token and redirects
- [ ] Protected routes redirect to login
- [ ] User info displays in nav
- [ ] API calls include auth header

## Next Phase

Once auth frontend is complete, proceed to [Phase 4: Organization Scoping](./phase4-org-scoping.md) to update all queries to filter by organization.
