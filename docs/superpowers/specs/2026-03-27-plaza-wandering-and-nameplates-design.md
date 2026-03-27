# Plaza Wandering AI & Nameplates

## Summary

Replace the circular drift movement in PlazaCanvas with a waypoint-based wandering AI that gives dinos lively, bouncy movement. Add always-visible compact nameplates below each dino showing dino name, gender, owner name, and owner photo.

## File: `frontend/src/components/PlazaCanvas.js`

This is the only file that changes. All modifications are within the PlazaCanvas class.

---

## 1. Wandering AI

### Current behavior (to be replaced)
Each dino has a fixed `driftCenterXFrac/YFrac` and `driftAngle` that increments at a constant rate, tracing a perfect circle. This produces unnatural spinning.

### New behavior: Waypoint state machine

Each dino has a `state` field: `"walking"`, `"sprinting"`, or `"idling"`.

#### State: WALKING
- Dino moves toward `targetX, targetY` at `speed` (40-80 px/sec, randomized per waypoint).
- Heading (angle toward target) is interpolated smoothly via lerp to avoid instant snapping.
- Sprite is flipped horizontally when heading left (`facingLeft` flag derived from heading).
- Hop animation: `sin(elapsed * hopSpeed + hopPhase) * 6` — same as current but only during movement.
- On reaching the target (within 5px), transition to IDLING.

#### State: SPRINTING
- Same as WALKING but speed is 2x (120-160 px/sec).
- Slightly larger hop amplitude (8px instead of 6).
- Triggered with ~20% probability when picking a new waypoint.
- Sprint waypoints are further away: 300-500px from current position.

#### State: IDLING
- Dino pauses for 1-3 seconds (randomized).
- Subtle breathing animation: slower, smaller vertical bob (`sin(elapsed * 1.0) * 2`).
- After idle duration expires, pick a new waypoint and transition to WALKING (or SPRINTING with 20% chance).

#### Waypoint selection
- Normal waypoints: random point within 100-300px of current position.
- Sprint waypoints: random point within 300-500px of current position.
- All waypoints clamped to world bounds with a 60px margin from edges.
- Random angle, random distance within the range.

#### Per-dino state fields (replaces old drift fields)
```js
{
  state: 'idling',       // 'walking' | 'sprinting' | 'idling'
  targetX: 0,            // current waypoint
  targetY: 0,
  speed: 60,             // px/sec for current waypoint
  heading: 0,            // current smoothed heading angle (radians)
  facingLeft: false,      // derived from heading, used for sprite flip
  idleTimer: 0,          // seconds remaining in idle state
  hopPhase: Math.random() * Math.PI * 2,
  hopSpeed: 1.5 + Math.random() * 1.0,
  sparklePhase: Math.random() * Math.PI * 2,
  worldX: <random start>, // initial position (random within world)
  worldY: <random start>,
}
```

#### Update loop (in `_draw`)
Replace the current `driftAngle += ...` block with a delta-time-based update:
1. Compute `dt` from elapsed time since last frame.
2. Switch on `d.state`:
   - **idling**: Decrement `idleTimer` by `dt`. When it hits 0, pick new waypoint + transition.
   - **walking/sprinting**: Compute direction to target, lerp `heading` toward it. Move `worldX/worldY` by `speed * dt` in heading direction. Check if within 5px of target to transition to idling.
3. Update `facingLeft` from heading.
4. Clamp `worldX/worldY` to world bounds.

---

## 2. Nameplates

### Layout (compact horizontal bar below dino)
```
[photo_circle] [Dino Name ♂/♀]
               [Owner: Alex   ]
```

### Rendering (canvas-drawn)
Positioned centered below the dino sprite, 8px below the shadow ellipse.

1. **Background pill**: `roundRect` with `rgba(0,0,0,0.65)`, border-radius 8px, 1px border `rgba(74,222,128,0.3)`.
2. **Owner photo circle** (left side, 20px diameter):
   - Load `partner.owner_photo` URL into an `Image()` during `_buildDinoData`.
   - Draw as a circle-clipped image using `ctx.clip()` with an arc path.
   - On load failure: draw a green circle (#4ade80) with the owner's first initial in white.
   - Cache the loaded `Image` object on the dino data. Set `photoFailed` flag on error to skip retries.
3. **Line 1** (right of photo): Dino name + gender symbol. Bold 10px sans-serif, white (#f0fdf4). Gender symbol colored: blue (#60a5fa) for male, pink (#f472b6) for female, omitted if no gender set.
4. **Line 2** (right of photo, below line 1): `"Owner: {name}"`. 8px sans-serif, green (#86efac).

### Pill sizing
- Measure text width of both lines using `ctx.measureText`.
- Pill width = photo diameter (20) + gap (6) + max(line1_width, line2_width) + padding (16 total horizontal).
- Pill height = ~30px (two lines of text + padding).

### Sprite flip interaction
When `facingLeft` is true, the sprite is drawn flipped via `ctx.scale(-1, 1)`. The nameplate is always drawn un-flipped (separate `ctx.save/restore` block) so text remains readable.

### Existing elements preserved
- Hat label above dino: unchanged.
- Champion crown: unchanged.
- Champion sparkles: unchanged.
- Shadow ellipse: unchanged.

---

## 3. Data availability

The plaza API already returns `name`, `owner_name`, `owner_photo`. However, `gender` is **not** currently stored on the PLAZA partner record or returned by the plaza API.

### Backend fix required (2 files)

**`backend/src/handlers/dino.py`** — `partner_handler` (line ~167): Add `"gender": dino.get("gender", "")` to the `plaza_data` dict written to DynamoDB.

**`backend/src/handlers/plaza.py`** — `handler` (line ~31): Add `"gender": item.get("gender", "")` to the partner dict returned by the API.

This is a minor two-line change. Existing plaza records without gender will gracefully show no gender symbol (empty string fallback).

---

## 4. Non-goals
- No dino-to-dino interaction (approaching each other, herding, etc.)
- No pathfinding or obstacle avoidance
- No sound effects
- Nameplate does not scale with zoom (always same world-space size)
