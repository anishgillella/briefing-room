"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
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
import { tokens, springConfig } from "@/lib/design-tokens";

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

  const getScoreColor = (score: number) => {
    if (score >= 80) return tokens.statusSuccess;
    if (score >= 60) return tokens.statusWarning;
    return tokens.statusDanger;
  };

  const getScoreBg = (score: number) => {
    if (score >= 80) return { bg: `${tokens.statusSuccess}10`, border: `${tokens.statusSuccess}30` };
    if (score >= 60) return { bg: `${tokens.statusWarning}10`, border: `${tokens.statusWarning}30` };
    return { bg: `${tokens.statusDanger}10`, border: `${tokens.statusDanger}30` };
  };

  const getSeverityStyles = (severity: string) => {
    switch (severity.toLowerCase()) {
      case "high":
        return { bg: `${tokens.statusDanger}10`, border: `${tokens.statusDanger}30`, color: tokens.statusDanger };
      case "medium":
        return { bg: `${tokens.statusWarning}10`, border: `${tokens.statusWarning}30`, color: tokens.statusWarning };
      default:
        return { bg: `${tokens.brandSecondary}10`, border: `${tokens.brandSecondary}30`, color: tokens.brandSecondary };
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: tokens.bgApp }}>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          >
            <Loader2 className="w-10 h-10 mx-auto mb-4" style={{ color: tokens.brandPrimary }} />
          </motion.div>
          <p style={{ color: tokens.textMuted }}>Generating pre-interview briefing...</p>
          <p className="text-sm mt-2" style={{ color: tokens.textMuted }}>This may take up to 30 seconds</p>
        </motion.div>
      </div>
    );
  }

  if (error || !prebrief) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white" style={{ backgroundColor: tokens.bgApp }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={springConfig}
          className="text-center p-8 rounded-2xl border max-w-md"
          style={{
            backgroundColor: tokens.bgCard,
            borderColor: tokens.borderSubtle,
          }}
        >
          <motion.div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{
              backgroundColor: `${tokens.statusDanger}15`,
              border: `1px solid ${tokens.statusDanger}30`,
            }}
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <AlertTriangle className="w-8 h-8" style={{ color: tokens.statusDanger }} />
          </motion.div>
          <h1 className="text-xl font-semibold mb-2 text-white">Failed to Load Pre-Brief</h1>
          <p className="mb-6" style={{ color: tokens.textMuted }}>{error}</p>
          <Button
            variant="primary"
            onClick={() => router.push(`/candidates/${candidateId}`)}
          >
            Back to Candidate
          </Button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-white" style={{ backgroundColor: tokens.bgApp }}>
      {/* Ambient Background */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background: `
            radial-gradient(ellipse 80% 50% at 50% -20%, ${tokens.brandPrimary}15, transparent),
            radial-gradient(ellipse 60% 40% at 100% 0%, ${tokens.brandSecondary}10, transparent),
            ${tokens.bgApp}
          `,
        }}
      />

      {/* Grain Texture */}
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.015]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Header */}
      <header
        className="border-b backdrop-blur-xl sticky top-0 z-50 relative"
        style={{
          borderColor: tokens.borderSubtle,
          backgroundColor: `${tokens.bgApp}cc`,
        }}
      >
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <motion.button
            onClick={() => router.push(`/candidates/${candidateId}`)}
            className="flex items-center gap-2 transition group"
            style={{ color: tokens.textMuted }}
            whileHover={{ x: -2 }}
          >
            <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
            Back to Candidate
          </motion.button>
          <motion.button
            onClick={handleStartInterview}
            disabled={startingInterview}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium transition-all"
            style={{
              background: `linear-gradient(to right, ${tokens.brandPrimary}, ${tokens.brandSecondary})`,
              color: "white",
              opacity: startingInterview ? 0.6 : 1,
            }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            {startingInterview ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <PlayCircle className="w-5 h-5" />
            )}
            Start Interview
          </motion.button>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-6 py-8 relative">
        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={springConfig}
          className="mb-8 text-center"
        >
          <div
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm mb-4"
            style={{
              backgroundColor: `${tokens.brandPrimary}15`,
              border: `1px solid ${tokens.brandPrimary}30`,
              color: tokens.brandPrimary,
            }}
          >
            <Target className="w-4 h-4" />
            Pre-Interview Briefing
          </div>
          <h1 className="text-4xl font-light tracking-tight mb-2 text-white">{prebrief.candidate_name}</h1>
          <p style={{ color: tokens.textMuted }}>{prebrief.current_role} · {prebrief.years_experience} years experience</p>
        </motion.div>

        {/* Fit Score + TLDR */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...springConfig, delay: 0.1 }}
          className="grid grid-cols-3 gap-6 mb-8"
        >
          <motion.div
            whileHover={{ scale: 1.02 }}
            transition={springConfig}
            className="rounded-2xl p-6 text-center border"
            style={{
              backgroundColor: getScoreBg(prebrief.overall_fit_score).bg,
              borderColor: getScoreBg(prebrief.overall_fit_score).border,
            }}
          >
            <div className="text-sm mb-2" style={{ color: tokens.textMuted }}>Overall Fit</div>
            <div className="text-5xl font-light" style={{ color: getScoreColor(prebrief.overall_fit_score) }}>
              {prebrief.overall_fit_score}
            </div>
            <div className="text-sm mt-1" style={{ color: tokens.textMuted }}>/ 100</div>
          </motion.div>
          <div
            className="col-span-2 rounded-2xl p-6 border"
            style={{
              backgroundColor: tokens.bgCard,
              borderColor: tokens.borderSubtle,
            }}
          >
            <div className="text-sm mb-2" style={{ color: tokens.textMuted }}>TL;DR</div>
            <p className="text-lg leading-relaxed" style={{ color: tokens.textSecondary }}>{prebrief.tldr}</p>
          </div>
        </motion.div>

        {/* Score Breakdown */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...springConfig, delay: 0.15 }}
          className="rounded-2xl p-6 border mb-8"
          style={{
            backgroundColor: tokens.bgCard,
            borderColor: tokens.borderSubtle,
          }}
        >
          <h2 className="text-lg font-medium mb-4 text-white">Score Breakdown</h2>
          <div className="grid grid-cols-3 gap-4">
            {Object.entries(prebrief.score_breakdown).map(([key, value]) => (
              <motion.div
                key={key}
                className="flex items-center justify-between p-3 rounded-xl border"
                style={{
                  backgroundColor: getScoreBg(value).bg,
                  borderColor: getScoreBg(value).border,
                }}
                whileHover={{ scale: 1.02 }}
                transition={springConfig}
              >
                <span className="capitalize text-sm" style={{ color: tokens.textMuted }}>{key.replace(/_/g, " ")}</span>
                <span className="font-bold" style={{ color: getScoreColor(value) }}>{value}</span>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Key Things to Remember */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...springConfig, delay: 0.2 }}
          className="rounded-2xl p-6 border-l-4 mb-8"
          style={{
            backgroundColor: tokens.bgCard,
            borderColor: tokens.borderSubtle,
            borderLeftColor: `${tokens.brandPrimary}60`,
          }}
        >
          <h2 className="font-medium mb-4 flex items-center gap-2" style={{ color: tokens.brandPrimary }}>
            <Star className="w-5 h-5" />
            Key Things to Remember
          </h2>
          <div className="space-y-2">
            {prebrief.key_things_to_remember.map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ ...springConfig, delay: 0.25 + i * 0.05 }}
                className="flex items-start gap-3"
                style={{ color: tokens.textSecondary }}
              >
                <span style={{ color: tokens.brandPrimary }}>·</span>
                {item}
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Two Column: Strengths & Concerns */}
        <div className="grid grid-cols-2 gap-6 mb-8">
          {/* Strengths */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...springConfig, delay: 0.25 }}
            className="rounded-2xl p-6 border-l-4 h-full"
            style={{
              backgroundColor: tokens.bgCard,
              borderColor: tokens.borderSubtle,
              borderLeftColor: `${tokens.statusSuccess}60`,
            }}
          >
            <h2 className="font-medium mb-4 flex items-center gap-2" style={{ color: tokens.statusSuccess }}>
              <TrendingUp className="w-5 h-5" />
              Strengths ({prebrief.strengths.length})
            </h2>
            <div className="space-y-4">
              {prebrief.strengths.map((s, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ ...springConfig, delay: 0.3 + i * 0.05 }}
                  className="p-3 rounded-xl border"
                  style={{
                    backgroundColor: tokens.bgSurface,
                    borderColor: tokens.borderSubtle,
                  }}
                  whileHover={{ x: 4 }}
                >
                  <div className="font-medium text-white mb-1">{s.strength}</div>
                  <div className="text-sm mb-2" style={{ color: tokens.textMuted }}>{s.evidence}</div>
                  <div className="text-sm" style={{ color: tokens.statusSuccess }}>Verify: {s.how_to_verify}</div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Concerns */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...springConfig, delay: 0.3 }}
            className="rounded-2xl p-6 border-l-4 h-full"
            style={{
              backgroundColor: tokens.bgCard,
              borderColor: tokens.borderSubtle,
              borderLeftColor: `${tokens.statusWarning}60`,
            }}
          >
            <h2 className="font-medium mb-4 flex items-center gap-2" style={{ color: tokens.statusWarning }}>
              <TrendingDown className="w-5 h-5" />
              Concerns ({prebrief.concerns.length})
            </h2>
            <div className="space-y-4">
              {prebrief.concerns.map((c, i) => {
                const styles = getSeverityStyles(c.severity);
                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ ...springConfig, delay: 0.35 + i * 0.05 }}
                    className="p-3 rounded-xl border"
                    style={{
                      backgroundColor: styles.bg,
                      borderColor: styles.border,
                    }}
                    whileHover={{ x: 4 }}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-white">{c.concern}</span>
                      <span
                        className="text-xs px-2 py-0.5 rounded-full"
                        style={{
                          backgroundColor: styles.bg,
                          border: `1px solid ${styles.border}`,
                          color: styles.color,
                        }}
                      >
                        {c.severity}
                      </span>
                    </div>
                    <div className="text-sm mb-2" style={{ color: tokens.textMuted }}>{c.evidence}</div>
                    <div className="text-sm" style={{ color: tokens.statusWarning }}>Ask: &quot;{c.suggested_question}&quot;</div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        </div>

        {/* Skill Matches */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...springConfig, delay: 0.35 }}
          className="rounded-2xl p-6 border mb-8"
          style={{
            backgroundColor: tokens.bgCard,
            borderColor: tokens.borderSubtle,
          }}
        >
          <h2 className="font-medium mb-4 text-white">Skill Matches</h2>
          <div className="grid grid-cols-2 gap-3">
            {prebrief.skill_matches.map((skill, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ ...springConfig, delay: 0.4 + i * 0.03 }}
                className="p-3 rounded-xl border flex items-center justify-between"
                style={{
                  backgroundColor: skill.is_match ? `${tokens.statusSuccess}10` : `${tokens.statusDanger}10`,
                  borderColor: skill.is_match ? `${tokens.statusSuccess}30` : `${tokens.statusDanger}30`,
                }}
                whileHover={{ scale: 1.01 }}
              >
                <div>
                  <span className="font-medium text-white">{skill.skill}</span>
                  <span className="text-sm ml-2" style={{ color: tokens.textMuted }}>
                    (needed: {skill.required_level})
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm capitalize" style={{ color: tokens.textMuted }}>{skill.candidate_level}</span>
                  {skill.is_match ? (
                    <CheckCircle className="w-4 h-4" style={{ color: tokens.statusSuccess }} />
                  ) : (
                    <AlertTriangle className="w-4 h-4" style={{ color: tokens.statusDanger }} />
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Suggested Questions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...springConfig, delay: 0.4 }}
          className="rounded-2xl p-6 border"
          style={{
            backgroundColor: tokens.bgCard,
            borderColor: tokens.borderSubtle,
          }}
        >
          <h2 className="font-medium mb-4 flex items-center gap-2 text-white">
            <HelpCircle className="w-5 h-5" style={{ color: tokens.brandPrimary }} />
            Suggested Interview Questions
          </h2>
          <div className="space-y-4">
            {prebrief.suggested_questions.map((q, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ ...springConfig, delay: 0.45 + i * 0.05 }}
                className="p-4 rounded-xl border"
                style={{
                  backgroundColor: tokens.bgSurface,
                  borderColor: tokens.borderSubtle,
                }}
                whileHover={{ x: 4 }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-semibold" style={{ color: tokens.brandPrimary }}>{i + 1}.</span>
                  <span
                    className="text-xs px-2 py-0.5 rounded-full"
                    style={{
                      backgroundColor: `${tokens.brandSecondary}15`,
                      border: `1px solid ${tokens.brandSecondary}30`,
                      color: tokens.brandSecondary,
                    }}
                  >
                    {q.category}
                  </span>
                </div>
                <p className="mb-2" style={{ color: tokens.textSecondary }}>&quot;{q.question}&quot;</p>
                <p className="text-sm" style={{ color: tokens.textMuted }}>Purpose: {q.purpose}</p>
                {q.follow_up && (
                  <p className="text-sm mt-1" style={{ color: tokens.brandPrimary }}>Follow-up: {q.follow_up}</p>
                )}
              </motion.div>
            ))}
          </div>
        </motion.div>
      </main>
    </div>
  );
}
