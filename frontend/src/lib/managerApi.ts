/**
 * Manager Dashboard API Hooks
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Types
export interface Manager {
    id: string;
    name: string;
    email?: string;
    department?: string;
    team?: string;
    total_candidates_reviewed?: number;
    total_interviews_conducted?: number;
    total_offers_made?: number;
    total_hires?: number;
}

export interface FunnelMetrics {
    reviewed: number;
    interviewed: number;
    offered: number;
    hired: number;
    interview_rate: number;
    offer_rate: number;
    hire_rate: number;
}

export interface TimingMetrics {
    time_to_first_interview: number;
    time_in_pipeline: number;
    interviews_per_candidate: number;
}

export interface Comparison {
    value: number;
    benchmark: number;
    difference: number;
    status: 'good' | 'warning' | 'critical';
}

export interface ManagerMetrics {
    manager: {
        id: string;
        name: string;
        team?: string;
        department?: string;
    };
    period_days: number;
    metrics: {
        funnel: FunnelMetrics;
        timing: TimingMetrics;
    };
    comparisons: Record<string, Comparison>;
    recommendations: string[];
}

// API Functions

export async function getManagers(): Promise<Manager[]> {
    const response = await fetch(`${API_BASE}/api/managers`);
    if (!response.ok) {
        throw new Error('Failed to fetch managers');
    }
    const data = await response.json();
    return data.managers;
}

export async function getManager(managerId: string): Promise<Manager> {
    const response = await fetch(`${API_BASE}/api/managers/${managerId}`);
    if (!response.ok) {
        throw new Error('Failed to fetch manager');
    }
    return response.json();
}

export async function getManagerMetrics(managerId: string, days: number = 90): Promise<ManagerMetrics> {
    const response = await fetch(`${API_BASE}/api/managers/${managerId}/metrics?days=${days}`);
    if (!response.ok) {
        throw new Error('Failed to fetch manager metrics');
    }
    return response.json();
}

export async function getManagerRecommendations(managerId: string): Promise<{ recommendations: string[] }> {
    const response = await fetch(`${API_BASE}/api/managers/${managerId}/recommendations`);
    if (!response.ok) {
        throw new Error('Failed to fetch recommendations');
    }
    return response.json();
}

// Consolidated Report Types
export interface ConsolidatedReport {
    period_days: number;
    summary: {
        total_interviewers: number;
        total_interviews_completed: number;
        team_avg_interview_score: number;
        team_avg_overall_rating: number;
        active_interviewers: number;
    };
    leaderboard: LeaderboardEntry[];
    all_interviewers: LeaderboardEntry[];
}

export interface LeaderboardEntry {
    interviewer_id: string;
    name: string;
    team?: string;
    department?: string;
    total_interviews: number;
    avg_interview_score: number;
    avg_overall_rating: number;
    avg_question_quality: number;
    avg_candidate_experience: number;
}

export async function getConsolidatedTeamReport(days: number = 90): Promise<ConsolidatedReport> {
    const response = await fetch(`${API_BASE}/api/managers/metrics/consolidated?days=${days}`);
    if (!response.ok) {
        throw new Error('Failed to fetch consolidated team report');
    }
    return response.json();
}

// LocalStorage helpers for manager selection
const SELECTED_MANAGER_KEY = 'pluto_selected_manager_id';

export function getSelectedManagerId(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(SELECTED_MANAGER_KEY);
}

export function setSelectedManagerId(managerId: string): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(SELECTED_MANAGER_KEY, managerId);
}

export function clearSelectedManagerId(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(SELECTED_MANAGER_KEY);
}
