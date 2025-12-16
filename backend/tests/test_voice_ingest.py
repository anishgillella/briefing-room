#!/usr/bin/env python3
"""
Comprehensive Test Script for Voice Ingest Feature.
Tests all phases: Models, Repository, Services, API Endpoints.

Run with: python -m tests.test_voice_ingest
Or: pytest tests/test_voice_ingest.py -v
"""
import asyncio
import sys
import os
import json
import uuid
from pathlib import Path
from datetime import datetime
from typing import Dict, Any

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent.parent))

# Set environment to use local storage
os.environ["USE_SUPABASE"] = "false"

# Colors for terminal output
class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    RESET = '\033[0m'
    BOLD = '\033[1m'


def print_header(text: str):
    print(f"\n{Colors.BOLD}{Colors.BLUE}{'='*60}{Colors.RESET}")
    print(f"{Colors.BOLD}{Colors.CYAN}{text}{Colors.RESET}")
    print(f"{Colors.BOLD}{Colors.BLUE}{'='*60}{Colors.RESET}\n")


def print_test(name: str, passed: bool, details: str = ""):
    status = f"{Colors.GREEN}PASS{Colors.RESET}" if passed else f"{Colors.RED}FAIL{Colors.RESET}"
    print(f"  [{status}] {name}")
    if details and not passed:
        print(f"         {Colors.YELLOW}{details}{Colors.RESET}")


def print_section(text: str):
    print(f"\n{Colors.BOLD}{Colors.YELLOW}>>> {text}{Colors.RESET}")


class TestResults:
    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.errors = []

    def add_result(self, name: str, passed: bool, error: str = ""):
        if passed:
            self.passed += 1
        else:
            self.failed += 1
            self.errors.append((name, error))
        print_test(name, passed, error)

    def summary(self):
        total = self.passed + self.failed
        print(f"\n{Colors.BOLD}{'='*60}{Colors.RESET}")
        print(f"{Colors.BOLD}TEST SUMMARY{Colors.RESET}")
        print(f"{'='*60}")
        print(f"  Total:  {total}")
        print(f"  {Colors.GREEN}Passed: {self.passed}{Colors.RESET}")
        print(f"  {Colors.RED}Failed: {self.failed}{Colors.RESET}")

        if self.errors:
            print(f"\n{Colors.RED}Failed Tests:{Colors.RESET}")
            for name, error in self.errors:
                print(f"  - {name}: {error}")

        return self.failed == 0


results = TestResults()


# =============================================================================
# PHASE 1: Test Data Models
# =============================================================================

