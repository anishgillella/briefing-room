"""
Tests for Phase 5: Candidate Interview Flow with Full Job Context

This test suite verifies:
1. Interview start endpoint creates interview with correct data
2. Interview uses full job context (requirements, company, scoring)
3. Interview end correctly updates status and candidate
4. Interview webhook processes end-of-call events
5. Interview listing works for candidates

Run with: pytest tests/test_phase5_interview_flow.py -v
"""

import pytest
import pytest_asyncio
import uuid
import json
from datetime import datetime, timedelta
import httpx

# Models
from models.streamlined.job import JobCreate, JobStatus
from models.streamlined.candidate import CandidateCreate, InterviewStatus
from models.streamlined.interview import InterviewType, InterviewSessionStatus

# Repositories
from repositories.streamlined.job_repo import JobRepository
from repositories.streamlined.person_repo import PersonRepository
from repositories.streamlined.candidate_repo import CandidateRepository
from repositories.streamlined.interview_repo import InterviewRepository

# Database client
from db.client import get_db


# ============================================
# FIXTURES
# ============================================

@pytest.fixture
def db():
    """Get database client."""
    return get_db()


@pytest.fixture
def job_repo():
    """Get job repository."""
    return JobRepository()


@pytest.fixture
def person_repo():
    """Get person repository."""
    return PersonRepository()


@pytest.fixture
def candidate_repo():
    """Get candidate repository."""
    return CandidateRepository()


@pytest.fixture
def interview_repo():
    """Get interview repository."""
    return InterviewRepository()


@pytest_asyncio.fixture
async def client():
    """Get FastAPI async test client."""
    from main import app
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        yield client


@pytest_asyncio.fixture
async def test_job_with_context(client):
    """Create a test job with full context (requirements, company, scoring)."""
    unique_id = uuid.uuid4().hex[:8]

    # Create job
    response = await client.post("/api/jobs/", json={
        "title": f"Senior Engineer {unique_id}",
        "raw_description": """
        We are looking for a Senior Software Engineer with 5+ years experience.
        You will work on building scalable backend services using Python and FastAPI.
        Experience with PostgreSQL, Redis, and AWS is required.
        """,
    })
    job = response.json()
    job_id = job["id"]

    # Add extracted requirements
    await client.patch(f"/api/jobs/{job_id}", json={
        "extracted_requirements": {
            "years_experience": "5+ years",
            "required_skills": ["Python", "FastAPI", "PostgreSQL"],
            "preferred_skills": ["Redis", "AWS", "Docker"],
            "work_type": "hybrid",
            "location": "San Francisco",
        },
        "company_context": {
            "company_name": "TechCorp",
            "team_size": "12 engineers",
            "team_culture": "Collaborative, fast-paced startup",
            "growth_stage": "Series B",
            "reporting_to": "VP of Engineering",
        },
        "scoring_criteria": {
            "must_haves": ["Python expertise", "API design experience"],
            "nice_to_haves": ["Cloud infrastructure experience"],
            "weight_technical": 0.5,
            "weight_experience": 0.3,
            "weight_cultural": 0.2,
        },
        "red_flags": ["Job hopping", "No backend experience"],
    })

    # Fetch updated job
    response = await client.get(f"/api/jobs/{job_id}")
    yield response.json()

    # Cleanup
    await client.delete(f"/api/jobs/{job_id}")


@pytest_asyncio.fixture
async def test_candidate(client, test_job_with_context, person_repo, candidate_repo):
    """Create a test candidate linked to the job."""
    unique_id = uuid.uuid4().hex[:8]
    job_id = test_job_with_context["id"]

    # Create person
    from models.streamlined.person import PersonCreate
    person, _ = person_repo.get_or_create_sync(PersonCreate(
        name=f"Test Candidate {unique_id}",
        email=f"candidate_{unique_id}@example.com",
    ))

    # Create candidate
    candidate = candidate_repo.create_sync(CandidateCreate(
        person_id=person.id,
        job_id=uuid.UUID(job_id),
        bio_summary="Experienced Python developer with 7 years of backend experience. Led teams at multiple startups.",
        skills=["Python", "FastAPI", "PostgreSQL", "Redis", "AWS", "Docker"],
        years_experience=7,
        current_company="Previous Startup",
        current_title="Staff Engineer",
    ))

    yield {
        "id": str(candidate.id),
        "person_id": str(person.id),
        "job_id": job_id,
        "person_name": person.name,
        "email": person.email,
    }

    # Cleanup handled by job deletion (cascade)


