# Lively Plaza Behaviors Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three small behaviors to plaza dinos — follow-the-leader, sniffing, and startle reactions — to make the plaza feel more alive.

**Architecture:** All logic lives in one file: [frontend/src/components/PlazaCanvas.js](../../../frontend/src/components/PlazaCanvas.js). Three behaviors layer onto the existing `idling`/`walking`/`sprinting` state machine. No new files, no API/backend changes.

**Tech Stack:** Preact + Vite frontend, plain canvas rendering.

**Design spec:** [docs/superpowers/specs/2026-04-15-lively-plaza-behaviors-design.md](../specs/2026-04-15-lively-plaza-behaviors-design.md)

## Testing Strategy

This codebase has no frontend test infrastructure in use (vitest is configured but unused). The established pattern for plaza AI work is **manual verification via the admin bots panel** at `#admin`. Each task below includes a manual verification step. The user handles all `npm run dev` / builds — the engineer only edits files and commits.

## File Structure

**Modified:**
- [frontend/src/components/PlazaCanvas.js](../../../frontend/src/components/PlazaCanvas.js) — all changes live here

---

## Task 1: Add constants and per-dino fields

**Files:**
- Modify: [frontend/src/components/PlazaCanvas.js](../../../frontend/src/components/PlazaCanvas.js) (constants block ~L25-38, dino `anim` object ~L139-157)

- [ ] **Step 1: Add new constants after the existing wandering AI constants block**

In [PlazaCanvas.js](../../../frontend/src/components/PlazaCanvas.js), find the block ending with `const ARRIVE_DIST = 5;` (around line 38). Add immediately after:

```js
// Lively behavior constants
const FOLLOW_CHANCE       = 0.35;  // chance when leaving idle to follow instead of random waypoint
const FOLLOW_RADIUS       = 350;   // px — "nearby" for follow candidates
const FOLLOW_OFFSET       = 40;    // random offset from leader so follower doesn't overlap
const SNIFF_RADIUS        = 80;    // two idle dinos within this range trigger a sniff
const SNIFF_DURATION      = 1.5;   // seconds
const SNIFF_COOLDOWN      = 8;     // per-dino cooldown after a sniff ends
const STARTLE_RADIUS      = 130;   // px around sprinting/tapping dino
const STARTLE_DURATION    = 0.8;   // seconds ❗ stays visible
const STARTLE_COOLDOWN    = 4;     // per-dino cooldown
const STARTLE_HOP         = 0.4;   // tapJump duration for startle
const STARTLE_HOP_HEIGHT  = 10;    // smaller than normal tap jump
```

- [ ] **Step 2: Add new fields to the per-dino anim object**

In the `const anim = reuse || { ... }` block (around line 139), add the new fields alongside the existing ones. After the `nameplateBig: 0,` line and before the closing `};`, add:

```js
      sniffTimer: 0,          // seconds remaining in sniff interaction
      sniffPartnerId: null,   // player_id of the other dino
      sniffCooldown: 0,       // seconds until this dino can sniff again
      startleTimer: 0,        // seconds remaining for ❗ emoji
      startleCooldown: 0,     // seconds until this dino can be startled again
```

- [ ] **Step 3: Manual verification**

Tell the user: "Task 1 adds constants + fields only. No visible behavior change. Please load the app and confirm plaza still renders normally with dinos wandering as before."

Expected: plaza works exactly as it did before. No errors in console.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/PlazaCanvas.js
git commit -m "feat(plaza): add constants and per-dino fields for lively behaviors"
```

---

## Task 2: Implement follow-the-leader (#9)

**Files:**
- Modify: [frontend/src/components/PlazaCanvas.js](../../../frontend/src/components/PlazaCanvas.js) (`_pickWaypoint` area and `case 'idling'` block ~L446-452)

- [ ] **Step 1: Add a `_pickFollowTarget` helper method**

Find the `_pickWaypoint` method (around line 354). Add this new method immediately **above** it (inside the class, before `_pickWaypoint`):

```js
  _pickFollowTarget(d) {
    // Return a dino to follow, or null to fall back to random waypoint.
    const moving = [];
    const idle = [];
    for (const other of this.dinos) {
      if (other === d) continue;
      if (other.dropIn > 0) continue;
      if (other.playPartner) continue;
      const dx = other.worldX - d.worldX;
      const dy = other.worldY - d.worldY;
      const dist = Math.hypot(dx, dy);
      if (dist > FOLLOW_RADIUS) continue;
      if (dist < ARRIVE_DIST) continue; // already there
      if (other.state === 'walking' || other.state === 'sprinting') {
        moving.push(other);
      } else if (other.state === 'idling') {
        idle.push(other);
      }
    }
    const pool = moving.length > 0 ? moving : idle;
    if (pool.length === 0) return null;
    return pool[Math.floor(Math.random() * pool.length)];
  }
