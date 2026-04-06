# Taming Runner Minigame — Design Spec

**Date:** 2026-04-06
**Status:** Approved

## Overview

A Chrome-dino-style side-scrolling runner minigame that plays during the taming flow. After the player harvests food (existing minigame), the wild dino runs toward the food they set out — dodging obstacles along the way. The player taps to jump. The run lasts ~20 seconds, always succeeds (the dino is always tamed), and score awards bonus XP.

## Flow Integration

Current flow:
```
Scan QR → Encounter → Harvest food (minigame) → Name & customize → Tamed
```

New flow:
```
Scan QR → Encounter → Harvest food (minigame) → Taming runner (NEW) → Name & customize → Tamed
```

The runner slots into `FoodHarvest.jsx` as a new phase:
```
phase='minigame' → phase='runner' → phase='taming'
```

No backend changes. The taming API call (`scanFood` with species) already happens on the naming screen. The runner is purely frontend.

## Game Mechanics

### Core Loop (20 seconds)
- The player's dino auto-runs rightward at increasing speed. Ground scrolls left.
- Obstacles (cacti, rocks) spawn off-screen right and scroll toward the dino.
- Player taps anywhere on the canvas to jump. Single tap = fixed-height parabolic jump arc (~500ms).
- No double-jump — tap is ignored while airborne.
- Hitting an obstacle causes a brief stumble (slow down + red flash) but does NOT end the run.
- Score = distance covered, displayed as a running meter count (top-right).

### Difficulty Curve
- Speed increases linearly over 20 seconds, reaching ~1.5x starting speed by the end.
- Obstacle frequency increases with speed.
- Gap between obstacles always leaves enough reaction time — no impossible combos.

### Scoring → XP
- Distance accumulates throughout the run. Stumbles briefly reduce distance gain rate.
- Bonus XP = `min(10, floor(distance / 100))` — yields 0-10 bonus XP on top of harvest XP.
- This bonus is added to the harvest score before being sent to the backend.

### End of Run
- At 20 seconds, obstacles stop spawning.
- A food item (meat or mejoberries, matching the dino's diet) appears at the right edge.
- Dino runs to the food, happy bounce animation, distance score animates up.
- "Continue" button appears → proceeds to naming/customization screen.
- No retry/restart option. Always moves forward. Keeps the party moving.

## Rendering & Canvas Architecture

### Canvas Setup
- Dedicated `<canvas>` element, full screen width, ~40% screen height (landscape strip like Chrome dino).
- Pixel art style: `imageSmoothingEnabled = false`, `imageRendering: 'pixelated'` CSS.
- Background matches app theme (#0a0a0a).

### Layers (drawn back to front per frame)
1. **Sky** — flat dark color (#0a0a0a)
2. **Ground** — scrolling dashed/dotted line at ~75% canvas height
3. **Obstacles** — cacti and rocks, drawn procedurally with canvas paths (no external assets)
   - Cacti: triangular/rectangular shapes in green-ish hue
   - Rocks: rounded rectangles in grey tones
4. **Dino** — the player's actual species sprite via `getRecolored(species, colors, regions)` from `spriteEngine.js` at ~2x scale. For shiny/effect dinos, use `getRecoloredUncached()` each frame.
5. **HUD** — distance counter (top-right), timer bar (top)

### Dino Animation
- **Run cycle:** 2-frame bob — alternate between sprite at normal Y and slightly offset Y every ~150ms to simulate running without needing separate run-cycle sprite art.
- **Jump:** Parabolic Y offset over ~500ms.
- **Stumble:** Tint red for 300ms via compositing overlay, brief screen shake, speed dip.
- **Squash & stretch:** Slight scale distortion on takeoff and landing.

### Obstacles
- Procedurally drawn with canvas paths — no asset files needed.
- Object pool of ~5 obstacles, recycled as they scroll off-screen left.

### Performance
- Single `requestAnimationFrame` loop.
- Small obstacle pool, single sprite draw, minimal per-frame allocation.
- Lightweight enough for any phone at the party.

## Component Structure

### New File: `frontend/src/components/TamingRunner.jsx`

Self-contained Preact component.

**Props:**
| Prop | Type | Description |
|------|------|-------------|
| `species` | string | Dino species key (e.g. 'trex') |
| `colors` | object | Color map for the dino's regions |
| `onComplete` | function(score) | Callback when run ends, passes distance score |

**Internal State / Phases:**
| Phase | Behavior |
|-------|----------|
| `ready` | "Tap to start!" prompt, dino standing still |
| `running` | 20-second game loop, active input |
| `done` | Score summary, dino at food, "Continue" button → calls `onComplete(score)` |

### Modified File: `frontend/src/components/FoodHarvest.jsx`

- Add `phase === 'runner'` branch that renders `<TamingRunner>`.
- On harvest minigame end, transition to `phase='runner'` instead of `phase='taming'`.
- `TamingRunner.onComplete(score)` adds bonus XP to harvest score, then transitions to `phase='taming'`.

### No Other Files Change
The runner is fully encapsulated. DinoTaming is unaware of the upstream change.

## Input Handling

- **Mobile:** Tap anywhere on canvas to jump. `touchstart` event with `preventDefault()` to avoid page scroll.
- **Desktop:** Spacebar also triggers jump (for testing / laptop players).
- No other gestures needed — single mechanic.

## Edge Cases

- **Screen resize:** Canvas width set on mount from `window.innerWidth`. No dynamic resize mid-game — 20 seconds is too short for rotation to matter.
- **Sprites not loaded:** `spriteEngine.preloadAll()` is already called on app init. If somehow not ready, fall back to a colored rectangle placeholder.
- **Godzilla:** Godzilla is auto-tamed (no food step), so the runner never triggers for Godzilla. No special handling needed.

## Visual Style

Consistent with app theme:
- Dark background (#0a0a0a)
- Ground line in indigo (#6366f1)
- HUD text in light grey (#e0e0e0)
- Obstacles in muted earth tones
- Score/timer use the same font styling as existing game UI
