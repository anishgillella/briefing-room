"use client";

import { useState, useEffect } from "react";
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
} from "lucide-react";
import { getTeamMetrics, TeamMetrics } from "@/lib/managerApi";
import { getTeamAnalytics, TeamAnalyticsResponse } from "@/lib/interviewerApi";
import { tokens, springConfig } from "@/lib/design-tokens";

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
  trend?: { value: number; positive: boolean };
}

function StatCard({ icon, value, label, color, suffix = "", decimals = 0, trend }: StatCardProps) {
  return (
    <div
      className="relative overflow-hidden rounded-2xl border group"
      style={{
        backgroundColor: tokens.bgCard,
        borderColor: tokens.borderSubtle,
      }}
    >
      {/* Subtle glow effect */}
      <div
        className="absolute -top-12 -right-12 w-32 h-32 rounded-full opacity-20 blur-3xl transition-opacity group-hover:opacity-30"
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
          {trend && (
            <div
              className="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full"
              style={{
                backgroundColor: trend.positive ? `${tokens.statusSuccess}15` : `${tokens.statusDanger}15`,
                color: trend.positive ? tokens.statusSuccess : tokens.statusDanger,
              }}
            >
              {trend.positive ? (
                <ArrowUpRight className="w-3 h-3" />
              ) : (
                <ArrowDownRight className="w-3 h-3" />
              )}
              {trend.value}%
            </div>
          )}
        </div>
        <div className="text-3xl font-light tracking-tight text-white mb-1">
          {value.toFixed(decimals)}{suffix}
        </div>
        <div className="text-sm" style={{ color: tokens.textMuted }}>
          {label}
        </div>
      </div>
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
}

function FunnelStage({ icon, label, value, rate, color }: FunnelStageProps) {
  return (
    <div
      className="flex-1 text-center p-6 rounded-2xl border cursor-default transition-transform hover:-translate-y-1 hover:scale-[1.02]"
      style={{
        backgroundColor: tokens.bgSurface,
        borderColor: tokens.borderSubtle,
      }}
    >
      <div
        className="w-12 h-12 rounded-xl mx-auto mb-3 flex items-center justify-center"
        style={{ backgroundColor: `${color}15` }}
      >
        <div style={{ color }}>{icon}</div>
      </div>
      <div className="text-4xl font-light text-white mb-1">
        {value}
      </div>
      <div className="text-sm capitalize mb-2" style={{ color: tokens.textMuted }}>
        {label}
      </div>
      {rate !== null && rate !== undefined && (
        <div className="text-sm font-medium" style={{ color }}>
          {(rate * 100).toFixed(1)}%
        </div>
      )}
    </div>
  );
}

// =============================================================================
// PROGRESS BAR COMPONENT
// =============================================================================

function ProgressBar({ value, maxValue, color, label }: { value: number; maxValue: number; color: string; label: string }) {
  const percentage = maxValue > 0 ? (value / maxValue) * 100 : 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span style={{ color: tokens.textSecondary }}>{label}</span>
        <span className="font-medium" style={{ color: tokens.textPrimary }}>{value}%</span>
      </div>
      <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: tokens.bgSurface }}>
        <div
          className="h-full rounded-full transition-all duration-1000 ease-out"
          style={{ backgroundColor: color, width: `${percentage}%` }}
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
}

