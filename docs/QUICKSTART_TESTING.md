# Quick Start: Test the Battle UI

## TL;DR - Start Both Servers (2 Terminal Windows)

### Terminal 1: Backend
```bash
cd backend
conda activate uwu
uvicorn main:app --reload --port 8000
```
✅ Backend running at http://localhost:8000

### Terminal 2: Frontend
```bash
cd frontend
npm run dev
```
✅ Frontend running at http://localhost:5173

### Browser
Open: http://localhost:5173

---

## What You'll See

### Welcome Screen
- Title: "FIGHT UWU BIRD"
- Button: "FIGHT UWU BIRD"

### Battle Screen (Click Button)
1. **Intro** (3-4 sec)
   - Bird slides in from right with panel
   - Player slides in from left with panel
   - Text animates: "Wild UWU BIRD appeared!" → "Go! YOU!"

2. **Bird Call** (1-2 sec)
   - Bird sprite vibrates
   - Audio plays (the UWU call)
   - Text: "UWU BIRD used SCREECH!"

3. **Recording** (3.5 sec)
   - Player sprite vibrates
   - Text: "YOUR TURN!"
   - Countdown displayed
   - **SPEAK INTO MICROPHONE** (or stay silent to test fail)

4. **Analysis** (2.5 sec)
   - Text: "..."
   - Pitch chart displays (green = bird, blue = you)
   - Shows how well you matched

5. **Result** (1-2 sec)
   - Text: "Round 1 cleared!" (if you passed)
   - OR "Try again!" (if you failed)
   - HP bars update

### Repeat or End
- **Pass all 3 rounds** → Win screen → Video plays
- **Fail 3 times** → Lose screen → Video plays
- **Click "Play Again"** → Back to welcome screen

---

## Quick Testing Scenarios

### Scenario 1: Test Fail Path (Silent Recording)
**Expected**: Fail 3 times, see lose animation
- Click button
- Don't speak during recording (3 times)
- Watch player sprite slide off-screen
- See bird win animation video
- Click Play Again

**Duration**: ~1 minute

### Scenario 2: Test Graphics (Intro Only)
**Expected**: See slide-in animations, panels, bars
- Click button
- Watch intro (don't record, just observe)
- Close tab or refresh

**Duration**: ~5 seconds

### Scenario 3: Test With Real Pitch Matching
**Expected**: Pass some rounds, see bird HP drain
- Click button
- During "YOUR TURN", speak/sing to match the pitch
- Play through multiple rounds
- Watch HP bars drain

**Duration**: ~3-5 minutes (depends on your pitch matching skills)

---

## What to Look For

### Visual Elements
- ✅ Sprites render (woman on left, bird on right)
- ✅ Sprites have crisp pixel edges (not blurry)
- ✅ HP bars visible and color-coded (green/yellow/red)
- ✅ Text animates character-by-character with blinking cursor

### Animations
- ✅ Sprites slide in from edges (chunky/stepped, not smooth)
- ✅ Sprites vibrate during their turns (rapid shaking)
- ✅ HP bars drain smoothly in discrete steps
- ✅ Videos play after win/lose

### Gameplay Flow
- ✅ Each round gets harder (bird's pitch increases)
- ✅ You can retry same round on fail
- ✅ After 3 tries exhausted → Game Over (lose)
- ✅ After all 3 rounds passed → Game Over (win)
- ✅ Can restart with "Play Again"

### Audio/Pitch
- ✅ Bird audio plays automatically
- ✅ Microphone permission requested on first recording
- ✅ Pitch chart shows two lines (reference + your recording)
- ✅ Chart updates with each attempt

---

## Browser Console (Optional Debug)

Open DevTools with **F12** → Console tab

**Good Indicators:**
- No red error messages
- Messages like: "[BIRD_CALLING] Fetching bird call audio..."
- No 404s for sprites/videos

**Bad Indicators:**
- Red errors
- Failed network requests (404)
- "Permission denied" for microphone

---

## Common Issues & Fixes

### Microphone Not Working
- Check browser permissions (address bar icon)
- Try different browser (Chrome/Edge recommended)
- Ensure speakers/headphones connected
- Check Windows Sound settings

### Sprites Not Visible
- Clear browser cache (Ctrl+Shift+Delete)
- Hard refresh (Ctrl+Shift+R)
- Check console for image 404s

### No Audio Playing
- Check volume (system + browser)
- Try a different browser
- Check DevTools Network tab for audio requests

### Build Issues (npm run dev fails)
```bash
# Clean install
rm -rf node_modules package-lock.json
npm install
npm run dev
```

---

## Screenshots / What to Expect

### Battle Screen Layout
```
┌─────────────────────────────────┐
│ [Bird Panel] [Bird Sprite]      │
│   HP: ███████████              │
│                                  │
│ [Player Sprite] [Player Panel]   │
│                          HP: ███  │
│                          Tries: 3 │
├─────────────────────────────────┤
│ [Typewriter Text OR Pitch Chart] │
│                                  │
└─────────────────────────────────┘
```

### HP Colors
- 🟢 Green (66-100%) — Full health
- 🟡 Yellow (33-65%) — Damaged
- 🔴 Red (1-32%) — Critical

---

## Performance Notes

- **First Load**: Takes ~2-3 seconds (Plotly.js is 3MB)
- **Each Round**: ~10-12 seconds (varies based on recording)
- **Total Game**: ~1-5 minutes (depends on passes/fails)

---

## Have Fun!

The game is fully functional and ready to test. Try to match the bird's pitch as closely as you can! 🎤🦜

If you find any issues or have feedback, check the console logs and file any bugs with:
- Browser version
- Screenshot of the issue
- Console error messages (if any)
