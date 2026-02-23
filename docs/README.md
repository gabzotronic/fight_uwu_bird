# FIGHT UWU BIRD - Technical Implementation

A pitch-based audio game where players compete against a simulated Koel bird in a 3-round battle of escalating pitch challenges.

## Project Status

- **Checkpoint 1: Audio Asset Pipeline** ✓ PASSED
- **Checkpoint 2: UWU Detection Logic** ✓ PASSED
- **Checkpoint 3: Backend API Integration** - Ready for testing
- **Checkpoint 4: Frontend Mic Capture** - Ready for testing
- **Checkpoint 5: Full Game Loop (End-to-End)** - Pending
- **Checkpoint 6: Tuning & Polish** - Pending

## Setup & Installation

### 1. Backend Setup

Ensure you have Python 3.11 and the `uwu` conda environment:

```bash
# The environment is already created with all dependencies
conda activate uwu
```

### 2. Frontend Setup

```bash
cd frontend
npm install  # Already done
```

## Running the Application

### Start the Backend Server

```bash
cd backend
conda activate uwu
uvicorn main:app --reload --port 8000
```

The backend will:
- Load `assets/uwu_sound_1.mp3`
- Process and normalize the audio
- Generate 3 pitch-shifted variants (+0, +4, +8 semitones)
- Extract the pitch contour template
- Start serving on `http://localhost:8000`

### Start the Frontend Dev Server

In a separate terminal:

```bash
cd frontend
npm run dev
```

The frontend will start on `http://localhost:5173` and automatically open in your browser.

### Test the API (Optional)

```bash
# Health check
curl http://localhost:8000/api/health

# Start a game
curl -X POST http://localhost:8000/api/game/start

# This will return a session_id you can use for testing other endpoints
```

## Project Structure

```
UWU/
├── README.md
├── requirements.txt              (Python dependencies)
│
├── backend/
│   ├── main.py                   (FastAPI app & routes)
│   ├── config.py                 (Configuration & tuning parameters)
│   ├── audio_processor.py        (Pitch detection using librosa pyin)
│   ├── pitch_shifter.py          (Generates shifted bird calls)
│   ├── uwu_detector.py           (DTW-based matching algorithm)
│   ├── game_manager.py           (Session state management)
│   ├── assets/                   (Audio files)
│   │   ├── uwu_sound_1.mp3       (Original bird call)
│   │   ├── uwu_base.wav          (Processed base, generated)
│   │   ├── uwu_round_1.wav       (Generated: +0 semitones)
│   │   ├── uwu_round_2.wav       (Generated: +4 semitones)
│   │   ├── uwu_round_3.wav       (Generated: +8 semitones)
│   │   └── uwu_template.npy      (Reference pitch contour, generated)
│   └── tests/                    (Unit tests)
│
└── frontend/
    ├── index.html
    ├── vite.config.js
    ├── package.json
    ├── public/
    └── src/
        ├── main.jsx              (React entry point)
        ├── App.jsx               (Main game controller)
        ├── components/
        │   ├── FightButton.jsx   (Start button)
        │   ├── GameArena.jsx     (Game display)
        │   ├── RecordingIndicator.jsx
        │   └── ResultScreen.jsx  (Win/lose screen)
        ├── hooks/
        │   ├── useGameSession.js (Game state management)
        │   ├── useAudioRecorder.js (Mic capture & WAV encoding)
        │   └── useAudioPlayer.js (Audio playback)
        ├── api/
        │   └── gameApi.js        (API wrapper functions)
        └── styles/
            └── app.css           (Complete styling)
```

## How It Works

### Game Loop

1. **IDLE State**: User clicks "FIGHT UWU BIRD" button
2. **START**: Backend creates game session, returns session_id
3. **BIRD_CALLING**: Frontend fetches and plays bird call for current round
4. **PLAYER_TURN**: 500ms gap, then mic recording starts for 3.5 seconds
5. **ANALYZING**: Frontend sends WAV blob to backend for analysis
6. **Result**:
   - If passed → move to next round or win
   - If failed → display lose screen

