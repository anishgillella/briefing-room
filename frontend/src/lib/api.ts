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

