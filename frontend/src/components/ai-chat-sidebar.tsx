"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { getCoachSuggestion, CoachSuggestion } from "@/lib/api";

interface Message {
    role: "user" | "assistant";
    content: string;
}

interface AIChatSidebarProps {
    roomName: string;
    briefingContext?: string;
    isOpen: boolean;
    onToggle: () => void;
    transcript?: string;  // Live transcript for coach mode
    interviewStartTime?: number;  // When interview started (for elapsed time)
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const MIN_WIDTH = 320;
const MAX_WIDTH = 800;

// Detect when a Q&A exchange completes (Interviewer asks, Candidate answers)
function extractLastExchange(transcript: string): string | null {
    // Look for pattern: "Interviewer: ..." followed by "Candidate: ..."
    const lines = transcript.split('\n').filter(l => l.trim());
    if (lines.length < 2) return null;

    // Find the last complete exchange
    let lastInterviewerIdx = -1;
    let lastCandidateIdx = -1;

    for (let i = lines.length - 1; i >= 0; i--) {
        const line = lines[i].toLowerCase();
        if (line.includes('candidate:') && lastCandidateIdx === -1) {
            lastCandidateIdx = i;
        }
        if (line.includes('interviewer:') && lastCandidateIdx !== -1 && lastInterviewerIdx === -1) {
            lastInterviewerIdx = i;
            break;
        }
    }

    if (lastInterviewerIdx !== -1 && lastCandidateIdx !== -1) {
        return lines.slice(lastInterviewerIdx, lastCandidateIdx + 1).join('\n');
    }
    return null;
}

export default function AIChatSidebar({
    roomName,
    briefingContext,
    isOpen,
    onToggle,
    transcript,
    interviewStartTime
}: AIChatSidebarProps) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    // Resize state
    const [width, setWidth] = useState(MIN_WIDTH);
    const [isResizing, setIsResizing] = useState(false);

