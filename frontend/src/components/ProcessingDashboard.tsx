"use client";

import { useEffect, useState, useMemo } from "react";
import { Loader2, CheckCircle2, Sparkles, User, TrendingUp, Zap } from "lucide-react";

interface AlgoPreview {
    id: string;
    name: string;
    job_title: string;
    bio_summary: string;
    algo_score: number;
    sold_to_finance: boolean;
    is_founder: boolean;
    startup_experience: boolean;
    enterprise_experience?: boolean;
    years_experience?: number;
}

interface Candidate {
    id: string;
    name: string;
    job_title: string;
    tier: string;
    algo_score: number;
    ai_score: number;
    final_score: number;
    one_line_summary: string;
}

interface Status {
    status: "processing" | "waiting_confirmation" | "complete" | "error";
    phase: "extracting" | "scoring" | "completed";
    candidates_total: number;
    candidates_extracted: number;
    candidates_scored: number;
    message: string;
    error: string | null;
    algo_ranked: AlgoPreview[];
    scored_candidates: Candidate[];
}

interface ProcessingDashboardProps {
    status: Status;
    onStartScoring: () => void;
}

// Phase definitions
const PHASES = [
    { id: "extracting", label: "Extracting", icon: Loader2 },
    { id: "scoring", label: "AI Scoring", icon: Sparkles },
    { id: "completed", label: "Complete", icon: CheckCircle2 },
];

// Tier config
const TIER_CONFIG = [
    { key: "Top", label: "Tier A", color: "from-amber-500 to-yellow-400", bgColor: "bg-amber-500/10", borderColor: "border-amber-500/30", textColor: "text-amber-400" },
    { key: "Strong", label: "Tier B", color: "from-green-500 to-emerald-400", bgColor: "bg-green-500/10", borderColor: "border-green-500/30", textColor: "text-green-400" },
    { key: "Consider", label: "Tier C", color: "from-blue-500 to-cyan-400", bgColor: "bg-blue-500/10", borderColor: "border-blue-500/30", textColor: "text-blue-400" },
    { key: "Not", label: "Tier D", color: "from-gray-500 to-gray-400", bgColor: "bg-gray-500/10", borderColor: "border-gray-500/30", textColor: "text-gray-400" },
];

