"""
Vapi Service for Voice AI Calls.
Uses pre-configured assistant from Vapi console.
"""
import httpx
import logging
from typing import Dict, Any, Optional

from config import VAPI_API_KEY, VAPI_ASSISTANT_ID

logger = logging.getLogger(__name__)

VAPI_API_URL = "https://api.vapi.ai"


class VapiService:
    """Service for creating Vapi voice calls using pre-configured assistant."""

    def __init__(self):
        self.api_key = VAPI_API_KEY
        self.assistant_id = VAPI_ASSISTANT_ID
        self.timeout = 30.0

    def _get_headers(self) -> Dict[str, str]:
        """Get request headers for Vapi API."""
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

    async def create_web_call(
        self,
        session_id: str,
        user_name: str,
        system_prompt: Optional[str] = None,
        assistant_overrides: Optional[Dict[str, Any]] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Create a Vapi web call using the pre-configured assistant ID.

        Args:
            session_id: The session ID (voice ingest or interview)
            user_name: User's first name
            system_prompt: Optional system prompt to override the default
            assistant_overrides: Optional complete assistant overrides
            metadata: Optional metadata to pass to Vapi (for webhooks)

        Returns:
            Dict with assistant_id and full overrides for frontend to use
        """
        if not self.assistant_id:
            logger.error("VAPI_ASSISTANT_ID not configured")
            return {"error": "Vapi assistant ID not configured"}

        # Return the assistant ID for the frontend to use directly
        logger.info(f"Returning assistant ID for session {session_id}: {self.assistant_id}")
        
        response = {
            "assistantId": self.assistant_id,
            "sessionId": session_id,
            "userName": user_name,
        }
        
        if assistant_overrides:
            response["assistantOverrides"] = assistant_overrides
        
        # If specific system prompt provided but no full overrides, create minimal override
        if system_prompt and not assistant_overrides:
            response["assistantOverrides"] = {
                "model": {
                    "provider": "openrouter",
                    "model": "google/gemini-2.5-flash", # Default to configured model
                    "temperature": 0.7,
                    "systemPrompt": system_prompt
                }
            }
            
        # Inject metadata if provided
        if metadata:
            if "assistantOverrides" not in response:
                response["assistantOverrides"] = {}
            
            # Merge with existing metadata if present
            existing_metadata = response["assistantOverrides"].get("metadata", {})
            response["assistantOverrides"]["metadata"] = {**existing_metadata, **metadata}
            
        return response

    async def end_call(self, call_id: str) -> Dict[str, Any]:
        """End an active Vapi call."""
        if not self.api_key:
            return {"error": "Vapi API key not configured"}

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.patch(
                    f"{VAPI_API_URL}/call/{call_id}",
                    headers=self._get_headers(),
                    json={"status": "ended"}
                )
                response.raise_for_status()
                return response.json()

        except Exception as e:
            logger.error(f"Error ending Vapi call: {e}")
            return {"error": str(e)}

    async def get_call(self, call_id: str) -> Dict[str, Any]:
        """Get details of a Vapi call."""
        if not self.api_key:
            return {"error": "Vapi API key not configured"}

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(
                    f"{VAPI_API_URL}/call/{call_id}",
                    headers=self._get_headers(),
                )
                response.raise_for_status()
                return response.json()

        except Exception as e:
            logger.error(f"Error getting Vapi call: {e}")
            return {"error": str(e)}


# Global instance
vapi_service = VapiService()
