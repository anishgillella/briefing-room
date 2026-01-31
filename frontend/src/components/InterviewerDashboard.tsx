"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  MessageSquare,
  Target,
  Users,
  Shield,
  Lightbulb,
  UserCheck,
  Loader2,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  ChevronRight,
  ExternalLink,
  Award,
  Minus,
} from "lucide-react";
import {
  getInterviewerAnalytics,
  getSelectedInterviewerId,
  InterviewerAnalyticsResponse,
  InterviewAnalytics,
} from "@/lib/interviewerApi";
import InterviewerSelector from "./InterviewerSelector";
import { tokens } from "@/lib/design-tokens";

// =============================================================================
// TABS COMPONENT
// =============================================================================

function Tabs({ tabs, activeTab, onChange }: { tabs: string[]; activeTab: string; onChange: (tab: string) => void }) {
  return (
    <div className="flex gap-1 p-1 rounded-xl" style={{ backgroundColor: tokens.bgSurface }}>
      {tabs.map((tab) => (
        <button
          key={tab}
          onClick={() => onChange(tab)}
          className="px-4 py-2 text-sm font-medium rounded-lg transition-all"
          style={{
            backgroundColor: activeTab === tab ? tokens.brandPrimary : "transparent",
            color: activeTab === tab ? "white" : tokens.textMuted,
          }}
        >
          {tab}
        </button>
      ))}
    </div>
  );
}

// =============================================================================
// STAT CARD WITH BENCHMARK
// =============================================================================

interface StatCardProps {
  icon: React.ReactNode;
  value: number;
  label: string;
  inverted?: boolean;
  benchmark?: { diff: number; is_better: boolean; percentile: number };
  trend?: { direction: string; diff: number };
}

