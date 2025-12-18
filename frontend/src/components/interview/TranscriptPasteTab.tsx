"use client";

import { useState } from "react";
import {
    FileText,
    Sparkles,
    Loader2,
    CheckCircle,
    AlertCircle,
    Upload,
    ClipboardPaste,
    User,
    MessageSquare,
} from "lucide-react";

interface TranscriptTurn {
    speaker: "interviewer" | "candidate";
    text: string;
    timestamp?: number;
}

interface TranscriptPasteTabProps {
    interviewId: string;
    candidateName: string;
    stage: string;
    onTranscriptSaved: (transcript: TranscriptTurn[]) => void;
    existingTranscript?: TranscriptTurn[];
}

export default function TranscriptPasteTab({
    interviewId,
    candidateName,
    stage,
    onTranscriptSaved,
    existingTranscript,
}: TranscriptPasteTabProps) {
    const [transcriptText, setTranscriptText] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [parsedTranscript, setParsedTranscript] = useState<TranscriptTurn[] | null>(null);
    const [saveSuccess, setSaveSuccess] = useState(false);

    const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

    // Parse transcript text into structured turns
    const parseTranscript = (text: string): TranscriptTurn[] => {
        const lines = text.split("\n").filter((line) => line.trim());
        const turns: TranscriptTurn[] = [];

        // Common patterns for speaker labels
        const speakerPatterns = [
            // "Speaker Name: text" or "Speaker Name - text"
            /^([^:]+?):\s*(.+)$/,
            /^([^-]+?)\s*-\s*(.+)$/,
            // Zoom format: "00:00:00 Speaker Name: text"
            /^\d{1,2}:\d{2}(?::\d{2})?\s+([^:]+?):\s*(.+)$/,
            // Otter format: "Speaker Name  00:00" followed by text
            /^([A-Za-z\s]+?)\s+\d{1,2}:\d{2}$/,
        ];

        let currentSpeaker: "interviewer" | "candidate" | null = null;
        let currentText = "";

        const determineSpeaker = (name: string): "interviewer" | "candidate" => {
            const lowerName = name.toLowerCase().trim();
            // Keywords that suggest interviewer
            const interviewerKeywords = [
                "interviewer",
                "host",
                "recruiter",
                "hiring",
                "manager",
                "hr",
                "you",
                "me",
            ];
            // Keywords that suggest candidate
            const candidateKeywords = [
                "candidate",
                "applicant",
                "interviewee",
                candidateName.toLowerCase(),
            ];

            if (interviewerKeywords.some((k) => lowerName.includes(k))) {
                return "interviewer";
            }
            if (candidateKeywords.some((k) => lowerName.includes(k))) {
                return "candidate";
            }

            // Default: alternate based on position or use first as interviewer
            return turns.length % 2 === 0 ? "interviewer" : "candidate";
        };

        for (const line of lines) {
            let matched = false;

            for (const pattern of speakerPatterns) {
                const match = line.match(pattern);
                if (match) {
                    // Save previous turn if exists
                    if (currentSpeaker && currentText.trim()) {
                        turns.push({
                            speaker: currentSpeaker,
                            text: currentText.trim(),
                            timestamp: turns.length,
                        });
                    }

                    const speakerName = match[1];
                    const text = match[2] || "";

                    currentSpeaker = determineSpeaker(speakerName);
                    currentText = text;
                    matched = true;
                    break;
                }
            }

            // If no pattern matched, append to current text
            if (!matched && currentSpeaker) {
                currentText += " " + line.trim();
            } else if (!matched && !currentSpeaker) {
                // First line without speaker label - assume interviewer
                currentSpeaker = "interviewer";
                currentText = line.trim();
            }
        }

        // Don't forget the last turn
        if (currentSpeaker && currentText.trim()) {
            turns.push({
                speaker: currentSpeaker,
                text: currentText.trim(),
                timestamp: turns.length,
            });
        }

        return turns;
    };

    const handleParse = () => {
        if (!transcriptText.trim()) {
            setError("Please paste a transcript");
            return;
        }

        if (transcriptText.trim().length < 50) {
            setError("Transcript is too short. Please paste the full conversation.");
            return;
        }

        setError(null);
        const parsed = parseTranscript(transcriptText);

        if (parsed.length < 2) {
            setError(
                "Could not parse transcript. Please ensure it has speaker labels (e.g., 'Interviewer: Hello...')"
            );
            return;
        }

        setParsedTranscript(parsed);
    };

    const handleSave = async () => {
        if (!parsedTranscript || parsedTranscript.length === 0) {
            setError("No transcript to save");
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const response = await fetch(
                `${API_URL}/api/interviews/${interviewId}/paste-transcript`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        turns: parsedTranscript,
                        full_text: transcriptText,
                    }),
                }
            );

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.detail || "Failed to save transcript");
            }

            setSaveSuccess(true);
            onTranscriptSaved(parsedTranscript);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to save transcript");
        } finally {
            setIsLoading(false);
        }
    };

    const handleReset = () => {
        setParsedTranscript(null);
        setSaveSuccess(false);
        setError(null);
    };

    // If already has transcript, show it
    if (existingTranscript && existingTranscript.length > 0) {
        return (
            <div className="animate-fade-in">
                <div className="glass-panel rounded-3xl p-8 border border-green-500/20 bg-green-500/5">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center">
                            <CheckCircle className="w-6 h-6 text-green-400" />
                        </div>
                        <div>
                            <h3 className="text-lg font-medium text-green-300">
                                Transcript Already Saved
                            </h3>
                            <p className="text-sm text-green-400/60">
                                {existingTranscript.length} turns recorded for {stage}
                            </p>
                        </div>
                    </div>

                    {/* Preview */}
                    <div className="bg-black/20 rounded-2xl p-4 max-h-64 overflow-y-auto custom-scrollbar">
                        {existingTranscript.slice(0, 5).map((turn, i) => (
                            <div key={i} className="flex gap-3 mb-3">
                                <div
                                    className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                                        turn.speaker === "interviewer"
                                            ? "bg-purple-500/20 text-purple-400"
                                            : "bg-blue-500/20 text-blue-400"
                                    }`}
                                >
                                    <User className="w-3 h-3" />
                                </div>
                                <div className="flex-1">
                                    <span
                                        className={`text-[10px] font-bold uppercase tracking-wider ${
                                            turn.speaker === "interviewer"
                                                ? "text-purple-400"
                                                : "text-blue-400"
                                        }`}
                                    >
                                        {turn.speaker}
                                    </span>
                                    <p className="text-sm text-white/70 line-clamp-2">
                                        {turn.text}
                                    </p>
                                </div>
                            </div>
                        ))}
                        {existingTranscript.length > 5 && (
                            <p className="text-center text-white/30 text-xs mt-2">
                                + {existingTranscript.length - 5} more turns
                            </p>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    // Success state
    if (saveSuccess && parsedTranscript) {
        return (
            <div className="animate-fade-in">
                <div className="glass-panel rounded-3xl p-8 border border-green-500/20 bg-green-500/5">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center">
                            <CheckCircle className="w-6 h-6 text-green-400" />
                        </div>
                        <div>
                            <h3 className="text-lg font-medium text-green-300">
                                Transcript Saved Successfully
                            </h3>
                            <p className="text-sm text-green-400/60">
                                {parsedTranscript.length} conversation turns parsed and stored
                            </p>
                        </div>
                    </div>

                    <div className="flex gap-6 text-sm">
                        <div>
                            <span className="text-white/40">Interviewer turns: </span>
                            <span className="text-purple-400 font-medium">
                                {parsedTranscript.filter((t) => t.speaker === "interviewer").length}
                            </span>
                        </div>
                        <div>
                            <span className="text-white/40">Candidate turns: </span>
                            <span className="text-blue-400 font-medium">
                                {parsedTranscript.filter((t) => t.speaker === "candidate").length}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Preview state - after parsing, before saving
    if (parsedTranscript) {
        return (
            <div className="animate-fade-in space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-lg font-medium text-white">Preview Parsed Transcript</h3>
                        <p className="text-sm text-white/50">
                            {parsedTranscript.length} turns detected. Review and save.
                        </p>
                    </div>
                    <button
                        onClick={handleReset}
                        className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-sm text-white/70 transition-colors"
                    >
                        Edit Transcript
                    </button>
                </div>

                {/* Preview */}
                <div className="glass-panel rounded-3xl p-6 max-h-[400px] overflow-y-auto custom-scrollbar">
                    <div className="space-y-4">
                        {parsedTranscript.map((turn, i) => (
                            <div
                                key={i}
                                className={`flex gap-4 ${
                                    turn.speaker === "interviewer" ? "" : "flex-row-reverse"
                                }`}
                            >
                                <div
                                    className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                                        turn.speaker === "interviewer"
                                            ? "bg-purple-500/20 text-purple-400"
                                            : "bg-blue-500/20 text-blue-400"
                                    }`}
                                >
                                    <User className="w-4 h-4" />
                                </div>
                                <div
                                    className={`flex-1 max-w-[80%] p-4 rounded-2xl ${
                                        turn.speaker === "interviewer"
                                            ? "bg-purple-500/10 border border-purple-500/20 rounded-tl-sm"
                                            : "bg-blue-500/10 border border-blue-500/20 rounded-tr-sm ml-auto"
                                    }`}
                                >
                                    <span
                                        className={`text-[10px] font-bold uppercase tracking-widest ${
                                            turn.speaker === "interviewer"
                                                ? "text-purple-400"
                                                : "text-blue-400"
                                        }`}
                                    >
                                        {turn.speaker}
                                    </span>
                                    <p className="text-white/80 text-sm leading-relaxed mt-1">
                                        {turn.text}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Stats & Save */}
                <div className="flex items-center justify-between">
                    <div className="flex gap-6 text-sm">
                        <div>
                            <span className="text-white/40">Interviewer: </span>
                            <span className="text-purple-400 font-medium">
                                {parsedTranscript.filter((t) => t.speaker === "interviewer").length}
                            </span>
                        </div>
                        <div>
                            <span className="text-white/40">Candidate: </span>
                            <span className="text-blue-400 font-medium">
                                {parsedTranscript.filter((t) => t.speaker === "candidate").length}
                            </span>
                        </div>
                    </div>

                    <button
                        onClick={handleSave}
                        disabled={isLoading}
                        className="px-6 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-[0_0_30px_rgba(168,85,247,0.3)]"
                    >
                        {isLoading ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Saving...
                            </>
                        ) : (
                            <>
                                <CheckCircle className="w-4 h-4" />
                                Save Transcript
                            </>
                        )}
                    </button>
                </div>

                {error && (
                    <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        {error}
                    </div>
                )}
            </div>
        );
    }

    // Default: Input state
    return (
        <div className="animate-fade-in">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Input Area */}
                <div className="lg:col-span-2">
                    <div className="glass-panel rounded-3xl p-1 h-full">
                        <div className="p-6 h-full flex flex-col">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="font-medium text-sm text-gray-400 uppercase tracking-wider flex items-center gap-2">
                                    <ClipboardPaste className="w-4 h-4" />
                                    Paste Transcript
                                </h3>
                                <span className="text-xs text-white/30">
                                    {transcriptText.length.toLocaleString()} chars
                                </span>
                            </div>

                            <textarea
                                value={transcriptText}
                                onChange={(e) => setTranscriptText(e.target.value)}
                                placeholder={`Paste your interview transcript here...

Supported formats:
• Speaker labels: "Interviewer: Hello..." or "John: Hi there..."
• Zoom transcripts
• Otter.ai exports
• Any format with speaker names followed by colons

Example:
Interviewer: Thanks for joining us today. Can you tell me about yourself?
${candidateName}: Sure! I've been working as a software engineer for 5 years...
Interviewer: That's great. What attracted you to this role?`}
                                className="flex-1 min-h-[350px] bg-transparent border-0 resize-none text-gray-300 placeholder:text-gray-700 focus:outline-none focus:ring-0 text-sm leading-relaxed"
                            />

                            {error && (
                                <div className="mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-2">
                                    <AlertCircle className="w-4 h-4 shrink-0" />
                                    {error}
                                </div>
                            )}

                            <div className="mt-4">
                                <button
                                    onClick={handleParse}
                                    disabled={!transcriptText.trim()}
                                    className="w-full py-3 rounded-xl bg-white text-black font-semibold hover:bg-gray-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    <Sparkles className="w-4 h-4" />
                                    Parse Transcript
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Info Panel */}
                <div className="space-y-4">
                    {/* What We Extract */}
                    <div className="glass-panel rounded-2xl p-6">
                        <h4 className="font-medium text-white/80 mb-4 text-sm uppercase tracking-wider flex items-center gap-2">
                            <FileText className="w-4 h-4 text-purple-400" />
                            How It Works
                        </h4>
                        <ul className="space-y-3">
                            {[
                                "Paste any transcript format",
                                "Auto-detects speakers",
                                "Parses conversation turns",
                                "Saves for offer prep analysis",
                            ].map((item, i) => (
                                <li
                                    key={i}
                                    className="flex items-center gap-3 text-sm text-white/50"
                                >
                                    <div className="w-5 h-5 rounded-full bg-white/5 flex items-center justify-center">
                                        <CheckCircle className="w-3 h-3 text-purple-400" />
                                    </div>
                                    {item}
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Supported Formats */}
                    <div className="glass-panel rounded-2xl p-6 border border-white/5">
                        <h4 className="font-medium text-white/80 mb-3 text-sm flex items-center gap-2">
                            <MessageSquare className="w-4 h-4 text-blue-400" />
                            Supported Formats
                        </h4>
                        <ul className="space-y-2 text-sm text-white/40">
                            <li>• Plain text with speaker labels</li>
                            <li>• Zoom transcript exports</li>
                            <li>• Otter.ai transcripts</li>
                            <li>• Google Meet captions</li>
                            <li>• Any "Name: text" format</li>
                        </ul>
                    </div>

                    {/* Stage Info */}
                    <div className="glass-panel rounded-2xl p-6 border border-purple-500/20 bg-purple-500/5">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
                                <span className="text-purple-400 font-bold text-sm">
                                    {stage.replace("round_", "R")}
                                </span>
                            </div>
                            <div>
                                <h4 className="font-medium text-purple-300 text-sm">
                                    {stage.replace("_", " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                                </h4>
                                <p className="text-xs text-purple-400/60">
                                    Interview with {candidateName}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
