"use client";

import { useState, useEffect } from "react";
import {
    FileText,
    Sparkles,
    Loader2,
    CheckCircle,
    AlertCircle,
    ClipboardPaste,
    User,
    MessageSquare,
    ChevronDown,
    UserCircle,
    BarChart3,
    Save,
    Brain,
} from "lucide-react";
import { getInterviewers, Interviewer } from "@/lib/interviewerApi";

interface TranscriptTurn {
    speaker: "interviewer" | "candidate";
    text: string;
    timestamp?: number;
    is_question?: boolean;
    speaker_name?: string;
}

interface AnalyticsResult {
    candidate_analytics: Record<string, unknown> | null;
    interviewer_analytics: Record<string, unknown> | null;
    status: string;
    message: string;
}

interface TranscriptPasteTabProps {
    interviewId: string;
    candidateName: string;
    stage: string;
    onTranscriptSaved: (transcript: TranscriptTurn[]) => void;
    existingTranscript?: TranscriptTurn[];
    defaultInterviewerId?: string;
}

export default function TranscriptPasteTab({
    interviewId,
    candidateName,
    stage,
    onTranscriptSaved,
    existingTranscript,
    defaultInterviewerId,
}: TranscriptPasteTabProps) {
    const [transcriptText, setTranscriptText] = useState("");
    const [selectedInterviewer, setSelectedInterviewer] = useState<Interviewer | null>(null);
    const [interviewers, setInterviewers] = useState<Interviewer[]>([]);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [loadingInterviewers, setLoadingInterviewers] = useState(true);
    const [isParsing, setIsParsing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isGeneratingAnalytics, setIsGeneratingAnalytics] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [parsedTranscript, setParsedTranscript] = useState<TranscriptTurn[] | null>(null);
    const [parseMetadata, setParseMetadata] = useState<{
        interviewer_name?: string;
        candidate_name?: string;
        questions_count?: number;
        parsing_notes?: string;
    } | null>(null);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [analyticsResult, setAnalyticsResult] = useState<AnalyticsResult | null>(null);

    const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

    // Load interviewers on mount
    useEffect(() => {
        const loadInterviewersList = async () => {
            try {
                const data = await getInterviewers();
                setInterviewers(data);
                if (defaultInterviewerId) {
                    const defaultInterviewer = data.find(i => i.id === defaultInterviewerId);
                    if (defaultInterviewer) {
                        setSelectedInterviewer(defaultInterviewer);
                    }
                }
            } catch (err) {
                console.error("Failed to load interviewers:", err);
            } finally {
                setLoadingInterviewers(false);
            }
        };
        loadInterviewersList();
    }, [defaultInterviewerId]);

    // Smart parse using Gemini 2.5 Flash
    const handleSmartParse = async () => {
        if (!transcriptText.trim()) {
            setError("Please paste a transcript");
            return;
        }

        if (transcriptText.trim().length < 50) {
            setError("Transcript is too short. Please paste the full conversation.");
            return;
        }

        setIsParsing(true);
        setError(null);

        try {
            const response = await fetch(`${API_URL}/api/interviews/smart-parse`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    raw_transcript: transcriptText,
                    candidate_name: candidateName,
                    interviewer_name: selectedInterviewer?.name,
                }),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.detail || "Failed to parse transcript");
            }

            const result = await response.json();

            // Convert to our turn format
            const turns: TranscriptTurn[] = result.turns.map((t: { speaker: string; text: string; is_question?: boolean; speaker_name?: string }, i: number) => ({
                speaker: t.speaker as "interviewer" | "candidate",
                text: t.text,
                timestamp: i,
                is_question: t.is_question,
                speaker_name: t.speaker_name,
            }));

            if (turns.length < 2) {
                throw new Error("Could not parse transcript. Please ensure it contains a conversation between interviewer and candidate.");
            }

            setParsedTranscript(turns);
            setParseMetadata({
                interviewer_name: result.interviewer_name,
                candidate_name: result.candidate_name,
                questions_count: result.questions_count,
                parsing_notes: result.parsing_notes,
            });
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to parse transcript");
        } finally {
            setIsParsing(false);
        }
    };

    // Save transcript
    const handleSave = async () => {
        if (!parsedTranscript || parsedTranscript.length === 0) {
            setError("No transcript to save");
            return;
        }

        setIsSaving(true);
        setError(null);

        try {
            const response = await fetch(
                `${API_URL}/api/interviews/${interviewId}/paste-transcript`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        turns: parsedTranscript,
                        full_text: transcriptText,
                        interviewer_id: selectedInterviewer?.id || undefined,
                        interviewer_name: selectedInterviewer?.name || undefined,
                    }),
                }
            );

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.detail || "Failed to save transcript");
            }

            setSaveSuccess(true);
            onTranscriptSaved(parsedTranscript);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to save transcript");
        } finally {
            setIsSaving(false);
        }
    };

    // Generate analytics
    const handleGenerateAnalytics = async () => {
        // Save first if not already saved
        if (!saveSuccess) {
            await handleSave();
        }

        setIsGeneratingAnalytics(true);
        setError(null);

        try {
            const response = await fetch(
                `${API_URL}/api/interviews/${interviewId}/generate-analytics`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        interview_id: interviewId,
                        interviewer_id: selectedInterviewer?.id || undefined,
                    }),
                }
            );

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.detail || "Failed to generate analytics");
            }

            const result: AnalyticsResult = await response.json();
            setAnalyticsResult(result);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to generate analytics");
        } finally {
            setIsGeneratingAnalytics(false);
        }
    };

    const handleReset = () => {
        setParsedTranscript(null);
        setParseMetadata(null);
        setSaveSuccess(false);
        setAnalyticsResult(null);
        setError(null);
    };

    // Render interviewer dropdown
    const renderInterviewerDropdown = (compact = false) => (
        <div className="relative">
            <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className={`w-full flex items-center justify-between gap-3 ${compact ? 'px-3 py-2' : 'px-4 py-3'} bg-black/30 border border-orange-500/20 ${compact ? 'rounded-lg' : 'rounded-xl'} text-white hover:border-orange-500/40 transition-colors`}
            >
                <div className="flex items-center gap-3">
                    {selectedInterviewer ? (
                        <>
                            <div className={`${compact ? 'w-6 h-6' : 'w-8 h-8'} rounded-full bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center`}>
                                <span className={`${compact ? 'text-[10px]' : 'text-xs'} text-white font-medium`}>
                                    {selectedInterviewer.name.split(' ').map(n => n[0]).join('')}
                                </span>
                            </div>
                            <div className="text-left">
                                <div className={`${compact ? 'text-xs' : 'text-sm'} font-medium`}>{selectedInterviewer.name}</div>
                                {!compact && (selectedInterviewer.team || selectedInterviewer.department) && (
                                    <div className="text-[10px] text-white/40">
                                        {[selectedInterviewer.team, selectedInterviewer.department].filter(Boolean).join(' · ')}
                                    </div>
                                )}
                            </div>
                        </>
                    ) : (
                        <span className={`text-white/30 ${compact ? 'text-xs' : 'text-sm'}`}>Select interviewer...</span>
                    )}
                </div>
                <ChevronDown className={`w-4 h-4 text-orange-400 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
            </button>
            {isDropdownOpen && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-[#1a1a1a] border border-orange-500/20 rounded-xl shadow-2xl z-50 overflow-hidden">
                    <div className="p-2 border-b border-white/5">
                        <div className="text-xs text-white/40 uppercase tracking-wider px-2 py-1">
                            Available Interviewers
                        </div>
                    </div>
                    <div className="max-h-48 overflow-y-auto">
                        {loadingInterviewers ? (
                            <div className="px-4 py-3 text-sm text-white/40 flex items-center gap-2">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Loading...
                            </div>
                        ) : interviewers.length === 0 ? (
                            <div className="px-4 py-3 text-sm text-white/40">No interviewers available</div>
                        ) : (
                            interviewers.map((interviewer) => (
                                <button
                                    key={interviewer.id}
                                    onClick={() => {
                                        setSelectedInterviewer(interviewer);
                                        setIsDropdownOpen(false);
                                    }}
                                    className={`w-full px-4 py-3 flex items-center gap-3 hover:bg-orange-500/10 transition-colors text-left ${
                                        selectedInterviewer?.id === interviewer.id ? 'bg-orange-500/20' : ''
                                    }`}
                                >
                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-500/50 to-pink-500/50 flex items-center justify-center">
                                        <span className="text-xs text-white font-medium">
                                            {interviewer.name.split(' ').map(n => n[0]).join('')}
                                        </span>
                                    </div>
                                    <div>
                                        <div className="text-sm text-white">{interviewer.name}</div>
                                        {(interviewer.team || interviewer.department) && (
                                            <div className="text-xs text-white/40">
                                                {[interviewer.team, interviewer.department].filter(Boolean).join(' · ')}
                                            </div>
                                        )}
                                    </div>
                                </button>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );

    // If analytics were generated, show results
    if (analyticsResult) {
        const candAnalytics = analyticsResult.candidate_analytics as { overall?: { overall_score?: number; recommendation?: string; recommendation_reasoning?: string; highlights?: string[]; red_flags?: string[] }; qa_pairs?: { question: string; answer: string; metrics?: { relevance?: number; clarity?: number; depth?: number } }[] } | null;
        const intAnalytics = analyticsResult.interviewer_analytics as { overall_score?: number; question_quality_score?: number; topic_coverage_score?: number; bias_score?: number; improvement_suggestions?: string[] } | null;

        return (
            <div className="animate-fade-in space-y-6">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500/20 to-cyan-500/20 flex items-center justify-center">
                            <BarChart3 className="w-6 h-6 text-purple-400" />
                        </div>
                        <div>
                            <h3 className="text-lg font-medium text-white">Analytics Generated</h3>
                            <p className="text-sm text-white/50">{analyticsResult.message}</p>
                        </div>
                    </div>
                    <button
                        onClick={handleReset}
                        className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-sm text-white/70 transition-colors"
                    >
                        Parse Another
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Candidate Analytics */}
                    {candAnalytics && (
                        <div className="glass-panel rounded-2xl p-6 border border-blue-500/20 bg-blue-500/5">
                            <h4 className="font-medium text-blue-300 mb-4 flex items-center gap-2">
                                <User className="w-4 h-4" />
                                Candidate Analytics
                            </h4>
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-white/50 text-sm">Overall Score</span>
                                    <span className="text-2xl font-bold text-blue-400">
                                        {candAnalytics.overall?.overall_score || 0}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-white/50 text-sm">Recommendation</span>
                                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                                        candAnalytics.overall?.recommendation?.includes('Hire') && !candAnalytics.overall?.recommendation?.includes('No')
                                            ? 'bg-green-500/20 text-green-400'
                                            : 'bg-red-500/20 text-red-400'
                                    }`}>
                                        {candAnalytics.overall?.recommendation || 'N/A'}
                                    </span>
                                </div>
                                {candAnalytics.overall?.recommendation_reasoning && (
                                    <p className="text-xs text-white/40 italic">
                                        "{candAnalytics.overall.recommendation_reasoning}"
                                    </p>
                                )}
                                {candAnalytics.qa_pairs && (
                                    <div className="text-xs text-white/40 pt-2 border-t border-white/5">
                                        {candAnalytics.qa_pairs.length} questions analyzed
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Interviewer Analytics */}
                    {intAnalytics && (
                        <div className="glass-panel rounded-2xl p-6 border border-purple-500/20 bg-purple-500/5">
                            <h4 className="font-medium text-purple-300 mb-4 flex items-center gap-2">
                                <UserCircle className="w-4 h-4" />
                                Interviewer Analytics
                            </h4>
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-white/50 text-sm">Overall Score</span>
                                    <span className="text-2xl font-bold text-purple-400">
                                        {intAnalytics.overall_score || 0}
                                    </span>
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                    <div>
                                        <span className="text-white/40">Question Quality</span>
                                        <div className="text-white font-medium">{intAnalytics.question_quality_score || 0}/100</div>
                                    </div>
                                    <div>
                                        <span className="text-white/40">Topic Coverage</span>
                                        <div className="text-white font-medium">{intAnalytics.topic_coverage_score || 0}/100</div>
                                    </div>
                                    <div>
                                        <span className="text-white/40">Bias Score</span>
                                        <div className={`font-medium ${(intAnalytics.bias_score || 0) < 20 ? 'text-green-400' : 'text-yellow-400'}`}>
                                            {intAnalytics.bias_score || 0}/100
                                        </div>
                                    </div>
                                </div>
                                {intAnalytics.improvement_suggestions && intAnalytics.improvement_suggestions.length > 0 && (
                                    <div className="text-xs text-white/40 pt-2 border-t border-white/5">
                                        {intAnalytics.improvement_suggestions.length} improvement suggestions
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // If already has transcript, show it
    if (existingTranscript && existingTranscript.length > 0) {
        return (
            <div className="animate-fade-in">
                <div className="glass-panel rounded-3xl p-8 border border-green-500/20 bg-green-500/5">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center">
                            <CheckCircle className="w-6 h-6 text-green-400" />
                        </div>
                        <div>
                            <h3 className="text-lg font-medium text-green-300">
                                Transcript Already Saved
                            </h3>
                            <p className="text-sm text-green-400/60">
                                {existingTranscript.length} turns recorded for {stage}
                            </p>
                        </div>
                    </div>

                    <div className="bg-black/20 rounded-2xl p-4 max-h-64 overflow-y-auto custom-scrollbar">
                        {existingTranscript.slice(0, 5).map((turn, i) => (
                            <div key={i} className="flex gap-3 mb-3">
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                                    turn.speaker === "interviewer" ? "bg-purple-500/20 text-purple-400" : "bg-blue-500/20 text-blue-400"
                                }`}>
                                    <User className="w-3 h-3" />
                                </div>
                                <div className="flex-1">
                                    <span className={`text-[10px] font-bold uppercase tracking-wider ${
                                        turn.speaker === "interviewer" ? "text-purple-400" : "text-blue-400"
                                    }`}>
                                        {turn.speaker}
                                    </span>
                                    <p className="text-sm text-white/70 line-clamp-2">{turn.text}</p>
                                </div>
                            </div>
                        ))}
                        {existingTranscript.length > 5 && (
                            <p className="text-center text-white/30 text-xs mt-2">
                                + {existingTranscript.length - 5} more turns
                            </p>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    // Success state - transcript saved
    if (saveSuccess && parsedTranscript) {
        return (
            <div className="animate-fade-in space-y-6">
                <div className="glass-panel rounded-3xl p-8 border border-green-500/20 bg-green-500/5">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center">
                                <CheckCircle className="w-6 h-6 text-green-400" />
                            </div>
                            <div>
                                <h3 className="text-lg font-medium text-green-300">
                                    Transcript Saved Successfully
                                </h3>
                                <p className="text-sm text-green-400/60">
                                    {parsedTranscript.length} conversation turns parsed and stored
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={handleGenerateAnalytics}
                            disabled={isGeneratingAnalytics}
                            className="px-6 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-cyan-600 text-white font-semibold hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            {isGeneratingAnalytics ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Generating...
                                </>
                            ) : (
                                <>
                                    <BarChart3 className="w-4 h-4" />
                                    Generate Analytics
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {error && (
                    <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        {error}
                    </div>
                )}
            </div>
        );
    }

    // Preview state - after parsing, before saving
    if (parsedTranscript) {
        return (
            <div className="animate-fade-in space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-lg font-medium text-white flex items-center gap-2">
                            <Brain className="w-5 h-5 text-purple-400" />
                            AI-Parsed Transcript
                        </h3>
                        <p className="text-sm text-white/50">
                            {parsedTranscript.length} turns • {parseMetadata?.questions_count || 0} questions detected
                        </p>
                        {parseMetadata?.parsing_notes && (
                            <p className="text-xs text-yellow-400/70 mt-1">Note: {parseMetadata.parsing_notes}</p>
                        )}
                    </div>
                    <button
                        onClick={handleReset}
                        className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-sm text-white/70 transition-colors"
                    >
                        Edit Transcript
                    </button>
                </div>

                {/* Transcript Preview */}
                <div className="glass-panel rounded-3xl p-6 max-h-[400px] overflow-y-auto custom-scrollbar">
                    <div className="space-y-4">
                        {parsedTranscript.map((turn, i) => (
                            <div key={i} className={`flex gap-4 ${turn.speaker === "interviewer" ? "" : "flex-row-reverse"}`}>
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                                    turn.speaker === "interviewer" ? "bg-purple-500/20 text-purple-400" : "bg-blue-500/20 text-blue-400"
                                }`}>
                                    <User className="w-4 h-4" />
                                </div>
                                <div className={`flex-1 max-w-[80%] p-4 rounded-2xl ${
                                    turn.speaker === "interviewer"
                                        ? "bg-purple-500/10 border border-purple-500/20 rounded-tl-sm"
                                        : "bg-blue-500/10 border border-blue-500/20 rounded-tr-sm ml-auto"
                                }`}>
                                    <div className="flex items-center gap-2">
                                        <span className={`text-[10px] font-bold uppercase tracking-widest ${
                                            turn.speaker === "interviewer" ? "text-purple-400" : "text-blue-400"
                                        }`}>
                                            {turn.speaker_name || turn.speaker}
                                        </span>
                                        {turn.is_question && (
                                            <span className="text-[8px] px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-400 uppercase">
                                                Question
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-white/80 text-sm leading-relaxed mt-1">{turn.text}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Interviewer Selector */}
                <div className="glass-panel rounded-2xl p-4 border border-orange-500/20 bg-orange-500/5">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-3 flex-shrink-0">
                            <UserCircle className="w-4 h-4 text-orange-400" />
                            <span className="text-sm text-orange-300 font-medium">Interviewer:</span>
                        </div>
                        <div className="flex-1 max-w-xs">
                            {renderInterviewerDropdown(true)}
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between">
                    <div className="flex gap-6 text-sm">
                        <div>
                            <span className="text-white/40">Interviewer turns: </span>
                            <span className="text-purple-400 font-medium">
                                {parsedTranscript.filter((t) => t.speaker === "interviewer").length}
                            </span>
                        </div>
                        <div>
                            <span className="text-white/40">Candidate turns: </span>
                            <span className="text-blue-400 font-medium">
                                {parsedTranscript.filter((t) => t.speaker === "candidate").length}
                            </span>
                        </div>
                    </div>

                    <div className="flex gap-3">
                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="px-6 py-3 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 text-white font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            {isSaving ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                <>
                                    <Save className="w-4 h-4" />
                                    Save Transcript
                                </>
                            )}
                        </button>
                        <button
                            onClick={handleGenerateAnalytics}
                            disabled={isGeneratingAnalytics || isSaving}
                            className="px-6 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-cyan-600 text-white font-semibold hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-[0_0_30px_rgba(168,85,247,0.3)]"
                        >
                            {isGeneratingAnalytics ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Analyzing...
                                </>
                            ) : (
                                <>
                                    <BarChart3 className="w-4 h-4" />
                                    Generate Analytics
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {error && (
                    <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        {error}
                    </div>
                )}
            </div>
        );
    }

    // Default: Input state
    return (
        <div className="animate-fade-in">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Input Area */}
                <div className="lg:col-span-2">
                    <div className="glass-panel rounded-3xl p-1 h-full">
                        <div className="p-6 h-full flex flex-col">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="font-medium text-sm text-gray-400 uppercase tracking-wider flex items-center gap-2">
                                    <ClipboardPaste className="w-4 h-4" />
                                    Paste Transcript
                                </h3>
                                <span className="text-xs text-white/30">
                                    {transcriptText.length.toLocaleString()} chars
                                </span>
                            </div>

                            <textarea
                                value={transcriptText}
                                onChange={(e) => setTranscriptText(e.target.value)}
                                placeholder={`Paste your interview transcript here...

Supported formats:
• Speaker labels: "Interviewer: Hello..." or "John: Hi there..."
• Zoom transcripts
• Otter.ai exports
• Any format - AI will intelligently parse it

Example:
Interviewer: Thanks for joining us today. Can you tell me about yourself?
${candidateName}: Sure! I've been working as a software engineer for 5 years...
Interviewer: That's great. What attracted you to this role?`}
                                className="flex-1 min-h-[350px] bg-transparent border-0 resize-none text-gray-300 placeholder:text-gray-700 focus:outline-none focus:ring-0 text-sm leading-relaxed"
                            />

                            {error && (
                                <div className="mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-2">
                                    <AlertCircle className="w-4 h-4 shrink-0" />
                                    {error}
                                </div>
                            )}

                            <div className="mt-4">
                                <button
                                    onClick={handleSmartParse}
                                    disabled={!transcriptText.trim() || isParsing}
                                    className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-cyan-600 text-white font-semibold hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    {isParsing ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            AI Parsing...
                                        </>
                                    ) : (
                                        <>
                                            <Brain className="w-4 h-4" />
                                            Smart Parse with AI
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Info Panel */}
                <div className="space-y-4">
                    {/* Interviewer Selector */}
                    <div className="glass-panel rounded-2xl p-6 border border-orange-500/20 bg-orange-500/5">
                        <h4 className="font-medium text-orange-300 mb-3 text-sm uppercase tracking-wider flex items-center gap-2">
                            <UserCircle className="w-4 h-4" />
                            Select Interviewer
                        </h4>
                        <p className="text-xs text-orange-400/60 mb-3">
                            Select who conducted this interview for analytics
                        </p>
                        {renderInterviewerDropdown()}
                    </div>

                    {/* AI Features */}
                    <div className="glass-panel rounded-2xl p-6 border border-purple-500/20 bg-purple-500/5">
                        <h4 className="font-medium text-purple-300 mb-4 text-sm uppercase tracking-wider flex items-center gap-2">
                            <Brain className="w-4 h-4" />
                            AI-Powered Features
                        </h4>
                        <ul className="space-y-3">
                            {[
                                "Smart speaker detection",
                                "Cleans transcription errors",
                                "Identifies questions",
                                "Generates candidate analytics",
                                "Generates interviewer analytics",
                            ].map((item, i) => (
                                <li key={i} className="flex items-center gap-3 text-sm text-white/50">
                                    <div className="w-5 h-5 rounded-full bg-purple-500/20 flex items-center justify-center">
                                        <Sparkles className="w-3 h-3 text-purple-400" />
                                    </div>
                                    {item}
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Supported Formats */}
                    <div className="glass-panel rounded-2xl p-6 border border-white/5">
                        <h4 className="font-medium text-white/80 mb-3 text-sm flex items-center gap-2">
                            <MessageSquare className="w-4 h-4 text-blue-400" />
                            Supported Formats
                        </h4>
                        <ul className="space-y-2 text-sm text-white/40">
                            <li>• Plain text conversations</li>
                            <li>• Zoom transcript exports</li>
                            <li>• Otter.ai transcripts</li>
                            <li>• Google Meet captions</li>
                            <li>• Any format - AI adapts!</li>
                        </ul>
                    </div>

                    {/* Stage Info */}
                    <div className="glass-panel rounded-2xl p-6 border border-cyan-500/20 bg-cyan-500/5">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-cyan-500/20 flex items-center justify-center">
                                <span className="text-cyan-400 font-bold text-sm">
                                    {stage.replace("round_", "R")}
                                </span>
                            </div>
                            <div>
                                <h4 className="font-medium text-cyan-300 text-sm">
                                    {stage.replace("_", " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                                </h4>
                                <p className="text-xs text-cyan-400/60">
                                    Interview with {candidateName}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
