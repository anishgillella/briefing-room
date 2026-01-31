/**
 * Interviewer Analytics API Hooks
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Types
export interface Interviewer {
    id: string;
    name: string;
    email?: string;
    department?: string;
    team?: string;
    role?: 'manager' | 'interviewer' | 'both';
}

export interface TopicBreakdown {
    technical: number;
    behavioral: number;
    culture_fit: number;
    problem_solving: number;
}

export interface InterviewerMetrics {
    total_interviews: number;
    avg_question_quality: number;
    avg_topic_coverage: number;
    avg_consistency: number;
    avg_bias_score: number;
    avg_candidate_experience: number;
    avg_overall: number;
    topic_breakdown: TopicBreakdown;
    common_suggestions: string[];
    bias_flags: string[];
}

export interface InterviewAnalytics {
    id: string;
    interview_id: string;
    interviewer_id: string;
    question_quality_score: number;
    topic_coverage_score: number;
    consistency_score: number;
    bias_score: number;
    candidate_experience_score: number;
    overall_score: number;
    question_quality_breakdown: {
        relevance: number;
        depth: number;
        follow_up_quality: number;
    };
    topics_covered: TopicBreakdown;
    bias_indicators: {
        flags: string[];
        severity: string;
        sentiment_balance: number;
    };
    improvement_suggestions: string[];
    created_at: string;
}

export interface InterviewerAnalyticsResponse {
    interviewer: {
        id: string;
        name: string;
        team?: string;
        department?: string;
    };
    aggregated: InterviewerMetrics;
    recent_interviews: InterviewAnalytics[];
    benchmarks: Record<string, {
        value: number;
        team_avg: number;
        diff: number;
        is_better: boolean;
        percentile: number;
    }>;
    team_average: {
        avg_question_quality: number;
        avg_topic_coverage: number;
        avg_consistency: number;
        avg_bias_score: number;
        avg_candidate_experience: number;
        avg_overall: number;
    };
    trends: Record<string, {
        recent_avg: number;
        older_avg: number;
        diff: number;
        improving: boolean;
        direction: 'improving' | 'declining' | 'stable';
    }>;
    badges: Array<{
        id: string;
        name: string;
        icon: string;
        description: string;
    }>;
    coaching: Array<{
        area: string;
        score: number;
        tip: string;
    }>;
}

// API Functions

export async function getInterviewers(): Promise<Interviewer[]> {
    const response = await fetch(`${API_BASE}/api/interviewers`);
    if (!response.ok) {
        throw new Error('Failed to fetch interviewers');
    }
    const data = await response.json();
    return data.interviewers;
}

export async function getInterviewer(interviewerId: string): Promise<Interviewer> {
    const response = await fetch(`${API_BASE}/api/interviewers/${interviewerId}`);
    if (!response.ok) {
        throw new Error('Failed to fetch interviewer');
    }
    return response.json();
}

export async function getInterviewerAnalytics(interviewerId: string): Promise<InterviewerAnalyticsResponse> {
    const response = await fetch(`${API_BASE}/api/interviewers/${interviewerId}/analytics`);
    if (!response.ok) {
        throw new Error('Failed to fetch interviewer analytics');
    }
    return response.json();
}

export async function triggerInterviewAnalysis(interviewId: string): Promise<{ status: string }> {
    const response = await fetch(`${API_BASE}/api/interviewers/interviews/${interviewId}/analyze`, {
        method: 'POST'
    });
    if (!response.ok) {
        throw new Error('Failed to trigger analysis');
    }
    return response.json();
}

// Team Analytics Types (for Manager Dashboard)
export interface TeamInterviewerData {
    interviewer: {
        id: string;
        name: string;
        team?: string;
        department?: string;
    };
    metrics: InterviewerMetrics;
}

export interface TeamAnalyticsResponse {
    team_averages: {
        total_interviews: number;
        avg_question_quality: number;
        avg_topic_coverage: number;
        avg_consistency: number;
        avg_bias_score: number;
        avg_candidate_experience: number;
        avg_overall: number;
    };
    interviewers: TeamInterviewerData[];
}

export async function getTeamAnalytics(): Promise<TeamAnalyticsResponse> {
    const response = await fetch(`${API_BASE}/api/interviewers/analytics/team`);
    if (!response.ok) {
        throw new Error('Failed to fetch team analytics');
    }
    return response.json();
}

// LocalStorage helpers
const SELECTED_INTERVIEWER_KEY = 'pluto_selected_interviewer_id';

export function getSelectedInterviewerId(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(SELECTED_INTERVIEWER_KEY);
}

export function setSelectedInterviewerId(interviewerId: string): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(SELECTED_INTERVIEWER_KEY, interviewerId);
}
