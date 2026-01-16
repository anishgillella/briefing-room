"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useRecruiter } from "@/contexts/RecruiterContext";
import RecruiterSelector from "@/components/RecruiterSelector";
import {
  ArrowLeft,
  Briefcase,
  FileText,
  Loader2,
  CheckCircle2,
  Sparkles,
  AlertCircle,
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function NewJobPage() {
  const router = useRouter();
  const { currentRecruiter } = useRecruiter();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [extractedRequirements, setExtractedRequirements] = useState<any>(null);

  const handleExtract = async () => {
    if (!description.trim()) {
      setError("Please enter a job description first");
      return;
    }

    try {
      setExtracting(true);
      setError(null);

      const response = await fetch(`${API_URL}/api/jobs/extract-requirements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
    if (!currentRecruiter) {
      setError("Please select a recruiter first");
      return;
    }

    if (!title.trim() || !description.trim()) {
      setError("Title and description are required");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`${API_URL}/api/jobs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          raw_description: description.trim(),
          recruiter_id: currentRecruiter.id,
          status: "draft",
        }),
      });

      if (response.ok) {
        const job = await response.json();
        router.push(`/jobs/${job.id}`);
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

  return (
    <main className="min-h-screen gradient-bg text-white">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-[#000000]/80 backdrop-blur-md border-b border-white/5 py-4">
        <div className="flex items-center justify-between max-w-7xl mx-auto px-6">
          <div className="flex items-center gap-4">
            <Link href="/jobs" className="p-2 hover:bg-white/5 rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5 text-white/60" />
            </Link>
            <div>
              <h1 className="text-lg font-light tracking-wide text-white">Create New Job</h1>
              <p className="text-xs text-white/50">Add a new job posting</p>
            </div>
          </div>

          <RecruiterSelector />
        </div>
      </header>

      <div className="pt-28 px-6 pb-12 max-w-4xl mx-auto">
        {!currentRecruiter ? (
          <div className="glass-panel rounded-3xl p-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-indigo-500/20 flex items-center justify-center mx-auto mb-6">
              <Briefcase className="w-8 h-8 text-indigo-400" />
            </div>
            <h3 className="text-xl font-medium text-white mb-2">Select a Recruiter</h3>
            <p className="text-white/50">
              Choose a recruiter from the dropdown above to create a job.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
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
                ) : (
                  <>
                    <Briefcase className="w-4 h-4" />
                    Create Job
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
