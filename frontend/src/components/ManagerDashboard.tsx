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
} from "lucide-react";
import { getTeamMetrics, TeamMetrics } from "@/lib/managerApi";
import { getTeamAnalytics, TeamAnalyticsResponse } from "@/lib/interviewerApi";
import { Card } from "@/components/ui/card";
import { FadeInUp, Stagger, StaggerItem, Spinner } from "@/components/ui/motion";
import { cn } from "@/lib/utils";

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
      if (score <= 20) return "text-emerald-400";
      if (score <= 50) return "text-amber-400";
      return "text-red-400";
    }
    if (score >= 80) return "text-emerald-400";
    if (score >= 60) return "text-amber-400";
    return "text-red-400";
  };

  const getScoreBg = (score: number, inverted: boolean = false) => {
    if (inverted) {
      if (score <= 20) return "bg-emerald-500/10 border-emerald-500/20";
      if (score <= 50) return "bg-amber-500/10 border-amber-500/20";
      return "bg-red-500/10 border-red-500/20";
    }
    if (score >= 80) return "bg-emerald-500/10 border-emerald-500/20";
    if (score >= 60) return "bg-amber-500/10 border-amber-500/20";
    return "bg-red-500/10 border-red-500/20";
  };

  const formatPercent = (val: number) => `${(val * 100).toFixed(1)}%`;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <Card variant="glass" padding="lg" className="bg-red-500/5 border-red-500/20">
        <p className="text-red-400">{error}</p>
      </Card>
    );
  }

  const funnelStages = [
    {
      key: "reviewed",
      label: "Reviewed",
      icon: Users,
      value: funnelData?.metrics.funnel.reviewed || 0,
      rate: null,
      color: "purple",
    },
    {
      key: "interviewed",
      label: "Interviewed",
      icon: UserCheck,
      value: funnelData?.metrics.funnel.interviewed || 0,
      rate: funnelData?.metrics.rates.interview_rate,
      color: "indigo",
    },
    {
      key: "offered",
      label: "Offered",
      icon: FileCheck,
      value: funnelData?.metrics.funnel.offered || 0,
      rate: funnelData?.metrics.rates.offer_rate,
      color: "cyan",
    },
    {
      key: "hired",
      label: "Hired",
      icon: Target,
      value: funnelData?.metrics.funnel.hired || 0,
      rate: funnelData?.metrics.rates.hire_rate,
      color: "emerald",
    },
  ];

  const timingMetrics = [
    {
      key: "time_to_first_interview",
      label: "Avg Time to First Interview",
      unit: "days",
      icon: Clock,
      color: "indigo",
    },
    {
      key: "time_in_pipeline",
      label: "Avg Time in Pipeline",
      unit: "days",
      icon: TrendingUp,
      color: "purple",
    },
    {
      key: "interviews_per_candidate",
      label: "Avg Interviews per Hire",
      unit: "",
      icon: Users,
      color: "cyan",
    },
  ];

  const teamMetrics = [
    { key: "avg_question_quality", label: "Question Quality", icon: MessageSquare },
    { key: "avg_topic_coverage", label: "Topic Coverage", icon: Target },
    { key: "avg_consistency", label: "Consistency", icon: TrendingUp },
    { key: "avg_bias_score", label: "Bias Score", icon: Shield, inverted: true },
    { key: "avg_candidate_experience", label: "Candidate Exp", icon: Users },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <FadeInUp>
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">
            Manager Dashboard
          </h1>
          <p className="text-zinc-400 mt-1">
            Consolidated hiring funnel and team interviewer performance
          </p>
        </div>
      </FadeInUp>

      {/* Hiring Funnel */}
      {funnelData && (
        <FadeInUp delay={0.1}>
          <Card padding="lg">
            <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-8">
              Team Hiring Funnel (Last {funnelData.period_days} Days)
            </h2>

            <div className="flex items-center justify-between">
              {funnelStages.map((stage, i) => (
                <div key={stage.key} className="flex items-center flex-1">
                  <motion.div
                    className="flex-1 text-center p-6 rounded-2xl border bg-white/[0.03] border-white/[0.06]"
                    whileHover={{ y: -4, scale: 1.02 }}
                    transition={{ type: "spring", stiffness: 400, damping: 17 }}
                  >
                    <div
                      className={cn(
                        "w-12 h-12 rounded-xl mx-auto mb-3 flex items-center justify-center",
                        stage.color === "purple" && "bg-purple-500/10",
                        stage.color === "indigo" && "bg-indigo-500/10",
                        stage.color === "cyan" && "bg-cyan-500/10",
                        stage.color === "emerald" && "bg-emerald-500/10"
                      )}
                    >
                      <stage.icon
                        className={cn(
                          "w-6 h-6",
                          stage.color === "purple" && "text-purple-400",
                          stage.color === "indigo" && "text-indigo-400",
                          stage.color === "cyan" && "text-cyan-400",
                          stage.color === "emerald" && "text-emerald-400"
                        )}
                      />
                    </div>
                    <div className="text-4xl font-light text-white mb-1">
                      {stage.value}
                    </div>
                    <div className="text-sm text-zinc-500 capitalize mb-2">
                      {stage.label}
                    </div>
                    {stage.rate !== null && stage.rate !== undefined && (
                      <div
                        className={cn(
                          "text-sm font-medium",
                          stage.color === "purple" && "text-purple-400",
                          stage.color === "indigo" && "text-indigo-400",
                          stage.color === "cyan" && "text-cyan-400",
                          stage.color === "emerald" && "text-emerald-400"
                        )}
                      >
                        {formatPercent(stage.rate)}
                      </div>
                    )}
                  </motion.div>
                  {i < 3 && (
                    <ChevronRight className="w-8 h-8 text-zinc-700 mx-4 flex-shrink-0" />
                  )}
                </div>
              ))}
            </div>
          </Card>
        </FadeInUp>
      )}

      {/* Timing Metrics */}
      {funnelData && (
        <FadeInUp delay={0.15}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {timingMetrics.map((metric) => {
              const value =
                funnelData.metrics.timing[
                  metric.key as keyof typeof funnelData.metrics.timing
                ];
              return (
                <motion.div
                  key={metric.key}
                  whileHover={{ y: -2 }}
                  transition={{ type: "spring", stiffness: 400, damping: 17 }}
                >
                  <Card padding="lg" className="h-full">
                    <div className="flex items-center gap-3 mb-4">
                      <div
                        className={cn(
                          "p-2 rounded-lg",
                          metric.color === "indigo" && "bg-indigo-500/10",
                          metric.color === "purple" && "bg-purple-500/10",
                          metric.color === "cyan" && "bg-cyan-500/10"
                        )}
                      >
                        <metric.icon
                          className={cn(
                            "w-5 h-5",
                            metric.color === "indigo" && "text-indigo-400",
                            metric.color === "purple" && "text-purple-400",
                            metric.color === "cyan" && "text-cyan-400"
                          )}
                        />
                      </div>
                      <span className="text-sm text-zinc-400 uppercase tracking-wider">
                        {metric.label}
                      </span>
                    </div>
                    <div className="text-4xl font-light text-white mb-2">
                      {value.toFixed(1)}
                      {metric.unit && (
                        <span className="text-lg text-zinc-500 ml-1">
                          {metric.unit}
                        </span>
                      )}
                    </div>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </FadeInUp>
      )}

      {/* Team Interviewer Analytics */}
      {teamData && teamData.interviewers.length > 0 && (
        <FadeInUp delay={0.2}>
          <Card padding="lg">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-500">
                Team Interviewer Performance
              </h2>
              <div className="text-xs text-zinc-600">
                {teamData.team_averages.total_interviews} total interviews analyzed
              </div>
            </div>

            {/* Team Averages Summary */}
            <div className="grid grid-cols-5 gap-4 mb-8">
              {teamMetrics.map((metric) => {
                const value = teamData.team_averages[
                  metric.key as keyof typeof teamData.team_averages
                ] as number;
                const inverted = metric.inverted || false;
                return (
                  <motion.div
                    key={metric.key}
                    className={cn(
                      "text-center p-4 rounded-xl border",
                      getScoreBg(value, inverted)
                    )}
                    whileHover={{ scale: 1.02 }}
                    transition={{ type: "spring", stiffness: 400, damping: 17 }}
                  >
                    <metric.icon className="w-5 h-5 mx-auto mb-2 text-zinc-500" />
                    <div className={cn("text-2xl font-light", getScoreColor(value, inverted))}>
                      {value.toFixed(0)}
                    </div>
                    <div className="text-xs text-zinc-500 mt-1">{metric.label}</div>
                  </motion.div>
                );
              })}
            </div>

            {/* Individual Interviewers Table */}
            <div className="space-y-3">
              <div className="grid grid-cols-7 gap-4 px-4 py-2 text-xs text-zinc-500 uppercase tracking-wider">
                <div className="col-span-2">Interviewer</div>
                <div className="text-center">Interviews</div>
                <div className="text-center">Quality</div>
                <div className="text-center">Coverage</div>
                <div className="text-center">Bias</div>
                <div className="text-center">Action</div>
              </div>
              <Stagger className="space-y-2">
                {teamData.interviewers.map((item) => (
                  <StaggerItem key={item.interviewer.id}>
                    <motion.div
                      className="grid grid-cols-7 gap-4 items-center p-4 bg-white/[0.03] rounded-xl border border-white/[0.04] hover:bg-white/[0.06] transition-colors"
                      whileHover={{ x: 4 }}
                      transition={{ type: "spring", stiffness: 400, damping: 25 }}
                    >
                      <div className="col-span-2">
                        <div className="text-white font-medium">
                          {item.interviewer.name}
                        </div>
                        <div className="text-xs text-zinc-500">
                          {item.interviewer.team}
                        </div>
                      </div>
                      <div className="text-center text-zinc-400">
                        {item.metrics.total_interviews}
                      </div>
                      <div
                        className={cn(
                          "text-center font-medium",
                          getScoreColor(item.metrics.avg_question_quality)
                        )}
                      >
                        {item.metrics.avg_question_quality.toFixed(0)}
                      </div>
                      <div
                        className={cn(
                          "text-center font-medium",
                          getScoreColor(item.metrics.avg_topic_coverage)
                        )}
                      >
                        {item.metrics.avg_topic_coverage.toFixed(0)}
                      </div>
                      <div
                        className={cn(
                          "text-center font-medium",
                          getScoreColor(item.metrics.avg_bias_score, true)
                        )}
                      >
                        {item.metrics.avg_bias_score.toFixed(0)}
                      </div>
                      <div className="text-center">
                        <Link
                          href={`/dashboard/interviewer?id=${item.interviewer.id}`}
                          className="inline-flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                        >
                          Details <ExternalLink className="w-3 h-3" />
                        </Link>
                      </div>
                    </motion.div>
                  </StaggerItem>
                ))}
              </Stagger>
            </div>
          </Card>
        </FadeInUp>
      )}

      {/* No Interviewer Analytics Yet */}
      {teamData && teamData.interviewers.length === 0 && (
        <FadeInUp delay={0.2}>
          <Card variant="glass" padding="lg" className="text-center py-12">
            <motion.div
              className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500/10 to-indigo-500/10 flex items-center justify-center mx-auto mb-4 border border-white/5"
              animate={{ y: [0, -4, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <Users className="w-8 h-8 text-purple-400" />
            </motion.div>
            <h3 className="text-lg text-zinc-300 mb-2">
              No Interviewer Analytics Yet
            </h3>
            <p className="text-sm text-zinc-500">
              Complete interviews with the interviewer selector to generate analytics.
            </p>
          </Card>
        </FadeInUp>
      )}
    </div>
  );
}
