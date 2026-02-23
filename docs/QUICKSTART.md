# QUICKSTART GUIDE - FIGHT UWU BIRD

## 30 Second Setup

### Terminal 1 (Backend)
```bash
cd UWU/backend
conda activate uwu
uvicorn main:app --reload --port 8000
```

Watch for:
```
INFO:     Application startup complete
INFO:     Loaded base call. Median pitch: 1174.7 Hz
INFO:     Pre-generated 3 pitch variants
INFO:     Uvicorn running on http://127.0.0.1:8000
```

### Terminal 2 (Frontend)
```bash
cd UWU/frontend
npm run dev
```

Watch for:
```
VITE v5.0.0  ready in ... ms

➜  Local:   http://localhost:5173/
```

### Browser
Open `http://localhost:5173` and click **"START GAME"**

---

## What Happens

1. **Bird Calls** - You hear a "UWU" sound
2. **Your Turn** - Mic records for 3.5 seconds (mic icon pulses red)
3. **Say "UWU"** - Match the bird's pitch or go higher
4. **Result** - Pass/Fail displayed
5. **Rounds** - 2 more rounds with higher pitches
6. **Win** - All 3 rounds passed!

---

## Testing Checkpoints

### ✅ Checkpoint 1 & 2: Already Verified
```bash
cd backend
python << 'EOF'
from pitch_shifter import PitchShifter
from audio_processor import AudioProcessor
from uwu_detector import UWUDetector
import numpy as np

ps = PitchShifter("assets/uwu_sound_1.mp3")
ps.pregenerate([0, 4, 8], "assets/")

ap = AudioProcessor()
contour = ap.extract_contour(ps.y_base)
print(f"✓ Audio: {contour['median_hz']:.0f} Hz, {contour['voiced_ratio']:.0%} voiced")

template = np.load("assets/uwu_template.npy")
config = {'dtw_threshold': 8.0, 'min_voiced_ratio': 0.25, 'pitch_tolerance': 5.0}
detector = UWUDetector(template, config)
result = detector.analyze(contour, target_pitch_hz=1174.7)
print(f"✓ Detection: {result['contour_score']:.3f} score, Pass: {result['passed']}")
EOF
```

### 🧪 Checkpoint 3: API Test
```bash
# Terminal 3, while backend is running
curl -X POST http://localhost:8000/api/game/start | python -m json.tool
```

Should return:
```json
{
  "session_id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "round": 1,
  "max_rounds": 3,
  "message": "The bird is calling... listen carefully!"
}
```

### 🎙️ Checkpoint 4: Mic Test
1. Open http://localhost:5173
2. Click "START GAME"
3. You should see a **permission popup** asking for mic access
4. **Allow** the permission
5. You'll see a **red pulsing mic icon** counting down 3.5 seconds
6. **Say "UWU"** into the mic

### 🎮 Checkpoint 5: Full Game
1. Complete all 3 rounds successfully
2. See the **"YOU WIN!"** screen
3. Click "Play Again" to restart

---

## Difficulty Guide

**Round 1 (Easiest)** - Natural bird pitch (~1175 Hz)
- Just say "uwu" at a similar pitch
- >90% of people should pass

**Round 2 (Medium)** - +4 semitones higher (~1397 Hz)
- Need to go noticeably higher
- ~60-70% pass rate expected

**Round 3 (Hard)** - +8 semitones higher (~1760 Hz)
- Significantly higher pitch, challenging
- ~30-50% pass rate expected

**Tips for Players:**
- Use headphones to avoid echo
- Speak clearly into the mic
- Match the bird's pitch contour (the "uwu" shape)
- Try to go as high as you can

---

## Tuning Parameters

Edit `backend/config.py` to adjust difficulty:

```python
CONFIG = {
    # Make easier:
    "dtw_threshold": 12.0,         # (increase from 8.0)
    "min_voiced_ratio": 0.15,      # (decrease from 0.25)
    "pitch_tolerance": 8.0,        # (increase from 5.0)

    # Make harder:
    "dtw_threshold": 4.0,          # (decrease from 8.0)
    "min_voiced_ratio": 0.35,      # (increase from 0.25)
    "pitch_tolerance": 2.0,        # (decrease from 5.0)
}
```

**After changing:** Backend auto-reloads (due to `--reload` flag)

---

## Troubleshooting

### Backend won't start
```bash
# Check port 8000 is free
lsof -i :8000  # On Mac/Linux
netstat -ano | findstr :8000  # On Windows

# Or use different port
uvicorn main:app --reload --port 8001
```

### Mic not working
- Check browser console (F12 → Console tab)
- Look for permission errors
- Try different browser (Chrome works best)
- Ensure localhost or HTTPS

### "Module not found"
```bash
conda activate uwu  # Activate environment
```

### Weird audio quality
- Use headphones
- Check system mic is working
- Test with Voice Memo app first

---

## File Structure Reference

```
UWU/
├── backend/
│   ├── main.py            ← FastAPI server
│   ├── config.py          ← Tuning parameters
│   ├── audio_processor.py ← Pitch detection
│   ├── uwu_detector.py    ← DTW matching
│   ├── pitch_shifter.py   ← Generate variants
│   ├── game_manager.py    ← Session management
│   ├── assets/
│   │   ├── uwu_sound_1.mp3
│   │   ├── uwu_*.wav      ← Generated
│   │   └── uwu_template.npy ← Generated
│   └── requirements.txt
│
├── frontend/
│   ├── src/
│   │   ├── main.jsx
│   │   ├── App.jsx        ← Main controller
│   │   ├── components/    ← UI components
│   │   ├── hooks/         ← State & audio logic
│   │   ├── api/           ← API calls
│   │   └── styles/        ← CSS
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
│
├── README.md
├── IMPLEMENTATION_STATUS.md
└── QUICKSTART.md          ← You are here
```

---

## Quick Commands

```bash
# Start everything
# Terminal 1:
cd backend && conda activate uwu && uvicorn main:app --reload --port 8000

# Terminal 2:
cd frontend && npm run dev

# Test API (Terminal 3):
curl http://localhost:8000/api/health

# Rebuild frontend
cd frontend && npm run build

# Clear generated audio files
rm backend/assets/uwu_round_*.wav backend/assets/uwu_base.wav backend/assets/uwu_template.npy

# View logs
cat /tmp/server.log  # Backend logs
```

---

## Success Criteria

✅ **Game is working when:**
- Backend starts without errors
- Frontend loads on localhost:5173
- Mic permission popup appears
- Can hear bird call
- Mic records (3.5s countdown)
- Backend analyzes and returns result
- Can complete game and see win/lose screen

---

## Need Help?

1. Check browser console (F12) for JavaScript errors
2. Check backend terminal for Python errors
3. Read full README.md for detailed documentation
4. Check IMPLEMENTATION_STATUS.md for what's ready

**Everything is ready to run! Just start the two servers and open your browser.** 🚀
