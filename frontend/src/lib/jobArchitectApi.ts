import { getStoredToken as getToken } from "./authApi";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface Message {
    role: "user" | "assistant" | "system";
    content: string;
}

export interface MarketInsights {
    role: string;
    location: string;
    salary_range_low: number;
    salary_range_high: number;
    currency: string;
    top_skills: string[];
    demand_level: string;
    average_time_to_hire_days: number;
    sources?: string[];
}

export interface ArchitectResponse {
    message: string;
    market_insights?: MarketInsights;
    suggested_title?: string;
    is_ready_to_generate: boolean;
}

export async function chatWithArchitect(history: Message[]): Promise<ArchitectResponse> {
    const token = getToken();
    const res = await fetch(`${API_URL}/api/job-architect/chat`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ history }),
    });

    if (!res.ok) {
        throw new Error("Failed to chat with architect");
    }

    return res.json();
}

export async function generateJobDescription(history: Message[]): Promise<{ jd: string }> {
    const token = getToken();
    const res = await fetch(`${API_URL}/api/job-architect/generate`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ history }),
    });

    if (!res.ok) {
        throw new Error("Failed to generate JD");
    }

    return res.json();
}
