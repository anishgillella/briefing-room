"""
Tests for Streamlined Interview Flow Models and Database Operations.

This test suite verifies:
1. Pydantic models work correctly
2. Database CRUD operations work
3. Relationships between tables work (Person -> Candidate -> Interview -> Analytics)
4. Database views return correct data

Run with: pytest tests/test_streamlined_models.py -v
"""

import pytest
import uuid
from datetime import datetime
from typing import Optional

# Models
from models.streamlined import (
    Person, PersonCreate, PersonUpdate,
    Job, JobCreate, JobUpdate, JobStatus, ExtractedRequirements, CompanyContext, ScoringCriteria,
    Candidate, CandidateCreate, CandidateUpdate, InterviewStatus,
    Interview, InterviewCreate, InterviewUpdate, InterviewType, InterviewSessionStatus,
    Analytics, AnalyticsCreate, CompetencyScore, Recommendation,
)

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
def test_person_email():
    """Generate unique email for testing."""
    return f"test_{uuid.uuid4().hex[:8]}@example.com"


@pytest.fixture
def test_job_title():
    """Generate unique job title for testing."""
    return f"Test Engineer {uuid.uuid4().hex[:8]}"


# ============================================
# MODEL VALIDATION TESTS
# ============================================

class TestPersonModel:
    """Tests for Person model validation."""

    def test_person_create_valid(self):
        """Test creating a valid PersonCreate."""
        person = PersonCreate(
            name="John Doe",
            email="john@example.com",
            phone="+1-555-1234",
        )
        assert person.name == "John Doe"
        assert person.email == "john@example.com"
        assert person.phone == "+1-555-1234"

    def test_person_create_minimal(self):
        """Test creating PersonCreate with only required fields."""
        person = PersonCreate(name="Jane Doe", email="jane@example.com")
        assert person.name == "Jane Doe"
        assert person.phone is None
        assert person.resume_url is None

    def test_person_create_invalid_email(self):
        """Test that invalid email raises validation error."""
        with pytest.raises(Exception):  # Pydantic validation error
            PersonCreate(name="Test", email="not-an-email")

    def test_person_update_partial(self):
        """Test PersonUpdate allows partial updates."""
        update = PersonUpdate(phone="+1-555-9999")
        assert update.phone == "+1-555-9999"
        assert update.name is None
        assert update.email is None


class TestJobModel:
    """Tests for Job model validation."""

    def test_job_create_valid(self):
        """Test creating a valid JobCreate."""
        job = JobCreate(
            title="Senior Software Engineer",
            raw_description="We are looking for a senior engineer...",
        )
        assert job.title == "Senior Software Engineer"
        assert job.status == JobStatus.DRAFT  # Default

    def test_job_with_extracted_requirements(self):
        """Test Job with ExtractedRequirements."""
        requirements = ExtractedRequirements(
            years_experience="5+ years",
            required_skills=["Python", "FastAPI", "PostgreSQL"],
            preferred_skills=["AWS", "Docker"],
            work_type="remote",
        )
        assert requirements.years_experience == "5+ years"
        assert len(requirements.required_skills) == 3
        assert "Python" in requirements.required_skills

    def test_job_with_scoring_criteria(self):
        """Test Job with ScoringCriteria."""
        criteria = ScoringCriteria(
            must_haves=["Python expertise", "API design experience"],
            nice_to_haves=["AWS experience"],
            technical_competencies=["Backend Development", "Database Design"],
            weight_technical=0.5,
            weight_experience=0.3,
            weight_cultural=0.2,
        )
        assert len(criteria.must_haves) == 2
        assert criteria.weight_technical + criteria.weight_experience + criteria.weight_cultural == 1.0

    def test_company_context(self):
        """Test CompanyContext model."""
        context = CompanyContext(
            company_name="Acme Inc",
            team_size="8 engineers",
            team_culture="Collaborative, fast-paced",
            growth_stage="Series B",
        )
        assert context.company_name == "Acme Inc"
        assert context.growth_stage == "Series B"


