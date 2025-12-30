"""
Tests for Phase 2: Job Management

This test suite verifies:
1. Job Repository CRUD operations
2. Jobs API endpoints
3. JD extraction service
4. Job status transitions

Run with: pytest tests/test_phase2_job_management.py -v
"""

import pytest
import pytest_asyncio
import uuid
from datetime import datetime
import httpx

# Models
from models.streamlined.job import (
    Job, JobCreate, JobUpdate, JobStatus,
    ExtractedRequirements, CompanyContext, ScoringCriteria
)

# Repository
from repositories.streamlined.job_repo import JobRepository

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
def test_job_title():
    """Generate unique job title for testing."""
    return f"Test Engineer {uuid.uuid4().hex[:8]}"


@pytest.fixture
def sample_job_description():
    """Sample job description for testing."""
    return """
    Senior Software Engineer - Backend

    We are looking for a Senior Software Engineer to join our backend team.

    Requirements:
    - 5+ years of experience in backend development
    - Strong proficiency in Python and FastAPI
    - Experience with PostgreSQL and Redis
    - Bachelor's degree in Computer Science or related field

    Nice to have:
    - Experience with Kubernetes and Docker
    - AWS or GCP experience
    - GraphQL knowledge

    Location: San Francisco, CA (Hybrid - 2 days in office)
    Salary: $150,000 - $200,000 + equity
    """


@pytest_asyncio.fixture
async def client():
    """Get FastAPI async test client using httpx ASGITransport."""
    from main import app
    # Use httpx AsyncClient with ASGITransport for httpx 0.28+ compatibility
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        yield client


# ============================================
# REPOSITORY TESTS
# ============================================

