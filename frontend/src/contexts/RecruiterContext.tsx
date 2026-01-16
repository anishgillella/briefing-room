"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Recruiter {
  id: string;
  name: string;
  email: string;
  job_count?: number;
  active_job_count?: number;
}

interface RecruiterContextType {
  currentRecruiter: Recruiter | null;
  recruiters: Recruiter[];
  loading: boolean;
  setCurrentRecruiter: (recruiter: Recruiter | null) => void;
  refreshRecruiters: () => Promise<void>;
  createRecruiter: (name: string, email: string) => Promise<Recruiter>;
}

const RecruiterContext = createContext<RecruiterContextType | undefined>(undefined);

export function RecruiterProvider({ children }: { children: ReactNode }) {
  const [currentRecruiter, setCurrentRecruiterState] = useState<Recruiter | null>(null);
  const [recruiters, setRecruiters] = useState<Recruiter[]>([]);
  const [loading, setLoading] = useState(true);

  // Load recruiters on mount
  useEffect(() => {
    refreshRecruiters();
  }, []);

  // Persist current recruiter to localStorage
  useEffect(() => {
    if (currentRecruiter) {
      localStorage.setItem("currentRecruiterId", currentRecruiter.id);
    }
  }, [currentRecruiter]);

  // Restore current recruiter from localStorage
  useEffect(() => {
    const savedId = localStorage.getItem("currentRecruiterId");
    if (savedId && recruiters.length > 0) {
      const saved = recruiters.find((r) => r.id === savedId);
      if (saved) {
        setCurrentRecruiterState(saved);
      }
    }
  }, [recruiters]);

  const refreshRecruiters = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/api/recruiters`);
      if (response.ok) {
        const data = await response.json();
        setRecruiters(data);
      }
    } catch (error) {
      console.error("Failed to fetch recruiters:", error);
    } finally {
      setLoading(false);
    }
  };

  const setCurrentRecruiter = (recruiter: Recruiter | null) => {
    setCurrentRecruiterState(recruiter);
    if (recruiter) {
      localStorage.setItem("currentRecruiterId", recruiter.id);
    } else {
      localStorage.removeItem("currentRecruiterId");
    }
  };

  const createRecruiter = async (name: string, email: string): Promise<Recruiter> => {
    const response = await fetch(`${API_URL}/api/recruiters`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Failed to create recruiter");
    }

    const newRecruiter = await response.json();
    await refreshRecruiters();
    return newRecruiter;
  };

  return (
    <RecruiterContext.Provider
      value={{
        currentRecruiter,
        recruiters,
        loading,
        setCurrentRecruiter,
        refreshRecruiters,
        createRecruiter,
      }}
    >
      {children}
    </RecruiterContext.Provider>
  );
}

export function useRecruiter() {
  const context = useContext(RecruiterContext);
  if (context === undefined) {
    throw new Error("useRecruiter must be used within a RecruiterProvider");
  }
  return context;
}
