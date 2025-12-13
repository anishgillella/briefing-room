"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
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
            <div className="min-h-screen bg-gradient-to-br from-violet-950 via-slate-900 to-slate-950 flex items-center justify-center">
                <div className="text-center">
                    <Loader2 className="w-12 h-12 text-purple-400 animate-spin mx-auto mb-4" />
                    <p className="text-white/60">Generating pre-interview briefing...</p>
                    <p className="text-white/40 text-sm mt-2">This may take up to 30 seconds</p>
                </div>
            </div>
        );
    }

    if (error || !prebrief) {
        return (
            <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center text-white">
                <div className="text-center">
                    <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
                    <h1 className="text-xl font-bold mb-2">Failed to Load Pre-Brief</h1>
                    <p className="text-white/60 mb-4">{error}</p>
                    <button
                        onClick={() => router.push(`/candidates/${candidateId}`)}
                        className="px-4 py-2 bg-purple-600 rounded-lg hover:bg-purple-700 transition"
                    >
                        Back to Candidate
                    </button>
                </div>
            </div>
        );
    }

    const getScoreColor = (score: number) => {
        if (score >= 80) return "text-green-400";
        if (score >= 60) return "text-yellow-400";
        return "text-red-400";
    };

    const getSeverityColor = (severity: string) => {
        switch (severity.toLowerCase()) {
            case "high": return "text-red-400 bg-red-500/10 border-red-500/20";
            case "medium": return "text-yellow-400 bg-yellow-500/10 border-yellow-500/20";
            default: return "text-blue-400 bg-blue-500/10 border-blue-500/20";
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-violet-950 via-slate-900 to-slate-950 text-white">
            {/* Header */}
            <header className="border-b border-white/10 bg-black/30 backdrop-blur sticky top-0 z-50">
                <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
                    <button
                        onClick={() => router.push(`/candidates/${candidateId}`)}
                        className="flex items-center gap-2 text-white/60 hover:text-white transition"
                    >
                        <ArrowLeft className="w-5 h-5" />
                        Back to Candidate
                    </button>
                    <button
                        onClick={handleStartInterview}
                        disabled={startingInterview}
                        className="px-6 py-2 bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg hover:from-purple-700 hover:to-pink-700 transition flex items-center gap-2 font-semibold disabled:opacity-50"
                    >
                        {startingInterview ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <PlayCircle className="w-5 h-5" />
                        )}
                        Start Interview
                    </button>
                </div>
            </header>

            {/* Content */}
            <main className="max-w-6xl mx-auto px-6 py-8">
                {/* Hero */}
                <div className="mb-8 text-center">
                    <div className="inline-flex items-center gap-2 px-4 py-1 bg-purple-500/20 border border-purple-500/30 rounded-full text-purple-300 text-sm mb-4">
                        <Target className="w-4 h-4" />
                        Pre-Interview Briefing
                    </div>
                    <h1 className="text-4xl font-bold mb-2">{prebrief.candidate_name}</h1>
                    <p className="text-white/60">{prebrief.current_role} • {prebrief.years_experience} years experience</p>
                </div>

                {/* Fit Score + TLDR */}
                <div className="grid grid-cols-3 gap-6 mb-8">
                    <div className="col-span-1 bg-white/5 border border-white/10 rounded-xl p-6 text-center">
                        <div className="text-sm text-white/40 mb-2">Overall Fit</div>
                        <div className={`text-5xl font-bold ${getScoreColor(prebrief.overall_fit_score)}`}>
                            {prebrief.overall_fit_score}
                        </div>
                        <div className="text-white/40 text-sm mt-1">/ 100</div>
                    </div>
                    <div className="col-span-2 bg-white/5 border border-white/10 rounded-xl p-6">
                        <div className="text-sm text-white/40 mb-2">TL;DR</div>
                        <p className="text-lg text-white/90 leading-relaxed">{prebrief.tldr}</p>
                    </div>
                </div>

                {/* Score Breakdown */}
                <div className="bg-white/5 border border-white/10 rounded-xl p-6 mb-8">
                    <h2 className="text-lg font-semibold mb-4">Score Breakdown</h2>
                    <div className="grid grid-cols-3 gap-4">
                        {Object.entries(prebrief.score_breakdown).map(([key, value]) => (
                            <div key={key} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                                <span className="text-white/60 capitalize">{key.replace(/_/g, " ")}</span>
                                <span className={`font-bold ${getScoreColor(value)}`}>{value}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Key Things to Remember */}
                <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-6 mb-8">
                    <h2 className="text-purple-400 font-semibold mb-4 flex items-center gap-2">
                        <Star className="w-5 h-5" />
                        Key Things to Remember
                    </h2>
                    <ul className="space-y-2">
                        {prebrief.key_things_to_remember.map((item, i) => (
                            <li key={i} className="flex items-start gap-3 text-white/80">
                                <span className="text-purple-400">•</span>
                                {item}
                            </li>
                        ))}
                    </ul>
                </div>

                {/* Two Column: Strengths & Concerns */}
                <div className="grid grid-cols-2 gap-6 mb-8">
                    {/* Strengths */}
                    <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-6">
                        <h2 className="text-green-400 font-semibold mb-4 flex items-center gap-2">
                            <TrendingUp className="w-5 h-5" />
                            Strengths ({prebrief.strengths.length})
                        </h2>
                        <div className="space-y-4">
                            {prebrief.strengths.map((s, i) => (
                                <div key={i} className="p-3 bg-white/5 rounded-lg">
                                    <div className="font-medium text-white/90 mb-1">{s.strength}</div>
                                    <div className="text-sm text-white/50 mb-2">{s.evidence}</div>
                                    <div className="text-sm text-green-400">Verify: {s.how_to_verify}</div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Concerns */}
                    <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-6">
                        <h2 className="text-yellow-400 font-semibold mb-4 flex items-center gap-2">
                            <TrendingDown className="w-5 h-5" />
                            Concerns ({prebrief.concerns.length})
                        </h2>
                        <div className="space-y-4">
                            {prebrief.concerns.map((c, i) => (
                                <div key={i} className={`p-3 rounded-lg border ${getSeverityColor(c.severity)}`}>
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="font-medium">{c.concern}</span>
                                        <span className="text-xs uppercase">{c.severity}</span>
                                    </div>
                                    <div className="text-sm text-white/50 mb-2">{c.evidence}</div>
                                    <div className="text-sm text-yellow-300">Ask: "{c.suggested_question}"</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Skill Matches */}
                <div className="bg-white/5 border border-white/10 rounded-xl p-6 mb-8">
                    <h2 className="font-semibold mb-4">Skill Matches</h2>
                    <div className="grid grid-cols-2 gap-3">
                        {prebrief.skill_matches.map((skill, i) => (
                            <div
                                key={i}
                                className={`p-3 rounded-lg border flex items-center justify-between ${skill.is_match
                                        ? "bg-green-500/10 border-green-500/20"
                                        : "bg-red-500/10 border-red-500/20"
                                    }`}
                            >
                                <div>
                                    <span className="font-medium">{skill.skill}</span>
                                    <span className="text-white/40 text-sm ml-2">
                                        (needed: {skill.required_level})
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-sm capitalize">{skill.candidate_level}</span>
                                    {skill.is_match ? (
                                        <CheckCircle className="w-4 h-4 text-green-400" />
                                    ) : (
                                        <AlertTriangle className="w-4 h-4 text-red-400" />
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Suggested Questions */}
                <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                    <h2 className="font-semibold mb-4 flex items-center gap-2">
                        <HelpCircle className="w-5 h-5 text-purple-400" />
                        Suggested Interview Questions
                    </h2>
                    <div className="space-y-4">
                        {prebrief.suggested_questions.map((q, i) => (
                            <div key={i} className="p-4 bg-white/5 rounded-lg">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="text-purple-400 font-semibold">{i + 1}.</span>
                                    <span className="px-2 py-0.5 bg-purple-500/20 text-purple-300 text-xs rounded capitalize">
                                        {q.category}
                                    </span>
                                </div>
                                <p className="text-white/90 mb-2">"{q.question}"</p>
                                <p className="text-sm text-white/50">Purpose: {q.purpose}</p>
                                {q.follow_up && (
                                    <p className="text-sm text-purple-300 mt-1">Follow-up: {q.follow_up}</p>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </main>
        </div>
    );
}
