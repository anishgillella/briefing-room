/**
 * Candidate types for Pluto integration
 * Matches the backend Candidate model
 */

// Interview status enum
export type InterviewStatus = "not_scheduled" | "briefing" | "in_progress" | "completed";

// Candidate tier based on combined score
export type CandidateTier = "Top Tier" | "Strong" | "Good" | "Evaluate" | "Poor";

// Recommendation after interview
export type Recommendation = "Strong Hire" | "Hire" | "Leaning Hire" | "Leaning No Hire" | "No Hire";

// Data source
export type CandidateSource = "csv_upload" | "manual" | "voice_enriched";

/**
 * Main Candidate interface - unified data model
 */
export interface Candidate {
    // Identity
    id: string;
    name: string;
    email?: string | null;
    linkedin_url?: string | null;

    // Basic Info
    job_title?: string | null;
    current_company?: string | null;
    location_city?: string | null;
    location_state?: string | null;
    years_experience?: number | null;

    // Extracted Resume Data
    bio_summary?: string | null;
    industries: string[];
    skills: string[];
    education?: string | null;
    sales_methodologies: string[];

    // Pluto Scoring Signals
    sold_to_finance: boolean;
    is_founder: boolean;
    startup_experience: boolean;
    enterprise_experience: boolean;
    max_acv_mentioned?: number | null;
    quota_attainment?: number | null;

    // Pluto Scores (0-100)
    algo_score?: number | null;
    ai_score?: number | null;
    combined_score?: number | null;
    tier?: CandidateTier | null;

    // AI Evaluation Details
    one_line_summary?: string | null;
    pros: string[];
    cons: string[];
    reasoning?: string | null;
    interview_questions: string[];

    // Data Quality
    missing_required: string[];
    missing_preferred: string[];
    red_flags: string[];
    red_flag_count: number;
    completeness: number; // 0-100%

    // Interview Tracking
    interview_status: InterviewStatus;
    room_name?: string | null;
    interview_score?: number | null;
    recommendation?: Recommendation | null;

    // Metadata
    created_at: string; // ISO timestamp
    updated_at: string;
    source: CandidateSource;
    has_enrichment_data: boolean;
}

/**
 * Processing status for CSV uploads
 */
export interface ProcessingStatus {
    status: "idle" | "extracting" | "scoring" | "complete" | "error";
    phase: string;
    progress: number; // 0-100
    message: string;
    candidates_total: number;
    candidates_extracted: number;
    candidates_scored: number;
    error?: string | null;
}

/**
 * Response for candidate list endpoint
 */
export interface CandidateListResponse {
    total: number;
    offset: number;
    limit: number;
    candidates: Candidate[];
}

/**
 * Response for starting an interview
 */
export interface StartInterviewResponse {
    room_name: string;
    room_url: string;
    token: string;
    candidate: Candidate;
}

/**
 * Candidate update payload
 */
export interface CandidateUpdate {
    name?: string;
    email?: string;
    job_title?: string;
    bio_summary?: string;
    interview_status?: InterviewStatus;
    interview_score?: number;
    recommendation?: Recommendation;
}

/**
 * Helper functions
 */

// Get tier color class for styling
export function getTierColor(tier?: CandidateTier | null): string {
    switch (tier) {
        case "Top Tier":
            return "bg-green-500/20 text-green-400 border-green-500/30";
        case "Strong":
            return "bg-blue-500/20 text-blue-400 border-blue-500/30";
        case "Good":
            return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
        case "Evaluate":
            return "bg-orange-500/20 text-orange-400 border-orange-500/30";
        case "Poor":
            return "bg-red-500/20 text-red-400 border-red-500/30";
        default:
            return "bg-gray-500/20 text-gray-400 border-gray-500/30";
    }
}

// Get status badge color
export function getStatusColor(status: InterviewStatus): string {
    switch (status) {
        case "not_scheduled":
            return "bg-gray-500/20 text-gray-400";
        case "briefing":
            return "bg-purple-500/20 text-purple-400";
        case "in_progress":
            return "bg-blue-500/20 text-blue-400";
        case "completed":
            return "bg-green-500/20 text-green-400";
        default:
            return "bg-gray-500/20 text-gray-400";
    }
}

// Format interview status for display
export function formatInterviewStatus(status: InterviewStatus): string {
    switch (status) {
        case "not_scheduled":
            return "Not Scheduled";
        case "briefing":
            return "In Briefing";
        case "in_progress":
            return "Interview Active";
        case "completed":
            return "Completed";
        default:
            return status;
    }
}
