import httpx
from typing import Optional, List, Dict, Any
from config import SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY


class SupabaseClient:
    """Simple Supabase REST client to avoid SDK compatibility issues"""
    
    def __init__(self):
        self.base_url = SUPABASE_URL
        self.api_key = SUPABASE_SERVICE_ROLE_KEY
        self.headers = {
            "apikey": self.api_key,
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "Prefer": "return=representation"
        }
    
    def _get_rest_url(self, table: str) -> str:
        """Get REST API URL for a table"""
        return f"{self.base_url}/rest/v1/{table}"
    
    async def insert(self, table: str, data: Dict[str, Any]) -> Dict[str, Any]:
        """Insert a row into a table"""
        async with httpx.AsyncClient() as client:
            response = await client.post(
                self._get_rest_url(table),
                headers=self.headers,
                json=data
            )
            response.raise_for_status()
            result = response.json()
            return result[0] if result else data
    
    async def select(
        self, 
        table: str, 
        columns: str = "*",
        filters: Optional[Dict[str, Any]] = None
    ) -> List[Dict[str, Any]]:
        """Select rows from a table"""
        url = f"{self._get_rest_url(table)}?select={columns}"
        
        # Add filters
        if filters:
            for key, value in filters.items():
                url += f"&{key}=eq.{value}"
        
        async with httpx.AsyncClient() as client:
            response = await client.get(url, headers=self.headers)
            response.raise_for_status()
            return response.json()
    
    async def select_one(
        self,
        table: str,
        columns: str = "*",
        filters: Optional[Dict[str, Any]] = None
    ) -> Optional[Dict[str, Any]]:
        """Select a single row from a table"""
        results = await self.select(table, columns, filters)
        return results[0] if results else None


_supabase_client: Optional[SupabaseClient] = None


def get_supabase_client() -> SupabaseClient:
    """Get Supabase client instance (lazy initialization)"""
    global _supabase_client
    
    if _supabase_client is None:
        if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
            raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set")
        _supabase_client = SupabaseClient()
    
    return _supabase_client
