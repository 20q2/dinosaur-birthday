# Boss Stop & Active-Fight Redirect — Design Spec

**Date:** 2026-03-28

## Summary

Two related features:
1. Admin button to fully reset the boss fight back to idle at any time.
2. Hard-lock all normal players to `/boss` while a fight is active; redirect on every navigation attempt.
3. Fix: award Kaiju Slayer hat to **all players** on boss defeat (not just the killing blow player).

---

## Backend Changes

### A. `POST /admin/boss/stop` — new endpoint in `backend/src/handlers/admin.py`

New `stop_handler()`:
- Overwrites `BOSS#STATE` with `{ status: 'idle', buildup_phase: 0, hp: 0, max_hp: 0 }`
- Broadcasts `boss_stopped` on both `all` and `boss` WebSocket channels
- Posts feed entry of type `boss_stop`: *"The boss fight has been called off. The city is safe... for now."*
- Registered in `handler()` router: `POST` path ending in `/boss/stop`

### B. Award Kaiju Slayer hat to all players on defeat — `backend/src/handlers/boss.py`

Replace `_award_kaiju_slayer_hat(player_id)` (single player) with `_award_kaiju_slayer_hat_all()`:
- Scan all `PROFILE` records to get every player ID
- For each player: find their partner dino (first dino where `is_partner=True` or `tamed=True`), update `hat = 'kaiju_slayer'`
- Called from the defeat branch in `tap_handler` when `new_hp <= 0`
- Best-effort (wrapped in try/except per-player so one failure doesn't block others)

### C. Infra — `infra/lib/dino-party-stack.ts`

Add `POST /admin/boss/stop` route wired to the admin Lambda, consistent with existing `/admin/boss/start` and `/admin/boss/buildup` route patterns.

---

## Frontend Changes

### D. Fetch boss state on startup — `frontend/src/store.js`

In `store.init()`, after the player profile loads (or in parallel), call `api.getBossState()` and set `store.bossState` from the result. This ensures fresh page loads are aware of an in-progress fight.

### E. Hard-lock redirect in `App` — `frontend/src/app.jsx`

**Redirect effect:**
```js
useEffect(() => {
  if (bossState?.status === 'active' && route !== '/boss' && route !== '/admin') {
    store.navigate('/boss');
  }
}, [bossState, route]);
```
- Fires on every route change and every bossState update
- Admin panel (`/admin`) is exempt — host must be able to stop the fight
- No other routes are exempt

**`boss_stopped` WebSocket handler** (added alongside existing `boss_start`/`boss_defeated` handlers):
```js
ws.on('boss', 'boss_stopped', () => {
  store.setBossState({ status: 'idle' });
  store.navigate('/plaza');
});
```

### F. `api.adminBossStop()` — `frontend/src/api.js`

```js
adminBossStop: () => request('POST', '/admin/boss/stop'),
```

### G. Stop button in Admin UI — `frontend/src/components/AdminDashboard.jsx`

In the existing "Boss Fight Control" section:

- New `handleBossStop()` async function:
  - `confirm()` dialog: *"Stop the boss fight? This will reset everything and send all players back to the plaza."*
  - Calls `api.adminBossStop()`
  - On success: resets `bossStarted = false`, refreshes dashboard
  - Loading state: `bossStoppping` boolean (button shows "STOPPING...")
  - Error: `alert()`

- Button visibility: shown only when `bossStarted && bossStatus === 'active'`
- Style: destructive — dark red border, grey fill (distinct from the green "active" disabled state)
- Placed directly below the existing boss start button / live HP display

---

## Data Flow Summary

```
Admin taps "STOP BOSS FIGHT"
  → confirm() dialog
  → POST /admin/boss/stop
    → BOSS#STATE overwritten: status=idle
    → broadcast boss_stopped (all + boss channels)
    → feed entry posted
  → admin UI resets bossStarted=false, refreshes dashboard

All connected clients receive boss_stopped WS event
  → store.bossState = { status: 'idle' }
  → store.navigate('/plaza')

Future page loads while boss is idle
  → store.init() fetches /boss/state → status=idle → no redirect

Future page loads while boss is active
  → store.init() fetches /boss/state → status=active
  → App useEffect fires → store.navigate('/boss')

Player tries to navigate away during active fight
  → route changes → useEffect fires → store.navigate('/boss') immediately
  → /admin is exempt
```

---

## Non-Goals

- No partial credit or XP awarded when boss is stopped early
- No confirmation broadcast to players that the fight was stopped (just the feed entry + navigation)
- No protection against admin accidentally double-tapping stop (idempotent — stopping idle is harmless since handler overwrites regardless)
