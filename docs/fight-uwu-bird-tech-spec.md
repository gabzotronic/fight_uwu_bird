# FIGHT UWU BIRD — Technical Specification

## 1. Overview

**FIGHT UWU BIRD** is a web app game where players compete against a simulated Koel bird in a pitch-escalation battle. The Koel plays its signature "uwu" call, and the player must mimic it back at a higher pitch. The bird responds even higher, and so on for 3 rounds. If the player successfully matches all 3 rounds, the bird "gives up" and the player wins.

### 1.1 Core Game Loop

```
Round N (N = 1, 2, 3):
  1. Bird plays its "uwu" call at pitch level N
  2. UI prompts: "Your turn! Say uwu higher!"
  3. App records 3 seconds of mic audio
  4. Backend analyzes recording:
     a. Extract pitch contour (F0 over time)
     b. Match against "uwu" shape template (DTW)
     c. Verify player's pitch is above the bird's pitch for round N
  5. If PASS → proceed to round N+1 (or WIN if N=3)
     If FAIL → game over, YOU LOSE
```

### 1.2 Win/Lose Conditions

| Condition | Result |
|-----------|--------|
| Player matches uwu shape AND pitch for all 3 rounds | **YOU WIN** — bird falls silent |
| Player fails shape match in any round | **YOU LOSE** — bird out-uwu'd you |
| Player matches shape but pitch too low | **YOU LOSE** — not intimidating enough |
| No sound detected (silence / too quiet) | **YOU LOSE** — bird wasn't impressed |

---

## 2. Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | React 18 + Vite | UI, game state display, animations |
| Audio Capture | Web Audio API + MediaRecorder | Mic input, WAV encoding |
| Audio Playback | Web Audio API | Playing bird calls with low latency |
| Backend | Python 3.11 + FastAPI | Audio analysis, pitch shifting, game logic |
| Pitch Detection | librosa (pyin algorithm) | Extract F0 contour from player audio |
| Contour Matching | dtw-python or fastdtw | Dynamic Time Warping for shape comparison |
| Pitch Shifting | librosa.effects.pitch_shift | Generate escalating bird calls |
| Audio Format | WAV (16-bit, 44100 Hz) | Lossless interchange between frontend/backend |

---

## 3. Audio Assets

### 3.1 Base Bird Call

- **File:** `uwu_sound_1.mp3` (provided by user)
- **Processing on first load:**
  1. Convert MP3 → WAV (44100 Hz, 16-bit mono) using `librosa.load()`
  2. Trim silence from start/end using `librosa.effects.trim()`
  3. Normalize amplitude to -3 dBFS
  4. Extract and store the reference pitch contour (used as the "uwu template")
  5. Pre-generate pitch-shifted variants for rounds 1–3

### 3.2 Pitch-Shifted Variants

| Round | Semitone Shift | Perceived Effect |
|-------|---------------|------------------|
| 1 | +0 (original) | Natural Koel call |
| 2 | +4 (major 3rd up) | Noticeably higher, still bird-like |
| 3 | +8 (minor 6th up) | Comically high, strained bird |

**Implementation:** Use `librosa.effects.pitch_shift(y, sr=44100, n_steps=N)` for each variant. Cache as WAV files on backend startup.

### 3.3 Reference Contour Template

Extracted from the base bird call at startup:

```python
# Extract F0 from the base sample
f0, voiced_flag, voiced_probs = librosa.pyin(
    y_base,
    fmin=librosa.note_to_hz('C3'),   # ~130 Hz
    fmax=librosa.note_to_hz('C7'),   # ~2093 Hz
    sr=44100
)

# Convert to semitones relative to median pitch
median_f0 = np.nanmedian(f0)
contour_semitones = 12 * np.log2(f0 / median_f0)

# Smooth with moving average (window = 5 frames)
template_contour = pd.Series(contour_semitones).rolling(5, center=True).mean().values

# Store as the reference template
np.save("uwu_template.npy", template_contour)
```

This template captures the characteristic **down-up** shape of the "uwu" call and is used for DTW matching against player input.

---

## 4. Backend (Python / FastAPI)

### 4.1 Project Structure

