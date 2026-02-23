# Tech Spec: FIGHT UWU BIRD — Battle UI Overhaul

## Overview

A React-based battle screen that recreates the Pokémon Red/Blue (Gen I) battle aesthetic for the FIGHT UWU BIRD pitch-matching audio game. The player competes against the UWU Bird across 3 rounds of increasingly difficult pitch matching, with 3 total tries (lives) shared across all rounds.

Styled using the **css-pokemon-gameboy** CSS framework for authentic Game Boy UI chrome (frames, HP bars), with custom CSS keyframe animations for battle-specific motion.

The bottom dialogue area displays either typewriter text (during bird call / player turn phases) or a minimalist **Plotly.js** pitch chart (during the results phase after each attempt).

---

## Goals

- Faithfully reproduce the visual rhythm of a Gen I Pokémon battle adapted to an audio-based game
- All animations driven by CSS keyframes with `steps()` timing for the authentic stepped/chunky retro feel
- Turn sequencing orchestrated via async React state machine, integrating with the existing backend API
- Clean component boundaries so individual pieces (sprites, HP bars, dialogue) are reusable
- The bottom frame serves as a dual-purpose content area: typewriter text OR a Plotly.js pitch visualization

## Non-Goals

- Full game logic changes — the backend pitch detection, DTW matching, and scoring remain unchanged
- Mobile responsiveness (target desktop viewports)
- Action menus or move selection UI — turns are driven programmatically by the game loop
- Sound effects (can be added later; the async architecture supports it)

---

## Tech Stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Framework | React 18+ (existing) | Already in use; component model maps to battle scene elements |
| Styling | css-pokemon-gameboy v0.6.1 | Provides authentic Gen I frames and HP bars out of the box |
| Font | Provided by css-pokemon-gameboy (inlined base64 `@font-face`) | No external font needed — bundled Game Boy pixel font |
| Animation | CSS `@keyframes` + `animation-timing-function: steps()` | Retro stepped feel; no runtime animation library |
| Charting | Plotly.js (existing, via `react-plotly.js`) | Already used for pitch visualization; rendered in content frame |
| Turn orchestration | Async state machine (React state + `await delay()`) | Simple, linear, integrates with existing hooks |
| Build | Vite (existing) | Already configured in the project |

---

## Game Mechanics Summary

### Round Structure
- **3 rounds** of increasing pitch difficulty (pitch shifts: -5, -2, 0 semitones from base)
- **3 tries (lives)** shared across all rounds — not per-round

### HP Bars
- **Bird HP**: Visual progress indicator. Starts full. Drains by 1/3 when the player **clears** a round.
  - Round 1 start: 3/3 → Round 1 cleared: 2/3 → Round 2 cleared: 1/3 → Round 3 cleared: 0/3
- **Player HP**: Represents remaining tries. Starts full. Drains by 1/3 on each **failed** attempt.
  - 3 tries → fail → 2 tries → fail → 1 try → fail → 0 tries (game over)

### Win/Lose Conditions
- **WIN**: Player clears all 3 rounds (bird HP reaches 0)
- **LOSE**: Player exhausts all 3 tries (player HP reaches 0)

### Retry Logic
- On fail, the player retries the **same round** at the same pitch difficulty
- On pass, the player advances to the next round

---

## Visual Layout

Both sprites face each other front-on (face-off style), using the existing front-facing sprite assets.

```
┌──────────────────────────────────────────────┐
│                                              │
│  ┌──────────────────┐                        │
│  │ UWU BIRD         │                        │
│  │ :L10             │                        │
│  │ HP: ████████████▶│         [uwu_bird     │
│  └──────────────────┘          sprite]       │
│                                              │
│                                              │
│                       ┌────────────────────┐ │
│   [Player             │ YOU               │ │
│    sprite]            │ :L6               │ │
│                       │ HP: █████░░░░░    │ │
│                       │       2 / 3       │ │
│                       └────────────────────┘ │
│                                              │
│  ┌──────────────────────────────────────────┐│
│  │                                          ││
│  │ [Typewriter text / Plotly chart]         ││
│  │                                          ││
│  └──────────────────────────────────────────┘│
└──────────────────────────────────────────────┘
```

Five key spatial observations:

1. **Bird info panel** — top-left. Shows name, level, and HP bar. No numeric HP readout.
2. **Bird sprite** — top-right. Front-facing `uwu_bird_sprite.jpg`.
3. **Player sprite** — bottom-left. Front-facing `player_sprite.jpg`. Same rendered size as the bird sprite.
4. **Player info panel** — bottom-right. Shows name, level, HP bar, AND numeric tries (`current / max`). This is the key asymmetry vs the bird panel.
5. **Content frame** — full-width bottom. Displays typewriter text during bird call / player turn, or a minimalist Plotly pitch chart during results.