class TestCandidateModel:
    """Tests for Candidate model validation."""

    def test_candidate_create_valid(self):
        """Test creating a valid CandidateCreate."""
        person_id = uuid.uuid4()
        job_id = uuid.uuid4()
        candidate = CandidateCreate(
            person_id=person_id,
            job_id=job_id,
            skills=["Python", "JavaScript"],
            years_experience=5,
        )
        assert candidate.person_id == person_id
        assert candidate.job_id == job_id
        assert len(candidate.skills) == 2

    def test_interview_status_enum(self):
        """Test InterviewStatus enum values."""
        assert InterviewStatus.PENDING.value == "pending"
        assert InterviewStatus.COMPLETED.value == "completed"
        assert InterviewStatus.REJECTED.value == "rejected"


class TestInterviewModel:
    """Tests for Interview model validation."""

    def test_interview_create_valid(self):
        """Test creating a valid InterviewCreate."""
        candidate_id = uuid.uuid4()
        interview = InterviewCreate(
            candidate_id=candidate_id,
            interview_type=InterviewType.AI_CANDIDATE,
        )
        assert interview.candidate_id == candidate_id
        assert interview.interview_type == InterviewType.AI_CANDIDATE

    def test_interview_types(self):
        """Test InterviewType enum values."""
        assert InterviewType.AI_CANDIDATE.value == "ai_candidate"
        assert InterviewType.LIVE.value == "live"
        assert InterviewType.PHONE_SCREEN.value == "phone_screen"


class TestAnalyticsModel:
    """Tests for Analytics model validation."""

    def test_competency_score_valid(self):
        """Test creating a valid CompetencyScore."""
        score = CompetencyScore(
            name="Python Proficiency",
            score=85.0,
            evidence=["Demonstrated deep understanding of decorators"],
            notes="Strong technical foundation",
        )
        assert score.name == "Python Proficiency"
        assert score.score == 85.0
        assert len(score.evidence) == 1

    def test_recommendation_enum(self):
        """Test Recommendation enum values."""
        assert Recommendation.STRONG_HIRE.value == "strong_hire"
        assert Recommendation.HIRE.value == "hire"
        assert Recommendation.MAYBE.value == "maybe"
        assert Recommendation.NO_HIRE.value == "no_hire"


# ============================================
# DATABASE CRUD TESTS
# ============================================

class TestPersonDatabase:
    """Tests for Person database operations."""

    def test_create_person(self, db, test_person_email):
        """Test creating a person in the database."""
        # Insert
        result = db.table("persons").insert({
            "name": "Test User",
            "email": test_person_email,
            "phone": "+1-555-0000",
        }).execute()

        assert len(result.data) == 1
        person = result.data[0]
        assert person["name"] == "Test User"
        assert person["email"] == test_person_email
        assert "id" in person
        assert "created_at" in person

        # Cleanup
        db.table("persons").delete().eq("email", test_person_email).execute()

    def test_read_person(self, db, test_person_email):
        """Test reading a person from the database."""
        # Create first
        db.table("persons").insert({
            "name": "Read Test User",
            "email": test_person_email,
        }).execute()

        # Read
        result = db.table("persons").select("*").eq("email", test_person_email).execute()
        assert len(result.data) == 1
        assert result.data[0]["name"] == "Read Test User"

        # Cleanup
        db.table("persons").delete().eq("email", test_person_email).execute()

    def test_update_person(self, db, test_person_email):
        """Test updating a person in the database."""
        # Create
        create_result = db.table("persons").insert({
            "name": "Original Name",
            "email": test_person_email,
        }).execute()
        person_id = create_result.data[0]["id"]

        # Update
        db.table("persons").update({
            "name": "Updated Name",
            "phone": "+1-555-9999",
        }).eq("id", person_id).execute()

        # Verify
        result = db.table("persons").select("*").eq("id", person_id).execute()
        assert result.data[0]["name"] == "Updated Name"
        assert result.data[0]["phone"] == "+1-555-9999"

        # Cleanup
        db.table("persons").delete().eq("id", person_id).execute()

    def test_delete_person(self, db, test_person_email):
        """Test deleting a person from the database."""
        # Create
        db.table("persons").insert({
            "name": "Delete Test",
            "email": test_person_email,
        }).execute()

        # Delete
        db.table("persons").delete().eq("email", test_person_email).execute()

        # Verify deleted
        result = db.table("persons").select("*").eq("email", test_person_email).execute()
        assert len(result.data) == 0

    def test_unique_email_constraint(self, db, test_person_email):
        """Test that duplicate emails are rejected."""
        # Create first person
        db.table("persons").insert({
            "name": "First User",
            "email": test_person_email,
        }).execute()

        # Try to create duplicate - should fail
        with pytest.raises(Exception):
            db.table("persons").insert({
                "name": "Second User",
                "email": test_person_email,  # Same email
            }).execute()

        # Cleanup
        db.table("persons").delete().eq("email", test_person_email).execute()


