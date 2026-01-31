"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ChevronRight,
  Clock,
  TrendingUp,
  Target,
  UserCheck,
  FileCheck,
  Users,
  MessageSquare,
  Shield,
  ExternalLink,
  BarChart3,
  Activity,
  Zap,
  Loader2,
  Award,
  Timer,
  ArrowUpRight,
  ArrowDownRight,
  AlertTriangle,
} from "lucide-react";
import { getTeamMetrics, TeamMetrics, TrendData, StuckCandidate } from "@/lib/managerApi";
import { getTeamAnalytics, TeamAnalyticsResponse } from "@/lib/interviewerApi";
import { tokens } from "@/lib/design-tokens";

// =============================================================================
// TREND BADGE COMPONENT
// =============================================================================

function TrendBadge({ trend, inverted = false }: { trend: TrendData; inverted?: boolean }) {
  if (trend.change_pct === 0) return null;

  const isPositive = inverted ? trend.change_pct < 0 : trend.change_pct > 0;
  const displayValue = Math.abs(trend.change_pct);

  return (
    <div
      className="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full"
      style={{
        backgroundColor: isPositive ? `${tokens.statusSuccess}15` : `${tokens.statusDanger}15`,
        color: isPositive ? tokens.statusSuccess : tokens.statusDanger,
      }}
    >
      {isPositive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
      {displayValue.toFixed(0)}%
    </div>
  );
}

// =============================================================================
// STAT CARD COMPONENT
// =============================================================================

interface StatCardProps {
  icon: React.ReactNode;
  value: number;
  label: string;
  color: string;
  suffix?: string;
  decimals?: number;
  trend?: TrendData;
}

function StatCard({ icon, value, label, color, suffix = "", decimals = 0, trend }: StatCardProps) {
  return (
    <div
      className="relative overflow-hidden rounded-2xl border group"
      style={{ backgroundColor: tokens.bgCard, borderColor: tokens.borderSubtle }}
    >
      <div
        className="absolute -top-12 -right-12 w-32 h-32 rounded-full opacity-20 blur-3xl"
        style={{ backgroundColor: color }}
      />
      <div className="relative p-5">
        <div className="flex items-center justify-between mb-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: `${color}15` }}
          >
            <div style={{ color }}>{icon}</div>
          </div>
          {trend && <TrendBadge trend={trend} />}
        </div>
        <div className="text-3xl font-light tracking-tight text-white mb-1">
          {Number(value.toFixed(decimals))}{suffix}
        </div>
        <div className="text-sm" style={{ color: tokens.textMuted }}>{label}</div>
      </div>
    </div>
  );
}

// =============================================================================
// PERIOD TOGGLE COMPONENT
// =============================================================================

function PeriodToggle({ value, onChange }: { value: number; onChange: (days: number) => void }) {
  const options = [30, 60, 90];
  return (
    <div className="inline-flex rounded-lg p-1" style={{ backgroundColor: tokens.bgSurface }}>
      {options.map((days) => (
        <button
          key={days}
          onClick={() => onChange(days)}
          className="px-3 py-1.5 text-sm font-medium rounded-md transition-all"
          style={{
            backgroundColor: value === days ? tokens.brandPrimary : "transparent",
            color: value === days ? "white" : tokens.textMuted,
          }}
        >
          {days}d
        </button>
      ))}
    </div>
  );
}

// =============================================================================
// FUNNEL STAGE COMPONENT
// =============================================================================

interface FunnelStageProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  rate?: number | null;
  color: string;
  isBottleneck?: boolean;
}

