# Leveling and Trivia Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a level-up celebration on the MyDinos list page and a confetti burst on correct trivia answers, without changing the XP curve, rewards, or backend.

**Architecture:** Frontend-only. A new `lastSeenLevels` utility uses `localStorage` to detect which dinos leveled up since the player's last visit. `MyDinos` reads pending level-ups on mount and passes per-card celebration info down to `DinoCard`, which plays a three-phase animation (bar fills to cap → sprite hops + level number ticks up → bar resets to 0 and fills to actual progress). `PlayTrivia` fires `canvas-confetti` from the tapped answer button when `result.correct` is true.

**Tech Stack:** Preact 10, Vite 6, Vitest 3, `canvas-confetti` (new dep, ~4kb).

**Reference:** spec at [docs/superpowers/specs/2026-04-15-leveling-and-trivia-polish-design.md](docs/superpowers/specs/2026-04-15-leveling-and-trivia-polish-design.md).

**Note about frontend builds:** the user handles all frontend builds and `npm install` themselves. Do NOT run `npm install`, `npm run build`, or `npm run dev` in any task. Plans that add dependencies stop at editing `package.json`.

---

## File Structure

| Path | Status | Responsibility |
|---|---|---|
| `frontend/package.json` | modify | Add `canvas-confetti` dependency |
| `frontend/src/utils/lastSeenLevels.js` | create | Pure helper: read/write/seed localStorage-backed "last seen levels" map, compute pending level-ups |
| `frontend/src/utils/lastSeenLevels.test.js` | create | Vitest unit tests for the helper (it's pure logic — easily testable) |
| `frontend/src/components/MyDinos.jsx` | modify | Detect pending level-ups on mount/player change, pass celebration info to cards, clear flags when cards report completion |
| `frontend/src/components/PlayTrivia.jsx` | modify | Fire `canvas-confetti` from tapped answer button on correct result |

No backend files change. No CDK/infra changes.

---

## Task 1: Add `canvas-confetti` dependency

**Files:**
- Modify: `frontend/package.json`

- [ ] **Step 1: Add dependency to package.json**

Edit [frontend/package.json](frontend/package.json). Add `canvas-confetti` to the `dependencies` block (in alphabetical order):

```json
{
  "name": "dino-party",
  "private": true,
  "type": "module",
  "version": "1.0.0",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "canvas-confetti": "^1.9.3",
    "lucide-preact": "^1.7.0",
    "preact": "^10.25.0"
  },
  "devDependencies": {
    "@preact/preset-vite": "^2.9.0",
    "vite": "^6.0.0",
    "vitest": "^3.0.0"
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/package.json
git commit -m "feat(deps): add canvas-confetti for trivia celebration"
```

User will run `npm install` themselves (project convention — do not run it).

---

## Task 2: `lastSeenLevels` helper — failing test for first-load seed

**Files:**
- Create: `frontend/src/utils/lastSeenLevels.test.js`

- [ ] **Step 1: Write the failing test**

Create `frontend/src/utils/lastSeenLevels.test.js`:

```js
import { describe, it, expect, beforeEach } from 'vitest';
import { read, getPendingLevelUps } from './lastSeenLevels.js';

describe('lastSeenLevels', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('seeds with current levels on first-ever load and returns no pending', () => {
    const dinos = [
      { species: 'trex', level: 3 },
      { species: 'triceratops', level: 2 },
    ];
    const pending = getPendingLevelUps(dinos);
    expect(pending).toEqual([]);
    expect(read()).toEqual({ trex: 3, triceratops: 2 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/utils/lastSeenLevels.test.js`
Expected: FAIL — file `./lastSeenLevels.js` does not exist.

---

## Task 3: `lastSeenLevels` helper — minimal implementation

**Files:**
- Create: `frontend/src/utils/lastSeenLevels.js`

- [ ] **Step 1: Write minimal implementation**

Create `frontend/src/utils/lastSeenLevels.js`:

```js
const KEY = 'dino_party_last_seen_levels';

export function read() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function write(map) {
  try {
    localStorage.setItem(KEY, JSON.stringify(map));
  } catch {
    // ignore (private mode, quota, etc.)
  }
}

export function seed(dinos) {
  const map = {};
  for (const d of dinos) {
    map[d.species] = d.level || 1;
  }
  write(map);
}

export function markSeen(species, level) {
  const existing = read() || {};
  existing[species] = level;
  write(existing);
}

export function getPendingLevelUps(dinos) {
  const stored = read();
  if (stored === null) {
    seed(dinos);
    return [];
  }
  const pending = [];
  let storedChanged = false;
  for (const d of dinos) {
    const newLevel = d.level || 1;
    if (!(d.species in stored)) {
      // New species first-seen — baseline silently, no celebration
      stored[d.species] = newLevel;
      storedChanged = true;
      continue;
    }
    const oldLevel = stored[d.species];
    if (newLevel > oldLevel) {
      pending.push({ species: d.species, oldLevel, newLevel });
    }
  }
  if (storedChanged) {
    write(stored);
  }
  return pending;
}
```

- [ ] **Step 2: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/utils/lastSeenLevels.test.js`
Expected: PASS — 1 test passes.

---

## Task 4: `lastSeenLevels` helper — additional tests for all cases

**Files:**
- Modify: `frontend/src/utils/lastSeenLevels.test.js`

- [ ] **Step 1: Add tests for all remaining behaviors**

Replace the contents of `frontend/src/utils/lastSeenLevels.test.js` with:

```js
import { describe, it, expect, beforeEach } from 'vitest';
import { read, seed, markSeen, getPendingLevelUps } from './lastSeenLevels.js';

const KEY = 'dino_party_last_seen_levels';

describe('lastSeenLevels', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('seeds with current levels on first-ever load and returns no pending', () => {
    const dinos = [
      { species: 'trex', level: 3 },
      { species: 'triceratops', level: 2 },
    ];
    const pending = getPendingLevelUps(dinos);
    expect(pending).toEqual([]);
    expect(read()).toEqual({ trex: 3, triceratops: 2 });
  });

  it('returns pending level-ups when current > last seen', () => {
    localStorage.setItem(KEY, JSON.stringify({ trex: 2 }));
    const dinos = [{ species: 'trex', level: 4 }];
    const pending = getPendingLevelUps(dinos);
    expect(pending).toEqual([{ species: 'trex', oldLevel: 2, newLevel: 4 }]);
  });

  it('returns empty when all current levels equal stored', () => {
    localStorage.setItem(KEY, JSON.stringify({ trex: 3 }));
    const dinos = [{ species: 'trex', level: 3 }];
    expect(getPendingLevelUps(dinos)).toEqual([]);
  });

  it('baselines new species silently without celebrating', () => {
    localStorage.setItem(KEY, JSON.stringify({ trex: 2 }));
    const dinos = [
      { species: 'trex', level: 2 },
      { species: 'spinosaurus', level: 1 },
    ];
    expect(getPendingLevelUps(dinos)).toEqual([]);
    expect(read()).toEqual({ trex: 2, spinosaurus: 1 });
  });

  it('celebrates level-ups on a newly-baselined species the next time it levels', () => {
    // First visit: sees trex at 2, spinosaurus at 1 (new — baselined silently)
    localStorage.setItem(KEY, JSON.stringify({ trex: 2 }));
    getPendingLevelUps([{ species: 'trex', level: 2 }, { species: 'spinosaurus', level: 1 }]);
    // Second visit: spinosaurus has leveled up
    const pending = getPendingLevelUps([
      { species: 'trex', level: 2 },
      { species: 'spinosaurus', level: 2 },
    ]);
    expect(pending).toEqual([{ species: 'spinosaurus', oldLevel: 1, newLevel: 2 }]);
  });

  it('markSeen updates stored value for a species', () => {
    localStorage.setItem(KEY, JSON.stringify({ trex: 2 }));
    markSeen('trex', 4);
    expect(read()).toEqual({ trex: 4 });
  });

  it('markSeen creates storage if none exists', () => {
    markSeen('trex', 3);
    expect(read()).toEqual({ trex: 3 });
  });

  it('seed writes current levels for all provided dinos', () => {
    seed([{ species: 'trex', level: 3 }, { species: 'ankylosaurus', level: 1 }]);
    expect(read()).toEqual({ trex: 3, ankylosaurus: 1 });
  });

  it('read returns null when nothing stored', () => {
    expect(read()).toBeNull();
  });

  it('handles dinos with missing level field as level 1', () => {
    const dinos = [{ species: 'trex' }];
    getPendingLevelUps(dinos);
    expect(read()).toEqual({ trex: 1 });
  });

  it('detects multi-level jumps correctly', () => {
    localStorage.setItem(KEY, JSON.stringify({ trex: 1 }));
    const pending = getPendingLevelUps([{ species: 'trex', level: 4 }]);
    expect(pending).toEqual([{ species: 'trex', oldLevel: 1, newLevel: 4 }]);
  });
});
```

- [ ] **Step 2: Run test to verify all pass**

Run: `cd frontend && npx vitest run src/utils/lastSeenLevels.test.js`
Expected: PASS — all 11 tests pass.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/utils/lastSeenLevels.js frontend/src/utils/lastSeenLevels.test.js
git commit -m "feat(frontend): add lastSeenLevels helper for level-up detection"
```

