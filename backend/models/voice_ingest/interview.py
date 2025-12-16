"""
Interview Stage model.
Stages in the interview process with descriptions and actions.
"""

from pydantic import BaseModel, Field, field_validator
from typing import Optional, List
import uuid


class InterviewStage(BaseModel):
    """
    A stage in the interview process.

    Each stage should describe:
    - What it evaluates (description)
    - Who conducts it (interviewer_role)
    - What the recruiter should do (actions)

    Example stages:
    - Phone Screen: Initial recruiter call to assess fit
    - Technical Interview: Deep dive with engineering team
    - System Design: Architecture discussion for senior roles
    - Culture Fit: Team/values alignment conversation
    - Final Round: CTO/CEO conversation
    """

    id: str = Field(
        default_factory=lambda: str(uuid.uuid4()),
        description="Unique identifier"
    )
    name: str = Field(
        ...,
        min_length=2,
        max_length=100,
        description="Stage name, e.g., 'Phone Screen', 'Technical Interview'"
    )
    description: str = Field(
        ...,
        min_length=5,
        max_length=500,
        description="What this stage evaluates"
    )
    order: int = Field(
        ...,
        ge=1,
        description="Stage order in the interview process (1-indexed)"
    )
    duration_minutes: Optional[int] = Field(
        None,
        ge=15,
        le=480,
        description="Expected duration in minutes"
    )
    interviewer_role: Optional[str] = Field(
        None,
        description="Who conducts this stage, e.g., 'Recruiter', 'Hiring Manager', 'Engineering Team'"
    )
    actions: List[str] = Field(
        default_factory=list,
        description="Recruiter instructions/actions for this stage"
    )

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v):
        """Ensure name is not just whitespace"""
        if not v.strip():
            raise ValueError("Stage name cannot be empty")
        return v.strip()

    @field_validator("actions")
    @classmethod
    def actions_not_empty_strings(cls, v):
        """Filter out empty action strings"""
        return [action.strip() for action in v if action.strip()]

    def format_for_display(self) -> str:
        """Format stage for display"""
        result = f"{self.order}. {self.name}"
        if self.duration_minutes:
            result += f" ({self.duration_minutes} min)"
        return result

    class Config:
        json_schema_extra = {
            "example": {
                "id": "stage-123",
                "name": "Technical Interview",
                "description": "Deep technical discussion with the engineering team covering system design, coding practices, and problem-solving approach.",
                "order": 2,
                "duration_minutes": 60,
                "interviewer_role": "Engineering Team",
                "actions": [
                    "Send calendar invite to engineering panel",
                    "Share system design prep materials",
                    "Notify candidate of interview format"
                ]
            }
        }


class InterviewProcess(BaseModel):
    """Collection of interview stages with utility methods"""

    stages: List[InterviewStage] = Field(default_factory=list)

    def get_ordered_stages(self) -> List[InterviewStage]:
        """Get stages sorted by order"""
        return sorted(self.stages, key=lambda s: s.order)

    def find_by_name(self, name: str) -> Optional[InterviewStage]:
        """Find a stage by name (case-insensitive)"""
        name_lower = name.lower()
        for stage in self.stages:
            if stage.name.lower() == name_lower:
                return stage
        return None

    def add_stage(self, stage: InterviewStage) -> None:
        """Add a stage, auto-assigning order if not set"""
        if stage.order == 0 or stage.order is None:
            stage.order = len(self.stages) + 1
        self.stages.append(stage)

    def remove_stage(self, name: str) -> bool:
        """Remove a stage by name and reorder remaining stages"""
        for i, stage in enumerate(self.stages):
            if stage.name.lower() == name.lower():
                self.stages.pop(i)
                # Reorder remaining stages
                for j, remaining in enumerate(self.get_ordered_stages()):
                    remaining.order = j + 1
                return True
        return False

    def reorder_stages(self, name_order: List[str]) -> None:
        """Reorder stages based on list of names"""
        name_to_stage = {s.name.lower(): s for s in self.stages}

        for i, name in enumerate(name_order):
            if name.lower() in name_to_stage:
                name_to_stage[name.lower()].order = i + 1

    def total_duration(self) -> Optional[int]:
        """Calculate total interview duration if all stages have durations"""
        durations = [s.duration_minutes for s in self.stages if s.duration_minutes]
        if len(durations) == len(self.stages):
            return sum(durations)
        return None

    def format_pipeline(self) -> str:
        """Format the interview pipeline for display"""
        ordered = self.get_ordered_stages()
        return " → ".join(s.name for s in ordered)


# Common interview stage templates
COMMON_STAGES = {
    "phone_screen": InterviewStage(
        name="Phone Screen",
        description="Initial recruiter call to assess basic fit, salary expectations, and timeline",
        order=1,
        duration_minutes=30,
        interviewer_role="Recruiter",
        actions=["Schedule 30-min call", "Send calendar invite", "Prepare initial questions"]
    ),
    "technical": InterviewStage(
        name="Technical Interview",
        description="Technical deep dive covering coding, system design, and problem-solving",
        order=2,
        duration_minutes=60,
        interviewer_role="Engineering Team",
        actions=["Send calendar invite to eng panel", "Share prep materials", "Set up coding environment"]
    ),
    "hiring_manager": InterviewStage(
        name="Hiring Manager",
        description="Discussion with hiring manager about role scope, team dynamics, and career growth",
        order=3,
        duration_minutes=45,
        interviewer_role="Hiring Manager",
        actions=["Schedule with hiring manager", "Share candidate summary"]
    ),
    "culture_fit": InterviewStage(
        name="Culture Fit",
        description="Team and values alignment conversation with cross-functional stakeholders",
        order=4,
        duration_minutes=45,
        interviewer_role="Cross-functional Team",
        actions=["Coordinate with team members", "Prepare culture questions"]
    ),
    "executive": InterviewStage(
        name="Executive Round",
        description="Final conversation with CTO/CEO to discuss vision and strategic fit",
        order=5,
        duration_minutes=30,
        interviewer_role="Executive",
        actions=["Coordinate executive calendar", "Prepare executive briefing"]
    ),
}
