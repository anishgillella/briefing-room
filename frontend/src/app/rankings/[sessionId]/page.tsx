"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, LayoutGrid, Table, ChevronDown, Users, TrendingUp } from "lucide-react";
import DashboardNav from "@/components/DashboardNav";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// Types
interface Candidate {
    rank: number;
    id: string;
    name: string;
    job_title: string;
    location_city: string;
    location_state: string;
    years_sales_experience: number;
    years_experience?: number;
    tier: string;
    algo_score: number;
    ai_score: number;
    final_score: number;
    one_line_summary: string;
    pros: string[];
    cons: string[];
    reasoning: string;
    interview_questions: string[];
    bio_summary: string;
    industries: string;
    sold_to_finance: boolean;
    is_founder: boolean;
    startup_experience: boolean;
    enterprise_experience: boolean;
    missing_required: string[];
    missing_preferred: string[];
    data_completeness: number;
    [key: string]: unknown;
}

interface ExtractionField {
    field_name: string;
    field_type: "boolean" | "number" | "string" | "string_list";
    description: string;
    is_required: boolean;
}

export default function RankingsPage() {
    const params = useParams();
    const router = useRouter();
    const sessionId = params.sessionId as string;

    const [candidates, setCandidates] = useState<Candidate[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<"cards" | "table">("cards");
    const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
    const [extractionFields, setExtractionFields] = useState<ExtractionField[]>([]);

    // Fetch candidates on mount
    useEffect(() => {
        const fetchCandidates = async () => {
            try {
                setLoading(true);
                const res = await fetch(`${API_URL}/api/pluto/candidates`);
                if (!res.ok) throw new Error("Failed to fetch candidates");

                const data = await res.json();
                const candidatesList: Candidate[] = data.candidates || data || [];

                if (candidatesList.length === 0) {
                    setError("No candidates found for this session");
                    return;
                }

                // Add rank based on final_score
                const ranked = candidatesList
                    .sort((a, b) => (b.final_score || 0) - (a.final_score || 0))
                    .map((c, idx) => ({ ...c, rank: idx + 1 }));

                setCandidates(ranked);

                // Try to fetch extraction fields from session storage
                const storedFields = sessionStorage.getItem("extractionFields");
                if (storedFields) {
                    setExtractionFields(JSON.parse(storedFields));
                }
            } catch (e) {
                setError(e instanceof Error ? e.message : "Unknown error");
            } finally {
                setLoading(false);
            }
        };

        fetchCandidates();
    }, [sessionId]);

    // Tier counts
    const tierCounts = useMemo(() => {
        const counts = { top: 0, strong: 0, good: 0, other: 0 };
        candidates.forEach(c => {
            if (c.tier?.includes("Top")) counts.top++;
            else if (c.tier?.includes("Strong")) counts.strong++;
            else if (c.tier?.includes("Good")) counts.good++;
            else counts.other++;
        });
        return counts;
    }, [candidates]);

    if (loading) {
        return (
            <main className="min-h-screen gradient-bg flex items-center justify-center">
                <div className="text-white/60 animate-pulse">Loading rankings...</div>
            </main>
        );
    }

    if (error) {
        return (
            <main className="min-h-screen gradient-bg">
                <DashboardNav />
                <div className="max-w-4xl mx-auto px-6 pt-24 text-center">
                    <p className="text-red-400 mb-4">{error}</p>
                    <Link href="/" className="text-indigo-400 hover:text-indigo-300">
                        ← Start a new session
                    </Link>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen gradient-bg">
            <DashboardNav />

            <div className="max-w-7xl mx-auto px-6 pt-24 pb-12">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <Link href="/" className="text-white/40 hover:text-white/60 text-sm flex items-center gap-1 mb-2">
                            <ArrowLeft className="w-4 h-4" /> New Upload
                        </Link>
                        <h1 className="text-3xl font-light text-white tracking-tight">
                            Candidate Rankings
                        </h1>
                        <p className="text-white/40 text-sm mt-1">
                            Session: {sessionId.slice(0, 8)}... • {candidates.length} candidates
                        </p>
                    </div>

                    {/* View Toggle */}
                    <div className="flex items-center gap-2 bg-white/5 rounded-xl p-1">
                        <button
                            onClick={() => setViewMode("cards")}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${viewMode === "cards" ? "bg-indigo-500 text-white" : "text-white/50 hover:text-white"}`}
                        >
                            <LayoutGrid className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => setViewMode("table")}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${viewMode === "table" ? "bg-indigo-500 text-white" : "text-white/50 hover:text-white"}`}
                        >
                            <Table className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Tier Summary */}
                <div className="grid grid-cols-4 gap-4 mb-8">
                    {[
                        { label: "Top Tier", count: tierCounts.top, color: "text-amber-400", bg: "bg-amber-500/10" },
                        { label: "Strong", count: tierCounts.strong, color: "text-green-400", bg: "bg-green-500/10" },
                        { label: "Good", count: tierCounts.good, color: "text-blue-400", bg: "bg-blue-500/10" },
                        { label: "Other", count: tierCounts.other, color: "text-gray-400", bg: "bg-gray-500/10" },
                    ].map(tier => (
                        <div key={tier.label} className={`glass-panel p-4 rounded-xl ${tier.bg}`}>
                            <div className={`text-2xl font-bold ${tier.color}`}>{tier.count}</div>
                            <div className="text-xs text-white/50 uppercase tracking-wider">{tier.label}</div>
                        </div>
                    ))}
                </div>

                {/* Cards View */}
                {viewMode === "cards" && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {candidates.map(candidate => (
                            <div
                                key={candidate.id}
                                onClick={() => setSelectedCandidate(candidate)}
                                className="glass-panel p-6 rounded-2xl cursor-pointer hover:bg-white/5 transition-all group"
                            >
                                <div className="flex items-start justify-between mb-3">
                                    <div>
                                        <h3 className="text-white font-medium group-hover:text-indigo-300 transition-colors">
                                            {candidate.name}
                                        </h3>
                                        <p className="text-white/40 text-sm">{candidate.job_title}</p>
                                    </div>
                                    <span className={`text-2xl font-light ${candidate.final_score >= 80 ? "text-amber-400" :
                                        candidate.final_score >= 65 ? "text-green-400" :
                                            "text-gray-400"
                                        }`}>
                                        {candidate.final_score}
                                    </span>
                                </div>

                                <p className="text-white/60 text-sm line-clamp-2 mb-4">
                                    {candidate.one_line_summary || candidate.bio_summary}
                                </p>

                                <div className="flex items-center justify-between">
                                    <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wide border ${candidate.tier?.includes("Top") ? "bg-amber-500/10 border-amber-500/30 text-amber-300" :
                                        candidate.tier?.includes("Strong") ? "bg-green-500/10 border-green-500/30 text-green-300" :
                                            "bg-gray-800 border-gray-700 text-gray-400"
                                        }`}>
                                        {candidate.tier}
                                    </span>
                                    <Link
                                        href={`/candidates/${candidate.id}`}
                                        onClick={(e) => e.stopPropagation()}
                                        className="text-xs text-indigo-400 hover:text-indigo-300"
                                    >
                                        View Profile →
                                    </Link>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Table View */}
                {viewMode === "table" && (
                    <div className="glass-panel p-0 overflow-hidden rounded-2xl">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-white/5 text-gray-400 text-[10px] uppercase tracking-widest font-medium">
                                    <tr>
                                        <th className="px-4 py-4 font-normal sticky left-0 bg-[#1a1a20] z-10">#</th>
                                        <th className="px-4 py-4 font-normal">Candidate</th>
                                        <th className="px-4 py-4 font-normal">Role</th>
                                        <th className="px-4 py-4 font-normal">Tier</th>
                                        <th className="px-3 py-4 text-right font-normal">Final</th>
                                        <th className="px-3 py-4 text-right font-normal">Algo</th>
                                        <th className="px-3 py-4 text-right font-normal">AI</th>
                                        <th className="px-3 py-4 text-right font-normal">Exp</th>
                                        {/* Dynamic extraction fields */}
                                        {extractionFields.filter(f => !['bio_summary'].includes(f.field_name)).map(field => (
                                            <th key={field.field_name} className="px-3 py-4 font-normal whitespace-nowrap text-center" title={field.description}>
                                                {field.field_name.replace(/_/g, ' ').slice(0, 15)}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {candidates.map((candidate) => (
                                        <tr
                                            key={candidate.id}
                                            onClick={() => setSelectedCandidate(candidate)}
                                            className="hover:bg-white/5 cursor-pointer transition-colors group"
                                        >
                                            <td className="px-4 py-4 text-white/40 sticky left-0 bg-[#0d0d0f] group-hover:bg-[#1a1a20]">{candidate.rank}</td>
                                            <td className="px-4 py-4 font-medium text-white group-hover:text-blue-200">{candidate.name}</td>
                                            <td className="px-4 py-4 text-gray-400 font-light text-xs">{candidate.job_title}</td>
                                            <td className="px-4 py-4">
                                                <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wide border ${candidate.tier?.includes("Top") ? "bg-amber-500/10 border-amber-500/30 text-amber-300" :
                                                    candidate.tier?.includes("Strong") ? "bg-green-500/10 border-green-500/30 text-green-300" :
                                                        "bg-gray-800 border-gray-700 text-gray-400"
                                                    }`}>{candidate.tier}</span>
                                            </td>
                                            <td className="px-3 py-4 text-right font-medium text-white">{candidate.final_score}</td>
                                            <td className="px-3 py-4 text-right text-gray-400 font-mono text-xs">{candidate.algo_score}</td>
                                            <td className="px-3 py-4 text-right text-gray-400 font-mono text-xs">{candidate.ai_score}</td>
                                            <td className="px-3 py-4 text-right text-gray-400 text-xs">{candidate.years_experience || 0}y</td>
                                            {/* Dynamic field values */}
                                            {extractionFields.filter(f => !['bio_summary'].includes(f.field_name)).map(field => {
                                                const value = candidate[field.field_name];
                                                let displayValue: React.ReactNode = '—';

                                                if (value !== undefined && value !== null) {
                                                    if (typeof value === 'boolean') {
                                                        displayValue = value ? <span className="text-green-400">✓</span> : <span className="text-red-400/50">✗</span>;
                                                    } else if (typeof value === 'number') {
                                                        displayValue = <span className="font-mono">{String(value)}</span>;
                                                    } else if (Array.isArray(value)) {
                                                        displayValue = value.length > 0 ? `${value.length}` : '—';
                                                    } else if (typeof value === 'string') {
                                                        displayValue = value.length > 15 ? value.slice(0, 15) + '…' : value;
                                                    } else {
                                                        displayValue = String(value).slice(0, 15);
                                                    }
                                                }

                                                return (
                                                    <td key={field.field_name} className="px-3 py-4 text-center text-xs text-gray-400">
                                                        {displayValue}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            {/* Candidate Detail Modal */}
            {selectedCandidate && (
                <div
                    className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6"
                    onClick={() => setSelectedCandidate(null)}
                >
                    {/* Backdrop */}
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" />

                    {/* Modal Content */}
                    <div
                        className="relative w-full max-w-2xl bg-[#0d0d0f] border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-scale-in"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="p-6 border-b border-white/5 flex items-start justify-between bg-white/5">
                            <div>
                                <h2 className="text-2xl font-light text-white mb-1">{selectedCandidate.name}</h2>
                                <p className="text-white/40 text-sm">{selectedCandidate.job_title}</p>
                            </div>
                            <button
                                onClick={() => setSelectedCandidate(null)}
                                className="p-2 rounded-full hover:bg-white/10 text-white/40 hover:text-white transition-colors"
                            >
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        <div className="p-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
                            {/* Score Cards */}
                            <div className="grid grid-cols-3 gap-4 mb-8">
                                <div className="glass-panel p-4 rounded-xl text-center relative overflow-hidden group">
                                    <div className="absolute inset-0 bg-indigo-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    <div className="text-3xl font-light text-white mb-1">
                                        {selectedCandidate.final_score || Math.round(((selectedCandidate.algo_score || 0) + (selectedCandidate.ai_score || 0)) / 2)}
                                    </div>
                                    <div className="text-[10px] uppercase tracking-widest text-indigo-400 font-medium">Final Score</div>
                                </div>
                                <div className="glass-panel p-4 rounded-xl text-center">
                                    <div className="text-3xl font-light text-white/80 mb-1">{selectedCandidate.algo_score}</div>
                                    <div className="text-[10px] uppercase tracking-widest text-white/40">Algo Score</div>
                                </div>
                                <div className="glass-panel p-4 rounded-xl text-center">
                                    <div className="text-3xl font-light text-white/80 mb-1">{selectedCandidate.ai_score}</div>
                                    <div className="text-[10px] uppercase tracking-widest text-white/40">AI Score</div>
                                </div>
                            </div>

                            {/* Summary Section */}
                            <div className="mb-8">
                                <h3 className="text-xs font-bold text-white/40 uppercase tracking-widest mb-3 flex items-center gap-2">
                                    <span className="w-1 h-1 rounded-full bg-indigo-500" />
                                    Executive Summary
                                </h3>
                                <p className="text-white/80 leading-relaxed text-sm">
                                    {selectedCandidate.one_line_summary || selectedCandidate.bio_summary}
                                </p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                                {/* Strengths */}
                                {selectedCandidate.pros?.length > 0 && (
                                    <div className="glass-panel p-5 rounded-xl bg-green-500/5 border-green-500/10">
                                        <h3 className="text-xs font-bold text-green-400 uppercase tracking-widest mb-3">
                                            Key Strengths
                                        </h3>
                                        <ul className="space-y-2">
                                            {selectedCandidate.pros.map((pro, i) => (
                                                <li key={i} className="flex items-start gap-2 text-sm text-white/70">
                                                    <span className="text-green-400 mt-[2px] block text-[10px]">✚</span>
                                                    <span className="leading-snug">{pro}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                {/* Weaknesses */}
                                {selectedCandidate.cons?.length > 0 && (
                                    <div className="glass-panel p-5 rounded-xl bg-red-500/5 border-red-500/10">
                                        <h3 className="text-xs font-bold text-red-400 uppercase tracking-widest mb-3">
                                            Risk Factors
                                        </h3>
                                        <ul className="space-y-2">
                                            {selectedCandidate.cons.map((con, i) => (
                                                <li key={i} className="flex items-start gap-2 text-sm text-white/70">
                                                    <span className="text-red-400 mt-[2px] block text-[10px]">−</span>
                                                    <span className="leading-snug">{con}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-6 border-t border-white/5 bg-white/5 flex gap-3">
                            <button
                                onClick={() => setSelectedCandidate(null)}
                                className="flex-1 px-4 py-3 rounded-xl text-sm font-medium text-white/60 hover:text-white hover:bg-white/5 transition-colors"
                            >
                                Close
                            </button>
                            <Link
                                href={`/candidates/${selectedCandidate.id}`}
                                className="flex-[2] px-4 py-3 rounded-xl text-sm font-medium bg-indigo-500 hover:bg-indigo-600 text-white transition-colors text-center shadow-lg shadow-indigo-500/20"
                            >
                                View Full Profile & Interview
                            </Link>
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
}
