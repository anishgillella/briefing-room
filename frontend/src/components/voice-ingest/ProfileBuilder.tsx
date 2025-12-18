"use client";

import { useState, useCallback } from "react";
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
    Plus,
    X,
    Edit2,
    Save,
    ChevronDown,
    ChevronUp,
    UserCheck,
    TrendingUp,
    AlertTriangle,
    Zap,
    Building2,
} from "lucide-react";
import {
    JobProfile,
    CandidateTrait,
    InterviewStage,
    NuanceCapture,
    HardRequirements,
    formatLocation,
    formatCompensation,
    formatExperience,
    formatPriority,
    getPriorityColor,
    updateRequirements,
    createTrait,
    updateTrait,
    deleteTrait,
    createInterviewStage,
    updateInterviewStage,
    deleteInterviewStage,
    getProfile,
} from "@/lib/voiceIngestApi";

interface ProfileBuilderProps {
    profile: JobProfile;
    completionPercentage: number;
    missingFields: string[];
    transcripts: Array<{ speaker: "agent" | "user"; text: string }>;
    sessionId: string;
    onProfileUpdate?: (profile: JobProfile) => void;
    onDeleteTrait?: (traitName: string) => void;
    onDeleteStage?: (stageName: string) => void;
}

export default function ProfileBuilder({
    profile,
    completionPercentage,
    missingFields,
    transcripts,
    sessionId,
    onProfileUpdate,
    onDeleteTrait,
    onDeleteStage,
}: ProfileBuilderProps) {
    const [activeTab, setActiveTab] = useState<"profile" | "transcript">("profile");
    const [isAddingTrait, setIsAddingTrait] = useState(false);
    const [isAddingStage, setIsAddingStage] = useState(false);

    const isComplete = completionPercentage >= 100;

    // Refresh profile after updates
    const refreshProfile = useCallback(async () => {
        try {
            const data = await getProfile(sessionId);
            onProfileUpdate?.(data.profile);
        } catch (err) {
            console.error("Failed to refresh profile:", err);
        }
    }, [sessionId, onProfileUpdate]);

    // Handle requirement updates
    const handleRequirementUpdate = async (updates: Partial<HardRequirements>) => {
        try {
            await updateRequirements(sessionId, updates);
            await refreshProfile();
        } catch (err) {
            console.error("Failed to update requirement:", err);
        }
    };

    // Handle trait operations
    const handleCreateTrait = async (trait: { name: string; description: string; priority: string }) => {
        try {
            await createTrait(sessionId, trait);
            await refreshProfile();
            setIsAddingTrait(false);
        } catch (err) {
            console.error("Failed to create trait:", err);
        }
    };

    const handleUpdateTrait = async (traitId: string, updates: Partial<CandidateTrait>) => {
        try {
            await updateTrait(sessionId, traitId, updates);
            await refreshProfile();
        } catch (err) {
            console.error("Failed to update trait:", err);
        }
    };

    const handleDeleteTrait = async (traitId: string) => {
        try {
            await deleteTrait(sessionId, traitId);
            await refreshProfile();
        } catch (err) {
            console.error("Failed to delete trait:", err);
        }
    };

    // Handle interview stage operations
    const handleCreateStage = async (stage: { name: string; description: string; duration_minutes?: number }) => {
        try {
            await createInterviewStage(sessionId, stage);
            await refreshProfile();
            setIsAddingStage(false);
        } catch (err) {
            console.error("Failed to create stage:", err);
        }
    };

    const handleUpdateStage = async (stageId: string, updates: Partial<InterviewStage>) => {
        try {
            await updateInterviewStage(sessionId, stageId, updates);
            await refreshProfile();
        } catch (err) {
            console.error("Failed to update stage:", err);
        }
    };

    const handleDeleteStage = async (stageId: string) => {
        try {
            await deleteInterviewStage(sessionId, stageId);
            await refreshProfile();
        } catch (err) {
            console.error("Failed to delete stage:", err);
        }
    };

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
                        {/* Hard Requirements Section */}
                        <section>
                            <h3 className="text-xs font-bold text-white/40 uppercase tracking-widest mb-4 flex items-center gap-2">
                                <Briefcase className="w-3 h-3" />
                                Hard Requirements
                            </h3>
                            <div className="space-y-3">
                                <EditableRequirementRow
                                    icon={<Briefcase className="w-4 h-4" />}
                                    label="Title"
                                    value={profile.requirements.job_title}
                                    fieldKey="job_title"
                                    type="text"
                                    onSave={(value) => handleRequirementUpdate({ job_title: value as string })}
                                />
                                <EditableRequirementRow
                                    icon={<MapPin className="w-4 h-4" />}
                                    label="Location"
                                    value={profile.requirements.location_type}
                                    displayValue={formatLocation(profile.requirements)}
                                    fieldKey="location_type"
                                    type="select"
                                    options={[
                                        { value: "remote", label: "Remote" },
                                        { value: "hybrid", label: "Hybrid" },
                                        { value: "onsite", label: "On-site" },
                                    ]}
                                    onSave={(value) => handleRequirementUpdate({ location_type: value as string })}
                                />
                                <EditableRequirementRow
                                    icon={<Clock className="w-4 h-4" />}
                                    label="Experience"
                                    value={profile.requirements.experience_min_years}
                                    displayValue={formatExperience(profile.requirements)}
                                    fieldKey="experience_min_years"
                                    type="number"
                                    placeholder="Min years"
                                    onSave={(value) => handleRequirementUpdate({ experience_min_years: value ? Number(value) : undefined })}
                                />
                                <EditableRequirementRow
                                    icon={<DollarSign className="w-4 h-4" />}
                                    label="Compensation"
                                    value={profile.requirements.salary_min}
                                    displayValue={formatCompensation(profile.requirements)}
                                    fieldKey="salary_min"
                                    type="number"
                                    placeholder="Min salary"
                                    onSave={(value) => handleRequirementUpdate({ salary_min: value ? Number(value) : undefined })}
                                />
                                <EditableRequirementRow
                                    icon={<Users className="w-4 h-4" />}
                                    label="Visa Sponsorship"
                                    value={profile.requirements.visa_sponsorship}
                                    displayValue={
                                        profile.requirements.visa_sponsorship === true
                                            ? "Yes, will sponsor"
                                            : profile.requirements.visa_sponsorship === false
                                            ? "No sponsorship"
                                            : undefined
                                    }
                                    fieldKey="visa_sponsorship"
                                    type="select"
                                    options={[
                                        { value: "true", label: "Yes, will sponsor" },
                                        { value: "false", label: "No sponsorship" },
                                    ]}
                                    onSave={(value) => handleRequirementUpdate({ visa_sponsorship: value === "true" })}
                                />
                                <EditableRequirementRow
                                    icon={<DollarSign className="w-4 h-4" />}
                                    label="Equity"
                                    value={profile.requirements.equity_offered}
                                    displayValue={
                                        profile.requirements.equity_offered === true
                                            ? profile.requirements.equity_range || "Yes, offered"
                                            : profile.requirements.equity_offered === false
                                            ? "No equity"
                                            : undefined
                                    }
                                    fieldKey="equity_offered"
                                    type="select"
                                    options={[
                                        { value: "true", label: "Yes, equity offered" },
                                        { value: "false", label: "No equity" },
                                    ]}
                                    onSave={(value) => handleRequirementUpdate({ equity_offered: value === "true" })}
                                />
                            </div>
                        </section>

                        {/* Soft Requirements (Traits) Section - Always show */}
                        <section>
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-xs font-bold text-white/40 uppercase tracking-widest flex items-center gap-2">
                                    <Target className="w-3 h-3" />
                                    Soft Requirements ({profile.traits.length})
                                </h3>
                                <button
                                    onClick={() => setIsAddingTrait(true)}
                                    className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-all"
                                >
                                    <Plus className="w-4 h-4" />
                                </button>
                            </div>

                            {isAddingTrait && (
                                <AddTraitForm
                                    onSave={handleCreateTrait}
                                    onCancel={() => setIsAddingTrait(false)}
                                />
                            )}

                            {profile.traits.length === 0 && !isAddingTrait ? (
                                <div className="p-4 rounded-xl bg-white/5 border border-white/5 text-center">
                                    <p className="text-white/30 text-sm">
                                        Traits will appear here as you describe your ideal candidate
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {profile.traits.map((trait) => (
                                        <EditableTraitCard
                                            key={trait.id}
                                            trait={trait}
                                            onUpdate={(updates) => handleUpdateTrait(trait.id, updates)}
                                            onDelete={() => handleDeleteTrait(trait.id)}
                                        />
                                    ))}
                                </div>
                            )}
                        </section>

                        {/* Team Context Section - Always show */}
                        <section>
                            <h3 className="text-xs font-bold text-white/40 uppercase tracking-widest mb-4 flex items-center gap-2">
                                <Users className="w-3 h-3" />
                                Team Context
                            </h3>
                            {!(profile.requirements.team_size || profile.requirements.reporting_to || profile.requirements.team_composition) ? (
                                <div className="p-4 rounded-xl bg-white/5 border border-white/5 text-center">
                                    <p className="text-white/30 text-sm">Team info will appear here</p>
                                </div>
                            ) : (
                                <div className="space-y-2 text-sm">
                                    {profile.requirements.team_size && (
                                        <div className="flex items-center justify-between py-2 border-b border-white/5">
                                            <span className="text-white/50">Team Size</span>
                                            <span className="text-white">{profile.requirements.team_size} people</span>
                                        </div>
                                    )}
                                    {profile.requirements.team_composition && (
                                        <div className="flex items-center justify-between py-2 border-b border-white/5">
                                            <span className="text-white/50">Composition</span>
                                            <span className="text-white">{profile.requirements.team_composition}</span>
                                        </div>
                                    )}
                                    {profile.requirements.team_seniority && (
                                        <div className="flex items-center justify-between py-2 border-b border-white/5">
                                            <span className="text-white/50">Seniority</span>
                                            <span className="text-white">{profile.requirements.team_seniority.replace(/_/g, ' ')}</span>
                                        </div>
                                    )}
                                    {profile.requirements.reporting_to && (
                                        <div className="flex items-center justify-between py-2 border-b border-white/5">
                                            <span className="text-white/50">Reports To</span>
                                            <span className="text-white">{profile.requirements.reporting_to}</span>
                                        </div>
                                    )}
                                    {profile.requirements.direct_reports !== undefined && profile.requirements.direct_reports > 0 && (
                                        <div className="flex items-center justify-between py-2 border-b border-white/5">
                                            <span className="text-white/50">Direct Reports</span>
                                            <span className="text-white">{profile.requirements.direct_reports}</span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </section>

                        {/* Role Context Section - Always show */}
                        <section>
                            <h3 className="text-xs font-bold text-white/40 uppercase tracking-widest mb-4 flex items-center gap-2">
                                <TrendingUp className="w-3 h-3" />
                                Role Context
                            </h3>
                            {!(profile.requirements.hiring_urgency || profile.requirements.success_metrics_30_day || profile.requirements.success_metrics_90_day || profile.requirements.growth_path) ? (
                                <div className="p-4 rounded-xl bg-white/5 border border-white/5 text-center">
                                    <p className="text-white/30 text-sm">Urgency, success metrics & growth path will appear here</p>
                                </div>
                            ) : (
                                <div className="space-y-2 text-sm">
                                    {profile.requirements.hiring_urgency && (
                                        <div className="flex items-center justify-between py-2 border-b border-white/5">
                                            <span className="text-white/50">Urgency</span>
                                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                                profile.requirements.hiring_urgency === 'asap' ? 'bg-red-500/20 text-red-300' :
                                                profile.requirements.hiring_urgency === 'within_month' ? 'bg-orange-500/20 text-orange-300' :
                                                'bg-green-500/20 text-green-300'
                                            }`}>
                                                {profile.requirements.hiring_urgency.replace(/_/g, ' ').toUpperCase()}
                                            </span>
                                        </div>
                                    )}
                                    {profile.requirements.backfill_reason && (
                                        <div className="py-2 border-b border-white/5">
                                            <span className="text-white/50 text-xs">Backfill Reason</span>
                                            <p className="text-white mt-1">{profile.requirements.backfill_reason}</p>
                                        </div>
                                    )}
                                    {profile.requirements.success_metrics_30_day && (
                                        <div className="py-2 border-b border-white/5">
                                            <span className="text-white/50 text-xs">30-Day Success</span>
                                            <p className="text-white mt-1">{profile.requirements.success_metrics_30_day}</p>
                                        </div>
                                    )}
                                    {profile.requirements.success_metrics_90_day && (
                                        <div className="py-2 border-b border-white/5">
                                            <span className="text-white/50 text-xs">90-Day Success</span>
                                            <p className="text-white mt-1">{profile.requirements.success_metrics_90_day}</p>
                                        </div>
                                    )}
                                    {profile.requirements.growth_path && (
                                        <div className="py-2 border-b border-white/5">
                                            <span className="text-white/50 text-xs">Growth Path</span>
                                            <p className="text-white mt-1">{profile.requirements.growth_path}</p>
                                        </div>
                                    )}
                                    {profile.requirements.interview_turnaround && (
                                        <div className="flex items-center justify-between py-2 border-b border-white/5">
                                            <span className="text-white/50">Interview Speed</span>
                                            <span className="text-white">{profile.requirements.interview_turnaround}</span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </section>

                        {/* Deal Breakers Section - Always show */}
                        <section>
                            <h3 className="text-xs font-bold text-white/40 uppercase tracking-widest mb-4 flex items-center gap-2">
                                <AlertTriangle className="w-3 h-3" />
                                Deal Breakers & Preferences
                            </h3>
                            {!((profile.requirements.deal_breakers && profile.requirements.deal_breakers.length > 0) || profile.requirements.ideal_background) ? (
                                <div className="p-4 rounded-xl bg-white/5 border border-white/5 text-center">
                                    <p className="text-white/30 text-sm">Deal breakers & ideal candidate will appear here</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {profile.requirements.ideal_background && (
                                        <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                                            <span className="text-green-400 text-xs font-medium">IDEAL BACKGROUND</span>
                                            <p className="text-white text-sm mt-1">{profile.requirements.ideal_background}</p>
                                        </div>
                                    )}
                                    {profile.requirements.deal_breakers && profile.requirements.deal_breakers.length > 0 && (
                                        <div className="space-y-2">
                                            {profile.requirements.deal_breakers.map((breaker, idx) => (
                                                <div key={idx} className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                                                    <span className="text-red-400 text-xs font-medium">DEAL BREAKER</span>
                                                    <p className="text-white text-sm mt-1">{breaker}</p>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </section>

                        {/* Engineering Culture Section - Always show */}
                        <section>
                            <h3 className="text-xs font-bold text-white/40 uppercase tracking-widest mb-4 flex items-center gap-2">
                                <Building2 className="w-3 h-3" />
                                Engineering Culture
                            </h3>
                            {!(profile.company && (profile.company.work_style || profile.company.deployment_frequency || profile.company.code_review_culture)) ? (
                                <div className="p-4 rounded-xl bg-white/5 border border-white/5 text-center">
                                    <p className="text-white/30 text-sm">Engineering culture details will appear here</p>
                                </div>
                            ) : (
                                <div className="space-y-2 text-sm">
                                    {profile.company?.work_style && (
                                        <div className="flex items-center justify-between py-2 border-b border-white/5">
                                            <span className="text-white/50">Work Style</span>
                                            <span className="text-white">{profile.company.work_style}</span>
                                        </div>
                                    )}
                                    {profile.company?.decision_making && (
                                        <div className="flex items-center justify-between py-2 border-b border-white/5">
                                            <span className="text-white/50">Decision Making</span>
                                            <span className="text-white">{profile.company.decision_making}</span>
                                        </div>
                                    )}
                                    {profile.company?.deployment_frequency && (
                                        <div className="flex items-center justify-between py-2 border-b border-white/5">
                                            <span className="text-white/50">Deployment</span>
                                            <span className="text-white">{profile.company.deployment_frequency}</span>
                                        </div>
                                    )}
                                    {profile.company?.code_review_culture && (
                                        <div className="flex items-center justify-between py-2 border-b border-white/5">
                                            <span className="text-white/50">Code Review</span>
                                            <span className="text-white">{profile.company.code_review_culture}</span>
                                        </div>
                                    )}
                                    {profile.company?.on_call_expectations && (
                                        <div className="py-2 border-b border-white/5">
                                            <span className="text-white/50 text-xs">On-Call</span>
                                            <p className="text-white mt-1">{profile.company.on_call_expectations}</p>
                                        </div>
                                    )}
                                    {profile.company?.growth_trajectory && (
                                        <div className="flex items-center justify-between py-2 border-b border-white/5">
                                            <span className="text-white/50">Growth</span>
                                            <span className="text-white">{profile.company.growth_trajectory}</span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </section>

                        {/* Interview Stages Section - Always show */}
                        <section>
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-xs font-bold text-white/40 uppercase tracking-widest flex items-center gap-2">
                                    <Sparkles className="w-3 h-3" />
                                    Interview Stages ({profile.interview_stages.length})
                                </h3>
                                <button
                                    onClick={() => setIsAddingStage(true)}
                                    className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-all"
                                >
                                    <Plus className="w-4 h-4" />
                                </button>
                            </div>

                            {isAddingStage && (
                                <AddStageForm
                                    onSave={handleCreateStage}
                                    onCancel={() => setIsAddingStage(false)}
                                />
                            )}

                            {profile.interview_stages.length === 0 && !isAddingStage ? (
                                <div className="p-4 rounded-xl bg-white/5 border border-white/5 text-center">
                                    <p className="text-white/30 text-sm">
                                        Interview stages will appear here as you describe the process
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {profile.interview_stages
                                        .sort((a, b) => a.order - b.order)
                                        .map((stage, index) => (
                                            <EditableStageCard
                                                key={stage.id}
                                                stage={stage}
                                                index={index}
                                                onUpdate={(updates) => handleUpdateStage(stage.id, updates)}
                                                onDelete={() => handleDeleteStage(stage.id)}
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

                        {/* Skipped Fields Section */}
                        {profile.skipped_fields && profile.skipped_fields.length > 0 && (
                            <section>
                                <h3 className="text-xs font-bold text-white/40 uppercase tracking-widest mb-4 flex items-center gap-2">
                                    <ChevronRight className="w-3 h-3" />
                                    Skipped ({profile.skipped_fields.length})
                                </h3>
                                <div className="flex flex-wrap gap-2">
                                    {profile.skipped_fields.map((field, idx) => (
                                        <span
                                            key={idx}
                                            className="px-2 py-1 text-xs rounded bg-white/5 text-white/40 border border-white/10"
                                        >
                                            {field.replace(/_/g, ' ')}
                                        </span>
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
// Editable Requirement Row
// =============================================================================

function EditableRequirementRow({
    icon,
    label,
    value,
    displayValue,
    fieldKey,
    type,
    options,
    placeholder,
    onSave,
}: {
    icon: React.ReactNode;
    label: string;
    value?: string | number | boolean;
    displayValue?: string;
    fieldKey: string;
    type: "text" | "number" | "select";
    options?: { value: string; label: string }[];
    placeholder?: string;
    onSave: (value: string | number | undefined) => void;
}) {
    const [isEditing, setIsEditing] = useState(false);
    const [editValue, setEditValue] = useState(String(value ?? ""));
    const filled = value !== undefined && value !== null && value !== "";

    const handleSave = () => {
        if (type === "number") {
            onSave(editValue ? Number(editValue) : undefined);
        } else {
            onSave(editValue || undefined);
        }
        setIsEditing(false);
    };

    const handleCancel = () => {
        setEditValue(String(value ?? ""));
        setIsEditing(false);
    };

    const display = displayValue || (value !== undefined && value !== null ? String(value) : "Not set");

    return (
        <div
            className={`flex items-center gap-3 p-3 rounded-xl transition-all cursor-pointer group ${
                filled ? "bg-white/5" : "bg-white/[0.02] border border-dashed border-white/10"
            }`}
            onClick={() => !isEditing && setIsEditing(true)}
        >
            <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    filled ? "bg-indigo-500/20 text-indigo-400" : "bg-white/5 text-white/20"
                }`}
            >
                {icon}
            </div>
            <div className="flex-1 min-w-0">
                <div className="text-xs text-white/40 uppercase tracking-wider">{label}</div>
                {isEditing ? (
                    <div className="flex items-center gap-2 mt-1" onClick={(e) => e.stopPropagation()}>
                        {type === "select" ? (
                            <select
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                className="flex-1 bg-white/10 border border-white/20 rounded-lg px-2 py-1 text-sm text-white focus:outline-none focus:border-indigo-500"
                                autoFocus
                            >
                                <option value="">Select...</option>
                                {options?.map((opt) => (
                                    <option key={opt.value} value={opt.value}>
                                        {opt.label}
                                    </option>
                                ))}
                            </select>
                        ) : (
                            <input
                                type={type}
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                placeholder={placeholder || label}
                                className="flex-1 bg-white/10 border border-white/20 rounded-lg px-2 py-1 text-sm text-white placeholder-white/30 focus:outline-none focus:border-indigo-500"
                                autoFocus
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") handleSave();
                                    if (e.key === "Escape") handleCancel();
                                }}
                            />
                        )}
                        <button
                            onClick={handleSave}
                            className="p-1 rounded text-green-400 hover:bg-green-500/20"
                        >
                            <Save className="w-4 h-4" />
                        </button>
                        <button
                            onClick={handleCancel}
                            className="p-1 rounded text-white/40 hover:bg-white/10"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                ) : (
                    <div
                        className={`text-sm truncate ${
                            filled ? "text-white" : "text-white/30 italic"
                        }`}
                    >
                        {display}
                    </div>
                )}
            </div>
            {!isEditing && filled && <CheckCircle className="w-4 h-4 text-green-400/60 shrink-0" />}
            {!isEditing && (
                <Edit2 className="w-4 h-4 text-white/20 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
            )}
        </div>
    );
}

// =============================================================================
// Add Trait Form
// =============================================================================

function AddTraitForm({
    onSave,
    onCancel,
}: {
    onSave: (trait: { name: string; description: string; priority: string }) => void;
    onCancel: () => void;
}) {
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [priority, setPriority] = useState("must_have");

    const handleSubmit = () => {
        if (!name.trim()) return;
        onSave({ name: name.trim(), description: description.trim(), priority });
    };

    return (
        <div className="mb-3 p-4 rounded-xl bg-white/5 border border-white/10 space-y-3">
            <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Trait name"
                className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-indigo-500"
                autoFocus
            />
            <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Description"
                rows={2}
                className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-indigo-500 resize-none"
            />
            <div className="flex items-center gap-2">
                <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    className="flex-1 bg-white/10 border border-white/20 rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                >
                    <option value="must_have">Must Have</option>
                    <option value="strong_preference">Strong Preference</option>
                    <option value="nice_to_have">Nice to Have</option>
                </select>
                <button
                    onClick={handleSubmit}
                    disabled={!name.trim()}
                    className="px-3 py-1.5 rounded-lg bg-indigo-500 text-white text-sm font-medium hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    Add
                </button>
                <button
                    onClick={onCancel}
                    className="px-3 py-1.5 rounded-lg bg-white/10 text-white/70 text-sm hover:bg-white/20"
                >
                    Cancel
                </button>
            </div>
        </div>
    );
}

// =============================================================================
// Editable Trait Card
// =============================================================================

function EditableTraitCard({
    trait,
    onUpdate,
    onDelete,
}: {
    trait: CandidateTrait;
    onUpdate: (updates: Partial<CandidateTrait>) => void;
    onDelete: () => void;
}) {
    const [isExpanded, setIsExpanded] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editName, setEditName] = useState(trait.name);
    const [editDescription, setEditDescription] = useState(trait.description);
    const [editPriority, setEditPriority] = useState(trait.priority);

    const handleSave = () => {
        onUpdate({
            name: editName,
            description: editDescription,
            priority: editPriority,
        });
        setIsEditing(false);
    };

    const handleCancel = () => {
        setEditName(trait.name);
        setEditDescription(trait.description);
        setEditPriority(trait.priority);
        setIsEditing(false);
    };

    return (
        <div className="group p-4 rounded-xl bg-white/5 border border-white/5 hover:bg-white/[0.07] transition-all">
            <div className="flex items-start justify-between gap-3">
                <div
                    className="flex-1 min-w-0 cursor-pointer"
                    onClick={() => setIsExpanded(!isExpanded)}
                >
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-white">{trait.name}</span>
                        <span
                            className={`text-[10px] px-2 py-0.5 rounded-full border uppercase tracking-wider ${getPriorityColor(
                                trait.priority
                            )}`}
                        >
                            {formatPriority(trait.priority)}
                        </span>
                        {isExpanded ? (
                            <ChevronUp className="w-3 h-3 text-white/30" />
                        ) : (
                            <ChevronDown className="w-3 h-3 text-white/30" />
                        )}
                    </div>
                    <p className="text-xs text-white/50 leading-relaxed line-clamp-2">{trait.description}</p>
                </div>
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => {
                            setIsExpanded(true);
                            setIsEditing(true);
                        }}
                        className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 text-white/30 hover:text-indigo-400 hover:bg-indigo-500/10 transition-all"
                    >
                        <Edit2 className="w-3 h-3" />
                    </button>
                    <button
                        onClick={onDelete}
                        className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-all"
                    >
                        <Trash2 className="w-3 h-3" />
                    </button>
                </div>
            </div>

            {isExpanded && (
                <div className="mt-3 pt-3 border-t border-white/10">
                    {isEditing ? (
                        <div className="space-y-3">
                            <input
                                type="text"
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                            />
                            <textarea
                                value={editDescription}
                                onChange={(e) => setEditDescription(e.target.value)}
                                rows={3}
                                className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 resize-none"
                            />
                            <div className="flex items-center gap-2">
                                <select
                                    value={editPriority}
                                    onChange={(e) => setEditPriority(e.target.value as typeof editPriority)}
                                    className="flex-1 bg-white/10 border border-white/20 rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                                >
                                    <option value="must_have">Must Have</option>
                                    <option value="strong_preference">Strong Preference</option>
                                    <option value="nice_to_have">Nice to Have</option>
                                </select>
                                <button
                                    onClick={handleSave}
                                    className="px-3 py-1.5 rounded-lg bg-indigo-500 text-white text-sm font-medium hover:bg-indigo-600"
                                >
                                    Save
                                </button>
                                <button
                                    onClick={handleCancel}
                                    className="px-3 py-1.5 rounded-lg bg-white/10 text-white/70 text-sm hover:bg-white/20"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    ) : (
                        <>
                            <p className="text-xs text-white/50 leading-relaxed">{trait.description}</p>
                            {trait.signals && trait.signals.length > 0 && (
                                <div className="mt-2 flex flex-wrap gap-1">
                                    {trait.signals.map((signal, i) => (
                                        <span
                                            key={i}
                                            className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-white/40"
                                        >
                                            {signal}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}
        </div>
    );
}

// =============================================================================
// Add Stage Form
// =============================================================================

function AddStageForm({
    onSave,
    onCancel,
}: {
    onSave: (stage: { name: string; description: string; duration_minutes?: number }) => void;
    onCancel: () => void;
}) {
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [duration, setDuration] = useState("");

    const handleSubmit = () => {
        if (!name.trim()) return;
        onSave({
            name: name.trim(),
            description: description.trim(),
            duration_minutes: duration ? Number(duration) : undefined,
        });
    };

    return (
        <div className="mb-3 p-4 rounded-xl bg-white/5 border border-white/10 space-y-3">
            <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Stage name (e.g., Technical Interview)"
                className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-indigo-500"
                autoFocus
            />
            <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Description"
                rows={2}
                className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-indigo-500 resize-none"
            />
            <div className="flex items-center gap-2">
                <input
                    type="number"
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    placeholder="Duration (min)"
                    className="w-32 bg-white/10 border border-white/20 rounded-lg px-2 py-1.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-indigo-500"
                />
                <div className="flex-1" />
                <button
                    onClick={handleSubmit}
                    disabled={!name.trim()}
                    className="px-3 py-1.5 rounded-lg bg-indigo-500 text-white text-sm font-medium hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    Add
                </button>
                <button
                    onClick={onCancel}
                    className="px-3 py-1.5 rounded-lg bg-white/10 text-white/70 text-sm hover:bg-white/20"
                >
                    Cancel
                </button>
            </div>
        </div>
    );
}

// =============================================================================
// Editable Stage Card
// =============================================================================

function EditableStageCard({
    stage,
    index,
    onUpdate,
    onDelete,
}: {
    stage: InterviewStage;
    index: number;
    onUpdate: (updates: Partial<InterviewStage>) => void;
    onDelete: () => void;
}) {
    const [isExpanded, setIsExpanded] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editName, setEditName] = useState(stage.name);
    const [editDescription, setEditDescription] = useState(stage.description);
    const [editDuration, setEditDuration] = useState(String(stage.duration_minutes || ""));

    const handleSave = () => {
        onUpdate({
            name: editName,
            description: editDescription,
            duration_minutes: editDuration ? Number(editDuration) : undefined,
        });
        setIsEditing(false);
    };

    const handleCancel = () => {
        setEditName(stage.name);
        setEditDescription(stage.description);
        setEditDuration(String(stage.duration_minutes || ""));
        setIsEditing(false);
    };

    return (
        <div className="group flex items-start gap-3 p-4 rounded-xl bg-white/5 border border-white/5 hover:bg-white/[0.07] transition-all">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center text-indigo-400 font-bold text-sm shrink-0">
                {index + 1}
            </div>
            <div className="flex-1 min-w-0">
                <div
                    className="cursor-pointer"
                    onClick={() => setIsExpanded(!isExpanded)}
                >
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white">{stage.name}</span>
                        {stage.duration_minutes && (
                            <span className="text-[10px] text-white/30">{stage.duration_minutes} min</span>
                        )}
                        {isExpanded ? (
                            <ChevronUp className="w-3 h-3 text-white/30" />
                        ) : (
                            <ChevronDown className="w-3 h-3 text-white/30" />
                        )}
                    </div>
                    <p className="text-xs text-white/50 truncate">{stage.description}</p>
                </div>

                {isExpanded && (
                    <div className="mt-3 pt-3 border-t border-white/10">
                        {isEditing ? (
                            <div className="space-y-3">
                                <input
                                    type="text"
                                    value={editName}
                                    onChange={(e) => setEditName(e.target.value)}
                                    className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                                />
                                <textarea
                                    value={editDescription}
                                    onChange={(e) => setEditDescription(e.target.value)}
                                    rows={2}
                                    className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 resize-none"
                                />
                                <div className="flex items-center gap-2">
                                    <input
                                        type="number"
                                        value={editDuration}
                                        onChange={(e) => setEditDuration(e.target.value)}
                                        placeholder="Duration (min)"
                                        className="w-32 bg-white/10 border border-white/20 rounded-lg px-2 py-1.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-indigo-500"
                                    />
                                    <div className="flex-1" />
                                    <button
                                        onClick={handleSave}
                                        className="px-3 py-1.5 rounded-lg bg-indigo-500 text-white text-sm font-medium hover:bg-indigo-600"
                                    >
                                        Save
                                    </button>
                                    <button
                                        onClick={handleCancel}
                                        className="px-3 py-1.5 rounded-lg bg-white/10 text-white/70 text-sm hover:bg-white/20"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <p className="text-xs text-white/50 leading-relaxed">{stage.description}</p>
                        )}
                    </div>
                )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
                <button
                    onClick={() => {
                        setIsExpanded(true);
                        setIsEditing(true);
                    }}
                    className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 text-white/30 hover:text-indigo-400 hover:bg-indigo-500/10 transition-all"
                >
                    <Edit2 className="w-3 h-3" />
                </button>
                <button
                    onClick={onDelete}
                    className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-all"
                >
                    <Trash2 className="w-3 h-3" />
                </button>
            </div>
        </div>
    );
}

// =============================================================================
// Nuance Card (Read-only)
// =============================================================================

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

// =============================================================================
// Transcript View
// =============================================================================

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
