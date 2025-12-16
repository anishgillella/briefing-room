"""
Conversation Context model.
Context passed to the voice agent for informed conversation.
"""

from pydantic import BaseModel, Field
from typing import Optional, List, Dict

from .company import CompanyIntelligence
from .profile import JobProfile


class SmartQuestion(BaseModel):
    """
    A contextual question for the agent to ask.

    Smart questions are generated based on company context and
    missing fields, making the conversation more natural and relevant.
    """

    field: str = Field(
        ...,
        description="The field this question helps fill"
    )
    question: str = Field(
        ...,
        description="The question to ask"
    )
    why: str = Field(
        ...,
        description="Why this question matters - context for the agent"
    )
    asked: bool = Field(
        False,
        description="Whether this question has been asked"
    )
    priority: int = Field(
        1,
        ge=1,
        le=3,
        description="Priority level: 1=high, 2=medium, 3=low"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "field": "compensation",
                "question": "For a Series B company in this space, what's the compensation range? And is there equity on top?",
                "why": "Stage-appropriate framing makes the question more natural",
                "asked": False,
                "priority": 1
            }
        }


class ConversationContext(BaseModel):
    """
    Complete context passed to the voice agent.

    This includes everything the agent needs to have an informed,
    natural conversation: company research, extracted data so far,
    gaps to fill, and smart questions to ask.
    """

    # Session
    session_id: str = Field(..., description="Unique session identifier")

    # User info
    user_first_name: str = Field(..., description="User's first name for personalization")
    user_last_name: str = Field(..., description="User's last name")

    # Company intelligence (from Parallel.ai)
    company_intel: Optional[CompanyIntelligence] = Field(
        None,
        description="Company research from Parallel.ai"
    )

    # Current profile state
    current_profile: JobProfile = Field(
        ...,
        description="Current job profile with all extracted data"
    )

    # Gap analysis
    confirmed_fields: List[str] = Field(
        default_factory=list,
        description="Fields that have been confirmed"
    )
    inferred_fields: Dict[str, str] = Field(
        default_factory=dict,
        description="Fields that were inferred, mapped to reason"
    )
    missing_fields: List[str] = Field(
        default_factory=list,
        description="Required fields still missing"
    )

    # Agent guidance
    opening_hook: str = Field(
        "",
        description="Personalized opening line for the agent"
    )
    smart_questions: List[SmartQuestion] = Field(
        default_factory=list,
        description="Contextual questions to weave into conversation"
    )

    # Conversation state
    current_topic: Optional[str] = Field(
        None,
        description="Current topic being discussed"
    )
    topics_covered: List[str] = Field(
        default_factory=list,
        description="Topics that have been covered"
    )

    def get_unanswered_questions(self) -> List[SmartQuestion]:
        """Get questions that haven't been asked yet"""
        return [q for q in self.smart_questions if not q.asked]

    def get_high_priority_questions(self) -> List[SmartQuestion]:
        """Get high-priority unanswered questions"""
        return [q for q in self.get_unanswered_questions() if q.priority == 1]

    def mark_question_asked(self, field: str) -> None:
        """Mark a question as asked"""
        for q in self.smart_questions:
            if q.field == field:
                q.asked = True
                break

    def mark_field_confirmed(self, field: str) -> None:
        """Mark a field as confirmed"""
        if field not in self.confirmed_fields:
            self.confirmed_fields.append(field)
        if field in self.missing_fields:
            self.missing_fields.remove(field)
        if field in self.inferred_fields:
            del self.inferred_fields[field]

    def add_topic_covered(self, topic: str) -> None:
        """Add a topic to the covered list"""
        if topic not in self.topics_covered:
            self.topics_covered.append(topic)

    def get_completion_summary(self) -> str:
        """Get a summary of completion status"""
        total_required = 8  # Based on JobProfile requirements
        completed = len(self.confirmed_fields)
        percentage = round((completed / total_required) * 100)

        if self.missing_fields:
            return f"{percentage}% complete. Still need: {', '.join(self.missing_fields)}"
        return f"100% complete - all required fields filled"

    def format_for_system_prompt(self) -> str:
        """Format context for inclusion in agent system prompt"""
        sections = []

        # Company intel
        if self.company_intel:
            ci = self.company_intel
            company_section = f"""
## COMPANY INTELLIGENCE (from web research)

Company: {ci.name}
{f'"{ci.tagline}"' if ci.tagline else ""}

Stage: {ci.funding_stage.value.replace("_", " ").title() if ci.funding_stage else "Unknown"}
{f"Total raised: {ci.total_raised}" if ci.total_raised else ""}
{f"Investors: {', '.join(ci.investors)}" if ci.investors else ""}

Product: {ci.product_description or "Unknown"}
Team: {ci.team_size or "Unknown"} people, HQ: {ci.headquarters or "Unknown"}

{f"Tech stack hints: {', '.join(ci.tech_stack_hints)}" if ci.tech_stack_hints else ""}
{f"Competitors: {', '.join(ci.competitors)}" if ci.competitors else ""}
{f"Culture: {', '.join(ci.culture_keywords)}" if ci.culture_keywords else ""}

Interesting facts: {'; '.join(ci.interesting_facts) if ci.interesting_facts else "None found"}
"""
            sections.append(company_section)

        # Current profile
        if self.current_profile:
            p = self.current_profile
            req = p.requirements

            profile_section = f"""
## WHAT WE KNOW SO FAR

Job Title: {req.job_title or "Not set"}
Location: {req.format_location() if req.location_type else "Not set"}
Experience: {req.format_experience() if req.experience_min_years is not None else "Not set"}
Compensation: {req.format_compensation() if req.salary_min else "Not set"}
Visa: {"Yes" if req.visa_sponsorship else ("No" if req.visa_sponsorship is False else "Not set")}

Traits ({len(p.traits)}):
{chr(10).join(f"- {t.name}: {t.description}" for t in p.traits) if p.traits else "- None defined yet"}

Interview Stages ({len(p.interview_stages)}):
{chr(10).join(f"- {s.order}. {s.name}" for s in p.get_ordered_interview_stages()) if p.interview_stages else "- None defined yet"}
"""
            sections.append(profile_section)

        # Missing fields
        if self.missing_fields:
            missing_section = f"""
## WHAT WE STILL NEED

Required fields missing: {", ".join(self.missing_fields)}

These are the gaps you need to fill through conversation.
"""
            sections.append(missing_section)

        # Smart questions
        unanswered = self.get_unanswered_questions()
        if unanswered:
            questions_section = """
## SMART QUESTIONS TO WEAVE IN

"""
            for q in unanswered[:5]:  # Limit to top 5
                questions_section += f"- {q.question}\n  (Why: {q.why})\n\n"
            sections.append(questions_section)

        return "\n".join(sections)

    class Config:
        json_schema_extra = {
            "example": {
                "session_id": "session-123",
                "user_first_name": "Sarah",
                "user_last_name": "Chen",
                "company_intel": {
                    "name": "Acme Inc",
                    "website": "https://acme.dev",
                    "funding_stage": "series_b"
                },
                "current_profile": {
                    "id": "profile-123",
                    "recruiter_first_name": "Sarah",
                    "recruiter_last_name": "Chen"
                },
                "confirmed_fields": ["job_title", "location"],
                "missing_fields": ["compensation", "visa", "traits"],
                "opening_hook": "Hey Sarah! I see you're at Acme - the observability platform. Tell me about this role.",
                "smart_questions": [
                    {
                        "field": "compensation",
                        "question": "What's the comp range for this role?",
                        "why": "Required field",
                        "asked": False,
                        "priority": 1
                    }
                ]
            }
        }


