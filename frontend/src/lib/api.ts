const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface CreateRoomResponse {
    room_name: string;
    room_url: string;
    interviewer_token: string;
    expires_at: string;
}

export interface JoinRoomResponse {
    token: string;
    room_url: string;
}

export interface RoomDetails {
    room_name: string;
    room_url: string;
    created_by: string;
    created_at: string;
    expires_at: string;
}

export async function createRoom(interviewerName: string): Promise<CreateRoomResponse> {
    const response = await fetch(`${API_BASE_URL}/api/rooms`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            interviewer_name: interviewerName,
        }),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Failed to create room");
    }

    return response.json();
}

export async function getRoom(roomName: string): Promise<RoomDetails> {
    const response = await fetch(`${API_BASE_URL}/api/rooms/${roomName}`);

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Room not found");
    }

    return response.json();
}

export async function joinRoom(
    roomName: string,
    participantName: string,
    participantType: "interviewer" | "candidate"
): Promise<JoinRoomResponse> {
    const response = await fetch(`${API_BASE_URL}/api/rooms/${roomName}/join`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            participant_name: participantName,
            participant_type: participantType,
        }),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Failed to join room");
    }

    return response.json();
}

export interface BriefingData {
    candidate_name: string;
    role: string | null;
    resume_summary: string | null;
    notes: string | null;
    focus_areas: string[] | null;
    briefing_prompt: string;
}

export async function getBriefing(roomName: string): Promise<BriefingData> {
    const response = await fetch(`${API_BASE_URL}/api/rooms/${roomName}/briefing`);

    if (!response.ok) {
        // Return default briefing if not found
        return {
            candidate_name: "the candidate",
            role: null,
            resume_summary: null,
            notes: null,
            focus_areas: null,
            briefing_prompt: "No specific candidate information was provided.",
        };
    }

    return response.json();
}

export async function setBriefing(
    roomName: string,
    data: {
        candidate_name: string;
        role?: string;
        resume_summary?: string;
        notes?: string;
        focus_areas?: string[];
    }
): Promise<BriefingData> {
    const response = await fetch(`${API_BASE_URL}/api/rooms/${roomName}/briefing`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Failed to set briefing");
    }

    return response.json();
}

export interface DebriefResponse {
    summary: string;
    strengths: string[];
    improvements: string[];
    follow_up_questions: string[];
    recommendation: string;
    original_briefing: BriefingData | null;
}

export async function generateDebrief(
    roomName: string,
    chatHistory: { role: string; content: string }[],
    notes?: string,
    transcript?: string // New optional parameter
): Promise<DebriefResponse> {
    const response = await fetch(`${API_BASE_URL}/api/rooms/${roomName}/debrief`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            chat_history: chatHistory,
            notes: notes,
            transcript: transcript, // Pass to backend
        }),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Failed to generate debrief");
    }

    return response.json();
}

// Interview Analytics types
export interface QuestionMetrics {
    relevance: number;
    clarity: number;
    depth: number;
    type_specific_metric: number;
    type_specific_label: string;
}

export interface QuestionAnswer {
    question: string;
    answer: string;
    question_type: "technical" | "behavioral" | "situational" | "other";
    metrics: QuestionMetrics;
    highlight: string | null;
}

export interface OverallMetrics {
    overall_score: number;
    communication_score: number;
    technical_score: number;
    cultural_fit_score: number;
    total_questions: number;
    avg_response_length: number;
    red_flags: string[];
    highlights: string[];
    recommendation: "Strong Hire" | "Hire" | "Leaning Hire" | "Leaning No Hire" | "No Hire";
    recommendation_reasoning: string;
    confidence: number;
}

export interface HighlightItem {
    quote: string;
    context: string;
}

export interface InterviewHighlights {
    best_answer: HighlightItem;
    red_flag: HighlightItem | null;
    quotable_moment: string;
    areas_to_probe: string[];
}

export interface InterviewAnalytics {
    qa_pairs: QuestionAnswer[];
    overall: OverallMetrics;
    highlights: InterviewHighlights;
}

