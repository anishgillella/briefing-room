"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  MessageSquare,
  Target,
  Users,
  Shield,
  Lightbulb,
} from "lucide-react";
import {
  getInterviewerAnalytics,
  getSelectedInterviewerId,
  InterviewerAnalyticsResponse,
} from "@/lib/interviewerApi";
import InterviewerSelector from "./InterviewerSelector";
import { Card } from "@/components/ui/card";
import { FadeInUp, Spinner } from "@/components/ui/motion";
import { cn } from "@/lib/utils";

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

  const getCircleColor = (score: number) => {
    if (score >= 70) return "stroke-emerald-500";
    if (score >= 50) return "stroke-amber-500";
    return "stroke-red-500";
  };

  const scoreMetrics = [
    { key: "avg_question_quality", label: "Question Quality", icon: MessageSquare },
    { key: "avg_topic_coverage", label: "Topic Coverage", icon: Target },
    { key: "avg_consistency", label: "Consistency", icon: TrendingUp },
    { key: "avg_bias_score", label: "Bias Score", icon: Shield, inverted: true },
    { key: "avg_candidate_experience", label: "Candidate Exp", icon: Users },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <FadeInUp>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight">
              Interviewer Analytics
            </h1>
            <p className="text-zinc-400 mt-1">
              Performance insights and quality metrics
            </p>
          </div>
          <InterviewerSelector onInterviewerChange={handleInterviewerChange} />
        </div>
      </FadeInUp>

      {!interviewerId && (
        <FadeInUp delay={0.1}>
          <Card variant="glass" padding="lg" className="text-center py-16">
            <motion.div
              className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center mx-auto mb-6 border border-white/10"
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            >
              <Users className="w-10 h-10 text-indigo-400" />
            </motion.div>
            <h2 className="text-2xl font-bold text-white mb-3">
              Select an Interviewer
            </h2>
            <p className="text-zinc-400 max-w-md mx-auto">
              Choose an interviewer from the dropdown above to view their analytics.
            </p>
          </Card>
        </FadeInUp>
      )}

      {error && (
        <FadeInUp delay={0.1}>
          <Card variant="glass" padding="lg" className="bg-red-500/5 border-red-500/20">
            <p className="text-red-400">{error}</p>
          </Card>
        </FadeInUp>
      )}

      {data && (
        <>
          {data.aggregated.total_interviews === 0 ? (
            <FadeInUp delay={0.1}>
              <Card variant="glass" padding="lg" className="text-center py-16">
                <motion.div
                  className="w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-500/10 to-cyan-500/10 flex items-center justify-center mx-auto mb-6 border border-white/10"
                  animate={{ y: [0, -8, 0] }}
                  transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                >
                  <MessageSquare className="w-10 h-10 text-purple-400" />
                </motion.div>
                <h2 className="text-2xl font-bold text-white mb-3">
                  No Analytics Yet
                </h2>
                <p className="text-zinc-400 max-w-md mx-auto">
                  Complete interviews with this interviewer to see analytics.
                </p>
              </Card>
            </FadeInUp>
          ) : (
            <>
              {/* Score Cards */}
              <FadeInUp delay={0.1}>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  {scoreMetrics.map((metric) => {
                    const value = data.aggregated[
                      metric.key as keyof typeof data.aggregated
                    ] as number;
                    const inverted = metric.inverted || false;
                    return (
                      <motion.div
                        key={metric.key}
                        whileHover={{ y: -4, scale: 1.02 }}
                        transition={{ type: "spring", stiffness: 400, damping: 17 }}
                      >
                        <Card
                          padding="md"
                          className={cn("border", getScoreBg(value, inverted))}
                        >
                          <div className="flex items-center gap-2 mb-3">
                            <metric.icon className="w-4 h-4 text-zinc-500" />
                            <span className="text-xs text-zinc-500 uppercase tracking-wider">
                              {metric.label}
                            </span>
                          </div>
                          <div
                            className={cn(
                              "text-3xl font-light",
                              getScoreColor(value, inverted)
                            )}
                          >
                            {value.toFixed(0)}
                            <span className="text-lg text-zinc-600">/100</span>
                          </div>
                          {inverted && value <= 20 && (
                            <div className="mt-2 text-xs text-emerald-400 flex items-center gap-1">
                              <CheckCircle className="w-3 h-3" /> Low bias detected
                            </div>
                          )}
                        </Card>
                      </motion.div>
                    );
                  })}
                </div>
              </FadeInUp>

              {/* Topic Coverage Breakdown */}
              <FadeInUp delay={0.15}>
                <Card padding="lg">
                  <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-6">
                    Topic Coverage Breakdown
                  </h2>
                  <div className="grid grid-cols-4 gap-6">
                    {Object.entries(data.aggregated.topic_breakdown).map(
                      ([topic, score]) => (
                        <motion.div
                          key={topic}
                          className="text-center"
                          whileHover={{ scale: 1.05 }}
                          transition={{ type: "spring", stiffness: 400, damping: 17 }}
                        >
                          <div className="relative w-24 h-24 mx-auto mb-3">
                            <svg className="w-24 h-24 transform -rotate-90">
                              <circle
                                cx="48"
                                cy="48"
                                r="40"
                                strokeWidth="8"
                                fill="none"
                                className="stroke-zinc-800"
                              />
                              <motion.circle
                                cx="48"
                                cy="48"
                                r="40"
                                strokeWidth="8"
                                fill="none"
                                strokeLinecap="round"
                                className={getCircleColor(score)}
                                initial={{ strokeDasharray: "0 251.2" }}
                                animate={{
                                  strokeDasharray: `${(score / 100) * 251.2} 251.2`,
                                }}
                                transition={{ duration: 1, ease: "easeOut" }}
                              />
                            </svg>
                            <div className="absolute inset-0 flex items-center justify-center">
                              <span className="text-xl font-light text-white">
                                {score}
                              </span>
                            </div>
                          </div>
                          <div className="text-sm text-zinc-400 capitalize">
                            {topic.replace("_", " ")}
                          </div>
                        </motion.div>
                      )
                    )}
                  </div>
                </Card>
              </FadeInUp>

              {/* Recommendations / Suggestions */}
              {data.aggregated.common_suggestions.length > 0 && (
                <FadeInUp delay={0.2}>
                  <Card
                    padding="lg"
                    className="border-l-4 border-l-amber-500/50"
                  >
                    <h2 className="text-amber-400 font-semibold mb-6 flex items-center gap-2 text-lg">
                      <Lightbulb className="w-5 h-5" />
                      Common Improvement Areas
                    </h2>
                    <div className="space-y-4">
                      {data.aggregated.common_suggestions.map((suggestion, i) => (
                        <motion.div
                          key={i}
                          className="flex items-start gap-4 text-zinc-300"
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.1 * i }}
                        >
                          <div className="w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <span className="text-amber-400 text-xs font-bold">
                              {i + 1}
                            </span>
                          </div>
                          <p className="leading-relaxed">{suggestion}</p>
                        </motion.div>
                      ))}
                    </div>
                  </Card>
                </FadeInUp>
              )}

              {/* Bias Flags */}
              {data.aggregated.bias_flags.length > 0 && (
                <FadeInUp delay={0.25}>
                  <Card
                    padding="lg"
                    className="border-l-4 border-l-red-500/50"
                  >
                    <h2 className="text-red-400 font-semibold mb-6 flex items-center gap-2 text-lg">
                      <AlertTriangle className="w-5 h-5" />
                      Bias Indicators Detected
                    </h2>
                    <div className="space-y-2">
                      {data.aggregated.bias_flags.map((flag, i) => (
                        <motion.div
                          key={i}
                          className="flex items-center gap-3 text-zinc-400"
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.05 * i }}
                        >
                          <div className="w-2 h-2 rounded-full bg-red-500" />
                          <span>{flag}</span>
                        </motion.div>
                      ))}
                    </div>
                  </Card>
                </FadeInUp>
              )}

              {/* No issues state */}
              {data.aggregated.common_suggestions.length === 0 &&
                data.aggregated.bias_flags.length === 0 && (
                  <FadeInUp delay={0.2}>
                    <Card
                      padding="lg"
                      className="border-l-4 border-l-emerald-500/50"
                    >
                      <h2 className="text-emerald-400 font-semibold mb-2 flex items-center gap-2 text-lg">
                        <CheckCircle className="w-5 h-5" />
                        Excellent Performance
                      </h2>
                      <p className="text-zinc-400">
                        No significant improvement areas or bias indicators
                        detected. Keep up the great work!
                      </p>
                    </Card>
                  </FadeInUp>
                )}

              {/* Interview Count */}
              <FadeInUp delay={0.3}>
                <p className="text-center text-zinc-600 text-sm">
                  Based on {data.aggregated.total_interviews} analyzed interview
                  {data.aggregated.total_interviews !== 1 ? "s" : ""}
                </p>
              </FadeInUp>
            </>
          )}
        </>
      )}
    </div>
  );
}
