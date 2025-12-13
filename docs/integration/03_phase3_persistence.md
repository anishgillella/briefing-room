# Phase 3: Database Integration

## Goal
Transition from local JSON storage to Supabase for production-ready persistence.

## Storage Tiers

```
┌─────────────────────────────────────────────────────────────────────┐
│  HOT (In-Memory)    │ Active sessions, processing state           │
├─────────────────────────────────────────────────────────────────────┤
│  WARM (Supabase)    │ Candidates, interviews, analytics           │
├─────────────────────────────────────────────────────────────────────┤
│  COLD (AWS S3)      │ Transcripts, audio recordings, exports      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3.1 Supabase Table Creation

### Migration Order
1. `organizations` - Multi-tenancy foundation
2. `job_descriptions` - JD storage
3. `candidates` - Main candidate table
4. `interviews` - Interview sessions
5. `analytics` - Post-interview analysis
6. `prebriefs` - Cached pre-briefing data
7. `intake_sessions` - Candidate intake tracking

See [Database Schema](./05_database_schema.md) for full table definitions.

---

## 3.2 Data Migration

### Local → Supabase Script
```python
# scripts/migrate_to_supabase.py

async def migrate():
    # 1. Load local JSON
    candidates = load_json("data/candidates.json")
    
    # 2. Upsert to Supabase
    for c in candidates:
        await supabase.table("candidates").upsert(c)
    
    # 3. Verify counts match
    assert len(candidates) == count_supabase_candidates()
```

---

## 3.3 Service Layer Updates

### Repository Pattern
```python
# services/candidate_repository.py

class CandidateRepository:
    async def get_by_id(self, id: str) -> Candidate:
        # Try memory cache first
        # Then Supabase
        pass
    
    async def save(self, candidate: Candidate) -> None:
        # Write to Supabase
        # Invalidate cache
        pass
    
    async def list(self, filters: dict) -> List[Candidate]:
        pass
```

### Wire Up
- Replace direct JSON reads with repository calls
- Keep local JSON as fallback/backup

---

## 3.4 AWS S3 for Large Files

### What Goes to S3
- `transcripts/{interview_id}.txt` - Full transcripts
- `audio/{interview_id}.webm` - Interview recordings (optional)
- `exports/{timestamp}_report.csv` - Generated reports

### Supabase References
```sql
-- In interviews table
transcript_s3_key TEXT,  -- e.g., "transcripts/abc123.txt"
audio_s3_key TEXT        -- e.g., "audio/abc123.webm"
```

---

## 3.5 Sync Strategy

### Write Path
1. Write to Supabase (source of truth)
2. Async upload large files to S3
3. Update Supabase with S3 keys

### Read Path
1. Query Supabase for metadata
2. Fetch S3 files on-demand
3. Cache locally for active sessions

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `services/supabase.py` | MODIFY | Add table operations |
| `services/s3_storage.py` | CREATE | S3 upload/download |
| `services/candidate_repository.py` | CREATE | Repository pattern |
| `scripts/migrate_to_supabase.py` | CREATE | Migration script |

---

## Success Criteria

- [ ] All tables created in Supabase
- [ ] Local data migrated successfully
- [ ] CRUD operations work via Supabase
- [ ] Transcripts stored in S3
- [ ] Fallback to local JSON if Supabase unavailable
