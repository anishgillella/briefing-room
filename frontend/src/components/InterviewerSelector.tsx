"use client";

import { useState, useEffect } from "react";
import { ChevronDown, UserCircle } from "lucide-react";
import { getInterviewers, getSelectedInterviewerId, setSelectedInterviewerId, Interviewer } from "@/lib/interviewerApi";

interface InterviewerSelectorProps {
    onInterviewerChange?: (interviewerId: string) => void;
    selectedId?: string | null;
    label?: string;
    className?: string;
}

export default function InterviewerSelector({
    onInterviewerChange,
    selectedId,
    label = "Interviewer",
    className = ""
}: InterviewerSelectorProps) {
    const [interviewers, setInterviewers] = useState<Interviewer[]>([]);
    const [selectedInterviewer, setSelectedInterviewer] = useState<Interviewer | null>(null);
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadInterviewers();
    }, []);

    useEffect(() => {
        if (selectedId && interviewers.length > 0) {
            const found = interviewers.find(i => i.id === selectedId);
            if (found && found.id !== selectedInterviewer?.id) {
                setSelectedInterviewer(found);
            }
        }
    }, [selectedId, interviewers]);

    const loadInterviewers = async () => {
        try {
            const data = await getInterviewers();
            setInterviewers(data);

            // Initial load strategy: prop > localStorage
            const targetId = selectedId || getSelectedInterviewerId();
            if (targetId) {
                const saved = data.find(i => i.id === targetId);
                if (saved) {
                    setSelectedInterviewer(saved);
                }
            }
        } catch (err) {
            console.error("Failed to load interviewers:", err);
        } finally {
            setLoading(false);
        }
    };

    const handleSelect = (interviewer: Interviewer) => {
        setSelectedInterviewer(interviewer);
        setSelectedInterviewerId(interviewer.id);
        setIsOpen(false);
        onInterviewerChange?.(interviewer.id);
    };

    if (loading) {
        return (
            <div className={`flex items-center gap-2 px-4 py-2 bg-white/5 rounded-xl animate-pulse ${className}`}>
                <div className="w-8 h-8 bg-white/10 rounded-full"></div>
                <div className="w-24 h-4 bg-white/10 rounded"></div>
            </div>
        );
    }

    return (
        <div className={`relative ${className}`}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-3 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 transition-all group w-full"
            >
                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-full flex items-center justify-center">
                    <UserCircle className="w-5 h-5 text-white" />
                </div>
                <div className="text-left flex-1">
                    <div className="text-xs text-white/40 uppercase tracking-wider">{label}</div>
                    <div className="text-sm text-white font-medium">
                        {selectedInterviewer?.name || "Select Interviewer"}
                    </div>
                </div>
                <ChevronDown className={`w-4 h-4 text-white/40 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-[#1a1a1a] border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden animate-fade-in">
                    <div className="p-2 border-b border-white/5">
                        <div className="text-xs text-white/40 uppercase tracking-wider px-2 py-1">
                            Available Interviewers
                        </div>
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                        {interviewers.length === 0 ? (
                            <div className="px-4 py-3 text-sm text-white/40">No interviewers available</div>
                        ) : (
                            interviewers.map((interviewer) => (
                                <button
                                    key={interviewer.id}
                                    onClick={() => handleSelect(interviewer)}
                                    className={`w-full px-4 py-3 flex items-center gap-3 hover:bg-white/5 transition-colors text-left ${selectedInterviewer?.id === interviewer.id ? 'bg-white/10' : ''
                                        }`}
                                >
                                    <div className="w-8 h-8 bg-gradient-to-br from-blue-500/50 to-cyan-500/50 rounded-full flex items-center justify-center">
                                        <span className="text-xs text-white font-medium">
                                            {interviewer.name.split(' ').map(n => n[0]).join('')}
                                        </span>
                                    </div>
                                    <div>
                                        <div className="text-sm text-white">{interviewer.name}</div>
                                        <div className="text-xs text-white/40">{interviewer.team} · {interviewer.department}</div>
                                    </div>
                                </button>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
