import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { v4 as uuidv4 } from "uuid";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// Types
interface StageCount {
  stage_key: string;    // e.g., "new", "stage_0", "stage_1", "offer"
  stage_name: string;   // e.g., "Screen", "Round 1", "Technical", "Offer"
  count: number;
}

interface Job {
  id: string;
  title: string;
  status: "draft" | "active" | "paused" | "closed";
  recruiter_id?: string;
  candidate_count: number;
  interviewed_count: number;
  created_at: string;
  raw_description?: string;
  extracted_requirements?: {
    required_skills?: { value: string; weight: number }[];
    years_experience?: string;
  };
  scoring_criteria?: Record<string, unknown>;
  red_flags?: string[];
  company_context?: Record<string, unknown>;
  // Configurable interview stages
  interview_stages: string[];  // e.g., ["Round 1", "Round 2", "Round 3"]
  // Actual candidate counts per stage
  stage_counts: StageCount[];
}

export type { Job, StageCount };

interface Candidate {
  id: string;
  person_id: string;
  person_name: string;
  person_email?: string;
  current_title?: string;
  current_company?: string;
  years_experience?: number;
  skills?: string[];
  bio_summary?: string;
  combined_score?: number;
  screening_notes?: string;
  interview_status: string;
  pipeline_status?: string;
  created_at: string;
}

interface JobDashboardSummary {
  job_id: string;
  job_title: string;
  job_status: string;
  candidate_stats: {
    total: number;
    pending: number;
    in_progress: number;
    completed: number;
  };
  interview_stats: {
    total: number;
    completed: number;
    avg_duration_seconds: number;
    avg_duration_minutes: number;
  };
  analytics_stats: {
    total_evaluated: number;
    avg_score: number;
    recommendations: Record<string, number>;
  };
}

// Helper to get auth headers
function useAuthHeaders() {
  const { token } = useAuth();
  return (): Record<string, string> => {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    return headers;
  };
}

// Generate idempotency key for mutations
function generateIdempotencyKey(): string {
  return uuidv4();
}

// ============================================
// JOBS HOOKS
// ============================================

export function useJobs(recruiterId?: string, status?: string) {
  const getHeaders = useAuthHeaders();

  return useQuery({
    queryKey: ["jobs", recruiterId, status],
    queryFn: async (): Promise<Job[]> => {
      const params = new URLSearchParams();
      if (recruiterId) params.append("recruiter_id", recruiterId);
      if (status && status !== "all") params.append("status", status);

      const url = `${API_URL}/api/jobs/${params.toString() ? `?${params}` : ""}`;
      const response = await fetch(url, { headers: getHeaders() });

      if (!response.ok) {
        throw new Error("Failed to fetch jobs");
      }

      return response.json();
    },
    enabled: !!recruiterId,
    staleTime: 30000, // 30 seconds
  });
}

export function useJob(jobId: string, organizationId?: string) {
  const getHeaders = useAuthHeaders();

  return useQuery({
    queryKey: ["job", jobId],
    queryFn: async (): Promise<Job> => {
      const response = await fetch(`${API_URL}/api/jobs/${jobId}`, {
        headers: getHeaders(),
      });

      if (!response.ok) {
        throw new Error("Failed to fetch job");
      }

      return response.json();
    },
    enabled: !!jobId,
    staleTime: 30000,
  });
}