export async function getInterviewAnalytics(
    roomName: string,
    transcript: string,
    jobDescription?: string,
    resume?: string
): Promise<InterviewAnalytics> {
    const response = await fetch(`${API_BASE_URL}/api/analytics/${roomName}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            transcript,
            job_description: jobDescription,
            resume,
        }),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Failed to get interview analytics");
    }

    return response.json();
}

// Coach Mode types and API - suggests next question after each Q&A exchange
export interface CoachSuggestion {
    last_question_type: string;
    answer_quality: "strong" | "adequate" | "weak" | "unclear";
    suggested_next_question: string;
    reasoning: string;
    should_change_topic: boolean;
    topic_suggestion: string | null;
}

export async function getCoachSuggestion(
    lastExchange: string,
    fullTranscript: string,
    elapsedMinutes: number,
    briefingContext?: string
): Promise<CoachSuggestion> {
    const response = await fetch(`${API_BASE_URL}/api/coach/suggest`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            last_exchange: lastExchange,
            full_transcript: fullTranscript,
            elapsed_minutes: elapsedMinutes,
            briefing_context: briefingContext,
        }),
    });

    if (!response.ok) {
        // Return default suggestion on error
        return {
            last_question_type: "other",
            answer_quality: "adequate",
            suggested_next_question: "Continue with your planned questions",
            reasoning: "API error",
            should_change_topic: false,
            topic_suggestion: null
        };
    }

    return response.json();
}

// Pre-Interview Brief types
export interface SkillMatch {
    skill: string;
    required_level: string;
    candidate_level: "expert" | "proficient" | "competent" | "beginner" | "not_found";
    evidence: string | null;
    is_match: boolean;
}

export interface ExperienceHighlight {
    company: string;
    role: string;
    duration: string;
    key_achievement: string;
    relevance: string;
}

export interface ConcernItem {
    concern: string;
    evidence: string;
    suggested_question: string;
    severity: "low" | "medium" | "high";
}

export interface StrengthItem {
    strength: string;
    evidence: string;
    how_to_verify: string;
}

export interface SuggestedQuestion {
    question: string;
    category: "technical" | "behavioral" | "situational" | "cultural";
    purpose: string;
    follow_up: string | null;
}

export interface ScoreBreakdown {
    technical_skills: number;
    experience_relevance: number;
    leadership_potential: number;
    communication_signals: number;
    culture_fit_signals: number;
    growth_trajectory: number;
}

export interface PreInterviewBrief {
    candidate_name: string;
    current_role: string;
    years_experience: number;
    overall_fit_score: number;
    fit_summary: string;
    score_breakdown: ScoreBreakdown;
    skill_matches: SkillMatch[];
    experience_highlights: ExperienceHighlight[];
    strengths: StrengthItem[];
    concerns: ConcernItem[];
    suggested_questions: SuggestedQuestion[];
    topics_to_avoid: string[];
    tldr: string;
    key_things_to_remember: string[];
}

export async function getPreInterviewBrief(
    roomName: string,
    jobDescription: string,
    resume: string,
    companyContext?: string
): Promise<PreInterviewBrief> {
    const response = await fetch(`${API_BASE_URL}/api/prebrief/${roomName}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            job_description: jobDescription,
            resume: resume,
            company_context: companyContext
        }),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Failed to generate pre-brief");
    }

    return response.json();
}


// --- Parse resume and JD with LLM for formatted markdown ---

// --- Parse resume and JD with LLM for formatted markdown ---

export interface ParsedResume {
    personal_info: {
        name: string;
        role: string;
        contact?: string;
        summary: string;
    };
    experience: {
        company: string;
        role: string;
        duration: string;
        location?: string;
        highlights: string[];
    }[];
    education: {
        school: string;
        degree: string;
        year: string;
    }[];
    skills: Record<string, string[]>;
    projects?: {
        name: string;
        details: string;
    }[];
    other?: string[];
}

