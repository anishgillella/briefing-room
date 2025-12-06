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
    notes?: string
): Promise<DebriefResponse> {
    const response = await fetch(`${API_BASE_URL}/api/rooms/${roomName}/debrief`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            chat_history: chatHistory,
            notes: notes,
        }),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Failed to generate debrief");
    }

    return response.json();
}
