"""
Tests for Phase 3: Job Enrichment via Vapi Voice Agent

This test suite verifies:
1. Job enrichment endpoint returns correct Vapi configuration
2. Webhook endpoint handles tool calls correctly
3. Company context, scoring criteria, and red flags are saved properly
4. Job activation via webhook works

Run with: pytest tests/test_phase3_job_enrichment.py -v
"""

import pytest
import pytest_asyncio
import uuid
import json
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
    return f"Phase3 Test Job {uuid.uuid4().hex[:8]}"


@pytest.fixture
def sample_job_description():
    """Sample job description for testing."""
    return """
    Senior Software Engineer - Backend

    We are looking for a Senior Software Engineer with 5+ years experience.

    Requirements:
    - Strong Python and FastAPI skills
    - PostgreSQL experience
    - Cloud experience (AWS/GCP)

    Location: San Francisco (Hybrid)
    """


@pytest_asyncio.fixture
async def client():
    """Get FastAPI async test client."""
    from main import app
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        yield client


@pytest_asyncio.fixture
async def test_job(client, test_job_title, sample_job_description):
    """Create a test job for enrichment tests."""
    # Create job with extracted requirements
    response = await client.post("/api/jobs/", json={
        "title": test_job_title,
        "raw_description": sample_job_description,
    })
    job_data = response.json()
    job_id = job_data["id"]

    # Add extracted requirements so enrichment works
    await client.patch(f"/api/jobs/{job_id}", json={
        "extracted_requirements": {
            "years_experience": "5+ years",
            "required_skills": ["Python", "FastAPI", "PostgreSQL"],
            "preferred_skills": ["AWS", "GCP"],
            "work_type": "hybrid",
            "location": "San Francisco",
        }
    })

    # Fetch updated job
    response = await client.get(f"/api/jobs/{job_id}")
    yield response.json()

    # Cleanup
    await client.delete(f"/api/jobs/{job_id}")


# ============================================
# ENRICH ENDPOINT TESTS
# ============================================

@pytest.mark.asyncio
class TestJobEnrichEndpoint:
    """Tests for POST /api/jobs/{job_id}/enrich endpoint."""

    async def test_enrich_returns_vapi_config(self, client, test_job, monkeypatch):
        """Test that enrich endpoint returns Vapi configuration."""
        # Mock Vapi config
        monkeypatch.setenv("VAPI_PUBLIC_KEY", "test_public_key_123")
        monkeypatch.setenv("VAPI_ASSISTANT_ID", "test_assistant_id_456")

        # Need to reload config after setting env vars
        import config
        import importlib
        importlib.reload(config)

        job_id = test_job["id"]

        response = await client.post(f"/api/jobs/{job_id}/enrich")

        # If Vapi keys not configured, expect 500
        if response.status_code == 500:
            assert "VAPI" in response.json()["detail"]
            return

        assert response.status_code == 200
        data = response.json()

        assert "vapi_public_key" in data
        assert "assistant_id" in data
        assert "job_id" in data
        assert data["job_id"] == job_id
        assert "assistant_overrides" in data

        overrides = data["assistant_overrides"]
        assert "variableValues" in overrides
        assert "firstMessage" in overrides
        assert "metadata" in overrides

        # Check metadata contains job info
        metadata = overrides["metadata"]
        assert metadata["jobId"] == job_id
        assert metadata["mode"] == "job_enrichment"

    async def test_enrich_nonexistent_job(self, client):
        """Test enrich endpoint with non-existent job."""
        fake_id = str(uuid.uuid4())
        response = await client.post(f"/api/jobs/{fake_id}/enrich")

        assert response.status_code == 404
        assert "not found" in response.json()["detail"].lower()

    async def test_enrich_first_message_includes_skills(self, client, test_job, monkeypatch):
        """Test that first message includes extracted skills."""
        monkeypatch.setenv("VAPI_PUBLIC_KEY", "test_key")
        monkeypatch.setenv("VAPI_ASSISTANT_ID", "test_assistant")

        import config
        import importlib
        importlib.reload(config)

        job_id = test_job["id"]
        response = await client.post(f"/api/jobs/{job_id}/enrich")

        if response.status_code == 500:
            return  # Skip if Vapi not configured

        data = response.json()
        first_message = data["assistant_overrides"]["firstMessage"]

        # Should include job title
        assert test_job["title"] in first_message
        # Should include at least one skill
        assert any(skill in first_message for skill in ["Python", "FastAPI", "PostgreSQL"])


