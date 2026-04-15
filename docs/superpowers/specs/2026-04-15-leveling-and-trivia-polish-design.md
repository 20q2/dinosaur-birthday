# Leveling and Trivia Polish — Design

**Date:** 2026-04-15
**Status:** Draft

## Summary

Two small polish features that make progression feel more alive, without touching the XP curve or backend:

1. **Level-up celebration on MyDinos** — when a player opens their MyDinos list, any dino whose level increased since the player last viewed the list plays a short animation: XP bar fills to cap, dino hops, bar empties, bar fills to the actual current progress.
2. **Confetti on correct trivia answer** — when a trivia answer resolves correctly in PlayTrivia, confetti bursts from the button the player tapped.

Both features are frontend-only. One new dependency: `canvas-confetti`.

Out of scope (discussed but deferred):
- Reward-mix changes for trivia (current XP + hat rewards stay as-is).
- Dino reactions in the trivia top panel.
- Fetching the opponent partner dino for the trivia top panel.
- Server-side level-up tracking (client-side localStorage is sufficient for the party context).

---

## Feature A — Level-up celebration on MyDinos

### Goal

The MyDinos list is where players see their collection. Right now, a leveled-up dino just silently shows a higher number on return. We want to make "you leveled up!" feel like an event when the player next opens the list.

### Detection (client-side, A1)

