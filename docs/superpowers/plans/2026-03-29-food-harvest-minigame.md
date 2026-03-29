# Food Harvest Minigame Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the static "FOOD HARVESTED!" screen with a short interactive minigame (Timing Tap for meat, Whack-a-Food for berries) that plays on every food QR scan and always awards 5 XP.

**Architecture:** Single `HarvestMinigame.jsx` with three internal phases (ready → playing → results). `FoodHarvest.jsx` fires the API call on mount and passes `apiResult` as a prop so the results screen can show the "Feed a Dino!" button once eligibility is known. The backend drops the one-time `FOOD#` gate and always awards 5 XP.

**Tech Stack:** Preact 10, inline styles only (no CSS files), CSS `@keyframes` injected via `<style>` tag in JSX (required for ring animation), `useRef` for game-loop state to avoid stale closures, Python 3.12, pytest.

---

## File Map

| Action | File |
|--------|------|
| Modify | `backend/src/handlers/scan_food.py` — lines 11–57 (`_harvest` function) |
| Modify | `backend/tests/test_scan_food.py` — add one test |
| Create | `frontend/src/components/HarvestMinigame.jsx` |
| Modify | `frontend/src/components/FoodHarvest.jsx` |

---

## Task 1: Backend — Remove one-time harvest gate; always award 5 XP

**Files:**
- Modify: `backend/src/handlers/scan_food.py:11-57`
- Modify: `backend/tests/test_scan_food.py`

- [ ] **Step 1: Add failing test to `backend/tests/test_scan_food.py`**

Append to the end of the file:

```python
def test_harvest_awards_xp_every_scan():
    put_item({"PK": "PLAYER#p9", "SK": "PROFILE", "name": "Dana"})
    resp1 = handler(_event("meat", {"player_id": "p9"}), None)
    body1 = json.loads(resp1["body"])
    assert body1["harvest"]["xp_awarded"] == 5

    resp2 = handler(_event("meat", {"player_id": "p9"}), None)
    body2 = json.loads(resp2["body"])
    assert body2["harvest"]["xp_awarded"] == 5
```

- [ ] **Step 2: Run the test and confirm it fails**

```
cd backend && pytest tests/test_scan_food.py::test_harvest_awards_xp_every_scan -v
```

Expected: FAIL — second call returns `xp_awarded: 0` because the existing `FOOD#` record is found.

- [ ] **Step 3: Replace `_harvest()` in `backend/src/handlers/scan_food.py`**

Replace lines 11–57 (the entire `_harvest` function body) with:

```python
def _harvest(player_id, food_type, profile):
    """Award XP for harvesting food. Called on every scan."""
    dino_result = award_xp(player_id, 5)
    return {
        "xp_awarded": 5,
        "dino": dino_result,
        "no_partner": dino_result is None,
    }
```

Leave the `import uuid` and `from datetime import datetime, timezone` lines at the top of the file — they are still used by other functions in the handler. The `FOOD#` DynamoDB record, its `put_item`, and the feed broadcast are all removed by replacing `_harvest` with the simplified version above.

- [ ] **Step 4: Run the new test — expect PASS**

```
cd backend && pytest tests/test_scan_food.py::test_harvest_awards_xp_every_scan -v
```

- [ ] **Step 5: Run full test suite — expect all pass**

```
cd backend && pytest
```

The `first_time` field no longer appears in any response, but existing tests do not assert on it, so they pass unchanged.

- [ ] **Step 6: Commit**

```bash
git add backend/src/handlers/scan_food.py backend/tests/test_scan_food.py
git commit -m "feat: harvest always awards 5 XP, remove one-time gate"
```

---

## Task 2: Frontend — Create `HarvestMinigame.jsx`

**Files:**
- Create: `frontend/src/components/HarvestMinigame.jsx`

No frontend test framework exists in this project — manual testing steps are provided below.

- [ ] **Step 1: Create `frontend/src/components/HarvestMinigame.jsx`**

