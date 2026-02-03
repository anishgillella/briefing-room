"use client";

import { useState, useEffect, use, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, useReducedMotion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import Vapi from "@vapi-ai/web";
import { cn } from "@/lib/utils";
import InterviewerSelector from "@/components/InterviewerSelector";
import { setSelectedInterviewerId } from "@/lib/interviewerApi";
import AppLayout from "@/components/AppLayout";
import {
  tokens,
  springConfig,
  easeOutCustom,
  ambientGradient,
  grainTexture,
  getStatusColor,
} from "@/lib/design-tokens";
import { useGlobalTalentProfile, type GlobalTalentProfile } from "@/hooks/useApi";
import {
  ArrowLeft,
  User,
  Mail,
  Phone,
  MapPin,
  Building2,
  Briefcase,
  GraduationCap,
  ExternalLink,
  ChevronRight,
  Clock,
  Star,
  TrendingUp,
  Target,
  BarChart3,
  Award,
  Sparkles,
  TrendingDown,
  Mic,
  MicOff,
  Loader2,
  PlayCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/ui/avatar";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface WorkHistory {
  company: string | null;
  title: string | null;
  start_date: string | null;
  end_date: string | null;
  is_current: boolean;
}

interface Education {
  school: string | null;
  degree: string | null;
  field_of_study: string | null;
  start_date: string | null;
  end_date: string | null;
}

interface Application {
  candidate_id: string;
  job_id: string | null;
  job_title: string | null;
  pipeline_status: string | null;
  interview_status: string | null;
  ranking_score: number | null;
  created_at: string | null;
}

interface PersonDetail {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  linkedin_url: string | null;
  resume_url: string | null;
  headline: string | null;
  summary: string | null;
  current_title: string | null;
  current_company: string | null;
  location: string | null;
  years_experience: number | null;
  skills: string[];
  work_history: WorkHistory[];
  education: Education[];
  created_at: string | null;
  updated_at: string | null;
  applications: Application[];
}

// =============================================================================
// SCORE RING - Circular Progress Component
// =============================================================================
function ScoreRing({
  score,
  size = 120,
  strokeWidth = 8,
  label,
}: {
  score: number | null;
  size?: number;
  strokeWidth?: number;
  label?: string;
}) {
  const shouldReduceMotion = useReducedMotion();
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const normalizedScore = score !== null ? Math.min(100, Math.max(0, score)) : 0;
  const offset = circumference - (normalizedScore / 100) * circumference;

  const getScoreColor = (s: number) => {
    if (s >= 80) return tokens.statusSuccess;
    if (s >= 60) return tokens.brandPrimary;
    if (s >= 40) return tokens.statusWarning;
    return tokens.statusDanger;
  };

  const scoreColor = score !== null ? getScoreColor(score) : tokens.textMuted;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={tokens.borderDefault}
          strokeWidth={strokeWidth}
        />
        {/* Progress circle */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={scoreColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={
            shouldReduceMotion
              ? { duration: 0 }
              : { duration: 1, ease: "easeOut", delay: 0.3 }
          }
          style={{
            filter: `drop-shadow(0 0 8px ${scoreColor}40)`,
          }}
        />
      </svg>
      {/* Center text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5 }}
          className="text-3xl font-bold tabular-nums"
          style={{
            color: score !== null ? tokens.textPrimary : tokens.textMuted,
            fontFamily: "var(--font-mono), monospace",
          }}
        >
          {score !== null ? Math.round(score) : "—"}
        </motion.span>
        {label && (
          <span className="text-xs mt-1" style={{ color: tokens.textMuted }}>
            {label}
          </span>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// STATUS BREAKDOWN BAR
// =============================================================================
function StatusBreakdownBar({
  breakdown,
  total,
}: {
  breakdown: Record<string, number>;
  total: number;
}) {
  if (total === 0) return null;

  const statusColors: Record<string, string> = {
    new: tokens.textMuted,
    round_1: tokens.brandPrimary,
    round_2: tokens.brandSecondary,
    round_3: "#A78BFA",
    decision_pending: tokens.statusWarning,
    accepted: tokens.statusSuccess,
    rejected: tokens.statusDanger,
  };

  const segments = Object.entries(breakdown).map(([status, count]) => ({
    status,
    count,
    percentage: (count / total) * 100,
    color: statusColors[status] || tokens.textMuted,
  }));

  return (
    <div className="space-y-3">
      {/* Bar */}
      <div
        className="h-3 rounded-full overflow-hidden flex"
        style={{ backgroundColor: tokens.bgSurfaceHover }}
      >
        {segments.map((segment, i) => (
          <motion.div
            key={segment.status}
            initial={{ width: 0 }}
            animate={{ width: `${segment.percentage}%` }}
            transition={{ duration: 0.5, delay: i * 0.1, ease: easeOutCustom }}
            style={{
              backgroundColor: segment.color,
              height: "100%",
            }}
          />
        ))}
      </div>
      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs">
        {segments.map((segment) => (
          <div key={segment.status} className="flex items-center gap-2">
            <div
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: segment.color }}
            />
            <span style={{ color: tokens.textSecondary }}>
              {segment.status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
            </span>
            <span
              className="tabular-nums font-medium"
              style={{ color: tokens.textPrimary }}
            >
              {segment.count}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// =============================================================================
// GLOBAL PERFORMANCE SECTION
// =============================================================================
function GlobalPerformanceSection({ profile }: { profile: GlobalTalentProfile }) {
  const stats = [
    {
      label: "Avg Score",
      value: profile.average_score !== null ? Math.round(profile.average_score) : "—",
      icon: Target,
      color: tokens.brandPrimary,
    },
    {
      label: "Highest",
      value: profile.highest_score !== null ? profile.highest_score : "—",
      icon: TrendingUp,
      color: tokens.statusSuccess,
    },
    {
      label: "Lowest",
      value: profile.lowest_score !== null ? profile.lowest_score : "—",
      icon: BarChart3,
      color: tokens.statusWarning,
    },
    {
      label: "Applications",
      value: profile.total_applications,
      icon: Briefcase,
      color: tokens.brandSecondary,
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2, ease: easeOutCustom }}
      className="rounded-2xl p-6"
      style={{
        backgroundColor: tokens.bgCard,
        border: `1px solid ${tokens.borderDefault}`,
      }}
    >
      <div className="flex items-center gap-2 mb-6">
        <Award className="w-5 h-5" style={{ color: tokens.brandPrimary }} />
        <h3 className="font-semibold" style={{ color: tokens.textPrimary }}>
          Global Performance
        </h3>
      </div>

      <div className="flex flex-col lg:flex-row items-center gap-8">
        {/* Score Ring */}
        <ScoreRing score={profile.average_score} label="Average" />

        {/* Stats Grid */}
        <div className="flex-1 grid grid-cols-2 gap-4">
          {stats.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + i * 0.1 }}
              className="p-4 rounded-xl"
              style={{ backgroundColor: tokens.bgSurface }}
            >
              <div className="flex items-center gap-2 mb-2">
                <stat.icon
                  className="w-4 h-4"
                  style={{ color: stat.color }}
                />
                <span className="text-xs" style={{ color: tokens.textMuted }}>
                  {stat.label}
                </span>
              </div>
              <span
                className="text-2xl font-bold tabular-nums"
                style={{
                  color: tokens.textPrimary,
                  fontFamily: "var(--font-mono), monospace",
                }}
              >
                {stat.value}
              </span>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Status Breakdown */}
      {Object.keys(profile.status_breakdown).length > 0 && (
        <div className="mt-6 pt-6" style={{ borderTop: `1px solid ${tokens.borderSubtle}` }}>
          <h4 className="text-sm font-medium mb-4" style={{ color: tokens.textSecondary }}>
            Pipeline Distribution
          </h4>
          <StatusBreakdownBar
            breakdown={profile.status_breakdown}
            total={profile.total_applications}
          />
        </div>
      )}
    </motion.div>
  );
}

// =============================================================================
// ENHANCED APPLICATION CARD
// =============================================================================
function ApplicationCard({
  app,
  index,
}: {
  app: GlobalTalentProfile["applications"][0];
  index: number;
}) {
  const statusStyle = getStatusColor(app.pipeline_status);
  const score = app.score;

  const getScoreColor = (s: number | null) => {
    if (s === null) return tokens.textMuted;
    if (s >= 80) return tokens.statusSuccess;
    if (s >= 60) return tokens.brandPrimary;
    if (s >= 40) return tokens.statusWarning;
    return tokens.statusDanger;
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
    >
      <Link href={app.job_id ? `/jobs/${app.job_id}` : "#"}>
        <div
          className="group flex items-center justify-between p-4 rounded-xl transition-all duration-200 cursor-pointer"
          style={{
            backgroundColor: tokens.bgSurface,
            border: `1px solid ${tokens.borderSubtle}`,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = tokens.borderHover;
            e.currentTarget.style.backgroundColor = tokens.bgSurfaceHover;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = tokens.borderSubtle;
            e.currentTarget.style.backgroundColor = tokens.bgSurface;
          }}
        >
          <div className="flex-1 min-w-0">
            <h4
              className="font-medium truncate group-hover:text-indigo-400 transition-colors"
              style={{ color: tokens.textPrimary }}
            >
              {app.job_title || "Unknown Job"}
            </h4>
            <div className="flex items-center gap-3 mt-2">
              {/* Status Badge */}
              <span
                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium capitalize"
                style={{ backgroundColor: statusStyle.bg, color: statusStyle.text }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: statusStyle.dot }}
                />
                {app.pipeline_status.replace(/_/g, " ")}
              </span>
              {/* Date */}
              {app.created_at && (
                <span className="text-xs" style={{ color: tokens.textMuted }}>
                  {new Date(app.created_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
              )}
            </div>
          </div>

          {/* Score */}
          <div className="flex items-center gap-3">
            {score !== null && (
              <div className="text-right">
                <div className="flex items-center gap-2">
                  <div
                    className="h-1.5 w-16 rounded-full overflow-hidden"
                    style={{ backgroundColor: tokens.bgSurfaceHover }}
                  >
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.min(100, score)}%`,
                        backgroundColor: getScoreColor(score),
                      }}
                    />
                  </div>
                  <span
                    className="text-lg font-semibold tabular-nums"
                    style={{
                      color: getScoreColor(score),
                      fontFamily: "var(--font-mono), monospace",
                    }}
                  >
                    {Math.round(score)}
                  </span>
                </div>
              </div>
            )}
            <ChevronRight
              className="w-4 h-4 transition-transform group-hover:translate-x-1"
              style={{ color: tokens.textMuted }}
            />
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

// =============================================================================
// SECTION CARD
// =============================================================================
function SectionCard({
  title,
  icon: Icon,
  children,
  delay = 0,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  children: React.ReactNode;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: easeOutCustom }}
      className="rounded-2xl p-6"
      style={{
        backgroundColor: tokens.bgCard,
        border: `1px solid ${tokens.borderDefault}`,
      }}
    >
      <div className="flex items-center gap-2 mb-4">
        <Icon className="w-4 h-4" style={{ color: tokens.textMuted }} />
        <h3 className="text-sm font-medium" style={{ color: tokens.textSecondary }}>
          {title}
        </h3>
      </div>
      {children}
    </motion.div>
  );
}

// =============================================================================
// LOADING STATE
// =============================================================================
function LoadingState() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: tokens.bgApp }}>
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        className="w-8 h-8 border-2 rounded-full"
        style={{
          borderColor: tokens.borderDefault,
          borderTopColor: tokens.brandPrimary,
        }}
      />
    </div>
  );
}

// =============================================================================
// MAIN PAGE
// =============================================================================
export default function PersonDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading, token } = useAuth();

  const [person, setPerson] = useState<PersonDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const { data: globalProfile, isLoading: profileLoading } = useGlobalTalentProfile(
    person?.id
  );

  // Interview & Voice State
  const [startingInterview, setStartingInterview] = useState(false);
  const [selectedInterviewer, setSelectedInterviewer] = useState<string | null>(null);
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const [isVoiceConnecting, setIsVoiceConnecting] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState<string[]>([]);
  const vapiRef = useRef<Vapi | null>(null);

  // Build briefing context for voice agent
  const buildBriefingContext = useCallback(() => {
    if (!person) return "";
    const parts = [
      `Candidate: ${person.name}`,
      person.current_title ? `Current Role: ${person.current_title}` : "",
      person.years_experience ? `Experience: ${person.years_experience} years` : "",
      person.summary ? `Summary: ${person.summary}` : "",
      person.skills?.length ? `Skills: ${person.skills.join(", ")}` : "",
    ];
    return parts.filter(Boolean).join("\n");
  }, [person]);

  // Start voice agent
  const startVoiceAgent = useCallback(async () => {
    const vapiKey = process.env.NEXT_PUBLIC_VAPI_WEB_KEY;
    const assistantId = process.env.NEXT_PUBLIC_VAPI_BRIEFING_ASSISTANT_ID;

    if (!vapiKey) {
      alert("Voice AI not configured. Add NEXT_PUBLIC_VAPI_WEB_KEY to .env.local");
      return;
    }

    setIsVoiceConnecting(true);
    setVoiceTranscript([]);

    try {
      const vapi = new Vapi(vapiKey);
      vapiRef.current = vapi;

      vapi.on("call-start", () => {
        setIsVoiceConnecting(false);
        setIsVoiceActive(true);
        setVoiceTranscript((prev) => [
          ...prev,
          "Voice assistant connected. Ask me anything about this candidate!",
        ]);
      });

      vapi.on("call-end", () => {
        setIsVoiceActive(false);
        setVoiceTranscript((prev) => [...prev, "Voice assistant disconnected."]);
      });

      vapi.on("message", (msg: any) => {
        if (msg.type === "transcript" && msg.transcript) {
          const role = msg.role === "assistant" ? "AI:" : "You:";
          setVoiceTranscript((prev) => [...prev, `${role} ${msg.transcript}`]);
        }
      });

      vapi.on("error", (err: any) => {
        console.error("VAPI error:", err);
        setIsVoiceConnecting(false);
        setIsVoiceActive(false);
        if (err && Object.keys(err).length > 0) {
          setVoiceTranscript((prev) => [...prev, `Error: ${err.message || JSON.stringify(err)}`]);
        }
      });

      const briefingContext = buildBriefingContext();

      if (assistantId) {
        await vapi.start(assistantId, {
          variableValues: {
            candidateName: person?.name || "the candidate",
            briefingContext: briefingContext,
          },
        });
      } else {
        await vapi.start({
          model: {
            provider: "openai",
            model: "gpt-4o-mini",
            messages: [
              {
                role: "system",
                content: `You are a helpful interview preparation assistant. You're helping a recruiter prepare for an interview with a candidate.

Here's the candidate information:
${briefingContext}

Help by:
- Answering questions about the candidate's background
- Suggesting probing questions based on their experience
- Highlighting concerns or red flags to explore
- Providing interviewing tips specific to this candidate

Be concise and helpful. The recruiter has limited time before the interview.`,
              },
            ],
          },
          voice: {
            provider: "11labs",
            voiceId: "21m00Tcm4TlvDq8ikWAM",
          },
          firstMessage: `Hi! I'm ready to help you prepare for your interview with ${person?.name || "this candidate"}. What would you like to know?`,
        });
      }
    } catch (err) {
      console.error("Voice agent failed:", err);
      setIsVoiceConnecting(false);
      const errorMsg = err instanceof Error ? err.message : JSON.stringify(err);
      alert(`Failed to start voice AI: ${errorMsg}`);
    }
  }, [person, buildBriefingContext]);

  // Stop voice agent
  const stopVoiceAgent = useCallback(() => {
    if (vapiRef.current) {
      vapiRef.current.stop();
      vapiRef.current = null;
    }
    setIsVoiceActive(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (vapiRef.current) {
        vapiRef.current.stop();
      }
    };
  }, []);

  const handleVoiceToggle = () => {
    if (isVoiceActive) {
      stopVoiceAgent();
    } else {
      startVoiceAgent();
    }
  };

  const handleStartInterview = async () => {
    setStartingInterview(true);
    try {
      const res = await fetch(`${API_URL}/api/pluto/talent-pool/${resolvedParams.id}/interview/start`, {
        method: "POST",
        headers: getAuthHeaders(), // Added auth headers
      });
      if (res.ok) {
        const data = await res.json();
        // Use legacy route for now, or update if route is ported
        router.push(`/talent-pool/${resolvedParams.id}/interview?room=${data.room_name}`);
      } else {
        const data = await res.json();
        alert(data.detail || "Failed to start interview");
      }
    } catch (e) {
      alert("Failed to start interview");
    } finally {
      setStartingInterview(false);
    }
  };

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, authLoading, router]);

  useEffect(() => {
    if (isAuthenticated && token) {
      fetchPerson();
    }
  }, [resolvedParams.id, isAuthenticated, token]);

  const getAuthHeaders = (): Record<string, string> => {
    const headers: Record<string, string> = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    return headers;
  };

  const fetchPerson = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/api/talent-pool/${resolvedParams.id}`, {
        headers: getAuthHeaders(),
      });

      if (response.ok) {
        const data = await response.json();
        setPerson(data);
      } else if (response.status === 401) {
        router.push("/login");
      } else if (response.status === 404) {
        router.push("/talent-pool");
      }
    } catch (error) {
      console.error("Failed to fetch person:", error);
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || loading) {
    return <LoadingState />;
  }

  if (!person) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: tokens.bgApp }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center p-8 rounded-2xl"
          style={{
            backgroundColor: tokens.bgCard,
            border: `1px solid ${tokens.borderDefault}`,
          }}
        >
          <User className="w-12 h-12 mx-auto mb-4" style={{ color: tokens.textMuted }} />
          <p className="mb-4" style={{ color: tokens.textSecondary }}>Person not found</p>
          <Button variant="ghost" onClick={() => router.push("/talent-pool")}>
            Back to Talent Pool
          </Button>
        </motion.div>
      </div>
    );
  }


  const formatDate = (dateString: string | null) => {
    if (!dateString) return "?";
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    } catch {
      return dateString;
    }
  };

  return (
    <AppLayout>
      <div className="min-h-screen relative" style={{ backgroundColor: tokens.bgApp }}>
        {/* Ambient gradient */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: ambientGradient }}
        />

        {/* Grain texture */}
        <div
          className="absolute inset-0 pointer-events-none mix-blend-overlay opacity-30"
          style={{ backgroundImage: grainTexture }}
        />

        {/* Content */}
        <div className="relative px-8 py-8 max-w-6xl mx-auto">
          {/* Back Button */}
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="mb-6"
          >
            <Link
              href="/talent-pool"
              className="inline-flex items-center gap-2 text-sm transition-colors hover:text-white"
              style={{ color: tokens.textMuted }}
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Talent Pool
            </Link>

            <div className="flex gap-3 items-center">
              {/* Voice indicator */}
              <AnimatePresence>
                {isVoiceActive && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="flex items-center gap-2 px-3 py-1.5 bg-indigo-500/20 border border-indigo-500/30 rounded-full"
                  >
                    <motion.div
                      className="w-2 h-2 bg-indigo-400 rounded-full"
                      animate={{ opacity: [1, 0.4, 1] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                    />
                    <span className="text-sm text-indigo-300">AI Listening...</span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Voice AI Button */}
              <Button
                variant={isVoiceActive ? "danger" : "secondary"}
                size="sm"
                onClick={handleVoiceToggle}
                disabled={isVoiceConnecting}
                leftIcon={
                  isVoiceConnecting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : isVoiceActive ? (
                    <MicOff className="w-4 h-4" />
                  ) : (
                    <Mic className="w-4 h-4" />
                  )
                }
              >
                {isVoiceConnecting ? "Connecting..." : isVoiceActive ? "Stop AI" : "Ask AI"}
              </Button>

              {/* Interviewer Selector */}
              <div className="hidden md:block">
                <InterviewerSelector
                  label="As"
                  onInterviewerChange={(id) => {
                    setSelectedInterviewer(id);
                    setSelectedInterviewerId(id);
                  }}
                  className="min-w-[140px]"
                />
              </div>

              {/* Start Interview */}
              <Button
                variant="primary"
                onClick={handleStartInterview}
                disabled={startingInterview || !selectedInterviewer}
                leftIcon={
                  startingInterview ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <PlayCircle className="w-5 h-5" />
                  )
                }
              >
                Start Interview
              </Button>
            </div>
          </motion.div>

          {/* Profile Hero Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: easeOutCustom }}
            className="rounded-2xl p-8 mb-6"
            style={{
              backgroundColor: tokens.bgCard,
              border: `1px solid ${tokens.borderDefault}`,
            }}
          >
            <div className="flex flex-col md:flex-row items-start gap-6">
              {/* Avatar */}
              <UserAvatar name={person.name} size="xl" />

              {/* Info */}
              <div className="flex-1">
                <h1
                  className="text-2xl font-bold mb-1"
                  style={{ color: tokens.textPrimary }}
                >
                  {person.name}
                </h1>
                {person.headline && (
                  <p className="text-lg mb-4" style={{ color: tokens.textSecondary }}>
                    {person.headline}
                  </p>
                )}

                {/* Contact Row */}
                <div className="flex flex-wrap gap-4 mb-4">
                  {person.email && (
                    <a
                      href={`mailto:${person.email}`}
                      className="flex items-center gap-2 text-sm transition-colors hover:text-indigo-400"
                      style={{ color: tokens.textMuted }}
                    >
                      <Mail className="w-4 h-4" />
                      {person.email}
                    </a>
                  )}
                  {person.phone && (
                    <span
                      className="flex items-center gap-2 text-sm"
                      style={{ color: tokens.textMuted }}
                    >
                      <Phone className="w-4 h-4" />
                      {person.phone}
                    </span>
                  )}
                  {person.location && (
                    <span
                      className="flex items-center gap-2 text-sm"
                      style={{ color: tokens.textMuted }}
                    >
                      <MapPin className="w-4 h-4" />
                      {person.location}
                    </span>
                  )}
                  {person.current_company && (
                    <span
                      className="flex items-center gap-2 text-sm"
                      style={{ color: tokens.textMuted }}
                    >
                      <Building2 className="w-4 h-4" />
                      {person.current_title && `${person.current_title} at `}
                      {person.current_company}
                    </span>
                  )}
                  {person.years_experience && (
                    <span
                      className="flex items-center gap-2 text-sm"
                      style={{ color: tokens.textMuted }}
                    >
                      <Clock className="w-4 h-4" />
                      {person.years_experience} years
                    </span>
                  )}
                </div>

                {/* Links */}
                {(person.linkedin_url || person.resume_url) && (
                  <div className="flex gap-3">
                    {person.linkedin_url && (
                      <a href={person.linkedin_url} target="_blank" rel="noopener noreferrer">
                        <Button variant="secondary" size="sm" leftIcon={<ExternalLink className="w-3 h-3" />}>
                          LinkedIn
                        </Button>
                      </a>
                    )}
                    {person.resume_url && (
                      <a href={person.resume_url} target="_blank" rel="noopener noreferrer">
                        <Button variant="ghost" size="sm" leftIcon={<ExternalLink className="w-3 h-3" />}>
                          Resume
                        </Button>
                      </a>
                    )}
                  </div>
                )}
              </div>

              {/* Key Stats */}
              {globalProfile && (
                <div className="flex gap-4">
                  <div
                    className="text-center p-4 rounded-xl"
                    style={{ backgroundColor: tokens.bgSurface }}
                  >
                    <div
                      className="text-2xl font-bold tabular-nums"
                      style={{
                        color: tokens.textPrimary,
                        fontFamily: "var(--font-mono), monospace",
                      }}
                    >
                      {globalProfile.total_applications}
                    </div>
                    <div className="text-xs mt-1" style={{ color: tokens.textMuted }}>
                      Applications
                    </div>
                  </div>
                  <div
                    className="text-center p-4 rounded-xl"
                    style={{ backgroundColor: tokens.bgSurface }}
                  >
                    <div
                      className="text-2xl font-bold tabular-nums"
                      style={{
                        color: globalProfile.average_score
                          ? globalProfile.average_score >= 70
                            ? tokens.statusSuccess
                            : tokens.brandPrimary
                          : tokens.textMuted,
                        fontFamily: "var(--font-mono), monospace",
                      }}
                    >
                      {globalProfile.average_score !== null
                        ? Math.round(globalProfile.average_score)
                        : "—"}
                    </div>
                    <div className="text-xs mt-1" style={{ color: tokens.textMuted }}>
                      Avg Score
                    </div>
                  </div>
                </div>
              )}
            </div>
          </motion.div>

          {/* Two Column Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column - Profile Details */}
            <div className="space-y-6">
              {/* Skills */}
              {person.skills && person.skills.length > 0 && (
                <SectionCard title="Skills" icon={Star} delay={0.1}>
                  <div className="flex flex-wrap gap-2">
                    {person.skills.map((skill, index) => (
                      <motion.span
                        key={skill}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.15 + index * 0.02 }}
                        className="px-3 py-1.5 rounded-lg text-sm"
                        style={{
                          backgroundColor: tokens.brandGlow,
                          color: tokens.brandPrimary,
                          border: `1px solid ${tokens.brandPrimary}30`,
                        }}
                      >
                        {skill}
                      </motion.span>
                    ))}
                  </div>
                </SectionCard>
              )}

              {/* Summary */}
              {person.summary && (
                <SectionCard title="About" icon={User} delay={0.15}>
                  <p
                    className="text-sm leading-relaxed whitespace-pre-wrap"
                    style={{ color: tokens.textSecondary }}
                  >
                    {person.summary}
                  </p>
                </SectionCard>
              )}
            </div>

            {/* Right Column - Performance & History */}
            <div className="lg:col-span-2 space-y-6">
              {/* Global Performance */}
              {globalProfile && !profileLoading && (
                <GlobalPerformanceSection profile={globalProfile} />
              )}

              {/* Applications */}
              {globalProfile && globalProfile.applications.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.3, ease: easeOutCustom }}
                  className="rounded-2xl p-6"
                  style={{
                    backgroundColor: tokens.bgCard,
                    border: `1px solid ${tokens.borderDefault}`,
                  }}
                >
                  <div className="flex items-center gap-2 mb-4">
                    <Briefcase className="w-4 h-4" style={{ color: tokens.textMuted }} />
                    <h3 className="text-sm font-medium" style={{ color: tokens.textSecondary }}>
                      Job Applications ({globalProfile.applications.length})
                    </h3>
                  </div>
                  <div className="space-y-3">
                    {globalProfile.applications.map((app, index) => (
                      <ApplicationCard key={app.candidate_id} app={app} index={index} />
                    ))}
                  </div>
                </motion.div>
              )}

              {/* Work History */}
              {person.work_history && person.work_history.length > 0 && (
                <SectionCard title="Work Experience" icon={Briefcase} delay={0.35}>
                  <div className="space-y-4">
                    {person.work_history.map((job, index) => (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.4 + index * 0.05 }}
                        className="pl-4"
                        style={{
                          borderLeft: `2px solid ${job.is_current ? tokens.brandPrimary : tokens.borderSubtle}`,
                        }}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <h4
                              className="font-medium flex items-center gap-2"
                              style={{ color: tokens.textPrimary }}
                            >
                              {job.title || "Position"}
                              {job.is_current && (
                                <span
                                  className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
                                  style={{
                                    backgroundColor: tokens.statusInfoBg,
                                    color: tokens.statusInfo,
                                  }}
                                >
                                  Current
                                </span>
                              )}
                            </h4>
                            <p className="text-sm" style={{ color: tokens.textSecondary }}>
                              {job.company || "Company"}
                            </p>
                          </div>
                          {(job.start_date || job.end_date) && (
                            <span className="text-xs" style={{ color: tokens.textMuted }}>
                              {formatDate(job.start_date)} - {job.is_current ? "Present" : formatDate(job.end_date)}
                            </span>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </SectionCard>
              )}

              {/* Education */}
              {person.education && person.education.length > 0 && (
                <SectionCard title="Education" icon={GraduationCap} delay={0.4}>
                  <div className="space-y-4">
                    {person.education.map((edu, index) => (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.45 + index * 0.05 }}
                        className="pl-4"
                        style={{ borderLeft: `2px solid ${tokens.borderSubtle}` }}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="font-medium" style={{ color: tokens.textPrimary }}>
                              {edu.school || "School"}
                            </h4>
                            <p className="text-sm" style={{ color: tokens.textSecondary }}>
                              {edu.degree}
                              {edu.degree && edu.field_of_study && " in "}
                              {edu.field_of_study}
                            </p>
                          </div>
                          {(edu.start_date || edu.end_date) && (
                            <span className="text-xs" style={{ color: tokens.textMuted }}>
                              {formatDate(edu.start_date)} - {formatDate(edu.end_date)}
                            </span>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </SectionCard>
              )}
            </div>
          </div>
        </div>
      </div>
      {/* Floating Voice Assistant Panel */}
      <AnimatePresence>
        {(isVoiceActive || voiceTranscript.length > 0) && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={springConfig}
            className="fixed bottom-6 right-6 w-96 max-h-[400px] backdrop-blur-xl rounded-2xl shadow-2xl overflow-hidden z-50"
            style={{
              backgroundColor: `${tokens.bgCard}f5`,
              border: `1px solid ${tokens.brandPrimary}30`,
              boxShadow: `0 25px 50px -12px ${tokens.brandPrimary}20`,
            }}
          >
            <div
              className="p-4 flex items-center justify-between"
              style={{ borderBottom: `1px solid ${tokens.borderSubtle}` }}
            >
              <div className="flex items-center gap-3">
                <motion.div
                  className={cn(
                    "w-3 h-3 rounded-full",
                    isVoiceActive ? "bg-indigo-400" : "bg-zinc-500"
                  )}
                  animate={isVoiceActive ? { opacity: [1, 0.4, 1] } : {}}
                  transition={{ duration: 1.5, repeat: Infinity }}
                />
                <span className="font-semibold text-white">Voice Assistant</span>
              </div>
              <div className="flex gap-2">
                {isVoiceActive && (
                  <Button variant="danger" size="sm" onClick={stopVoiceAgent}>
                    Stop
                  </Button>
                )}
                {!isVoiceActive && voiceTranscript.length > 0 && (
                  <Button variant="ghost" size="sm" onClick={() => setVoiceTranscript([])}>
                    Clear
                  </Button>
                )}
              </div>
            </div>
            <div className="p-4 max-h-[320px] overflow-y-auto space-y-2">
              {voiceTranscript.length === 0 && !isVoiceActive && (
                <p className="text-zinc-500 text-sm text-center py-4">
                  Click &quot;Ask AI&quot; to start voice assistant
                </p>
              )}
              {voiceTranscript.map((line, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.05 }}
                  className={cn(
                    "text-sm",
                    line.startsWith("AI:")
                      ? "text-indigo-300"
                      : line.startsWith("You:")
                        ? "text-white"
                        : line.includes("connected")
                          ? "text-emerald-400"
                          : line.includes("disconnected")
                            ? "text-amber-400"
                            : line.includes("Error")
                              ? "text-red-400"
                              : "text-zinc-400"
                  )}
                >
                  {line}
                </motion.div>
              ))}
              {isVoiceActive && (
                <motion.div
                  className="flex items-center gap-2 text-indigo-400 text-sm"
                  animate={{ opacity: [1, 0.5, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  <Mic className="w-4 h-4" />
                  <span>Listening...</span>
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </AppLayout>
  );
}
