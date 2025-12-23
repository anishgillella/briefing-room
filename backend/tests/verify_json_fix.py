import json
import asyncio
from pydantic import BaseModel, Field
from typing import Literal, Optional

# Mock the CopilotInsight class as it is defined in interview_agent.py
class CopilotInsight(BaseModel):
    verdict: Literal["STRONG", "ADEQUATE", "WEAK", "NEEDS_PROBING"] = Field(description="Is the answer satisfactory?")
    question_type: Optional[str] = Field(default="general", description="Type of question being asked")
    issue_type: Literal[
        "none",
        "resume_contradiction",
        "prior_interview_contradiction",
        "missing_star",
        "rambling",
        "vague",
        "off_topic"
    ] = Field(description="The specific type of issue found, if any.")
    reasoning: str = Field(description="Brief explanation of the verdict and any issues.")
    suggestion: str = Field(description="The probing question or next topic question.")
    probe_recommendation: Literal["stay_on_topic", "probe_deeper", "change_topic"] = Field(default="stay_on_topic")
    topic_to_explore: Optional[str] = Field(default=None)
    prior_round: Optional[str] = Field(default=None, description="Prior interview stage if contradiction found")
    prior_quote: Optional[str] = Field(default=None, description="Verbatim prior quote if contradiction found")
    current_quote: Optional[str] = Field(default=None, description="Verbatim current quote if contradiction found")

def clean_json_text(text: str) -> str:
    """Clean markdown formatting from JSON string."""
    text = text.strip()
    # Remove markdown code blocks
    if text.startswith("```"):
        lines = text.split("\n")
        # Remove first line (```json or ```)
        lines = lines[1:]
        # Remove last line if it is ```
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        text = "\n".join(lines)
    return text.strip()

# Test cases
test_cases = [
    # 1. Clean JSON
    """{
        "verdict": "ADEQUATE",
        "issue_type": "none",
        "reasoning": "Good answer",
        "suggestion": "Ask about details",
        "probe_recommendation": "stay_on_topic"
    }""",
    
    # 2. Markdown wrapped JSON
    """```json
    {
        "verdict": "STRONG",
        "issue_type": "missing_star",
        "reasoning": "Great story but missing result",
        "suggestion": "What was the outcome?",
        "probe_recommendation": "probe_deeper"
    }
    ```""",
    
    # 3. Markdown without language
    """```
    {
        "verdict": "WEAK",
        "issue_type": "vague",
        "reasoning": "Too vague",
        "suggestion": "Can you be specific?",
        "probe_recommendation": "probe_deeper"
    }
    ```"""
]

async def verify():
    print("Verifying JSON parsing logic...")
    
    for i, raw_text in enumerate(test_cases):
        print(f"\nTest Case {i+1}:")
        try:
            cleaned = clean_json_text(raw_text)
            print("cleaned:", cleaned)
            insight = CopilotInsight.model_validate_json(cleaned)
            print(f"✅ Success! Parsed: {insight.verdict}")
        except Exception as e:
            print(f"❌ Failed: {e}")

if __name__ == "__main__":
    asyncio.run(verify())