def test_phase1_models():
    """Test all Pydantic models."""
    print_header("PHASE 1: Data Models")

    # Test Enums
    print_section("Testing Enums")
    try:
        from models.voice_ingest.enums import (
            FundingStage, LocationType, TraitPriority,
            NuanceCategory, OutreachTone, ExtractionSource
        )
        results.add_result("Import enums", True)

        # Test enum values
        assert FundingStage.SERIES_A.value == "series_a"
        assert LocationType.HYBRID.value == "hybrid"
        assert TraitPriority.MUST_HAVE.value == "must_have"
        results.add_result("Enum values correct", True)
    except Exception as e:
        results.add_result("Enums", False, str(e))

    # Test CompanyIntelligence
    print_section("Testing CompanyIntelligence")
    try:
        from models.voice_ingest import CompanyIntelligence
        from models.voice_ingest.enums import FundingStage

        company = CompanyIntelligence(
            name="TestCorp",
            website="https://testcorp.com",
            tagline="Testing made easy",
            funding_stage=FundingStage.SERIES_B,
            total_raised="$50M",
            team_size="100-200",  # String format
            headquarters="San Francisco, CA",
            tech_stack_hints=["Python", "React", "PostgreSQL"],
            culture_keywords=["innovative", "fast-paced"],
        )
        assert company.name == "TestCorp"
        assert company.team_size == "100-200"
        results.add_result("CompanyIntelligence model", True)
    except Exception as e:
        results.add_result("CompanyIntelligence model", False, str(e))

    # Test HardRequirements
    print_section("Testing HardRequirements")
    try:
        from models.voice_ingest import HardRequirements
        from models.voice_ingest.enums import LocationType

        req = HardRequirements(
            job_title="Senior Software Engineer",
            location_type=LocationType.HYBRID,
            location_city="San Francisco",
            onsite_days_per_week=3,
            experience_min_years=5,
            experience_max_years=10,
            salary_min=150000,
            salary_max=200000,
            equity_offered=True,
            visa_sponsorship=True,
        )
        assert req.job_title == "Senior Software Engineer"
        assert req.format_experience() == "5-10 years"
        assert "$150k" in req.format_compensation()
        results.add_result("HardRequirements model", True)
    except Exception as e:
        results.add_result("HardRequirements model", False, str(e))

    # Test CandidateTrait
    print_section("Testing CandidateTrait")
    try:
        from models.voice_ingest import CandidateTrait
        from models.voice_ingest.enums import TraitPriority

        trait = CandidateTrait(
            id=str(uuid.uuid4()),
            name="Distributed Systems",
            description="Experience with distributed systems design",
            priority=TraitPriority.MUST_HAVE,
            signals=["Kafka", "Redis", "gRPC"],
        )
        assert trait.name == "Distributed Systems"
        assert trait.priority == TraitPriority.MUST_HAVE
        results.add_result("CandidateTrait model", True)
    except Exception as e:
        results.add_result("CandidateTrait model", False, str(e))

    # Test InterviewStage
    print_section("Testing InterviewStage")
    try:
        from models.voice_ingest import InterviewStage

        stage = InterviewStage(
            id=str(uuid.uuid4()),
            name="Technical Interview",
            description="Deep dive into system design",
            order=2,
            duration_minutes=60,
            interviewer_role="Staff Engineer",
        )
        assert stage.name == "Technical Interview"
        assert stage.order == 2
        results.add_result("InterviewStage model", True)
    except Exception as e:
        results.add_result("InterviewStage model", False, str(e))

    # Test JobProfile
    print_section("Testing JobProfile")
    try:
        from models.voice_ingest import JobProfile, CompanyIntelligence, HardRequirements

        profile = JobProfile(
            id=str(uuid.uuid4()),
            recruiter_first_name="Jane",
            recruiter_last_name="Doe",
            company=CompanyIntelligence(name="TestCorp", website="https://test.com"),
            requirements=HardRequirements(job_title="Engineer"),
        )
        assert profile.recruiter_first_name == "Jane"
        assert profile.company.name == "TestCorp"

        # Test completion calculation
        missing = profile.get_missing_fields()
        assert "job_title" not in missing  # We set it
        results.add_result("JobProfile model", True)
    except Exception as e:
        results.add_result("JobProfile model", False, str(e))

    # Test ConversationContext
    print_section("Testing ConversationContext")
    try:
        from models.voice_ingest import JobProfile, CompanyIntelligence, HardRequirements
        from models.voice_ingest.context import ConversationContext, SmartQuestion

        profile = JobProfile(
            id="test-123",
            recruiter_first_name="Jane",
            recruiter_last_name="Doe",
            company=CompanyIntelligence(name="TestCorp", website="https://test.com"),
            requirements=HardRequirements(),
        )

        context = ConversationContext(
            session_id="test-123",
            user_first_name="Jane",
            user_last_name="Doe",
            current_profile=profile,
            missing_fields=["location_type", "experience_min_years"],
            smart_questions=[
                SmartQuestion(
                    field="location",
                    question="What location flexibility do you offer?",
                    why="Helps match candidates"
                )
            ],
            opening_hook="Hey Jane! Tell me about this role.",
        )
        assert context.session_id == "test-123"
        assert len(context.smart_questions) == 1
        results.add_result("ConversationContext model", True)
    except Exception as e:
        results.add_result("ConversationContext model", False, str(e))


# =============================================================================
# PHASE 2: Test Local Repository
# =============================================================================

