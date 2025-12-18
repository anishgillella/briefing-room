"use client";

import { useState, useEffect } from "react";
import {
    BarChart3,
    TrendingUp,
    TrendingDown,
    User,
    UserCircle,
    Loader2,
    AlertCircle,
    CheckCircle,
    XCircle,
    Star,
    Flag,
    MessageSquare,
    ChevronDown,
    ChevronRight,
    Award,
    Target,
    Brain,
    Sparkles,
    Lightbulb,
    AlertTriangle,
    ThumbsUp,
    HelpCircle,
    Scale,
    Zap,
    Shield,
    Eye,
    Clock,
    Users,
    Briefcase,
    ArrowUpRight,
    Quote,
    Activity,
    PieChart as PieChartIcon,
    Layers,
} from "lucide-react";
import {
    ResponsiveContainer,
    RadarChart,
    PolarGrid,
    PolarAngleAxis,
    PolarRadiusAxis,
    Radar,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    LineChart,
    Line,
    PieChart,
    Pie,
    Cell,
    Legend,
    Area,
    AreaChart,
} from "recharts";

// ============================================================================
// Types
// ============================================================================

interface STARBreakdown {
    situation: number | null;
    task: number | null;
    action: number | null;
    result: number | null;
}

interface QAPair {
    question: string;
    answer: string;
    question_type: string;
    metrics: {
        relevance: number;
        clarity: number;
        depth: number;
        type_specific_metric?: number;
        type_specific_label?: string;
    };
    star_breakdown?: STARBreakdown;
    highlight?: string;
    concern?: string;
    follow_up_needed?: string;
}

interface CommunicationProfile {
    articulation_score: number;
    conciseness_score: number;
    structure_score: number;
    vocabulary_level: string;
    filler_word_frequency: string;
    confidence_indicators: string;
    active_listening_signals: string[];
    communication_style: string;
}

interface CompetencyEvidence {
    competency: string;
    evidence_strength: string;
    evidence_quotes: string[];
    assessment: string;
}

interface BehavioralProfile {
    work_style: string;
    decision_making: string;
    conflict_approach: string;
    stress_indicators: string[];
    authenticity_score: number;
    self_awareness_score: number;
    growth_mindset_indicators: string[];
}

interface RiskAssessment {
    flight_risk: string;
    flight_risk_evidence: string[];
    performance_risk: string;
    performance_risk_evidence: string[];
    culture_fit_risk: string;
    culture_fit_evidence: string[];
    verification_needed: string[];
}

interface ResponsePatterns {
    avg_response_time_feel: string;
    consistency_across_topics: number;
    depth_variation: string;
    strongest_topic_area: string;
    weakest_topic_area: string;
    evasive_moments: string[];
}

interface ExecutiveSummary {
    one_liner: string;
    three_strengths: string[];
    three_concerns: string[];
    ideal_role_fit: string;
    development_areas: string[];
    comparison_to_bar: string;
}

interface InterviewerDynamics {
    time_management: number;
    active_listening_score: number;
    rapport_building: number;
    interruption_count: number;
    avg_response_wait_time: string;
}

interface MissedOpportunity {
    topic: string;
    candidate_statement: string;
    suggested_followup: string;
}

interface QuestionEffectiveness {
    question: string;
    effectiveness_score: number;
    information_elicited: string;
    better_alternative?: string;
}

interface CandidateAnalyticsData {
    overall_score: number;
    communication_score: number;
    technical_score: number;
    cultural_fit_score: number;
    problem_solving_score?: number;
    leadership_potential?: number;
    recommendation: string;
    recommendation_reasoning: string;
    confidence: number;
    red_flags: string[];
    highlights: string[];
    total_questions: number;
    qa_pairs: QAPair[];
    best_answer?: { question?: string; quote: string; context?: string; why_impressive?: string } | null;
    worst_answer?: { question: string; issue: string; impact: string } | null;
    quotable_moment?: string | null;
    quotable_moments?: string[];
    communication_profile?: CommunicationProfile;
    competency_evidence?: CompetencyEvidence[];
    behavioral_profile?: BehavioralProfile;
    risk_assessment?: RiskAssessment;
    response_patterns?: ResponsePatterns;
    executive_summary?: ExecutiveSummary;
}

interface InterviewerAnalyticsData {
    overall_score: number;
    question_quality_score: number;
    topic_coverage_score: number;
    consistency_score: number;
    bias_score: number;
    candidate_experience_score: number;
    question_quality_breakdown?: {
        relevance: number;
        depth: number;
        follow_up_quality: number;
        open_ended_ratio?: number;
        clarity?: number;
    };
    topics_covered?: {
        technical: number;
        behavioral: number;
        culture_fit: number;
        problem_solving: number;
    };
    bias_indicators?: {
        flags: string[];
        severity: string;
        sentiment_balance: number;
    };
    interview_dynamics?: InterviewerDynamics;
    missed_opportunities?: MissedOpportunity[];
    question_effectiveness?: QuestionEffectiveness[];
    coverage_gaps?: string[];
    interviewer_strengths?: string[];
    improvement_suggestions: string[];
    summary_line: string;
    detailed_assessment?: string;
}

interface RoundAnalytics {
    interview_id: string;
    stage: string;
    status: string;
    interviewer_name: string | null;
    interviewer_id: string | null;
    created_at: string | null;
    candidate_analytics: CandidateAnalyticsData | null;
    interviewer_analytics: InterviewerAnalyticsData | null;
}

interface CumulativeAnalytics {
    total_rounds: number;
    rounds_with_analytics: number;
    avg_overall_score: number;
    avg_communication_score: number;
    avg_technical_score: number;
    avg_cultural_fit_score: number;
    final_recommendation: string;
    all_recommendations: string[];
    total_questions_asked: number;
    key_highlights: string[];
    key_red_flags: string[];
    score_trend: number[];
    avg_interviewer_score?: number;
    avg_question_quality?: number;
}

interface AnalyticsData {
    candidate_id: string;
    rounds: RoundAnalytics[];
    cumulative: CumulativeAnalytics | null;
    message: string;
}

interface CandidateAnalyticsProps {
    candidateId: string;
    candidateName: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ============================================================================
// Utility Components
// ============================================================================

// Animated Score Ring Component
const ScoreRing = ({ score, size = 120, strokeWidth = 8, label, sublabel }: {
    score: number;
    size?: number;
    strokeWidth?: number;
    label?: string;
    sublabel?: string;
}) => {
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const offset = circumference - (score / 100) * circumference;

    const getColor = (s: number) => {
        if (s >= 80) return { stroke: "#22c55e", bg: "rgba(34, 197, 94, 0.1)" };
        if (s >= 60) return { stroke: "#eab308", bg: "rgba(234, 179, 8, 0.1)" };
        return { stroke: "#ef4444", bg: "rgba(239, 68, 68, 0.1)" };
    };

    const colors = getColor(score);

    return (
        <div className="flex flex-col items-center">
            <div className="relative" style={{ width: size, height: size }}>
                <svg width={size} height={size} className="transform -rotate-90">
                    <circle
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        fill="none"
                        stroke="rgba(255,255,255,0.1)"
                        strokeWidth={strokeWidth}
                    />
                    <circle
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        fill="none"
                        stroke={colors.stroke}
                        strokeWidth={strokeWidth}
                        strokeDasharray={circumference}
                        strokeDashoffset={offset}
                        strokeLinecap="round"
                        className="transition-all duration-1000 ease-out"
                        style={{ filter: `drop-shadow(0 0 8px ${colors.stroke})` }}
                    />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-4xl font-bold text-white" style={{ fontFamily: "SF Pro Display, -apple-system, sans-serif" }}>
                        {Math.round(score)}
                    </span>
                    {sublabel && <span className="text-xs text-white/40 uppercase tracking-wider">{sublabel}</span>}
                </div>
            </div>
            {label && <span className="mt-3 text-sm text-white/60 font-medium">{label}</span>}
        </div>
    );
};

// Minimal Progress Bar
const ProgressBar = ({ value, max = 100, color = "purple", showValue = true, height = 4 }: {
    value: number;
    max?: number;
    color?: string;
    showValue?: boolean;
    height?: number;
}) => {
    const percentage = Math.min((value / max) * 100, 100);
    const colorMap: Record<string, string> = {
        purple: "bg-purple-500",
        cyan: "bg-cyan-500",
        green: "bg-green-500",
        yellow: "bg-yellow-500",
        red: "bg-red-500",
        blue: "bg-blue-500",
        pink: "bg-pink-500",
        orange: "bg-orange-500",
    };

    return (
        <div className="flex items-center gap-3 w-full">
            <div className="flex-1 bg-white/5 rounded-full overflow-hidden" style={{ height }}>
                <div
                    className={`h-full ${colorMap[color]} rounded-full transition-all duration-700 ease-out`}
                    style={{ width: `${percentage}%` }}
                />
            </div>
            {showValue && (
                <span className="text-sm font-medium text-white/70 w-8 text-right">{Math.round(value)}</span>
            )}
        </div>
    );
};

// Metric Card Component
const MetricCard = ({ icon: Icon, label, value, subvalue, trend, color = "white" }: {
    icon: React.ElementType;
    label: string;
    value: string | number;
    subvalue?: string;
    trend?: "up" | "down" | "neutral";
    color?: string;
}) => {
    const colorClasses: Record<string, string> = {
        white: "text-white",
        green: "text-green-400",
        yellow: "text-yellow-400",
        red: "text-red-400",
        purple: "text-purple-400",
        cyan: "text-cyan-400",
    };

    return (
        <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.05] hover:border-white/10 transition-all group">
            <div className="flex items-start justify-between mb-2">
                <div className="p-2 rounded-xl bg-white/5 group-hover:bg-white/10 transition-colors">
                    <Icon className={`w-4 h-4 ${colorClasses[color]}`} />
                </div>
                {trend && (
                    <div className={`flex items-center gap-1 text-xs ${trend === "up" ? "text-green-400" : trend === "down" ? "text-red-400" : "text-white/40"}`}>
                        {trend === "up" ? <TrendingUp className="w-3 h-3" /> : trend === "down" ? <TrendingDown className="w-3 h-3" /> : null}
                    </div>
                )}
            </div>
            <div className={`text-2xl font-semibold ${colorClasses[color]}`}>{value}</div>
            <div className="text-xs text-white/40 mt-1">{label}</div>
            {subvalue && <div className="text-[10px] text-white/30 mt-0.5">{subvalue}</div>}
        </div>
    );
};