export interface ParsedJD {
    role_info: {
        title: string;
        company: string;
        location: string;
    };
    summary: string;
    responsibilities: string[];
    qualifications: {
        category: string;
        items: string[];
    }[];
    nice_to_haves?: string[];
    benefits?: string[];
}

export interface ParseResponse<T> {
    data: T | null;
    formatted: string;
    success: boolean;
}

export async function parseResume(text: string): Promise<ParseResponse<ParsedResume>> {
    try {
        const response = await fetch(`${API_BASE_URL}/api/prebrief/parse/resume`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text }),
        });

        if (!response.ok) {
            return { data: null, formatted: text, success: false };
        }

        return response.json();
    } catch {
        return { data: null, formatted: text, success: false };
    }
}

export async function parseJobDescription(text: string): Promise<ParseResponse<ParsedJD>> {
    try {
        const response = await fetch(`${API_BASE_URL}/api/prebrief/parse/jd`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text }),
        });

        if (!response.ok) {
            return { data: null, formatted: text, success: false };
        }

        return response.json();
    } catch {
        return { data: null, formatted: text, success: false };
    }
}


// =============================================================================
// Pluto API - Candidate Management
// =============================================================================

import type {
    Candidate,
    CandidateListResponse,
    ProcessingStatus,
    StartInterviewResponse,
    CandidateUpdate,
} from "./types";

/**
 * Get Pluto service info
 */
export async function getPlutoInfo(): Promise<{ service: string; description: string; candidates_count: number }> {
    const response = await fetch(`${API_BASE_URL}/api/pluto/`);
    if (!response.ok) {
        throw new Error("Failed to reach Pluto service");
    }
    return response.json();
}

/**
 * Upload a CSV file for processing
 */
export async function uploadCandidatesCsv(file: File): Promise<{ status: string; message: string; check_status_at: string }> {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(`${API_BASE_URL}/api/pluto/upload`, {
        method: "POST",
        body: formData,
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Failed to upload CSV");
    }

    return response.json();
}

/**
 * Check processing status
 */
export async function getProcessingStatus(): Promise<ProcessingStatus> {
    const response = await fetch(`${API_BASE_URL}/api/pluto/status`);
    if (!response.ok) {
        throw new Error("Failed to get processing status");
    }
    return response.json();
}

/**
 * Get all ranked candidates
 */
export async function getCandidates(
    tier?: string,
    status?: string,
    limit: number = 50,
    offset: number = 0
): Promise<CandidateListResponse> {
    const params = new URLSearchParams();
    if (tier) params.append("tier", tier);
    if (status) params.append("status", status);
    params.append("limit", String(limit));
    params.append("offset", String(offset));

    const response = await fetch(`${API_BASE_URL}/api/pluto/candidates?${params}`);
    if (!response.ok) {
        throw new Error("Failed to get candidates");
    }
    return response.json();
}

/**
 * Get a specific candidate by ID
 */
export async function getCandidate(candidateId: string): Promise<Candidate> {
    const response = await fetch(`${API_BASE_URL}/api/pluto/candidates/${candidateId}`);
    if (!response.ok) {
        if (response.status === 404) {
            throw new Error("Candidate not found");
        }
        throw new Error("Failed to get candidate");
    }
    return response.json();
}

/**
 * Update a candidate's data
 */
export async function updateCandidate(candidateId: string, updates: CandidateUpdate): Promise<Candidate> {
    const response = await fetch(`${API_BASE_URL}/api/pluto/candidates/${candidateId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Failed to update candidate");
    }

    return response.json();
}

/**
 * Delete a candidate
 */
export async function deleteCandidate(candidateId: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/pluto/candidates/${candidateId}`, {
        method: "DELETE",
    });

    if (!response.ok) {
        throw new Error("Failed to delete candidate");
    }
}

/**
 * Start an interview for a candidate
 */
export async function startCandidateInterview(candidateId: string): Promise<StartInterviewResponse> {
    const response = await fetch(`${API_BASE_URL}/api/pluto/candidates/${candidateId}/interview`, {
        method: "POST",
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Failed to start interview");
    }

    return response.json();
}

