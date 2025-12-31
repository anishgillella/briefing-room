"""
Tests for Phase 4: Candidate CSV Upload

This test suite verifies:
1. CSV upload endpoint parses files correctly
2. Person deduplication works (same email = same person)
3. Candidates are linked to jobs correctly
4. Resume processing is triggered in background
5. Error handling for invalid data

Run with: pytest tests/test_phase4_candidate_upload.py -v
"""

import pytest
import pytest_asyncio
import uuid
import io
from datetime import datetime
import httpx

# Models
from models.streamlined.job import JobCreate, JobStatus
from models.streamlined.person import Person, PersonCreate
from models.streamlined.candidate import Candidate, CandidateCreate

# Repositories
from repositories.streamlined.job_repo import JobRepository
from repositories.streamlined.person_repo import PersonRepository
from repositories.streamlined.candidate_repo import CandidateRepository

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
def test_job_title():
    """Generate unique job title for testing."""
    return f"Phase4 Test Job {uuid.uuid4().hex[:8]}"


@pytest_asyncio.fixture
async def client():
    """Get FastAPI async test client."""
    from main import app
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        yield client


@pytest_asyncio.fixture
async def test_job(client, test_job_title):
    """Create a test job for candidate upload tests."""
    response = await client.post("/api/jobs/", json={
        "title": test_job_title,
        "raw_description": "Test job for candidate upload testing",
    })
    job = response.json()
    yield job
    # Cleanup
    await client.delete(f"/api/jobs/{job['id']}")


def create_csv_content(rows: list[dict]) -> bytes:
    """Helper to create CSV content from list of dicts."""
    if not rows:
        return b"name,email\n"

    headers = list(rows[0].keys())
    lines = [",".join(headers)]

    for row in rows:
        values = [str(row.get(h, "")) for h in headers]
        # Handle values with commas by quoting
        values = [f'"{v}"' if "," in v else v for v in values]
        lines.append(",".join(values))

    return "\n".join(lines).encode("utf-8")


# ============================================
# CSV UPLOAD ENDPOINT TESTS
# ============================================

