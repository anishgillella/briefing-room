"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import {
    ArrowLeft,
    MapPin,
    Briefcase,
    Building2,
    ExternalLink,
    Play,
    CheckCircle2,
    AlertTriangle,
    TrendingUp,
    Target,
    Users,
    Loader2
} from "lucide-react";
import { getCandidate, startCandidateInterview } from "@/lib/api";
import { Candidate, getTierColor, getStatusColor, formatInterviewStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

interface PageProps {
    params: Promise<{ id: string }>;
}

export default function CandidateDetailPage({ params }: PageProps) {
    const { id } = use(params);
    const router = useRouter();
    const [candidate, setCandidate] = useState<Candidate | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [startingInterview, setStartingInterview] = useState(false);

    useEffect(() => {
        async function loadCandidate() {
            try {
                setLoading(true);
                const data = await getCandidate(id);
                setCandidate(data);
            } catch (err) {
                setError(err instanceof Error ? err.message : "Failed to load candidate");
            } finally {
                setLoading(false);
            }
        }
        loadCandidate();
    }, [id]);

    const handleStartInterview = async () => {
        if (!candidate) return;

        try {
            setStartingInterview(true);
            const response = await startCandidateInterview(candidate.id);
            // Navigate to the interview room
            window.location.href = response.room_url;
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to start interview");
            setStartingInterview(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    if (error || !candidate) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white flex items-center justify-center">
                <div className="text-center">
                    <p className="text-destructive mb-4">{error || "Candidate not found"}</p>
                    <button
                        onClick={() => router.push("/candidates")}
                        className="text-primary hover:underline"
                    >
                        ← Back to candidates
                    </button>
                </div>
            </div>
        );
    }

    const tierClass = getTierColor(candidate.tier);

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
            {/* Header */}
            <header className="sticky top-0 z-50 bg-slate-950/80 backdrop-blur-lg border-b border-white/5">
                <div className="container mx-auto px-4">
                    <div className="flex items-center justify-between h-16">
                        <button
                            onClick={() => router.push("/candidates")}
                            className="flex items-center gap-2 text-muted-foreground hover:text-white transition-colors"
                        >
                            <ArrowLeft className="w-5 h-5" />
                            Back to Candidates
                        </button>

                        <button
                            onClick={handleStartInterview}
                            disabled={startingInterview || candidate.interview_status === "completed"}
                            className={cn(
                                "flex items-center gap-2 px-6 py-2 rounded-lg font-medium transition-all",
                                "bg-primary text-primary-foreground hover:bg-primary/90",
                                "disabled:opacity-50 disabled:cursor-not-allowed"
                            )}
                        >
                            {startingInterview ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Play className="w-4 h-4" />
                            )}
                            {candidate.interview_status === "completed" ? "Interview Completed" : "Start Interview"}
                        </button>
                    </div>
                </div>
            </header>

            <main className="container mx-auto px-4 py-8">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Main Content */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Profile Header */}
                        <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
                            <div className="flex items-start gap-4">
                                {/* Avatar */}
                                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center text-3xl font-bold text-primary shrink-0">
                                    {candidate.name.charAt(0).toUpperCase()}
                                </div>

                                <div className="flex-1">
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <h1 className="text-2xl font-bold mb-1">{candidate.name}</h1>
                                            <p className="text-lg text-muted-foreground">
                                                {candidate.job_title || "No title"}
                                            </p>
                                        </div>

                                        {/* Score Badge */}
                                        <div className="text-center">
                                            <div className={cn(
                                                "text-3xl font-bold px-4 py-2 rounded-xl border",
                                                tierClass
                                            )}>
                                                {candidate.combined_score ?? "—"}
                                            </div>
                                            <p className="text-xs text-muted-foreground mt-1">
                                                {candidate.tier || "Unscored"}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Meta */}
                                    <div className="flex flex-wrap items-center gap-4 mt-4 text-sm text-muted-foreground">
                                        {candidate.location_city && (
                                            <span className="flex items-center gap-1">
                                                <MapPin className="w-4 h-4" />
                                                {candidate.location_city}{candidate.location_state && `, ${candidate.location_state}`}
                                            </span>
                                        )}
                                        {candidate.years_experience != null && (
                                            <span className="flex items-center gap-1">
                                                <Briefcase className="w-4 h-4" />
                                                {candidate.years_experience} years experience
                                            </span>
                                        )}
                                        {candidate.linkedin_url && (
                                            <a
                                                href={candidate.linkedin_url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex items-center gap-1 text-primary hover:underline"
                                            >
                                                <ExternalLink className="w-4 h-4" />
                                                LinkedIn
                                            </a>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Summary */}
                            {candidate.bio_summary && (
                                <p className="mt-6 text-muted-foreground leading-relaxed">
                                    {candidate.bio_summary}
                                </p>
                            )}
                        </div>

                        {/* AI Summary */}
                        {candidate.one_line_summary && (
                            <div className="bg-primary/5 rounded-xl p-4 border border-primary/20">
                                <p className="text-primary font-medium">
                                    "{candidate.one_line_summary}"
                                </p>
                            </div>
                        )}

                        {/* Strengths & Concerns */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Strengths */}
                            <div className="bg-green-500/5 rounded-xl p-5 border border-green-500/20">
                                <h3 className="flex items-center gap-2 text-green-400 font-semibold mb-3">
                                    <CheckCircle2 className="w-5 h-5" />
                                    Strengths
                                </h3>
                                <ul className="space-y-2">
                                    {candidate.pros.length > 0 ? (
                                        candidate.pros.map((pro, i) => (
                                            <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                                                <span className="text-green-400 mt-1">•</span>
                                                {pro}
                                            </li>
                                        ))
                                    ) : (
                                        <li className="text-sm text-muted-foreground">No strengths identified</li>
                                    )}
                                </ul>
                            </div>

                            {/* Concerns */}
                            <div className="bg-amber-500/5 rounded-xl p-5 border border-amber-500/20">
                                <h3 className="flex items-center gap-2 text-amber-400 font-semibold mb-3">
                                    <AlertTriangle className="w-5 h-5" />
                                    Concerns
                                </h3>
                                <ul className="space-y-2">
                                    {candidate.cons.length > 0 ? (
                                        candidate.cons.map((con, i) => (
                                            <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                                                <span className="text-amber-400 mt-1">•</span>
                                                {con}
                                            </li>
                                        ))
                                    ) : (
                                        <li className="text-sm text-muted-foreground">No concerns identified</li>
                                    )}
                                </ul>
                            </div>
                        </div>

                        {/* AI Reasoning */}
                        {candidate.reasoning && (
                            <div className="bg-white/5 rounded-xl p-5 border border-white/10">
                                <h3 className="font-semibold mb-3">AI Assessment</h3>
                                <p className="text-sm text-muted-foreground leading-relaxed">
                                    {candidate.reasoning}
                                </p>
                            </div>
                        )}

                        {/* Skills */}
                        {candidate.skills.length > 0 && (
                            <div className="bg-white/5 rounded-xl p-5 border border-white/10">
                                <h3 className="font-semibold mb-3">Skills</h3>
                                <div className="flex flex-wrap gap-2">
                                    {candidate.skills.map((skill, i) => (
                                        <span
                                            key={i}
                                            className="px-3 py-1 bg-white/5 rounded-full text-sm text-muted-foreground"
                                        >
                                            {skill}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Sidebar */}
                    <div className="space-y-4">
                        {/* Score Breakdown */}
                        <div className="bg-white/5 rounded-xl p-5 border border-white/10">
                            <h3 className="font-semibold mb-4">Score Breakdown</h3>

                            <div className="space-y-4">
                                {/* Algo Score */}
                                <div>
                                    <div className="flex justify-between text-sm mb-1">
                                        <span className="text-muted-foreground">Algorithmic</span>
                                        <span className="font-medium">{candidate.algo_score ?? "—"}</span>
                                    </div>
                                    <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-blue-500"
                                            style={{ width: `${candidate.algo_score || 0}%` }}
                                        />
                                    </div>
                                </div>

                                {/* AI Score */}
                                <div>
                                    <div className="flex justify-between text-sm mb-1">
                                        <span className="text-muted-foreground">AI Evaluation</span>
                                        <span className="font-medium">{candidate.ai_score ?? "—"}</span>
                                    </div>
                                    <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-purple-500"
                                            style={{ width: `${candidate.ai_score || 0}%` }}
                                        />
                                    </div>
                                </div>

                                {/* Completeness */}
                                <div>
                                    <div className="flex justify-between text-sm mb-1">
                                        <span className="text-muted-foreground">Data Completeness</span>
                                        <span className="font-medium">{candidate.completeness}%</span>
                                    </div>
                                    <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-emerald-500"
                                            style={{ width: `${candidate.completeness}%` }}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Key Signals */}
                        <div className="bg-white/5 rounded-xl p-5 border border-white/10">
                            <h3 className="font-semibold mb-4">Key Signals</h3>
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-muted-foreground">Finance Sales</span>
                                    <span className={cn("text-sm", candidate.sold_to_finance ? "text-green-400" : "text-muted-foreground")}>
                                        {candidate.sold_to_finance ? "✓ Yes" : "✗ No"}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-muted-foreground">Founder Experience</span>
                                    <span className={cn("text-sm", candidate.is_founder ? "text-green-400" : "text-muted-foreground")}>
                                        {candidate.is_founder ? "✓ Yes" : "✗ No"}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-muted-foreground">Startup Experience</span>
                                    <span className={cn("text-sm", candidate.startup_experience ? "text-green-400" : "text-muted-foreground")}>
                                        {candidate.startup_experience ? "✓ Yes" : "✗ No"}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-muted-foreground">Enterprise Sales</span>
                                    <span className={cn("text-sm", candidate.enterprise_experience ? "text-green-400" : "text-muted-foreground")}>
                                        {candidate.enterprise_experience ? "✓ Yes" : "✗ No"}
                                    </span>
                                </div>
                                {candidate.max_acv_mentioned && (
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-muted-foreground">Max Deal Size</span>
                                        <span className="text-sm text-green-400">
                                            ${candidate.max_acv_mentioned.toLocaleString()}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Missing Data */}
                        {(candidate.missing_required.length > 0 || candidate.missing_preferred.length > 0) && (
                            <div className="bg-amber-500/5 rounded-xl p-5 border border-amber-500/20">
                                <h3 className="font-semibold mb-3 text-amber-400">Missing Data</h3>
                                {candidate.missing_required.length > 0 && (
                                    <>
                                        <p className="text-xs text-muted-foreground mb-2">Required:</p>
                                        <div className="flex flex-wrap gap-1 mb-2">
                                            {candidate.missing_required.map((field, i) => (
                                                <span key={i} className="px-2 py-0.5 bg-amber-500/10 rounded text-xs text-amber-400">
                                                    {field}
                                                </span>
                                            ))}
                                        </div>
                                    </>
                                )}
                                {candidate.missing_preferred.length > 0 && (
                                    <>
                                        <p className="text-xs text-muted-foreground mb-2">Preferred:</p>
                                        <div className="flex flex-wrap gap-1">
                                            {candidate.missing_preferred.map((field, i) => (
                                                <span key={i} className="px-2 py-0.5 bg-white/5 rounded text-xs text-muted-foreground">
                                                    {field}
                                                </span>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </div>
                        )}

                        {/* Interview Status */}
                        <div className="bg-white/5 rounded-xl p-5 border border-white/10">
                            <h3 className="font-semibold mb-3">Interview Status</h3>
                            <div className={cn(
                                "inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm",
                                getStatusColor(candidate.interview_status)
                            )}>
                                {formatInterviewStatus(candidate.interview_status)}
                            </div>
                            {candidate.room_name && (
                                <p className="mt-3 text-xs text-muted-foreground">
                                    Room: {candidate.room_name}
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