class TestJobDatabase:
    """Tests for Job database operations."""

    def test_create_job(self, db, test_job_title):
        """Test creating a job in the database."""
        result = db.table("job_postings").insert({
            "title": test_job_title,
            "description": "Test job description",
            "status": "draft",
        }).execute()

        assert len(result.data) == 1
        job = result.data[0]
        assert job["title"] == test_job_title
        assert job["status"] == "draft"

        # Cleanup
        db.table("job_postings").delete().eq("title", test_job_title).execute()

    def test_job_with_extracted_requirements(self, db, test_job_title):
        """Test job with JSONB extracted_requirements field."""
        requirements = {
            "years_experience": "5+ years",
            "required_skills": ["Python", "FastAPI"],
            "work_type": "remote",
        }

        result = db.table("job_postings").insert({
            "title": test_job_title,
            "description": "Test job",
            "extracted_requirements": requirements,
        }).execute()

        job = result.data[0]
        assert job["extracted_requirements"]["years_experience"] == "5+ years"
        assert "Python" in job["extracted_requirements"]["required_skills"]

        # Cleanup
        db.table("job_postings").delete().eq("title", test_job_title).execute()

    def test_job_with_scoring_criteria(self, db, test_job_title):
        """Test job with JSONB scoring_criteria field."""
        criteria = {
            "must_haves": ["Python expertise"],
            "nice_to_haves": ["AWS experience"],
            "weight_technical": 0.5,
        }

        result = db.table("job_postings").insert({
            "title": test_job_title,
            "description": "Test job",
            "scoring_criteria": criteria,
        }).execute()

        job = result.data[0]
        assert job["scoring_criteria"]["must_haves"] == ["Python expertise"]
        assert job["scoring_criteria"]["weight_technical"] == 0.5

        # Cleanup
        db.table("job_postings").delete().eq("title", test_job_title).execute()

    def test_job_status_values(self, db, test_job_title):
        """Test that job status accepts valid values."""
        for status in ["draft", "active", "paused", "closed"]:
            unique_title = f"{test_job_title}_{status}"
            result = db.table("job_postings").insert({
                "title": unique_title,
                "description": "Test",
                "status": status,
            }).execute()
            assert result.data[0]["status"] == status
            # Cleanup
            db.table("job_postings").delete().eq("title", unique_title).execute()


class TestCandidateDatabase:
    """Tests for Candidate database operations with Person relationship."""

    def test_create_candidate_with_person(self, db, test_person_email, test_job_title):
        """Test creating a candidate linked to a person and job."""
        # Create person
        person_result = db.table("persons").insert({
            "name": "Candidate Test Person",
            "email": test_person_email,
        }).execute()
        person_id = person_result.data[0]["id"]

        # Create job
        job_result = db.table("job_postings").insert({
            "title": test_job_title,
            "description": "Test job",
        }).execute()
        job_id = job_result.data[0]["id"]

        # Create candidate
        candidate_result = db.table("candidates").insert({
            "name": "Candidate Test Person",
            "email": test_person_email,
            "person_id": person_id,
            "job_posting_id": job_id,
            "bio_summary": "Experienced engineer",
            "skills": ["Python", "JavaScript"],
        }).execute()

        candidate = candidate_result.data[0]
        assert candidate["person_id"] == person_id
        assert candidate["job_posting_id"] == job_id
        assert "Python" in candidate["skills"]

        # Cleanup
        db.table("candidates").delete().eq("id", candidate["id"]).execute()
        db.table("job_postings").delete().eq("id", job_id).execute()
        db.table("persons").delete().eq("id", person_id).execute()

    def test_same_person_multiple_jobs(self, db, test_person_email):
        """Test that same person can apply to multiple jobs."""
        # Create person
        person_result = db.table("persons").insert({
            "name": "Multi-Job Person",
            "email": test_person_email,
        }).execute()
        person_id = person_result.data[0]["id"]

        # Create two jobs
        job1_result = db.table("job_postings").insert({
            "title": f"Job 1 {uuid.uuid4().hex[:8]}",
            "description": "First job",
        }).execute()
        job1_id = job1_result.data[0]["id"]

        job2_result = db.table("job_postings").insert({
            "title": f"Job 2 {uuid.uuid4().hex[:8]}",
            "description": "Second job",
        }).execute()
        job2_id = job2_result.data[0]["id"]

        # Create two candidates for same person
        candidate1 = db.table("candidates").insert({
            "name": "Multi-Job Person",
            "email": test_person_email,
            "person_id": person_id,
            "job_posting_id": job1_id,
        }).execute()

        candidate2 = db.table("candidates").insert({
            "name": "Multi-Job Person",
            "email": test_person_email,
            "person_id": person_id,
            "job_posting_id": job2_id,
        }).execute()

        # Both should succeed
        assert candidate1.data[0]["job_posting_id"] == job1_id
        assert candidate2.data[0]["job_posting_id"] == job2_id

        # Cleanup
        db.table("candidates").delete().eq("person_id", person_id).execute()
        db.table("job_postings").delete().eq("id", job1_id).execute()
        db.table("job_postings").delete().eq("id", job2_id).execute()
        db.table("persons").delete().eq("id", person_id).execute()


