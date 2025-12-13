import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env from current directory first, then parent
load_dotenv()
parent_env = Path(__file__).parent.parent / ".env"
if parent_env.exists():
    load_dotenv(parent_env)

# Daily.co
DAILY_API_KEY = os.getenv("DAILY_API_KEY")
DAILY_API_URL = "https://api.daily.co/v1"

# Supabase
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

# OpenRouter
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
OPENROUTER_MODEL = os.getenv("OPENROUTER_MODEL", "google/gemini-2.5-flash")
GEMINI_ANALYTICS_MODEL = "google/gemini-2.5-flash"

# OpenAI (for Realtime API)
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

# LiveKit (for Voice Agent)
LIVEKIT_URL = os.getenv("LIVEKIT_URL")
LIVEKIT_API_KEY = os.getenv("LIVEKIT_API_KEY")
LIVEKIT_API_SECRET = os.getenv("LIVEKIT_API_SECRET")

# Deepgram (STT)
DEEPGRAM_API_KEY = os.getenv("DEEPGRAM_API_KEY")

# ElevenLabs (TTS)
ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY")

# App
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")