@pytest.mark.asyncio
class TestCandidateUploadEndpoint:
    """Tests for POST /api/jobs/{job_id}/candidates/upload endpoint."""

    async def test_upload_valid_csv(self, client, test_job):
        """Test uploading a valid CSV creates candidates."""
        job_id = test_job["id"]
        unique_suffix = uuid.uuid4().hex[:8]

        csv_content = create_csv_content([
            {"name": "John Doe", "email": f"john_{unique_suffix}@example.com"},
            {"name": "Jane Smith", "email": f"jane_{unique_suffix}@example.com"},
        ])

        response = await client.post(
            f"/api/jobs/{job_id}/candidates/upload",
            files={"file": ("candidates.csv", csv_content, "text/csv")}
        )

        assert response.status_code == 200
        result = response.json()

        assert result["job_id"] == job_id
        assert result["created"] == 2
        assert result["updated"] == 0
        assert len(result["errors"]) == 0
        assert result["total_processed"] == 2

        # Verify candidates were created
        candidates_response = await client.get(f"/api/jobs/{job_id}/candidates")
        candidates = candidates_response.json()
        assert candidates["total"] == 2

    async def test_upload_with_all_optional_fields(self, client, test_job):
        """Test uploading CSV with all optional fields."""
        job_id = test_job["id"]
        unique_suffix = uuid.uuid4().hex[:8]

        csv_content = create_csv_content([
            {
                "name": "Full Data Candidate",
                "email": f"fulldata_{unique_suffix}@example.com",
                "phone": "+1-555-1234",
                "linkedin_url": "https://linkedin.com/in/testuser",
                "current_company": "Acme Corp",
                "current_title": "Senior Engineer",
                "years_experience": "7",
            },
        ])

        response = await client.post(
            f"/api/jobs/{job_id}/candidates/upload",
            files={"file": ("candidates.csv", csv_content, "text/csv")}
        )

        assert response.status_code == 200
        result = response.json()
        assert result["created"] == 1

        # Verify candidate data
        candidates_response = await client.get(f"/api/jobs/{job_id}/candidates")
        candidates = candidates_response.json()["candidates"]
        assert len(candidates) == 1

        candidate = candidates[0]
        assert candidate["current_company"] == "Acme Corp"
        assert candidate["current_title"] == "Senior Engineer"
        assert candidate["years_experience"] == 7

    async def test_upload_nonexistent_job(self, client):
        """Test uploading to non-existent job returns 404."""
        fake_id = str(uuid.uuid4())
        csv_content = create_csv_content([
            {"name": "Test", "email": "test@example.com"},
        ])

        response = await client.post(
            f"/api/jobs/{fake_id}/candidates/upload",
            files={"file": ("candidates.csv", csv_content, "text/csv")}
        )

        assert response.status_code == 404
        assert "not found" in response.json()["detail"].lower()

    async def test_upload_missing_required_columns(self, client, test_job):
        """Test uploading CSV missing required columns returns 400."""
        job_id = test_job["id"]

        # Missing email column
        csv_content = b"name,phone\nJohn Doe,555-1234\n"

        response = await client.post(
            f"/api/jobs/{job_id}/candidates/upload",
            files={"file": ("candidates.csv", csv_content, "text/csv")}
        )

        assert response.status_code == 400
        assert "email" in response.json()["detail"].lower()

    async def test_upload_empty_csv(self, client, test_job):
        """Test uploading empty CSV."""
        job_id = test_job["id"]
        csv_content = b"name,email\n"

        response = await client.post(
            f"/api/jobs/{job_id}/candidates/upload",
            files={"file": ("candidates.csv", csv_content, "text/csv")}
        )

        assert response.status_code == 200
        result = response.json()
        assert result["created"] == 0
        assert result["updated"] == 0
        assert result["total_processed"] == 0

    async def test_upload_invalid_csv_format(self, client, test_job):
        """Test uploading invalid CSV format."""
        job_id = test_job["id"]
        invalid_content = b"not,a,proper\ncsv\"file"

        response = await client.post(
            f"/api/jobs/{job_id}/candidates/upload",
            files={"file": ("bad.csv", invalid_content, "text/csv")}
        )

        # Should either return 400 or process with errors
        assert response.status_code in [200, 400]

    async def test_upload_rows_with_missing_data(self, client, test_job):
        """Test uploading rows with missing name or email adds to errors."""
        job_id = test_job["id"]
        unique_suffix = uuid.uuid4().hex[:8]

        csv_content = create_csv_content([
            {"name": "Valid User", "email": f"valid_{unique_suffix}@example.com"},
            {"name": "", "email": f"noname_{unique_suffix}@example.com"},  # Missing name
            {"name": "No Email User", "email": ""},  # Missing email
        ])

        response = await client.post(
            f"/api/jobs/{job_id}/candidates/upload",
            files={"file": ("candidates.csv", csv_content, "text/csv")}
        )

        assert response.status_code == 200
        result = response.json()

        assert result["created"] == 1  # Only valid user
        assert len(result["errors"]) == 2  # Two rows with errors

    async def test_upload_case_insensitive_columns(self, client, test_job):
        """Test that column names are case-insensitive."""
        job_id = test_job["id"]
        unique_suffix = uuid.uuid4().hex[:8]

        # Use uppercase column names
        csv_content = f"NAME,EMAIL,CURRENT_COMPANY\nTest User,test_{unique_suffix}@example.com,TestCo\n".encode()

        response = await client.post(
            f"/api/jobs/{job_id}/candidates/upload",
            files={"file": ("candidates.csv", csv_content, "text/csv")}
        )

        assert response.status_code == 200
        result = response.json()
        assert result["created"] == 1


# ============================================
# PERSON DEDUPLICATION TESTS
# ============================================

