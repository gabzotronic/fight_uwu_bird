# Signal Processing & Scoring Pipeline

This document describes how audio is processed and scored in FIGHT UWU BIRD,
from raw input to pass/fail decision.

---

## Pipeline Diagram

```
╔══════════════════════════════════════════════════════════════════════════════════╗
║              FIGHT UWU BIRD — Signal Processing & Scoring Pipeline               ║
╚══════════════════════════════════════════════════════════════════════════════════╝

  TEMPLATE (built once at server startup)          PLAYER INPUT (per round)
  ════════════════════════════════════════          ════════════════════════

  ┌─────────────────────┐                          ┌──────────────────────────┐
  │  uwu_sound_1.mp3    │                          │  Microphone              │
  │  (source asset)     │                          │  3.5 s · 44100 Hz · mono │
  └──────────┬──────────┘                          └────────────┬─────────────┘
             │ librosa.load()                                   │ PyAV decode
             │ 44100 Hz mono float32                            │ → float32 PCM
             ▼                                                  ▼
  ┌──────────────────────┐                          ┌───────────────────────────┐
  │  librosa.pyin        │                          │  librosa.pyin             │
  │  fmin = C3 ~130 Hz   │                          │  fmin = C3  fmax = C7     │
  │  fmax = C7 ~2093 Hz  │                          │  hop_length = 512         │
  │  hop_length = 512    │                          │  → F0[t]  (NaN=unvoiced)  │
  │  → F0[t] (NaN=unvcd) │                          └──────┬─────────┬──────────┘
  └──────────┬───────────┘                                 │         │
             │                                             │ count(~NaN)/N
             │ nanmedian(F0)                               ▼         │
             │ → base_median_hz                    voiced_ratio      │ nanmedian(F0)
             │                                     [Check ① input]   ▼
             │                                             player_median_hz
             │                                             [Check ③ input]
             ▼                                             │
  ┌──────────────────────┐                                 ▼
  │  contour_st[t]       │                          ┌───────────────────────────┐
  │  = 12·log2(          │                          │  contour_st[t]            │
  │    F0 / base_median) │                          │  = 12·log2(               │
  │  (0 where unvoiced)  │                          │    F0 / player_median)    │
  └──────────┬───────────┘                          │  (0 where unvoiced)       │
             │ 5-frame moving average               └──────────┬────────────────┘
             ▼                                                  │ 5-frame moving average
  ┌──────────────────────┐                                      ▼
  │  template[t]         │                          ┌───────────────────────────┐
  │  (smoothed semitone  │    trim voiced edges ──▶ │  trim leading/trailing    │
  │   contour, rel. to   │    (both sides do this)  │  zero (unvoiced) edges    │
  │   bird's own median) │                          └──────────┬────────────────┘
  │  saved → .npy        │                                     │
  └──────────┬───────────┘                                     │
             │ trim voiced edges                               │
             ▼                                                  │
  ┌──────────────────────┐                                     │
  │  template_trimmed    │                                     │
  │  (voiced span only)  │◀────────────────────────────────────┘
  └──────────┬───────────┘          player_trimmed
             │
             │        per-round pitch target
             │        ─────────────────────
             │        target_hz = base_median_hz
             │                   × 2^(round_shift/12)
             │        min_hz    = target_hz
             │                   × 2^(-pitch_tolerance/12)
             │
             ▼
╔════════════════════════════════════════════════════════════════════════════════╗
║                               S C O R I N G                                   ║
╠════════════════════════════════════════════════════════════════════════════════╣
║                                                                                ║
║  CHECK ①  Voiced ratio                                                        ║
║  ─────────────────────────────────────────────────────────────────────────    ║
║  voiced_ratio  ≥  min_voiced_ratio (0.05)                                     ║
║                                                  FAIL → "Not enough sound"    ║
║                                                                                ║
║  CHECK ②  Contour shape — DTW                                                 ║
║  ─────────────────────────────────────────────────────────────────────────    ║
║                                                                                ║
║   player_trimmed    ──┐                                                       ║
║                       ├──▶  dtw( player_trimmed, template_trimmed )           ║
║   template_trimmed  ──┘     window_type = "sakoechiba"                        ║
║                             window_size = max( dtw_window_frames,             ║
║                                               |len(player) - len(template)| ) ║
║                               │                                               ║
║                               ▼                                               ║
║                     norm_dist = distance / path_length                        ║
║                               │                                               ║
║                               ▼                                               ║
║                     score = max(0,  1 − norm_dist / dtw_threshold)            ║
║                               │                                               ║
║                     score  >  0.35 ?                                          ║
║                                                  FAIL → "Didn't sound like uwu"║
║                                                                                ║
║  CHECK ③  Absolute pitch level                                                ║
║  ─────────────────────────────────────────────────────────────────────────    ║
║  player_median_hz  ≥  min_hz                                                  ║
║  (= target_hz − pitch_tolerance semitones)                                    ║
║                                                  FAIL → "Not high enough"     ║
║                                                                                ║
╠════════════════════════════════════════════════════════════════════════════════╣
║                                                                                ║
║   ① AND ② AND ③  →  PASS  →  next round  (or WIN if round 3)                ║
║   any FAIL        →  FAIL  →  player retries / game over                     ║
║                                                                                ║
╚════════════════════════════════════════════════════════════════════════════════╝
```

