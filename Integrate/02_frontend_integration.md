# Phase 2: Frontend Integration

Add candidate management pages to the Next.js frontend and wire the interview flow to pull from Pluto data.

---

## 🎯 Goals

1. New `/candidates` page showing ranked candidate list
2. New `/candidates/[id]` page with candidate details + "Start Interview" button
3. Updated homepage with navigation to candidates
4. Interview flow pre-populated with candidate data
5. Consistent shadcn/ui design throughout

---

## 📁 Files to Create/Modify

### Frontend Structure After Integration

```
frontend/src/
├── app/
│   ├── page.tsx                     # MODIFY: Add navigation
│   ├── candidates/
│   │   ├── page.tsx                 # CREATE: Candidate list
│   │   ├── upload/
│   │   │   └── page.tsx             # CREATE: CSV upload
│   │   └── [id]/
│   │       └── page.tsx             # CREATE: Candidate detail
│   └── room/
│       └── [roomName]/
│           └── page.tsx             # KEEP (existing)
├── components/
│   ├── candidate-card.tsx           # CREATE: Card for list view
│   ├── candidate-detail.tsx         # CREATE: Full detail view
│   ├── csv-upload.tsx               # CREATE: Upload component
│   ├── score-badge.tsx              # CREATE: Tier/score display
│   └── ...existing components...
├── lib/
│   ├── api.ts                       # MODIFY: Add Pluto API functions
│   └── types.ts                     # CREATE: Shared TypeScript types
```

---

## 🔧 Implementation Steps

### Step 2.1: Create Shared Types

**File:** `frontend/src/lib/types.ts`

```typescript
export interface Candidate {
  id: string;
  name: string;
  email?: string;
  linkedin_url?: string;
  
  // Resume data
  current_role?: string;
  current_company?: string;
  years_experience?: number;
  industries?: string[];
  skills?: string[];
  education?: string;
  bio?: string;
  
  // Pluto scoring
  algo_score?: number;
  ai_score?: number;
  combined_score?: number;
  tier?: "Top Tier" | "Strong" | "Good" | "Evaluate" | "Poor";
  
  // Data quality
  missing_required?: string[];
  missing_preferred?: string[];
  red_flags?: string[];
  completeness?: number;
  
  // Interview tracking
  interview_status?: "not_scheduled" | "briefing" | "in_progress" | "completed";
  room_name?: string;
  interview_score?: number;
  recommendation?: string;
  
  // Metadata
  created_at: string;
  updated_at: string;
  source: "csv_upload" | "manual" | "voice_enriched";
}

export interface ProcessingStatus {
  status: "idle" | "extracting" | "scoring" | "complete" | "error";
  progress: number;
  message: string;
  candidates_total: number;
  candidates_extracted: number;
  candidates_scored: number;
  error?: string;
}

export interface StartInterviewResponse {
  room_name: string;
  room_url: string;
  candidate: Candidate;
}
```

---

### Step 2.2: Add Pluto API Functions

**File:** `frontend/src/lib/api.ts` (add to existing)

```typescript
import { Candidate, ProcessingStatus, StartInterviewResponse } from "./types";

// Pluto API endpoints
export async function uploadCandidateCSV(file: File): Promise<{ status: string; message: string }> {
  const formData = new FormData();
  formData.append("file", file);
  
  const response = await fetch(`${API_BASE_URL}/api/pluto/upload`, {
    method: "POST",
    body: formData,
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "Failed to upload CSV");
  }
  
  return response.json();
}

export async function getProcessingStatus(): Promise<ProcessingStatus> {
  const response = await fetch(`${API_BASE_URL}/api/pluto/status`);
  return response.json();
}

export async function getCandidates(): Promise<Candidate[]> {
  const response = await fetch(`${API_BASE_URL}/api/pluto/results`);
  if (!response.ok) {
    throw new Error("Failed to fetch candidates");
  }
  return response.json();
}

export async function getCandidate(id: string): Promise<Candidate> {
  const response = await fetch(`${API_BASE_URL}/api/pluto/candidates/${id}`);
  if (!response.ok) {
    throw new Error("Candidate not found");
  }
  return response.json();
}

export async function startCandidateInterview(candidateId: string): Promise<StartInterviewResponse> {
  const response = await fetch(`${API_BASE_URL}/api/pluto/candidates/${candidateId}/interview`, {
    method: "POST",
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "Failed to start interview");
  }
  
  return response.json();
}
```