export function useCreateJob() {
  const queryClient = useQueryClient();
  const getHeaders = useAuthHeaders();

  return useMutation({
    mutationFn: async (data: {
      title: string;
      raw_description: string;
      recruiter_id: string;
      status?: string;
    }) => {
      const idempotencyKey = generateIdempotencyKey();
      const headers = {
        ...getHeaders(),
        "X-Idempotency-Key": idempotencyKey,
      };

      const response = await fetch(`${API_URL}/api/jobs/`, {
        method: "POST",
        headers,
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Failed to create job");
      }

      return response.json();
    },
    onSuccess: () => {
      // Invalidate jobs list to refetch
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
    },
  });
}

export function useDeleteJob() {
  const queryClient = useQueryClient();
  const getHeaders = useAuthHeaders();

  return useMutation({
    mutationFn: async (jobId: string) => {
      const response = await fetch(`${API_URL}/api/jobs/${jobId}`, {
        method: "DELETE",
        headers: getHeaders(),
      });

      if (!response.ok) {
        throw new Error("Failed to delete job");
      }

      return jobId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
    },
  });
}

export function useUpdateJobStatus() {
  const queryClient = useQueryClient();
  const getHeaders = useAuthHeaders();

  return useMutation({
    mutationFn: async ({
      jobId,
      action,
    }: {
      jobId: string;
      action: "activate" | "pause" | "close" | "reopen";
    }) => {
      const response = await fetch(`${API_URL}/api/jobs/${jobId}/${action}`, {
        method: "POST",
        headers: getHeaders(),
      });

      if (!response.ok) {
        throw new Error(`Failed to ${action} job`);
      }

      return response.json();
    },
    onSuccess: (_, { jobId }) => {
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      queryClient.invalidateQueries({ queryKey: ["job", jobId] });
    },
  });
}

export function useUpdateJob() {
  const queryClient = useQueryClient();
  const getHeaders = useAuthHeaders();

  return useMutation({
    mutationFn: async ({
      jobId,
      data,
    }: {
      jobId: string;
      data: {
        title?: string;
        raw_description?: string;
        status?: string;
        interview_stages?: string[];
      };
    }) => {
      const response = await fetch(`${API_URL}/api/jobs/${jobId}`, {
        method: "PATCH",
        headers: getHeaders(),
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Failed to update job");
      }

      return response.json();
    },
    onSuccess: (_, { jobId }) => {
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      queryClient.invalidateQueries({ queryKey: ["job", jobId] });
    },
  });
}

// ============================================
// CANDIDATES HOOKS
// ============================================

export function useCandidates(jobId: string) {
  const getHeaders = useAuthHeaders();

  return useQuery({
    queryKey: ["candidates", jobId],
    queryFn: async (): Promise<Candidate[]> => {
      const response = await fetch(
        `${API_URL}/api/jobs/${jobId}/candidates`,
        { headers: getHeaders() }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch candidates");
      }

      return response.json();
    },
    enabled: !!jobId,
    staleTime: 30000,
  });
}

export function useCandidate(jobId: string, candidateId: string) {
  const getHeaders = useAuthHeaders();

  return useQuery({
    queryKey: ["candidate", jobId, candidateId],
    queryFn: async (): Promise<Candidate> => {
      const response = await fetch(
        `${API_URL}/api/jobs/${jobId}/candidates/${candidateId}`,
        { headers: getHeaders() }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch candidate");
      }

      return response.json();
    },
    enabled: !!jobId && !!candidateId,
    staleTime: 30000,
  });
}

export function useBulkUpdateCandidates() {
  const queryClient = useQueryClient();
  const getHeaders = useAuthHeaders();

  return useMutation({
    mutationFn: async ({
      jobId,
      candidateIds,
      action,
      targetStage,
    }: {
      jobId: string;
      candidateIds: string[];
      action: "move_stage" | "reject" | "accept";
      targetStage?: string;
    }) => {
      const body: Record<string, unknown> = {
        candidate_ids: candidateIds,
        action,
      };
      if (action === "move_stage" && targetStage) {
        body.target_stage = targetStage;
      }

      const response = await fetch(
        `${API_URL}/api/jobs/${jobId}/candidates/bulk-update`,
        {
          method: "POST",
          headers: getHeaders(),
          body: JSON.stringify(body),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Failed to update candidates");
      }

      return response.json();
    },
    onSuccess: (_, { jobId }) => {
      queryClient.invalidateQueries({ queryKey: ["candidates", jobId] });
    },
  });
}

// ============================================
// DASHBOARD HOOKS
// ============================================

export function useJobDashboardSummary(jobId: string) {
  const getHeaders = useAuthHeaders();

  return useQuery({
    queryKey: ["jobDashboardSummary", jobId],
    queryFn: async (): Promise<JobDashboardSummary> => {
      const response = await fetch(
        `${API_URL}/api/dashboard/job/${jobId}/summary`,
        { headers: getHeaders() }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch job dashboard summary");
      }

      return response.json();
    },
    enabled: !!jobId,
    staleTime: 60000, // 1 minute for dashboard data
  });
}

// ============================================
// INTERVIEW SCHEDULING HOOKS
// ============================================

export function useScheduleInterview() {
  const queryClient = useQueryClient();
  const getHeaders = useAuthHeaders();

  return useMutation({
    mutationFn: async (data: {
      candidate_id: string;
      job_posting_id: string;
      interviewer_id: string;
      stage: string;
      scheduled_at: string;
      duration_minutes?: number;
      timezone?: string;
      interview_type?: string;
      notes?: string;
    }) => {
      const idempotencyKey = generateIdempotencyKey();
      const headers = {
        ...getHeaders(),
        "X-Idempotency-Key": idempotencyKey,
      };

      const response = await fetch(`${API_URL}/api/scheduling/interviews`, {
        method: "POST",
        headers,
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Failed to schedule interview");
      }

      return response.json();
    },
    onSuccess: (_, variables) => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ["interviews"] });
      queryClient.invalidateQueries({
        queryKey: ["candidate", variables.job_posting_id, variables.candidate_id],
      });
      queryClient.invalidateQueries({
        queryKey: ["candidates", variables.job_posting_id],
      });
    },
  });
}

export function useScheduledInterviews(options?: {
  interviewerId?: string;
  candidateId?: string;
  jobId?: string;
  dateFrom?: string;
  dateTo?: string;
  status?: string;
}) {
  const getHeaders = useAuthHeaders();

  return useQuery({
    queryKey: ["interviews", options],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (options?.interviewerId) params.append("interviewer_id", options.interviewerId);
      if (options?.candidateId) params.append("candidate_id", options.candidateId);
      if (options?.jobId) params.append("job_id", options.jobId);
      if (options?.dateFrom) params.append("date_from", options.dateFrom);
      if (options?.dateTo) params.append("date_to", options.dateTo);
      if (options?.status) params.append("status", options.status);

      const response = await fetch(
        `${API_URL}/api/scheduling/interviews?${params}`,
        { headers: getHeaders() }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch scheduled interviews");
      }

      return response.json();
    },
    staleTime: 30000,
  });
}