```
backend/
├── main.py                  # FastAPI app, routes, CORS
├── audio_processor.py       # Pitch detection, contour extraction
├── uwu_detector.py          # DTW matching, scoring logic
├── pitch_shifter.py         # Generate bird call variants
├── game_manager.py          # Session state, round tracking
├── config.py                # Thresholds, tuning parameters
├── assets/
│   ├── uwu_sound_1.mp3      # Original bird call
│   ├── uwu_base.wav         # Processed base (generated at startup)
│   ├── uwu_round_1.wav      # Pitch-shifted variants (generated)
│   ├── uwu_round_2.wav
│   ├── uwu_round_3.wav
│   └── uwu_template.npy     # Reference pitch contour
├── requirements.txt
└── tests/
    ├── test_audio_processor.py
    ├── test_uwu_detector.py
    └── test_game_manager.py
```

### 4.2 API Endpoints

#### `POST /api/game/start`

Creates a new game session.

**Response:**
```json
{
  "session_id": "uuid-v4",
  "round": 1,
  "message": "The bird is calling... listen carefully!"
}
```

#### `GET /api/game/{session_id}/bird-call`

Returns the bird's call audio for the current round.

**Response:** WAV file as binary stream (`audio/wav` content type)

**Headers:** `X-Round: 1`, `X-Pitch-Shift: 0`

#### `POST /api/game/{session_id}/analyze`

Receives the player's audio recording and analyzes it.

**Request:** `multipart/form-data` with field `audio` (WAV blob, ≤ 5 seconds)

**Response:**
```json
{
  "session_id": "uuid-v4",
  "round": 1,
  "contour_match": true,
  "contour_score": 0.72,         // 0-1, higher = better match
  "pitch_match": true,
  "player_median_pitch_hz": 523.25,
  "target_min_pitch_hz": 440.0,
  "passed": true,
  "next_round": 2,               // null if game over
  "game_over": false,
  "result": null,                 // "win" | "lose" | null
  "message": "Nice uwu! The bird calls back higher..."
}
```

#### `GET /api/health`

Health check endpoint.

### 4.3 Game Manager (`game_manager.py`)

Manages per-session game state using an in-memory dictionary (sufficient for a single-user game; swap to Redis for multi-user).

```python
from dataclasses import dataclass, field
from enum import Enum
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
    status: GameStatus = GameStatus.WAITING_FOR_PLAYER
    created_at: datetime = field(default_factory=datetime.utcnow)
    round_results: list = field(default_factory=list)

class GameManager:
    def __init__(self):
        self.sessions: dict[str, GameSession] = {}

    def create_session(self) -> GameSession:
        session = GameSession(session_id=str(uuid.uuid4()))
        self.sessions[session.session_id] = session
        self._cleanup_old_sessions()
        return session

    def get_session(self, session_id: str) -> GameSession | None:
        return self.sessions.get(session_id)

    def advance_round(self, session_id: str, passed: bool) -> GameSession:
        session = self.sessions[session_id]
        session.round_results.append(passed)

        if not passed:
            session.status = GameStatus.GAME_LOST
        elif session.current_round >= session.max_rounds:
            session.status = GameStatus.GAME_WON
        else:
            session.current_round += 1
            session.status = GameStatus.WAITING_FOR_PLAYER

        return session

    def _cleanup_old_sessions(self):
        """Remove sessions older than 1 hour."""
        cutoff = datetime.utcnow() - timedelta(hours=1)
        expired = [sid for sid, s in self.sessions.items() if s.created_at < cutoff]
        for sid in expired:
            del self.sessions[sid]
```

### 4.4 Audio Processor (`audio_processor.py`)

Handles raw audio → pitch contour extraction.

