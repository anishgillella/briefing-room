#!/usr/bin/env python3
"""
Seed script to add default weekly availability for all interviewers.
Adds Monday-Friday 9am-5pm availability slots.
"""
import sys
import os

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from db.client import get_db
import uuid


def seed_interviewer_availability():
    """Add default availability for all interviewers."""
    db = get_db()

    # Get all managers/interviewers
    result = db.table("hiring_managers").select("*").execute()
    managers = result.data or []

    # Filter to interviewers
    interviewers = [m for m in managers if m.get("role") in ["interviewer", "both", None]]

    print(f"Found {len(interviewers)} interviewers")

    for interviewer in interviewers:
        interviewer_id = interviewer["id"]
        name = interviewer.get("name", "Unknown")

        # Check if they already have availability
        existing = db.table("availability_weekly")\
            .select("*")\
            .eq("interviewer_id", interviewer_id)\
            .execute()

        if existing.data:
            print(f"  {name}: Already has {len(existing.data)} availability slots, skipping")
            continue

        # Create default availability: Monday-Friday, 9am-5pm
        # day_of_week: 0=Sunday, 1=Monday, ..., 6=Saturday
        slots_created = 0
        for day_of_week in [1, 2, 3, 4, 5]:  # Monday-Friday
            slot_data = {
                "id": str(uuid.uuid4()),
                "interviewer_id": interviewer_id,
                "day_of_week": day_of_week,
                "start_time": "09:00:00",
                "end_time": "17:00:00",
                "is_active": True,
            }

            try:
                db.table("availability_weekly").insert(slot_data).execute()
                slots_created += 1
            except Exception as e:
                print(f"  Error creating slot for {name} on day {day_of_week}: {e}")

        print(f"  {name}: Created {slots_created} availability slots (Mon-Fri 9am-5pm)")

        # Also ensure interviewer settings exist (if table exists)
        try:
            settings_result = db.table("interviewer_settings")\
                .select("*")\
                .eq("interviewer_id", interviewer_id)\
                .execute()

            if not settings_result.data:
                settings_data = {
                    "interviewer_id": interviewer_id,
                    "timezone": "America/New_York",
                    "default_interview_duration_minutes": 45,
                    "max_interviews_per_day": 5,
                }
                db.table("interviewer_settings").insert(settings_data).execute()
                print(f"  {name}: Created default settings")
        except Exception as e:
            # Table might not exist, that's okay
            pass

    print("\nDone!")


if __name__ == "__main__":
    seed_interviewer_availability()
