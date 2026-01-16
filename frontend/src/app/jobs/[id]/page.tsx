"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useRecruiter } from "@/contexts/RecruiterContext";
import RecruiterSelector from "@/components/RecruiterSelector";
import {
  ArrowLeft,
  Briefcase,
  Users,
  CheckCircle,
  Clock,
  Upload,
  Mic,
  BarChart3,
  Play,
  Pause,
  Archive,
  ChevronRight,
  Edit,
  Sparkles,
  TrendingUp,
  AlertCircle,
  FileText,
  Target,
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Job {
  id: string;
  title: string;
  status: string;
  raw_description: string;
  recruiter_id?: string;
  candidate_count: number;
  interviewed_count: number;
  created_at: string;
  updated_at: string;
  extracted_requirements?: {
    required_skills?: string[];
    preferred_skills?: string[];
    years_experience?: string;
    education?: string;
    location?: string;
    work_type?: string;
    salary_range?: string;
  };
  company_context?: {
    company_name?: string;
    team_size?: string;
    team_culture?: string;
  };
  scoring_criteria?: {
    must_haves?: string[];
    nice_to_haves?: string[];
    weight_technical?: number;
    weight_experience?: number;
    weight_cultural?: number;
  };
  red_flags?: string[];
}

interface Candidate {
  id: string;
  person_name: string;
  pipeline_status: string;
  ranking_score?: number;
  interview_status: string;
}

interface JobStats {
  candidate_stats: {
    total: number;
    pending: number;
    in_progress: number;
    completed: number;
  };
  analytics_stats: {
    total_evaluated: number;
    avg_score: number;
    recommendations: {
      strong_hire: number;
      hire: number;
      maybe: number;
      no_hire: number;
    };
  };
}

export default function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const { currentRecruiter } = useRecruiter();

  const [job, setJob] = useState<Job | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [stats, setStats] = useState<JobStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "candidates" | "analytics">("overview");

  useEffect(() => {
    fetchJobData();
  }, [resolvedParams.id]);

  const fetchJobData = async () => {
    try {
      setLoading(true);

      // Fetch job details
      const jobResponse = await fetch(`${API_URL}/api/jobs/${resolvedParams.id}`);
      if (jobResponse.ok) {
        const jobData = await jobResponse.json();
        setJob(jobData);
      }

      // Fetch candidates for this job
      const candidatesResponse = await fetch(`${API_URL}/api/jobs/${resolvedParams.id}/candidates`);
      if (candidatesResponse.ok) {
        const candidatesData = await candidatesResponse.json();
        setCandidates(candidatesData.candidates || []);
      }

      // Fetch job dashboard stats
      const statsResponse = await fetch(`${API_URL}/api/dashboard/job/${resolvedParams.id}/summary`);
      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        setStats(statsData);
      }
    } catch (error) {
      console.error("Failed to fetch job data:", error);
    } finally {
      setLoading(false);
    }
  };

  const updateJobStatus = async (action: "activate" | "pause" | "close" | "reopen") => {
    try {
      const response = await fetch(`${API_URL}/api/jobs/${resolvedParams.id}/${action}`, {
        method: "POST",
      });
      if (response.ok) {
        fetchJobData();
      }
    } catch (error) {
      console.error(`Failed to ${action} job:`, error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-500/10 border-green-500/30 text-green-400";
      case "draft":
        return "bg-yellow-500/10 border-yellow-500/30 text-yellow-400";
      case "paused":
        return "bg-orange-500/10 border-orange-500/30 text-orange-400";
      case "closed":
        return "bg-gray-500/10 border-gray-500/30 text-gray-400";
      default:
        return "bg-gray-500/10 border-gray-500/30 text-gray-400";
    }
  };

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
          <p className="text-white/50 mb-6">The job you're looking for doesn't exist.</p>
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
            <Link href="/jobs" className="p-2 hover:bg-white/5 rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5 text-white/60" />
            </Link>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-lg font-light tracking-wide text-white">{job.title}</h1>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider border ${getStatusColor(
                    job.status
                  )}`}
                >
                  {job.status}
                </span>
              </div>
              <p className="text-xs text-white/50">
                Created {new Date(job.created_at).toLocaleDateString()}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Quick Actions */}
            {job.status === "draft" && (
              <button
                onClick={() => updateJobStatus("activate")}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 rounded-lg text-sm font-medium transition-colors"
              >
                <Play className="w-4 h-4" />
                Activate
              </button>
            )}
            {job.status === "active" && (
              <button
                onClick={() => updateJobStatus("pause")}
                className="flex items-center gap-2 px-4 py-2 bg-orange-600/20 hover:bg-orange-600/30 text-orange-400 rounded-lg text-sm font-medium transition-colors"
              >
                <Pause className="w-4 h-4" />
                Pause
              </button>
            )}
            <RecruiterSelector />
          </div>
        </div>
      </header>

      <div className="pt-28 px-6 pb-12 max-w-7xl mx-auto">
        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="glass-panel rounded-2xl p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                <Users className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <div className="text-2xl font-light text-white">{job.candidate_count}</div>
                <div className="text-xs text-white/50 uppercase tracking-wider">Candidates</div>
              </div>
            </div>
          </div>
          <div className="glass-panel rounded-2xl p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-cyan-400" />
              </div>
              <div>
                <div className="text-2xl font-light text-white">{job.interviewed_count}</div>
                <div className="text-xs text-white/50 uppercase tracking-wider">Interviewed</div>
              </div>
            </div>
          </div>
          <div className="glass-panel rounded-2xl p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <div className="text-2xl font-light text-white">
                  {stats?.analytics_stats.avg_score.toFixed(1) || "—"}
                </div>
                <div className="text-xs text-white/50 uppercase tracking-wider">Avg Score</div>
              </div>
            </div>
          </div>
          <div className="glass-panel rounded-2xl p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center">
                <Target className="w-5 h-5 text-indigo-400" />
              </div>
              <div>
                <div className="text-2xl font-light text-white">
                  {(stats?.analytics_stats.recommendations.strong_hire || 0) +
                    (stats?.analytics_stats.recommendations.hire || 0)}
                </div>
                <div className="text-xs text-white/50 uppercase tracking-wider">Hire Ready</div>
              </div>
            </div>
          </div>
        </div>

        {/* Action Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Link
            href={`/jobs/${resolvedParams.id}/upload`}
            className="glass-panel rounded-2xl p-6 hover:bg-white/5 transition-all group"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-indigo-500/20 flex items-center justify-center group-hover:bg-indigo-500/30 transition-colors">
                <Upload className="w-6 h-6 text-indigo-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-white font-medium group-hover:text-indigo-300 transition-colors">
                  Upload Candidates
                </h3>
                <p className="text-sm text-white/50">Import CSV with resumes</p>
              </div>
              <ChevronRight className="w-5 h-5 text-white/30 group-hover:text-white/60 transition-colors" />
            </div>
          </Link>

          <Link
            href={`/jobs/${resolvedParams.id}/enrich`}
            className="glass-panel rounded-2xl p-6 hover:bg-white/5 transition-all group"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center group-hover:bg-purple-500/30 transition-colors">
                <Mic className="w-6 h-6 text-purple-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-white font-medium group-hover:text-purple-300 transition-colors">
                  Voice Enrichment
                </h3>
                <p className="text-sm text-white/50">Add scoring criteria</p>
              </div>
              <ChevronRight className="w-5 h-5 text-white/30 group-hover:text-white/60 transition-colors" />
            </div>
          </Link>

          <Link
            href={`/jobs/${resolvedParams.id}/candidates`}
            className="glass-panel rounded-2xl p-6 hover:bg-white/5 transition-all group"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-cyan-500/20 flex items-center justify-center group-hover:bg-cyan-500/30 transition-colors">
                <BarChart3 className="w-6 h-6 text-cyan-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-white font-medium group-hover:text-cyan-300 transition-colors">
                  View Rankings
                </h3>
                <p className="text-sm text-white/50">See candidate analytics</p>
              </div>
              <ChevronRight className="w-5 h-5 text-white/30 group-hover:text-white/60 transition-colors" />
            </div>
          </Link>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-2 p-1 bg-white/5 rounded-xl border border-white/10 w-fit mb-6">
          {[
            { key: "overview", label: "Overview" },
            { key: "candidates", label: "Candidates" },
            { key: "analytics", label: "Analytics" },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.key
                  ? "bg-white text-black"
                  : "text-white/50 hover:text-white"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === "overview" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Job Description */}
            <div className="glass-panel rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-white flex items-center gap-2">
                  <FileText className="w-5 h-5 text-white/60" />
                  Job Description
                </h3>
              </div>
              <div className="text-sm text-white/70 leading-relaxed whitespace-pre-wrap max-h-96 overflow-y-auto">
                {job.raw_description}
              </div>
            </div>

            {/* Extracted Requirements */}
            <div className="space-y-6">
              {job.extracted_requirements && (
                <div className="glass-panel rounded-2xl p-6">
                  <h3 className="text-lg font-medium text-white flex items-center gap-2 mb-4">
                    <Sparkles className="w-5 h-5 text-indigo-400" />
                    Extracted Requirements
                  </h3>
                  <div className="space-y-4">
                    {job.extracted_requirements.years_experience && (
                      <div>
                        <label className="text-xs text-white/50 uppercase tracking-wider">
                          Experience
                        </label>
                        <p className="text-white">{job.extracted_requirements.years_experience}</p>
                      </div>
                    )}
                    {job.extracted_requirements.required_skills?.length && job.extracted_requirements.required_skills.length > 0 && (
                      <div>
                        <label className="text-xs text-white/50 uppercase tracking-wider mb-2 block">
                          Required Skills
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {job.extracted_requirements.required_skills.map((skill) => (
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
                    {job.extracted_requirements.location && (
                      <div>
                        <label className="text-xs text-white/50 uppercase tracking-wider">
                          Location
                        </label>
                        <p className="text-white">{job.extracted_requirements.location}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Scoring Criteria */}
              {job.scoring_criteria && (
                <div className="glass-panel rounded-2xl p-6">
                  <h3 className="text-lg font-medium text-white flex items-center gap-2 mb-4">
                    <Target className="w-5 h-5 text-green-400" />
                    Scoring Criteria
                  </h3>
                  <div className="space-y-4">
                    {job.scoring_criteria.must_haves?.length && job.scoring_criteria.must_haves.length > 0 && (
                      <div>
                        <label className="text-xs text-white/50 uppercase tracking-wider mb-2 block">
                          Must-Haves
                        </label>
                        <ul className="space-y-1">
                          {job.scoring_criteria.must_haves.map((item, i) => (
                            <li key={i} className="text-sm text-white/80 flex items-center gap-2">
                              <CheckCircle className="w-3 h-3 text-green-400" />
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <div className="pt-4 border-t border-white/10">
                      <label className="text-xs text-white/50 uppercase tracking-wider mb-2 block">
                        Weights
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

              {/* Red Flags */}
              {job.red_flags && job.red_flags.length > 0 && (
                <div className="glass-panel rounded-2xl p-6">
                  <h3 className="text-lg font-medium text-white flex items-center gap-2 mb-4">
                    <AlertCircle className="w-5 h-5 text-red-400" />
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
            </div>
          </div>
        )}

        {activeTab === "candidates" && (
          <div className="glass-panel rounded-2xl p-6">
            {candidates.length === 0 ? (
              <div className="text-center py-12">
                <Users className="w-12 h-12 text-white/20 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-white mb-2">No Candidates Yet</h3>
                <p className="text-white/50 mb-6">Upload candidates to get started.</p>
                <Link
                  href={`/jobs/${resolvedParams.id}/upload`}
                  className="inline-flex items-center gap-2 px-5 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-full font-medium transition-colors"
                >
                  <Upload className="w-4 h-4" />
                  Upload Candidates
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {candidates.slice(0, 10).map((candidate) => (
                  <div
                    key={candidate.id}
                    className="flex items-center p-4 bg-white/5 rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
                    onClick={() => router.push(`/candidates/${candidate.id}`)}
                  >
                    <div className="flex-1">
                      <h4 className="font-medium text-white">{candidate.person_name}</h4>
                      <div className="text-sm text-white/50">{candidate.pipeline_status}</div>
                    </div>
                    {candidate.ranking_score && (
                      <div className="text-right mr-4">
                        <div className="text-lg font-light text-white">
                          {candidate.ranking_score.toFixed(0)}
                        </div>
                        <div className="text-xs text-white/40">Score</div>
                      </div>
                    )}
                    <ChevronRight className="w-5 h-5 text-white/30" />
                  </div>
                ))}
                {candidates.length > 10 && (
                  <Link
                    href={`/jobs/${resolvedParams.id}/candidates`}
                    className="block text-center py-3 text-indigo-400 hover:text-indigo-300"
                  >
                    View all {candidates.length} candidates
                  </Link>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === "analytics" && (
          <div className="glass-panel rounded-2xl p-6">
            {!stats || stats.analytics_stats.total_evaluated === 0 ? (
              <div className="text-center py-12">
                <BarChart3 className="w-12 h-12 text-white/20 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-white mb-2">No Analytics Yet</h3>
                <p className="text-white/50">
                  Analytics will appear once candidates have been interviewed.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Recommendation Distribution */}
                <div>
                  <h4 className="text-sm font-medium text-white/60 mb-4 uppercase tracking-wider">
                    Recommendation Distribution
                  </h4>
                  <div className="grid grid-cols-4 gap-4">
                    <div className="p-4 bg-green-500/10 rounded-xl text-center">
                      <div className="text-2xl font-light text-green-400">
                        {stats.analytics_stats.recommendations.strong_hire}
                      </div>
                      <div className="text-xs text-green-400/60">Strong Hire</div>
                    </div>
                    <div className="p-4 bg-blue-500/10 rounded-xl text-center">
                      <div className="text-2xl font-light text-blue-400">
                        {stats.analytics_stats.recommendations.hire}
                      </div>
                      <div className="text-xs text-blue-400/60">Hire</div>
                    </div>
                    <div className="p-4 bg-yellow-500/10 rounded-xl text-center">
                      <div className="text-2xl font-light text-yellow-400">
                        {stats.analytics_stats.recommendations.maybe}
                      </div>
                      <div className="text-xs text-yellow-400/60">Maybe</div>
                    </div>
                    <div className="p-4 bg-red-500/10 rounded-xl text-center">
                      <div className="text-2xl font-light text-red-400">
                        {stats.analytics_stats.recommendations.no_hire}
                      </div>
                      <div className="text-xs text-red-400/60">No Hire</div>
                    </div>
                  </div>
                </div>

                {/* Key Metrics */}
                <div className="pt-6 border-t border-white/10">
                  <h4 className="text-sm font-medium text-white/60 mb-4 uppercase tracking-wider">
                    Key Metrics
                  </h4>
                  <div className="grid grid-cols-3 gap-6">
                    <div>
                      <div className="text-3xl font-light text-white">
                        {stats.analytics_stats.total_evaluated}
                      </div>
                      <div className="text-sm text-white/40">Total Evaluated</div>
                    </div>
                    <div>
                      <div className="text-3xl font-light text-white">
                        {stats.analytics_stats.avg_score.toFixed(1)}
                      </div>
                      <div className="text-sm text-white/40">Average Score</div>
                    </div>
                    <div>
                      <div className="text-3xl font-light text-white">
                        {stats.analytics_stats.total_evaluated > 0
                          ? (
                              ((stats.analytics_stats.recommendations.strong_hire +
                                stats.analytics_stats.recommendations.hire) /
                                stats.analytics_stats.total_evaluated) *
                              100
                            ).toFixed(0)
                          : 0}
                        %
                      </div>
                      <div className="text-sm text-white/40">Hire Rate</div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
