"use client";

import { useState, useCallback, useEffect, useMemo } from "react";

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

interface Status {
  msg?: string;
  status: string;
  phase: string;
  progress: number;
  message: string;
  candidates_total: number;
  candidates_extracted: number;
  candidates_scored: number;
  error: string | null;
  extracted_preview: AlgoPreview[];
  scored_candidates: Candidate[];
  algo_ranked: AlgoPreview[];
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
  const [step, setStep] = useState<"landing" | "upload" | "configure" | "processing" | "results">("landing");
  const [file, setFile] = useState<File | null>(null);
  const [jobDescription, setJobDescription] = useState<string>("");
  const [isDragging, setIsDragging] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);
  const [results, setResults] = useState<Candidate[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentTipIndex, setCurrentTipIndex] = useState(0);
  const [loadingQuestions, setLoadingQuestions] = useState(false);

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

  // Calculate weighted priority score for sorting (not display - just affects sort order)
  const calculateWeightedPriority = useCallback((candidate: AlgoPreview) => {
    // Use algo_score as base, then apply multipliers based on signals
    let priority = candidate.algo_score || 0;

    // Boost priority based on signals and weights
    if (candidate.sold_to_finance) priority += 20 * weights.financeSales;
    if (candidate.is_founder) priority += 20 * weights.founder;
    if (candidate.startup_experience && !candidate.is_founder) priority += 10 * weights.founder;

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

  // Rotate tips every 5 seconds during processing
  useEffect(() => {
    if (step !== "processing") return;

    const interval = setInterval(() => {
      setCurrentTipIndex((prev) => (prev + 1) % RECRUITMENT_TIPS.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [step]);

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
          setStep("results");
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
        status: "extracting",
        phase: "extracting",
        progress: 0,
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

      console.log("DEBUG: handleUpload called. extractionFields length:", extractionFields.length);
      console.log("DEBUG: extractionFields content:", extractionFields);

      // Pass the dynamic extraction fields from JD Compiler
      if (extractionFields.length > 0) {
        const fieldsJson = JSON.stringify(extractionFields);
        console.log("DEBUG: Appending extraction_fields JSON:", fieldsJson);
        formData.append("extraction_fields", fieldsJson);
      } else {
        console.warn("DEBUG: extractionFields is EMPTY! Not appending.");
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

      // Append file LAST
      formData.append("file", file);

      // Verification of FormData
      console.log("DEBUG: FormData keys check:");
      // @ts-ignore
      for (const [key, value] of formData.entries()) {
        console.log(`DEBUG FormData Key: ${key}, Value: ${typeof value === 'object' ? 'File/Blob' : value}`);
      }

      // Backend now defaults to skip_ai_scoring=True for uploads
      const res = await fetch(`${API_URL}/api/upload`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        throw new Error("Upload failed");
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
      setStatus(prev => prev ? { ...prev, msg: "Starting AI scoring...", phase: "scoring" } : null);

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

  // Lazy load interview questions
  const loadInterviewQuestions = async (candidateId: string) => {
    setLoadingQuestions(true);
    try {
      const res = await fetch(`${API_URL}/api/candidate/${candidateId}/questions`);
      const data = await res.json();

      if (selectedCandidate && data.questions) {
        setSelectedCandidate({
          ...selectedCandidate,
          interview_questions: data.questions,
        });
        // Also update in results
        setResults(results.map(c =>
          c.id === candidateId ? { ...c, interview_questions: data.questions } : c
        ));
      }
    } catch (e) {
      console.error(e);
    }
    setLoadingQuestions(false);
  };

  // Download results CSV
  const handleDownload = async () => {
    window.open(`${API_URL}/api/results/csv`, "_blank");
  };

  // Reset
  const handleReset = () => {
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
    <main className="min-h-screen gradient-bg">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 glass-card mx-4 mt-4 !rounded-2xl px-6 py-4">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <span className="text-xl">🎯</span>
            </div>
            <div>
              <h1 className="text-xl font-bold">Superposition</h1>
              <p className="text-xs text-white/60">Fixing the recruiting industry</p>
            </div>
          </div>
          {(step === "results" || (step === "processing" && results.length > 0)) && (
            <div className="flex gap-3">
              <button onClick={handleDownload} className="btn-primary !py-2 !px-4 text-sm">
                ⬇️ Export CSV
              </button>
              <button onClick={handleReset} className="btn-primary !py-2 !px-4 text-sm !bg-white/10">
                ↺ New Analysis
              </button>
            </div>
          )}
        </div>
      </header>

      <div className="pt-28 px-4 pb-8 max-w-7xl mx-auto">
        {/* Landing Page - Workflow Selection */}
        {step === "landing" && (
          <div className="animate-fade-in">
            <div className="text-center mb-16">
              <h2 className="text-5xl font-bold mb-6 bg-gradient-to-r from-white via-white to-white/60 bg-clip-text text-transparent">
                Welcome to Pluto
              </h2>
              <p className="text-xl text-white/60 max-w-2xl mx-auto">
                AI-powered talent matching for the modern recruiter. Choose your workflow below.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
              {/* Analyze Candidates Card */}
              <div
                onClick={() => setStep("upload")}
                className="group cursor-pointer bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/30 rounded-3xl p-8 hover:border-purple-500/60 hover:scale-[1.02] transition-all duration-300"
              >
                <div className="text-6xl mb-6">📊</div>
                <h3 className="text-2xl font-bold mb-3 group-hover:text-purple-400 transition-colors">
                  Analyze Candidates
                </h3>
                <p className="text-white/60 mb-6">
                  Upload a CSV of candidates and get AI-powered scoring, ranking, and comparison.
                  Perfect for batch processing multiple applicants.
                </p>
                <div className="space-y-2 text-sm text-white/50">
                  <div className="flex items-center gap-2">
                    <span className="text-green-400">✓</span> Dual scoring (Algorithmic + AI)
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-green-400">✓</span> Head-to-head comparison
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-green-400">✓</span> Custom weight adjustments
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-green-400">✓</span> Interview questions generated
                  </div>
                </div>
                <div className="mt-6 flex items-center gap-2 text-purple-400 font-medium group-hover:gap-3 transition-all">
                  Get Started <span>→</span>
                </div>
              </div>

              {/* Onboard Candidate Card */}
              <div
                onClick={() => window.location.href = "/voice"}
                className="group cursor-pointer bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/30 rounded-3xl p-8 hover:border-purple-500/60 hover:scale-[1.02] transition-all duration-300"
              >
                <div className="text-6xl mb-6">🎤</div>
                <h3 className="text-2xl font-bold mb-3 group-hover:text-purple-400 transition-colors">
                  Onboard Candidate
                </h3>
                <p className="text-white/60 mb-6">
                  Let candidates upload their resume and complete their profile through a voice conversation with Pluto.
                </p>
                <div className="space-y-2 text-sm text-white/50">
                  <div className="flex items-center gap-2">
                    <span className="text-green-400">✓</span> AI resume extraction
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-green-400">✓</span> Voice-powered gap filling
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-green-400">✓</span> Real-time profile updates
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-green-400">✓</span> Natural conversation flow
                  </div>
                </div>
                <div className="mt-6 flex items-center gap-2 text-purple-400 font-medium group-hover:gap-3 transition-all">
                  Start Onboarding <span>→</span>
                </div>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="mt-16 text-center">
              <p className="text-white/40 text-sm mb-4">Powered by</p>
              <div className="flex justify-center gap-8 text-white/30 text-sm">
                <span>🤖 Gemini 2.5 Flash</span>
                <span>🎙️ VAPI Voice AI</span>
                <span>📊 Smart Scoring</span>
              </div>
            </div>
          </div>
        )}

        {/* Upload Step */}
        {step === "upload" && (
          <div className="animate-fade-in">
            <div className="text-center mb-12">
              <h2 className="text-4xl font-bold mb-4 bg-gradient-to-r from-white via-white to-white/60 bg-clip-text text-transparent">
                Find Your Perfect Hire
              </h2>
              <p className="text-lg text-white/60 max-w-xl mx-auto">
                Upload your candidate CSV and let AI analyze, score, and rank them
                based on your job requirements.
              </p>
            </div>

            <div className="max-w-2xl mx-auto">
              {/* Job Description Input */}
              <div className="glass-card p-6 mb-6">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <span className="text-xl">📋</span> Job Description
                  <span className="text-xs text-white/40 font-normal">(paste your JD for customized scoring)</span>
                </h3>
                <textarea
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  placeholder="Paste your job description here to help AI evaluate candidates against your specific requirements...

Example:
- Founding Account Executive at a FinTech startup
- Must have 5+ years of B2B SaaS experience
- Experience selling to CFOs preferred
- Startup/founder background is a plus"
                  className="w-full h-40 bg-white/5 border border-white/10 rounded-xl p-4 text-white/90 placeholder:text-white/30 focus:border-indigo-500/50 focus:outline-none resize-none text-sm"
                />
                {jobDescription && (
                  <div className="mt-2 flex items-center gap-2 text-xs text-green-400">
                    <span>✓</span> JD will be used for AI scoring
                  </div>
                )}
              </div>

              <div
                className={`upload-zone text-center ${isDragging ? "dragging" : ""}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
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
                <div className="text-6xl mb-4">{file ? "📄" : "📁"}</div>
                {file ? (
                  <div>
                    <p className="text-xl font-semibold text-white">{file.name}</p>
                    <p className="text-white/50 mt-1">
                      {(file.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                ) : (
                  <div>
                    <p className="text-xl font-semibold text-white/80">
                      Drop your CSV here
                    </p>
                    <p className="text-white/50 mt-2">or click to browse</p>
                  </div>
                )}
              </div>

              {error && (
                <div className="mt-4 p-4 rounded-xl bg-red-500/20 border border-red-500/30 text-red-300 text-center">
                  {error}
                </div>
              )}

              <button
                onClick={handleAnalyzeJD}
                disabled={!file || !jobDescription.trim() || analyzingJD}
                className="btn-primary w-full mt-6 text-lg py-4"
              >
                {analyzingJD ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Analyzing JD...
                  </span>
                ) : (
                  "🔍 Analyze Job Description"
                )}
              </button>

              <div className="mt-8 glass-card p-6">
                <h3 className="font-semibold mb-3 text-white/80">How it works:</h3>
                <div className="space-y-3">
                  {[
                    { icon: "📋", text: "Paste your job description for targeted scoring" },
                    { icon: "📊", text: "AI extracts key data points from profiles" },
                    { icon: "🎯", text: "Dual scoring: Algorithmic + AI evaluation" },
                    { icon: "🏆", text: "Ranks candidates against YOUR requirements" },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-3 text-white/60">
                      <span className="text-xl">{item.icon}</span>
                      <span>{item.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
        {/* Configure Step - Review/Edit Extraction Criteria */}
        {step === "configure" && jdAnalysis && (
          <div className="animate-fade-in max-w-4xl mx-auto">
            {/* Header */}
            <div className="text-center mb-6">
              <div className="text-5xl mb-4">🔬</div>
              <h2 className="text-2xl font-bold mb-2">Configure Extraction</h2>
              <p className="text-white/60">
                Detected role: <span className="text-indigo-400 font-medium">{jdAnalysis.role_type}</span>
              </p>
            </div>

            {/* Extraction Fields Grid */}
            <div className="glass-card p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">📋 Extraction Fields</h3>
                <span className="text-sm text-white/50">{extractionFields.length} fields</span>
              </div>

              <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
                {extractionFields.map((field) => (
                  <div
                    key={field.field_name}
                    className="flex items-center justify-between p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className={`text-xs px-2 py-0.5 rounded ${field.field_type === "boolean" ? "bg-green-500/20 text-green-300" :
                        field.field_type === "number" ? "bg-blue-500/20 text-blue-300" :
                          field.field_type === "string_list" ? "bg-purple-500/20 text-purple-300" :
                            "bg-yellow-500/20 text-yellow-300"
                        }`}>
                        {field.field_type}
                      </span>
                      <div>
                        <p className="font-medium text-sm">{field.field_name}</p>
                        <p className="text-xs text-white/40">{field.description}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemoveField(field.field_name)}
                      className="text-white/30 hover:text-red-400 transition-colors p-1"
                      title="Remove field"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>

              {/* Add Custom Field */}
              <div className="mt-4 pt-4 border-t border-white/10">
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="custom_field_name"
                    value={newFieldName}
                    onChange={(e) => setNewFieldName(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-sm focus:outline-none focus:border-indigo-500"
                    onKeyDown={(e) => e.key === "Enter" && handleAddField()}
                  />
                  <select
                    value={newFieldType}
                    onChange={(e) => setNewFieldType(e.target.value as any)}
                    className="px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-sm focus:outline-none focus:border-indigo-500"
                  >
                    <option value="boolean">boolean</option>
                    <option value="number">number</option>
                    <option value="string">string</option>
                    <option value="string_list">string_list</option>
                  </select>
                  <button
                    onClick={handleAddField}
                    className="px-4 py-2 rounded-lg bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 transition-colors text-sm font-medium"
                  >
                    + Add
                  </button>
                </div>
              </div>
            </div>

            {/* Scoring Criteria & Red Flags */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="glass-card p-4">
                <h4 className="text-sm font-semibold text-green-400 mb-2">✅ Scoring Criteria</h4>
                <ul className="space-y-1">
                  {jdAnalysis.scoring_criteria.slice(0, 4).map((c, i) => (
                    <li key={i} className="text-xs text-white/60 flex items-start gap-2">
                      <span className="text-green-400">•</span>
                      {c}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="glass-card p-4">
                <h4 className="text-sm font-semibold text-red-400 mb-2">🚩 Red Flags</h4>
                <ul className="space-y-1">
                  {jdAnalysis.red_flag_indicators.slice(0, 4).map((r, i) => (
                    <li key={i} className="text-xs text-white/60 flex items-start gap-2">
                      <span className="text-red-400">•</span>
                      {r}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4">
              <button
                onClick={() => setStep("upload")}
                className="px-6 py-3 rounded-xl bg-white/10 hover:bg-white/20 transition-colors"
              >
                ← Back
              </button>
              <button
                onClick={handleUpload}
                className="flex-1 btn-primary text-lg py-3"
              >
                🚀 Start Extraction ({extractionFields.length} fields)
              </button>
            </div>
          </div>
        )}

        {/* Processing Step - Shows streaming results */}
        {step === "processing" && status && (
          <div className="animate-fade-in">
            {/* Progress Card */}
            <div className="animate-fade-in">
              {/* Progress Card */}
              <div className="max-w-2xl mx-auto mb-6">
                <div className="glass-card p-6 text-center relative overflow-hidden">
                  {/* Background pulse for scoring */}
                  {status.phase === "scoring" && (
                    <div className="absolute inset-0 bg-indigo-500/5 animate-pulse" />
                  )}

                  <div className="relative z-10">
                    <div className="flex flex-col items-center justify-center gap-4 mb-6">
                      <div className="text-5xl animate-bounce-subtle">
                        {status.phase === "extracting" ? "🔍" : status.phase === "scoring" ? "🧠" : "✨"}
                      </div>

                      <div className="text-center max-w-lg mx-auto">
                        <h2 className="text-2xl font-bold mb-2">
                          {status.phase === "scoring"
                            ? "Deep AI Analysis in Progress"
                            : status.message}
                        </h2>

                        {status.phase === "scoring" ? (
                          <p className="text-indigo-300 font-medium animate-pulse">
                            "This might take a while, but Superposition is fixing the recruiting industry one candidate at a time."
                          </p>
                        ) : (
                          <p className="text-white/60">
                            Extracting data from resumes...
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between text-xs uppercase tracking-wider font-semibold text-white/40 mb-1">
                        <span>Progress</span>
                        <span>
                          {status.phase === "scoring"
                            ? `${Math.round((status.candidates_scored / status.candidates_total) * 100)}%`
                            : `${Math.round((status.candidates_extracted / status.candidates_total) * 100)}%`}
                        </span>
                      </div>

                      <div className="h-3 bg-white/5 rounded-full overflow-hidden relative">
                        {/* Animated shimmer for scoring */}
                        {status.phase === "scoring" && (
                          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent w-1/2 h-full z-10 animate-shimmer" />
                        )}

                        <div
                          className={`h-full transition-all duration-500 ${status.phase === "scoring"
                            ? "bg-gradient-to-r from-indigo-500 to-purple-500"
                            : "bg-blue-500"
                            }`}
                          style={{
                            width: `${status.phase === "scoring"
                              ? (status.candidates_scored / status.candidates_total) * 100
                              : (status.candidates_extracted / status.candidates_total) * 100}%`
                          }}
                        />
                      </div>

                      <div className="flex justify-between text-xs text-white/30 mt-2">
                        <span>
                          {status.phase === "scoring" ? "Scored: " : "Extracted: "}
                          {status.phase === "scoring" ? status.candidates_scored : status.candidates_extracted} / {status.candidates_total}
                        </span>
                        {status.phase === "scoring" && (
                          <span className="text-indigo-400">AI Logic Active</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Rotating Tips (Only show during active processing) */}
            {(status.phase === "extracting" || status.phase === "scoring") && (
              <div className="max-w-2xl mx-auto mb-6">
                <div className="glass-card p-4 transition-all duration-500">
                  <div className="flex items-center gap-4">
                    <div className="text-3xl">{currentTip.icon}</div>
                    <div>
                      <p className="text-xs text-indigo-400 uppercase tracking-wide mb-1">Recruiting Tip</p>
                      <p className="text-sm text-white/80">{currentTip.tip}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ACTION REQUIRED: Start AI Scoring */}
            {status.status === "waiting_confirmation" && (
              <div className="max-w-2xl mx-auto mb-8 animate-bounce-in">
                <div className="glass-card p-8 border-l-4 border-l-indigo-500 relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 opacity-10 text-9xl">🚀</div>
                  <h3 className="text-2xl font-bold mb-2">Extraction Complete!</h3>
                  <p className="text-white/70 mb-6">
                    We've extracted data for <span className="text-white font-bold">{status.candidates_extracted} candidates</span> and calculated algorithmic scores.
                    Review the preview table below, then click to proceed with deep AI analysis.
                  </p>
                  <button
                    onClick={handleStartScoring}
                    className="btn-primary w-full text-lg py-4 shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all"
                  >
                    🚀 Start AI Scoring & Ranking
                  </button>
                </div>
              </div>
            )}

            {/* Streaming Results - Show scored candidates (Phase 2) */}
            {results.length > 0 && status.phase === "scoring" && (
              <div className="animate-fade-in">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <span className="text-green-400">✓</span>
                  {results.length} candidates scored
                  {status.candidates_scored < status.candidates_total && (
                    <span className="text-white/40 text-sm font-normal animate-pulse">
                      (scoring {status.candidates_total - status.candidates_scored} more...)
                    </span>
                  )}
                </h3>

                <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
                  {results.map((candidate, i) => (
                    <div
                      key={candidate.id}
                      className={`candidate-card cursor-pointer ${selectedCandidate?.id === candidate.id ? "!border-indigo-500" : ""
                        }`}
                      onClick={() => setSelectedCandidate(candidate)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="text-xl font-bold text-white/30 w-6">
                          #{candidate.rank}
                        </div>
                        <div
                          className="score-ring bg-white/5 w-12 h-12 text-base"
                          style={{ "--score": `${candidate.final_score}%` } as React.CSSProperties}
                        >
                          {candidate.final_score}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold truncate">{candidate.name}</h4>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${getTierClass(candidate.tier)}`}>
                              {candidate.tier}
                            </span>
                          </div>
                          <p className="text-sm text-white/50 truncate">{candidate.job_title}</p>
                          <p className="text-xs text-white/40 truncate mt-0.5">{candidate.one_line_summary}</p>
                        </div>
                        <div className="text-right text-xs text-white/40">
                          <div>Algo: {candidate.algo_score}</div>
                          <div>AI: {candidate.ai_score}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Algo Preview Table (Phase 1 & Confirmation) */}
            {(results.length === 0 && status.algo_ranked && status.algo_ranked.length > 0) && (
              <div className="animate-fade-in">
                {/* Header with count */}
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-white/80 flex items-center gap-2">
                    ✨ {sortedAlgoRanked.length} profiles extracted
                    {status.phase === "scoring" ? (
                      <span className="text-sm font-normal text-indigo-400 animate-pulse">
                        — AI scoring in progress...
                      </span>
                    ) : (
                      <span className="text-sm font-normal text-white/40">
                        — Algorithm-only preview
                      </span>
                    )}
                  </h3>
                  <button
                    onClick={() => setShowWeights(!showWeights)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${showWeights ? "bg-purple-500 text-white" : "bg-white/10 hover:bg-white/20 text-white/70"
                      }`}
                  >
                    ⚖️ Adjust Weights
                  </button>
                </div>

                {/* Custom Weights Panel - Available during processing */}
                {showWeights && (
                  <div className="glass-card p-4 mb-4 animate-fade-in">
                    <h4 className="text-sm font-semibold mb-3 text-white/70">⚙️ Adjust weights to re-sort by priority (instant)</h4>
                    <div className="grid grid-cols-5 gap-4">
                      {[
                        { key: "experience", label: "Experience", icon: "📅" },
                        { key: "financeSales", label: "Finance Sales", icon: "💰" },
                        { key: "founder", label: "Founder DNA", icon: "🚀" },
                        { key: "dealSize", label: "Deal Size", icon: "💎" },
                        { key: "enterprise", label: "Enterprise", icon: "🏢" },
                      ].map((w) => (
                        <div key={w.key} className="text-center">
                          <div className="text-lg mb-1">{w.icon}</div>
                          <div className="text-xs text-white/50 mb-1">{w.label}</div>
                          <input
                            type="range"
                            min="0"
                            max="2"
                            step="0.1"
                            value={weights[w.key as keyof typeof weights]}
                            onChange={(e) => setWeights({ ...weights, [w.key]: parseFloat(e.target.value) })}
                            className="w-full accent-indigo-500"
                          />
                          <div className="text-xs font-mono">{weights[w.key as keyof typeof weights].toFixed(1)}x</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Sortable Table - DYNAMIC extracted data */}
                <div className="glass-card p-0 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wide text-white/50 bg-white/5">
                          <th className="px-3 py-3 w-10">#</th>
                          <th
                            className="px-3 py-3 cursor-pointer hover:text-white/80 transition-colors min-w-[150px]"
                            onClick={() => {
                              if (sortColumn === "name") setSortDirection(d => d === "asc" ? "desc" : "asc");
                              else { setSortColumn("name"); setSortDirection("asc"); }
                            }}
                          >
                            Name {sortColumn === "name" && (sortDirection === "asc" ? "↑" : "↓")}
                          </th>
                          <th className="px-3 py-3 min-w-[180px]">Title</th>
                          {/* Dynamic columns from extraction fields */}
                          {[...extractionFields]
                            .sort((a, b) => {
                              const baseline = ['years_experience', 'is_founder', 'startup_experience', 'enterprise_experience', 'industries', 'skills'];
                              const aIsBaseline = baseline.includes(a.field_name);
                              const bIsBaseline = baseline.includes(b.field_name);
                              if (aIsBaseline && !bIsBaseline) return 1;
                              if (!aIsBaseline && bIsBaseline) return -1;
                              return 0;
                            })
                            .map((field) => (
                              <th key={field.field_name} className="px-3 py-3 text-xs" title={field.description}>
                                {field.field_name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()).slice(0, 15)}
                              </th>
                            ))}
                          <th
                            className="px-3 py-3 text-right cursor-pointer hover:text-white/80 transition-colors w-16"
                            onClick={() => {
                              if (sortColumn === "algo_score") setSortDirection(d => d === "asc" ? "desc" : "asc");
                              else { setSortColumn("algo_score"); setSortDirection("desc"); }
                            }}
                          >
                            Algo {sortColumn === "algo_score" && (sortDirection === "desc" ? "↓" : "↑")}
                          </th>
                          {status?.phase === 'scoring' && <th className="px-3 py-3 text-right w-16">AI</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {sortedAlgoRanked.map((candidate, i) => (
                          <tr
                            key={candidate.id || i}
                            className="border-b border-white/5 hover:bg-white/5 transition-colors"
                          >
                            <td className="px-3 py-3 text-white/30 font-medium">{i + 1}</td>
                            <td className="px-3 py-3">
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500/30 to-purple-500/30 flex items-center justify-center text-xs">
                                  {candidate.name.charAt(0)}
                                </div>
                                <span className="font-medium truncate max-w-[120px]">{candidate.name}</span>
                              </div>
                            </td>
                            <td className="px-3 py-3 text-white/60 text-xs truncate max-w-[180px]">
                              {candidate.job_title || "—"}
                            </td>
                            {/* Dynamic field values */}
                            {[...extractionFields]
                              .sort((a, b) => {
                                const baseline = ['years_experience', 'is_founder', 'startup_experience', 'enterprise_experience', 'industries', 'skills'];
                                const aIsBaseline = baseline.includes(a.field_name);
                                const bIsBaseline = baseline.includes(b.field_name);
                                if (aIsBaseline && !bIsBaseline) return 1;
                                if (!aIsBaseline && bIsBaseline) return -1;
                                return 0;
                              })
                              .map((field) => {
                                const value = (candidate as unknown as Record<string, unknown>)[field.field_name];
                                return (
                                  <td key={field.field_name} className="px-3 py-3 text-white/50 text-xs">
                                    {field.field_type === "boolean" ? (
                                      value ? <span className="text-green-400">✓</span> : <span className="text-white/20">—</span>
                                    ) : field.field_type === "number" ? (
                                      value != null ? String(value) : "—"
                                    ) : field.field_type === "string_list" ? (
                                      Array.isArray(value) ? value.slice(0, 2).join(", ") : "—"
                                    ) : (
                                      value ? String(value).slice(0, 20) : "—"
                                    )}
                                  </td>
                                );
                              })}
                            <td className="px-3 py-3 text-right">
                              <span className="font-mono font-medium text-indigo-400">
                                {candidate.algo_score}
                              </span>
                            </td>
                            {status?.phase === 'scoring' && (
                              <td className="px-3 py-3 text-right">
                                <div className="shimmer inline-block w-8 h-5 rounded bg-white/10" />
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Results Step */}
        {step === "results" && (
          <div className="animate-fade-in">
            {/* Summary Stats */}
            <div className="grid grid-cols-4 gap-4 mb-6">
              {[
                { label: "Total Candidates", value: results.length, icon: "👥" },
                { label: "Strong Fits+", value: results.filter(c => c.tier.includes("Top") || c.tier.includes("Strong")).length, icon: "✅" },
                { label: "Avg. Experience", value: `${(results.reduce((acc, c) => acc + (c.years_experience || 0), 0) / (results.length || 1)).toFixed(1)} Yrs`, icon: "�" },
                { label: "Complete Profiles", value: results.filter(c => (c.data_completeness || 0) >= 80).length, icon: "📋" },
              ].map((stat, i) => (
                <div key={i} className="glass-card p-4 text-center animate-fade-in" style={{ animationDelay: `${i * 0.1}s` }}>
                  <div className="text-2xl mb-1">{stat.icon}</div>
                  <div className="text-3xl font-bold">{stat.value}</div>
                  <div className="text-sm text-white/50">{stat.label}</div>
                </div>
              ))}
            </div>

            {/* Action Toolbar */}
            <div className="flex items-center gap-3 mb-6">
              <button
                onClick={() => { setCompareMode(!compareMode); setCompareSelection([]); setComparisonResult(null); }}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${compareMode
                  ? "bg-indigo-500 text-white"
                  : "bg-white/10 hover:bg-white/20 text-white/70"
                  }`}
              >
                ⚔️ {compareMode ? "Exit Compare" : "Compare Candidates"}
              </button>
              <button
                onClick={() => setShowWeights(!showWeights)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${showWeights
                  ? "bg-purple-500 text-white"
                  : "bg-white/10 hover:bg-white/20 text-white/70"
                  }`}
              >
                ⚖️ Custom Weights
              </button>
              {compareMode && compareSelection.length === 2 && (
                <button
                  onClick={handleCompare}
                  disabled={comparingLoading}
                  className="btn-primary px-4 py-2 text-sm flex items-center gap-2"
                >
                  {comparingLoading ? "⏳ Analyzing..." : "🎯 Run Comparison"}
                </button>
              )}
              {compareMode && compareSelection.length > 0 && (
                <span className="text-sm text-white/50">
                  {compareSelection.length}/2 selected
                </span>
              )}
            </div>

            {/* Custom Weights Panel */}
            {showWeights && (
              <div className="glass-card p-4 mb-6 animate-fade-in">
                <h3 className="font-semibold mb-4">⚙️ Adjust Scoring Weights</h3>
                <div className="grid grid-cols-5 gap-4">
                  {[
                    { key: "experience", label: "Experience", icon: "📅" },
                    { key: "financeSales", label: "Finance Sales", icon: "💰" },
                    { key: "founder", label: "Founder DNA", icon: "🚀" },
                    { key: "dealSize", label: "Deal Size", icon: "💎" },
                    { key: "enterprise", label: "Enterprise", icon: "🏢" },
                  ].map((w) => (
                    <div key={w.key} className="text-center">
                      <div className="text-xl mb-1">{w.icon}</div>
                      <div className="text-xs text-white/50 mb-2">{w.label}</div>
                      <input
                        type="range"
                        min="0"
                        max="2"
                        step="0.1"
                        value={weights[w.key as keyof typeof weights]}
                        onChange={(e) => setWeights({ ...weights, [w.key]: parseFloat(e.target.value) })}
                        className="w-full accent-indigo-500"
                      />
                      <div className="text-sm font-mono mt-1">
                        {weights[w.key as keyof typeof weights].toFixed(1)}x
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex justify-end">
                  <button
                    onClick={handleRescore}
                    disabled={rescoreLoading}
                    className="btn-primary px-4 py-2 text-sm"
                  >
                    {rescoreLoading ? "⏳ Recalculating..." : "🔄 Apply Weights"}
                  </button>
                </div>
              </div>
            )}

            {/* Comparison Result Modal */}
            {comparisonResult && (
              <div className="glass-card p-6 mb-6 animate-fade-in border-2 border-indigo-500/50">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-xl font-bold">⚔️ Head-to-Head Analysis</h3>
                  <button onClick={() => setComparisonResult(null)} className="text-white/40 hover:text-white">✕</button>
                </div>

                <div className="text-center mb-6">
                  <div className={`inline-block px-6 py-3 rounded-xl ${comparisonResult.winner === "TIE"
                    ? "bg-yellow-500/20 text-yellow-300"
                    : "bg-green-500/20 text-green-300"
                    }`}>
                    <div className="text-sm uppercase tracking-wide opacity-70">Winner</div>
                    <div className="text-2xl font-bold">{comparisonResult.winner_name}</div>
                    <div className="text-sm mt-1">
                      Confidence: <span className={`font-semibold ${comparisonResult.confidence === "HIGH" ? "text-green-400" :
                        comparisonResult.confidence === "MEDIUM" ? "text-yellow-400" : "text-red-400"
                        }`}>{comparisonResult.confidence}</span>
                    </div>
                  </div>
                </div>

                <p className="text-center text-white/70 mb-6">{comparisonResult.summary}</p>

                <div className="grid grid-cols-2 gap-6">
                  {/* Candidate A */}
                  <div className="bg-white/5 rounded-xl p-4">
                    <h4 className="font-semibold mb-3 flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-indigo-500 flex items-center justify-center text-xs">A</span>
                      {results.find(c => c.id === compareSelection[0])?.name}
                    </h4>
                    <div className="mb-3">
                      <div className="text-xs text-green-400 font-semibold mb-1">✓ Strengths</div>
                      <ul className="text-sm space-y-1">
                        {comparisonResult.candidate_a_strengths.map((s, i) => (
                          <li key={i} className="text-white/70">• {s}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <div className="text-xs text-red-400 font-semibold mb-1">✗ Weaknesses</div>
                      <ul className="text-sm space-y-1">
                        {comparisonResult.candidate_a_weaknesses.map((w, i) => (
                          <li key={i} className="text-white/50">• {w}</li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Candidate B */}
                  <div className="bg-white/5 rounded-xl p-4">
                    <h4 className="font-semibold mb-3 flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-purple-500 flex items-center justify-center text-xs">B</span>
                      {results.find(c => c.id === compareSelection[1])?.name}
                    </h4>
                    <div className="mb-3">
                      <div className="text-xs text-green-400 font-semibold mb-1">✓ Strengths</div>
                      <ul className="text-sm space-y-1">
                        {comparisonResult.candidate_b_strengths.map((s, i) => (
                          <li key={i} className="text-white/70">• {s}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <div className="text-xs text-red-400 font-semibold mb-1">✗ Weaknesses</div>
                      <ul className="text-sm space-y-1">
                        {comparisonResult.candidate_b_weaknesses.map((w, i) => (
                          <li key={i} className="text-white/50">• {w}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="mt-4 p-3 bg-indigo-500/10 rounded-lg border border-indigo-500/30">
                  <div className="text-xs text-indigo-300 font-semibold mb-1">💡 Key Differentiator</div>
                  <p className="text-sm text-white/70">{comparisonResult.key_differentiator}</p>
                </div>

                <div className="mt-3 p-3 bg-green-500/10 rounded-lg border border-green-500/30">
                  <div className="text-xs text-green-300 font-semibold mb-1">📋 Recommendation</div>
                  <p className="text-sm text-white/70">{comparisonResult.recommendation}</p>
                </div>
              </div>
            )}

            <div className="flex gap-6">
              {/* Candidate List */}
              <div className="flex-1 min-w-0">
                {/* View Toggle Header */}
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold">Rankings</h2>
                  <div className="flex items-center gap-2 bg-white/5 rounded-lg p-1">
                    <button
                      onClick={() => setResultsViewMode("cards")}
                      className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${resultsViewMode === "cards"
                        ? "bg-indigo-500 text-white"
                        : "text-white/60 hover:text-white hover:bg-white/10"
                        }`}
                    >
                      🃏 Cards
                    </button>
                    <button
                      onClick={() => setResultsViewMode("table")}
                      className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${resultsViewMode === "table"
                        ? "bg-indigo-500 text-white"
                        : "text-white/60 hover:text-white hover:bg-white/10"
                        }`}
                    >
                      📊 Table
                    </button>
                  </div>
                </div>

                {/* Card View */}
                {resultsViewMode === "cards" && (
                  <div className="space-y-3">
                    {results.map((candidate, i) => (
                      <div
                        key={candidate.id}
                        className={`candidate-card cursor-pointer animate-fade-in ${selectedCandidate?.id === candidate.id ? "!border-indigo-500" : ""
                          }`}
                        onClick={() => setSelectedCandidate(candidate)}
                        style={{ animationDelay: `${i * 0.03}s` }}
                      >
                        <div className="flex items-center gap-4">
                          <div className="text-2xl font-bold text-white/30 w-8">
                            #{i + 1}
                          </div>
                          <div className="text-xl font-bold text-white/80 w-12 text-center">
                            {candidate.final_score}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold text-lg">{candidate.name}</h3>
                              <span className={`text-xs px-2 py-1 rounded-full ${getTierClass(candidate.tier)}`}>
                                {candidate.tier}
                              </span>
                              {candidate.missing_required?.length > 0 && (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-300" title={`Missing: ${candidate.missing_required.join(", ")}`}>
                                  ❌ {candidate.missing_required.length} Required
                                </span>
                              )}
                              {candidate.missing_required?.length === 0 && candidate.missing_preferred?.length > 0 && (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-300" title={`Missing: ${candidate.missing_preferred.join(", ")}`}>
                                  ⚠️ {candidate.missing_preferred.length} Preferred
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-white/60">{candidate.job_title}</p>
                            <p className="text-sm text-white/40 mt-1">{candidate.one_line_summary || "Evaluation pending or not available"}</p>
                          </div>
                          <div className="text-right text-sm">
                            <div className="text-white/40">Algo: {candidate.algo_score}</div>
                            <div className="text-white/40">AI: {candidate.ai_score}</div>
                            <div className="text-xs text-white/30 mt-1">{candidate.data_completeness}% data</div>
                          </div>
                          {compareMode && (candidate.tier.includes("Top") || candidate.tier.includes("Strong")) && (
                            <button
                              onClick={(e) => { e.stopPropagation(); toggleCompareSelection(candidate.id); }}
                              className={`ml-3 w-8 h-8 rounded-lg flex items-center justify-center transition-all ${compareSelection.includes(candidate.id)
                                ? "bg-indigo-500 text-white"
                                : "bg-white/10 text-white/40 hover:bg-white/20"
                                }`}
                            >
                              {compareSelection.includes(candidate.id) ? "✓" : compareSelection.length < 2 ? "+" : ""}
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Table View - Dynamic based on extraction fields */}
                {resultsViewMode === "table" && (
                  <div className="glass-card p-0 overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-white/5 sticky top-0">
                          <tr className="text-white/60 text-xs uppercase tracking-wide">
                            <th className="px-4 py-3 w-12">#</th>
                            <th className="px-4 py-3">Name</th>
                            <th className="px-4 py-3">Title</th>
                            <th className="px-4 py-3">Tier</th>
                            <th className="px-4 py-3 text-right">Combined</th>
                            <th className="px-4 py-3 text-right">Algo</th>
                            <th className="px-4 py-3 text-right">AI</th>
                            {/* Dynamic columns from extraction fields - showing ALL fields */}
                            {extractionFields
                              .sort((a, b) => {
                                // Prioritize custom fields (those not in baseline)
                                const baseline = ['years_experience', 'is_founder', 'startup_experience', 'enterprise_experience', 'industries', 'skills'];
                                const aIsBaseline = baseline.includes(a.field_name);
                                const bIsBaseline = baseline.includes(b.field_name);
                                if (aIsBaseline && !bIsBaseline) return 1;
                                if (!aIsBaseline && bIsBaseline) return -1;
                                return 0;
                              })
                              .map((field) => (
                                <th key={field.field_name} className="px-4 py-3 text-xs whitespace-nowrap" title={field.description}>
                                  {field.field_name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()).slice(0, 20)}
                                </th>
                              ))}
                            <th className="px-4 py-3 text-right">Data %</th>
                          </tr>
                        </thead>
                        <tbody>
                          {results.map((candidate, i) => (
                            <tr
                              key={candidate.id}
                              onClick={() => setSelectedCandidate(candidate)}
                              className={`border-b border-white/5 hover:bg-white/5 cursor-pointer transition-colors ${selectedCandidate?.id === candidate.id ? "bg-indigo-500/10" : ""
                                }`}
                            >
                              <td className="px-4 py-3 text-white/30 font-medium">{i + 1}</td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">{candidate.name}</span>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-white/60 truncate max-w-[180px]">
                                {candidate.job_title || "—"}
                              </td>
                              <td className="px-4 py-3">
                                <span className={`text-xs px-2 py-0.5 rounded-full ${getTierClass(candidate.tier)}`}>
                                  {candidate.tier}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right">
                                <span className="font-mono font-bold text-indigo-400">{candidate.final_score}</span>
                              </td>
                              <td className="px-4 py-3 text-right">
                                <span className="font-mono text-white/60">{candidate.algo_score}</span>
                              </td>
                              <td className="px-4 py-3 text-right">
                                <span className="font-mono text-white/60">{candidate.ai_score}</span>
                              </td>
                              {/* Dynamic field values */}
                              {extractionFields
                                .sort((a, b) => {
                                  // Match sort order from header
                                  const baseline = ['years_experience', 'is_founder', 'startup_experience', 'enterprise_experience', 'industries', 'skills'];
                                  const aIsBaseline = baseline.includes(a.field_name);
                                  const bIsBaseline = baseline.includes(b.field_name);
                                  if (aIsBaseline && !bIsBaseline) return 1;
                                  if (!aIsBaseline && bIsBaseline) return -1;
                                  return 0;
                                })
                                .map((field) => {
                                  const value = (candidate as unknown as Record<string, unknown>)[field.field_name];
                                  return (
                                    <td key={field.field_name} className="px-4 py-3 text-white/50 text-xs">
                                      {field.field_type === "boolean" ? (
                                        value ? <span className="text-green-400">✓</span> : <span className="text-white/20">—</span>
                                      ) : field.field_type === "number" ? (
                                        value != null ? String(value) : "—"
                                      ) : field.field_type === "string_list" ? (
                                        Array.isArray(value) ? value.slice(0, 2).join(", ") : "—"
                                      ) : (
                                        value ? String(value).slice(0, 20) : "—"
                                      )}
                                    </td>
                                  );
                                })}
                              <td className="px-4 py-3 text-right text-white/40 text-xs">
                                {candidate.data_completeness}%
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              {/* Candidate Detail Panel */}
              {selectedCandidate && (
                <div className="w-96 glass-card p-6 sticky top-28 h-fit max-h-[calc(100vh-8rem)] overflow-y-auto animate-fade-in">
                  <div className="flex items-center justify-between mb-4">
                    <span className={`text-sm px-3 py-1 rounded-full ${getTierClass(selectedCandidate.tier)}`}>
                      {selectedCandidate.tier}
                    </span>
                    <button
                      onClick={() => setSelectedCandidate(null)}
                      className="text-white/40 hover:text-white"
                    >
                      ✕
                    </button>
                  </div>

                  <h2 className="text-2xl font-bold">{selectedCandidate.name}</h2>
                  <p className="text-white/60 mb-4">{selectedCandidate.job_title}</p>
                  <p className="text-sm text-white/50 mb-4">
                    📍 {selectedCandidate.location_city}, {selectedCandidate.location_state}
                  </p>

                  {/* Scores */}
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    {[
                      { label: "Final", value: selectedCandidate.final_score, color: "from-indigo-500 to-purple-500" },
                      { label: "Algo", value: selectedCandidate.algo_score, color: "from-cyan-500 to-blue-500" },
                      { label: "AI", value: selectedCandidate.ai_score, color: "from-pink-500 to-rose-500" },
                    ].map((score, i) => (
                      <div key={i} className="text-center p-3 rounded-xl bg-white/5">
                        <div className={`text-2xl font-bold bg-gradient-to-r ${score.color} bg-clip-text text-transparent`}>
                          {score.value}
                        </div>
                        <div className="text-xs text-white/40">{score.label}</div>
                      </div>
                    ))}
                  </div>

                  {/* Data Completeness Indicator */}
                  {(selectedCandidate.missing_required?.length > 0 || selectedCandidate.missing_preferred?.length > 0) && (
                    <div className="mb-4 p-3 rounded-xl bg-white/5 border border-white/10">
                      <div className="flex items-center gap-2 mb-2">
                        <span>{selectedCandidate.data_completeness >= 80 ? "✅" : selectedCandidate.data_completeness >= 50 ? "⚠️" : "🚨"}</span>
                        <span className="text-sm font-semibold">
                          Profile {selectedCandidate.data_completeness}% Complete
                        </span>
                      </div>

                      {/* Missing Required (critical) */}
                      {selectedCandidate.missing_required?.length > 0 && (
                        <div className="mb-2">
                          <p className="text-xs text-red-400 font-semibold mb-1">❌ Missing Required:</p>
                          <div className="flex flex-wrap gap-1">
                            {selectedCandidate.missing_required.map((field: string, i: number) => (
                              <span
                                key={i}
                                className="text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-300"
                              >
                                {field}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Missing Preferred (nice-to-have) */}
                      {selectedCandidate.missing_preferred?.length > 0 && (
                        <div>
                          <p className="text-xs text-yellow-400 font-semibold mb-1">⚠️ Missing Preferred:</p>
                          <div className="flex flex-wrap gap-1">
                            {selectedCandidate.missing_preferred.map((field: string, i: number) => (
                              <span
                                key={i}
                                className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-300"
                              >
                                {field}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Bio */}
                  <div className="mb-4">
                    <h4 className="text-sm font-semibold text-white/60 mb-2">Summary</h4>
                    <p className="text-sm">{selectedCandidate.bio_summary}</p>
                  </div>

                  {/* Reasoning */}
                  <div className="mb-4">
                    <h4 className="text-sm font-semibold text-white/60 mb-2">AI Reasoning</h4>
                    <p className="text-sm text-white/70">{selectedCandidate.reasoning}</p>
                  </div>

                  {/* Pros */}
                  <div className="mb-4">
                    <h4 className="text-sm font-semibold text-green-400 mb-2">✓ Strengths</h4>
                    <ul className="text-sm space-y-1">
                      {selectedCandidate.pros.map((pro, i) => (
                        <li key={i} className="text-white/70">• {pro}</li>
                      ))}
                    </ul>
                  </div>

                  {/* Cons */}
                  <div className="mb-4">
                    <h4 className="text-sm font-semibold text-orange-400 mb-2">⚠ Concerns</h4>
                    <ul className="text-sm space-y-1">
                      {selectedCandidate.cons.map((con, i) => (
                        <li key={i} className="text-white/70">• {con}</li>
                      ))}
                    </ul>
                  </div>

                  {/* Interview Questions - Pre-generated during AI scoring */}
                  <div>
                    <h4 className="text-sm font-semibold text-cyan-400 mb-2">💬 Interview Questions</h4>
                    {selectedCandidate.interview_questions && selectedCandidate.interview_questions.length > 0 ? (
                      <ul className="text-sm space-y-2">
                        {selectedCandidate.interview_questions.map((q, i) => (
                          <li key={i} className="text-white/70 bg-white/5 p-2 rounded-lg">{q}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-white/40 text-sm italic">Re-process to generate tailored questions</p>
                    )}
                  </div>

                  {/* Tags */}
                  <div className="mt-4 flex flex-wrap gap-2">
                    {selectedCandidate.sold_to_finance && (
                      <span className="text-xs px-2 py-1 rounded-full bg-green-500/20 text-green-300">
                        💰 Finance Sales
                      </span>
                    )}
                    {selectedCandidate.is_founder && (
                      <span className="text-xs px-2 py-1 rounded-full bg-purple-500/20 text-purple-300">
                        🚀 Founder
                      </span>
                    )}
                    {selectedCandidate.startup_experience && (
                      <span className="text-xs px-2 py-1 rounded-full bg-blue-500/20 text-blue-300">
                        🏢 Startup Exp
                      </span>
                    )}
                    {selectedCandidate.enterprise_experience && (
                      <span className="text-xs px-2 py-1 rounded-full bg-orange-500/20 text-orange-300">
                        🏛️ Enterprise
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </main >
  );
}
