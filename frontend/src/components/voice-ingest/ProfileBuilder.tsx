"use client";

import { useState } from "react";
import {
    Briefcase,
    MapPin,
    DollarSign,
    Clock,
    Target,
    Users,
    Sparkles,
    CheckCircle,
    AlertCircle,
    ChevronRight,
    Trash2,
    MessageSquare,
} from "lucide-react";
import {
    JobProfile,
    CandidateTrait,
    InterviewStage,
    NuanceCapture,
    formatLocation,
    formatCompensation,
    formatExperience,
    formatPriority,
    getPriorityColor,
} from "@/lib/voiceIngestApi";

interface ProfileBuilderProps {
    profile: JobProfile;
    completionPercentage: number;
    missingFields: string[];
    transcripts: Array<{ speaker: "agent" | "user"; text: string }>;
    onDeleteTrait?: (traitName: string) => void;
    onDeleteStage?: (stageName: string) => void;
}

export default function ProfileBuilder({
    profile,
    completionPercentage,
    missingFields,
    transcripts,
    onDeleteTrait,
    onDeleteStage,
}: ProfileBuilderProps) {
    const [activeTab, setActiveTab] = useState<"profile" | "transcript">("profile");

    const isComplete = completionPercentage >= 100;

    return (
        <div className="h-full flex flex-col">
            {/* Header with Completion */}
            <div className="p-6 border-b border-white/10">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-white">Job Profile</h2>
                    <div className="flex items-center gap-2">
                        {isComplete ? (
                            <span className="flex items-center gap-1 text-green-400 text-sm font-medium">
                                <CheckCircle className="w-4 h-4" />
                                Complete
                            </span>
                        ) : (
                            <span className="text-white/50 text-sm">
                                {completionPercentage.toFixed(0)}% complete
                            </span>
                        )}
                    </div>
                </div>

                {/* Progress Bar */}
                <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                    <div
                        className={`h-full rounded-full transition-all duration-500 ${
                            isComplete
                                ? "bg-green-500"
                                : completionPercentage >= 75
                                ? "bg-indigo-500"
                                : completionPercentage >= 50
                                ? "bg-purple-500"
                                : "bg-amber-500"
                        }`}
                        style={{ width: `${Math.min(completionPercentage, 100)}%` }}
                    />
                </div>

                {/* Missing Fields */}
                {missingFields.length > 0 && missingFields.length <= 3 && (
                    <div className="mt-3 flex items-center gap-2 text-xs text-amber-400/80">
                        <AlertCircle className="w-3 h-3" />
                        <span>Need: {missingFields.slice(0, 3).join(", ")}</span>
                    </div>
                )}

                {/* Tab Switcher */}
                <div className="mt-4 flex gap-2 p-1 bg-white/5 rounded-lg">
                    <button
                        onClick={() => setActiveTab("profile")}
                        className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
                            activeTab === "profile"
                                ? "bg-white/10 text-white"
                                : "text-white/50 hover:text-white"
                        }`}
                    >
                        Profile
                    </button>
                    <button
                        onClick={() => setActiveTab("transcript")}
                        className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                            activeTab === "transcript"
                                ? "bg-white/10 text-white"
                                : "text-white/50 hover:text-white"
                        }`}
                    >
                        <MessageSquare className="w-3 h-3" />
                        Transcript
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
                {activeTab === "profile" ? (
                    <div className="p-6 space-y-6">
                        {/* Requirements Section */}
                        <section>
                            <h3 className="text-xs font-bold text-white/40 uppercase tracking-widest mb-4 flex items-center gap-2">
                                <Briefcase className="w-3 h-3" />
                                Requirements
                            </h3>
                            <div className="space-y-3">
                                <RequirementRow
                                    icon={<Briefcase className="w-4 h-4" />}
                                    label="Title"
                                    value={profile.requirements.job_title}
                                    filled={!!profile.requirements.job_title}
                                />
                                <RequirementRow
                                    icon={<MapPin className="w-4 h-4" />}
                                    label="Location"
                                    value={formatLocation(profile.requirements)}
                                    filled={!!profile.requirements.location_type}
                                />
                                <RequirementRow
                                    icon={<Clock className="w-4 h-4" />}
                                    label="Experience"
                                    value={formatExperience(profile.requirements)}
                                    filled={profile.requirements.experience_min_years !== undefined}
                                />
                                <RequirementRow
                                    icon={<DollarSign className="w-4 h-4" />}
                                    label="Compensation"
                                    value={formatCompensation(profile.requirements)}
                                    filled={!!profile.requirements.salary_min}
                                />
                                <RequirementRow
                                    icon={<Users className="w-4 h-4" />}
                                    label="Visa"
                                    value={
                                        profile.requirements.visa_sponsorship === true
                                            ? "Yes, will sponsor"
                                            : profile.requirements.visa_sponsorship === false
                                            ? "No sponsorship"
                                            : undefined
                                    }
                                    filled={profile.requirements.visa_sponsorship !== undefined}
                                />
                            </div>
                        </section>

                        {/* Traits Section */}
                        <section>
                            <h3 className="text-xs font-bold text-white/40 uppercase tracking-widest mb-4 flex items-center gap-2">
                                <Target className="w-3 h-3" />
                                Candidate Traits ({profile.traits.length})
                            </h3>
                            {profile.traits.length === 0 ? (
                                <div className="p-4 rounded-xl bg-white/5 border border-white/5 text-center">
                                    <p className="text-white/30 text-sm">
                                        No traits defined yet. Describe your ideal candidate.
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {profile.traits.map((trait) => (
                                        <TraitCard
                                            key={trait.id}
                                            trait={trait}
                                            onDelete={onDeleteTrait}
                                        />
                                    ))}
                                </div>
                            )}
                        </section>

                        {/* Interview Stages Section */}
                        <section>
                            <h3 className="text-xs font-bold text-white/40 uppercase tracking-widest mb-4 flex items-center gap-2">
                                <Sparkles className="w-3 h-3" />
                                Interview Stages ({profile.interview_stages.length})
                            </h3>
                            {profile.interview_stages.length === 0 ? (
                                <div className="p-4 rounded-xl bg-white/5 border border-white/5 text-center">
                                    <p className="text-white/30 text-sm">
                                        No interview process defined yet.
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {profile.interview_stages
                                        .sort((a, b) => a.order - b.order)
                                        .map((stage, index) => (
                                            <StageCard
                                                key={stage.id}
                                                stage={stage}
                                                index={index}
                                                onDelete={onDeleteStage}
                                            />
                                        ))}
                                </div>
                            )}
                        </section>

                        {/* Nuances Section */}
                        {profile.nuances.length > 0 && (
                            <section>
                                <h3 className="text-xs font-bold text-white/40 uppercase tracking-widest mb-4 flex items-center gap-2">
                                    <MessageSquare className="w-3 h-3" />
                                    Insights ({profile.nuances.length})
                                </h3>
                                <div className="space-y-2">
                                    {profile.nuances.map((nuance) => (
                                        <NuanceCard key={nuance.id} nuance={nuance} />
                                    ))}
                                </div>
                            </section>
                        )}
                    </div>
                ) : (
                    <div className="p-6">
                        <TranscriptView transcripts={transcripts} />
                    </div>
                )}
            </div>
        </div>
    );
}