```jsx
import { useState, useEffect, useRef } from 'preact/hooks';
import meatImg from '../assets/items/meat.png';
import berryImg from '../assets/items/berry.png';

const FOOD_IMGS = { meat: meatImg, mejoberries: berryImg };
const TIMING_ROUNDS = 6;
const ROUND_MS = 1500;
const WHACK_MS = 10000;
const SPAWN_MS = 700;
const MAX_ON_SCREEN = 4;

// ── Ready Screen ──────────────────────────────────────────────────────────────

function ReadyScreen({ foodType, countdown, theme }) {
  const isMeat = foodType === 'meat';
  return (
    <div style={{ ...styles.page, background: theme.bg }}>
      <div style={{ ...styles.tagline, color: theme.accent }}>{theme.title}</div>
      <img src={FOOD_IMGS[foodType]} style={styles.bigIcon} />
      <div style={styles.instruction}>
        {isMeat ? 'Tap when the ring hits the centre!' : 'Tap the berries before they vanish!'}
      </div>
      <div style={{ fontSize: '11px', color: '#6b7280' }}>
        {isMeat ? `${TIMING_ROUNDS} rounds` : '10 seconds'}
      </div>
      <div style={{ fontSize: '48px', fontWeight: '900', color: theme.accentAlt, marginTop: '12px' }}>
        {countdown > 0 ? countdown : 'GO!'}
      </div>
    </div>
  );
}

// ── Timing Tap Game ───────────────────────────────────────────────────────────
// Outer ring shrinks inward over ROUND_MS. t = elapsed/ROUND_MS (0→1).
// t >= 0.7 → PERFECT (ring near centre), t >= 0.4 → GOOD, else MISS.
// Score = catch count (GOOD or PERFECT rounds) out of TIMING_ROUNDS.

function TimingTapGame({ foodType, theme, onFinish }) {
  const [displayRound, setDisplayRound] = useState(1);
  const [animKey, setAnimKey] = useState(0);
  const [feedback, setFeedback] = useState(null); // 'PERFECT ✦' | 'GOOD' | 'MISS'
  const [dots, setDots] = useState([]);           // 'perfect' | 'good' | 'miss'

  const roundStartRef = useRef(null);
  const tappedRef = useRef(false);   // guards against double-resolution (tap vs. timer race)
  const timerRef = useRef(null);
  const catchRef = useRef(0);        // rounds where player tapped (GOOD or PERFECT)
  const roundRef = useRef(0);

  function resolveRound(label, isCatch) {
    if (tappedRef.current) return;   // already resolved — ignore duplicate call
    tappedRef.current = true;
    clearTimeout(timerRef.current);

    if (isCatch) catchRef.current++;
    setFeedback(label);
    setDots(d => [...d, label === 'PERFECT ✦' ? 'perfect' : label === 'GOOD' ? 'good' : 'miss']);

    const next = roundRef.current + 1;
    roundRef.current = next;
    setDisplayRound(Math.min(next + 1, TIMING_ROUNDS));

    if (next >= TIMING_ROUNDS) {
      setTimeout(() => onFinish(catchRef.current, TIMING_ROUNDS), 700);
    } else {
      setTimeout(() => startRound(), 700);
    }
  }

  function startRound() {
    tappedRef.current = false;
    roundStartRef.current = performance.now();
    setAnimKey(k => k + 1);  // new key unmounts/remounts ring div → restarts CSS animation
    setFeedback(null);
    timerRef.current = setTimeout(() => resolveRound('MISS', false), ROUND_MS + 50);
  }

  function handleTap() {
    const elapsed = performance.now() - (roundStartRef.current || 0);
    const t = Math.min(elapsed / ROUND_MS, 1);
    if (t >= 0.7) resolveRound('PERFECT ✦', true);
    else if (t >= 0.4) resolveRound('GOOD', true);
    else resolveRound('MISS', false);
  }

  useEffect(() => {
    startRound();
    return () => clearTimeout(timerRef.current);
  }, []);

  return (
    <div style={{ ...styles.page, background: theme.bg, userSelect: 'none' }} onClick={handleTap}>
      <style>{`
        @keyframes shrinkRing {
          from { transform: scale(1); opacity: 1; }
          to   { transform: scale(0.02); opacity: 0; }
        }
      `}</style>

      <div style={styles.roundRow}>
        <span style={{ color: '#9ca3af', fontSize: '11px' }}>
          Round {displayRound} / {TIMING_ROUNDS}
        </span>
        <div style={{ display: 'flex', gap: '4px' }}>
          {Array.from({ length: TIMING_ROUNDS }).map((_, i) => {
            const d = dots[i];
            const color = d === 'perfect' ? theme.accentAlt
              : d === 'good' ? '#4ade80'
              : '#374151';
            return <span key={i} style={{ color, fontSize: '14px' }}>{d ? '●' : '○'}</span>;
          })}
        </div>
      </div>

      {/* Ring arena — tap anywhere on the page to register */}
      <div style={styles.ringContainer}>
        {/* Static outer reference ring */}
        <div style={styles.ringOuter} />
        {/* Static target zone ring — shows where PERFECT begins (30% of radius) */}
        <div style={{ ...styles.ringTarget, borderColor: `${theme.accent}80` }} />
        {/* Animated shrinking ring — key change restarts the CSS animation */}
        <div
          key={animKey}
          style={{
            position: 'absolute', inset: 0,
            borderRadius: '50%',
            border: `4px solid ${theme.accentAlt}`,
            boxShadow: `0 0 14px ${theme.accentAlt}88`,
            animation: `shrinkRing ${ROUND_MS}ms linear forwards`,
          }}
        />
        <img src={FOOD_IMGS[foodType]} style={styles.ringIcon} />
      </div>

      <div style={{ fontSize: '11px', color: '#4ade80', fontWeight: 'bold', letterSpacing: '1px' }}>
        TAP!
      </div>

      <div style={{ height: '24px', display: 'flex', alignItems: 'center' }}>
        {feedback && (
          <span style={{
            fontSize: '15px', fontWeight: 'bold',
            color: feedback.includes('PERFECT') ? theme.accentAlt
              : feedback === 'GOOD' ? '#4ade80'
              : '#4b5563',
          }}>
            {feedback}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Whack-a-Food Game ─────────────────────────────────────────────────────────
// Items spawn every SPAWN_MS for WHACK_MS total. Each lives 1.0–1.4s.
// Up to MAX_ON_SCREEN items on screen at once.
// Score = items tapped / items spawned.

function WhackAFoodGame({ foodType, theme, onFinish }) {
  const [items, setItems] = useState([]);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(WHACK_MS);

  const scoreRef = useRef(0);
  const totalRef = useRef(0);
  const nextIdRef = useRef(0);
  const doneRef = useRef(false);

  function spawnItem() {
    if (doneRef.current) return;
    const life = 1000 + Math.random() * 400;
    const id = nextIdRef.current++;
    const item = {
      id,
      left: 5 + Math.random() * 70,  // 5–75%
      top: 5 + Math.random() * 75,   // 5–80%
      life,
    };
    // Only add if under the simultaneous cap; count only what actually appears
    setItems(prev => {
      if (prev.length >= MAX_ON_SCREEN) return prev;
      totalRef.current++;
      return [...prev, item];
    });
    // Auto-expire — filter is a no-op if item was never added
    setTimeout(() => {
      setItems(prev => prev.filter(i => i.id !== id));
    }, life);
  }

  function tapItem(e, id) {
    e.stopPropagation();
    scoreRef.current++;
    setScore(scoreRef.current);
    setItems(prev => prev.filter(i => i.id !== id));
  }

  useEffect(() => {
    const start = Date.now();

    const timerInterval = setInterval(() => {
      const remaining = WHACK_MS - (Date.now() - start);
      setTimeLeft(Math.max(0, remaining));
      if (remaining <= 0) {
        clearInterval(timerInterval);
        doneRef.current = true;
        onFinish(scoreRef.current, totalRef.current);
      }
    }, 100);

    const spawnInterval = setInterval(() => {
      if (!doneRef.current) spawnItem();
    }, SPAWN_MS);

    spawnItem(); // immediate first item

    return () => {
      clearInterval(timerInterval);
      clearInterval(spawnInterval);
    };
  }, []);

  const timerFraction = timeLeft / WHACK_MS;

  return (
    <div style={{ ...styles.page, background: theme.bg }}>
      <div style={styles.roundRow}>
        <span style={{ color: theme.accent, fontWeight: 'bold', fontSize: '13px' }}>
          Score: {score}
        </span>
        <div style={styles.timerTrack}>
          <div style={{
            ...styles.timerBar,
            width: `${timerFraction * 100}%`,
            background: theme.accent,
          }} />
        </div>
      </div>

      <div style={styles.playArea}>
        {items.map(item => (
          <img
            key={item.id}
            src={FOOD_IMGS[foodType]}
            onClick={e => tapItem(e, item.id)}
            style={{
              position: 'absolute',
              left: `${item.left}%`,
              top: `${item.top}%`,
              width: '44px',
              height: '44px',
              imageRendering: 'pixelated',
              cursor: 'pointer',
              filter: `drop-shadow(0 0 6px ${theme.accent})`,
              touchAction: 'manipulation',
            }}
          />
        ))}
      </div>

      <div style={{ color: '#6b7280', fontSize: '11px' }}>
        {Math.ceil(timeLeft / 1000)}s left
      </div>
    </div>
  );
}

// ── Results Screen ────────────────────────────────────────────────────────────

function ResultsScreen({ score, total, foodType, apiResult, onComplete, theme }) {
  const canTame = apiResult && !apiResult.harvest_only && !apiResult.already_tamed;
  const scoreLabel = foodType === 'meat' ? 'catches' : 'berries collected';

  return (
    <div style={{ ...styles.page, background: theme.bg }}>
      <div style={{ ...styles.tagline, color: theme.accent }}>{theme.label}</div>
      <div style={{ fontSize: '40px', fontWeight: '900', color: theme.text }}>
        {score} / {total || '?'}
      </div>
      <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>{scoreLabel}</div>

      <div style={{ ...styles.xpBox, borderColor: `${theme.accent}40` }}>
        <div style={styles.xpRow}>
          <span style={{ color: '#9ca3af' }}>XP Earned</span>
          <span style={{ color: '#f59e0b', fontWeight: 'bold' }}>+5 XP</span>
        </div>
      </div>

      {!apiResult ? (
        <div style={{ color: '#6b7280', fontSize: '13px' }}>Calculating reward...</div>
      ) : canTame ? (
        <button onClick={onComplete} style={styles.primaryBtn}>Feed a Dino! 🦕</button>
      ) : (
        <button onClick={onComplete} style={styles.backBtn}>Back to Plaza</button>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function HarvestMinigame({ foodType, apiResult, onComplete }) {
  const [phase, setPhase] = useState('ready');
  const [countdown, setCountdown] = useState(3);
  const [score, setScore] = useState(0);
  const [total, setTotal] = useState(0);

  const isMeat = foodType === 'meat';
  const theme = isMeat
    ? { bg: '#1a1008', accent: '#f87171', accentAlt: '#fbbf24', text: '#fef3c7', title: 'HUNTING TIME',   label: 'HUNT COMPLETE'   }
    : { bg: '#1a1035', accent: '#a78bfa', accentAlt: '#a78bfa', text: '#ede9fe', title: 'FORAGING TIME', label: 'FORAGE COMPLETE' };

  // Countdown: 3 → 2 → 1 → "GO!" (400ms) → phase='playing'
  useEffect(() => {
    if (phase !== 'ready') return;
    const interval = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) {
          clearInterval(interval);
          setTimeout(() => setPhase('playing'), 400);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [phase]);

  function handleGameFinish(s, t) {
    setScore(s);
    setTotal(t);
    setPhase('results');
  }

  if (phase === 'ready') {
    return <ReadyScreen foodType={foodType} countdown={countdown} theme={theme} />;
  }
  if (phase === 'playing') {
    return isMeat
      ? <TimingTapGame foodType={foodType} theme={theme} onFinish={handleGameFinish} />
      : <WhackAFoodGame foodType={foodType} theme={theme} onFinish={handleGameFinish} />;
  }
  return (
    <ResultsScreen
      score={score}
      total={total}
      foodType={foodType}
      apiResult={apiResult}
      onComplete={onComplete}
      theme={theme}
    />
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = {
  page: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    padding: '32px 20px 80px', gap: '14px', minHeight: '100vh',
  },
  tagline: {
    fontSize: '11px', fontWeight: '900', letterSpacing: '3px', textAlign: 'center',
  },
  bigIcon: {
    width: '80px', height: '80px', imageRendering: 'pixelated', margin: '8px 0',
  },
  instruction: {
    fontSize: '16px', fontWeight: 'bold', color: '#e5e7eb', textAlign: 'center', maxWidth: '260px',
  },
  roundRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    width: '100%', maxWidth: '300px',
  },
  // Ring layout for Timing Tap
  ringContainer: {
    position: 'relative', width: '140px', height: '140px',
  },
  ringOuter: {
    position: 'absolute', inset: 0, borderRadius: '50%',
    border: '3px solid #374151',
  },
  // Target ring marks the PERFECT zone (30% of radius = 21px from centre)
  // inset = (140 - 42) / 2 = 49px  →  42px diameter ring
  ringTarget: {
    position: 'absolute', inset: '49px', borderRadius: '50%',
    border: '2px dashed #374151', opacity: 0.7,
  },
  ringIcon: {
    position: 'absolute', width: '44px', height: '44px',
    imageRendering: 'pixelated', zIndex: 1,
    top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
  },
  // Timer bar for Whack-a-Food
  timerTrack: {
    width: '100px', height: '8px', background: '#1e293b',
    borderRadius: '4px', overflow: 'hidden',
  },
  timerBar: {
    height: '100%', borderRadius: '4px', transition: 'width 0.1s linear',
  },
  // Berry play area
  playArea: {
    position: 'relative', width: '100%', maxWidth: '340px', height: '200px',
    background: '#0f0a20', borderRadius: '12px', overflow: 'hidden',
  },
  // Results
  xpBox: {
    background: '#111827', border: '1px solid', borderRadius: '12px',
    padding: '12px 18px', width: '100%', maxWidth: '300px',
  },
  xpRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '14px',
  },
  primaryBtn: {
    padding: '16px', borderRadius: '12px', border: 'none',
    background: '#22c55e', color: 'white', fontSize: '16px',
    fontWeight: 'bold', cursor: 'pointer', width: '100%', maxWidth: '300px',
  },
  backBtn: {
    padding: '14px', borderRadius: '10px', border: 'none',
    background: 'transparent', color: '#6b7280', fontSize: '14px',
    cursor: 'pointer', width: '100%', maxWidth: '300px',
  },
};
```