def test_phase2_repository():
    """Test local file-based repository."""
    print_header("PHASE 2: Local Repository")

    async def run_repo_tests():
        from repositories.job_profile_local import LocalJobProfileRepository
        from models.voice_ingest import (
            JobProfile, CompanyIntelligence, HardRequirements,
            CandidateTrait, InterviewStage
        )
        from models.voice_ingest.enums import TraitPriority, LocationType

        # Use a test-specific data directory
        test_dir = Path(__file__).parent / "test_data"
        test_dir.mkdir(exist_ok=True)
        repo = LocalJobProfileRepository(data_dir=str(test_dir))

        session_id = f"test-{uuid.uuid4().hex[:8]}"

        # Test Create
        print_section("Testing Repository Create")
        try:
            profile = JobProfile(
                id=session_id,
                recruiter_first_name="Test",
                recruiter_last_name="User",
                company=CompanyIntelligence(name="TestCorp", website="https://test.com"),
                requirements=HardRequirements(
                    job_title="Senior Engineer",
                    location_type=LocationType.REMOTE,
                    experience_min_years=5,
                ),
            )
            created = await repo.create(profile)
            assert created is not None
            assert created.id == session_id
            results.add_result("Repository create", True)
        except Exception as e:
            results.add_result("Repository create", False, str(e))

        # Test Get
        print_section("Testing Repository Get")
        try:
            fetched = await repo.get(session_id)
            assert fetched is not None
            assert fetched.recruiter_first_name == "Test"
            assert fetched.requirements.job_title == "Senior Engineer"
            results.add_result("Repository get", True)
        except Exception as e:
            results.add_result("Repository get", False, str(e))

        # Test Update Requirements
        print_section("Testing Repository Update Requirements")
        try:
            success = await repo.update_requirements(session_id, {
                "salary_min": 150000,
                "salary_max": 200000,
            })
            assert success
            updated = await repo.get(session_id)
            assert updated.requirements.salary_min == 150000
            results.add_result("Repository update requirements", True)
        except Exception as e:
            results.add_result("Repository update requirements", False, str(e))

        # Test Add Trait
        print_section("Testing Repository Add Trait")
        try:
            trait = CandidateTrait(
                id=str(uuid.uuid4()),
                name="Python",
                description="Strong Python experience",
                priority=TraitPriority.MUST_HAVE,
                signals=["Django", "FastAPI"],
            )
            success = await repo.add_trait(session_id, trait)
            assert success
            updated = await repo.get(session_id)
            assert len(updated.traits) == 1
            assert updated.traits[0].name == "Python"
            results.add_result("Repository add trait", True)
        except Exception as e:
            results.add_result("Repository add trait", False, str(e))

        # Test Add Interview Stage
        print_section("Testing Repository Add Interview Stage")
        try:
            stage = InterviewStage(
                id=str(uuid.uuid4()),
                name="Phone Screen",
                description="Initial call",
                order=1,
                duration_minutes=30,
            )
            success = await repo.add_interview_stage(session_id, stage)
            assert success
            updated = await repo.get(session_id)
            assert len(updated.interview_stages) == 1
            results.add_result("Repository add interview stage", True)
        except Exception as e:
            results.add_result("Repository add interview stage", False, str(e))

        # Test List All
        print_section("Testing Repository List All")
        try:
            all_profiles = await repo.list_all()
            assert len(all_profiles) >= 1
            results.add_result("Repository list all", True)
        except Exception as e:
            results.add_result("Repository list all", False, str(e))

        # Test Delete
        print_section("Testing Repository Delete")
        try:
            success = await repo.delete(session_id)
            assert success
            deleted = await repo.get(session_id)
            assert deleted is None
            results.add_result("Repository delete", True)
        except Exception as e:
            results.add_result("Repository delete", False, str(e))

        # Cleanup test file
        try:
            (test_dir / "job_profiles.json").unlink(missing_ok=True)
            test_dir.rmdir()
        except:
            pass

    asyncio.run(run_repo_tests())


# =============================================================================
# PHASE 3: Test Services
# =============================================================================

