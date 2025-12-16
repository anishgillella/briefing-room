/**
 * API client for Voice Ingest flow.
 * Handles session management, company research, JD parsing, and voice token generation.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// =============================================================================
// Types
// =============================================================================

export interface StartSessionRequest {
    first_name: string;
    last_name: string;
    company_name: string;
    company_website: string;
}

export interface StartSessionResponse {
    session_id: string;
    status: string;
    message: string;
}

export interface CompanyIntelligence {
    name: string;
    website?: string;
    tagline?: string;
    funding_stage?: string;
    total_raised?: string;
    investors?: string[];
    team_size?: number;
    headquarters?: string;
    office_locations?: string[];
    product_description?: string;
    problem_solved?: string;
    tech_stack_hints?: string[];
    competitors?: string[];
    culture_keywords?: string[];
    recent_news?: string[];
    interesting_facts?: string[];
    potential_selling_points?: string[];
}

export interface CompanyIntelResponse {
    status: 'pending' | 'in_progress' | 'complete' | 'failed' | 'partial';
    company_intel?: CompanyIntelligence;
    error?: string;
}

export interface HardRequirements {
    job_title?: string;
    location_type?: string;
    location_city?: string;
    onsite_days_per_week?: number;
    visa_sponsorship?: boolean;
    experience_min_years?: number;
    experience_max_years?: number;
    salary_min?: number;
    salary_max?: number;
    equity_offered?: boolean;
    equity_range?: string;
}

export interface CandidateTrait {
    id: string;
    name: string;
    description: string;
    priority: 'must_have' | 'strong_preference' | 'nice_to_have';
    signals?: string[];
}

export interface InterviewStage {
    id: string;
    name: string;
    description: string;
    order: number;
    duration_minutes?: number;
    interviewer_role?: string;
    actions?: string[];
}

export interface NuanceCapture {
    id: string;
    category: string;
    insight: string;
    verbatim_quote?: string;
}

export interface JobProfile {
    id: string;
    recruiter_first_name: string;
    recruiter_last_name: string;
    company?: CompanyIntelligence;
    requirements: HardRequirements;
    traits: CandidateTrait[];
    interview_stages: InterviewStage[];
    nuances: NuanceCapture[];
    is_complete: boolean;
    completion_percentage: number;
}

export interface ProfileResponse {
    profile: JobProfile;
    completion_percentage: number;
    missing_fields: string[];
}

export interface ParseJDRequest {
    jd_text: string;
}

export interface ParseJDResponse {
    success: boolean;
    extracted: Record<string, unknown>;
    confidence_scores: Record<string, number>;
    missing_required: string[];
    missing_optional: string[];
    suggested_questions: string[];
    extraction_summary: string;
    completion_percentage: number;
}

export interface VoiceTokenResponse {
    token: string;
    livekit_url: string;
    room_name: string;
    session_id: string;
}

export interface VapiCallResponse {
    call_id: string;
    web_call_url?: string;
    vapi_public_key: string;
    assistant_id?: string;
    session_id: string;
    error?: string;
}

// =============================================================================
// WebSocket Message Types
// =============================================================================

export type WebSocketMessageType =
    | 'connected'
    | 'requirements'
    | 'trait_created'
    | 'trait_updated'
    | 'trait_deleted'
    | 'stage_created'
    | 'stage_updated'
    | 'stage_deleted'
    | 'nuance_captured'
    | 'transcript'
    | 'completion_update'
    | 'field_complete'
    | 'profile_refresh'
    | 'onboarding_complete';

export interface WebSocketMessage {
    type: WebSocketMessageType;
    data: Record<string, unknown>;
}

export interface TranscriptMessage {
    speaker: 'agent' | 'user';
    text: string;
}

export interface CompletionUpdate {
    completion_percentage: number;
    missing_fields: string[];
    is_complete: boolean;
}

// =============================================================================
// API Functions
// =============================================================================

/**
 * Start a new voice ingest session.
 * This creates a job profile and triggers company research in the background.
 */
