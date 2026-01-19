"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
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

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-center">
          <Spinner size="lg" className="mx-auto mb-4" />
          <p className="text-zinc-400">Generating pre-interview briefing...</p>
          <p className="text-zinc-600 text-sm mt-2">This may take up to 30 seconds</p>
        </div>
      </div>
    );
  }

  if (error || !prebrief) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-white">
        <FadeInUp>
          <Card padding="lg" className="text-center max-w-md">
            <motion.div
              className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center mx-auto mb-4 border border-red-500/20"
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <AlertTriangle className="w-8 h-8 text-red-400" />
            </motion.div>
            <h1 className="text-xl font-semibold mb-2">Failed to Load Pre-Brief</h1>
            <p className="text-zinc-400 mb-6">{error}</p>
            <Button
              variant="primary"
              onClick={() => router.push(`/candidates/${candidateId}`)}
            >
              Back to Candidate
            </Button>
          </Card>
        </FadeInUp>
      </div>
    );
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-emerald-400";
    if (score >= 60) return "text-amber-400";
    return "text-red-400";
  };

  const getScoreBg = (score: number) => {
    if (score >= 80) return "bg-emerald-500/10 border-emerald-500/20";
    if (score >= 60) return "bg-amber-500/10 border-amber-500/20";
    return "bg-red-500/10 border-red-500/20";
  };

  const getSeverityVariant = (severity: string): "error" | "warning" | "info" => {
    switch (severity.toLowerCase()) {
      case "high": return "error";
      case "medium": return "warning";
      default: return "info";
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Header */}
      <header className="border-b border-white/[0.06] bg-zinc-950/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <motion.button
            onClick={() => router.push(`/candidates/${candidateId}`)}
            className="flex items-center gap-2 text-zinc-400 hover:text-white transition group"
            whileHover={{ x: -2 }}
          >
            <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
            Back to Candidate
          </motion.button>
          <Button
            variant="primary"
            onClick={handleStartInterview}
            disabled={startingInterview}
            leftIcon={startingInterview ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlayCircle className="w-5 h-5" />}
          >
            Start Interview
          </Button>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Hero */}
        <FadeInUp className="mb-8 text-center">
          <Badge variant="secondary" className="mb-4">
            <Target className="w-4 h-4 mr-1" />
            Pre-Interview Briefing
          </Badge>
          <h1 className="text-4xl font-bold mb-2">{prebrief.candidate_name}</h1>
          <p className="text-zinc-400">{prebrief.current_role} · {prebrief.years_experience} years experience</p>
        </FadeInUp>

        {/* Fit Score + TLDR */}
        <FadeInUp delay={0.1} className="grid grid-cols-3 gap-6 mb-8">
          <motion.div
            whileHover={{ scale: 1.02 }}
            transition={{ type: "spring", stiffness: 400, damping: 17 }}
          >
            <Card padding="lg" className={cn("col-span-1 text-center border", getScoreBg(prebrief.overall_fit_score))}>
              <div className="text-sm text-zinc-400 mb-2">Overall Fit</div>
              <div className={cn("text-5xl font-light", getScoreColor(prebrief.overall_fit_score))}>
                {prebrief.overall_fit_score}
              </div>
              <div className="text-zinc-600 text-sm mt-1">/ 100</div>
            </Card>
          </motion.div>
          <Card padding="lg" className="col-span-2">
            <div className="text-sm text-zinc-400 mb-2">TL;DR</div>
            <p className="text-lg text-zinc-200 leading-relaxed">{prebrief.tldr}</p>
          </Card>
        </FadeInUp>

        {/* Score Breakdown */}
        <FadeInUp delay={0.15}>
          <Card padding="lg" className="mb-8">
            <h2 className="text-lg font-semibold mb-4">Score Breakdown</h2>
            <div className="grid grid-cols-3 gap-4">
              {Object.entries(prebrief.score_breakdown).map(([key, value]) => (
                <motion.div
                  key={key}
                  className={cn("flex items-center justify-between p-3 rounded-xl border", getScoreBg(value))}
                  whileHover={{ scale: 1.02 }}
                  transition={{ type: "spring", stiffness: 400, damping: 17 }}
                >
                  <span className="text-zinc-400 capitalize text-sm">{key.replace(/_/g, " ")}</span>
                  <span className={cn("font-bold", getScoreColor(value))}>{value}</span>
                </motion.div>
              ))}
            </div>
          </Card>
        </FadeInUp>

        {/* Key Things to Remember */}
        <FadeInUp delay={0.2}>
          <Card padding="lg" className="mb-8 border-l-4 border-l-indigo-500/50">
            <h2 className="text-indigo-400 font-semibold mb-4 flex items-center gap-2">
              <Star className="w-5 h-5" />
              Key Things to Remember
            </h2>
            <Stagger className="space-y-2">
              {prebrief.key_things_to_remember.map((item, i) => (
                <StaggerItem key={i}>
                  <div className="flex items-start gap-3 text-zinc-300">
                    <span className="text-indigo-400">·</span>
                    {item}
                  </div>
                </StaggerItem>
              ))}
            </Stagger>
          </Card>
        </FadeInUp>

        {/* Two Column: Strengths & Concerns */}
        <div className="grid grid-cols-2 gap-6 mb-8">
          {/* Strengths */}
          <FadeInUp delay={0.25}>
            <Card padding="lg" className="border-l-4 border-l-emerald-500/50 h-full">
              <h2 className="text-emerald-400 font-semibold mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Strengths ({prebrief.strengths.length})
              </h2>
              <Stagger className="space-y-4">
                {prebrief.strengths.map((s, i) => (
                  <StaggerItem key={i}>
                    <motion.div
                      className="p-3 bg-white/[0.03] rounded-xl border border-white/[0.06]"
                      whileHover={{ x: 4 }}
                      transition={{ type: "spring", stiffness: 400, damping: 25 }}
                    >
                      <div className="font-medium text-zinc-200 mb-1">{s.strength}</div>
                      <div className="text-sm text-zinc-500 mb-2">{s.evidence}</div>
                      <div className="text-sm text-emerald-400">Verify: {s.how_to_verify}</div>
                    </motion.div>
                  </StaggerItem>
                ))}
              </Stagger>
            </Card>
          </FadeInUp>

          {/* Concerns */}
          <FadeInUp delay={0.3}>
            <Card padding="lg" className="border-l-4 border-l-amber-500/50 h-full">
              <h2 className="text-amber-400 font-semibold mb-4 flex items-center gap-2">
                <TrendingDown className="w-5 h-5" />
                Concerns ({prebrief.concerns.length})
              </h2>
              <Stagger className="space-y-4">
                {prebrief.concerns.map((c, i) => (
                  <StaggerItem key={i}>
                    <motion.div
                      className={cn(
                        "p-3 rounded-xl border",
                        c.severity.toLowerCase() === "high"
                          ? "bg-red-500/10 border-red-500/20"
                          : c.severity.toLowerCase() === "medium"
                          ? "bg-amber-500/10 border-amber-500/20"
                          : "bg-blue-500/10 border-blue-500/20"
                      )}
                      whileHover={{ x: 4 }}
                      transition={{ type: "spring", stiffness: 400, damping: 25 }}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-zinc-200">{c.concern}</span>
                        <Badge variant={getSeverityVariant(c.severity)} size="sm">
                          {c.severity}
                        </Badge>
                      </div>
                      <div className="text-sm text-zinc-500 mb-2">{c.evidence}</div>
                      <div className="text-sm text-amber-300">Ask: &quot;{c.suggested_question}&quot;</div>
                    </motion.div>
                  </StaggerItem>
                ))}
              </Stagger>
            </Card>
          </FadeInUp>
        </div>

        {/* Skill Matches */}
        <FadeInUp delay={0.35}>
          <Card padding="lg" className="mb-8">
            <h2 className="font-semibold mb-4">Skill Matches</h2>
            <div className="grid grid-cols-2 gap-3">
              {prebrief.skill_matches.map((skill, i) => (
                <motion.div
                  key={i}
                  className={cn(
                    "p-3 rounded-xl border flex items-center justify-between",
                    skill.is_match
                      ? "bg-emerald-500/10 border-emerald-500/20"
                      : "bg-red-500/10 border-red-500/20"
                  )}
                  whileHover={{ scale: 1.01 }}
                  transition={{ type: "spring", stiffness: 400, damping: 17 }}
                >
                  <div>
                    <span className="font-medium text-white">{skill.skill}</span>
                    <span className="text-zinc-500 text-sm ml-2">
                      (needed: {skill.required_level})
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm capitalize text-zinc-400">{skill.candidate_level}</span>
                    {skill.is_match ? (
                      <CheckCircle className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-red-400" />
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </Card>
        </FadeInUp>

        {/* Suggested Questions */}
        <FadeInUp delay={0.4}>
          <Card padding="lg">
            <h2 className="font-semibold mb-4 flex items-center gap-2">
              <HelpCircle className="w-5 h-5 text-indigo-400" />
              Suggested Interview Questions
            </h2>
            <Stagger className="space-y-4">
              {prebrief.suggested_questions.map((q, i) => (
                <StaggerItem key={i}>
                  <motion.div
                    className="p-4 bg-white/[0.03] rounded-xl border border-white/[0.06]"
                    whileHover={{ x: 4 }}
                    transition={{ type: "spring", stiffness: 400, damping: 25 }}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-indigo-400 font-semibold">{i + 1}.</span>
                      <Badge variant="secondary" size="sm">
                        {q.category}
                      </Badge>
                    </div>
                    <p className="text-zinc-200 mb-2">&quot;{q.question}&quot;</p>
                    <p className="text-sm text-zinc-500">Purpose: {q.purpose}</p>
                    {q.follow_up && (
                      <p className="text-sm text-indigo-300 mt-1">Follow-up: {q.follow_up}</p>
                    )}
                  </motion.div>
                </StaggerItem>
              ))}
            </Stagger>
          </Card>
        </FadeInUp>
      </main>
    </div>
  );
}
