"""
Vapi Interview Assistant Creator.

Creates and manages a dedicated Vapi assistant for candidate interviews.
This assistant is separate from the job profile builder and configured specifically
for conducting screening interviews.
"""

import httpx
import logging
import os
from typing import Optional, Dict, Any

from config import VAPI_API_KEY

logger = logging.getLogger(__name__)

VAPI_API_URL = "https://api.vapi.ai"

# Cache the interview assistant ID after creation
_interview_assistant_id: Optional[str] = None


async def get_or_create_interview_assistant(
    server_url: Optional[str] = None
) -> Optional[str]:
    """
    Get or create the dedicated interview assistant.
    
    This creates a new assistant if one doesn't exist, configured specifically
    for conducting candidate screening interviews.
    
    Args:
        server_url: The webhook URL for call events (ngrok or production URL)
        
    Returns:
        The assistant ID, or None if creation failed.
    """
    global _interview_assistant_id
    
    # Return cached ID if available
    if _interview_assistant_id:
        logger.info(f"Using cached interview assistant: {_interview_assistant_id}")
        return _interview_assistant_id
    
    # Check if already stored in env/config
    # Default to the newly created screening assistant if no env var set
    existing_id = os.environ.get("VAPI_INTERVIEW_ASSISTANT_ID", "639a5d5e-2d09-4b79-9ee5-b11613170b10")
    if existing_id:
        _interview_assistant_id = existing_id
        logger.info(f"Using interview assistant: {existing_id}")
        return existing_id
    
    # Create a new interview assistant
    logger.info("Creating new Vapi interview assistant...")
    
    assistant_config = {
        "name": "Hirely Interview Assistant - Alex",
        "firstMessage": "Hi! I'm Alex, and I'll be conducting your interview today. It's great to meet you! Before we dive in, could you give me a brief introduction about yourself?",
        "model": {
            "provider": "openrouter",
            "model": os.environ.get("LLM_MODEL", "google/gemini-2.5-flash"),
            "temperature": 0.7,
            "systemPrompt": get_default_interview_prompt()
        },
        "voice": {
            "provider": "11labs",
            "voiceId": "21m00Tcm4TlvDq8ikWAM",  # Rachel - professional female voice
        },
        "transcriber": {
            "provider": "deepgram",
            "model": "nova-2",
            "language": "en"
        },
        # Enable end-of-call analysis
        "analysisPlan": {
            "summaryPrompt": "Summarize this interview in 2-3 paragraphs, highlighting the candidate's key strengths, areas of concern, and overall communication quality.",
            "structuredDataPrompt": "Extract: candidate_name, key_skills (list), experience_level, communication_score (1-10), overall_impression"
        }
    }
    
    # Add server URL for webhooks if provided
    if server_url:
        assistant_config["serverUrl"] = server_url
        logger.info(f"Setting webhook server URL: {server_url}")
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{VAPI_API_URL}/assistant",
                headers={
                    "Authorization": f"Bearer {VAPI_API_KEY}",
                    "Content-Type": "application/json"
                },
                json=assistant_config,
                timeout=30.0
            )
            
            if response.status_code == 201:
                data = response.json()
                assistant_id = data.get("id")
                _interview_assistant_id = assistant_id
                logger.info(f"Created interview assistant: {assistant_id}")
                
                # Log the ID so user can add it to .env for persistence
                print(f"\n{'='*60}")
                print(f"✅ Created new Vapi Interview Assistant!")
                print(f"   ID: {assistant_id}")
                print(f"   Add to .env: VAPI_INTERVIEW_ASSISTANT_ID={assistant_id}")
                print(f"{'='*60}\n")
                
                return assistant_id
            else:
                logger.error(f"Failed to create assistant: {response.status_code} - {response.text}")
                return None
                
    except Exception as e:
        logger.error(f"Error creating interview assistant: {e}")
        return None


