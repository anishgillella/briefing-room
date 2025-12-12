"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
    Users,
    Upload,
    Filter,
    RefreshCw,
    Search,
    ArrowLeft,
    LayoutGrid,
    List
} from "lucide-react";
import CandidateCard from "@/components/candidate-card";
import CsvUpload from "@/components/csv-upload";
import { getCandidates, getPlutoInfo } from "@/lib/api";
import { Candidate, CandidateTier } from "@/lib/types";
import { cn } from "@/lib/utils";

const TIER_OPTIONS: (CandidateTier | "All")[] = ["All", "Top Tier", "Strong", "Good", "Evaluate", "Poor"];

export default function CandidatesPage() {
    const router = useRouter();
    const [candidates, setCandidates] = useState<Candidate[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showUpload, setShowUpload] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedTier, setSelectedTier] = useState<CandidateTier | "All">("All");
    const [totalCandidates, setTotalCandidates] = useState(0);
    const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

    const loadCandidates = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            const tier = selectedTier !== "All" ? selectedTier : undefined;
            const response = await getCandidates(tier, undefined, 100, 0);

            setCandidates(response.candidates);
            setTotalCandidates(response.total);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load candidates");
        } finally {
            setLoading(false);
        }
    }, [selectedTier]);

    useEffect(() => {
        loadCandidates();
    }, [loadCandidates]);

    // Filter by search query
    const filteredCandidates = candidates.filter(c => {
        if (!searchQuery) return true;
        const query = searchQuery.toLowerCase();
        return (
            c.name.toLowerCase().includes(query) ||
            c.job_title?.toLowerCase().includes(query) ||
            c.one_line_summary?.toLowerCase().includes(query) ||
            c.location_city?.toLowerCase().includes(query)
        );
    });

    const handleCandidateClick = (candidate: Candidate) => {
        router.push(`/candidates/${candidate.id}`);
    };

    const handleUploadComplete = () => {
        setShowUpload(false);
        loadCandidates();
    };

    // Show upload screen if no candidates
    if (!loading && candidates.length === 0 && !showUpload) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
                <div className="container mx-auto px-4 py-16">
                    <div className="text-center mb-12">
                        <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-primary to-purple-400 bg-clip-text text-transparent">
                            Candidate Pipeline
                        </h1>
                        <p className="text-lg text-muted-foreground max-w-xl mx-auto">
                            Upload a CSV of candidates to get AI-powered scoring, ranking, and interview preparation.
                        </p>
                    </div>

                    <CsvUpload
                        onUploadComplete={handleUploadComplete}
                        onProcessingStart={() => { }}
                    />

                    <div className="mt-8 text-center">
                        <button
                            onClick={() => router.push("/")}
                            className="text-sm text-muted-foreground hover:text-primary transition-colors"
                        >
                            ← Back to Interview Room
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
            {/* Header */}
            <header className="sticky top-0 z-50 bg-slate-950/80 backdrop-blur-lg border-b border-white/5">
                <div className="container mx-auto px-4">
                    <div className="flex items-center justify-between h-16">
                        {/* Left - Back & Title */}
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => router.push("/")}
                                className="p-2 hover:bg-white/5 rounded-lg transition-colors"
                            >
                                <ArrowLeft className="w-5 h-5" />
                            </button>
                            <div>
                                <h1 className="text-xl font-semibold flex items-center gap-2">
                                    <Users className="w-5 h-5 text-primary" />
                                    Candidates
                                </h1>
                                <p className="text-xs text-muted-foreground">
                                    {totalCandidates} candidates ranked
                                </p>
                            </div>
                        </div>

                        {/* Right - Actions */}
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setShowUpload(true)}
                                className="flex items-center gap-2 px-4 py-2 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg transition-colors"
                            >
                                <Upload className="w-4 h-4" />
                                Upload CSV
                            </button>
                            <button
                                onClick={loadCandidates}
                                className="p-2 hover:bg-white/5 rounded-lg transition-colors"
                                title="Refresh"
                            >
                                <RefreshCw className={cn("w-5 h-5", loading && "animate-spin")} />
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            <main className="container mx-auto px-4 py-6">
                {/* Upload Modal */}
                {showUpload && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                        <div className="bg-slate-900 rounded-2xl p-8 max-w-xl w-full mx-4 border border-white/10">
                            <h2 className="text-2xl font-semibold mb-6 text-center">Upload Candidates</h2>
                            <CsvUpload
                                onUploadComplete={handleUploadComplete}
                                onProcessingStart={() => { }}
                            />
                            <button
                                onClick={() => setShowUpload(false)}
                                className="mt-6 w-full py-2 text-muted-foreground hover:text-white transition-colors"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                )}

                {/* Filters Row */}
                <div className="flex flex-wrap items-center gap-4 mb-6">
                    {/* Search */}
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder="Search candidates..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-primary/50 transition-colors"
                        />
                    </div>

                    {/* Tier Filter */}
                    <div className="flex items-center gap-2">
                        <Filter className="w-4 h-4 text-muted-foreground" />
                        <div className="flex gap-1 p-1 bg-white/5 rounded-lg">
                            {TIER_OPTIONS.map((tier) => (
                                <button
                                    key={tier}
                                    onClick={() => setSelectedTier(tier)}
                                    className={cn(
                                        "px-3 py-1 rounded-md text-sm transition-colors",
                                        selectedTier === tier
                                            ? "bg-primary text-primary-foreground"
                                            : "hover:bg-white/5 text-muted-foreground"
                                    )}
                                >
                                    {tier}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* View Toggle */}
                    <div className="flex gap-1 p-1 bg-white/5 rounded-lg">
                        <button
                            onClick={() => setViewMode("grid")}
                            className={cn(
                                "p-2 rounded-md transition-colors",
                                viewMode === "grid" ? "bg-white/10" : "hover:bg-white/5"
                            )}
                        >
                            <LayoutGrid className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => setViewMode("list")}
                            className={cn(
                                "p-2 rounded-md transition-colors",
                                viewMode === "list" ? "bg-white/10" : "hover:bg-white/5"
                            )}
                        >
                            <List className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Error State */}
                {error && (
                    <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive">
                        {error}
                    </div>
                )}

                {/* Loading State */}
                {loading && (
                    <div className="flex items-center justify-center py-20">
                        <RefreshCw className="w-8 h-8 animate-spin text-primary" />
                    </div>
                )}

                {/* Candidates Grid */}
                {!loading && (
                    <div className={cn(
                        "grid gap-4",
                        viewMode === "grid"
                            ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
                            : "grid-cols-1 max-w-3xl mx-auto"
                    )}>
                        {filteredCandidates.map((candidate) => (
                            <CandidateCard
                                key={candidate.id}
                                candidate={candidate}
                                onClick={() => handleCandidateClick(candidate)}
                            />
                        ))}
                    </div>
                )}

                {/* Empty State (after search) */}
                {!loading && filteredCandidates.length === 0 && candidates.length > 0 && (
                    <div className="text-center py-20 text-muted-foreground">
                        <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>No candidates match your search</p>
                    </div>
                )}
            </main>
        </div>
    );
}