---

## Component Architecture

```
<BattleScene>
├── <BattleBackground />           // Static background (Gen I horizontal lines)
├── <InfoPanel side="opponent" />   // Top-left: name, level, HP bar (no numeric HP)
│   └── <HealthBar />
├── <PokemonSprite side="opponent" /> // Top-right, slides in from right
├── <PokemonSprite side="player" />   // Bottom-left, slides in from left
├── <InfoPanel side="player" />     // Bottom-right: name, level, HP bar + numeric tries
│   └── <HealthBar />
└── <ContentFrame />                // Bottom: typewriter text OR Plotly chart
```

### Component Descriptions

#### `<BattleScene>`
Root container. Manages the game state machine and passes animation trigger props down to children. Fixed aspect ratio container (640×576 at 4× Game Boy resolution).

**State owned:**
- `phase`: enum — `'intro' | 'bird-call' | 'player-turn' | 'analysis' | 'round-result' | 'win' | 'lose'`
- `round`: number (1–3)
- `triesLeft`: number (3–0)
- `birdHp`: number (3–0, decrements on round clear)
- `contentMode`: `'text' | 'chart'`
- `dialogue`: string (current text when `contentMode === 'text'`)
- `chartData`: Plotly data/layout object (when `contentMode === 'chart'`)
- `playerAnimState` / `birdAnimState`: animation state enums
- `sessionId`: string (from backend)

#### `<BattleBackground />`
Pure presentational. A `<div>` with the classic Gen I battle background — horizontal lines pattern. CSS `repeating-linear-gradient` or tiled PNG. No state, no animation.

#### `<InfoPanel />`
Uses the **css-pokemon-gameboy `frame`** class for the bordered panel look. Handles both the bird and player variants via a `side` prop.

**Props:**
- `side`: `'player' | 'opponent'`
- `name`: string
- `level`: number
- `currentHp`: number
- `maxHp`: number

**Key asymmetry:** When `side === 'player'`, the panel renders the numeric readout (`currentHp / maxHp`, representing tries) below the bar. When `side === 'opponent'`, it renders only the bar.

```jsx
<div className={`frame info-panel info-panel--${side}`}>
  <span className="info-panel__name">{name}</span>
  <span className="info-panel__level">:L{level}</span>
  <HealthBar current={currentHp} max={maxHp} />
  {side === 'player' && (
    <span className="info-panel__hp-numbers">
      {currentHp} / {maxHp}
    </span>
  )}
</div>
```

The panel slides in during the intro phase alongside its respective sprite:
- Bird panel: slides in from the left (panel is on the left side)
- Player panel: slides in from the right (panel is on the right side)

#### `<HealthBar />`
Wraps the **css-pokemon-gameboy `<progress>`** element. The framework provides color-changing behavior (green → yellow → red) via `.p1`–`.p100` classes.

**Props:**
- `current`: number
- `max`: number

```html
<progress class="p{percentageValue}" value="{current}" max="{max}"></progress>
```

HP drain is handled by stepping the `current` value down over time via `setInterval`, updating the `.pN` class each tick. This produces the classic frame-by-frame drain with automatic color transitions.

**Tick rate:** ~30ms per HP point. Since max HP values are small (3), each 1/3 drain is a percentage animation from e.g. 100→66, ticking down one percentage point at a time.

#### `<PokemonSprite />`
Displays the sprite image. Both player and bird sprites render at the **same size**, both front-facing. During the game, this is normally a static `<img>`. On win/lose, the bird sprite swaps to a `<video>` element.

**Props:**
- `side`: `'player' | 'opponent'`
- `src`: string (sprite image URL)
- `videoSrc`: string (mp4 URL for win/lose animation — bird only)
- `animationState`: `'entering' | 'idle' | 'vibrating' | 'sliding-out' | 'video' | 'hidden'`
- `onAnimationComplete`: callback

**Rendering logic:**
```jsx
if (animationState === 'video' && videoSrc) {
  return (
    <video
      src={videoSrc}
      autoPlay
      muted
      playsInline
      className="sprite sprite--video"
      onEnded={() => onAnimationComplete('hidden')}
    />
  );
} else if (animationState === 'hidden') {
  return null;
} else {
  return (
    <img
      src={src}
      className={`sprite sprite--${side} sprite--${animationState}`}
    />
  );
}
```

Sprites use `image-rendering: pixelated` to preserve sharp pixel edges when scaled up.

