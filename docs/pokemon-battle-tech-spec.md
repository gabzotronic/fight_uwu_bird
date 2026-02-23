# Tech Spec: Pokémon Red/Blue Battle UI

## Overview

A React-based battle screen that recreates the Pokémon Red/Blue (Gen I) battle aesthetic with animated sprite entrances, attack effects, health bar transitions, and fainting sequences. Styled using the **css-pokemon-gameboy** CSS framework for authentic Game Boy UI chrome (frames, HP bars), with custom CSS keyframe animations for battle-specific motion.

The bottom dialogue area displays either typewriter text or an embedded **Plotly.js** chart on alternating turns, acting as a flexible content slot rather than a traditional game menu.

---

## Goals

- Faithfully reproduce the visual rhythm of a Gen I Pokémon battle
- All animations driven by CSS keyframes (not JS-based animation libraries) for the authentic stepped/chunky retro feel
- Turn sequencing orchestrated via async React state machine
- Clean component boundaries so individual pieces (sprites, HP bars, dialogue) are reusable and testable
- The bottom frame serves as a dual-purpose content area: text OR a Plotly.js visualization

## Non-Goals

- Full game logic (damage calculation, type effectiveness, AI) — the spec covers the **presentation layer** only
- Mobile responsiveness (the original Game Boy had a fixed resolution; we target desktop viewports)
- Multiplayer / networking
- Action menus or move selection UI — turns are driven programmatically, not by player input

---

## Tech Stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Framework | React 18+ | Component model maps cleanly to battle scene elements |
| Styling | css-pokemon-gameboy v0.6.1 | Provides authentic Gen I frames and HP bars out of the box |
| Font | Provided by css-pokemon-gameboy (inlined via base64 `@font-face`) | No external font needed — the framework bundles a Game Boy pixel font into the CSS |
| Animation | CSS `@keyframes` + `animation-timing-function: steps()` | Retro stepped feel; no runtime animation library needed |
| Charting | Plotly.js (via `react-plotly.js`) | Embedded charts rendered in the dialogue area on alternating turns |
| Turn orchestration | Async state machine (React state + `await delay()`) | Simple, linear, easy to reason about |
| Build | Vite | Fast dev server; css-pokemon-gameboy already uses Vite |

### Why Not Framer Motion / Motion?

Framer Motion produces smooth, interpolated animations by default. The Gen I games animate in discrete frame steps (e.g., a sprite slides in over ~8 visible positions, not a smooth ease). CSS `steps(N)` timing functions reproduce this natively. Framer Motion would work but requires fighting its defaults to get the right feel.

---

## Visual Layout Reference

Based on the classic Gen I battle screen (Zubat vs Bulbasaur):

```
┌──────────────────────────────────────────────┐
│                                              │
│  ┌──────────────────┐                        │
│  │ UWU BIRD         │                        │
│  │ :L10             │                        │
│  │ HP: ████████████▶│         [uwu_bird     │
│  └──────────────────┘          sprite]      │
│                                              │
│                                              │
│                       ┌────────────────────┐ │
│   [Player             │ YOU                │ │
│    sprite]            │ :L6                │ │
│                       │ HP: █████░░░░░     │ │
│                       │       13 / 22      │ │
│                       └────────────────────┘ │
│                                              │
│  ┌──────────────────────────────────────────┐│
│  │                                          ││
│  │ [Game Text] ▼                            ││
│  │    — OR —                                ││
│  │ [Plotly.js chart rendered here]          ││
│  │                                          ││
│  └──────────────────────────────────────────┘│
└──────────────────────────────────────────────┘
```

Five key spatial observations:

1. **Opponent info panel** — top-left. Shows name, level, and HP bar only. No numeric HP readout.
2. **Opponent sprite** — top-right, diagonally opposed to the player. Front-facing sprite.
3. **Player sprite** — center-left. Back-facing sprite. Same rendered size as the opponent sprite (no scale difference).
4. **Player info panel** — center-right. Shows name, level, HP bar, AND numeric HP (`current / max`). This is the key asymmetry vs the opponent panel.
5. **Bottom frame** — full-width. Displays either typewriter text or a Plotly.js chart depending on the current turn.

---

## Component Architecture

```
<BattleScene>
├── <BattleBackground />           // Static background (gradient or tiled)
├── <InfoPanel side="opponent" />  // Top-left: name, level, HP bar (no numeric HP)
│   └── <HealthBar />
├── <PokemonSprite side="opponent" />  // Top-right, slides in from right
├── <PokemonSprite side="player" />    // Center-left, slides in from left
├── <InfoPanel side="player" />    // Center-right: name, level, HP bar + numeric HP
│   └── <HealthBar />
└── <ContentFrame />               // Bottom: frame containing text OR Plotly chart
```