```python
import numpy as np
import librosa
import io

class AudioProcessor:
    def __init__(self, sr: int = 44100):
        self.sr = sr
        self.fmin = librosa.note_to_hz('C3')   # 130 Hz
        self.fmax = librosa.note_to_hz('C7')    # 2093 Hz
        self.hop_length = 512

    def load_audio(self, audio_bytes: bytes) -> np.ndarray:
        """Load audio from WAV bytes, convert to mono float."""
        y, _ = librosa.load(io.BytesIO(audio_bytes), sr=self.sr, mono=True)
        return y

    def extract_contour(self, y: np.ndarray) -> dict:
        """
        Extract pitch contour from audio signal.

        Returns:
            {
                "f0": np.ndarray (Hz, NaN for unvoiced),
                "contour_semitones": np.ndarray (relative to median),
                "median_hz": float,
                "voiced_ratio": float (0-1, proportion of voiced frames)
            }
        """
        f0, voiced_flag, voiced_probs = librosa.pyin(
            y,
            fmin=self.fmin,
            fmax=self.fmax,
            sr=self.sr,
            hop_length=self.hop_length
        )

        voiced_ratio = np.sum(~np.isnan(f0)) / len(f0)
        median_hz = float(np.nanmedian(f0)) if voiced_ratio > 0.1 else 0.0

        if median_hz > 0:
            contour_semitones = 12 * np.log2(f0 / median_hz)
            # Smooth: rolling mean, window=5
            kernel = np.ones(5) / 5
            contour_smooth = np.convolve(
                np.nan_to_num(contour_semitones, nan=0.0),
                kernel,
                mode='same'
            )
        else:
            contour_smooth = np.zeros_like(f0)

        return {
            "f0": f0,
            "contour_semitones": contour_smooth,
            "median_hz": median_hz,
            "voiced_ratio": voiced_ratio,
        }
```

### 4.5 UWU Detector (`uwu_detector.py`)

The core matching algorithm using Dynamic Time Warping.

```python
import numpy as np
from dtw import dtw  # dtw-python package

class UWUDetector:
    def __init__(self, template_contour: np.ndarray, config: dict):
        """
        Args:
            template_contour: Reference uwu pitch contour in semitones
            config: Detection thresholds
        """
        self.template = template_contour
        self.dtw_threshold = config["dtw_threshold"]            # e.g. 8.0
        self.min_voiced_ratio = config["min_voiced_ratio"]      # e.g. 0.3
        self.pitch_tolerance_semitones = config["pitch_tolerance"]  # e.g. 5.0

    def analyze(
        self,
        player_contour: dict,
        target_pitch_hz: float
    ) -> dict:
        """
        Analyze player's audio against the uwu template.

        Args:
            player_contour: Output from AudioProcessor.extract_contour()
            target_pitch_hz: Minimum pitch the player must reach for this round

        Returns:
            {
                "contour_match": bool,
                "contour_score": float (0-1, normalized),
                "pitch_match": bool,
                "player_median_hz": float,
                "target_min_hz": float,
                "dtw_distance": float,
                "passed": bool,
                "failure_reason": str | None
            }
        """
        result = {
            "contour_match": False,
            "contour_score": 0.0,
            "pitch_match": False,
            "player_median_hz": player_contour["median_hz"],
            "target_min_hz": target_pitch_hz,
            "dtw_distance": float('inf'),
            "passed": False,
            "failure_reason": None,
        }

        # Check 1: Was there enough voiced audio?
        if player_contour["voiced_ratio"] < self.min_voiced_ratio:
            result["failure_reason"] = "Not enough sound detected. Speak louder!"
            return result

        # Check 2: Contour shape match via DTW
        player_semitones = player_contour["contour_semitones"]

        # Remove zero-padding (unvoiced regions) from edges
        nonzero = np.nonzero(player_semitones)[0]
        if len(nonzero) < 5:
            result["failure_reason"] = "Call too short. Give us a proper uwu!"
            return result

        player_trimmed = player_semitones[nonzero[0]:nonzero[-1]+1]

        # DTW alignment
        alignment = dtw(
            player_trimmed,
            self.template,
            keep_internals=True
        )

        raw_distance = alignment.distance
        # Normalize by path length for consistent scoring
        normalized_distance = raw_distance / alignment.jmin

        # Convert to 0-1 score (lower distance = higher score)
        # Using a sigmoid-style mapping
        contour_score = max(0.0, 1.0 - (normalized_distance / self.dtw_threshold))
        result["dtw_distance"] = float(normalized_distance)
        result["contour_score"] = round(contour_score, 3)
        result["contour_match"] = contour_score > 0.35  # ~35% similarity minimum

        # Check 3: Pitch level
        player_hz = player_contour["median_hz"]
        # Allow player to be up to `pitch_tolerance` semitones BELOW target
        semitone_diff = 12 * np.log2(player_hz / target_pitch_hz) if player_hz > 0 else -999
        result["pitch_match"] = semitone_diff >= -self.pitch_tolerance_semitones

        if not result["contour_match"]:
            result["failure_reason"] = "That didn't sound like uwu! Try matching the bird's call."
        elif not result["pitch_match"]:
            result["failure_reason"] = "Not high enough! The bird needs to feel threatened."

        result["passed"] = result["contour_match"] and result["pitch_match"]
        return result
```