def get_default_interview_prompt() -> str:
    """
    Returns a generic interview prompt that works without dynamic context.
    For dynamic prompts per-interview, use generate_interviewer_prompt from interviewer_persona.py.
    """
    return """
You are Alex, a professional AI interviewer at Hirely. 
You are conducting a "First Round Tech/Behavioral Screen" with a candidate.

## INTERVIEW GOAL
Your goal is to assess if the candidate is a good potential fit for the role in a 15-minute conversation.
Focus on identifying their strengths, verifying their experience, and assessing communication skills.

## INSTRUCTIONS
1. **Persona**: You are professional, friendly, and structured. You are NOT a generic assistant. You are an INTERVIEWER.
2. **Opening**: Start by welcoming them, introducing yourself as Alex, and asking them to briefly introduce themselves.
3. **Questioning Strategy**:
   - Ask ONE question at a time.
   - Listen to their answer. If it's vague, ask a polite follow-up ("Could you give me a specific example of that?").
   - Move to the next topic once satisfied.
   - Cover 3-4 key areas: 
     a) Resume/Experience walkthrough
     b) Technical/Role-specific skills
     c) Behavioral (e.g., "Tell me about a challenge...")
     d) Motivation ("Why are you interested in this role?")
4. **Time Management**: Keep the interview to roughly 15 minutes. If it proceeds too long, gently wrap up.
5. **Closing**: Thank them for their time and let them know the team will be in touch.

## RULES
- Do NOT provide feedback on their answers during the interview.
- Do NOT say "I am an AI". Act as a member of the hiring team.
- Keep your responses concise (1-3 sentences). Do not monologue. 
- If the candidate asks about salary, say "That will be discussed with the recruiter in the next stage."

Start the conversation now by greeting the candidate.
"""


async def update_assistant_server_url(assistant_id: str, server_url: str) -> bool:
    """
    Update an existing assistant's server URL for webhooks.
    
    Useful when ngrok URL changes.
    """
    try:
        async with httpx.AsyncClient() as client:
            response = await client.patch(
                f"{VAPI_API_URL}/assistant/{assistant_id}",
                headers={
                    "Authorization": f"Bearer {VAPI_API_KEY}",
                    "Content-Type": "application/json"
                },
                json={"serverUrl": server_url},
                timeout=30.0
            )
            
            if response.status_code == 200:
                logger.info(f"Updated assistant {assistant_id} server URL to: {server_url}")
                return True
            else:
                logger.error(f"Failed to update assistant: {response.status_code} - {response.text}")
                return False
                
    except Exception as e:
        logger.error(f"Error updating assistant: {e}")
        return False


async def update_interview_assistant_prompt(
    assistant_id: str, 
    system_prompt: str,
    first_message: Optional[str] = None
) -> bool:
    """
    Update the assistant's system prompt before an interview.
    
    This injects the candidate-specific resume and job description context
    into the assistant so it can verify resume claims and probe JD gaps.
    
    Args:
        assistant_id: The Vapi assistant ID to update
        system_prompt: The full system prompt with resume/JD injected
        first_message: Optional custom first message
        
    Returns:
        True if update succeeded, False otherwise.
    """
    try:
        update_payload = {
            "model": {
                "provider": "openai",  # Use OpenAI for Vapi Web SDK compatibility
                "model": "gpt-4o-mini",
                "temperature": 0.7,
                "systemPrompt": system_prompt
            }
        }
        
        if first_message:
            update_payload["firstMessage"] = first_message
            
        async with httpx.AsyncClient() as client:
            response = await client.patch(
                f"{VAPI_API_URL}/assistant/{assistant_id}",
                headers={
                    "Authorization": f"Bearer {VAPI_API_KEY}",
                    "Content-Type": "application/json"
                },
                json=update_payload,
                timeout=30.0
            )
            
            if response.status_code == 200:
                logger.info(f"Updated assistant {assistant_id} with dynamic prompt ({len(system_prompt)} chars)")
                return True
            else:
                logger.error(f"Failed to update assistant prompt: {response.status_code} - {response.text}")
                return False
                
    except Exception as e:
        logger.error(f"Error updating assistant prompt: {e}")
        return False
