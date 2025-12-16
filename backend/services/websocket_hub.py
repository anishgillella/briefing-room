"""
WebSocket Hub for real-time UI updates.
Manages WebSocket connections and broadcasts updates from the voice agent.
"""
import asyncio
import json
import logging
from typing import Dict, Set, Any
from fastapi import WebSocket

logger = logging.getLogger(__name__)


class WebSocketHub:
    """
    Manages WebSocket connections for real-time UI updates.

    The voice agent calls send_update() to push changes to the frontend.
    Multiple clients can connect to the same session.
    """

    def __init__(self):
        # session_id -> set of connected WebSocket clients
        self.connections: Dict[str, Set[WebSocket]] = {}
        self.lock = asyncio.Lock()

    async def connect(self, session_id: str, websocket: WebSocket) -> None:
        """
        Register a new WebSocket connection for a session.

        Args:
            session_id: The voice ingest session ID
            websocket: The WebSocket connection
        """
        await websocket.accept()

        async with self.lock:
            if session_id not in self.connections:
                self.connections[session_id] = set()
            self.connections[session_id].add(websocket)

        logger.info(f"WebSocket connected for session {session_id}. Total: {len(self.connections[session_id])}")

    async def disconnect(self, session_id: str, websocket: WebSocket) -> None:
        """
        Remove a WebSocket connection.

        Args:
            session_id: The voice ingest session ID
            websocket: The WebSocket connection to remove
        """
        async with self.lock:
            if session_id in self.connections:
                self.connections[session_id].discard(websocket)
                if not self.connections[session_id]:
                    del self.connections[session_id]

        logger.info(f"WebSocket disconnected for session {session_id}")

    async def send_update(
        self,
        session_id: str,
        update_type: str,
        data: Dict[str, Any]
    ) -> int:
        """
        Send an update to all connected clients for a session.

        Args:
            session_id: The voice ingest session ID
            update_type: Type of update (e.g., 'requirements', 'trait_created')
            data: Update payload

        Returns:
            Number of clients the message was sent to
        """
        message = json.dumps({
            "type": update_type,
            "data": data
        })

        sent_count = 0
        dead_connections = set()

        async with self.lock:
            if session_id not in self.connections:
                return 0

            for ws in self.connections[session_id]:
                try:
                    await ws.send_text(message)
                    sent_count += 1
                except Exception as e:
                    logger.warning(f"Failed to send to WebSocket: {e}")
                    dead_connections.add(ws)

            # Clean up dead connections
            self.connections[session_id] -= dead_connections

        if sent_count > 0:
            logger.debug(f"Sent {update_type} to {sent_count} clients for session {session_id}")

        return sent_count

    async def broadcast_transcript(
        self,
        session_id: str,
        speaker: str,
        text: str
    ) -> None:
        """
        Broadcast a transcript entry to all connected clients.

        Args:
            session_id: The voice ingest session ID
            speaker: Who spoke ('agent' or 'user')
            text: What was said
        """
        await self.send_update(
            session_id=session_id,
            update_type="transcript",
            data={
                "speaker": speaker,
                "text": text
            }
        )

    async def broadcast_completion(
        self,
        session_id: str,
        completion_percentage: float,
        missing_fields: list
    ) -> None:
        """
        Broadcast profile completion status.

        Args:
            session_id: The voice ingest session ID
            completion_percentage: Current completion percentage
            missing_fields: List of still-missing fields
        """
        await self.send_update(
            session_id=session_id,
            update_type="completion_update",
            data={
                "completion_percentage": completion_percentage,
                "missing_fields": missing_fields,
                "is_complete": len(missing_fields) == 0
            }
        )

    def get_connection_count(self, session_id: str) -> int:
        """Get the number of active connections for a session."""
        return len(self.connections.get(session_id, set()))

    def get_all_sessions(self) -> list:
        """Get list of all active session IDs."""
        return list(self.connections.keys())


# Global singleton instance
ws_hub = WebSocketHub()