### 4.6 Pitch Shifter (`pitch_shifter.py`)

```python
import numpy as np
import librosa
import soundfile as sf
from pathlib import Path

class PitchShifter:
    def __init__(self, base_audio_path: str, sr: int = 44100):
        self.sr = sr
        self.y_base, _ = librosa.load(base_audio_path, sr=sr, mono=True)
        self.y_base = librosa.util.normalize(self.y_base)
        self.cache: dict[int, np.ndarray] = {}

    def get_shifted(self, semitones: int) -> np.ndarray:
        """Return pitch-shifted audio, cached."""
        if semitones not in self.cache:
            if semitones == 0:
                self.cache[0] = self.y_base.copy()
            else:
                self.cache[semitones] = librosa.effects.pitch_shift(
                    self.y_base,
                    sr=self.sr,
                    n_steps=semitones
                )
        return self.cache[semitones]

    def pregenerate(self, shifts: list[int], output_dir: str):
        """Pre-generate all variants as WAV files."""
        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)

        for s in shifts:
            y = self.get_shifted(s)
            filepath = output_path / f"uwu_round_{shifts.index(s)+1}.wav"
            sf.write(str(filepath), y, self.sr)

        # Also save the processed base
        sf.write(str(output_path / "uwu_base.wav"), self.y_base, self.sr)
```

### 4.7 Config (`config.py`)

Central tuning parameters — **these are the main knobs for playtesting**.

```python
CONFIG = {
    # Pitch shift per round (in semitones)
    "round_shifts": [0, 4, 8],

    # Base pitch of the original bird call (Hz) — set after loading asset
    # Will be computed at startup from the actual sample
    "base_pitch_hz": None,

    # Target pitch per round = base_pitch_hz * 2^(shift/12)
    # Player must be at or above this (minus tolerance)

    # UWU Detection thresholds
    "dtw_threshold": 8.0,            # DTW normalization ceiling
    "min_voiced_ratio": 0.25,        # At least 25% of frames must be voiced
    "pitch_tolerance": 5.0,          # Allow 5 semitones below target pitch

    # Recording
    "recording_duration_sec": 3.5,   # How long to record player input
    "silence_threshold_db": -40,     # Below this = silence

    # Audio
    "sample_rate": 44100,
    "hop_length": 512,
}
```

### 4.8 Main App (`main.py`)