#### `<ContentFrame />`
The bottom full-width area, using the **css-pokemon-gameboy `frame`** class. Conditionally renders either typewriter text or a Plotly.js pitch chart.

**Props:**
- `mode`: `'text' | 'chart'`
- `text`: string (used when `mode === 'text'`)
- `textSpeed`: number (ms per character, default 50)
- `onTextComplete`: callback
- `chartData`: Plotly `data` array (reference contour + player contour)
- `chartLayout`: Plotly `layout` object

**Rendering logic:**
```jsx
<div className="frame content-frame">
  {mode === 'text' ? (
    <TypewriterText
      text={text}
      speed={textSpeed}
      onComplete={onTextComplete}
    />
  ) : (
    <Plot
      data={chartData}
      layout={{
        ...chartLayout,
        paper_bgcolor: 'transparent',
        plot_bgcolor: 'transparent',
        font: { family: 'inherit', size: 8 },
        margin: { l: 30, r: 10, t: 10, b: 30 },
      }}
      config={{ displayModeBar: false, staticPlot: true }}
      className="content-frame__chart"
    />
  )}
</div>
```

**Plotly chart specifics for pitch display:**
- Two traces: bird reference contour (green) and player recorded contour (blue)
- `paper_bgcolor` and `plot_bgcolor` transparent so the frame background shows through
- Inherit the pixel font via `font.family: 'inherit'`
- `staticPlot: true` — no hover/zoom (retro non-interactive feel)
- `displayModeBar: false` — no toolbar
- Tight margins to fill the frame
- Content swaps instantly between text and chart (no crossfade — matches Gen I snap-in/out)

---

## Animation Specifications

All animations use CSS `@keyframes` with `steps()` timing for retro frame-by-frame motion.

### 1. Slide-In Entrance (Intro Phase)

**Player side** (sprite + panel): Slides in from the left.
**Bird side** (sprite + panel): Slides in from the right.

```css
@keyframes slideInFromLeft {
  from { transform: translateX(-120%); }
  to   { transform: translateX(0); }
}

@keyframes slideInFromRight {
  from { transform: translateX(120%); }
  to   { transform: translateX(0); }
}

.sprite--entering.sprite--player {
  animation: slideInFromLeft 0.8s steps(12) forwards;
}

.sprite--entering.sprite--opponent {
  animation: slideInFromRight 0.8s steps(12) forwards;
}
```

`steps(12)` produces ~12 discrete positions over 0.8s. Info panels use the same animations, staggered by ~0.2s via `animation-delay`.

### 2. Vibrate Animation (Active Turn)

When it's the bird's turn (calling) or the player's turn (recording), the active sprite vibrates in place.

```css
@keyframes vibrate {
  0%   { transform: translateX(0); }
  25%  { transform: translateX(-3px); }
  50%  { transform: translateX(3px); }
  75%  { transform: translateX(-3px); }
  100% { transform: translateX(0); }
}

.sprite--vibrating {
  animation: vibrate 0.15s steps(2) infinite;
}
```

The vibration loops continuously while the sprite is in the `vibrating` state and stops when the state returns to `idle`.

### 3. Health Bar Drain

HP drains in discrete ticks via JavaScript, not CSS transitions:

```ts
async function drainHp(
  setHp: (n: number) => void,
  from: number,
  to: number,
  tickMs: number = 30
) {
  // Drain in percentage steps for smooth bar animation
  const fromPct = Math.round((from / 3) * 100);
  const toPct = Math.round((to / 3) * 100);
  const totalTicks = fromPct - toPct;

  for (let i = 0; i <= totalTicks; i++) {
    const currentPct = fromPct - i;
    setHp(currentPct); // drives the .pN class on <progress>
    await delay(tickMs);
  }
}
```

Each tick updates the `.pN` class on the `<progress>` element. The css-pokemon-gameboy framework handles the color transitions (green → yellow → red) automatically.

### 4. Player Slide-Out (Lose)

On defeat, the player sprite slides off-screen to the left:

```css
@keyframes slideOutToLeft {
  from {
    transform: translateX(0);
    opacity: 1;
  }
  to {
    transform: translateX(-120%);
    opacity: 0;
  }
}

.sprite--sliding-out {
  animation: slideOutToLeft 0.8s steps(12) forwards;
}
```

No faint/collapse animation for the player — just a clean exit.

### 5. Bird Win/Lose Video

On game end, the bird's `<img>` swaps to a `<video>` element:
- **Player wins** → `you_win_bird_animation.mp4` plays
- **Player loses** → `you_lose_bird_animation.mp4` plays

The video plays once. `onEnded` fires the completion callback to advance to the final text screen.

### 6. Typewriter Text

