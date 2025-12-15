"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import ProcessingDashboard from "@/components/ProcessingDashboard";

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
  // Allow dynamic field access for custom extraction fields
  [key: string]: unknown;
}

interface AlgoPreview {
  id: string;
  name: string;
  job_title: string;
  bio_summary: string;
  algo_score: number;
  sold_to_finance: boolean;
  is_founder: boolean;
  startup_experience: boolean;
  enterprise_experience?: boolean;
  industries?: string[];
  skills?: string[];
  years_experience?: number;
  location_city?: string;
  location_state?: string;
  max_acv_mentioned?: number;
  quota_attainment?: number;
}

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

interface ComparisonResult {
  winner: "A" | "B" | "TIE";
  winner_name: string;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  summary: string;
  candidate_a_strengths: string[];
  candidate_a_weaknesses: string[];
  candidate_b_strengths: string[];
  candidate_b_weaknesses: string[];
  key_differentiator: string;
  recommendation: string;
}

interface Status {
  msg?: string;
  status: "processing" | "waiting_confirmation" | "complete" | "error"; // Updated to specific union types
  phase: "extracting" | "scoring" | "completed"; // Updated to specific union types
  candidates_processed: number; // New field
  candidates_total: number;
  candidates_extracted: number;
  candidates_scored: number;
  message: string; // Kept as string, but instruction suggested optional
  error: string | null;
  extracted_preview: AlgoPreview[];
  scored_candidates: Candidate[];
  algo_ranked: AlgoPreview[];
  logs?: string[]; // New field
}


const API_URL = "http://localhost:8000";

// Rotating recruitment tips
const RECRUITMENT_TIPS = [
  { icon: "💡", tip: "Candidates who have sold to CFOs typically close 40% larger deals" },
  { icon: "🎯", tip: "Founder experience often indicates high ownership and scrappiness" },
  { icon: "📊", tip: "Look for quota attainment above 100% - it shows consistent performance" },
  { icon: "🤝", tip: "Enterprise experience + startup mindset = rare and valuable combination" },
  { icon: "⚡", tip: "Short tenures aren't always bad - context matters more than duration" },
  { icon: "🔍", tip: "The best AEs can articulate their sales methodology clearly" },
  { icon: "💰", tip: "High ACV closers typically need 6-12 months to ramp at a new company" },
  { icon: "🚀", tip: "Startup experience builds resilience and adaptability in sales reps" },
  { icon: "📈", tip: "Top performers usually have 3+ years of progressive sales experience" },
  { icon: "🎓", tip: "Industry expertise can accelerate sales cycles significantly" },
  { icon: "🔥", tip: "The best candidates ask great questions during interviews" },
  { icon: "✨", tip: "Cultural fit is just as important as skills and experience" },
];