---

### Step 2.3: Create Candidate Card Component

**File:** `frontend/src/components/candidate-card.tsx`

```tsx
"use client";

import { Candidate } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { User, Briefcase, AlertCircle, CheckCircle } from "lucide-react";

interface CandidateCardProps {
  candidate: Candidate;
}

const tierColors: Record<string, string> = {
  "Top Tier": "bg-emerald-500",
  "Strong": "bg-blue-500",
  "Good": "bg-yellow-500",
  "Evaluate": "bg-orange-500",
  "Poor": "bg-red-500",
};

export function CandidateCard({ candidate }: CandidateCardProps) {
  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg">{candidate.name}</CardTitle>
            <p className="text-sm text-muted-foreground">
              {candidate.current_role} @ {candidate.current_company}
            </p>
          </div>
          <Badge className={tierColors[candidate.tier || "Evaluate"]}>
            {candidate.tier || "Unscored"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4 mb-3">
          <div className="text-center">
            <div className="text-2xl font-bold">{candidate.combined_score || "-"}</div>
            <div className="text-xs text-muted-foreground">Score</div>
          </div>
          <div className="text-center">
            <div className="text-lg">{candidate.years_experience || "?"}y</div>
            <div className="text-xs text-muted-foreground">Experience</div>
          </div>
          <div className="text-center">
            <div className="text-lg">{candidate.completeness || 0}%</div>
            <div className="text-xs text-muted-foreground">Complete</div>
          </div>
        </div>
        
        {candidate.red_flags && candidate.red_flags.length > 0 && (
          <div className="flex items-center gap-1 text-sm text-orange-600 mb-2">
            <AlertCircle className="h-4 w-4" />
            {candidate.red_flags.length} red flag(s)
          </div>
        )}
        
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm" className="flex-1">
            <Link href={`/candidates/${candidate.id}`}>View Details</Link>
          </Button>
          {candidate.interview_status === "not_scheduled" && (
            <Button size="sm" className="flex-1">Start Interview</Button>
          )}
          {candidate.interview_status === "completed" && (
            <Badge variant="secondary" className="flex items-center gap-1">
              <CheckCircle className="h-3 w-3" /> Interviewed
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
```

---

### Step 2.4: Create Candidates List Page

**File:** `frontend/src/app/candidates/page.tsx`