---

## Task 5: MyDinos — detect pending level-ups on mount

**Files:**
- Modify: `frontend/src/components/MyDinos.jsx`

This task wires up the detection only. Animation comes in the next task. After this task, a console.log will show which dinos are "pending celebration" — no visible UI change yet.

- [ ] **Step 1: Import the helper**

Near the top of `frontend/src/components/MyDinos.jsx`, add the import alongside the existing ones:

```js
import { getPendingLevelUps, markSeen } from '../utils/lastSeenLevels.js';
```

- [ ] **Step 2: Add detection state and effect to MyDinos component**

Locate the `export function MyDinos()` component. Currently it begins like:

```js
export function MyDinos() {
  const { player } = useStore();
  const dinos = player?.dinos || [];
```

Add state and effect right after `const dinos = player?.dinos || [];`:

```js
  const [pendingCelebrations, setPendingCelebrations] = useState(new Map());

  useEffect(() => {
    const pending = getPendingLevelUps(dinos);
    if (pending.length === 0) return;
    setPendingCelebrations(prev => {
      const next = new Map(prev);
      for (const p of pending) {
        if (!next.has(p.species)) {
          next.set(p.species, { oldLevel: p.oldLevel, newLevel: p.newLevel });
        }
      }
      return next;
    });
  }, [dinos]);

  const handleCelebrationComplete = (species, newLevel) => {
    markSeen(species, newLevel);
    setPendingCelebrations(prev => {
      const next = new Map(prev);
      next.delete(species);
      return next;
    });
  };
```