class TestInterviewDatabase:
    """Tests for Interview database operations."""

    def test_create_interview(self, db, test_person_email, test_job_title):
        """Test creating an interview linked to a candidate."""
        # Setup: Create person, job, candidate
        person_result = db.table("persons").insert({
            "name": "Interview Test Person",
            "email": test_person_email,
        }).execute()
        person_id = person_result.data[0]["id"]

        job_result = db.table("job_postings").insert({
            "title": test_job_title,
            "description": "Test job",
        }).execute()
        job_id = job_result.data[0]["id"]

        candidate_result = db.table("candidates").insert({
            "name": "Interview Test Person",
            "email": test_person_email,
            "person_id": person_id,
            "job_posting_id": job_id,
        }).execute()
        candidate_id = candidate_result.data[0]["id"]

        # Create interview
        interview_result = db.table("interviews").insert({
            "candidate_id": candidate_id,
            "job_posting_id": job_id,
            "stage": "round_1",
            "interview_type": "ai_candidate",
            "status": "scheduled",
        }).execute()

        interview = interview_result.data[0]
        assert interview["candidate_id"] == candidate_id
        assert interview["interview_type"] == "ai_candidate"
        assert interview["status"] == "scheduled"

        # Cleanup
        db.table("interviews").delete().eq("id", interview["id"]).execute()
        db.table("candidates").delete().eq("id", candidate_id).execute()
        db.table("job_postings").delete().eq("id", job_id).execute()
        db.table("persons").delete().eq("id", person_id).execute()

    def test_interview_with_transcript(self, db, test_person_email, test_job_title):
        """Test storing transcript in interview."""
        # Setup
        person_result = db.table("persons").insert({
            "name": "Transcript Test",
            "email": test_person_email,
        }).execute()
        person_id = person_result.data[0]["id"]

        job_result = db.table("job_postings").insert({
            "title": test_job_title,
            "description": "Test job",
        }).execute()
        job_id = job_result.data[0]["id"]

        candidate_result = db.table("candidates").insert({
            "name": "Transcript Test",
            "email": test_person_email,
            "person_id": person_id,
            "job_posting_id": job_id,
        }).execute()
        candidate_id = candidate_result.data[0]["id"]

        # Create interview with transcript
        transcript = "Interviewer: Tell me about yourself.\nCandidate: I am a software engineer..."
        interview_result = db.table("interviews").insert({
            "candidate_id": candidate_id,
            "job_posting_id": job_id,
            "stage": "round_1",
            "transcript": transcript,
            "status": "completed",
        }).execute()

        interview = interview_result.data[0]
        assert interview["transcript"] == transcript
        assert interview["status"] == "completed"

        # Cleanup
        db.table("interviews").delete().eq("id", interview["id"]).execute()
        db.table("candidates").delete().eq("id", candidate_id).execute()
        db.table("job_postings").delete().eq("id", job_id).execute()
        db.table("persons").delete().eq("id", person_id).execute()


