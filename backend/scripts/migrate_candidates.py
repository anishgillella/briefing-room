#!/usr/bin/env python3
"""
Migration script to move candidates from JSON to Supabase.
Creates proper UUID-based records and maintains a mapping file.
"""
import json
import uuid
import sys
from pathlib import Path
from datetime import datetime

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from db.client import get_db


def migrate_candidates():
    """Migrate candidates from JSON to Supabase."""
    
    # Load JSON candidates
    json_path = Path(__file__).parent.parent / "data" / "candidates.json"
    if not json_path.exists():
        print(f"❌ Candidates file not found: {json_path}")
        return False
    
    with open(json_path) as f:
        data = json.load(f)
    
    candidates = data.get("candidates", [])
    print(f"📦 Found {len(candidates)} candidates to migrate")
    
    # Connect to Supabase
    db = get_db()
    if not db:
        print("❌ Failed to connect to Supabase")
        return False
    
    # First, create a default job posting if none exists
    job_result = db.table("job_postings").select("id").limit(1).execute()
    if job_result.data:
        job_posting_id = job_result.data[0]["id"]
        print(f"✅ Using existing job posting: {job_posting_id[:8]}...")
    else:
        # Create a default job posting
        job_data = {
            "title": "Founding Account Executive",
            "description": "AI SaaS Marketplace - Founding AE role requiring 1+ years closing experience.",
            "company_context": "Fast-growing AI startup",
        }
        job_result = db.table("job_postings").insert(job_data).execute()
        job_posting_id = job_result.data[0]["id"]
        print(f"✅ Created default job posting: {job_posting_id[:8]}...")
    
    # Mapping from old JSON ID to new Supabase UUID
    id_mapping = {}
    migrated = 0
    skipped = 0
    
    for candidate in candidates:
        old_id = candidate.get("id")
        
        # Generate new UUID
        new_uuid = str(uuid.uuid4())
        
        # Map fields to Supabase schema
        db_candidate = {
            "id": new_uuid,
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
            "education": candidate.get("education", []),
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
            "source": "csv_upload",
            "has_enrichment_data": candidate.get("has_enrichment_data", False),
        }
        
        # Update pipeline status based on interview_status
        interview_status = candidate.get("interview_status")
        if interview_status == "completed":
            db_candidate["pipeline_status"] = "round_1"
        
        try:
            result = db.table("candidates").insert(db_candidate).execute()
            if result.data:
                id_mapping[old_id] = new_uuid
                migrated += 1
                print(f"  ✓ Migrated: {candidate.get('name', 'Unknown')[:30]} ({old_id} → {new_uuid[:8]}...)")
            else:
                skipped += 1
                print(f"  ✗ Failed: {candidate.get('name', 'Unknown')[:30]}")
        except Exception as e:
            skipped += 1
            print(f"  ✗ Error migrating {candidate.get('name', 'Unknown')[:30]}: {e}")
    
    # Save ID mapping for reference
    mapping_path = Path(__file__).parent.parent / "data" / "id_mapping.json"
    with open(mapping_path, "w") as f:
        json.dump(id_mapping, f, indent=2)
    print(f"\n📋 ID mapping saved to: {mapping_path}")
    
    print(f"\n✅ Migration complete: {migrated} migrated, {skipped} skipped")
    
    # Verify count
    count_result = db.table("candidates").select("id", count="exact").execute()
    print(f"📊 Total candidates in Supabase: {count_result.count}")
    
    return True


if __name__ == "__main__":
    print("=" * 50)
    print("CANDIDATE MIGRATION: JSON → Supabase")
    print("=" * 50)
    print()
    
    success = migrate_candidates()
    
    if success:
        print("\n🎉 Migration successful!")
    else:
        print("\n❌ Migration failed!")
        sys.exit(1)
