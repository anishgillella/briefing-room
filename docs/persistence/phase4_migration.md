# Phase 4: Data Migration

This document covers migrating existing JSON data to the Supabase database.

## Current Data Structure

```
backend/data/
├── candidates.json          # All candidates (main data)
├── prebriefs/
│   └── {id}.json           # Pre-interview briefs
├── analytics/
│   └── {id}_{timestamp}.json  # Post-interview analytics
└── transcripts/
    └── {id}_{timestamp}.json  # Interview transcripts
```

---

## Migration Script

Create `backend/scripts/migrate_json_to_db.py`:

```python
"""
Migrate JSON data to Supabase database.
Run: python scripts/migrate_json_to_db.py
"""
import json
import os
from pathlib import Path
from datetime import datetime
from uuid import uuid4
from config_db import supabase

DATA_DIR = Path(__file__).parent.parent / "data"

def migrate_job_posting():
    """Create a default job posting for existing candidates."""
    print("Creating default job posting...")
    
    job = {
        "id": str(uuid4()),
        "title": "Migrated Job Posting",
        "description": "Default job posting for migrated candidates",
        "created_at": datetime.now().isoformat()
    }
    
    result = supabase.table("job_postings").insert(job).execute()
    job_id = result.data[0]["id"]
    print(f"  Created job posting: {job_id}")
    
    # Create default interview stages
    stages = [
        {"name": "Phone Screen", "sequence_order": 1, "focus_areas": ["culture", "motivation"], "interviewer_role": "Recruiter"},
        {"name": "Technical", "sequence_order": 2, "focus_areas": ["skills", "experience"], "interviewer_role": "Engineer"},
        {"name": "Behavioral", "sequence_order": 3, "focus_areas": ["leadership", "teamwork"], "interviewer_role": "Manager"},
    ]
    
    for stage in stages:
        stage["id"] = str(uuid4())
        stage["job_posting_id"] = job_id
        supabase.table("interview_stages").insert(stage).execute()
        print(f"  Created stage: {stage['name']}")
    
    return job_id

def migrate_candidates(job_posting_id: str):
    """Migrate candidates from JSON to database."""
    print("\nMigrating candidates...")
    
    candidates_file = DATA_DIR / "candidates.json"
    if not candidates_file.exists():
        print("  No candidates.json found, skipping")
        return {}
    
    with open(candidates_file) as f:
        data = json.load(f)
    
    candidates = data.get("candidates", [])
    id_mapping = {}  # old_id -> new_uuid
    
    for candidate in candidates:
        old_id = candidate.get("id")
        new_id = str(uuid4())
        id_mapping[old_id] = new_id
        
        # Map fields
        db_candidate = {
            "id": new_id,
            "job_posting_id": job_posting_id,
            "name": candidate.get("name"),
            "email": candidate.get("email"),
            "job_title": candidate.get("job_title"),
            "location_city": candidate.get("location_city"),
            "location_state": candidate.get("location_state"),
            "years_experience": candidate.get("years_experience"),
            "bio_summary": candidate.get("bio_summary"),
            "skills": candidate.get("skills", []),
            "industries": candidate.get("industries", []),
            "algo_score": candidate.get("algo_score"),
            "ai_score": candidate.get("ai_score"),
            "combined_score": candidate.get("combined_score"),
            "tier": candidate.get("tier"),
            "one_line_summary": candidate.get("one_line_summary"),
            "pros": candidate.get("pros", []),
            "cons": candidate.get("cons", []),
            "pipeline_status": candidate.get("interview_status", "new"),
            "source": candidate.get("source", "csv_upload"),
            "created_at": candidate.get("created_at", datetime.now().isoformat()),
        }
        
        supabase.table("candidates").insert(db_candidate).execute()
        print(f"  Migrated: {candidate.get('name')} ({old_id} -> {new_id})")
    
    print(f"  Total candidates migrated: {len(candidates)}")
    return id_mapping

def migrate_prebriefs(id_mapping: dict):
    """Migrate prebrief files."""
    print("\nMigrating prebriefs...")
    
    prebriefs_dir = DATA_DIR / "prebriefs"
    if not prebriefs_dir.exists():
        print("  No prebriefs directory found, skipping")
        return
    
    count = 0
    for file in prebriefs_dir.glob("*.json"):
        old_id = file.stem
        new_id = id_mapping.get(old_id)
        
        if not new_id:
            print(f"  Skipping {file.name} - no matching candidate")
            continue
        
        with open(file) as f:
            content = json.load(f)
        
        prebrief = {
            "id": str(uuid4()),
            "candidate_id": new_id,
            "content": content,
            "created_at": datetime.now().isoformat()
        }
        
        supabase.table("prebriefs").insert(prebrief).execute()
        count += 1
    
    print(f"  Total prebriefs migrated: {count}")

def migrate_analytics(id_mapping: dict, job_posting_id: str):
    """Migrate analytics files to interviews + analytics tables."""
    print("\nMigrating analytics...")
    
    analytics_dir = DATA_DIR / "analytics"
    if not analytics_dir.exists():
        print("  No analytics directory found, skipping")
        return
    
    # Get first stage ID for migration (all migrated interviews go to "Technical")
    stages = supabase.table("interview_stages")\
        .select("id")\
        .eq("job_posting_id", job_posting_id)\
        .eq("sequence_order", 2)\
        .execute()
    stage_id = stages.data[0]["id"] if stages.data else None
    
    count = 0
    for file in analytics_dir.glob("*.json"):
        # Parse filename: {id}_{timestamp}.json
        parts = file.stem.split("_", 1)
        if len(parts) != 2:
            continue
        
        old_id, timestamp_str = parts
        new_candidate_id = id_mapping.get(old_id)
        
        if not new_candidate_id:
            print(f"  Skipping {file.name} - no matching candidate")
            continue
        
        with open(file) as f:
            content = json.load(f)
        
        # Create interview record
        interview_id = str(uuid4())
        interview = {
            "id": interview_id,
            "candidate_id": new_candidate_id,
            "stage_id": stage_id,
            "status": "completed",
            "started_at": datetime.now().isoformat(),
            "ended_at": datetime.now().isoformat(),
        }
        supabase.table("interviews").insert(interview).execute()
        
        # Create analytics record
        analytics = {
            "id": str(uuid4()),
            "interview_id": interview_id,
            "overall_score": content.get("overall_score"),
            "recommendation": content.get("recommendation"),
            "synthesis": content.get("overall_synthesis"),
            "question_analytics": content.get("question_analytics", []),
            "skill_evidence": content.get("skill_evidence", []),
            "behavioral_profile": content.get("behavioral_profile"),
            "topics_to_probe": content.get("topics_to_probe", []),
            "created_at": datetime.now().isoformat()
        }
        supabase.table("analytics").insert(analytics).execute()
        count += 1
    
    print(f"  Total analytics migrated: {count}")

def migrate_transcripts(id_mapping: dict):
    """Migrate transcript files."""
    print("\nMigrating transcripts...")
    
    transcripts_dir = DATA_DIR / "transcripts"
    if not transcripts_dir.exists():
        print("  No transcripts directory found, skipping")
        return
    
    # Get existing interviews to link transcripts
    interviews = supabase.table("interviews").select("id, candidate_id").execute()
    candidate_to_interview = {i["candidate_id"]: i["id"] for i in interviews.data}
    
    count = 0
    for file in transcripts_dir.glob("*.json"):
        parts = file.stem.split("_", 1)
        if len(parts) != 2:
            continue
        
        old_id, _ = parts
        new_candidate_id = id_mapping.get(old_id)
        interview_id = candidate_to_interview.get(new_candidate_id)
        
        if not interview_id:
            print(f"  Skipping {file.name} - no matching interview")
            continue
        
        with open(file) as f:
            content = json.load(f)
        
        # Build full text from turns
        turns = content if isinstance(content, list) else content.get("turns", [])
        full_text = "\n".join([f"{t.get('speaker', 'unknown')}: {t.get('text', '')}" for t in turns])
        
        transcript = {
            "id": str(uuid4()),
            "interview_id": interview_id,
            "turns": turns,
            "full_text": full_text,
            "created_at": datetime.now().isoformat()
        }
        
        supabase.table("transcripts").insert(transcript).execute()
        count += 1
    
    print(f"  Total transcripts migrated: {count}")

def main():
    print("=" * 60)
    print("Starting JSON to Supabase Migration")
    print("=" * 60)
    
    # Step 1: Create job posting and stages
    job_posting_id = migrate_job_posting()
    
    # Step 2: Migrate candidates
    id_mapping = migrate_candidates(job_posting_id)
    
    # Step 3: Migrate prebriefs
    migrate_prebriefs(id_mapping)
    
    # Step 4: Migrate analytics (creates interviews)
    migrate_analytics(id_mapping, job_posting_id)
    
    # Step 5: Migrate transcripts
    migrate_transcripts(id_mapping)
    
    print("\n" + "=" * 60)
    print("Migration Complete!")
    print("=" * 60)

if __name__ == "__main__":
    main()
```