export function useCancelInterview() {
  const queryClient = useQueryClient();
  const getHeaders = useAuthHeaders();

  return useMutation({
    mutationFn: async ({
      interviewId,
      reason,
    }: {
      interviewId: string;
      reason?: string;
    }) => {
      const response = await fetch(
        `${API_URL}/api/scheduling/interviews/${interviewId}/cancel`,
        {
          method: "PATCH",
          headers: getHeaders(),
          body: JSON.stringify({ reason }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Failed to cancel interview");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["interviews"] });
    },
  });
}

// ============================================
// INTERVIEWERS HOOKS
// ============================================

export function useInterviewers() {
  const getHeaders = useAuthHeaders();

  return useQuery({
    queryKey: ["interviewers"],
    queryFn: async () => {
      const response = await fetch(`${API_URL}/api/interviewers/`, {
        headers: getHeaders(),
      });

      if (!response.ok) {
        throw new Error("Failed to fetch interviewers");
      }

      return response.json();
    },
    staleTime: 60000, // 1 minute - interviewers don't change often
  });
}

// ============================================
// TALENT POOL HOOKS
// ============================================

interface GlobalTalentProfile {
  person_id: string;
  person_name: string;
  total_applications: number;
  average_score: number | null;
  highest_score: number | null;
  lowest_score: number | null;
  status_breakdown: Record<string, number>;
  applications: Array<{
    job_id: string | null;
    job_title: string | null;
    score: number | null;
    status: string;
  }>;
}

export function useGlobalTalentProfile(personId: string | undefined) {
  const getHeaders = useAuthHeaders();

  return useQuery({
    queryKey: ["globalTalentProfile", personId],
    queryFn: async (): Promise<GlobalTalentProfile> => {
      const response = await fetch(
        `${API_URL}/api/talent-pool/${personId}/global-profile`,
        { headers: getHeaders() }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch global talent profile");
      }

      return response.json();
    },
    enabled: !!personId,
    staleTime: 30000, // 30 seconds
  });
}
