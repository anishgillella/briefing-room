"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import JoinScreen from "@/components/join-screen";
import { joinRoom, getRoom } from "@/lib/api";

// Dynamic import to avoid SSR issues with Daily
// Dynamic import to avoid SSR issues with Daily
const VideoRoom = dynamic(() => import("@/components/video-room"), {
    ssr: false,
    loading: () => (
        <div className="min-h-screen flex items-center justify-center">
            <div className="animate-pulse text-muted-foreground">Loading video room...</div>
        </div>
    ),
});

const DebriefScreen = dynamic(() => import("@/components/debrief-screen"), {
    loading: () => null,
});

interface RoomState {
    token: string;
    roomUrl: string;
    participantType: "interviewer" | "candidate";
    participantName: string;
}

export default function RoomPage() {
    const params = useParams();
    const router = useRouter();
    const roomName = params.name as string;

    const [roomState, setRoomState] = useState<RoomState | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [roomExists, setRoomExists] = useState<boolean | null>(null);
    const [showDebrief, setShowDebrief] = useState(false);
    const [finalTranscript, setFinalTranscript] = useState<string | undefined>(undefined);

    // Check if room exists
    useEffect(() => {
        getRoom(roomName)
            .then(() => setRoomExists(true))
            .catch(() => setRoomExists(false));
    }, [roomName]);

    const handleJoin = async (data: {
        participantName: string;
        participantType: "interviewer" | "candidate";
    }) => {
        setIsLoading(true);
        setError(null);

        try {
            const response = await joinRoom(roomName, data.participantName, data.participantType);

            // Store session data
            sessionStorage.setItem(`room_${roomName}_token`, response.token);
            sessionStorage.setItem(`room_${roomName}_type`, data.participantType);
            sessionStorage.setItem(`room_${roomName}_name`, data.participantName);
            sessionStorage.setItem(`room_${roomName}_url`, response.room_url);

            setRoomState({
                token: response.token,
                roomUrl: response.room_url,
                participantType: data.participantType,
                participantName: data.participantName,
            });
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to join room");
        } finally {
            setIsLoading(false);
        }
    };

    const handleLeave = () => {
        // Clear session data
        sessionStorage.removeItem(`room_${roomName}_token`);
        sessionStorage.removeItem(`room_${roomName}_type`);
        sessionStorage.removeItem(`room_${roomName}_name`);
        sessionStorage.removeItem(`room_${roomName}_url`);

        router.push("/");
    };

    const handleEndInterview = (transcript?: string) => {
        // Transition to debrief screen
        setFinalTranscript(transcript);
        setShowDebrief(true);
    };

    // Show error if room doesn't exist
    if (roomExists === false) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center space-y-4">
                    <h1 className="text-2xl font-bold text-destructive">Room Not Found</h1>
                    <p className="text-muted-foreground">The room "{roomName}" does not exist or has expired.</p>
                    <button
                        onClick={() => router.push("/")}
                        className="text-primary underline"
                    >
                        Create a new room
                    </button>
                </div>
            </div>
        );
    }

    // Show Debrief Screen
    if (showDebrief) {
        return (
            <main className="min-h-screen bg-background text-foreground">
                <DebriefScreen
                    roomName={roomName}
                    transcript={finalTranscript}
                    onClose={handleLeave}
                />
            </main>
        );
    }

    // If we have room state, show the video room
    if (roomState) {
        return (
            <main className="h-screen overflow-hidden">
                <VideoRoom
                    roomUrl={roomState.roomUrl}
                    roomName={roomName}
                    token={roomState.token}
                    participantType={roomState.participantType}
                    participantName={roomState.participantName}
                    onLeave={handleLeave}
                    onEndInterview={handleEndInterview}
                />
            </main>
        );
    }

    // Show join screen
    return (
        <main className="min-h-screen">
            {error && (
                <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-destructive text-destructive-foreground px-4 py-2 rounded-md z-50">
                    {error}
                </div>
            )}
            <JoinScreen
                roomName={roomName}
                onJoin={handleJoin}
                isLoading={isLoading}
            />
        </main>
    );
}

