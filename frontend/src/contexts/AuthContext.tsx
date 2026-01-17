"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import {
  login as apiLogin,
  signup as apiSignup,
  getCurrentUser,
  getStoredToken,
  storeToken,
  removeToken,
  SignupData,
  LoginData,
  RecruiterInfo,
  OrganizationInfo,
} from "@/lib/authApi";

interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  recruiter: RecruiterInfo | null;
  organization: OrganizationInfo | null;
  token: string | null;
}

interface AuthContextType extends AuthState {
  login: (data: LoginData) => Promise<void>;
  signup: (data: SignupData) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    isAuthenticated: false,
    isLoading: true,
    recruiter: null,
    organization: null,
    token: null,
  });

  // Check for existing token on mount
  useEffect(() => {
    const initAuth = async () => {
      const token = getStoredToken();
      if (token) {
        try {
          const recruiter = await getCurrentUser(token);
          // Get organization from localStorage (stored during login/signup)
          const orgStr = localStorage.getItem("organization");
          const organization = orgStr ? JSON.parse(orgStr) : null;

          setState({
            isAuthenticated: true,
            isLoading: false,
            recruiter,
            organization,
            token,
          });
        } catch {
          // Token is invalid, clear it
          removeToken();
          localStorage.removeItem("organization");
          setState({
            isAuthenticated: false,
            isLoading: false,
            recruiter: null,
            organization: null,
            token: null,
          });
        }
      } else {
        setState((prev) => ({ ...prev, isLoading: false }));
      }
    };

    initAuth();
  }, []);

  const login = async (data: LoginData) => {
    const response = await apiLogin(data);
    storeToken(response.token);
    localStorage.setItem("organization", JSON.stringify(response.organization));

    setState({
      isAuthenticated: true,
      isLoading: false,
      recruiter: response.recruiter,
      organization: response.organization,
      token: response.token,
    });
  };

  const signup = async (data: SignupData) => {
    const response = await apiSignup(data);
    storeToken(response.token);
    localStorage.setItem("organization", JSON.stringify(response.organization));

    setState({
      isAuthenticated: true,
      isLoading: false,
      recruiter: response.recruiter,
      organization: response.organization,
      token: response.token,
    });
  };

  const logout = () => {
    removeToken();
    localStorage.removeItem("organization");
    setState({
      isAuthenticated: false,
      isLoading: false,
      recruiter: null,
      organization: null,
      token: null,
    });
  };

  const refreshUser = async () => {
    const token = getStoredToken();
    if (token) {
      const recruiter = await getCurrentUser(token);
      setState((prev) => ({ ...prev, recruiter }));
    }
  };

  return (
    <AuthContext.Provider
      value={{
        ...state,
        login,
        signup,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
