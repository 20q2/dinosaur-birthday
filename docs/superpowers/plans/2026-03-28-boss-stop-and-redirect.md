# Boss Stop & Active-Fight Redirect Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add admin stop-boss button, hard-lock players to `/boss` while fight is active, and award Kaiju Slayer hat to all players on defeat.

**Architecture:** Backend gets a new `POST /admin/boss/stop` endpoint and updated defeat logic; frontend gains boss-state hydration on startup, a `useEffect` redirect guard in `App`, and a stop button in `AdminDashboard`. WebSocket `boss_stopped` event drives client-side cleanup.

**Tech Stack:** Python 3.12 / moto / pytest (backend), Preact 10 / Vite (frontend), AWS CDK TypeScript (infra)

---

## File Map

| File | Change |
|------|--------|
| `backend/src/handlers/boss.py` | Replace single-player hat award with all-player version |
| `backend/src/handlers/admin.py` | Add `stop_handler()` + register in router |
| `backend/tests/test_boss.py` | New tests: all-player hat award, stop endpoint |
| `infra/lib/dino-party-stack.ts` | Add `POST /admin/boss/stop` route |
| `frontend/src/api.js` | Add `adminBossStop()` |
| `frontend/src/store.js` | Fetch boss state on `init()` |
| `frontend/src/app.jsx` | Add redirect `useEffect` + `boss_stopped` WS handler |
| `frontend/src/components/AdminDashboard.jsx` | Add stop-boss button |

---

## Task 1: Award Kaiju Slayer hat to all players on defeat

**Files:**
- Modify: `backend/src/handlers/boss.py`
- Test: `backend/tests/test_boss.py`

- [ ] **Step 1: Write the failing test**

Add to `backend/tests/test_boss.py` (after existing imports, keep existing helpers):

```python
def test_boss_defeat_awards_hat_to_all_players():
    """All players' tamed dinos receive Kaiju Slayer hat on defeat, not just killer."""
    # Two players, only defeat1 delivers killing blow
    _make_player("defeat1")
    _make_dino("defeat1", "trex", level=1, tamed=True, is_partner=True)
    _make_player("defeat2")
    _make_dino("defeat2", "triceratops", level=1, tamed=True, is_partner=True)

    # HP exactly matches defeat1's damage: 5 + 1 = 6
    _make_boss(hp=6, max_hp=1000, status="active")

    resp = tap_handler(_tap_event("defeat1"), None)
    assert resp["statusCode"] == 200
    body = json.loads(resp["body"])
    assert body["defeated"] is True

    # Both players should have the hat
    dino1 = get_item("PLAYER#defeat1", "DINO#trex")
    dino2 = get_item("PLAYER#defeat2", "DINO#triceratops")
    assert dino1["hat"] == "kaiju_slayer"
    assert dino2["hat"] == "kaiju_slayer"
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && pytest tests/test_boss.py::test_boss_defeat_awards_hat_to_all_players -v
```

Expected: FAIL — `dino2["hat"]` is `""` (defeat2 never gets the hat with current single-player logic).

- [ ] **Step 3: Add `_award_kaiju_slayer_hat_all()` to `boss.py`**

In `backend/src/handlers/boss.py`, add this new function directly after the existing `_award_kaiju_slayer_hat()` function:

```python
def _award_kaiju_slayer_hat_all():
    """Award the Kaiju Slayer hat to every player's partner/tamed dino."""
    try:
        table = get_table()
        resp = table.scan(
            FilterExpression="SK = :sk",
            ExpressionAttributeValues={":sk": "PROFILE"},
        )
        for profile in resp.get("Items", []):
            pk = profile.get("PK", "")
            if not pk.startswith("PLAYER#"):
                continue
            player_id = pk.replace("PLAYER#", "")
            _award_kaiju_slayer_hat(player_id)
    except Exception:
        pass
```

- [ ] **Step 4: Replace single-player call with all-players call in `tap_handler`**

