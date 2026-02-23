# Battle UI Testing Checkpoints 3-12

## Prerequisites
- Backend running: `uvicorn main:app --port 8000` (with conda activate uwu)
- Frontend running: `npm run dev` on port 5173
- Browser: Open http://localhost:5173

---

## Checkpoint 3: Sprite Assets + Rendering

**Test Steps:**
1. Click "Fight UWU BIRD" button
2. Watch intro sequence

**Visual Verification:**
- [ ] Player sprite (woman with net) appears on bottom-left
- [ ] Bird sprite (dark Koel) appears on top-right
- [ ] Both sprites render at same size, no distortion
- [ ] Sprites have clear pixel/crisp edges (pixelated rendering)
- [ ] Sprites composite cleanly over gray background (no white boxes)
- [ ] No 404 errors in browser console

**Expected Result:** ✅ Both sprites visible, properly scaled, pixelated art style preserved

---

## Checkpoint 4: HP Bars

**Test Steps:**
1. Intro plays, then bird call phase begins
2. Continue until after first attempt

**Visual Verification - Bird HP (top-left):**
- [ ] HP bar renders inside frame
- [ ] Starts at 100% (full green)
- [ ] Shows horizontal progress bar
- [ ] Color is Game Boy green (#08b500 or similar)
- [ ] No numeric HP readout visible (opponent-only)

**Visual Verification - Player HP (bottom-right):**
- [ ] HP bar renders inside frame
- [ ] Starts at 100% with label "3 / 3"
- [ ] Shows numeric tries count below bar
- [ ] Color is Game Boy green initially

**Expected Result:** ✅ Both bars visible, correct colors, correct labels

---

## Checkpoint 5: Animations

### 5.1 Slide-In (Intro)

**Test Steps:**
1. Click Fight button
2. Watch first 2 seconds of intro

**Visual Verification:**
- [ ] Bird sprite slides in from right edge (smooth but choppy steps)
- [ ] Bird panel slides in from left with ~0.2s delay after sprite
- [ ] Player sprite slides in from left edge
- [ ] Player panel slides in from right with ~0.2s delay after sprite
- [ ] Slide motion uses discrete steps (not smooth interpolation)
- [ ] Takes ~0.8 seconds per slide

**Expected Result:** ✅ Sprites and panels enter with stepped/chunky retro motion

### 5.2 Vibrate (Active Turns)

**Test Steps:**
1. Wait for "UWU BIRD used SCREECH!" message
2. Watch for 1 second (bird calling phase)
3. After recording starts, watch player sprite

**Visual Verification:**
- [ ] Bird sprite vibrates (shakes left-right) during call phase
- [ ] Vibration stops when moving to recording phase
- [ ] Player sprite vibrates while recording (red pulsing mic icon, or sprite shaking)
- [ ] Vibration is rapid (~6-8 Hz) and subtle
- [ ] Vibration amplitude is small (±3px)

**Expected Result:** ✅ Sprites shake during their active turns

### 5.3 HP Drain

**Test Steps:**
1. After recording, see "analysis" phase
2. Watch HP bars during result display

**Visual Verification:**
- [ ] HP bar ticks down frame-by-frame (not smooth transition)
- [ ] Each tick is visible (~30ms per step)
- [ ] Bar color may change (green → yellow → red) as it drains
- [ ] Drain animation takes ~1-2 seconds total

**Expected Result:** ✅ HP drains in discrete steps with color transitions

### 5.4 Slide-Out (Lose Path)

**Test Steps:**
1. Exhaust all 3 tries (fail 3 times)
2. Watch as game transitions to lose phase

**Visual Verification:**
- [ ] Player sprite slides off screen to the left
- [ ] Sprite fades as it exits
- [ ] Takes ~0.8 seconds
- [ ] Bird remains visible on screen
- [ ] Uses stepped motion (not smooth)

**Expected Result:** ✅ Player sprite exits screen smoothly before lose video plays

---

## Checkpoint 6: Content Frame — Typewriter Text

**Test Steps:**
1. Click Fight button
2. Watch intro and gameplay messages

**Visual Verification - During Intro:**
- [ ] "Wild UWU BIRD appeared!" appears character by character
- [ ] Text reveals at ~50ms per character
- [ ] Blinking ▼ cursor appears at end when text completes
- [ ] Cursor blinks (appears/disappears every ~300ms)
- [ ] Text centered in frame

**Visual Verification - During Gameplay:**
- [ ] "UWU BIRD used SCREECH!" appears
- [ ] "YOUR TURN!" appears
- [ ] "..." appears during analysis
- [ ] Round results show: "Round X cleared!" or "Try again!"
- [ ] Retry message shows: "Not quite! 2 tries left... (Round 1)"
- [ ] All text animates in typewriter style
- [ ] Cursor visible until text fully displayed

**Expected Result:** ✅ All text messages animate character-by-character with cursor feedback

---

## Checkpoint 7: Content Frame — Plotly Pitch Chart

**Test Steps:**
1. Complete recording (let it finish naturally)
2. Watch result display phase

**Visual Verification:**
- [ ] Chart appears in content frame (bottom panel)
- [ ] Two lines visible: green (reference) and blue (player)
- [ ] X-axis labeled "Time (frames)"
- [ ] Y-axis labeled "Pitch (semitones)"
- [ ] Chart title shows "Pitch Match Analysis"
- [ ] Chart fits within frame boundaries
- [ ] No Plotly toolbar visible (no interactive buttons)
- [ ] Chart displays for ~2.5 seconds
- [ ] Chart disappears and text returns

**Expected Result:** ✅ Chart renders with both contours, axes, and legend visible

---

## Checkpoint 8: Intro Sequence (End-to-End)

**Test Steps:**
1. Load page (should show Fight button)
2. Click Fight button
3. Watch entire intro

**Visual Verification:**
- [ ] FightButton screen displays with title "FIGHT UWU BIRD"
- [ ] Clicking button starts battle immediately
- [ ] "Wild UWU BIRD appeared!" text animates
- [ ] Bird slides in from right (with panel)
- [ ] "Go! YOU!" text animates
- [ ] Player slides in from left (with panel)
- [ ] Both info panels fully visible with names, levels, HP bars
- [ ] Bird HP at 3/3, Player HP at 3/3
- [ ] Intro takes ~3-4 seconds total
- [ ] Smoothly transitions to bird call phase

**Expected Result:** ✅ Complete intro sequence plays smoothly with all elements

---

## Checkpoint 9: Full Game Loop — Single Round

**Test Steps:**
1. Complete intro
2. Record one attempt (even if silent/fails)
3. Watch full round cycle

**Visual Verification:**
- [ ] **Bird Call Phase**: "UWU BIRD used SCREECH!" + bird vibrates
- [ ] **Recording Phase**: "YOUR TURN!" + player vibrates + countdown visible
- [ ] **Analysis Phase**: "..." text visible
- [ ] **Chart Display**: Pitch chart shows (green + blue lines)
- [ ] **Result Phase**: Message shows (either "Round X cleared!" or "Try again!")
- [ ] **HP Change**: Player HP bar drains by 1/3 on fail
- [ ] **State Updates**: Panel shows updated tries left
- [ ] Entire cycle takes ~10-12 seconds

**Expected Result:** ✅ Single round completes with all phases visible

---

## Checkpoint 10: Full Game Loop — Win Path

**Test Steps:**
1. Play through and intentionally fail all 3 attempts on purpose OR
2. Record with genuine pitch matching (speak into mic, try to match bird call)

**Visual Verification:**
- [ ] After passing a round: "Round X cleared!" message displays
- [ ] Bird HP bar drains by 1/3 (visible animation)
- [ ] Round increments (1 → 2 → 3)
- [ ] Bird call audio changes for each round (harder pitch)
- [ ] After clearing all 3 rounds: "UWU BIRD fainted!" appears
- [ ] Bird sprite replaces with video (you_win_bird_animation.mp4)
- [ ] Video plays for ~2-3 seconds
- [ ] After video: "YOU won the battle!" message shows
- [ ] Battle screen ends, returns to start screen
- [ ] Can click "Play Again" to restart

**Expected Result:** ✅ Win path completes with animations and return to start screen

---

## Checkpoint 11: Full Game Loop — Lose Path

**Test Steps:**
1. Play game
2. Record 3 times with silent/non-matching audio
3. Watch as all tries exhaust

**Visual Verification - First Fail:**
- [ ] "Try again!" or "Not quite! 2 tries left..." displays
- [ ] Player HP drains by 1/3 (100% → 66%)
- [ ] Game stays on same round
- [ ] Bird call repeats (same audio)

**Visual Verification - Second Fail:**
- [ ] Player HP at 2/3
- [ ] Message: "Not quite! 1 tries left... (Round X)"
- [ ] Can retry same round

**Visual Verification - Third Fail:**
- [ ] Player HP drains to 0/3
- [ ] Message: "Not enough sound detected. Speak louder!" or similar
- [ ] Player sprite slides off-screen to left
- [ ] "UWU BIRD is victorious!" displays
- [ ] Bird sprite shows video (you_lose_bird_animation.mp4)
- [ ] Video plays for ~2-3 seconds
- [ ] "YOU blacked out!" displays
- [ ] Battle ends, returns to start screen

**Expected Result:** ✅ Lose path completes with player exit animation and video

---

## Checkpoint 12: Polish + Edge Cases

### 12.1 Sprite Transparency

**Test Steps:**
1. Watch sprites during entire game

**Visual Verification:**
- [ ] No white/gray boxes around sprites
- [ ] Sprites composite cleanly with background
- [ ] Background pattern visible around sprites (not covered)

**Expected Result:** ✅ Transparent sprite backgrounds

### 12.2 Video Preloading

**Test Steps:**
1. Play through to win/lose condition

**Visual Verification:**
- [ ] Video plays immediately when triggered (no delay)
- [ ] No buffering or loading pause
- [ ] Video is smooth (30fps or better)

**Expected Result:** ✅ Instant video playback

### 12.3 Retry Audio Consistency

**Test Steps:**
1. Fail on Round 1
2. Retry Round 1
3. Fail on Round 2
4. Retry Round 2

**Visual Verification:**
- [ ] Each retry on same round fetches same audio
- [ ] Round 1 audio sounds identical on retries
- [ ] Round 2 audio has higher pitch than Round 1
- [ ] Round 3 audio (if reached) is higher still
- [ ] Pitch progression matches config: [-5, -2, 0] semitones

**Expected Result:** ✅ Consistent audio per round, proper pitch progression

### 12.4 No Console Errors

**Test Steps:**
1. Play full game loop start to finish

**Visual Verification:**
- [ ] Open DevTools (F12)
- [ ] Go to Console tab
- [ ] Play entire game
- [ ] Check for red error messages

**Expected Result:** ✅ Zero errors in console

### 12.5 Restart Flow

**Test Steps:**
1. Complete a game (win or lose)
2. Click "Play Again"

**Visual Verification:**
- [ ] Returns to Fight button screen
- [ ] Clicking Fight button starts new game
- [ ] New session created (different IDs in network tab)
- [ ] Game state resets (HP at 3/3, tries at 3)

**Expected Result:** ✅ Can restart game without page reload

---

## Summary Checklist

Run through all 12 checkpoints and mark complete:

- [ ] Checkpoint 1: Backend Retry Logic ✅
- [ ] Checkpoint 2: CSS Framework + Layout ✅
- [ ] Checkpoint 3: Sprite Assets + Rendering
- [ ] Checkpoint 4: HP Bars
- [ ] Checkpoint 5: Animations
- [ ] Checkpoint 6: Typewriter Text
- [ ] Checkpoint 7: Plotly Pitch Chart
- [ ] Checkpoint 8: Intro Sequence (E2E)
- [ ] Checkpoint 9: Single Round Loop
- [ ] Checkpoint 10: Win Path
- [ ] Checkpoint 11: Lose Path
- [ ] Checkpoint 12: Polish + Edge Cases

**All 12 Checkpoints Complete = Production Ready** ✅
