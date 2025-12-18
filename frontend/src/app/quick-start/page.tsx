"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
    FileText,
    Sparkles,
    Loader2,
    ArrowRight,
    ArrowLeft,
    CheckCircle,
    Upload,
    AlertCircle,
    Zap,
} from "lucide-react";

interface ExtractionField {
    field_name: string;
    field_type: "boolean" | "number" | "string" | "string_list";
    description: string;
    is_required: boolean;
}

interface JDAnalysisResult {
    role_type: string;
    baseline_fields: ExtractionField[];
    jd_specific_fields: ExtractionField[];
    all_fields: ExtractionField[];
    scoring_criteria: string[];
    red_flag_indicators: string[];
}

const API_URL = "http://localhost:8000";

export default function QuickStartPage() {
    const router = useRouter();

    // Steps: jd -> review -> upload -> processing
    const [step, setStep] = useState<"jd" | "review" | "upload" | "processing">("jd");

    // JD State
    const [jobDescription, setJobDescription] = useState("");
    const [analyzingJD, setAnalyzingJD] = useState(false);
    const [jdAnalysis, setJdAnalysis] = useState<JDAnalysisResult | null>(null);
    const [extractionFields, setExtractionFields] = useState<ExtractionField[]>([]);

    // Upload State
    const [file, setFile] = useState<File | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [uploading, setUploading] = useState(false);

    // Error State
    const [error, setError] = useState<string | null>(null);

    // Analyze JD
    const handleAnalyzeJD = async () => {
        if (!jobDescription.trim()) {
            setError("Please paste a job description");
            return;
        }

        setAnalyzingJD(true);
        setError(null);

        try {
            const res = await fetch(`${API_URL}/api/pluto/analyze-jd`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ job_description: jobDescription }),
            });

            if (!res.ok) {
                throw new Error("Failed to analyze job description");
            }

            const data: JDAnalysisResult = await res.json();
            setJdAnalysis(data);
            setExtractionFields(data.all_fields);
            setStep("review");
        } catch (e) {
            setError(e instanceof Error ? e.message : "Analysis failed");
        } finally {
            setAnalyzingJD(false);
        }
    };

    // Handle file drop
    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const droppedFile = e.dataTransfer.files[0];
        if (droppedFile?.name.endsWith(".csv")) {
            setFile(droppedFile);
            setError(null);
        } else {
            setError("Please upload a CSV file");
        }
    }, []);

    // Handle file select
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile?.name.endsWith(".csv")) {
            setFile(selectedFile);
            setError(null);
        } else {
            setError("Please upload a CSV file");
        }
    };

    // Upload and process
    const handleUpload = async () => {
        if (!file) {
            setError("Please upload a CSV file");
            return;
        }

        setUploading(true);
        setStep("processing");
        setError(null);

        try {
            const formData = new FormData();
            formData.append("job_description", jobDescription);

            if (extractionFields.length > 0) {
                formData.append("extraction_fields", JSON.stringify(extractionFields));
            }

            if (jdAnalysis) {
                if (jdAnalysis.scoring_criteria.length > 0) {
                    formData.append("scoring_criteria", JSON.stringify(jdAnalysis.scoring_criteria));
                }
                if (jdAnalysis.red_flag_indicators.length > 0) {
                    formData.append("red_flag_indicators", JSON.stringify(jdAnalysis.red_flag_indicators));
                }
            }

            formData.append("file", file);

            const res = await fetch(`${API_URL}/api/upload`, {
                method: "POST",
                body: formData,
            });

            if (!res.ok) {
                throw new Error("Upload failed");
            }

            // Store extraction fields for the rankings page
            if (extractionFields.length > 0) {
                sessionStorage.setItem("extractionFields", JSON.stringify(extractionFields));
            }

            // Generate session ID and redirect to rankings
            const sessionId = crypto.randomUUID();
            sessionStorage.setItem("currentSessionId", sessionId);

            // Poll for completion then redirect
            pollAndRedirect(sessionId);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Upload failed");
            setStep("upload");
            setUploading(false);
        }
    };

    // Poll status and redirect when complete
    const pollAndRedirect = async (sessionId: string) => {
        const pollInterval = setInterval(async () => {
            try {
                const res = await fetch(`${API_URL}/api/pluto/status`);
                const data = await res.json();

                if (data.status === "complete") {
                    clearInterval(pollInterval);
                    router.push(`/rankings/${sessionId}`);
                } else if (data.status === "error") {
                    clearInterval(pollInterval);
                    setError(data.error || "Processing failed");
                    setStep("upload");
                    setUploading(false);
                }
                // For waiting_confirmation, auto-trigger scoring
                else if (data.status === "waiting_confirmation") {
                    await fetch(`${API_URL}/api/pluto/score`, { method: "POST" });
                }
            } catch (e) {
                console.error("Polling error:", e);
            }
        }, 1500);
    };

    return (
        <main className="min-h-screen bg-[#000000] text-white">
            {/* Header */}
            <header className="fixed top-0 left-0 right-0 z-50 bg-[#000000]/80 backdrop-blur-md border-b border-white/5 py-4">
                <div className="flex items-center justify-between max-w-5xl mx-auto px-6">
                    <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                        <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center border border-white/10">
                            <span className="text-sm">⚛️</span>
                        </div>
                        <h1 className="text-lg font-light tracking-wide text-white">Superposition</h1>
                    </Link>

                    {/* Progress Steps */}
                    <div className="flex items-center gap-2">
                        {["jd", "review", "upload"].map((s, i) => (
                            <div key={s} className="flex items-center">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium transition-all ${
                                    step === s ? "bg-green-500 text-white" :
                                    ["jd", "review", "upload"].indexOf(step) > i ? "bg-green-500/20 text-green-400 border border-green-500/30" :
                                    "bg-white/5 text-white/30 border border-white/10"
                                }`}>
                                    {["jd", "review", "upload"].indexOf(step) > i ? <CheckCircle className="w-4 h-4" /> : i + 1}
                                </div>
                                {i < 2 && (
                                    <div className={`w-8 h-0.5 ${["jd", "review", "upload"].indexOf(step) > i ? "bg-green-500/30" : "bg-white/10"}`} />
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </header>

            <div className="pt-28 pb-16 px-6 max-w-4xl mx-auto">
                {/* Step 1: Paste JD */}
                {step === "jd" && (
                    <div className="animate-fade-in space-y-8">
                        <div className="text-center space-y-4">
                            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 text-sm font-medium">
                                <Zap className="w-4 h-4" />
                                Quick Start
                            </div>
                            <h2 className="text-4xl font-bold tracking-tight">
                                Paste Your Job Description
                            </h2>
                            <p className="text-white/50 max-w-lg mx-auto">
                                We'll extract key requirements and signals to score candidates against.
                            </p>
                        </div>

                        <div className="glass-panel rounded-3xl p-1 border border-white/10">
                            <textarea
                                value={jobDescription}
                                onChange={(e) => setJobDescription(e.target.value)}
                                placeholder="Paste the full job description here..."
                                className="w-full h-80 bg-transparent p-6 resize-none text-white/90 placeholder:text-white/20 focus:outline-none text-sm leading-relaxed"
                            />
                        </div>

                        {error && (
                            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-2">
                                <AlertCircle className="w-4 h-4 shrink-0" />
                                {error}
                            </div>
                        )}

                        <div className="flex gap-4">
                            <Link
                                href="/"
                                className="px-6 py-4 rounded-xl bg-white/5 border border-white/10 text-white/60 font-medium hover:bg-white/10 transition-colors flex items-center gap-2"
                            >
                                <ArrowLeft className="w-4 h-4" />
                                Back
                            </Link>
                            <button
                                onClick={handleAnalyzeJD}
                                disabled={!jobDescription.trim() || analyzingJD}
                                className="flex-1 py-4 rounded-xl bg-green-500 text-black font-semibold hover:bg-green-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {analyzingJD ? (
                                    <>
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        Analyzing...
                                    </>
                                ) : (
                                    <>
                                        Analyze JD
                                        <ArrowRight className="w-5 h-5" />
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                )}

                {/* Step 2: Review Extracted Requirements */}
                {step === "review" && jdAnalysis && (
                    <div className="animate-fade-in space-y-8">
                        <div className="text-center space-y-4">
                            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 text-sm font-medium">
                                <CheckCircle className="w-4 h-4" />
                                JD Analyzed
                            </div>
                            <h2 className="text-4xl font-bold tracking-tight">
                                Review Extracted Criteria
                            </h2>
                            <p className="text-white/50">
                                Role Type: <span className="text-white font-medium">{jdAnalysis.role_type}</span>
                            </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Extraction Fields */}
                            <div className="glass-panel rounded-2xl p-6 border border-white/10">
                                <h3 className="font-medium text-white mb-4 flex items-center gap-2">
                                    <FileText className="w-4 h-4 text-blue-400" />
                                    Extraction Fields
                                    <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-white/50 ml-auto">
                                        {extractionFields.length}
                                    </span>
                                </h3>
                                <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
                                    {extractionFields.map((field) => (
                                        <div key={field.field_name} className="p-3 rounded-xl bg-white/5 border border-white/5">
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm text-white/80">{field.field_name}</span>
                                                <span className={`text-[9px] px-1.5 py-0.5 rounded uppercase font-mono ${
                                                    field.field_type === "boolean" ? "bg-purple-500/20 text-purple-300" :
                                                    field.field_type === "number" ? "bg-blue-500/20 text-blue-300" :
                                                    "bg-white/10 text-white/50"
                                                }`}>
                                                    {field.field_type}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Success Signals & Red Flags */}
                            <div className="space-y-4">
                                <div className="glass-panel rounded-2xl p-6 border border-green-500/20 bg-green-500/5">
                                    <h3 className="font-medium text-green-400 mb-3 flex items-center gap-2 text-sm">
                                        <span className="w-2 h-2 rounded-full bg-green-500" />
                                        Success Signals
                                    </h3>
                                    <ul className="space-y-2">
                                        {jdAnalysis.scoring_criteria.slice(0, 4).map((c, i) => (
                                            <li key={i} className="text-xs text-white/60 flex items-start gap-2">
                                                <span className="text-green-500 mt-0.5">•</span>
                                                {c}
                                            </li>
                                        ))}
                                    </ul>
                                </div>

                                <div className="glass-panel rounded-2xl p-6 border border-red-500/20 bg-red-500/5">
                                    <h3 className="font-medium text-red-400 mb-3 flex items-center gap-2 text-sm">
                                        <span className="w-2 h-2 rounded-full bg-red-500" />
                                        Red Flags
                                    </h3>
                                    <ul className="space-y-2">
                                        {jdAnalysis.red_flag_indicators.slice(0, 4).map((c, i) => (
                                            <li key={i} className="text-xs text-white/60 flex items-start gap-2">
                                                <span className="text-red-500 mt-0.5">•</span>
                                                {c}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-4">
                            <button
                                onClick={() => setStep("jd")}
                                className="px-6 py-4 rounded-xl bg-white/5 border border-white/10 text-white/60 font-medium hover:bg-white/10 transition-colors flex items-center gap-2"
                            >
                                <ArrowLeft className="w-4 h-4" />
                                Edit JD
                            </button>
                            <button
                                onClick={() => setStep("upload")}
                                className="flex-1 py-4 rounded-xl bg-green-500 text-black font-semibold hover:bg-green-400 transition-all flex items-center justify-center gap-2"
                            >
                                Continue to Upload
                                <ArrowRight className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                )}

                {/* Step 3: Upload Candidates */}
                {step === "upload" && (
                    <div className="animate-fade-in space-y-8">
                        <div className="text-center space-y-4">
                            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-sm font-medium">
                                <Upload className="w-4 h-4" />
                                Upload Candidates
                            </div>
                            <h2 className="text-4xl font-bold tracking-tight">
                                Upload Your Candidate CSV
                            </h2>
                            <p className="text-white/50 max-w-lg mx-auto">
                                We'll extract and score candidates against the job requirements.
                            </p>
                        </div>

                        <div
                            className={`glass-panel rounded-3xl p-12 border-2 border-dashed transition-all cursor-pointer ${
                                isDragging ? "border-green-500 bg-green-500/10" :
                                file ? "border-green-500/50 bg-green-500/5" :
                                "border-white/10 hover:border-white/20 hover:bg-white/5"
                            }`}
                            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                            onDragLeave={() => setIsDragging(false)}
                            onDrop={handleDrop}
                            onClick={() => document.getElementById("file-input")?.click()}
                        >
                            <input
                                id="file-input"
                                type="file"
                                accept=".csv"
                                className="hidden"
                                onChange={handleFileSelect}
                            />

                            <div className="flex flex-col items-center text-center">
                                <div className={`w-16 h-16 rounded-2xl mb-6 flex items-center justify-center transition-all ${
                                    file ? "bg-green-500 text-white" : "bg-white/10 text-white/40"
                                }`}>
                                    {file ? <CheckCircle className="w-8 h-8" /> : <Upload className="w-8 h-8" />}
                                </div>

                                {file ? (
                                    <>
                                        <p className="text-xl font-medium text-white mb-2">{file.name}</p>
                                        <p className="text-sm text-green-400">Ready to process</p>
                                    </>
                                ) : (
                                    <>
                                        <p className="text-lg text-white mb-2">Drop your CSV here</p>
                                        <p className="text-sm text-white/40">or click to browse</p>
                                    </>
                                )}
                            </div>
                        </div>

                        {error && (
                            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-2">
                                <AlertCircle className="w-4 h-4 shrink-0" />
                                {error}
                            </div>
                        )}

                        <div className="flex gap-4">
                            <button
                                onClick={() => setStep("review")}
                                className="px-6 py-4 rounded-xl bg-white/5 border border-white/10 text-white/60 font-medium hover:bg-white/10 transition-colors flex items-center gap-2"
                            >
                                <ArrowLeft className="w-4 h-4" />
                                Back
                            </button>
                            <button
                                onClick={handleUpload}
                                disabled={!file || uploading}
                                className="flex-1 py-4 rounded-xl bg-green-500 text-black font-semibold hover:bg-green-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {uploading ? (
                                    <>
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        Processing...
                                    </>
                                ) : (
                                    <>
                                        <Sparkles className="w-5 h-5" />
                                        Start Analysis
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                )}

                {/* Step 4: Processing */}
                {step === "processing" && (
                    <div className="animate-fade-in flex flex-col items-center justify-center min-h-[60vh] text-center">
                        <div className="relative mb-8">
                            <div className="w-24 h-24 rounded-full border-4 border-green-500/20 border-t-green-500 animate-spin" />
                            <div className="absolute inset-0 flex items-center justify-center">
                                <Sparkles className="w-8 h-8 text-green-400" />
                            </div>
                        </div>
                        <h2 className="text-2xl font-medium text-white mb-2">Processing Candidates</h2>
                        <p className="text-white/50">Extracting and scoring against your job requirements...</p>
                    </div>
                )}
            </div>
        </main>
    );
}
