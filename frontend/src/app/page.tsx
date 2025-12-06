"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import JoinScreen from "@/components/join-screen";
import { createRoom, joinRoom } from "@/lib/api";

// Dynamic import to avoid SSR issues with Daily
const VideoRoom = dynamic(() => import("@/components/video-room"), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-pulse text-muted-foreground">Loading video room...</div>
    </div>
  ),
});

interface RoomState {
  token: string;
  roomUrl: string;
  roomName: string;
  participantType: "interviewer" | "candidate";
  participantName: string;
}

export default function Home() {
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleJoin = async (data: {
    participantName: string;
    participantType: "interviewer" | "candidate";
  }) => {
    setIsLoading(true);
    setError(null);

    try {
      // Create a new room
      const room = await createRoom(data.participantName);

      // If candidate, get a separate token (interviewer token is already in room response)
      let token = room.interviewer_token;
      if (data.participantType === "candidate") {
        const joinResponse = await joinRoom(room.room_name, data.participantName, "candidate");
        token = joinResponse.token;
      }

      // Set room state to show video room
      setRoomState({
        token,
        roomUrl: room.room_url,
        roomName: room.room_name,
        participantType: data.participantType,
        participantName: data.participantName,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create room");
      setIsLoading(false);
    }
  };

  const handleLeave = () => {
    setRoomState(null);
  };

  // If we have room state, show the video room
  if (roomState) {
    return (
      <main className="h-screen flex flex-col">
        {/* Room info bar */}
        <div className="bg-muted px-4 py-2 flex justify-between items-center text-sm">
          <span className="text-muted-foreground">
            Room: <span className="font-mono text-foreground">{roomState.roomName}</span>
          </span>
          <span className="text-muted-foreground">
            Share link: <span className="font-mono text-foreground select-all">
              {typeof window !== "undefined" ? `${window.location.origin}/room/${roomState.roomName}` : ""}
            </span>
          </span>
        </div>
        <div className="flex-1">
          <VideoRoom
            roomUrl={roomState.roomUrl}
            token={roomState.token}
            participantType={roomState.participantType}
            participantName={roomState.participantName}
            onLeave={handleLeave}
          />
        </div>
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
      <JoinScreen onJoin={handleJoin} isLoading={isLoading} />
    </main>
  );
}