```

- [ ] **Step 2: Modify the `case 'idling'` block to sometimes follow**

Find the `case 'idling':` block inside `_updateDino` (around line 446). Replace:

```js
      case 'idling': {
        d.idleTimer -= dt;
        if (d.idleTimer <= 0) {
          const sprint = Math.random() < SPRINT_CHANCE;
          this._pickWaypoint(d, sprint);
        }
        break;
      }
```

with:

```js
      case 'idling': {
        d.idleTimer -= dt;
        if (d.idleTimer <= 0) {
          // Chance to follow another dino instead of picking a random waypoint
          if (Math.random() < FOLLOW_CHANCE) {
            const leader = this._pickFollowTarget(d);
            if (leader) {
              const ox = (Math.random() - 0.5) * FOLLOW_OFFSET * 2;
              const oy = (Math.random() - 0.5) * FOLLOW_OFFSET * 2;
              d.targetX = Math.max(MARGIN, Math.min(WORLD_W - MARGIN, leader.worldX + ox));
              d.targetY = Math.max(MARGIN, Math.min(WORLD_H - MARGIN, leader.worldY + oy));
              d.speed = WALK_SPEED_MIN + Math.random() * (WALK_SPEED_MAX - WALK_SPEED_MIN);
              d.state = 'walking';
              break;
            }
          }
          const sprint = Math.random() < SPRINT_CHANCE;
          this._pickWaypoint(d, sprint);
        }
        break;
      }
```

- [ ] **Step 3: Manual verification**

Tell the user: "Task 2 adds follow-the-leader. Open `#admin` → Bots, spawn 4–6 bots on the plaza, watch for ~30 seconds. You should see idle dinos occasionally walk toward another dino's location instead of picking purely random spots. Expect roughly one-in-three idle transitions to be follows."

Expected signs of success:
- Dinos sometimes walk toward each other and end up near another dino
- Occasional "group" formations where multiple dinos cluster
- No dinos getting stuck, no console errors

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/PlazaCanvas.js
git commit -m "feat(plaza): idle dinos sometimes follow nearby dinos"
```

---

## Task 3: Implement sniff behavior + render (#10)

**Files:**
- Modify: [frontend/src/components/PlazaCanvas.js](../../../frontend/src/components/PlazaCanvas.js) (`_updateDino` top + `case 'idling'` + `_drawDino` near line 1041)

- [ ] **Step 1: Add sniff ticking at the top of `_updateDino`**

Find `_updateDino` (around line 386). Immediately after the drop-in block that ends with `return; // freeze AI while dropping in` (around line 399), add:

```js
    // ── Sniff ticking (runs before normal AI so sniffing pauses idle) ──────
    d.sniffCooldown = Math.max(0, d.sniffCooldown - dt);
    if (d.sniffTimer > 0) {
      d.sniffTimer = Math.max(0, d.sniffTimer - dt);
      if (d.sniffTimer === 0) {
        d.sniffPartnerId = null;
        d.sniffCooldown = SNIFF_COOLDOWN;
        // Fall through — dino resumes normal behavior this frame
      } else {
        const partner = this.dinos.find(o => o.partner.player_id === d.sniffPartnerId);
        if (partner) {
          d.facingLeft = partner.worldX < d.worldX;
        }
        return; // skip rest of AI while sniffing
      }
    }
```

- [ ] **Step 2: Add sniff pairing inside `case 'idling'`**

In the `case 'idling':` block (already modified in Task 2), insert the sniff scan at the top of the block — before `d.idleTimer -= dt;`. The block should become:

```js
      case 'idling': {
        // Look for a nearby idle dino to sniff with
        if (d.sniffCooldown === 0 && d.sniffPartnerId === null) {
          for (const other of this.dinos) {
            if (other === d) continue;
            if (other.state !== 'idling') continue;
            if (other.sniffCooldown !== 0 || other.sniffPartnerId !== null) continue;
            if (other.dropIn > 0 || other.playPartner) continue;
            const dx = other.worldX - d.worldX;
            const dy = other.worldY - d.worldY;
            if (Math.hypot(dx, dy) > SNIFF_RADIUS) continue;
            d.sniffPartnerId = other.partner.player_id;
            d.sniffTimer = SNIFF_DURATION;
            other.sniffPartnerId = d.partner.player_id;
            other.sniffTimer = SNIFF_DURATION;
            break;
          }
        }
        d.idleTimer -= dt;
        if (d.idleTimer <= 0) {
          // Chance to follow another dino instead of picking a random waypoint
          if (Math.random() < FOLLOW_CHANCE) {
            const leader = this._pickFollowTarget(d);
            if (leader) {
              const ox = (Math.random() - 0.5) * FOLLOW_OFFSET * 2;
              const oy = (Math.random() - 0.5) * FOLLOW_OFFSET * 2;
              d.targetX = Math.max(MARGIN, Math.min(WORLD_W - MARGIN, leader.worldX + ox));
              d.targetY = Math.max(MARGIN, Math.min(WORLD_H - MARGIN, leader.worldY + oy));
              d.speed = WALK_SPEED_MIN + Math.random() * (WALK_SPEED_MAX - WALK_SPEED_MIN);
              d.state = 'walking';
              break;
            }
          }
          const sprint = Math.random() < SPRINT_CHANCE;
          this._pickWaypoint(d, sprint);
        }
        break;
      }
```

- [ ] **Step 3: Render the sniff emoji in `_drawDino`**

Find the existing play-together emoji block (around line 1041) that starts with `// Play-together emoji above head`. Immediately **after** the closing `}` of that `if (d.state === 'playing')` block, add:

```js
    // Sniff emoji above head
    if (d.sniffTimer > 0 && d.state !== 'playing' && d.startleTimer === 0) {
      const emojiY = y - halfH + hopY - (d.partner.hat ? 14 : 6);
      const floatY = Math.sin(elapsed * 2.5 + d.hopPhase) * 3;
      const emojiAlpha = 0.7 + 0.3 * Math.sin(elapsed * 3 + d.hopPhase);
      ctx.save();
      ctx.globalAlpha = emojiAlpha;
      ctx.font = `${Math.round(10 * d.scale)}px serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText('\u{1F4AD}', x, emojiY + floatY); // 💭
      ctx.restore();
    }
```

- [ ] **Step 4: Manual verification**

Tell the user: "Task 3 adds sniffing. Spawn 4–6 bots via `#admin` → Bots. Watch for idle dinos that wander near each other — they should pause facing each other with a 💭 emoji floating above for ~1.5 seconds, then both go on cooldown and resume normal idle."

Expected signs of success:
- When two idle dinos end up within ~80px, both display 💭
- Both face each other during the sniff
- After ~1.5s, 💭 disappears and they resume wandering
- Same pair doesn't immediately re-sniff (cooldown of 8s works)
- No console errors

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/PlazaCanvas.js
git commit -m "feat(plaza): idle dinos sniff when near each other"
```

---

## Task 4: Implement startle + render (#11)

**Files:**
- Modify: [frontend/src/components/PlazaCanvas.js](../../../frontend/src/components/PlazaCanvas.js) (add `_broadcastStartle` helper, tick in `_updateDino`, call sites in frame loop + `handleTap`, render in `_drawDino`)

- [ ] **Step 1: Add the `_broadcastStartle` helper**

Add this method to the class, right after `_pickFollowTarget` (from Task 2) and before `_pickWaypoint`:

```js
  _broadcastStartle(source) {
    for (const other of this.dinos) {
      if (other === source) continue;
      if (other.startleCooldown > 0) continue;
      if (other.dropIn > 0 || other.playPartner) continue;
      const dx = other.worldX - source.worldX;
      const dy = other.worldY - source.worldY;
      if (Math.hypot(dx, dy) > STARTLE_RADIUS) continue;
      // Startle wins over sniff — cancel any in-progress sniff on target
      if (other.sniffTimer > 0) {
        other.sniffTimer = 0;
        other.sniffPartnerId = null;
        other.sniffCooldown = SNIFF_COOLDOWN;
      }
      other.tapJump = STARTLE_HOP;
      other.tapJumpHeight = STARTLE_HOP_HEIGHT;
      other.startleTimer = STARTLE_DURATION;
      other.startleCooldown = STARTLE_COOLDOWN;
    }
  }