function StatCard({ icon, value, label, inverted = false, benchmark, trend }: StatCardProps) {
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
      className="relative overflow-hidden rounded-2xl border"
      style={{ backgroundColor: tokens.bgCard, borderColor: `${scoreColor}30` }}
    >
      <div className="absolute -top-12 -right-12 w-32 h-32 rounded-full opacity-20 blur-3xl" style={{ backgroundColor: scoreColor }} />
      <div className="relative p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div style={{ color: tokens.textMuted }}>{icon}</div>
            <span className="text-xs uppercase tracking-wider" style={{ color: tokens.textMuted }}>{label}</span>
          </div>
          {trend && trend.direction !== "stable" && (
            <div
              className="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full"
              style={{
                backgroundColor: trend.direction === "improving" ? `${tokens.statusSuccess}15` : `${tokens.statusDanger}15`,
                color: trend.direction === "improving" ? tokens.statusSuccess : tokens.statusDanger,
              }}
            >
              {trend.direction === "improving" ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {Math.abs(trend.diff).toFixed(0)}
            </div>
          )}
        </div>
        <div className="text-3xl font-light" style={{ color: scoreColor }}>
          {value.toFixed(0)}<span className="text-lg ml-1" style={{ color: tokens.textMuted }}>/100</span>
        </div>
        {benchmark && (
          <div className="mt-2 flex items-center gap-2 text-xs">
            <span style={{ color: benchmark.is_better ? tokens.statusSuccess : tokens.statusDanger }}>
              {benchmark.diff > 0 ? "+" : ""}{benchmark.diff.toFixed(0)} vs team
            </span>
            <span style={{ color: tokens.textMuted }}>
              • {benchmark.percentile >= 50
                ? `Top ${Math.max(1, 100 - benchmark.percentile)}%`
                : `Bottom ${Math.max(1, benchmark.percentile)}%`}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// BADGE COMPONENT
// =============================================================================

function Badge({ badge }: { badge: { id: string; name: string; icon: string; description: string } }) {
  return (
    <div
      className="flex items-center gap-3 p-3 rounded-xl border"
      style={{ backgroundColor: tokens.bgSurface, borderColor: `${tokens.brandPrimary}30` }}
    >
      <div className="text-2xl">{badge.icon}</div>
      <div>
        <div className="text-sm font-medium text-white">{badge.name}</div>
        <div className="text-xs" style={{ color: tokens.textMuted }}>{badge.description}</div>
      </div>
    </div>
  );
}

// =============================================================================
// INTERVIEW ROW COMPONENT
// =============================================================================

function InterviewRow({ interview }: { interview: InterviewAnalytics }) {
  const date = new Date(interview.created_at);
  const formattedDate = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });

  const overallColor = interview.overall_score >= 80 ? tokens.statusSuccess : interview.overall_score >= 60 ? tokens.statusWarning : tokens.statusDanger;

  return (
    <div
      className="grid grid-cols-8 gap-4 items-center p-4 rounded-xl border hover:translate-x-1 transition-transform"
      style={{ backgroundColor: tokens.bgSurface, borderColor: tokens.borderSubtle }}
    >
      <div className="col-span-2 flex items-center gap-3">
        <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: `${tokens.brandPrimary}20` }}>
          <Calendar className="w-4 h-4" style={{ color: tokens.brandPrimary }} />
        </div>
        <div>
          <div className="text-sm text-white font-medium">{formattedDate}</div>
          <div className="text-xs" style={{ color: tokens.textMuted }}>Interview</div>
        </div>
      </div>
      <div className="text-center">
        <span className="text-sm font-medium" style={{ color: interview.question_quality_score >= 80 ? tokens.statusSuccess : tokens.textSecondary }}>
          {interview.question_quality_score}
        </span>
      </div>
      <div className="text-center">
        <span className="text-sm font-medium" style={{ color: interview.topic_coverage_score >= 80 ? tokens.statusSuccess : tokens.textSecondary }}>
          {interview.topic_coverage_score}
        </span>
      </div>
      <div className="text-center">
        <span className="text-sm font-medium" style={{ color: interview.consistency_score >= 80 ? tokens.statusSuccess : tokens.textSecondary }}>
          {interview.consistency_score}
        </span>
      </div>
      <div className="text-center">
        <span className="text-sm font-medium" style={{ color: interview.bias_score <= 20 ? tokens.statusSuccess : tokens.textSecondary }}>
          {interview.bias_score}
        </span>
      </div>
      <div className="text-center">
        <span className="text-2xl font-light" style={{ color: overallColor }}>{interview.overall_score}</span>
      </div>
      <div className="text-center">
        <Link
          href={`/interviews/${interview.interview_id}`}
          className="text-xs flex items-center justify-center gap-1"
          style={{ color: tokens.brandPrimary }}
        >
          Details <ExternalLink className="w-3 h-3" />
        </Link>
      </div>
    </div>
  );
}

// =============================================================================
// SECTION CARD
// =============================================================================

function SectionCard({ title, icon, children, action }: { title: string; icon: React.ReactNode; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border" style={{ backgroundColor: tokens.bgCard, borderColor: tokens.borderSubtle }}>
      <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: tokens.borderSubtle }}>
        <h3 className="text-lg font-medium text-white flex items-center gap-2">
          <span style={{ color: tokens.brandPrimary }}>{icon}</span>
          {title}
        </h3>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

// =============================================================================
// CIRCULAR PROGRESS
// =============================================================================

function CircularProgress({ value, label, color }: { value: number; label: string; color: string }) {
  const percentage = Math.min(100, Math.max(0, value));
  const strokeDasharray = (percentage / 100) * 251.2;

  return (
    <div className="text-center">
      <div className="relative w-20 h-20 mx-auto mb-2">
        <svg className="w-20 h-20 transform -rotate-90">
          <circle cx="40" cy="40" r="32" strokeWidth="6" fill="none" style={{ stroke: tokens.bgSurface }} />
          <circle cx="40" cy="40" r="32" strokeWidth="6" fill="none" strokeLinecap="round"
            style={{ stroke: color, strokeDasharray: `${strokeDasharray * 0.8} 251.2`, transition: "stroke-dasharray 1s" }} />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-lg font-light text-white">{value}</span>
        </div>
      </div>
      <div className="text-xs capitalize" style={{ color: tokens.textMuted }}>{label.replace(/_/g, " ")}</div>
    </div>
  );
}

