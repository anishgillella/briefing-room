export interface Candidate {
    id: string;
    name: string;
    email?: string;
    job_title?: string;
    current_company?: string;
    location_city?: string;
    location_state?: string;
    years_experience?: number;
    bio_summary?: string;
    industries: string[];
    skills: string[];
    algo_score?: number;
    ai_score?: number;
    combined_score?: number;
    tier?: string;
    one_line_summary?: string;
    pros: string[];
    cons: string[];
    reasoning?: string;
    interview_questions: string[];
    missing_required: string[];
    missing_preferred: string[];
    red_flags: string[];
    interview_status?: string;
    interview_score?: number;
    recommendation?: string;
    quota_attainment_history?: string;
    years_closing_experience?: number;
    sold_to_finance_accounting_leaders?: boolean;
    mid_market_enterprise_experience?: boolean;
    finance_accounting_degree?: boolean;
    travel_willingness?: boolean;
    is_founder?: boolean;
}

export interface ScoreBreakdown {
    technical_skills: number;
    experience_relevance: number;
    leadership_potential: number;
    communication_signals: number;
    culture_fit_signals: number;
    growth_trajectory: number;
}

export interface SkillMatch {
    skill: string;
    required_level: string;
    candidate_level: string;
    evidence?: string;
    is_match: boolean;
}

export interface Strength {
    strength: string;
    evidence: string;
    how_to_verify: string;
}

export interface Concern {
    concern: string;
    evidence: string;
    suggested_question: string;
    severity: string;
}

export interface SuggestedQuestion {
    question: string;
    category: string;
    purpose: string;
    follow_up?: string;
}

export interface PreBrief {
    candidate_name: string;
    current_role: string;
    years_experience: number;
    overall_fit_score: number;
    fit_summary: string;
    score_breakdown: ScoreBreakdown;
    skill_matches: SkillMatch[];
    strengths: Strength[];
    concerns: Concern[];
    suggested_questions: SuggestedQuestion[];
    tldr: string;
    key_things_to_remember: string[];
}