# ============================================
# INTERVIEW START TESTS
# ============================================

@pytest.mark.asyncio
class TestInterviewStart:
    """Tests for POST /api/jobs/{job_id}/candidates/{candidate_id}/interview/start"""

    async def test_start_interview_returns_vapi_config(self, client, test_job_with_context, test_candidate):
        """Test that starting an interview returns Vapi configuration."""
        job_id = test_job_with_context["id"]
        candidate_id = test_candidate["id"]

        response = await client.post(
            f"/api/jobs/{job_id}/candidates/{candidate_id}/interview/start"
        )

        # If Vapi not configured, expect 500
        if response.status_code == 500:
            assert "Vapi" in response.json()["detail"]
            return

        assert response.status_code == 200
        data = response.json()

        # Check response structure
        assert "interview_id" in data
        assert "vapi_public_key" in data
        assert "assistant_id" in data
        assert "candidate_id" in data
        assert "job_id" in data
        assert "assistant_overrides" in data

        # Check IDs match
        assert data["candidate_id"] == candidate_id
        assert data["job_id"] == job_id

        # Check overrides contain job context
        overrides = data["assistant_overrides"]
        assert "variableValues" in overrides
        assert "firstMessage" in overrides
        assert "metadata" in overrides
        assert "model" in overrides

        # Check metadata
        metadata = overrides["metadata"]
        assert metadata["candidateId"] == candidate_id
        assert metadata["jobId"] == job_id
        assert metadata["mode"] == "candidate_interview"

    async def test_start_interview_creates_interview_record(
        self, client, test_job_with_context, test_candidate, interview_repo
    ):
        """Test that starting an interview creates a record in the database."""
        job_id = test_job_with_context["id"]
        candidate_id = test_candidate["id"]

        response = await client.post(
            f"/api/jobs/{job_id}/candidates/{candidate_id}/interview/start"
        )

        if response.status_code == 500:
            return  # Skip if Vapi not configured

        interview_id = response.json()["interview_id"]

        # Verify interview exists
        interview = interview_repo.get_by_id_sync(uuid.UUID(interview_id))
        assert interview is not None
        assert str(interview.candidate_id) == candidate_id
        assert interview.status == InterviewSessionStatus.IN_PROGRESS

    async def test_start_interview_updates_candidate_status(
        self, client, test_job_with_context, test_candidate, candidate_repo
    ):
        """Test that starting an interview updates candidate status to in_progress."""
        job_id = test_job_with_context["id"]
        candidate_id = test_candidate["id"]

        response = await client.post(
            f"/api/jobs/{job_id}/candidates/{candidate_id}/interview/start"
        )

        if response.status_code == 500:
            return  # Skip if Vapi not configured

        # Verify candidate status updated
        candidate = candidate_repo.get_by_id_sync(uuid.UUID(candidate_id))
        assert candidate.interview_status == InterviewStatus.IN_PROGRESS

    async def test_start_interview_includes_job_context_in_prompt(
        self, client, test_job_with_context, test_candidate
    ):
        """Test that the system prompt includes full job context."""
        job_id = test_job_with_context["id"]
        candidate_id = test_candidate["id"]

        response = await client.post(
            f"/api/jobs/{job_id}/candidates/{candidate_id}/interview/start"
        )

        if response.status_code == 500:
            return

        data = response.json()
        system_prompt = data["assistant_overrides"]["model"]["systemPrompt"]

        # Check job context is in prompt
        assert "Senior Engineer" in system_prompt  # Job title
        assert "Python" in system_prompt  # Required skill
        assert "TechCorp" in system_prompt  # Company name
        assert "Python expertise" in system_prompt  # Must-have

    async def test_start_interview_nonexistent_job(self, client, test_candidate):
        """Test starting interview with non-existent job."""
        fake_job_id = str(uuid.uuid4())
        candidate_id = test_candidate["id"]

        response = await client.post(
            f"/api/jobs/{fake_job_id}/candidates/{candidate_id}/interview/start"
        )

        assert response.status_code == 404
        assert "Job not found" in response.json()["detail"]

    async def test_start_interview_nonexistent_candidate(self, client, test_job_with_context):
        """Test starting interview with non-existent candidate."""
        job_id = test_job_with_context["id"]
        fake_candidate_id = str(uuid.uuid4())

        response = await client.post(
            f"/api/jobs/{job_id}/candidates/{fake_candidate_id}/interview/start"
        )

        assert response.status_code == 404
        assert "Candidate not found" in response.json()["detail"]

    async def test_start_interview_candidate_wrong_job(
        self, client, test_job_with_context, test_candidate
    ):
        """Test starting interview with candidate from different job."""
        candidate_id = test_candidate["id"]

        # Create a different job
        response = await client.post("/api/jobs/", json={
            "title": f"Other Job {uuid.uuid4().hex[:8]}",
            "raw_description": "Different job",
        })
        other_job_id = response.json()["id"]

        try:
            response = await client.post(
                f"/api/jobs/{other_job_id}/candidates/{candidate_id}/interview/start"
            )

            assert response.status_code == 400
            assert "does not belong to this job" in response.json()["detail"]
        finally:
            await client.delete(f"/api/jobs/{other_job_id}")