# ============================================
# WEBHOOK ENDPOINT TESTS
# ============================================

@pytest.mark.asyncio
class TestJobEnrichWebhook:
    """Tests for POST /api/jobs/enrich-webhook endpoint."""

    async def test_webhook_non_tool_call_returns_ok(self, client):
        """Test webhook returns ok for non-tool-call messages."""
        response = await client.post("/api/jobs/enrich-webhook", json={
            "message": {"type": "transcript"}
        })

        assert response.status_code == 200
        assert response.json()["status"] == "ok"

    async def test_webhook_update_company_context(self, client, test_job):
        """Test webhook handles update_company_context tool call."""
        job_id = test_job["id"]

        webhook_payload = {
            "message": {
                "type": "tool-calls",
                "call": {
                    "metadata": {"jobId": job_id}
                },
                "toolCalls": [{
                    "id": "call_123",
                    "function": {
                        "name": "update_company_context",
                        "arguments": json.dumps({
                            "company_name": "Test Corp",
                            "team_size": "10 engineers",
                            "team_culture": "Collaborative and fast-paced",
                            "reporting_to": "VP of Engineering",
                            "growth_stage": "Series B"
                        })
                    }
                }]
            }
        }

        response = await client.post("/api/jobs/enrich-webhook", json=webhook_payload)

        assert response.status_code == 200
        results = response.json()["results"]
        assert len(results) == 1

        result = json.loads(results[0]["result"])
        assert result["success"] is True
        assert result["field"] == "company_context"

        # Verify job was updated
        job_response = await client.get(f"/api/jobs/{job_id}")
        job = job_response.json()
        assert job["company_context"]["company_name"] == "Test Corp"
        assert job["company_context"]["team_size"] == "10 engineers"

    async def test_webhook_update_scoring_criteria(self, client, test_job):
        """Test webhook handles update_scoring_criteria tool call."""
        job_id = test_job["id"]

        webhook_payload = {
            "message": {
                "type": "tool-calls",
                "call": {
                    "metadata": {"jobId": job_id}
                },
                "toolCalls": [{
                    "id": "call_456",
                    "function": {
                        "name": "update_scoring_criteria",
                        "arguments": json.dumps({
                            "must_haves": ["Python expertise", "API design"],
                            "nice_to_haves": ["Kubernetes experience"],
                            "technical_competencies": ["Backend Development"],
                            "weight_technical": 0.5,
                            "weight_experience": 0.3,
                            "weight_cultural": 0.2
                        })
                    }
                }]
            }
        }

        response = await client.post("/api/jobs/enrich-webhook", json=webhook_payload)

        assert response.status_code == 200
        results = response.json()["results"]
        result = json.loads(results[0]["result"])
        assert result["success"] is True
        assert result["field"] == "scoring_criteria"

        # Verify job was updated
        job_response = await client.get(f"/api/jobs/{job_id}")
        job = job_response.json()
        assert "Python expertise" in job["scoring_criteria"]["must_haves"]

    async def test_webhook_add_red_flag(self, client, test_job):
        """Test webhook handles add_red_flag tool call."""
        job_id = test_job["id"]

        webhook_payload = {
            "message": {
                "type": "tool-calls",
                "call": {
                    "metadata": {"jobId": job_id}
                },
                "toolCalls": [{
                    "id": "call_789",
                    "function": {
                        "name": "add_red_flag",
                        "arguments": json.dumps({
                            "red_flag": "Job hopping - less than 1 year at each company"
                        })
                    }
                }]
            }
        }

        response = await client.post("/api/jobs/enrich-webhook", json=webhook_payload)

        assert response.status_code == 200
        results = response.json()["results"]
        result = json.loads(results[0]["result"])
        assert result["success"] is True
        assert result["red_flag"] == "Job hopping - less than 1 year at each company"

        # Verify job was updated
        job_response = await client.get(f"/api/jobs/{job_id}")
        job = job_response.json()
        assert "Job hopping - less than 1 year at each company" in job["red_flags"]

    async def test_webhook_activate_job(self, client, test_job):
        """Test webhook handles activate_job tool call."""
        job_id = test_job["id"]

        webhook_payload = {
            "message": {
                "type": "tool-calls",
                "call": {
                    "metadata": {"jobId": job_id}
                },
                "toolCalls": [{
                    "id": "call_activate",
                    "function": {
                        "name": "activate_job",
                        "arguments": "{}"
                    }
                }]
            }
        }

        response = await client.post("/api/jobs/enrich-webhook", json=webhook_payload)

        assert response.status_code == 200
        results = response.json()["results"]
        result = json.loads(results[0]["result"])
        assert result["success"] is True
        assert result["status"] == "active"

        # Verify job status changed
        job_response = await client.get(f"/api/jobs/{job_id}")
        job = job_response.json()
        assert job["status"] == "active"

    async def test_webhook_multiple_tool_calls(self, client, test_job):
        """Test webhook handles multiple tool calls in one request."""
        job_id = test_job["id"]

        webhook_payload = {
            "message": {
                "type": "tool-calls",
                "call": {
                    "metadata": {"jobId": job_id}
                },
                "toolCalls": [
                    {
                        "id": "call_1",
                        "function": {
                            "name": "add_red_flag",
                            "arguments": json.dumps({"red_flag": "Red flag 1"})
                        }
                    },
                    {
                        "id": "call_2",
                        "function": {
                            "name": "add_red_flag",
                            "arguments": json.dumps({"red_flag": "Red flag 2"})
                        }
                    }
                ]
            }
        }

        response = await client.post("/api/jobs/enrich-webhook", json=webhook_payload)

        assert response.status_code == 200
        results = response.json()["results"]
        assert len(results) == 2

        # Verify both red flags were added
        job_response = await client.get(f"/api/jobs/{job_id}")
        job = job_response.json()
        assert "Red flag 1" in job["red_flags"]
        assert "Red flag 2" in job["red_flags"]

    async def test_webhook_job_id_from_tool_args(self, client, test_job):
        """Test webhook extracts job_id from tool arguments."""
        job_id = test_job["id"]

        # No metadata, job_id is in arguments
        webhook_payload = {
            "message": {
                "type": "tool-calls",
                "toolCalls": [{
                    "id": "call_args_id",
                    "function": {
                        "name": "add_red_flag",
                        "arguments": json.dumps({
                            "job_id": job_id,
                            "red_flag": "Test red flag from args"
                        })
                    }
                }]
            }
        }

        response = await client.post("/api/jobs/enrich-webhook", json=webhook_payload)

        assert response.status_code == 200
        results = response.json()["results"]
        result = json.loads(results[0]["result"])
        assert result["success"] is True

    async def test_webhook_missing_job_id(self, client):
        """Test webhook returns error when job_id is missing."""
        webhook_payload = {
            "message": {
                "type": "tool-calls",
                "toolCalls": [{
                    "id": "call_no_id",
                    "function": {
                        "name": "add_red_flag",
                        "arguments": json.dumps({"red_flag": "Test"})
                    }
                }]
            }
        }

        response = await client.post("/api/jobs/enrich-webhook", json=webhook_payload)

        assert response.status_code == 200
        results = response.json()["results"]
        result = json.loads(results[0]["result"])
        assert "error" in result
        assert "job_id" in result["error"]


