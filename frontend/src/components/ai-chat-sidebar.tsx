"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { getCoachSuggestion, CoachSuggestion } from "@/lib/api";
import { Lightbulb, MessageSquare, ChevronDown, ChevronUp } from "lucide-react";

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
    const [width, setWidth] = useState(380); // Slightly wider default
    const [isResizing, setIsResizing] = useState(false);

    // Coach Mode state - keep history of all suggestions
    const [coachSuggestions, setCoachSuggestions] = useState<CoachSuggestion[]>([]);
    const [lastProcessedExchange, setLastProcessedExchange] = useState<string>("");
    const [isCoachLoading, setIsCoachLoading] = useState(false);

    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom of chat
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
                content: "I'm here to help. I'll suggest questions above, and you can chat with me here."
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
                // Add to array instead of replacing (Max 50 history)
                setCoachSuggestions(prev => [...prev, suggestion].slice(-50));
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

    const dismissSuggestion = (index: number) => {
        setCoachSuggestions(prev => prev.filter((_, i) => i !== index));
    };


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

    if (!isOpen) {
        return (
            <Button
                onClick={onToggle}
                className="fixed right-4 top-20 z-50 bg-violet-600 hover:bg-violet-700 shadow-lg"
            >
                🤖 AI Assistant
            </Button>
        );
    }

    return (
        <div
            className="fixed right-0 top-0 h-screen bg-background border-l shadow-2xl z-50 flex flex-col"
            style={{ width: `${width}px` }}
        >
            {/* Resize handle */}
            <div
                className="absolute left-0 top-0 bottom-0 w-1 cursor-ew-resize hover:bg-violet-500/50 transition-colors z-50"
                onMouseDown={() => setIsResizing(true)}
            />

            {/* Header */}
            <div className="flex items-center justify-between py-3 px-4 border-b bg-background shrink-0">
                <div className="text-sm font-semibold flex items-center gap-2">
                    🤖 AI Assistant
                    <span className="text-xs text-muted-foreground font-normal">(Private)</span>
                </div>
                <Button variant="ghost" size="sm" onClick={onToggle}>✕</Button>
            </div>

            {/* SPLIT VIEW */}
            <div className="flex-1 flex flex-col min-h-0 bg-slate-50 dark:bg-slate-950/50">

                {/* TOP HALF: Active Suggestions (Coach) */}
                <div className="flex-1 min-h-0 flex flex-col border-b overflow-hidden">
                    <div className="px-4 py-2 bg-gradient-to-r from-violet-500/10 to-purple-500/10 border-b flex justify-between items-center shrink-0">
                        <span className="text-xs font-bold uppercase tracking-wider text-violet-600 dark:text-violet-300 flex items-center gap-2">
                            <Lightbulb className="w-3 h-3" /> Live Suggestions
                        </span>
                        {isCoachLoading && <span className="text-xs animate-pulse text-muted-foreground">Analyzing...</span>}
                    </div>

                    <div className="overflow-y-auto p-3 space-y-3 bg-slate-100/50 dark:bg-black/20">
                        {coachSuggestions.length === 0 ? (
                            <div className="text-center p-6 text-muted-foreground text-sm opacity-60">
                                <Lightbulb className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                <p>Listening to interview...</p>
                                <p className="text-xs">Suggestions will appear here automatically.</p>
                            </div>
                        ) : (
                            [...coachSuggestions].reverse().map((suggestion, reverseIdx) => {
                                const originalIndex = coachSuggestions.length - 1 - reverseIdx;
                                const isNewest = reverseIdx === 0;
                                return (
                                    <div
                                        key={originalIndex}
                                        className={`p-3 rounded-xl border transition-all duration-500 ${isNewest
                                            ? "bg-white dark:bg-slate-900 border-violet-500/30 shadow-lg shadow-violet-500/10 scale-[1.02]"
                                            : "bg-white/50 dark:bg-slate-900/50 border-transparent opacity-70 hover:opacity-100 scale-100"
                                            }`}
                                    >
                                        <div className="flex items-start justify-between gap-2 mb-2">
                                            <div className="flex items-center gap-2">
                                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium uppercase tracking-wide ${suggestion.answer_quality === "strong" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" :
                                                    suggestion.answer_quality === "adequate" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" :
                                                        suggestion.answer_quality === "weak" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" :
                                                            "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                                                    }`}>
                                                    {suggestion.answer_quality} Answer
                                                </span>
                                            </div>
                                            <Button variant="ghost" size="sm" className="h-5 w-5 p-0 opacity-40 hover:opacity-100" onClick={() => dismissSuggestion(originalIndex)}>×</Button>
                                        </div>

                                        <p className="text-sm font-medium text-slate-800 dark:text-slate-100 mb-2 leading-relaxed">
                                            "{suggestion.suggested_next_question}"
                                        </p>

                                        <p className="text-xs text-slate-500 dark:text-slate-400 border-l-2 border-slate-200 dark:border-slate-800 pl-2">
                                            {suggestion.reasoning}
                                        </p>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* BOTTOM HALF: Assistant Chat */}
                <div className="flex-1 min-h-0 flex flex-col">
                    <div className="px-4 py-2 bg-slate-50 dark:bg-slate-900 border-b flex justify-between items-center shrink-0">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
                            <MessageSquare className="w-3 h-3" /> Assistant Chat
                        </span>
                    </div>

                    <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-white dark:bg-slate-950">
                        {messages.map((msg, i) => (
                            <div
                                key={i}
                                className={`text-sm ${msg.role === "user"
                                    ? "bg-violet-600 text-white ml-8 rounded-2xl rounded-tr-sm p-3 shadow-sm"
                                    : "bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-200 mr-8 rounded-2xl rounded-tl-sm p-3"
                                    }`}
                            >
                                <div className="prose prose-sm dark:prose-invert max-w-none break-words">
                                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                                </div>
                            </div>
                        ))}
                        {isLoading && (
                            <div className="bg-slate-100 dark:bg-slate-900 rounded-2xl rounded-tl-sm p-3 mr-auto w-12 flex items-center justify-center">
                                <span className="flex gap-1">
                                    <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                                    <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                                    <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"></span>
                                </span>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    <div className="p-3 border-t bg-background shrink-0">
                        <div className="flex gap-2">
                            <Textarea
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="Ask me anything..."
                                className="min-h-[44px] max-h-[100px] resize-none text-sm rounded-xl"
                                disabled={isLoading}
                            />
                            <Button
                                onClick={sendMessage}
                                disabled={!input.trim() || isLoading}
                                className="self-end rounded-xl bg-violet-600 hover:bg-violet-700 h-[44px]"
                            >
                                Send
                            </Button>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}