class TestJobRepository:
    """Tests for JobRepository."""

    def test_create_job(self, job_repo, test_job_title, sample_job_description):
        """Test creating a job via repository."""
        job_data = JobCreate(
            title=test_job_title,
            raw_description=sample_job_description,
            status=JobStatus.DRAFT,
        )

        job = job_repo.create_sync(job_data)

        assert job is not None
        assert job.id is not None
        assert job.title == test_job_title
        assert job.status == JobStatus.DRAFT
        assert job.raw_description == sample_job_description

        # Cleanup
        job_repo.delete_sync(job.id)

    def test_get_job_by_id(self, job_repo, test_job_title, sample_job_description):
        """Test getting a job by ID."""
        # Create
        job_data = JobCreate(
            title=test_job_title,
            raw_description=sample_job_description,
        )
        created = job_repo.create_sync(job_data)

        # Get
        job = job_repo.get_by_id_sync(created.id)

        assert job is not None
        assert job.id == created.id
        assert job.title == test_job_title

        # Cleanup
        job_repo.delete_sync(created.id)

    def test_get_nonexistent_job(self, job_repo):
        """Test getting a job that doesn't exist."""
        fake_id = uuid.uuid4()
        job = job_repo.get_by_id_sync(fake_id)
        assert job is None

    def test_update_job(self, job_repo, test_job_title, sample_job_description):
        """Test updating a job."""
        # Create
        job_data = JobCreate(
            title=test_job_title,
            raw_description=sample_job_description,
        )
        created = job_repo.create_sync(job_data)

        # Update
        update = JobUpdate(
            title="Updated Title",
            status=JobStatus.ACTIVE,
        )
        updated = job_repo.update_sync(created.id, update)

        assert updated is not None
        assert updated.title == "Updated Title"
        assert updated.status == JobStatus.ACTIVE

        # Cleanup
        job_repo.delete_sync(created.id)

    def test_update_job_with_requirements(self, job_repo, test_job_title, sample_job_description):
        """Test updating a job with extracted requirements."""
        # Create
        job_data = JobCreate(
            title=test_job_title,
            raw_description=sample_job_description,
        )
        created = job_repo.create_sync(job_data)

        # Update with requirements
        requirements = ExtractedRequirements(
            years_experience="5+ years",
            required_skills=["Python", "FastAPI", "PostgreSQL"],
            preferred_skills=["Kubernetes", "Docker"],
            work_type="hybrid",
            location="San Francisco, CA",
        )
        update = JobUpdate(extracted_requirements=requirements)
        updated = job_repo.update_sync(created.id, update)

        assert updated is not None
        assert updated.extracted_requirements is not None
        assert updated.extracted_requirements.years_experience == "5+ years"
        assert "Python" in updated.extracted_requirements.required_skills

        # Cleanup
        job_repo.delete_sync(created.id)

    def test_update_job_with_scoring_criteria(self, job_repo, test_job_title, sample_job_description):
        """Test updating a job with scoring criteria."""
        # Create
        job_data = JobCreate(
            title=test_job_title,
            raw_description=sample_job_description,
        )
        created = job_repo.create_sync(job_data)

        # Update with scoring criteria
        criteria = ScoringCriteria(
            must_haves=["Python expertise", "API design"],
            nice_to_haves=["AWS experience"],
            technical_competencies=["Backend Development", "Database Design"],
            weight_technical=0.5,
            weight_experience=0.3,
            weight_cultural=0.2,
        )
        update = JobUpdate(scoring_criteria=criteria)
        updated = job_repo.update_sync(created.id, update)

        assert updated is not None
        assert updated.scoring_criteria is not None
        assert "Python expertise" in updated.scoring_criteria.must_haves

        # Cleanup
        job_repo.delete_sync(created.id)

    def test_delete_job(self, job_repo, test_job_title, sample_job_description):
        """Test deleting a job."""
        # Create
        job_data = JobCreate(
            title=test_job_title,
            raw_description=sample_job_description,
        )
        created = job_repo.create_sync(job_data)

        # Delete
        success = job_repo.delete_sync(created.id)
        assert success is True

        # Verify deleted
        job = job_repo.get_by_id_sync(created.id)
        assert job is None

    def test_list_all_jobs(self, job_repo):
        """Test listing all jobs."""
        # Create a couple of jobs
        job1 = job_repo.create_sync(JobCreate(
            title=f"List Test Job 1 {uuid.uuid4().hex[:8]}",
            raw_description="Test description 1",
        ))
        job2 = job_repo.create_sync(JobCreate(
            title=f"List Test Job 2 {uuid.uuid4().hex[:8]}",
            raw_description="Test description 2",
        ))

        # List
        jobs = job_repo.list_all_sync()

        assert len(jobs) >= 2
        job_ids = [j.id for j in jobs]
        assert job1.id in job_ids
        assert job2.id in job_ids

        # Cleanup
        job_repo.delete_sync(job1.id)
        job_repo.delete_sync(job2.id)

    def test_list_jobs_by_status(self, job_repo):
        """Test listing jobs filtered by status."""
        # Create jobs with different statuses
        active_job = job_repo.create_sync(JobCreate(
            title=f"Active Job {uuid.uuid4().hex[:8]}",
            raw_description="Active job description",
            status=JobStatus.ACTIVE,
        ))
        draft_job = job_repo.create_sync(JobCreate(
            title=f"Draft Job {uuid.uuid4().hex[:8]}",
            raw_description="Draft job description",
            status=JobStatus.DRAFT,
        ))

        # List active only
        active_jobs = job_repo.list_all_sync(status="active")

        active_ids = [j.id for j in active_jobs]
        assert active_job.id in active_ids
        assert draft_job.id not in active_ids

        # Cleanup
        job_repo.delete_sync(active_job.id)
        job_repo.delete_sync(draft_job.id)


# ============================================
# API ENDPOINT TESTS
# ============================================