Implemented via `useTypewriter` hook:

```ts
function useTypewriter(text: string, speed: number = 50) {
  const [displayed, setDisplayed] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    setDisplayed('');
    setDone(false);
    let i = 0;
    const interval = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) {
        clearInterval(interval);
        setDone(true);
      }
    }, speed);
    return () => clearInterval(interval);
  }, [text, speed]);

  return { displayed, done };
}
```

A blinking `▼` cursor appears when `done === true`.

---

## Turn Sequencing (State Machine)

The battle flow is an async function that orchestrates the entire game loop, integrating with the existing backend API.

```ts
type BattlePhase =
  | 'intro'
  | 'bird-call'
  | 'player-turn'
  | 'analysis'
  | 'round-result'
  | 'win'
  | 'lose';
```

### Intro Sequence

```ts
async function playIntro() {
  setPhase('intro');
  setContentMode('text');

  setDialogue('Wild UWU BIRD appeared!');
  setBirdAnim('entering');
  await delay(2000);
  setBirdAnim('idle');

  setDialogue('Go! YOU!');
  setPlayerAnim('entering');
  await delay(2000);
  setPlayerAnim('idle');

  await delay(500);
}
```

### Main Game Loop

```ts
async function runBattle(sessionId: string) {
  await playIntro();

  let round = 1;
  let triesLeft = 3;
  let birdHp = 3;

  while (round <= 3 && triesLeft > 0) {
    // --- Bird Call Phase ---
    setPhase('bird-call');
    setContentMode('text');
    setDialogue(`UWU BIRD used SCREECH!`);
    setBirdAnim('vibrating');

    const birdAudio = await fetchBirdCall(sessionId);
    await playAudio(birdAudio);
    setBirdAnim('idle');
    await delay(500); // echo prevention gap

    // --- Player Turn Phase ---
    setPhase('player-turn');
    setContentMode('text');
    setDialogue('YOUR TURN!');
    setPlayerAnim('vibrating');

    const playerAudio = await recordPlayerAudio(3500);
    setPlayerAnim('idle');

    // --- Analysis Phase ---
    setPhase('analysis');
    setContentMode('text');
    setDialogue('...');

    const result = await submitAudio(sessionId, playerAudio);

    // --- Show Pitch Chart ---
    setContentMode('chart');
    setChartData(buildPitchChart(result.referenceContour, result.playerContour));
    await delay(2500); // hold chart visible

    // --- Round Result ---
    setPhase('round-result');
    setContentMode('text');

    if (result.passed) {
      // Player cleared this round
      birdHp--;
      setBirdHp(birdHp);
      await drainHp(setBirdHpDisplay, birdHp + 1, birdHp);
      setDialogue(`Round ${round} cleared!`);
      await delay(1500);
      round++;
    } else {
      // Player failed this attempt
      triesLeft--;
      setTriesLeft(triesLeft);
      await drainHp(setPlayerHpDisplay, triesLeft + 1, triesLeft);

      if (triesLeft > 0) {
        setDialogue('Try again!');
        await delay(1500);
        // Loop continues — same round
      }
    }
  }

  // --- End Game ---
  if (round > 3) {
    // WIN — player cleared all rounds
    setPhase('win');
    setContentMode('text');
    setDialogue('UWU BIRD fainted!');
    setBirdAnim('video'); // plays you_win_bird_animation.mp4
    await delay(3000); // wait for video
    setDialogue('YOU won the battle!');
  } else {
    // LOSE — player ran out of tries
    setPhase('lose');
    setContentMode('text');
    setPlayerAnim('sliding-out');
    await delay(800);
    setDialogue('UWU BIRD is victorious!');
    setBirdAnim('video'); // plays you_lose_bird_animation.mp4
    await delay(3000); // wait for video
    setDialogue('YOU blacked out!');
  }
}
```

**`delay` helper:**
```ts
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

---

## Data Model

```ts
interface BattleConfig {
  player: {
    name: string;          // "YOU"
    level: number;         // display only
    sprite: string;        // URL to player_sprite.jpg
    maxTries: number;      // 3
  };
  opponent: {
    name: string;          // "UWU BIRD"
    level: number;         // display only
    sprite: string;        // URL to uwu_bird_sprite.jpg
    winVideo: string;      // URL to you_win_bird_animation.mp4
    loseVideo: string;     // URL to you_lose_bird_animation.mp4
    totalRounds: number;   // 3
  };
}