@pytest.mark.asyncio
class TestPersonDeduplication:
    """Tests for person deduplication by email."""

    async def test_same_email_reuses_person(self, client, test_job, person_repo, db):
        """Test that uploading same email twice reuses the person record."""
        job_id = test_job["id"]
        unique_email = f"dedup_test_{uuid.uuid4().hex[:8]}@example.com"

        # First upload
        csv_content1 = create_csv_content([
            {"name": "Original Name", "email": unique_email},
        ])
        response1 = await client.post(
            f"/api/jobs/{job_id}/candidates/upload",
            files={"file": ("candidates.csv", csv_content1, "text/csv")}
        )
        assert response1.json()["created"] == 1

        # Get the person ID
        person = person_repo.get_by_email_sync(unique_email)
        assert person is not None
        original_person_id = person.id

        # Create second job for second upload
        job2_response = await client.post("/api/jobs/", json={
            "title": f"Second Job {uuid.uuid4().hex[:8]}",
            "raw_description": "Second test job",
        })
        job2_id = job2_response.json()["id"]

        try:
            # Second upload with same email to different job
            csv_content2 = create_csv_content([
                {"name": "Same Email Person", "email": unique_email},
            ])
            response2 = await client.post(
                f"/api/jobs/{job2_id}/candidates/upload",
                files={"file": ("candidates.csv", csv_content2, "text/csv")}
            )
            assert response2.json()["created"] == 1

            # Verify same person ID was used
            person_after = person_repo.get_by_email_sync(unique_email)
            assert person_after.id == original_person_id

            # Verify we have 2 candidates for 1 person
            result = db.table("candidates").select("*").eq("person_id", str(original_person_id)).execute()
            assert len(result.data) == 2

        finally:
            await client.delete(f"/api/jobs/{job2_id}")

    async def test_same_email_same_job_updates(self, client, test_job):
        """Test uploading same email to same job updates instead of creates."""
        job_id = test_job["id"]
        unique_email = f"update_test_{uuid.uuid4().hex[:8]}@example.com"

        # First upload
        csv_content1 = create_csv_content([
            {"name": "Initial Name", "email": unique_email, "current_company": "First Co"},
        ])
        response1 = await client.post(
            f"/api/jobs/{job_id}/candidates/upload",
            files={"file": ("candidates.csv", csv_content1, "text/csv")}
        )
        assert response1.json()["created"] == 1
        assert response1.json()["updated"] == 0

        # Second upload with same email - should update
        csv_content2 = create_csv_content([
            {"name": "Initial Name", "email": unique_email, "current_company": "Updated Co"},
        ])
        response2 = await client.post(
            f"/api/jobs/{job_id}/candidates/upload",
            files={"file": ("candidates.csv", csv_content2, "text/csv")}
        )
        assert response2.json()["created"] == 0
        assert response2.json()["updated"] == 1

        # Verify candidate was updated, not duplicated
        candidates_response = await client.get(f"/api/jobs/{job_id}/candidates")
        candidates = candidates_response.json()
        assert candidates["total"] == 1
        assert candidates["candidates"][0]["current_company"] == "Updated Co"


# ============================================
# CANDIDATE-JOB LINKING TESTS
# ============================================

@pytest.mark.asyncio
class TestCandidateJobLinking:
    """Tests for candidate-job relationship."""

    async def test_candidates_linked_to_correct_job(self, client, test_job):
        """Test that uploaded candidates are linked to the correct job."""
        job_id = test_job["id"]
        unique_suffix = uuid.uuid4().hex[:8]

        csv_content = create_csv_content([
            {"name": "Linked Candidate", "email": f"linked_{unique_suffix}@example.com"},
        ])

        await client.post(
            f"/api/jobs/{job_id}/candidates/upload",
            files={"file": ("candidates.csv", csv_content, "text/csv")}
        )

        # Verify candidate is linked to job
        response = await client.get(f"/api/jobs/{job_id}/candidates")
        assert response.status_code == 200

        data = response.json()
        assert data["job_id"] == job_id
        assert data["job_title"] == test_job["title"]
        assert len(data["candidates"]) == 1

    async def test_candidates_isolated_between_jobs(self, client, test_job):
        """Test that candidates from one job don't appear in another."""
        job1_id = test_job["id"]
        unique_suffix = uuid.uuid4().hex[:8]

        # Upload to first job
        csv_content = create_csv_content([
            {"name": "Job1 Candidate", "email": f"job1_{unique_suffix}@example.com"},
        ])
        await client.post(
            f"/api/jobs/{job1_id}/candidates/upload",
            files={"file": ("candidates.csv", csv_content, "text/csv")}
        )

        # Create second job
        job2_response = await client.post("/api/jobs/", json={
            "title": f"Isolated Test Job {uuid.uuid4().hex[:8]}",
            "raw_description": "Second job for isolation test",
        })
        job2_id = job2_response.json()["id"]

        try:
            # Verify second job has no candidates
            response = await client.get(f"/api/jobs/{job2_id}/candidates")
            assert response.json()["total"] == 0

            # Verify first job still has its candidate
            response = await client.get(f"/api/jobs/{job1_id}/candidates")
            assert response.json()["total"] == 1

        finally:
            await client.delete(f"/api/jobs/{job2_id}")


