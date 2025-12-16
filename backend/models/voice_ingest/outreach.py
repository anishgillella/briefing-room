"""
Outreach Configuration model.
Email outreach preferences and generated templates.
"""

from pydantic import BaseModel, Field
from typing import Optional, List

from .enums import OutreachTone


class OutreachConfig(BaseModel):
    """
    Configuration for candidate outreach emails.

    This captures preferences for tone, messaging, and contains
    the generated email template that can be edited.
    """

    # Preferences
    tone: Optional[OutreachTone] = Field(
        None,
        description="Desired email tone: formal, casual, direct, enthusiastic"
    )
    key_hook: Optional[str] = Field(
        None,
        max_length=200,
        description="What makes this role compelling - the main hook"
    )
    selling_points: List[str] = Field(
        default_factory=list,
        description="Key selling points to include in outreach"
    )
    avoid_phrases: List[str] = Field(
        default_factory=list,
        description="Phrases or approaches to avoid"
    )

    # Generated content
    subject_line: Optional[str] = Field(
        None,
        max_length=100,
        description="Email subject line"
    )
    email_body: Optional[str] = Field(
        None,
        max_length=2000,
        description="Email body template with variables like {{first_name}}"
    )

    # Status
    is_signed_off: bool = Field(
        False,
        description="Whether the email template has been approved"
    )

    def get_available_variables(self) -> List[str]:
        """Get list of available template variables"""
        return [
            "{{first_name}}",
            "{{last_name}}",
            "{{current_company}}",
            "{{current_title}}",
            "{{sender_name}}",
            "{{sender_title}}",
            "{{company}}",
            "{{role_title}}",
        ]

    def validate_template(self) -> List[str]:
        """Check for potential issues in the email template"""
        issues = []

        if not self.subject_line:
            issues.append("Missing subject line")

        if not self.email_body:
            issues.append("Missing email body")
            return issues

        # Check for personalization
        if "{{first_name}}" not in self.email_body and "{{last_name}}" not in self.email_body:
            issues.append("Consider adding personalization ({{first_name}} or {{last_name}})")

        # Check length
        if len(self.email_body) > 1500:
            issues.append("Email may be too long - consider shortening")

        if len(self.email_body) < 200:
            issues.append("Email may be too short - consider adding more detail")

        # Check for call to action
        cta_indicators = ["chat", "call", "talk", "meet", "connect", "interested"]
        has_cta = any(indicator in self.email_body.lower() for indicator in cta_indicators)
        if not has_cta:
            issues.append("Missing clear call to action")

        return issues

    class Config:
        json_schema_extra = {
            "example": {
                "tone": "casual",
                "key_hook": "Building the future of observability with an amazing team",
                "selling_points": [
                    "Series B funded, strong runway",
                    "Technical founders who code",
                    "Interesting distributed systems problems"
                ],
                "avoid_phrases": [
                    "rockstar",
                    "ninja",
                    "fast-paced environment"
                ],
                "subject_line": "Engineering opportunity at Acme",
                "email_body": """Hi {{first_name}},

I came across your profile and was impressed by your work at {{current_company}}. We're building the future of observability at Acme, and I think you could be a great fit for our Senior Backend role.

A few things that make this opportunity exciting:
- Series B funded with strong runway
- Technical founders who still code
- Interesting distributed systems challenges at scale

Would you be open to a quick chat to learn more?

Best,
{{sender_name}}""",
                "is_signed_off": False
            }
        }


# Default email templates by tone
DEFAULT_TEMPLATES = {
    OutreachTone.FORMAL: """Dear {{first_name}},

I hope this message finds you well. I am reaching out regarding a {{role_title}} opportunity at {{company}} that aligns well with your background.

Based on your experience at {{current_company}}, I believe you would be an excellent candidate for this position.

{selling_points}

I would welcome the opportunity to discuss this role with you at your convenience.

Best regards,
{{sender_name}}
{{sender_title}}""",

    OutreachTone.CASUAL: """Hey {{first_name}},

Saw your profile and had to reach out - your work at {{current_company}} caught my eye.

We're hiring a {{role_title}} at {{company}}, and I think you'd be a great fit.

{selling_points}

Would love to chat if you're open to it. No pressure either way!

{{sender_name}}""",

    OutreachTone.DIRECT: """{{first_name}},

{{role_title}} role at {{company}}. Thought of you.

{selling_points}

Interested in a quick call?

{{sender_name}}""",

    OutreachTone.ENTHUSIASTIC: """Hi {{first_name}}!

I'm SO excited to reach out - I just came across your background and immediately thought of our {{role_title}} role at {{company}}!

{selling_points}

I'd absolutely love to tell you more about what we're building. Would you be open to a quick chat?

Looking forward to connecting!
{{sender_name}}""",
}