```tsx
"use client";

import { useState, useEffect } from "react";
import { getCandidates } from "@/lib/api";
import { Candidate } from "@/lib/types";
import { CandidateCard } from "@/components/candidate-card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Upload, Users, Filter } from "lucide-react";

export default function CandidatesPage() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    async function load() {
      try {
        const data = await getCandidates();
        setCandidates(data);
      } catch (err) {
        console.error("Failed to load candidates", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const filteredCandidates = candidates.filter((c) => {
    if (filter === "all") return true;
    if (filter === "top") return c.tier === "Top Tier" || c.tier === "Strong";
    if (filter === "interview") return c.interview_status !== "not_scheduled";
    return true;
  });

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-6 w-6" />
            <h1 className="text-xl font-bold">Candidates</h1>
          </div>
          <div className="flex gap-2">
            <Button asChild>
              <Link href="/candidates/upload">
                <Upload className="h-4 w-4 mr-2" /> Upload CSV
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/">Quick Interview</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Filters */}
      <div className="container mx-auto px-4 py-4">
        <div className="flex gap-2 mb-4">
          <Button variant={filter === "all" ? "default" : "outline"} size="sm" onClick={() => setFilter("all")}>
            All ({candidates.length})
          </Button>
          <Button variant={filter === "top" ? "default" : "outline"} size="sm" onClick={() => setFilter("top")}>
            Top Candidates
          </Button>
          <Button variant={filter === "interview" ? "default" : "outline"} size="sm" onClick={() => setFilter("interview")}>
            Interviewed
          </Button>
        </div>

        {/* Candidate Grid */}
        {loading ? (
          <div className="text-center py-12 text-muted-foreground">Loading candidates...</div>
        ) : filteredCandidates.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground mb-4">No candidates yet</p>
            <Button asChild>
              <Link href="/candidates/upload">Upload your first CSV</Link>
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredCandidates.map((candidate) => (
              <CandidateCard key={candidate.id} candidate={candidate} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

---

### Step 2.5: Create Candidate Detail Page

**File:** `frontend/src/app/candidates/[id]/page.tsx`

```tsx
"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { getCandidate, startCandidateInterview } from "@/lib/api";
import { Candidate } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Play, AlertCircle } from "lucide-react";
import Link from "next/link";