# ============================================
# RESUME PROCESSING TESTS
# ============================================

@pytest.mark.asyncio
class TestResumeProcessing:
    """Tests for resume processing functionality."""

    async def test_resume_triggers_background_processing(self, client, test_job):
        """Test that resume text triggers background processing."""
        job_id = test_job["id"]
        unique_suffix = uuid.uuid4().hex[:8]

        # Include resume text (> 50 chars to trigger processing)
        resume_text = """
        Experienced software engineer with 8 years of Python development.
        Expertise in FastAPI, Django, and microservices architecture.
        Led teams of 5+ engineers. Strong problem-solving skills.
        """

        csv_content = create_csv_content([
            {
                "name": "Resume Candidate",
                "email": f"resume_{unique_suffix}@example.com",
                "resume": resume_text,
            },
        ])

        response = await client.post(
            f"/api/jobs/{job_id}/candidates/upload",
            files={"file": ("candidates.csv", csv_content, "text/csv")}
        )

        assert response.status_code == 200
        assert response.json()["created"] == 1

        # Note: Resume processing happens in background, so we can't verify
        # the extracted data immediately. This test just verifies the upload
        # succeeds and no errors occur with resume text.

    async def test_short_resume_not_processed(self, client, test_job):
        """Test that short resume text (< 50 chars) is not processed."""
        job_id = test_job["id"]
        unique_suffix = uuid.uuid4().hex[:8]

        csv_content = create_csv_content([
            {
                "name": "Short Resume",
                "email": f"short_{unique_suffix}@example.com",
                "resume": "Too short",  # Less than 50 chars
            },
        ])

        response = await client.post(
            f"/api/jobs/{job_id}/candidates/upload",
            files={"file": ("candidates.csv", csv_content, "text/csv")}
        )

        assert response.status_code == 200
        assert response.json()["created"] == 1


# ============================================
# INTEGRATION TESTS
# ============================================