function FunnelStage({ icon, label, value, rate, color, isBottleneck = false }: FunnelStageProps) {
  const borderColor = isBottleneck ? tokens.statusDanger : tokens.borderSubtle;

  return (
    <div
      className="flex-1 text-center p-5 rounded-2xl border cursor-default transition-all hover:-translate-y-1 relative"
      style={{
        backgroundColor: tokens.bgSurface,
        borderColor: borderColor,
        borderWidth: isBottleneck ? "2px" : "1px",
      }}
    >
      {isBottleneck && (
        <div
          className="absolute -top-2 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full text-xs font-medium"
          style={{ backgroundColor: tokens.statusDanger, color: "white" }}
        >
          Bottleneck
        </div>
      )}
      <div
        className="w-10 h-10 rounded-xl mx-auto mb-2 flex items-center justify-center"
        style={{ backgroundColor: `${color}15` }}
      >
        <div style={{ color }}>{icon}</div>
      </div>
      <div className="text-3xl font-light text-white mb-1">{value}</div>
      <div className="text-sm capitalize" style={{ color: tokens.textMuted }}>{label}</div>
      {rate !== null && rate !== undefined && (
        <div className="text-sm font-medium mt-1" style={{ color: isBottleneck ? tokens.statusDanger : color }}>
          {(rate * 100).toFixed(1)}%
        </div>
      )}
    </div>
  );
}

// =============================================================================
// PROGRESS BAR COMPONENT
// =============================================================================

function ProgressBar({ value, color, label, isBottleneck = false }: { value: number; color: string; label: string; isBottleneck?: boolean }) {
  const barColor = isBottleneck ? tokens.statusDanger : color;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-2" style={{ color: tokens.textSecondary }}>
          {label}
          {isBottleneck && (
            <span
              className="px-1.5 py-0.5 rounded text-xs font-medium"
              style={{ backgroundColor: `${tokens.statusDanger}20`, color: tokens.statusDanger }}
            >
              Bottleneck
            </span>
          )}
        </span>
        <span className="font-medium" style={{ color: isBottleneck ? tokens.statusDanger : tokens.textPrimary }}>{value}%</span>
      </div>
      <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: tokens.bgSurface }}>
        <div
          className="h-full rounded-full transition-all duration-1000"
          style={{ backgroundColor: barColor, width: `${Math.min(value, 100)}%` }}
        />
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
  action?: React.ReactNode;
  variant?: "default" | "warning" | "danger";
}

