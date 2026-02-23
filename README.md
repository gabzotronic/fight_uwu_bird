# FIGHT UWU BIRD

A pitch-based audio game where you battle a Koel bird across 3 rounds. Match and exceed its call using your voice to win.

**Stack:** Python/FastAPI backend · React/Vite frontend · Librosa pitch detection · DTW matching

---

## Quick start (local)

**Backend**
```bash
conda activate uwu
cd backend
uvicorn main:app --reload --port 8000
```

**Frontend** (separate terminal)
```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

---

## Deploy to Railway

Two services, each pointing to its subdirectory:

| Service | Root dir | Config |
|---------|----------|--------|
| Backend | `backend/` | `backend/railway.toml` |
| Frontend | `frontend/` | `frontend/railway.toml` |

**Environment variables to set:**

| Variable | Where | Value |
|----------|-------|-------|
| `ALLOWED_ORIGINS` | Backend service | Your frontend Railway URL |
| `VITE_API_URL` | Frontend service (build var) | Your backend Railway URL |

See `.env.example` for details.

---

## Docs

Full documentation lives in [`docs/`](docs/README.md):

- [README](docs/README.md) — complete setup & architecture
- [QUICKSTART](docs/QUICKSTART.md) — 30-second setup
- [Tech spec](docs/fight-uwu-bird-tech-spec.md)
- [Signal processing](docs/SIGNAL_PROCESSING.md)
