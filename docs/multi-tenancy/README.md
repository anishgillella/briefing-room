# Multi-Tenancy & Authentication Architecture

## Overview

This documentation describes the multi-tenancy architecture that enables organizations to manage their recruiters, jobs, and candidates in isolation. The core innovation is adding an **Organization** layer as the top-level tenant, with simple email/password authentication for recruiters.

## The Problem We're Solving

Currently, the system has:
1. **No organization boundary** - All jobs and candidates are visible to everyone
2. **No authentication** - RecruiterContext is purely UI-based selection
3. **No recruiter accounts** - Recruiters are just records, not authenticated users
4. **Flat data structure** - No hierarchy for enterprise use

## The New Multi-Tenant Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        MULTI-TENANT HIERARCHY                                    │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ORGANIZATION (Tenant)                                                           │
│  ─────────────────────                                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐        │
│  │  • Company using Briefing Room (e.g., "Acme Corp")                  │        │
│  │  • All data scoped to this organization                             │        │
│  │  • One org for MVP, multi-org support later                         │        │
│  └─────────────────────────────────────────────────────────────────────┘        │
│                                     │                                            │
│                    ┌────────────────┴────────────────┐                          │
│                    ▼                                 ▼                          │
│              RECRUITERS                           JOBS                          │
│              ──────────                           ────                          │
│  ┌─────────────────────────┐       ┌─────────────────────────────────┐         │
│  │  • Authenticated users   │       │  • Belong to organization       │         │
│  │  • Email + password      │       │  • Visible to all recruiters    │         │
│  │  • Belong to one org     │       │  • Have candidates attached     │         │
│  │  • Can see all org jobs  │       │  • Scoring criteria per job     │         │
│  │  • Have personal analytics│      │                                 │         │
│  └─────────────────────────┘       └─────────────────────────────────┘         │
│              │                                      │                           │
│              │ conducts                             │ has many                  │
│              ▼                                      ▼                           │
│         INTERVIEWS ◄─────────────────────── CANDIDATES                          │
│         ──────────                          ──────────                          │
│  ┌─────────────────────────┐       ┌─────────────────────────────────┐         │
│  │  • Linked to recruiter   │       │  • Person + Job = Candidate     │         │
│  │  • Linked to candidate   │       │  • Specific to each job         │         │
│  │  • Has analytics         │       │  • Person can apply to many jobs│         │
│  └─────────────────────────┘       └─────────────────────────────────┘         │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## Data Model Changes

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                        NEW DATA MODEL HIERARCHY                               │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│   Organization (NEW)                                                          │
│   ├── id (UUID)                                                               │
│   ├── name                                                                    │
│   ├── slug (unique, URL-friendly)                                             │
│   ├── created_at                                                              │
│   └── updated_at                                                              │
│         │                                                                     │
│         │ has many                                                            │
│         ▼                                                                     │
│   Recruiter (MODIFIED - now authenticated user)                               │
│   ├── id (UUID)                                                               │
│   ├── organization_id (FK → Organization) [NEW]                               │
│   ├── email (unique)                                                          │
│   ├── password_hash [NEW]                                                     │
│   ├── name                                                                    │
│   ├── role ('recruiter', 'admin') [NEW]                                       │
│   ├── is_active [NEW]                                                         │
│   ├── last_login_at [NEW]                                                     │
│   ├── created_at                                                              │
│   └── updated_at                                                              │
│         │                                                                     │
│         │ can access                                                          │
│         ▼                                                                     │
│   Job (MODIFIED)                                                              │
│   ├── id                                                                      │
│   ├── organization_id (FK → Organization) [NEW]                               │
│   ├── created_by_recruiter_id (FK → Recruiter) [NEW]                          │
│   ├── title                                                                   │
│   ├── ... (existing fields)                                                   │
│   └── updated_at                                                              │
│         │                                                                     │
│         │ has many                                                            │
│         ▼                                                                     │
│   Candidate (unchanged)                                                       │
│   ├── id                                                                      │
│   ├── job_id (FK → Job)                                                       │
│   ├── person_id (FK → Person)                                                 │
│   └── ... (existing fields)                                                   │
│         │                                                                     │
│         │ has many                                                            │
│         ▼                                                                     │
│   Interview (MODIFIED)                                                        │
│   ├── id                                                                      │
│   ├── candidate_id (FK → Candidate)                                           │
│   ├── conducted_by_recruiter_id (FK → Recruiter) [NEW]                        │
│   └── ... (existing fields)                                                   │
│         │                                                                     │
│         │ has one                                                             │
│         ▼                                                                     │
│   Analytics (unchanged)                                                       │
│                                                                               │
└──────────────────────────────────────────────────────────────────────────────┘
```

## Authentication Flow

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           AUTHENTICATION FLOW                                    │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  SIGNUP                                                                          │
│  ──────                                                                          │
│  1. Recruiter visits /signup                                                     │
│  2. Enters: name, email, password                                                │
│  3. Backend:                                                                     │
│     • Validates email format, password strength                                  │
│     • Hashes password with bcrypt                                                │
│     • Creates recruiter record linked to default org                             │
│     • Returns success                                                            │
│  4. Redirect to /login                                                           │
│                                                                                  │
│  LOGIN                                                                           │
│  ─────                                                                           │
│  1. Recruiter visits /login                                                      │
│  2. Enters: email, password                                                      │
│  3. Backend:                                                                     │
│     • Finds recruiter by email                                                   │
│     • Verifies password hash                                                     │
│     • Generates JWT token (contains recruiter_id, org_id)                        │
│     • Updates last_login_at                                                      │
│     • Returns token + recruiter info                                             │
│  4. Frontend:                                                                    │
│     • Stores token in localStorage                                               │
│     • Sets AuthContext with recruiter data                                       │
│     • Redirect to /dashboard                                                     │
│                                                                                  │
│  AUTHENTICATED REQUESTS                                                          │
│  ──────────────────────                                                          │
│  1. Frontend includes token in Authorization header                              │
│  2. Backend middleware:                                                          │
│     • Validates JWT signature                                                    │
│     • Extracts recruiter_id, org_id                                              │
│     • Attaches to request context                                                │
│  3. All queries automatically scoped to organization                             │
│                                                                                  │
│  LOGOUT                                                                          │
│  ──────                                                                          │
│  1. Frontend clears localStorage                                                 │
│  2. Clears AuthContext                                                           │
│  3. Redirect to /login                                                           │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## Key Benefits

| Benefit | Description |
|---------|-------------|
| **Data Isolation** | Each organization's data is completely separate |
| **Secure Access** | Recruiters authenticate with email/password |
| **Audit Trail** | Know which recruiter created jobs, conducted interviews |
| **Scalable** | Easy to add multi-org support later |
| **Recruiter Analytics** | Track individual recruiter performance across jobs |
| **Simple Auth** | No complex OAuth, just bcrypt + JWT |

## Scoping Rules

| Entity | Scoped By | Rule |
|--------|-----------|------|
| **Jobs** | Organization | Recruiters see all jobs in their org |
| **Candidates** | Job | Candidates are specific to each job |
| **Interviews** | Candidate + Recruiter | Linked to who conducted it |
| **Analytics** | Interview | One-to-one with interview |
| **Recruiter Stats** | Recruiter | Aggregated across all their interviews |

## Implementation Phases

| Phase | Document | Status | Scope |
|-------|----------|--------|-------|
| 1 | [phase1-schema.md](./phase1-schema.md) | PENDING | Database schema changes (organizations, auth fields) |
| 2 | [phase2-auth-backend.md](./phase2-auth-backend.md) | PENDING | Backend auth endpoints (signup, login, middleware) |
| 3 | [phase3-auth-frontend.md](./phase3-auth-frontend.md) | PENDING | Frontend auth (login/signup pages, AuthContext, protected routes) |
| 4 | [phase4-org-scoping.md](./phase4-org-scoping.md) | PENDING | Update all queries to scope by organization |
| 5 | [phase5-recruiter-tracking.md](./phase5-recruiter-tracking.md) | PENDING | Track which recruiter created jobs, conducted interviews |

## Migration Strategy

1. **Create organizations table** with a default "Demo Organization"
2. **Add organization_id to recruiters** - backfill with default org
3. **Add auth fields to recruiters** - password_hash initially null (legacy)
4. **Add organization_id to jobs** - backfill with default org
5. **Existing recruiters** become legacy users (can set password on first login)

## Security Considerations

| Aspect | Implementation |
|--------|----------------|
| **Password Storage** | bcrypt with salt (never plain text) |
| **Token Format** | JWT with expiration (24h default) |
| **Token Storage** | localStorage (HttpOnly cookie for production) |
| **Password Requirements** | Min 8 chars (can enhance later) |
| **Rate Limiting** | TODO: Add to login endpoint |

## Tech Stack Additions

| Component | Technology | Purpose |
|-----------|------------|---------|
| Password Hashing | bcrypt | Secure password storage |
| Token Generation | PyJWT | JWT creation and validation |
| Frontend State | React Context | AuthContext for user state |
| Protected Routes | Next.js Middleware | Redirect unauthenticated users |
