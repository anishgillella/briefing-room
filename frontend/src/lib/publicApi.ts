
import { API_URL } from "./api-config";

// Use environment variable or default
const BASE_URL = API_URL || "http://localhost:8000";

export interface PublicRequirements {
    years_experience?: string;
    education?: string;
    location?: string;
    work_type?: string;
    salary_range?: string;
    required_skills: string[];
    preferred_skills: string[];
}

export interface PublicJobDetail {
    id: string;
    title: string;
    description: string;
    location?: string;
    work_type?: string;
    salary_range?: string;
    requirements: PublicRequirements;
    created_at: string;
}

export interface ApplyData {
    name: string;
    email: string;
    phone?: string;
    linkedin_url?: string;
    portfolio_url?: string;
    resume: File;
}

export async function getPublicJob(id: string): Promise<PublicJobDetail> {
    const response = await fetch(`${BASE_URL}/api/public/jobs/${id}`, {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
        },
    });

    if (!response.ok) {
        throw new Error("Failed to fetch job details");
    }

    return response.json();
}

export async function applyToJob(jobId: string, data: ApplyData): Promise<{ message: string; candidate_id: string }> {
    const formData = new FormData();
    formData.append("name", data.name);
    formData.append("email", data.email);
    if (data.phone) formData.append("phone", data.phone);
    if (data.linkedin_url) formData.append("linkedin_url", data.linkedin_url);
    if (data.portfolio_url) formData.append("portfolio_url", data.portfolio_url);
    formData.append("resume", data.resume);

    const response = await fetch(`${BASE_URL}/api/public/jobs/${jobId}/apply`, {
        method: "POST",
        body: formData,
    });

    if (!response.ok) {
        throw new Error("Failed to submit application");
    }

    return response.json();
}