- [ ] **Step 2: Verify dev server compiles without errors**

```
cd frontend && npm run dev
```

Open `http://localhost:3000/dinosaur-birthday/`. If Vite reports no errors, the file is syntactically valid. Fix any JSX or import errors before continuing.

- [ ] **Step 3: Manual test — meat minigame**

Navigate to `/#scan/food/meat` in the browser (or scan a meat QR code):

1. **Ready screen**: dark amber background (`#1a1008`), "HUNTING TIME" label, meat image, "Tap when the ring hits the centre!", countdown 3 → 2 → 1 → GO!
2. **Playing screen**: ring shrinks every 1.5s. Tapping near the end shows "PERFECT ✦" (amber). Mid-ring shows "GOOD" (green). Early tap or miss shows "MISS" (grey). Dot row fills round by round.
3. After 6 rounds: **results screen** — "HUNT COMPLETE", "X / 6 catches", "+5 XP" box, either "Calculating reward..." → then "Feed a Dino! 🦕" or "Back to Plaza".

- [ ] **Step 4: Manual test — berry minigame**

Navigate to `/#scan/food/mejoberries`:

1. **Ready screen**: dark purple background (`#1a1035`), "FORAGING TIME", berry image, countdown.
2. **Playing screen**: berry images pop up at random positions. Purple timer bar depletes over 10s. Tapping a berry removes it and increments score. "Xs left" countdown below.
3. After 10s: **results screen** — "FORAGE COMPLETE", "X / Y berries collected", "+5 XP".

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/HarvestMinigame.jsx
git commit -m "feat: HarvestMinigame component with timing tap and whack-a-food"
```

---

## Task 3: Frontend — Update `FoodHarvest.jsx` to use HarvestMinigame

**Files:**
- Modify: `frontend/src/components/FoodHarvest.jsx`

- [ ] **Step 1: Replace `frontend/src/components/FoodHarvest.jsx` entirely**

```jsx
import { useState, useEffect } from 'preact/hooks';
import { store } from '../store.js';
import { api } from '../api.js';
import { DinoTaming } from './DinoTaming.jsx';
import { HarvestMinigame } from './HarvestMinigame.jsx';

