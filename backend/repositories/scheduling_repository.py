"""
Scheduling repository for availability and interview scheduling operations.
"""
from typing import Optional, List
from datetime import datetime, date, time, timedelta
import logging
import uuid
from zoneinfo import ZoneInfo

from db.client import get_db

logger = logging.getLogger(__name__)


class SchedulingRepository:
    """Repository for interview scheduling and availability operations."""

    def __init__(self):
        self.weekly_table = "availability_weekly"
        self.overrides_table = "availability_overrides"
        self.interviews_table = "interviews"
        self.managers_table = "hiring_managers"

    def _get_db(self):
        """Get database client."""
        return get_db()

    # ============================================
    # WEEKLY AVAILABILITY
    # ============================================

    def get_weekly_availability(self, interviewer_id: str) -> List[dict]:
        """Get all weekly availability slots for an interviewer."""
        try:
            result = self._get_db().table(self.weekly_table)\
                .select("*")\
                .eq("interviewer_id", interviewer_id)\
                .eq("is_active", True)\
                .order("day_of_week")\
                .order("start_time")\
                .execute()
            return result.data or []
        except Exception as e:
            logger.error(f"Error getting weekly availability: {e}")
            return []

    def create_weekly_slot(
        self,
        interviewer_id: str,
        day_of_week: int,
        start_time: time,
        end_time: time
    ) -> Optional[dict]:
        """Create a weekly availability slot."""
        try:
            data = {
                "id": str(uuid.uuid4()),
                "interviewer_id": interviewer_id,
                "day_of_week": day_of_week,
                "start_time": start_time.isoformat(),
                "end_time": end_time.isoformat(),
                "is_active": True,
            }
            result = self._get_db().table(self.weekly_table)\
                .insert(data)\
                .execute()
            return result.data[0] if result.data else None
        except Exception as e:
            logger.error(f"Error creating weekly slot: {e}")
            return None

    def delete_weekly_slot(self, slot_id: str) -> bool:
        """Delete a weekly availability slot."""
        try:
            self._get_db().table(self.weekly_table)\
                .delete()\
                .eq("id", slot_id)\
                .execute()
            return True
        except Exception as e:
            logger.error(f"Error deleting weekly slot: {e}")
            return False

    def update_weekly_slot(self, slot_id: str, updates: dict) -> Optional[dict]:
        """Update a weekly availability slot."""
        try:
            # Convert time objects to strings
            if 'start_time' in updates and isinstance(updates['start_time'], time):
                updates['start_time'] = updates['start_time'].isoformat()
            if 'end_time' in updates and isinstance(updates['end_time'], time):
                updates['end_time'] = updates['end_time'].isoformat()

            updates['updated_at'] = datetime.utcnow().isoformat()
            result = self._get_db().table(self.weekly_table)\
                .update(updates)\
                .eq("id", slot_id)\
                .execute()
            return result.data[0] if result.data else None
        except Exception as e:
            logger.error(f"Error updating weekly slot: {e}")
            return None

    # ============================================
    # AVAILABILITY OVERRIDES
    # ============================================

    def get_overrides(
        self,
        interviewer_id: str,
        date_from: Optional[date] = None,
        date_to: Optional[date] = None
    ) -> List[dict]:
        """Get availability overrides for an interviewer within a date range."""
        try:
            query = self._get_db().table(self.overrides_table)\
                .select("*")\
                .eq("interviewer_id", interviewer_id)

            if date_from:
                query = query.gte("override_date", date_from.isoformat())
            if date_to:
                query = query.lte("override_date", date_to.isoformat())

            result = query.order("override_date").execute()
            return result.data or []
        except Exception as e:
            logger.error(f"Error getting overrides: {e}")
            return []

    def create_override(
        self,
        interviewer_id: str,
        override_date: date,
        override_type: str,
        start_time: Optional[time] = None,
        end_time: Optional[time] = None,
        reason: Optional[str] = None
    ) -> Optional[dict]:
        """Create an availability override."""
        try:
            data = {
                "id": str(uuid.uuid4()),
                "interviewer_id": interviewer_id,
                "override_date": override_date.isoformat(),
                "override_type": override_type,
                "reason": reason,
            }
            if start_time:
                data["start_time"] = start_time.isoformat()
            if end_time:
                data["end_time"] = end_time.isoformat()

            result = self._get_db().table(self.overrides_table)\
                .insert(data)\
                .execute()
            return result.data[0] if result.data else None
        except Exception as e:
            logger.error(f"Error creating override: {e}")
            return None

    def delete_override(self, override_id: str) -> bool:
        """Delete an availability override."""
        try:
            self._get_db().table(self.overrides_table)\
                .delete()\
                .eq("id", override_id)\
                .execute()
            return True
        except Exception as e:
            logger.error(f"Error deleting override: {e}")
            return False

    # ============================================
    # INTERVIEWER SETTINGS
    # ============================================

    def get_interviewer_settings(self, interviewer_id: str) -> Optional[dict]:
        """Get scheduling settings for an interviewer."""
        try:
            result = self._get_db().table(self.managers_table)\
                .select("id, name, email, timezone, default_interview_duration_minutes, max_interviews_per_day")\
                .eq("id", interviewer_id)\
                .single()\
                .execute()
            return result.data if result.data else None
        except Exception as e:
            logger.error(f"Error getting interviewer settings: {e}")
            return None

    def update_interviewer_settings(
        self,
        interviewer_id: str,
        updates: dict
    ) -> Optional[dict]:
        """Update scheduling settings for an interviewer."""
        try:
            allowed_fields = ['timezone', 'default_interview_duration_minutes', 'max_interviews_per_day']
            filtered_updates = {k: v for k, v in updates.items() if k in allowed_fields and v is not None}

            if not filtered_updates:
                return self.get_interviewer_settings(interviewer_id)

            filtered_updates['updated_at'] = datetime.utcnow().isoformat()
            result = self._get_db().table(self.managers_table)\
                .update(filtered_updates)\
                .eq("id", interviewer_id)\
                .execute()
            return result.data[0] if result.data else None
        except Exception as e:
            logger.error(f"Error updating interviewer settings: {e}")
            return None

    # ============================================
    # SCHEDULED INTERVIEWS
    # ============================================

    def get_scheduled_interviews(
        self,
        interviewer_id: Optional[str] = None,
        date_from: Optional[date] = None,
        date_to: Optional[date] = None,
        status: str = "scheduled"
    ) -> List[dict]:
        """Get scheduled interviews within a date range."""
        try:
            # Use explicit foreign key hint to disambiguate the relationship
            query = self._get_db().table(self.interviews_table)\
                .select("*, candidates!interviews_candidate_id_fkey(person_id, persons(name, email)), job_postings(title), hiring_managers!interviews_interviewer_id_fkey(name, email)")\
                .eq("status", status)\
                .not_.is_("scheduled_at", "null")

            if interviewer_id:
                query = query.eq("interviewer_id", interviewer_id)

            if date_from:
                query = query.gte("scheduled_at", datetime.combine(date_from, time.min).isoformat())
            if date_to:
                query = query.lte("scheduled_at", datetime.combine(date_to, time.max).isoformat())

            result = query.order("scheduled_at").execute()
            return result.data or []
        except Exception as e:
            logger.error(f"Error getting scheduled interviews: {e}")
            return []

    def schedule_interview(
        self,
        candidate_id: str,
        job_posting_id: str,
        interviewer_id: str,
        stage: str,
        scheduled_at: datetime,
        duration_minutes: int = 45,
        timezone: str = "America/New_York",
        interview_type: str = "live",
        room_name: Optional[str] = None,
        notes: Optional[str] = None
    ) -> Optional[dict]:
        """Create a scheduled interview."""
        try:
            interview_id = str(uuid.uuid4())
            if not room_name:
                room_name = f"interview-{interview_id[:8]}"

            data = {
                "id": interview_id,
                "candidate_id": candidate_id,
                "job_posting_id": job_posting_id,
                "interviewer_id": interviewer_id,
                "stage": stage,
                "interview_type": interview_type,
                "scheduled_at": scheduled_at.isoformat(),
                "duration_minutes": duration_minutes,
                "timezone": timezone,
                "room_name": room_name,
                "status": "scheduled",
                "notes": notes,
            }

            result = self._get_db().table(self.interviews_table)\
                .insert(data)\
                .execute()
            return result.data[0] if result.data else None
        except Exception as e:
            logger.error(f"Error scheduling interview: {e}")
            return None

    def reschedule_interview(
        self,
        interview_id: str,
        new_scheduled_at: datetime,
        new_interviewer_id: Optional[str] = None,
        reason: Optional[str] = None
    ) -> Optional[dict]:
        """Reschedule an existing interview."""
        try:
            updates = {
                "scheduled_at": new_scheduled_at.isoformat(),
            }
            if new_interviewer_id:
                updates["interviewer_id"] = new_interviewer_id
            if reason:
                updates["notes"] = f"Rescheduled: {reason}"

            result = self._get_db().table(self.interviews_table)\
                .update(updates)\
                .eq("id", interview_id)\
                .eq("status", "scheduled")\
                .execute()
            return result.data[0] if result.data else None
        except Exception as e:
            logger.error(f"Error rescheduling interview: {e}")
            return None

    def cancel_interview(
        self,
        interview_id: str,
        reason: Optional[str] = None
    ) -> Optional[dict]:
        """Cancel a scheduled interview."""
        try:
            updates = {
                "status": "cancelled",
                "cancel_reason": reason,
            }
            result = self._get_db().table(self.interviews_table)\
                .update(updates)\
                .eq("id", interview_id)\
                .execute()
            return result.data[0] if result.data else None
        except Exception as e:
            logger.error(f"Error cancelling interview: {e}")
            return None

    # ============================================
    # AVAILABILITY CALCULATION
    # ============================================

    def get_available_slots(
        self,
        interviewer_id: str,
        date_from: date,
        date_to: date,
        duration_minutes: int = 45,
        timezone: str = "America/New_York"
    ) -> List[dict]:
        """
        Calculate available time slots for an interviewer.
        Combines weekly availability with overrides and existing bookings.
        """
        try:
            # Get interviewer settings
            settings = self.get_interviewer_settings(interviewer_id)
            if not settings:
                return []

            interviewer_tz = ZoneInfo(settings.get('timezone', timezone))

            # Get weekly availability
            weekly_slots = self.get_weekly_availability(interviewer_id)

            # Get overrides for date range
            overrides = self.get_overrides(interviewer_id, date_from, date_to)

            # Get existing scheduled interviews
            existing = self.get_scheduled_interviews(
                interviewer_id=interviewer_id,
                date_from=date_from,
                date_to=date_to,
                status="scheduled"
            )

            # Build list of available slots
            available_slots = []
            current_date = date_from

            while current_date <= date_to:
                day_of_week = (current_date.weekday() + 1) % 7  # Convert to 0=Sunday

                # Check for unavailable override for whole day
                day_unavailable = any(
                    o['override_date'] == current_date.isoformat() and
                    o['override_type'] == 'unavailable' and
                    o['start_time'] is None
                    for o in overrides
                )

                if day_unavailable:
                    current_date += timedelta(days=1)
                    continue

                # Get base slots from weekly availability
                day_slots = [
                    s for s in weekly_slots
                    if s['day_of_week'] == day_of_week
                ]

                # Add available overrides for this date
                for override in overrides:
                    if (override['override_date'] == current_date.isoformat() and
                        override['override_type'] == 'available' and
                        override['start_time'] is not None):
                        day_slots.append({
                            'start_time': override['start_time'],
                            'end_time': override['end_time'],
                        })

                # Process each slot
                for slot in day_slots:
                    start_time_str = slot['start_time']
                    end_time_str = slot['end_time']

                    # Parse times
                    if isinstance(start_time_str, str):
                        slot_start = time.fromisoformat(start_time_str)
                    else:
                        slot_start = start_time_str

                    if isinstance(end_time_str, str):
                        slot_end = time.fromisoformat(end_time_str)
                    else:
                        slot_end = end_time_str

                    # Generate slots at duration_minutes intervals
                    current_time = datetime.combine(current_date, slot_start)
                    slot_end_dt = datetime.combine(current_date, slot_end)

                    while current_time + timedelta(minutes=duration_minutes) <= slot_end_dt:
                        slot_end_time = current_time + timedelta(minutes=duration_minutes)

                        # Check if blocked by unavailable override
                        is_blocked = any(
                            o['override_date'] == current_date.isoformat() and
                            o['override_type'] == 'unavailable' and
                            o['start_time'] is not None and
                            self._times_overlap(
                                current_time.time(),
                                slot_end_time.time(),
                                time.fromisoformat(o['start_time']),
                                time.fromisoformat(o['end_time'])
                            )
                            for o in overrides
                        )

                        # Check if blocked by existing interview
                        if not is_blocked:
                            is_blocked = any(
                                self._datetimes_overlap(
                                    current_time,
                                    slot_end_time,
                                    datetime.fromisoformat(e['scheduled_at'].replace('Z', '+00:00')),
                                    datetime.fromisoformat(e['scheduled_at'].replace('Z', '+00:00')) + timedelta(minutes=e.get('duration_minutes', 45))
                                )
                                for e in existing
                            )

                        if not is_blocked:
                            # Make timezone-aware
                            aware_start = current_time.replace(tzinfo=interviewer_tz)
                            aware_end = slot_end_time.replace(tzinfo=interviewer_tz)

                            available_slots.append({
                                "start": aware_start.isoformat(),
                                "end": aware_end.isoformat(),
                                "interviewer_id": interviewer_id,
                                "interviewer_name": settings.get('name'),
                                "is_available": True,
                            })

                        current_time += timedelta(minutes=duration_minutes)

                current_date += timedelta(days=1)

            return available_slots

        except Exception as e:
            logger.error(f"Error calculating available slots: {e}")
            return []

    def _times_overlap(
        self,
        start1: time,
        end1: time,
        start2: time,
        end2: time
    ) -> bool:
        """Check if two time ranges overlap."""
        return start1 < end2 and end1 > start2

    def _datetimes_overlap(
        self,
        start1: datetime,
        end1: datetime,
        start2: datetime,
        end2: datetime
    ) -> bool:
        """Check if two datetime ranges overlap."""
        # Make both naive for comparison if needed
        if start1.tzinfo is None and start2.tzinfo is not None:
            start2 = start2.replace(tzinfo=None)
            end2 = end2.replace(tzinfo=None)
        elif start1.tzinfo is not None and start2.tzinfo is None:
            start1 = start1.replace(tzinfo=None)
            end1 = end1.replace(tzinfo=None)

        return start1 < end2 and end1 > start2
