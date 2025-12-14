"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
    ChevronRight,
    Clock,
    TrendingUp,
    Target,
    UserCheck,
    FileCheck,
    Users,
    Loader2,
    MessageSquare,
    Shield,
    ExternalLink
} from "lucide-react";
import { getTeamMetrics, TeamMetrics } from "@/lib/managerApi";
import { getTeamAnalytics, TeamAnalyticsResponse } from "@/lib/interviewerApi";

export default function ManagerDashboard() {
    const [funnelData, setFunnelData] = useState<TeamMetrics | null>(null);
    const [teamData, setTeamData] = useState<TeamAnalyticsResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const [funnel, team] = await Promise.all([
                getTeamMetrics(),
                getTeamAnalytics()
            ]);
            setFunnelData(funnel);
            setTeamData(team);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load data");
        } finally {
            setLoading(false);
        }
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

    const formatPercent = (val: number) => `${(val * 100).toFixed(1)}%`;

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="glass-card-premium p-6 bg-red-500/10 border-red-500/20">
                <p className="text-red-400">{error}</p>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-fade-in">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-semibold text-white tracking-tight">Manager Dashboard</h1>
                <p className="text-white/40 mt-1">Consolidated hiring funnel and team interviewer performance</p>
            </div>

            {/* Hiring Funnel (Team-Wide) */}
            {funnelData && (
                <div className="glass-card-premium p-8">
                    <h2 className="text-sm font-bold uppercase tracking-widest text-white/40 mb-8">
                        Team Hiring Funnel (Last {funnelData.period_days} Days)
                    </h2>

                    <div className="flex items-center justify-between">
                        {[
                            { key: 'reviewed', label: 'Reviewed', icon: Users, value: funnelData.metrics.funnel.reviewed, rate: null },
                            { key: 'interviewed', label: 'Interviewed', icon: UserCheck, value: funnelData.metrics.funnel.interviewed, rate: funnelData.metrics.rates.interview_rate },
                            { key: 'offered', label: 'Offered', icon: FileCheck, value: funnelData.metrics.funnel.offered, rate: funnelData.metrics.rates.offer_rate },
                            { key: 'hired', label: 'Hired', icon: Target, value: funnelData.metrics.funnel.hired, rate: funnelData.metrics.rates.hire_rate }
                        ].map((stage, i) => (
                            <div key={stage.key} className="flex items-center flex-1">
                                <div className="flex-1 text-center p-6 rounded-2xl border bg-white/5 border-white/10">
                                    <stage.icon className="w-8 h-8 mx-auto mb-3 text-white/40" />
                                    <div className="text-4xl font-light text-white mb-1">{stage.value}</div>
                                    <div className="text-sm text-white/40 capitalize mb-2">{stage.label}</div>
                                    {stage.rate !== null && (
                                        <div className="text-sm font-medium text-purple-400">
                                            {formatPercent(stage.rate)}
                                        </div>
                                    )}
                                </div>
                                {i < 3 && (
                                    <ChevronRight className="w-8 h-8 text-white/20 mx-4 flex-shrink-0" />
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Timing Metrics */}
            {funnelData && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {[
                        { key: 'time_to_first_interview', label: 'Avg Time to First Interview', unit: 'days', icon: Clock },
                        { key: 'time_in_pipeline', label: 'Avg Time in Pipeline', unit: 'days', icon: TrendingUp },
                        { key: 'interviews_per_candidate', label: 'Avg Interviews per Hire', unit: '', icon: Users }
                    ].map((metric) => {
                        const value = funnelData.metrics.timing[metric.key as keyof typeof funnelData.metrics.timing];
                        return (
                            <div
                                key={metric.key}
                                className="glass-card-premium p-6 border border-white/10"
                            >
                                <div className="flex items-center gap-3 mb-4">
                                    <metric.icon className="w-5 h-5 text-white/40" />
                                    <span className="text-sm text-white/60 uppercase tracking-wider">{metric.label}</span>
                                </div>
                                <div className="text-4xl font-light text-white mb-2">
                                    {value.toFixed(1)}{metric.unit && <span className="text-lg text-white/40 ml-1">{metric.unit}</span>}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Team Interviewer Analytics */}
            {teamData && teamData.interviewers.length > 0 && (
                <div className="glass-card-premium p-8">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-sm font-bold uppercase tracking-widest text-white/40">
                            Team Interviewer Performance
                        </h2>
                        <div className="text-xs text-white/30">
                            {teamData.team_averages.total_interviews} total interviews analyzed
                        </div>
                    </div>

                    {/* Team Averages Summary */}
                    <div className="grid grid-cols-5 gap-4 mb-8">
                        {[
                            { key: 'avg_question_quality', label: 'Question Quality', icon: MessageSquare },
                            { key: 'avg_topic_coverage', label: 'Topic Coverage', icon: Target },
                            { key: 'avg_consistency', label: 'Consistency', icon: TrendingUp },
                            { key: 'avg_bias_score', label: 'Bias Score', icon: Shield, inverted: true },
                            { key: 'avg_candidate_experience', label: 'Candidate Exp', icon: Users }
                        ].map((metric) => {
                            const value = teamData.team_averages[metric.key as keyof typeof teamData.team_averages] as number;
                            const inverted = metric.inverted || false;
                            return (
                                <div key={metric.key} className="text-center p-4 bg-white/5 rounded-xl border border-white/10">
                                    <metric.icon className="w-5 h-5 mx-auto mb-2 text-white/30" />
                                    <div className={`text-2xl font-light ${getScoreColor(value, inverted)}`}>
                                        {value.toFixed(0)}
                                    </div>
                                    <div className="text-xs text-white/40 mt-1">{metric.label}</div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Individual Interviewers Table */}
                    <div className="space-y-3">
                        <div className="grid grid-cols-7 gap-4 px-4 py-2 text-xs text-white/40 uppercase tracking-wider">
                            <div className="col-span-2">Interviewer</div>
                            <div className="text-center">Interviews</div>
                            <div className="text-center">Quality</div>
                            <div className="text-center">Coverage</div>
                            <div className="text-center">Bias</div>
                            <div className="text-center">Action</div>
                        </div>
                        {teamData.interviewers.map((item) => (
                            <div
                                key={item.interviewer.id}
                                className="grid grid-cols-7 gap-4 items-center p-4 bg-white/5 rounded-lg border border-white/5 hover:bg-white/10 transition-colors"
                            >
                                <div className="col-span-2">
                                    <div className="text-white font-medium">{item.interviewer.name}</div>
                                    <div className="text-xs text-white/40">{item.interviewer.team}</div>
                                </div>
                                <div className="text-center text-white/60">{item.metrics.total_interviews}</div>
                                <div className={`text-center font-medium ${getScoreColor(item.metrics.avg_question_quality)}`}>
                                    {item.metrics.avg_question_quality.toFixed(0)}
                                </div>
                                <div className={`text-center font-medium ${getScoreColor(item.metrics.avg_topic_coverage)}`}>
                                    {item.metrics.avg_topic_coverage.toFixed(0)}
                                </div>
                                <div className={`text-center font-medium ${getScoreColor(item.metrics.avg_bias_score, true)}`}>
                                    {item.metrics.avg_bias_score.toFixed(0)}
                                </div>
                                <div className="text-center">
                                    <Link
                                        href={`/dashboard/interviewer?id=${item.interviewer.id}`}
                                        className="inline-flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300 transition-colors"
                                    >
                                        Details <ExternalLink className="w-3 h-3" />
                                    </Link>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* No Interviewer Analytics Yet */}
            {teamData && teamData.interviewers.length === 0 && (
                <div className="glass-card-premium p-8 text-center">
                    <Users className="w-12 h-12 text-white/20 mx-auto mb-4" />
                    <h3 className="text-lg text-white/60 mb-2">No Interviewer Analytics Yet</h3>
                    <p className="text-sm text-white/40">Complete interviews with the interviewer selector to generate analytics.</p>
                </div>
            )}
        </div>
    );
}