export function FoodHarvest({ foodType }) {
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [phase, setPhase] = useState('minigame'); // 'minigame' | 'taming'

  useEffect(() => {
    (async () => {
      try {
        const data = await api.scanFood(store.playerId, foodType, null);
        setResult(data);      // apiResult prop updates HarvestMinigame mid-game if still playing
        await store.refresh();
      } catch (err) {
        setError(err.message);
      }
    })();
  }, [foodType]);

  if (error) {
    return (
      <div style={styles.center}>
        <p style={{ color: '#ef4444' }}>{error}</p>
        <button onClick={() => store.navigate('/plaza')} style={styles.button}>Back to Plaza</button>
      </div>
    );
  }

  if (phase === 'taming') {
    return <DinoTaming foodType={foodType} prefetchedResult={result} />;
  }

  // canTame is evaluated from result state here (not inside HarvestMinigame)
  // so onComplete always reflects the latest resolved result.
  const canTame = result && !result.harvest_only && !result.already_tamed;

  function handleComplete() {
    if (canTame) {
      setPhase('taming');
    } else {
      store.navigate('/plaza');
    }
  }

  return (
    <HarvestMinigame
      foodType={foodType}
      apiResult={result}
      onComplete={handleComplete}
    />
  );
}

const styles = {
  center: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', minHeight: '80dvh', padding: '20px', gap: '16px',
  },
  button: {
    padding: '14px', borderRadius: '10px', border: 'none',
    background: '#6366f1', color: 'white', fontSize: '16px',
    fontWeight: 'bold', cursor: 'pointer', width: '100%', maxWidth: '320px',
  },
};
```

- [ ] **Step 2: Manual test — full end-to-end flow**

1. Scan a meat QR → minigame plays → results screen shows "+5 XP" immediately → "Calculating reward..." for a moment if API hasn't returned → button appears
2. Tap "Feed a Dino!" → `DinoTaming` screen appears correctly (prefetched result passed through)
3. Scan same QR again immediately → minigame plays again, +5 XP again (no one-time gate)
4. Player with no untamed dinos of that diet → only "Back to Plaza" button in results
5. API error → error screen with "Back to Plaza" button

- [ ] **Step 3: Run backend tests**

```
cd backend && pytest
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/FoodHarvest.jsx
git commit -m "feat: wire FoodHarvest to HarvestMinigame, remove static harvest screen"
```