interface RoundResult {
  passed: boolean;
  referenceContour: number[];   // bird's pitch contour (from backend)
  playerContour: number[];      // player's pitch contour (from backend)
  dtwScore: number;             // DTW distance
  medianPitch: number;          // player's median pitch
}
```

### Integration with Existing Backend API

The battle UI integrates with the existing endpoints:

| Endpoint | Usage in Battle |
|----------|----------------|
| `POST /api/game/start` | Called during intro to create session |
| `GET /api/game/{id}/bird-call` | Called during bird-call phase to fetch audio |
| `POST /api/game/{id}/analyze` | Called during analysis phase with player recording |

The existing `useGameSession`, `useAudioRecorder`, and `useAudioPlayer` hooks are reused internally, but the battle state machine replaces `App.jsx` as the top-level orchestrator.

---

## Sprite Assets

| Asset | File | Usage |
|-------|------|-------|
| Player sprite | `player_sprite.jpg` | Front-facing, displayed bottom-left |
| Bird sprite | `uwu_bird_sprite.jpg` | Front-facing, displayed top-right |
| Win animation | `you_win_bird_animation.mp4` | Replaces bird sprite when player **wins** |
| Lose animation | `you_lose_bird_animation.mp4` | Replaces bird sprite when player **loses** |

**Notes:**
- Both sprites are JPGs with light backgrounds. Apply `mix-blend-mode: multiply` or pre-process to transparent PNGs for clean compositing over the battle background.
- Both sprites render at the same dimensions.
- `image-rendering: pixelated` on all sprites for sharp pixel scaling.

---

## CSS Integration with css-pokemon-gameboy

### Installation

Download the v0.6.1 release ZIP and include the CSS:
```html
<link rel="stylesheet" href="./styles/css-pokemon-gameboy.css">
```

### Key Classes Used

| Element | Class(es) | Notes |
|---------|-----------|-------|
| Info panels | `.frame` | Core bordered panel |
| Accent variant | `.frame.accent-primary` | Optional green tint |
| HP bar | `<progress class="pN">` | N = 1–100 for percentage; auto-colors green→yellow→red |
| Content frame | `.frame` | Full-width bottom panel |

### Custom CSS Layer

All animation keyframes and battle-specific layout go in a separate `battle.css`:

```
src/
├── styles/
│   ├── css-pokemon-gameboy.css   (framework, unmodified)
│   └── battle.css                (custom keyframes + layout)
```

---

## Layout CSS

```css
.battle-scene {
  display: grid;
  grid-template-rows: auto 1fr auto 1fr auto;
  grid-template-columns: 1fr 1fr;
  width: 640px;
  height: 576px;
  background: #f8f8f8;
  image-rendering: pixelated;
  font-size: 8px;
  overflow: hidden;
  position: relative;
}

.opponent-panel  { grid-area: 1 / 1 / 2 / 2; }  /* top-left */
.opponent-sprite { grid-area: 1 / 2 / 3 / 3; }  /* top-right */
.player-sprite   { grid-area: 3 / 1 / 5 / 2; }  /* bottom-left */
.player-panel    { grid-area: 3 / 2 / 4 / 3; }  /* bottom-right */
.content-frame   { grid-area: 5 / 1 / 6 / 3; }  /* full-width bottom */
```

Sprites are absolutely positioned within their grid cells so slide-in animations can start off-screen.

---

## File Structure

```
frontend/src/
├── components/
│   ├── BattleScene.tsx          # Root: state machine, turn orchestration
│   ├── BattleBackground.tsx     # Static Gen I background
│   ├── PokemonSprite.tsx        # Sprite img/video, animation classes
│   ├── InfoPanel.tsx            # Name, level, HP bar (player vs opponent)
│   ├── HealthBar.tsx            # Wraps <progress> with css-pokemon-gameboy
│   └── ContentFrame.tsx         # Frame: typewriter text OR Plotly chart
├── hooks/
│   ├── useTypewriter.ts         # Typewriter text effect
│   ├── useBattleSequence.ts     # Async game loop orchestration
│   ├── useGameSession.js        # (existing) Backend API calls
│   ├── useAudioRecorder.js      # (existing) Mic capture
│   └── useAudioPlayer.js        # (existing) Audio playback
├── styles/
│   ├── css-pokemon-gameboy.css  # Framework (unmodified)
│   ├── battle.css               # Custom keyframes + battle layout
│   └── app.css                  # (existing, may be reduced)
├── types/
│   └── battle.ts                # BattleConfig, RoundResult, BattlePhase types
├── utils/
│   └── delay.ts                 # delay() helper
├── assets/
│   ├── player_sprite.jpg        # Player sprite (move from project root)
│   ├── uwu_bird_sprite.jpg      # Bird sprite (move from project root)
│   ├── you_win_bird_animation.mp4
│   └── you_lose_bird_animation.mp4
└── App.tsx                      # Mounts <BattleScene> with config
```

---

## Migration from Current Frontend

The current frontend has separate screens for each game state (`FightButton`, `GameArena`, `RecordingIndicator`, `ResultScreen`). The battle UI replaces this with a single persistent `<BattleScene>` that shows all elements simultaneously and orchestrates transitions via animation states.

**What stays:**
- `useGameSession.js` — backend API integration
- `useAudioRecorder.js` — mic capture and WAV encoding
- `useAudioPlayer.js` — audio playback
- Plotly.js dependency — reused for pitch charts in content frame

**What changes:**
- `App.jsx` — simplified to just mount `<BattleScene>` with config
- `FightButton.jsx` — replaced by intro sequence (could be kept as a pre-battle start trigger)
- `GameArena.jsx` — replaced by `BattleScene` + `ContentFrame`
- `RecordingIndicator.jsx` — replaced by player sprite vibration animation
- `ResultScreen.jsx` — replaced by content frame chart + win/lose sequence

---

## Backend Changes Required

The current backend ends the game immediately on a single failure. It needs to support the retry mechanic (3 shared tries across 3 rounds).

### 1. `game_manager.py` — GameSession Model

Add `tries_left` and `max_tries` fields:

```python
@dataclass
class GameSession:
    session_id: str
    current_round: int = 1
    max_rounds: int = 3
    max_tries: int = 3                                    # NEW
    tries_left: int = 3                                   # NEW
    status: GameStatus = GameStatus.WAITING_FOR_PLAYER
    created_at: datetime = field(default_factory=datetime.utcnow)
    round_results: list = field(default_factory=list)
    round_contours: list = field(default_factory=list)