function SectionCard({ title, icon, children, action, variant = "default" }: SectionCardProps) {
  const colors = {
    default: { accent: tokens.brandPrimary, border: tokens.borderSubtle },
    warning: { accent: tokens.statusWarning, border: `${tokens.statusWarning}50` },
    danger: { accent: tokens.statusDanger, border: `${tokens.statusDanger}50` },
  };
  const colorSet = colors[variant];

  return (
    <div
      className="rounded-2xl border"
      style={{
        backgroundColor: tokens.bgCard,
        borderColor: colorSet.border,
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
        {action}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

// =============================================================================
// STUCK CANDIDATE ROW COMPONENT
// =============================================================================

function StuckCandidateRow({ candidate }: { candidate: StuckCandidate }) {
  const getSeverity = (days: number) => {
    if (days >= 14) return { color: tokens.statusDanger, label: "Critical" };
    if (days >= 10) return { color: tokens.statusWarning, label: "Warning" };
    return { color: tokens.textMuted, label: "Monitor" };
  };
  const severity = getSeverity(candidate.days_stuck);

  return (
    <div
      className="flex items-center justify-between p-3 rounded-xl border"
      style={{ backgroundColor: tokens.bgSurface, borderColor: `${severity.color}30` }}
    >
      <div className="flex items-center gap-3">
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-white font-medium text-sm"
          style={{ backgroundColor: `${severity.color}30` }}
        >
          {candidate.name.charAt(0)}
        </div>
        <div>
          <div className="text-white font-medium text-sm">{candidate.name}</div>
          <div className="text-xs capitalize" style={{ color: tokens.textMuted }}>
            {candidate.stage.replace(/_/g, " ")}
          </div>
        </div>
      </div>
      <div className="text-right">
        <div className="font-medium text-sm" style={{ color: severity.color }}>{candidate.days_stuck}d</div>
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
      <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
        <Loader2 className="w-8 h-8" style={{ color: tokens.brandPrimary }} />
      </motion.div>
      <p className="mt-4 text-sm" style={{ color: tokens.textMuted }}>Loading analytics...</p>
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function ManagerDashboard() {
  const [funnelData, setFunnelData] = useState<TeamMetrics | null>(null);
  const [teamData, setTeamData] = useState<TeamAnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [periodDays, setPeriodDays] = useState(90);
  const hasFetchedRef = useRef(false);

  useEffect(() => {
    if (!hasFetchedRef.current) {
      hasFetchedRef.current = true;
      loadData(periodDays);
    }
  }, []);

  const loadData = async (days: number) => {
    try {
      setLoading(true);
      const [funnel, team] = await Promise.all([getTeamMetrics(days), getTeamAnalytics()]);
      setFunnelData(funnel);
      setTeamData(team);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const handlePeriodChange = (days: number) => {
    setPeriodDays(days);
    loadData(days);
  };

  const getScoreColor = (score: number, inverted: boolean = false) => {
    if (inverted) {
      if (score <= 20) return tokens.statusSuccess;
      if (score <= 50) return tokens.statusWarning;
      return tokens.statusDanger;
    }
    if (score >= 80) return tokens.statusSuccess;
    if (score >= 60) return tokens.statusWarning;
    return tokens.statusDanger;
  };

  if (loading) return <LoadingState />;

  if (error) {
    return (
      <div className="rounded-2xl border p-8 text-center" style={{ backgroundColor: tokens.statusDangerBg, borderColor: `${tokens.statusDanger}30` }}>
        <p style={{ color: tokens.statusDanger }}>{error}</p>
      </div>
    );
  }

  const bottleneckStage = funnelData?.bottleneck?.stage;

  const funnelStages = [
    { key: "reviewed", label: "Reviewed", icon: <Users className="w-5 h-5" />, color: "#A78BFA", rate: null, isBottleneck: false },
    { key: "interviewed", label: "Interviewed", icon: <UserCheck className="w-5 h-5" />, color: tokens.brandPrimary, rate: funnelData?.metrics.rates.interview_rate, isBottleneck: bottleneckStage === "review_to_interview" },
    { key: "offered", label: "Offered", icon: <FileCheck className="w-5 h-5" />, color: "#22D3EE", rate: funnelData?.metrics.rates.offer_rate, isBottleneck: bottleneckStage === "interview_to_offer" },
    { key: "hired", label: "Hired", icon: <Target className="w-5 h-5" />, color: tokens.statusSuccess, rate: funnelData?.metrics.rates.hire_rate, isBottleneck: bottleneckStage === "offer_to_hire" },
  ];

  const teamMetrics = [
    { key: "avg_question_quality", label: "Question Quality", icon: <MessageSquare className="w-5 h-5" /> },
    { key: "avg_topic_coverage", label: "Topic Coverage", icon: <Target className="w-5 h-5" /> },
    { key: "avg_consistency", label: "Consistency", icon: <TrendingUp className="w-5 h-5" /> },
    { key: "avg_bias_score", label: "Bias Score", icon: <Shield className="w-5 h-5" />, inverted: true },
    { key: "avg_candidate_experience", label: "Candidate Exp", icon: <Users className="w-5 h-5" /> },
  ];

  return (
    <div className="space-y-6">
      {/* Ambient Background */}
      <div
        className="fixed inset-0 pointer-events-none -z-10"
        style={{
          background: `radial-gradient(ellipse 80% 50% at 50% -20%, ${tokens.brandPrimary}15, transparent), ${tokens.bgApp}`,
        }}
      />

      {/* Header with Period Toggle */}
      <div className="flex items-start justify-between">
        <div>
          <div
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium mb-3"
            style={{ backgroundColor: `${tokens.brandPrimary}15`, border: `1px solid ${tokens.brandPrimary}30`, color: tokens.brandPrimary }}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            Team Analytics
          </div>
          <h1 className="text-3xl font-light tracking-tight text-white mb-2">Manager Dashboard</h1>
          <p style={{ color: tokens.textMuted }}>Hiring funnel and interviewer performance for the last {periodDays} days</p>
        </div>
        <PeriodToggle value={periodDays} onChange={handlePeriodChange} />
      </div>

      {/* TOP KPI CARDS */}
      {funnelData && (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
          <StatCard icon={<Users className="w-5 h-5" />} value={funnelData.metrics.funnel.reviewed} label="Reviewed" color="#A78BFA" trend={funnelData.trends?.reviewed} />
          <StatCard icon={<UserCheck className="w-5 h-5" />} value={funnelData.metrics.funnel.interviewed} label="Interviewed" color={tokens.brandPrimary} trend={funnelData.trends?.interviewed} />
          <StatCard icon={<Target className="w-5 h-5" />} value={funnelData.metrics.funnel.hired} label="Hired" color={tokens.statusSuccess} trend={funnelData.trends?.hired} />
          <StatCard icon={<Timer className="w-5 h-5" />} value={funnelData.metrics.timing.time_to_first_interview} label="Days to Interview" color="#22D3EE" decimals={1} suffix="d" />
          <StatCard icon={<Award className="w-5 h-5" />} value={funnelData.metrics.timing.time_to_hire || 0} label="Time to Hire" color={tokens.statusSuccess} decimals={1} suffix="d" />
          <StatCard icon={<Activity className="w-5 h-5" />} value={funnelData.metrics.timing.interviews_per_candidate} label="Interviews/Hire" color={tokens.brandSecondary} decimals={1} />
        </div>
      )}

      {/* Alerts Row: Bottleneck + Stuck Candidates */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Bottleneck Alert */}
        {funnelData?.bottleneck && (
          <div
            className="rounded-xl p-4 flex items-center gap-4"
            style={{ backgroundColor: `${tokens.statusDanger}15`, border: `1px solid ${tokens.statusDanger}30` }}
          >
            <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${tokens.statusDanger}20` }}>
              <AlertTriangle className="w-6 h-6" style={{ color: tokens.statusDanger }} />
            </div>
            <div>
              <div className="font-medium text-white">Bottleneck Detected</div>
              <div className="text-sm" style={{ color: tokens.textMuted }}>{funnelData.bottleneck.description}</div>
            </div>
          </div>
        )}

        {/* Stuck Candidates Alert */}
        {funnelData && funnelData.stuck_count > 0 && (
          <div
            className="rounded-xl p-4 flex items-center gap-4"
            style={{ backgroundColor: `${tokens.statusWarning}15`, border: `1px solid ${tokens.statusWarning}30` }}
          >
            <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${tokens.statusWarning}20` }}>
              <Clock className="w-6 h-6" style={{ color: tokens.statusWarning }} />
            </div>
            <div>
              <div className="font-medium text-white">{funnelData.stuck_count} Candidates Stuck</div>
              <div className="text-sm" style={{ color: tokens.textMuted }}>Candidates in same stage for 7+ days</div>
            </div>
          </div>
        )}
      </div>

      {/* Hiring Funnel */}
      {funnelData && (
        <SectionCard title={`Hiring Funnel`} icon={<Activity className="w-5 h-5" />}>
          <div className="flex items-center justify-between gap-3">
            {funnelStages.map((stage, i) => (
              <div key={stage.key} className="flex items-center flex-1">
                <FunnelStage
                  icon={stage.icon}
                  label={stage.label}
                  value={funnelData.metrics.funnel[stage.key as keyof typeof funnelData.metrics.funnel] || 0}
                  rate={stage.rate}
                  color={stage.color}
                  isBottleneck={stage.isBottleneck}
                />
                {i < funnelStages.length - 1 && (
                  <ChevronRight className="w-6 h-6 mx-2 flex-shrink-0" style={{ color: tokens.textMuted }} />
                )}
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* Conversion Rates + Stuck Candidates Side by Side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Conversion Rates */}
        {funnelData && (
          <SectionCard title="Conversion Rates" icon={<Zap className="w-5 h-5" />}>
            <div className="space-y-4">
              <ProgressBar value={Math.round(funnelData.metrics.rates.interview_rate * 100)} color={tokens.brandPrimary} label="Review → Interview" isBottleneck={bottleneckStage === "review_to_interview"} />
              <ProgressBar value={Math.round(funnelData.metrics.rates.offer_rate * 100)} color="#22D3EE" label="Interview → Offer" isBottleneck={bottleneckStage === "interview_to_offer"} />
              <ProgressBar value={Math.round(funnelData.metrics.rates.hire_rate * 100)} color={tokens.statusSuccess} label="Offer → Hire" isBottleneck={bottleneckStage === "offer_to_hire"} />
            </div>
          </SectionCard>
        )}

        {/* Stuck Candidates List */}
        {funnelData && funnelData.stuck_count > 0 && (
          <SectionCard title="Action Needed" icon={<AlertTriangle className="w-5 h-5" />} variant="warning">
            <div className="space-y-2">
              {funnelData.stuck_candidates.slice(0, 5).map((candidate) => (
                <StuckCandidateRow key={candidate.id} candidate={candidate} />
              ))}
              {funnelData.stuck_count > 5 && (
                <p className="text-center text-sm pt-2" style={{ color: tokens.textMuted }}>
                  +{funnelData.stuck_count - 5} more
                </p>
              )}
            </div>
          </SectionCard>
        )}
      </div>

      {/* Team Interviewer Analytics */}
      {teamData && teamData.interviewers.length > 0 && (
        <SectionCard
          title="Team Interviewer Performance"
          icon={<Users className="w-5 h-5" />}
          action={
            <span className="text-xs px-2 py-1 rounded-full" style={{ backgroundColor: tokens.bgSurface, color: tokens.textMuted }}>
              {teamData.team_averages.total_interviews} interviews
            </span>
          }
        >
          {/* Team Averages */}
          <div className="grid grid-cols-5 gap-3 mb-6">
            {teamMetrics.map((metric) => {
              const value = teamData.team_averages[metric.key as keyof typeof teamData.team_averages] as number;
              const inverted = (metric as any).inverted || false;
              const color = getScoreColor(value, inverted);
              return (
                <div key={metric.key} className="text-center p-3 rounded-xl border" style={{ backgroundColor: tokens.bgSurface, borderColor: `${color}30` }}>
                  <div style={{ color: tokens.textMuted }} className="mb-2 flex justify-center">{metric.icon}</div>
                  <div className="text-xl font-light" style={{ color }}>{value.toFixed(0)}</div>
                  <div className="text-xs mt-1" style={{ color: tokens.textMuted }}>{metric.label}</div>
                </div>
              );
            })}
          </div>

          {/* Interviewers Table */}
          <div className="space-y-2">
            <div className="grid grid-cols-7 gap-4 px-4 py-2 text-xs uppercase tracking-wider" style={{ color: tokens.textMuted }}>
              <div className="col-span-2">Interviewer</div>
              <div className="text-center">Interviews</div>
              <div className="text-center">Quality</div>
              <div className="text-center">Coverage</div>
              <div className="text-center">Bias</div>
              <div className="text-center">Action</div>
            </div>
            {teamData.interviewers.map((item) => (
              <div key={item.interviewer.id} className="grid grid-cols-7 gap-4 items-center p-3 rounded-xl border" style={{ backgroundColor: tokens.bgSurface, borderColor: tokens.borderSubtle }}>
                <div className="col-span-2">
                  <div className="text-white font-medium text-sm">{item.interviewer.name}</div>
                  <div className="text-xs" style={{ color: tokens.textMuted }}>{item.interviewer.team}</div>
                </div>
                <div className="text-center text-sm" style={{ color: tokens.textSecondary }}>{item.metrics.total_interviews}</div>
                <div className="text-center font-medium text-sm" style={{ color: getScoreColor(item.metrics.avg_question_quality) }}>{item.metrics.avg_question_quality.toFixed(0)}</div>
                <div className="text-center font-medium text-sm" style={{ color: getScoreColor(item.metrics.avg_topic_coverage) }}>{item.metrics.avg_topic_coverage.toFixed(0)}</div>
                <div className="text-center font-medium text-sm" style={{ color: getScoreColor(item.metrics.avg_bias_score, true) }}>{item.metrics.avg_bias_score.toFixed(0)}</div>
                <div className="text-center">
                  <Link href={`/dashboard/interviewer?id=${item.interviewer.id}`} className="inline-flex items-center gap-1 text-xs" style={{ color: tokens.brandPrimary }}>
                    View <ExternalLink className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* Empty State */}
      {teamData && teamData.interviewers.length === 0 && (
        <div className="rounded-2xl border text-center py-12" style={{ backgroundColor: tokens.bgCard, borderColor: tokens.borderSubtle }}>
          <Users className="w-12 h-12 mx-auto mb-4" style={{ color: tokens.brandPrimary }} />
          <h3 className="text-lg text-white mb-2">No Interviewer Analytics Yet</h3>
          <p className="text-sm" style={{ color: tokens.textMuted }}>Complete interviews to generate analytics.</p>
        </div>
      )}
    </div>
  );
}
