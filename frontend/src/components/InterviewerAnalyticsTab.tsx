"use client";

import { useState, useEffect } from "react";
import {
    Loader2,
    MessageSquare,
    Target,
    Users,
    AlertTriangle,
    Lightbulb,
    TrendingUp,
    CheckCircle,
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface InterviewerAnalytics {
    question_quality_score: number;
    topic_coverage_score: number;
    consistency_score: number;
    bias_score: number;
    candidate_experience_score: number;
    overall_score: number;
    question_quality_breakdown: {
        relevance: number;
        depth: number;
        follow_up_quality: number;
    };
    topics_covered: {
        technical: number;
        behavioral: number;
        culture_fit: number;
        problem_solving: number;
    };
    bias_indicators: {
        flags: string[];
        severity: string;
        sentiment_balance: number;
    };
    improvement_suggestions: string[];
}

interface Props {
    interviewId?: string;
    analyticsData?: InterviewerAnalytics | null;
}

export default function InterviewerAnalyticsTab({ interviewId, analyticsData }: Props) {
    const [analytics, setAnalytics] = useState<InterviewerAnalytics | null>(analyticsData || null);
    const [loading, setLoading] = useState(!analyticsData);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        // If analyticsData is provided via props, use it directly
        if (analyticsData) {
            setAnalytics(analyticsData);
            setLoading(false);
            setError(null);
            return;
        }

        // Otherwise, fetch from API if we have an interview ID
        if (interviewId) {
            fetchAnalytics();
        } else {
            setLoading(false);
            setError("No interview ID or analytics data provided");
        }
    }, [interviewId, analyticsData]);

    const fetchAnalytics = async () => {
        if (!interviewId) return;

        try {
            setLoading(true);
            const res = await fetch(`${API_URL}/api/interviewers/interviews/${interviewId}/analytics`);
            if (!res.ok) {
                if (res.status === 404) {
                    setError("Interviewer analytics not yet available");
                    return;
                }
                throw new Error("Failed to fetch analytics");
            }
            const data = await res.json();
            setAnalytics(data.analytics);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Unknown error");
        } finally {
            setLoading(false);
        }
    };

    const getScoreColor = (score: number, inverted: boolean = false) => {
        if (inverted) {
            if (score <= 20) return "text-green-400";
            if (score <= 50) return "text-yellow-400";
            return "text-red-400";
        }
        if (score >= 80) return "text-green-400";
        if (score >= 60) return "text-yellow-400";
        return "text-red-400";
    };

    const getScoreBg = (score: number, inverted: boolean = false) => {
        if (inverted) {
            if (score <= 20) return "bg-green-500/10 border-green-500/20";
            if (score <= 50) return "bg-yellow-500/10 border-yellow-500/20";
            return "bg-red-500/10 border-red-500/20";
        }
        if (score >= 80) return "bg-green-500/10 border-green-500/20";
        if (score >= 60) return "bg-yellow-500/10 border-yellow-500/20";
        return "bg-red-500/10 border-red-500/20";
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[300px]">
                <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
            </div>
        );
    }

    if (error || !analytics) {
        return (
            <div className="glass-panel rounded-2xl p-8 text-center">
                <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-yellow-400" />
                <p className="text-white/60">{error || "No analytics available"}</p>
                <p className="text-white/40 text-sm mt-2">
                    Interviewer analytics are generated after the interview is analyzed.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-fadeIn">
            {/* Overall Score Card */}
            <div className="glass-panel rounded-3xl p-8">
                <h3 className="text-gray-400 text-sm font-medium tracking-wider uppercase mb-4">
                    Interviewer Performance
                </h3>
                <div className="flex items-center gap-8">
                    <div className="flex items-center gap-4">
                        <div className={`text-6xl font-bold ${getScoreColor(analytics.overall_score)}`}>
                            {analytics.overall_score}
                        </div>
                        <div className="text-gray-400">/ 100 Overall Score</div>
                    </div>
                </div>
            </div>

            {/* Score Cards Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {[
                    { label: "Question Quality", score: analytics.question_quality_score, icon: MessageSquare },
                    { label: "Topic Coverage", score: analytics.topic_coverage_score, icon: Target },
                    { label: "Consistency", score: analytics.consistency_score, icon: CheckCircle },
                    { label: "Bias Score", score: analytics.bias_score, icon: AlertTriangle, inverted: true },
                    { label: "Candidate Experience", score: analytics.candidate_experience_score, icon: Users },
                ].map((item) => (
                    <div
                        key={item.label}
                        className={`glass-panel p-5 rounded-2xl border ${getScoreBg(item.score, item.inverted)}`}
                    >
                        <item.icon className={`w-5 h-5 mb-3 ${getScoreColor(item.score, item.inverted)}`} />
                        <div className={`text-3xl font-light mb-1 ${getScoreColor(item.score, item.inverted)}`}>
                            {item.score}
                        </div>
                        <div className="text-[10px] uppercase tracking-widest text-white/40">{item.label}</div>
                    </div>
                ))}
            </div>

            {/* Topic Coverage Breakdown */}
            <div className="glass-panel rounded-3xl p-8">
                <h3 className="text-gray-400 text-sm font-medium tracking-wider uppercase mb-6 flex items-center gap-2">
                    <Target className="w-4 h-4" /> Topic Coverage
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    {Object.entries(analytics.topics_covered).map(([topic, score]) => (
                        <div key={topic} className="text-center">
                            <div className="relative w-20 h-20 mx-auto mb-3">
                                <svg className="w-full h-full -rotate-90">
                                    <circle
                                        cx="40"
                                        cy="40"
                                        r="36"
                                        fill="none"
                                        stroke="rgba(255,255,255,0.1)"
                                        strokeWidth="6"
                                    />
                                    <circle
                                        cx="40"
                                        cy="40"
                                        r="36"
                                        fill="none"
                                        stroke={score >= 70 ? "#22c55e" : score >= 40 ? "#eab308" : "#ef4444"}
                                        strokeWidth="6"
                                        strokeDasharray={`${(score / 100) * 226} 226`}
                                        strokeLinecap="round"
                                    />
                                </svg>
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <span className="text-lg font-semibold text-white">{score}</span>
                                </div>
                            </div>
                            <div className="text-xs text-white/60 capitalize">{topic.replace("_", " ")}</div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Bias Indicators */}
            {analytics.bias_indicators.flags.length > 0 && (
                <div className="glass-panel rounded-3xl p-8 bg-yellow-500/5 border-yellow-500/10">
                    <h3 className="text-yellow-400 text-sm font-medium tracking-wider uppercase mb-4 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4" /> Bias Indicators
                    </h3>
                    <div className="flex items-center gap-4 mb-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${analytics.bias_indicators.severity === "high" ? "bg-red-500/20 text-red-300" :
                            analytics.bias_indicators.severity === "medium" ? "bg-yellow-500/20 text-yellow-300" :
                                "bg-green-500/20 text-green-300"
                            }`}>
                            {analytics.bias_indicators.severity.toUpperCase()} severity
                        </span>
                    </div>
                    <ul className="space-y-2">
                        {analytics.bias_indicators.flags.map((flag, i) => (
                            <li key={i} className="text-white/70 text-sm flex items-start gap-2">
                                <span className="text-yellow-400">•</span>
                                {flag}
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Improvement Suggestions */}
            <div className="glass-panel rounded-3xl p-8">
                <h3 className="text-gray-400 text-sm font-medium tracking-wider uppercase mb-6 flex items-center gap-2">
                    <Lightbulb className="w-4 h-4" /> Improvement Suggestions
                </h3>
                <div className="space-y-3">
                    {analytics.improvement_suggestions.map((suggestion, i) => (
                        <div
                            key={i}
                            className="flex items-start gap-3 p-4 rounded-xl bg-white/5 border border-white/10"
                        >
                            <TrendingUp className="w-4 h-4 text-purple-400 mt-0.5 flex-shrink-0" />
                            <p className="text-white/80 text-sm">{suggestion}</p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
