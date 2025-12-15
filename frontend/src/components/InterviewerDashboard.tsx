"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
    Loader2,
    TrendingUp,
    AlertTriangle,
    CheckCircle,
    MessageSquare,
    Target,
    Users,
    Shield,
    Lightbulb,
    Calendar,
    ChevronRight,
    Award
} from "lucide-react";
import {
    getInterviewerAnalytics,
    getInterviewerInterviews,
    InterviewerAnalyticsResponse,
    InterviewerSession
} from "@/lib/interviewerApi";
import InterviewerSelector from "./InterviewerSelector";
import InterviewDetailsModal from "./InterviewDetailsModal";

function DashboardContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const [analytics, setAnalytics] = useState<InterviewerAnalyticsResponse | null>(null);
    const [sessions, setSessions] = useState<InterviewerSession[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

    // Get ID from URL
    const interviewerId = searchParams.get('id');

    useEffect(() => {
        if (interviewerId) {
            loadData(interviewerId);
        } else {
            // Reset if no ID
            setAnalytics(null);
            setSessions([]);
        }
    }, [interviewerId]);

    const loadData = async (id: string) => {
        try {
            setLoading(true);
            setError(null);

            // Parallel fetch
            const [analyticsData, sessionsData] = await Promise.all([
                getInterviewerAnalytics(id),
                getInterviewerInterviews(id)
            ]);

            setAnalytics(analyticsData);
            setSessions(sessionsData.interviews);
        } catch (err) {
            console.error(err);
            setError(err instanceof Error ? err.message : "Failed to load dashboard data");
        } finally {
            setLoading(false);
        }
    };

    const handleInterviewerChange = (id: string) => {
        // Update URL to trigger fetch via useEffect
        router.push(`?id=${id}`);
    };

    const getScoreColor = (score: number, inverted: boolean = false) => {
        if (inverted) {
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

    if (loading && !analytics) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-fade-in relative hidden-scrollbar">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-semibold text-white tracking-tight">Interviewer Analytics</h1>
                    <p className="text-white/40 mt-1">Detailed performance metrics and interview history</p>
                </div>
                <InterviewerSelector
                    selectedId={interviewerId}
                    onInterviewerChange={handleInterviewerChange}
                    className="w-64"
                />
            </div>

            {!interviewerId && (
                <div className="glass-card-premium p-12 text-center border border-white/5">
                    <Users className="w-16 h-16 text-white/20 mx-auto mb-4" />
                    <h2 className="text-xl text-white/60 mb-2">Select an Interviewer</h2>
                    <p className="text-white/40">Choose an interviewer to view their performance report and history.</p>
                </div>
            )}

            {error && (
                <div className="glass-card-premium p-6 bg-red-500/10 border-red-500/20">
                    <p className="text-red-400">{error}</p>
                </div>
            )}

            {analytics && (
                <>
                    {/* Aggregated Stats Section */}
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                        {[
                            { key: 'avg_question_quality', label: 'Question Quality', icon: MessageSquare },
                            { key: 'avg_topic_coverage', label: 'Topic Coverage', icon: Target },
                            { key: 'avg_consistency', label: 'Consistency', icon: TrendingUp },
                            { key: 'avg_bias_score', label: 'Bias Score', icon: Shield, inverted: true },
                            { key: 'avg_candidate_experience', label: 'Candidate Exp', icon: Users }
                        ].map((metric) => {
                            const value = analytics.aggregated[metric.key as keyof typeof analytics.aggregated] as number;
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
                                </div>
                            );
                        })}
                    </div>

                    {/* Content Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Left Column: Interview History */}
                        <div className="lg:col-span-2 space-y-6">
                            <div className="flex items-center justify-between">
                                <h2 className="text-lg font-semibold text-white">Interview History</h2>
                                <span className="text-xs text-white/40 bg-white/5 px-2 py-1 rounded">
                                    {sessions.length} Sessions
                                </span>
                            </div>

                            <div className="space-y-3">
                                {sessions.length === 0 ? (
                                    <div className="glass-card-premium p-8 text-center text-white/40">
                                        No interviews found for this interviewer.
                                    </div>
                                ) : (
                                    sessions.map((session) => (
                                        <button
                                            key={session.interview_id}
                                            onClick={() => setSelectedSessionId(session.interview_id)}
                                            className="w-full glass-card-premium p-4 flex items-center justify-between hover:bg-white/5 transition-all text-left group border border-white/5 hover:border-white/10"
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-white/40 group-hover:bg-blue-500/20 group-hover:text-blue-400 transition-colors">
                                                    <Award className="w-5 h-5" />
                                                </div>
                                                <div>
                                                    <div className="text-white font-medium">{session.candidate_name}</div>
                                                    <div className="text-xs text-white/40 flex items-center gap-2">
                                                        <span>{session.candidate_title || 'Candidate'}</span>
                                                        <span>•</span>
                                                        <Calendar className="w-3 h-3" />
                                                        <span>
                                                            {session.started_at
                                                                ? new Date(session.started_at).toLocaleDateString()
                                                                : 'Unknown Date'}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-6">
                                                <div className="text-right">
                                                    <div className="text-xs text-white/40 uppercase tracking-wider">Score</div>
                                                    <div className={`font-mono font-medium ${(session.interview_score || 0) >= 70 ? 'text-green-400' : 'text-white'
                                                        }`}>
                                                        {session.interview_score || '--'}
                                                    </div>
                                                </div>
                                                <ChevronRight className="w-5 h-5 text-white/20 group-hover:text-white/60 transition-colors" />
                                            </div>
                                        </button>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Right Column: Insights & Recommendations */}
                        <div className="space-y-6">
                            {/* Recommendations */}
                            {analytics.aggregated.common_suggestions.length > 0 && (
                                <div className="glass-card-premium p-6 border-l-4 border-yellow-500/50">
                                    <h2 className="text-yellow-400 font-semibold mb-4 flex items-center gap-2">
                                        <Lightbulb className="w-4 h-4" />
                                        Areas for Improvement
                                    </h2>
                                    <div className="space-y-3">
                                        {analytics.aggregated.common_suggestions.slice(0, 5).map((suggestion, i) => (
                                            <div key={i} className="flex items-start gap-3 text-white/70 text-sm">
                                                <span className="text-yellow-500 mt-1">•</span>
                                                <p>{suggestion}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Bias Indicators */}
                            {analytics.aggregated.bias_flags.length > 0 && (
                                <div className="glass-card-premium p-6 border-l-4 border-red-500/50">
                                    <h2 className="text-red-400 font-semibold mb-4 flex items-center gap-2">
                                        <AlertTriangle className="w-4 h-4" />
                                        Bias Patterns
                                    </h2>
                                    <div className="space-y-2">
                                        {analytics.aggregated.bias_flags.slice(0, 3).map((flag, i) => (
                                            <div key={i} className="flex items-center gap-2 text-white/70 text-sm">
                                                <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                                                <span>{flag}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}

            {/* Detail Modal */}
            {selectedSessionId && (
                <InterviewDetailsModal
                    interviewId={selectedSessionId}
                    onClose={() => setSelectedSessionId(null)}
                />
            )}
        </div>
    );
}

export default function InterviewerDashboard() {
    return (
        <Suspense fallback={
            <div className="flex items-center justify-center min-h-screen">
                <Loader2 className="w-8 h-8 animate-spin text-white/20" />
            </div>
        }>
            <DashboardContent />
        </Suspense>
    );
}
