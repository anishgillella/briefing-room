"use client";

import { useCallback, useState, useEffect } from "react";
import {
    DailyProvider,
    useDaily,
    useLocalSessionId,
    useParticipantIds,
    useVideoTrack,
    useAudioTrack,
    DailyVideo,
    useDailyEvent,
} from "@daily-co/daily-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface VideoRoomProps {
    roomUrl: string;
    token: string;
    participantType: "interviewer" | "candidate";
    participantName: string;
    onLeave?: () => void;
}

function VideoTile({ sessionId, isLocal, label }: { sessionId: string; isLocal: boolean; label: string }) {
    const videoState = useVideoTrack(sessionId);
    const audioState = useAudioTrack(sessionId);

    return (
        <Card className={`relative overflow-hidden ${isLocal ? "col-span-1" : "col-span-2"}`}>
            <CardContent className="p-0 aspect-video bg-muted flex items-center justify-center">
                {videoState.isOff ? (
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
                            <span className="text-2xl">{label[0]?.toUpperCase()}</span>
                        </div>
                        <span>Camera off</span>
                    </div>
                ) : (
                    <DailyVideo
                        sessionId={sessionId}
                        type="video"
                        automirror
                        className="w-full h-full object-cover"
                    />
                )}

                {/* Label overlay */}
                <div className="absolute bottom-2 left-2 bg-black/60 text-white px-2 py-1 rounded text-sm flex items-center gap-2">
                    <span>{label}</span>
                    {isLocal && <span className="text-xs opacity-70">(You)</span>}
                    {audioState.isOff && (
                        <span className="text-red-400">🔇</span>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}

// Simulated candidate tile with random avatar
function SimulatedCandidateTile({ onRemove }: { onRemove: () => void }) {
    const randomId = useState(() => Math.floor(Math.random() * 70) + 1)[0];

    return (
        <Card className="relative overflow-hidden col-span-1">
            <CardContent className="p-0 aspect-video bg-muted flex items-center justify-center">
                {/* Random avatar from UI Faces */}
                <img
                    src={`https://i.pravatar.cc/400?img=${randomId}`}
                    alt="Simulated Candidate"
                    className="w-full h-full object-cover"
                />

                {/* Label overlay */}
                <div className="absolute bottom-2 left-2 bg-black/60 text-white px-2 py-1 rounded text-sm flex items-center gap-2">
                    <span>Candidate (Simulated)</span>
                </div>

                {/* Remove button */}
                <button
                    onClick={onRemove}
                    className="absolute top-2 right-2 bg-red-500/80 text-white px-2 py-1 rounded text-xs hover:bg-red-600"
                >
                    ✕ Remove
                </button>
            </CardContent>
        </Card>
    );
}

function CallInterface({ roomUrl, token, participantType, participantName, onLeave }: {
    roomUrl: string;
    token: string;
    participantType: "interviewer" | "candidate";
    participantName: string;
    onLeave?: () => void;
}) {
    const daily = useDaily();
    const localSessionId = useLocalSessionId();
    const participantIds = useParticipantIds({ filter: "remote" });

    const [isCameraOn, setIsCameraOn] = useState(true);
    const [isMicOn, setIsMicOn] = useState(true);
    const [isJoining, setIsJoining] = useState(true);
    const [hasJoined, setHasJoined] = useState(false);
    const [showSimulatedCandidate, setShowSimulatedCandidate] = useState(false);

    // Join the call when component mounts
    useEffect(() => {
        if (!daily || hasJoined) return;

        const joinCall = async () => {
            try {
                setIsJoining(true);
                await daily.join({
                    url: roomUrl,
                    token: token,
                    userName: participantName,
                    startVideoOff: false,
                    startAudioOff: false,
                });
                setHasJoined(true);
            } catch (error) {
                console.error("Failed to join call:", error);
            } finally {
                setIsJoining(false);
            }
        };

        joinCall();
    }, [daily, roomUrl, token, participantName, hasJoined]);

    // Handle left-meeting event
    useDailyEvent("left-meeting", () => {
        setHasJoined(false);
        onLeave?.();
    });

    const toggleCamera = useCallback(() => {
        if (daily) {
            daily.setLocalVideo(!isCameraOn);
            setIsCameraOn(!isCameraOn);
        }
    }, [daily, isCameraOn]);

    const toggleMic = useCallback(() => {
        if (daily) {
            daily.setLocalAudio(!isMicOn);
            setIsMicOn(!isMicOn);
        }
    }, [daily, isMicOn]);

    const leaveCall = useCallback(() => {
        if (daily) {
            daily.leave();
        }
    }, [daily]);

    // Show loading while joining
    if (isJoining) {
        return (
            <div className="flex flex-col h-full items-center justify-center">
                <div className="animate-spin text-4xl mb-4">⏳</div>
                <p className="text-muted-foreground">Joining call...</p>
            </div>
        );
    }

    const hasRemoteParticipants = participantIds.length > 0 || showSimulatedCandidate;

    return (
        <div className="flex flex-col h-full">
            {/* Video grid */}
            <div className="flex-1 p-4 grid grid-cols-2 gap-4 auto-rows-fr">
                {localSessionId && (
                    <VideoTile
                        sessionId={localSessionId}
                        isLocal={true}
                        label={`${participantName} (${participantType})`}
                    />
                )}

                {participantIds.map((id) => (
                    <VideoTile
                        key={id}
                        sessionId={id}
                        isLocal={false}
                        label="Participant"
                    />
                ))}

                {/* Simulated candidate */}
                {showSimulatedCandidate && (
                    <SimulatedCandidateTile onRemove={() => setShowSimulatedCandidate(false)} />
                )}

                {/* Waiting placeholder - only show if no remote participants */}
                {!hasRemoteParticipants && (
                    <Card className="col-span-1 bg-muted/50">
                        <CardContent className="h-full flex flex-col items-center justify-center p-4 gap-4">
                            <p className="text-muted-foreground text-center">
                                Waiting for {participantType === "interviewer" ? "candidate" : "interviewer"} to join...
                            </p>
                            {participantType === "interviewer" && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setShowSimulatedCandidate(true)}
                                >
                                    🎭 Simulate Candidate
                                </Button>
                            )}
                        </CardContent>
                    </Card>
                )}
            </div>

            {/* Controls */}
            <div className="p-4 border-t bg-card">
                <div className="flex justify-center gap-4">
                    <Button
                        variant={isCameraOn ? "secondary" : "destructive"}
                        size="lg"
                        onClick={toggleCamera}
                    >
                        {isCameraOn ? "📹" : "📷"} Camera
                    </Button>

                    <Button
                        variant={isMicOn ? "secondary" : "destructive"}
                        size="lg"
                        onClick={toggleMic}
                    >
                        {isMicOn ? "🎙️" : "🔇"} Mic
                    </Button>

                    <Button
                        variant="destructive"
                        size="lg"
                        onClick={leaveCall}
                    >
                        Leave Call
                    </Button>
                </div>
            </div>
        </div>
    );
}

export default function VideoRoom({ roomUrl, token, participantType, participantName, onLeave }: VideoRoomProps) {
    return (
        <DailyProvider>
            <CallInterface
                roomUrl={roomUrl}
                token={token}
                participantType={participantType}
                participantName={participantName}
                onLeave={onLeave}
            />
        </DailyProvider>
    );
}