### Component Descriptions

#### `<BattleScene>`
Root container. Manages the turn state machine and passes animation trigger props down to children. Fixed aspect ratio container (160×144 scaled up, or a modern equivalent like 640×576 at 4×).

**State owned:**
- `phase`: enum — `'intro' | 'player-attack' | 'opponent-attack' | 'player-faint' | 'opponent-faint' | 'victory' | 'defeat'`
- `playerHp` / `opponentHp`: number
- `contentMode`: `'text' | 'chart'` — what the bottom frame currently displays
- `dialogue`: string (current text when `contentMode === 'text'`)
- `chartData`: Plotly data/layout object (when `contentMode === 'chart'`)
- `playerPokemon` / `opponentPokemon`: Pokemon data objects

#### `<BattleBackground />`
Pure presentational. A `<div>` with the classic Gen I battle background — horizontal lines pattern. Can be a CSS `repeating-linear-gradient` or a tiled PNG. No state, no animation.

#### `<InfoPanel />`
Uses the **css-pokemon-gameboy `frame`** class for the bordered panel look. Handles both the opponent and player variants via a `side` prop.

**Props:**
- `side`: `'player' | 'opponent'`
- `name`: string
- `level`: number
- `currentHp`: number
- `maxHp`: number

**Key asymmetry:** When `side === 'player'`, the panel renders the numeric HP readout (`currentHp / maxHp`) below the bar. When `side === 'opponent'`, it renders only the bar.

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
- Opponent panel: slides in from the left (it's on the left side of the screen)
- Player panel: slides in from the right (it's on the right side of the screen)

**css-pokemon-gameboy usage:**
```html
<div class="frame">
  <!-- panel content -->
</div>
```
Use the `accent-primary` class variant if you want the green-tinted frame, or leave default.

#### `<HealthBar />`
Wraps the **css-pokemon-gameboy `<progress>`** element. The framework provides color-changing behavior (green → yellow → red) based on value. For Chrome compatibility, apply `.p1` through `.p100` classes dynamically.

**Props:**
- `current`: number
- `max`: number

**CSS integration:**
```html
<progress class="p{percentageValue}" value="{current}" max="{max}"></progress>
```

The HP drain animation is handled by stepping the `current` value down over time (see Turn Sequencing), NOT via CSS transition on the `<progress>` element, because the framework relies on class-based color thresholds. We tick down HP in discrete steps with a `setInterval`, updating the `.pN` class each tick, which produces the classic frame-by-frame drain.

#### `<PokemonSprite />`
Displays the Pokémon sprite image. Both player and opponent sprites render at the **same size** — no scale difference. During battle, this is a static `<img>`. On faint, it swaps to a `<video>` element (see Fainting Animation).

**Props:**
- `side`: `'player' | 'opponent'`
- `src`: string (sprite image URL — back sprite for player, front sprite for opponent)
- `faintVideoSrc`: string (mp4 URL for the faint animation)
- `animationState`: `'entering' | 'idle' | 'attacking' | 'hit' | 'fainting' | 'fainted'`
- `onAnimationComplete`: callback

**Rendering logic:**
```jsx
if (animationState === 'fainting' && faintVideoSrc) {
  return <video src={faintVideoSrc} autoPlay muted onEnded={onFaintComplete} />
} else if (animationState === 'fainted') {
  return null  // sprite removed from DOM
} else {
  return (
    <img
      src={src}
      className={`sprite sprite--${side} sprite--${animationState}`}
    />
  )
}
```

Sprites use `image-rendering: pixelated` to preserve sharp pixel edges when scaled up.

#### `<ContentFrame />`
The bottom full-width area, using the **css-pokemon-gameboy `frame`** class. This is the key flexible component — it conditionally renders either text content or a Plotly.js chart.

**Props:**
- `mode`: `'text' | 'chart'`
- `text`: string (used when `mode === 'text'`)
- `textSpeed`: number (ms per character, default 50)
- `onTextComplete`: callback
- `chartData`: Plotly `data` array (used when `mode === 'chart'`)
- `chartLayout`: Plotly `layout` object (used when `mode === 'chart'`)

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

**Plotly styling considerations:**
- Set `paper_bgcolor` and `plot_bgcolor` to `'transparent'` so the frame background shows through
- Inherit the pixel font via `font.family: 'inherit'`
- Use `staticPlot: true` to disable hover/zoom interactions (keeps the retro non-interactive feel)
- Use `displayModeBar: false` to hide the Plotly toolbar
- Keep margins tight so the chart fills the frame
- The chart animates in via Plotly's built-in `animate()` or simply appears; no CSS entrance needed since the frame itself is already visible

**Transition between modes:**
When switching from text to chart (or vice versa), the content swaps instantly — no crossfade. This matches the Gen I feel where UI elements snap in and out. The `mode` prop is toggled by the parent `<BattleScene>` during the turn sequence.

---

## Animation Specifications

All animations use CSS `@keyframes` with `steps()` timing to achieve the retro frame-by-frame look.

### 1. Slide-In Entrance (Intro Phase)

**Player side** (sprite + panel): Slides in from the left.
**Opponent side** (sprite + panel): Slides in from the right.

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

**`steps(12)`** produces ~12 discrete positions over 0.8s, matching the choppy original. The info panels use the same animation, slightly delayed (staggered by ~0.2s via `animation-delay`).

### 2. Attack Animation (Shake/Vibrate)

When a Pokémon attacks, the **attacker** lunges forward slightly, then the **defender** shakes rapidly to indicate a hit.

**Attacker lunge:**
```css
@keyframes attackLunge {
  0%   { transform: translateX(0); }
  30%  { transform: translateX(20px); }
  100% { transform: translateX(0); }
}

.sprite--attacking {
  animation: attackLunge 0.4s steps(4) forwards;
}
```

**Defender hit shake:**
```css
@keyframes hitShake {
  0%   { transform: translateX(0); opacity: 1; }
  10%  { transform: translateX(-6px); opacity: 0.3; }
  20%  { transform: translateX(6px); opacity: 1; }
  30%  { transform: translateX(-6px); opacity: 0.3; }
  40%  { transform: translateX(6px); opacity: 1; }
  50%  { transform: translateX(-6px); opacity: 0.3; }
  60%  { transform: translateX(0); opacity: 1; }
  100% { transform: translateX(0); opacity: 1; }
}

.sprite--hit {
  animation: hitShake 0.6s steps(1, end) forwards;
}
```

The `opacity` flicker simulates the Gen I "flash on hit" effect where the sprite blinks in and out rapidly. Using `steps(1, end)` on the overall animation makes each keyframe snap rather than interpolate.

### 3. Health Bar Drain

The HP bar drains in discrete ticks, NOT via a smooth CSS transition. This is orchestrated in JavaScript:

```ts
async function drainHp(
  setHp: (n: number) => void,
  from: number,
  to: number,
  tickMs: number = 30
) {
  for (let hp = from; hp >= to; hp--) {
    setHp(hp);
    await delay(tickMs);
  }
}
```

Each tick updates the React state, which recalculates the percentage and applies the corresponding `.pN` class on the `<progress>` element. The css-pokemon-gameboy framework handles the color transitions (green → yellow → red) via these classes.

**Tick rate:** ~30ms per HP point, matching the original game's bar drain speed. For Pokémon with high HP, you may want to drain multiple points per tick to cap total drain time at ~2 seconds.

### 4. Fainting Animation

Two-phase animation:

**Phase A — Sprite collapse (CSS fallback):**
The sprite slides downward and fades out, simulating the original "sinking" faint.
```css
@keyframes faintCollapse {
  from {
    transform: translateY(0);
    opacity: 1;
  }
  to {
    transform: translateY(60px);
    opacity: 0;
  }
}

.sprite--fainting-collapse {
  animation: faintCollapse 0.6s steps(8) forwards;
}
```

**Phase B — Faint video (preferred):**
If a custom faint `.mp4` video is provided for the Pokémon, swap the `<img>` to a `<video>` element instead of playing the CSS collapse. The video plays once, and `onEnded` fires the completion callback.

```jsx
// In the sprite component:
const [showVideo, setShowVideo] = useState(false);

useEffect(() => {
  if (animationState === 'fainting' && faintVideoSrc) {
    setShowVideo(true);
  }
}, [animationState, faintVideoSrc]);

if (showVideo) {
  return (
    <video
      src={faintVideoSrc}
      autoPlay
      muted
      playsInline
      className="sprite sprite--faint-video"
      onEnded={() => onAnimationComplete('fainted')}
    />
  );
}
```

If no video is provided, fall back to the CSS collapse animation and listen for `onAnimationEnd`.

### 5. Typewriter Text

Not a CSS animation — implemented in JS via `useEffect`:

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

A blinking `▼` cursor appears at the end when `done === true`, indicating the message is complete and the sequence can advance.

---

## Turn Sequencing (State Machine)

The battle flow is an async function that drives the entire animation pipeline. Each turn alternates the bottom frame between text and chart content.

```ts
type BattlePhase =
  | 'intro'
  | 'player-attack'
  | 'opponent-attack'
  | 'player-faint'
  | 'opponent-faint'
  | 'victory'
  | 'defeat';

async function executeTurn(move: Move, turnData: TurnData) {
  // 1. Player attacks — show text
  setPhase('player-attack');
  setContentMode('text');
  setDialogue(`${playerPokemon.name} used ${move.name}!`);
  await delay(400);

  // Attacker lunges
  setPlayerAnim('attacking');
  await delay(400);
  setPlayerAnim('idle');

  // Defender takes hit
  setOpponentAnim('hit');
  await delay(600);
  setOpponentAnim('idle');

  // HP drains
  const newOpponentHp = Math.max(0, opponentHp - move.damage);
  await drainHp(setOpponentHp, opponentHp, newOpponentHp);
  await delay(300);

  // Show chart for this turn's data
  setContentMode('chart');
  setChartData(turnData.playerChart);
  await delay(2000);  // hold chart visible

  // Check faint
  if (newOpponentHp <= 0) {
    setPhase('opponent-faint');
    setOpponentAnim('fainting');
    setContentMode('text');
    setDialogue(`${opponentPokemon.name} fainted!`);
    await delay(1200);
    setPhase('victory');
    return;
  }

  // 2. Opponent attacks — show text
  setPhase('opponent-attack');
  setContentMode('text');
  const oppMove = selectOpponentMove();
  setDialogue(`${opponentPokemon.name} used ${oppMove.name}!`);
  await delay(400);

  setOpponentAnim('attacking');
  await delay(400);
  setOpponentAnim('idle');

  setPlayerAnim('hit');
  await delay(600);
  setPlayerAnim('idle');

  const newPlayerHp = Math.max(0, playerHp - oppMove.damage);
  await drainHp(setPlayerHp, playerHp, newPlayerHp);
  await delay(300);

  // Show chart for opponent's turn data
  setContentMode('chart');
  setChartData(turnData.opponentChart);
  await delay(2000);  // hold chart visible

  if (newPlayerHp <= 0) {
    setPhase('player-faint');
    setPlayerAnim('fainting');
    setContentMode('text');
    setDialogue(`${playerPokemon.name} fainted!`);
    await delay(1200);
    setPhase('defeat');
    return;
  }

  // 3. Reset for next turn
  setContentMode('text');
  setDialogue('');
}
```

**`delay` helper:**
```ts
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

### Intro Sequence

Before the first turn, a separate async function handles the entrance:

```ts
async function playIntro() {
  setPhase('intro');
  setContentMode('text');
  setDialogue(`Wild ${opponentPokemon.name} appeared!`);
  setOpponentAnim('entering');
  await delay(1000);
  setOpponentAnim('idle');

  setDialogue(`Go! ${playerPokemon.name}!`);
  setPlayerAnim('entering');
  await delay(1000);
  setPlayerAnim('idle');

  setDialogue('');
}
```

---

## Data Model

```ts
interface Pokemon {
  name: string;
  level: number;
  maxHp: number;
  currentHp: number;
  frontSprite: string;    // URL to front-facing sprite image
  backSprite: string;     // URL to back-facing sprite image
  faintVideo?: string;    // optional URL to .mp4 faint animation
  moves: Move[];
}

interface Move {
  name: string;
  type: string;           // 'normal' | 'fire' | 'water' | etc.
  damage: number;         // simplified flat damage for presentation layer
}

interface TurnData {
  playerChart: PlotlyChartConfig;
  opponentChart: PlotlyChartConfig;
}

interface PlotlyChartConfig {
  data: Plotly.Data[];
  layout?: Partial<Plotly.Layout>;
}
```

**Sprite assets:** Use sprites from community sprite databases (e.g., PokéAPI sprites, Spriters Resource). Front sprites for the opponent, back sprites for the player — matching the original Gen I layout. Both rendered at the same size.

---

## CSS Integration with css-pokemon-gameboy

### Installation

Download the v0.6.1 release ZIP and include the CSS:
```html
<link rel="stylesheet" href="./styles/css-pokemon-gameboy.css">
```

Or copy the CSS into your Vite/React project's `public/` directory and import it.

### Key Classes Used

| Element | Class(es) | Notes |
|---------|-----------|-------|
| Info panels (name/HP) | `.frame` | Core bordered panel |
| Accent on panels | `.frame.accent-primary` | Optional green tint |
| HP bar | `<progress class="pN">` | Where N = 1–100 for percentage; framework auto-colors |
| Content frame (bottom) | `.frame` | Same bordered panel, full-width at screen bottom |
| Unscaled mode | `.no-hd` | Use if you want true 1× pixel size |

### Custom CSS Layer

All animation keyframes and battle-specific layout go in a separate `battle.css` file that layers on top of the framework CSS. This avoids modifying the framework source.

```
src/
├── styles/
│   ├── css-pokemon-gameboy.css   (framework, unmodified)
│   └── battle.css                (our animations + layout)
```

---

## Layout

The battle scene uses CSS Grid to position elements matching the Gen I spatial layout:

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
.player-sprite   { grid-area: 3 / 1 / 5 / 2; }  /* center-left */
.player-panel    { grid-area: 3 / 2 / 4 / 3; }  /* center-right */
.content-frame   { grid-area: 5 / 1 / 6 / 3; }  /* full-width bottom */
```

The sprites are absolutely positioned within their grid cells so the slide-in animation can start off-screen. Both sprites render at the same dimensions.

---

## File Structure

```
src/
├── components/
│   ├── BattleScene.tsx          # Root: state machine, turn orchestration
│   ├── BattleBackground.tsx     # Static background
│   ├── PokemonSprite.tsx        # Sprite img/video, animation classes
│   ├── InfoPanel.tsx            # Name, level, HP bar (player vs opponent variants)
│   ├── HealthBar.tsx            # Wraps <progress> with css-pokemon-gameboy
│   └── ContentFrame.tsx         # Frame containing text (typewriter) OR Plotly chart
├── hooks/
│   ├── useTypewriter.ts         # Typewriter text hook
│   └── useBattleSequence.ts     # Async turn orchestration logic
├── styles/
│   ├── css-pokemon-gameboy.css  # Framework (unmodified)
│   └── battle.css               # Custom keyframes + layout
├── types/
│   └── battle.ts                # Pokemon, Move, TurnData, BattlePhase types
├── utils/
│   └── delay.ts                 # delay() helper
└── App.tsx                      # Mounts <BattleScene> with sample data
```

---

## Open Questions & Future Considerations

1. **Sound effects:** The original games have distinct sounds for attacks, HP drain, and fainting. Adding `<audio>` playback in the turn sequence would complete the experience. Not in scope for v1 but the async architecture supports it trivially (`audioRef.current.play(); await delay(duration)`).

2. **Plotly chart sizing:** The content frame has a fixed height. Plotly charts need to fit within this constraint. Use `layout.height` explicitly or set the container to `height: 100%` and let Plotly fill it. Test with different chart types (bar, line, scatter) to ensure they render legibly at small sizes.

3. **Chart-to-text transition timing:** The `await delay(2000)` hold time for charts is a starting estimate. This may need to be configurable per turn or driven by chart complexity. Consider adding a `chartHoldMs` field to `TurnData`.

4. **Plotly bundle size:** Plotly.js is large (~3MB minified). If bundle size matters, use `plotly.js-basic-dist-min` (a trimmed build with only common chart types) or `plotly.js-cartesian-dist-min` for just 2D charts. Import via `react-plotly.js` with a custom Plotly bundle.

5. **Framework limitations:** css-pokemon-gameboy is self-described as "a joke CSS-framework not intended for production." The `<progress>` element in particular has cross-browser quirks (Chrome doesn't support value-based color changes natively, requiring the `.p1`–`.p100` class workaround). If this becomes painful, consider replacing the HP bar with a custom `<div>`-based implementation styled to match.

6. **Faint video format:** mp4 with H.264 encoding has the broadest browser support. Videos should be short (1–2 seconds), small resolution (matching the sprite size, e.g., 96×96), and pre-loaded to avoid playback delays. Use `<video preload="auto">`.

7. **Panel shape:** The original Gen I info panels have an angled/arrow-shaped right edge (opponent) or left edge (player), not a simple rectangle. The css-pokemon-gameboy `.frame` class produces a rectangle. Achieving the exact Gen I panel shape may require a CSS `clip-path` or a custom border-image. This is a polish item for after the core is working.
