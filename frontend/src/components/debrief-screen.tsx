"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
    generateDebrief,
    DebriefResponse,
    getInterviewAnalytics,
    InterviewAnalytics,
    QuestionAnswer,
    getBriefing
} from "@/lib/api";

interface DebriefScreenProps {
    roomName: string;
    transcript?: string;
    onClose: () => void;
}

export default function DebriefScreen({ roomName, transcript, onClose }: DebriefScreenProps) {
    const [data, setData] = useState<DebriefResponse | null>(null);
    const [analytics, setAnalytics] = useState<InterviewAnalytics | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [analyticsLoading, setAnalyticsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showTranscript, setShowTranscript] = useState(false);
    const [expandedQA, setExpandedQA] = useState<number | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                // Fetch debrief (existing functionality)
                const result = await generateDebrief(roomName, [], undefined, transcript);
                setData(result);

                // If we have transcript, also fetch analytics
                if (transcript && transcript.length > 100) {
                    setAnalyticsLoading(true);
                    try {
                        // Get briefing context for better analysis
                        const briefing = await getBriefing(roomName);
                        const analyticsResult = await getInterviewAnalytics(
                            roomName,
                            transcript,
                            briefing?.role || undefined,
                            briefing?.resume_summary || undefined
                        );
                        setAnalytics(analyticsResult);
                    } catch (analyticsErr) {
                        console.error("Analytics failed:", analyticsErr);
                        // Don't fail the whole debrief if analytics fails
                    } finally {
                        setAnalyticsLoading(false);
                    }
                }
            } catch (err) {
                console.error("Debrief failed:", err);
                setError("Failed to generate debrief. Please try again.");
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [roomName, transcript]);

    const getScoreColor = (score: number) => {
        if (score >= 8) return "text-green-600 dark:text-green-400";
        if (score >= 6) return "text-yellow-600 dark:text-yellow-400";
        return "text-red-600 dark:text-red-400";
    };

    const getRecColor = (rec: string) => {
        const r = rec.toLowerCase();
        if (r.includes("strong hire")) return "bg-green-600 hover:bg-green-700";
        if (r.includes("no hire")) return "bg-red-600 hover:bg-red-700";
        if (r.includes("hire")) return "bg-green-500 hover:bg-green-600";
        return "bg-yellow-500 hover:bg-yellow-600";
    };

    const getTypeColor = (type: string) => {
        switch (type) {
            case "technical": return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
            case "behavioral": return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200";
            case "situational": return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200";
            default: return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200";
        }
    };

    if (isLoading) {
        return (
            <div className="h-full flex flex-col items-center justify-center space-y-4 animate-in fade-in bg-background p-8">
                <div className="animate-spin text-4xl">🤖</div>
                <h2 className="text-xl font-medium">Generating interview debrief...</h2>
                <p className="text-muted-foreground text-center max-w-md">
                    The AI is analyzing the interview to provide detailed insights.
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

    const exportMarkdown = () => {
        let md = `# Interview Debrief\n\n`;
        md += `**Candidate:** ${data.original_briefing?.candidate_name || "Unknown"}\n`;
        md += `**Role:** ${data.original_briefing?.role || "Unknown"}\n`;
        md += `**Date:** ${new Date().toLocaleDateString()}\n\n`;
        md += `## Recommendation: ${data.recommendation}\n\n`;
        md += `## Summary\n${data.summary}\n\n`;

        if (analytics) {
            md += `## Overall Scores\n`;
            md += `- Overall: ${analytics.overall.overall_score}/100\n`;
            md += `- Communication: ${analytics.overall.communication_score}/10\n`;
            md += `- Technical: ${analytics.overall.technical_score}/10\n\n`;

            md += `## Question Analysis (${analytics.qa_pairs.length} Q&As)\n\n`;
            analytics.qa_pairs.forEach((qa, i) => {
                md += `### Q${i + 1}: ${qa.question}\n`;
                md += `**Type:** ${qa.question_type}\n`;
                md += `**Scores:** Relevance: ${qa.metrics.relevance}/10, Clarity: ${qa.metrics.clarity}/10, Depth: ${qa.metrics.depth}/10\n`;
                md += `**Answer:** ${qa.answer}\n\n`;
            });
        }

        if (transcript) {
            md += `## Full Transcript\n\`\`\`\n${transcript}\n\`\`\`\n`;
        }

        const blob = new Blob([md], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `debrief-${roomName}-${Date.now()}.md`;
        a.click();
    };

    return (
        <div className="container mx-auto max-w-5xl py-8 px-4 space-y-8 animate-in slide-in-from-bottom-4 duration-500">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Interview Debrief</h1>
                    <p className="text-muted-foreground mt-1">
                        {data.original_briefing?.candidate_name || "Candidate"} • {data.original_briefing?.role || "Role"}
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={exportMarkdown}>📥 Export</Button>
                    <Button onClick={onClose}>Done</Button>
                </div>
            </div>

            {/* Overall Score Card - Only if analytics available */}
            {analytics && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Card className="bg-gradient-to-br from-violet-500 to-purple-600 text-white border-0">
                        <CardContent className="p-6 text-center">
                            <div className="text-4xl font-bold">{analytics.overall.overall_score}</div>
                            <div className="text-sm opacity-80">Overall Score</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="p-6 text-center">
                            <div className={`text-3xl font-bold ${getScoreColor(analytics.overall.communication_score)}`}>
                                {analytics.overall.communication_score.toFixed(1)}
                            </div>
                            <div className="text-sm text-muted-foreground">Communication</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="p-6 text-center">
                            <div className={`text-3xl font-bold ${getScoreColor(analytics.overall.technical_score)}`}>
                                {analytics.overall.technical_score.toFixed(1)}
                            </div>
                            <div className="text-sm text-muted-foreground">Technical</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="p-6 text-center">
                            <div className={`text-3xl font-bold ${getScoreColor(analytics.overall.cultural_fit_score)}`}>
                                {analytics.overall.cultural_fit_score.toFixed(1)}
                            </div>
                            <div className="text-sm text-muted-foreground">Cultural Fit</div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Recommendation Banner */}
            <Card className={`${analytics ? getRecColor(analytics.overall.recommendation) : getRecColor(data.recommendation)} text-white border-0`}>
                <CardContent className="flex items-center justify-between p-6">
                    <div className="flex-1">
                        <h3 className="text-lg font-medium opacity-90">AI Recommendation</h3>
                        <p className="text-3xl font-bold">{analytics?.overall.recommendation || data.recommendation}</p>
                        {analytics?.overall.recommendation_reasoning && (
                            <p className="text-sm opacity-90 mt-2 max-w-xl">
                                💡 {analytics.overall.recommendation_reasoning}
                            </p>
                        )}
                        {analytics && (
                            <p className="text-sm opacity-75 mt-1">Confidence: {analytics.overall.confidence}%</p>
                        )}
                    </div>
                    <div className="text-4xl opacity-50">
                        {(analytics?.overall.recommendation || data.recommendation).toLowerCase().includes("no") ? "🚫" : "✅"}
                    </div>
                </CardContent>
            </Card>

            {/* Analytics Loading */}
            {analyticsLoading && (
                <Card className="border-dashed">
                    <CardContent className="flex items-center justify-center p-8 gap-3">
                        <div className="animate-spin text-2xl">🔍</div>
                        <span className="text-muted-foreground">Analyzing Q&A pairs with Gemini...</span>
                    </CardContent>
                </Card>
            )}

            {/* TL;DR Highlights Section */}
            {analytics?.highlights && (
                <Card className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border-amber-200 dark:border-amber-800">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            ⚡ TL;DR - Interview Highlights
                        </CardTitle>
                        <CardDescription>Key moments from the interview at a glance</CardDescription>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Best Answer */}
                        <div className="bg-green-50 dark:bg-green-950/30 p-4 rounded-lg border border-green-200 dark:border-green-800">
                            <div className="flex items-center gap-2 mb-2">
                                <span className="text-xl">🌟</span>
                                <span className="font-semibold text-green-800 dark:text-green-300">Best Answer</span>
                            </div>
                            <p className="text-sm italic text-green-900 dark:text-green-200 mb-2">
                                "{analytics.highlights.best_answer.quote}"
                            </p>
                            <p className="text-xs text-green-700 dark:text-green-400">
                                {analytics.highlights.best_answer.context}
                            </p>
                        </div>

                        {/* Red Flag (if any) */}
                        {analytics.highlights.red_flag && (
                            <div className="bg-red-50 dark:bg-red-950/30 p-4 rounded-lg border border-red-200 dark:border-red-800">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="text-xl">🚩</span>
                                    <span className="font-semibold text-red-800 dark:text-red-300">Red Flag</span>
                                </div>
                                <p className="text-sm italic text-red-900 dark:text-red-200 mb-2">
                                    "{analytics.highlights.red_flag.quote}"
                                </p>
                                <p className="text-xs text-red-700 dark:text-red-400">
                                    {analytics.highlights.red_flag.context}
                                </p>
                            </div>
                        )}

                        {/* Quotable Moment */}
                        <div className="bg-blue-50 dark:bg-blue-950/30 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                            <div className="flex items-center gap-2 mb-2">
                                <span className="text-xl">💬</span>
                                <span className="font-semibold text-blue-800 dark:text-blue-300">Quotable Moment</span>
                            </div>
                            <p className="text-sm italic text-blue-900 dark:text-blue-200">
                                "{analytics.highlights.quotable_moment}"
                            </p>
                        </div>

                        {/* Areas to Probe */}
                        {analytics.highlights.areas_to_probe.length > 0 && (
                            <div className="bg-purple-50 dark:bg-purple-950/30 p-4 rounded-lg border border-purple-200 dark:border-purple-800">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="text-xl">🔍</span>
                                    <span className="font-semibold text-purple-800 dark:text-purple-300">Areas to Probe</span>
                                </div>
                                <ul className="text-sm text-purple-900 dark:text-purple-200 list-disc list-inside">
                                    {analytics.highlights.areas_to_probe.map((area, i) => (
                                        <li key={i}>{area}</li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Q&A Breakdown */}
            {analytics && analytics.qa_pairs.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            📊 Question Analysis
                            <Badge variant="secondary">{analytics.qa_pairs.length} Q&As</Badge>
                        </CardTitle>
                        <CardDescription>
                            Click any question to expand the full answer
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {analytics.qa_pairs.map((qa, index) => (
                            <div
                                key={index}
                                className="border rounded-lg p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                                onClick={() => setExpandedQA(expandedQA === index ? null : index)}
                            >
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Badge className={getTypeColor(qa.question_type)}>
                                                {qa.question_type}
                                            </Badge>
                                            {qa.highlight && <Badge variant="outline">⭐ Notable</Badge>}
                                        </div>
                                        <p className="font-medium">{qa.question}</p>
                                    </div>
                                    <div className="flex gap-2 text-sm shrink-0">
                                        <div className="text-center px-2">
                                            <div className={`font-bold ${getScoreColor(qa.metrics.relevance)}`}>{qa.metrics.relevance}</div>
                                            <div className="text-xs text-muted-foreground">Rel</div>
                                        </div>
                                        <div className="text-center px-2">
                                            <div className={`font-bold ${getScoreColor(qa.metrics.clarity)}`}>{qa.metrics.clarity}</div>
                                            <div className="text-xs text-muted-foreground">Clr</div>
                                        </div>
                                        <div className="text-center px-2">
                                            <div className={`font-bold ${getScoreColor(qa.metrics.depth)}`}>{qa.metrics.depth}</div>
                                            <div className="text-xs text-muted-foreground">Dpt</div>
                                        </div>
                                        <div className="text-center px-2">
                                            <div className={`font-bold ${getScoreColor(qa.metrics.type_specific_metric)}`}>{qa.metrics.type_specific_metric}</div>
                                            <div className="text-xs text-muted-foreground truncate max-w-[60px]" title={qa.metrics.type_specific_label}>
                                                {qa.metrics.type_specific_label.split(" ")[0]}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                {expandedQA === index && (
                                    <div className="mt-4 pt-4 border-t">
                                        <p className="text-muted-foreground whitespace-pre-wrap">{qa.answer}</p>
                                        {qa.highlight && (
                                            <div className="mt-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg text-sm">
                                                <span className="font-medium">💡 Highlight:</span> {qa.highlight}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                    </CardContent>
                </Card>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Main Summary */}
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
                                    {(analytics?.overall.highlights || data.strengths).map((s, i) => (
                                        <li key={i} className="text-sm">{s}</li>
                                    ))}
                                </ul>
                            </CardContent>
                        </Card>

                        <Card className="bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900">
                            <CardHeader>
                                <CardTitle className="text-amber-700 dark:text-amber-400 text-lg flex items-center gap-2">
                                    ⚠️ Red Flags / Areas to Probe
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <ul className="list-disc list-outside ml-4 space-y-2">
                                    {(analytics?.overall.red_flags.length ? analytics.overall.red_flags : data.improvements).map((s, i) => (
                                        <li key={i} className="text-sm">{s}</li>
                                    ))}
                                </ul>
                            </CardContent>
                        </Card>
                    </div>
                </div>

                {/* Sidebar */}
                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Follow-up Questions</CardTitle>
                            <CardDescription>Suggested for the next round</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ul className="space-y-4">
                                {data.follow_up_questions.map((q, i) => (
                                    <li key={i} className="bg-muted p-3 rounded-lg text-sm italic">
                                        "{q}"
                                    </li>
                                ))}
                            </ul>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Meta</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2 text-sm text-muted-foreground">
                            <div className="flex justify-between">
                                <span>Date</span>
                                <span>{new Date().toLocaleDateString()}</span>
                            </div>
                            <Separator />
                            <div className="flex justify-between">
                                <span>Analysis Model</span>
                                <span>Gemini 2.5 Flash</span>
                            </div>
                            {analytics && (
                                <>
                                    <Separator />
                                    <div className="flex justify-between">
                                        <span>Avg Response</span>
                                        <span>{analytics.overall.avg_response_length} words</span>
                                    </div>
                                </>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Full Transcript Section */}
            {transcript && (
                <Card>
                    <CardHeader
                        className="cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => setShowTranscript(!showTranscript)}
                    >
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-lg">📝 Full Transcript</CardTitle>
                            <Button variant="ghost" size="sm">
                                {showTranscript ? "Collapse ▲" : "Expand ▼"}
                            </Button>
                        </div>
                    </CardHeader>
                    {showTranscript && (
                        <CardContent>
                            <pre className="whitespace-pre-wrap text-sm bg-muted p-4 rounded-lg max-h-96 overflow-y-auto">
                                {transcript}
                            </pre>
                        </CardContent>
                    )}
                </Card>
            )}
        </div>
    );
}
