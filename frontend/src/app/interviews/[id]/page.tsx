"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import Link from "next/link";
import {
    ArrowLeft,
    MessageSquare,
    Target,
    TrendingUp,
    Shield,
    Users,
    CheckCircle,
    AlertTriangle,
    Lightbulb,
    Calendar,
    Loader2,
    Award,
} from "lucide-react";
import { tokens } from "@/lib/design-tokens";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface InterviewAnalytics {
    id: string;
    interview_id: string;
    interviewer_id: string;
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
    created_at: string;
}

// =============================================================================
// COMPONENTS
// =============================================================================

function ScoreCard({ icon, value, label, inverted = false }: { icon: React.ReactNode; value: number; label: string; inverted?: boolean }) {
    const getColor = (score: number, inv: boolean) => {
        if (inv) {
            if (score <= 20) return tokens.statusSuccess;
            if (score <= 50) return tokens.statusWarning;
            return tokens.statusDanger;
        }
        if (score >= 80) return tokens.statusSuccess;
        if (score >= 60) return tokens.statusWarning;
        return tokens.statusDanger;
    };

    const color = getColor(value, inverted);

    return (
        <div className="p-5 rounded-2xl border" style={{ backgroundColor: tokens.bgCard, borderColor: `${color}30` }}>
            <div className="flex items-center gap-2 mb-3">
                <div style={{ color: tokens.textMuted }}>{icon}</div>
                <span className="text-xs uppercase tracking-wider" style={{ color: tokens.textMuted }}>{label}</span>
            </div>
            <div className="text-4xl font-light" style={{ color }}>{value}</div>
        </div>
    );
}

