"use client";

import { useState, useEffect } from "react";
import {
    BarChart3,
    TrendingUp,
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
} from "lucide-react";

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
    highlight?: string;
}

interface RoundAnalytics {
    interview_id: string;
    stage: string;
    status: string;
    interviewer_name: string | null;
    interviewer_id: string | null;
    created_at: string | null;
    candidate_analytics: {
        overall_score: number;
        communication_score: number;
        technical_score: number;
        cultural_fit_score: number;
        recommendation: string;
        recommendation_reasoning: string;
        confidence: number;
        red_flags: string[];
        highlights: string[];
        total_questions: number;
        qa_pairs: QAPair[];
        best_answer: { quote: string; context: string } | null;
        quotable_moment: string | null;
    } | null;
    interviewer_analytics: {
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
        improvement_suggestions: string[];
        summary_line: string;
    } | null;
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

export default function CandidateAnalytics({ candidateId, candidateName }: CandidateAnalyticsProps) {
    const [data, setData] = useState<AnalyticsData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [expandedRound, setExpandedRound] = useState<string | null>(null);
    const [activeSubTab, setActiveSubTab] = useState<Record<string, 'candidate' | 'interviewer'>>({});
    const [dbCandidateId, setDbCandidateId] = useState<string | null>(null);

    useEffect(() => {
        fetchAnalytics();
    }, [candidateId, candidateName]);

    const fetchAnalytics = async () => {
        setLoading(true);
        setError(null);

        try {
            // Check if candidateId is a UUID or a simple ID (like "0", "1", etc.)
            const isUuid = candidateId.length === 36 && candidateId.includes('-');
            let effectiveId = candidateId;

            // If not a UUID, lookup the database ID by candidate name
            if (!isUuid && candidateName) {
                try {
                    const lookupRes = await fetch(`${API_URL}/api/interviews/lookup-by-name/${encodeURIComponent(candidateName)}`);
                    if (lookupRes.ok) {
                        const lookupData = await lookupRes.json();
                        effectiveId = lookupData.db_id;
                        setDbCandidateId(effectiveId);
                    } else {
                        setError("Candidate not found in database");
                        setLoading(false);
                        return;
                    }
                } catch (lookupErr) {
                    setError("Failed to lookup candidate");
                    setLoading(false);
                    return;
                }
            } else {
                setDbCandidateId(candidateId);
            }

            const url = `${API_URL}/api/interviews/candidate/${effectiveId}/all-analytics`;
            const res = await fetch(url);
            if (!res.ok) throw new Error("Failed to fetch analytics");
            const result = await res.json();
            setData(result);

            // Auto-expand first round with analytics
            const firstWithAnalytics = result.rounds?.find((r: RoundAnalytics) => r.candidate_analytics);
            if (firstWithAnalytics) {
                setExpandedRound(firstWithAnalytics.interview_id);
                setActiveSubTab({ [firstWithAnalytics.interview_id]: 'candidate' });
            }
        } catch (e) {
            setError(e instanceof Error ? e.message : "Failed to load analytics");
        } finally {
            setLoading(false);
        }
    };

    const getScoreColor = (score: number) => {
        if (score >= 80) return "text-green-400";
        if (score >= 60) return "text-yellow-400";
        return "text-red-400";
    };

    const getScoreBgColor = (score: number) => {
        if (score >= 80) return "bg-green-500/20 border-green-500/30";
        if (score >= 60) return "bg-yellow-500/20 border-yellow-500/30";
        return "bg-red-500/20 border-red-500/30";
    };

    const getRecommendationStyle = (rec: string) => {
        if (rec.includes("Strong Hire") || rec === "Hire") {
            return "bg-green-500/20 text-green-400 border-green-500/30";
        }
        if (rec.includes("Leaning Hire")) {
            return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
        }
        return "bg-red-500/20 text-red-400 border-red-500/30";
    };

    const formatStage = (stage: string) => {
        return stage.replace("_", " ").replace(/\b\w/g, l => l.toUpperCase());
    };

    const getBiasSeverityColor = (severity: string) => {
        switch (severity) {
            case 'none': return 'text-green-400 bg-green-500/20';
            case 'low': return 'text-yellow-400 bg-yellow-500/20';
            case 'medium': return 'text-orange-400 bg-orange-500/20';
            case 'high': return 'text-red-400 bg-red-500/20';
            default: return 'text-white/40 bg-white/10';
        }
    };

    const toggleRound = (roundId: string) => {
        if (expandedRound === roundId) {
            setExpandedRound(null);
        } else {
            setExpandedRound(roundId);
            if (!activeSubTab[roundId]) {
                setActiveSubTab(prev => ({ ...prev, [roundId]: 'candidate' }));
            }
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="text-center py-20">
                <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
                <p className="text-red-400">{error}</p>
                <button
                    onClick={fetchAnalytics}
                    className="mt-4 px-4 py-2 bg-white/10 rounded-lg hover:bg-white/20 transition"
                >
                    Retry
                </button>
            </div>
        );
    }

    if (!data || data.rounds.length === 0) {
        return (
            <div className="text-center py-20">
                <BarChart3 className="w-12 h-12 text-white/20 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-white/60 mb-2">No Analytics Yet</h3>
                <p className="text-white/40 text-sm">
                    Complete interviews and generate analytics to see insights here.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {/* Cumulative Analytics Section */}
            {data.cumulative && (
                <div className="glass-panel rounded-3xl p-8 border border-purple-500/20 bg-gradient-to-br from-purple-500/5 to-cyan-500/5">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500/30 to-cyan-500/30 flex items-center justify-center">
                            <Award className="w-6 h-6 text-purple-400" />
                        </div>
                        <div>
                            <h3 className="text-xl font-semibold text-white">Cumulative Analytics</h3>
                            <p className="text-sm text-white/50">
                                Aggregated from {data.cumulative.rounds_with_analytics} of {data.cumulative.total_rounds} rounds
                            </p>
                        </div>
                    </div>

                    {/* Main Score & Recommendation */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                        {/* Overall Score */}
                        <div className={`rounded-2xl p-6 border ${getScoreBgColor(data.cumulative.avg_overall_score)}`}>
                            <div className="text-center">
                                <div className={`text-5xl font-bold ${getScoreColor(data.cumulative.avg_overall_score)}`}>
                                    {Math.round(data.cumulative.avg_overall_score)}
                                </div>
                                <div className="text-white/50 text-sm mt-1">Average Score</div>
                            </div>
                        </div>

                        {/* Final Recommendation */}
                        <div className={`rounded-2xl p-6 border ${getRecommendationStyle(data.cumulative.final_recommendation)}`}>
                            <div className="text-center">
                                <div className="flex items-center justify-center gap-2 mb-2">
                                    {data.cumulative.final_recommendation.includes("Hire") && !data.cumulative.final_recommendation.includes("No") ? (
                                        <CheckCircle className="w-8 h-8" />
                                    ) : (
                                        <XCircle className="w-8 h-8" />
                                    )}
                                </div>
                                <div className="text-lg font-bold">{data.cumulative.final_recommendation}</div>
                                <div className="text-white/50 text-sm mt-1">Final Recommendation</div>
                            </div>
                        </div>

                        {/* Questions Asked */}
                        <div className="rounded-2xl p-6 border border-white/10 bg-white/5">
                            <div className="text-center">
                                <div className="text-5xl font-bold text-cyan-400">
                                    {data.cumulative.total_questions_asked}
                                </div>
                                <div className="text-white/50 text-sm mt-1">Total Questions</div>
                            </div>
                        </div>
                    </div>

                    {/* Skill Scores */}
                    <div className="grid grid-cols-3 gap-4 mb-8">
                        <div className="text-center p-4 rounded-xl bg-white/5">
                            <div className={`text-2xl font-bold ${getScoreColor(data.cumulative.avg_communication_score * 10)}`}>
                                {data.cumulative.avg_communication_score.toFixed(1)}/10
                            </div>
                            <div className="text-white/40 text-xs mt-1">Communication</div>
                        </div>
                        <div className="text-center p-4 rounded-xl bg-white/5">
                            <div className={`text-2xl font-bold ${getScoreColor(data.cumulative.avg_technical_score * 10)}`}>
                                {data.cumulative.avg_technical_score.toFixed(1)}/10
                            </div>
                            <div className="text-white/40 text-xs mt-1">Technical</div>
                        </div>
                        <div className="text-center p-4 rounded-xl bg-white/5">
                            <div className={`text-2xl font-bold ${getScoreColor(data.cumulative.avg_cultural_fit_score * 10)}`}>
                                {data.cumulative.avg_cultural_fit_score.toFixed(1)}/10
                            </div>
                            <div className="text-white/40 text-xs mt-1">Cultural Fit</div>
                        </div>
                    </div>

                    {/* Score Trend */}
                    {data.cumulative.score_trend.length > 1 && (
                        <div className="mb-8">
                            <h4 className="text-sm font-medium text-white/60 mb-3 flex items-center gap-2">
                                <TrendingUp className="w-4 h-4" />
                                Score Trend Across Rounds
                            </h4>
                            <div className="flex items-end gap-2 h-20">
                                {data.cumulative.score_trend.map((score, i) => (
                                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                                        <div
                                            className={`w-full rounded-t transition-all ${score >= 80 ? 'bg-green-500' : score >= 60 ? 'bg-yellow-500' : 'bg-red-500'}`}
                                            style={{ height: `${(score / 100) * 80}px` }}
                                        />
                                        <span className="text-[10px] text-white/40">R{i + 1}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Highlights & Red Flags */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {data.cumulative.key_highlights.length > 0 && (
                            <div className="rounded-2xl p-5 bg-green-500/5 border border-green-500/20">
                                <h4 className="font-medium text-green-400 mb-3 flex items-center gap-2">
                                    <Star className="w-4 h-4" />
                                    Key Highlights
                                </h4>
                                <ul className="space-y-2">
                                    {data.cumulative.key_highlights.slice(0, 5).map((h, i) => (
                                        <li key={i} className="text-sm text-white/70 flex items-start gap-2">
                                            <CheckCircle className="w-4 h-4 text-green-400 shrink-0 mt-0.5" />
                                            {h}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                        {data.cumulative.key_red_flags.length > 0 && (
                            <div className="rounded-2xl p-5 bg-red-500/5 border border-red-500/20">
                                <h4 className="font-medium text-red-400 mb-3 flex items-center gap-2">
                                    <Flag className="w-4 h-4" />
                                    Red Flags
                                </h4>
                                <ul className="space-y-2">
                                    {data.cumulative.key_red_flags.slice(0, 5).map((rf, i) => (
                                        <li key={i} className="text-sm text-white/70 flex items-start gap-2">
                                            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                                            {rf}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Per-Round Analytics */}
            <div>
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <Target className="w-5 h-5 text-cyan-400" />
                    Per-Round Analytics
                </h3>

                <div className="space-y-4">
                    {data.rounds.map((round) => (
                        <div
                            key={round.interview_id}
                            className="glass-panel rounded-2xl overflow-hidden border border-white/10"
                        >
                            {/* Round Header */}
                            <button
                                onClick={() => toggleRound(round.interview_id)}
                                className="w-full p-5 flex items-center justify-between hover:bg-white/5 transition"
                            >
                                <div className="flex items-center gap-4">
                                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                                        round.candidate_analytics
                                            ? getScoreBgColor(round.candidate_analytics.overall_score)
                                            : 'bg-white/5 border border-white/10'
                                    }`}>
                                        {round.candidate_analytics ? (
                                            <span className={`text-lg font-bold ${getScoreColor(round.candidate_analytics.overall_score)}`}>
                                                {round.candidate_analytics.overall_score}
                                            </span>
                                        ) : (
                                            <BarChart3 className="w-5 h-5 text-white/30" />
                                        )}
                                    </div>
                                    <div className="text-left">
                                        <div className="font-medium text-white">{formatStage(round.stage)}</div>
                                        <div className="text-sm text-white/40">
                                            {round.interviewer_name || "No interviewer"} •{" "}
                                            {round.status}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    {round.candidate_analytics && (
                                        <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getRecommendationStyle(round.candidate_analytics.recommendation)}`}>
                                            {round.candidate_analytics.recommendation}
                                        </span>
                                    )}
                                    {!round.candidate_analytics && (
                                        <span className="px-3 py-1 rounded-full text-xs bg-white/10 text-white/40">
                                            No Analytics
                                        </span>
                                    )}
                                    {expandedRound === round.interview_id ? (
                                        <ChevronDown className="w-5 h-5 text-white/40" />
                                    ) : (
                                        <ChevronRight className="w-5 h-5 text-white/40" />
                                    )}
                                </div>
                            </button>

                            {/* Expanded Content */}
                            {expandedRound === round.interview_id && (round.candidate_analytics || round.interviewer_analytics) && (
                                <div className="border-t border-white/5 animate-fadeIn">
                                    {/* Sub-tabs for Candidate / Interviewer */}
                                    <div className="px-6 pt-4 flex gap-2">
                                        <button
                                            onClick={() => setActiveSubTab(prev => ({ ...prev, [round.interview_id]: 'candidate' }))}
                                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                                                activeSubTab[round.interview_id] === 'candidate'
                                                    ? 'bg-purple-600 text-white'
                                                    : 'bg-white/5 text-white/60 hover:bg-white/10'
                                            }`}
                                        >
                                            <User className="w-4 h-4" />
                                            Candidate Analytics
                                        </button>
                                        <button
                                            onClick={() => setActiveSubTab(prev => ({ ...prev, [round.interview_id]: 'interviewer' }))}
                                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                                                activeSubTab[round.interview_id] === 'interviewer'
                                                    ? 'bg-cyan-600 text-white'
                                                    : 'bg-white/5 text-white/60 hover:bg-white/10'
                                            }`}
                                        >
                                            <UserCircle className="w-4 h-4" />
                                            Interviewer Analytics
                                        </button>
                                    </div>

                                    {/* Candidate Analytics Tab Content */}
                                    {activeSubTab[round.interview_id] === 'candidate' && round.candidate_analytics && (
                                        <div className="p-6 space-y-8">
                                            {/* Recommendation & Reasoning */}
                                            <div className="p-5 rounded-2xl bg-gradient-to-br from-purple-500/10 to-transparent border border-purple-500/20">
                                                <div className="flex items-start gap-4">
                                                    <div className={`p-3 rounded-xl border ${getRecommendationStyle(round.candidate_analytics.recommendation)}`}>
                                                        {round.candidate_analytics.recommendation.includes("Hire") && !round.candidate_analytics.recommendation.includes("No") ? (
                                                            <ThumbsUp className="w-6 h-6" />
                                                        ) : (
                                                            <AlertTriangle className="w-6 h-6" />
                                                        )}
                                                    </div>
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-3 mb-2">
                                                            <span className={`text-xl font-bold ${getScoreColor(round.candidate_analytics.overall_score)}`}>
                                                                {round.candidate_analytics.recommendation}
                                                            </span>
                                                            <span className="text-sm text-white/40">
                                                                {round.candidate_analytics.confidence}% confidence
                                                            </span>
                                                        </div>
                                                        <p className="text-white/70 italic">
                                                            &ldquo;{round.candidate_analytics.recommendation_reasoning}&rdquo;
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Core Scores Grid */}
                                            <div>
                                                <h5 className="text-sm font-medium text-white/60 mb-4 flex items-center gap-2">
                                                    <BarChart3 className="w-4 h-4" />
                                                    Performance Scores
                                                </h5>
                                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                                    <div className={`text-center p-4 rounded-xl border ${getScoreBgColor(round.candidate_analytics.overall_score)}`}>
                                                        <div className={`text-3xl font-bold ${getScoreColor(round.candidate_analytics.overall_score)}`}>
                                                            {round.candidate_analytics.overall_score}
                                                        </div>
                                                        <div className="text-white/50 text-xs mt-1">Overall</div>
                                                    </div>
                                                    <div className="text-center p-4 rounded-xl bg-white/5 border border-white/10">
                                                        <div className={`text-3xl font-bold ${getScoreColor(round.candidate_analytics.communication_score * 10)}`}>
                                                            {round.candidate_analytics.communication_score}
                                                        </div>
                                                        <div className="text-white/50 text-xs mt-1">Communication</div>
                                                    </div>
                                                    <div className="text-center p-4 rounded-xl bg-white/5 border border-white/10">
                                                        <div className={`text-3xl font-bold ${getScoreColor(round.candidate_analytics.technical_score * 10)}`}>
                                                            {round.candidate_analytics.technical_score}
                                                        </div>
                                                        <div className="text-white/50 text-xs mt-1">Technical</div>
                                                    </div>
                                                    <div className="text-center p-4 rounded-xl bg-white/5 border border-white/10">
                                                        <div className={`text-3xl font-bold ${getScoreColor(round.candidate_analytics.cultural_fit_score * 10)}`}>
                                                            {round.candidate_analytics.cultural_fit_score}
                                                        </div>
                                                        <div className="text-white/50 text-xs mt-1">Cultural Fit</div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Highlights & Red Flags */}
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                {round.candidate_analytics.highlights.length > 0 && (
                                                    <div className="p-5 rounded-2xl bg-green-500/5 border border-green-500/20">
                                                        <h5 className="font-medium text-green-400 mb-3 flex items-center gap-2">
                                                            <Star className="w-4 h-4" />
                                                            Highlights ({round.candidate_analytics.highlights.length})
                                                        </h5>
                                                        <ul className="space-y-2">
                                                            {round.candidate_analytics.highlights.map((h, i) => (
                                                                <li key={i} className="text-sm text-white/70 flex items-start gap-2">
                                                                    <CheckCircle className="w-4 h-4 text-green-400 shrink-0 mt-0.5" />
                                                                    {h}
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                )}
                                                {round.candidate_analytics.red_flags.length > 0 && (
                                                    <div className="p-5 rounded-2xl bg-red-500/5 border border-red-500/20">
                                                        <h5 className="font-medium text-red-400 mb-3 flex items-center gap-2">
                                                            <Flag className="w-4 h-4" />
                                                            Red Flags ({round.candidate_analytics.red_flags.length})
                                                        </h5>
                                                        <ul className="space-y-2">
                                                            {round.candidate_analytics.red_flags.map((rf, i) => (
                                                                <li key={i} className="text-sm text-white/70 flex items-start gap-2">
                                                                    <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                                                                    {rf}
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Best Answer */}
                                            {round.candidate_analytics.best_answer && (
                                                <div className="p-5 rounded-2xl bg-purple-500/5 border border-purple-500/20">
                                                    <h5 className="font-medium text-purple-400 mb-3 flex items-center gap-2">
                                                        <Sparkles className="w-4 h-4" />
                                                        Best Answer
                                                    </h5>
                                                    <blockquote className="text-white/80 italic border-l-2 border-purple-500 pl-4 mb-2">
                                                        &ldquo;{round.candidate_analytics.best_answer.quote}&rdquo;
                                                    </blockquote>
                                                    <p className="text-sm text-white/50">
                                                        {round.candidate_analytics.best_answer.context}
                                                    </p>
                                                </div>
                                            )}

                                            {/* Quotable Moment */}
                                            {round.candidate_analytics.quotable_moment && (
                                                <div className="p-4 rounded-xl bg-cyan-500/10 border border-cyan-500/20">
                                                    <p className="text-cyan-300 text-sm flex items-start gap-2">
                                                        <MessageSquare className="w-4 h-4 shrink-0 mt-0.5" />
                                                        <span className="italic">&ldquo;{round.candidate_analytics.quotable_moment}&rdquo;</span>
                                                    </p>
                                                </div>
                                            )}

                                            {/* Q&A Analysis */}
                                            {round.candidate_analytics.qa_pairs.length > 0 && (
                                                <div>
                                                    <h5 className="font-medium text-white/60 mb-4 flex items-center gap-2">
                                                        <MessageSquare className="w-4 h-4" />
                                                        Q&A Analysis ({round.candidate_analytics.total_questions} questions)
                                                    </h5>
                                                    <div className="space-y-4">
                                                        {round.candidate_analytics.qa_pairs.map((qa, i) => (
                                                            <div key={i} className="p-4 rounded-xl bg-white/5 border border-white/10">
                                                                <div className="flex items-start justify-between gap-4 mb-3">
                                                                    <div className="flex-1">
                                                                        <span className={`text-xs px-2 py-0.5 rounded-full mb-2 inline-block ${
                                                                            qa.question_type === 'technical' ? 'bg-blue-500/20 text-blue-400' :
                                                                            qa.question_type === 'behavioral' ? 'bg-purple-500/20 text-purple-400' :
                                                                            qa.question_type === 'situational' ? 'bg-orange-500/20 text-orange-400' :
                                                                            'bg-white/10 text-white/60'
                                                                        }`}>
                                                                            {qa.question_type}
                                                                        </span>
                                                                        <p className="text-white font-medium">Q: {qa.question}</p>
                                                                    </div>
                                                                </div>
                                                                <p className="text-white/60 text-sm mb-3">A: {qa.answer}</p>
                                                                <div className="flex gap-4 text-xs">
                                                                    <div className="flex items-center gap-1">
                                                                        <span className="text-white/40">Relevance:</span>
                                                                        <span className={getScoreColor(qa.metrics.relevance * 10)}>{qa.metrics.relevance}/10</span>
                                                                    </div>
                                                                    <div className="flex items-center gap-1">
                                                                        <span className="text-white/40">Clarity:</span>
                                                                        <span className={getScoreColor(qa.metrics.clarity * 10)}>{qa.metrics.clarity}/10</span>
                                                                    </div>
                                                                    <div className="flex items-center gap-1">
                                                                        <span className="text-white/40">Depth:</span>
                                                                        <span className={getScoreColor(qa.metrics.depth * 10)}>{qa.metrics.depth}/10</span>
                                                                    </div>
                                                                </div>
                                                                {qa.highlight && (
                                                                    <div className="mt-2 text-xs text-yellow-400 italic">
                                                                        ✨ {qa.highlight}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Interviewer Analytics Tab Content */}
                                    {activeSubTab[round.interview_id] === 'interviewer' && round.interviewer_analytics && (
                                        <div className="p-6 space-y-8">
                                            {/* Summary */}
                                            {round.interviewer_analytics.summary_line && (
                                                <div className="p-5 rounded-2xl bg-gradient-to-br from-cyan-500/10 to-transparent border border-cyan-500/20">
                                                    <div className="flex items-start gap-4">
                                                        <div className="p-3 rounded-xl bg-cyan-500/20">
                                                            <Brain className="w-6 h-6 text-cyan-400" />
                                                        </div>
                                                        <div>
                                                            <h5 className="text-sm font-medium text-cyan-400 mb-1">Performance Summary</h5>
                                                            <p className="text-white/70">
                                                                {round.interviewer_analytics.summary_line}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Core Scores Grid */}
                                            <div>
                                                <h5 className="text-sm font-medium text-white/60 mb-4 flex items-center gap-2">
                                                    <BarChart3 className="w-4 h-4" />
                                                    Interviewer Scores
                                                </h5>
                                                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                                    <div className={`text-center p-4 rounded-xl border ${getScoreBgColor(round.interviewer_analytics.overall_score)}`}>
                                                        <div className={`text-3xl font-bold ${getScoreColor(round.interviewer_analytics.overall_score)}`}>
                                                            {round.interviewer_analytics.overall_score}
                                                        </div>
                                                        <div className="text-white/50 text-xs mt-1">Overall</div>
                                                    </div>
                                                    <div className="text-center p-4 rounded-xl bg-white/5 border border-white/10">
                                                        <div className={`text-3xl font-bold ${getScoreColor(round.interviewer_analytics.question_quality_score)}`}>
                                                            {round.interviewer_analytics.question_quality_score}
                                                        </div>
                                                        <div className="text-white/50 text-xs mt-1">Question Quality</div>
                                                    </div>
                                                    <div className="text-center p-4 rounded-xl bg-white/5 border border-white/10">
                                                        <div className={`text-3xl font-bold ${getScoreColor(round.interviewer_analytics.topic_coverage_score)}`}>
                                                            {round.interviewer_analytics.topic_coverage_score}
                                                        </div>
                                                        <div className="text-white/50 text-xs mt-1">Topic Coverage</div>
                                                    </div>
                                                    <div className="text-center p-4 rounded-xl bg-white/5 border border-white/10">
                                                        <div className={`text-3xl font-bold ${getScoreColor(round.interviewer_analytics.consistency_score)}`}>
                                                            {round.interviewer_analytics.consistency_score}
                                                        </div>
                                                        <div className="text-white/50 text-xs mt-1">Consistency</div>
                                                    </div>
                                                    <div className="text-center p-4 rounded-xl bg-white/5 border border-white/10">
                                                        <div className={`text-3xl font-bold ${round.interviewer_analytics.bias_score < 30 ? 'text-green-400' : round.interviewer_analytics.bias_score < 60 ? 'text-yellow-400' : 'text-red-400'}`}>
                                                            {round.interviewer_analytics.bias_score}
                                                        </div>
                                                        <div className="text-white/50 text-xs mt-1">Bias Score</div>
                                                        <div className="text-[10px] text-white/30">(lower is better)</div>
                                                    </div>
                                                    <div className="text-center p-4 rounded-xl bg-white/5 border border-white/10">
                                                        <div className={`text-3xl font-bold ${getScoreColor(round.interviewer_analytics.candidate_experience_score)}`}>
                                                            {round.interviewer_analytics.candidate_experience_score}
                                                        </div>
                                                        <div className="text-white/50 text-xs mt-1">Candidate Experience</div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Question Quality Breakdown */}
                                            {round.interviewer_analytics.question_quality_breakdown && (
                                                <div>
                                                    <h5 className="text-sm font-medium text-white/60 mb-4 flex items-center gap-2">
                                                        <HelpCircle className="w-4 h-4" />
                                                        Question Quality Breakdown
                                                    </h5>
                                                    <div className="grid grid-cols-3 gap-4">
                                                        <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                                                            <div className="flex justify-between items-center mb-2">
                                                                <span className="text-white/60 text-sm">Relevance</span>
                                                                <span className={`font-bold ${getScoreColor(round.interviewer_analytics.question_quality_breakdown.relevance)}`}>
                                                                    {round.interviewer_analytics.question_quality_breakdown.relevance}
                                                                </span>
                                                            </div>
                                                            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                                                                <div
                                                                    className="h-full bg-purple-500 rounded-full transition-all"
                                                                    style={{ width: `${round.interviewer_analytics.question_quality_breakdown.relevance}%` }}
                                                                />
                                                            </div>
                                                        </div>
                                                        <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                                                            <div className="flex justify-between items-center mb-2">
                                                                <span className="text-white/60 text-sm">Depth</span>
                                                                <span className={`font-bold ${getScoreColor(round.interviewer_analytics.question_quality_breakdown.depth)}`}>
                                                                    {round.interviewer_analytics.question_quality_breakdown.depth}
                                                                </span>
                                                            </div>
                                                            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                                                                <div
                                                                    className="h-full bg-cyan-500 rounded-full transition-all"
                                                                    style={{ width: `${round.interviewer_analytics.question_quality_breakdown.depth}%` }}
                                                                />
                                                            </div>
                                                        </div>
                                                        <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                                                            <div className="flex justify-between items-center mb-2">
                                                                <span className="text-white/60 text-sm">Follow-up</span>
                                                                <span className={`font-bold ${getScoreColor(round.interviewer_analytics.question_quality_breakdown.follow_up_quality)}`}>
                                                                    {round.interviewer_analytics.question_quality_breakdown.follow_up_quality}
                                                                </span>
                                                            </div>
                                                            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                                                                <div
                                                                    className="h-full bg-green-500 rounded-full transition-all"
                                                                    style={{ width: `${round.interviewer_analytics.question_quality_breakdown.follow_up_quality}%` }}
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Topics Covered */}
                                            {round.interviewer_analytics.topics_covered && (
                                                <div>
                                                    <h5 className="text-sm font-medium text-white/60 mb-4 flex items-center gap-2">
                                                        <Target className="w-4 h-4" />
                                                        Topic Coverage
                                                    </h5>
                                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                                        {Object.entries(round.interviewer_analytics.topics_covered).map(([topic, score]) => (
                                                            <div key={topic} className="p-4 rounded-xl bg-white/5 border border-white/10">
                                                                <div className="flex justify-between items-center mb-2">
                                                                    <span className="text-white/60 text-sm capitalize">{topic.replace('_', ' ')}</span>
                                                                    <span className={`font-bold ${getScoreColor(score)}`}>{score}%</span>
                                                                </div>
                                                                <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                                                                    <div
                                                                        className={`h-full rounded-full transition-all ${
                                                                            topic === 'technical' ? 'bg-blue-500' :
                                                                            topic === 'behavioral' ? 'bg-purple-500' :
                                                                            topic === 'culture_fit' ? 'bg-pink-500' :
                                                                            'bg-orange-500'
                                                                        }`}
                                                                        style={{ width: `${score}%` }}
                                                                    />
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Bias Indicators */}
                                            {round.interviewer_analytics.bias_indicators && (
                                                <div className="p-5 rounded-2xl bg-white/5 border border-white/10">
                                                    <h5 className="text-sm font-medium text-white/60 mb-4 flex items-center gap-2">
                                                        <Scale className="w-4 h-4" />
                                                        Bias Analysis
                                                    </h5>
                                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                                        <div className="text-center p-3 rounded-xl bg-white/5">
                                                            <div className={`text-sm font-medium px-3 py-1 rounded-full inline-block ${getBiasSeverityColor(round.interviewer_analytics.bias_indicators.severity)}`}>
                                                                {round.interviewer_analytics.bias_indicators.severity.toUpperCase()}
                                                            </div>
                                                            <div className="text-white/40 text-xs mt-2">Severity Level</div>
                                                        </div>
                                                        <div className="text-center p-3 rounded-xl bg-white/5">
                                                            <div className={`text-2xl font-bold ${
                                                                round.interviewer_analytics.bias_indicators.sentiment_balance >= 40 &&
                                                                round.interviewer_analytics.bias_indicators.sentiment_balance <= 60
                                                                    ? 'text-green-400'
                                                                    : 'text-yellow-400'
                                                            }`}>
                                                                {round.interviewer_analytics.bias_indicators.sentiment_balance}
                                                            </div>
                                                            <div className="text-white/40 text-xs mt-1">Sentiment Balance</div>
                                                            <div className="text-[10px] text-white/30">(50 = balanced)</div>
                                                        </div>
                                                        <div className="text-center p-3 rounded-xl bg-white/5">
                                                            <div className="text-2xl font-bold text-white/60">
                                                                {round.interviewer_analytics.bias_indicators.flags.length}
                                                            </div>
                                                            <div className="text-white/40 text-xs mt-1">Flags Detected</div>
                                                        </div>
                                                    </div>
                                                    {round.interviewer_analytics.bias_indicators.flags.length > 0 && (
                                                        <div className="p-4 rounded-xl bg-yellow-500/5 border border-yellow-500/20">
                                                            <h6 className="text-sm font-medium text-yellow-400 mb-2">Bias Flags</h6>
                                                            <ul className="space-y-1">
                                                                {round.interviewer_analytics.bias_indicators.flags.map((flag, i) => (
                                                                    <li key={i} className="text-sm text-white/60 flex items-start gap-2">
                                                                        <AlertTriangle className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" />
                                                                        {flag}
                                                                    </li>
                                                                ))}
                                                            </ul>
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {/* Improvement Suggestions */}
                                            {round.interviewer_analytics.improvement_suggestions.length > 0 && (
                                                <div className="p-5 rounded-2xl bg-gradient-to-br from-green-500/5 to-transparent border border-green-500/20">
                                                    <h5 className="font-medium text-green-400 mb-4 flex items-center gap-2">
                                                        <Lightbulb className="w-4 h-4" />
                                                        Improvement Suggestions
                                                    </h5>
                                                    <ul className="space-y-3">
                                                        {round.interviewer_analytics.improvement_suggestions.map((suggestion, i) => (
                                                            <li key={i} className="flex items-start gap-3 p-3 rounded-xl bg-white/5">
                                                                <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center shrink-0">
                                                                    <span className="text-xs font-bold text-green-400">{i + 1}</span>
                                                                </div>
                                                                <p className="text-white/70 text-sm">{suggestion}</p>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* No Interviewer Analytics Message */}
                                    {activeSubTab[round.interview_id] === 'interviewer' && !round.interviewer_analytics && (
                                        <div className="p-6 text-center">
                                            <UserCircle className="w-12 h-12 text-white/20 mx-auto mb-3" />
                                            <p className="text-white/40">No interviewer analytics available for this round.</p>
                                            <p className="text-white/30 text-sm mt-1">
                                                Make sure an interviewer was selected when the transcript was uploaded.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* No Analytics Message */}
                            {expandedRound === round.interview_id && !round.candidate_analytics && !round.interviewer_analytics && (
                                <div className="p-6 border-t border-white/5 text-center">
                                    <BarChart3 className="w-8 h-8 text-white/20 mx-auto mb-2" />
                                    <p className="text-white/40 text-sm">
                                        No analytics generated yet for this round.
                                    </p>
                                    <p className="text-white/30 text-xs mt-1">
                                        Upload a transcript and generate analytics to see insights.
                                    </p>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