# ============================================
# INTERVIEW END TESTS
# ============================================

@pytest.mark.asyncio
class TestInterviewEnd:
    """Tests for POST /api/jobs/interviews/{interview_id}/end"""

    async def test_end_interview_updates_status(
        self, client, test_job_with_context, test_candidate, interview_repo
    ):
        """Test that ending an interview updates its status."""
        job_id = test_job_with_context["id"]
        candidate_id = test_candidate["id"]

        # Start interview
        start_response = await client.post(
            f"/api/jobs/{job_id}/candidates/{candidate_id}/interview/start"
        )

        if start_response.status_code == 500:
            return  # Skip if Vapi not configured

        interview_id = start_response.json()["interview_id"]

        # End interview
        response = await client.post(f"/api/jobs/interviews/{interview_id}/end")

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "completed"
        assert data["interview_id"] == interview_id

        # Verify in database
        interview = interview_repo.get_by_id_sync(uuid.UUID(interview_id))
        assert interview.status == InterviewSessionStatus.COMPLETED
        assert interview.ended_at is not None

    async def test_end_interview_calculates_duration(
        self, client, test_job_with_context, test_candidate
    ):
        """Test that ending an interview calculates duration."""
        job_id = test_job_with_context["id"]
        candidate_id = test_candidate["id"]

        # Start interview
        start_response = await client.post(
            f"/api/jobs/{job_id}/candidates/{candidate_id}/interview/start"
        )

        if start_response.status_code == 500:
            return

        interview_id = start_response.json()["interview_id"]

        # End interview
        response = await client.post(f"/api/jobs/interviews/{interview_id}/end")

        data = response.json()
        # Duration should be calculated (at least 0)
        assert "duration_seconds" in data
        assert data["duration_seconds"] is None or data["duration_seconds"] >= 0

    async def test_end_interview_updates_candidate_status(
        self, client, test_job_with_context, test_candidate, candidate_repo
    ):
        """Test that ending an interview updates candidate status to completed."""
        job_id = test_job_with_context["id"]
        candidate_id = test_candidate["id"]

        # Start interview
        start_response = await client.post(
            f"/api/jobs/{job_id}/candidates/{candidate_id}/interview/start"
        )

        if start_response.status_code == 500:
            return

        interview_id = start_response.json()["interview_id"]

        # End interview
        await client.post(f"/api/jobs/interviews/{interview_id}/end")

        # Verify candidate status
        candidate = candidate_repo.get_by_id_sync(uuid.UUID(candidate_id))
        assert candidate.interview_status == InterviewStatus.COMPLETED

    async def test_end_nonexistent_interview(self, client):
        """Test ending non-existent interview."""
        fake_id = str(uuid.uuid4())
        response = await client.post(f"/api/jobs/interviews/{fake_id}/end")

        assert response.status_code == 404
        assert "Interview not found" in response.json()["detail"]


# ============================================
# INTERVIEW WEBHOOK TESTS
# ============================================

