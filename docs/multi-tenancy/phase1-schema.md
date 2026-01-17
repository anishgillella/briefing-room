# Phase 1: Database Schema Changes

## Status: PENDING

## Overview

This phase adds the database tables and columns needed for multi-tenancy and authentication. We introduce the `organizations` table and modify existing tables to support organization scoping and recruiter authentication.

## Schema Changes

### 1. New Table: `organizations`

```sql
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,  -- URL-friendly identifier
    settings JSONB DEFAULT '{}',         -- Future: org-level settings
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_organizations_slug ON organizations(slug);
```

**Purpose**: Top-level tenant that owns all data.

**Fields**:
- `name`: Display name (e.g., "Acme Corporation")
- `slug`: URL-friendly identifier (e.g., "acme-corp")
- `settings`: Future extensibility for org-level configuration

### 2. Modify Table: `recruiters`

```sql
-- Add new columns
ALTER TABLE recruiters ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE recruiters ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);
ALTER TABLE recruiters ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'recruiter' CHECK (role IN ('recruiter', 'admin'));
ALTER TABLE recruiters ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE recruiters ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

-- Add unique constraint on email within organization
ALTER TABLE recruiters DROP CONSTRAINT IF EXISTS recruiters_email_key;
ALTER TABLE recruiters ADD CONSTRAINT recruiters_org_email_unique UNIQUE (organization_id, email);

-- Add index for org lookups
CREATE INDEX IF NOT EXISTS idx_recruiters_organization ON recruiters(organization_id);
CREATE INDEX IF NOT EXISTS idx_recruiters_email ON recruiters(email);
```

**New Fields**:
| Field | Type | Purpose |
|-------|------|---------|
| `organization_id` | UUID (FK) | Links recruiter to their organization |
| `password_hash` | VARCHAR | bcrypt-hashed password |
| `role` | VARCHAR | 'recruiter' or 'admin' (for future permissions) |
| `is_active` | BOOLEAN | Soft-disable accounts |
| `last_login_at` | TIMESTAMPTZ | Track last login time |

**Constraint Change**: Email unique per organization (not globally).

### 3. Modify Table: `job_postings`

```sql
-- Add organization_id column
ALTER TABLE job_postings ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- Add created_by to track which recruiter created the job
ALTER TABLE job_postings ADD COLUMN IF NOT EXISTS created_by_recruiter_id UUID REFERENCES recruiters(id) ON DELETE SET NULL;

-- Add index
CREATE INDEX IF NOT EXISTS idx_job_postings_organization ON job_postings(organization_id);
```

**New Fields**:
| Field | Type | Purpose |
|-------|------|---------|
| `organization_id` | UUID (FK) | Scopes job to organization |
| `created_by_recruiter_id` | UUID (FK) | Tracks who created the job |

### 4. Modify Table: `interviews`

```sql
-- Add conducted_by to track which recruiter ran the interview
ALTER TABLE interviews ADD COLUMN IF NOT EXISTS conducted_by_recruiter_id UUID REFERENCES recruiters(id) ON DELETE SET NULL;

-- Add index
CREATE INDEX IF NOT EXISTS idx_interviews_conducted_by ON interviews(conducted_by_recruiter_id);
```

**New Fields**:
| Field | Type | Purpose |
|-------|------|---------|
| `conducted_by_recruiter_id` | UUID (FK) | Tracks who conducted the interview |

## Full Migration Script

