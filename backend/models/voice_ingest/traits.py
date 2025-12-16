"""
Candidate Trait model.
Skills, competencies, and characteristics to evaluate in candidates.
"""

from pydantic import BaseModel, Field, field_validator
from typing import Optional, List
import uuid

from .enums import TraitPriority


class CandidateTrait(BaseModel):
    """
    A skill, competency, or characteristic to evaluate in candidates.

    IMPORTANT: Traits should be CONCEPTUAL, not individual technologies.

    GOOD examples:
    - "Frontend Architecture" with signals: ["React", "Vue", "TypeScript"]
    - "Distributed Systems" with signals: ["Kafka", "Redis", "gRPC"]
    - "Technical Leadership" with signals: ["mentoring", "code reviews", "architecture decisions"]

    BAD examples:
    - "React" as a separate trait
    - "Python" as a separate trait
    - "TypeScript" as a separate trait

    Group related technologies and skills into conceptual categories.
    """

    id: str = Field(
        default_factory=lambda: str(uuid.uuid4()),
        description="Unique identifier"
    )
    name: str = Field(
        ...,
        min_length=2,
        max_length=100,
        description="Conceptual trait name, e.g., 'Distributed Systems', 'Frontend Architecture'"
    )
    description: str = Field(
        ...,
        min_length=10,
        max_length=500,
        description="1-2 sentence description explaining what this trait means for the role"
    )
    priority: TraitPriority = Field(
        TraitPriority.MUST_HAVE,
        description="Whether this trait is required or nice-to-have"
    )
    signals: List[str] = Field(
        default_factory=list,
        description="What to look for in candidates - specific skills, experiences, or behaviors"
    )
    anti_signals: List[str] = Field(
        default_factory=list,
        description="Red flags or negative indicators for this trait"
    )

    @field_validator("name")
    @classmethod
    def name_not_single_tech(cls, v):
        """
        Warn if the trait name looks like a single technology.
        We want conceptual groupings, not individual techs.
        """
        single_tech_keywords = [
            "react", "vue", "angular", "python", "java", "javascript",
            "typescript", "go", "rust", "ruby", "php", "swift", "kotlin",
            "aws", "gcp", "azure", "docker", "kubernetes", "redis",
            "postgres", "mysql", "mongodb", "kafka", "rabbitmq"
        ]

        if v.lower() in single_tech_keywords:
            # We allow it but it's not ideal - could add a warning here
            pass

        return v

    @field_validator("description")
    @classmethod
    def description_not_empty(cls, v):
        """Ensure description is meaningful"""
        if len(v.strip()) < 10:
            raise ValueError("Description must be at least 10 characters and meaningful")
        return v

    def is_must_have(self) -> bool:
        """Check if this is a must-have trait"""
        return self.priority == TraitPriority.MUST_HAVE

    def has_overlap_with(self, other: "CandidateTrait") -> bool:
        """
        Check if this trait might overlap with another.
        Used for semantic deduplication.
        """
        # Simple overlap check based on signals
        if not self.signals or not other.signals:
            return False

        self_signals = set(s.lower() for s in self.signals)
        other_signals = set(s.lower() for s in other.signals)

        overlap = self_signals & other_signals
        return len(overlap) >= 2  # Significant overlap if 2+ shared signals

    class Config:
        json_schema_extra = {
            "example": {
                "id": "trait-123",
                "name": "Distributed Systems",
                "description": "Experience designing and building scalable distributed systems that handle high throughput and maintain reliability.",
                "priority": "must_have",
                "signals": [
                    "Kafka or similar message queues",
                    "Microservices architecture",
                    "Database sharding experience",
                    "Handled millions of requests"
                ],
                "anti_signals": [
                    "Only worked on monoliths",
                    "No production scale experience"
                ]
            }
        }


class TraitCollection(BaseModel):
    """Collection of traits with utility methods"""

    traits: List[CandidateTrait] = Field(default_factory=list)

    def get_must_haves(self) -> List[CandidateTrait]:
        """Get all must-have traits"""
        return [t for t in self.traits if t.is_must_have()]

    def get_nice_to_haves(self) -> List[CandidateTrait]:
        """Get all nice-to-have traits"""
        return [t for t in self.traits if not t.is_must_have()]

    def find_by_name(self, name: str) -> Optional[CandidateTrait]:
        """Find a trait by name (case-insensitive)"""
        name_lower = name.lower()
        for trait in self.traits:
            if trait.name.lower() == name_lower:
                return trait
        return None

    def check_overlaps(self) -> List[tuple]:
        """Find potentially overlapping traits"""
        overlaps = []
        for i, t1 in enumerate(self.traits):
            for t2 in self.traits[i + 1:]:
                if t1.has_overlap_with(t2):
                    overlaps.append((t1.name, t2.name))
        return overlaps

    def add_trait(self, trait: CandidateTrait) -> None:
        """Add a trait to the collection"""
        self.traits.append(trait)

    def remove_trait(self, name: str) -> bool:
        """Remove a trait by name, returns True if found and removed"""
        for i, trait in enumerate(self.traits):
            if trait.name.lower() == name.lower():
                self.traits.pop(i)
                return True
        return False
