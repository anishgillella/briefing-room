"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import {
  ArrowLeft,
  Briefcase,
  Users,
  CheckCircle,
  Clock,
  Upload,
  Mic,
  BarChart3,
  Play,
  Pause,
  Archive,
  ChevronRight,
  Edit,
  Sparkles,
  TrendingUp,
  AlertCircle,
  FileText,
  Target,
  LogOut,
  LayoutDashboard,
  ThumbsUp,
  ThumbsDown,
  Brain,
  Heart,
  Ban,
  Plus,
  X,
  Save,
  Loader2,
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// Weighted attribute for screening criteria
interface WeightedAttribute {
  value: string;
  weight: number;  // 0.0 to 1.0
}

interface Job {
  id: string;
  title: string;
  status: string;
  raw_description: string;
  recruiter_id?: string;
  candidate_count: number;
  interviewed_count: number;
  created_at: string;
  updated_at: string;
  extracted_requirements?: {
    // Basic info
    required_skills?: WeightedAttribute[];
    preferred_skills?: WeightedAttribute[];
    years_experience?: string;
    education?: string;
    location?: string;
    work_type?: string;
    salary_range?: string;
    certifications?: string[];
    // Semantic profile attributes - all weighted
    success_signals?: WeightedAttribute[];
    red_flags?: WeightedAttribute[];
    behavioral_traits?: WeightedAttribute[];
    cultural_indicators?: WeightedAttribute[];
    deal_breakers?: WeightedAttribute[];
    ideal_background?: string;
    // Category weights for overall scoring
    category_weights?: {
      required_skills: number;
      preferred_skills: number;
      success_signals: number;
      red_flags: number;
      behavioral_traits: number;
      cultural_indicators: number;
      deal_breakers: number;
    };
    // Missing fields tracking
    missing_fields?: string[];
    extraction_confidence?: number;
  };
  company_context?: {
    company_name?: string;
    team_size?: string;
    team_culture?: string;
  };
  scoring_criteria?: {
    must_haves?: string[];
    nice_to_haves?: string[];
    weight_technical?: number;
    weight_experience?: number;
    weight_cultural?: number;
  };
  red_flags?: string[];
}

interface Candidate {
  id: string;
  person_name: string;
  person_email?: string;
  email?: string;
  pipeline_status: string;
  ranking_score?: number;
  combined_score?: number;
  screening_notes?: string;
  current_title?: string;
  interview_status: string;
}

// Parse screening notes to get recommendation
const getRecommendation = (candidate: Candidate): string | null => {
  if (!candidate.screening_notes) return null;
  try {
    const notes = typeof candidate.screening_notes === 'string'
      ? JSON.parse(candidate.screening_notes)
      : candidate.screening_notes;
    return notes.recommendation || null;
  } catch {
    return null;
  }
};

// Get fit badge color
const getFitBadgeStyle = (recommendation: string | null) => {
  switch (recommendation) {
    case "Strong Fit":
      return "bg-green-500/20 border-green-500/40 text-green-400";
    case "Good Fit":
      return "bg-blue-500/20 border-blue-500/40 text-blue-400";
    case "Potential Fit":
      return "bg-yellow-500/20 border-yellow-500/40 text-yellow-400";
    case "Not a Fit":
      return "bg-red-500/20 border-red-500/40 text-red-400";
    default:
      return "bg-gray-500/20 border-gray-500/40 text-gray-400";
  }
};

// Get fit rank (lower is better)
const getFitRank = (recommendation: string | null): number => {
  switch (recommendation) {
    case "Strong Fit": return 1;
    case "Good Fit": return 2;
    case "Potential Fit": return 3;
    case "Not a Fit": return 4;
    default: return 5;
  }
};

interface JobStats {
  candidate_stats: {
    total: number;
    pending: number;
    in_progress: number;
    completed: number;
  };
  analytics_stats: {
    total_evaluated: number;
    avg_score: number;
    recommendations: {
      strong_hire: number;
      hire: number;
      maybe: number;
      no_hire: number;
    };
  };
}