```sql
-- ============================================
-- MULTI-TENANCY SCHEMA MIGRATION
-- Run this in Supabase SQL Editor
-- ============================================

-- 1. Create organizations table
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_organizations_slug ON organizations(slug);

-- 2. Add auth and org fields to recruiters
ALTER TABLE recruiters ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE recruiters ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);
ALTER TABLE recruiters ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'recruiter';
ALTER TABLE recruiters ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE recruiters ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

-- Add check constraint for role
DO $$ BEGIN
    ALTER TABLE recruiters ADD CONSTRAINT recruiters_role_check CHECK (role IN ('recruiter', 'admin'));
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Update unique constraint (email unique per org, not globally)
ALTER TABLE recruiters DROP CONSTRAINT IF EXISTS recruiters_email_key;
DO $$ BEGIN
    ALTER TABLE recruiters ADD CONSTRAINT recruiters_org_email_unique UNIQUE (organization_id, email);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS idx_recruiters_organization ON recruiters(organization_id);
CREATE INDEX IF NOT EXISTS idx_recruiters_email ON recruiters(email);

-- 3. Add org and creator fields to job_postings
ALTER TABLE job_postings ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE job_postings ADD COLUMN IF NOT EXISTS created_by_recruiter_id UUID REFERENCES recruiters(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_job_postings_organization ON job_postings(organization_id);

-- 4. Add conducted_by to interviews
ALTER TABLE interviews ADD COLUMN IF NOT EXISTS conducted_by_recruiter_id UUID REFERENCES recruiters(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_interviews_conducted_by ON interviews(conducted_by_recruiter_id);

-- 5. Disable RLS and grant permissions
ALTER TABLE organizations DISABLE ROW LEVEL SECURITY;
GRANT ALL ON organizations TO postgres, anon, authenticated, service_role;

-- 6. Create default organization for migration
INSERT INTO organizations (name, slug)
VALUES ('Demo Organization', 'demo')
ON CONFLICT (slug) DO NOTHING;

-- 7. Backfill existing data with default organization
UPDATE recruiters
SET organization_id = (SELECT id FROM organizations WHERE slug = 'demo')
WHERE organization_id IS NULL;

UPDATE job_postings
SET organization_id = (SELECT id FROM organizations WHERE slug = 'demo')
WHERE organization_id IS NULL;

-- 8. Add updated_at trigger for organizations
DROP TRIGGER IF EXISTS update_organizations_updated_at ON organizations;
CREATE TRIGGER update_organizations_updated_at
    BEFORE UPDATE ON organizations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- DONE!
-- ============================================
```

## Data Model After Migration

```
organizations
├── id (PK)
├── name
├── slug (unique)
├── settings (JSONB)
├── created_at
└── updated_at

recruiters
├── id (PK)
├── organization_id (FK → organizations) [NEW]
├── email (unique per org)
├── password_hash [NEW]
├── name
├── role [NEW]
├── is_active [NEW]
├── last_login_at [NEW]
├── created_at
└── updated_at

job_postings
├── id (PK)
├── organization_id (FK → organizations) [NEW]
├── created_by_recruiter_id (FK → recruiters) [NEW]
├── recruiter_id (FK - existing, for job owner)
├── title
├── ... (existing fields)
└── updated_at

interviews
├── id (PK)
├── candidate_id (FK)
├── conducted_by_recruiter_id (FK → recruiters) [NEW]
├── ... (existing fields)
└── created_at
```

## Verification Queries

After running the migration, verify with:

```sql
-- Check organizations table exists
SELECT * FROM organizations;

-- Check recruiters have org_id
SELECT id, name, email, organization_id, role, is_active FROM recruiters LIMIT 5;

-- Check jobs have org_id
SELECT id, title, organization_id, created_by_recruiter_id FROM job_postings LIMIT 5;

-- Check interviews have conducted_by
SELECT id, candidate_id, conducted_by_recruiter_id FROM interviews LIMIT 5;
```

## Rollback Script

If needed, rollback with:

```sql
-- Remove new columns (careful - data loss!)
ALTER TABLE recruiters DROP COLUMN IF EXISTS organization_id;
ALTER TABLE recruiters DROP COLUMN IF EXISTS password_hash;
ALTER TABLE recruiters DROP COLUMN IF EXISTS role;
ALTER TABLE recruiters DROP COLUMN IF EXISTS is_active;
ALTER TABLE recruiters DROP COLUMN IF EXISTS last_login_at;

ALTER TABLE job_postings DROP COLUMN IF EXISTS organization_id;
ALTER TABLE job_postings DROP COLUMN IF EXISTS created_by_recruiter_id;

ALTER TABLE interviews DROP COLUMN IF EXISTS conducted_by_recruiter_id;

DROP TABLE IF EXISTS organizations;
```

## Next Phase

Once schema is in place, proceed to [Phase 2: Auth Backend](./phase2-auth-backend.md) to implement signup/login endpoints.
