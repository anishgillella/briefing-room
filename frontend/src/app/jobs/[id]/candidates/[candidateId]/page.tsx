"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import {
  ArrowLeft,
  Star,
  AlertTriangle,
  CheckCircle,
  XCircle,
  TrendingUp,
  Briefcase,
  Mail,
  Calendar,
  Target,
  MessageSquare,
  Shield,
  Award,
  AlertCircle,
  Brain,
  Heart,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Play,
  CalendarPlus,
} from "lucide-react";
import ScheduleInterviewModal from "@/components/ScheduleInterviewModal";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface ScreeningNotes {
  fit_summary?: string;
  recommendation?: string;
  category_scores?: CategoryScore[];
  skill_matches?: SkillMatch[];
  green_flags?: GreenFlag[];
  red_flags?: RedFlag[];
  deal_breakers_triggered?: string[];
  has_deal_breaker?: boolean;
  behavioral_assessment?: string;
  cultural_fit_assessment?: string;
  interview_questions?: string[];
}

interface CategoryScore {
  category: string;
  category_weight: number;
  raw_score: number;
  weighted_score: number;
  attribute_matches?: AttributeMatch[];
}

interface AttributeMatch {
  attribute: string;
  weight: number;
  match_score: number;
  evidence: string;
}

interface SkillMatch {
  skill: string;
  match_level: string;
  weight: number;
  notes?: string;
}

interface GreenFlag {
  strength: string;
  evidence: string;
  matched_success_signal?: string;
}

interface RedFlag {
  concern: string;
  severity: string;
  evidence: string;
  matched_job_red_flag?: string;
}

interface Candidate {
  id: string;
  person_id: string;
  person_name: string;
  person_email?: string;
  current_title?: string;
  current_company?: string;
  years_experience?: number;
  skills?: string[];
  bio_summary?: string;
  combined_score?: number;
  screening_notes?: string;
  interview_status: string;
  pipeline_status?: string;
  created_at: string;
}

interface Job {
  id: string;
  title: string;
  status: string;
}

// Get fit badge style
const getFitBadgeStyle = (recommendation: string | null) => {
  switch (recommendation) {
    case "Strong Fit":
      return "bg-green-500/20 border-green-500/40 text-green-400";
    case "Good Fit":
      return "bg-blue-500/20 border-blue-500/40 text-blue-400";
    case "Potential Fit":
      return "bg-yellow-500/20 border-yellow-500/40 text-yellow-400";
    case "Not a Fit":
      return "bg-red-500/20 border-red-500/40 text-red-400";
    default:
      return "bg-gray-500/20 border-gray-500/40 text-gray-400";
  }
};

// Get fit icon
const getFitIcon = (recommendation: string | null) => {
  switch (recommendation) {
    case "Strong Fit":
      return <Star className="w-5 h-5 text-green-400 fill-green-400" />;
    case "Good Fit":
      return <CheckCircle className="w-5 h-5 text-blue-400" />;
    case "Potential Fit":
      return <TrendingUp className="w-5 h-5 text-yellow-400" />;
    case "Not a Fit":
      return <XCircle className="w-5 h-5 text-red-400" />;
    default:
      return <AlertCircle className="w-5 h-5 text-gray-400" />;
  }
};

// Get severity badge style
const getSeverityStyle = (severity: string) => {
  switch (severity?.toLowerCase()) {
    case "high":
      return "bg-red-500/20 text-red-400 border border-red-500/30";
    case "medium":
      return "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30";
    case "low":
      return "bg-blue-500/20 text-blue-400 border border-blue-500/30";
    default:
      return "bg-gray-500/20 text-gray-400 border border-gray-500/30";
  }
};

// Get match level style
const getMatchLevelStyle = (level: string) => {
  switch (level) {
    case "Strong Match":
      return "bg-green-500/20 text-green-400 border border-green-500/30";
    case "Partial Match":
      return "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30";
    case "No Match":
      return "bg-red-500/20 text-red-400 border border-red-500/30";
    default:
      return "bg-gray-500/20 text-gray-400 border border-gray-500/30";
  }
};

