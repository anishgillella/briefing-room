"""
Phase 7 Dashboard Tests - Recruiter dashboard endpoints.

Tests:
1. Dashboard statistics endpoint
2. Jobs summary endpoint
3. Pipeline statistics endpoint
4. Recent activity endpoint
5. Top candidates endpoint
6. Job-specific dashboard summary
"""

import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from uuid import uuid4, UUID
from datetime import datetime, timedelta
import json
from unittest.mock import patch, MagicMock

# Add backend to path
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from main import app
from models.streamlined.job import Job, JobCreate, JobUpdate, ScoringCriteria
from models.streamlined.person import PersonCreate
from models.streamlined.candidate import CandidateCreate, CandidateUpdate, InterviewStatus
from models.streamlined.interview import InterviewCreate, InterviewUpdate, InterviewType, InterviewSessionStatus
from models.streamlined.analytics import AnalyticsCreate, CompetencyScore, Recommendation
from repositories.streamlined.job_repo import JobRepository
from repositories.streamlined.person_repo import PersonRepository
from repositories.streamlined.candidate_repo import CandidateRepository
from repositories.streamlined.interview_repo import InterviewRepository
from repositories.streamlined.analytics_repo import AnalyticsRepository


# =============================================================================
# Test Fixtures
# =============================================================================

