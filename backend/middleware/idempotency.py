"""
Idempotency middleware for preventing duplicate mutations.

This module provides a simple in-memory idempotency cache for critical
operations like job creation and interview scheduling.
"""

from typing import Optional, Dict, Any
from datetime import datetime, timedelta
from functools import wraps
import hashlib
import json
import logging

logger = logging.getLogger(__name__)

# In-memory cache for idempotency keys
# In production, use Redis or a database
_idempotency_cache: Dict[str, Dict[str, Any]] = {}

# How long to keep idempotency keys (24 hours)
IDEMPOTENCY_TTL = timedelta(hours=24)


def _clean_expired_keys():
    """Remove expired idempotency keys from cache."""
    now = datetime.utcnow()
    expired = [
        key for key, value in _idempotency_cache.items()
        if now - value["created_at"] > IDEMPOTENCY_TTL
    ]
    for key in expired:
        del _idempotency_cache[key]


def get_cached_response(idempotency_key: str) -> Optional[Dict[str, Any]]:
    """
    Check if we have a cached response for this idempotency key.

    Args:
        idempotency_key: The idempotency key from the request header

    Returns:
        The cached response if found and not expired, None otherwise
    """
    _clean_expired_keys()

    if idempotency_key in _idempotency_cache:
        cached = _idempotency_cache[idempotency_key]
        logger.info(f"Idempotency cache hit for key: {idempotency_key[:8]}...")
        return cached["response"]

    return None


def cache_response(idempotency_key: str, response: Dict[str, Any]):
    """
    Cache a response for an idempotency key.

    Args:
        idempotency_key: The idempotency key from the request header
        response: The response to cache
    """
    _idempotency_cache[idempotency_key] = {
        "response": response,
        "created_at": datetime.utcnow(),
    }
    logger.info(f"Idempotency response cached for key: {idempotency_key[:8]}...")


def generate_idempotency_key(data: Dict[str, Any]) -> str:
    """
    Generate an idempotency key from request data.

    This is useful when the client doesn't provide an idempotency key
    but we want to prevent duplicates based on the request content.

    Args:
        data: The request data to hash

    Returns:
        A hash-based idempotency key
    """
    serialized = json.dumps(data, sort_keys=True, default=str)
    return hashlib.sha256(serialized.encode()).hexdigest()


def is_duplicate_request(idempotency_key: str) -> bool:
    """
    Check if this is a duplicate request.

    Args:
        idempotency_key: The idempotency key to check

    Returns:
        True if this key has been seen before
    """
    _clean_expired_keys()
    return idempotency_key in _idempotency_cache


def mark_request_in_progress(idempotency_key: str):
    """
    Mark a request as in progress to prevent concurrent duplicates.

    This creates a placeholder entry in the cache that will be
    updated with the actual response when the request completes.

    Args:
        idempotency_key: The idempotency key to mark
    """
    _idempotency_cache[idempotency_key] = {
        "response": None,
        "created_at": datetime.utcnow(),
        "in_progress": True,
    }


def clear_in_progress(idempotency_key: str):
    """
    Clear an in-progress marker if the request fails.

    Args:
        idempotency_key: The idempotency key to clear
    """
    if idempotency_key in _idempotency_cache:
        cached = _idempotency_cache[idempotency_key]
        if cached.get("in_progress") and cached.get("response") is None:
            del _idempotency_cache[idempotency_key]
