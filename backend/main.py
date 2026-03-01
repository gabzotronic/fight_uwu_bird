"""
FIGHT UWU BIRD API - FastAPI application
"""

import os

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse
from pydantic import BaseModel, Field
import numpy as np
from pathlib import Path

from game_manager import GameManager
from audio_processor import AudioProcessor
from uwu_detector import UWUDetector
from pitch_shifter import PitchShifter
from config import CONFIG
import leaderboard
from better_profanity import profanity

app = FastAPI(title="FIGHT UWU BIRD API")


def build_plotly_chart(analysis: dict, target_hz: float) -> dict | None:
    """
    Build Plotly-compatible chart data for the merged Hz corridor view.

    Returns a dict with "data" (list of traces) and "layout", ready to be
    passed directly to ContentFrame as chartData / chartLayout.
    Returns None if the intermediate contour data is unavailable (e.g. the
    player was silent or the recording was too short to run DTW).
    """
    template_st = analysis.get("template_trimmed_st")
    user_st = analysis.get("user_resampled_st")
    user_median_hz = analysis.get("player_median_hz", 0)
    if not template_st or not user_st or user_median_hz <= 0:
        return None

    template_arr = np.array(template_st)
    user_arr = np.array(user_st)

    dtw_band = CONFIG["dtw_threshold"] * (1.0 - 0.35)  # semitone half-width of corridor
    min_hz = target_hz * 2.0 ** (-CONFIG["pitch_tolerance"] / 12.0)

    t = np.linspace(0, 1, len(template_arr))
    upper_hz = target_hz * 2.0 ** ((template_arr + dtw_band) / 12.0)
    lower_hz = min_hz * 2.0 ** ((template_arr - dtw_band) / 12.0)
    user_hz = user_median_hz * 2.0 ** (user_arr / 12.0)

    # Closed polygon for the green fill corridor (toself trace)
    x_fill = np.concatenate([t, t[::-1]]).tolist()
    y_fill = np.concatenate([upper_hz, lower_hz[::-1]]).tolist()

    return {
        "data": [
            {
                "x": x_fill,
                "y": y_fill,
                "type": "scatter",
                "fill": "toself",
                "fillcolor": "rgba(46, 204, 113, 0.18)",
                "line": {"width": 0, "color": "rgba(0,0,0,0)"},
                "showlegend": False,
                "hoverinfo": "none",
            },
            {
                "x": t.tolist(),
                "y": user_hz.tolist(),
                "type": "scatter",
                "mode": "lines",
                "line": {"color": "#e74c3c", "width": 2},
                "showlegend": False,
                "hoverinfo": "none",
            },
        ],
        "layout": {
            "xaxis": {
                "title": {"text": "Time", "font": {"color": "rgba(0,0,0,0.9)"}},
                "showticklabels": True,
                "zeroline": False,
                "showgrid": True,
                "gridcolor": "rgba(255,255,255,0.1)",
                "color": "rgba(255,255,255,0.7)",
                "tickcolor": "rgba(255,255,255,0.7)",
            },
            "yaxis": {
                "title": {"text": "Hz", "font": {"color": "rgba(0,0,0,0.9)"}},
                "showticklabels": True,
                "type": "log",
                "zeroline": False,
                "showgrid": True,
                "gridcolor": "rgba(255,255,255,0.1)",
                "color": "rgba(255,255,255,0.7)",
                "tickcolor": "rgba(255,255,255,0.7)",
            },
            "showlegend": False,
        },
    }