    // Coach Mode state
    const [coachSuggestion, setCoachSuggestion] = useState<CoachSuggestion | null>(null);
    const [lastProcessedExchange, setLastProcessedExchange] = useState<string>("");
    const [isCoachLoading, setIsCoachLoading] = useState(false);

    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    // Handle resizing (mouse events)
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isResizing) return;
            const newWidth = window.innerWidth - e.clientX;
            if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) {
                setWidth(newWidth);
            }
        };

        const handleMouseUp = () => {
            setIsResizing(false);
            document.body.style.cursor = "default";
        };

        if (isResizing) {
            window.addEventListener("mousemove", handleMouseMove);
            window.addEventListener("mouseup", handleMouseUp);
            document.body.style.cursor = "ew-resize";
            document.body.style.userSelect = "none";
        }

        return () => {
            window.removeEventListener("mousemove", handleMouseMove);
            window.removeEventListener("mouseup", handleMouseUp);
            document.body.style.cursor = "default";
            document.body.style.userSelect = "";
        };
    }, [isResizing]);

    // Add initial context message
    useEffect(() => {
        if (messages.length === 0 && briefingContext) {
            setMessages([{
                role: "assistant",
                content: "I'm here to help during the interview. After each Q&A exchange, I'll suggest the next question to ask."
            }]);
        }
    }, [briefingContext, messages.length]);

    // Coach Mode: Detect Q&A exchanges and get suggestions
    useEffect(() => {
        if (!transcript || !interviewStartTime || !isOpen) return;

        const lastExchange = extractLastExchange(transcript);
        if (!lastExchange || lastExchange === lastProcessedExchange) return;

        const fetchCoachSuggestion = async () => {
            setIsCoachLoading(true);
            const elapsedMinutes = Math.floor((Date.now() - interviewStartTime) / 60000);

            try {
                const suggestion = await getCoachSuggestion(
                    lastExchange,
                    transcript,
                    elapsedMinutes,
                    briefingContext
                );
                setCoachSuggestion(suggestion);
                setLastProcessedExchange(lastExchange);
            } catch (err) {
                console.error("Coach suggestion failed:", err);
            } finally {
                setIsCoachLoading(false);
            }
        };

        const timer = setTimeout(fetchCoachSuggestion, 500); // Small debounce
        return () => clearTimeout(timer);
    }, [transcript, interviewStartTime, isOpen, lastProcessedExchange, briefingContext]);

    const dismissSuggestion = () => setCoachSuggestion(null);


    const sendMessage = useCallback(async () => {
        if (!input.trim() || isLoading) return;

        const userMessage = input.trim();
        setInput("");
        setMessages(prev => [...prev, { role: "user", content: userMessage }]);
        setIsLoading(true);

        try {
            const response = await fetch(`${API_BASE_URL}/api/rooms/${roomName}/chat`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    message: userMessage,
                    context: briefingContext,
                    history: messages.slice(-6),
                }),
            });

            if (!response.ok) {
                throw new Error("Failed to get response");
            }

            const data = await response.json();
            setMessages(prev => [...prev, { role: "assistant", content: data.response }]);
        } catch (error) {
            console.error("Chat error:", error);
            setMessages(prev => [...prev, {
                role: "assistant",
                content: "Sorry, I couldn't process that. Try again."
            }]);
        } finally {
            setIsLoading(false);
        }
    }, [input, isLoading, roomName, briefingContext, messages]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    // Quick actions
    const quickActions = [
        { label: "🎯 Suggest Question", prompt: "Suggest a good interview question to ask right now based on the candidate's background." },
        { label: "⚠️ Red Flags", prompt: "What potential red flags should I be watching for with this candidate?" },
        { label: "📝 Probe Deeper", prompt: "What should I probe deeper on based on what we've discussed?" },
    ];

    if (!isOpen) {
        return (
            <Button
                onClick={onToggle}
                className="fixed right-4 top-20 z-50 bg-violet-600 hover:bg-violet-700"
            >
                🤖 AI Assistant
            </Button>
        );
    }

    return (
        <div
            className="fixed right-0 top-0 h-screen bg-background border-l shadow-lg z-50 flex flex-col"
            style={{ width: `${width}px` }}
        >
            {/* Resize handle */}
            <div
                className="absolute left-0 top-0 bottom-0 w-1 cursor-ew-resize hover:bg-violet-500/50 transition-colors z-50"
                onMouseDown={() => setIsResizing(true)}
            />

            {/* Header - fixed height */}
            <div className="flex items-center justify-between py-3 px-4 border-b bg-background shrink-0">
                <div className="text-sm flex items-center gap-2 font-medium">
                    🤖 AI Assistant
                    <span className="text-xs text-muted-foreground font-normal">(only you can see this)</span>
                </div>
                <Button variant="ghost" size="sm" onClick={onToggle}>✕</Button>
            </div>

            {/* Quick actions - fixed height */}
            <div className="px-3 py-2 border-b flex gap-2 flex-wrap shrink-0">
                {quickActions.map((action, i) => (
                    <Button
                        key={i}
                        variant="outline"
                        size="sm"
                        className="text-xs"
                        onClick={() => {
                            setInput(action.prompt);
                            setTimeout(() => sendMessage(), 100);
                        }}
                        disabled={isLoading}
                    >
                        {action.label}
                    </Button>
                ))}
            </div>

            {/* Coach Mode Suggestion Banner - Shows suggested next question */}
            {coachSuggestion && (
                <div className="mx-3 mt-2 p-3 rounded-lg border bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-950/30 dark:to-purple-950/30 border-violet-200 dark:border-violet-700 animate-in slide-in-from-top-2">
                    <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                            {/* Answer quality indicator */}
                            <div className="flex items-center gap-2 mb-2">
                                <span className={`text-xs px-2 py-0.5 rounded-full ${coachSuggestion.answer_quality === "strong" ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" :
                                        coachSuggestion.answer_quality === "adequate" ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" :
                                            coachSuggestion.answer_quality === "weak" ? "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200" :
                                                "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200"
                                    }`}>
                                    {coachSuggestion.answer_quality === "strong" && "✓ Strong answer"}
                                    {coachSuggestion.answer_quality === "adequate" && "○ Adequate"}
                                    {coachSuggestion.answer_quality === "weak" && "⚠ Needs probing"}
                                    {coachSuggestion.answer_quality === "unclear" && "? Unclear"}
                                </span>
                                {coachSuggestion.should_change_topic && (
                                    <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200">
                                        🔄 Change topic
                                    </span>
                                )}
                            </div>

                            {/* Suggested next question */}
                            <p className="text-sm font-medium text-foreground mb-1">
                                💡 Ask next:
                            </p>
                            <p className="text-sm text-violet-900 dark:text-violet-100 italic bg-white/50 dark:bg-black/20 p-2 rounded">
                                "{coachSuggestion.suggested_next_question}"
                            </p>

                            {/* Reasoning */}
                            <p className="text-xs text-muted-foreground mt-2">
                                {coachSuggestion.reasoning}
                            </p>

                            {/* Topic suggestion if changing */}
                            {coachSuggestion.topic_suggestion && (
                                <p className="text-xs text-orange-700 dark:text-orange-300 mt-1">
                                    → Move to: {coachSuggestion.topic_suggestion}
                                </p>
                            )}
                        </div>
                        <Button variant="ghost" size="sm" className="shrink-0 h-6 w-6 p-0" onClick={dismissSuggestion}>
                            ✕
                        </Button>
                    </div>
                </div>
            )}

            {/* Loading indicator for coach */}
            {isCoachLoading && (
                <div className="mx-3 mt-2 p-2 rounded-lg border border-dashed flex items-center gap-2 text-sm text-muted-foreground">
                    <span className="animate-spin">🔍</span>
                    Analyzing last exchange...
                </div>
            )}

            {/* Messages - scrollable, takes remaining space */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
                {messages.map((msg, i) => (
                    <div
                        key={i}
                        className={`text-sm ${msg.role === "user"
                            ? "bg-primary/10 ml-8 rounded-lg p-2"
                            : "bg-muted rounded-lg p-2"
                            }`}
                    >
                        <span className="font-medium text-xs block mb-1 opacity-70">
                            {msg.role === "user" ? "You" : "AI"}
                        </span>
                        <div className="prose prose-sm dark:prose-invert max-w-none">
                            {msg.role === "assistant" ? (
                                <ReactMarkdown
                                    components={{
                                        ul: ({ node, ...props }) => <ul className="list-disc list-outside ml-4 space-y-1 my-1" {...props} />,
                                        ol: ({ node, ...props }) => <ol className="list-decimal list-outside ml-4 space-y-1 my-1" {...props} />,
                                        li: ({ node, ...props }) => <li className="pl-1" {...props} />,
                                        p: ({ node, ...props }) => <p className="mb-1 last:mb-0 inline" {...props} />,
                                        strong: ({ node, ...props }) => <strong className="font-semibold text-primary" {...props} />
                                    }}
                                >
                                    {msg.content}
                                </ReactMarkdown>
                            ) : (
                                msg.content
                            )}
                        </div>
                    </div>
                ))}
                {isLoading && (
                    <div className="bg-muted rounded-lg p-2 text-sm opacity-70">
                        <span className="animate-pulse">Thinking...</span>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input - fixed at bottom */}
            <div className="p-3 border-t bg-background shrink-0">
                <div className="flex gap-2">
                    <Textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Ask for suggestions..."
                        className="min-h-[50px] max-h-[80px] resize-none text-sm"
                        disabled={isLoading}
                    />
                    <Button
                        onClick={sendMessage}
                        disabled={!input.trim() || isLoading}
                        className="self-end"
                    >
                        Send
                    </Button>
                </div>
            </div>
        </div>
    );
}
