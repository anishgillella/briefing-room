"""
Supabase client configuration.
"""
import os
from pathlib import Path
from supabase import create_client, Client
from dotenv import load_dotenv

# Load environment variables from project root
# Search upward from this file to find .env
current = Path(__file__).resolve().parent
while current != current.parent:
    env_file = current / ".env"
    if env_file.exists():
        load_dotenv(env_file)
        break
    current = current.parent
else:
    load_dotenv()  # Fallback to default

# Supabase configuration
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

# Use service role key for server-side operations (full access)
SUPABASE_KEY = SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY

# Debug: Print which key type is being used (don't print actual key)
if SUPABASE_SERVICE_ROLE_KEY:
    print("[Supabase] Using SERVICE_ROLE_KEY (full access)")
elif SUPABASE_ANON_KEY:
    print("[Supabase] WARNING: Using ANON_KEY (limited access - may cause RLS issues)")
else:
    print("[Supabase] ERROR: No API key found!")


def get_supabase_client() -> Client:
    """Get Supabase client instance."""
    if not SUPABASE_URL:
        raise ValueError("SUPABASE_URL environment variable not set")
    if not SUPABASE_KEY:
        raise ValueError("SUPABASE_KEY environment variable not set")
    
    return create_client(SUPABASE_URL, SUPABASE_KEY)


# Singleton instance for reuse
_supabase_client: Client | None = None


def get_db() -> Client:
    """Get singleton Supabase client."""
    global _supabase_client
    if _supabase_client is None:
        _supabase_client = get_supabase_client()
    return _supabase_client


def reset_db_client():
    """Reset the singleton client (useful when env changes)."""
    global _supabase_client
    _supabase_client = None


# For convenience - direct import (lazy to avoid early creation issues)
supabase = None
def _get_supabase():
    global supabase
    if supabase is None and SUPABASE_URL and SUPABASE_KEY:
        supabase = get_db()
    return supabase