export async function startSession(request: StartSessionRequest): Promise<StartSessionResponse> {
    const response = await fetch(`${API_BASE}/api/voice-ingest/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to start session' }));
        throw new Error(error.detail || 'Failed to start session');
    }

    return response.json();
}

/**
 * Get the current job profile for a session.
 */
export async function getProfile(sessionId: string): Promise<ProfileResponse> {
    const response = await fetch(`${API_BASE}/api/voice-ingest/${sessionId}`);

    if (!response.ok) {
        throw new Error('Session not found');
    }

    return response.json();
}

/**
 * Poll company research status.
 * Returns current status and company intel when available.
 */
export async function getCompanyIntel(sessionId: string): Promise<CompanyIntelResponse> {
    const response = await fetch(`${API_BASE}/api/voice-ingest/${sessionId}/company-intel`);

    if (!response.ok) {
        throw new Error('Session not found');
    }

    return response.json();
}

/**
 * Parse a job description and extract structured data.
 */
export async function parseJD(sessionId: string, jdText: string): Promise<ParseJDResponse> {
    const response = await fetch(`${API_BASE}/api/voice-ingest/${sessionId}/parse-jd`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jd_text: jdText }),
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'JD parsing failed' }));
        throw new Error(error.detail || 'JD parsing failed');
    }

    return response.json();
}

/**
 * Update job requirements.
 */
export async function updateRequirements(
    sessionId: string,
    updates: Partial<HardRequirements>
): Promise<{ success: boolean; requirements: HardRequirements; completion_percentage: number; missing_fields: string[] }> {
    const response = await fetch(`${API_BASE}/api/voice-ingest/${sessionId}/requirements`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
    });

    if (!response.ok) {
        throw new Error('Failed to update requirements');
    }

    return response.json();
}

/**
 * Add a candidate trait.
 */
export async function createTrait(
    sessionId: string,
    trait: { name: string; description: string; priority?: string; signals?: string[] }
): Promise<{ success: boolean; trait: CandidateTrait }> {
    const response = await fetch(`${API_BASE}/api/voice-ingest/${sessionId}/traits`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(trait),
    });

    if (!response.ok) {
        throw new Error('Failed to create trait');
    }

    return response.json();
}

/**
 * Delete a trait.
 */
export async function deleteTrait(sessionId: string, traitName: string): Promise<void> {
    const response = await fetch(`${API_BASE}/api/voice-ingest/${sessionId}/traits/${encodeURIComponent(traitName)}`, {
        method: 'DELETE',
    });

    if (!response.ok) {
        throw new Error('Failed to delete trait');
    }
}

/**
 * Add an interview stage.
 */
export async function createInterviewStage(
    sessionId: string,
    stage: { name: string; description: string; duration_minutes?: number; interviewer_role?: string; actions?: string[] }
): Promise<{ success: boolean; stage: InterviewStage }> {
    const response = await fetch(`${API_BASE}/api/voice-ingest/${sessionId}/interview-stages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(stage),
    });

    if (!response.ok) {
        throw new Error('Failed to create interview stage');
    }

    return response.json();
}

/**
 * Delete an interview stage.
 */
export async function deleteInterviewStage(sessionId: string, stageName: string): Promise<void> {
    const response = await fetch(`${API_BASE}/api/voice-ingest/${sessionId}/interview-stages/${encodeURIComponent(stageName)}`, {
        method: 'DELETE',
    });

    if (!response.ok) {
        throw new Error('Failed to delete interview stage');
    }
}

/**
 * Get a LiveKit token for voice session (DEPRECATED - use createVapiCall instead).
 */
