"use client";

import { useState } from "react";
import { FileText, Sparkles, Loader2, CheckCircle, AlertCircle, Mic, ArrowRight } from "lucide-react";

interface JDPastePanelProps {
    onParse: (jdText: string) => Promise<void>;
    onSkip: () => void;
    isLoading?: boolean;
    parseResult?: {
        success: boolean;
        extraction_summary: string;
        completion_percentage: number;
        missing_required: string[];
        suggested_questions: string[];
    };
    companyName?: string;
}

export default function JDPastePanel({
    onParse,
    onSkip,
    isLoading = false,
    parseResult,
    companyName,
}: JDPastePanelProps) {
    const [jdText, setJdText] = useState("");
    const [error, setError] = useState<string | null>(null);

    const handleParse = async () => {
        if (!jdText.trim()) {
            setError("Please paste a job description");
            return;
        }

        if (jdText.trim().length < 50) {
            setError("Job description is too short. Please paste the full JD.");
            return;
        }

        setError(null);

        try {
            await onParse(jdText);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to parse JD");
        }
    };

    return (
        <div className="max-w-4xl mx-auto animate-fade-in">
            {/* Header */}
            <div className="text-center mb-8">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 mb-6 text-sm font-medium text-purple-300">
                    <Sparkles className="w-4 h-4" />
                    Smart Extraction
                </div>
                <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
                    <span className="text-white">Got a Job Description?</span>
                </h2>
                <p className="text-lg text-white/50 max-w-lg mx-auto">
                    {companyName
                        ? `Paste your JD for ${companyName} and we'll extract everything automatically.`
                        : "Paste your JD and we'll extract all the details. Or skip and tell us via voice."}
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* JD Input */}
                <div className="lg:col-span-2">
                    <div className="glass-card-premium p-1 rounded-3xl h-full">
                        <div className="p-6 h-full flex flex-col">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="font-medium text-sm text-gray-400 uppercase tracking-wider flex items-center gap-2">
                                    <FileText className="w-4 h-4" />
                                    Job Description
                                </h3>
                                <span className="text-xs text-white/30">
                                    {jdText.length.toLocaleString()} chars
                                </span>
                            </div>

                            <textarea
                                value={jdText}
                                onChange={(e) => setJdText(e.target.value)}
                                placeholder="Paste your full job description here...

Example:
We're looking for a Senior Software Engineer to join our platform team. You'll work on building scalable distributed systems...

Requirements:
- 5+ years of experience
- Strong in Python or Go
- Experience with Kubernetes..."
                                className="flex-1 min-h-[300px] bg-transparent border-0 resize-none text-gray-300 placeholder:text-gray-700 focus:outline-none focus:ring-0 text-sm leading-relaxed"
                                disabled={isLoading}
                            />

                            {error && (
                                <div className="mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-2">
                                    <AlertCircle className="w-4 h-4 shrink-0" />
                                    {error}
                                </div>
                            )}

                            <div className="mt-4 flex gap-3">
                                <button
                                    onClick={handleParse}
                                    disabled={isLoading || !jdText.trim()}
                                    className="flex-1 py-3 rounded-xl bg-white text-black font-semibold hover:bg-gray-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    {isLoading ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            Extracting...
                                        </>
                                    ) : (
                                        <>
                                            <Sparkles className="w-4 h-4" />
                                            Extract Details
                                        </>
                                    )}
                                </button>
                                <button
                                    onClick={onSkip}
                                    disabled={isLoading}
                                    className="px-6 py-3 rounded-xl bg-white/5 text-white/70 font-medium hover:bg-white/10 hover:text-white transition-all border border-white/10 flex items-center gap-2"
                                >
                                    <Mic className="w-4 h-4" />
                                    Skip to Voice
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Extraction Results / Info Panel */}
                <div className="space-y-4">
                    {parseResult ? (
                        <>
                            {/* Success Card */}
                            <div className="glass-card-premium p-6 rounded-2xl border border-green-500/20 bg-green-500/5">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                                        <CheckCircle className="w-5 h-5 text-green-400" />
                                    </div>
                                    <div>
                                        <h4 className="font-medium text-green-300">Extracted!</h4>
                                        <p className="text-xs text-green-400/60">
                                            {parseResult.completion_percentage.toFixed(0)}% complete
                                        </p>
                                    </div>
                                </div>
                                <p className="text-sm text-white/70 leading-relaxed">
                                    {parseResult.extraction_summary}
                                </p>
                            </div>

                            {/* Missing Fields */}
                            {parseResult.missing_required.length > 0 && (
                                <div className="glass-card-premium p-6 rounded-2xl border border-amber-500/20">
                                    <h4 className="font-medium text-amber-300 mb-3 text-sm">
                                        Still Need ({parseResult.missing_required.length})
                                    </h4>
                                    <ul className="space-y-2">
                                        {parseResult.missing_required.slice(0, 5).map((field, i) => (
                                            <li key={i} className="flex items-center gap-2 text-sm text-white/60">
                                                <div className="w-1.5 h-1.5 rounded-full bg-amber-500/50" />
                                                {field.replace(/_/g, " ")}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {/* Continue Button */}
                            <button
                                onClick={onSkip}
                                className="w-full py-4 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-500 transition-all flex items-center justify-center gap-2 shadow-[0_0_30px_rgba(99,102,241,0.3)]"
                            >
                                Continue to Voice
                                <ArrowRight className="w-4 h-4" />
                            </button>
                        </>
                    ) : (
                        <>
                            {/* What We Extract */}
                            <div className="glass-card-premium p-6 rounded-2xl">
                                <h4 className="font-medium text-white/80 mb-4 text-sm uppercase tracking-wider">
                                    What We Extract
                                </h4>
                                <ul className="space-y-3">
                                    {[
                                        "Job title & level",
                                        "Location & work model",
                                        "Experience requirements",
                                        "Compensation range",
                                        "Key skills & traits",
                                        "Interview process",
                                    ].map((item, i) => (
                                        <li key={i} className="flex items-center gap-3 text-sm text-white/50">
                                            <div className="w-5 h-5 rounded-full bg-white/5 flex items-center justify-center">
                                                <CheckCircle className="w-3 h-3 text-indigo-400" />
                                            </div>
                                            {item}
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            {/* Why Voice Option */}
                            <div className="glass-card-premium p-6 rounded-2xl border border-white/5">
                                <div className="flex items-center gap-3 mb-3">
                                    <Mic className="w-5 h-5 text-purple-400" />
                                    <h4 className="font-medium text-white/80 text-sm">No JD? No Problem</h4>
                                </div>
                                <p className="text-sm text-white/40 leading-relaxed">
                                    Skip this step and describe the role via voice. Our AI will capture everything through natural conversation.
                                </p>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
