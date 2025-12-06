"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import JoinScreen from "@/components/join-screen";
import { createRoom, joinRoom, setBriefing } from "@/lib/api";

// Dynamic imports to avoid SSR issues
const VideoRoom = dynamic(() => import("@/components/video-room"), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-pulse text-muted-foreground">Loading video room...</div>
    </div>
  ),
});

const PreBriefingScreen = dynamic(() => import("@/components/pre-briefing-screen"), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-violet-950 via-slate-900 to-slate-950">
      <div className="animate-pulse text-white/60">Loading briefing assistant...</div>
    </div>
  ),
});

type AppPhase = "join" | "briefing" | "interview";

interface RoomState {
  token: string;
  roomUrl: string;
  roomName: string;
  participantType: "interviewer" | "candidate";
  participantName: string;
}

export default function Home() {
  const [phase, setPhase] = useState<AppPhase>("join");
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleJoin = async (data: {
    participantName: string;
    participantType: "interviewer" | "candidate";
    jobDescription?: string;
    candidateResume?: string;
  }) => {
    setIsLoading(true);
    setError(null);

    try {
      // Create a new room
      const room = await createRoom(data.participantName);

      // If interviewer and has JD/resume, store briefing data
      if (data.participantType === "interviewer" && (data.jobDescription || data.candidateResume)) {
        try {
          await setBriefing(room.room_name, {
            candidate_name: "the candidate",
            role: data.jobDescription ? "See job description" : undefined,
            resume_summary: data.candidateResume,
            notes: data.jobDescription,
          });
        } catch (briefingErr) {
          console.error("Failed to store briefing:", briefingErr);
          // Non-fatal, continue
        }
      }

      // If candidate, get a separate token (interviewer token is already in room response)
      let token = room.interviewer_token;
      if (data.participantType === "candidate") {
        const joinResponse = await joinRoom(room.room_name, data.participantName, "candidate");
        token = joinResponse.token;
      }

      // Set room state
      setRoomState({
        token,
        roomUrl: room.room_url,
        roomName: room.room_name,
        participantType: data.participantType,
        participantName: data.participantName,
      });

      // If interviewer, go to briefing first. If candidate, go directly to interview.
      if (data.participantType === "interviewer") {
        setPhase("briefing");
      } else {
        setPhase("interview");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create room");
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartInterview = () => {
    // Transition from briefing to interview
    setPhase("interview");
  };

  const handleLeave = () => {
    setRoomState(null);
    setPhase("join");
  };

  // Phase: Pre-Interview Briefing (interviewer only)
  if (phase === "briefing" && roomState) {
    return (
      <PreBriefingScreen
        roomName={roomState.roomName}
        participantName={roomState.participantName}
        onStartInterview={handleStartInterview}
      />
    );
  }

  // Phase: Interview (video room)
  if (phase === "interview" && roomState) {
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
            roomName={roomState.roomName}
            token={roomState.token}
            participantType={roomState.participantType}
            participantName={roomState.participantName}
            onLeave={handleLeave}
          />
        </div>
      </main>
    );
  }

  // Phase: Join screen
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
