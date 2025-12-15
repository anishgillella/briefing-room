"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
    Loader2,
    Users,
    TrendingUp,
    Star,
    Award,
    MessageSquare,
    Target,
    Shield,
    ExternalLink
} from "lucide-react";
import { getConsolidatedTeamReport, ConsolidatedReport, LeaderboardEntry } from "@/lib/managerApi";

export default function ManagerDashboard() {
    const [data, setData] = useState<ConsolidatedReport | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const report = await getConsolidatedTeamReport();
            setData(report);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load report");
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
                <p className="text-white/40 mt-1">Consolidated team performance and interviewer leaderboard</p>
            </div>

            {/* Summary Metrics */}
            {data && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div className="glass-card-premium p-6 border border-white/10">
                        <div className="flex items-center gap-3 mb-4">
                            <Users className="w-5 h-5 text-white/40" />
                            <span className="text-xs text-white/60 uppercase tracking-wider">Active Interviewers</span>
                        </div>
                        <div className="text-4xl font-light text-white">
                            {data.summary.active_interviewers}
                            <span className="text-lg text-white/20 ml-2">/ {data.summary.total_interviewers}</span>
                        </div>
                    </div>

                    <div className="glass-card-premium p-6 border border-white/10">
                        <div className="flex items-center gap-3 mb-4">
                            <MessageSquare className="w-5 h-5 text-purple-400" />
                            <span className="text-xs text-white/60 uppercase tracking-wider">Interviews Completed</span>
                        </div>
                        <div className="text-4xl font-light text-white">
                            {data.summary.total_interviews_completed}
                        </div>
                    </div>

                    <div className="glass-card-premium p-6 border border-white/10">
                        <div className="flex items-center gap-3 mb-4">
                            <Star className="w-5 h-5 text-yellow-400" />
                            <span className="text-xs text-white/60 uppercase tracking-wider">Avg Interview Score</span>
                        </div>
                        <div className="text-4xl font-light text-white">
                            {data.summary.team_avg_interview_score.toFixed(1)}
                        </div>
                    </div>

                    <div className="glass-card-premium p-6 border border-white/10">
                        <div className="flex items-center gap-3 mb-4">
                            <Award className="w-5 h-5 text-green-400" />
                            <span className="text-xs text-white/60 uppercase tracking-wider">Interviewer Rating</span>
                        </div>
                        <div className="text-4xl font-light text-white">
                            {data.summary.team_avg_overall_rating.toFixed(1)}
                            <span className="text-sm text-white/20 ml-2">/ 100</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Leaderboard */}
            {data && (
                <div className="glass-card-premium p-8">
                    <div className="flex items-center justify-between mb-8">
                        <h2 className="text-sm font-bold uppercase tracking-widest text-white/40">
                            Interviewer Performance Leaderboard
                        </h2>
                        <div className="text-xs text-white/30">
                            Last {data.period_days} days
                        </div>
                    </div>

                    <div className="space-y-2">
                        {/* Table Header */}
                        <div className="grid grid-cols-12 gap-4 px-4 py-2 text-xs text-white/40 uppercase tracking-wider border-b border-white/10 pb-2">
                            <div className="col-span-4">Interviewer</div>
                            <div className="col-span-2 text-center">Interviews</div>
                            <div className="col-span-2 text-center">Avg Score</div>
                            <div className="col-span-2 text-center">Quality</div>
                            <div className="col-span-2 text-center">Action</div>
                        </div>

                        {/* Rows */}
                        {data.leaderboard.length === 0 ? (
                            <div className="p-8 text-center text-white/40">No data available</div>
                        ) : (
                            data.leaderboard.map((entry: LeaderboardEntry, index: number) => (
                                <div
                                    key={entry.interviewer_id}
                                    className="grid grid-cols-12 gap-4 items-center p-4 bg-white/5 rounded-lg border border-white/5 hover:bg-white/10 transition-colors"
                                >
                                    <div className="col-span-4 flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold text-white/60">
                                            {index + 1}
                                        </div>
                                        <div>
                                            <div className="text-white font-medium">{entry.name}</div>
                                            <div className="text-xs text-white/40">{entry.team || 'No Team'}</div>
                                        </div>
                                    </div>

                                    <div className="col-span-2 text-center text-white/60 font-mono">
                                        {entry.total_interviews}
                                    </div>

                                    <div className="col-span-2 text-center font-medium font-mono text-white/80">
                                        {entry.avg_interview_score.toFixed(1)}
                                    </div>

                                    <div className={`col-span-2 text-center font-medium ${getScoreColor(entry.avg_overall_rating)}`}>
                                        {entry.avg_overall_rating.toFixed(0)} <span className="text-xs opacity-50">/100</span>
                                    </div>

                                    <div className="col-span-2 text-center">
                                        <Link
                                            href={`/dashboard/interviewer?id=${entry.interviewer_id}`}
                                            className="inline-flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300 transition-colors px-3 py-1.5 rounded-full bg-purple-500/10 hover:bg-purple-500/20"
                                        >
                                            View <ExternalLink className="w-3 h-3" />
                                        </Link>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