You will also need to ensure `useState` and `useEffect` are imported from `preact/hooks` at the top of the file. Check the existing import — if it doesn't include them, add them.

- [ ] **Step 3: Pass celebration info to DinoCard**

Find the render block where `<DinoCard key={dino.species} dino={dino} />` is rendered inside `sorted.map(...)`. Replace that line with:

```jsx
        {sorted.map(dino => (
          <DinoCard
            key={dino.species}
            dino={dino}
            celebration={pendingCelebrations.get(dino.species) || null}
            onCelebrationComplete={handleCelebrationComplete}
          />
        ))}
```

- [ ] **Step 4: Temporarily add a console.log in DinoCard to confirm wiring**

Add this at the very top of the `DinoCard` function body (before `const speciesData = ...`):

```js
  if (celebration) {
    console.log('[MyDinos] celebration pending for', dino.species, celebration);
  }
```

And update the `DinoCard` signature to accept the new props:

```js
function DinoCard({ dino, celebration, onCelebrationComplete }) {
```

- [ ] **Step 5: Manually verify detection**

Manual verification (user has frontend already running):
1. Open browser devtools console on the MyDinos page.
2. Ensure `localStorage.getItem('dino_party_last_seen_levels')` returns a value — if not, refresh MyDinos once to seed.
3. Manually rewrite one entry to a lower level: `localStorage.setItem('dino_party_last_seen_levels', JSON.stringify({...JSON.parse(localStorage.getItem('dino_party_last_seen_levels')), trex: 1}))` (substitute an actual species you own).
4. Re-navigate to MyDinos (or refresh).
5. Expected: console shows `[MyDinos] celebration pending for trex { oldLevel: 1, newLevel: N }`.