def test_phase3_services():
    """Test service layer."""
    print_header("PHASE 3: Services")

    # Test Profile Converter
    print_section("Testing Profile Converter")
    try:
        from services.profile_converter import (
            convert_profile_to_scoring_context,
            build_enhanced_jd,
            get_profile_summary_for_display,
        )
        from models.voice_ingest import (
            JobProfile, CompanyIntelligence, HardRequirements, CandidateTrait
        )
        from models.voice_ingest.enums import TraitPriority, LocationType, FundingStage

        profile = JobProfile(
            id="test-123",
            recruiter_first_name="Jane",
            recruiter_last_name="Doe",
            company=CompanyIntelligence(
                name="TechCorp",
                website="https://techcorp.com",
                tagline="Building the future",
                funding_stage=FundingStage.SERIES_B,
                team_size="50-100",  # String format
            ),
            requirements=HardRequirements(
                job_title="Senior Backend Engineer",
                location_type=LocationType.HYBRID,
                location_city="San Francisco",
                experience_min_years=5,
                salary_min=180000,
                visa_sponsorship=True,
            ),
            traits=[
                CandidateTrait(
                    id="t1",
                    name="Distributed Systems",
                    description="Experience with microservices",
                    priority=TraitPriority.MUST_HAVE,
                    signals=["Kafka", "gRPC"],
                ),
                CandidateTrait(
                    id="t2",
                    name="Team Leadership",
                    description="Led engineering teams",
                    priority=TraitPriority.NICE_TO_HAVE,
                ),
            ],
        )

        # Test convert_profile_to_scoring_context
        jd, criteria, red_flags, fields = convert_profile_to_scoring_context(profile)
        assert len(criteria) > 0
        assert "Distributed Systems" in criteria[0]
        results.add_result("Profile to scoring context conversion", True)

        # Test build_enhanced_jd
        enhanced_jd = build_enhanced_jd(profile)
        assert "Senior Backend Engineer" in enhanced_jd
        assert "TechCorp" in enhanced_jd
        results.add_result("Build enhanced JD", True)

        # Test get_profile_summary_for_display
        summary = get_profile_summary_for_display(profile)
        assert summary["job_title"] == "Senior Backend Engineer"
        assert summary["traits_count"] == 2
        assert summary["must_have_count"] == 1
        results.add_result("Profile summary for display", True)

    except Exception as e:
        results.add_result("Profile Converter", False, str(e))

    # Test Smart Questions Generator
    print_section("Testing Smart Questions Generator")
    try:
        from services.smart_questions import (
            generate_smart_questions,
            generate_gap_fill_questions,
        )
        from models.voice_ingest import CompanyIntelligence
        from models.voice_ingest.enums import FundingStage

        company = CompanyIntelligence(
            name="StartupXYZ",
            website="https://startupxyz.com",
            funding_stage=FundingStage.SEED,
            team_size="15-25",
        )

        questions = generate_smart_questions(
            company=company,
            missing_fields=["experience_min_years", "salary_min"],
        )
        assert len(questions) > 0
        results.add_result("Generate smart questions", True)

        gap_questions = generate_gap_fill_questions(
            missing_required=["location_type", "visa_sponsorship"],
            missing_optional=["equity_range"],
            company=company,
        )
        assert len(gap_questions) > 0
        results.add_result("Generate gap fill questions", True)

    except Exception as e:
        results.add_result("Smart Questions Generator", False, str(e))


# =============================================================================
# PHASE 4: Test Agent Components
# =============================================================================

def test_phase4_agent():
    """Test agent components (context, prompts, tools structure)."""
    print_header("PHASE 4: Agent Components")

    # Test Context Builder
    print_section("Testing Agent Context Builder")
    try:
        from agents.context import format_profile_for_prompt, format_company_for_prompt
        from models.voice_ingest import JobProfile, CompanyIntelligence, HardRequirements
        from models.voice_ingest.enums import LocationType

        profile = JobProfile(
            id="test-123",
            recruiter_first_name="Jane",
            recruiter_last_name="Doe",
            company=CompanyIntelligence(
                name="TestCorp",
                website="https://testcorp.com",
                tagline="Test company",
                team_size="40-60",
            ),
            requirements=HardRequirements(
                job_title="Engineer",
                location_type=LocationType.REMOTE,
                experience_min_years=3,
            ),
        )

        profile_prompt = format_profile_for_prompt(profile)
        assert "Engineer" in profile_prompt
        assert "Remote" in profile_prompt or "remote" in profile_prompt.lower()
        results.add_result("Format profile for prompt", True)

        company_prompt = format_company_for_prompt(profile)
        assert "TestCorp" in company_prompt
        results.add_result("Format company for prompt", True)

    except Exception as e:
        results.add_result("Agent Context Builder", False, str(e))

    # Test Prompts Builder
    print_section("Testing Agent Prompts Builder")
    try:
        from agents.prompts import build_system_prompt, build_opening_hook
        from models.voice_ingest import JobProfile, CompanyIntelligence, HardRequirements
        from models.voice_ingest.context import ConversationContext

        profile = JobProfile(
            id="test-123",
            recruiter_first_name="Jane",
            recruiter_last_name="Doe",
            company=CompanyIntelligence(name="TestCorp", website="https://test.com"),
            requirements=HardRequirements(),
        )

        context = ConversationContext(
            session_id="test-123",
            user_first_name="Jane",
            user_last_name="Doe",
            current_profile=profile,
            missing_fields=["job_title"],
            opening_hook="Hey Jane!",
        )

        system_prompt = build_system_prompt(context)
        assert "Jane" in system_prompt
        assert "recruiting" in system_prompt.lower() or "candidate" in system_prompt.lower()
        results.add_result("Build system prompt", True)

        # Test opening hook builder
        company = CompanyIntelligence(
            name="TechCorp",
            website="https://techcorp.com",
            tagline="Building the future",
        )
        hook = build_opening_hook("John", company)
        assert "John" in hook
        assert "TechCorp" in hook
        results.add_result("Build opening hook", True)

    except Exception as e:
        results.add_result("Agent Prompts Builder", False, str(e))

    # Test Tools Structure
    print_section("Testing Agent Tools Structure")
    try:
        from agents.tools import ALL_TOOLS

        assert len(ALL_TOOLS) > 0
        tool_names = [t.__name__ for t in ALL_TOOLS]
        assert "update_requirements" in tool_names
        assert "create_trait" in tool_names
        assert "create_interview_stage" in tool_names
        assert "capture_nuance" in tool_names
        assert "complete_onboarding" in tool_names
        results.add_result("Agent tools defined", True)
        results.add_result(f"Found {len(ALL_TOOLS)} tools", True)

    except Exception as e:
        results.add_result("Agent Tools Structure", False, str(e))


