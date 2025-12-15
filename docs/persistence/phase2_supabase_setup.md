# Phase 2: Supabase Setup

This document covers setting up the Supabase project and running database migrations.

## Prerequisites

- Supabase account (free tier available at [supabase.com](https://supabase.com))
- Project API keys (from Supabase Dashboard)

---

## Step 1: Create Supabase Project

1. Go to [app.supabase.com](https://app.supabase.com)
2. Click **New Project**
3. Configure:
   - **Name**: `pluto-interviews`
   - **Database Password**: Generate a strong password (save it!)
   - **Region**: Choose closest to your users
4. Wait for project to provision (~2 minutes)

---

## Step 2: Get API Credentials

From Dashboard → Settings → API:

```bash
# Add to backend/.env
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-role-key  # For server-side operations

# Direct PostgreSQL connection (for SQLAlchemy)
DATABASE_URL=postgresql://postgres:your-password@db.your-project-id.supabase.co:5432/postgres
```

---

## Step 3: Run SQL Migrations

### Option A: Supabase Dashboard (Quick)

1. Go to **SQL Editor** in Supabase Dashboard
2. Create new query
3. Paste the SQL from `phase1_schema.md`
4. Run

### Option B: Supabase CLI (Recommended)

```bash
# Install Supabase CLI
npm install -g supabase

# Login
supabase login

# Link to your project
supabase link --project-ref your-project-id

# Create migration
supabase migration new initial_schema

# Edit the migration file with SQL from phase1_schema.md
# Location: supabase/migrations/YYYYMMDDHHMMSS_initial_schema.sql

# Apply migration
supabase db push
```

---

## Step 4: Install Python Dependencies

```bash
cd backend

# Add to requirements.txt
supabase>=2.0.0
sqlalchemy[asyncio]>=2.0.0
asyncpg>=0.29.0
python-dotenv>=1.0.0

# Install
pip install -r requirements.txt
```

---

## Step 5: Configure Backend

Create `backend/config_db.py`:

```python
import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY")  # Use service key for full access

def get_supabase_client() -> Client:
    """Get Supabase client instance."""
    if not SUPABASE_URL or not SUPABASE_KEY:
        raise ValueError("Supabase credentials not configured")
    return create_client(SUPABASE_URL, SUPABASE_KEY)

# Singleton instance
supabase: Client = get_supabase_client()
```

---

## Step 6: Verify Connection

Create `backend/scripts/test_db.py`:

```python
"""Test Supabase connection."""
import asyncio
from config_db import supabase

def test_connection():
    # Test by listing tables
    result = supabase.table("job_postings").select("*").limit(1).execute()
    print(f"Connected! Found {len(result.data)} job postings.")
    
    # Insert test record
    test_job = {
        "title": "Test Job",
        "description": "Testing Supabase connection"
    }
    insert_result = supabase.table("job_postings").insert(test_job).execute()
    print(f"Inserted test job with ID: {insert_result.data[0]['id']}")
    
    # Clean up
    supabase.table("job_postings").delete().eq("title", "Test Job").execute()
    print("Cleaned up test data.")

if __name__ == "__main__":
    test_connection()
```

Run:
```bash
python scripts/test_db.py
```

---

## Step 7: Enable Row Level Security (Optional)

For production, enable RLS to protect data:

```sql
-- Enable RLS on all tables
ALTER TABLE job_postings ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE interviews ENABLE ROW LEVEL SECURITY;
-- ... repeat for all tables

-- Example policy: Allow all operations for authenticated users
CREATE POLICY "Allow all for authenticated" ON job_postings
    FOR ALL
    USING (auth.role() = 'authenticated');
```

---

## Folder Structure After Setup

```
backend/
├── config.py           # Existing config
├── config_db.py        # NEW: Supabase client
├── .env                # Updated with Supabase credentials
├── requirements.txt    # Updated with supabase, sqlalchemy
└── scripts/
    └── test_db.py      # NEW: Connection test
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Connection refused | Check if Supabase project is active |
| Permission denied | Verify using service key (not anon key) |
| Table not found | Run migrations first |
| SSL error | Add `?sslmode=require` to DATABASE_URL |

---

## Next: [Phase 3 - Python Models](./phase3_python_models.md)
