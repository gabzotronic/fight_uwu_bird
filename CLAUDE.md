# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**FIGHT UWU BIRD** is a pitch-based audio game where players compete in a 3-round battle against a simulated Koel bird. Players must match and exceed the bird's pitch using their voice while their recording is analyzed in real-time.

- **Core Challenge**: Pitch detection + Dynamic Time Warping (DTW) matching + pitch validation
- **Stack**: Python/FastAPI backend + React/Vite frontend
- **Status**: Core gameplay functional; ready for testing and tuning

## Development Commands

### Backend
```bash
# Activate conda environment (required)
conda activate uwu

# Run development server with auto-reload (localhost only)
cd backend
uvicorn main:app --reload --port 8000

# Run on all network interfaces (expose to phone/other devices)
cd backend
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# Run tests
cd backend && python -m pytest tests/

# Test individual components manually
python << 'EOF'
from audio_processor import AudioProcessor
from uwu_detector import UWUDetector
from pitch_shifter import PitchShifter
# ... test code here
EOF
```

### Frontend
```bash
# Development server (localhost only on :5173)
cd frontend
npm run dev

# Development server on all network interfaces (expose to phone/other devices)
cd frontend
npm run dev -- --host 0.0.0.0

# Build for production
npm run build

# Preview production build
npm run preview
```

### Testing
```bash
# Start both servers in separate terminals:
# Terminal 1: cd backend && conda activate uwu && uvicorn main:app --reload --port 8000
# Terminal 2: cd frontend && npm run dev

# Then open http://localhost:5173 in browser

# Quick API health check
curl http://localhost:8000/api/health
```

## High-Level Architecture

### Backend (Python FastAPI)

**Startup Flow:**
1. Load `assets/uwu_sound_1.mp3` via `PitchShifter`
2. Generate 3 pitch-shifted variants (stored as WAV files)
3. Extract pitch contour template from base audio (stored as NumPy array)
4. Initialize `GameManager` and `AudioProcessor` for runtime use

**Key Components:**
- **main.py** (60+ lines): FastAPI app, route handlers, CORS configuration
  - `POST /api/game/start`: Create new game session
  - `GET /api/game/{session_id}/bird-call`: Fetch bird audio for current round
  - `POST /api/game/{session_id}/analyze`: Process player audio submission
  - `GET /api/health`: Health check
- **game_manager.py**: Session state (round tracking, game status)
- **audio_processor.py**: Librosa pitch extraction (pyin algorithm)
- **uwu_detector.py**: DTW-based contour matching + pitch range validation
- **pitch_shifter.py**: Librosa pitch shifting to generate round variants
- **config.py**: Tuning parameters (thresholds, audio settings)

**Audio Pipeline:**
```
Input (WAV 16-bit 44100Hz) → Librosa pyin → Pitch contour (F0 over time)
→ Normalize to semitones → Smooth (5-frame MA) → DTW matching + pitch check
```

### Frontend (React + Vite + Plotly.js)

**Component Hierarchy:**
```
App.jsx (main controller, state orchestration)
├── FightButton (start game button)
├── GameArena (play bird call, show recording countdown)
├── RecordingIndicator (red pulsing mic icon)
└── ResultScreen (pass/fail with pitch visualization)
```

**State Management:**
- `useGameSession.js`: Backend API calls, game state (round, session_id, result)
- `useAudioRecorder.js`: Microphone capture, WAV encoding, blob generation
- `useAudioPlayer.js`: Bird call playback

**Audio Recording:**
- Uses `navigator.mediaDevices.getUserMedia()` for mic access
- Records as WAV (16-bit, 44100 Hz, mono)
- 3.5 second recording with visual countdown
- Automatic echo cancellation enabled

**Visualization:**
- Plotly.js pitch contour graph (interactive)
- Shows bird's template (green) vs player's recording (blue)
- Displays pitch tolerance range (±10 semitones default)

## Key Implementation Details

### Detection Algorithm (backend/uwu_detector.py)

1. **Voiced Ratio Check**: At least 5% of frames must have detected pitch (prevents silence from passing)
2. **Contour Matching (DTW)**: Dynamic Time Warping compares shape similarity
   - Normalized by warping path length
   - Threshold: 10.0 (lower is stricter match required)
3. **Pitch Validation**: Player's median pitch must be within tolerance of target
   - Default tolerance: ±10 semitones
4. **Pass Condition**: Both contour AND pitch checks must pass

### Game State Flow

```
IDLE → START (session created)
     → BIRD_CALLING (audio fetched, played)
     → 500ms gap (echo prevention)
     → PLAYER_TURN (recording enabled for 3.5s)
     → ANALYZING (audio sent to backend)
     → RESULT (pass/fail displayed)
     → next round OR game_over
```

### Audio Files

Generated at startup in `backend/assets/`:
- `uwu_base.wav` (normalized base audio)
- `uwu_round_1.wav` through `uwu_round_3.wav` (pitch-shifted variants)
- `uwu_template.npy` (NumPy array: pitch contour for matching)

Original source: `assets/uwu_sound_1.mp3`

## Configuration & Tuning

All tuning parameters in `backend/config.py`:

```python
"round_shifts": [-5, -2, 0]      # Semitone shifts (relative to base)
"dtw_threshold": 10.0             # Lower = stricter contour matching
"min_voiced_ratio": 0.05          # Minimum % of voiced frames needed
"pitch_tolerance": 10.0           # Semitones tolerance for pitch range
"recording_duration_sec": 3.5     # Player recording time
```