_env_origins = os.environ.get("ALLOWED_ORIGINS", "")
_origins = (
    [o.strip() for o in _env_origins.split(",") if o.strip()]
    if _env_origins
    else [
        "http://localhost:5173",
        "https://localhost:5173",
        "http://localhost:3000",
        "http://192.168.68.54:5173",
        "https://192.168.68.54:5173",
    ]
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Initialization at startup ---
ASSETS_DIR = Path("assets")
game_manager = GameManager()
audio_processor = AudioProcessor(sr=CONFIG["sample_rate"])


@app.on_event("startup")
def startup():
    global pitch_shifter, uwu_detector

    # 1. Process base audio
    base_audio_path = ASSETS_DIR / "uwu_sound_1.mp3"
    if not base_audio_path.exists():
        raise FileNotFoundError(
            f"Base audio not found at {base_audio_path}. "
            "Please ensure uwu_sound_1.mp3 exists in the assets directory."
        )

    pitch_shifter = PitchShifter(str(base_audio_path))
    pitch_shifter.pregenerate(CONFIG["round_shifts"], str(ASSETS_DIR), CONFIG["preroll_silence_sec"])

    # 2. Extract template contour from base
    contour_data = audio_processor.extract_contour(pitch_shifter.y_base)
    template = contour_data["contour_semitones"]
    np.save(str(ASSETS_DIR / "uwu_template.npy"), template)

    # 3. Store base pitch
    CONFIG["base_pitch_hz"] = contour_data["median_hz"]

    # 4. Initialize detector
    uwu_detector = UWUDetector(template, CONFIG)

    # 5. Initialize leaderboard
    leaderboard.init_db()

    print(f"[OK] Loaded base call. Median pitch: {CONFIG['base_pitch_hz']:.1f} Hz")
    print(f"[OK] Pre-generated {len(CONFIG['round_shifts'])} pitch variants")


# --- Routes ---

GAME_URL = "https://fightuwubird.com"
IMAGE_URL = f"{GAME_URL}/share_image.png"


@app.get("/share")
def share_page(result: str = "win", score: int = 0):
    result = result if result in ("win", "lose") else "win"
    score = max(0, min(30000, score))

    if result == "win":
        title = "I defeated the UWU Bird! 🎤"
    else:
        title = "The UWU Bird destroyed me 😢"
    desc = f"I scored {score:,} points! Can you beat me? → fightuwubird.com"
    share_url = f"{GAME_URL}/share?result={result}&score={score}"

    html = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta property="og:title" content="{title}" />
  <meta property="og:description" content="{desc}" />
  <meta property="og:image" content="{IMAGE_URL}" />
  <meta property="og:url" content="{share_url}" />
  <meta property="og:type" content="website" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="{title}" />
  <meta name="twitter:description" content="{desc}" />
  <meta name="twitter:image" content="{IMAGE_URL}" />
  <meta http-equiv="refresh" content="0; url={GAME_URL}" />
</head>
<body>Redirecting to Fight UWU Bird...</body>
</html>"""
    return HTMLResponse(html)


@app.get("/api/health")
def health():
    return {"status": "ok", "base_pitch_hz": CONFIG["base_pitch_hz"]}


@app.post("/api/game/start")
def start_game():
    session = game_manager.create_session()
    return {
        "session_id": session.session_id,
        "round": session.current_round,
        "max_rounds": session.max_rounds,
        "tries_left": session.tries_left,
        "max_tries": session.max_tries,
        "message": "The bird is calling... listen carefully!",
    }


@app.get("/api/game/{session_id}/bird-call")
def get_bird_call(session_id: str):
    session = game_manager.get_session(session_id)
    if not session:
        raise HTTPException(404, "Session not found")

    round_idx = session.current_round - 1
    audio_file = ASSETS_DIR / f"uwu_round_{session.current_round}.wav"

    if not audio_file.exists():
        raise HTTPException(500, "Bird call audio not found")

    file_size = audio_file.stat().st_size
    print(f"[BIRD_CALL] Round {session.current_round}: Serving {audio_file.name} ({file_size} bytes)")

    return FileResponse(
        str(audio_file),
        media_type="audio/wav",
        headers={
            "X-Round": str(session.current_round),
            "X-Pitch-Shift": str(CONFIG["round_shifts"][round_idx]),
            "Content-Length": str(file_size),
        },
    )


@app.post("/api/game/{session_id}/analyze")
async def analyze_player_audio(session_id: str, audio: UploadFile = File(...), include_chart: bool = False):
    session = game_manager.get_session(session_id)
    if not session:
        raise HTTPException(404, "Session not found")

    if session.status.value in ("game_won", "game_lost"):
        raise HTTPException(400, "Game already over")

    # Read and process audio
    MAX_AUDIO_BYTES = 5 * 1024 * 1024  # 5 MB (a 3s mono WAV at 44100 Hz is ~265 KB)
    audio_bytes = await audio.read()
    if len(audio_bytes) < 1000:
        raise HTTPException(400, "Audio file too small")
    if len(audio_bytes) > MAX_AUDIO_BYTES:
        raise HTTPException(413, "Audio file too large")

    y = audio_processor.load_audio(audio_bytes)
    contour_data = audio_processor.extract_contour(y)

    # Calculate target pitch for this round
    round_idx = session.current_round - 1
    shift = CONFIG["round_shifts"][round_idx]
    target_hz = CONFIG["base_pitch_hz"] * (2 ** (shift / 12.0))

    # Run detection
    analysis = uwu_detector.analyze(contour_data, target_hz)
    pitch_chart = build_plotly_chart(analysis, target_hz) if include_chart else None

    # Load template for visualization
    template = np.load(str(ASSETS_DIR / "uwu_template.npy"))

    # Prepare pitch contours for visualization (downsample for smaller payload)
    player_contour = contour_data["contour_semitones"]
    template_contour = template

    # Downsample by factor of 4 to reduce data size
    downsample_factor = 4
    player_contour_downsampled = player_contour[::downsample_factor].tolist()
    template_contour_downsampled = template_contour[::downsample_factor].tolist()

    # Create time array (in frames, then we'll convert to seconds on frontend)
    time_frames = list(range(0, len(player_contour_downsampled)))

    # Store this round's contours in the session for persistence
    session.round_contours.append({
        "round": session.current_round,
        "player_contour": player_contour_downsampled,
        "template_contour": template_contour_downsampled,
        "time_frames": time_frames,
        "target_pitch_hz": target_hz,
        "player_median_pitch_hz": float(analysis["player_median_hz"]),
        "shift": CONFIG["round_shifts"][round_idx],
    })

    # Advance game state
    session = game_manager.advance_round(session_id, analysis["passed"], int(analysis["performance_score"]))

    # Build response
    result = None
    next_round = None
    if session.status.value == "game_won":
        result = "win"
        message = "🎉 The bird falls silent... YOU WIN!"
    elif session.status.value == "game_lost":
        result = "lose"
        message = analysis.get("failure_reason", "The bird out-uwu'd you!")
    elif not analysis["passed"]:
        # Failed but has tries remaining — retry same round
        next_round = session.current_round
        message = f"Not quite! {session.tries_left} tries left... (Round {next_round})"
    else:
        # Passed — advancing to next round
        next_round = session.current_round
        message = f"Nice uwu! The bird calls back even higher... (Round {next_round})"

    return {
        "session_id": session_id,
        "round": int(round_idx + 1),
        "tries_left": session.tries_left,
        "max_tries": session.max_tries,
        "contour_match": bool(analysis["contour_match"]),
        "contour_score": float(analysis["contour_score"]),
        "pitch_match": bool(analysis["pitch_match"]),
        "player_median_pitch_hz": float(round(analysis["player_median_hz"], 2)),
        "target_min_pitch_hz": float(round(target_hz, 2)),
        "passed": bool(analysis["passed"]),
        "performance_score": int(analysis["performance_score"]),
        "failure_reason": analysis.get("failure_reason"),
        "next_round": next_round if next_round is None else int(next_round),
        "game_over": bool(result is not None),
        "result": result,
        "message": message,
        "score_token": session.score_token,
        "total_score": session.total_score,
        # Plotly chart traces for ContentFrame (merged Hz corridor view)
        "pitch_chart": pitch_chart,
        # Visualization data - current round
        "pitch_visualization": {
            "player_contour": [float(x) for x in player_contour_downsampled],
            "template_contour": [float(x) for x in template_contour_downsampled],
            "time_frames": [int(x) for x in time_frames],
            "target_pitch_hz": float(target_hz),
            "player_median_pitch_hz": float(analysis["player_median_hz"]),
            "pitch_tolerance_semitones": float(CONFIG["pitch_tolerance"]),
        },
        # All rounds' contours for persistent visualization
        "all_rounds_visualization": session.round_contours,
    }


# --- Leaderboard ---

class LeaderboardSubmission(BaseModel):
    name: str = Field(..., min_length=1, max_length=8)
    score: int = Field(..., ge=0, le=30000)
    session_id: str
    token: str


@app.get("/api/leaderboard")
def get_leaderboard():
    return {"entries": leaderboard.get_top(8)}


@app.post("/api/leaderboard")
def post_leaderboard(body: LeaderboardSubmission):
    # Verify score token
    if not GameManager.verify_token(body.session_id, body.score, body.token):
        raise HTTPException(403, "Invalid score token")

    clean_name = body.name.strip().upper()

    # Profanity check
    if profanity.contains_profanity(clean_name):
        raise HTTPException(400, "Name contains inappropriate language")

    leaderboard.insert_entry(clean_name, body.score)
    rank = leaderboard.get_rank(clean_name, body.score)
    return {"entries": leaderboard.get_top(8), "player_rank": rank}
