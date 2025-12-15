# Database Persistence Integration

This folder contains the implementation documentation for migrating from file-based JSON storage to a proper database (Supabase/PostgreSQL).

## Overview

The Pluto platform currently stores all data in JSON files. This integration adds:
- ✅ Multi-stage interview tracking
- ✅ Relational data integrity
- ✅ Accumulated context across interview stages
- ✅ Question redundancy prevention
- ✅ Scalable storage for transcripts and analytics

## Phases

| Phase | Document | Description |
|-------|----------|-------------|
| 1 | [Schema Design](./phase1_schema.md) | Database tables, relationships, and JSONB structures |
| 2 | [Supabase Setup](./phase2_supabase_setup.md) | Project creation, migrations, and configuration |
| 3 | [Python Models](./phase3_python_models.md) | SQLAlchemy/Supabase SDK models and repositories |
| 4 | [Data Migration](./phase4_migration.md) | Migrating existing JSON data to database |
| 5 | [Backend Integration](./phase5_backend.md) | Updating FastAPI routes to use database |
| 6 | [Frontend Updates](./phase6_frontend.md) | Multi-stage context in the UI |

## Tech Stack

- **Database**: Supabase (PostgreSQL 15+)
- **ORM**: SQLAlchemy 2.0 or `supabase-py`
- **Migrations**: Alembic or Supabase Dashboard
- **Blob Storage**: Supabase Storage (S3-compatible)

## Quick Start

```bash
# After Supabase project is created
pip install supabase sqlalchemy asyncpg

# Run migrations
alembic upgrade head

# Migrate existing data
python scripts/migrate_json_to_db.py
```