# =============================================================================
# PHASE 5: Test WebSocket Hub
# =============================================================================

def test_phase5_websocket():
    """Test WebSocket hub functionality."""
    print_header("PHASE 5: WebSocket Hub")

    print_section("Testing WebSocket Hub")
    try:
        from services.websocket_hub import WebSocketHub, ws_hub

        # Test hub instance
        assert ws_hub is not None
        results.add_result("WebSocket hub instance", True)

        # Test connection tracking structure
        hub = WebSocketHub()
        assert hasattr(hub, 'connections')
        assert hasattr(hub, 'connect')
        assert hasattr(hub, 'disconnect')
        assert hasattr(hub, 'send_update')
        assert hasattr(hub, 'broadcast_transcript')
        assert hasattr(hub, 'broadcast_completion')
        results.add_result("WebSocket hub methods", True)

    except Exception as e:
        results.add_result("WebSocket Hub", False, str(e))


# =============================================================================
# PHASE 6: Test API Endpoints (Structure)
# =============================================================================

def test_phase6_api():
    """Test API endpoint structure."""
    print_header("PHASE 6: API Endpoints")

    print_section("Testing Voice Ingest Router")
    try:
        from routers.voice_ingest import router

        # Check routes are defined
        routes = [route.path for route in router.routes]
        assert "/start" in routes or any("/start" in r for r in routes)
        results.add_result("Voice ingest router loaded", True)

        # Check expected endpoints exist
        route_paths = [str(r.path) for r in router.routes]
        has_start = any("start" in p for p in route_paths)
        has_profiles = any("profiles" in p for p in route_paths)
        has_websocket = any("ws" in p for p in route_paths)

        results.add_result("Has /start endpoint", has_start)
        results.add_result("Has /profiles endpoint", has_profiles)
        results.add_result("Has WebSocket endpoint", has_websocket)

    except Exception as e:
        results.add_result("Voice Ingest Router", False, str(e))

    print_section("Testing Pluto Router Integration")
    try:
        from routers.pluto import upload_csv
        import inspect

        # Check upload_csv accepts job_profile_id
        sig = inspect.signature(upload_csv)
        params = list(sig.parameters.keys())
        assert "job_profile_id" in params
        results.add_result("Pluto upload accepts job_profile_id", True)

    except Exception as e:
        results.add_result("Pluto Router Integration", False, str(e))


# =============================================================================
# Integration Test
# =============================================================================