// Badge Component
const Badge = ({ children, variant = "default" }: { children: React.ReactNode; variant?: "default" | "success" | "warning" | "danger" | "info" }) => {
    const variants = {
        default: "bg-white/10 text-white/70",
        success: "bg-green-500/20 text-green-400 border border-green-500/30",
        warning: "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30",
        danger: "bg-red-500/20 text-red-400 border border-red-500/30",
        info: "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30",
    };

    return (
        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${variants[variant]}`}>
            {children}
        </span>
    );
};

// Section Header
const SectionHeader = ({ icon: Icon, title, subtitle, action }: {
    icon: React.ElementType;
    title: string;
    subtitle?: string;
    action?: React.ReactNode;
}) => (
    <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-white/10 to-white/5">
                <Icon className="w-5 h-5 text-white/70" />
            </div>
            <div>
                <h3 className="text-lg font-semibold text-white">{title}</h3>
                {subtitle && <p className="text-sm text-white/40">{subtitle}</p>}
            </div>
        </div>
        {action}
    </div>
);

// ============================================================================
// Main Component
// ============================================================================

interface Interviewer {
    id: string;
    name: string;
}

export default function CandidateAnalytics({ candidateId, candidateName }: CandidateAnalyticsProps) {
    const [data, setData] = useState<AnalyticsData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedRound, setSelectedRound] = useState<string | null>(null);
    const [activeView, setActiveView] = useState<"candidate" | "interviewer">("candidate");
    const [interviewers, setInterviewers] = useState<Interviewer[]>([]);
    const [selectedInterviewerForRegen, setSelectedInterviewerForRegen] = useState<string>("");
    const [regenerating, setRegenerating] = useState(false);
    const [regenError, setRegenError] = useState<string | null>(null);

    useEffect(() => {
        fetchAnalytics();
        fetchInterviewers();
    }, [candidateId, candidateName]);

    const fetchInterviewers = async () => {
        try {
            const res = await fetch(`${API_URL}/api/interviewers`);
            if (res.ok) {
                const data = await res.json();
                setInterviewers(data.interviewers || []);
            }
        } catch (e) {
            console.error("Failed to fetch interviewers", e);
        }
    };

    const regenerateInterviewerAnalytics = async (interviewId: string, interviewerId: string) => {
        setRegenerating(true);
        setRegenError(null);
        try {
            const res = await fetch(`${API_URL}/api/interviews/${interviewId}/regenerate-interviewer-analytics`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ interviewer_id: interviewerId }),
            });

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.detail || "Failed to regenerate");
            }

            // Refresh analytics data
            await fetchAnalytics();
        } catch (e) {
            setRegenError(e instanceof Error ? e.message : "Failed to regenerate analytics");
        } finally {
            setRegenerating(false);
        }
    };

    const fetchAnalytics = async () => {
        setLoading(true);
        setError(null);

        try {
            const isUuid = candidateId.length === 36 && candidateId.includes("-");
            let effectiveId = candidateId;

            if (!isUuid && candidateName) {
                const lookupRes = await fetch(`${API_URL}/api/interviews/lookup-by-name/${encodeURIComponent(candidateName)}`);
                if (lookupRes.ok) {
                    const lookupData = await lookupRes.json();
                    effectiveId = lookupData.db_id;
                } else {
                    setError("Candidate not found in database");
                    setLoading(false);
                    return;
                }
            }

            const res = await fetch(`${API_URL}/api/interviews/candidate/${effectiveId}/all-analytics`);
            if (!res.ok) throw new Error("Failed to fetch analytics");
            const result = await res.json();
            setData(result);

            // Auto-select first round with analytics
            const firstWithAnalytics = result.rounds?.find((r: RoundAnalytics) => r.candidate_analytics);
            if (firstWithAnalytics) {
                setSelectedRound(firstWithAnalytics.interview_id);
            }
        } catch (e) {
            setError(e instanceof Error ? e.message : "Failed to load analytics");
        } finally {
            setLoading(false);
        }
    };

    const getScoreColor = (score: number) => {
        if (score >= 80) return "green";
        if (score >= 60) return "yellow";
        return "red";
    };

    const getRecommendationVariant = (rec: string): "success" | "warning" | "danger" => {
        if (rec.includes("Strong Hire") || rec === "Hire") return "success";
        if (rec.includes("Leaning Hire")) return "warning";
        return "danger";
    };

    const formatStage = (stage: string) => stage.replace("_", " ").replace(/\b\w/g, (l) => l.toUpperCase());

    const selectedRoundData = data?.rounds.find((r) => r.interview_id === selectedRound);

    // Loading State
    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-32">
                <div className="relative">
                    <div className="w-16 h-16 rounded-full border-2 border-purple-500/30 border-t-purple-500 animate-spin" />
                    <Brain className="w-6 h-6 text-purple-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                </div>
                <p className="mt-6 text-white/40 text-sm">Analyzing interview data...</p>
            </div>
        );
    }

    // Error State
    if (error) {
        return (
            <div className="flex flex-col items-center justify-center py-32">
                <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
                    <AlertCircle className="w-8 h-8 text-red-400" />
                </div>
                <p className="text-red-400 mb-4">{error}</p>
                <button
                    onClick={fetchAnalytics}
                    className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white/70 text-sm transition-colors"
                >
                    Try Again
                </button>
            </div>
        );
    }

    // Empty State
    if (!data || data.rounds.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-32">
                <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mb-6">
                    <BarChart3 className="w-10 h-10 text-white/20" />
                </div>
                <h3 className="text-xl font-semibold text-white/60 mb-2">No Analytics Yet</h3>
                <p className="text-white/40 text-sm max-w-md text-center">
                    Complete interviews and generate analytics to see comprehensive insights here.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-8 pb-12">
            {/* ============================================================ */}
            {/* HERO SECTION - Cumulative Analytics */}
            {/* ============================================================ */}
            {data.cumulative && (
                <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#1a1a2e] via-[#16162a] to-[#0f0f1a] border border-white/[0.05]">
                    {/* Background Glow */}
                    <div className="absolute top-0 right-0 w-96 h-96 bg-purple-500/10 blur-[100px] rounded-full" />
                    <div className="absolute bottom-0 left-0 w-64 h-64 bg-cyan-500/10 blur-[80px] rounded-full" />

                    <div className="relative p-8 md:p-12">
                        {/* Header */}
                        <div className="flex items-center gap-4 mb-10">
                            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500/30 to-cyan-500/30 flex items-center justify-center backdrop-blur-xl">
                                <Award className="w-7 h-7 text-white" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold text-white" style={{ fontFamily: "SF Pro Display, -apple-system, sans-serif" }}>
                                    Candidate Assessment
                                </h2>
                                <p className="text-white/40 text-sm">
                                    {data.cumulative.rounds_with_analytics} of {data.cumulative.total_rounds} rounds analyzed
                                </p>
                            </div>
                        </div>

                        {/* Main Score Display */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-10">
                            {/* The Score */}
                            <div className="lg:col-span-1 flex justify-center">
                                <ScoreRing
                                    score={data.cumulative.avg_overall_score}
                                    size={180}
                                    strokeWidth={12}
                                    sublabel="overall"
                                />
                            </div>

                            {/* Key Metrics */}
                            <div className="lg:col-span-2 grid grid-cols-2 md:grid-cols-4 gap-4">
                                <MetricCard
                                    icon={MessageSquare}
                                    label="Communication"
                                    value={data.cumulative.avg_communication_score.toFixed(1)}
                                    subvalue="out of 10"
                                    color={getScoreColor(data.cumulative.avg_communication_score * 10)}
                                />
                                <MetricCard
                                    icon={Zap}
                                    label="Technical"
                                    value={data.cumulative.avg_technical_score.toFixed(1)}
                                    subvalue="out of 10"
                                    color={getScoreColor(data.cumulative.avg_technical_score * 10)}
                                />
                                <MetricCard
                                    icon={Users}
                                    label="Cultural Fit"
                                    value={data.cumulative.avg_cultural_fit_score.toFixed(1)}
                                    subvalue="out of 10"
                                    color={getScoreColor(data.cumulative.avg_cultural_fit_score * 10)}
                                />
                                <MetricCard
                                    icon={HelpCircle}
                                    label="Questions"
                                    value={data.cumulative.total_questions_asked}
                                    subvalue="total asked"
                                    color="cyan"
                                />
                            </div>
                        </div>

                        {/* Recommendation Banner */}
                        <div className={`p-6 rounded-2xl mb-8 ${
                            getRecommendationVariant(data.cumulative.final_recommendation) === "success"
                                ? "bg-green-500/10 border border-green-500/20"
                                : getRecommendationVariant(data.cumulative.final_recommendation) === "warning"
                                ? "bg-yellow-500/10 border border-yellow-500/20"
                                : "bg-red-500/10 border border-red-500/20"
                        }`}>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    {getRecommendationVariant(data.cumulative.final_recommendation) === "success" ? (
                                        <CheckCircle className="w-8 h-8 text-green-400" />
                                    ) : getRecommendationVariant(data.cumulative.final_recommendation) === "warning" ? (
                                        <AlertTriangle className="w-8 h-8 text-yellow-400" />
                                    ) : (
                                        <XCircle className="w-8 h-8 text-red-400" />
                                    )}
                                    <div>
                                        <div className="text-xl font-bold text-white">{data.cumulative.final_recommendation}</div>
                                        <div className="text-sm text-white/50">Final Recommendation</div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-sm text-white/40">Based on</div>
                                    <div className="text-white/70 font-medium">{data.cumulative.all_recommendations.length} evaluations</div>
                                </div>
                            </div>
                        </div>

                        {/* Performance Charts Grid */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                            {/* Score Trend Line Chart */}
                            {data.cumulative.score_trend.length > 0 && (
                                <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.05]">
                                    <h4 className="text-sm font-medium text-white/50 mb-4 flex items-center gap-2">
                                        <Activity className="w-4 h-4" />
                                        Performance Trajectory
                                    </h4>
                                    <div className="h-48">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <AreaChart
                                                data={data.cumulative.score_trend.map((score, i) => ({
                                                    round: `Round ${i + 1}`,
                                                    score,
                                                }))}
                                                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                                            >
                                                <defs>
                                                    <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="#a855f7" stopOpacity={0.4}/>
                                                        <stop offset="95%" stopColor="#a855f7" stopOpacity={0}/>
                                                    </linearGradient>
                                                </defs>
                                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                                <XAxis
                                                    dataKey="round"
                                                    tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }}
                                                    axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                                                    tickLine={false}
                                                />
                                                <YAxis
                                                    domain={[0, 100]}
                                                    tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }}
                                                    axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                                                    tickLine={false}
                                                />
                                                <Tooltip
                                                    contentStyle={{
                                                        backgroundColor: 'rgba(15, 15, 26, 0.95)',
                                                        border: '1px solid rgba(255,255,255,0.1)',
                                                        borderRadius: '12px',
                                                        color: 'white',
                                                    }}
                                                    labelStyle={{ color: 'rgba(255,255,255,0.7)' }}
                                                />
                                                <Area
                                                    type="monotone"
                                                    dataKey="score"
                                                    stroke="#a855f7"
                                                    strokeWidth={3}
                                                    fill="url(#scoreGradient)"
                                                    dot={{ fill: '#a855f7', strokeWidth: 2, r: 5 }}
                                                    activeDot={{ r: 7, fill: '#a855f7', stroke: 'white', strokeWidth: 2 }}
                                                />
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            )}

                            {/* Core Competencies Radar Chart */}
                            <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.05]">
                                <h4 className="text-sm font-medium text-white/50 mb-4 flex items-center gap-2">
                                    <Target className="w-4 h-4" />
                                    Core Competencies
                                </h4>
                                <div className="h-48">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <RadarChart
                                            data={[
                                                { skill: 'Communication', value: data.cumulative.avg_communication_score * 10, fullMark: 100 },
                                                { skill: 'Technical', value: data.cumulative.avg_technical_score * 10, fullMark: 100 },
                                                { skill: 'Cultural Fit', value: data.cumulative.avg_cultural_fit_score * 10, fullMark: 100 },
                                                { skill: 'Overall', value: data.cumulative.avg_overall_score, fullMark: 100 },
                                            ]}
                                            margin={{ top: 10, right: 30, bottom: 10, left: 30 }}
                                        >
                                            <PolarGrid stroke="rgba(255,255,255,0.1)" />
                                            <PolarAngleAxis
                                                dataKey="skill"
                                                tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11 }}
                                            />
                                            <PolarRadiusAxis
                                                angle={30}
                                                domain={[0, 100]}
                                                tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 9 }}
                                                axisLine={false}
                                            />
                                            <Radar
                                                name="Score"
                                                dataKey="value"
                                                stroke="#22d3ee"
                                                fill="#22d3ee"
                                                fillOpacity={0.3}
                                                strokeWidth={2}
                                            />
                                        </RadarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>

                        {/* Score Comparison Bar Chart */}
                        {data.rounds.length > 0 && data.rounds.some(r => r.candidate_analytics) && (
                            <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.05] mb-8">
                                <h4 className="text-sm font-medium text-white/50 mb-4 flex items-center gap-2">
                                    <BarChart3 className="w-4 h-4" />
                                    Score Breakdown by Round
                                </h4>
                                <div className="h-64">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart
                                            data={data.rounds
                                                .filter(r => r.candidate_analytics)
                                                .map((r, i) => ({
                                                    name: `${r.stage.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}`,
                                                    Communication: (r.candidate_analytics?.communication_score || 0) * 10,
                                                    Technical: (r.candidate_analytics?.technical_score || 0) * 10,
                                                    'Cultural Fit': (r.candidate_analytics?.cultural_fit_score || 0) * 10,
                                                    Overall: r.candidate_analytics?.overall_score || 0,
                                                }))}
                                            margin={{ top: 20, right: 30, left: -10, bottom: 5 }}
                                        >
                                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                            <XAxis
                                                dataKey="name"
                                                tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }}
                                                axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                                            />
                                            <YAxis
                                                domain={[0, 100]}
                                                tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }}
                                                axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                                            />
                                            <Tooltip
                                                contentStyle={{
                                                    backgroundColor: 'rgba(15, 15, 26, 0.95)',
                                                    border: '1px solid rgba(255,255,255,0.1)',
                                                    borderRadius: '12px',
                                                    color: 'white',
                                                }}
                                                cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                                            />
                                            <Legend
                                                wrapperStyle={{ paddingTop: '10px' }}
                                                formatter={(value) => <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '11px' }}>{value}</span>}
                                            />
                                            <Bar dataKey="Communication" fill="#a855f7" radius={[4, 4, 0, 0]} />
                                            <Bar dataKey="Technical" fill="#22d3ee" radius={[4, 4, 0, 0]} />
                                            <Bar dataKey="Cultural Fit" fill="#22c55e" radius={[4, 4, 0, 0]} />
                                            <Bar dataKey="Overall" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        )}

                        {/* Highlights & Red Flags */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {data.cumulative.key_highlights.length > 0 && (
                                <div className="p-5 rounded-2xl bg-green-500/5 border border-green-500/10">
                                    <h4 className="font-medium text-green-400 mb-4 flex items-center gap-2">
                                        <Star className="w-4 h-4" />
                                        Key Strengths
                                    </h4>
                                    <ul className="space-y-2">
                                        {data.cumulative.key_highlights.slice(0, 4).map((h, i) => (
                                            <li key={i} className="text-sm text-white/70 flex items-start gap-2">
                                                <CheckCircle className="w-4 h-4 text-green-400 shrink-0 mt-0.5" />
                                                <span>{h}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                            {data.cumulative.key_red_flags.length > 0 && (
                                <div className="p-5 rounded-2xl bg-red-500/5 border border-red-500/10">
                                    <h4 className="font-medium text-red-400 mb-4 flex items-center gap-2">
                                        <Flag className="w-4 h-4" />
                                        Areas of Concern
                                    </h4>
                                    <ul className="space-y-2">
                                        {data.cumulative.key_red_flags.slice(0, 4).map((rf, i) => (
                                            <li key={i} className="text-sm text-white/70 flex items-start gap-2">
                                                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                                                <span>{rf}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ============================================================ */}
            {/* ROUND SELECTOR */}
            {/* ============================================================ */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
                {data.rounds.map((round) => (
                    <button
                        key={round.interview_id}
                        onClick={() => setSelectedRound(round.interview_id)}
                        className={`flex items-center gap-3 px-5 py-3 rounded-2xl transition-all whitespace-nowrap ${
                            selectedRound === round.interview_id
                                ? "bg-white/10 border border-white/20"
                                : "bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.05]"
                        }`}
                    >
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                            round.candidate_analytics
                                ? round.candidate_analytics.overall_score >= 80
                                    ? "bg-green-500/20"
                                    : round.candidate_analytics.overall_score >= 60
                                    ? "bg-yellow-500/20"
                                    : "bg-red-500/20"
                                : "bg-white/5"
                        }`}>
                            {round.candidate_analytics ? (
                                <span className={`text-sm font-bold ${
                                    round.candidate_analytics.overall_score >= 80 ? "text-green-400" :
                                    round.candidate_analytics.overall_score >= 60 ? "text-yellow-400" :
                                    "text-red-400"
                                }`}>
                                    {round.candidate_analytics.overall_score}
                                </span>
                            ) : (
                                <BarChart3 className="w-4 h-4 text-white/30" />
                            )}
                        </div>
                        <div className="text-left">
                            <div className="text-sm font-medium text-white">{formatStage(round.stage)}</div>
                            <div className="text-xs text-white/40">{round.interviewer_name || "No interviewer"}</div>
                        </div>
                        {round.candidate_analytics && (
                            <Badge variant={getRecommendationVariant(round.candidate_analytics.recommendation)}>
                                {round.candidate_analytics.recommendation.split(" ").slice(-1)[0]}
                            </Badge>
                        )}
                    </button>
                ))}
            </div>

            {/* ============================================================ */}
            {/* SELECTED ROUND DETAILS */}
            {/* ============================================================ */}
            {selectedRoundData && (selectedRoundData.candidate_analytics || selectedRoundData.interviewer_analytics) && (
                <div className="space-y-6">
                    {/* View Toggle */}
                    <div className="flex items-center gap-2 p-1 bg-white/[0.02] rounded-xl border border-white/[0.05] w-fit">
                        <button
                            onClick={() => setActiveView("candidate")}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                                activeView === "candidate"
                                    ? "bg-purple-600 text-white"
                                    : "text-white/50 hover:text-white/70"
                            }`}
                        >
                            <User className="w-4 h-4" />
                            Candidate Analysis
                        </button>
                        <button
                            onClick={() => setActiveView("interviewer")}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                                activeView === "interviewer"
                                    ? "bg-cyan-600 text-white"
                                    : "text-white/50 hover:text-white/70"
                            }`}
                        >
                            <UserCircle className="w-4 h-4" />
                            Interviewer Analysis
                        </button>
                    </div>

                    {/* ============================================================ */}
                    {/* CANDIDATE ANALYTICS VIEW */}
                    {/* ============================================================ */}
                    {activeView === "candidate" && selectedRoundData.candidate_analytics && (
                        <div className="space-y-6">
                            {/* Executive Summary */}
                            {selectedRoundData.candidate_analytics.executive_summary && (
                                <div className="p-6 rounded-2xl bg-gradient-to-br from-purple-500/5 to-cyan-500/5 border border-white/[0.05]">
                                    <SectionHeader icon={Sparkles} title="Executive Summary" />
                                    <div className="p-4 rounded-xl bg-black/20 mb-6">
                                        <p className="text-lg text-white/90 font-medium italic">
                                            &ldquo;{selectedRoundData.candidate_analytics.executive_summary.one_liner}&rdquo;
                                        </p>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div className="p-4 rounded-xl bg-green-500/5 border border-green-500/10">
                                            <h5 className="text-xs uppercase tracking-wider text-green-400 mb-3">Strengths</h5>
                                            <ul className="space-y-2">
                                                {selectedRoundData.candidate_analytics.executive_summary.three_strengths.map((s, i) => (
                                                    <li key={i} className="text-sm text-white/70 flex items-start gap-2">
                                                        <CheckCircle className="w-3 h-3 text-green-400 shrink-0 mt-1" />
                                                        {s}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                        <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/10">
                                            <h5 className="text-xs uppercase tracking-wider text-red-400 mb-3">Concerns</h5>
                                            <ul className="space-y-2">
                                                {selectedRoundData.candidate_analytics.executive_summary.three_concerns.map((c, i) => (
                                                    <li key={i} className="text-sm text-white/70 flex items-start gap-2">
                                                        <AlertCircle className="w-3 h-3 text-red-400 shrink-0 mt-1" />
                                                        {c}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                        <div className="p-4 rounded-xl bg-cyan-500/5 border border-cyan-500/10">
                                            <h5 className="text-xs uppercase tracking-wider text-cyan-400 mb-3">Development</h5>
                                            <ul className="space-y-2">
                                                {selectedRoundData.candidate_analytics.executive_summary.development_areas.map((d, i) => (
                                                    <li key={i} className="text-sm text-white/70 flex items-start gap-2">
                                                        <ArrowUpRight className="w-3 h-3 text-cyan-400 shrink-0 mt-1" />
                                                        {d}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    </div>
                                    {selectedRoundData.candidate_analytics.executive_summary.ideal_role_fit && (
                                        <div className="mt-4 p-3 rounded-xl bg-white/5 flex items-center gap-3">
                                            <Briefcase className="w-5 h-5 text-purple-400" />
                                            <div>
                                                <span className="text-xs text-white/40">Ideal Role Fit: </span>
                                                <span className="text-sm text-white/80">{selectedRoundData.candidate_analytics.executive_summary.ideal_role_fit}</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Score Breakdown */}
                            <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                                <div className="col-span-2 md:col-span-2 p-6 rounded-2xl bg-white/[0.02] border border-white/[0.05]">
                                    <ScoreRing score={selectedRoundData.candidate_analytics.overall_score} size={100} strokeWidth={8} />
                                    <div className="text-center mt-2 text-sm text-white/50">Overall Score</div>
                                </div>
                                <MetricCard icon={MessageSquare} label="Communication" value={selectedRoundData.candidate_analytics.communication_score} color={getScoreColor(selectedRoundData.candidate_analytics.communication_score * 10)} />
                                <MetricCard icon={Zap} label="Technical" value={selectedRoundData.candidate_analytics.technical_score} color={getScoreColor(selectedRoundData.candidate_analytics.technical_score * 10)} />
                                <MetricCard icon={Users} label="Cultural Fit" value={selectedRoundData.candidate_analytics.cultural_fit_score} color={getScoreColor(selectedRoundData.candidate_analytics.cultural_fit_score * 10)} />
                                {selectedRoundData.candidate_analytics.leadership_potential !== undefined && (
                                    <MetricCard icon={Award} label="Leadership" value={selectedRoundData.candidate_analytics.leadership_potential} color={getScoreColor(selectedRoundData.candidate_analytics.leadership_potential * 10)} />
                                )}
                            </div>

                            {/* Visual Analytics Row */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {/* Question Type Distribution */}
                                {selectedRoundData.candidate_analytics.qa_pairs.length > 0 && (
                                    <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.05]">
                                        <h4 className="text-sm font-medium text-white/50 mb-4 flex items-center gap-2">
                                            <PieChartIcon className="w-4 h-4" />
                                            Question Distribution
                                        </h4>
                                        <div className="h-48">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <PieChart>
                                                    <Pie
                                                        data={(() => {
                                                            const counts: Record<string, number> = {};
                                                            selectedRoundData.candidate_analytics?.qa_pairs.forEach((qa) => {
                                                                counts[qa.question_type] = (counts[qa.question_type] || 0) + 1;
                                                            });
                                                            return Object.entries(counts).map(([type, count]) => ({
                                                                name: type.charAt(0).toUpperCase() + type.slice(1),
                                                                value: count,
                                                            }));
                                                        })()}
                                                        cx="50%"
                                                        cy="50%"
                                                        innerRadius={40}
                                                        outerRadius={70}
                                                        paddingAngle={3}
                                                        dataKey="value"
                                                    >
                                                        {[
                                                            { color: '#3b82f6' },
                                                            { color: '#a855f7' },
                                                            { color: '#f59e0b' },
                                                            { color: '#22c55e' },
                                                        ].map((entry, index) => (
                                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                                        ))}
                                                    </Pie>
                                                    <Tooltip
                                                        contentStyle={{
                                                            backgroundColor: 'rgba(15, 15, 26, 0.95)',
                                                            border: '1px solid rgba(255,255,255,0.1)',
                                                            borderRadius: '12px',
                                                            color: 'white',
                                                        }}
                                                    />
                                                    <Legend
                                                        formatter={(value) => <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '11px' }}>{value}</span>}
                                                    />
                                                </PieChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>
                                )}

                                {/* Score Radar for this round */}
                                <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.05]">
                                    <h4 className="text-sm font-medium text-white/50 mb-4 flex items-center gap-2">
                                        <Target className="w-4 h-4" />
                                        Competency Radar
                                    </h4>
                                    <div className="h-48">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <RadarChart
                                                data={[
                                                    { skill: 'Communication', value: selectedRoundData.candidate_analytics?.communication_score ? selectedRoundData.candidate_analytics.communication_score * 10 : 0 },
                                                    { skill: 'Technical', value: selectedRoundData.candidate_analytics?.technical_score ? selectedRoundData.candidate_analytics.technical_score * 10 : 0 },
                                                    { skill: 'Culture Fit', value: selectedRoundData.candidate_analytics?.cultural_fit_score ? selectedRoundData.candidate_analytics.cultural_fit_score * 10 : 0 },
                                                    { skill: 'Leadership', value: selectedRoundData.candidate_analytics?.leadership_potential ? selectedRoundData.candidate_analytics.leadership_potential * 10 : 50 },
                                                    { skill: 'Overall', value: selectedRoundData.candidate_analytics?.overall_score || 0 },
                                                ]}
                                                margin={{ top: 10, right: 30, bottom: 10, left: 30 }}
                                            >
                                                <PolarGrid stroke="rgba(255,255,255,0.1)" />
                                                <PolarAngleAxis
                                                    dataKey="skill"
                                                    tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 10 }}
                                                />
                                                <PolarRadiusAxis
                                                    angle={30}
                                                    domain={[0, 100]}
                                                    tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 9 }}
                                                    axisLine={false}
                                                />
                                                <Radar
                                                    name="Score"
                                                    dataKey="value"
                                                    stroke="#a855f7"
                                                    fill="#a855f7"
                                                    fillOpacity={0.3}
                                                    strokeWidth={2}
                                                />
                                            </RadarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            </div>

                            {/* Answer Quality Distribution */}
                            {selectedRoundData.candidate_analytics.qa_pairs.length > 0 && (
                                <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.05]">
                                    <h4 className="text-sm font-medium text-white/50 mb-4 flex items-center gap-2">
                                        <BarChart3 className="w-4 h-4" />
                                        Answer Quality by Question
                                    </h4>
                                    <div className="h-48">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart
                                                data={selectedRoundData.candidate_analytics.qa_pairs.slice(0, 8).map((qa, i) => ({
                                                    name: `Q${i + 1}`,
                                                    Relevance: qa.metrics.relevance * 10,
                                                    Clarity: qa.metrics.clarity * 10,
                                                    Depth: qa.metrics.depth * 10,
                                                }))}
                                                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                                            >
                                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                                <XAxis
                                                    dataKey="name"
                                                    tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }}
                                                    axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                                                />
                                                <YAxis
                                                    domain={[0, 100]}
                                                    tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }}
                                                    axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                                                />
                                                <Tooltip
                                                    contentStyle={{
                                                        backgroundColor: 'rgba(15, 15, 26, 0.95)',
                                                        border: '1px solid rgba(255,255,255,0.1)',
                                                        borderRadius: '12px',
                                                        color: 'white',
                                                    }}
                                                    cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                                                />
                                                <Legend
                                                    formatter={(value) => <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '11px' }}>{value}</span>}
                                                />
                                                <Bar dataKey="Relevance" fill="#22c55e" radius={[2, 2, 0, 0]} />
                                                <Bar dataKey="Clarity" fill="#22d3ee" radius={[2, 2, 0, 0]} />
                                                <Bar dataKey="Depth" fill="#a855f7" radius={[2, 2, 0, 0]} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            )}

                            {/* Communication Profile */}
                            {selectedRoundData.candidate_analytics.communication_profile && (
                                <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.05]">
                                    <SectionHeader icon={MessageSquare} title="Communication Profile" />
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-4">
                                            <div>
                                                <div className="flex justify-between text-sm mb-1">
                                                    <span className="text-white/50">Articulation</span>
                                                    <span className="text-white/70">{selectedRoundData.candidate_analytics.communication_profile.articulation_score}</span>
                                                </div>
                                                <ProgressBar value={selectedRoundData.candidate_analytics.communication_profile.articulation_score} color="purple" showValue={false} />
                                            </div>
                                            <div>
                                                <div className="flex justify-between text-sm mb-1">
                                                    <span className="text-white/50">Conciseness</span>
                                                    <span className="text-white/70">{selectedRoundData.candidate_analytics.communication_profile.conciseness_score}</span>
                                                </div>
                                                <ProgressBar value={selectedRoundData.candidate_analytics.communication_profile.conciseness_score} color="cyan" showValue={false} />
                                            </div>
                                            <div>
                                                <div className="flex justify-between text-sm mb-1">
                                                    <span className="text-white/50">Structure</span>
                                                    <span className="text-white/70">{selectedRoundData.candidate_analytics.communication_profile.structure_score}</span>
                                                </div>
                                                <ProgressBar value={selectedRoundData.candidate_analytics.communication_profile.structure_score} color="green" showValue={false} />
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="p-3 rounded-xl bg-white/5">
                                                <div className="text-xs text-white/40 mb-1">Vocabulary</div>
                                                <div className="text-sm font-medium text-white capitalize">{selectedRoundData.candidate_analytics.communication_profile.vocabulary_level}</div>
                                            </div>
                                            <div className="p-3 rounded-xl bg-white/5">
                                                <div className="text-xs text-white/40 mb-1">Confidence</div>
                                                <div className="text-sm font-medium text-white capitalize">{selectedRoundData.candidate_analytics.communication_profile.confidence_indicators.replace("_", " ")}</div>
                                            </div>
                                            <div className="p-3 rounded-xl bg-white/5">
                                                <div className="text-xs text-white/40 mb-1">Filler Words</div>
                                                <div className="text-sm font-medium text-white capitalize">{selectedRoundData.candidate_analytics.communication_profile.filler_word_frequency}</div>
                                            </div>
                                            <div className="p-3 rounded-xl bg-white/5">
                                                <div className="text-xs text-white/40 mb-1">Style</div>
                                                <div className="text-sm font-medium text-white capitalize">{selectedRoundData.candidate_analytics.communication_profile.communication_style}</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Competency Evidence */}
                            {selectedRoundData.candidate_analytics.competency_evidence && selectedRoundData.candidate_analytics.competency_evidence.length > 0 && (
                                <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.05]">
                                    <SectionHeader icon={Target} title="Competency Evidence" subtitle="Skills demonstrated with evidence" />
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {selectedRoundData.candidate_analytics.competency_evidence.map((comp, i) => (
                                            <div key={i} className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.05]">
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="font-medium text-white">{comp.competency}</span>
                                                    <Badge variant={
                                                        comp.evidence_strength === "exceptional" || comp.evidence_strength === "strong" ? "success" :
                                                        comp.evidence_strength === "moderate" ? "warning" : "danger"
                                                    }>
                                                        {comp.evidence_strength}
                                                    </Badge>
                                                </div>
                                                <p className="text-sm text-white/50 mb-2">{comp.assessment}</p>
                                                {comp.evidence_quotes.length > 0 && (
                                                    <div className="p-2 rounded bg-white/5 text-xs text-white/40 italic">
                                                        &ldquo;{comp.evidence_quotes[0]}&rdquo;
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Risk Assessment */}
                            {selectedRoundData.candidate_analytics.risk_assessment && (
                                <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.05]">
                                    <SectionHeader icon={Shield} title="Risk Assessment" />
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div className={`p-4 rounded-xl ${
                                            selectedRoundData.candidate_analytics.risk_assessment.flight_risk === "low" ? "bg-green-500/5 border border-green-500/10" :
                                            selectedRoundData.candidate_analytics.risk_assessment.flight_risk === "medium" ? "bg-yellow-500/5 border border-yellow-500/10" :
                                            "bg-red-500/5 border border-red-500/10"
                                        }`}>
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-sm text-white/50">Flight Risk</span>
                                                <Badge variant={
                                                    selectedRoundData.candidate_analytics.risk_assessment.flight_risk === "low" ? "success" :
                                                    selectedRoundData.candidate_analytics.risk_assessment.flight_risk === "medium" ? "warning" : "danger"
                                                }>
                                                    {selectedRoundData.candidate_analytics.risk_assessment.flight_risk}
                                                </Badge>
                                            </div>
                                            <ul className="text-xs text-white/40 space-y-1">
                                                {selectedRoundData.candidate_analytics.risk_assessment.flight_risk_evidence.slice(0, 2).map((e, i) => (
                                                    <li key={i}>• {e}</li>
                                                ))}
                                            </ul>
                                        </div>
                                        <div className={`p-4 rounded-xl ${
                                            selectedRoundData.candidate_analytics.risk_assessment.performance_risk === "low" ? "bg-green-500/5 border border-green-500/10" :
                                            selectedRoundData.candidate_analytics.risk_assessment.performance_risk === "medium" ? "bg-yellow-500/5 border border-yellow-500/10" :
                                            "bg-red-500/5 border border-red-500/10"
                                        }`}>
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-sm text-white/50">Performance Risk</span>
                                                <Badge variant={
                                                    selectedRoundData.candidate_analytics.risk_assessment.performance_risk === "low" ? "success" :
                                                    selectedRoundData.candidate_analytics.risk_assessment.performance_risk === "medium" ? "warning" : "danger"
                                                }>
                                                    {selectedRoundData.candidate_analytics.risk_assessment.performance_risk}
                                                </Badge>
                                            </div>
                                            <ul className="text-xs text-white/40 space-y-1">
                                                {selectedRoundData.candidate_analytics.risk_assessment.performance_risk_evidence.slice(0, 2).map((e, i) => (
                                                    <li key={i}>• {e}</li>
                                                ))}
                                            </ul>
                                        </div>
                                        <div className={`p-4 rounded-xl ${
                                            selectedRoundData.candidate_analytics.risk_assessment.culture_fit_risk === "low" ? "bg-green-500/5 border border-green-500/10" :
                                            selectedRoundData.candidate_analytics.risk_assessment.culture_fit_risk === "medium" ? "bg-yellow-500/5 border border-yellow-500/10" :
                                            "bg-red-500/5 border border-red-500/10"
                                        }`}>
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-sm text-white/50">Culture Fit Risk</span>
                                                <Badge variant={
                                                    selectedRoundData.candidate_analytics.risk_assessment.culture_fit_risk === "low" ? "success" :
                                                    selectedRoundData.candidate_analytics.risk_assessment.culture_fit_risk === "medium" ? "warning" : "danger"
                                                }>
                                                    {selectedRoundData.candidate_analytics.risk_assessment.culture_fit_risk}
                                                </Badge>
                                            </div>
                                            <ul className="text-xs text-white/40 space-y-1">
                                                {selectedRoundData.candidate_analytics.risk_assessment.culture_fit_evidence.slice(0, 2).map((e, i) => (
                                                    <li key={i}>• {e}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    </div>
                                    {selectedRoundData.candidate_analytics.risk_assessment.verification_needed.length > 0 && (
                                        <div className="mt-4 p-4 rounded-xl bg-yellow-500/5 border border-yellow-500/10">
                                            <h5 className="text-sm font-medium text-yellow-400 mb-2 flex items-center gap-2">
                                                <Eye className="w-4 h-4" />
                                                Claims to Verify
                                            </h5>
                                            <ul className="text-sm text-white/60 space-y-1">
                                                {selectedRoundData.candidate_analytics.risk_assessment.verification_needed.map((v, i) => (
                                                    <li key={i}>• {v}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Best & Worst Answers */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {selectedRoundData.candidate_analytics.best_answer && (
                                    <div className="p-6 rounded-2xl bg-green-500/5 border border-green-500/10">
                                        <h4 className="font-medium text-green-400 mb-4 flex items-center gap-2">
                                            <Sparkles className="w-4 h-4" />
                                            Standout Moment
                                        </h4>
                                        {selectedRoundData.candidate_analytics.best_answer.question && (
                                            <p className="text-xs text-white/40 mb-2">Q: {selectedRoundData.candidate_analytics.best_answer.question}</p>
                                        )}
                                        <blockquote className="text-white/80 italic border-l-2 border-green-500 pl-4 mb-3">
                                            &ldquo;{selectedRoundData.candidate_analytics.best_answer.quote}&rdquo;
                                        </blockquote>
                                        <p className="text-sm text-white/50">
                                            {selectedRoundData.candidate_analytics.best_answer.why_impressive || selectedRoundData.candidate_analytics.best_answer.context}
                                        </p>
                                    </div>
                                )}
                                {selectedRoundData.candidate_analytics.worst_answer && (
                                    <div className="p-6 rounded-2xl bg-red-500/5 border border-red-500/10">
                                        <h4 className="font-medium text-red-400 mb-4 flex items-center gap-2">
                                            <AlertTriangle className="w-4 h-4" />
                                            Area of Concern
                                        </h4>
                                        <p className="text-xs text-white/40 mb-2">Q: {selectedRoundData.candidate_analytics.worst_answer.question}</p>
                                        <p className="text-white/70 mb-2">{selectedRoundData.candidate_analytics.worst_answer.issue}</p>
                                        <p className="text-sm text-white/50">Impact: {selectedRoundData.candidate_analytics.worst_answer.impact}</p>
                                    </div>
                                )}
                            </div>

                            {/* Q&A Analysis */}
                            {selectedRoundData.candidate_analytics.qa_pairs.length > 0 && (
                                <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.05]">
                                    <SectionHeader
                                        icon={MessageSquare}
                                        title="Question Analysis"
                                        subtitle={`${selectedRoundData.candidate_analytics.total_questions} questions analyzed`}
                                    />
                                    <div className="space-y-4">
                                        {selectedRoundData.candidate_analytics.qa_pairs.slice(0, 8).map((qa, i) => (
                                            <div key={i} className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.05] hover:border-white/10 transition-all">
                                                <div className="flex items-start gap-4">
                                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                                                        qa.question_type === "technical" ? "bg-blue-500/20" :
                                                        qa.question_type === "behavioral" ? "bg-purple-500/20" :
                                                        qa.question_type === "situational" ? "bg-orange-500/20" :
                                                        "bg-white/10"
                                                    }`}>
                                                        <span className="text-xs font-bold text-white/70">{i + 1}</span>
                                                    </div>
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <Badge variant={
                                                                qa.question_type === "technical" ? "info" :
                                                                qa.question_type === "behavioral" ? "default" :
                                                                "warning"
                                                            }>
                                                                {qa.question_type}
                                                            </Badge>
                                                            {qa.highlight && <Badge variant="success">Highlight</Badge>}
                                                            {qa.concern && <Badge variant="danger">Concern</Badge>}
                                                        </div>
                                                        <p className="text-white font-medium mb-2">{qa.question}</p>
                                                        <p className="text-sm text-white/50 mb-3">{qa.answer}</p>
                                                        <div className="flex flex-wrap gap-4 text-xs">
                                                            <div className="flex items-center gap-1">
                                                                <span className="text-white/30">Relevance:</span>
                                                                <span className={`font-medium ${qa.metrics.relevance >= 8 ? "text-green-400" : qa.metrics.relevance >= 6 ? "text-yellow-400" : "text-red-400"}`}>
                                                                    {qa.metrics.relevance}/10
                                                                </span>
                                                            </div>
                                                            <div className="flex items-center gap-1">
                                                                <span className="text-white/30">Clarity:</span>
                                                                <span className={`font-medium ${qa.metrics.clarity >= 8 ? "text-green-400" : qa.metrics.clarity >= 6 ? "text-yellow-400" : "text-red-400"}`}>
                                                                    {qa.metrics.clarity}/10
                                                                </span>
                                                            </div>
                                                            <div className="flex items-center gap-1">
                                                                <span className="text-white/30">Depth:</span>
                                                                <span className={`font-medium ${qa.metrics.depth >= 8 ? "text-green-400" : qa.metrics.depth >= 6 ? "text-yellow-400" : "text-red-400"}`}>
                                                                    {qa.metrics.depth}/10
                                                                </span>
                                                            </div>
                                                        </div>
                                                        {qa.star_breakdown && qa.question_type === "behavioral" && (
                                                            <div className="mt-3 p-3 rounded-lg bg-purple-500/5 border border-purple-500/10">
                                                                <div className="text-xs text-purple-400 mb-2 font-medium">STAR Breakdown</div>
                                                                <div className="grid grid-cols-4 gap-2 text-xs">
                                                                    <div className="text-center">
                                                                        <div className="text-white/40">Situation</div>
                                                                        <div className={`font-medium ${(qa.star_breakdown.situation || 0) >= 7 ? "text-green-400" : "text-yellow-400"}`}>
                                                                            {qa.star_breakdown.situation ?? "—"}
                                                                        </div>
                                                                    </div>
                                                                    <div className="text-center">
                                                                        <div className="text-white/40">Task</div>
                                                                        <div className={`font-medium ${(qa.star_breakdown.task || 0) >= 7 ? "text-green-400" : "text-yellow-400"}`}>
                                                                            {qa.star_breakdown.task ?? "—"}
                                                                        </div>
                                                                    </div>
                                                                    <div className="text-center">
                                                                        <div className="text-white/40">Action</div>
                                                                        <div className={`font-medium ${(qa.star_breakdown.action || 0) >= 7 ? "text-green-400" : "text-yellow-400"}`}>
                                                                            {qa.star_breakdown.action ?? "—"}
                                                                        </div>
                                                                    </div>
                                                                    <div className="text-center">
                                                                        <div className="text-white/40">Result</div>
                                                                        <div className={`font-medium ${(qa.star_breakdown.result || 0) >= 7 ? "text-green-400" : "text-yellow-400"}`}>
                                                                            {qa.star_breakdown.result ?? "—"}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ============================================================ */}
                    {/* INTERVIEWER ANALYTICS VIEW */}
                    {/* ============================================================ */}
                    {activeView === "interviewer" && selectedRoundData.interviewer_analytics && (
                        <div className="space-y-6">
                            {/* Detailed Assessment */}
                            {selectedRoundData.interviewer_analytics.detailed_assessment && (
                                <div className="p-6 rounded-2xl bg-gradient-to-br from-cyan-500/5 to-purple-500/5 border border-white/[0.05]">
                                    <SectionHeader icon={Brain} title="Performance Assessment" />
                                    <p className="text-white/70 leading-relaxed whitespace-pre-line">
                                        {selectedRoundData.interviewer_analytics.detailed_assessment}
                                    </p>
                                </div>
                            )}

                            {/* Core Scores */}
                            <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                                <div className="col-span-2 md:col-span-2 p-6 rounded-2xl bg-white/[0.02] border border-white/[0.05]">
                                    <ScoreRing score={selectedRoundData.interviewer_analytics.overall_score} size={100} strokeWidth={8} />
                                    <div className="text-center mt-2 text-sm text-white/50">Overall Score</div>
                                </div>
                                <MetricCard icon={HelpCircle} label="Question Quality" value={selectedRoundData.interviewer_analytics.question_quality_score} color={getScoreColor(selectedRoundData.interviewer_analytics.question_quality_score)} />
                                <MetricCard icon={Layers} label="Topic Coverage" value={selectedRoundData.interviewer_analytics.topic_coverage_score} color={getScoreColor(selectedRoundData.interviewer_analytics.topic_coverage_score)} />
                                <MetricCard icon={Scale} label="Bias Score" value={selectedRoundData.interviewer_analytics.bias_score} subvalue="lower is better" color={selectedRoundData.interviewer_analytics.bias_score < 30 ? "green" : selectedRoundData.interviewer_analytics.bias_score < 60 ? "yellow" : "red"} />
                                <MetricCard icon={Users} label="Candidate Exp." value={selectedRoundData.interviewer_analytics.candidate_experience_score} color={getScoreColor(selectedRoundData.interviewer_analytics.candidate_experience_score)} />
                            </div>

                            {/* Interviewer Performance Charts */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {/* Interviewer Metrics Radar */}
                                <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.05]">
                                    <h4 className="text-sm font-medium text-white/50 mb-4 flex items-center gap-2">
                                        <Target className="w-4 h-4" />
                                        Performance Radar
                                    </h4>
                                    <div className="h-48">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <RadarChart
                                                data={[
                                                    { metric: 'Question Quality', value: selectedRoundData.interviewer_analytics?.question_quality_score || 0 },
                                                    { metric: 'Topic Coverage', value: selectedRoundData.interviewer_analytics?.topic_coverage_score || 0 },
                                                    { metric: 'Consistency', value: selectedRoundData.interviewer_analytics?.consistency_score || 0 },
                                                    { metric: 'Candidate Exp.', value: selectedRoundData.interviewer_analytics?.candidate_experience_score || 0 },
                                                    { metric: 'Low Bias', value: 100 - (selectedRoundData.interviewer_analytics?.bias_score || 0) },
                                                ]}
                                                margin={{ top: 10, right: 30, bottom: 10, left: 30 }}
                                            >
                                                <PolarGrid stroke="rgba(255,255,255,0.1)" />
                                                <PolarAngleAxis
                                                    dataKey="metric"
                                                    tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 9 }}
                                                />
                                                <PolarRadiusAxis
                                                    angle={30}
                                                    domain={[0, 100]}
                                                    tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 9 }}
                                                    axisLine={false}
                                                />
                                                <Radar
                                                    name="Score"
                                                    dataKey="value"
                                                    stroke="#22d3ee"
                                                    fill="#22d3ee"
                                                    fillOpacity={0.3}
                                                    strokeWidth={2}
                                                />
                                            </RadarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>

                                {/* Topic Coverage Breakdown */}
                                {selectedRoundData.interviewer_analytics.topics_covered && (
                                    <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.05]">
                                        <h4 className="text-sm font-medium text-white/50 mb-4 flex items-center gap-2">
                                            <PieChartIcon className="w-4 h-4" />
                                            Topic Coverage
                                        </h4>
                                        <div className="h-48">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <PieChart>
                                                    <Pie
                                                        data={[
                                                            { name: 'Technical', value: selectedRoundData.interviewer_analytics.topics_covered.technical },
                                                            { name: 'Behavioral', value: selectedRoundData.interviewer_analytics.topics_covered.behavioral },
                                                            { name: 'Culture Fit', value: selectedRoundData.interviewer_analytics.topics_covered.culture_fit },
                                                            { name: 'Problem Solving', value: selectedRoundData.interviewer_analytics.topics_covered.problem_solving },
                                                        ]}
                                                        cx="50%"
                                                        cy="50%"
                                                        innerRadius={40}
                                                        outerRadius={70}
                                                        paddingAngle={3}
                                                        dataKey="value"
                                                    >
                                                        <Cell fill="#3b82f6" />
                                                        <Cell fill="#a855f7" />
                                                        <Cell fill="#22c55e" />
                                                        <Cell fill="#f59e0b" />
                                                    </Pie>
                                                    <Tooltip
                                                        contentStyle={{
                                                            backgroundColor: 'rgba(15, 15, 26, 0.95)',
                                                            border: '1px solid rgba(255,255,255,0.1)',
                                                            borderRadius: '12px',
                                                            color: 'white',
                                                        }}
                                                        formatter={(value: number) => [`${value}%`, '']}
                                                    />
                                                    <Legend
                                                        formatter={(value) => <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '11px' }}>{value}</span>}
                                                    />
                                                </PieChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Question Effectiveness Chart */}
                            {selectedRoundData.interviewer_analytics.question_effectiveness && selectedRoundData.interviewer_analytics.question_effectiveness.length > 0 && (
                                <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.05]">
                                    <h4 className="text-sm font-medium text-white/50 mb-4 flex items-center gap-2">
                                        <BarChart3 className="w-4 h-4" />
                                        Question Effectiveness
                                    </h4>
                                    <div className="h-48">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart
                                                data={selectedRoundData.interviewer_analytics.question_effectiveness.slice(0, 8).map((q, i) => ({
                                                    name: `Q${i + 1}`,
                                                    Effectiveness: q.effectiveness_score,
                                                    fullQuestion: q.question,
                                                }))}
                                                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                                            >
                                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                                <XAxis
                                                    dataKey="name"
                                                    tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }}
                                                    axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                                                />
                                                <YAxis
                                                    domain={[0, 100]}
                                                    tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }}
                                                    axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                                                />
                                                <Tooltip
                                                    contentStyle={{
                                                        backgroundColor: 'rgba(15, 15, 26, 0.95)',
                                                        border: '1px solid rgba(255,255,255,0.1)',
                                                        borderRadius: '12px',
                                                        color: 'white',
                                                    }}
                                                    cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                                                    formatter={(value: number, name: string, props: { payload?: { fullQuestion?: string } }) => [
                                                        `${value}%`,
                                                        props.payload?.fullQuestion?.slice(0, 50) + '...' || name
                                                    ]}
                                                />
                                                <Bar
                                                    dataKey="Effectiveness"
                                                    fill="#22d3ee"
                                                    radius={[4, 4, 0, 0]}
                                                />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            )}

                            {/* Interview Dynamics */}
                            {selectedRoundData.interviewer_analytics.interview_dynamics && (
                                <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.05]">
                                    <SectionHeader icon={Activity} title="Interview Dynamics" />
                                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                                        <div className="p-4 rounded-xl bg-white/5">
                                            <div className="text-xs text-white/40 mb-1">Time Management</div>
                                            <div className={`text-2xl font-bold ${getScoreColor(selectedRoundData.interviewer_analytics.interview_dynamics.time_management) === "green" ? "text-green-400" : getScoreColor(selectedRoundData.interviewer_analytics.interview_dynamics.time_management) === "yellow" ? "text-yellow-400" : "text-red-400"}`}>
                                                {selectedRoundData.interviewer_analytics.interview_dynamics.time_management}
                                            </div>
                                        </div>
                                        <div className="p-4 rounded-xl bg-white/5">
                                            <div className="text-xs text-white/40 mb-1">Active Listening</div>
                                            <div className={`text-2xl font-bold ${getScoreColor(selectedRoundData.interviewer_analytics.interview_dynamics.active_listening_score) === "green" ? "text-green-400" : getScoreColor(selectedRoundData.interviewer_analytics.interview_dynamics.active_listening_score) === "yellow" ? "text-yellow-400" : "text-red-400"}`}>
                                                {selectedRoundData.interviewer_analytics.interview_dynamics.active_listening_score}
                                            </div>
                                        </div>
                                        <div className="p-4 rounded-xl bg-white/5">
                                            <div className="text-xs text-white/40 mb-1">Rapport Building</div>
                                            <div className={`text-2xl font-bold ${getScoreColor(selectedRoundData.interviewer_analytics.interview_dynamics.rapport_building) === "green" ? "text-green-400" : getScoreColor(selectedRoundData.interviewer_analytics.interview_dynamics.rapport_building) === "yellow" ? "text-yellow-400" : "text-red-400"}`}>
                                                {selectedRoundData.interviewer_analytics.interview_dynamics.rapport_building}
                                            </div>
                                        </div>
                                        <div className="p-4 rounded-xl bg-white/5">
                                            <div className="text-xs text-white/40 mb-1">Interruptions</div>
                                            <div className={`text-2xl font-bold ${selectedRoundData.interviewer_analytics.interview_dynamics.interruption_count === 0 ? "text-green-400" : selectedRoundData.interviewer_analytics.interview_dynamics.interruption_count <= 2 ? "text-yellow-400" : "text-red-400"}`}>
                                                {selectedRoundData.interviewer_analytics.interview_dynamics.interruption_count}
                                            </div>
                                        </div>
                                        <div className="p-4 rounded-xl bg-white/5">
                                            <div className="text-xs text-white/40 mb-1">Pacing</div>
                                            <div className="text-lg font-bold text-white capitalize">
                                                {selectedRoundData.interviewer_analytics.interview_dynamics.avg_response_wait_time.replace("_", " ")}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Missed Opportunities */}
                            {selectedRoundData.interviewer_analytics.missed_opportunities && selectedRoundData.interviewer_analytics.missed_opportunities.length > 0 && (
                                <div className="p-6 rounded-2xl bg-yellow-500/5 border border-yellow-500/10">
                                    <SectionHeader icon={Eye} title="Missed Opportunities" subtitle="Moments that warranted deeper probing" />
                                    <div className="space-y-4">
                                        {selectedRoundData.interviewer_analytics.missed_opportunities.map((opp, i) => (
                                            <div key={i} className="p-4 rounded-xl bg-black/20">
                                                <div className="font-medium text-yellow-400 mb-2">{opp.topic}</div>
                                                <p className="text-sm text-white/50 mb-2 italic">&ldquo;{opp.candidate_statement}&rdquo;</p>
                                                <div className="flex items-start gap-2 text-sm">
                                                    <Lightbulb className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" />
                                                    <span className="text-white/70">Suggested: {opp.suggested_followup}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Coverage Gaps */}
                            {selectedRoundData.interviewer_analytics.coverage_gaps && selectedRoundData.interviewer_analytics.coverage_gaps.length > 0 && (
                                <div className="p-6 rounded-2xl bg-red-500/5 border border-red-500/10">
                                    <SectionHeader icon={AlertTriangle} title="Coverage Gaps" subtitle="Critical areas not explored" />
                                    <div className="flex flex-wrap gap-2">
                                        {selectedRoundData.interviewer_analytics.coverage_gaps.map((gap, i) => (
                                            <Badge key={i} variant="danger">{gap}</Badge>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Strengths & Improvements */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {selectedRoundData.interviewer_analytics.interviewer_strengths && selectedRoundData.interviewer_analytics.interviewer_strengths.length > 0 && (
                                    <div className="p-6 rounded-2xl bg-green-500/5 border border-green-500/10">
                                        <h4 className="font-medium text-green-400 mb-4 flex items-center gap-2">
                                            <Star className="w-4 h-4" />
                                            Interviewer Strengths
                                        </h4>
                                        <ul className="space-y-2">
                                            {selectedRoundData.interviewer_analytics.interviewer_strengths.map((s, i) => (
                                                <li key={i} className="text-sm text-white/70 flex items-start gap-2">
                                                    <CheckCircle className="w-4 h-4 text-green-400 shrink-0 mt-0.5" />
                                                    {s}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                                {selectedRoundData.interviewer_analytics.improvement_suggestions.length > 0 && (
                                    <div className="p-6 rounded-2xl bg-cyan-500/5 border border-cyan-500/10">
                                        <h4 className="font-medium text-cyan-400 mb-4 flex items-center gap-2">
                                            <Lightbulb className="w-4 h-4" />
                                            Improvement Suggestions
                                        </h4>
                                        <ul className="space-y-2">
                                            {selectedRoundData.interviewer_analytics.improvement_suggestions.map((s, i) => (
                                                <li key={i} className="text-sm text-white/70 flex items-start gap-2">
                                                    <ArrowUpRight className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                                                    {s}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* No Interviewer Analytics - Show regeneration UI */}
                    {activeView === "interviewer" && !selectedRoundData.interviewer_analytics && (
                        <div className="flex flex-col items-center justify-center py-16">
                            <div className="w-20 h-20 rounded-full bg-cyan-500/10 flex items-center justify-center mb-6">
                                <UserCircle className="w-10 h-10 text-cyan-400/50" />
                            </div>
                            <h3 className="text-xl font-medium text-white mb-2">No Interviewer Analytics</h3>
                            <p className="text-white/40 text-sm text-center max-w-md mb-8">
                                Interviewer analytics weren&apos;t generated for this round. Select an interviewer below to generate them now.
                            </p>

                            {/* Regeneration Form */}
                            <div className="w-full max-w-md p-6 rounded-2xl bg-white/[0.02] border border-white/[0.05]">
                                <h4 className="text-sm font-medium text-white/70 mb-4">Generate Interviewer Analytics</h4>

                                <div className="space-y-4">
                                    <div>
                                        <label className="text-xs text-white/40 mb-2 block">Select Interviewer</label>
                                        <select
                                            value={selectedInterviewerForRegen}
                                            onChange={(e) => setSelectedInterviewerForRegen(e.target.value)}
                                            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-cyan-500/50 transition-colors"
                                        >
                                            <option value="" className="bg-[#1a1a2e]">Choose interviewer...</option>
                                            {interviewers.map((int) => (
                                                <option key={int.id} value={int.id} className="bg-[#1a1a2e]">
                                                    {int.name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    {regenError && (
                                        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-2">
                                            <AlertCircle className="w-4 h-4" />
                                            {regenError}
                                        </div>
                                    )}

                                    <button
                                        onClick={() => {
                                            if (selectedInterviewerForRegen && selectedRound) {
                                                regenerateInterviewerAnalytics(selectedRound, selectedInterviewerForRegen);
                                            }
                                        }}
                                        disabled={!selectedInterviewerForRegen || regenerating}
                                        className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-600 to-purple-600 text-white font-medium hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                    >
                                        {regenerating ? (
                                            <>
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                Generating Analytics...
                                            </>
                                        ) : (
                                            <>
                                                <Brain className="w-4 h-4" />
                                                Generate Interviewer Analytics
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* No Analytics for Selected Round */}
            {selectedRoundData && !selectedRoundData.candidate_analytics && !selectedRoundData.interviewer_analytics && (
                <div className="flex flex-col items-center justify-center py-20">
                    <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
                        <BarChart3 className="w-8 h-8 text-white/20" />
                    </div>
                    <h3 className="text-lg font-medium text-white/60 mb-2">No Analytics Yet</h3>
                    <p className="text-white/40 text-sm text-center max-w-md">
                        Upload a transcript and generate analytics to see comprehensive insights for this round.
                    </p>
                </div>
            )}
        </div>
    );
}