```

### 2. `game_manager.py` — advance_round() Logic

Replace the current logic that immediately loses on fail:

**Current behavior:**
```python
def advance_round(self, session_id: str, passed: bool) -> GameSession:
    session = self.sessions[session_id]
    session.round_results.append(passed)

    if not passed:
        session.status = GameStatus.GAME_LOST          # ← instant game over
    elif session.current_round >= session.max_rounds:
        session.status = GameStatus.GAME_WON
    else:
        session.current_round += 1
        session.status = GameStatus.WAITING_FOR_PLAYER

    return session
```

**New behavior:**
```python
def advance_round(self, session_id: str, passed: bool) -> GameSession:
    session = self.sessions[session_id]
    session.round_results.append(passed)

    if passed:
        # Player cleared this round — advance
        if session.current_round >= session.max_rounds:
            session.status = GameStatus.GAME_WON
        else:
            session.current_round += 1
            session.status = GameStatus.WAITING_FOR_PLAYER
    else:
        # Player failed — decrement tries, stay on same round
        session.tries_left -= 1
        if session.tries_left <= 0:
            session.status = GameStatus.GAME_LOST
        else:
            session.status = GameStatus.WAITING_FOR_PLAYER
            # current_round stays the same — player retries

    return session
```

Key changes:
- On fail: decrement `tries_left`, keep `current_round` unchanged
- Only `GAME_LOST` when `tries_left` reaches 0
- On pass: same as before (advance round or win)

### 3. `main.py` — `/api/game/start` Response

Add `tries_left` to the start response so the frontend knows the initial try count:

```python
@app.post("/api/game/start")
def start_game():
    session = game_manager.create_session()
    return {
        "session_id": session.session_id,
        "round": session.current_round,
        "max_rounds": session.max_rounds,
        "tries_left": session.tries_left,          # NEW
        "max_tries": session.max_tries,             # NEW
        "message": "The bird is calling... listen carefully!",
    }
```

### 4. `main.py` — `/api/game/{session_id}/analyze` Response

Add `tries_left` and `max_tries` to the analyze response so the frontend can update the player HP bar:

```python
return {
    "session_id": session_id,
    "round": int(round_idx + 1),
    "tries_left": session.tries_left,               # NEW
    "max_tries": session.max_tries,                  # NEW
    "contour_match": bool(analysis["contour_match"]),
    "contour_score": float(analysis["contour_score"]),
    "pitch_match": bool(analysis["pitch_match"]),
    "player_median_pitch_hz": float(round(analysis["player_median_hz"], 2)),
    "target_min_pitch_hz": float(round(target_hz, 2)),
    "passed": bool(analysis["passed"]),
    "next_round": next_round if next_round is None else int(next_round),
    "game_over": bool(result is not None),
    "result": result,
    "message": message,
    "pitch_visualization": { ... },     # unchanged
    "all_rounds_visualization": ...,    # unchanged
}
```

### 5. `main.py` — `/api/game/{session_id}/bird-call` Endpoint

**No changes needed.** This endpoint already serves audio based on `session.current_round`. Since `current_round` no longer increments on fail, retrying the same round will automatically fetch the correct audio file.

### 6. `main.py` — Analyze Response Message Logic

Update the message logic to handle the retry case (fail but not game over):

**Current:**
```python
if session.status.value == "game_won":
    result = "win"
    message = "🎉 The bird falls silent... YOU WIN!"