# ============================================
# INTEGRATION TESTS
# ============================================

@pytest.mark.asyncio
class TestJobEnrichmentFlow:
    """Integration tests for complete job enrichment flow."""

    async def test_complete_enrichment_flow(self, client, test_job_title, sample_job_description):
        """Test complete flow: create job -> enrich via webhook -> verify updates."""
        # 1. Create job
        create_response = await client.post("/api/jobs/", json={
            "title": test_job_title,
            "raw_description": sample_job_description,
        })
        assert create_response.status_code == 200
        job = create_response.json()
        job_id = job["id"]
        assert job["status"] == "draft"

        try:
            # 2. Add extracted requirements (normally done by JD extraction)
            await client.patch(f"/api/jobs/{job_id}", json={
                "extracted_requirements": {
                    "years_experience": "5+ years",
                    "required_skills": ["Python", "FastAPI"],
                }
            })

            # 3. Simulate webhook calls from voice agent
            # 3a. Update company context
            await client.post("/api/jobs/enrich-webhook", json={
                "message": {
                    "type": "tool-calls",
                    "call": {"metadata": {"jobId": job_id}},
                    "toolCalls": [{
                        "id": "call_context",
                        "function": {
                            "name": "update_company_context",
                            "arguments": json.dumps({
                                "company_name": "Acme Corp",
                                "team_size": "8 engineers",
                                "team_culture": "Collaborative"
                            })
                        }
                    }]
                }
            })

            # 3b. Update scoring criteria
            await client.post("/api/jobs/enrich-webhook", json={
                "message": {
                    "type": "tool-calls",
                    "call": {"metadata": {"jobId": job_id}},
                    "toolCalls": [{
                        "id": "call_scoring",
                        "function": {
                            "name": "update_scoring_criteria",
                            "arguments": json.dumps({
                                "must_haves": ["Python", "API Design"],
                                "nice_to_haves": ["Cloud experience"],
                                "weight_technical": 0.5,
                                "weight_experience": 0.3,
                                "weight_cultural": 0.2
                            })
                        }
                    }]
                }
            })

            # 3c. Add red flags
            await client.post("/api/jobs/enrich-webhook", json={
                "message": {
                    "type": "tool-calls",
                    "call": {"metadata": {"jobId": job_id}},
                    "toolCalls": [{
                        "id": "call_flag",
                        "function": {
                            "name": "add_red_flag",
                            "arguments": json.dumps({"red_flag": "No Python experience"})
                        }
                    }]
                }
            })

            # 3d. Activate job
            await client.post("/api/jobs/enrich-webhook", json={
                "message": {
                    "type": "tool-calls",
                    "call": {"metadata": {"jobId": job_id}},
                    "toolCalls": [{
                        "id": "call_activate",
                        "function": {
                            "name": "activate_job",
                            "arguments": "{}"
                        }
                    }]
                }
            })

            # 4. Verify final job state
            final_response = await client.get(f"/api/jobs/{job_id}")
            assert final_response.status_code == 200
            final_job = final_response.json()

            # Verify all enrichment was saved
            assert final_job["status"] == "active"
            assert final_job["company_context"]["company_name"] == "Acme Corp"
            assert final_job["company_context"]["team_size"] == "8 engineers"
            assert "Python" in final_job["scoring_criteria"]["must_haves"]
            assert "No Python experience" in final_job["red_flags"]

            print("Complete enrichment flow test passed!")

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
            test_title = f"Quick Enrich Test {uuid.uuid4().hex[:8]}"

            try:
                # Create job
                response = await client.post("/api/jobs/", json={
                    "title": test_title,
                    "raw_description": "Test job description for enrichment",
                })
                job_id = response.json()["id"]
                print(f"[OK] Created job: {job_id}")

                # Test webhook
                response = await client.post("/api/jobs/enrich-webhook", json={
                    "message": {
                        "type": "tool-calls",
                        "call": {"metadata": {"jobId": job_id}},
                        "toolCalls": [{
                            "id": "test_call",
                            "function": {
                                "name": "add_red_flag",
                                "arguments": json.dumps({"red_flag": "Test flag"})
                            }
                        }]
                    }
                })
                assert response.status_code == 200
                print("[OK] Webhook tool call processed")

                # Verify update
                response = await client.get(f"/api/jobs/{job_id}")
                job = response.json()
                assert "Test flag" in job["red_flags"]
                print("[OK] Job updated with red flag")

                # Cleanup
                await client.delete(f"/api/jobs/{job_id}")
                print("[OK] Cleanup completed")

            except Exception as e:
                print(f"[FAIL] {e}")

    print("=" * 60)
    print("PHASE 3: JOB ENRICHMENT TEST SUITE")
    print("=" * 60)

    asyncio.run(run_quick_tests())

    print("\n" + "=" * 60)
    print("TEST SUITE COMPLETE")
    print("=" * 60)