@pytest.mark.asyncio
class TestJobsAPI:
    """Tests for Jobs API endpoints."""

    async def test_create_job_endpoint(self, client, test_job_title, sample_job_description):
        """Test POST /api/jobs/"""
        response = await client.post("/api/jobs/", json={
            "title": test_job_title,
            "raw_description": sample_job_description,
        })

        assert response.status_code == 200
        data = response.json()
        assert data["title"] == test_job_title
        assert data["status"] == "draft"
        assert "id" in data

        # Cleanup
        job_id = data["id"]
        await client.delete(f"/api/jobs/{job_id}")

    async def test_get_job_endpoint(self, client, test_job_title, sample_job_description):
        """Test GET /api/jobs/{job_id}"""
        # Create
        create_response = await client.post("/api/jobs/", json={
            "title": test_job_title,
            "raw_description": sample_job_description,
        })
        job_id = create_response.json()["id"]

        # Get
        response = await client.get(f"/api/jobs/{job_id}")

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == job_id
        assert data["title"] == test_job_title

        # Cleanup
        await client.delete(f"/api/jobs/{job_id}")

    async def test_get_nonexistent_job_endpoint(self, client):
        """Test GET /api/jobs/{job_id} with invalid ID."""
        fake_id = str(uuid.uuid4())
        response = await client.get(f"/api/jobs/{fake_id}")

        assert response.status_code == 404
        assert "not found" in response.json()["detail"].lower()

    async def test_list_jobs_endpoint(self, client):
        """Test GET /api/jobs/"""
        response = await client.get("/api/jobs/")

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)

    async def test_list_active_jobs_endpoint(self, client, test_job_title, sample_job_description):
        """Test GET /api/jobs/active"""
        # Create and activate a job
        create_response = await client.post("/api/jobs/", json={
            "title": test_job_title,
            "raw_description": sample_job_description,
        })
        job_id = create_response.json()["id"]

        # Activate it
        await client.patch(f"/api/jobs/{job_id}", json={"status": "active"})

        # List active
        response = await client.get("/api/jobs/active")

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        active_ids = [j["id"] for j in data]
        assert job_id in active_ids

        # Cleanup
        await client.delete(f"/api/jobs/{job_id}")

    async def test_update_job_endpoint(self, client, test_job_title, sample_job_description):
        """Test PATCH /api/jobs/{job_id}"""
        # Create
        create_response = await client.post("/api/jobs/", json={
            "title": test_job_title,
            "raw_description": sample_job_description,
        })
        job_id = create_response.json()["id"]

        # Update
        response = await client.patch(f"/api/jobs/{job_id}", json={
            "title": "Updated Title",
            "status": "active",
        })

        assert response.status_code == 200
        data = response.json()
        assert data["title"] == "Updated Title"
        assert data["status"] == "active"

        # Cleanup
        await client.delete(f"/api/jobs/{job_id}")

    async def test_delete_job_endpoint(self, client, test_job_title, sample_job_description):
        """Test DELETE /api/jobs/{job_id}"""
        # Create
        create_response = await client.post("/api/jobs/", json={
            "title": test_job_title,
            "raw_description": sample_job_description,
        })
        job_id = create_response.json()["id"]

        # Delete
        response = await client.delete(f"/api/jobs/{job_id}")

        assert response.status_code == 200
        assert "deleted" in response.json()["message"].lower()

        # Verify deleted
        get_response = await client.get(f"/api/jobs/{job_id}")
        assert get_response.status_code == 404

    async def test_activate_job_endpoint(self, client, test_job_title, sample_job_description):
        """Test POST /api/jobs/{job_id}/activate"""
        # Create job with extracted requirements
        create_response = await client.post("/api/jobs/", json={
            "title": test_job_title,
            "raw_description": sample_job_description,
        })
        job_id = create_response.json()["id"]

        # Add requirements so activation works
        await client.patch(f"/api/jobs/{job_id}", json={
            "extracted_requirements": {
                "years_experience": "5+ years",
                "required_skills": ["Python"],
            }
        })

        # Activate
        response = await client.post(f"/api/jobs/{job_id}/activate")

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "active"

        # Cleanup
        await client.delete(f"/api/jobs/{job_id}")

    async def test_close_job_endpoint(self, client, test_job_title, sample_job_description):
        """Test POST /api/jobs/{job_id}/close"""
        # Create
        create_response = await client.post("/api/jobs/", json={
            "title": test_job_title,
            "raw_description": sample_job_description,
        })
        job_id = create_response.json()["id"]

        # Close
        response = await client.post(f"/api/jobs/{job_id}/close")

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "closed"

        # Cleanup
        await client.delete(f"/api/jobs/{job_id}")

    async def test_pause_job_endpoint(self, client, test_job_title, sample_job_description):
        """Test POST /api/jobs/{job_id}/pause"""
        # Create and activate
        create_response = await client.post("/api/jobs/", json={
            "title": test_job_title,
            "raw_description": sample_job_description,
            "status": "active",
        })
        job_id = create_response.json()["id"]

        # Pause
        response = await client.post(f"/api/jobs/{job_id}/pause")

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "paused"

        # Cleanup
        await client.delete(f"/api/jobs/{job_id}")

    async def test_reopen_job_endpoint(self, client, test_job_title, sample_job_description):
        """Test POST /api/jobs/{job_id}/reopen"""
        # Create and close
        create_response = await client.post("/api/jobs/", json={
            "title": test_job_title,
            "raw_description": sample_job_description,
        })
        job_id = create_response.json()["id"]
        await client.post(f"/api/jobs/{job_id}/close")

        # Reopen
        response = await client.post(f"/api/jobs/{job_id}/reopen")

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "active"

        # Cleanup
        await client.delete(f"/api/jobs/{job_id}")

    async def test_get_job_candidates_endpoint(self, client, test_job_title, sample_job_description):
        """Test GET /api/jobs/{job_id}/candidates"""
        # Create
        create_response = await client.post("/api/jobs/", json={
            "title": test_job_title,
            "raw_description": sample_job_description,
        })
        job_id = create_response.json()["id"]

        # Get candidates (should be empty)
        response = await client.get(f"/api/jobs/{job_id}/candidates")

        assert response.status_code == 200
        data = response.json()
        assert "candidates" in data
        assert data["total"] == 0

        # Cleanup
        await client.delete(f"/api/jobs/{job_id}")