**Difficulty Adjustments:**
- **Easier**: Increase `dtw_threshold`, decrease `min_voiced_ratio`, increase `pitch_tolerance`
- **Harder**: Decrease `dtw_threshold`, increase `min_voiced_ratio`, decrease `pitch_tolerance`

Backend auto-reloads when config is changed (due to `--reload` flag).

## Testing on Mobile/Same Network

**Local IP Address: `192.168.68.54`**

To test the game on your phone over the same network:

1. **Start backend on all interfaces:**
   ```bash
   cd backend && conda activate uwu
   uvicorn main:app --reload --host 0.0.0.0 --port 8000
   ```

2. **Start frontend on all interfaces:**
   ```bash
   cd frontend
   npm run dev -- --host 0.0.0.0
   ```

3. **On your phone's browser**, visit:
   ```
   http://192.168.68.54:5173
   ```

**Important Notes:**
- Ensure phone is on the same WiFi network
- Allow microphone permission when prompted
- Windows Firewall may ask for access—allow it
- CORS is configured to allow `http://192.168.68.54:5173`
- 500ms gap between audio playback and recording helps reduce echo on mobile

## Testing Checkpoints

From README.md:
- **Checkpoint 1** ✓: Audio asset pipeline (pitch extraction, shifting)
- **Checkpoint 2** ✓: UWU detection logic (DTW matching, validation)
- **Checkpoint 3**: Backend API integration (test endpoints manually)
- **Checkpoint 4**: Frontend mic capture (browser permissions, recording)
- **Checkpoint 5**: Full game loop (complete all 3 rounds)
- **Checkpoint 6**: Tuning & playtesting (adjust thresholds, gather feedback)

## Common Tasks

### Adding New Game Round
1. Modify `"round_shifts"` in `config.py`
2. Backend auto-loads on restart (adjust `max_rounds` in `game_manager.py`)
3. Thresholds automatically calculated from base pitch

### Adjusting Difficulty
1. Edit `backend/config.py` thresholds
2. Server auto-reloads (no backend restart needed)
3. Test with curl or frontend

### Debugging Audio Issues
- Check browser console (F12) for mic permission errors
- Backend logs show pitch detection results
- Check that `uwu_sound_1.mp3` exists in `backend/assets/`
- Use headphones to avoid echo during testing

### Frontend Styling Changes
- CSS in `frontend/src/styles/app.css`
- Vite hot-reload applies changes instantly
- Component structure in `frontend/src/components/`

## Dependencies & Tools

**Backend:**
- fastapi (web framework)
- uvicorn (ASGI server)
- librosa (audio analysis, pitch detection via pyin)
- soundfile (WAV I/O)
- numpy, scipy (numerical computing)
- dtw-python (Dynamic Time Warping)
- Python 3.11+

**Frontend:**
- React 18 (UI library)
- Vite 5 (build tool, dev server on :5173)
- Plotly.js (interactive pitch visualization)
- Node 16+ (npm package manager)

**Environment:**
- Conda environment: `uwu` (pre-configured)
- Windows 11 Pro (development platform)

## File Structure Reference

```
UWU/
├── CLAUDE.md                          (this file)
├── README.md                          (full documentation)
├── QUICKSTART.md                      (30-second setup guide)
├── requirements.txt                   (Python dependencies)
│
├── backend/
│   ├── main.py                        (FastAPI server, routes)
│   ├── game_manager.py                (session/state management)
│   ├── audio_processor.py             (pitch detection)
│   ├── uwu_detector.py                (DTW matching + validation)
│   ├── pitch_shifter.py               (variant generation)
│   ├── config.py                      (tuning parameters)
│   ├── assets/
│   │   ├── uwu_sound_1.mp3           (source audio)
│   │   ├── uwu_*.wav                 (generated variants)
│   │   └── uwu_template.npy          (reference contour)
│   └── tests/                         (unit tests)
│
└── frontend/
    ├── package.json                   (npm dependencies)
    ├── vite.config.js                 (build configuration)
    ├── index.html                     (entry point)
    └── src/
        ├── main.jsx                   (React mount)
        ├── App.jsx                    (main controller)
        ├── components/                (UI components)
        │   ├── FightButton.jsx
        │   ├── GameArena.jsx
        │   ├── RecordingIndicator.jsx
        │   └── ResultScreen.jsx
        ├── hooks/                     (custom hooks)
        │   ├── useGameSession.js
        │   ├── useAudioRecorder.js
        │   └── useAudioPlayer.js
        ├── api/                       (API wrapper)
        │   └── gameApi.js
        └── styles/
            └── app.css
```

## Notes for Future Development

- **CORS**: Currently allows localhost:5173 and localhost:3000 only
- **Echo Prevention**: 500ms gap between bird call playback and recording start
- **Pitch Detection**: Uses Librosa's pyin algorithm (probabilistic YIN), robust to noise
- **DTW Matching**: Compares contour shape, not absolute pitch
- **Mobile**: Frontend responsive but audio recording behavior differs on iOS Safari
- **Performance**: Audio analysis typically <200ms; Vite dev server very fast for frontend changes

## Quick Debugging Checklist

- Backend won't start? Check `conda activate uwu`, ensure port 8000 free, verify audio asset exists
- Mic not working? Check browser console for permission errors, try different browser, ensure HTTPS or localhost
- Generated audio files missing? Delete old files in `backend/assets/`, restart backend (regenerates on startup)
- Frontend not loading? Ensure `npm install` completed, check Vite server on :5173
- Inconsistent game results? Check `config.py` thresholds, review backend logs for pitch detection values