def build_opening_hook(
    user_name: str,
    company_intel: Optional[CompanyIntelligence]
) -> str:
    """
    Generate a personalized opening hook that:
    1. Demonstrates impressive company knowledge (wow factor)
    2. Asks whether to work on entire JD or specific sections

    This creates an immediate "how did they know that?" reaction.
    """

    if not company_intel or not company_intel.name:
        return (
            f"Hey {user_name}! I'm ready to help you build out this job profile. "
            f"Would you like me to work through the entire job description with you, "
            f"or are there specific sections you want to focus on - like requirements, "
            f"compensation, or the interview process?"
        )

    ci = company_intel

    # Build an impressive company insight - prioritize the most "wow" worthy details
    wow_details = []

    # Recent news is most impressive (shows we're current)
    if ci.recent_news and len(ci.recent_news) > 0:
        wow_details.append(f"I noticed {ci.name} has been in the news recently - {ci.recent_news[0]}")

    # Funding/investors shows depth of research
    if ci.total_raised and ci.investors:
        top_investors = ", ".join(ci.investors[:2])
        wow_details.append(f"I see you've raised {ci.total_raised} with backing from {top_investors}")
    elif ci.total_raised:
        wow_details.append(f"I see you've raised {ci.total_raised}")
    elif ci.funding_stage:
        stage = ci.funding_stage.value.replace("_", " ").title()
        wow_details.append(f"I see {ci.name} is at the {stage} stage")

    # Interesting facts are conversation gold
    if ci.interesting_facts and len(ci.interesting_facts) > 0:
        # Pick the most specific/surprising fact
        fact = ci.interesting_facts[0]
        if len(fact) < 100:  # Keep it concise for speech
            wow_details.append(fact)

    # Product/problem shows we understand the business
    if ci.problem_solved:
        wow_details.append(f"You're solving {ci.problem_solved}")
    elif ci.product_description:
        wow_details.append(f"You're building {ci.product_description}")

    # Tech stack shows technical depth
    if ci.tech_stack_hints and len(ci.tech_stack_hints) >= 2:
        tech = ", ".join(ci.tech_stack_hints[:3])
        wow_details.append(f"I see you're working with {tech}")

    # Build the hook - pick best 1-2 details
    if wow_details:
        # Use the most impressive detail(s)
        if len(wow_details) >= 2:
            wow_sentence = f"{wow_details[0]}. {wow_details[1]}."
        else:
            wow_sentence = f"{wow_details[0]}."

        # Add tagline if we have one and it's short
        if ci.tagline and len(ci.tagline) < 60:
            company_intro = f"{ci.name} - {ci.tagline}"
        else:
            company_intro = ci.name

        return (
            f"Hey {user_name}! I did some research on {company_intro}. "
            f"{wow_sentence} Pretty exciting stuff! "
            f"Now, for this role - would you like to walk through the entire job description together, "
            f"or focus on specific areas like must-have skills, compensation, or the interview stages?"
        )

    # Fallback with company name
    if ci.tagline:
        return (
            f"Hey {user_name}! I've been reading up on {ci.name} - {ci.tagline}. "
            f"Ready to build out this role. Should we go through the full job description, "
            f"or would you rather focus on specific sections?"
        )

    return (
        f"Hey {user_name}! I've pulled some context on {ci.name}. "
        f"Let's build out this hiring profile. Would you like to work through the entire JD, "
        f"or dive into specific areas first?"
    )
