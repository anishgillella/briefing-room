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
    ) -> Dict[str, Any]:
        """
        Create a Vapi web call using the pre-configured assistant ID.

        Args:
            session_id: The voice ingest session ID
            user_name: User's first name

        Returns:
            Dict with assistant_id for frontend to use
        """
        if not self.assistant_id:
            logger.error("VAPI_ASSISTANT_ID not configured")
            return {"error": "Vapi assistant ID not configured"}

        # Return the assistant ID for the frontend to use directly
        logger.info(f"Returning assistant ID for session {session_id}: {self.assistant_id}")
        return {
            "assistantId": self.assistant_id,
            "sessionId": session_id,
            "userName": user_name,
        }

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