### Audio Processing Pipeline

```
Input Audio (WAV 16-bit, 44100 Hz)
    ↓
[Librosa pyin] → Extract pitch contour (F0 over time)
    ↓
[Normalize to semitones] → Convert to semitone scale relative to median
    ↓
[Smooth with kernel] → 5-frame moving average
    ↓
Output: Pitch contour for DTW matching
```

### Detection Algorithm

1. **Voiced Ratio Check**: Must be >25% voiced frames
2. **Contour Matching (DTW)**: Compare shape to template
   - DTW distance normalized by path length
   - Converted to 0-1 score (higher = better match)
   - Threshold: >0.35 for pass
3. **Pitch Check**: Player median pitch must be within 5 semitones of target
4. **Result**: Pass = both contour_match AND pitch_match

## Configuration & Tuning

Edit `backend/config.py` to adjust game difficulty:

```python
"dtw_threshold": 8.0,            # DTW ceiling (increase = easier)
"min_voiced_ratio": 0.25,        # % voiced frames (decrease = easier)
"pitch_tolerance": 5.0,          # Semitone tolerance (increase = easier)
```

## Testing Checkpoints

### Checkpoint 1: Audio Asset Pipeline
✓ Verified that:
- Bird call loads and processes correctly
- Pitch contour extracted with 70% voiced frames
- Base median pitch: 1174.7 Hz (within Koel range)
- Pitch-shifted variants generated successfully

**To test manually:**
```bash
cd backend && python << 'EOF'
from pitch_shifter import PitchShifter
from audio_processor import AudioProcessor

ps = PitchShifter("assets/uwu_sound_1.mp3")
ps.pregenerate([0, 4, 8], "assets/")

ap = AudioProcessor()
contour = ap.extract_contour(ps.y_base)
print(f"Median pitch: {contour['median_hz']:.1f} Hz")
print(f"Voiced ratio: {contour['voiced_ratio']:.2%}")
EOF
```

### Checkpoint 2: UWU Detection Logic
✓ Verified that:
- Bird call matches itself with score 0.977 (excellent)
- Silence is rejected as expected
- Low pitch is rejected even with good contour match
- Round 2 (pitch-shifted) passes correctly

**To test manually:**
```bash
cd backend && python << 'EOF'
import numpy as np
from uwu_detector import UWUDetector
from audio_processor import AudioProcessor

template = np.load("assets/uwu_template.npy")
config = {'dtw_threshold': 8.0, 'min_voiced_ratio': 0.25, 'pitch_tolerance': 5.0}
detector = UWUDetector(template, config)

ap = AudioProcessor()
y = ap.load_audio(open("assets/uwu_base.wav", 'rb').read())
contour = ap.extract_contour(y)
result = detector.analyze(contour, target_pitch_hz=1174.7)
print(f"Score: {result['contour_score']:.3f}, Pass: {result['passed']}")
EOF
```

### Checkpoint 3: Backend API Integration
Ready to test. Run backend server and test endpoints:
```bash
# Start backend
uvicorn main:app --reload --port 8000

# In another terminal
curl -X POST http://localhost:8000/api/game/start
curl http://localhost:8000/api/game/{session_id}/bird-call -o bird.wav
```

### Checkpoint 4: Frontend Mic Capture
Run frontend dev server and test in browser:
```bash
npm run dev
# Open http://localhost:5173
# Check browser console for audio permission requests
# Verify mic icon pulses during recording
```

### Checkpoint 5: Full Game Loop
Play through the game completely:
1. Start backend and frontend
2. Click "FIGHT UWU BIRD"
3. Listen to bird call
4. Say "uwu" at appropriate pitch
5. Verify correct pass/fail
6. Complete all 3 rounds or fail

### Checkpoint 6: Tuning & Polish
Conduct playtesting with 5+ people:
- Round 1: Should be easy (>90% pass rate)
- Round 2: Should be moderate (60-70% pass rate)
- Round 3: Should be hard (30-50% pass rate)

