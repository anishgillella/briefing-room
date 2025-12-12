"""
Candidate store service for JSON-based persistence.
Handles CRUD operations for candidates.
"""

import json
from pathlib import Path
from typing import List, Optional
from datetime import datetime
from models.candidate import Candidate, CandidateUpdate

# Data file path
DATA_DIR = Path(__file__).parent.parent / "data"
CANDIDATES_FILE = DATA_DIR / "candidates.json"


def _ensure_file():
    """Ensure data directory and file exist."""
    DATA_DIR.mkdir(exist_ok=True)
    if not CANDIDATES_FILE.exists():
        CANDIDATES_FILE.write_text('{"candidates": [], "last_updated": null}')


def _read_data() -> dict:
    """Read data from JSON file."""
    _ensure_file()
    return json.loads(CANDIDATES_FILE.read_text())


def _write_data(data: dict):
    """Write data to JSON file."""
    _ensure_file()
    data["last_updated"] = datetime.utcnow().isoformat()
    CANDIDATES_FILE.write_text(json.dumps(data, indent=2, default=str))


def save_candidates(candidates: List[Candidate]):
    """Save a list of candidates, replacing existing data."""
    data = {
        "candidates": [c.model_dump() for c in candidates],
        "last_updated": datetime.utcnow().isoformat()
    }
    _write_data(data)


def get_all_candidates() -> List[Candidate]:
    """Get all candidates, sorted by combined_score descending."""
    data = _read_data()
    candidates = []
    for c_data in data.get("candidates", []):
        # Handle datetime fields
        if isinstance(c_data.get("created_at"), str):
            c_data["created_at"] = datetime.fromisoformat(c_data["created_at"].replace("Z", "+00:00"))
        if isinstance(c_data.get("updated_at"), str):
            c_data["updated_at"] = datetime.fromisoformat(c_data["updated_at"].replace("Z", "+00:00"))
        candidates.append(Candidate(**c_data))
    
    # Sort by combined_score descending
    return sorted(candidates, key=lambda c: c.combined_score or 0, reverse=True)


def get_candidate(candidate_id: str) -> Optional[Candidate]:
    """Get a specific candidate by ID."""
    candidates = get_all_candidates()
    return next((c for c in candidates if c.id == candidate_id), None)


def update_candidate(candidate_id: str, updates: CandidateUpdate | dict) -> Optional[Candidate]:
    """Update a candidate with partial data."""
    data = _read_data()
    candidates_data = data.get("candidates", [])
    
    for i, c_data in enumerate(candidates_data):
        if c_data.get("id") == candidate_id:
            # Apply updates
            update_dict = updates if isinstance(updates, dict) else updates.model_dump(exclude_unset=True)
            for key, value in update_dict.items():
                if value is not None:
                    c_data[key] = value
            c_data["updated_at"] = datetime.utcnow().isoformat()
            
            # Save and return
            data["candidates"] = candidates_data
            _write_data(data)
            
            # Parse dates for return
            if isinstance(c_data.get("created_at"), str):
                c_data["created_at"] = datetime.fromisoformat(c_data["created_at"].replace("Z", "+00:00"))
            if isinstance(c_data.get("updated_at"), str):
                c_data["updated_at"] = datetime.fromisoformat(c_data["updated_at"].replace("Z", "+00:00"))
            
            return Candidate(**c_data)
    
    return None


def add_candidate(candidate: Candidate) -> Candidate:
    """Add a single candidate."""
    data = _read_data()
    candidates_data = data.get("candidates", [])
    candidates_data.append(candidate.model_dump())
    data["candidates"] = candidates_data
    _write_data(data)
    return candidate


def add_candidates(new_candidates: List[Candidate]):
    """Add multiple candidates to existing list."""
    data = _read_data()
    candidates_data = data.get("candidates", [])
    for c in new_candidates:
        candidates_data.append(c.model_dump())
    data["candidates"] = candidates_data
    _write_data(data)


def delete_candidate(candidate_id: str) -> bool:
    """Delete a candidate by ID. Returns True if deleted."""
    data = _read_data()
    candidates_data = data.get("candidates", [])
    original_len = len(candidates_data)
    candidates_data = [c for c in candidates_data if c.get("id") != candidate_id]
    
    if len(candidates_data) < original_len:
        data["candidates"] = candidates_data
        _write_data(data)
        return True
    return False


def clear_all_candidates():
    """Clear all candidates (useful for fresh uploads)."""
    _write_data({"candidates": [], "last_updated": None})


def get_candidates_count() -> int:
    """Get total number of candidates."""
    data = _read_data()
    return len(data.get("candidates", []))
