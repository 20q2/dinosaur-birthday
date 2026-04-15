# Lively Plaza Behaviors — Design

**Date:** 2026-04-15
**Scope:** Three small additions to plaza dino AI to make wandering feel more alive: follow-the-leader, sniffing, and startle reactions.

## Goal

The current plaza AI ([PlazaCanvas.js](../../../frontend/src/components/PlazaCanvas.js)) has a clean `idling ↔ walking/sprinting` state machine with random waypoints. Dinos feel functional but don't acknowledge each other. Add three lightweight behaviors so the plaza reads as a living space:

1. **Follow-the-leader** — idle dinos sometimes target another dino's position instead of a random waypoint
2. **Sniffing** — two idle dinos that end up near each other pause, face each other, and show a 💭 emoji
3. **Startle** — sprinting dinos and tap-jumps cause nearby dinos to hop with a ❗ emoji

All three behaviors combine emergently (a follower arrives near an idle leader → triggers a sniff; a sprint past a sniff pair → startles both).

## Non-goals

- No new animations, sprites, or backend changes
- No pathfinding or collision avoidance — waypoints are fire-and-forget
- No social memory (preferred partners, rivalries, etc.)
- No changes to `playing` play-together state

## Scope of changes

All logic lives in [frontend/src/components/PlazaCanvas.js](../../../frontend/src/components/PlazaCanvas.js). No new files. No API or DB changes.

## New per-dino fields

Added to the dino object created when a partner joins the plaza:

```js
sniffTimer: 0,          // seconds remaining in sniff interaction
sniffPartnerId: null,   // player_id of the other dino
sniffCooldown: 0,       // seconds until this dino can sniff again
startleTimer: 0,        // seconds remaining for ❗ emoji
startleCooldown: 0,     // seconds until this dino can be startled again
```

## New constants (top of file, alongside existing wander constants)

```js
const FOLLOW_CHANCE       = 0.35;  // chance when leaving idle to follow instead of random waypoint
const FOLLOW_RADIUS       = 350;   // px — "nearby" for follow candidates
const FOLLOW_OFFSET       = 40;    // random offset from leader so follower doesn't overlap
const SNIFF_RADIUS        = 80;    // two idle dinos within this range trigger a sniff
const SNIFF_DURATION      = 1.5;   // seconds
const SNIFF_COOLDOWN      = 8;     // per-dino cooldown after a sniff ends
const STARTLE_RADIUS      = 130;   // px around sprinting/tapping dino
const STARTLE_DURATION    = 0.8;   // seconds ❗ stays visible
const STARTLE_COOLDOWN    = 4;     // per-dino cooldown
const STARTLE_HOP         = 0.4;   // tapJump duration
const STARTLE_HOP_HEIGHT  = 10;    // smaller than normal tap jump
```

## Behavior 1 — Follow-the-leader (#9)

**When:** An idling dino's `idleTimer` hits 0 and it's about to pick a new waypoint.

**Logic:** Before calling `_pickWaypoint`:
1. Collect candidates from `this.dinos`: exclude self, any dino with `dropIn > 0`, any `playPartner`, any already within `ARRIVE_DIST` of this dino.
2. Filter to those within `FOLLOW_RADIUS`.
3. Split into *moving* (`state === 'walking' || 'sprinting'`) and *idle*.
4. With probability `FOLLOW_CHANCE`:
   - If any moving candidates, pick one randomly; else if any idle candidates, pick one randomly; else skip.
   - If picked: set `d.targetX = leader.worldX + (Math.random() - 0.5) * FOLLOW_OFFSET * 2`, same for Y, clamped to world margins. Set `d.speed` in walk range, `d.state = 'walking'`.
5. Otherwise fall through to the existing `_pickWaypoint(d, sprint)` random logic.

**Emergent property:** a follower that arrives near an idle leader will trigger behavior #2 on the next frame.

## Behavior 2 — Sniff each other (#10)

**When:** Two idle dinos are within `SNIFF_RADIUS` and both are off cooldown.

