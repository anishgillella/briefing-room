"""
Email Service.

Handles generating personalized emails using LLM and sending them via Resend.
"""

import httpx
import logging
from typing import Optional, Dict, Any
from openai import AsyncOpenAI

from config import (
    RESEND_API_KEY, 
    RESEND_API_URL, 
    OPENROUTER_API_KEY, 
    LLM_MODEL
)

logger = logging.getLogger(__name__)

# Initialize OpenRouter client for email generation
client = AsyncOpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key=OPENROUTER_API_KEY,
)

from pydantic import BaseModel, Field

class EmailContent(BaseModel):
    subject: str = Field(description="Engaging and professional subject line")
    body: str = Field(description="The body of the email (plain text, no HTML)")

class EmailService:
    @staticmethod
    async def generate_strong_fit_email(
        candidate_name: str,
        job_title: str,
        fit_summary: str,
        green_flags: list[Dict[str, Any]]
    ) -> Dict[str, str]:
        """
        Generate a personalized email for a strong fit candidate.
        
        Returns:
            Dict with 'subject' and 'body' keys.
        """
        
        # Prepare context for the LLM
        green_flag_text = "\n".join([f"- {g['strength']}: {g['evidence']}" for g in green_flags[:3]])
        
        prompt = f"""
        You are a recruiter at "Hirely". Write a personalized email to a candidate who has just applied and is a "Strong Fit".
        
        Candidate Name: {candidate_name}
        Job Title: {job_title}
        
        Why we liked them (Success Signals):
        {green_flag_text}
        
        Fit Summary:
        {fit_summary}
        
        INSTRUCTIONS:
        1. Subject line: Engaging and relevant to the role.
        2. Tone: Professional, enthusiastic, and urgent.
        3. Key Message: They have been qualified to the next round.
        4. Call to Action: They need to finish the interview in the next 7 days as quickly as possible.
        5. Sender Name: The Hirely Team
        """
        
        try:
            completion = await client.beta.chat.completions.parse(
                model=LLM_MODEL,
                messages=[
                    {"role": "system", "content": "You are an expert recruiter assistant. Generate a structured email."},
                    {"role": "user", "content": prompt}
                ],
                response_format=EmailContent,
                temperature=0.7,
            )
            
            result = completion.choices[0].message.parsed
            return result.model_dump()
            
        except Exception as e:
            logger.error(f"Error generating candidate email: {e}")
            # Fallback
            return {
                "body": f"Hi {candidate_name},\n\nWe were impressed with your application for the {job_title} role. We'd like to invite you to the next round. Please complete your interview within the next 7 days.\n\nBest,\nThe Hirely Team"
            }

    @staticmethod
    async def send_application_received_email(
        candidate_name: str,
        job_title: str,
        to_email: str
    ) -> bool:
        """
        Send a generic 'Application Received' confirmation.
        """
        subject = f"Application Received: {job_title}"
        body = f"""Hi {candidate_name},

Thanks for applying to the {job_title} position.

We've received your application and will review it shortly. If your profile is a good match, we'll be in touch with next steps.

Best,
The Hirely Team"""
        
        return await EmailService.send_email(to_email, subject, body)

    @staticmethod
    async def send_email(to_email: str, subject: str, body: str) -> bool:
        """
        Send an email using Resend API.
        """
        if not RESEND_API_KEY:
            logger.warning("RESEND_API_KEY not configured. Email not sent.")
            return False
            
        payload = {
            # Use Resend's testing domain by default to avoid verification errors
            "from": "Career Team <onboarding@resend.dev>",
            "to": [to_email],
            "subject": subject,
            "text": body,
        }
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    RESEND_API_URL,
                    headers={
                        "Authorization": f"Bearer {RESEND_API_KEY}",
                        "Content-Type": "application/json"
                    },
                    json=payload,
                    timeout=10.0
                )
                
                if response.status_code >= 400:
                    logger.error(f"Failed to send email via Resend: {response.text}")
                    return False
                    
                logger.info(f"Email sent successfully to {to_email}")
                return True
                
        except Exception as e:
            logger.error(f"Exception sending email: {e}")
            return False