function SectionCard({ title, icon, children, action }: SectionCardProps) {
  return (
    <div
      className="rounded-2xl border"
      style={{
        backgroundColor: tokens.bgCard,
        borderColor: tokens.borderSubtle,
      }}
    >
      <div
        className="flex items-center justify-between px-5 py-4 border-b"
        style={{ borderColor: tokens.borderSubtle }}
      >
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
// LOADING STATE COMPONENT
// =============================================================================

function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
      >
        <Loader2 className="w-8 h-8" style={{ color: tokens.brandPrimary }} />
      </motion.div>
      <p className="mt-4 text-sm" style={{ color: tokens.textMuted }}>
        Loading manager dashboard...
      </p>
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

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [funnel, team] = await Promise.all([
        getTeamMetrics(),
        getTeamAnalytics(),
      ]);
      setFunnelData(funnel);
      setTeamData(team);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
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

  if (loading) {
    return <LoadingState />;
  }

  if (error) {
    return (
      <div
        className="rounded-2xl border p-8 text-center"
        style={{
          backgroundColor: tokens.statusDangerBg,
          borderColor: `${tokens.statusDanger}30`,
        }}
      >
        <p style={{ color: tokens.statusDanger }}>{error}</p>
      </div>
    );
  }

  const funnelStages = [
    { key: "reviewed", label: "Reviewed", icon: <Users className="w-6 h-6" />, color: "#A78BFA", rate: null },
    { key: "interviewed", label: "Interviewed", icon: <UserCheck className="w-6 h-6" />, color: tokens.brandPrimary, rate: funnelData?.metrics.rates.interview_rate },
    { key: "offered", label: "Offered", icon: <FileCheck className="w-6 h-6" />, color: "#22D3EE", rate: funnelData?.metrics.rates.offer_rate },
    { key: "hired", label: "Hired", icon: <Target className="w-6 h-6" />, color: tokens.statusSuccess, rate: funnelData?.metrics.rates.hire_rate },
  ];

  const teamMetrics = [
    { key: "avg_question_quality", label: "Question Quality", icon: <MessageSquare className="w-5 h-5" /> },
    { key: "avg_topic_coverage", label: "Topic Coverage", icon: <Target className="w-5 h-5" /> },
    { key: "avg_consistency", label: "Consistency", icon: <TrendingUp className="w-5 h-5" /> },
    { key: "avg_bias_score", label: "Bias Score", icon: <Shield className="w-5 h-5" />, inverted: true },
    { key: "avg_candidate_experience", label: "Candidate Exp", icon: <Users className="w-5 h-5" /> },
  ];

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
      <div>
        <div
          className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium mb-3"
          style={{
            backgroundColor: `${tokens.brandPrimary}15`,
            border: `1px solid ${tokens.brandPrimary}30`,
            color: tokens.brandPrimary,
          }}
        >
          <BarChart3 className="w-3.5 h-3.5" />
          Team Analytics
        </div>
        <h1 className="text-3xl font-light tracking-tight text-white mb-2">
          Manager Dashboard
        </h1>
        <p style={{ color: tokens.textMuted }}>
          Monitor your team's hiring funnel and interviewer performance
        </p>
      </div>

      {/* Summary KPI Cards */}
      {funnelData && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            icon={<Users className="w-5 h-5" />}
            value={funnelData.metrics.funnel.reviewed}
            label="Candidates Reviewed"
            color="#A78BFA"
          />
          <StatCard
            icon={<UserCheck className="w-5 h-5" />}
            value={funnelData.metrics.funnel.interviewed}
            label="Interviewed"
            color={tokens.brandPrimary}
            trend={{ value: Math.round(funnelData.metrics.rates.interview_rate * 100), positive: true }}
          />
          <StatCard
            icon={<Target className="w-5 h-5" />}
            value={funnelData.metrics.funnel.hired}
            label="Total Hires"
            color={tokens.statusSuccess}
          />
          <StatCard
            icon={<Timer className="w-5 h-5" />}
            value={funnelData.metrics.timing.time_to_first_interview}
            label="Avg Days to Interview"
            color="#22D3EE"
            decimals={1}
            suffix=" days"
          />
        </div>
      )}

      {/* Hiring Funnel */}
      {funnelData && (
        <SectionCard
          title={`Hiring Funnel (Last ${funnelData.period_days} Days)`}
          icon={<Activity className="w-5 h-5" />}
        >
          <div className="flex items-center justify-between gap-4">
            {funnelStages.map((stage, i) => (
              <div key={stage.key} className="flex items-center flex-1">
                <FunnelStage
                  icon={stage.icon}
                  label={stage.label}
                  value={funnelData.metrics.funnel[stage.key as keyof typeof funnelData.metrics.funnel] || 0}
                  rate={stage.rate}
                  color={stage.color}
                />
                {i < funnelStages.length - 1 && (
                  <ChevronRight className="w-8 h-8 mx-4 flex-shrink-0" style={{ color: tokens.textMuted }} />
                )}
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* Timing & Efficiency Metrics */}
      {funnelData && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <SectionCard title="Time to First Interview" icon={<Clock className="w-5 h-5" />}>
            <div className="text-5xl font-light text-white mb-2">
              {funnelData.metrics.timing.time_to_first_interview.toFixed(1)}
              <span className="text-lg ml-2" style={{ color: tokens.textMuted }}>days</span>
            </div>
            <p className="text-sm" style={{ color: tokens.textMuted }}>
              Average time from application to first interview
            </p>
          </SectionCard>

          <SectionCard title="Time in Pipeline" icon={<TrendingUp className="w-5 h-5" />}>
            <div className="text-5xl font-light text-white mb-2">
              {funnelData.metrics.timing.time_in_pipeline.toFixed(1)}
              <span className="text-lg ml-2" style={{ color: tokens.textMuted }}>days</span>
            </div>
            <p className="text-sm" style={{ color: tokens.textMuted }}>
              Average candidate time from start to decision
            </p>
          </SectionCard>

          <SectionCard title="Interviews per Hire" icon={<Award className="w-5 h-5" />}>
            <div className="text-5xl font-light text-white mb-2">
              {funnelData.metrics.timing.interviews_per_candidate.toFixed(1)}
            </div>
            <p className="text-sm" style={{ color: tokens.textMuted }}>
              Average interviews conducted per successful hire
            </p>
          </SectionCard>
        </div>
      )}

      {/* Conversion Rate Visual */}
      {funnelData && (
        <SectionCard title="Conversion Rates" icon={<Zap className="w-5 h-5" />}>
          <div className="space-y-4">
            <ProgressBar
              value={Math.round(funnelData.metrics.rates.interview_rate * 100)}
              maxValue={100}
              color={tokens.brandPrimary}
              label="Review → Interview Rate"
            />
            <ProgressBar
              value={Math.round(funnelData.metrics.rates.offer_rate * 100)}
              maxValue={100}
              color="#22D3EE"
              label="Interview → Offer Rate"
            />
            <ProgressBar
              value={Math.round(funnelData.metrics.rates.hire_rate * 100)}
              maxValue={100}
              color={tokens.statusSuccess}
              label="Offer → Hire Rate"
            />
          </div>
        </SectionCard>
      )}

      {/* Team Interviewer Analytics */}
      {teamData && teamData.interviewers.length > 0 && (
        <SectionCard
          title="Team Interviewer Performance"
          icon={<Users className="w-5 h-5" />}
          action={
            <span className="text-xs px-2 py-1 rounded-full" style={{ backgroundColor: tokens.bgSurface, color: tokens.textMuted }}>
              {teamData.team_averages.total_interviews} interviews analyzed
            </span>
          }
        >
          {/* Team Averages Summary */}
          <div className="grid grid-cols-5 gap-4 mb-8">
            {teamMetrics.map((metric) => {
              const value = teamData.team_averages[metric.key as keyof typeof teamData.team_averages] as number;
              const inverted = (metric as any).inverted || false;
              const color = getScoreColor(value, inverted);
              return (
                <div
                  key={metric.key}
                  className="text-center p-4 rounded-xl border transition-transform hover:scale-[1.02]"
                  style={{
                    backgroundColor: tokens.bgSurface,
                    borderColor: `${color}30`,
                  }}
                >
                  <div style={{ color: tokens.textMuted }} className="mb-2 flex justify-center">{metric.icon}</div>
                  <div className="text-2xl font-light" style={{ color }}>
                    {value.toFixed(0)}
                  </div>
                  <div className="text-xs mt-1" style={{ color: tokens.textMuted }}>{metric.label}</div>
                </div>
              );
            })}
          </div>

          {/* Individual Interviewers Table */}
          <div className="space-y-3">
            <div
              className="grid grid-cols-7 gap-4 px-4 py-2 text-xs uppercase tracking-wider"
              style={{ color: tokens.textMuted }}
            >
              <div className="col-span-2">Interviewer</div>
              <div className="text-center">Interviews</div>
              <div className="text-center">Quality</div>
              <div className="text-center">Coverage</div>
              <div className="text-center">Bias</div>
              <div className="text-center">Action</div>
            </div>
            {teamData.interviewers.map((item) => (
              <div
                key={item.interviewer.id}
                className="grid grid-cols-7 gap-4 items-center p-4 rounded-xl border transition-all hover:translate-x-1"
                style={{
                  backgroundColor: tokens.bgSurface,
                  borderColor: tokens.borderSubtle,
                }}
              >
                <div className="col-span-2">
                  <div className="text-white font-medium">{item.interviewer.name}</div>
                  <div className="text-xs" style={{ color: tokens.textMuted }}>{item.interviewer.team}</div>
                </div>
                <div className="text-center" style={{ color: tokens.textSecondary }}>
                  {item.metrics.total_interviews}
                </div>
                <div
                  className="text-center font-medium"
                  style={{ color: getScoreColor(item.metrics.avg_question_quality) }}
                >
                  {item.metrics.avg_question_quality.toFixed(0)}
                </div>
                <div
                  className="text-center font-medium"
                  style={{ color: getScoreColor(item.metrics.avg_topic_coverage) }}
                >
                  {item.metrics.avg_topic_coverage.toFixed(0)}
                </div>
                <div
                  className="text-center font-medium"
                  style={{ color: getScoreColor(item.metrics.avg_bias_score, true) }}
                >
                  {item.metrics.avg_bias_score.toFixed(0)}
                </div>
                <div className="text-center">
                  <Link
                    href={`/dashboard/interviewer?id=${item.interviewer.id}`}
                    className="inline-flex items-center gap-1 text-xs transition-colors hover:underline"
                    style={{ color: tokens.brandPrimary }}
                  >
                    Details <ExternalLink className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* Empty State */}
      {teamData && teamData.interviewers.length === 0 && (
        <div
          className="rounded-2xl border text-center py-12"
          style={{
            backgroundColor: tokens.bgCard,
            borderColor: tokens.borderSubtle,
          }}
        >
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{
              background: `linear-gradient(135deg, ${tokens.brandPrimary}20, ${tokens.brandSecondary}20)`,
              border: `1px solid ${tokens.borderSubtle}`,
            }}
          >
            <Users className="w-8 h-8" style={{ color: tokens.brandPrimary }} />
          </div>
          <h3 className="text-lg text-white mb-2">No Interviewer Analytics Yet</h3>
          <p className="text-sm" style={{ color: tokens.textMuted }}>
            Complete interviews with the interviewer selector to generate analytics.
          </p>
        </div>
      )}
    </div>
  );
}