---

## Step-by-Step Explanation

### Template (built once at startup)

The bird's reference contour is extracted from `uwu_sound_1.mp3` and saved to
`assets/uwu_template.npy` so it doesn't need to be recomputed on every request.

1. **Load audio** — `librosa.load()` decodes the MP3 to a 44100 Hz mono float32
   waveform.
2. **Pitch detection** — `librosa.pyin` (probabilistic YIN) runs frame-by-frame
   with a 512-sample hop (~11.6 ms per frame), detecting the fundamental frequency
   F0 in each frame. Unvoiced frames are returned as `NaN`.
3. **Median normalisation** — the bird's median F0 across all voiced frames
   (`base_median_hz`) is computed. The contour is converted to semitones *relative
   to this median*, making it speaker/pitch-independent:
   ```
   contour_st[t] = 12 · log2( F0[t] / base_median_hz )
   ```
4. **Smoothing** — a 5-frame (≈58 ms) centred moving average is applied to reduce
   frame-to-frame jitter. Unvoiced frames are treated as 0 before smoothing.
5. **Per-round target pitches** — at game start, `target_hz` for each round is
   derived by shifting `base_median_hz` by `round_shifts[i]` semitones:
   ```
   target_hz = base_median_hz × 2^(round_shift / 12)
   ```

### Player Input (per round)

1. **Capture** — the browser records 3.5 s of microphone audio at 44100 Hz mono
   16-bit WAV via `getUserMedia`.
2. **Decode** — the backend uses PyAV to decode any container format (WAV, M4A,
   etc.) to float32 PCM at 44100 Hz.
3. **Pitch detection** — same `librosa.pyin` settings as the template.
4. **Voiced ratio** — the fraction of non-NaN frames; used directly for Check ①.
5. **Median normalisation & smoothing** — same procedure as the template, but
   relative to the *player's own* median. This is intentional: Check ② tests
   *shape* (does the melody go up and down the same way?), not absolute pitch.
   Absolute pitch is handled separately in Check ③.
6. **Edge trimming** — leading and trailing zero-valued (unvoiced) frames are
   stripped before DTW. The same trimming is applied to the template at scoring
   time, so neither sequence includes silence padding that would inflate the
   DTW cost without being visible in the shape comparison.

---

## The Three Checks

### Check ① — Voiced Ratio

```
voiced_ratio  ≥  min_voiced_ratio
```

A trivial gate that rejects completely silent or near-silent recordings before
running the more expensive DTW computation.

### Check ② — Contour Shape (DTW)

Both sequences are trimmed to their voiced spans before being passed to DTW.
This ensures unvoiced zero-regions at the edges don't contribute cost and don't
create a false mismatch between the shape of the two signals.

```
norm_dist  = dtw_distance / warping_path_length
score      = max(0,  1 − norm_dist / dtw_threshold)
pass  iff  score > 0.35
```

The **Sakoe-Chiba window** (`dtw_window_frames`) constrains how far the warping
path may deviate from the diagonal, preventing a badly-timed recording from
"cheating" by warping wildly across the full sequence.