- [ ] **Step 6: Remove the temporary console.log**

Remove the debug log from DinoCard. Keep the signature change and the `celebration` / `onCelebrationComplete` props.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/MyDinos.jsx
git commit -m "feat(frontend): detect pending level-ups in MyDinos"
```

---

## Task 6: DinoCard — animation sequence

**Files:**
- Modify: `frontend/src/components/MyDinos.jsx` (DinoCard component)

This task implements the actual animation inside DinoCard using the props wired up in Task 5.

- [ ] **Step 1: Add animation state to DinoCard**

Replace the top of the `DinoCard` function body (starting from the function signature) with:

```js
function DinoCard({ dino, celebration, onCelebrationComplete }) {
  const speciesData = SPECIES[dino.species] || {};
  const hatData = dino.hat ? HAT_MAP[dino.hat] : null;
  const isTamed = dino.tamed;
  const actualProgress = xpProgress(dino.xp || 0, dino.level || 1);
  const backdropSrc = BACKDROP_IMG[speciesData.backdrop];

  // Animation state — used only when `celebration` is non-null.
  // Phases: initial (bar at 0, level=oldLevel) → filling (bar→100) → hop (level ticks to newLevel)
  // → reset (bar→0, instant) → refill (bar→actualProgress).
  const [anim, setAnim] = useState(() => celebration
    ? { displayedLevel: celebration.oldLevel, displayedProgress: 0, hopping: false, skipTransition: false }
    : null
  );

  useEffect(() => {
    if (!celebration) return;

    // Start in initial state, then kick off phase 1 after two animation frames
    // (first frame: commit DOM at progress=0; second frame: start transition to 100).
    const raf1 = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setAnim(s => ({ ...s, displayedProgress: 100 }));
      });
    });

    // Phase 2: hop + level tick at 400ms (after fill-to-cap completes)
    const hopTimer = setTimeout(() => {
      setAnim(s => ({ ...s, displayedLevel: celebration.newLevel, hopping: true }));
    }, 400);

    // Phase 3: reset bar to 0 instantly at 700ms (400 fill + 300 hop)
    const resetTimer = setTimeout(() => {
      setAnim(s => ({ ...s, displayedProgress: 0, hopping: false, skipTransition: true }));
      // Next two frames: switch transition back on and fill to actual
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setAnim(s => ({ ...s, displayedProgress: actualProgress, skipTransition: false }));
        });
      });
    }, 700);

    // Phase 4: completion at 1300ms (700 + 600 refill)
    const doneTimer = setTimeout(() => {
      onCelebrationComplete(dino.species, celebration.newLevel);
    }, 1300);

    return () => {
      cancelAnimationFrame(raf1);
      clearTimeout(hopTimer);
      clearTimeout(resetTimer);
      clearTimeout(doneTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [celebration?.oldLevel, celebration?.newLevel]);

  // Derive rendered values: use anim state while celebrating, else straight from dino
  const displayedLevel = (celebration && anim) ? anim.displayedLevel : (dino.level || 1);
  const displayedProgress = (celebration && anim) ? anim.displayedProgress : actualProgress;
  const hopping = (celebration && anim?.hopping) || false;
  const skipTransition = (celebration && anim?.skipTransition) || false;
```

- [ ] **Step 2: Update the JSX to use animation values**

Inside the `DinoCard` return block, find the sprite wrapper and the level/bar block. Modify them:

Find:
```jsx
      {/* Sprite — clipped to box */}
      <div style={styles.spriteBox}>
        <DinoSprite species={dino.species} colors={dino.colors || {}} scale={2} hat={dino.hat || null} style={{ width: '100%', height: '100%' }} />
        {dino.shiny && <span style={styles.shinyBadge}>✨</span>}
      </div>
```

Replace with:
```jsx
      {/* Sprite — clipped to box */}
      <div style={{
        ...styles.spriteBox,
        animation: hopping ? 'myDinosHop 0.3s ease-out' : 'none',
      }}>
        <DinoSprite species={dino.species} colors={dino.colors || {}} scale={2} hat={dino.hat || null} style={{ width: '100%', height: '100%' }} />
        {dino.shiny && <span style={styles.shinyBadge}>✨</span>}
      </div>
```

Find:
```jsx
        {isTamed ? (
          <>
            <div style={styles.levelRow}>
              Lv {dino.level || 1}
              {hatData && <span style={styles.hatLabel}>{hatData.name}</span>}
            </div>
            <div style={styles.xpBarBg}>
              <div style={{ ...styles.xpBarFill, width: `${progress}%` }} />
            </div>
          </>
        ) : (
```

Replace with:
```jsx
        {isTamed ? (
          <>
            <div style={styles.levelRow}>
              Lv {displayedLevel}
              {hatData && <span style={styles.hatLabel}>{hatData.name}</span>}
            </div>
            <div style={styles.xpBarBg}>
              <div style={{
                ...styles.xpBarFill,
                width: `${displayedProgress}%`,
                transition: skipTransition
                  ? 'none'
                  : (celebration ? 'width 0.6s ease-out' : 'width 0.3s ease-out'),
              }} />
            </div>
          </>
        ) : (
```

Note: the old `progress` constant (line 35 in the original file) is replaced by `actualProgress` in Step 1 and `displayedProgress` here. Delete the original `const progress = xpProgress(...)` line — it no longer exists after Step 1's replacement, but double-check.

- [ ] **Step 3: Add the hop keyframe and mount it once**

At the bottom of `MyDinos.jsx`, just above the `const styles = {` block, add:

```js
const myDinosHopKeyframes = `
@keyframes myDinosHop {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
}
`;
```

Then in the `MyDinos` component's return, inside the top of the `<div style={styles.page}>`, add a `<style>` element. Find:

```jsx
  return (
    <div style={styles.page}>
      <TitleBar title="My Dinos" subtitle={`${nonSecretDinos.length}/${TOTAL_SPECIES} discovered · ${tamedCount} tamed`} />
```

Replace with:

```jsx
  return (
    <div style={styles.page}>
      <style>{myDinosHopKeyframes}</style>
      <TitleBar title="My Dinos" subtitle={`${nonSecretDinos.length}/${TOTAL_SPECIES} discovered · ${tamedCount} tamed`} />
```

- [ ] **Step 4: Manual verification**

1. In devtools console, seed a pending level-up: open MyDinos at least once, then set a lower level for an owned species:
   ```js
   const k = 'dino_party_last_seen_levels';
   const m = JSON.parse(localStorage.getItem(k));
   m.trex = 1;  // substitute a species you own and have leveled
   localStorage.setItem(k, JSON.stringify(m));
   ```
2. Refresh / navigate to MyDinos.
3. Expected: on that dino's card you see bar fill green to 100% over ~0.4s → sprite hops once → level number changes to current value → bar instantly resets to 0 → bar fills to current actual progress over ~0.6s.
4. After the animation, check localStorage again — the value for that species should equal the current level.
5. Navigate away and back. Expected: no animation replays.
6. Seed two species at once and verify both animate simultaneously.
7. Edge case (private mode): open in an incognito window with localStorage disabled — MyDinos renders normally, no errors in console.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/MyDinos.jsx
git commit -m "feat(frontend): level-up celebration animation on MyDinos"
```

---

## Task 7: PlayTrivia — confetti on correct answer

**Files:**
- Modify: `frontend/src/components/PlayTrivia.jsx`

- [ ] **Step 1: Add import and refs**

In `frontend/src/components/PlayTrivia.jsx`, add the confetti import and add `useRef` to the existing hooks import. Find:

```js
import { useState, useEffect } from 'preact/hooks';
```

Replace with:

```js
import { useState, useEffect, useRef } from 'preact/hooks';
import confetti from 'canvas-confetti';
```

- [ ] **Step 2: Add refs to PlayTrivia component**

Inside `export function PlayTrivia({ code })`, add refs near the other state:

```js
  const answerRefs = useRef([]);
  const confettiFiredRef = useRef(false);
```

Place these right after the existing `useState` calls (after `setPartnerName`).

- [ ] **Step 3: Fire confetti when result becomes correct**

Still inside `PlayTrivia`, add a new effect right after the existing `useEffect(() => { ws.subscribe(...) }, [code])`:

```js
  useEffect(() => {
    if (!result?.correct || confettiFiredRef.current) return;
    confettiFiredRef.current = true;

    let origin = { x: 0.5, y: 0.6 };  // fallback: center of answers grid
    const btn = selectedAnswer != null ? answerRefs.current[selectedAnswer] : null;
    if (btn) {
      const rect = btn.getBoundingClientRect();
      origin = {
        x: (rect.left + rect.width / 2) / window.innerWidth,
        y: (rect.top + rect.height / 2) / window.innerHeight,
      };
    }

    confetti({
      particleCount: 60,
      spread: 70,
      startVelocity: 35,
      origin,
      colors: ['#4ade80', '#f59e0b', '#60a5fa', '#f3f4f6'],
    });
  }, [result?.correct, selectedAnswer]);
```

- [ ] **Step 4: Attach refs to answer buttons**

Find the block rendering the answer buttons:

```jsx
            <div style={styles.answersGrid}>
              {(trivia.options || []).map((option, i) => (
                <button
                  key={i}
                  onClick={() => handleAnswer(i)}
                  disabled={busy}
                  style={{
                    ...styles.answerBtn,
                    opacity: busy ? 0.6 : 1,
                    background: selectedAnswer === i ? '#1e3a5f' : '#111827',
                    borderColor: selectedAnswer === i ? '#60a5fa' : '#374151',
                  }}
                >
```

Add a `ref` prop:

```jsx
            <div style={styles.answersGrid}>
              {(trivia.options || []).map((option, i) => (
                <button
                  key={i}
                  ref={el => answerRefs.current[i] = el}
                  onClick={() => handleAnswer(i)}
                  disabled={busy}
                  style={{
                    ...styles.answerBtn,
                    opacity: busy ? 0.6 : 1,
                    background: selectedAnswer === i ? '#1e3a5f' : '#111827',
                    borderColor: selectedAnswer === i ? '#60a5fa' : '#374151',
                  }}
                >
```

- [ ] **Step 5: Manual verification**

1. Start a trivia game with a partner (or use admin testing panel if available).
2. Answer correctly → expect a burst of green/amber/blue/white confetti originating from the button you tapped, just as the "Correct!" banner appears.
3. Answer incorrectly → expect no confetti.
4. Try getting a result via the partner answering first (WebSocket path) — if `selectedAnswer` was null on this device, confetti falls back to the center of the answers grid. Still fires once.
5. Confirm no double-burst: network-slow case where both API response and WS event arrive with `correct: true` — the `confettiFiredRef` guard should prevent a second burst.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/PlayTrivia.jsx
git commit -m "feat(frontend): confetti burst from tapped button on correct trivia"
```

---

## Task 8: Full unit-test run

**Files:** (no changes)

- [ ] **Step 1: Run all frontend tests**

Run: `cd frontend && npx vitest run`
Expected: PASS — 11 tests pass (all from `lastSeenLevels.test.js`), 0 failures. No other tests exist yet in this project.

If anything fails, debug before continuing. Do not move on with red tests.

---

## Task 9: End-to-end manual test pass

**Files:** (no changes)

- [ ] **Step 1: Clean-slate level-up celebration**

1. In devtools, `localStorage.clear()`.
2. Navigate to MyDinos. Expected: no animations (first load seeds silently).
3. Confirm `localStorage.getItem('dino_party_last_seen_levels')` now contains an object mapping your species to their current levels.

- [ ] **Step 2: Single-level celebration**

1. In devtools:
   ```js
   const k = 'dino_party_last_seen_levels';
   const m = JSON.parse(localStorage.getItem(k));
   const someSpecies = Object.keys(m)[0];
   m[someSpecies] = Math.max(1, (m[someSpecies] || 1) - 1);
   localStorage.setItem(k, JSON.stringify(m));
   ```
2. Reload MyDinos.
3. Expected: that dino's card animates (bar fill → hop → reset → refill) once. Level number updates at the hop peak.

- [ ] **Step 3: Multi-level celebration**

1. Same as above, but set the species to `1` when its current level is ≥ 3.
2. Reload MyDinos.
3. Expected: a single animation sequence plays; the level number jumps directly from 1 → current (e.g., 3), not stepwise.

- [ ] **Step 4: Multiple dinos celebrating simultaneously**

1. Lower two species' stored levels.
2. Reload MyDinos.
3. Expected: both cards animate in parallel.

- [ ] **Step 5: Flag clearing**

1. After animation completes, inspect localStorage.
2. Expected: `dino_party_last_seen_levels` now shows current levels for all celebrated species.
3. Navigate away and back → no replay.

- [ ] **Step 6: Trivia confetti — correct answer**

1. Start a trivia game. Tap the correct answer.
2. Expected: confetti bursts from the tapped button as the Correct banner appears.

- [ ] **Step 7: Trivia confetti — incorrect answer**

1. Start another trivia game. Tap an incorrect answer.
2. Expected: no confetti. Banner shows Incorrect normally.

- [ ] **Step 8: Boss fight sanity check (no regression)**

1. Briefly load the Boss Victory screen path (admin can force victory state if available, or recall that this uses hand-rolled CSS confetti, not the library).
2. Expected: BossVictory confetti still works exactly as before — it uses `<div>` particles and CSS keyframes and is unaffected by this change.

---

## Self-Review Notes

**Spec coverage:**
- Detection (A1, first-load seed, localStorage unavailable) → Tasks 2–4 helper + tests, Task 5 integration.
- Animation sequence (4 phases, multi-level E2, max level) → Task 6 with explicit timings matching spec (400/300/instant-reset/600ms).
- MyDinos-only placement (L2) → only `MyDinos.jsx` modified.
- Flag clearing after each animation → Task 6 Step 1 (`onCelebrationComplete` calls `markSeen`).
- Confetti library + C1 origin + single-shot guard + fallback origin → Task 7.
- Incorrect answer = no confetti → Task 7 effect gated on `result.correct`.
- Max-level case → covered by animation using `actualProgress` which is 100 at level 5.

**Type/name consistency:**
- Helper exports: `read`, `seed`, `markSeen`, `getPendingLevelUps` — used consistently in Task 5.
- Celebration prop shape: `{ oldLevel, newLevel }` — matches what `getPendingLevelUps` returns and what `DinoCard` reads.
- `onCelebrationComplete(species, newLevel)` signature consistent between MyDinos Task 5 Step 2 and DinoCard Task 6 Step 1.

**Placeholder scan:** No TBD/TODO/"similar to"/"add error handling" patterns present. All code shown in full.