```python
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
import numpy as np
from pathlib import Path

from game_manager import GameManager
from audio_processor import AudioProcessor
from uwu_detector import UWUDetector
from pitch_shifter import PitchShifter
from config import CONFIG

app = FastAPI(title="FIGHT UWU BIRD API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
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
    pitch_shifter = PitchShifter(str(ASSETS_DIR / "uwu_sound_1.mp3"))
    pitch_shifter.pregenerate(CONFIG["round_shifts"], str(ASSETS_DIR))

    # 2. Extract template contour from base
    contour_data = audio_processor.extract_contour(pitch_shifter.y_base)
    template = contour_data["contour_semitones"]
    np.save(str(ASSETS_DIR / "uwu_template.npy"), template)

    # 3. Store base pitch
    CONFIG["base_pitch_hz"] = contour_data["median_hz"]

    # 4. Initialize detector
    uwu_detector = UWUDetector(template, CONFIG)

    print(f"✅ Loaded base call. Median pitch: {CONFIG['base_pitch_hz']:.1f} Hz")
    print(f"✅ Pre-generated {len(CONFIG['round_shifts'])} pitch variants")


# --- Routes ---

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

    return FileResponse(
        str(audio_file),
        media_type="audio/wav",
        headers={
            "X-Round": str(session.current_round),
            "X-Pitch-Shift": str(CONFIG["round_shifts"][round_idx]),
        },
    )


@app.post("/api/game/{session_id}/analyze")
async def analyze_player_audio(session_id: str, audio: UploadFile = File(...)):
    session = game_manager.get_session(session_id)
    if not session:
        raise HTTPException(404, "Session not found")

    if session.status.value in ("game_won", "game_lost"):
        raise HTTPException(400, "Game already over")

    # Read and process audio
    audio_bytes = await audio.read()
    if len(audio_bytes) < 1000:
        raise HTTPException(400, "Audio file too small")

    y = audio_processor.load_audio(audio_bytes)
    contour_data = audio_processor.extract_contour(y)

    # Calculate target pitch for this round
    round_idx = session.current_round - 1
    shift = CONFIG["round_shifts"][round_idx]
    target_hz = CONFIG["base_pitch_hz"] * (2 ** (shift / 12.0))

    # Run detection
    analysis = uwu_detector.analyze(contour_data, target_hz)

    # Advance game state
    session = game_manager.advance_round(session_id, analysis["passed"])

    # Build response
    result = None
    next_round = None
    if session.status.value == "game_won":
        result = "win"
        message = "🎉 The bird falls silent... YOU WIN!"
    elif session.status.value == "game_lost":
        result = "lose"
        message = analysis.get("failure_reason", "The bird out-uwu'd you!")
    else:
        next_round = session.current_round
        message = f"Nice uwu! The bird calls back even higher... (Round {next_round})"

    return {
        "session_id": session_id,
        "round": round_idx + 1,
        "contour_match": analysis["contour_match"],
        "contour_score": analysis["contour_score"],
        "pitch_match": analysis["pitch_match"],
        "player_median_pitch_hz": round(analysis["player_median_hz"], 2),
        "target_min_pitch_hz": round(target_hz, 2),
        "passed": analysis["passed"],
        "next_round": next_round,
        "game_over": result is not None,
        "result": result,
        "message": message,
    }
```

---

## 5. Frontend (React + Vite)

### 5.1 Project Structure

```
frontend/
├── index.html
├── vite.config.js
├── package.json
├── public/
│   └── bird-icon.svg
├── src/
│   ├── main.jsx
│   ├── App.jsx
│   ├── components/
│   │   ├── FightButton.jsx         # The main "FIGHT UWU BIRD" button
│   │   ├── GameArena.jsx           # Round display, status, bird animation
│   │   ├── RecordingIndicator.jsx  # Pulsing mic icon during recording
│   │   ├── ResultScreen.jsx        # WIN/LOSE display with animation
│   │   └── PitchVisualizer.jsx     # Optional: live pitch contour display
│   ├── hooks/
│   │   ├── useAudioRecorder.js     # Mic capture → WAV blob
│   │   ├── useAudioPlayer.js       # Play bird call from backend
│   │   └── useGameSession.js       # API calls, game state management
│   ├── api/
│   │   └── gameApi.js              # Fetch wrappers for backend endpoints
│   └── styles/
│       └── app.css
```

### 5.2 Game State Machine (Frontend)

```
IDLE
  │
  ▼ (user presses FIGHT UWU BIRD)
START → POST /api/game/start
  │
  ▼
BIRD_CALLING → GET /bird-call → play audio
  │
  ▼ (audio finishes playing)
PLAYER_TURN → start mic recording (3.5 sec)
  │
  ▼ (recording complete)
ANALYZING → POST /analyze (send WAV blob)
  │
  ├─ passed=true, game_over=false → BIRD_CALLING (next round)
  ├─ passed=true, game_over=true  → WIN_SCREEN
  └─ passed=false                 → LOSE_SCREEN
```

### 5.3 Audio Recorder Hook (`useAudioRecorder.js`)

Key implementation details:

```javascript
// Uses MediaRecorder API to capture mic audio
// IMPORTANT: Must request WAV/PCM format for backend compatibility
// If MediaRecorder doesn't support WAV natively, capture as webm
// and convert to WAV client-side using AudioContext.

export function useAudioRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioContextRef = useRef(null);

  const startRecording = async (durationMs = 3500) => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,   // Important: prevent feedback from speaker
        noiseSuppression: true,
        sampleRate: 44100,
      }
    });

    // Use AudioContext + ScriptProcessor/AudioWorklet to capture raw PCM
    // Then encode as WAV for backend
    const audioContext = new AudioContext({ sampleRate: 44100 });
    const source = audioContext.createMediaStreamSource(stream);

    // Collect raw samples
    const chunks = [];
    const processor = audioContext.createScriptProcessor(4096, 1, 1);
    processor.onaudioprocess = (e) => {
      chunks.push(new Float32Array(e.inputBuffer.getChannelData(0)));
    };

    source.connect(processor);
    processor.connect(audioContext.destination);
    setIsRecording(true);

    // Auto-stop after duration
    return new Promise((resolve) => {
      setTimeout(() => {
        processor.disconnect();
        source.disconnect();
        stream.getTracks().forEach(t => t.stop());
        audioContext.close();
        setIsRecording(false);

        // Encode collected samples as WAV blob
        const wavBlob = encodeWAV(chunks, 44100);
        resolve(wavBlob);
      }, durationMs);
    });
  };

  return { startRecording, isRecording };
}

function encodeWAV(chunks, sampleRate) {
  // Concatenate all chunks
  const length = chunks.reduce((acc, c) => acc + c.length, 0);
  const samples = new Float32Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    samples.set(chunk, offset);
    offset += chunk.length;
  }

  // Convert to 16-bit PCM
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  // WAV header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);        // PCM
  view.setUint16(22, 1, true);        // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, 'data');
  view.setUint32(40, samples.length * 2, true);

  // PCM samples
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

function writeString(view, offset, str) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}
```

### 5.4 UI Design Notes

**Idle State:**
- Large centered button: **"FIGHT UWU BIRD"** with a bird silhouette icon
- Dark/moody background (nighttime setting — Koels call at night)
- Subtle animated stars or moon

**Active Game:**
- Bird character on one side, player silhouette on the other
- Round indicator: "Round 1/3", "Round 2/3", "Round 3/3"
- When bird is calling: bird animates (flapping, glowing), sound waves emanate
- When player's turn: mic icon pulses red, countdown timer (3.5s)
- When analyzing: spinning/loading indicator

**Win Screen:**
- Big green "YOU WIN!" text with confetti animation
- Bird character shrinks and flies away
- "The bird has been silenced. Peace at last."

**Lose Screen:**
- Big red "YOU LOSE" text
- Bird character grows larger, looks smug
- "The bird's uwu echoes through the night..."
- "Try Again" button

---

## 6. Echo Cancellation Strategy

**Critical concern:** When the bird's call plays through the speaker and the mic is recording shortly after, the mic may pick up residual echo of the bird's call rather than the player's voice. This could cause false positive matches.

**Mitigations (in priority order):**

1. **Sequential, not simultaneous:** Bird call plays first, THEN recording starts (with a 500ms gap). No overlap.

2. **Browser echo cancellation:** The `getUserMedia` constraint `echoCancellation: true` handles most of this in modern browsers.

3. **Spectral subtraction (backend fallback):** If echo is detected, subtract the known bird call spectrum from the recording:
   ```python
   # Simple spectral gate: suppress frequencies that match the bird call
   bird_spectrum = np.abs(librosa.stft(y_bird))
   player_spectrum = np.abs(librosa.stft(y_player))
   mask = player_spectrum > (bird_spectrum * 1.5)  # Only keep player's energy
   cleaned = player_spectrum * mask
   ```

4. **Instruct the player:** UI hint: "Use headphones for best results!"

---

## 7. Testing Checkpoints

### ✅ Checkpoint 1: Audio Asset Pipeline
**Goal:** Verify the base bird call loads, processes, and pitch-shifts correctly.

**Tests:**
- [ ] `uwu_sound_1.mp3` loads without errors via librosa
- [ ] Trimmed audio is between 0.5s and 5s long
- [ ] Normalized audio peak is at -3 dBFS (±1 dB)
- [ ] Pitch contour extraction produces non-NaN values for >50% of frames
- [ ] Base median pitch is in the expected range (500–2000 Hz for a Koel)
- [ ] Pitch-shifted variants at +4 and +8 semitones play back correctly
- [ ] Shifted audio sounds natural (no robotic artifacts)