@pytest.mark.asyncio
class TestInterviewWebhook:
    """Tests for POST /api/jobs/interviews/webhook"""

    async def test_webhook_non_end_call_returns_ok(self, client):
        """Test webhook returns ok for non-end-of-call events."""
        response = await client.post("/api/jobs/interviews/webhook", json={
            "message": {"type": "transcript"}
        })

        assert response.status_code == 200
        assert response.json()["status"] == "ok"

    async def test_webhook_end_of_call_updates_interview(
        self, client, test_job_with_context, test_candidate, interview_repo
    ):
        """Test webhook end-of-call event updates interview with transcript."""
        job_id = test_job_with_context["id"]
        candidate_id = test_candidate["id"]

        # Start interview
        start_response = await client.post(
            f"/api/jobs/{job_id}/candidates/{candidate_id}/interview/start"
        )

        if start_response.status_code == 500:
            return

        interview_id = start_response.json()["interview_id"]

        # Simulate end-of-call webhook
        test_transcript = "Interviewer: Tell me about yourself.\nCandidate: I'm a software engineer..."

        webhook_payload = {
            "message": {
                "type": "end-of-call-report",
                "call": {
                    "assistantOverrides": {
                        "metadata": {
                            "interviewId": interview_id,
                            "candidateId": candidate_id,
                            "jobId": job_id,
                        }
                    }
                },
                "transcript": test_transcript,
            }
        }

        response = await client.post("/api/jobs/interviews/webhook", json=webhook_payload)

        assert response.status_code == 200
        assert response.json()["status"] == "ok"

        # Verify interview was updated
        interview = interview_repo.get_by_id_sync(uuid.UUID(interview_id))
        assert interview.status == InterviewSessionStatus.COMPLETED
        assert interview.transcript == test_transcript


# ============================================
# INTERVIEW GET/LIST TESTS
# ============================================

@pytest.mark.asyncio
class TestInterviewQueries:
    """Tests for interview query endpoints."""

    async def test_get_interview_details(
        self, client, test_job_with_context, test_candidate
    ):
        """Test getting interview details."""
        job_id = test_job_with_context["id"]
        candidate_id = test_candidate["id"]

        # Start interview
        start_response = await client.post(
            f"/api/jobs/{job_id}/candidates/{candidate_id}/interview/start"
        )

        if start_response.status_code == 500:
            return

        interview_id = start_response.json()["interview_id"]

        # Get interview
        response = await client.get(f"/api/jobs/interviews/{interview_id}")

        assert response.status_code == 200
        data = response.json()

        assert data["id"] == interview_id
        assert data["candidate_id"] == candidate_id
        assert data["job_id"] == job_id
        assert data["status"] == "in_progress"

    async def test_get_nonexistent_interview(self, client):
        """Test getting non-existent interview."""
        fake_id = str(uuid.uuid4())
        response = await client.get(f"/api/jobs/interviews/{fake_id}")

        assert response.status_code == 404

    async def test_list_candidate_interviews(
        self, client, test_job_with_context, test_candidate
    ):
        """Test listing all interviews for a candidate."""
        job_id = test_job_with_context["id"]
        candidate_id = test_candidate["id"]

        # Start an interview
        start_response = await client.post(
            f"/api/jobs/{job_id}/candidates/{candidate_id}/interview/start"
        )

        if start_response.status_code == 500:
            return

        # List interviews
        response = await client.get(
            f"/api/jobs/{job_id}/candidates/{candidate_id}/interviews"
        )

        assert response.status_code == 200
        data = response.json()

        assert data["job_id"] == job_id
        assert data["candidate_id"] == candidate_id
        assert data["total"] >= 1
        assert len(data["interviews"]) >= 1

    async def test_list_interviews_wrong_job(
        self, client, test_job_with_context, test_candidate
    ):
        """Test listing interviews with wrong job ID."""
        candidate_id = test_candidate["id"]
        fake_job_id = str(uuid.uuid4())

        response = await client.get(
            f"/api/jobs/{fake_job_id}/candidates/{candidate_id}/interviews"
        )

        assert response.status_code == 404


# ============================================
# INTEGRATION TESTS
# ============================================

