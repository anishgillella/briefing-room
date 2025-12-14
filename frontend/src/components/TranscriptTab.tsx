"use client";

import { User, MessageSquare } from "lucide-react";

interface TranscriptItem {
    speaker: "interviewer" | "candidate";
    text: string;
    timestamp?: Date;
}

interface Props {
    transcript: TranscriptItem[];
}

export default function TranscriptTab({ transcript }: Props) {
    if (!transcript || transcript.length === 0) {
        return (
            <div className="glass-panel rounded-2xl p-8 text-center">
                <MessageSquare className="w-12 h-12 mx-auto mb-4 text-gray-500" />
                <p className="text-white/60">No transcript available</p>
                <p className="text-white/40 text-sm mt-2">
                    The conversation transcript will appear here after the interview.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-4 animate-fadeIn">
            <div className="glass-panel rounded-3xl p-6">
                <h3 className="text-gray-400 text-sm font-medium tracking-wider uppercase mb-6 flex items-center gap-2">
                    <MessageSquare className="w-4 h-4" /> Interview Transcript
                </h3>

                <div className="space-y-4 max-h-[600px] overflow-y-auto custom-scrollbar pr-2">
                    {transcript.map((item, index) => (
                        <div
                            key={index}
                            className={`flex gap-4 ${item.speaker === "interviewer" ? "" : "flex-row-reverse"
                                }`}
                        >
                            {/* Avatar */}
                            <div
                                className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${item.speaker === "interviewer"
                                        ? "bg-purple-500/20 text-purple-400"
                                        : "bg-blue-500/20 text-blue-400"
                                    }`}
                            >
                                <User className="w-4 h-4" />
                            </div>

                            {/* Message Bubble */}
                            <div
                                className={`flex-1 max-w-[80%] p-4 rounded-2xl ${item.speaker === "interviewer"
                                        ? "bg-purple-500/10 border border-purple-500/20 rounded-tl-sm"
                                        : "bg-blue-500/10 border border-blue-500/20 rounded-tr-sm ml-auto"
                                    }`}
                            >
                                <div className="flex items-center gap-2 mb-2">
                                    <span
                                        className={`text-[10px] font-bold uppercase tracking-widest ${item.speaker === "interviewer"
                                                ? "text-purple-400"
                                                : "text-blue-400"
                                            }`}
                                    >
                                        {item.speaker}
                                    </span>
                                    {item.timestamp && (
                                        <span className="text-[10px] text-white/30">
                                            {new Date(item.timestamp).toLocaleTimeString([], {
                                                hour: "2-digit",
                                                minute: "2-digit",
                                            })}
                                        </span>
                                    )}
                                </div>
                                <p className="text-white/80 text-sm leading-relaxed">{item.text}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Stats Footer */}
            <div className="glass-panel rounded-xl p-4 flex items-center justify-between text-sm">
                <div className="flex gap-6">
                    <div>
                        <span className="text-white/40">Turns: </span>
                        <span className="text-white font-medium">{transcript.length}</span>
                    </div>
                    <div>
                        <span className="text-white/40">Interviewer: </span>
                        <span className="text-purple-400 font-medium">
                            {transcript.filter((t) => t.speaker === "interviewer").length}
                        </span>
                    </div>
                    <div>
                        <span className="text-white/40">Candidate: </span>
                        <span className="text-blue-400 font-medium">
                            {transcript.filter((t) => t.speaker === "candidate").length}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}