export async function getVoiceToken(sessionId: string): Promise<VoiceTokenResponse> {
    const response = await fetch(`${API_BASE}/api/voice-ingest/${sessionId}/voice-token`, {
        method: 'POST',
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to get voice token' }));
        throw new Error(error.detail || 'Failed to get voice token');
    }

    return response.json();
}

/**
 * Create a Vapi call for voice session.
 * This is the preferred method for voice sessions.
 */
export async function createVapiCall(sessionId: string): Promise<VapiCallResponse> {
    const response = await fetch(`${API_BASE}/api/voice-ingest/${sessionId}/vapi-call`, {
        method: 'POST',
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to create Vapi call' }));
        throw new Error(error.detail || 'Failed to create Vapi call');
    }

    return response.json();
}

/**
 * Mark the profile as complete.
 */
export async function markComplete(sessionId: string): Promise<{ success: boolean; message: string }> {
    const response = await fetch(`${API_BASE}/api/voice-ingest/${sessionId}/complete`, {
        method: 'POST',
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Profile is not complete' }));
        throw new Error(error.detail || 'Profile is not complete');
    }

    return response.json();
}

/**
 * Get generated job description from the profile.
 */
export async function getJobDescription(sessionId: string): Promise<{ job_description: string; is_complete: boolean }> {
    const response = await fetch(`${API_BASE}/api/voice-ingest/${sessionId}/job-description`);

    if (!response.ok) {
        throw new Error('Session not found');
    }

    return response.json();
}

// =============================================================================
// WebSocket Helper
// =============================================================================

/**
 * Create a WebSocket connection for real-time profile updates.
 */
export function createWebSocketConnection(
    sessionId: string,
    handlers: {
        onMessage: (message: WebSocketMessage) => void;
        onOpen?: () => void;
        onClose?: () => void;
        onError?: (error: Event) => void;
    }
): WebSocket {
    const wsUrl = `${API_BASE.replace('http', 'ws')}/api/voice-ingest/ws/${sessionId}`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
        console.log('[WebSocket] Connected to session:', sessionId);
        handlers.onOpen?.();
    };

    ws.onmessage = (event) => {
        try {
            const message: WebSocketMessage = JSON.parse(event.data);
            handlers.onMessage(message);
        } catch (e) {
            // Handle non-JSON messages (like pong)
            if (event.data === 'pong') {
                return;
            }
            console.warn('[WebSocket] Failed to parse message:', event.data);
        }
    };

    ws.onclose = () => {
        console.log('[WebSocket] Disconnected from session:', sessionId);
        handlers.onClose?.();
    };

    ws.onerror = (error) => {
        console.error('[WebSocket] Error:', error);
        handlers.onError?.(error);
    };

    return ws;
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Format location for display.
 */
export function formatLocation(requirements: HardRequirements): string {
    if (!requirements.location_type) return 'Not set';

    const type = requirements.location_type.replace('_', ' ');
    const city = requirements.location_city;

    if (requirements.location_type === 'remote') {
        return 'Remote';
    }

    if (requirements.location_type === 'hybrid') {
        const days = requirements.onsite_days_per_week;
        const daysStr = days ? ` (${days} days/week)` : '';
        return city ? `${city} - Hybrid${daysStr}` : `Hybrid${daysStr}`;
    }

    return city ? `${city} - On-site` : 'On-site';
}

/**
 * Format compensation for display.
 */
export function formatCompensation(requirements: HardRequirements): string {
    if (!requirements.salary_min) return 'Not set';

    const min = requirements.salary_min.toLocaleString();
    const max = requirements.salary_max?.toLocaleString();

    let comp = max ? `$${min} - $${max}` : `$${min}+`;

    if (requirements.equity_offered) {
        comp += ' + Equity';
        if (requirements.equity_range) {
            comp += ` (${requirements.equity_range})`;
        }
    }

    return comp;
}

/**
 * Format experience for display.
 */
export function formatExperience(requirements: HardRequirements): string {
    if (requirements.experience_min_years === undefined) return 'Not set';

    const min = requirements.experience_min_years;
    const max = requirements.experience_max_years;

    if (max) {
        return `${min}-${max} years`;
    }

    return `${min}+ years`;
}

/**
 * Get priority badge color.
 */
export function getPriorityColor(priority: string): string {
    switch (priority) {
        case 'must_have':
            return 'bg-red-500/20 text-red-300 border-red-500/30';
        case 'strong_preference':
            return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30';
        case 'nice_to_have':
            return 'bg-green-500/20 text-green-300 border-green-500/30';
        default:
            return 'bg-gray-500/20 text-gray-300 border-gray-500/30';
    }
}

// =============================================================================
// Profile Listing (for candidate upload integration)
// =============================================================================

export interface ProfileSummary {
    id: string;
    job_title?: string;
    company_name?: string;
    location?: string;
    experience_range: string;
    traits_count: number;
    must_have_count: number;
    interview_stages_count: number;
    completion_percentage: number;
    is_complete: boolean;
    created_at?: string;
}

export interface ProfileListResponse {
    profiles: ProfileSummary[];
    total: number;
}

/**
 * List available job profiles.
 * Use this to populate the profile selector in the candidate upload flow.
 */
export async function listProfiles(completeOnly: boolean = false): Promise<ProfileListResponse> {
    const params = new URLSearchParams();
    if (completeOnly) params.set('complete_only', 'true');

    const response = await fetch(`${API_BASE}/api/voice-ingest/profiles?${params.toString()}`);

    if (!response.ok) {
        throw new Error('Failed to fetch profiles');
    }

    return response.json();
}

/**
 * Format priority for display.
 */
export function formatPriority(priority: string): string {
    switch (priority) {
        case 'must_have':
            return 'Must Have';
        case 'strong_preference':
            return 'Strong Preference';
        case 'nice_to_have':
            return 'Nice to Have';
        default:
            return priority.replace(/_/g, ' ');
    }
}