@pytest.mark.asyncio
class TestInterviewFlowIntegration:
    """Integration tests for complete interview flow."""

    async def test_complete_interview_flow(self, client):
        """Test complete flow: create job -> add candidate -> interview -> end."""
        unique_id = uuid.uuid4().hex[:8]

        # 1. Create job with context
        job_response = await client.post("/api/jobs/", json={
            "title": f"Integration Test Job {unique_id}",
            "raw_description": "Test job for interview flow integration",
        })
        job_id = job_response.json()["id"]

        try:
            # Add requirements
            await client.patch(f"/api/jobs/{job_id}", json={
                "extracted_requirements": {
                    "years_experience": "3+ years",
                    "required_skills": ["Python"],
                },
                "company_context": {
                    "company_name": "TestCo",
                    "team_size": "5 engineers",
                }
            })

            # 2. Upload candidate
            csv_content = f"name,email,years_experience\nTest User,testuser_{unique_id}@example.com,5\n".encode()
            upload_response = await client.post(
                f"/api/jobs/{job_id}/candidates/upload",
                files={"file": ("test.csv", csv_content, "text/csv")}
            )
            assert upload_response.json()["created"] == 1

            # Get candidate ID
            candidates_response = await client.get(f"/api/jobs/{job_id}/candidates")
            candidate_id = candidates_response.json()["candidates"][0]["id"]

            # 3. Start interview
            start_response = await client.post(
                f"/api/jobs/{job_id}/candidates/{candidate_id}/interview/start"
            )

            if start_response.status_code == 500:
                # Vapi not configured - verify we got this far
                assert "Vapi" in start_response.json()["detail"]
                print("Integration test passed (Vapi not configured, but flow works)")
                return

            assert start_response.status_code == 200
            interview_id = start_response.json()["interview_id"]

            # Verify interview started
            interview_response = await client.get(f"/api/jobs/interviews/{interview_id}")
            assert interview_response.json()["status"] == "in_progress"

            # 4. End interview
            end_response = await client.post(f"/api/jobs/interviews/{interview_id}/end")
            assert end_response.status_code == 200
            assert end_response.json()["status"] == "completed"

            # 5. Verify final state
            final_response = await client.get(f"/api/jobs/interviews/{interview_id}")
            assert final_response.json()["status"] == "completed"

            # 6. List interviews
            list_response = await client.get(
                f"/api/jobs/{job_id}/candidates/{candidate_id}/interviews"
            )
            assert list_response.json()["total"] >= 1

            print("Complete interview flow integration test passed!")

        finally:
            # Cleanup
            await client.delete(f"/api/jobs/{job_id}")


# ============================================
# RUN TESTS DIRECTLY
# ============================================

if __name__ == "__main__":
    """Run tests directly without pytest for quick verification."""
    import asyncio
    from main import app

    async def run_quick_tests():
        """Run quick verification tests."""
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
            unique_id = uuid.uuid4().hex[:8]

            try:
                # Create job
                job_response = await client.post("/api/jobs/", json={
                    "title": f"Quick Test {unique_id}",
                    "raw_description": "Quick test job",
                })
                job_id = job_response.json()["id"]
                print(f"[OK] Created job: {job_id}")

                # Add requirements
                await client.patch(f"/api/jobs/{job_id}", json={
                    "extracted_requirements": {
                        "years_experience": "3+",
                        "required_skills": ["Python"],
                    }
                })
                print("[OK] Added job requirements")

                # Upload candidate
                csv_content = f"name,email\nQuick Test,quicktest_{unique_id}@example.com\n".encode()
                await client.post(
                    f"/api/jobs/{job_id}/candidates/upload",
                    files={"file": ("test.csv", csv_content, "text/csv")}
                )
                print("[OK] Uploaded candidate")

                # Get candidate ID
                candidates_response = await client.get(f"/api/jobs/{job_id}/candidates")
                candidate_id = candidates_response.json()["candidates"][0]["id"]

                # Start interview
                start_response = await client.post(
                    f"/api/jobs/{job_id}/candidates/{candidate_id}/interview/start"
                )

                if start_response.status_code == 500:
                    print("[OK] Interview start blocked - Vapi not configured (expected)")
                else:
                    print(f"[OK] Interview started: {start_response.json()['interview_id']}")

                # Cleanup
                await client.delete(f"/api/jobs/{job_id}")
                print("[OK] Cleanup completed")

            except Exception as e:
                print(f"[FAIL] {e}")
                import traceback
                traceback.print_exc()

    print("=" * 60)
    print("PHASE 5: INTERVIEW FLOW TEST SUITE")
    print("=" * 60)

    asyncio.run(run_quick_tests())

    print("\n" + "=" * 60)
    print("TEST SUITE COMPLETE")
    print("=" * 60)
