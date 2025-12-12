"""
Configuration and environment setup for the backend.
"""

import os
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Paths
BASE_DIR = Path(__file__).parent
DATA_DIR = BASE_DIR / "data"
CSV_PATH = DATA_DIR / "takehome_candidates.csv"
RESULT_CSV_PATH = DATA_DIR / "result.csv"  # Primary output
PROCESSED_JSON_PATH = DATA_DIR / "processed_candidates.json"  # Backup JSON
RANKED_OUTPUT_PATH = DATA_DIR / "ranked_candidates.json"

# API Configuration
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"

# Model Configuration
EXTRACTION_MODEL = "google/gemini-2.5-flash"  # Fast, cheap, good for extraction
SCORING_MODEL = "google/gemini-2.5-flash"  # Fast model for scoring

# Processing Configuration
BATCH_SIZE = 10  # Number of concurrent API calls (increased for speed)
MAX_RETRIES = 2  # Retries on API failure

# LiveKit Voice Agent Configuration
LIVEKIT_URL = os.getenv("LIVEKIT_URL")
LIVEKIT_API_KEY = os.getenv("LIVEKIT_API_KEY")
LIVEKIT_API_SECRET = os.getenv("LIVEKIT_API_SECRET")

# Deepgram STT Configuration
DEEPGRAM_API_KEY = os.getenv("DEEPGRAM_API_KEY")

# ElevenLabs TTS Configuration
ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY")


def validate_config() -> None:
    """Validate that all required configuration is present."""
    if not OPENROUTER_API_KEY:
        raise ValueError(
            "OPENROUTER_API_KEY not found. "
            "Please set it in your .env file or environment."
        )
    
    if not CSV_PATH.exists():
        raise FileNotFoundError(
            f"Candidate CSV not found at {CSV_PATH}. "
            "Please ensure the data file is in place."
        )
    
    # Ensure data directory exists
    DATA_DIR.mkdir(parents=True, exist_ok=True)