```

- [ ] **Step 2: Tick startle timers at the top of `_updateDino`**

Find the sniff ticking block added in Task 3 (starts with `// ── Sniff ticking`). Immediately **before** that block, add:

```js
    // ── Startle ticking ────────────────────────────────────────────────────
    d.startleCooldown = Math.max(0, d.startleCooldown - dt);
    d.startleTimer = Math.max(0, d.startleTimer - dt);
```

- [ ] **Step 3: Broadcast startle from sprinting dinos each frame**

Find the line `this.dinos.forEach(d => this._updateDino(d, dt, elapsed));` (around line 819). Change it to:

```js
    this.dinos.forEach(d => this._updateDino(d, dt, elapsed));
    // Sprinting dinos startle nearby dinos
    for (const d of this.dinos) {
      if (d.state === 'sprinting') this._broadcastStartle(d);
    }
```

- [ ] **Step 4: Broadcast startle from tap**

Find `handleTap` (around line 715). Locate the existing line `d.tapJump = 0.45; // trigger jump animation` (around line 727). Immediately **after** that line (same block, before the `d.tapJumpHeight = ...` assignment is fine), insert:

```js
        this._broadcastStartle(d);
```

So the block becomes:

```js
        d.tapJump = 0.45; // trigger jump animation
        this._broadcastStartle(d);
        d.tapJumpHeight = 14 + Math.random() * 22; // 14–36px variable height
        d.state = 'idling';
        d.idleTimer = 3.5 + Math.random() * 2.0; // stay put 3.5–5.5s after tap
        d.nameplateBig = 3; // enlarged nameplate for 3s
        this.onSelect(d.partner);
        return;
```

- [ ] **Step 5: Render the startle emoji**

Find the sniff emoji block added in Task 3. Immediately **before** that block (so startle renders first and sniff's `d.startleTimer === 0` guard keeps them mutually exclusive), add:

```js
    // Startle emoji above head
    if (d.startleTimer > 0 && d.state !== 'playing') {
      const emojiY = y - halfH + hopY - (d.partner.hat ? 14 : 6);
      const floatY = Math.sin(elapsed * 4 + d.hopPhase) * 2;
      // Fade out over the last half of the timer
      const fade = Math.min(1, d.startleTimer / (STARTLE_DURATION * 0.5));
      ctx.save();
      ctx.globalAlpha = fade;
      ctx.font = `${Math.round(11 * d.scale)}px serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText('\u2757', x, emojiY + floatY); // ❗
      ctx.restore();
    }
```

- [ ] **Step 6: Manual verification**

Tell the user: "Task 4 adds startle. Spawn 6+ bots on the plaza. Watch for two things: (1) when a dino sprints past another, the other should briefly hop and show ❗; (2) when you tap a dino, any neighbors within range should also hop with ❗."

Expected signs of success:
- Sprinting dinos trigger ❗ + hop on neighbors within ~130px
- Tapping a dino with neighbors nearby startles them too
- ❗ fades out over ~0.8s
- Same dino can't be re-startled for 4s (no emoji spam)
- If two dinos were sniffing when one gets startled, sniff ends cleanly
- No console errors

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/PlazaCanvas.js
git commit -m "feat(plaza): sprinting and tap-jumps startle nearby dinos"
```

---

## Self-Review Notes

- **Spec coverage:** All three behaviors (#9 follow, #10 sniff, #11 startle) have dedicated tasks. Field additions, constants, rendering priority, and cooldowns all covered.
- **Emoji priority:** Startle renders first with its own `state !== 'playing'` guard; sniff renders after with `d.startleTimer === 0 && d.state !== 'playing'` guard. Play-emoji block at the original ~line 1041 already only runs when `d.state === 'playing'`, so the three are mutually exclusive as specified.
- **Edge cases handled:** Drop-in dinos excluded everywhere. Play-together dinos excluded. Self-startle guarded. Stale sniff partner (departed plaza) handled by null-check + letting timer expire naturally. Startle-during-sniff explicitly cancels sniff.
- **Type/name consistency:** `_pickFollowTarget`, `_broadcastStartle` are new. Field names `sniffTimer/sniffPartnerId/sniffCooldown/startleTimer/startleCooldown` used identically in all tasks. Constants used match their declarations in Task 1.