**Window floor** — the Sakoe-Chiba window has a hard mathematical lower bound:
if the two sequences differ in length by *d* frames, a window narrower than *d*
cannot produce any valid path. The code automatically uses
`max(dtw_window_frames, |len(player_trimmed) − len(template_trimmed)|)` and
logs a warning when the floor kicks in. The configured value still constrains
warping for all frames beyond that floor.

At the default hop length (512 samples @ 44100 Hz), 1 frame ≈ 11.6 ms, so:

| `dtw_window_frames` | Intended max time stretch | Notes |
|---------------------|--------------------------|-------|
| 15                  | ±0.17 s                  | May be widened by floor if sequences differ in length |
| 30                  | ±0.35 s                  | Recommended starting point |
| 60                  | ±0.70 s                  | Loose constraint |
| `None`              | unconstrained            | Original behaviour |

### Check ③ — Absolute Pitch Level

```
player_median_hz  ≥  target_hz × 2^(−pitch_tolerance / 12)
```

The player's median pitch across their entire recording must be within
`pitch_tolerance` semitones *below* the round's target. This check is independent
of shape — a player who sings the right melody at the wrong octave passes Check ②
but fails Check ③.

---

## Configuration Knobs (`backend/config.py`)

| Parameter | Current value | Effect |
|-----------|--------------|--------|
| `dtw_threshold` | `3.0` | Score ceiling. `score = 1 − norm_dist / threshold`. Lower = stricter shape match required. |
| `dtw_window_frames` | `30` | Sakoe-Chiba band width. Lower = less temporal stretching allowed. `None` = unconstrained. Actual window used is `max(this, length_diff)`. |
| `pitch_tolerance` | `3.0` | Semitones below round target still accepted. `0` = must meet or exceed target exactly. |
| `min_voiced_ratio` | `0.05` | Minimum fraction of frames with detected pitch. Raise to require more sustained singing. |
| `round_shifts` | `[-10, -6, -3]` | Semitone shift applied to bird's base pitch per round. More negative = lower target. |

**Making it easier:** raise `dtw_threshold`, raise `pitch_tolerance`, raise
`dtw_window_frames`.

**Making it harder:** lower `dtw_threshold`, lower `pitch_tolerance`, lower
`dtw_window_frames` (or set all three simultaneously).

---

## Visualisation Scripts

### `visualize_scoring.py`

Static reference diagram. Shows the bird's pitch contour, DTW tolerance band,
and per-round absolute Hz targets — all derived from config, with no player
input required.

### `visualize_scoring2.py`

Loads a specific user recording (`USER_INPUT_FILE`) and produces **two figures**:

**`scoring_visualisation2.png` — two-panel diagnostic**

- *Panel 1 (Hz corridor)*: player's raw F0 trace overlaid on the round's
  absolute Hz pass corridor (combines checks 2 and 3 as approximate bounds).
- *Panel 2 (contour shape)*: bird's voiced semitone contour with ±dtw_band
  shading, and the player's contour **linearly resampled** to the bird's
  duration. The red line tracking the green line through the band means the
  shapes match.

**`scoring_visualisation2_merged.png` — single merged view**

The player's time-normalised contour is converted back to absolute Hz using the
player's own median, then overlaid directly on the bird's Hz corridor. A single
plot that shows both checks simultaneously:

- Red line **inside** the band → check 3 passes (absolute pitch) and check 2
  likely passes (shape).
- Red line **outside** the band → at least one check fails.

Note: the merged view is a conservative approximation for check 2. DTW may
still pass even if the resampled line sits slightly outside the band (DTW finds
the optimal warping; linear resampling does not). If the line is clearly inside,
DTW will always pass.

---

## Relevant Source Files

| File | Role |
|------|------|
| `backend/config.py` | All tuning parameters |
| `backend/audio_processor.py` | `pyin` pitch extraction, semitone normalisation, smoothing |
| `backend/uwu_detector.py` | Three checks; DTW against voiced-trimmed template with Sakoe-Chiba window |
| `backend/pitch_shifter.py` | Generates per-round bird audio at startup |
| `backend/visualize_scoring.py` | Static scoring bounds diagram (no player input) |
| `backend/visualize_scoring2.py` | Two-panel diagnostic + merged view for a specific recording |