**How to test:**
```bash
cd backend
python -c "
from pitch_shifter import PitchShifter
from audio_processor import AudioProcessor

ps = PitchShifter('assets/uwu_sound_1.mp3')
ps.pregenerate([0, 4, 8], 'assets/')

ap = AudioProcessor()
contour = ap.extract_contour(ps.y_base)
print(f'Median pitch: {contour[\"median_hz\"]:.1f} Hz')
print(f'Voiced ratio: {contour[\"voiced_ratio\"]:.2f}')
print(f'Contour length: {len(contour[\"contour_semitones\"])} frames')
print('✅ Asset pipeline OK' if contour['voiced_ratio'] > 0.3 else '❌ Low voiced ratio')
"
```

---

### ✅ Checkpoint 2: UWU Detection Logic
**Goal:** Verify the detector correctly identifies uwu-like sounds and rejects non-uwu sounds.

**Tests:**
- [ ] Original bird call (round 1) analyzed against itself → high contour score (>0.8)
- [ ] Pitch-shifted bird call (round 2) analyzed → contour matches, pitch matches
- [ ] Human saying "uwu" → contour score > 0.35 (should pass)
- [ ] Human saying "ahhh" (monotone) → contour score < 0.35 (should fail)
- [ ] Silence → rejected with "not enough sound" message
- [ ] Random noise → rejected with low contour score
- [ ] Human uwu at too low a pitch → contour passes, pitch fails

**How to test:**
```bash
# Record test samples:
# 1. Play the bird call into mic → save as test_bird_echo.wav
# 2. Say "uwu" into mic → save as test_human_uwu.wav
# 3. Say "ahhh" into mic → save as test_monotone.wav
# 4. Record silence → save as test_silence.wav

python -c "
from uwu_detector import UWUDetector
from audio_processor import AudioProcessor
import numpy as np

ap = AudioProcessor()
template = np.load('assets/uwu_template.npy')
config = {'dtw_threshold': 8.0, 'min_voiced_ratio': 0.25, 'pitch_tolerance': 5.0}
detector = UWUDetector(template, config)

for test_file, label in [
    ('test_bird_echo.wav', 'bird echo'),
    ('test_human_uwu.wav', 'human uwu'),
    ('test_monotone.wav', 'monotone'),
    ('test_silence.wav', 'silence'),
]:
    y = ap.load_audio(open(test_file, 'rb').read())
    contour = ap.extract_contour(y)
    result = detector.analyze(contour, target_pitch_hz=600.0)
    print(f'{label:15s} → score={result[\"contour_score\"]:.3f} '
          f'match={result[\"contour_match\"]} '
          f'passed={result[\"passed\"]} '
          f'reason={result[\"failure_reason\"]}')
"
```

---

### ✅ Checkpoint 3: Backend API Integration
**Goal:** Full API loop works end-to-end.

**Tests:**
- [ ] `POST /api/game/start` returns valid session ID
- [ ] `GET /api/game/{id}/bird-call` returns playable WAV audio
- [ ] `POST /api/game/{id}/analyze` with a good uwu WAV → `passed: true`
- [ ] `POST /api/game/{id}/analyze` with silence → `passed: false`
- [ ] Full 3-round winning game completes with `result: "win"`
- [ ] Losing on round 2 returns `result: "lose"` and `game_over: true`
- [ ] Expired/invalid session ID → 404 error
- [ ] Second analyze call after game over → 400 error

**How to test:**
```bash
# Start backend
cd backend && uvicorn main:app --reload --port 8000

# Test with curl
SESSION=$(curl -s -X POST http://localhost:8000/api/game/start | jq -r .session_id)
echo "Session: $SESSION"

# Get bird call
curl -s http://localhost:8000/api/game/$SESSION/bird-call -o /tmp/bird_round1.wav
file /tmp/bird_round1.wav  # Should say: RIFF ... WAVE audio

# Analyze (using a test WAV)
curl -s -X POST http://localhost:8000/api/game/$SESSION/analyze \
  -F "audio=@test_human_uwu.wav" | jq .
```

---

### ✅ Checkpoint 4: Frontend Mic Capture
**Goal:** Browser correctly captures audio and produces a valid WAV blob.

