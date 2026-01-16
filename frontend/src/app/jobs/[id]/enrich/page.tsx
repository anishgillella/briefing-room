"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRecruiter } from "@/contexts/RecruiterContext";
import RecruiterSelector from "@/components/RecruiterSelector";
import {
  ArrowLeft,
  Mic,
  CheckCircle,
  AlertCircle,
  Target,
  Scale,
  AlertTriangle,
  Sparkles,
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Job {
  id: string;
  title: string;
  status: string;
  scoring_criteria?: {
    must_haves?: string[];
    nice_to_haves?: string[];
    cultural_fit_traits?: string[];
    technical_competencies?: string[];
    weight_technical?: number;
    weight_experience?: number;
    weight_cultural?: number;
  };
  red_flags?: string[];
  company_context?: {
    company_name?: string;
    team_size?: string;
    team_culture?: string;
    reporting_to?: string;
  };
}

export default function JobEnrichPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);

  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchJob();
  }, [resolvedParams.id]);

  const fetchJob = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/api/jobs/${resolvedParams.id}`);
      if (response.ok) {
        const data = await response.json();
        setJob(data);
      }
    } catch (error) {
      console.error("Failed to fetch job:", error);
    } finally {
      setLoading(false);
    }
  };

  const isEnriched =
    job?.scoring_criteria?.must_haves?.length ||
    job?.red_flags?.length ||
    job?.company_context?.company_name;

  if (loading) {
    return (
      <main className="min-h-screen gradient-bg text-white flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
      </main>
    );
  }

  if (!job) {
    return (
      <main className="min-h-screen gradient-bg text-white flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-medium text-white mb-2">Job Not Found</h2>
          <Link href="/jobs" className="text-indigo-400 hover:text-indigo-300">
            Back to Jobs
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen gradient-bg text-white">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-[#000000]/80 backdrop-blur-md border-b border-white/5 py-4">
        <div className="flex items-center justify-between max-w-7xl mx-auto px-6">
          <div className="flex items-center gap-4">
            <Link
              href={`/jobs/${resolvedParams.id}`}
              className="p-2 hover:bg-white/5 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-white/60" />
            </Link>
            <div>
              <h1 className="text-lg font-light tracking-wide text-white">Voice Enrichment</h1>
              <p className="text-xs text-white/50">{job.title}</p>
            </div>
          </div>

          <RecruiterSelector />
        </div>
      </header>

      <div className="pt-28 px-6 pb-12 max-w-4xl mx-auto">
        {isEnriched ? (
          <div className="space-y-6">
            {/* Status Banner */}
            <div className="flex items-center gap-3 p-4 bg-green-500/10 border border-green-500/30 rounded-xl">
              <CheckCircle className="w-5 h-5 text-green-400 shrink-0" />
              <div>
                <p className="text-sm font-medium text-green-300">
                  This job has been enriched
                </p>
                <p className="text-xs text-green-300/60">
                  Scoring criteria and context have been configured
                </p>
              </div>
            </div>

            {/* Current Configuration */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Scoring Criteria */}
              {job.scoring_criteria && (
                <div className="glass-panel rounded-2xl p-6">
                  <h3 className="text-lg font-medium text-white flex items-center gap-2 mb-4">
                    <Target className="w-5 h-5 text-green-400" />
                    Scoring Criteria
                  </h3>
                  <div className="space-y-4">
                    {job.scoring_criteria.must_haves &&
                      job.scoring_criteria.must_haves.length > 0 && (
                        <div>
                          <label className="text-xs text-white/50 uppercase tracking-wider mb-2 block">
                            Must-Haves
                          </label>
                          <ul className="space-y-1">
                            {job.scoring_criteria.must_haves.map((item, i) => (
                              <li
                                key={i}
                                className="text-sm text-white/80 flex items-center gap-2"
                              >
                                <CheckCircle className="w-3 h-3 text-green-400" />
                                {item}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                    {job.scoring_criteria.nice_to_haves &&
                      job.scoring_criteria.nice_to_haves.length > 0 && (
                        <div>
                          <label className="text-xs text-white/50 uppercase tracking-wider mb-2 block">
                            Nice-to-Haves
                          </label>
                          <ul className="space-y-1">
                            {job.scoring_criteria.nice_to_haves.map((item, i) => (
                              <li key={i} className="text-sm text-white/60 flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-white/30" />
                                {item}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                    {/* Weights */}
                    <div className="pt-4 border-t border-white/10">
                      <label className="text-xs text-white/50 uppercase tracking-wider mb-2 block">
                        Scoring Weights
                      </label>
                      <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                          <div className="text-lg font-light text-white">
                            {((job.scoring_criteria.weight_technical || 0.5) * 100).toFixed(0)}%
                          </div>
                          <div className="text-xs text-white/40">Technical</div>
                        </div>
                        <div>
                          <div className="text-lg font-light text-white">
                            {((job.scoring_criteria.weight_experience || 0.3) * 100).toFixed(0)}%
                          </div>
                          <div className="text-xs text-white/40">Experience</div>
                        </div>
                        <div>
                          <div className="text-lg font-light text-white">
                            {((job.scoring_criteria.weight_cultural || 0.2) * 100).toFixed(0)}%
                          </div>
                          <div className="text-xs text-white/40">Cultural</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Red Flags & Context */}
              <div className="space-y-6">
                {job.red_flags && job.red_flags.length > 0 && (
                  <div className="glass-panel rounded-2xl p-6">
                    <h3 className="text-lg font-medium text-white flex items-center gap-2 mb-4">
                      <AlertTriangle className="w-5 h-5 text-red-400" />
                      Red Flags
                    </h3>
                    <ul className="space-y-2">
                      {job.red_flags.map((flag, i) => (
                        <li key={i} className="text-sm text-red-300/80 flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                          {flag}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {job.company_context && (
                  <div className="glass-panel rounded-2xl p-6">
                    <h3 className="text-lg font-medium text-white flex items-center gap-2 mb-4">
                      <Sparkles className="w-5 h-5 text-purple-400" />
                      Company Context
                    </h3>
                    <div className="space-y-3">
                      {job.company_context.company_name && (
                        <div>
                          <label className="text-xs text-white/50">Company</label>
                          <p className="text-white">{job.company_context.company_name}</p>
                        </div>
                      )}
                      {job.company_context.team_size && (
                        <div>
                          <label className="text-xs text-white/50">Team Size</label>
                          <p className="text-white">{job.company_context.team_size}</p>
                        </div>
                      )}
                      {job.company_context.team_culture && (
                        <div>
                          <label className="text-xs text-white/50">Culture</label>
                          <p className="text-white/80 text-sm">{job.company_context.team_culture}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Re-enrich Button */}
            <div className="flex justify-center pt-4">
              <Link
                href={`/candidates?job_id=${resolvedParams.id}`}
                className="flex items-center gap-2 px-6 py-3 bg-white/5 hover:bg-white/10 rounded-xl font-medium transition-colors"
              >
                <Mic className="w-4 h-4" />
                Update via Voice Agent
              </Link>
            </div>
          </div>
        ) : (
          <div className="glass-panel rounded-3xl p-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-purple-500/20 flex items-center justify-center mx-auto mb-6">
              <Mic className="w-8 h-8 text-purple-400" />
            </div>
            <h3 className="text-xl font-medium text-white mb-2">Enrich with Voice</h3>
            <p className="text-white/50 mb-6 max-w-md mx-auto">
              Talk to our AI agent to configure scoring criteria, red flags, and company context
              for this role. This will improve candidate matching and analytics.
            </p>
            <Link
              href={`/candidates?job_id=${resolvedParams.id}`}
              className="inline-flex items-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-500 rounded-full font-medium transition-colors"
            >
              <Mic className="w-4 h-4" />
              Start Voice Enrichment
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
