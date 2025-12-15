"use client";

import { useState, useEffect } from "react";
import {
    Loader2,
    TrendingUp,
    TrendingDown,
    AlertTriangle,
    CheckCircle,
    MessageSquare,
    Target,
    Users,
    Shield,
    Lightbulb
} from "lucide-react";
import { getInterviewerAnalytics, getSelectedInterviewerId, InterviewerAnalyticsResponse } from "@/lib/interviewerApi";
import InterviewerSelector from "./InterviewerSelector";

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
            // Lower is better (bias score)
            if (score <= 20) return 'text-green-400';
            if (score <= 50) return 'text-yellow-400';
            return 'text-red-400';
        }
        if (score >= 80) return 'text-green-400';
        if (score >= 60) return 'text-yellow-400';
        return 'text-red-400';
    };

    const getScoreBg = (score: number, inverted: boolean = false) => {
        if (inverted) {
            if (score <= 20) return 'bg-green-500/10 border-green-500/20';
            if (score <= 50) return 'bg-yellow-500/10 border-yellow-500/20';
            return 'bg-red-500/10 border-red-500/20';
        }
        if (score >= 80) return 'bg-green-500/10 border-green-500/20';
        if (score >= 60) return 'bg-yellow-500/10 border-yellow-500/20';
        return 'bg-red-500/10 border-red-500/20';
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-semibold text-white tracking-tight">Interviewer Analytics</h1>
                    <p className="text-white/40 mt-1">Performance insights and quality metrics</p>
                </div>
                <InterviewerSelector onInterviewerChange={handleInterviewerChange} />
            </div>

            {!interviewerId && (
                <div className="glass-card-premium p-12 text-center">
                    <Users className="w-16 h-16 text-white/20 mx-auto mb-4" />
                    <h2 className="text-xl text-white/60 mb-2">Select an Interviewer</h2>
                    <p className="text-white/40">Choose an interviewer from the dropdown above to view their analytics.</p>
                </div>
            )}

            {error && (
                <div className="glass-card-premium p-6 bg-red-500/10 border-red-500/20">
                    <p className="text-red-400">{error}</p>
                </div>
            )}

            {data && (
                <>
                    {/* Summary Stats */}
                    {data.aggregated.total_interviews === 0 ? (
                        <div className="glass-card-premium p-12 text-center">
                            <MessageSquare className="w-16 h-16 text-white/20 mx-auto mb-4" />
                            <h2 className="text-xl text-white/60 mb-2">No Analytics Yet</h2>
                            <p className="text-white/40">Complete interviews with this interviewer to see analytics.</p>
                        </div>
                    ) : (
                        <>
                            {/* Score Cards */}
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                                {[
                                    { key: 'avg_question_quality', label: 'Question Quality', icon: MessageSquare },
                                    { key: 'avg_topic_coverage', label: 'Topic Coverage', icon: Target },
                                    { key: 'avg_consistency', label: 'Consistency', icon: TrendingUp },
                                    { key: 'avg_bias_score', label: 'Bias Score', icon: Shield, inverted: true },
                                    { key: 'avg_candidate_experience', label: 'Candidate Exp', icon: Users }
                                ].map((metric) => {
                                    const value = data.aggregated[metric.key as keyof typeof data.aggregated] as number;
                                    const inverted = metric.inverted || false;
                                    return (
                                        <div
                                            key={metric.key}
                                            className={`glass-card-premium p-5 border ${getScoreBg(value, inverted)}`}
                                        >
                                            <div className="flex items-center gap-2 mb-3">
                                                <metric.icon className="w-4 h-4 text-white/40" />
                                                <span className="text-xs text-white/40 uppercase tracking-wider">{metric.label}</span>
                                            </div>
                                            <div className={`text-3xl font-light ${getScoreColor(value, inverted)}`}>
                                                {value.toFixed(0)}
                                                <span className="text-lg text-white/20">/100</span>
                                            </div>
                                            {inverted && value <= 20 && (
                                                <div className="mt-2 text-xs text-green-400 flex items-center gap-1">
                                                    <CheckCircle className="w-3 h-3" /> Low bias detected
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Topic Coverage Breakdown */}
                            <div className="glass-card-premium p-8">
                                <h2 className="text-sm font-bold uppercase tracking-widest text-white/40 mb-6">
                                    Topic Coverage Breakdown
                                </h2>
                                <div className="grid grid-cols-4 gap-6">
                                    {Object.entries(data.aggregated.topic_breakdown).map(([topic, score]) => (
                                        <div key={topic} className="text-center">
                                            <div className="relative w-24 h-24 mx-auto mb-3">
                                                <svg className="w-24 h-24 transform -rotate-90">
                                                    <circle
                                                        cx="48"
                                                        cy="48"
                                                        r="40"
                                                        strokeWidth="8"
                                                        fill="none"
                                                        className="stroke-white/10"
                                                    />
                                                    <circle
                                                        cx="48"
                                                        cy="48"
                                                        r="40"
                                                        strokeWidth="8"
                                                        fill="none"
                                                        strokeLinecap="round"
                                                        className={score >= 70 ? 'stroke-green-500' : score >= 50 ? 'stroke-yellow-500' : 'stroke-red-500'}
                                                        strokeDasharray={`${(score / 100) * 251.2} 251.2`}
                                                    />
                                                </svg>
                                                <div className="absolute inset-0 flex items-center justify-center">
                                                    <span className="text-xl font-light text-white">{score}</span>
                                                </div>
                                            </div>
                                            <div className="text-sm text-white/60 capitalize">{topic.replace('_', ' ')}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Recommendations / Suggestions */}
                            {data.aggregated.common_suggestions.length > 0 && (
                                <div className="glass-card-premium p-8 border-l-4 border-yellow-500/50">
                                    <h2 className="text-yellow-400 font-semibold mb-6 flex items-center gap-2 text-lg">
                                        <Lightbulb className="w-5 h-5" />
                                        Common Improvement Areas
                                    </h2>
                                    <div className="space-y-4">
                                        {data.aggregated.common_suggestions.map((suggestion, i) => (
                                            <div key={i} className="flex items-start gap-4 text-white/80">
                                                <div className="w-6 h-6 rounded-full bg-yellow-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                                                    <span className="text-yellow-400 text-xs font-bold">{i + 1}</span>
                                                </div>
                                                <p className="leading-relaxed">{suggestion}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Bias Flags */}
                            {data.aggregated.bias_flags.length > 0 && (
                                <div className="glass-card-premium p-8 border-l-4 border-red-500/50">
                                    <h2 className="text-red-400 font-semibold mb-6 flex items-center gap-2 text-lg">
                                        <AlertTriangle className="w-5 h-5" />
                                        Bias Indicators Detected
                                    </h2>
                                    <div className="space-y-2">
                                        {data.aggregated.bias_flags.map((flag, i) => (
                                            <div key={i} className="flex items-center gap-3 text-white/70">
                                                <div className="w-2 h-2 rounded-full bg-red-500" />
                                                <span>{flag}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* No issues state */}
                            {data.aggregated.common_suggestions.length === 0 && data.aggregated.bias_flags.length === 0 && (
                                <div className="glass-card-premium p-8 border-l-4 border-green-500/50">
                                    <h2 className="text-green-400 font-semibold mb-2 flex items-center gap-2 text-lg">
                                        <CheckCircle className="w-5 h-5" />
                                        Excellent Performance
                                    </h2>
                                    <p className="text-white/60">
                                        No significant improvement areas or bias indicators detected. Keep up the great work!
                                    </p>
                                </div>
                            )}

                            {/* Interview Count */}
                            <div className="text-center text-white/30 text-sm">
                                Based on {data.aggregated.total_interviews} analyzed interview{data.aggregated.total_interviews !== 1 ? 's' : ''}
                            </div>
                        </>
                    )}
                </>
            )}
        </div>
    );
}