// =============================================================================
// LOADING STATE
// =============================================================================

function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <Loader2 className="w-8 h-8 animate-spin" style={{ color: tokens.brandPrimary }} />
      <p className="mt-4 text-sm" style={{ color: tokens.textMuted }}>Loading analytics...</p>
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
  const [activeTab, setActiveTab] = useState("Overview");
  const hasFetchedRef = useRef(false);

  useEffect(() => {
    if (!hasFetchedRef.current) {
      hasFetchedRef.current = true;
      const savedId = getSelectedInterviewerId();
      if (savedId) {
        setInterviewerId(savedId);
        loadAnalytics(savedId);
      } else {
        setLoading(false);
      }
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

  if (!interviewerId && !loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-light tracking-tight text-white mb-2">Interviewer Dashboard</h1>
          <p style={{ color: tokens.textMuted }}>Select an interviewer to view their analytics</p>
        </div>
        <InterviewerSelector selectedId={null} onInterviewerChange={handleInterviewerChange} />
      </div>
    );
  }

  if (loading) return <LoadingState />;

  if (error) {
    return (
      <div className="rounded-2xl border p-8 text-center" style={{ backgroundColor: tokens.statusDangerBg, borderColor: `${tokens.statusDanger}30` }}>
        <p style={{ color: tokens.statusDanger }}>{error}</p>
      </div>
    );
  }

  if (!data) return null;

  const metrics = data.aggregated;
  const tabs = ["Overview", "Interviews", "Benchmarks"];

  return (
    <div className="space-y-6">
      {/* Ambient Background */}
      <div className="fixed inset-0 pointer-events-none -z-10" style={{ background: `radial-gradient(ellipse 80% 50% at 50% -20%, ${tokens.brandPrimary}15, transparent), ${tokens.bgApp}` }} />

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium mb-3"
            style={{ backgroundColor: `${tokens.brandPrimary}15`, border: `1px solid ${tokens.brandPrimary}30`, color: tokens.brandPrimary }}>
            <UserCheck className="w-3.5 h-3.5" />
            Performance Analytics
          </div>
          <h1 className="text-3xl font-light tracking-tight text-white mb-2">Interviewer Dashboard</h1>
          <p style={{ color: tokens.textMuted }}>Performance insights and quality metrics</p>
        </div>
        <div className="flex items-center gap-4">
          <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />
        </div>
      </div>

      {/* Interviewer Selector + Badges */}
      <div className="flex items-center justify-between">
        <InterviewerSelector selectedId={interviewerId} onInterviewerChange={handleInterviewerChange} />
        {data.badges && data.badges.length > 0 && (
          <div className="flex items-center gap-2">
            {data.badges.slice(0, 3).map((badge) => (
              <div key={badge.id} className="text-xl" title={badge.name}>{badge.icon}</div>
            ))}
          </div>
        )}
      </div>

      {/* OVERVIEW TAB */}
      {activeTab === "Overview" && (
        <>
          {/* Badge Section if any */}
          {data.badges && data.badges.length > 0 && (
            <div className="grid grid-cols-3 gap-3">
              {data.badges.map((badge) => <Badge key={badge.id} badge={badge} />)}
            </div>
          )}

          {/* KPI Cards with Benchmarks */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <StatCard
              icon={<MessageSquare className="w-5 h-5" />}
              value={metrics.avg_question_quality}
              label="Question Quality"
              benchmark={data.benchmarks?.avg_question_quality}
              trend={data.trends?.question_quality_score}
            />
            <StatCard
              icon={<Target className="w-5 h-5" />}
              value={metrics.avg_topic_coverage}
              label="Topic Coverage"
              benchmark={data.benchmarks?.avg_topic_coverage}
              trend={data.trends?.topic_coverage_score}
            />
            <StatCard
              icon={<TrendingUp className="w-5 h-5" />}
              value={metrics.avg_consistency}
              label="Consistency"
              benchmark={data.benchmarks?.avg_consistency}
              trend={data.trends?.consistency_score}
            />
            <StatCard
              icon={<Shield className="w-5 h-5" />}
              value={metrics.avg_bias_score}
              label="Bias Score"
              inverted
              benchmark={data.benchmarks?.avg_bias_score}
              trend={data.trends?.bias_score}
            />
            <StatCard
              icon={<Users className="w-5 h-5" />}
              value={metrics.avg_candidate_experience}
              label="Candidate Exp"
              benchmark={data.benchmarks?.avg_candidate_experience}
              trend={data.trends?.candidate_experience_score}
            />
          </div>

          {/* Topic Coverage Breakdown */}
          {metrics.topic_breakdown && (
            <SectionCard title="Topic Coverage Breakdown" icon={<Target className="w-5 h-5" />}>
              <div className="grid grid-cols-4 gap-6">
                <CircularProgress value={metrics.topic_breakdown.technical} label="technical" color={tokens.brandPrimary} />
                <CircularProgress value={metrics.topic_breakdown.behavioral} label="behavioral" color="#22D3EE" />
                <CircularProgress value={metrics.topic_breakdown.culture_fit} label="culture fit" color={tokens.statusSuccess} />
                <CircularProgress value={metrics.topic_breakdown.problem_solving} label="problem solving" color={tokens.statusWarning} />
              </div>
            </SectionCard>
          )}

          {/* Coaching Insights */}
          {data.coaching && data.coaching.length > 0 && (
            <SectionCard title="Coaching Insights" icon={<Lightbulb className="w-5 h-5" />}>
              <div className="space-y-3">
                {data.coaching.map((item, i) => (
                  <div key={i} className="flex items-start gap-3 p-4 rounded-xl" style={{ backgroundColor: tokens.bgSurface }}>
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${tokens.statusWarning}20` }}>
                      <AlertTriangle className="w-4 h-4" style={{ color: tokens.statusWarning }} />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-white">{item.area} ({item.score})</div>
                      <div className="text-sm mt-1" style={{ color: tokens.textMuted }}>{item.tip}</div>
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>
          )}

          {/* Common Improvement Areas */}
          {metrics.common_suggestions && metrics.common_suggestions.length > 0 && (
            <SectionCard title="Common Improvement Areas" icon={<Lightbulb className="w-5 h-5" />}>
              <div className="space-y-3">
                {metrics.common_suggestions.map((suggestion, i) => (
                  <div key={i} className="flex items-start gap-3 p-4 rounded-xl" style={{ backgroundColor: tokens.bgSurface }}>
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold" style={{ backgroundColor: tokens.brandPrimary, color: "white" }}>
                      {i + 1}
                    </div>
                    <p className="text-sm" style={{ color: tokens.textSecondary }}>{suggestion}</p>
                  </div>
                ))}
              </div>
            </SectionCard>
          )}
        </>
      )}

      {/* INTERVIEWS TAB */}
      {activeTab === "Interviews" && (
        <SectionCard
          title={`Recent Interviews (${data.recent_interviews?.length || 0})`}
          icon={<Calendar className="w-5 h-5" />}
          action={<span className="text-xs" style={{ color: tokens.textMuted }}>Last {data.recent_interviews?.length || 0} interviews</span>}
        >
          {data.recent_interviews && data.recent_interviews.length > 0 ? (
            <div className="space-y-2">
              {/* Header */}
              <div className="grid grid-cols-8 gap-4 px-4 py-2 text-xs uppercase tracking-wider" style={{ color: tokens.textMuted }}>
                <div className="col-span-2">Date</div>
                <div className="text-center">Quality</div>
                <div className="text-center">Coverage</div>
                <div className="text-center">Consistency</div>
                <div className="text-center">Bias</div>
                <div className="text-center">Overall</div>
                <div className="text-center">Action</div>
              </div>
              {data.recent_interviews.map((interview) => (
                <InterviewRow key={interview.id} interview={interview} />
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Calendar className="w-12 h-12 mx-auto mb-4" style={{ color: tokens.textMuted }} />
              <p style={{ color: tokens.textMuted }}>No interviews recorded yet</p>
            </div>
          )}
        </SectionCard>
      )}

      {/* BENCHMARKS TAB */}
      {activeTab === "Benchmarks" && (
        <div className="space-y-6">
          <SectionCard title="Team Comparison" icon={<Users className="w-5 h-5" />}>
            <div className="space-y-4">
              {Object.entries(data.benchmarks || {}).map(([key, bench]) => {
                const label = key.replace("avg_", "").replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());
                const isInverted = key === "avg_bias_score";
                return (
                  <div key={key} className="flex items-center gap-4">
                    <div className="w-32 text-sm" style={{ color: tokens.textSecondary }}>{label}</div>
                    <div className="flex-1 h-2 rounded-full" style={{ backgroundColor: tokens.bgSurface }}>
                      <div className="relative h-full">
                        {/* Team average marker */}
                        <div
                          className="absolute w-1 h-4 -top-1 rounded"
                          style={{ left: `${bench.team_avg}%`, backgroundColor: tokens.textMuted }}
                          title={`Team avg: ${bench.team_avg}`}
                        />
                        {/* Your score bar */}
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.min(bench.value, 100)}%`,
                            backgroundColor: bench.is_better ? tokens.statusSuccess : tokens.statusDanger
                          }}
                        />
                      </div>
                    </div>
                    <div className="w-24 text-right">
                      <span className="text-lg font-light text-white">{bench.value.toFixed(0)}</span>
                      <span className="text-xs ml-2" style={{ color: bench.is_better ? tokens.statusSuccess : tokens.statusDanger }}>
                        {bench.diff > 0 ? "+" : ""}{bench.diff.toFixed(0)}
                      </span>
                    </div>
                    <div className="w-20 text-right text-xs" style={{ color: tokens.textMuted }}>
                      {bench.percentile >= 50
                        ? `Top ${Math.max(1, 100 - bench.percentile)}%`
                        : `Bottom ${Math.max(1, bench.percentile)}%`}
                    </div>
                  </div>
                );
              })}
            </div>
          </SectionCard>

          {/* Trends Section */}
          {Object.keys(data.trends || {}).length > 0 && (
            <SectionCard title="Performance Trends" icon={<TrendingUp className="w-5 h-5" />}>
              <div className="grid grid-cols-3 gap-4">
                {Object.entries(data.trends).map(([key, trend]) => {
                  const label = key.replace("_score", "").replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());
                  return (
                    <div key={key} className="p-4 rounded-xl flex items-center gap-4" style={{ backgroundColor: tokens.bgSurface }}>
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center"
                        style={{
                          backgroundColor: trend.direction === "improving" ? `${tokens.statusSuccess}20` : trend.direction === "declining" ? `${tokens.statusDanger}20` : `${tokens.textMuted}20`,
                        }}
                      >
                        {trend.direction === "improving" ? (
                          <TrendingUp className="w-5 h-5" style={{ color: tokens.statusSuccess }} />
                        ) : trend.direction === "declining" ? (
                          <TrendingDown className="w-5 h-5" style={{ color: tokens.statusDanger }} />
                        ) : (
                          <Minus className="w-5 h-5" style={{ color: tokens.textMuted }} />
                        )}
                      </div>
                      <div>
                        <div className="text-sm text-white capitalize">{label}</div>
                        <div className="text-xs" style={{ color: tokens.textMuted }}>
                          {trend.older_avg.toFixed(0)} → {trend.recent_avg.toFixed(0)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </SectionCard>
          )}
        </div>
      )}
    </div>
  );
}