Adjust `config.py` thresholds based on feedback and log analysis.

## API Endpoints

### `POST /api/game/start`
Start a new game session.

**Response:**
```json
{
  "session_id": "uuid-string",
  "round": 1,
  "max_rounds": 3,
  "message": "The bird is calling... listen carefully!"
}
```

### `GET /api/game/{session_id}/bird-call`
Get the bird's call audio for the current round.

**Response:** WAV file (audio/wav)

### `POST /api/game/{session_id}/analyze`
Analyze player's audio recording.

**Request:** multipart/form-data with field `audio` (WAV blob)

**Response:**
```json
{
  "session_id": "uuid-string",
  "round": 1,
  "contour_match": true,
  "contour_score": 0.72,
  "pitch_match": true,
  "player_median_pitch_hz": 523.25,
  "target_min_pitch_hz": 440.0,
  "passed": true,
  "next_round": 2,
  "game_over": false,
  "result": null,
  "message": "Nice uwu! The bird calls back even higher..."
}
```

### `GET /api/health`
Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "base_pitch_hz": 1174.7
}
```

## Troubleshooting

### "Module not found" errors
Make sure you've activated the conda environment:
```bash
conda activate uwu
```

### Backend server won't start
- Ensure port 8000 is not in use
- Check that `assets/uwu_sound_1.mp3` exists
- Check Python path is correct

### Mic not working in browser
- Check browser console for permission errors
- Ensure HTTPS or localhost (required for getUserMedia)
- Try a different browser (Chrome/Firefox work best)
- Check CORS is enabled (already configured)

### Audio quality issues
- Ensure speaker volume is reasonable
- Use headphones to avoid echo
- Check `echo CancellationCancellation: true` is enabled

## Dependencies

### Backend
- **fastapi**: Web framework
- **uvicorn**: ASGI server
- **librosa**: Audio analysis (pitch detection, effects)
- **soundfile**: WAV file I/O
- **numpy**: Numerical computing
- **scipy**: Scientific algorithms
- **scikit-learn**: Machine learning utilities
- **dtw-python**: Dynamic Time Warping
- **pandas**: Data manipulation

### Frontend
- **react**: UI library
- **vite**: Build tool
- **@vitejs/plugin-react**: React support for Vite

## Known Issues & Mitigations

- **Safari iOS**: Media permission flow is different; users must manually grant permission
- **Echo**: Sequential playback + recording with 500ms gap minimizes echo
- **DTW tuning**: Thresholds are set conservatively; adjust based on playtesting
- **Network latency**: Audio analysis is fast (<200ms typically)

## Pitch Contour Visualization

After each round, players see an interactive pitch-time plot showing:

**Components:**
- **Green Line (Template)**: The bird's characteristic pitch contour (reference template)
- **Blue Line (Your Call)**: Your recorded pitch contour
- **Shaded Zone (Acceptable Range)**: Pitch tolerance region (±5 semitones by default)

**What It Shows:**
- X-axis: Time in seconds (0 to ~3.5s)
- Y-axis: Pitch in semitones relative to your median pitch

**How to Read It:**
1. If your blue line overlaps the green line well → Good contour match (DTW score high)
2. If your peak pitch reaches above the target line → Pitch requirement met
3. If you stay within the shaded zone → Pitch validation passed

This visualization provides immediate feedback on:
- How well you matched the bird's pitch shape
- Whether your pitch was high enough for the round
- Exactly where in the call you diverged from the target

**Technical Details:**
- Implemented using Plotly.js for interactivity
- Pitch contours downsampled by 4x to reduce payload
- Responsive design works on desktop and mobile

## Next Steps

1. **Test Checkpoint 4**: Verify browser mic capture works
2. **Test Checkpoint 5**: Play through full game loop
3. **Playtesting**: Run Checkpoint 6 with real users
4. **Tuning**: Adjust thresholds based on feedback
5. **Deployment**: Deploy backend to cloud (AWS Lambda, Heroku, etc.)

---

**Built with ❤️ for the Koel bird enthusiasts of the world.**