export default function Home() {
  const router = useRouter();
  const [step, setStep] = useState<"landing" | "upload" | "configure" | "processing" | "results" | "checking_session">("checking_session");
  const [file, setFile] = useState<File | null>(null);
  const [jobDescription, setJobDescription] = useState<string>("");
  const [isDragging, setIsDragging] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);
  const [results, setResults] = useState<Candidate[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentTipIndex, setCurrentTipIndex] = useState(0);
  const [loadingQuestions, setLoadingQuestions] = useState(false);

  // Job Posting ID - tracks which job we're working on (for re-uploads)
  const [jobPostingId, setJobPostingId] = useState<string | null>(null);

  // JD Compiler - Extraction Criteria
  const [extractionFields, setExtractionFields] = useState<ExtractionField[]>([]);
  const [jdAnalysis, setJdAnalysis] = useState<JDAnalysisResult | null>(null);
  const [analyzingJD, setAnalyzingJD] = useState(false);
  const [newFieldName, setNewFieldName] = useState("");
  const [newFieldType, setNewFieldType] = useState<"boolean" | "number" | "string" | "string_list">("boolean");

  // Head-to-Head Comparison
  const [compareMode, setCompareMode] = useState(false);
  const [compareSelection, setCompareSelection] = useState<string[]>([]);
  const [comparisonResult, setComparisonResult] = useState<ComparisonResult | null>(null);
  const [comparingLoading, setComparingLoading] = useState(false);

  // Custom Weights
  const [showWeights, setShowWeights] = useState(false);
  const [weights, setWeights] = useState({
    experience: 1.0,
    financeSales: 1.0,
    founder: 1.0,
    dealSize: 1.0,
    enterprise: 1.0,
  });
  const [rescoreLoading, setRescoreLoading] = useState(false);

  // Sorting state for algo preview table
  const [sortColumn, setSortColumn] = useState<"algo_score" | "name" | "job_title">("algo_score");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  // Results view mode (table or cards)
  const [resultsViewMode, setResultsViewMode] = useState<"cards" | "table">("cards");

  // Calculate weighted priority score for sorting
  const calculateWeightedPriority = useCallback((candidate: AlgoPreview) => {
    let priority = candidate.algo_score || 0;
    if (candidate.sold_to_finance) priority += 20 * weights.financeSales;
    if (candidate.is_founder) priority += 20 * weights.founder;
    if (candidate.startup_experience && !candidate.is_founder) priority += 10 * weights.founder; // approximate using founder weight
    return priority;
  }, [weights]);

  // Sorted algo preview candidates
  const sortedAlgoRanked = useMemo(() => {
    if (!status?.algo_ranked) return [];

    const sorted = [...status.algo_ranked].map(c => ({
      ...c,
      weighted_priority: calculateWeightedPriority(c)
    }));

    sorted.sort((a, b) => {
      let comparison = 0;
      if (sortColumn === "algo_score") {
        comparison = (b.weighted_priority || 0) - (a.weighted_priority || 0);
      } else if (sortColumn === "name") {
        comparison = a.name.localeCompare(b.name);
      } else if (sortColumn === "job_title") {
        comparison = (a.job_title || "").localeCompare(b.job_title || "");
      }
      return sortDirection === "desc" ? comparison : -comparison;
    });

    return sorted;
  }, [status?.algo_ranked, sortColumn, sortDirection, calculateWeightedPriority]);


  // Home page always shows upload form - rankings are at /rankings/[sessionId]
  useEffect(() => {
    setStep("upload");
  }, []); // Run once on mount





  // Poll for status during processing
  useEffect(() => {
    if (step !== "processing") return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${API_URL}/api/pluto/status`);
        const data: Status = await res.json();

        // Prevent overwriting local status msg if we just set it manually to "Starting AI scoring..."
        setStatus((prev) => {
          if (prev?.msg === "Starting AI scoring..." && data.status === "waiting_confirmation") {
            return prev;
          }
          return data;
        });



        // Update results as they stream in (only relevant for phase 2 scoring)
        if (data.scored_candidates && data.scored_candidates.length > 0) {
          const updatedCandidates = data.scored_candidates.map(c => ({
            ...c,
            final_score: Math.round(((c.algo_score || 0) + (c.ai_score || 0)) / 2)
          }));
          setResults(updatedCandidates);
        }

        if (data.status === "complete") {
          clearInterval(interval);
          // Store extraction fields for the rankings page
          if (extractionFields.length > 0) {
            sessionStorage.setItem("extractionFields", JSON.stringify(extractionFields));
          }
          // Generate session ID and redirect to rankings
          const newSessionId = sessionStorage.getItem("currentSessionId") || crypto.randomUUID();
          sessionStorage.setItem("currentSessionId", newSessionId);
          router.push(`/rankings/${newSessionId}`);
          return;

        } else if (data.status === "error") {
          clearInterval(interval);
          setError(data.error || "Unknown error");

        }
        // Note: We intentionally stay in "processing" loop for "waiting_confirmation"
        // The UI will handle showing the "Start Scoring" button based on this status
      } catch (e) {
        console.error(e);

      }
    }, 1000);

    return () => clearInterval(interval);
  }, [step]);

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

  // Analyze JD and get suggested extraction fields
  const handleAnalyzeJD = async () => {
    if (!jobDescription.trim()) {
      setError("Please enter a job description first");
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
      setStep("configure");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed");
    } finally {
      setAnalyzingJD(false);
    }
  };

  // Add custom extraction field
  const handleAddField = () => {
    if (!newFieldName.trim()) return;

    const fieldName = newFieldName.toLowerCase().replace(/\s+/g, "_");
    if (extractionFields.some(f => f.field_name === fieldName)) {
      setError("Field already exists");
      return;
    }

    setExtractionFields([
      ...extractionFields,
      {
        field_name: fieldName,
        field_type: newFieldType,
        description: `Custom field: ${newFieldName}`,
        is_required: false,
      },
    ]);
    setNewFieldName("");
  };

  // Remove extraction field
  const handleRemoveField = (fieldName: string) => {
    setExtractionFields(extractionFields.filter(f => f.field_name !== fieldName));
  };

  // Upload and start processing (Extraction Phase)
  const handleUpload = async () => {
    if (!file) return;

    try {
      setStep("processing");
      setError(null);
      setCurrentTipIndex(0);
      setResults([]);

      setStatus({
        msg: "Starting extraction...",
        status: "processing",
        phase: "extracting",
        candidates_processed: 0,
        message: "Starting extraction...",
        candidates_total: 0,
        candidates_extracted: 0,
        candidates_scored: 0,
        error: null,
        extracted_preview: [],
        scored_candidates: [],
        algo_ranked: []
      });

      const formData = new FormData();

      // Append text fields FIRST (crucial for some backend parsers)
      formData.append("job_description", jobDescription);

      // Pass the dynamic extraction fields from JD Compiler
      if (extractionFields.length > 0) {
        const fieldsJson = JSON.stringify(extractionFields);
        formData.append("extraction_fields", fieldsJson);
      }

      // Pass Scoring Criteria & Red Flags (NEW)
      if (jdAnalysis) {
        if (jdAnalysis.scoring_criteria.length > 0) {
          formData.append("scoring_criteria", JSON.stringify(jdAnalysis.scoring_criteria));
        }
        if (jdAnalysis.red_flag_indicators.length > 0) {
          formData.append("red_flag_indicators", JSON.stringify(jdAnalysis.red_flag_indicators));
        }
      }

      // Pass job_posting_id if we have one (re-upload same job clears only that job's candidates)
      if (jobPostingId) {
        formData.append("job_posting_id", jobPostingId);
      }

      // Append file LAST
      formData.append("file", file);

      // Backend now defaults to skip_ai_scoring=True for uploads
      const res = await fetch(`${API_URL}/api/upload`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        throw new Error("Upload failed");
      }

      // Store the job_posting_id from response for future re-uploads
      const data = await res.json();
      if (data.job_posting_id) {
        setJobPostingId(data.job_posting_id);
        // Also persist to sessionStorage in case of page refresh
        sessionStorage.setItem("currentJobPostingId", data.job_posting_id);
      }

      // Status polling will take over
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");

      setStep("upload");
    }
  };

  // Trigger AI Scoring (Scoring Phase)
  const handleStartScoring = async () => {
    try {
      setStep("processing"); // Ensure we are in processing view

      setStatus(prev => prev ? { ...prev, msg: "Starting AI scoring...", phase: "scoring", status: "processing" } : null);

      const res = await fetch(`${API_URL}/api/pluto/score`, {
        method: "POST",
      });

      if (!res.ok) {
        throw new Error("Failed to start scoring");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed into initiate scoring");

    }
  };

  // Download results CSV
  const handleDownload = async () => {
    window.open(`${API_URL}/api/results/csv`, "_blank");
  };

  // Reset
  const handleReset = async () => {
    try {
      await fetch(`${API_URL}/api/pluto/reset`, { method: "POST" });
    } catch (e) {
      console.warn("Failed to reset backend state", e);
    }

    setStep("upload");
    setFile(null);
    setResults([]);
    setSelectedCandidate(null);
    setStatus(null);
    setError(null);
    setCompareMode(false);
    setCompareSelection([]);
    setComparisonResult(null);
    setShowWeights(false);

    // Clear job posting ID so next upload creates a new job
    setJobPostingId(null);
    sessionStorage.removeItem("currentJobPostingId");
    setJobDescription("");
    setExtractionFields([]);
    setJdAnalysis(null);
  };

  // Toggle compare mode selection
  const toggleCompareSelection = (candidateId: string) => {
    if (compareSelection.includes(candidateId)) {
      setCompareSelection(compareSelection.filter(id => id !== candidateId));
    } else if (compareSelection.length < 2) {
      setCompareSelection([...compareSelection, candidateId]);
    }
  };

  // Run head-to-head comparison
  const handleCompare = async () => {
    if (compareSelection.length !== 2) return;

    setComparingLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/compare`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidate_a_id: compareSelection[0],
          candidate_b_id: compareSelection[1],
        }),
      });
      const data = await res.json();
      setComparisonResult(data.comparison);
    } catch (e) {
      console.error(e);
    }
    setComparingLoading(false);
  };

  // Rescore with custom weights
  const handleRescore = async () => {
    setRescoreLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/rescore`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          experience_weight: weights.experience,
          finance_sales_weight: weights.financeSales,
          founder_weight: weights.founder,
          deal_size_weight: weights.dealSize,
          enterprise_weight: weights.enterprise,
        }),
      });
      const data = await res.json();
      setResults(data.candidates);
    } catch (e) {
      console.error(e);
    }
    setRescoreLoading(false);
  };

  // Get tier color class
  const getTierClass = (tier: string) => {
    if (tier.includes("Top")) return "tier-top";
    if (tier.includes("Strong")) return "tier-strong";
    if (tier.includes("Consider")) return "tier-consider";
    return "tier-not-fit";
  };

  const currentTip = RECRUITMENT_TIPS[currentTipIndex];

  return (
    <main className="min-h-screen gradient-bg text-white">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-[#000000]/80 backdrop-blur-md border-b border-white/5 py-4">
        <div className="flex items-center justify-between max-w-7xl mx-auto px-6">
          <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center border border-white/10">
              <span className="text-sm">⚛️</span>
            </div>
            <div>
              <h1 className="text-lg font-light tracking-wide text-white">
                Superposition
              </h1>
            </div>
          </Link>
          {(step === "results" || (step === "processing" && results.length > 0)) && (
            <div className="flex gap-3 items-center">
              <a
                href="/dashboard/manager"
                className="text-xs font-medium text-gray-400 hover:text-white transition-colors uppercase tracking-wider"
              >
                Manager Dashboard
              </a>
              <a
                href="/dashboard/interviewer"
                className="text-xs font-medium text-gray-400 hover:text-white transition-colors uppercase tracking-wider"
              >
                Interviewer Analytics
              </a>
              <button onClick={handleDownload} className="text-xs font-medium text-gray-400 hover:text-white transition-colors uppercase tracking-wider">
                Export CSV
              </button>
              <button onClick={handleReset} className="px-4 py-2 rounded-full bg-white text-black text-xs font-bold hover:bg-gray-200 transition-colors">
                + New Analysis
              </button>
            </div>
          )}
        </div>
      </header>

      <div className="pt-32 px-4 pb-12 max-w-7xl mx-auto">

        {/* Step: Session Check */}
        {step === "checking_session" && (
          <div className="flex flex-col items-center justify-center h-[50vh] animate-pulse relative z-10">
            <div className="w-16 h-16 rounded-full border-4 border-indigo-500/30 border-t-indigo-500 animate-spin mb-8" />
            <div className="text-xl font-light text-white/60 tracking-wider">Restoring Session...</div>
          </div>
        )}

        {/* Step: Upload (Now the Landing) */}
        {step === "upload" && (
          <div className="animate-fade-in space-y-12">
            {/* Hero Section */}
            <div className="text-center space-y-6 max-w-3xl mx-auto relative">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-500/10 rounded-full blur-[100px] -z-10 animate-pulse" />

              <h2 className="text-6xl md:text-7xl font-bold tracking-tight">
                <span className="bg-gradient-to-r from-white via-white to-white/50 bg-clip-text text-transparent">
                  Uncover Hidden
                </span>
                <br />
                <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                  Talent Signals
                </span>
              </h2>
              <p className="text-xl text-white/60 max-w-2xl mx-auto leading-relaxed">
                Redefining how companies discover exceptional talent.
                <br />
                The recruiting industry will never be the same.
              </p>
            </div>

            <div className="max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-5 gap-8">
              {/* Job Description Column */}
              <div className="lg:col-span-2 glass-panel p-1 rounded-3xl flex flex-col h-full hover:bg-white/5 transition-colors group">
                <div className="p-6 h-full flex flex-col">
                  <h3 className="font-medium mb-4 flex items-center gap-2 text-sm text-gray-400 uppercase tracking-wider">
                    1. Job Context
                  </h3>
                  <textarea
                    value={jobDescription}
                    onChange={(e) => setJobDescription(e.target.value)}
                    placeholder="Paste JD here..."
                    className="flex-1 bg-transparent border-0 resize-none text-gray-300 placeholder:text-gray-700 focus:outline-none focus:ring-0 text-sm leading-relaxed"
                  />
                </div>
              </div>

              {/* Upload Column */}
              <div className="lg:col-span-3">
                <div
                  className={`h-full glass-panel rounded-3xl p-8 flex flex-col items-center justify-center text-center transition-all duration-500 cursor-pointer group relative overflow-hidden ${isDragging ? "bg-white/10 ring-1 ring-white/20 scale-[1.02]" : "hover:bg-white/5"}`}
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

                  <div className={`w-16 h-16 rounded-2xl mb-6 flex items-center justify-center transition-all duration-500 ${file ? "bg-green-500 text-white shadow-[0_0_30px_rgba(34,197,94,0.3)]" : "bg-white/5 text-gray-500 group-hover:scale-110 group-hover:text-white"}`}>
                    <div className="text-2xl">{file ? "✓" : "+"}</div>
                  </div>

                  {file ? (
                    <div className="animate-fadeIn">
                      <p className="text-xl font-light text-white mb-2">{file.name}</p>
                      <p className="text-sm text-green-400 font-medium tracking-wide">Ready for analysis</p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-lg font-light text-white mb-2">Upload Candidate CSV</p>
                      <p className="text-sm text-gray-500 font-light">Drag & drop or click to browse</p>
                    </div>
                  )}

                  {/* Hover Glow */}
                  <div className="absolute inset-0 bg-gradient-to-tr from-purple-500/10 to-blue-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
                </div>

                {error && (
                  <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center">
                    {error}
                  </div>
                )}
              </div>
            </div>

            {/* Action Button */}
            <div className="max-w-md mx-auto">
              <button
                onClick={handleAnalyzeJD}
                disabled={!file || !jobDescription.trim() || analyzingJD}
                className="w-full py-4 rounded-full bg-white text-black font-semibold text-lg hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 shadow-[0_0_40px_rgba(255,255,255,0.1)]"
              >
                {analyzingJD ? "Analyzing Context..." : "Start Analysis"}
              </button>
            </div>

            <div className="flex justify-center gap-12 text-white/20 text-sm font-medium pt-8">
              <span className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-green-500" />SOC2 Compliant</span>
              <span className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-blue-500" />Encrypted End-to-End</span>
              <span className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-purple-500" />99.9% Accuracy</span>
            </div>
          </div>
        )}

        {/* Configure Step */}
        {step === "configure" && jdAnalysis && (
          <div className="animate-fade-in max-w-4xl mx-auto space-y-8">
            <div className="text-center">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 mb-4 text-sm font-medium text-indigo-300">
                <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
                Context Extracted
              </div>
              <h2 className="text-4xl font-bold mb-4">Configuration</h2>
              <p className="text-white/60">We've identified the following signals as critical for this <span className="text-white font-medium">{jdAnalysis.role_type}</span> role.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Fields */}
              <div className="glass-panel p-6 rounded-3xl md:col-span-2 lg:col-span-1 border border-white/5 h-fit">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="font-medium text-white tracking-wide">Extraction Fields</h3>
                  <span className="text-[10px] px-2 py-1 rounded-full bg-white/5 border border-white/5 text-gray-400 font-mono">
                    {extractionFields.length} active
                  </span>
                </div>

                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                  {extractionFields.map((field) => (
                    <div key={field.field_name} className="group p-4 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/10 transition-all">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-medium text-white group-hover:text-blue-200 transition-colors">
                              {field.field_name}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 font-light leading-relaxed">{field.description}</p>
                        </div>
                        <span className={`shrink-0 text-[9px] px-1.5 py-0.5 rounded border uppercase tracking-wider font-mono ${field.field_type === 'number' ? 'border-blue-500/30 text-blue-400 bg-blue-500/5' :
                          field.field_type === 'boolean' ? 'border-purple-500/30 text-purple-400 bg-purple-500/5' :
                            'border-gray-700 text-gray-400 bg-gray-800'
                          }`}>
                          {field.field_type}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Add Custom Field */}
                <div className="mt-6 pt-6 border-t border-white/5">
                  <div className="flex gap-3">
                    <input
                      value={newFieldName}
                      onChange={(e) => setNewFieldName(e.target.value)}
                      placeholder="Add custom extraction field..."
                      className="flex-1 bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-blue-500/50 transition-colors"
                    />
                    <button
                      onClick={handleAddField}
                      disabled={!newFieldName.trim()}
                      className="px-4 py-2 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30 hover:bg-blue-600 hover:text-white hover:border-transparent text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      + Add
                    </button>
                  </div>
                </div>
              </div>

              {/* Criteria */}
              <div className="space-y-6 md:col-span-2 lg:col-span-1">
                <div className="glass-panel p-6 rounded-3xl border border-green-500/10 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/5 rounded-full blur-3xl -z-10" />
                  <h3 className="font-medium mb-4 text-green-400 flex items-center gap-2 text-sm tracking-wide">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                    Success Signals
                  </h3>
                  <ul className="space-y-3">
                    {jdAnalysis.scoring_criteria.slice(0, 5).map((c, i) => (
                      <li key={i} className="flex items-start gap-3 text-sm text-gray-300 font-light">
                        <span className="mt-1.5 w-1 h-1 rounded-full bg-green-500/50 shrink-0" />
                        <span className="leading-relaxed">{c}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="glass-panel p-6 rounded-3xl border border-red-500/10 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/5 rounded-full blur-3xl -z-10" />
                  <h3 className="font-medium mb-4 text-red-400 flex items-center gap-2 text-sm tracking-wide">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                    Risk Indicators
                  </h3>
                  <ul className="space-y-3">
                    {jdAnalysis.red_flag_indicators.slice(0, 5).map((c, i) => (
                      <li key={i} className="flex items-start gap-3 text-sm text-gray-300 font-light">
                        <span className="mt-1.5 w-1 h-1 rounded-full bg-red-500/50 shrink-0" />
                        <span className="leading-relaxed">{c}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            <div className="flex gap-4 pt-8">
              <button
                onClick={() => setStep("upload")}
                className="px-8 py-4 rounded-full bg-white/5 hover:bg-white/10 text-gray-400 font-medium transition-colors border border-white/5"
              >
                Cancel
              </button>
              <button
                onClick={handleUpload}
                className="flex-1 py-4 rounded-full bg-white text-black text-lg font-semibold hover:scale-[1.02] active:scale-[0.98] transition-all shadow-[0_0_40px_rgba(255,255,255,0.1)]"
              >
                Launch Extraction Engine →
              </button>
            </div>
          </div>
        )}

        {/* Processing Step */}
        {step === "processing" && status && (
          <div className="max-w-5xl mx-auto pt-10">
            <ProcessingDashboard status={status} onStartScoring={handleStartScoring} />
          </div>
        )}

        {/* Results Step */}
        {step === "results" && (
          <div className="animate-fade-in space-y-8">
            {/* Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {[
                { label: "Candidates", value: results.length, icon: "👥" },
                { label: "Top Tier", value: results.filter(c => c.tier.includes("Top")).length, icon: "🏆", color: "text-amber-300" },
                { label: "Strong Fits", value: results.filter(c => c.tier.includes("Strong")).length, icon: "✅", color: "text-green-300" },
                { label: "Avg Experience", value: `${(results.reduce((acc, c) => acc + (c.years_experience || 0), 0) / (results.length || 1)).toFixed(1)}y`, icon: "⏳" },
              ].map((stat, i) => (
                <div key={i} className="glass-panel p-5 flex items-center gap-4 group hover:bg-white/5 transition-colors">
                  <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-xl group-hover:scale-110 transition-transform">
                    {stat.icon}
                  </div>
                  <div>
                    <div className={`text-2xl font-light tracking-tight ${stat.color || "text-white"}`}>{stat.value}</div>
                    <div className="text-xs text-gray-400 font-medium uppercase tracking-wider">{stat.label}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex gap-2 p-1 rounded-xl bg-white/5 border border-white/5">
                <button
                  onClick={() => setResultsViewMode("cards")}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${resultsViewMode === "cards" ? "bg-indigo-500 text-white shadow-lg" : "text-white/50 hover:text-white"}`}
                >
                  Cards
                </button>
                <button
                  onClick={() => setResultsViewMode("table")}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${resultsViewMode === "table" ? "bg-indigo-500 text-white shadow-lg" : "text-white/50 hover:text-white"}`}
                >
                  Table
                </button>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowWeights(!showWeights)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium border border-white/10 transition-colors ${showWeights ? "bg-white/10 text-white" : "bg-transparent text-white/50 hover:text-white"}`}
                >
                  ⚖️ Weights
                </button>
                <button
                  onClick={() => setCompareMode(!compareMode)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium border border-white/10 transition-colors ${compareMode ? "bg-indigo-500 border-transparent text-white" : "bg-transparent text-white/50 hover:text-white"}`}
                >
                  ⚔️ Compare
                </button>
              </div>
            </div>

            {/* Weights Panel */}
            {showWeights && (
              <div className="glass-card p-6 border border-white/10 bg-white/5 animate-fade-in">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="font-semibold">Custom Scoring Weights</h3>
                  <button onClick={handleRescore} disabled={rescoreLoading} className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-medium transition-colors">
                    {rescoreLoading ? "Recalculating..." : "Apply Changes"}
                  </button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
                  {Object.entries(weights).map(([key, val]) => (
                    <div key={key}>
                      <div className="flex justify-between text-xs text-white/50 mb-2 uppercase tracking-wide">
                        {key.replace(/([A-Z])/g, ' $1').trim()}
                        <span>{val.toFixed(1)}x</span>
                      </div>
                      <input
                        type="range" min="0" max="2" step="0.1" value={val}
                        onChange={(e) => setWeights({ ...weights, [key]: parseFloat(e.target.value) })}
                        className="w-full accent-indigo-500"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Compare Bar */}
            {compareMode && (
              <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-[#1a1a20] border border-white/20 rounded-2xl shadow-2xl p-4 flex items-center gap-6 animate-fade-in pl-6 pr-2">
                <div className="flex items-center gap-4">
                  <div className="text-sm font-medium">Select 2 candidates</div>
                  <div className="flex gap-2">
                    {[0, 1].map(i => (
                      <div key={i} className={`w-10 h-10 rounded-full border-2 flex items-center justify-center text-xs font-bold ${compareSelection[i] ? "border-indigo-500 bg-indigo-500/20 text-indigo-300" : "border-white/10 bg-white/5 text-white/20"}`}>
                        {compareSelection[i] ? results.find(c => c.id === compareSelection[i])?.name.charAt(0) : (i + 1)}
                      </div>
                    ))}
                  </div>
                </div>
                <button
                  disabled={compareSelection.length !== 2 || comparingLoading}
                  onClick={handleCompare}
                  className="px-6 py-3 rounded-xl bg-white text-black font-bold disabled:opacity-50 hover:scale-105 transition-transform"
                >
                  {comparingLoading ? "Processing..." : "Run Comparison"}
                </button>
              </div>
            )}

            {/* Comparison Modal */}
            {comparisonResult && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
                <div className="bg-[#1a1a20] border border-white/10 w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl p-8 shadow-2xl relative">
                  <button onClick={() => setComparisonResult(null)} className="absolute top-6 right-6 text-white/40 hover:text-white">✕</button>

                  <div className="text-center mb-8">
                    <div className="text-sm font-medium text-white/40 uppercase tracking-widest mb-2">Head-to-Head Result</div>
                    <h2 className="text-4xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent mb-4">
                      {comparisonResult.winner_name} Wins
                    </h2>
                    <p className="text-xl text-white/80 max-w-2xl mx-auto">{comparisonResult.summary}</p>
                  </div>

                  <div className="grid md:grid-cols-2 gap-8">
                    <div className="p-6 rounded-2xl bg-white/5 border border-white/5">
                      <h3 className="font-bold text-lg mb-4 text-indigo-300">{results.find(c => c.id === compareSelection[0])?.name}</h3>
                      <div className="space-y-4">
                        <div>
                          <div className="text-xs uppercase text-green-400 font-bold mb-2">Strengths</div>
                          <ul className="space-y-1 text-sm text-white/70">{comparisonResult.candidate_a_strengths.map((s, i) => <li key={i}>• {s}</li>)}</ul>
                        </div>
                        <div>
                          <div className="text-xs uppercase text-red-400 font-bold mb-2">Weaknesses</div>
                          <ul className="space-y-1 text-sm text-white/70">{comparisonResult.candidate_a_weaknesses.map((s, i) => <li key={i}>• {s}</li>)}</ul>
                        </div>
                      </div>
                    </div>
                    <div className="p-6 rounded-2xl bg-white/5 border border-white/5">
                      <h3 className="font-bold text-lg mb-4 text-purple-300">{results.find(c => c.id === compareSelection[1])?.name}</h3>
                      <div className="space-y-4">
                        <div>
                          <div className="text-xs uppercase text-green-400 font-bold mb-2">Strengths</div>
                          <ul className="space-y-1 text-sm text-white/70">{comparisonResult.candidate_b_strengths.map((s, i) => <li key={i}>• {s}</li>)}</ul>
                        </div>
                        <div>
                          <div className="text-xs uppercase text-red-400 font-bold mb-2">Weaknesses</div>
                          <ul className="space-y-1 text-sm text-white/70">{comparisonResult.candidate_b_weaknesses.map((s, i) => <li key={i}>• {s}</li>)}</ul>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Candidate List (Cards) */}
            {resultsViewMode === "cards" && (
              <div className="space-y-3">
                {results.map((candidate, i) => (
                  <div
                    key={candidate.id}
                    onClick={() => setSelectedCandidate(candidate)}
                    className="glass-panel p-0 hover:bg-white/5 transition-all cursor-pointer group flex items-center overflow-hidden"
                  >
                    {/* Left Score Strip */}
                    <div className="w-24 self-stretch flex flex-col items-center justify-center p-4 border-r border-white/5 bg-white/5 group-hover:bg-white/10 transition-colors">
                      <div className="text-3xl font-light tracking-tighter">{candidate.final_score}</div>
                      <div className="text-[9px] text-gray-500 uppercase tracking-widest mt-1">Score</div>
                    </div>

                    {/* Main Content */}
                    <div className="flex-1 p-6 flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-xl font-medium text-white group-hover:text-blue-200 transition-colors">{candidate.name}</h3>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wide border ${candidate.tier.includes("Top") ? 'bg-amber-500/10 border-amber-500/30 text-amber-300' :
                            candidate.tier.includes("Strong") ? 'bg-green-500/10 border-green-500/30 text-green-300' :
                              'bg-gray-800 border-gray-700 text-gray-400'
                            }`}>
                            {candidate.tier}
                          </span>
                          {compareMode && (
                            <button
                              onClick={(e) => { e.stopPropagation(); toggleCompareSelection(candidate.id); }}
                              className={`w-6 h-6 rounded-full border flex items-center justify-center text-xs ml-2 transition-all ${compareSelection.includes(candidate.id) ? "bg-blue-500 border-blue-500 text-white" : "border-white/20 text-white/20 hover:border-white hover:text-white"}`}
                            >
                              {compareSelection.includes(candidate.id) ? "✓" : "+"}
                            </button>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-gray-400 font-light">
                          <span>{candidate.job_title}</span>
                          <span className="w-1 h-1 rounded-full bg-gray-700"></span>
                          <span>{candidate.years_experience} Yrs Exp</span>
                        </div>
                      </div>

                      <div className="text-right hidden md:block">
                        <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">AI Match</div>
                        <div className="text-lg font-mono text-purple-300">{candidate.ai_score}%</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Candidate List (Table) */}
            {resultsViewMode === "table" && (
              <div className="glass-panel p-0 overflow-hidden rounded-2xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-white/5 text-gray-400 text-[10px] uppercase tracking-widest font-medium">
                      <tr>
                        {/* Fixed base columns */}
                        <th className="px-4 py-4 font-normal sticky left-0 bg-[#1a1a20] z-10">Candidate</th>
                        <th className="px-4 py-4 font-normal">Role</th>
                        <th className="px-4 py-4 font-normal">Tier</th>
                        <th className="px-3 py-4 text-right font-normal">Final</th>
                        <th className="px-3 py-4 text-right font-normal">Algo</th>
                        <th className="px-3 py-4 text-right font-normal">AI</th>
                        <th className="px-3 py-4 text-right font-normal">Exp</th>
                        <th className="px-3 py-4 text-right font-normal">Complete</th>
                        {/* ALL dynamic extraction fields from JD Compiler */}
                        {extractionFields.filter(f => !['bio_summary'].includes(f.field_name)).map(field => (
                          <th key={field.field_name} className="px-3 py-4 font-normal whitespace-nowrap text-center" title={field.description}>
                            {field.field_name.replace(/_/g, ' ').slice(0, 15)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {results.map((candidate) => (
                        <tr
                          key={candidate.id}
                          onClick={() => setSelectedCandidate(candidate)}
                          className="hover:bg-white/5 cursor-pointer transition-colors group"
                        >
                          {/* Fixed base columns */}
                          <td className="px-4 py-4 font-medium text-white group-hover:text-blue-200 transition-colors sticky left-0 bg-[#0d0d0f] group-hover:bg-[#1a1a20]">{candidate.name}</td>
                          <td className="px-4 py-4 text-gray-400 font-light text-xs">{candidate.job_title}</td>
                          <td className="px-4 py-4">
                            <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wide border ${candidate.tier.includes("Top") ? 'bg-amber-500/10 border-amber-500/30 text-amber-300' :
                              candidate.tier.includes("Strong") ? 'bg-green-500/10 border-green-500/30 text-green-300' :
                                'bg-gray-800 border-gray-700 text-gray-400'
                              }`}>{candidate.tier}</span>
                          </td>
                          <td className="px-3 py-4 text-right font-medium text-white">{candidate.final_score}</td>
                          <td className="px-3 py-4 text-right text-gray-400 font-mono text-xs">{candidate.algo_score}</td>
                          <td className="px-3 py-4 text-right text-gray-400 font-mono text-xs">{candidate.ai_score}</td>
                          <td className="px-3 py-4 text-right text-gray-400 text-xs">{candidate.years_experience || candidate.years_sales_experience || 0}y</td>
                          <td className="px-3 py-4 text-right text-gray-500 font-mono text-xs">{candidate.data_completeness || 0}%</td>
                          {/* ALL dynamic extraction field values */}
                          {extractionFields.filter(f => !['bio_summary'].includes(f.field_name)).map(field => {
                            const value = candidate[field.field_name];
                            let displayValue: React.ReactNode = '—';

                            if (value !== undefined && value !== null) {
                              if (field.field_type === 'boolean') {
                                displayValue = value ? (
                                  <span className="text-green-400">✓</span>
                                ) : (
                                  <span className="text-red-400/50">✗</span>
                                );
                              } else if (field.field_type === 'number') {
                                displayValue = <span className="font-mono">{String(value)}</span>;
                              } else if (field.field_type === 'string_list' && Array.isArray(value)) {
                                displayValue = value.length > 0 ? `${value.length}` : '—';
                              } else if (typeof value === 'string') {
                                displayValue = value.length > 15 ? value.slice(0, 15) + '…' : value;
                              } else if (Array.isArray(value)) {
                                displayValue = value.length > 0 ? `${value.length}` : '—';
                              } else if (typeof value === 'boolean') {
                                displayValue = value ? <span className="text-green-400">✓</span> : <span className="text-red-400/50">✗</span>;
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
        )}

      </div>

      {/* Candidate Profile Drawer (Right Side) */}
      {selectedCandidate && (
        <div className="fixed inset-y-0 right-0 w-full md:w-[600px] z-[60] bg-[#000000] border-l border-white/10 shadow-2xl overflow-y-auto animate-slide-in">
          <div className="p-8">
            <button onClick={() => setSelectedCandidate(null)} className="absolute top-6 right-6 p-2 rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors">✕</button>

            <div className="mt-8 mb-10">
              <div className="flex items-center gap-5 mb-6">
                <div className="w-20 h-20 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-4xl font-light text-white">
                  {selectedCandidate.name.charAt(0)}
                </div>
                <div>
                  <h2 className="text-3xl font-light tracking-tight text-white mb-2">{selectedCandidate.name}</h2>
                  <p className="text-lg text-gray-400 font-light">{selectedCandidate.job_title}</p>
                </div>
              </div>

              <div className="flex gap-4 mb-10">
                <a
                  href={`/candidates/${selectedCandidate.id}`}
                  className="flex-1 py-4 rounded-full bg-white/10 text-white font-medium text-center hover:bg-white/20 transition-colors flex items-center justify-center gap-2 border border-white/10"
                >
                  <span>👤</span> View Full Profile
                </a>
                <a
                  href={`/candidates/${selectedCandidate.id}/interview`}
                  className="flex-1 py-4 rounded-full bg-blue-600 text-white font-medium text-center hover:bg-blue-500 transition-colors flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(37,99,235,0.3)]"
                >
                  <span>🎤</span> Start AI Interview
                </a>
              </div>

              <div className="grid grid-cols-3 gap-4 mb-10">
                <div className="p-5 rounded-2xl bg-white/5 border border-white/5 text-center">
                  <div className="text-3xl font-light text-white">{selectedCandidate.final_score}</div>
                  <div className="text-[10px] text-gray-500 uppercase tracking-widest mt-2">Overall</div>
                </div>
                <div className="p-5 rounded-2xl bg-white/5 border border-white/5 text-center">
                  <div className="text-3xl font-light text-purple-300">{selectedCandidate.algo_score}</div>
                  <div className="text-[10px] text-gray-500 uppercase tracking-widest mt-2">Algorithm</div>
                </div>
                <div className="p-5 rounded-2xl bg-white/5 border border-white/5 text-center">
                  <div className="text-3xl font-light text-pink-300">{selectedCandidate.ai_score}</div>
                  <div className="text-[10px] text-gray-500 uppercase tracking-widest mt-2">AI Model</div>
                </div>
              </div>

              <div className="space-y-10">
                <section>
                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">Analysis</h3>
                  <div className="glass-panel p-6 rounded-2xl">
                    <p className="text-gray-300 leading-relaxed font-light">{selectedCandidate.reasoning}</p>
                  </div>
                </section>

                <div className="grid grid-cols-1 gap-6">
                  <section>
                    <h3 className="text-xs font-bold text-green-500/80 uppercase tracking-widest mb-4">Strengths</h3>
                    <ul className="space-y-3">
                      {selectedCandidate.pros.map((p, i) => (
                        <li key={i} className="flex items-start gap-3 text-gray-300 font-light text-sm">
                          <span className="text-green-400 mt-0.5">•</span> {p}
                        </li>
                      ))}
                    </ul>
                  </section>
                  <section>
                    <h3 className="text-xs font-bold text-amber-500/80 uppercase tracking-widest mb-4">Concerns</h3>
                    <ul className="space-y-3">
                      {selectedCandidate.cons.map((c, i) => (
                        <li key={i} className="flex items-start gap-3 text-gray-300 font-light text-sm">
                          <span className="text-amber-400 mt-0.5">•</span> {c}
                        </li>
                      ))}
                    </ul>
                  </section>
                </div>

                <section>
                  <h3 className="text-xs font-bold text-blue-500/80 uppercase tracking-widest mb-4">Generated Interview Questions</h3>
                  <div className="space-y-3">
                    {selectedCandidate.interview_questions.map((q, i) => (
                      <div key={i} className="p-5 rounded-2xl bg-white/5 border border-white/5 text-gray-300 text-sm font-light relative leading-relaxed hover:bg-white/10 transition-colors">
                        <span className="absolute top-5 left-5 text-blue-500/50 font-mono text-xs">0{i + 1}</span>
                        <p className="pl-8">{q}</p>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            </div>
          </div>
        </div>
      )}

    </main>
  );
}
