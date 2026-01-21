"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowLeft,
  PlayCircle,
  Loader2,
  CheckCircle,
  AlertTriangle,
  Target,
  HelpCircle,
  Star,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FadeInUp, Stagger, StaggerItem, Spinner } from "@/components/ui/motion";
import { cn } from "@/lib/utils";
import { tokens, springConfig, easeOutCustom } from "@/lib/design-tokens";

const API_URL = "http://localhost:8000";

interface ScoreBreakdown {
  technical_skills: number;
  experience_relevance: number;
  leadership_potential: number;
  communication_signals: number;
  culture_fit_signals: number;
  growth_trajectory: number;
}

interface SkillMatch {
  skill: string;
  required_level: string;
  candidate_level: string;
  evidence?: string;
  is_match: boolean;
}

interface Strength {
  strength: string;
  evidence: string;
  how_to_verify: string;
}

interface Concern {
  concern: string;
  evidence: string;
  suggested_question: string;
  severity: string;
}

interface SuggestedQuestion {
  question: string;
  category: string;
  purpose: string;
  follow_up?: string;
}

interface PreBrief {
  candidate_name: string;
  current_role: string;
  years_experience: number;
  overall_fit_score: number;
  fit_summary: string;
  score_breakdown: ScoreBreakdown;
  skill_matches: SkillMatch[];
  strengths: Strength[];
  concerns: Concern[];
  suggested_questions: SuggestedQuestion[];
  tldr: string;
  key_things_to_remember: string[];
}

