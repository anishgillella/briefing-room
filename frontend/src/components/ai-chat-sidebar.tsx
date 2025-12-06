"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

interface Message {
    role: "user" | "assistant";
    content: string;
}

interface AIChatSidebarProps {
    roomName: string;
    briefingContext?: string;
    isOpen: boolean;
    onToggle: () => void;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function AIChatSidebar({
    roomName,
    briefingContext,
    isOpen,
    onToggle
}: AIChatSidebarProps) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    // Add initial context message
    useEffect(() => {
        if (messages.length === 0 && briefingContext) {
            setMessages([{
                role: "assistant",
                content: "I'm here to help during the interview. Ask me for question suggestions, red flags to watch for, or anything about the candidate's background."
            }]);
        }
    }, [briefingContext, messages.length]);

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
                    history: messages.slice(-6), // Last 6 messages for context
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
        <div className="fixed right-0 top-0 h-screen w-80 bg-background border-l shadow-lg z-50 flex flex-col">
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
                        {msg.content}
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

