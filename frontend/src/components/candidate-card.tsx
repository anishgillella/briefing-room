"use client";

import { Candidate, getTierColor, getStatusColor, formatInterviewStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
    Building2,
    MapPin,
    Briefcase,
    TrendingUp,
    AlertTriangle,
    CheckCircle2,
    ChevronRight
} from "lucide-react";

interface CandidateCardProps {
    candidate: Candidate;
    onClick?: () => void;
    selected?: boolean;
}

export default function CandidateCard({ candidate, onClick, selected }: CandidateCardProps) {
    const tierClass = getTierColor(candidate.tier);
    const statusClass = getStatusColor(candidate.interview_status);

    return (
        <div
            onClick={onClick}
            className={cn(
                "group relative rounded-xl border bg-card p-4 transition-all cursor-pointer",
                "hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5",
                selected && "border-primary ring-2 ring-primary/20",
                !selected && "border-border/50"
            )}
        >
            {/* Score Badge - Top Right */}
            <div className="absolute -top-2 -right-2 flex items-center gap-1">
                {candidate.combined_score !== null && (
                    <div className={cn(
                        "px-2.5 py-1 rounded-full text-xs font-bold border",
                        tierClass
                    )}>
                        {candidate.combined_score}
                    </div>
                )}
            </div>

            {/* Header */}
            <div className="flex items-start gap-3 mb-3">
                {/* Avatar */}
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-lg font-semibold text-primary shrink-0">
                    {candidate.name.charAt(0).toUpperCase()}
                </div>

                {/* Name & Title */}
                <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                        {candidate.name}
                    </h3>
                    <p className="text-sm text-muted-foreground truncate">
                        {candidate.job_title || "No title"}
                    </p>
                </div>

                {/* Arrow indicator */}
                <ChevronRight className="w-5 h-5 text-muted-foreground/50 group-hover:text-primary transition-colors shrink-0" />
            </div>

            {/* One-line summary */}
            {candidate.one_line_summary && (
                <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                    {candidate.one_line_summary}
                </p>
            )}

            {/* Meta Info Row */}
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mb-3">
                {candidate.location_city && (
                    <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {candidate.location_city}{candidate.location_state && `, ${candidate.location_state}`}
                    </span>
                )}
                {candidate.years_experience !== null && candidate.years_experience !== undefined && (
                    <span className="flex items-center gap-1">
                        <Briefcase className="w-3 h-3" />
                        {candidate.years_experience} yrs
                    </span>
                )}
                {candidate.current_company && (
                    <span className="flex items-center gap-1">
                        <Building2 className="w-3 h-3" />
                        {candidate.current_company}
                    </span>
                )}
            </div>

            {/* Tags Row */}
            <div className="flex flex-wrap gap-1.5 mb-3">
                {/* Tier Badge */}
                {candidate.tier && (
                    <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium border", tierClass)}>
                        {candidate.tier}
                    </span>
                )}

                {/* Interview Status */}
                {candidate.interview_status !== "not_scheduled" && (
                    <span className={cn("px-2 py-0.5 rounded-full text-xs", statusClass)}>
                        {formatInterviewStatus(candidate.interview_status)}
                    </span>
                )}

                {/* Key signals */}
                {candidate.sold_to_finance && (
                    <span className="px-2 py-0.5 rounded-full text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        Finance Sales
                    </span>
                )}
                {candidate.is_founder && (
                    <span className="px-2 py-0.5 rounded-full text-xs bg-purple-500/10 text-purple-400 border border-purple-500/20">
                        Founder
                    </span>
                )}
            </div>

            {/* Bottom Row - Pros/Cons Preview */}
            <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                    {candidate.pros.length > 0 && (
                        <span className="flex items-center gap-1 text-green-400">
                            <CheckCircle2 className="w-3 h-3" />
                            {candidate.pros.length} strengths
                        </span>
                    )}
                    {candidate.red_flag_count > 0 && (
                        <span className="flex items-center gap-1 text-amber-400">
                            <AlertTriangle className="w-3 h-3" />
                            {candidate.red_flag_count} flags
                        </span>
                    )}
                </div>

                {/* Completeness indicator */}
                {candidate.completeness < 70 && (
                    <span className="text-muted-foreground">
                        {candidate.completeness}% complete
                    </span>
                )}
            </div>

            {/* Score breakdown on hover (subtle) */}
            {candidate.algo_score !== null && candidate.ai_score !== null && (
                <div className="absolute bottom-1 right-2 opacity-0 group-hover:opacity-100 transition-opacity text-[10px] text-muted-foreground">
                    Algo: {candidate.algo_score} | AI: {candidate.ai_score}
                </div>
            )}
        </div>
    );
}
