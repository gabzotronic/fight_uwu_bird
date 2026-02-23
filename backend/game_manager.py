"""
Game session and state management
"""

from dataclasses import dataclass, field
from enum import Enum
from typing import Optional
import uuid
from datetime import datetime, timedelta


class GameStatus(Enum):
    WAITING_FOR_PLAYER = "waiting_for_player"
    ANALYZING = "analyzing"
    ROUND_COMPLETE = "round_complete"
    GAME_WON = "game_won"
    GAME_LOST = "game_lost"


@dataclass
class GameSession:
    session_id: str
    current_round: int = 1
    max_rounds: int = 3
    max_tries: int = 3
    tries_left: int = 3
    status: GameStatus = GameStatus.WAITING_FOR_PLAYER
    created_at: datetime = field(default_factory=datetime.utcnow)
    round_results: list = field(default_factory=list)
    round_contours: list = field(default_factory=list)  # Store contours for each round


class GameManager:
    """Manages per-session game state"""

    def __init__(self):
        self.sessions: dict[str, GameSession] = {}

    def create_session(self) -> GameSession:
        session = GameSession(session_id=str(uuid.uuid4()))
        self.sessions[session.session_id] = session
        self._cleanup_old_sessions()
        return session

    def get_session(self, session_id: str) -> Optional[GameSession]:
        return self.sessions.get(session_id)

    def advance_round(self, session_id: str, passed: bool) -> GameSession:
        session = self.sessions[session_id]
        session.round_results.append(passed)

        if passed:
            # Player cleared this round — advance
            if session.current_round >= session.max_rounds:
                session.status = GameStatus.GAME_WON
            else:
                session.current_round += 1
                session.status = GameStatus.WAITING_FOR_PLAYER
        else:
            # Player failed — decrement tries, stay on same round
            session.tries_left -= 1
            if session.tries_left <= 0:
                session.status = GameStatus.GAME_LOST
            else:
                session.status = GameStatus.WAITING_FOR_PLAYER
                # current_round stays the same — player retries

        return session

    def _cleanup_old_sessions(self):
        """Remove sessions older than 1 hour."""
        cutoff = datetime.utcnow() - timedelta(hours=1)
        expired = [sid for sid, s in self.sessions.items() if s.created_at < cutoff]
        for sid in expired:
            del self.sessions[sid]
