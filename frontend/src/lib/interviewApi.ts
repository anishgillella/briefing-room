/**
 * API hooks for interview management.
 * Uses the new database-backed /api/interviews/ routes.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Types
export interface InterviewSummary {
    id: string;
    stage: string;
    status: string;
    started_at?: string;
    scheduled_at?: string;
    ended_at?: string;
    duration_sec?: number;
    analytics?: {
        overall_score?: number;
        recommendation?: string;
        synthesis?: string;
        overall_synthesis?: string;
        question_analytics?: Array<{
            question: string;
            answer_summary?: string;
            topic?: string;
            quality_score?: number;
            key_insight?: string;
            relevance_score?: number;
            clarity_score?: number;
            depth_score?: number;
        }>;
        topics_to_probe?: string[];
        skill_evidence?: Array<{
            skill: string;
            quote?: string;
            confidence?: string;
        }>;
        red_flags?: Array<{
            concern: string;
            severity?: string;
            evidence?: string;
        }>;
        highlights?: Array<{
            moment: string;
            quote?: string;
            why_notable?: string;
        }>;
        role_competencies?: Array<{
            competency: string;
            score: number;
            evidence_quote?: string;
            assessment?: string;
        }>;
        behavioral_profile?: Record<string, number>;
        cultural_fit?: {
            values_alignment?: number;
            work_style?: string;
            motivation_drivers?: string[];
            team_fit_notes?: string;
        };
        enthusiasm?: {
            overall_enthusiasm?: number;
            role_interest?: number;
            company_interest?: number;
            engagement_notes?: string;
        };
        communication_metrics?: Record<string, any>;
    };
    transcript_turns?: Array<{
        speaker: string;
        text: string;
    }>;
}

export interface CandidateInterviewsResponse {
    candidate_id: string;
    candidate_name: string;
    pipeline_status: string;
    stages_completed: number;
    all_stages_complete: boolean;
    average_score?: number;
    interviews: InterviewSummary[];
    next_stage?: string;
}

export interface StartInterviewResponse {
    interview_id: string;
    room_name: string;
    room_url: string;
    token: string;
    stage: string;
    candidate: Record<string, any>;
}

export interface DecisionResponse {
    status: string;
    decision: string;
    candidate_id: string;
}

export interface DeleteInterviewResponse {
    status: string;
    interview_id: string;
    stage: string;
    candidate_id: string;
    new_pipeline_status: string;
}

export interface CreateForTranscriptResponse {
    interview_id: string;
    stage: string;
    candidate_id: string;
    message: string;
}

// API Functions

/**
 * Lookup a candidate's database UUID by their name.
 * Use this to bridge JSON simple IDs to database UUIDs.
 */
export async function lookupCandidateByName(name: string): Promise<{
    name: string;
    db_id: string;
    pipeline_status: string;
}> {
    const response = await fetch(`${API_BASE}/api/interviews/lookup-by-name/${encodeURIComponent(name)}`);
    if (!response.ok) {
        throw new Error(`Candidate '${name}' not found in database`);
    }
    return response.json();
}

/**
 * Get all interviews for a candidate with analytics.
 * Note: candidateId should be a database UUID, not a JSON simple ID.
 * Use lookupCandidateByName() first if you only have the candidate name.
 */
export async function getCandidateInterviews(candidateId: string): Promise<CandidateInterviewsResponse> {
    const response = await fetch(`${API_BASE}/api/interviews/candidate/${candidateId}`);
    if (!response.ok) {
        throw new Error(`Failed to fetch interviews: ${response.statusText}`);
    }
    return response.json();
}

/**
 * Start the next interview stage (auto-selects round_1, round_2, or round_3)
 */
export async function startNextInterview(candidateId: string): Promise<StartInterviewResponse> {
    const response = await fetch(`${API_BASE}/api/interviews/candidate/${candidateId}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to start interview');
    }
    return response.json();
}

/**
 * Create an interview record for transcript upload only.
 * This doesn't start a live interview room, just creates the record
 * so you can upload a transcript and generate analytics.
 */
export async function createInterviewForTranscript(candidateId: string): Promise<CreateForTranscriptResponse> {
    const response = await fetch(`${API_BASE}/api/interviews/candidate/${candidateId}/create-for-transcript`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to create interview');
    }
    return response.json();
}

/**
 * Submit Accept/Reject decision (only after all 3 stages complete)
 */
export async function submitDecision(
    candidateId: string,
    decision: 'accepted' | 'rejected',
    notes?: string
): Promise<DecisionResponse> {
    const response = await fetch(`${API_BASE}/api/interviews/candidate/${candidateId}/decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, notes }),
    });
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to submit decision');
    }
    return response.json();
}

/**
 * Mark an interview as completed
 */
export async function completeInterview(interviewId: string): Promise<void> {
    const response = await fetch(`${API_BASE}/api/interviews/${interviewId}/complete`, {
        method: 'POST',
    });
    if (!response.ok) {
        throw new Error('Failed to complete interview');
    }
}

/**
 * Save analytics for an interview
 */
export async function saveInterviewAnalytics(
    interviewId: string,
    analytics: Record<string, any>
): Promise<void> {
    const response = await fetch(`${API_BASE}/api/interviews/${interviewId}/analytics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(analytics),
    });
    if (!response.ok) {
        throw new Error('Failed to save analytics');
    }
}

/**
 * Get interview context (questions to avoid, topics to probe)
 */
export async function getInterviewContext(interviewId: string): Promise<{
    prior_interviews: any[];
    questions_to_avoid: string[];
    topics_to_explore: string[];
    score_history: Array<{ stage: string; score?: number }>;
}> {
    const response = await fetch(`${API_BASE}/api/interviews/${interviewId}/context`);
    if (!response.ok) {
        throw new Error('Failed to get interview context');
    }
    return response.json();
}

/**
 * Delete an interview and all associated data (analytics, transcript, etc.)
 * This allows retrying the interview from scratch.
 */
export async function deleteInterview(interviewId: string): Promise<DeleteInterviewResponse> {
    const response = await fetch(`${API_BASE}/api/interviews/${interviewId}`, {
        method: 'DELETE',
    });
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to delete interview');
    }
    return response.json();
}

// Helper to format stage names
export function formatStageName(stage: string): string {
    const names: Record<string, string> = {
        'round_1': 'Round 1',
        'round_2': 'Round 2',
        'round_3': 'Round 3',
    };
    return names[stage] || stage;
}

// Helper to get stage status styling
export function getStageStatus(
    stage: string,
    interviews: InterviewSummary[]
): 'completed' | 'in_progress' | 'pending' {
    const interview = interviews.find(i => i.stage === stage);
    if (!interview) return 'pending';
    if (interview.status === 'completed') return 'completed';
    if (interview.status === 'active') return 'in_progress';
    return 'pending';
}