# ============================================
# JD EXTRACTION TESTS
# ============================================

class TestJDExtraction:
    """Tests for JD extraction service."""

    def test_extracted_requirements_model(self):
        """Test ExtractedRequirements model."""
        requirements = ExtractedRequirements(
            years_experience="5+ years",
            education="Bachelor's in Computer Science",
            required_skills=["Python", "FastAPI"],
            preferred_skills=["Docker", "Kubernetes"],
            location="San Francisco, CA",
            work_type="hybrid",
            salary_range="$150k-$200k",
        )

        assert requirements.years_experience == "5+ years"
        assert len(requirements.required_skills) == 2
        assert "Python" in requirements.required_skills

    def test_company_context_model(self):
        """Test CompanyContext model."""
        context = CompanyContext(
            company_name="Acme Corp",
            company_description="Leading tech company",
            team_size="50 engineers",
            team_culture="Fast-paced, collaborative",
            growth_stage="Series C",
        )

        assert context.company_name == "Acme Corp"
        assert context.growth_stage == "Series C"

    def test_scoring_criteria_model(self):
        """Test ScoringCriteria model."""
        criteria = ScoringCriteria(
            must_haves=["Python", "API design"],
            nice_to_haves=["AWS"],
            technical_competencies=["Backend"],
            weight_technical=0.5,
            weight_experience=0.3,
            weight_cultural=0.2,
        )

        # Weights should sum to 1
        total = criteria.weight_technical + criteria.weight_experience + criteria.weight_cultural
        assert total == 1.0


# ============================================
# INTEGRATION TESTS
# ============================================