---

## Running the Migration

```bash
cd backend

# Ensure database is set up (Phase 2)
python scripts/test_db.py

# Run migration
python scripts/migrate_json_to_db.py

# Verify data
python -c "from config_db import supabase; print(supabase.table('candidates').select('count').execute())"
```

---

## Rollback (If Needed)

```sql
-- Clear all migrated data (in order due to foreign keys)
DELETE FROM questions_asked;
DELETE FROM analytics;
DELETE FROM transcripts;
DELETE FROM interviews;
DELETE FROM prebriefs;
DELETE FROM candidates;
DELETE FROM interview_stages;
DELETE FROM job_postings;
```

---

## Post-Migration Verification

| Table | Expected Count | Query |
|-------|----------------|-------|
| `candidates` | Same as JSON | `SELECT COUNT(*) FROM candidates;` |
| `prebriefs` | ≤ candidates | `SELECT COUNT(*) FROM prebriefs;` |
| `interviews` | ≤ analytics files | `SELECT COUNT(*) FROM interviews;` |
| `analytics` | Same as analytics files | `SELECT COUNT(*) FROM analytics;` |
| `transcripts` | Same as transcript files | `SELECT COUNT(*) FROM transcripts;` |

---

## Next: [Phase 5 - Backend Integration](./phase5_backend.md)
