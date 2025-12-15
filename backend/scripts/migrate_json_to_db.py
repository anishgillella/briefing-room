"""
Migrate existing JSON data to Supabase database.

Run: python scripts/migrate_json_to_db.py
"""
import json
import os
import sys
from pathlib import Path
from datetime import datetime
import uuid

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from db.client import get_db

DATA_DIR = Path(__file__).parent.parent / "data"


def print_header(message: str):
    """Print a formatted header."""
    print("\n" + "=" * 60)
    print(f"  {message}")
    print("=" * 60)


def migrate_job_posting() -> str:
    """Create a default job posting for existing candidates."""
    print("\n📋 Creating default job posting...")
    
    db = get_db()
    
    job = {
        "id": str(uuid.uuid4()),
        "title": "Migrated Job Posting",
        "description": "Default job posting for migrated candidates from CSV upload.",
        "company_context": "Migrated from legacy JSON storage",
        "scoring_criteria": {},
        "red_flag_indicators": []
    }
    
    try:
        result = db.table("job_postings").insert(job).execute()
        job_id = result.data[0]["id"]
        print(f"   ✅ Created job posting: {job_id[:8]}...")
        return job_id
    except Exception as e:
        print(f"   ❌ Error creating job posting: {e}")
        raise


def migrate_candidates(job_posting_id: str) -> dict:
    """Migrate candidates from JSON to database."""
    print("\n👥 Migrating candidates...")
    
    candidates_file = DATA_DIR / "candidates.json"
    if not candidates_file.exists():
        print("   ⚠️ No candidates.json found, skipping")
        return {}
    
    with open(candidates_file) as f:
        data = json.load(f)
    
    candidates = data.get("candidates", [])
    if not candidates:
        print("   ⚠️ No candidates in file, skipping")
        return {}
    
    db = get_db()
    id_mapping = {}  # old_id -> new_uuid
    success_count = 0
    
    for candidate in candidates:
        old_id = candidate.get("id")
        new_id = str(uuid.uuid4())
        id_mapping[old_id] = new_id
        
        # Map fields to database schema
        db_candidate = {
            "id": new_id,
            "job_posting_id": job_posting_id,
            "name": candidate.get("name", "Unknown"),
            "email": candidate.get("email"),
            "linkedin_url": candidate.get("linkedin_url"),
            "job_title": candidate.get("job_title"),
            "current_company": candidate.get("current_company"),
            "location_city": candidate.get("location_city"),
            "location_state": candidate.get("location_state"),
            "years_experience": candidate.get("years_experience"),
            "bio_summary": candidate.get("bio_summary"),
            "skills": candidate.get("skills", []),
            "industries": candidate.get("industries", []),
            "education": [candidate.get("education")] if candidate.get("education") else [],
            "algo_score": candidate.get("algo_score"),
            "ai_score": candidate.get("ai_score"),
            "combined_score": candidate.get("combined_score"),
            "tier": candidate.get("tier"),
            "one_line_summary": candidate.get("one_line_summary"),
            "pros": candidate.get("pros", []),
            "cons": candidate.get("cons", []),
            "reasoning": candidate.get("reasoning"),
            "interview_questions": candidate.get("interview_questions", []),
            "pipeline_status": "new",
            "source": candidate.get("source", "csv_upload"),
            "has_enrichment_data": candidate.get("has_enrichment_data", False),
        }
        
        # Remove None values
        db_candidate = {k: v for k, v in db_candidate.items() if v is not None}
        
        try:
            db.table("candidates").insert(db_candidate).execute()
            success_count += 1
            print(f"   ✅ {candidate.get('name', 'Unknown')}")
        except Exception as e:
            print(f"   ❌ {candidate.get('name', 'Unknown')}: {e}")
    
    print(f"\n   📊 Migrated {success_count}/{len(candidates)} candidates")
    return id_mapping


def migrate_prebriefs(id_mapping: dict):
    """Migrate prebrief files."""
    print("\n📝 Migrating prebriefs...")
    
    prebriefs_dir = DATA_DIR / "prebriefs"
    if not prebriefs_dir.exists():
        print("   ⚠️ No prebriefs directory found, skipping")
        return
    
    db = get_db()
    count = 0
    
    for file in prebriefs_dir.glob("*.json"):
        old_id = file.stem
        new_id = id_mapping.get(old_id)
        
        if not new_id:
            print(f"   ⚠️ Skipping {file.name} - no matching candidate")
            continue
        
        try:
            with open(file) as f:
                content = json.load(f)
            
            prebrief = {
                "id": str(uuid.uuid4()),
                "candidate_id": new_id,
                "content": content
            }
            
            db.table("prebriefs").insert(prebrief).execute()
            count += 1
            print(f"   ✅ Prebrief for candidate {old_id[:8]}...")
        except Exception as e:
            print(f"   ❌ {file.name}: {e}")
    
    print(f"\n   📊 Migrated {count} prebriefs")