elif session.status.value == "game_lost":
    result = "lose"
    message = analysis.get("failure_reason", "The bird out-uwu'd you!")
else:
    next_round = session.current_round
    message = f"Nice uwu! The bird calls back even higher... (Round {next_round})"
```

**New:**
```python
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
```

### Summary of Backend Changes

| File | Change | Impact |
|------|--------|--------|
| `game_manager.py` | Add `tries_left`, `max_tries` fields to `GameSession` | Data model |
| `game_manager.py` | Rewrite `advance_round()` to decrement tries on fail, keep round | Core retry logic |
| `main.py` | Add `tries_left`, `max_tries` to `/start` response | Frontend init |
| `main.py` | Add `tries_left`, `max_tries` to `/analyze` response | Frontend HP update |
| `main.py` | Update message logic for retry case | UX text |
| `main.py` `/bird-call` | No change | Already works — serves by `current_round` |

### What Stays Unchanged

- **Audio processing pipeline** — pitch extraction, DTW matching, contour analysis all untouched
- **`uwu_detector.py`** — detection algorithm unchanged
- **`audio_processor.py`** — audio processing unchanged
- **`pitch_shifter.py`** — variant generation unchanged
- **`config.py`** — thresholds unchanged
- **Pitch visualization data** — the `/analyze` response already returns all contour data needed for the Plotly chart

---

## Resolved Design Decisions

1. **Sprite transparency:** Convert JPGs to PNGs with transparent backgrounds before implementation.
2. **Chart hold time:** Start with `await delay(2500)`, tune during testing.
3. **Plotly bundle size:** Use the current full Plotly bundle; optimize later if needed.
4. **Video preloading:** Yes — use `<link rel="preload">` or fetch during intro to avoid playback delay.
5. **Panel shape:** Use the css-pokemon-gameboy `.frame` rectangles as-is (no clip-path).
6. **Pre-battle screen:** Keep the existing FightButton as the first screen. Pressing it launches the battle intro sequence.
7. **Backend round management:** Requires changes — see "Backend Changes Required" section above.

---

## Testing Checkpoints

Each checkpoint should be verified before moving to the next. They follow the implementation order.

### Checkpoint 1: Backend Retry Logic
- [ ] `game_manager.py` updated with `tries_left` / `max_tries` fields
- [ ] `advance_round()` decrements tries on fail, keeps round unchanged
- [ ] `advance_round()` only sets `GAME_LOST` when `tries_left == 0`
- [ ] `advance_round()` still advances round and sets `GAME_WON` correctly on pass
- [ ] Verify with curl:
  ```bash
  # Start session
  curl -X POST http://localhost:8000/api/game/start
  # Response includes tries_left: 3, max_tries: 3

  # Submit bad audio — should fail but NOT end game
  curl -X POST http://localhost:8000/api/game/{id}/analyze -F audio=@silent.wav
  # Response: passed=false, tries_left=2, game_over=false

  # Submit bad audio again — still not game over
  # Response: passed=false, tries_left=1, game_over=false

  # Submit bad audio third time — NOW game over
  # Response: passed=false, tries_left=0, game_over=true, result="lose"
  ```
- [ ] Bird call endpoint still serves the same round audio on retry (no round increment)

### Checkpoint 2: CSS Framework + Static Layout
- [ ] css-pokemon-gameboy v0.6.1 integrated into the project
- [ ] `battle.css` created with all keyframe animations
- [ ] Battle scene grid renders at 640x576 with correct spatial layout:
  - Bird panel top-left, bird sprite top-right
  - Player sprite bottom-left, player panel bottom-right
  - Content frame full-width bottom
- [ ] `.frame` class applied to info panels and content frame — borders render correctly
- [ ] Pixel font from css-pokemon-gameboy displays in all text elements
- [ ] `image-rendering: pixelated` applied to sprites

### Checkpoint 3: Sprite Assets + Rendering
- [ ] Sprites converted from JPG to PNG with transparent backgrounds
- [ ] Both sprites display at the same size within their grid cells
- [ ] Sprites composite cleanly over the battle background (no white rectangles)
- [ ] Win/lose mp4 videos preloaded and play correctly when swapped in

### Checkpoint 4: HP Bars
- [ ] `<progress>` elements render with css-pokemon-gameboy styling
- [ ] `.pN` class updates correctly as percentage changes
- [ ] Color transitions work: green (high) → yellow (mid) → red (low)
- [ ] Bird HP bar: starts full, visually static until a round is cleared
- [ ] Player HP bar: starts full, numeric readout shows `3 / 3`
- [ ] `drainHp()` function ticks down smoothly at ~30ms per percentage point
- [ ] Player panel shows numeric tries; bird panel does not

### Checkpoint 5: Animations
- [ ] **Slide-in:** Bird sprite + panel slide in from right; player sprite + panel from left. `steps(12)` produces chunky retro motion. Panels staggered by ~0.2s.
- [ ] **Vibrate:** Sprite shakes in place while in `vibrating` state, stops when returning to `idle`
- [ ] **HP drain:** Bar visibly ticks down frame-by-frame on state change
- [ ] **Player slide-out:** Player sprite exits left on defeat
- [ ] **Bird video swap:** `<img>` swaps to `<video>`, video plays once, `onEnded` fires

### Checkpoint 6: Content Frame — Typewriter Text
- [ ] `useTypewriter` hook produces character-by-character reveal at ~50ms/char
- [ ] Blinking `▼` cursor appears when text is complete
- [ ] Text snaps in/out when switching content (no crossfade)
- [ ] Content frame displays:
  - `"Wild UWU BIRD appeared!"` during bird entrance
  - `"Go! YOU!"` during player entrance
  - `"UWU BIRD used SCREECH!"` during bird call
  - `"YOUR TURN!"` during player recording
  - `"..."` during analysis
  - `"Round N cleared!"` / `"Try again!"` / `"Not quite! N tries left..."` on result

### Checkpoint 7: Content Frame — Plotly Pitch Chart
- [ ] Chart renders inside the `.frame` content area with transparent background
- [ ] Two traces visible: bird reference contour (green) + player contour (blue)
- [ ] Pixel font inherited for axis labels
- [ ] `staticPlot: true` — no hover tooltips or zoom
- [ ] `displayModeBar: false` — no Plotly toolbar
- [ ] Chart fits within the content frame without overflow
- [ ] Chart appears after analysis, holds for ~2.5s, then swaps back to text

### Checkpoint 8: Intro Sequence (End-to-End)
- [ ] FightButton screen displays on page load
- [ ] Pressing FightButton calls `/api/game/start` and transitions to battle
- [ ] Bird slides in from right → `"Wild UWU BIRD appeared!"` typewriter text
- [ ] Player slides in from left → `"Go! YOU!"` typewriter text
- [ ] Both info panels visible with full HP bars after intro completes

### Checkpoint 9: Full Game Loop — Single Round
- [ ] Bird call phase: bird vibrates, audio plays from backend, content shows attack text
- [ ] 500ms echo gap after bird audio ends
- [ ] Player turn phase: player vibrates, mic records for 3.5s, content shows `"YOUR TURN!"`
- [ ] Analysis phase: recording sent to `/analyze`, content shows `"..."`
- [ ] Result shown: pitch chart displays for ~2.5s
- [ ] On pass: bird HP drains by 1/3, `"Round 1 cleared!"` text
- [ ] On fail: player HP drains by 1/3, `"Try again!"` text, same round replays

### Checkpoint 10: Full Game Loop — Win Path
- [ ] Player passes all 3 rounds (may take multiple attempts using tries)
- [ ] Bird HP drains: 3/3 → 2/3 → 1/3 → 0/3 across rounds
- [ ] On final round pass: `"UWU BIRD fainted!"` text
- [ ] Bird sprite swaps to `you_win_bird_animation.mp4`, video plays
- [ ] After video: `"YOU won the battle!"` text

### Checkpoint 11: Full Game Loop — Lose Path
- [ ] Player fails 3 times (across any combination of rounds)
- [ ] Player HP drains: 3/3 → 2/3 → 1/3 → 0/3 across failures
- [ ] On third fail: player sprite slides off-screen to the left
- [ ] `"UWU BIRD is victorious!"` text
- [ ] Bird sprite swaps to `you_lose_bird_animation.mp4`, video plays
- [ ] After video: `"YOU blacked out!"` text

### Checkpoint 12: Polish + Edge Cases
- [ ] Retry within a round fetches the same bird call audio (same pitch)
- [ ] Round advancement fetches the next (harder) bird call audio
- [ ] Videos preloaded — no delay on playback at game end
- [ ] No console errors throughout full game loop
- [ ] Game can be restarted (return to FightButton screen) after win or lose