export default function ProcessingDashboard({ status, onStartScoring }: ProcessingDashboardProps) {
    const [animatedCounts, setAnimatedCounts] = useState<Record<string, number>>({});

    // Calculate tier counts from scored candidates
    const tierCounts = useMemo(() => {
        const counts: Record<string, number> = { Top: 0, Strong: 0, Consider: 0, Not: 0 };
        status.scored_candidates?.forEach(c => {
            if (c.tier?.includes("Top")) counts.Top++;
            else if (c.tier?.includes("Strong")) counts.Strong++;
            else if (c.tier?.includes("Consider")) counts.Consider++;
            else counts.Not++;
        });
        return counts;
    }, [status.scored_candidates]);

    // Animate tier counters
    useEffect(() => {
        const timer = setTimeout(() => {
            setAnimatedCounts(tierCounts);
        }, 100);
        return () => clearTimeout(timer);
    }, [tierCounts]);

    // Get current phase index
    const currentPhaseIndex = PHASES.findIndex(p => p.id === status.phase);

    // Calculate progress percentage
    const progress = useMemo(() => {
        if (status.phase === "extracting") {
            return status.candidates_total > 0
                ? Math.round((status.candidates_extracted / status.candidates_total) * 100)
                : 0;
        }
        if (status.phase === "scoring") {
            return status.candidates_total > 0
                ? Math.round((status.candidates_scored / status.candidates_total) * 100)
                : 0;
        }
        return 100;
    }, [status]);

    // Get latest scored candidates (last 3)
    const latestScored = useMemo(() => {
        return (status.scored_candidates || []).slice(-3).reverse();
    }, [status.scored_candidates]);

    // Status message
    const statusMessage = useMemo(() => {
        if (status.phase === "extracting") {
            return `Extracting ${status.candidates_extracted} of ${status.candidates_total} profiles...`;
        }
        if (status.phase === "scoring") {
            if (status.status === "waiting_confirmation") {
                return "Extraction complete. Ready to score.";
            }
            return `AI scoring ${status.candidates_scored} of ${status.candidates_total}...`;
        }
        return "Processing complete!";
    }, [status]);

    return (
        <div className="w-full max-w-4xl mx-auto space-y-8 animate-fade-in">
            {/* Phase Indicator */}
            <div className="flex items-center justify-center gap-4">
                {PHASES.map((phase, idx) => {
                    const isActive = idx === currentPhaseIndex;
                    const isComplete = idx < currentPhaseIndex;
                    const Icon = phase.icon;

                    return (
                        <div key={phase.id} className="flex items-center gap-4">
                            {idx > 0 && (
                                <div className={`w-16 h-0.5 ${isComplete ? "bg-green-500" : "bg-white/10"} transition-colors duration-500`} />
                            )}
                            <div className={`flex flex-col items-center gap-2 transition-all duration-300 ${isActive ? "scale-110" : ""}`}>
                                <div className={`
                  w-12 h-12 rounded-full flex items-center justify-center border-2 transition-all duration-500
                  ${isComplete ? "bg-green-500/20 border-green-500 text-green-400" :
                                        isActive ? "bg-indigo-500/20 border-indigo-400 text-indigo-400" :
                                            "bg-white/5 border-white/10 text-white/30"}
                `}>
                                    <Icon className={`w-5 h-5 ${isActive && !isComplete ? "animate-spin" : ""}`} />
                                </div>
                                <span className={`text-xs font-medium uppercase tracking-wider ${isActive ? "text-white" : "text-white/40"}`}>
                                    {phase.label}
                                </span>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Main Progress Area */}
            <div className="glass-panel rounded-3xl p-10 text-center relative overflow-hidden">
                {/* Animated Background Glow */}
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 via-transparent to-purple-500/5 animate-pulse" />

                {/* Large Icon */}
                <div className="relative z-10">
                    <div className={`
            w-24 h-24 mx-auto mb-6 rounded-full flex items-center justify-center
            bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30
            ${status.status === "processing" ? "animate-pulse" : ""}
          `}>
                        {status.phase === "extracting" && <Zap className="w-10 h-10 text-indigo-400" />}
                        {status.phase === "scoring" && status.status !== "waiting_confirmation" && <Sparkles className="w-10 h-10 text-purple-400" />}
                        {status.phase === "scoring" && status.status === "waiting_confirmation" && <TrendingUp className="w-10 h-10 text-green-400" />}
                        {status.phase === "completed" && <CheckCircle2 className="w-10 h-10 text-green-400" />}
                    </div>

                    {/* Status Text */}
                    <h2 className="text-2xl font-light text-white mb-2 tracking-tight">
                        {statusMessage}
                    </h2>

                    {/* Progress Bar */}
                    {status.status !== "waiting_confirmation" && status.phase !== "completed" && (
                        <div className="max-w-md mx-auto mt-6">
                            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-500 ease-out"
                                    style={{ width: `${progress}%` }}
                                />
                            </div>
                            <div className="flex justify-between mt-2 text-xs text-white/40 font-mono">
                                <span>{progress}%</span>
                                <span>
                                    {status.phase === "scoring"
                                        ? `${status.candidates_scored}/${status.candidates_total} scored`
                                        : `${status.candidates_extracted}/${status.candidates_total} extracted`
                                    }
                                </span>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Tier Counters - Only show during/after scoring */}
            {(status.phase === "scoring" || status.phase === "completed") && status.scored_candidates?.length > 0 && (
                <div className="grid grid-cols-4 gap-4">
                    {TIER_CONFIG.map(tier => {
                        const count = animatedCounts[tier.key] || 0;
                        return (
                            <div
                                key={tier.key}
                                className={`glass-panel p-5 rounded-2xl border ${tier.borderColor} ${tier.bgColor} transition-all duration-300 hover:scale-105`}
                            >
                                <div className={`text-3xl font-bold ${tier.textColor} mb-1 transition-all duration-500`}>
                                    {count}
                                </div>
                                <div className="text-xs text-white/50 uppercase tracking-wider font-medium">
                                    {tier.label}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Latest Scored Preview - Show during scoring */}
            {status.phase === "scoring" && latestScored.length > 0 && status.status !== "waiting_confirmation" && (
                <div className="space-y-3">
                    <h3 className="text-xs font-medium text-white/40 uppercase tracking-wider px-1">
                        Latest Scored
                    </h3>
                    <div className="space-y-2">
                        {latestScored.map((candidate, idx) => (
                            <div
                                key={candidate.id}
                                className={`
                  glass-panel p-4 rounded-xl flex items-center gap-4 
                  animate-slide-in-right border border-white/5
                  ${idx === 0 ? "bg-white/5" : ""}
                `}
                                style={{ animationDelay: `${idx * 100}ms` }}
                            >
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500/30 to-purple-500/30 flex items-center justify-center">
                                    <User className="w-5 h-5 text-white/60" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className="font-medium text-white truncate">{candidate.name}</span>
                                        <span className={`text-xs px-2 py-0.5 rounded-full ${candidate.tier?.includes("Top") ? "bg-amber-500/20 text-amber-300" :
                                            candidate.tier?.includes("Strong") ? "bg-green-500/20 text-green-300" :
                                                "bg-white/10 text-white/50"
                                            }`}>
                                            {candidate.tier}
                                        </span>
                                    </div>
                                    <p className="text-sm text-white/50 truncate">{candidate.one_line_summary || candidate.job_title}</p>
                                </div>
                                <div className="text-right">
                                    <div className="text-xl font-light text-white">{candidate.final_score}</div>
                                    <div className="text-xs text-white/40">score</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Waiting Confirmation CTA */}
            {status.status === "waiting_confirmation" && (
                <div className="text-center space-y-6 animate-fade-in">
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 text-sm">
                        <CheckCircle2 className="w-4 h-4" />
                        {status.candidates_extracted} profiles extracted
                    </div>
                    <div>
                        <button
                            onClick={onStartScoring}
                            className="px-8 py-4 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-semibold text-lg hover:scale-105 active:scale-95 transition-all shadow-[0_0_40px_rgba(99,102,241,0.3)]"
                        >
                            Start AI Scoring →
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
