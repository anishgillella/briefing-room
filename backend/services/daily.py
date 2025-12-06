import httpx
from datetime import datetime, timedelta
from config import DAILY_API_KEY, DAILY_API_URL


class DailyService:
    """Service for interacting with Daily.co API"""
    
    def __init__(self):
        self.api_key = DAILY_API_KEY
        self.base_url = DAILY_API_URL
        self.headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
    
    async def create_room(self, room_name: str = None, expires_in_hours: int = 1) -> dict:
        """
        Create a new Daily room
        
        Args:
            room_name: Optional custom name for the room
            expires_in_hours: Hours until room expires (default 1)
            
        Returns:
            Room data including URL and name
        """
        expires_at = datetime.utcnow() + timedelta(hours=expires_in_hours)
        
        payload = {
            "properties": {
                "exp": int(expires_at.timestamp()),
                "enable_prejoin_ui": True,
                "enable_screenshare": True,
                "enable_chat": True,
                "start_video_off": False,
                "start_audio_off": False,
            }
        }
        
        if room_name:
            payload["name"] = room_name
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/rooms",
                headers=self.headers,
                json=payload
            )
            response.raise_for_status()
            return response.json()
    
    async def get_room(self, room_name: str) -> dict:
        """Get room details by name"""
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.base_url}/rooms/{room_name}",
                headers=self.headers
            )
            response.raise_for_status()
            return response.json()
    
    async def delete_room(self, room_name: str) -> bool:
        """Delete a room by name"""
        async with httpx.AsyncClient() as client:
            response = await client.delete(
                f"{self.base_url}/rooms/{room_name}",
                headers=self.headers
            )
            return response.status_code == 200
    
    async def create_meeting_token(
        self, 
        room_name: str, 
        participant_name: str,
        participant_type: str = "candidate",
        expires_in_hours: int = 1
    ) -> str:
        """
        Create a meeting token for a participant
        
        Args:
            room_name: Name of the room
            participant_name: Display name for the participant
            participant_type: Either 'interviewer' or 'candidate'
            expires_in_hours: Token validity duration
            
        Returns:
            Meeting token string
        """
        expires_at = datetime.utcnow() + timedelta(hours=expires_in_hours)
        
        payload = {
            "properties": {
                "room_name": room_name,
                "user_name": participant_name,
                "exp": int(expires_at.timestamp()),
                "is_owner": participant_type == "interviewer",
                "user_id": f"{participant_type}_{participant_name}",
            }
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/meeting-tokens",
                headers=self.headers,
                json=payload
            )
            response.raise_for_status()
            data = response.json()
            return data["token"]


# Singleton instance
daily_service = DailyService()
