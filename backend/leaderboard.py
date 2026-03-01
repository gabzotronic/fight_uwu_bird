"""
Leaderboard persistence using PostgreSQL (Supabase or any Postgres).
"""

import os

import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv

load_dotenv()

_DATABASE_URL = None


def init_db():
    """Read DATABASE_URL from env and create the leaderboard table if needed."""
    global _DATABASE_URL
    _DATABASE_URL = os.environ.get("DATABASE_URL")
    if not _DATABASE_URL:
        print("[LEADERBOARD] WARNING: DATABASE_URL not set — leaderboard disabled")
        return

    with psycopg2.connect(_DATABASE_URL) as conn:
        with conn.cursor() as cur:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS leaderboard (
                    id         SERIAL PRIMARY KEY,
                    name       VARCHAR(10) NOT NULL,
                    score      INTEGER NOT NULL,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                );
            """)
        conn.commit()
    print("[LEADERBOARD] Table ready")


def _get_conn():
    if not _DATABASE_URL:
        return None
    return psycopg2.connect(_DATABASE_URL)


def insert_entry(name: str, score: int):
    """Insert a leaderboard entry. No-op if DB is not configured."""
    conn = _get_conn()
    if conn is None:
        return
    try:
        with conn:
            with conn.cursor() as cur:
                cur.execute(
                    "INSERT INTO leaderboard (name, score) VALUES (%s, %s)",
                    (name, score),
                )
    finally:
        conn.close()


def get_top(n: int = 8) -> list[dict]:
    """Return top N entries by score DESC, then earliest first."""
    conn = _get_conn()
    if conn is None:
        return []
    try:
        with conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(
                    "SELECT name, score, created_at FROM leaderboard "
                    "ORDER BY score DESC, created_at ASC LIMIT %s",
                    (n,),
                )
                rows = cur.fetchall()
        return [
            {
                "name": r["name"],
                "score": r["score"],
                "created_at": r["created_at"].isoformat(),
            }
            for r in rows
        ]
    finally:
        conn.close()


def get_rank(name: str, score: int) -> int:
    """Return 1-based rank for a given name+score (most recent matching entry)."""
    conn = _get_conn()
    if conn is None:
        return 0
    try:
        with conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT COUNT(*) + 1 FROM leaderboard "
                    "WHERE score > %s OR (score = %s AND created_at < "
                    "  (SELECT created_at FROM leaderboard "
                    "   WHERE name = %s AND score = %s "
                    "   ORDER BY created_at DESC LIMIT 1))",
                    (score, score, name, score),
                )
                return cur.fetchone()[0]
    finally:
        conn.close()
