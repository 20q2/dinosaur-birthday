# Boss Fight Arena — Design Spec
_2026-03-28_

## Overview

Replace the current `BossFight.jsx` placeholder (lightning-bolt icon) with a full Pokemon-GO-raid-style arena: Godzilla looms large in the upper frame, all plaza dinos ring the middle ground, and the current player's tamed dinos own the front row. Every tap makes the player's dinos lunge toward Godzilla.

---

## Layout

```
┌───────────────────────────────────────────┐  ← canvas
│  [GODZILLA ATTACKS!]   [subtitle]          │  ← HTML header overlay
│                                            │
│            👾 GODZILLA 👾                  │  ← upper 50% of canvas
│           (large sprite, red glow)         │
│                                            │
│   🦕  🦕  🦕  🦕  🦕  🦕  🦕             │  ← plaza dinos mid ring
│                                            │
│       🦖  🦖  🦖  🦖  🦖                  │  ← MY DINOS front row (larger)
│  ─────────────────────────────────────────│
│  [GODZILLA HP ███████████ 418/600]        │  ← HTML overlay bottom
│  [13 DMG/tap] [7 Tamed] [8 Levels]        │
│  [TAP TO ATTACK!]                          │
└───────────────────────────────────────────┘
```

---

## Files Changed / Created

| File | Change |
|------|--------|
| `frontend/src/components/BossFightCanvas.js` | **New** — canvas engine for the arena |
| `frontend/src/components/BossFight.jsx` | **Modified** — mount canvas, fetch plaza data, wire tap to canvas |

---

## BossFightCanvas.js

### Constructor
```js
new BossFightCanvas(canvas, { plazaDinos, myDinos, godzillaImg, onReady })
```
- `plazaDinos`: array of plaza partner objects (from `api.getPlaza()`)
- `myDinos`: array of normalized partner-shaped objects for the current player's tamed dinos
- `godzillaImg`: preloaded `Image` for `godzilla.png`
- `onReady`: callback fired once sprites are initialized

### Coordinate System
- No world/camera transform — all positions are screen-space fractions, recomputed on resize
- `_layout()` called on `resize` and initial mount: derives all positions from `canvas.width / canvas.height`

### Arena Geometry
```
godzillaCenterX = canvasW * 0.5
godzillaCenterY = canvasH * 0.30        // Godzilla midpoint
godzillaHeight  = canvasH * 0.52        // image draw height

ellipseCX = canvasW * 0.5
ellipseCY = canvasH * 0.55              // ellipse center ≈ Godzilla's feet
ellipseRX = canvasW * 0.42
ellipseRY = canvasH * 0.20             // squished for ground-plane perspective
```

### Dino Slot Assignment
- **My dinos**: bottom arc of ellipse, angles `[120°, 240°]` (front/near side), evenly spaced
  - If > 7 tamed dinos, compress spacing to stay within arc
- **Plaza dinos**: full ellipse EXCEPT the bottom arc reserved for my dinos
  - If > ~24 plaza dinos, cap at 24 (pick first 24 or random selection)
- Each dino gets a fixed `slotAngle` and derives `{ sx, sy }` from the ellipse formula:
  ```
  sx = ellipseCX + cos(angle) * ellipseRX
  sy = ellipseCY + sin(angle) * ellipseRY
  ```

### Depth Scaling
Each dino's draw scale is interpolated by Y position on the ellipse:
```
depthT = (sy - (ellipseCY - ellipseRY)) / (ellipseRY * 2)  // 0 = far top, 1 = near bottom
levelScale = SCALE_MIN + ((level - 1) / (MAX_LEVEL - 1)) * (SCALE_MAX - SCALE_MIN)  // same as PlazaCanvas
drawScale = lerp(0.45, 1.25, depthT) * BASE_SPRITE_SCALE * levelScale
```
Dinos further back (near Godzilla, top of ellipse) are drawn at ~0.45× scale. Front-row dinos are at ~1.25× scale.

### Y-Sort Draw Order
All dinos sorted by `sy` ascending before drawing — far dinos drawn first, near dinos on top. My front-row dinos naturally overdraw plaza dinos at the same Y.

### Godzilla Rendering
- Draw `godzilla.png` centered at `(godzillaCenterX, godzillaCenterY)` with `height = godzillaHeight`
- Red drop-shadow: `ctx.filter = 'drop-shadow(0 0 24px rgba(255,50,50,0.7))'`
- On shake: offset draw position by `±shakeAmt` pixels (driven by `shaking` state passed from parent)
- Drawn AFTER far dinos (those at top of ellipse, behind Godzilla) but BEFORE near dinos — achieved by splitting the Y-sort: draw dinos with `sy < ellipseCY`, then Godzilla, then dinos with `sy >= ellipseCY`

