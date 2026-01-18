"""
Cleanup script to remove orphaned persons from the database.

An orphaned person is one that:
- Has no associated candidates (never uploaded to a job)
- OR has no email/linkedin (incomplete data)

This keeps only legitimate candidates that were uploaded and processed.
"""

import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from db.client import get_db


def get_person_ids_with_candidates(client) -> set:
    """Get all person IDs that have at least one candidate record."""
    result = client.table("candidates").select("person_id").execute()
    return {row["person_id"] for row in result.data if row.get("person_id")}


def get_all_person_ids(client) -> list:
    """Get all person IDs from the persons table."""
    result = client.table("persons").select("id, name, email").execute()
    return result.data


def delete_persons(client, person_ids: list) -> int:
    """Delete persons by their IDs. Returns count deleted."""
    deleted = 0
    for person_id in person_ids:
        try:
            result = client.table("persons").delete().eq("id", person_id).execute()
            if result.data:
                deleted += 1
        except Exception as e:
            print(f"  Error deleting {person_id}: {e}")
    return deleted


def main():
    print("=" * 60)
    print("ORPHAN PERSONS CLEANUP SCRIPT")
    print("=" * 60)

    client = get_db()

    # Get all persons
    all_persons = get_all_person_ids(client)
    print(f"\nTotal persons in database: {len(all_persons)}")

    # Get persons that have candidates
    persons_with_candidates = get_person_ids_with_candidates(client)
    print(f"Persons with candidates: {len(persons_with_candidates)}")

    # Find orphans (persons without any candidates)
    orphan_ids = []
    orphan_names = []
    for person in all_persons:
        if person["id"] not in persons_with_candidates:
            orphan_ids.append(person["id"])
            orphan_names.append(f"{person.get('name', 'Unknown')} ({person.get('email', 'no email')})")

    print(f"Orphaned persons (no candidates): {len(orphan_ids)}")

    if not orphan_ids:
        print("\nNo orphaned persons found. Database is clean!")
        return

    # Show preview
    print("\n" + "-" * 40)
    print("ORPHANED PERSONS TO DELETE:")
    print("-" * 40)
    for i, name in enumerate(orphan_names[:20]):
        print(f"  {i+1}. {name}")
    if len(orphan_names) > 20:
        print(f"  ... and {len(orphan_names) - 20} more")

    # Auto-confirm deletion (set to True to skip prompt)
    auto_confirm = "--confirm" in sys.argv

    if not auto_confirm:
        print("\n" + "=" * 60)
        print("Run with --confirm flag to delete these persons")
        print("Example: python scripts/cleanup_orphan_persons.py --confirm")
        return

    # Delete orphans
    print("\nDeleting orphaned persons...")
    deleted_count = delete_persons(client, orphan_ids)

    print(f"\nDeleted {deleted_count} orphaned persons.")

    # Verify final count
    final_persons = get_all_person_ids(client)
    print(f"Remaining persons: {len(final_persons)}")
    print("\nCleanup complete!")


if __name__ == "__main__":
    main()