In `backend/src/handlers/boss.py`, find the defeat branch (around line 77). Replace:

```python
        # Award "Kaiju Slayer" hat to the player who delivered the killing blow
        _award_kaiju_slayer_hat(player_id)
```

With:

```python
        # Award "Kaiju Slayer" hat to ALL players
        _award_kaiju_slayer_hat_all()
```

- [ ] **Step 5: Run the new test plus full boss test suite**

```bash
cd backend && pytest tests/test_boss.py -v
```

Expected: all tests PASS (existing tests unaffected — they don't assert hat values).

- [ ] **Step 6: Commit**

```bash
git add backend/src/handlers/boss.py backend/tests/test_boss.py
git commit -m "fix: award Kaiju Slayer hat to all players on boss defeat"
```

---

## Task 2: Add `POST /admin/boss/stop` endpoint

**Files:**
- Modify: `backend/src/handlers/admin.py`
- Test: `backend/tests/test_boss.py`

- [ ] **Step 1: Write the failing test**

Add to `backend/tests/test_boss.py`. Update the imports line at the top:

```python
from src.handlers.admin import buildup_handler, start_handler, announce_handler, dashboard_handler, stop_handler
```

Then add the test:

```python
def _stop_event():
    return {
        "httpMethod": "POST",
        "resource": "/admin/boss/stop",
        "body": "{}",
    }


def test_admin_boss_stop_resets_to_idle():
    """Stop handler overwrites BOSS#STATE with idle status."""
    put_item({
        "PK": "BOSS",
        "SK": "STATE",
        "status": "active",
        "hp": 500,
        "max_hp": 1000,
        "buildup_phase": 3,
    })

    resp = stop_handler(_stop_event(), None)
    assert resp["statusCode"] == 200
    body = json.loads(resp["body"])
    assert body["status"] == "idle"

    boss = get_item("BOSS", "STATE")
    assert boss["status"] == "idle"
    assert int(boss["hp"]) == 0
    assert int(boss["buildup_phase"]) == 0


def test_admin_boss_stop_is_idempotent_when_already_idle():
    """Stop handler succeeds even when no active boss exists."""
    # No BOSS#STATE in DB at all
    resp = stop_handler(_stop_event(), None)
    assert resp["statusCode"] == 200
    body = json.loads(resp["body"])
    assert body["status"] == "idle"
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend && pytest tests/test_boss.py::test_admin_boss_stop_resets_to_idle tests/test_boss.py::test_admin_boss_stop_is_idempotent_when_already_idle -v
```

Expected: FAIL with `ImportError: cannot import name 'stop_handler'`.

- [ ] **Step 3: Add `stop_handler()` to `admin.py`**

In `backend/src/handlers/admin.py`, add after `start_handler()` (around line 161):

```python
def stop_handler(event, context):
    """POST /admin/boss/stop — Reset boss fight to idle."""
    put_item({
        "PK": "BOSS",
        "SK": "STATE",
        "status": "idle",
        "buildup_phase": 0,
        "hp": 0,
        "max_hp": 0,
    })

    broadcast("all", "boss_stopped", {"status": "idle"})
    broadcast("boss", "boss_stopped", {"status": "idle"})

    _post_feed_entry("boss_stop", "The boss fight has been called off. The city is safe... for now.")

    return success({"status": "idle"})
```

- [ ] **Step 4: Register the route in `handler()` at the bottom of `admin.py`**

In the `handler()` function, add before the final `return error("Not found", 404)`:

```python
    if method == "POST" and path.endswith("/boss/stop"):
        return stop_handler(event, context)
```

- [ ] **Step 5: Run the new tests plus full suite**

```bash
cd backend && pytest tests/test_boss.py -v
```

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/src/handlers/admin.py backend/tests/test_boss.py
git commit -m "feat: add POST /admin/boss/stop endpoint"
```

---

## Task 3: Wire infra route for `/admin/boss/stop`

**Files:**
- Modify: `infra/lib/dino-party-stack.ts`

- [ ] **Step 1: Add the route**

In `infra/lib/dino-party-stack.ts`, find these two existing lines:

```typescript
    addRoute(adminFn, 'POST', '/admin/boss/buildup');
    addRoute(adminFn, 'POST', '/admin/boss/start');
```

Add immediately after them:

```typescript
    addRoute(adminFn, 'POST', '/admin/boss/stop');
```

- [ ] **Step 2: Verify CDK compiles**

```bash
cd infra && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add infra/lib/dino-party-stack.ts
git commit -m "feat: add /admin/boss/stop infra route"
```

---

## Task 4: Frontend — API method, boss state on startup, hard-lock redirect

**Files:**
- Modify: `frontend/src/api.js`
- Modify: `frontend/src/store.js`
- Modify: `frontend/src/app.jsx`

### 4a — Add `adminBossStop()` to api.js

- [ ] **Step 1: Add the method**

In `frontend/src/api.js`, add after `adminBossStart`:

```js
  adminBossStop: () =>
    request('POST', '/admin/boss/stop'),
```

### 4b — Fetch boss state during `store.init()`

- [ ] **Step 2: Update `store.init()` in `store.js`**

Replace the existing `init()` method:

```js
  async init() {
    if (this.playerId) {
      try {
        this.player = await api.getPlayer(this.playerId);
        this.loading = false;
        this.notify();
      } catch {
        this.loading = false;
        this.notify();
      }
    } else {
      this.loading = false;
      this.notify();
    }
  },
```

With:

```js
  async init() {
    const [playerResult, bossResult] = await Promise.allSettled([
      this.playerId ? api.getPlayer(this.playerId) : Promise.resolve(null),
      api.getBossState(),
    ]);

    if (playerResult.status === 'fulfilled' && playerResult.value) {
      this.player = playerResult.value;
    }
    if (bossResult.status === 'fulfilled' && bossResult.value) {
      this.bossState = bossResult.value;
    }
    this.loading = false;
    this.notify();
  },
```

### 4c — Add hard-lock redirect and `boss_stopped` handler in `app.jsx`

- [ ] **Step 3: Add redirect `useEffect` to `App`**

In `frontend/src/app.jsx`, inside the `App` function, add a new `useEffect` directly after the existing one (the one that calls `store.init()` and wires WS handlers). The existing `useEffect` ends at line ~55. Add after it:

```jsx
  // Hard-lock: redirect to /boss whenever a fight is active
  useEffect(() => {
    if (bossState?.status === 'active' && route !== '/boss' && route !== '/admin') {
      store.navigate('/boss');
    }
  }, [bossState, route]);
```

- [ ] **Step 4: Add `boss_stopped` WS handler inside the existing `useEffect`**

In the same existing `useEffect` (the one with `store.init()` and `ws.connect()`), add alongside the other `ws.on('boss', ...)` calls:

```js
    ws.on('boss', 'boss_stopped', () => {
      store.setBossState({ status: 'idle' });
      store.navigate('/plaza');
    });
```

- [ ] **Step 5: Manual verification — fresh load during active boss**

1. `cd frontend && npm run dev`
2. In DynamoDB (or via admin panel), start the boss fight
3. Open a new browser tab to `http://localhost:3000/dinosaur-birthday/#/dinos`
4. Expected: tab immediately redirects to `/#/boss`

- [ ] **Step 6: Manual verification — navigation lock during active fight**

1. With boss active, navigate to any other tab via BottomNav
2. Expected: immediately redirected back to `/boss`
3. Navigate to `/#admin` — expected: admin panel opens normally (not redirected)

- [ ] **Step 7: Manual verification — boss stopped clears lock**

1. With boss active and a player on `/boss`, trigger `boss_stopped` event (next task adds the button; for now call the API directly: `curl -X POST $VITE_API_URL/admin/boss/stop`)
2. Expected: player navigates to `/plaza`, can navigate freely again

- [ ] **Step 8: Commit**

```bash
git add frontend/src/api.js frontend/src/store.js frontend/src/app.jsx
git commit -m "feat: hydrate boss state on startup and hard-lock /boss during active fight"
```

---

## Task 5: Admin UI — Stop Boss button

**Files:**
- Modify: `frontend/src/components/AdminDashboard.jsx`

- [ ] **Step 1: Add `bossStopping` state**

In `frontend/src/components/AdminDashboard.jsx`, add alongside the existing boss state declarations (around line 21):

```jsx
  const [bossStopping, setBossStopping] = useState(false);
```

- [ ] **Step 2: Add `handleBossStop()` handler**

Add after `handleBossStart()` (around line 89):

```jsx
  async function handleBossStop() {
    if (bossStopping) return;
    if (!confirm('Stop the boss fight? This will reset everything and send all players back to the plaza.')) return;
    setBossStopping(true);
    try {
      await api.adminBossStop();
      setBossStarted(false);
      await fetchDashboard();
    } catch (err) {
      alert(`Stop boss failed: ${err.message}`);
    } finally {
      setBossStopping(false);
    }
  }
```

- [ ] **Step 3: Add the stop button to the Boss Fight Control section**

In the JSX, find the Boss Fight Control section. After the closing `</button>` of the start button and after the `{bossStarted && boss && bossStatus === 'active' && (...)}` live HP block, add:

```jsx
        {bossStarted && bossStatus === 'active' && (
          <button
            style={{
              ...styles.bossStopBtn,
              ...(bossStopping ? styles.bossStopBtnDisabled : {}),
            }}
            onClick={handleBossStop}
            disabled={bossStopping}
          >
            {bossStopping ? 'STOPPING...' : 'STOP BOSS FIGHT'}
          </button>
        )}
```

- [ ] **Step 4: Add styles**

In the `styles` object at the bottom of `AdminDashboard.jsx`, add after `liveBossInfo`:

```js
  bossStopBtn: {
    width: '100%',
    marginTop: '10px',
    padding: '14px',
    fontSize: '16px',
    fontWeight: '700',
    letterSpacing: '1px',
    background: '#1a0000',
    border: '2px solid #7f1d1d',
    borderRadius: '12px',
    color: '#f87171',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  bossStopBtnDisabled: {
    background: '#1f2937',
    border: '2px solid #374151',
    color: '#6b7280',
    cursor: 'not-allowed',
  },
```

- [ ] **Step 5: Manual verification**

1. Start the boss fight via admin panel
2. Verify "STOP BOSS FIGHT" button appears below the live HP bar
3. Click it, confirm the dialog
4. Expected: button shows "STOPPING...", then disappears; dashboard refreshes showing idle boss; all connected players navigate to `/plaza`

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/AdminDashboard.jsx
git commit -m "feat: add Stop Boss Fight button to admin dashboard"
```

---

## Task 6: Deploy

- [ ] **Step 1: Run full backend test suite**

```bash
cd backend && pytest -v
```

Expected: all tests PASS.

- [ ] **Step 2: Deploy infra + backend**

```bash
cd infra && npx cdk deploy
```

- [ ] **Step 3: Build frontend with updated env vars**

After CDK outputs new URLs (if any changed):

```bash
cd frontend && npm run build
```

- [ ] **Step 4: End-to-end smoke test**

1. Open app on two devices (player + admin)
2. Admin: trigger buildup phases 1→2→3, start boss
3. Player device: verify redirected to `/boss` immediately
4. Player: try navigating to `/dinos` — verify bounced back to `/boss`
5. Admin: open `/#admin` — verify admin panel is accessible (not redirected)
6. Admin: click "STOP BOSS FIGHT" and confirm
7. Player device: verify navigates to `/plaza`, can now freely navigate
8. Admin: start boss again, let player tap to defeat it
9. Verify all players receive Kaiju Slayer hat (check Profile → dino detail)

- [ ] **Step 5: Final commit**

```bash
git add .
git commit -m "chore: deploy boss stop and active-fight redirect"
```