export default function PreBriefPage() {
  const params = useParams();
  const router = useRouter();
  const candidateId = params.id as string;
  const prefersReducedMotion = useReducedMotion();

  const [prebrief, setPrebrief] = useState<PreBrief | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [startingInterview, setStartingInterview] = useState(false);

  useEffect(() => {
    fetchPrebrief();
  }, [candidateId]);

  const fetchPrebrief = async () => {
    try {
      const res = await fetch(`${API_URL}/api/pluto/candidates/${candidateId}/prebrief`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || "Failed to load pre-brief");
      }
      const data = await res.json();
      setPrebrief(data.prebrief);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleStartInterview = async () => {
    setStartingInterview(true);
    try {
      const res = await fetch(`${API_URL}/api/pluto/candidates/${candidateId}/interview/start`, {
        method: "POST",
      });
      if (res.ok) {
        const data = await res.json();
        router.push(`/candidates/${candidateId}/interview?room=${data.room_name}`);
      } else {
        alert("Failed to start interview");
      }
    } catch (e) {
      alert("Failed to start interview");
    } finally {
      setStartingInterview(false);
    }
  };

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: tokens.bgApp }}
      >
        <div className="text-center">
          <Spinner size="lg" className="mx-auto mb-4" />
          <p style={{ color: tokens.textMuted }}>Generating pre-interview briefing...</p>
          <p className="text-sm mt-2" style={{ color: tokens.textDisabled }}>
            This may take up to 30 seconds
          </p>
        </div>
      </div>
    );
  }

  if (error || !prebrief) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: tokens.bgApp, color: tokens.textPrimary }}
      >
        <FadeInUp>
          <Card padding="lg" className="text-center max-w-md">
            <motion.div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{
                background: "rgba(239,68,68,0.1)",
                border: "1px solid rgba(239,68,68,0.2)",
              }}
              animate={prefersReducedMotion ? {} : { scale: [1, 1.05, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <AlertTriangle className="w-8 h-8" style={{ color: tokens.statusDanger }} />
            </motion.div>
            <h1 className="text-xl font-semibold mb-2">Failed to Load Pre-Brief</h1>
            <p style={{ color: tokens.textMuted }} className="mb-6">
              {error}
            </p>
            <Button variant="primary" onClick={() => router.push(`/candidates/${candidateId}`)}>
              Back to Candidate
            </Button>
          </Card>
        </FadeInUp>
      </div>
    );
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return tokens.statusSuccess;
    if (score >= 60) return tokens.statusWarning;
    return tokens.statusDanger;
  };

  const getScoreBg = (score: number) => {
    if (score >= 80) return { bg: "rgba(16,185,129,0.1)", border: "rgba(16,185,129,0.2)" };
    if (score >= 60) return { bg: "rgba(245,158,11,0.1)", border: "rgba(245,158,11,0.2)" };
    return { bg: "rgba(239,68,68,0.1)", border: "rgba(239,68,68,0.2)" };
  };

  const getSeverityVariant = (severity: string): "error" | "warning" | "info" => {
    switch (severity.toLowerCase()) {
      case "high":
        return "error";
      case "medium":
        return "warning";
      default:
        return "info";
    }
  };

  const getSeverityColors = (severity: string) => {
    switch (severity.toLowerCase()) {
      case "high":
        return { bg: "rgba(239,68,68,0.1)", border: "rgba(239,68,68,0.2)" };
      case "medium":
        return { bg: "rgba(245,158,11,0.1)", border: "rgba(245,158,11,0.2)" };
      default:
        return { bg: "rgba(59,130,246,0.1)", border: "rgba(59,130,246,0.2)" };
    }
  };

  return (
    <div className="min-h-screen" style={{ background: tokens.bgApp, color: tokens.textPrimary }}>
      {/* Ambient Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute top-0 left-1/4 w-[800px] h-[800px] rounded-full blur-[120px] opacity-30"
          style={{ background: tokens.brandGlow }}
        />
        <div
          className="absolute bottom-0 right-1/4 w-[600px] h-[600px] rounded-full blur-[100px] opacity-20"
          style={{ background: "rgba(139,92,246,0.15)" }}
        />
      </div>

      {/* Header */}
      <header
        className="backdrop-blur-xl sticky top-0 z-50"
        style={{
          borderBottom: `1px solid ${tokens.borderSubtle}`,
          background: "rgba(7,11,20,0.8)",
        }}
      >
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <motion.button
            onClick={() => router.push(`/candidates/${candidateId}`)}
            className="flex items-center gap-2 transition group"
            style={{ color: tokens.textMuted }}
            whileHover={prefersReducedMotion ? {} : { x: -2 }}
          >
            <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
            Back to Candidate
          </motion.button>
          <Button
            variant="primary"
            onClick={handleStartInterview}
            disabled={startingInterview}
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
      </header>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-6 py-8 relative z-10">
        {/* Hero */}
        <FadeInUp className="mb-8 text-center">
          <Badge variant="secondary" className="mb-4">
            <Target className="w-4 h-4 mr-1" />
            Pre-Interview Briefing
          </Badge>
          <h1 className="text-4xl font-bold mb-2">{prebrief.candidate_name}</h1>
          <p style={{ color: tokens.textMuted }}>
            {prebrief.current_role} · {prebrief.years_experience} years experience
          </p>
        </FadeInUp>

        {/* Fit Score + TLDR */}
        <FadeInUp delay={0.1} className="grid grid-cols-3 gap-6 mb-8">
          <motion.div
            whileHover={prefersReducedMotion ? {} : { scale: 1.02 }}
            transition={springConfig}
          >
            <div
              className="col-span-1 text-center rounded-2xl p-6"
              style={{
                background: getScoreBg(prebrief.overall_fit_score).bg,
                border: `1px solid ${getScoreBg(prebrief.overall_fit_score).border}`,
              }}
            >
              <div className="text-sm mb-2" style={{ color: tokens.textMuted }}>
                Overall Fit
              </div>
              <div
                className="text-5xl font-light"
                style={{ color: getScoreColor(prebrief.overall_fit_score) }}
              >
                {prebrief.overall_fit_score}
              </div>
              <div className="text-sm mt-1" style={{ color: tokens.textDisabled }}>
                / 100
              </div>
            </div>
          </motion.div>
          <div
            className="col-span-2 rounded-2xl p-6"
            style={{
              background: tokens.bgCard,
              border: `1px solid ${tokens.borderSubtle}`,
            }}
          >
            <div className="text-sm mb-2" style={{ color: tokens.textMuted }}>
              TL;DR
            </div>
            <p className="text-lg leading-relaxed" style={{ color: tokens.textSecondary }}>
              {prebrief.tldr}
            </p>
          </div>
        </FadeInUp>

        {/* Score Breakdown */}
        <FadeInUp delay={0.15}>
          <div
            className="mb-8 rounded-2xl p-6"
            style={{
              background: tokens.bgCard,
              border: `1px solid ${tokens.borderSubtle}`,
            }}
          >
            <h2 className="text-lg font-semibold mb-4">Score Breakdown</h2>
            <div className="grid grid-cols-3 gap-4">
              {Object.entries(prebrief.score_breakdown).map(([key, value]) => (
                <motion.div
                  key={key}
                  className="flex items-center justify-between p-3 rounded-xl"
                  style={{
                    background: getScoreBg(value).bg,
                    border: `1px solid ${getScoreBg(value).border}`,
                  }}
                  whileHover={prefersReducedMotion ? {} : { scale: 1.02 }}
                  transition={springConfig}
                >
                  <span className="capitalize text-sm" style={{ color: tokens.textMuted }}>
                    {key.replace(/_/g, " ")}
                  </span>
                  <span className="font-bold" style={{ color: getScoreColor(value) }}>
                    {value}
                  </span>
                </motion.div>
              ))}
            </div>
          </div>
        </FadeInUp>

        {/* Key Things to Remember */}
        <FadeInUp delay={0.2}>
          <div
            className="mb-8 rounded-2xl p-6"
            style={{
              background: tokens.bgCard,
              border: `1px solid ${tokens.borderSubtle}`,
              borderLeft: `4px solid ${tokens.brandPrimary}80`,
            }}
          >
            <h2 className="font-semibold mb-4 flex items-center gap-2" style={{ color: tokens.brandSecondary }}>
              <Star className="w-5 h-5" />
              Key Things to Remember
            </h2>
            <Stagger className="space-y-2">
              {prebrief.key_things_to_remember.map((item, i) => (
                <StaggerItem key={i}>
                  <div className="flex items-start gap-3" style={{ color: tokens.textSecondary }}>
                    <span style={{ color: tokens.brandSecondary }}>·</span>
                    {item}
                  </div>
                </StaggerItem>
              ))}
            </Stagger>
          </div>
        </FadeInUp>

        {/* Two Column: Strengths & Concerns */}
        <div className="grid grid-cols-2 gap-6 mb-8">
          {/* Strengths */}
          <FadeInUp delay={0.25}>
            <div
              className="h-full rounded-2xl p-6"
              style={{
                background: tokens.bgCard,
                border: `1px solid ${tokens.borderSubtle}`,
                borderLeft: `4px solid ${tokens.statusSuccess}80`,
              }}
            >
              <h2
                className="font-semibold mb-4 flex items-center gap-2"
                style={{ color: tokens.statusSuccess }}
              >
                <TrendingUp className="w-5 h-5" />
                Strengths ({prebrief.strengths.length})
              </h2>
              <Stagger className="space-y-4">
                {prebrief.strengths.map((s, i) => (
                  <StaggerItem key={i}>
                    <motion.div
                      className="p-3 rounded-xl"
                      style={{
                        background: "rgba(255,255,255,0.03)",
                        border: `1px solid ${tokens.borderSubtle}`,
                      }}
                      whileHover={prefersReducedMotion ? {} : { x: 4 }}
                      transition={springConfig}
                    >
                      <div className="font-medium mb-1" style={{ color: tokens.textSecondary }}>
                        {s.strength}
                      </div>
                      <div className="text-sm mb-2" style={{ color: tokens.textDisabled }}>
                        {s.evidence}
                      </div>
                      <div className="text-sm" style={{ color: tokens.statusSuccess }}>
                        Verify: {s.how_to_verify}
                      </div>
                    </motion.div>
                  </StaggerItem>
                ))}
              </Stagger>
            </div>
          </FadeInUp>

          {/* Concerns */}
          <FadeInUp delay={0.3}>
            <div
              className="h-full rounded-2xl p-6"
              style={{
                background: tokens.bgCard,
                border: `1px solid ${tokens.borderSubtle}`,
                borderLeft: `4px solid ${tokens.statusWarning}80`,
              }}
            >
              <h2
                className="font-semibold mb-4 flex items-center gap-2"
                style={{ color: tokens.statusWarning }}
              >
                <TrendingDown className="w-5 h-5" />
                Concerns ({prebrief.concerns.length})
              </h2>
              <Stagger className="space-y-4">
                {prebrief.concerns.map((c, i) => {
                  const colors = getSeverityColors(c.severity);
                  return (
                    <StaggerItem key={i}>
                      <motion.div
                        className="p-3 rounded-xl"
                        style={{
                          background: colors.bg,
                          border: `1px solid ${colors.border}`,
                        }}
                        whileHover={prefersReducedMotion ? {} : { x: 4 }}
                        transition={springConfig}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium" style={{ color: tokens.textSecondary }}>
                            {c.concern}
                          </span>
                          <Badge variant={getSeverityVariant(c.severity)} size="sm">
                            {c.severity}
                          </Badge>
                        </div>
                        <div className="text-sm mb-2" style={{ color: tokens.textDisabled }}>
                          {c.evidence}
                        </div>
                        <div className="text-sm" style={{ color: tokens.statusWarning }}>
                          Ask: &quot;{c.suggested_question}&quot;
                        </div>
                      </motion.div>
                    </StaggerItem>
                  );
                })}
              </Stagger>
            </div>
          </FadeInUp>
        </div>

        {/* Skill Matches */}
        <FadeInUp delay={0.35}>
          <div
            className="mb-8 rounded-2xl p-6"
            style={{
              background: tokens.bgCard,
              border: `1px solid ${tokens.borderSubtle}`,
            }}
          >
            <h2 className="font-semibold mb-4">Skill Matches</h2>
            <div className="grid grid-cols-2 gap-3">
              {prebrief.skill_matches.map((skill, i) => (
                <motion.div
                  key={i}
                  className="p-3 rounded-xl flex items-center justify-between"
                  style={{
                    background: skill.is_match ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)",
                    border: `1px solid ${skill.is_match ? "rgba(16,185,129,0.2)" : "rgba(239,68,68,0.2)"}`,
                  }}
                  whileHover={prefersReducedMotion ? {} : { scale: 1.01 }}
                  transition={springConfig}
                >
                  <div>
                    <span className="font-medium" style={{ color: tokens.textPrimary }}>
                      {skill.skill}
                    </span>
                    <span className="text-sm ml-2" style={{ color: tokens.textDisabled }}>
                      (needed: {skill.required_level})
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm capitalize" style={{ color: tokens.textMuted }}>
                      {skill.candidate_level}
                    </span>
                    {skill.is_match ? (
                      <CheckCircle className="w-4 h-4" style={{ color: tokens.statusSuccess }} />
                    ) : (
                      <AlertTriangle className="w-4 h-4" style={{ color: tokens.statusDanger }} />
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </FadeInUp>

        {/* Suggested Questions */}
        <FadeInUp delay={0.4}>
          <div
            className="rounded-2xl p-6"
            style={{
              background: tokens.bgCard,
              border: `1px solid ${tokens.borderSubtle}`,
            }}
          >
            <h2 className="font-semibold mb-4 flex items-center gap-2">
              <HelpCircle className="w-5 h-5" style={{ color: tokens.brandSecondary }} />
              Suggested Interview Questions
            </h2>
            <Stagger className="space-y-4">
              {prebrief.suggested_questions.map((q, i) => (
                <StaggerItem key={i}>
                  <motion.div
                    className="p-4 rounded-xl"
                    style={{
                      background: "rgba(255,255,255,0.03)",
                      border: `1px solid ${tokens.borderSubtle}`,
                    }}
                    whileHover={prefersReducedMotion ? {} : { x: 4 }}
                    transition={springConfig}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-semibold" style={{ color: tokens.brandSecondary }}>
                        {i + 1}.
                      </span>
                      <Badge variant="secondary" size="sm">
                        {q.category}
                      </Badge>
                    </div>
                    <p className="mb-2" style={{ color: tokens.textSecondary }}>
                      &quot;{q.question}&quot;
                    </p>
                    <p className="text-sm" style={{ color: tokens.textDisabled }}>
                      Purpose: {q.purpose}
                    </p>
                    {q.follow_up && (
                      <p className="text-sm mt-1" style={{ color: tokens.brandSecondary }}>
                        Follow-up: {q.follow_up}
                      </p>
                    )}
                  </motion.div>
                </StaggerItem>
              ))}
            </Stagger>
          </div>
        </FadeInUp>
      </main>

      {/* Grain texture overlay */}
      <div
        className="fixed inset-0 pointer-events-none z-[100] opacity-[0.015]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />
    </div>
  );
}