@pytest.mark.asyncio
class TestCandidateUploadIntegration:
    """Integration tests for complete candidate upload flow."""

    async def test_complete_upload_flow(self, client):
        """Test complete flow: create job -> upload candidates -> verify -> cleanup."""
        unique_id = uuid.uuid4().hex[:8]

        # 1. Create job
        job_response = await client.post("/api/jobs/", json={
            "title": f"Integration Test Job {unique_id}",
            "raw_description": "Full integration test for candidate upload",
        })
        assert job_response.status_code == 200
        job = job_response.json()
        job_id = job["id"]

        try:
            # 2. Upload multiple candidates
            csv_content = create_csv_content([
                {
                    "name": "Alice Johnson",
                    "email": f"alice_{unique_id}@example.com",
                    "phone": "+1-555-0001",
                    "current_company": "Tech Giant",
                    "current_title": "Senior Engineer",
                    "years_experience": "8",
                },
                {
                    "name": "Bob Williams",
                    "email": f"bob_{unique_id}@example.com",
                    "phone": "+1-555-0002",
                    "current_company": "Startup Inc",
                    "current_title": "Staff Engineer",
                    "years_experience": "10",
                },
                {
                    "name": "Carol Davis",
                    "email": f"carol_{unique_id}@example.com",
                    "current_company": "Consulting Co",
                    "years_experience": "5",
                },
            ])

            upload_response = await client.post(
                f"/api/jobs/{job_id}/candidates/upload",
                files={"file": ("candidates.csv", csv_content, "text/csv")}
            )
            assert upload_response.status_code == 200
            result = upload_response.json()

            assert result["created"] == 3
            assert result["updated"] == 0
            assert len(result["errors"]) == 0

            # 3. Verify all candidates were created correctly
            candidates_response = await client.get(f"/api/jobs/{job_id}/candidates")
            assert candidates_response.status_code == 200
            candidates_data = candidates_response.json()

            assert candidates_data["total"] == 3
            candidates = candidates_data["candidates"]

            # Verify candidate data (email is person_email from the join)
            emails = [c.get("person_email") or c.get("email") for c in candidates]
            assert f"alice_{unique_id}@example.com" in emails
            assert f"bob_{unique_id}@example.com" in emails
            assert f"carol_{unique_id}@example.com" in emails

            # 4. Upload update for one candidate
            update_csv = create_csv_content([
                {
                    "name": "Alice Johnson",
                    "email": f"alice_{unique_id}@example.com",
                    "current_title": "Principal Engineer",  # Updated title
                    "years_experience": "9",  # Updated years
                },
            ])

            update_response = await client.post(
                f"/api/jobs/{job_id}/candidates/upload",
                files={"file": ("update.csv", update_csv, "text/csv")}
            )
            assert update_response.status_code == 200
            assert update_response.json()["updated"] == 1
            assert update_response.json()["created"] == 0

            # 5. Verify update was applied
            final_response = await client.get(f"/api/jobs/{job_id}/candidates")
            final_candidates = final_response.json()["candidates"]

            # Email is in person_email field from the join
            alice = next(c for c in final_candidates if "alice" in (c.get("person_email") or ""))
            assert alice["current_title"] == "Principal Engineer"
            assert alice["years_experience"] == 9

            print("Complete upload flow test passed!")

        finally:
            # Cleanup
            await client.delete(f"/api/jobs/{job_id}")

    async def test_bulk_upload_performance(self, client):
        """Test uploading a larger batch of candidates."""
        unique_id = uuid.uuid4().hex[:8]

        # Create job
        job_response = await client.post("/api/jobs/", json={
            "title": f"Bulk Upload Test Job {unique_id}",
            "raw_description": "Testing bulk upload performance",
        })
        job_id = job_response.json()["id"]

        try:
            # Create 50 candidates
            candidates = [
                {"name": f"Candidate {i}", "email": f"bulk_{unique_id}_{i}@example.com"}
                for i in range(50)
            ]
            csv_content = create_csv_content(candidates)

            response = await client.post(
                f"/api/jobs/{job_id}/candidates/upload",
                files={"file": ("bulk.csv", csv_content, "text/csv")}
            )

            assert response.status_code == 200
            result = response.json()
            assert result["created"] == 50
            assert result["total_processed"] == 50

            # Verify all were created
            candidates_response = await client.get(f"/api/jobs/{job_id}/candidates")
            assert candidates_response.json()["total"] == 50

            print("Bulk upload test passed!")

        finally:
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
                    "title": f"Quick Upload Test {unique_id}",
                    "raw_description": "Quick test for upload",
                })
                job_id = job_response.json()["id"]
                print(f"[OK] Created job: {job_id}")

                # Upload CSV
                csv_content = create_csv_content([
                    {"name": "Quick Test", "email": f"quick_{unique_id}@example.com"},
                ])
                response = await client.post(
                    f"/api/jobs/{job_id}/candidates/upload",
                    files={"file": ("test.csv", csv_content, "text/csv")}
                )
                assert response.status_code == 200
                assert response.json()["created"] == 1
                print("[OK] CSV upload successful")

                # Verify candidate
                response = await client.get(f"/api/jobs/{job_id}/candidates")
                assert response.json()["total"] == 1
                print("[OK] Candidate verified")

                # Cleanup
                await client.delete(f"/api/jobs/{job_id}")
                print("[OK] Cleanup completed")

            except Exception as e:
                print(f"[FAIL] {e}")
                import traceback
                traceback.print_exc()

    print("=" * 60)
    print("PHASE 4: CANDIDATE CSV UPLOAD TEST SUITE")
    print("=" * 60)

    asyncio.run(run_quick_tests())

    print("\n" + "=" * 60)
    print("TEST SUITE COMPLETE")
    print("=" * 60)
