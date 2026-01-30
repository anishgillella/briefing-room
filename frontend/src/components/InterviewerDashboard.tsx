"use client";

import { useState, useEffect } from "react";
import {
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  MessageSquare,
  Target,
  Users,
  Shield,
  Lightbulb,
  UserCheck,
  Loader2,
} from "lucide-react";
import {
  getInterviewerAnalytics,
  getSelectedInterviewerId,
  InterviewerAnalyticsResponse,
} from "@/lib/interviewerApi";
import InterviewerSelector from "./InterviewerSelector";
import { tokens } from "@/lib/design-tokens";

// =============================================================================
// STAT CARD COMPONENT
// =============================================================================

interface StatCardProps {
  icon: React.ReactNode;
  value: number;
  label: string;
  color: string;
  maxValue?: number;
  inverted?: boolean;
  note?: string;
}

function StatCard({ icon, value, label, color, maxValue = 100, inverted = false, note }: StatCardProps) {
  const getScoreColor = (score: number, inv: boolean) => {
    if (inv) {
      if (score <= 20) return tokens.statusSuccess;
      if (score <= 50) return tokens.statusWarning;
      return tokens.statusDanger;
    }
    if (score >= 80) return tokens.statusSuccess;
    if (score >= 60) return tokens.statusWarning;
    return tokens.statusDanger;
  };

  const scoreColor = getScoreColor(value, inverted);

  return (
    <div
      className="relative overflow-hidden rounded-2xl border group"
      style={{
        backgroundColor: tokens.bgCard,
        borderColor: `${scoreColor}30`,
      }}
    >
      <div
        className="absolute -top-12 -right-12 w-32 h-32 rounded-full opacity-20 blur-3xl"
        style={{ backgroundColor: scoreColor }}
      />

      <div className="relative p-5">
        <div className="flex items-center gap-2 mb-3">
          <div style={{ color: tokens.textMuted }}>{icon}</div>
          <span className="text-xs uppercase tracking-wider" style={{ color: tokens.textMuted }}>
            {label}
          </span>
        </div>
        <div className="text-3xl font-light" style={{ color: scoreColor }}>
          {value.toFixed(0)}
          <span className="text-lg ml-1" style={{ color: tokens.textMuted }}>/{maxValue}</span>
        </div>
        {note && (
          <div className="mt-2 text-xs flex items-center gap-1" style={{ color: tokens.statusSuccess }}>
            <CheckCircle className="w-3 h-3" />
            {note}
          </div>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// SECTION CARD COMPONENT
// =============================================================================

interface SectionCardProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  variant?: "default" | "warning" | "danger" | "success";
}

function SectionCard({ title, icon, children, variant = "default" }: SectionCardProps) {
  const colors = {
    default: { border: tokens.borderSubtle, accent: tokens.brandPrimary },
    warning: { border: `${tokens.statusWarning}50`, accent: tokens.statusWarning },
    danger: { border: `${tokens.statusDanger}50`, accent: tokens.statusDanger },
    success: { border: `${tokens.statusSuccess}50`, accent: tokens.statusSuccess },
  };

  const colorSet = colors[variant];

  return (
    <div
      className="rounded-2xl border"
      style={{
        backgroundColor: tokens.bgCard,
        borderColor: tokens.borderSubtle,
        borderLeftWidth: variant !== "default" ? "4px" : "1px",
        borderLeftColor: variant !== "default" ? colorSet.accent : tokens.borderSubtle,
      }}
    >
      <div
        className="flex items-center justify-between px-5 py-4 border-b"
        style={{ borderColor: tokens.borderSubtle }}
      >
        <h3 className="text-lg font-medium text-white flex items-center gap-2">
          <span style={{ color: colorSet.accent }}>{icon}</span>
          {title}
        </h3>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

// =============================================================================
// CIRCULAR PROGRESS COMPONENT
// =============================================================================

function CircularProgress({ value, label, color }: { value: number; label: string; color: string }) {
  const percentage = Math.min(100, Math.max(0, value));
  const strokeDasharray = (percentage / 100) * 251.2;

  return (
    <div className="text-center">
      <div className="relative w-24 h-24 mx-auto mb-3">
        <svg className="w-24 h-24 transform -rotate-90">
          <circle
            cx="48"
            cy="48"
            r="40"
            strokeWidth="8"
            fill="none"
            style={{ stroke: tokens.bgSurface }}
          />
          <circle
            cx="48"
            cy="48"
            r="40"
            strokeWidth="8"
            fill="none"
            strokeLinecap="round"
            style={{
              stroke: color,
              strokeDasharray: `${strokeDasharray} 251.2`,
              transition: "stroke-dasharray 1s ease-out",
            }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xl font-light text-white">{value}</span>
        </div>
      </div>
      <div className="text-sm capitalize" style={{ color: tokens.textMuted }}>
        {label.replace("_", " ")}
      </div>
    </div>
  );
}

// =============================================================================
// LOADING STATE COMPONENT
// =============================================================================

function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <Loader2 className="w-8 h-8 animate-spin" style={{ color: tokens.brandPrimary }} />
      <p className="mt-4 text-sm" style={{ color: tokens.textMuted }}>
        Loading interviewer analytics...
      </p>
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function InterviewerDashboard() {
  const [data, setData] = useState<InterviewerAnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [interviewerId, setInterviewerId] = useState<string | null>(null);

  useEffect(() => {
    const savedId = getSelectedInterviewerId();
    if (savedId) {
      setInterviewerId(savedId);
      loadAnalytics(savedId);
    } else {
      setLoading(false);
    }
  }, []);

  const loadAnalytics = async (id: string) => {
    try {
      setLoading(true);
      setError(null);
      const analytics = await getInterviewerAnalytics(id);
      setData(analytics);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load analytics");
    } finally {
      setLoading(false);
    }
  };

  const handleInterviewerChange = (id: string) => {
    setInterviewerId(id);
    loadAnalytics(id);
  };

  const getCircleColor = (score: number) => {
    if (score >= 70) return tokens.statusSuccess;
    if (score >= 50) return tokens.statusWarning;
    return tokens.statusDanger;
  };

  const scoreMetrics = [
    { key: "avg_question_quality", label: "Question Quality", icon: <MessageSquare className="w-4 h-4" /> },
    { key: "avg_topic_coverage", label: "Topic Coverage", icon: <Target className="w-4 h-4" /> },
    { key: "avg_consistency", label: "Consistency", icon: <TrendingUp className="w-4 h-4" /> },
    { key: "avg_bias_score", label: "Bias Score", icon: <Shield className="w-4 h-4" />, inverted: true },
    { key: "avg_candidate_experience", label: "Candidate Exp", icon: <Users className="w-4 h-4" /> },
  ];

  if (loading) {
    return <LoadingState />;
  }

  return (
    <div className="space-y-8">
      {/* Ambient Background */}
      <div
        className="fixed inset-0 pointer-events-none -z-10"
        style={{
          background: `
            radial-gradient(ellipse 80% 50% at 50% -20%, ${tokens.brandPrimary}15, transparent),
            radial-gradient(ellipse 60% 40% at 100% 0%, ${tokens.brandSecondary}10, transparent),
            ${tokens.bgApp}
          `,
        }}
      />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium mb-3"
            style={{
              backgroundColor: `${tokens.brandPrimary}15`,
              border: `1px solid ${tokens.brandPrimary}30`,
              color: tokens.brandPrimary,
            }}
          >
            <UserCheck className="w-3.5 h-3.5" />
            Performance Analytics
          </div>
          <h1 className="text-3xl font-light tracking-tight text-white mb-2">
            Interviewer Dashboard
          </h1>
          <p style={{ color: tokens.textMuted }}>
            Performance insights and quality metrics
          </p>
        </div>
        <InterviewerSelector onInterviewerChange={handleInterviewerChange} />
      </div>

      {/* No Interviewer Selected */}
      {!interviewerId && (
        <div
          className="rounded-2xl border text-center py-16"
          style={{
            backgroundColor: tokens.bgCard,
            borderColor: tokens.borderSubtle,
          }}
        >
          <div
            className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6"
            style={{
              background: `linear-gradient(135deg, ${tokens.brandPrimary}20, ${tokens.brandSecondary}20)`,
              border: `1px solid ${tokens.borderSubtle}`,
            }}
          >
            <Users className="w-10 h-10" style={{ color: tokens.brandPrimary }} />
          </div>
          <h2 className="text-2xl font-light text-white mb-3">
            Select an Interviewer
          </h2>
          <p style={{ color: tokens.textMuted }}>
            Choose an interviewer from the dropdown above to view their analytics.
          </p>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div
          className="rounded-2xl border p-8"
          style={{
            backgroundColor: tokens.statusDangerBg,
            borderColor: `${tokens.statusDanger}30`,
          }}
        >
          <p style={{ color: tokens.statusDanger }}>{error}</p>
        </div>
      )}

      {/* Data Display */}
      {data && (
        <>
          {data.aggregated.total_interviews === 0 ? (
            <div
              className="rounded-2xl border text-center py-16"
              style={{
                backgroundColor: tokens.bgCard,
                borderColor: tokens.borderSubtle,
              }}
            >
              <div
                className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6"
                style={{
                  background: `linear-gradient(135deg, ${tokens.brandPrimary}20, ${tokens.brandSecondary}20)`,
                  border: `1px solid ${tokens.borderSubtle}`,
                }}
              >
                <MessageSquare className="w-10 h-10" style={{ color: tokens.brandPrimary }} />
              </div>
              <h2 className="text-2xl font-light text-white mb-3">
                No Analytics Yet
              </h2>
              <p style={{ color: tokens.textMuted }}>
                Complete interviews with this interviewer to see analytics.
              </p>
            </div>
          ) : (
            <>
              {/* Score Cards */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {scoreMetrics.map((metric) => {
                  const value = data.aggregated[metric.key as keyof typeof data.aggregated] as number;
                  const inverted = metric.inverted || false;
                  return (
                    <StatCard
                      key={metric.key}
                      icon={metric.icon}
                      value={value}
                      label={metric.label}
                      color={tokens.brandPrimary}
                      inverted={inverted}
                      note={inverted && value <= 20 ? "Low bias detected" : undefined}
                    />
                  );
                })}
              </div>

              {/* Topic Coverage Breakdown */}
              <SectionCard title="Topic Coverage Breakdown" icon={<Target className="w-5 h-5" />}>
                <div className="grid grid-cols-4 gap-6">
                  {Object.entries(data.aggregated.topic_breakdown).map(([topic, score]) => (
                    <CircularProgress
                      key={topic}
                      value={score}
                      label={topic}
                      color={getCircleColor(score)}
                    />
                  ))}
                </div>
              </SectionCard>

              {/* Improvement Areas */}
              {data.aggregated.common_suggestions.length > 0 && (
                <SectionCard
                  title="Common Improvement Areas"
                  icon={<Lightbulb className="w-5 h-5" />}
                  variant="warning"
                >
                  <div className="space-y-4">
                    {data.aggregated.common_suggestions.map((suggestion, i) => (
                      <div key={i} className="flex items-start gap-4">
                        <div
                          className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                          style={{ backgroundColor: `${tokens.statusWarning}20` }}
                        >
                          <span className="text-xs font-bold" style={{ color: tokens.statusWarning }}>
                            {i + 1}
                          </span>
                        </div>
                        <p className="leading-relaxed" style={{ color: tokens.textSecondary }}>
                          {suggestion}
                        </p>
                      </div>
                    ))}
                  </div>
                </SectionCard>
              )}

              {/* Bias Flags */}
              {data.aggregated.bias_flags.length > 0 && (
                <SectionCard
                  title="Bias Indicators Detected"
                  icon={<AlertTriangle className="w-5 h-5" />}
                  variant="danger"
                >
                  <div className="space-y-2">
                    {data.aggregated.bias_flags.map((flag, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: tokens.statusDanger }}
                        />
                        <span style={{ color: tokens.textMuted }}>{flag}</span>
                      </div>
                    ))}
                  </div>
                </SectionCard>
              )}

              {/* Excellent Performance */}
              {data.aggregated.common_suggestions.length === 0 &&
                data.aggregated.bias_flags.length === 0 && (
                  <SectionCard
                    title="Excellent Performance"
                    icon={<CheckCircle className="w-5 h-5" />}
                    variant="success"
                  >
                    <p style={{ color: tokens.textMuted }}>
                      No significant improvement areas or bias indicators detected. Keep up the great work!
                    </p>
                  </SectionCard>
                )}

              {/* Interview Count */}
              <p className="text-center text-sm" style={{ color: tokens.textMuted }}>
                Based on {data.aggregated.total_interviews} analyzed interview
                {data.aggregated.total_interviews !== 1 ? "s" : ""}
              </p>
            </>
          )}
        </>
      )}
    </div>
  );
}
