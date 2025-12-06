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