// =============================================================================
// Sub-components
// =============================================================================

function RequirementRow({
    icon,
    label,
    value,
    filled,
}: {
    icon: React.ReactNode;
    label: string;
    value?: string;
    filled: boolean;
}) {
    return (
        <div
            className={`flex items-center gap-3 p-3 rounded-xl transition-all ${
                filled ? "bg-white/5" : "bg-white/[0.02] border border-dashed border-white/10"
            }`}
        >
            <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    filled ? "bg-indigo-500/20 text-indigo-400" : "bg-white/5 text-white/20"
                }`}
            >
                {icon}
            </div>
            <div className="flex-1 min-w-0">
                <div className="text-xs text-white/40 uppercase tracking-wider">{label}</div>
                <div
                    className={`text-sm truncate ${
                        filled ? "text-white" : "text-white/30 italic"
                    }`}
                >
                    {value || "Not set"}
                </div>
            </div>
            {filled && <CheckCircle className="w-4 h-4 text-green-400/60 shrink-0" />}
        </div>
    );
}

function TraitCard({
    trait,
    onDelete,
}: {
    trait: CandidateTrait;
    onDelete?: (name: string) => void;
}) {
    return (
        <div className="group p-4 rounded-xl bg-white/5 border border-white/5 hover:bg-white/[0.07] transition-all">
            <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-white">{trait.name}</span>
                        <span
                            className={`text-[10px] px-2 py-0.5 rounded-full border uppercase tracking-wider ${getPriorityColor(
                                trait.priority
                            )}`}
                        >
                            {formatPriority(trait.priority)}
                        </span>
                    </div>
                    <p className="text-xs text-white/50 leading-relaxed">{trait.description}</p>
                    {trait.signals && trait.signals.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                            {trait.signals.slice(0, 3).map((signal, i) => (
                                <span
                                    key={i}
                                    className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-white/40"
                                >
                                    {signal}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
                {onDelete && (
                    <button
                        onClick={() => onDelete(trait.name)}
                        className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-all"
                    >
                        <Trash2 className="w-3 h-3" />
                    </button>
                )}
            </div>
        </div>
    );
}

function StageCard({
    stage,
    index,
    onDelete,
}: {
    stage: InterviewStage;
    index: number;
    onDelete?: (name: string) => void;
}) {
    return (
        <div className="group flex items-center gap-3 p-4 rounded-xl bg-white/5 border border-white/5 hover:bg-white/[0.07] transition-all">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center text-indigo-400 font-bold text-sm">
                {index + 1}
            </div>
            <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-white">{stage.name}</div>
                <p className="text-xs text-white/50 truncate">{stage.description}</p>
                {stage.duration_minutes && (
                    <span className="text-[10px] text-white/30">{stage.duration_minutes} min</span>
                )}
            </div>
            <ChevronRight className="w-4 h-4 text-white/20" />
            {onDelete && (
                <button
                    onClick={() => onDelete(stage.name)}
                    className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-all"
                >
                    <Trash2 className="w-3 h-3" />
                </button>
            )}
        </div>
    );
}

function NuanceCard({ nuance }: { nuance: NuanceCapture }) {
    const categoryColors: Record<string, string> = {
        culture_fit: "bg-purple-500/20 text-purple-300",
        hidden_pref: "bg-blue-500/20 text-blue-300",
        red_flag: "bg-red-500/20 text-red-300",
        selling_point: "bg-green-500/20 text-green-300",
        team_dynamics: "bg-amber-500/20 text-amber-300",
    };

    return (
        <div className="p-4 rounded-xl bg-white/5 border border-white/5">
            <div className="flex items-center gap-2 mb-2">
                <span
                    className={`text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider ${
                        categoryColors[nuance.category] || "bg-gray-500/20 text-gray-300"
                    }`}
                >
                    {nuance.category.replace(/_/g, " ")}
                </span>
            </div>
            <p className="text-sm text-white/70">{nuance.insight}</p>
            {nuance.verbatim_quote && (
                <p className="mt-2 text-xs text-white/40 italic border-l-2 border-white/10 pl-3">
                    "{nuance.verbatim_quote}"
                </p>
            )}
        </div>
    );
}

function TranscriptView({
    transcripts,
}: {
    transcripts: Array<{ speaker: "agent" | "user"; text: string }>;
}) {
    if (transcripts.length === 0) {
        return (
            <div className="h-full flex items-center justify-center text-center p-8">
                <div>
                    <MessageSquare className="w-12 h-12 text-white/10 mx-auto mb-4" />
                    <p className="text-white/30 text-sm">Conversation will appear here...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {transcripts.map((t, i) => (
                <div
                    key={i}
                    className={`flex gap-3 ${t.speaker === "user" ? "flex-row-reverse" : ""}`}
                >
                    <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                            t.speaker === "agent"
                                ? "bg-indigo-500/20 text-indigo-400"
                                : "bg-purple-500/20 text-purple-400"
                        }`}
                    >
                        {t.speaker === "agent" ? "AI" : "You"}
                    </div>
                    <div
                        className={`max-w-[80%] p-3 rounded-2xl text-sm ${
                            t.speaker === "agent"
                                ? "bg-white/5 text-white/80 rounded-tl-sm"
                                : "bg-indigo-500/20 text-white rounded-tr-sm"
                        }`}
                    >
                        {t.text}
                    </div>
                </div>
            ))}
        </div>
    );
}
