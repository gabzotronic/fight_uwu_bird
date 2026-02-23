# Leaderboard Tech Spec — FIGHT UWU BIRD

## Overview

Add a persistent global leaderboard to the results screen. Players can submit their name after a game ends. The top 8 scores are displayed, visible to all players.

---

## Requirements

- Player can enter a name (max 10 characters) on the results screen
- Score is submitted with the name to the backend
- Leaderboard shows top 8 all-time scores (all players, all sessions)
- Leaderboard persists across server restarts and redeployments
- Works identically in local development and on Railway

---

## Architecture

No structural changes to the existing stack. Two new API endpoints are added to the existing FastAPI backend. A new `leaderboard.py` module handles all database interaction. The frontend adds a name input and leaderboard table to the existing `ResultScreen` component.

```
Frontend (React)
    └── ResultScreen.jsx
            ├── POST /api/leaderboard   (submit name + score)
            └── GET  /api/leaderboard   (fetch top 8)

Backend (FastAPI)
    └── main.py
            └── leaderboard.py
                    └── PostgreSQL (local Docker / Railway plugin)
```

---

## Storage

**Engine:** PostgreSQL via `psycopg2-binary`

**Why not SQLite:** Railway's filesystem is ephemeral — files written at runtime are wiped on redeploy or restart. PostgreSQL on Railway is a native plugin with a persistent managed instance.

### Schema

```sql
CREATE TABLE IF NOT EXISTS leaderboard (
    id        SERIAL PRIMARY KEY,
    name      VARCHAR(10)  NOT NULL,
    score     INTEGER      NOT NULL,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
```

All scores are stored (not just top 8). The top 8 filter is applied at query time. Timestamp is used as a tiebreaker — earlier submission ranks higher.

---

## Environment Configuration

The backend connects via a single `DATABASE_URL` environment variable.

| Environment | How `DATABASE_URL` is set              | Value example                                      |
|-------------|----------------------------------------|----------------------------------------------------|
| Local       | `backend/.env` file (via python-dotenv) | `postgresql://postgres:postgres@localhost:5432/uwu` |
| Railway     | Injected automatically by Railway      | Provided by the Railway Postgres plugin            |

`.env` is gitignored and never committed.

---

## Local Development Setup

1. Start a local Postgres instance via Docker:
   ```bash
   docker run -d --name uwu-postgres \
     -e POSTGRES_PASSWORD=postgres \
     -e POSTGRES_DB=uwu \
     -p 5432:5432 postgres:16
   ```

2. Create `backend/.env`:
   ```
   DATABASE_URL=postgresql://postgres:postgres@localhost:5432/uwu
   ```

3. The table is created automatically on backend startup (`CREATE TABLE IF NOT EXISTS`).

---

## Railway Deployment Setup

1. In the Railway dashboard, add a **Postgres plugin** to your project.
2. Railway automatically injects `DATABASE_URL` into the backend service's environment.
3. No code changes required — the backend reads the same env var in both environments.

---

## New Dependencies

Add to `requirements.txt`:

```
psycopg2-binary   # PostgreSQL driver
python-dotenv     # reads .env file in local development
```

---

## Backend Changes

### New file: `backend/leaderboard.py`

Responsibilities:
- On import, read `DATABASE_URL` from environment (via `python-dotenv`)
- Expose `init_db()` — creates the table if it doesn't exist (called at startup)
- Expose `insert_entry(name: str, score: int)` — inserts a row
- Expose `get_top(n: int = 8) -> list[dict]` — returns top N entries ordered by score DESC, created_at ASC

### Changes to `backend/main.py`

- Call `leaderboard.init_db()` inside the existing `@app.on_event("startup")` handler
- Add two new routes (see API section below)

---

## API

### `GET /api/leaderboard`

Returns the top 8 scores.

**Response:**
```json
{
  "entries": [
    { "rank": 1, "name": "PLAYERONE", "score": 19737 },
    { "rank": 2, "name": "AUNTIE",    "score": 15200 },
    ...
  ]
}
```

### `POST /api/leaderboard`

Submits a new score entry.

**Request body:**
```json
{ "name": "PLAYERONE", "score": 19737 }
```

**Validation:**
- `name`: required, 1–10 characters, stripped of leading/trailing whitespace
- `score`: required, integer ≥ 0

**Response:** same shape as `GET /api/leaderboard` (returns updated top 8 immediately)

**Error responses:**
- `422` — validation failure (name too long, missing fields, etc.)

---

## Frontend Changes

### `frontend/src/api/gameApi.js`

Two new functions:
- `getLeaderboard()` — `GET /api/leaderboard`
- `submitScore(name, score)` — `POST /api/leaderboard`

### `frontend/src/components/ResultScreen.jsx`

New section below the Play Again / Try Again button:

```
[Play Again]

── ENTER YOUR NAME ──────────────
[ PLAYERONE        ] [Submit]

── LEADERBOARD ──────────────────
#1   PLAYERONE    19,737
#2   AUNTIE       15,200
#3   ...
```

**Component state:**
| State        | Description                                              |
|--------------|----------------------------------------------------------|
| `name`       | Controlled input value                                   |
| `submitState`| `idle` \| `submitting` \| `submitted`                  |
| `entries`    | Array of top 8 leaderboard entries                       |

**Behaviour:**
- Leaderboard fetches on component mount (`GET /api/leaderboard`)
- Submit button is disabled if name is empty or `submitState !== 'idle'`
- On submit: set `submitting`, call `POST /api/leaderboard`, update `entries` from response, set `submitted`
- After submission: hide the name input, optionally highlight the player's own entry
- If `score === 0`: hide the submit input (no point entering a zero score)
- Name input: `maxLength={10}`, auto-uppercased for display consistency

### `frontend/src/styles/app.css`

New styles for:
- `.leaderboard` — container
- `.leaderboard__entry` — each row (rank, name, score)
- `.leaderboard__entry--own` — highlight for the player's own submitted entry

---

## Open Questions

1. **Duplicate names:** Should the same name be allowed multiple times (store all), or should submitting overwrite the previous best score for that name? Current spec stores all — simplest, no login required.
2. **Score = 0 visibility:** Spec hides the submit input at score 0. Confirm this is the desired behaviour.
3. **Railway filesystem for audio assets:** The existing startup event generates `uwu_round_*.wav` into `backend/assets/` at runtime. These will also be wiped on Railway redeploy. This is a separate issue from the leaderboard but should be resolved before deployment (options: commit the generated files, or generate them into `/tmp`).