function SectionCard({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
    return (
        <div className="rounded-2xl border" style={{ backgroundColor: tokens.bgCard, borderColor: tokens.borderSubtle }}>
            <div className="px-5 py-4 border-b" style={{ borderColor: tokens.borderSubtle }}>
                <h3 className="text-lg font-medium text-white flex items-center gap-2">
                    <span style={{ color: tokens.brandPrimary }}>{icon}</span>
                    {title}
                </h3>
            </div>
            <div className="p-5">{children}</div>
        </div>
    );
}

function CircularProgress({ value, label, color }: { value: number; label: string; color: string }) {
    const percentage = Math.min(100, Math.max(0, value));
    const strokeDasharray = (percentage / 100) * 201;

    return (
        <div className="text-center">
            <div className="relative w-20 h-20 mx-auto mb-2">
                <svg className="w-20 h-20 transform -rotate-90">
                    <circle cx="40" cy="40" r="32" strokeWidth="6" fill="none" style={{ stroke: tokens.bgSurface }} />
                    <circle cx="40" cy="40" r="32" strokeWidth="6" fill="none" strokeLinecap="round"
                        style={{ stroke: color, strokeDasharray: `${strokeDasharray} 251.2`, transition: "stroke-dasharray 1s" }} />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-lg font-light text-white">{value}</span>
                </div>
            </div>
            <div className="text-xs capitalize" style={{ color: tokens.textMuted }}>{label}</div>
        </div>
    );
}

// =============================================================================
// MAIN PAGE
// =============================================================================

export default function InterviewDetailPage() {
    const params = useParams();
    const router = useRouter();
    const interviewId = params.id as string;

    const [analytics, setAnalytics] = useState<InterviewAnalytics | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (interviewId) {
            loadAnalytics();
        }
    }, [interviewId]);

    const loadAnalytics = async () => {
        try {
            setLoading(true);
            const response = await fetch(`${API_BASE}/api/interviewers/interviews/${interviewId}/analytics`);
            if (!response.ok) {
                throw new Error("Analytics not found for this interview");
            }
            const data = await response.json();
            setAnalytics(data.analytics);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load analytics");
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh]">
                <Loader2 className="w-8 h-8 animate-spin" style={{ color: tokens.brandPrimary }} />
                <p className="mt-4 text-sm" style={{ color: tokens.textMuted }}>Loading interview analytics...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="max-w-2xl mx-auto py-12 text-center">
                <div className="rounded-2xl border p-8" style={{ backgroundColor: tokens.statusDangerBg, borderColor: `${tokens.statusDanger}30` }}>
                    <AlertTriangle className="w-12 h-12 mx-auto mb-4" style={{ color: tokens.statusDanger }} />
                    <h2 className="text-xl font-medium text-white mb-2">Analytics Not Found</h2>
                    <p className="text-sm mb-6" style={{ color: tokens.textMuted }}>{error}</p>
                    <button
                        onClick={() => router.back()}
                        className="px-4 py-2 rounded-lg text-white"
                        style={{ backgroundColor: tokens.brandPrimary }}
                    >
                        Go Back
                    </button>
                </div>
            </div>
        );
    }

    if (!analytics) return null;

    const formattedDate = new Date(analytics.created_at).toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
    });

    const overallColor = analytics.overall_score >= 80 ? tokens.statusSuccess : analytics.overall_score >= 60 ? tokens.statusWarning : tokens.statusDanger;

    return (
        <div className="max-w-5xl mx-auto space-y-6 pb-12">
            {/* Ambient Background */}
            <div className="fixed inset-0 pointer-events-none -z-10" style={{ background: `radial-gradient(ellipse 80% 50% at 50% -20%, ${tokens.brandPrimary}15, transparent), ${tokens.bgApp}` }} />

            {/* Back Button */}
            <button
                onClick={() => router.back()}
                className="flex items-center gap-2 text-sm transition-colors hover:underline"
                style={{ color: tokens.textMuted }}
            >
                <ArrowLeft className="w-4 h-4" />
                Back to Dashboard
            </button>

            {/* Header */}
            <div className="flex items-start justify-between">
                <div>
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium mb-3"
                        style={{ backgroundColor: `${tokens.brandPrimary}15`, border: `1px solid ${tokens.brandPrimary}30`, color: tokens.brandPrimary }}>
                        <Calendar className="w-3.5 h-3.5" />
                        Interview Analysis
                    </div>
                    <h1 className="text-3xl font-light tracking-tight text-white mb-2">Interview Details</h1>
                    <p style={{ color: tokens.textMuted }}>{formattedDate}</p>
                </div>
                <div className="text-right">
                    <div className="text-sm mb-1" style={{ color: tokens.textMuted }}>Overall Score</div>
                    <div className="text-5xl font-light" style={{ color: overallColor }}>{analytics.overall_score}</div>
                </div>
            </div>

            {/* Score Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <ScoreCard icon={<MessageSquare className="w-5 h-5" />} value={analytics.question_quality_score} label="Question Quality" />
                <ScoreCard icon={<Target className="w-5 h-5" />} value={analytics.topic_coverage_score} label="Topic Coverage" />
                <ScoreCard icon={<TrendingUp className="w-5 h-5" />} value={analytics.consistency_score} label="Consistency" />
                <ScoreCard icon={<Shield className="w-5 h-5" />} value={analytics.bias_score} label="Bias Score" inverted />
                <ScoreCard icon={<Users className="w-5 h-5" />} value={analytics.candidate_experience_score} label="Candidate Exp" />
            </div>

            {/* Question Quality Breakdown */}
            {analytics.question_quality_breakdown && (
                <SectionCard title="Question Quality Breakdown" icon={<MessageSquare className="w-5 h-5" />}>
                    <div className="grid grid-cols-3 gap-6">
                        <CircularProgress value={analytics.question_quality_breakdown.relevance} label="Relevance" color={tokens.brandPrimary} />
                        <CircularProgress value={analytics.question_quality_breakdown.depth} label="Depth" color="#22D3EE" />
                        <CircularProgress value={analytics.question_quality_breakdown.follow_up_quality} label="Follow-up Quality" color={tokens.statusSuccess} />
                    </div>
                </SectionCard>
            )}

            {/* Topics Covered */}
            {analytics.topics_covered && (
                <SectionCard title="Topics Covered" icon={<Target className="w-5 h-5" />}>
                    <div className="grid grid-cols-4 gap-6">
                        <CircularProgress value={analytics.topics_covered.technical} label="Technical" color={tokens.brandPrimary} />
                        <CircularProgress value={analytics.topics_covered.behavioral} label="Behavioral" color="#22D3EE" />
                        <CircularProgress value={analytics.topics_covered.culture_fit} label="Culture Fit" color={tokens.statusSuccess} />
                        <CircularProgress value={analytics.topics_covered.problem_solving} label="Problem Solving" color={tokens.statusWarning} />
                    </div>
                </SectionCard>
            )}

            {/* Bias Indicators */}
            {analytics.bias_indicators && (
                <SectionCard title="Bias Analysis" icon={<Shield className="w-5 h-5" />}>
                    <div className="space-y-4">
                        <div className="flex items-center gap-4">
                            <div className="text-sm" style={{ color: tokens.textMuted }}>Severity:</div>
                            <div
                                className="px-3 py-1 rounded-full text-sm font-medium capitalize"
                                style={{
                                    backgroundColor: analytics.bias_indicators.severity === "low" ? `${tokens.statusSuccess}20` : `${tokens.statusWarning}20`,
                                    color: analytics.bias_indicators.severity === "low" ? tokens.statusSuccess : tokens.statusWarning,
                                }}
                            >
                                {analytics.bias_indicators.severity}
                            </div>
                        </div>

                        {analytics.bias_indicators.flags && analytics.bias_indicators.flags.length > 0 ? (
                            <div>
                                <div className="text-sm mb-2" style={{ color: tokens.textMuted }}>Flags detected:</div>
                                <div className="flex flex-wrap gap-2">
                                    {analytics.bias_indicators.flags.map((flag, i) => (
                                        <div key={i} className="px-3 py-1 rounded-lg text-sm" style={{ backgroundColor: `${tokens.statusWarning}20`, color: tokens.statusWarning }}>
                                            {flag}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 text-sm" style={{ color: tokens.statusSuccess }}>
                                <CheckCircle className="w-4 h-4" />
                                No significant bias indicators detected
                            </div>
                        )}
                    </div>
                </SectionCard>
            )}

            {/* Improvement Suggestions */}
            {analytics.improvement_suggestions && analytics.improvement_suggestions.length > 0 && (
                <SectionCard title="Improvement Suggestions" icon={<Lightbulb className="w-5 h-5" />}>
                    <div className="space-y-3">
                        {analytics.improvement_suggestions.map((suggestion, i) => (
                            <div key={i} className="flex items-start gap-3 p-4 rounded-xl" style={{ backgroundColor: tokens.bgSurface }}>
                                <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ backgroundColor: tokens.brandPrimary, color: "white" }}>
                                    {i + 1}
                                </div>
                                <p className="text-sm" style={{ color: tokens.textSecondary }}>{suggestion}</p>
                            </div>
                        ))}
                    </div>
                </SectionCard>
            )}
        </div>
    );
}
