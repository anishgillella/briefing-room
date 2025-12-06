"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { generateDebrief, DebriefResponse } from "@/lib/api";
import ReactMarkdown from "react-markdown";

interface DebriefScreenProps {
    roomName: string;
    onClose: () => void;
}

export default function DebriefScreen({ roomName, onClose }: DebriefScreenProps) {
    const [data, setData] = useState<DebriefResponse | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        // Fetch debrief data on mount
        const fetchDebrief = async () => {
            try {
                // In a real app, we'd pass the actual chat history here if we tracked it in frontend state
                // For now, we'll let the backend use what it has stored or generate lightly
                const result = await generateDebrief(roomName, []);
                setData(result);
            } catch (err) {
                console.error("Debrief failed:", err);
                setError("Failed to generate debrief. Please try again.");
            } finally {
                setIsLoading(false);
            }
        };

        fetchDebrief();
    }, [roomName]);

    if (isLoading) {
        return (
            <div className="h-full flex flex-col items-center justify-center space-y-4 animate-in fade-in bg-background p-8">
                <div className="animate-spin text-4xl">🤖</div>
                <h2 className="text-xl font-medium">Generating interview debrief...</h2>
                <p className="text-muted-foreground text-center max-w-md">
                    The AI is analyzing the session context and questions asked to summarize the interview.
                </p>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="h-full flex flex-col items-center justify-center space-y-4 p-8">
                <div className="text-destructive text-4xl">⚠️</div>
                <h2 className="text-xl font-medium">Something went wrong</h2>
                <p className="text-muted-foreground">{error}</p>
                <Button onClick={onClose}>Return to Home</Button>
            </div>
        );
    }

    const getRecColor = (rec: string) => {
        const r = rec.toLowerCase();
        if (r.includes("strong hire")) return "bg-green-600 hover:bg-green-700";
        if (r.includes("no hire")) return "bg-red-600 hover:bg-red-700";
        if (r.includes("hire")) return "bg-green-500 hover:bg-green-600";
        return "bg-yellow-500 hover:bg-yellow-600";
    };

    return (
        <div className="container mx-auto max-w-4xl py-8 px-4 space-y-8 animate-in slide-in-from-bottom-4 duration-500">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Interview Debrief</h1>
                    <p className="text-muted-foreground mt-1">
                        Generated for {data.original_briefing?.candidate_name || "Candidate"} • {data.original_briefing?.role || "Role"}
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => window.print()}>🖨️ Print / Save PDF</Button>
                    <Button onClick={onClose}>Done</Button>
                </div>
            </div>

            {/* Recommendation Banner */}
            <Card className={`${getRecColor(data.recommendation)} text-white border-0`}>
                <CardContent className="flex items-center justify-between p-6">
                    <div>
                        <h3 className="text-lg font-medium opacity-90">AI Recommendation</h3>
                        <p className="text-3xl font-bold">{data.recommendation}</p>
                    </div>
                    <div className="text-4xl opacity-50">
                        {data.recommendation.toLowerCase().includes("no") ? "🚫" : "✅"}
                    </div>
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Main Summary - Left Column */}
                <div className="md:col-span-2 space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Executive Summary</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-lg leading-relaxed">{data.summary}</p>
                        </CardContent>
                    </Card>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Card className="bg-green-50/50 dark:bg-green-950/20 border-green-200 dark:border-green-900">
                            <CardHeader>
                                <CardTitle className="text-green-700 dark:text-green-400 text-lg flex items-center gap-2">
                                    💪 Strengths
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <ul className="list-disc list-outside ml-4 space-y-2">
                                    {data.strengths.map((s, i) => (
                                        <li key={i} className="text-sm">{s}</li>
                                    ))}
                                </ul>
                            </CardContent>
                        </Card>

                        <Card className="bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900">
                            <CardHeader>
                                <CardTitle className="text-amber-700 dark:text-amber-400 text-lg flex items-center gap-2">
                                    📈 Growth Areas
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <ul className="list-disc list-outside ml-4 space-y-2">
                                    {data.improvements.map((s, i) => (
                                        <li key={i} className="text-sm">{s}</li>
                                    ))}
                                </ul>
                            </CardContent>
                        </Card>
                    </div>
                </div>

                {/* Sidebar - Right Column */}
                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Follow-up Questions</CardTitle>
                            <CardDescription>Suggested for the next round</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ul className="space-y-4">
                                {data.follow_up_questions.map((q, i) => (
                                    <li key={i} className="bg-muted p-3 rounded-lg text-sm text-italic">
                                        "{q}"
                                    </li>
                                ))}
                            </ul>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Meta Data</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2 text-sm text-muted-foreground">
                            <div className="flex justify-between">
                                <span>Date</span>
                                <span>{new Date().toLocaleDateString()}</span>
                            </div>
                            <Separator />
                            <div className="flex justify-between">
                                <span>Analysis Model</span>
                                <span>GPT-4o Mini</span>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