def migrate_analytics(id_mapping: dict):
    """Migrate analytics files to interviews + analytics tables."""
    print("\n📊 Migrating analytics...")
    
    analytics_dir = DATA_DIR / "analytics"
    if not analytics_dir.exists():
        print("   ⚠️ No analytics directory found, skipping")
        return
    
    db = get_db()
    count = 0
    
    for file in analytics_dir.glob("*.json"):
        # Parse filename: {id}_{timestamp}.json or {id}.json
        parts = file.stem.split("_", 1)
        old_id = parts[0]
        new_candidate_id = id_mapping.get(old_id)
        
        if not new_candidate_id:
            print(f"   ⚠️ Skipping {file.name} - no matching candidate")
            continue
        
        try:
            with open(file) as f:
                content = json.load(f)
            
            # Create interview record (default to round_1)
            interview_id = str(uuid.uuid4())
            interview = {
                "id": interview_id,
                "candidate_id": new_candidate_id,
                "stage": "round_1",
                "status": "completed",
                "started_at": datetime.now().isoformat(),
                "ended_at": datetime.now().isoformat(),
            }
            db.table("interviews").insert(interview).execute()
            
            # Create analytics record
            analytics = {
                "id": str(uuid.uuid4()),
                "interview_id": interview_id,
                "overall_score": content.get("overall", {}).get("overall_score") or content.get("overall_score"),
                "recommendation": content.get("overall", {}).get("recommendation") or content.get("recommendation"),
                "synthesis": content.get("overall", {}).get("recommendation_reasoning") or content.get("synthesis", ""),
                "question_analytics": content.get("qa_pairs", []),
                "skill_evidence": [],
                "behavioral_profile": {},
                "topics_to_probe": content.get("highlights", {}).get("areas_to_probe", []),
            }
            db.table("analytics").insert(analytics).execute()
            
            count += 1
            print(f"   ✅ Analytics for candidate {old_id[:8]}...")
        except Exception as e:
            print(f"   ❌ {file.name}: {e}")
    
    print(f"\n   📊 Migrated {count} analytics records")


def migrate_transcripts(id_mapping: dict):
    """Migrate transcript files."""
    print("\n🎙️ Migrating transcripts...")
    
    transcripts_dir = DATA_DIR / "transcripts"
    if not transcripts_dir.exists():
        print("   ⚠️ No transcripts directory found, skipping")
        return
    
    db = get_db()
    count = 0
    
    # Get existing interviews to link transcripts
    interviews_result = db.table("interviews").select("id, candidate_id").execute()
    candidate_to_interview = {i["candidate_id"]: i["id"] for i in interviews_result.data}
    
    for file in transcripts_dir.glob("*.json"):
        parts = file.stem.split("_", 1)
        old_id = parts[0]
        new_candidate_id = id_mapping.get(old_id)
        interview_id = candidate_to_interview.get(new_candidate_id)
        
        if not interview_id:
            print(f"   ⚠️ Skipping {file.name} - no matching interview")
            continue
        
        try:
            with open(file) as f:
                content = json.load(f)
            
            # Handle different formats
            turns = content if isinstance(content, list) else content.get("turns", [])
            full_text = "\n".join([
                f"{t.get('speaker', 'unknown')}: {t.get('text', '')}" 
                for t in turns
            ])
            
            transcript = {
                "id": str(uuid.uuid4()),
                "interview_id": interview_id,
                "turns": turns,
                "full_text": full_text
            }
            
            db.table("transcripts").insert(transcript).execute()
            count += 1
            print(f"   ✅ Transcript for candidate {old_id[:8]}...")
        except Exception as e:
            print(f"   ❌ {file.name}: {e}")
    
    print(f"\n   📊 Migrated {count} transcripts")


def verify_migration():
    """Verify migration was successful."""
    print("\n🔍 Verifying migration...")
    
    db = get_db()
    
    tables = ["job_postings", "candidates", "prebriefs", "interviews", "analytics", "transcripts"]
    
    for table in tables:
        try:
            result = db.table(table).select("id", count="exact").execute()
            count = result.count or 0
            print(f"   {table}: {count} records")
        except Exception as e:
            print(f"   {table}: ❌ Error: {e}")


def main():
    print_header("PLUTO DATA MIGRATION")
    print(f"Data directory: {DATA_DIR}")
    
    try:
        # Step 1: Create job posting
        job_posting_id = migrate_job_posting()
        
        # Step 2: Migrate candidates
        id_mapping = migrate_candidates(job_posting_id)
        
        # Step 3: Migrate prebriefs
        migrate_prebriefs(id_mapping)
        
        # Step 4: Migrate analytics (creates interviews)
        migrate_analytics(id_mapping)
        
        # Step 5: Migrate transcripts
        migrate_transcripts(id_mapping)
        
        # Step 6: Verify
        verify_migration()
        
        print_header("MIGRATION COMPLETE! ✅")
        
    except Exception as e:
        print_header(f"MIGRATION FAILED: {e}")
        raise


if __name__ == "__main__":
    main()