def test_integration():
    """Full integration test."""
    print_header("INTEGRATION TEST")

    async def run_integration():
        from repositories.job_profile_local import LocalJobProfileRepository
        from models.voice_ingest import (
            JobProfile, CompanyIntelligence, HardRequirements,
            CandidateTrait, InterviewStage
        )
        from models.voice_ingest.enums import TraitPriority, LocationType, FundingStage
        from services.profile_converter import convert_profile_to_scoring_context

        # Use test directory
        test_dir = Path(__file__).parent / "integration_test_data"
        test_dir.mkdir(exist_ok=True)
        repo = LocalJobProfileRepository(data_dir=str(test_dir))

        print_section("Full Workflow Test")

        try:
            # 1. Create a complete job profile (simulating voice ingest)
            session_id = f"integration-{uuid.uuid4().hex[:8]}"

            profile = JobProfile(
                id=session_id,
                recruiter_first_name="Integration",
                recruiter_last_name="Test",
                company=CompanyIntelligence(
                    name="IntegrationCorp",
                    website="https://integration.test",
                    tagline="Testing end-to-end",
                    funding_stage=FundingStage.SERIES_A,
                    team_size="50-100",  # String format
                    headquarters="Test City",
                    tech_stack_hints=["Python", "TypeScript", "PostgreSQL"],
                ),
                requirements=HardRequirements(
                    job_title="Full Stack Engineer",
                    location_type=LocationType.HYBRID,
                    location_city="Test City",
                    onsite_days_per_week=2,
                    experience_min_years=4,
                    experience_max_years=8,
                    salary_min=140000,
                    salary_max=180000,
                    equity_offered=True,
                    visa_sponsorship=True,
                ),
            )

            # Create profile
            created = await repo.create(profile)
            assert created is not None
            results.add_result("1. Create profile", True)

            # 2. Add traits
            traits = [
                CandidateTrait(
                    id=str(uuid.uuid4()),
                    name="Full Stack Development",
                    description="Experience with both frontend and backend",
                    priority=TraitPriority.MUST_HAVE,
                    signals=["React", "Node.js", "Python"],
                ),
                CandidateTrait(
                    id=str(uuid.uuid4()),
                    name="API Design",
                    description="Strong REST/GraphQL experience",
                    priority=TraitPriority.NICE_TO_HAVE,
                ),
            ]
            for trait in traits:
                await repo.add_trait(session_id, trait)

            updated = await repo.get(session_id)
            assert len(updated.traits) == 2
            results.add_result("2. Add traits", True)

            # 3. Add interview stages
            stages = [
                InterviewStage(
                    id=str(uuid.uuid4()),
                    name="Phone Screen",
                    description="Initial culture fit",
                    order=1,
                    duration_minutes=30,
                ),
                InterviewStage(
                    id=str(uuid.uuid4()),
                    name="Technical Round",
                    description="Coding and system design",
                    order=2,
                    duration_minutes=90,
                ),
            ]
            for stage in stages:
                await repo.add_interview_stage(session_id, stage)

            updated = await repo.get(session_id)
            assert len(updated.interview_stages) == 2
            results.add_result("3. Add interview stages", True)

            # 4. Convert to scoring context (for candidate upload)
            jd, criteria, red_flags, fields = convert_profile_to_scoring_context(updated)
            assert "Full Stack Engineer" in jd
            assert len(criteria) >= 2
            results.add_result("4. Convert to scoring context", True)

            # 5. Verify completion percentage
            completion = updated.calculate_completion_percentage()
            assert completion > 50  # Should be mostly complete
            results.add_result(f"5. Completion: {completion:.0f}%", True)

            # 6. Mark complete
            await repo.mark_complete(session_id)
            final = await repo.get(session_id)
            assert final.is_complete
            results.add_result("6. Mark complete", True)

            # Cleanup
            await repo.delete(session_id)
            try:
                (test_dir / "job_profiles.json").unlink(missing_ok=True)
                test_dir.rmdir()
            except:
                pass

            results.add_result("Integration workflow complete", True)

        except Exception as e:
            results.add_result("Integration test", False, str(e))

    asyncio.run(run_integration())


# =============================================================================
# Main
# =============================================================================

def main():
    print(f"\n{Colors.BOLD}{Colors.CYAN}")
    print("="*60)
    print("   VOICE INGEST FEATURE - COMPREHENSIVE TEST SUITE")
    print("="*60)
    print(f"{Colors.RESET}")

    try:
        # Run all phase tests
        test_phase1_models()
        test_phase2_repository()
        test_phase3_services()
        test_phase4_agent()
        test_phase5_websocket()
        test_phase6_api()
        test_integration()

        # Print summary
        success = results.summary()

        # Exit code
        sys.exit(0 if success else 1)

    except Exception as e:
        print(f"\n{Colors.RED}FATAL ERROR: {e}{Colors.RESET}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