export default function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading, recruiter, logout, token } = useAuth();

  const [job, setJob] = useState<Job | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [stats, setStats] = useState<JobStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "candidates" | "analytics">("overview");

  // Missing fields form state
  const [showMissingFieldsForm, setShowMissingFieldsForm] = useState(false);
  const [savingFields, setSavingFields] = useState(false);
  const [editedFields, setEditedFields] = useState<{
    success_signals: WeightedAttribute[];
    red_flags: WeightedAttribute[];
    behavioral_traits: WeightedAttribute[];
    cultural_indicators: WeightedAttribute[];
    deal_breakers: WeightedAttribute[];
    required_skills: WeightedAttribute[];
    ideal_background: string;
    category_weights: {
      required_skills: number;
      preferred_skills: number;
      success_signals: number;
      red_flags: number;
      behavioral_traits: number;
      cultural_indicators: number;
      deal_breakers: number;
    };
  }>({
    success_signals: [],
    red_flags: [],
    behavioral_traits: [],
    cultural_indicators: [],
    deal_breakers: [],
    required_skills: [],
    ideal_background: "",
    category_weights: {
      required_skills: 0.25,
      preferred_skills: 0.10,
      success_signals: 0.20,
      red_flags: 0.15,
      behavioral_traits: 0.15,
      cultural_indicators: 0.10,
      deal_breakers: 0.05,
    },
  });
  const [newItemInputs, setNewItemInputs] = useState<Record<string, string>>({});

  // Auth redirect is handled by AppLayout

  useEffect(() => {
    if (isAuthenticated && token) {
      fetchJobData();
    }
  }, [resolvedParams.id, isAuthenticated, token]);

  const getAuthHeaders = (): Record<string, string> => {
    const headers: Record<string, string> = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    return headers;
  };

  const fetchJobData = async () => {
    try {
      setLoading(true);
      const headers = getAuthHeaders();

      // Fetch job details
      const jobResponse = await fetch(`${API_URL}/api/jobs/${resolvedParams.id}`, { headers });
      if (jobResponse.ok) {
        const jobData = await jobResponse.json();
        setJob(jobData);
      } else if (jobResponse.status === 401) {
        router.push("/login");
        return;
      }

      // Fetch candidates for this job
      const candidatesResponse = await fetch(`${API_URL}/api/jobs/${resolvedParams.id}/candidates`, { headers });
      if (candidatesResponse.ok) {
        const candidatesData = await candidatesResponse.json();
        setCandidates(candidatesData.candidates || []);
      }

      // Fetch job dashboard stats
      const statsResponse = await fetch(`${API_URL}/api/dashboard/job/${resolvedParams.id}/summary`, { headers });
      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        setStats(statsData);
      }
    } catch (error) {
      console.error("Failed to fetch job data:", error);
    } finally {
      setLoading(false);
    }
  };

  const updateJobStatus = async (action: "activate" | "pause" | "close" | "reopen") => {
    try {
      const response = await fetch(`${API_URL}/api/jobs/${resolvedParams.id}/${action}`, {
        method: "POST",
        headers: getAuthHeaders(),
      });
      if (response.ok) {
        fetchJobData();
      }
    } catch (error) {
      console.error(`Failed to ${action} job:`, error);
    }
  };

  // Initialize edited fields when job loads
  useEffect(() => {
    if (job?.extracted_requirements) {
      setEditedFields({
        success_signals: job.extracted_requirements.success_signals || [],
        red_flags: job.extracted_requirements.red_flags || [],
        behavioral_traits: job.extracted_requirements.behavioral_traits || [],
        cultural_indicators: job.extracted_requirements.cultural_indicators || [],
        deal_breakers: job.extracted_requirements.deal_breakers || [],
        required_skills: job.extracted_requirements.required_skills || [],
        ideal_background: job.extracted_requirements.ideal_background || "",
        category_weights: job.extracted_requirements.category_weights || {
          required_skills: 0.25,
          preferred_skills: 0.10,
          success_signals: 0.20,
          red_flags: 0.15,
          behavioral_traits: 0.15,
          cultural_indicators: 0.10,
          deal_breakers: 0.05,
        },
      });
    }
  }, [job]);

  // Save missing fields
  const saveSemanticAttributes = async () => {
    if (!job) return;

    try {
      setSavingFields(true);
      const headers = {
        ...getAuthHeaders(),
        "Content-Type": "application/json",
      };

      // Merge edited fields with existing extracted_requirements
      const updatedRequirements = {
        ...job.extracted_requirements,
        ...editedFields,
        // Clear missing_fields for the ones we've filled
        missing_fields: (job.extracted_requirements?.missing_fields || []).filter(
          (field) => {
            const fieldKey = field.toLowerCase().replace(/\s+/g, '_');
            const editedValue = editedFields[fieldKey as keyof typeof editedFields];
            if (Array.isArray(editedValue)) {
              return editedValue.length === 0;
            }
            return !editedValue;
          }
        ),
      };

      const response = await fetch(`${API_URL}/api/jobs/${resolvedParams.id}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          extracted_requirements: updatedRequirements,
        }),
      });

      if (response.ok) {
        fetchJobData();
        setShowMissingFieldsForm(false);
      }
    } catch (error) {
      console.error("Failed to save semantic attributes:", error);
    } finally {
      setSavingFields(false);
    }
  };

  // Add weighted item to array field
  const addItemToField = (field: keyof typeof editedFields, value: string, weight: number = 0.7) => {
    if (!value.trim()) return;
    if (Array.isArray(editedFields[field]) && field !== 'category_weights') {
      const newItem: WeightedAttribute = { value: value.trim(), weight };
      setEditedFields({
        ...editedFields,
        [field]: [...(editedFields[field] as WeightedAttribute[]), newItem],
      });
      setNewItemInputs({ ...newItemInputs, [field]: "" });
    }
  };

  // Remove item from array field
  const removeItemFromField = (field: keyof typeof editedFields, index: number) => {
    if (Array.isArray(editedFields[field]) && field !== 'category_weights') {
      setEditedFields({
        ...editedFields,
        [field]: (editedFields[field] as WeightedAttribute[]).filter((_, i) => i !== index),
      });
    }
  };

  // Update weight for an item
  const updateItemWeight = (field: keyof typeof editedFields, index: number, weight: number) => {
    if (Array.isArray(editedFields[field]) && field !== 'category_weights') {
      const items = [...(editedFields[field] as WeightedAttribute[])];
      items[index] = { ...items[index], weight };
      setEditedFields({
        ...editedFields,
        [field]: items,
      });
    }
  };

  // Update category weight
  const updateCategoryWeight = (category: keyof typeof editedFields.category_weights, weight: number) => {
    setEditedFields({
      ...editedFields,
      category_weights: {
        ...editedFields.category_weights,
        [category]: weight,
      },
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-500/10 border-green-500/30 text-green-400";
      case "draft":
        return "bg-yellow-500/10 border-yellow-500/30 text-yellow-400";
      case "paused":
        return "bg-orange-500/10 border-orange-500/30 text-orange-400";
      case "closed":
        return "bg-gray-500/10 border-gray-500/30 text-gray-400";
      default:
        return "bg-gray-500/10 border-gray-500/30 text-gray-400";
    }
  };

  // Auth loading is handled by AppLayout

  return (
    <AppLayout>
      <div className="px-6 py-8 max-w-7xl mx-auto">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
          </div>
        ) : !job ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
              <h2 className="text-xl font-medium text-white mb-2">Job Not Found</h2>
              <p className="text-white/50 mb-6">The job you're looking for doesn't exist.</p>
              <Link href="/jobs" className="text-indigo-400 hover:text-indigo-300">
                Back to Jobs
              </Link>
            </div>
          </div>
        ) : (
        <>
        {/* Page Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link href="/jobs" className="p-2 hover:bg-white/5 rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5 text-white/60" />
            </Link>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-white">{job.title}</h1>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider border ${getStatusColor(
                    job.status
                  )}`}
                >
                  {job.status}
                </span>
              </div>
              <p className="text-sm text-white/50">
                Created {new Date(job.created_at).toLocaleDateString()}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Quick Actions */}
            {job.status === "draft" && (
              <button
                onClick={() => updateJobStatus("activate")}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 rounded-lg text-sm font-medium transition-colors"
              >
                <Play className="w-4 h-4" />
                Activate
              </button>
            )}
            {job.status === "active" && (
              <button
                onClick={() => updateJobStatus("pause")}
                className="flex items-center gap-2 px-4 py-2 bg-orange-600/20 hover:bg-orange-600/30 text-orange-400 rounded-lg text-sm font-medium transition-colors"
              >
                <Pause className="w-4 h-4" />
                Pause
              </button>
            )}
          </div>
        </div>
        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="glass-panel rounded-2xl p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                <Users className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <div className="text-2xl font-light text-white">{job.candidate_count}</div>
                <div className="text-xs text-white/50 uppercase tracking-wider">Candidates</div>
              </div>
            </div>
          </div>
          <div className="glass-panel rounded-2xl p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-cyan-400" />
              </div>
              <div>
                <div className="text-2xl font-light text-white">{job.interviewed_count}</div>
                <div className="text-xs text-white/50 uppercase tracking-wider">Interviewed</div>
              </div>
            </div>
          </div>
          <div className="glass-panel rounded-2xl p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <div className="text-2xl font-light text-white">
                  {stats?.analytics_stats.avg_score.toFixed(1) || "—"}
                </div>
                <div className="text-xs text-white/50 uppercase tracking-wider">Avg Score</div>
              </div>
            </div>
          </div>
          <div className="glass-panel rounded-2xl p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center">
                <Target className="w-5 h-5 text-indigo-400" />
              </div>
              <div>
                <div className="text-2xl font-light text-white">
                  {(stats?.analytics_stats.recommendations.strong_hire || 0) +
                    (stats?.analytics_stats.recommendations.hire || 0)}
                </div>
                <div className="text-xs text-white/50 uppercase tracking-wider">Hire Ready</div>
              </div>
            </div>
          </div>
        </div>

        {/* Action Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Link
            href={`/jobs/${resolvedParams.id}/upload`}
            className="glass-panel rounded-2xl p-6 hover:bg-white/5 transition-all group"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-indigo-500/20 flex items-center justify-center group-hover:bg-indigo-500/30 transition-colors">
                <Upload className="w-6 h-6 text-indigo-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-white font-medium group-hover:text-indigo-300 transition-colors">
                  Upload Candidates
                </h3>
                <p className="text-sm text-white/50">Import CSV with resumes</p>
              </div>
              <ChevronRight className="w-5 h-5 text-white/30 group-hover:text-white/60 transition-colors" />
            </div>
          </Link>

          <Link
            href={`/jobs/${resolvedParams.id}/enrich`}
            className="glass-panel rounded-2xl p-6 hover:bg-white/5 transition-all group"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center group-hover:bg-purple-500/30 transition-colors">
                <Mic className="w-6 h-6 text-purple-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-white font-medium group-hover:text-purple-300 transition-colors">
                  Voice Enrichment
                </h3>
                <p className="text-sm text-white/50">Add scoring criteria</p>
              </div>
              <ChevronRight className="w-5 h-5 text-white/30 group-hover:text-white/60 transition-colors" />
            </div>
          </Link>

          <Link
            href={`/jobs/${resolvedParams.id}/candidates`}
            className="glass-panel rounded-2xl p-6 hover:bg-white/5 transition-all group"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-cyan-500/20 flex items-center justify-center group-hover:bg-cyan-500/30 transition-colors">
                <BarChart3 className="w-6 h-6 text-cyan-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-white font-medium group-hover:text-cyan-300 transition-colors">
                  View Rankings
                </h3>
                <p className="text-sm text-white/50">See candidate analytics</p>
              </div>
              <ChevronRight className="w-5 h-5 text-white/30 group-hover:text-white/60 transition-colors" />
            </div>
          </Link>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-2 p-1 bg-white/5 rounded-xl border border-white/10 w-fit mb-6">
          {[
            { key: "overview", label: "Overview" },
            { key: "candidates", label: "Candidates" },
            { key: "analytics", label: "Analytics" },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.key
                  ? "bg-white text-black"
                  : "text-white/50 hover:text-white"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            {/* Missing Fields Alert */}
            {job.extracted_requirements?.missing_fields && job.extracted_requirements.missing_fields.length > 0 && (
              <div className="glass-panel rounded-2xl p-6 border border-yellow-500/30 bg-yellow-500/5">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-yellow-500/20 flex items-center justify-center flex-shrink-0">
                    <AlertCircle className="w-5 h-5 text-yellow-400" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-medium text-white mb-2">Complete Job Profile</h3>
                    <p className="text-sm text-white/60 mb-4">
                      The following attributes weren't found in the job description. Add them to improve candidate screening accuracy.
                    </p>
                    <div className="flex flex-wrap gap-2 mb-4">
                      {job.extracted_requirements.missing_fields.map((field) => (
                        <span key={field} className="px-3 py-1 bg-yellow-500/20 text-yellow-300 rounded-lg text-sm">
                          {field.replace(/_/g, ' ')}
                        </span>
                      ))}
                    </div>
                    <button
                      onClick={() => setShowMissingFieldsForm(true)}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-500 text-black rounded-lg font-medium hover:bg-yellow-400 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      Add Missing Attributes
                    </button>
                  </div>
                  {job.extracted_requirements.extraction_confidence !== undefined && (
                    <div className="text-right">
                      <div className="text-2xl font-light text-white">
                        {(job.extracted_requirements.extraction_confidence * 100).toFixed(0)}%
                      </div>
                      <div className="text-xs text-white/40">Extraction Confidence</div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Missing Fields Form Modal */}
            {showMissingFieldsForm && (
              <div className="glass-panel rounded-2xl p-6 border border-indigo-500/30">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-medium text-white flex items-center gap-2">
                    <Edit className="w-5 h-5 text-indigo-400" />
                    Complete Screening Profile
                  </h3>
                  <button
                    onClick={() => setShowMissingFieldsForm(false)}
                    className="p-2 hover:bg-white/5 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5 text-white/60" />
                  </button>
                </div>

                <div className="space-y-6">
                  {/* Category Weights Section */}
                  <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                    <h4 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-indigo-400" />
                      Category Weights
                    </h4>
                    <p className="text-xs text-white/40 mb-4">Adjust how much each category matters in overall candidate scoring.</p>
                    <div className="grid grid-cols-2 gap-3">
                      {Object.entries(editedFields.category_weights).map(([key, value]) => (
                        <div key={key} className="flex items-center gap-2">
                          <span className="text-xs text-white/60 w-28 truncate">{key.replace(/_/g, ' ')}</span>
                          <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.05"
                            value={value}
                            onChange={(e) => updateCategoryWeight(key as keyof typeof editedFields.category_weights, parseFloat(e.target.value))}
                            className="flex-1 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                          />
                          <span className="text-xs text-white/60 w-10 text-right">{(value * 100).toFixed(0)}%</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Required Skills */}
                  <div>
                    <label className="flex items-center gap-2 text-sm font-medium text-indigo-400 mb-2">
                      <Sparkles className="w-4 h-4" />
                      Required Skills
                    </label>
                    <p className="text-xs text-white/40 mb-3">Key skills with importance weights for scoring.</p>
                    <div className="space-y-2">
                      {editedFields.required_skills.map((item, i) => (
                        <div key={i} className="flex items-center gap-2 p-2 bg-indigo-500/10 rounded-lg">
                          <span className="flex-1 text-sm text-white/80">{item.value}</span>
                          <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.1"
                            value={item.weight}
                            onChange={(e) => updateItemWeight('required_skills', i, parseFloat(e.target.value))}
                            className="w-20 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                            title={`Weight: ${(item.weight * 100).toFixed(0)}%`}
                          />
                          <span className="text-xs text-white/50 w-8">{(item.weight * 100).toFixed(0)}%</span>
                          <button onClick={() => removeItemFromField('required_skills', i)} className="p-1 hover:bg-white/10 rounded">
                            <X className="w-3 h-3 text-white/40" />
                          </button>
                        </div>
                      ))}
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="e.g., closing deals, prospecting..."
                          value={newItemInputs.required_skills || ""}
                          onChange={(e) => setNewItemInputs({ ...newItemInputs, required_skills: e.target.value })}
                          onKeyDown={(e) => e.key === "Enter" && addItemToField('required_skills', newItemInputs.required_skills || "")}
                          className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-indigo-500/50"
                        />
                        <button
                          onClick={() => addItemToField('required_skills', newItemInputs.required_skills || "")}
                          className="px-3 py-2 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-400 rounded-lg"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Success Signals */}
                  <div>
                    <label className="flex items-center gap-2 text-sm font-medium text-green-400 mb-2">
                      <ThumbsUp className="w-4 h-4" />
                      Success Signals (Green Flags)
                    </label>
                    <p className="text-xs text-white/40 mb-3">What patterns indicate a strong candidate? Higher weight = more important.</p>
                    <div className="space-y-2">
                      {editedFields.success_signals.map((item, i) => (
                        <div key={i} className="flex items-center gap-2 p-2 bg-green-500/10 rounded-lg">
                          <span className="flex-1 text-sm text-white/80">{item.value}</span>
                          <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.1"
                            value={item.weight}
                            onChange={(e) => updateItemWeight('success_signals', i, parseFloat(e.target.value))}
                            className="w-20 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-green-500"
                            title={`Weight: ${(item.weight * 100).toFixed(0)}%`}
                          />
                          <span className="text-xs text-white/50 w-8">{(item.weight * 100).toFixed(0)}%</span>
                          <button onClick={() => removeItemFromField('success_signals', i)} className="p-1 hover:bg-white/10 rounded">
                            <X className="w-3 h-3 text-white/40" />
                          </button>
                        </div>
                      ))}
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="e.g., Track record of exceeding quota..."
                          value={newItemInputs.success_signals || ""}
                          onChange={(e) => setNewItemInputs({ ...newItemInputs, success_signals: e.target.value })}
                          onKeyDown={(e) => e.key === "Enter" && addItemToField('success_signals', newItemInputs.success_signals || "")}
                          className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-green-500/50"
                        />
                        <button
                          onClick={() => addItemToField('success_signals', newItemInputs.success_signals || "")}
                          className="px-3 py-2 bg-green-600/20 hover:bg-green-600/30 text-green-400 rounded-lg"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Red Flags */}
                  <div>
                    <label className="flex items-center gap-2 text-sm font-medium text-red-400 mb-2">
                      <ThumbsDown className="w-4 h-4" />
                      Red Flags (Warning Signs)
                    </label>
                    <p className="text-xs text-white/40 mb-3">What patterns should disqualify a candidate? Higher weight = more severe.</p>
                    <div className="space-y-2">
                      {editedFields.red_flags.map((item, i) => (
                        <div key={i} className="flex items-center gap-2 p-2 bg-red-500/10 rounded-lg">
                          <span className="flex-1 text-sm text-white/80">{item.value}</span>
                          <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.1"
                            value={item.weight}
                            onChange={(e) => updateItemWeight('red_flags', i, parseFloat(e.target.value))}
                            className="w-20 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-red-500"
                            title={`Weight: ${(item.weight * 100).toFixed(0)}%`}
                          />
                          <span className="text-xs text-white/50 w-8">{(item.weight * 100).toFixed(0)}%</span>
                          <button onClick={() => removeItemFromField('red_flags', i)} className="p-1 hover:bg-white/10 rounded">
                            <X className="w-3 h-3 text-white/40" />
                          </button>
                        </div>
                      ))}
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="e.g., No experience with target customer segment..."
                          value={newItemInputs.red_flags || ""}
                          onChange={(e) => setNewItemInputs({ ...newItemInputs, red_flags: e.target.value })}
                          onKeyDown={(e) => e.key === "Enter" && addItemToField('red_flags', newItemInputs.red_flags || "")}
                          className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-red-500/50"
                        />
                        <button
                          onClick={() => addItemToField('red_flags', newItemInputs.red_flags || "")}
                          className="px-3 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Behavioral Traits */}
                  <div>
                    <label className="flex items-center gap-2 text-sm font-medium text-purple-400 mb-2">
                      <Brain className="w-4 h-4" />
                      Behavioral Traits
                    </label>
                    <p className="text-xs text-white/40 mb-3">What behaviors should the ideal candidate demonstrate?</p>
                    <div className="space-y-2">
                      {editedFields.behavioral_traits.map((item, i) => (
                        <div key={i} className="flex items-center gap-2 p-2 bg-purple-500/10 rounded-lg">
                          <span className="flex-1 text-sm text-white/80">{item.value}</span>
                          <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.1"
                            value={item.weight}
                            onChange={(e) => updateItemWeight('behavioral_traits', i, parseFloat(e.target.value))}
                            className="w-20 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-purple-500"
                            title={`Weight: ${(item.weight * 100).toFixed(0)}%`}
                          />
                          <span className="text-xs text-white/50 w-8">{(item.weight * 100).toFixed(0)}%</span>
                          <button onClick={() => removeItemFromField('behavioral_traits', i)} className="p-1 hover:bg-white/10 rounded">
                            <X className="w-3 h-3 text-white/40" />
                          </button>
                        </div>
                      ))}
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="e.g., Self-starter mentality, Data-driven decision making..."
                          value={newItemInputs.behavioral_traits || ""}
                          onChange={(e) => setNewItemInputs({ ...newItemInputs, behavioral_traits: e.target.value })}
                          onKeyDown={(e) => e.key === "Enter" && addItemToField('behavioral_traits', newItemInputs.behavioral_traits || "")}
                          className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-purple-500/50"
                        />
                        <button
                          onClick={() => addItemToField('behavioral_traits', newItemInputs.behavioral_traits || "")}
                          className="px-3 py-2 bg-purple-600/20 hover:bg-purple-600/30 text-purple-400 rounded-lg"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Cultural Indicators */}
                  <div>
                    <label className="flex items-center gap-2 text-sm font-medium text-cyan-400 mb-2">
                      <Heart className="w-4 h-4" />
                      Cultural Fit Indicators
                    </label>
                    <p className="text-xs text-white/40 mb-3">What values and working styles align with your team?</p>
                    <div className="space-y-2">
                      {editedFields.cultural_indicators.map((item, i) => (
                        <div key={i} className="flex items-center gap-2 p-2 bg-cyan-500/10 rounded-lg">
                          <span className="flex-1 text-sm text-white/80">{item.value}</span>
                          <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.1"
                            value={item.weight}
                            onChange={(e) => updateItemWeight('cultural_indicators', i, parseFloat(e.target.value))}
                            className="w-20 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                            title={`Weight: ${(item.weight * 100).toFixed(0)}%`}
                          />
                          <span className="text-xs text-white/50 w-8">{(item.weight * 100).toFixed(0)}%</span>
                          <button onClick={() => removeItemFromField('cultural_indicators', i)} className="p-1 hover:bg-white/10 rounded">
                            <X className="w-3 h-3 text-white/40" />
                          </button>
                        </div>
                      ))}
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="e.g., Thrives in fast-paced startup environment..."
                          value={newItemInputs.cultural_indicators || ""}
                          onChange={(e) => setNewItemInputs({ ...newItemInputs, cultural_indicators: e.target.value })}
                          onKeyDown={(e) => e.key === "Enter" && addItemToField('cultural_indicators', newItemInputs.cultural_indicators || "")}
                          className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-cyan-500/50"
                        />
                        <button
                          onClick={() => addItemToField('cultural_indicators', newItemInputs.cultural_indicators || "")}
                          className="px-3 py-2 bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-400 rounded-lg"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Deal Breakers */}
                  <div>
                    <label className="flex items-center gap-2 text-sm font-medium text-orange-400 mb-2">
                      <Ban className="w-4 h-4" />
                      Deal Breakers
                    </label>
                    <p className="text-xs text-white/40 mb-3">What are non-negotiable requirements?</p>
                    <div className="space-y-2">
                      {editedFields.deal_breakers.map((item, i) => (
                        <div key={i} className="flex items-center gap-2 p-2 bg-orange-500/10 rounded-lg">
                          <span className="flex-1 text-sm text-white/80">{item.value}</span>
                          <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.1"
                            value={item.weight}
                            onChange={(e) => updateItemWeight('deal_breakers', i, parseFloat(e.target.value))}
                            className="w-20 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-orange-500"
                            title={`Weight: ${(item.weight * 100).toFixed(0)}%`}
                          />
                          <span className="text-xs text-white/50 w-8">{(item.weight * 100).toFixed(0)}%</span>
                          <button onClick={() => removeItemFromField('deal_breakers', i)} className="p-1 hover:bg-white/10 rounded">
                            <X className="w-3 h-3 text-white/40" />
                          </button>
                        </div>
                      ))}
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="e.g., Must have sold to enterprise customers..."
                          value={newItemInputs.deal_breakers || ""}
                          onChange={(e) => setNewItemInputs({ ...newItemInputs, deal_breakers: e.target.value })}
                          onKeyDown={(e) => e.key === "Enter" && addItemToField('deal_breakers', newItemInputs.deal_breakers || "")}
                          className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-orange-500/50"
                        />
                        <button
                          onClick={() => addItemToField('deal_breakers', newItemInputs.deal_breakers || "")}
                          className="px-3 py-2 bg-orange-600/20 hover:bg-orange-600/30 text-orange-400 rounded-lg"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Ideal Background */}
                  <div>
                    <label className="flex items-center gap-2 text-sm font-medium text-indigo-400 mb-2">
                      <Target className="w-4 h-4" />
                      Ideal Background
                    </label>
                    <p className="text-xs text-white/40 mb-3">Describe the ideal candidate's background in 2-3 sentences.</p>
                    <textarea
                      value={editedFields.ideal_background}
                      onChange={(e) => setEditedFields({ ...editedFields, ideal_background: e.target.value })}
                      placeholder="e.g., The ideal candidate has 2+ years of SaaS sales experience, with a track record of selling to mid-market finance teams..."
                      rows={3}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-indigo-500/50 resize-none"
                    />
                  </div>

                  {/* Save Button */}
                  <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
                    <button
                      onClick={() => setShowMissingFieldsForm(false)}
                      className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-white/60 font-medium transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={saveSemanticAttributes}
                      disabled={savingFields}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg font-medium transition-colors disabled:opacity-50"
                    >
                      {savingFields ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4" />
                          Save Attributes
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left Column: Job Description + Basic Info */}
              <div className="space-y-6">
                {/* Job Description */}
                <div className="glass-panel rounded-2xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-medium text-white flex items-center gap-2">
                      <FileText className="w-5 h-5 text-white/60" />
                      Job Description
                    </h3>
                  </div>
                  <div className="text-sm text-white/70 leading-relaxed whitespace-pre-wrap max-h-96 overflow-y-auto">
                    {job.raw_description}
                  </div>
                </div>

                {/* Basic Requirements */}
                {job.extracted_requirements && (
                  <div className="glass-panel rounded-2xl p-6">
                    <h3 className="text-lg font-medium text-white flex items-center gap-2 mb-4">
                      <Sparkles className="w-5 h-5 text-indigo-400" />
                      Basic Requirements
                    </h3>
                    <div className="space-y-4">
                      {job.extracted_requirements.years_experience && (
                        <div>
                          <label className="text-xs text-white/50 uppercase tracking-wider">Experience</label>
                          <p className="text-white">{job.extracted_requirements.years_experience}</p>
                        </div>
                      )}
                      {job.extracted_requirements.location && (
                        <div>
                          <label className="text-xs text-white/50 uppercase tracking-wider">Location</label>
                          <p className="text-white">{job.extracted_requirements.location}</p>
                        </div>
                      )}
                      {job.extracted_requirements.required_skills && job.extracted_requirements.required_skills.length > 0 && (
                        <div>
                          <label className="text-xs text-white/50 uppercase tracking-wider mb-2 block">Skills (with weights)</label>
                          <div className="flex flex-wrap gap-2">
                            {job.extracted_requirements.required_skills.map((skill, i) => (
                              <span key={i} className="px-3 py-1 bg-indigo-500/20 text-indigo-300 rounded-lg text-sm flex items-center gap-2">
                                {skill.value}
                                <span className="text-xs opacity-60 bg-indigo-500/30 px-1.5 rounded">
                                  {(skill.weight * 100).toFixed(0)}%
                                </span>
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column: Semantic Profile */}
              <div className="space-y-6">
                {/* Success Signals */}
                {job.extracted_requirements?.success_signals && job.extracted_requirements.success_signals.length > 0 && (
                  <div className="glass-panel rounded-2xl p-6 border border-green-500/20">
                    <h3 className="text-lg font-medium text-white flex items-center gap-2 mb-4">
                      <ThumbsUp className="w-5 h-5 text-green-400" />
                      Success Signals
                      {job.extracted_requirements.category_weights && (
                        <span className="text-xs text-white/40 ml-auto">
                          Category: {(job.extracted_requirements.category_weights.success_signals * 100).toFixed(0)}%
                        </span>
                      )}
                    </h3>
                    <ul className="space-y-2">
                      {job.extracted_requirements.success_signals.map((signal, i) => (
                        <li key={i} className="text-sm text-white/80 flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                          <span className="flex-1">{signal.value}</span>
                          <span className="text-xs text-green-400/60 bg-green-500/20 px-2 py-0.5 rounded">
                            {(signal.weight * 100).toFixed(0)}%
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Red Flags */}
                {job.extracted_requirements?.red_flags && job.extracted_requirements.red_flags.length > 0 && (
                  <div className="glass-panel rounded-2xl p-6 border border-red-500/20">
                    <h3 className="text-lg font-medium text-white flex items-center gap-2 mb-4">
                      <ThumbsDown className="w-5 h-5 text-red-400" />
                      Red Flags
                      {job.extracted_requirements.category_weights && (
                        <span className="text-xs text-white/40 ml-auto">
                          Category: {(job.extracted_requirements.category_weights.red_flags * 100).toFixed(0)}%
                        </span>
                      )}
                    </h3>
                    <ul className="space-y-2">
                      {job.extracted_requirements.red_flags.map((flag, i) => (
                        <li key={i} className="text-sm text-white/80 flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                          <span className="flex-1">{flag.value}</span>
                          <span className="text-xs text-red-400/60 bg-red-500/20 px-2 py-0.5 rounded">
                            {(flag.weight * 100).toFixed(0)}%
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Behavioral Traits */}
                {job.extracted_requirements?.behavioral_traits && job.extracted_requirements.behavioral_traits.length > 0 && (
                  <div className="glass-panel rounded-2xl p-6 border border-purple-500/20">
                    <h3 className="text-lg font-medium text-white flex items-center gap-2 mb-4">
                      <Brain className="w-5 h-5 text-purple-400" />
                      Behavioral Traits
                      {job.extracted_requirements.category_weights && (
                        <span className="text-xs text-white/40 ml-auto">
                          Category: {(job.extracted_requirements.category_weights.behavioral_traits * 100).toFixed(0)}%
                        </span>
                      )}
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {job.extracted_requirements.behavioral_traits.map((trait, i) => (
                        <span key={i} className="px-3 py-1.5 bg-purple-500/20 text-purple-300 rounded-lg text-sm flex items-center gap-2">
                          {trait.value}
                          <span className="text-xs opacity-60 bg-purple-500/30 px-1.5 rounded">
                            {(trait.weight * 100).toFixed(0)}%
                          </span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Cultural Fit */}
                {job.extracted_requirements?.cultural_indicators && job.extracted_requirements.cultural_indicators.length > 0 && (
                  <div className="glass-panel rounded-2xl p-6 border border-cyan-500/20">
                    <h3 className="text-lg font-medium text-white flex items-center gap-2 mb-4">
                      <Heart className="w-5 h-5 text-cyan-400" />
                      Cultural Fit
                      {job.extracted_requirements.category_weights && (
                        <span className="text-xs text-white/40 ml-auto">
                          Category: {(job.extracted_requirements.category_weights.cultural_indicators * 100).toFixed(0)}%
                        </span>
                      )}
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {job.extracted_requirements.cultural_indicators.map((indicator, i) => (
                        <span key={i} className="px-3 py-1.5 bg-cyan-500/20 text-cyan-300 rounded-lg text-sm flex items-center gap-2">
                          {indicator.value}
                          <span className="text-xs opacity-60 bg-cyan-500/30 px-1.5 rounded">
                            {(indicator.weight * 100).toFixed(0)}%
                          </span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Deal Breakers */}
                {job.extracted_requirements?.deal_breakers && job.extracted_requirements.deal_breakers.length > 0 && (
                  <div className="glass-panel rounded-2xl p-6 border border-orange-500/20">
                    <h3 className="text-lg font-medium text-white flex items-center gap-2 mb-4">
                      <Ban className="w-5 h-5 text-orange-400" />
                      Deal Breakers
                      {job.extracted_requirements.category_weights && (
                        <span className="text-xs text-white/40 ml-auto">
                          Category: {(job.extracted_requirements.category_weights.deal_breakers * 100).toFixed(0)}%
                        </span>
                      )}
                    </h3>
                    <ul className="space-y-2">
                      {job.extracted_requirements.deal_breakers.map((breaker, i) => (
                        <li key={i} className="text-sm text-white/80 flex items-center gap-2">
                          <Ban className="w-4 h-4 text-orange-400 flex-shrink-0" />
                          <span className="flex-1">{breaker.value}</span>
                          <span className="text-xs text-orange-400/60 bg-orange-500/20 px-2 py-0.5 rounded">
                            {(breaker.weight * 100).toFixed(0)}%
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Ideal Background */}
                {job.extracted_requirements?.ideal_background && (
                  <div className="glass-panel rounded-2xl p-6">
                    <h3 className="text-lg font-medium text-white flex items-center gap-2 mb-4">
                      <Target className="w-5 h-5 text-indigo-400" />
                      Ideal Background
                    </h3>
                    <p className="text-sm text-white/70 leading-relaxed">
                      {job.extracted_requirements.ideal_background}
                    </p>
                  </div>
                )}

                {/* Edit Button if no missing fields form is showing */}
                {!showMissingFieldsForm && (
                  <button
                    onClick={() => setShowMissingFieldsForm(true)}
                    className="w-full py-3 glass-panel rounded-xl text-white/60 hover:text-white hover:bg-white/5 transition-colors flex items-center justify-center gap-2"
                  >
                    <Edit className="w-4 h-4" />
                    Edit Screening Profile
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === "candidates" && (
          <div className="glass-panel rounded-2xl p-6">
            {candidates.length === 0 ? (
              <div className="text-center py-12">
                <Users className="w-12 h-12 text-white/20 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-white mb-2">No Candidates Yet</h3>
                <p className="text-white/50 mb-6">Upload candidates to get started.</p>
                <Link
                  href={`/jobs/${resolvedParams.id}/upload`}
                  className="inline-flex items-center gap-2 px-5 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-full font-medium transition-colors"
                >
                  <Upload className="w-4 h-4" />
                  Upload Candidates
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Sort candidates by score (highest first) */}
                {[...candidates]
                  .sort((a, b) => {
                    const fitRankA = getFitRank(getRecommendation(a));
                    const fitRankB = getFitRank(getRecommendation(b));
                    if (fitRankA !== fitRankB) return fitRankA - fitRankB;
                    const scoreA = a.combined_score ?? a.ranking_score ?? 0;
                    const scoreB = b.combined_score ?? b.ranking_score ?? 0;
                    return scoreB - scoreA;
                  })
                  .slice(0, 10)
                  .map((candidate) => {
                    const recommendation = getRecommendation(candidate);
                    const score = candidate.combined_score ?? candidate.ranking_score;
                    return (
                      <div
                        key={candidate.id}
                        className="flex items-center p-4 bg-white/5 rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
                        onClick={() => router.push(`/jobs/${resolvedParams.id}/candidates/${candidate.id}`)}
                      >
                        <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-white/60 font-medium mr-3">
                          {candidate.person_name?.charAt(0)?.toUpperCase() || "?"}
                        </div>
                        <div className="flex-1">
                          <h4 className="font-medium text-white">{candidate.person_name}</h4>
                          <div className="text-sm text-white/50">
                            {candidate.current_title || candidate.person_email || candidate.email || "No title"}
                          </div>
                        </div>
                        {/* Fit Badge */}
                        <div className="mr-4">
                          {recommendation ? (
                            <span
                              className={`text-[10px] px-2 py-1 rounded-full uppercase tracking-wider border ${getFitBadgeStyle(recommendation)}`}
                            >
                              {recommendation}
                            </span>
                          ) : (
                            <span className="text-white/30 text-xs">—</span>
                          )}
                        </div>
                        {/* Score */}
                        {score != null ? (
                          <div className="text-right mr-4 w-14">
                            <div className="text-lg font-light text-white">
                              {score}
                            </div>
                            <div className="text-xs text-white/40">Score</div>
                          </div>
                        ) : (
                          <div className="text-right mr-4 w-14">
                            <div className="text-lg font-light text-white/30">—</div>
                            <div className="text-xs text-white/40">Score</div>
                          </div>
                        )}
                        <ChevronRight className="w-5 h-5 text-white/30" />
                      </div>
                    );
                  })}
                {candidates.length > 10 && (
                  <Link
                    href={`/jobs/${resolvedParams.id}/candidates`}
                    className="block text-center py-3 text-indigo-400 hover:text-indigo-300"
                  >
                    View all {candidates.length} candidates
                  </Link>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === "analytics" && (
          <div className="glass-panel rounded-2xl p-6">
            {!stats || stats.analytics_stats.total_evaluated === 0 ? (
              <div className="text-center py-12">
                <BarChart3 className="w-12 h-12 text-white/20 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-white mb-2">No Analytics Yet</h3>
                <p className="text-white/50">
                  Analytics will appear once candidates have been interviewed.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Recommendation Distribution */}
                <div>
                  <h4 className="text-sm font-medium text-white/60 mb-4 uppercase tracking-wider">
                    Recommendation Distribution
                  </h4>
                  <div className="grid grid-cols-4 gap-4">
                    <div className="p-4 bg-green-500/10 rounded-xl text-center">
                      <div className="text-2xl font-light text-green-400">
                        {stats.analytics_stats.recommendations.strong_hire}
                      </div>
                      <div className="text-xs text-green-400/60">Strong Hire</div>
                    </div>
                    <div className="p-4 bg-blue-500/10 rounded-xl text-center">
                      <div className="text-2xl font-light text-blue-400">
                        {stats.analytics_stats.recommendations.hire}
                      </div>
                      <div className="text-xs text-blue-400/60">Hire</div>
                    </div>
                    <div className="p-4 bg-yellow-500/10 rounded-xl text-center">
                      <div className="text-2xl font-light text-yellow-400">
                        {stats.analytics_stats.recommendations.maybe}
                      </div>
                      <div className="text-xs text-yellow-400/60">Maybe</div>
                    </div>
                    <div className="p-4 bg-red-500/10 rounded-xl text-center">
                      <div className="text-2xl font-light text-red-400">
                        {stats.analytics_stats.recommendations.no_hire}
                      </div>
                      <div className="text-xs text-red-400/60">No Hire</div>
                    </div>
                  </div>
                </div>

                {/* Key Metrics */}
                <div className="pt-6 border-t border-white/10">
                  <h4 className="text-sm font-medium text-white/60 mb-4 uppercase tracking-wider">
                    Key Metrics
                  </h4>
                  <div className="grid grid-cols-3 gap-6">
                    <div>
                      <div className="text-3xl font-light text-white">
                        {stats.analytics_stats.total_evaluated}
                      </div>
                      <div className="text-sm text-white/40">Total Evaluated</div>
                    </div>
                    <div>
                      <div className="text-3xl font-light text-white">
                        {stats.analytics_stats.avg_score.toFixed(1)}
                      </div>
                      <div className="text-sm text-white/40">Average Score</div>
                    </div>
                    <div>
                      <div className="text-3xl font-light text-white">
                        {stats.analytics_stats.total_evaluated > 0
                          ? (
                              ((stats.analytics_stats.recommendations.strong_hire +
                                stats.analytics_stats.recommendations.hire) /
                                stats.analytics_stats.total_evaluated) *
                              100
                            ).toFixed(0)
                          : 0}
                        %
                      </div>
                      <div className="text-sm text-white/40">Hire Rate</div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
        </>
        )}
      </div>
    </AppLayout>
  );
}