// Parse text into bullet points (split by sentences)
const parseIntoBullets = (text: string | undefined): string[] => {
  if (!text) return [];
  // Split by common sentence endings, but keep meaningful chunks
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 10); // Filter out very short fragments
  return sentences;
};

export default function CandidateDetailPage({
  params,
}: {
  params: Promise<{ id: string; candidateId: string }>;
}) {
  const resolvedParams = use(params);
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading, token } = useAuth();

  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [screeningNotes, setScreeningNotes] = useState<ScreeningNotes | null>(null);
  const [showAllSkills, setShowAllSkills] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, authLoading, router]);

  useEffect(() => {
    if (isAuthenticated && token) {
      fetchData();
    }
  }, [resolvedParams.id, resolvedParams.candidateId, isAuthenticated, token]);

  const getAuthHeaders = (): Record<string, string> => {
    const headers: Record<string, string> = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    return headers;
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const headers = getAuthHeaders();

      // Fetch job
      const jobResponse = await fetch(`${API_URL}/api/jobs/${resolvedParams.id}`, { headers });
      if (jobResponse.ok) {
        const jobData = await jobResponse.json();
        setJob(jobData);
      }

      // Fetch candidate
      const candidateResponse = await fetch(
        `${API_URL}/api/jobs/${resolvedParams.id}/candidates/${resolvedParams.candidateId}`,
        { headers }
      );
      if (candidateResponse.ok) {
        const candidateData = await candidateResponse.json();
        setCandidate(candidateData);

        // Parse screening notes
        if (candidateData.screening_notes) {
          try {
            const notes =
              typeof candidateData.screening_notes === "string"
                ? JSON.parse(candidateData.screening_notes)
                : candidateData.screening_notes;
            setScreeningNotes(notes);
          } catch {
            console.error("Failed to parse screening notes");
          }
        }
      }
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || loading) {
    return (
      <main className="min-h-screen gradient-bg flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
      </main>
    );
  }

  if (!candidate) {
    return (
      <main className="min-h-screen gradient-bg text-white flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-medium text-white mb-2">Candidate Not Found</h2>
          <Link
            href={`/jobs/${resolvedParams.id}/candidates`}
            className="text-indigo-400 hover:text-indigo-300"
          >
            Back to Candidates
          </Link>
        </div>
      </main>
    );
  }

  const recommendation = screeningNotes?.recommendation;
  const score = candidate.combined_score;
  const behavioralBullets = parseIntoBullets(screeningNotes?.behavioral_assessment);
  const culturalBullets = parseIntoBullets(screeningNotes?.cultural_fit_assessment);

  // Count skill matches by level
  const strongMatches = screeningNotes?.skill_matches?.filter(s => s.match_level === "Strong Match").length || 0;
  const partialMatches = screeningNotes?.skill_matches?.filter(s => s.match_level === "Partial Match").length || 0;
  const noMatches = screeningNotes?.skill_matches?.filter(s => s.match_level === "No Match").length || 0;

  return (
    <main className="min-h-screen gradient-bg text-white">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-[#000000]/80 backdrop-blur-md border-b border-white/5 py-4">
        <div className="flex items-center justify-between max-w-7xl mx-auto px-6">
          <div className="flex items-center gap-4">
            <Link
              href={`/jobs/${resolvedParams.id}/candidates`}
              className="p-2 hover:bg-white/5 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-white/60" />
            </Link>
            <div>
              <h1 className="text-lg font-light tracking-wide text-white">
                {candidate.person_name}
              </h1>
              <p className="text-xs text-white/50">{job?.title}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {recommendation && (
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${getFitBadgeStyle(recommendation)}`}>
                {getFitIcon(recommendation)}
                <span className="text-sm font-medium">{recommendation}</span>
              </div>
            )}
            {score != null && (
              <div className="flex items-center gap-2 px-4 py-1.5 bg-white/5 rounded-full border border-white/10">
                <span className="text-2xl font-light">{score}</span>
                <span className="text-xs text-white/50">/100</span>
              </div>
            )}
            {/* Schedule Interview Button */}
            {candidate.pipeline_status !== "accepted" && candidate.pipeline_status !== "rejected" && (
              <button
                onClick={() => setShowScheduleModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-sm font-medium transition-colors"
              >
                <CalendarPlus className="w-4 h-4" />
                Schedule Interview
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="pt-28 px-6 pb-12 max-w-7xl mx-auto">
        {/* Top Section: Profile + Quick Stats */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
          {/* Profile Card */}
          <div className="glass-panel rounded-2xl p-6">
            <div className="flex flex-col items-center text-center mb-6">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-3xl font-light mb-4">
                {candidate.person_name?.charAt(0)?.toUpperCase() || "?"}
              </div>
              <h2 className="text-xl font-medium text-white mb-1">
                {candidate.person_name}
              </h2>
              {candidate.current_title && (
                <p className="text-white/60 text-sm">{candidate.current_title}</p>
              )}
            </div>

            <div className="space-y-3 border-t border-white/10 pt-4">
              {candidate.current_company && (
                <div className="flex items-center gap-3 text-sm">
                  <Briefcase className="w-4 h-4 text-white/40 flex-shrink-0" />
                  <span className="text-white/70">{candidate.current_company}</span>
                </div>
              )}
              {candidate.person_email && (
                <div className="flex items-center gap-3 text-sm">
                  <Mail className="w-4 h-4 text-white/40 flex-shrink-0" />
                  <span className="text-white/70 truncate">{candidate.person_email}</span>
                </div>
              )}
              {candidate.years_experience != null && (
                <div className="flex items-center gap-3 text-sm">
                  <Calendar className="w-4 h-4 text-white/40 flex-shrink-0" />
                  <span className="text-white/70">{candidate.years_experience} years experience</span>
                </div>
              )}
            </div>
          </div>

          {/* Quick Stats Cards */}
          <div className="lg:col-span-3 grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Overall Score */}
            <div className="glass-panel rounded-2xl p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center">
                  <Target className="w-5 h-5 text-indigo-400" />
                </div>
              </div>
              <div className="text-3xl font-light text-white mb-1">
                {score != null ? score : "—"}
              </div>
              <div className="text-xs text-white/50 uppercase tracking-wider">Overall Score</div>
            </div>

            {/* Skills Match */}
            <div className="glass-panel rounded-2xl p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
                  <Award className="w-5 h-5 text-green-400" />
                </div>
              </div>
              <div className="text-3xl font-light text-white mb-1">
                {strongMatches}
                <span className="text-base text-white/40">/{screeningNotes?.skill_matches?.length || 0}</span>
              </div>
              <div className="text-xs text-white/50 uppercase tracking-wider">Strong Skills</div>
            </div>

            {/* Green Flags */}
            <div className="glass-panel rounded-2xl p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-emerald-400" />
                </div>
              </div>
              <div className="text-3xl font-light text-emerald-400 mb-1">
                {screeningNotes?.green_flags?.length || 0}
              </div>
              <div className="text-xs text-white/50 uppercase tracking-wider">Green Flags</div>
            </div>

            {/* Red Flags */}
            <div className="glass-panel rounded-2xl p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-red-400" />
                </div>
              </div>
              <div className="text-3xl font-light text-red-400 mb-1">
                {screeningNotes?.red_flags?.length || 0}
              </div>
              <div className="text-xs text-white/50 uppercase tracking-wider">Red Flags</div>
            </div>
          </div>
        </div>

        {/* Fit Summary */}
        {screeningNotes?.fit_summary && (
          <div className="glass-panel rounded-2xl p-6 mb-6">
            <h3 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-indigo-400" />
              Fit Summary
            </h3>
            <p className="text-white/70 leading-relaxed text-lg">{screeningNotes.fit_summary}</p>
          </div>
        )}

        {/* Deal Breakers Alert */}
        {screeningNotes?.deal_breakers_triggered && screeningNotes.deal_breakers_triggered.length > 0 && (
          <div className="glass-panel rounded-2xl p-6 mb-6 border-2 border-red-500/40 bg-red-500/5">
            <h3 className="text-lg font-medium text-red-400 mb-4 flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Deal Breakers Triggered
            </h3>
            <div className="space-y-2">
              {screeningNotes.deal_breakers_triggered.map((db, i) => (
                <div key={i} className="flex items-center gap-3 p-3 bg-red-500/10 rounded-xl">
                  <XCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                  <span className="text-white/80">{db}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Skill Matches */}
        {screeningNotes?.skill_matches && screeningNotes.skill_matches.length > 0 && (
          <div className="glass-panel rounded-2xl p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-white flex items-center gap-2">
                <Award className="w-5 h-5 text-indigo-400" />
                Skill Matches
              </h3>
              <div className="flex items-center gap-3 text-sm">
                <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded-lg">{strongMatches} Strong</span>
                <span className="px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded-lg">{partialMatches} Partial</span>
                <span className="px-2 py-1 bg-red-500/20 text-red-400 rounded-lg">{noMatches} No Match</span>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {(showAllSkills ? screeningNotes.skill_matches : screeningNotes.skill_matches.slice(0, 9)).map((match, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-3 bg-white/5 rounded-xl hover:bg-white/10 transition-colors"
                >
                  <span className="text-white/80 font-medium">{match.skill}</span>
                  <span className={`px-2 py-1 text-xs rounded-lg ${getMatchLevelStyle(match.match_level)}`}>
                    {match.match_level}
                  </span>
                </div>
              ))}
            </div>
            {screeningNotes.skill_matches.length > 9 && (
              <button
                onClick={() => setShowAllSkills(!showAllSkills)}
                className="mt-4 flex items-center gap-2 text-indigo-400 hover:text-indigo-300 text-sm mx-auto"
              >
                {showAllSkills ? (
                  <>Show Less <ChevronUp className="w-4 h-4" /></>
                ) : (
                  <>Show All {screeningNotes.skill_matches.length} Skills <ChevronDown className="w-4 h-4" /></>
                )}
              </button>
            )}
          </div>
        )}

        {/* Green Flags & Red Flags */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Green Flags */}
          <div className="glass-panel rounded-2xl p-6">
            <h3 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-emerald-400" />
              Green Flags
              <span className="ml-auto text-sm font-normal text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded-lg">
                {screeningNotes?.green_flags?.length || 0}
              </span>
            </h3>
            {screeningNotes?.green_flags && screeningNotes.green_flags.length > 0 ? (
              <div className="space-y-3">
                {screeningNotes.green_flags.map((flag, i) => (
                  <div key={i} className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                    <div className="font-medium text-emerald-400 mb-2 flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      {flag.strength}
                    </div>
                    <div className="text-sm text-white/60 ml-6">{flag.evidence}</div>
                    {flag.matched_success_signal && (
                      <div className="mt-2 ml-6 text-xs text-emerald-400/70 italic">
                        Matches success signal: "{flag.matched_success_signal}"
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-white/40">
                <CheckCircle className="w-12 h-12 mx-auto mb-2 opacity-30" />
                <p>No green flags identified</p>
              </div>
            )}
          </div>

          {/* Red Flags */}
          <div className="glass-panel rounded-2xl p-6">
            <h3 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-400" />
              Red Flags
              <span className="ml-auto text-sm font-normal text-red-400 bg-red-500/20 px-2 py-0.5 rounded-lg">
                {screeningNotes?.red_flags?.length || 0}
              </span>
            </h3>
            {screeningNotes?.red_flags && screeningNotes.red_flags.length > 0 ? (
              <div className="space-y-3">
                {screeningNotes.red_flags.map((flag, i) => (
                  <div key={i} className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
                    <div className="flex items-start justify-between mb-2">
                      <span className="font-medium text-red-400 flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        {flag.concern}
                      </span>
                      <span className={`px-2 py-0.5 text-xs rounded-lg ${getSeverityStyle(flag.severity)}`}>
                        {flag.severity}
                      </span>
                    </div>
                    <div className="text-sm text-white/60 ml-6">{flag.evidence}</div>
                    {flag.matched_job_red_flag && (
                      <div className="mt-2 ml-6 text-xs text-red-400/70 italic">
                        Matches job red flag: "{flag.matched_job_red_flag}"
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-white/40">
                <AlertTriangle className="w-12 h-12 mx-auto mb-2 opacity-30" />
                <p>No red flags identified</p>
              </div>
            )}
          </div>
        </div>

        {/* Behavioral & Cultural Assessment */}
        {(behavioralBullets.length > 0 || culturalBullets.length > 0) && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Behavioral Assessment */}
            {behavioralBullets.length > 0 && (
              <div className="glass-panel rounded-2xl p-6">
                <h3 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
                  <Brain className="w-5 h-5 text-purple-400" />
                  Behavioral Assessment
                </h3>
                <ul className="space-y-3">
                  {behavioralBullets.map((bullet, i) => (
                    <li key={i} className="flex items-start gap-3 text-white/70">
                      <div className="w-1.5 h-1.5 rounded-full bg-purple-400 mt-2 flex-shrink-0" />
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Cultural Fit */}
            {culturalBullets.length > 0 && (
              <div className="glass-panel rounded-2xl p-6">
                <h3 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
                  <Heart className="w-5 h-5 text-pink-400" />
                  Cultural Fit
                </h3>
                <ul className="space-y-3">
                  {culturalBullets.map((bullet, i) => (
                    <li key={i} className="flex items-start gap-3 text-white/70">
                      <div className="w-1.5 h-1.5 rounded-full bg-pink-400 mt-2 flex-shrink-0" />
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Interview Questions */}
        {screeningNotes?.interview_questions && screeningNotes.interview_questions.length > 0 && (
          <div className="glass-panel rounded-2xl p-6 mb-6">
            <h3 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-indigo-400" />
              Suggested Interview Questions
            </h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {screeningNotes.interview_questions.map((question, i) => (
                <div
                  key={i}
                  className="flex items-start gap-4 p-4 bg-white/5 rounded-xl hover:bg-white/10 transition-colors"
                >
                  <span className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-sm font-medium">
                    {i + 1}
                  </span>
                  <span className="text-white/80 pt-1">{question}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Candidate Skills */}
        {candidate.skills && candidate.skills.length > 0 && (
          <div className="glass-panel rounded-2xl p-6">
            <h3 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-indigo-400" />
              Candidate Skills
              <span className="ml-auto text-sm font-normal text-white/40">
                {candidate.skills.length} skills
              </span>
            </h3>
            <div className="flex flex-wrap gap-2">
              {candidate.skills.map((skill, i) => (
                <span
                  key={i}
                  className="px-3 py-1.5 text-sm bg-white/5 border border-white/10 rounded-lg text-white/70 hover:bg-white/10 transition-colors"
                >
                  {skill}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Schedule Interview Modal */}
      <ScheduleInterviewModal
        isOpen={showScheduleModal}
        onClose={() => setShowScheduleModal(false)}
        onScheduled={() => {
          setShowScheduleModal(false);
          fetchData();
        }}
        candidateId={candidate.id}
        candidateName={candidate.person_name}
        jobId={resolvedParams.id}
        jobTitle={job?.title || "Interview"}
        stage={candidate.pipeline_status === "new" ? "round_1" :
               candidate.pipeline_status === "round_1" ? "round_2" :
               candidate.pipeline_status === "round_2" ? "round_3" : "round_1"}
      />
    </main>
  );
}