**Tests:**
- [ ] Mic permission prompt appears on first use
- [ ] Recording indicator shows during capture
- [ ] WAV blob is non-empty (> 10KB for 3.5s of audio)
- [ ] WAV blob plays back correctly when loaded into an `<audio>` element
- [ ] Echo cancellation is active (check via `getSettings()` on the track)
- [ ] Recording auto-stops after 3.5 seconds

**How to test:**
```javascript
// In browser console on the frontend:
const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
const settings = stream.getAudioTracks()[0].getSettings();
console.log('Echo cancellation:', settings.echoCancellation);
console.log('Sample rate:', settings.sampleRate);
stream.getTracks().forEach(t => t.stop());
```

---

### ✅ Checkpoint 5: Full Game Loop (End-to-End)
**Goal:** Complete game is playable from button press to win/lose screen.

**Tests:**
- [ ] Press "FIGHT UWU BIRD" → bird call plays through speakers
- [ ] After bird call → mic recording starts with visual indicator
- [ ] Player says "uwu" → recording sent to backend → response received
- [ ] On pass → next round bird call plays (audibly higher pitch)
- [ ] Win all 3 rounds → "YOU WIN" screen with animation
- [ ] Fail a round → "YOU LOSE" screen with appropriate message
- [ ] "Try Again" button resets to idle state
- [ ] Game works on Chrome desktop
- [ ] Game works on Chrome mobile (Android)
- [ ] Game works on Safari mobile (iOS) — test mic permissions carefully

**How to test:**
Play through the game manually. Recruit 3-5 testers for different devices/browsers.

---

### ✅ Checkpoint 6: Tuning & Polish
**Goal:** Detection thresholds feel fair and fun.

**Tests:**
- [ ] Most people can pass round 1 easily (>90% success rate)
- [ ] Round 2 is moderately challenging (~60-70% success rate)
- [ ] Round 3 is hard but possible (~30-50% success rate)
- [ ] Adjust `dtw_threshold`, `pitch_tolerance`, and `min_voiced_ratio` based on playtesting
- [ ] False positives (passing when player didn't actually uwu) are rare (<5%)
- [ ] Error messages are helpful and funny
- [ ] Audio latency between bird call ending and recording starting is < 700ms

**Tuning procedure:**
```
1. Have 5+ people play 3 games each
2. Log all contour_score and pitch values
3. Plot distribution of scores for passes vs. fails
4. Adjust thresholds so the overlap zone is small
5. Repeat until difficulty curve feels right
```

---

## 8. Dependencies

### Backend (`requirements.txt`)
```
fastapi==0.109.0
uvicorn==0.27.0
python-multipart==0.0.6
librosa==0.10.1
soundfile==0.12.1
numpy==1.26.3
dtw-python==1.3.0
pandas==2.1.4
```

### Frontend (`package.json` dependencies)
```json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.2.0",
    "vite": "^5.0.0"
  }
}
```

---

## 9. Known Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Browser mic API differences (especially Safari) | Game broken on some browsers | Feature-detect MediaRecorder; fallback to ScriptProcessor; test early on Safari |
| librosa pitch detection fails on noisy input | False negatives, frustrating gameplay | Lower `min_voiced_ratio`, add pre-processing (bandpass filter 200-3000 Hz) |
| DTW too strict/loose for real human voices | Game too hard or trivially easy | Extensive playtesting at Checkpoint 6; expose threshold as admin config |
| Echo of bird call detected as player's uwu | False positives | 500ms gap + echoCancellation + headphones recommendation |
| High latency on audio upload/analysis | Breaks flow of the game | Compress WAV before upload (or use opus); keep backend on same machine for dev |
| Mobile browser audio autoplay policies | Bird call won't play | Ensure first interaction is a user gesture (button click); use AudioContext.resume() |

---

## 10. Future Enhancements (v2)

- **Difficulty modes:** Easy (generous thresholds, 2 rounds), Normal (3 rounds), Hard (strict thresholds, 4 rounds)
- **Live pitch visualizer:** Show player's pitch contour in real-time during recording vs. the target
- **Multiplayer:** Two players take turns trying to out-uwu each other
- **Bird species selection:** Different birds with different call patterns
- **Leaderboard:** Fastest win time, highest contour match scores
- **Sound effects:** Ambient night sounds, bird wing flaps, victory/defeat jingles
