"use client";

import { useState, useEffect } from "react";
import { Briefcase, Building2, MapPin, Users, Target, ChevronDown, CheckCircle, Plus, Loader2 } from "lucide-react";
import { listProfiles, ProfileSummary } from "@/lib/voiceIngestApi";
import Link from "next/link";

interface ProfileSelectorProps {
    selectedProfileId: string | null;
    onSelect: (profileId: string | null) => void;
    showCreateOption?: boolean;
}

export default function ProfileSelector({
    selectedProfileId,
    onSelect,
    showCreateOption = true,
}: ProfileSelectorProps) {
    const [profiles, setProfiles] = useState<ProfileSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        loadProfiles();
    }, []);

    const loadProfiles = async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await listProfiles(false); // Get all profiles
            setProfiles(response.profiles);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load profiles");
        } finally {
            setLoading(false);
        }
    };

    const selectedProfile = profiles.find((p) => p.id === selectedProfileId);

    const handleSelect = (profileId: string | null) => {
        onSelect(profileId);
        setIsOpen(false);
    };

    if (loading) {
        return (
            <div className="glass-card-premium p-4 rounded-2xl">
                <div className="flex items-center gap-3 text-white/50">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm">Loading job profiles...</span>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="glass-card-premium p-4 rounded-2xl border border-red-500/20">
                <p className="text-red-400 text-sm">{error}</p>
                <button
                    onClick={loadProfiles}
                    className="mt-2 text-xs text-white/50 hover:text-white underline"
                >
                    Try again
                </button>
            </div>
        );
    }

    return (
        <div className="relative">
            {/* Selected Profile Display / Trigger */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full glass-card-premium p-4 rounded-2xl text-left hover:bg-white/[0.07] transition-all"
            >
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div
                            className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                                selectedProfile
                                    ? "bg-indigo-500/20 text-indigo-400"
                                    : "bg-white/10 text-white/40"
                            }`}
                        >
                            <Briefcase className="w-5 h-5" />
                        </div>
                        <div>
                            {selectedProfile ? (
                                <>
                                    <div className="text-white font-medium">
                                        {selectedProfile.job_title || "Untitled Role"}
                                    </div>
                                    <div className="text-white/40 text-sm flex items-center gap-2">
                                        {selectedProfile.company_name && (
                                            <span className="flex items-center gap-1">
                                                <Building2 className="w-3 h-3" />
                                                {selectedProfile.company_name}
                                            </span>
                                        )}
                                        <span className="flex items-center gap-1">
                                            <Target className="w-3 h-3" />
                                            {selectedProfile.traits_count} traits
                                        </span>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="text-white/70">No job profile selected</div>
                                    <div className="text-white/40 text-sm">
                                        Select a profile or paste JD below
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                    <ChevronDown
                        className={`w-5 h-5 text-white/40 transition-transform ${
                            isOpen ? "rotate-180" : ""
                        }`}
                    />
                </div>
            </button>

            {/* Dropdown */}
            {isOpen && (
                <div className="absolute top-full left-0 right-0 mt-2 z-50 rounded-2xl overflow-hidden shadow-2xl border border-white/20 animate-fade-in bg-[#1a1a2e]">
                    <div className="max-h-[400px] overflow-y-auto custom-scrollbar bg-[#1a1a2e]">
                        {/* No Profile Option */}
                        <button
                            onClick={() => handleSelect(null)}
                            className={`w-full p-4 text-left hover:bg-white/10 transition-all flex items-center gap-3 border-b border-white/10 ${
                                !selectedProfileId ? "bg-indigo-500/20" : ""
                            }`}
                        >
                            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center text-white/60">
                                <Briefcase className="w-5 h-5" />
                            </div>
                            <div className="flex-1">
                                <div className="text-white">No profile - use JD only</div>
                                <div className="text-white/60 text-xs">
                                    Paste a job description manually
                                </div>
                            </div>
                            {!selectedProfileId && <CheckCircle className="w-5 h-5 text-green-400" />}
                        </button>

                        {/* Profile List */}
                        {profiles.length === 0 ? (
                            <div className="p-6 text-center bg-[#1a1a2e]">
                                <Users className="w-10 h-10 text-white/40 mx-auto mb-3" />
                                <p className="text-white/60 text-sm">No job profiles yet</p>
                                {showCreateOption && (
                                    <Link
                                        href="/onboard"
                                        className="inline-flex items-center gap-2 mt-4 px-4 py-2 rounded-full bg-indigo-500/20 text-indigo-300 text-sm hover:bg-indigo-500/30 transition-all"
                                    >
                                        <Plus className="w-4 h-4" />
                                        Create Profile
                                    </Link>
                                )}
                            </div>
                        ) : (
                            profiles.map((profile) => (
                                <button
                                    key={profile.id}
                                    onClick={() => handleSelect(profile.id)}
                                    className={`w-full p-4 text-left hover:bg-white/10 transition-all flex items-center gap-3 border-b border-white/10 last:border-0 ${
                                        selectedProfileId === profile.id ? "bg-indigo-500/20" : ""
                                    }`}
                                >
                                    <div
                                        className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                                            profile.is_complete
                                                ? "bg-green-500/20 text-green-400"
                                                : "bg-amber-500/20 text-amber-400"
                                        }`}
                                    >
                                        <Briefcase className="w-5 h-5" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="text-white font-semibold truncate">
                                                {profile.job_title || "Untitled Role"}
                                            </span>
                                            {profile.is_complete ? (
                                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/20 text-green-300">
                                                    Complete
                                                </span>
                                            ) : (
                                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300">
                                                    {profile.completion_percentage.toFixed(0)}%
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-white/60 text-xs flex items-center gap-3 mt-0.5">
                                            {profile.company_name && (
                                                <span className="flex items-center gap-1">
                                                    <Building2 className="w-3 h-3" />
                                                    {profile.company_name}
                                                </span>
                                            )}
                                            {profile.location && (
                                                <span className="flex items-center gap-1">
                                                    <MapPin className="w-3 h-3" />
                                                    {profile.location}
                                                </span>
                                            )}
                                            <span className="flex items-center gap-1">
                                                <Target className="w-3 h-3" />
                                                {profile.must_have_count} must-have
                                            </span>
                                        </div>
                                    </div>
                                    {selectedProfileId === profile.id && (
                                        <CheckCircle className="w-5 h-5 text-green-400 shrink-0" />
                                    )}
                                </button>
                            ))
                        )}

                        {/* Create New Profile Link */}
                        {showCreateOption && profiles.length > 0 && (
                            <Link
                                href="/onboard"
                                className="flex items-center gap-3 p-4 text-indigo-300 hover:bg-indigo-500/20 transition-all border-t border-white/20 bg-[#1a1a2e]"
                            >
                                <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center">
                                    <Plus className="w-5 h-5" />
                                </div>
                                <span className="font-medium">Create New Profile</span>
                            </Link>
                        )}
                    </div>
                </div>
            )}

            {/* Selected Profile Badge (outside dropdown) */}
            {selectedProfile && !isOpen && (
                <div className="mt-3 flex items-center gap-2 text-xs">
                    {selectedProfile.is_complete ? (
                        <span className="flex items-center gap-1 text-green-400">
                            <CheckCircle className="w-3 h-3" />
                            Complete profile will be used for scoring
                        </span>
                    ) : (
                        <span className="flex items-center gap-1 text-amber-400">
                            Profile is {selectedProfile.completion_percentage.toFixed(0)}% complete - some scoring context may be limited
                        </span>
                    )}
                </div>
            )}
        </div>
    );
}