@pytest_asyncio.fixture
async def client():
    """Async HTTP client for testing."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client


@pytest.fixture
def job_repo():
    return JobRepository()


@pytest.fixture
def person_repo():
    return PersonRepository()


@pytest.fixture
def candidate_repo():
    return CandidateRepository()


@pytest.fixture
def interview_repo():
    return InterviewRepository()


@pytest.fixture
def analytics_repo():
    return AnalyticsRepository()


@pytest.fixture
def sample_job(job_repo):
    """Create a sample active job."""
    job = job_repo.create_sync(JobCreate(
        title=f"Test Dashboard Engineer {uuid4().hex[:6]}",
        raw_description="A test job for dashboard testing",
    ))
    yield job
    # Cleanup
    try:
        job_repo.delete_sync(job.id)
    except Exception:
        pass


@pytest.fixture
def sample_job_with_candidates(job_repo, person_repo, candidate_repo):
    """Create a job with multiple candidates in different states."""
    # Create job
    job = job_repo.create_sync(JobCreate(
        title=f"Dashboard Test Role {uuid4().hex[:6]}",
        raw_description="Testing dashboard with multiple candidates",
    ))

    candidates_created = []
    persons_created = []

    try:
        # Create candidates in different states
        states = [
            ("Alice Pending", "pending"),
            ("Bob InProgress", "in_progress"),
            ("Charlie Completed", "completed"),
            ("Diana Pending", "pending"),
            ("Eve Completed", "completed"),
        ]

        for name, status in states:
            unique_email = f"{name.lower().replace(' ', '_')}_{uuid4().hex[:6]}@test.com"
            person, _ = person_repo.get_or_create_sync(PersonCreate(
                name=name,
                email=unique_email,
            ))
            persons_created.append(person)

            candidate = candidate_repo.create_sync(CandidateCreate(
                person_id=person.id,
                job_id=job.id,
            ))

            # Update status
            candidate_repo.update_sync(candidate.id, CandidateUpdate(
                interview_status=InterviewStatus(status),
            ))
            candidates_created.append(candidate)

        yield {
            "job": job,
            "candidates": candidates_created,
            "persons": persons_created,
        }

    finally:
        # Cleanup
        for candidate in candidates_created:
            try:
                candidate_repo.delete_sync(candidate.id)
            except Exception:
                pass
        try:
            job_repo.delete_sync(job.id)
        except Exception:
            pass


@pytest.fixture
def sample_job_with_interviews_and_analytics(
    job_repo, person_repo, candidate_repo, interview_repo, analytics_repo
):
    """Create a complete job with candidates, interviews, and analytics."""
    # Create job
    job = job_repo.create_sync(JobCreate(
        title=f"Full Dashboard Test {uuid4().hex[:6]}",
        raw_description="Complete dashboard test with analytics",
    ))

    created_items = {
        "job": job,
        "candidates": [],
        "interviews": [],
        "analytics": [],
    }

    try:
        # Create candidates with different outcomes
        test_data = [
            ("Top Candidate", 92, "strong_hire"),
            ("Good Candidate", 78, "hire"),
            ("Maybe Candidate", 62, "maybe"),
            ("Weak Candidate", 45, "no_hire"),
        ]

        for name, score, recommendation in test_data:
            unique_email = f"{name.lower().replace(' ', '_')}_{uuid4().hex[:6]}@test.com"
            person, _ = person_repo.get_or_create_sync(PersonCreate(
                name=name,
                email=unique_email,
            ))

            candidate = candidate_repo.create_sync(CandidateCreate(
                person_id=person.id,
                job_id=job.id,
            ))
            candidate_repo.update_sync(candidate.id, CandidateUpdate(
                interview_status=InterviewStatus.COMPLETED,
            ))
            created_items["candidates"].append(candidate)

            # Create interview
            interview = interview_repo.create_sync(InterviewCreate(
                candidate_id=candidate.id,
                interview_type=InterviewType.AI_CANDIDATE,
            ))
            interview_repo.update_sync(interview.id, InterviewUpdate(
                status=InterviewSessionStatus.COMPLETED,
                started_at=datetime.utcnow() - timedelta(hours=2),
                ended_at=datetime.utcnow() - timedelta(hours=1),
                duration_seconds=3600,
                transcript="Test interview transcript",
            ))
            # Set job_posting_id directly for analytics query to work
            from db.client import get_db
            db = get_db()
            db.table("interviews").update({
                "job_posting_id": str(job.id)
            }).eq("id", str(interview.id)).execute()

            created_items["interviews"].append(interview)

            # Create analytics
            rec_enum = {
                "strong_hire": Recommendation.STRONG_HIRE,
                "hire": Recommendation.HIRE,
                "maybe": Recommendation.MAYBE,
                "no_hire": Recommendation.NO_HIRE,
            }[recommendation]

            analytics = analytics_repo.create_sync(AnalyticsCreate(
                interview_id=interview.id,
                overall_score=score,
                competency_scores=[
                    CompetencyScore(name="Technical", score=score, evidence=[], notes="Test"),
                ],
                strengths=["Strength 1"],
                concerns=["Concern 1"] if score < 70 else [],
                red_flags_detected=[],
                recommendation=rec_enum,
                summary=f"Test analytics for {name}",
            ))
            created_items["analytics"].append(analytics)

        yield created_items

    finally:
        # Cleanup in reverse order
        for analytics in created_items["analytics"]:
            try:
                analytics_repo.delete_sync(analytics.id)
            except Exception:
                pass
        for interview in created_items["interviews"]:
            try:
                interview_repo.delete_sync(interview.id)
            except Exception:
                pass
        for candidate in created_items["candidates"]:
            try:
                candidate_repo.delete_sync(candidate.id)
            except Exception:
                pass
        try:
            job_repo.delete_sync(job.id)
        except Exception:
            pass


# =============================================================================
# Test Dashboard Stats Endpoint
# =============================================================================

class TestDashboardStats:
    """Tests for the dashboard stats endpoint."""

    @pytest.mark.asyncio
    async def test_get_dashboard_stats_empty(self, client):
        """Test dashboard stats with no data."""
        response = await client.get("/api/dashboard/stats")
        assert response.status_code == 200

        data = response.json()
        assert "active_jobs" in data
        assert "total_candidates" in data
        assert "interviewed_candidates" in data
        assert "pending_candidates" in data
        assert "avg_score" in data

    @pytest.mark.asyncio
    async def test_get_dashboard_stats_with_data(
        self, client, sample_job_with_candidates
    ):
        """Test dashboard stats with actual data."""
        response = await client.get("/api/dashboard/stats")
        assert response.status_code == 200

        data = response.json()
        # Should have at least our test job
        assert data["total_jobs"] >= 1
        # Should have our test candidates
        assert data["total_candidates"] >= 5

    @pytest.mark.asyncio
    async def test_dashboard_stats_include_analytics(
        self, client, sample_job_with_interviews_and_analytics
    ):
        """Test that dashboard stats include analytics data."""
        response = await client.get("/api/dashboard/stats")
        assert response.status_code == 200

        data = response.json()
        # Should have strong_hires count
        assert data["strong_hires"] >= 1
        # Should have average score
        assert data["avg_score"] > 0


# =============================================================================
# Test Jobs Summary Endpoint
# =============================================================================

class TestJobsSummary:
    """Tests for the jobs summary endpoint."""

    @pytest.mark.asyncio
    async def test_get_jobs_summary(self, client, sample_job):
        """Test getting jobs summary."""
        response = await client.get("/api/dashboard/jobs/summary")
        assert response.status_code == 200

        data = response.json()
        assert "jobs" in data
        assert "total_active" in data
        assert "total_all" in data

        # Should include our test job
        job_ids = [j["id"] for j in data["jobs"]]
        assert str(sample_job.id) in job_ids

    @pytest.mark.asyncio
    async def test_get_jobs_summary_with_limit(self, client, sample_job):
        """Test jobs summary with limit parameter."""
        response = await client.get("/api/dashboard/jobs/summary?limit=2")
        assert response.status_code == 200

        data = response.json()
        assert len(data["jobs"]) <= 2

    @pytest.mark.asyncio
    async def test_get_jobs_summary_with_status_filter(self, client, sample_job):
        """Test jobs summary with status filter."""
        response = await client.get("/api/dashboard/jobs/summary?status=active")
        assert response.status_code == 200

        data = response.json()
        # All returned jobs should be active
        for job in data["jobs"]:
            assert job["status"] == "active"

    @pytest.mark.asyncio
    async def test_jobs_summary_includes_candidate_counts(
        self, client, sample_job_with_candidates
    ):
        """Test that jobs summary includes accurate candidate counts."""
        job = sample_job_with_candidates["job"]

        response = await client.get("/api/dashboard/jobs/summary?limit=20")
        assert response.status_code == 200

        data = response.json()
        job_summary = next((j for j in data["jobs"] if j["id"] == str(job.id)), None)

        assert job_summary is not None
        assert job_summary["candidate_count"] == 5
        # 2 pending, 1 in_progress, 2 completed = 3 interviewed
        assert job_summary["interviewed_count"] == 3


# =============================================================================
# Test Pipeline Stats Endpoint
# =============================================================================

class TestPipelineStats:
    """Tests for the pipeline stats endpoint."""

    @pytest.mark.asyncio
    async def test_get_pipeline_stats(self, client):
        """Test getting pipeline statistics."""
        response = await client.get("/api/dashboard/pipeline")
        assert response.status_code == 200

        data = response.json()
        assert "applied" in data
        assert "in_progress" in data
        assert "completed" in data
        assert "strong_hire" in data
        assert "hire" in data
        assert "maybe" in data
        assert "no_hire" in data

    @pytest.mark.asyncio
    async def test_pipeline_stats_with_data(
        self, client, sample_job_with_candidates
    ):
        """Test pipeline stats with actual candidate data."""
        response = await client.get("/api/dashboard/pipeline")
        assert response.status_code == 200

        data = response.json()
        # We have 2 pending, 1 in_progress, 2 completed
        assert data["applied"] >= 2
        assert data["in_progress"] >= 1
        assert data["completed"] >= 2

    @pytest.mark.asyncio
    async def test_pipeline_stats_with_analytics(
        self, client, sample_job_with_interviews_and_analytics
    ):
        """Test pipeline stats include recommendation breakdown."""
        response = await client.get("/api/dashboard/pipeline")
        assert response.status_code == 200

        data = response.json()
        # We have 1 strong_hire, 1 hire, 1 maybe, 1 no_hire
        assert data["strong_hire"] >= 1
        assert data["hire"] >= 1
        assert data["maybe"] >= 1
        assert data["no_hire"] >= 1


# =============================================================================
# Test Recent Activity Endpoint
# =============================================================================

class TestRecentActivity:
    """Tests for the recent activity endpoint."""

    @pytest.mark.asyncio
    async def test_get_recent_activity(self, client):
        """Test getting recent activity."""
        response = await client.get("/api/dashboard/activity")
        assert response.status_code == 200

        data = response.json()
        assert "activities" in data
        assert "total" in data
        assert isinstance(data["activities"], list)

    @pytest.mark.asyncio
    async def test_recent_activity_with_limit(self, client):
        """Test recent activity with limit parameter."""
        response = await client.get("/api/dashboard/activity?limit=5")
        assert response.status_code == 200

        data = response.json()
        assert len(data["activities"]) <= 5

    @pytest.mark.asyncio
    async def test_recent_activity_with_days_filter(self, client):
        """Test recent activity with days filter."""
        response = await client.get("/api/dashboard/activity?days=30")
        assert response.status_code == 200

        data = response.json()
        # All activities should be within 30 days
        for activity in data["activities"]:
            # Could add date validation here
            assert "timestamp" in activity

    @pytest.mark.asyncio
    async def test_recent_activity_includes_scores(
        self, client, sample_job_with_interviews_and_analytics
    ):
        """Test that recent activity includes analytics scores."""
        response = await client.get("/api/dashboard/activity?limit=20")
        assert response.status_code == 200

        data = response.json()
        # Should have activities from our test data
        assert data["total"] >= 1

        # Activities with analytics should have scores
        activities_with_scores = [a for a in data["activities"] if a.get("score")]
        assert len(activities_with_scores) >= 1


# =============================================================================
# Test Top Candidates Endpoint
# =============================================================================

class TestTopCandidates:
    """Tests for the top candidates endpoint."""

    @pytest.mark.asyncio
    async def test_get_top_candidates(self, client):
        """Test getting top candidates."""
        response = await client.get("/api/dashboard/top-candidates")
        assert response.status_code == 200

        data = response.json()
        assert "candidates" in data
        assert "total" in data
        assert isinstance(data["candidates"], list)

    @pytest.mark.asyncio
    async def test_top_candidates_with_limit(self, client):
        """Test top candidates with limit parameter."""
        response = await client.get("/api/dashboard/top-candidates?limit=3")
        assert response.status_code == 200

        data = response.json()
        assert len(data["candidates"]) <= 3

    @pytest.mark.asyncio
    async def test_top_candidates_with_min_score(self, client):
        """Test top candidates with minimum score filter."""
        response = await client.get("/api/dashboard/top-candidates?min_score=70")
        assert response.status_code == 200

        data = response.json()
        # All candidates should have score >= 70
        for candidate in data["candidates"]:
            assert candidate["score"] >= 70

    @pytest.mark.asyncio
    async def test_top_candidates_sorted_by_score(
        self, client, sample_job_with_interviews_and_analytics
    ):
        """Test that top candidates are sorted by score (highest first)."""
        response = await client.get("/api/dashboard/top-candidates?limit=10")
        assert response.status_code == 200

        data = response.json()
        candidates = data["candidates"]

        # Verify sorted in descending order
        for i in range(len(candidates) - 1):
            assert candidates[i]["score"] >= candidates[i + 1]["score"]

    @pytest.mark.asyncio
    async def test_top_candidates_include_recommendation(
        self, client, sample_job_with_interviews_and_analytics
    ):
        """Test that top candidates include recommendation."""
        response = await client.get("/api/dashboard/top-candidates?limit=10")
        assert response.status_code == 200

        data = response.json()
        for candidate in data["candidates"]:
            assert "recommendation" in candidate
            assert candidate["recommendation"] in ["strong_hire", "hire", "maybe", "no_hire"]


# =============================================================================
# Test Job-Specific Dashboard Summary
# =============================================================================

class TestJobDashboardSummary:
    """Tests for the job-specific dashboard summary endpoint."""

    @pytest.mark.asyncio
    async def test_get_job_summary_not_found(self, client):
        """Test getting summary for non-existent job."""
        fake_id = uuid4()
        response = await client.get(f"/api/dashboard/job/{fake_id}/summary")
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_get_job_summary(self, client, sample_job):
        """Test getting job-specific dashboard summary."""
        response = await client.get(f"/api/dashboard/job/{sample_job.id}/summary")
        assert response.status_code == 200

        data = response.json()
        assert data["job_id"] == str(sample_job.id)
        assert data["job_title"] == sample_job.title
        assert "candidate_stats" in data
        assert "interview_stats" in data
        assert "analytics_stats" in data

    @pytest.mark.asyncio
    async def test_job_summary_with_candidates(
        self, client, sample_job_with_candidates
    ):
        """Test job summary includes accurate candidate stats."""
        job = sample_job_with_candidates["job"]

        response = await client.get(f"/api/dashboard/job/{job.id}/summary")
        assert response.status_code == 200

        data = response.json()
        stats = data["candidate_stats"]

        assert stats["total"] == 5
        assert stats["pending"] == 2
        assert stats["in_progress"] == 1
        assert stats["completed"] == 2

    @pytest.mark.asyncio
    async def test_job_summary_with_interviews_and_analytics(
        self, client, sample_job_with_interviews_and_analytics
    ):
        """Test job summary includes interview and analytics stats."""
        job = sample_job_with_interviews_and_analytics["job"]

        response = await client.get(f"/api/dashboard/job/{job.id}/summary")
        assert response.status_code == 200

        data = response.json()

        # Interview stats
        interview_stats = data["interview_stats"]
        assert interview_stats["total"] == 4
        assert interview_stats["completed"] == 4
        assert interview_stats["avg_duration_seconds"] == 3600  # 1 hour each
        assert interview_stats["avg_duration_minutes"] == 60.0

        # Analytics stats - verify structure is returned
        analytics_stats = data["analytics_stats"]
        assert "total_evaluated" in analytics_stats
        assert "avg_score" in analytics_stats
        assert "recommendations" in analytics_stats
        assert all(k in analytics_stats["recommendations"] for k in ["strong_hire", "hire", "maybe", "no_hire"])


# =============================================================================
# Integration Tests
# =============================================================================

class TestDashboardIntegration:
    """Integration tests for the complete dashboard flow."""

    @pytest.mark.asyncio
    async def test_full_dashboard_flow(
        self, client, sample_job_with_interviews_and_analytics
    ):
        """Test the complete dashboard data retrieval flow."""
        job = sample_job_with_interviews_and_analytics["job"]

        # 1. Get overall stats
        stats_response = await client.get("/api/dashboard/stats")
        assert stats_response.status_code == 200
        stats = stats_response.json()
        assert stats["total_jobs"] >= 1
        assert stats["total_candidates"] >= 4

        # 2. Get jobs summary
        jobs_response = await client.get("/api/dashboard/jobs/summary")
        assert jobs_response.status_code == 200
        jobs_data = jobs_response.json()
        assert jobs_data["total_all"] >= 1

        # 3. Get pipeline stats
        pipeline_response = await client.get("/api/dashboard/pipeline")
        assert pipeline_response.status_code == 200
        pipeline = pipeline_response.json()
        assert pipeline["completed"] >= 4

        # 4. Get recent activity
        activity_response = await client.get("/api/dashboard/activity")
        assert activity_response.status_code == 200
        activity = activity_response.json()
        assert activity["total"] >= 4

        # 5. Get top candidates
        top_response = await client.get("/api/dashboard/top-candidates")
        assert top_response.status_code == 200
        top = top_response.json()
        assert top["total"] >= 1
        # Top candidate should be the one with score 92
        if top["candidates"]:
            assert top["candidates"][0]["score"] >= 90

        # 6. Get job-specific summary
        job_summary_response = await client.get(f"/api/dashboard/job/{job.id}/summary")
        assert job_summary_response.status_code == 200
        job_summary = job_summary_response.json()
        # Verify structure is correct
        assert "analytics_stats" in job_summary
        assert "candidate_stats" in job_summary
        assert "interview_stats" in job_summary

        print("Full dashboard integration test passed!")

    @pytest.mark.asyncio
    async def test_dashboard_with_multiple_jobs(
        self, client, job_repo, person_repo, candidate_repo
    ):
        """Test dashboard with multiple jobs."""
        # Create 3 jobs
        jobs = []
        for i in range(3):
            job = job_repo.create_sync(JobCreate(
                title=f"Multi-Job Test {i} {uuid4().hex[:4]}",
                raw_description=f"Job {i} description",
            ))
            jobs.append(job)

            # Add some candidates
            for j in range(2):
                person, _ = person_repo.get_or_create_sync(PersonCreate(
                    name=f"Person {i}-{j}",
                    email=f"person_{i}_{j}_{uuid4().hex[:6]}@test.com",
                ))
                candidate_repo.create_sync(CandidateCreate(
                    person_id=person.id,
                    job_id=job.id,
                ))

        try:
            # Get dashboard stats
            response = await client.get("/api/dashboard/stats")
            assert response.status_code == 200
            data = response.json()

            # Should have at least our 3 jobs
            assert data["total_jobs"] >= 3
            # Should have at least our 6 candidates (2 per job)
            assert data["total_candidates"] >= 6

            # Get jobs summary
            jobs_response = await client.get("/api/dashboard/jobs/summary?limit=10")
            assert jobs_response.status_code == 200
            jobs_data = jobs_response.json()

            # Verify all our jobs are in the summary
            job_ids = [j["id"] for j in jobs_data["jobs"]]
            for job in jobs:
                assert str(job.id) in job_ids

            print("Multiple jobs dashboard test passed!")

        finally:
            # Cleanup
            for job in jobs:
                try:
                    # Delete candidates first
                    candidates = candidate_repo.list_by_job_sync(job.id)
                    for c in candidates:
                        candidate_repo.delete_sync(c.id)
                    job_repo.delete_sync(job.id)
                except Exception:
                    pass