**Logic:** At the top of `_updateDino` (before the state switch):
1. `d.sniffCooldown = Math.max(0, d.sniffCooldown - dt)`.
2. If `d.sniffTimer > 0`:
   - `d.sniffTimer = Math.max(0, d.sniffTimer - dt)`.
   - If `d.sniffTimer === 0` after decrement: clear `d.sniffPartnerId`, set `d.sniffCooldown = SNIFF_COOLDOWN`. (Fall through — dino resumes normal idling this frame.)
   - Else: face the sniff partner (look up by `sniffPartnerId` in `this.dinos`; if not found, skip facing). `return` — skip the rest of `_updateDino` so idle timer doesn't count down and no waypoint gets picked.

In the `case 'idling'` block, before decrementing `idleTimer`:
3. If `d.sniffCooldown === 0 && d.sniffPartnerId === null`: scan `this.dinos` for another dino within `SNIFF_RADIUS` (Euclidean) that is also idling, has `sniffCooldown === 0`, `sniffPartnerId === null`, and no `playPartner`/`dropIn`.
4. If found, set on **both dinos**: `sniffPartnerId = other player_id`, `sniffTimer = SNIFF_DURATION`. (Next frame both will hit the partner-face branch in step 2.)

**Render:** In `_drawDino`, after the existing play-emoji block (line ~1041), add a branch: if `d.sniffTimer > 0`, draw `💭` using the same float-above-head pattern (same `iconSize`, same `floatY` sine, same alpha).

## Behavior 3 — Startle (#11)

**Trigger sources:**
- Each frame, any dino with `state === 'sprinting'`
- Player tap — in `handleTap`, after the existing `d.tapJump = 0.45` line

**Broadcast helper** `_broadcastStartle(sourceDino)`:
```
for each other in this.dinos:
  if other === sourceDino: continue
  if other.startleCooldown > 0: continue
  if other.dropIn > 0 or other.playPartner: continue
  dist = hypot(other.worldX - sourceDino.worldX, other.worldY - sourceDino.worldY)
  if dist > STARTLE_RADIUS: continue
  // Startle wins over sniff
  if other.sniffTimer > 0:
    other.sniffTimer = 0
    other.sniffPartnerId = null
    other.sniffCooldown = SNIFF_COOLDOWN
  other.tapJump = STARTLE_HOP
  other.tapJumpHeight = STARTLE_HOP_HEIGHT
  other.startleTimer = STARTLE_DURATION
  other.startleCooldown = STARTLE_COOLDOWN
```

**Ticking:** In `_updateDino` (top, alongside sniff ticks): tick both `startleTimer` and `startleCooldown` down by `dt`.

**Call sites:**
- In `_draw` (the main render/update loop), after each dino's `_updateDino` call, if `d.state === 'sprinting'` call `this._broadcastStartle(d)`. Cooldown on targets prevents per-frame spam — no per-source throttle needed.
- In `handleTap`, after `d.tapJump = 0.45;`, call `this._broadcastStartle(d);`.

**Render:** In `_drawDino`, add a branch: if `d.startleTimer > 0`, draw `❗` above head using the float-emoji pattern.

**Emoji priority (single slot above head):**
1. `playing` state — existing play emojis
2. `startleTimer > 0` — ❗
3. `sniffTimer > 0` — 💭

## Testing

Manual via admin bots panel ([AdminBots.jsx](../../../frontend/src/components/AdminBots.jsx)):
- Spawn 4–6 bots
- Observe within ~30s: at least one follow chain, at least one sniff pair with 💭, at least one sprint-triggered ❗ cluster
- Tap a dino with another in range — neighbor should hop + show ❗
- Verify no perma-stuck state: sniff pairs always release after `SNIFF_DURATION`, startle always clears after `STARTLE_DURATION`

## Risks / edge cases

- **Follow + sniff clumping:** multiple followers converge on the same leader and form a sniff ring. Acceptable — reads as a "group gathering."
- **Sniff desync:** if one dino in a sniff pair leaves the plaza mid-sniff, the other's `sniffPartnerId` won't resolve in `this.dinos` → the partner-face block is skipped, `sniffTimer` decrements normally to 0, cooldown is set. No bug, just a graceful exit.
- **Startle during sniff:** startle explicitly clears sniff state on the target so the ❗ emoji takes over cleanly.
- **Sprint self-startle:** guarded by `other === sourceDino` check.
- **Drop-in dinos:** excluded from all three behaviors via `dropIn > 0` guard.
- **Play-together dinos:** excluded via `playPartner` guard — their AI is fully overridden already.