class TestAnalyticsDatabase:
    """Tests for Analytics database operations."""

    def test_create_analytics(self, db, test_person_email, test_job_title):
        """Test creating analytics linked to an interview."""
        # Full setup chain
        person_result = db.table("persons").insert({
            "name": "Analytics Test",
            "email": test_person_email,
        }).execute()
        person_id = person_result.data[0]["id"]

        job_result = db.table("job_postings").insert({
            "title": test_job_title,
            "description": "Test job",
        }).execute()
        job_id = job_result.data[0]["id"]

        candidate_result = db.table("candidates").insert({
            "name": "Analytics Test",
            "email": test_person_email,
            "person_id": person_id,
            "job_posting_id": job_id,
        }).execute()
        candidate_id = candidate_result.data[0]["id"]

        interview_result = db.table("interviews").insert({
            "candidate_id": candidate_id,
            "job_posting_id": job_id,
            "stage": "round_1",
            "status": "completed",
        }).execute()
        interview_id = interview_result.data[0]["id"]

        # Create analytics
        analytics_result = db.table("analytics").insert({
            "interview_id": interview_id,
            "overall_score": 85,
            "recommendation": "hire",
            "summary": "Strong candidate with good technical skills",
            "competency_scores": [
                {"name": "Python", "score": 90, "evidence": ["Good examples"]},
                {"name": "Communication", "score": 80, "evidence": ["Clear answers"]},
            ],
            "strengths": ["Technical depth", "Problem solving"],
            "concerns": ["Limited cloud experience"],
            "red_flags_detected": [],
        }).execute()

        analytics = analytics_result.data[0]
        assert analytics["overall_score"] == 85
        assert analytics["recommendation"] == "hire"
        assert len(analytics["competency_scores"]) == 2
        assert len(analytics["strengths"]) == 2

        # Cleanup
        db.table("analytics").delete().eq("id", analytics["id"]).execute()
        db.table("interviews").delete().eq("id", interview_id).execute()
        db.table("candidates").delete().eq("id", candidate_id).execute()
        db.table("job_postings").delete().eq("id", job_id).execute()
        db.table("persons").delete().eq("id", person_id).execute()


# ============================================
# VIEW TESTS
# ============================================

class TestDatabaseViews:
    """Tests for database views."""

    def test_job_dashboard_view(self, db, test_job_title):
        """Test job_dashboard_view returns correct aggregates."""
        # Create job with some candidates
        job_result = db.table("job_postings").insert({
            "title": test_job_title,
            "description": "Test job",
            "status": "active",
        }).execute()
        job_id = job_result.data[0]["id"]

        # Create a few candidates
        for i in range(3):
            db.table("candidates").insert({
                "name": f"View Test Candidate {i}",
                "email": f"viewtest{i}_{uuid.uuid4().hex[:8]}@example.com",
                "job_posting_id": job_id,
                "pipeline_status": "new" if i < 2 else "round_1",
            }).execute()

        # Query the view
        result = db.table("job_dashboard_view").select("*").eq("id", job_id).execute()

        assert len(result.data) == 1
        view_data = result.data[0]
        assert view_data["title"] == test_job_title
        assert view_data["candidate_count"] == 3
        assert view_data["pending_count"] == 2  # 2 with status 'new'

        # Cleanup
        db.table("candidates").delete().eq("job_posting_id", job_id).execute()
        db.table("job_postings").delete().eq("id", job_id).execute()


# ============================================
# INTEGRATION TESTS
# ============================================

