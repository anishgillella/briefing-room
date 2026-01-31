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
    Clock,
    Mic,
    HeartHandshake,
    AlertCircle,
    Zap,
    ChevronDown,
    ChevronUp,
    Star,
    XCircle,
} from "lucide-react";
import { tokens } from "@/lib/design-tokens";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// =============================================================================
// TYPES
// =============================================================================

interface QuestionEffectiveness {
    question: string;
    effectiveness_score: number;
    information_elicited: "high" | "medium" | "low" | "none";
    better_alternative: string | null;
}

interface MissedOpportunity {
    topic: string;
    candidate_statement: string;
    suggested_followup: string;
}

interface InterviewDynamics {
    time_management: number;
    active_listening_score: number;
    rapport_building: number;
    interruption_count: number;
    avg_response_wait_time: "rushed" | "appropriate" | "too_long";
}

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
        open_ended_ratio?: number;
        clarity?: number;
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
    // NEW: Granular analytics
    interview_dynamics?: InterviewDynamics;
    question_effectiveness?: QuestionEffectiveness[];
    missed_opportunities?: MissedOpportunity[];
    coverage_gaps?: string[];
    interviewer_strengths?: string[];
    detailed_assessment?: string;
    summary?: string;
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

function SectionCard({ title, icon, children, defaultOpen = true }: { title: string; icon: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean }) {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    return (
        <div className="rounded-2xl border" style={{ backgroundColor: tokens.bgCard, borderColor: tokens.borderSubtle }}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full px-5 py-4 border-b flex items-center justify-between transition-colors hover:bg-white/5"
                style={{ borderColor: tokens.borderSubtle }}
            >
                <h3 className="text-lg font-medium text-white flex items-center gap-2">
                    <span style={{ color: tokens.brandPrimary }}>{icon}</span>
                    {title}
                </h3>
                {isOpen ? <ChevronUp className="w-5 h-5" style={{ color: tokens.textMuted }} /> : <ChevronDown className="w-5 h-5" style={{ color: tokens.textMuted }} />}
            </button>
            {isOpen && <div className="p-5">{children}</div>}
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

function getEffectivenessColor(score: number): string {
    if (score >= 80) return tokens.statusSuccess;
    if (score >= 60) return tokens.statusWarning;
    return tokens.statusDanger;
}

function getInfoElicitedBadge(level: string): { bg: string; text: string; label: string } {
    switch (level) {
        case "high": return { bg: `${tokens.statusSuccess}20`, text: tokens.statusSuccess, label: "High Value" };
        case "medium": return { bg: `${tokens.statusWarning}20`, text: tokens.statusWarning, label: "Medium Value" };
        case "low": return { bg: `${tokens.statusDanger}20`, text: tokens.statusDanger, label: "Low Value" };
        default: return { bg: `${tokens.textMuted}20`, text: tokens.textMuted, label: "No Value" };
    }
}

function QuestionTimelineItem({ question, index }: { question: QuestionEffectiveness; index: number }) {
    const [expanded, setExpanded] = useState(false);
    const scoreColor = getEffectivenessColor(question.effectiveness_score);
    const infoBadge = getInfoElicitedBadge(question.information_elicited);

    return (
        <div className="relative pl-8 pb-6 border-l-2" style={{ borderColor: `${scoreColor}50` }}>
            {/* Timeline dot */}
            <div
                className="absolute left-[-9px] w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold"
                style={{ backgroundColor: scoreColor, color: "white" }}
            >
                {index + 1}
            </div>

            <div className="rounded-xl p-4" style={{ backgroundColor: tokens.bgSurface }}>
                {/* Question header */}
                <div className="flex items-start justify-between gap-4 mb-3">
                    <p className="text-sm text-white flex-1">"{question.question}"</p>
                    <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-2xl font-light" style={{ color: scoreColor }}>{question.effectiveness_score}</span>
                    </div>
                </div>

                {/* Tags */}
                <div className="flex flex-wrap gap-2">
                    <span className="px-2 py-1 rounded-full text-xs" style={{ backgroundColor: infoBadge.bg, color: infoBadge.text }}>
                        {infoBadge.label}
                    </span>
                </div>

                {/* Better alternative */}
                {question.better_alternative && (
                    <button
                        onClick={() => setExpanded(!expanded)}
                        className="mt-3 flex items-center gap-1 text-xs transition-colors hover:underline"
                        style={{ color: tokens.brandPrimary }}
                    >
                        <Lightbulb className="w-3 h-3" />
                        Better alternative available
                        {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>
                )}
                {expanded && question.better_alternative && (
                    <div className="mt-2 p-3 rounded-lg text-sm italic" style={{ backgroundColor: `${tokens.brandPrimary}10`, color: tokens.textSecondary }}>
                        "{question.better_alternative}"
                    </div>
                )}
            </div>
        </div>
    );
}

function DynamicsMetric({ icon, value, label, isScore = true, suffix = "" }: { icon: React.ReactNode; value: number | string; label: string; isScore?: boolean; suffix?: string }) {
    const getScoreColor = (score: number) => {
        if (score >= 80) return tokens.statusSuccess;
        if (score >= 60) return tokens.statusWarning;
        return tokens.statusDanger;
    };

    const displayValue = typeof value === "number" ? value : value;
    const color = isScore && typeof value === "number" ? getScoreColor(value) : tokens.textSecondary;

    return (
        <div className="text-center p-4 rounded-xl" style={{ backgroundColor: tokens.bgSurface }}>
            <div className="mb-2" style={{ color: tokens.textMuted }}>{icon}</div>
            <div className="text-2xl font-light mb-1" style={{ color }}>
                {displayValue}{suffix}
            </div>
            <div className="text-xs" style={{ color: tokens.textMuted }}>{label}</div>
        </div>
    );
}

function WaitTimeIndicator({ waitTime }: { waitTime: string }) {
    const config = {
        rushed: { color: tokens.statusDanger, label: "Rushed", desc: "Candidate needed more time" },
        appropriate: { color: tokens.statusSuccess, label: "Appropriate", desc: "Good pacing" },
        too_long: { color: tokens.statusWarning, label: "Too Long", desc: "Consider prompting earlier" }
    };

    const { color, label, desc } = config[waitTime as keyof typeof config] || config.appropriate;

    return (
        <div className="text-center p-4 rounded-xl" style={{ backgroundColor: tokens.bgSurface }}>
            <Clock className="w-6 h-6 mx-auto mb-2" style={{ color: tokens.textMuted }} />
            <div className="text-lg font-medium mb-1" style={{ color }}>{label}</div>
            <div className="text-xs" style={{ color: tokens.textMuted }}>{desc}</div>
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
                    {analytics.summary && (
                        <p className="mt-3 text-sm" style={{ color: tokens.textSecondary }}>{analytics.summary}</p>
                    )}
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

            {/* Interview Dynamics */}
            {analytics.interview_dynamics && (
                <SectionCard title="Interview Dynamics" icon={<Zap className="w-5 h-5" />}>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                        <DynamicsMetric
                            icon={<Clock className="w-6 h-6 mx-auto" />}
                            value={analytics.interview_dynamics.time_management}
                            label="Time Management"
                        />
                        <DynamicsMetric
                            icon={<Mic className="w-6 h-6 mx-auto" />}
                            value={analytics.interview_dynamics.active_listening_score}
                            label="Active Listening"
                        />
                        <DynamicsMetric
                            icon={<HeartHandshake className="w-6 h-6 mx-auto" />}
                            value={analytics.interview_dynamics.rapport_building}
                            label="Rapport Building"
                        />
                        <DynamicsMetric
                            icon={<AlertCircle className="w-6 h-6 mx-auto" />}
                            value={analytics.interview_dynamics.interruption_count}
                            label="Interruptions"
                            isScore={false}
                        />
                        <WaitTimeIndicator waitTime={analytics.interview_dynamics.avg_response_wait_time} />
                    </div>
                </SectionCard>
            )}

            {/* Question-by-Question Analysis */}
            {analytics.question_effectiveness && analytics.question_effectiveness.length > 0 && (
                <SectionCard title={`Question Analysis (${analytics.question_effectiveness.length} questions)`} icon={<MessageSquare className="w-5 h-5" />} defaultOpen={true}>
                    <div className="space-y-0">
                        {analytics.question_effectiveness.map((q, i) => (
                            <QuestionTimelineItem key={i} question={q} index={i} />
                        ))}
                    </div>
                </SectionCard>
            )}

            {/* Interviewer Strengths */}
            {analytics.interviewer_strengths && analytics.interviewer_strengths.length > 0 && (
                <SectionCard title="Interviewer Strengths" icon={<Star className="w-5 h-5" />}>
                    <div className="space-y-3">
                        {analytics.interviewer_strengths.map((strength, i) => (
                            <div key={i} className="flex items-start gap-3 p-4 rounded-xl" style={{ backgroundColor: `${tokens.statusSuccess}10` }}>
                                <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: tokens.statusSuccess }} />
                                <p className="text-sm" style={{ color: tokens.textSecondary }}>{strength}</p>
                            </div>
                        ))}
                    </div>
                </SectionCard>
            )}

            {/* Missed Opportunities */}
            {analytics.missed_opportunities && analytics.missed_opportunities.length > 0 && (
                <SectionCard title="Missed Opportunities" icon={<AlertTriangle className="w-5 h-5" />}>
                    <div className="space-y-4">
                        {analytics.missed_opportunities.map((opp, i) => (
                            <div key={i} className="rounded-xl border p-4" style={{ backgroundColor: tokens.bgSurface, borderColor: `${tokens.statusWarning}30` }}>
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="px-2 py-1 rounded text-xs font-medium" style={{ backgroundColor: `${tokens.statusWarning}20`, color: tokens.statusWarning }}>
                                        {opp.topic}
                                    </span>
                                </div>
                                <p className="text-sm mb-3" style={{ color: tokens.textMuted }}>
                                    <span className="font-medium text-white">Candidate said:</span> "{opp.candidate_statement}"
                                </p>
                                <div className="flex items-start gap-2 p-3 rounded-lg" style={{ backgroundColor: `${tokens.brandPrimary}10` }}>
                                    <Lightbulb className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: tokens.brandPrimary }} />
                                    <p className="text-sm" style={{ color: tokens.textSecondary }}>
                                        <span style={{ color: tokens.brandPrimary }}>Suggested follow-up:</span> "{opp.suggested_followup}"
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </SectionCard>
            )}

            {/* Coverage Gaps */}
            {analytics.coverage_gaps && analytics.coverage_gaps.length > 0 && (
                <SectionCard title="Coverage Gaps" icon={<XCircle className="w-5 h-5" />}>
                    <p className="text-sm mb-4" style={{ color: tokens.textMuted }}>
                        These critical topics were not adequately explored during the interview:
                    </p>
                    <div className="flex flex-wrap gap-2">
                        {analytics.coverage_gaps.map((gap, i) => (
                            <span key={i} className="px-3 py-2 rounded-lg text-sm" style={{ backgroundColor: `${tokens.statusDanger}15`, color: tokens.statusDanger }}>
                                {gap}
                            </span>
                        ))}
                    </div>
                </SectionCard>
            )}

            {/* Question Quality Breakdown */}
            {analytics.question_quality_breakdown && (
                <SectionCard title="Question Quality Breakdown" icon={<MessageSquare className="w-5 h-5" />}>
                    <div className="grid grid-cols-3 md:grid-cols-5 gap-6">
                        <CircularProgress value={analytics.question_quality_breakdown.relevance} label="Relevance" color={tokens.brandPrimary} />
                        <CircularProgress value={analytics.question_quality_breakdown.depth} label="Depth" color="#22D3EE" />
                        <CircularProgress value={analytics.question_quality_breakdown.follow_up_quality} label="Follow-up Quality" color={tokens.statusSuccess} />
                        {analytics.question_quality_breakdown.open_ended_ratio !== undefined && (
                            <CircularProgress value={analytics.question_quality_breakdown.open_ended_ratio} label="Open-ended %" color={tokens.statusWarning} />
                        )}
                        {analytics.question_quality_breakdown.clarity !== undefined && (
                            <CircularProgress value={analytics.question_quality_breakdown.clarity} label="Clarity" color="#A78BFA" />
                        )}
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
                                    backgroundColor: analytics.bias_indicators.severity === "none" || analytics.bias_indicators.severity === "low" ? `${tokens.statusSuccess}20` : `${tokens.statusWarning}20`,
                                    color: analytics.bias_indicators.severity === "none" || analytics.bias_indicators.severity === "low" ? tokens.statusSuccess : tokens.statusWarning,
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

            {/* Detailed Assessment */}
            {analytics.detailed_assessment && (
                <SectionCard title="Detailed Assessment" icon={<Award className="w-5 h-5" />}>
                    <div className="prose prose-invert max-w-none">
                        <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: tokens.textSecondary }}>
                            {analytics.detailed_assessment}
                        </p>
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
