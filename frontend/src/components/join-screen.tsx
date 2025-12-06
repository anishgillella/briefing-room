"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface JoinScreenProps {
    roomName?: string;
    onJoin: (data: {
        participantName: string;
        participantType: "interviewer" | "candidate";
    }) => void;
    isLoading?: boolean;
}

export default function JoinScreen({ roomName, onJoin, isLoading }: JoinScreenProps) {
    const [name, setName] = useState("");
    const [participantType, setParticipantType] = useState<"interviewer" | "candidate">("interviewer");

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (name.trim()) {
            onJoin({
                participantName: name.trim(),
                participantType,
            });
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
            <Card className="w-full max-w-md">
                <CardHeader className="text-center">
                    <CardTitle className="text-2xl font-bold">
                        Join Interview
                    </CardTitle>
                    <CardDescription>
                        {roomName
                            ? `Joining room: ${roomName}`
                            : "Enter your details to start"
                        }
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-6">
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

                        <Button
                            type="submit"
                            className="w-full"
                            size="lg"
                            disabled={!name.trim() || isLoading}
                        >
                            {isLoading ? (
                                <>
                                    <span className="animate-spin mr-2">⏳</span>
                                    Joining...
                                </>
                            ) : (
                                "Join Room"
                            )}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