class TestFullFlow:
    """Integration tests for the full streamlined flow."""

    def test_complete_hiring_flow(self, db):
        """Test complete flow: Person -> Candidate -> Interview -> Analytics."""
        test_email = f"fullflow_{uuid.uuid4().hex[:8]}@example.com"
        test_title = f"Full Flow Test Job {uuid.uuid4().hex[:8]}"

        # 1. Create Person
        person = db.table("persons").insert({
            "name": "Full Flow Test Person",
            "email": test_email,
        }).execute().data[0]

        # 2. Create Job with requirements
        job = db.table("job_postings").insert({
            "title": test_title,
            "description": "Full flow test job description",
            "status": "active",
            "extracted_requirements": {
                "years_experience": "3+ years",
                "required_skills": ["Python", "SQL"],
            },
            "scoring_criteria": {
                "must_haves": ["Python expertise"],
                "weight_technical": 0.5,
            },
            "red_flags": ["Job hopping"],
        }).execute().data[0]

        # 3. Create Candidate (application)
        candidate = db.table("candidates").insert({
            "name": "Full Flow Test Person",
            "email": test_email,
            "person_id": person["id"],
            "job_posting_id": job["id"],
            "bio_summary": "Experienced Python developer",
            "skills": ["Python", "FastAPI", "PostgreSQL"],
            "pipeline_status": "new",
        }).execute().data[0]

        # 4. Create Interview
        interview = db.table("interviews").insert({
            "candidate_id": candidate["id"],
            "job_posting_id": job["id"],
            "stage": "round_1",
            "interview_type": "ai_candidate",
            "status": "completed",
            "transcript": "Full interview transcript here...",
        }).execute().data[0]

        # 5. Create Analytics
        analytics = db.table("analytics").insert({
            "interview_id": interview["id"],
            "overall_score": 88,
            "recommendation": "strong_hire",
            "summary": "Excellent candidate with strong Python skills",
            "competency_scores": [
                {"name": "Python", "score": 95, "evidence": ["Excellent examples"]},
            ],
            "strengths": ["Deep Python expertise", "Good communication"],
            "concerns": [],
            "red_flags_detected": [],
        }).execute().data[0]

        # Verify everything is linked
        assert candidate["person_id"] == person["id"]
        assert candidate["job_posting_id"] == job["id"]
        assert interview["candidate_id"] == candidate["id"]
        assert analytics["interview_id"] == interview["id"]

        # Verify we can query the job dashboard view
        dashboard = db.table("job_dashboard_view").select("*").eq("id", job["id"]).execute().data[0]
        assert dashboard["candidate_count"] == 1

        # Cleanup (reverse order due to foreign keys)
        db.table("analytics").delete().eq("id", analytics["id"]).execute()
        db.table("interviews").delete().eq("id", interview["id"]).execute()
        db.table("candidates").delete().eq("id", candidate["id"]).execute()
        db.table("job_postings").delete().eq("id", job["id"]).execute()
        db.table("persons").delete().eq("id", person["id"]).execute()

        print("Full flow test completed successfully!")


# ============================================
# RUN TESTS DIRECTLY
# ============================================

if __name__ == "__main__":
    """Run tests directly without pytest for quick verification."""
    import sys

    print("=" * 60)
    print("STREAMLINED MODELS TEST SUITE")
    print("=" * 60)

    # Get DB client
    try:
        db = get_db()
        print("[OK] Database connection established")
    except Exception as e:
        print(f"[FAIL] Database connection failed: {e}")
        sys.exit(1)

    # Run model tests
    print("\n--- Model Validation Tests ---")
    try:
        TestPersonModel().test_person_create_valid()
        print("[OK] PersonCreate validation")
    except Exception as e:
        print(f"[FAIL] PersonCreate validation: {e}")

    try:
        TestJobModel().test_job_create_valid()
        print("[OK] JobCreate validation")
    except Exception as e:
        print(f"[FAIL] JobCreate validation: {e}")

    try:
        TestJobModel().test_job_with_extracted_requirements()
        print("[OK] ExtractedRequirements validation")
    except Exception as e:
        print(f"[FAIL] ExtractedRequirements validation: {e}")

    try:
        TestJobModel().test_job_with_scoring_criteria()
        print("[OK] ScoringCriteria validation")
    except Exception as e:
        print(f"[FAIL] ScoringCriteria validation: {e}")

    # Run database tests
    print("\n--- Database CRUD Tests ---")

    test_email = f"quicktest_{uuid.uuid4().hex[:8]}@example.com"
    test_title = f"Quick Test Job {uuid.uuid4().hex[:8]}"

    try:
        TestPersonDatabase().test_create_person(db, test_email)
        print("[OK] Person CRUD")
    except Exception as e:
        print(f"[FAIL] Person CRUD: {e}")
        # Cleanup on failure
        db.table("persons").delete().eq("email", test_email).execute()

    try:
        TestJobDatabase().test_create_job(db, test_title)
        print("[OK] Job CRUD")
    except Exception as e:
        print(f"[FAIL] Job CRUD: {e}")
        db.table("job_postings").delete().eq("title", test_title).execute()

    # Run full flow test
    print("\n--- Integration Test ---")
    try:
        TestFullFlow().test_complete_hiring_flow(db)
        print("[OK] Full hiring flow")
    except Exception as e:
        print(f"[FAIL] Full hiring flow: {e}")

    print("\n" + "=" * 60)
    print("TEST SUITE COMPLETE")
    print("=" * 60)