### Dino State Per Slot
```js
{
  partner,          // partner-shaped object
  slotAngle,        // angle on ellipse (radians)
  sx, sy,           // resting screen position
  drawScale,
  facingLeft,       // faces toward Godzilla center
  spriteCanvas,     // from getRecolored()
  hopPhase,         // idle breathing phase
  // Jump state:
  jumpT,            // seconds elapsed since jump start; -1 = resting; reset to 0 on trigger
  jumpDuration,     // seconds for full arc (0.45s); jump is complete when jumpT >= jumpDuration
  jumpHeight,       // peak screen-px lift (depth-scaled: front dinos jump higher)
  // Plaza dino random jump timer:
  nextRandomJump,   // countdown seconds (null for my dinos)
}
```

### Jump Animation
**Trigger (my dinos):** `triggerAttack()` public method, called by `BossFight.jsx` on every tap. Sets `jumpT = 0` and starts the arc for all `myDino` slots simultaneously.

**Trigger (plaza dinos):** Each frame, decrement `nextRandomJump`. When it hits 0, trigger that dino's jump and reset timer to `6 + random()*12` seconds.

**Arc math (per frame):**
```
t = jumpT / jumpDuration           // normalized 0→1
arcY = sin(t * PI) * jumpHeight    // parabolic up and back
// Translate TOWARD Godzilla center during arc:
dx = (godzillaCenterX - sx) * 0.25 * sin(t * PI)
dy = (godzillaCenterY - sy) * 0.25 * sin(t * PI)
drawX = sx + dx
drawY = sy + dy - arcY
```
Front-row (my) dinos: `jumpHeight = lerp(30, 60, depthT)` — larger, more dramatic.
Plaza dinos: `jumpHeight = lerp(12, 28, depthT)` — subtler.

On jump completion (`jumpT >= jumpDuration`), spawn a small poof particle burst at dino feet (reuse `_spawnLandingPoof` pattern from PlazaCanvas).

### Idle Animation
All dinos have a gentle breathing bob: `hopY = sin(elapsed * 1.0 + hopPhase) * 1.5 * depthT` (scaled by depth so far dinos barely move).

### Public API
```js
canvas.start()
canvas.stop()
canvas.updatePlazaDinos(partners)   // called on WS plaza events
canvas.updateMyDinos(dinos)         // called when player data changes
canvas.triggerAttack()              // called on tap (before API call resolves)
canvas.setShaking(bool)             // called to shake Godzilla
canvas.destroy()                    // cleanup + remove listeners
```

---

## BossFight.jsx Changes

### Added State
```js
const [plazaPartners, setPlazaPartners] = useState([]);
```

### Canvas Mount (new useEffect)
```js
useEffect(() => {
  // Preload godzilla.png, create BossFightCanvas, wire to canvasRef
  // start() the canvas
  return () => canvas.destroy()
}, []);
```

### Plaza Data (new useEffect)
```js
useEffect(() => {
  api.getPlaza().then(data => setPlazaPartners(data.partners || []));
  const offArrive = ws.on('plaza', 'dino_arrive', ...);
  const offLeave  = ws.on('plaza', 'dino_leave', ...);
  return () => { offArrive(); offLeave(); };
}, []);
```

### Tap Handler
`handleTap` calls `canvasRef.triggerAttack()` immediately (before await), so the animation feels instant even before the API responds.

### Shaking
After resolving `bossTap`, if `dmg >= 20`, call `canvasRef.setShaking(true)` / `setShaking(false)` (replaces current DOM shake).

### My Dino Normalization
```js
const myDinos = (player?.dinos ?? [])
  .filter(d => d.tamed)
  .map(d => ({
    ...d,
    player_id: playerId,
    owner_name: player.name,
    owner_photo: player.photo_url,
  }));
```

### Removed
- The `<Zap>` icon and `bossWrapper` / `bossEmoji` DOM nodes
- The `bossShake` CSS animation on the container div (replaced by canvas-level Godzilla shake)
- The `<style>` block for `bossShake` (only `floatUp` and `hpBarPulse` remain)

### Kept
- Floating damage numbers (DOM layer, still tap-position based)
- HP bar section
- Stats row
- Tap hint
- Defeated overlay

---

## Godzilla Asset
- Path: `frontend/src/assets/sprites/godzilla.png`
- Imported as a URL: `import godzillaUrl from '../assets/sprites/godzilla.png'`
- Preloaded via `new Image()` before canvas start; canvas doesn't start until image loads

---

## Constraints & Edge Cases
- **No plaza dinos yet**: canvas renders fine with just my dinos in a small front arc
- **No tamed dinos**: my-dino arc is empty; plaza dinos fill the full ellipse
- **Boss defeated**: `triggerAttack()` becomes a no-op; dinos idle; Godzilla switches to skull/defeated state (replace image with a grayscale/desaturated version or overlay)
- **Resize**: `_layout()` recomputes all slot positions and scales; dinos snap to new positions (no animation needed)
- **Many dinos (>24 plaza)**: cap rendering at 24 plaza dinos, prioritized by level descending