export default function CandidateDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const data = await getCandidate(params.id as string);
        setCandidate(data);
      } catch (err) {
        console.error("Failed to load candidate", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [params.id]);

  const handleStartInterview = async () => {
    if (!candidate) return;
    setStarting(true);
    try {
      const result = await startCandidateInterview(candidate.id);
      // Navigate to the interview room
      router.push(`/room/${result.room_name}`);
    } catch (err) {
      console.error("Failed to start interview", err);
    } finally {
      setStarting(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  if (!candidate) {
    return <div className="min-h-screen flex items-center justify-center">Candidate not found</div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Button variant="ghost" asChild>
            <Link href="/candidates">
              <ArrowLeft className="h-4 w-4 mr-2" /> Back to Candidates
            </Link>
          </Button>
          <Button onClick={handleStartInterview} disabled={starting}>
            <Play className="h-4 w-4 mr-2" />
            {starting ? "Starting..." : "Start Interview"}
          </Button>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Info */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-2xl">{candidate.name}</CardTitle>
                  <p className="text-muted-foreground">
                    {candidate.current_role} @ {candidate.current_company}
                  </p>
                </div>
                <div className="text-center">
                  <div className="text-4xl font-bold">{candidate.combined_score}</div>
                  <Badge>{candidate.tier}</Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {candidate.bio && (
                <div className="mb-4">
                  <h3 className="font-semibold mb-2">Bio</h3>
                  <p className="text-sm">{candidate.bio}</p>
                </div>
              )}
              
              {candidate.skills && candidate.skills.length > 0 && (
                <div className="mb-4">
                  <h3 className="font-semibold mb-2">Skills</h3>
                  <div className="flex flex-wrap gap-1">
                    {candidate.skills.map((skill) => (
                      <Badge key={skill} variant="secondary">{skill}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Scoring & Flags */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Scores</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Algorithmic</span>
                    <span className="font-bold">{candidate.algo_score}/100</span>
                  </div>
                  <div className="flex justify-between">
                    <span>AI Evaluation</span>
                    <span className="font-bold">{candidate.ai_score}/100</span>
                  </div>
                  <div className="flex justify-between border-t pt-2">
                    <span>Combined</span>
                    <span className="font-bold">{candidate.combined_score}/100</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {candidate.red_flags && candidate.red_flags.length > 0 && (
              <Card className="border-orange-200">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <AlertCircle className="h-5 w-5 text-orange-500" />
                    Red Flags
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="list-disc list-inside text-sm space-y-1">
                    {candidate.red_flags.map((flag, i) => (
                      <li key={i}>{flag}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
```

---

### Step 2.6: Create CSV Upload Page

**File:** `frontend/src/app/candidates/upload/page.tsx`

```tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { uploadCandidateCSV, getProcessingStatus } from "@/lib/api";
import { ProcessingStatus } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Upload, ArrowLeft, CheckCircle } from "lucide-react";
import Link from "next/link";

export default function UploadPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState<ProcessingStatus | null>(null);
  const [polling, setPolling] = useState(false);

  // Poll for status while processing
  useEffect(() => {
    if (!polling) return;
    
    const interval = setInterval(async () => {
      const s = await getProcessingStatus();
      setStatus(s);
      if (s.status === "complete" || s.status === "error") {
        setPolling(false);
      }
    }, 1000);
    
    return () => clearInterval(interval);
  }, [polling]);

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    try {
      await uploadCandidateCSV(file);
      setPolling(true);
    } catch (err) {
      console.error("Upload failed", err);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <Button variant="ghost" asChild>
            <Link href="/candidates">
              <ArrowLeft className="h-4 w-4 mr-2" /> Back to Candidates
            </Link>
          </Button>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-xl">
        <Card>
          <CardHeader>
            <CardTitle>Upload Candidates CSV</CardTitle>
          </CardHeader>
          <CardContent>
            {!status ? (
              <div className="space-y-4">
                <div className="border-2 border-dashed rounded-lg p-8 text-center">
                  <input
                    type="file"
                    accept=".csv"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                    className="hidden"
                    id="csv-upload"
                  />
                  <label htmlFor="csv-upload" className="cursor-pointer">
                    <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="font-medium">{file ? file.name : "Click to select CSV"}</p>
                    <p className="text-sm text-muted-foreground">or drag and drop</p>
                  </label>
                </div>
                <Button onClick={handleUpload} disabled={!file || uploading} className="w-full">
                  {uploading ? "Uploading..." : "Upload & Process"}
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="text-center">
                  {status.status === "complete" ? (
                    <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-2" />
                  ) : (
                    <div className="animate-spin h-12 w-12 mx-auto border-4 border-primary border-t-transparent rounded-full mb-2" />
                  )}
                  <p className="font-medium">{status.message}</p>
                </div>
                <Progress value={status.progress} />
                <div className="text-sm text-muted-foreground text-center">
                  Extracted: {status.candidates_extracted}/{status.candidates_total} • 
                  Scored: {status.candidates_scored}/{status.candidates_total}
                </div>
                {status.status === "complete" && (
                  <Button onClick={() => router.push("/candidates")} className="w-full">
                    View Candidates
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
```

---

### Step 2.7: Update Homepage

**File:** `frontend/src/app/page.tsx` (modify)

Add navigation to candidates:

```tsx
// Add to the join screen or header
<Button asChild variant="outline">
  <Link href="/candidates">View Candidates</Link>
</Button>
```

---

## ✅ Verification Plan

### Manual Testing

1. **Navigate to `/candidates`** — Should show empty state with upload button
2. **Click "Upload CSV"** — Navigate to upload page
3. **Upload a CSV file** — Should show progress, then redirect to list
4. **View candidate list** — Should show cards with scores and tiers
5. **Click "View Details"** — Navigate to candidate detail page
6. **Click "Start Interview"** — Should create room and navigate to interview

### Visual Checks

- [ ] shadcn/ui components render correctly
- [ ] Responsive layout (mobile, tablet, desktop)
- [ ] Loading states display properly
- [ ] Error handling shows user-friendly messages

---

## 📋 Checklist

- [ ] Create `frontend/src/lib/types.ts`
- [ ] Add Pluto API functions to `frontend/src/lib/api.ts`
- [ ] Create `frontend/src/components/candidate-card.tsx`
- [ ] Create `frontend/src/app/candidates/page.tsx`
- [ ] Create `frontend/src/app/candidates/[id]/page.tsx`
- [ ] Create `frontend/src/app/candidates/upload/page.tsx`
- [ ] Modify homepage to link to candidates
- [ ] Test full flow: upload → list → detail → interview