- Storage key: `dino_party_last_seen_levels` in `localStorage`.
- Value shape: a single JSON object `{ [species]: level }`. Species is the unique per-player dino key (matches the DB's `DINO#{species}` sort key).
- On MyDinos mount — and whenever `player.dinos` changes — compare each dino's current `level` against `last_seen_levels[species]`. For every dino where `current > last_seen`, queue an animation on that card.
- **First-ever load:** if the key does not exist, seed it silently with all current levels (no animation). This prevents spurious celebrations for dinos that leveled up before the feature shipped.
- **localStorage unavailable** (private mode, quota, etc.): treat every load as "up to date" — skip animations silently. Never throw.

### Animation sequence (per card)

Applied to each card whose dino leveled up. All cards animate simultaneously (not staggered).

1. Bar fills from current visual progress → 100% (~400ms ease-out).
2. Card's `<DinoSprite>` does a single hop (~300ms, applied via a CSS keyframe on the sprite wrapper — similar to the `hop` pattern used in PlayTrivia). The displayed level number ticks up to the final new level at the hop peak.
3. Bar resets to 0% instantly (no transition).
4. Bar fills from 0% → actual current progress for the new level (~600ms ease-out).

Total per card: ~1.3s.

**Multi-level jumps (E2):** play the sequence exactly once regardless of how many levels were gained. The level number jumps directly to its final value at step 2 — no per-level replay.

**Max-level case (level 5 reached):** the "actual current progress" at step 4 is 100%. The bar fills all the way and stays there. Sequence is otherwise identical.

### Flag clearing

After step 4 completes for a given dino, update `last_seen_levels[species] = newLevel` and persist to localStorage immediately (not batched across dinos). This ensures that a page refresh mid-sequence does not re-trigger animations for dinos that have already finished.

### Scope of changes

- [frontend/src/components/MyDinos.jsx](frontend/src/components/MyDinos.jsx) — add the detection hook, per-card animation state, and the animation sequence. Card markup already has the XP bar (`xpBarBg` / `xpBarFill`) and the `<DinoSprite>` — we just drive them. Note: only tamed dinos render the XP bar; this is the only path that can trigger the animation (untamed dinos stay at level 1 and never satisfy `current > last_seen`).
- Possibly a small helper module (e.g., `frontend/src/utils/lastSeenLevels.js`) if the read/write/seed/clear logic gets chunky enough to warrant extraction. Inline if it stays small.

### Edge cases summary

| Case | Behavior |
|---|---|
| First-ever page load | Seed silently, no animation |
| localStorage unavailable | Skip silently, never throw |
| Single level up | Full sequence |
| Multi-level jump | Full sequence once; level number snaps to final |
| Reached max level (5) | Full sequence; final fill stays at 100% |
| Multiple dinos leveled | All animate simultaneously |
| Refresh mid-animation | Completed dinos stay cleared; mid-animation dino re-animates once |
| Dino level 1, no XP yet | Never triggers (no level increase) |

---

## Feature B — Confetti on correct trivia answer

### Goal

Make getting a trivia question right feel a bit more celebratory. Scoped narrowly to the correct-answer moment; no change to rewards or incorrect-answer feedback.

### Dependency

Add `canvas-confetti` (~4kb) to `frontend/package.json`. This is a new dependency — the existing BossVictory confetti is hand-rolled with CSS keyframes, not this library. Using the library here is justified by C1 (origin-from-tap-point) which is trivial with `canvas-confetti` and fiddly to reproduce by hand.

### Trigger

In [frontend/src/components/PlayTrivia.jsx](frontend/src/components/PlayTrivia.jsx): when the trivia result arrives and `result.correct === true`, fire one confetti burst.

Both result paths must work:
- `api.answerTrivia(...)` resolves with `correct: true` (same-device case).
- WebSocket `trivia_result` event arrives with `correct: true` (paired-partner case).

Fire exactly once per trivia session (guard against firing twice if both paths happen to resolve).

### Origin (C1 — burst from tapped button)

- Attach a ref to each answer `<button>` in the answers grid.
- When a correct result arrives, read the ref at index `selectedAnswer`, compute its bounding rect, and convert the center to normalized viewport coords:
  - `x = (rect.left + rect.width / 2) / window.innerWidth`
  - `y = (rect.top + rect.height / 2) / window.innerHeight`
- Pass as `origin: { x, y }` to `canvas-confetti`.

### Burst parameters (starting point, tune in implementation)

```js
confetti({
  particleCount: 60,
  spread: 70,
  startVelocity: 35,
  origin: { x, y },
  colors: ['#4ade80', '#f59e0b', '#60a5fa', '#f3f4f6'],
});
```

Colors pulled from the existing green/amber/blue palette used on the result banner.

### Timing

Fire the burst synchronously when the correct result is known — at the same moment the result banner transitions in. No artificial delay.

### Edge cases summary

| Case | Behavior |
|---|---|
| Correct answer | One burst from tapped button |
| Incorrect answer | No burst (deliberate — keeps confetti feeling rewarding) |
| Ref to tapped button unavailable | Fall back to `origin: { x: 0.5, y: 0.6 }` (center of answers grid) |
| Both API and WS result paths fire | Guard ensures only one burst |
| User leaves page before result arrives | No burst (component unmounted) |

### Scope of changes

- `frontend/package.json` — add `canvas-confetti` dependency.
- [frontend/src/components/PlayTrivia.jsx](frontend/src/components/PlayTrivia.jsx) — import `canvas-confetti`, attach button refs, add the firing logic with single-shot guard.

---

## Testing

No backend changes, no new API contracts to test. Verification is manual:

**Feature A:**
- Fresh player (no localStorage key): open MyDinos → no animation, levels shown statically. Refresh → still no animation.
- Use admin panel to grant XP enough to level a dino, then open MyDinos → observe full animation sequence on that card.
- Level two dinos at once, open MyDinos → both cards animate simultaneously.
- Multi-level jump: grant enough XP for 2 levels in one shot, open MyDinos → one sequence, level number snaps to final.
- Hit level 5: open MyDinos → bar stays full after fill.
- Refresh during animation → completed dinos stay cleared; in-flight dino replays.

**Feature B:**
- Play a trivia game, answer correctly → confetti bursts from the button that was tapped.
- Answer incorrectly → no confetti.
- Trigger result via both code paths (api response vs WebSocket) → exactly one burst per correct answer.

## Files changed (estimated)

- `frontend/src/components/MyDinos.jsx` (modified)
- `frontend/src/components/PlayTrivia.jsx` (modified)
- `frontend/package.json` (modified — new dep)
- Optionally `frontend/src/utils/lastSeenLevels.js` (new) if the helper logic warrants extraction
