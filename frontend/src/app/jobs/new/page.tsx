"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import {
  ArrowLeft,
  Briefcase,
  FileText,
  Loader2,
  CheckCircle2,
  Sparkles,
  AlertCircle,
  Mic,
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function NewJobPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, isLoading: authLoading, recruiter, logout, token } = useAuth();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [extractedRequirements, setExtractedRequirements] = useState<any>(null);

  // Check if voice mode is requested
  const voiceMode = searchParams.get("voice") === "true";

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, authLoading, router]);

  const handleExtract = async () => {
    if (!description.trim()) {
      setError("Please enter a job description first");
      return;
    }

    try {
      setExtracting(true);
      setError(null);

      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const response = await fetch(`${API_URL}/api/jobs/extract-requirements`, {
        method: "POST",
        headers,
        body: JSON.stringify({ description }),
      });

      if (response.ok) {
        const data = await response.json();
        setExtractedRequirements(data);

        // Auto-fill title if not set
        if (!title && data.title) {
          setTitle(data.title);
        }
      } else {
        const err = await response.json();
        setError(err.detail || "Failed to extract requirements");
      }
    } catch (err) {
      setError("Failed to extract requirements. Please try again.");
    } finally {
      setExtracting(false);
    }
  };

  const handleSubmit = async () => {
    if (!recruiter) {
      setError("Authentication error. Please try logging in again.");
      return;
    }

    if (!title.trim() || !description.trim()) {
      setError("Title and description are required");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const response = await fetch(`${API_URL}/api/jobs/`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          title: title.trim(),
          raw_description: description.trim(),
          recruiter_id: recruiter.id,
          status: "draft",
        }),
      });

      if (response.ok) {
        const job = await response.json();
        // If voice mode, go to enrich page, otherwise go to job detail
        if (voiceMode) {
          router.push(`/jobs/${job.id}/enrich`);
        } else {
          router.push(`/jobs/${job.id}`);
        }
      } else {
        const err = await response.json();
        setError(err.detail || "Failed to create job");
      }
    } catch (err) {
      setError("Failed to create job. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Show loading while checking auth
  if (authLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
        </div>
      </AppLayout>
    );
  }

  // Don't render for unauthenticated users (they'll be redirected)
  if (!isAuthenticated) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="px-6 py-8 max-w-4xl mx-auto">
        {/* Page Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link href="/jobs" className="p-2 hover:bg-white/5 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5 text-white/60" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white">
              {voiceMode ? "Create Job with Voice Setup" : "Create New Job"}
            </h1>
            <p className="text-sm text-white/50">Add a new job posting</p>
          </div>
        </div>
        <div className="space-y-6">
          {/* Voice Mode Banner */}
          {voiceMode && (
            <div className="glass-panel rounded-2xl p-4 border border-indigo-500/30 bg-indigo-500/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center">
                  <Mic className="w-5 h-5 text-indigo-400" />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-white">Voice Setup Mode</h3>
                  <p className="text-xs text-white/50">
                    After creating the job, you'll be guided through a voice conversation to enrich the job profile.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Error Alert */}
          {error && (
            <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
              <p className="text-sm text-red-300">{error}</p>
            </div>
          )}

          {/* Job Title */}
          <div className="glass-panel rounded-2xl p-6">
            <label className="block text-sm font-medium text-white/60 mb-2">
              Job Title
            </label>
            <input
              type="text"
              placeholder="e.g., Senior Software Engineer"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:border-indigo-500/50 text-lg"
            />
          </div>

          {/* Job Description */}
          <div className="glass-panel rounded-2xl p-6">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-white/60">
                Job Description
              </label>
              <button
                onClick={handleExtract}
                disabled={extracting || !description.trim()}
                className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
              >
                {extracting ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Sparkles className="w-3 h-3" />
                )}
                Extract Requirements
              </button>
            </div>
            <textarea
              placeholder="Paste the full job description here..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={12}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:border-indigo-500/50 text-sm leading-relaxed resize-none"
            />
          </div>

          {/* Extracted Requirements Preview */}
          {extractedRequirements && (
            <div className="glass-panel rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <CheckCircle2 className="w-5 h-5 text-green-400" />
                <h3 className="text-sm font-medium text-white">
                  AI-Extracted Requirements
                </h3>
              </div>

              <div className="space-y-4">
                {extractedRequirements.years_experience && (
                  <div>
                    <label className="text-xs text-white/50 uppercase tracking-wider">
                      Experience
                    </label>
                    <p className="text-white">{extractedRequirements.years_experience}</p>
                  </div>
                )}

                {extractedRequirements.required_skills?.length > 0 && (
                  <div>
                    <label className="text-xs text-white/50 uppercase tracking-wider mb-2 block">
                      Required Skills
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {extractedRequirements.required_skills.map((skill: string) => (
                        <span
                          key={skill}
                          className="px-3 py-1 bg-indigo-500/20 text-indigo-300 rounded-lg text-sm"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {extractedRequirements.preferred_skills?.length > 0 && (
                  <div>
                    <label className="text-xs text-white/50 uppercase tracking-wider mb-2 block">
                      Nice to Have
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {extractedRequirements.preferred_skills.map((skill: string) => (
                        <span
                          key={skill}
                          className="px-3 py-1 bg-white/5 text-white/70 rounded-lg text-sm"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {extractedRequirements.location && (
                  <div>
                    <label className="text-xs text-white/50 uppercase tracking-wider">
                      Location
                    </label>
                    <p className="text-white">{extractedRequirements.location}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-4">
            <Link
              href="/jobs"
              className="px-6 py-3 bg-white/5 hover:bg-white/10 rounded-xl font-medium transition-colors"
            >
              Cancel
            </Link>
            <button
              onClick={handleSubmit}
              disabled={loading || !title.trim() || !description.trim()}
              className="flex items-center gap-2 px-6 py-3 bg-white text-black rounded-xl font-medium hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating...
                </>
              ) : voiceMode ? (
                <>
                  <Mic className="w-4 h-4" />
                  Create & Start Voice Setup
                </>
              ) : (
                <>
                  <Briefcase className="w-4 h-4" />
                  Create Job
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

export default function NewJobPage() {
  return (
    <Suspense fallback={
      <AppLayout>
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
        </div>
      </AppLayout>
    }>
      <NewJobPageContent />
    </Suspense>
  );
}
