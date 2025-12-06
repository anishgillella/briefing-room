"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface JoinScreenProps {
    roomName?: string;
    onJoin: (data: {
        participantName: string;
        participantType: "interviewer" | "candidate";
        jobDescription?: string;
        candidateResume?: string;
    }) => void;
    isLoading?: boolean;
}

export default function JoinScreen({ roomName, onJoin, isLoading }: JoinScreenProps) {
    const [name, setName] = useState("");
    const [participantType, setParticipantType] = useState<"interviewer" | "candidate">("interviewer");
    const [jobDescription, setJobDescription] = useState("");
    const [candidateResume, setCandidateResume] = useState("");

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (name.trim()) {
            onJoin({
                participantName: name.trim(),
                participantType,
                jobDescription: jobDescription.trim() || undefined,
                candidateResume: candidateResume.trim() || undefined,
            });
        }
    };

    const isInterviewer = participantType === "interviewer";

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
            <Card className={`w-full ${isInterviewer ? "max-w-2xl" : "max-w-md"}`}>
                <CardHeader className="text-center">
                    <CardTitle className="text-2xl font-bold">
                        {roomName ? "Join Interview" : "Start Interview"}
                    </CardTitle>
                    <CardDescription>
                        {roomName
                            ? `Joining room: ${roomName}`
                            : isInterviewer
                                ? "Set up your interview session"
                                : "Enter your details to join"
                        }
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Name and Role Selection */}
                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="name">Your Name</Label>
                                <Input
                                    id="name"
                                    type="text"
                                    placeholder="Enter your name"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    required
                                    autoFocus
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Join as</Label>
                                <div className="grid grid-cols-2 gap-2">
                                    <Button
                                        type="button"
                                        variant={participantType === "interviewer" ? "default" : "outline"}
                                        onClick={() => setParticipantType("interviewer")}
                                        className="w-full"
                                    >
                                        👔 Interviewer
                                    </Button>
                                    <Button
                                        type="button"
                                        variant={participantType === "candidate" ? "default" : "outline"}
                                        onClick={() => setParticipantType("candidate")}
                                        className="w-full"
                                    >
                                        🎯 Candidate
                                    </Button>
                                </div>
                            </div>
                        </div>

                        {/* Job Description & Resume - Only for Interviewers */}
                        {isInterviewer && (
                            <div className="space-y-4 pt-4 border-t">
                                <div className="text-center">
                                    <h3 className="font-medium text-sm text-muted-foreground">
                                        📋 Prepare your AI briefing assistant (optional)
                                    </h3>
                                </div>

                                <div className="grid gap-4 md:grid-cols-2">
                                    <div className="space-y-2">
                                        <Label htmlFor="jobDescription">Job Description</Label>
                                        <Textarea
                                            id="jobDescription"
                                            placeholder="Paste the job description here..."
                                            value={jobDescription}
                                            onChange={(e) => setJobDescription(e.target.value)}
                                            className="min-h-[120px] resize-none"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="candidateResume">Candidate Resume / Notes</Label>
                                        <Textarea
                                            id="candidateResume"
                                            placeholder="Paste candidate info, resume summary, or notes..."
                                            value={candidateResume}
                                            onChange={(e) => setCandidateResume(e.target.value)}
                                            className="min-h-[120px] resize-none"
                                        />
                                    </div>
                                </div>

                                <p className="text-xs text-center text-muted-foreground">
                                    💡 The AI briefing assistant will use this to help prepare you for the interview
                                </p>
                            </div>
                        )}

                        <Button
                            type="submit"
                            className="w-full"
                            size="lg"
                            disabled={!name.trim() || isLoading}
                        >
                            {isLoading ? (
                                <>
                                    <span className="animate-spin mr-2">⏳</span>
                                    {isInterviewer ? "Setting up..." : "Joining..."}
                                </>
                            ) : (
                                isInterviewer ? "Start Interview Session" : "Join Room"
                            )}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