@pytest.mark.asyncio
class TestJobManagementIntegration:
    """Integration tests for job management flow."""

    async def test_full_job_lifecycle(self, client):
        """Test complete job lifecycle: create -> update -> activate -> close."""
        unique_title = f"Lifecycle Test Job {uuid.uuid4().hex[:8]}"

        # 1. Create draft job
        create_response = await client.post("/api/jobs/", json={
            "title": unique_title,
            "raw_description": "We need a software engineer with Python experience.",
        })
        assert create_response.status_code == 200
        job = create_response.json()
        job_id = job["id"]
        assert job["status"] == "draft"

        # 2. Update with requirements
        update_response = await client.patch(f"/api/jobs/{job_id}", json={
            "extracted_requirements": {
                "years_experience": "3+ years",
                "required_skills": ["Python", "FastAPI"],
            },
            "scoring_criteria": {
                "must_haves": ["Python proficiency"],
                "weight_technical": 0.6,
                "weight_experience": 0.25,
                "weight_cultural": 0.15,
            }
        })
        assert update_response.status_code == 200
        updated = update_response.json()
        assert updated["extracted_requirements"]["years_experience"] == "3+ years"

        # 3. Activate
        activate_response = await client.post(f"/api/jobs/{job_id}/activate")
        assert activate_response.status_code == 200
        assert activate_response.json()["status"] == "active"

        # 4. Pause
        pause_response = await client.post(f"/api/jobs/{job_id}/pause")
        assert pause_response.status_code == 200
        assert pause_response.json()["status"] == "paused"

        # 5. Reopen
        reopen_response = await client.post(f"/api/jobs/{job_id}/reopen")
        assert reopen_response.status_code == 200
        assert reopen_response.json()["status"] == "active"

        # 6. Close
        close_response = await client.post(f"/api/jobs/{job_id}/close")
        assert close_response.status_code == 200
        assert close_response.json()["status"] == "closed"

        # 7. Delete
        delete_response = await client.delete(f"/api/jobs/{job_id}")
        assert delete_response.status_code == 200

        # 8. Verify deleted
        get_response = await client.get(f"/api/jobs/{job_id}")
        assert get_response.status_code == 404

        print("Full job lifecycle test completed successfully!")


# ============================================
# RUN TESTS DIRECTLY
# ============================================

if __name__ == "__main__":
    """Run tests directly without pytest for quick verification."""
    import sys
    import asyncio
    from main import app

    async def run_api_tests():
        """Run API tests using async httpx client."""
        # Use httpx with ASGITransport for httpx 0.28+ compatibility
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
            try:
                # Create
                response = await client.post("/api/jobs/", json={
                    "title": f"API Test Job {uuid.uuid4().hex[:8]}",
                    "raw_description": "Test API job description",
                })
                assert response.status_code == 200
                job_id = response.json()["id"]
                print(f"[OK] POST /api/jobs/ - created {job_id}")

                # Get
                response = await client.get(f"/api/jobs/{job_id}")
                assert response.status_code == 200
                print("[OK] GET /api/jobs/{id}")

                # List
                response = await client.get("/api/jobs/")
                assert response.status_code == 200
                print("[OK] GET /api/jobs/")

                # Update
                response = await client.patch(f"/api/jobs/{job_id}", json={"status": "active"})
                assert response.status_code == 200
                print("[OK] PATCH /api/jobs/{id}")

                # Close
                response = await client.post(f"/api/jobs/{job_id}/close")
                assert response.status_code == 200
                print("[OK] POST /api/jobs/{id}/close")

                # Delete
                response = await client.delete(f"/api/jobs/{job_id}")
                assert response.status_code == 200
                print("[OK] DELETE /api/jobs/{id}")

            except Exception as e:
                print(f"[FAIL] API tests: {e}")

    print("=" * 60)
    print("PHASE 2: JOB MANAGEMENT TEST SUITE")
    print("=" * 60)

    job_repo = JobRepository()

    # Run quick tests
    print("\n--- Repository Tests ---")

    try:
        test_title = f"Quick Test Job {uuid.uuid4().hex[:8]}"
        job_data = JobCreate(title=test_title, raw_description="Test description")
        job = job_repo.create_sync(job_data)
        print(f"[OK] Create job: {job.id}")

        fetched = job_repo.get_by_id_sync(job.id)
        assert fetched is not None
        print("[OK] Get job by ID")

        job_repo.delete_sync(job.id)
        print("[OK] Delete job")
    except Exception as e:
        print(f"[FAIL] Repository tests: {e}")

    print("\n--- API Tests ---")
    asyncio.run(run_api_tests())

    print("\n" + "=" * 60)
    print("TEST SUITE COMPLETE")
    print("=" * 60)
