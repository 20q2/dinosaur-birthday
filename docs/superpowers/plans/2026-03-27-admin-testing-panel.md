# Admin Testing Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand the admin panel into a tabbed testing tool with QR code links, player simulator, bot spawning, and data reset capabilities.

**Architecture:** Refactor the existing monolithic AdminPanel.jsx into a tab shell that renders 5 tab components (Dashboard, QR Codes, Simulator, Bots, Reset). Add two new backend endpoints for data reset. All new frontend components are pure admin UI — no changes to player-facing screens.

**Tech Stack:** Preact (frontend), Python 3.12 Lambda (backend), DynamoDB, existing api.js REST client

---

## File Structure

**New files:**
- `frontend/src/components/AdminDashboard.jsx` — extracted from current AdminPanel (stats, boss controls, announcements, player list)
- `frontend/src/components/AdminQRCodes.jsx` — clickable scan URL grid
- `frontend/src/components/AdminSimulator.jsx` — player selector + API action caller
- `frontend/src/components/AdminBots.jsx` — bot spawner and controller
- `frontend/src/components/AdminReset.jsx` — per-player and full game reset
- `backend/tests/test_admin_reset.py` — tests for reset endpoints

**Modified files:**
- `frontend/src/components/AdminPanel.jsx` — gutted and replaced with tab shell
- `frontend/src/api.js` — add resetPlayer, resetAll methods
- `backend/src/handlers/admin.py` — add reset_player_handler, reset_all_handler, route DELETE methods
- `backend/template.yaml` — add DELETE method events to AdminFunction, update CORS to allow DELETE

---

### Task 1: Backend Reset Endpoints + Tests

**Files:**
- Modify: `backend/src/handlers/admin.py`
- Create: `backend/tests/test_admin_reset.py`

- [ ] **Step 1: Write tests for reset_player_handler**

Create `backend/tests/test_admin_reset.py`:
```python
import json
import pytest
from backend.src.handlers.admin import handler
from backend.src.shared.db import put_item, get_item, query_pk


def _make_event(method, path, body=None, query=None):
    event = {
        "httpMethod": method,
        "resource": path,
        "path": path,
        "body": json.dumps(body) if body else None,
        "queryStringParameters": query or {},
    }
    return event


def _create_player(player_id, name="TestPlayer"):
    """Create a player with profile, dino, item, note, inspiration, and plaza entry."""
    put_item({"PK": f"PLAYER#{player_id}", "SK": "PROFILE", "name": name})
    put_item({"PK": f"PLAYER#{player_id}", "SK": "DINO#trex", "tamed": True, "name": "Rex", "xp": 50, "level": 1, "colors": {}, "gender": "M", "nature": "Brave", "hat": "", "is_partner": True, "shiny": False})
    put_item({"PK": f"PLAYER#{player_id}", "SK": "ITEM#party_hat", "type": "hat", "name": "Party Hat", "details": {}})
    put_item({"PK": f"PLAYER#{player_id}", "SK": "NOTE#1"})
    put_item({"PK": f"PLAYER#{player_id}", "SK": "INSPIRATION"})
    put_item({"PK": "PLAZA", "SK": f"PARTNER#{player_id}", "species": "trex", "name": "Rex"})
    put_item({"PK": "COOLDOWN", "SK": f"COOLDOWN#{player_id}#other_player"})


def test_reset_player_removes_game_data():
    player_id = "reset-test-1"
    _create_player(player_id)

    resp = handler(_make_event("DELETE", "/admin/reset", query={"player_id": player_id}), None)
    body = json.loads(resp["body"])

    assert resp["statusCode"] == 200
    assert body["deleted"] >= 5  # dino, item, note, inspiration, cooldown, plaza

    # Profile should still exist
    profile = get_item(f"PLAYER#{player_id}", "PROFILE")
    assert profile is not None
    assert profile["name"] == "TestPlayer"

    # Game data should be gone
    assert get_item(f"PLAYER#{player_id}", "DINO#trex") is None
    assert get_item(f"PLAYER#{player_id}", "ITEM#party_hat") is None
    assert get_item(f"PLAYER#{player_id}", "NOTE#1") is None
    assert get_item(f"PLAYER#{player_id}", "INSPIRATION") is None
    assert get_item("PLAZA", f"PARTNER#{player_id}") is None


def test_reset_player_requires_player_id():
    resp = handler(_make_event("DELETE", "/admin/reset", query={}), None)
    assert resp["statusCode"] == 400


def test_reset_player_nonexistent_player():
    resp = handler(_make_event("DELETE", "/admin/reset", query={"player_id": "no-such-player"}), None)
    body = json.loads(resp["body"])
    assert resp["statusCode"] == 200
    assert body["deleted"] == 0


def test_reset_all_removes_everything_except_profiles():
    # Create two players with game data
    _create_player("all-test-1", "Alice")
    _create_player("all-test-2", "Bob")
    put_item({"PK": "FEED", "SK": "2026-01-01T00:00:00#abc"})
    put_item({"PK": "BOSS", "SK": "STATE", "hp": 100, "max_hp": 100, "status": "active"})

    resp = handler(_make_event("DELETE", "/admin/reset-all"), None)
    body = json.loads(resp["body"])

    assert resp["statusCode"] == 200
    assert body["deleted"] >= 10

    # Profiles should still exist
    assert get_item("PLAYER#all-test-1", "PROFILE") is not None
    assert get_item("PLAYER#all-test-2", "PROFILE") is not None

    # Game data should be gone
    assert get_item("PLAYER#all-test-1", "DINO#trex") is None
    assert get_item("PLAYER#all-test-2", "DINO#trex") is None
    assert get_item("BOSS", "STATE") is None
    assert get_item("FEED", "2026-01-01T00:00:00#abc") is None
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `python -m pytest backend/tests/test_admin_reset.py -v`
Expected: FAIL (reset handlers don't exist yet)

- [ ] **Step 3: Implement reset handlers in admin.py**

Add these functions to `backend/src/handlers/admin.py` before the `handler()` function:

```python
def reset_player_handler(event, context):
    """DELETE /admin/reset?player_id=X — Wipe a player's game data (keep profile)."""
    params = event.get("queryStringParameters") or {}
    player_id = params.get("player_id", "")

    if not player_id:
        return error("player_id query parameter is required")

    deleted = 0
    table = get_table()

    # Delete all player items except PROFILE
    player_items = query_pk(f"PLAYER#{player_id}")
    for item in player_items:
        if item["SK"] != "PROFILE":
            table.delete_item(Key={"PK": item["PK"], "SK": item["SK"]})
            deleted += 1

    # Delete plaza entry
    plaza_item = get_item("PLAZA", f"PARTNER#{player_id}")
    if plaza_item:
        table.delete_item(Key={"PK": "PLAZA", "SK": f"PARTNER#{player_id}"})
        deleted += 1

    # Delete cooldowns containing this player
    cooldown_items = query_pk("COOLDOWN")
    for item in cooldown_items:
        if player_id in item["SK"]:
            table.delete_item(Key={"PK": item["PK"], "SK": item["SK"]})
            deleted += 1

    return success({"player_id": player_id, "deleted": deleted})


def reset_all_handler(event, context):
    """DELETE /admin/reset-all — Wipe all game data (keep profiles)."""
    table = get_table()
    deleted = 0

    # Scan entire table
    scan_kwargs = {}
    while True:
        resp = table.scan(**scan_kwargs)
        items = resp.get("Items", [])

        # Batch delete everything except PROFILE items
        with table.batch_writer() as batch:
            for item in items:
                if item.get("SK") == "PROFILE":
                    continue
                batch.delete_item(Key={"PK": item["PK"], "SK": item["SK"]})
                deleted += 1

        # Handle pagination
        if "LastEvaluatedKey" in resp:
            scan_kwargs["ExclusiveStartKey"] = resp["LastEvaluatedKey"]
        else:
            break

    return success({"deleted": deleted})
```

Also update the `handler()` routing function to add DELETE method handling:

```python
def handler(event, context):
    """Route admin endpoints."""
    path = event.get("resource", event.get("path", ""))
    method = event.get("httpMethod", "")

    if method == "POST":
        if path.endswith("/boss/buildup"):
            return buildup_handler(event, context)
        if path.endswith("/boss/start"):
            return start_handler(event, context)
        if path.endswith("/announce"):
            return announce_handler(event, context)

    if method == "GET":
        if path.endswith("/dashboard"):
            return dashboard_handler(event, context)

    if method == "DELETE":
        if path.endswith("/reset-all"):
            return reset_all_handler(event, context)
        if path.endswith("/reset"):
            return reset_player_handler(event, context)

    return error("Not found", 404)
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `python -m pytest backend/tests/test_admin_reset.py -v`
Expected: ALL PASS

Also run: `python -m pytest backend/tests/ -v`
Expected: ALL PASS (no regressions)

- [ ] **Step 5: Commit**

```bash
git add backend/src/handlers/admin.py backend/tests/test_admin_reset.py
git commit -m "feat: add admin reset endpoints - per-player and full game wipe"
```

---

### Task 2: SAM Template + API Client Updates

**Files:**
- Modify: `backend/template.yaml`
- Modify: `frontend/src/api.js`

- [ ] **Step 1: Update SAM template CORS and add DELETE events**

In `backend/template.yaml`, update the RestApi CORS to allow DELETE:

Change:
```yaml
      Cors:
        AllowOrigin: "'*'"
        AllowMethods: "'GET,POST,PUT,OPTIONS'"
        AllowHeaders: "'Content-Type'"
```
To:
```yaml
      Cors:
        AllowOrigin: "'*'"
        AllowMethods: "'GET,POST,PUT,DELETE,OPTIONS'"
        AllowHeaders: "'Content-Type'"
```

Add two new events to the AdminFunction resource, after the Dashboard event:

```yaml
        ResetPlayer:
          Type: Api
          Properties:
            RestApiId: !Ref RestApi
            Path: /admin/reset
            Method: DELETE
        ResetAll:
          Type: Api
          Properties:
            RestApiId: !Ref RestApi
            Path: /admin/reset-all
            Method: DELETE
```

- [ ] **Step 2: Add API client methods**

Add to the end of the `api` object in `frontend/src/api.js` (before the closing `};`):

```javascript
  resetPlayer: (playerId) =>
    request('DELETE', `/admin/reset?player_id=${encodeURIComponent(playerId)}`),

  resetAll: () =>
    request('DELETE', '/admin/reset-all'),
```

- [ ] **Step 3: Commit**

```bash
git add backend/template.yaml frontend/src/api.js
git commit -m "feat: SAM template + API client updates for admin reset endpoints"
```

---

### Task 3: Admin Tab Shell + Extract Dashboard

**Files:**
- Modify: `frontend/src/components/AdminPanel.jsx`
- Create: `frontend/src/components/AdminDashboard.jsx`

- [ ] **Step 1: Create AdminDashboard.jsx**

Extract the entire current AdminPanel content into `frontend/src/components/AdminDashboard.jsx`. This is a direct move — no behavior changes. The file should contain:

- All the state variables (dashboard, buildup, boss, announce)
- All the handler functions (fetchDashboard, handleBuildup, handleBossStart, handleAnnounce)
- The full render JSX (all Section components)
- The Section and StatCard sub-components
- The entire styles object
- The BUILDUP_PHASES constant

The only change: rename the export from `AdminPanel` to `AdminDashboard`:

```jsx
import { useEffect, useRef, useState } from 'preact/hooks';
import { api } from '../api.js';

const BUILDUP_PHASES = [
  { phase: 1, label: 'Shadows', icon: '🌑', description: 'Shadows creep over the plaza' },
  { phase: 2, label: 'Tremors', icon: '🌍', description: 'The ground starts shaking' },
  { phase: 3, label: 'Roar',    icon: '🔊', description: 'A deafening roar echoes out' },
];

export function AdminDashboard() {
  // ... exact same content as current AdminPanel function body ...
}

// ... exact same Section, StatCard sub-components ...

// ... exact same styles object ...
```

Copy the entire AdminPanel.jsx contents, change only the function name to `AdminDashboard`.

- [ ] **Step 2: Rewrite AdminPanel.jsx as tab shell**

Replace `frontend/src/components/AdminPanel.jsx` with the tab shell:

```jsx
import { useState } from 'preact/hooks';
import { AdminDashboard } from './AdminDashboard.jsx';
import { AdminQRCodes } from './AdminQRCodes.jsx';
import { AdminSimulator } from './AdminSimulator.jsx';
import { AdminBots } from './AdminBots.jsx';
import { AdminReset } from './AdminReset.jsx';

const TABS = [
  { id: 'dashboard',  label: 'Dashboard', icon: '📊' },
  { id: 'qrcodes',    label: 'QR Codes',  icon: '📱' },
  { id: 'simulator',  label: 'Simulator', icon: '🎮' },
  { id: 'bots',       label: 'Bots',      icon: '🤖' },
  { id: 'reset',      label: 'Reset',     icon: '🗑️' },
];

const TAB_COMPONENTS = {
  dashboard: AdminDashboard,
  qrcodes: AdminQRCodes,
  simulator: AdminSimulator,
  bots: AdminBots,
  reset: AdminReset,
};

export function AdminPanel() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const TabContent = TAB_COMPONENTS[activeTab];

  return (
    <div style={styles.page}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerTitle}>ADMIN PANEL</div>
        <div style={styles.headerSub}>Party Host Controls</div>
      </div>

      {/* Tab bar */}
      <div style={styles.tabBar}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            style={{
              ...styles.tab,
              ...(activeTab === tab.id ? styles.tabActive : {}),
            }}
            onClick={() => setActiveTab(tab.id)}
          >
            <span style={styles.tabIcon}>{tab.icon}</span>
            <span style={styles.tabLabel}>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={styles.tabContent}>
        <TabContent />
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100dvh',
    background: '#0a0a0a',
    color: '#f0f0f0',
    display: 'flex',
    flexDirection: 'column',
    overflowX: 'hidden',
  },
  header: {
    background: 'linear-gradient(135deg, #1a0000 0%, #3d0000 100%)',
    padding: '20px 16px 16px',
    borderBottom: '2px solid #7f1d1d',
    flexShrink: 0,
  },
  headerTitle: {
    fontSize: '26px',
    fontWeight: '900',
    color: '#ef4444',
    letterSpacing: '3px',
    textShadow: '0 0 20px rgba(239,68,68,0.5)',
  },
  headerSub: {
    fontSize: '13px',
    color: '#fca5a5',
    marginTop: '3px',
  },
  tabBar: {
    display: 'flex',
    background: '#111',
    borderBottom: '1px solid #333',
    overflowX: 'auto',
    flexShrink: 0,
  },
  tab: {
    flex: '1 1 0',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '2px',
    padding: '10px 4px 8px',
    background: 'none',
    border: 'none',
    borderBottom: '3px solid transparent',
    color: '#888',
    cursor: 'pointer',
    minWidth: '60px',
    fontSize: '12px',
  },
  tabActive: {
    color: '#fff',
    borderBottomColor: '#6366f1',
  },
  tabIcon: {
    fontSize: '18px',
  },
  tabLabel: {
    fontSize: '10px',
    whiteSpace: 'nowrap',
  },
  tabContent: {
    flex: 1,
    overflow: 'auto',
  },
};
```

- [ ] **Step 3: Create placeholder files for remaining tabs**

Create minimal placeholder components so the tab shell works immediately:

`frontend/src/components/AdminQRCodes.jsx`:
```jsx
export function AdminQRCodes() {
  return <div style={{ padding: '20px', color: '#888' }}>QR Codes tab — coming soon</div>;
}
```

`frontend/src/components/AdminSimulator.jsx`:
```jsx
export function AdminSimulator() {
  return <div style={{ padding: '20px', color: '#888' }}>Simulator tab — coming soon</div>;
}
```

`frontend/src/components/AdminBots.jsx`:
```jsx
export function AdminBots() {
  return <div style={{ padding: '20px', color: '#888' }}>Bots tab — coming soon</div>;
}
```

`frontend/src/components/AdminReset.jsx`:
```jsx
export function AdminReset() {
  return <div style={{ padding: '20px', color: '#888' }}>Reset tab — coming soon</div>;
}
```

- [ ] **Step 4: Verify the frontend builds**

Run: `cd frontend && npx vite build`
Expected: Build succeeds

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/AdminPanel.jsx frontend/src/components/AdminDashboard.jsx frontend/src/components/AdminQRCodes.jsx frontend/src/components/AdminSimulator.jsx frontend/src/components/AdminBots.jsx frontend/src/components/AdminReset.jsx
git commit -m "feat: refactor admin panel into tabbed interface, extract dashboard"
```

---

### Task 4: QR Codes Tab

**Files:**
- Modify: `frontend/src/components/AdminQRCodes.jsx`

- [ ] **Step 1: Implement AdminQRCodes.jsx**

Replace the placeholder with the full implementation:

```jsx
import { store } from '../store.js';

const QR_GROUPS = [
  {
    title: 'Dinos',
    color: '#f59e0b',
    items: [
      { label: 'T-Rex', route: '/scan/dino/trex', sub: 'Carnivore', subColor: '#ef4444' },
      { label: 'Spinosaurus', route: '/scan/dino/spinosaurus', sub: 'Carnivore', subColor: '#ef4444' },
      { label: 'Dilophosaurus', route: '/scan/dino/dilophosaurus', sub: 'Carnivore', subColor: '#ef4444' },
      { label: 'Pachycephalosaurus', route: '/scan/dino/pachycephalosaurus', sub: 'Herbivore', subColor: '#22c55e' },
      { label: 'Parasaurolophus', route: '/scan/dino/parasaurolophus', sub: 'Herbivore', subColor: '#22c55e' },
      { label: 'Stegosaurus', route: '/scan/dino/stegosaurus', sub: 'Herbivore', subColor: '#22c55e' },
      { label: 'Triceratops', route: '/scan/dino/triceratops', sub: 'Herbivore', subColor: '#22c55e' },
    ],
  },
  {
    title: 'Food',
    color: '#22c55e',
    items: [
      { label: 'Meat', route: '/scan/food/meat', sub: 'FOOD', subColor: '#ef4444' },
      { label: 'Mejoberries', route: '/scan/food/mejoberries', sub: 'FOOD', subColor: '#22c55e' },
    ],
  },
  {
    title: 'Events',
    color: '#6366f1',
    items: [
      { label: 'Cooking Pot', route: '/scan/event/cooking_pot', sub: 'EVENT', subColor: '#6366f1' },
      { label: 'Dance Floor', route: '/scan/event/dance_floor', sub: 'EVENT', subColor: '#6366f1' },
      { label: 'Photo Booth', route: '/scan/event/photo_booth', sub: 'EVENT', subColor: '#6366f1' },
      { label: 'Cake Table', route: '/scan/event/cake_table', sub: 'EVENT', subColor: '#6366f1' },
      { label: 'Mystery Chest', route: '/scan/event/mystery_chest', sub: 'EVENT', subColor: '#6366f1' },
    ],
  },
  {
    title: 'Special',
    color: '#f59e0b',
    items: [
      { label: "Alex's Inspiration", route: '/scan/inspiration', sub: 'SPECIAL', subColor: '#f59e0b' },
    ],
  },
  {
    title: 'Explorer Notes',
    color: '#888',
    items: [
      { label: 'Note #1', route: '/scan/note/1', sub: 'NOTE', subColor: '#888' },
      { label: 'Note #2', route: '/scan/note/2', sub: 'NOTE', subColor: '#888' },
      { label: 'Note #3', route: '/scan/note/3', sub: 'NOTE', subColor: '#888' },
      { label: 'Note #4', route: '/scan/note/4', sub: 'NOTE', subColor: '#888' },
      { label: 'Note #5', route: '/scan/note/5', sub: 'NOTE', subColor: '#888' },
    ],
  },
];

export function AdminQRCodes() {
  return (
    <div style={styles.container}>
      <p style={styles.desc}>Click any button to navigate to that scan route as the current player.</p>
      {QR_GROUPS.map(group => (
        <div key={group.title} style={styles.group}>
          <h3 style={{ ...styles.groupTitle, color: group.color }}>{group.title}</h3>
          <div style={styles.grid}>
            {group.items.map(item => (
              <button
                key={item.route}
                style={styles.qrBtn}
                onClick={() => store.navigate(item.route)}
              >
                <span style={styles.qrLabel}>{item.label}</span>
                <span style={{ ...styles.qrSub, color: item.subColor }}>{item.sub}</span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

const styles = {
  container: {
    padding: '16px',
  },
  desc: {
    margin: '0 0 16px',
    fontSize: '13px',
    color: '#9ca3af',
  },
  group: {
    marginBottom: '20px',
  },
  groupTitle: {
    margin: '0 0 8px',
    fontSize: '14px',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: '1px',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
    gap: '8px',
  },
  qrBtn: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px',
    padding: '14px 8px',
    background: '#111',
    border: '1px solid #333',
    borderRadius: '10px',
    color: '#f0f0f0',
    cursor: 'pointer',
  },
  qrLabel: {
    fontSize: '13px',
    fontWeight: '600',
    textAlign: 'center',
  },
  qrSub: {
    fontSize: '10px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
};
```

- [ ] **Step 2: Verify build**

Run: `cd frontend && npx vite build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/AdminQRCodes.jsx
git commit -m "feat: admin QR codes tab with all 20 scan routes"
```

---

### Task 5: Simulator Tab

**Files:**
- Modify: `frontend/src/components/AdminSimulator.jsx`

- [ ] **Step 1: Implement AdminSimulator.jsx**

Replace the placeholder with the full implementation:

```jsx
import { useState, useEffect } from 'preact/hooks';
import { api } from '../api.js';
import { HATS } from '../data/hats.js';
import { generateId } from '../utils/uuid.js';

const SPECIES = ['trex', 'spinosaurus', 'dilophosaurus', 'pachycephalosaurus', 'parasaurolophus', 'stegosaurus', 'triceratops'];
const SPECIES_NAMES = { trex: 'T-Rex', spinosaurus: 'Spinosaurus', dilophosaurus: 'Dilophosaurus', pachycephalosaurus: 'Pachycephalosaurus', parasaurolophus: 'Parasaurolophus', stegosaurus: 'Stegosaurus', triceratops: 'Triceratops' };
const FOOD_TYPES = ['meat', 'mejoberries'];
const EVENT_TYPES = ['cooking_pot', 'dance_floor', 'photo_booth', 'cake_table', 'mystery_chest'];

export function AdminSimulator() {
  const [players, setPlayers] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [playerData, setPlayerData] = useState(null);
  const [testCount, setTestCount] = useState(1);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  // Form states
  const [scanSpecies, setScanSpecies] = useState(SPECIES[0]);
  const [foodType, setFoodType] = useState(FOOD_TYPES[0]);
  const [foodSpecies, setFoodSpecies] = useState('');
  const [customSpecies, setCustomSpecies] = useState('');
  const [customName, setCustomName] = useState('');
  const [customHat, setCustomHat] = useState('');
  const [customPartner, setCustomPartner] = useState(false);
  const [lobbyCode, setLobbyCode] = useState('');
  const [triviaState, setTriviaState] = useState(null);
  const [eventType, setEventType] = useState(EVENT_TYPES[0]);
  const [noteId, setNoteId] = useState('1');

  useEffect(() => { loadPlayers(); }, []);

  async function loadPlayers() {
    try {
      const data = await api.adminDashboard();
      setPlayers(data.player_list || []);
    } catch {}
  }

  async function createTestPlayer() {
    const id = generateId();
    const name = `TestPlayer-${testCount}`;
    setTestCount(c => c + 1);
    try {
      await api.createPlayer(id, name, '');
      await loadPlayers();
      setSelectedId(id);
      setResult({ ok: true, data: { created: name, id } });
    } catch (err) {
      setResult({ ok: false, data: err.message });
    }
  }

  async function refreshPlayer() {
    if (!selectedId) return;
    try {
      const data = await api.getPlayer(selectedId);
      setPlayerData(data);
      setResult({ ok: true, data });
    } catch (err) {
      setResult({ ok: false, data: err.message });
    }
  }

  useEffect(() => {
    if (selectedId) refreshPlayer();
    else setPlayerData(null);
  }, [selectedId]);

  async function run(fn) {
    setLoading(true);
    setResult(null);
    try {
      const data = await fn();
      setResult({ ok: true, data });
      refreshPlayer();
    } catch (err) {
      setResult({ ok: false, data: err.message });
    }
    setLoading(false);
  }

  const pid = selectedId;
  const tamedDinos = (playerData?.dinos || []).filter(d => d.tamed);

  return (
    <div style={styles.container}>
      {/* Player selector */}
      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>Player</h3>
        <div style={styles.row}>
          <select style={styles.select} value={selectedId} onChange={e => setSelectedId(e.target.value)}>
            <option value="">-- Select player --</option>
            {players.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <button style={styles.btn} onClick={createTestPlayer}>Create Test Player</button>
          <button style={styles.btnSmall} onClick={refreshPlayer} disabled={!pid}>Refresh</button>
        </div>
        {playerData && (
          <div style={styles.statsRow}>
            <span>{playerData.name}</span>
            <span>Dinos: {tamedDinos.length}</span>
            <span>Items: {(playerData.items || []).length}</span>
            <span>Notes: {(playerData.notes || []).length}/5</span>
            <span>{playerData.inspiration ? 'Inspired' : ''}</span>
          </div>
        )}
      </div>

      {pid && (
        <>
          {/* Scan Dino */}
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>Scan Dino</h3>
            <div style={styles.row}>
              <select style={styles.select} value={scanSpecies} onChange={e => setScanSpecies(e.target.value)}>
                {SPECIES.map(s => <option key={s} value={s}>{SPECIES_NAMES[s]}</option>)}
              </select>
              <button style={styles.btn} onClick={() => run(() => api.scanDino(pid, scanSpecies))} disabled={loading}>Encounter</button>
            </div>
          </div>

          {/* Tame Dino */}
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>Tame Dino</h3>
            <div style={styles.row}>
              <select style={styles.select} value={foodType} onChange={e => setFoodType(e.target.value)}>
                {FOOD_TYPES.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
              <input style={styles.input} placeholder="species (optional)" value={foodSpecies} onInput={e => setFoodSpecies(e.target.value)} />
              <button style={styles.btn} onClick={() => run(() => api.scanFood(pid, foodType, foodSpecies || null))} disabled={loading}>Feed</button>
            </div>
          </div>

          {/* Customize Dino */}
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>Customize Dino</h3>
            <div style={styles.row}>
              <select style={styles.select} value={customSpecies} onChange={e => setCustomSpecies(e.target.value)}>
                <option value="">-- Select dino --</option>
                {tamedDinos.map(d => <option key={d.species} value={d.species}>{d.name || SPECIES_NAMES[d.species]}</option>)}
              </select>
              <input style={styles.input} placeholder="Name" value={customName} onInput={e => setCustomName(e.target.value)} />
            </div>
            <div style={styles.row}>
              <select style={styles.select} value={customHat} onChange={e => setCustomHat(e.target.value)}>
                <option value="">-- Hat --</option>
                {HATS.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
              </select>
              <label style={styles.checkLabel}>
                <input type="checkbox" checked={customPartner} onChange={e => setCustomPartner(e.target.checked)} />
                Partner
              </label>
              <button style={styles.btn} onClick={() => run(async () => {
                const updates = {};
                if (customName.trim()) updates.name = customName.trim();
                if (customHat) updates.hat = customHat;
                let res = {};
                if (Object.keys(updates).length > 0) {
                  res = await api.customizeDino(pid, customSpecies, updates);
                }
                if (customPartner) {
                  res = await api.setPartner(pid, customSpecies);
                }
                return res;
              })} disabled={loading || !customSpecies}>Save</button>
            </div>
          </div>

          {/* Social Play */}
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>Social Play</h3>
            <div style={styles.row}>
              <button style={styles.btn} onClick={() => run(() => api.createLobby(pid))} disabled={loading}>Create Lobby</button>
              <input style={styles.input} placeholder="Lobby code" value={lobbyCode} onInput={e => setLobbyCode(e.target.value)} />
              <button style={styles.btn} onClick={() => run(async () => {
                const res = await api.joinLobby(pid, lobbyCode);
                if (res.trivia) setTriviaState({ code: lobbyCode, ...res.trivia });
                return res;
              })} disabled={loading || !lobbyCode}>Join</button>
            </div>
            {triviaState && (
              <div style={styles.triviaBox}>
                <p style={{ margin: '0 0 8px', fontWeight: '600' }}>{triviaState.question}</p>
                {triviaState.options.map((opt, i) => (
                  <button key={i} style={styles.triviaBtn} onClick={() => {
                    run(() => api.answerTrivia(pid, triviaState.code, i));
                    setTriviaState(null);
                  }}>{opt}</button>
                ))}
              </div>
            )}
          </div>

          {/* Scan Event */}
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>Scan Event</h3>
            <div style={styles.row}>
              <select style={styles.select} value={eventType} onChange={e => setEventType(e.target.value)}>
                {EVENT_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
              </select>
              <button style={styles.btn} onClick={() => run(() => api.scanEvent(pid, eventType, ''))} disabled={loading}>Claim</button>
            </div>
          </div>

          {/* Scan Inspiration */}
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>Scan Inspiration</h3>
            <button style={styles.btn} onClick={() => run(() => api.scanInspiration(pid))} disabled={loading}>Claim Inspiration</button>
          </div>

          {/* Scan Note */}
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>Scan Note</h3>
            <div style={styles.row}>
              <select style={styles.select} value={noteId} onChange={e => setNoteId(e.target.value)}>
                {[1,2,3,4,5].map(n => <option key={n} value={String(n)}>Note #{n}</option>)}
              </select>
              <button style={styles.btn} onClick={() => run(() => api.scanNote(pid, noteId))} disabled={loading}>Read Note</button>
            </div>
          </div>

          {/* Boss Tap */}
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>Boss Tap</h3>
            <button style={styles.btn} onClick={() => run(() => api.bossTap(pid))} disabled={loading}>Tap Boss</button>
          </div>
        </>
      )}

      {/* Result display */}
      {result && (
        <div style={{ ...styles.resultBox, borderColor: result.ok ? '#22c55e' : '#ef4444' }}>
          <pre style={styles.resultPre}>{JSON.stringify(result.data, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: { padding: '16px' },
  section: { marginBottom: '16px', padding: '12px', background: '#111', borderRadius: '10px', border: '1px solid #222' },
  sectionTitle: { margin: '0 0 8px', fontSize: '14px', fontWeight: '700', color: '#e5e7eb' },
  row: { display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '6px' },
  select: { flex: '1 1 120px', padding: '8px', background: '#1f2937', border: '1px solid #374151', borderRadius: '6px', color: '#f0f0f0', fontSize: '13px' },
  input: { flex: '1 1 100px', padding: '8px', background: '#1f2937', border: '1px solid #374151', borderRadius: '6px', color: '#f0f0f0', fontSize: '13px' },
  btn: { padding: '8px 14px', background: '#6366f1', border: 'none', borderRadius: '6px', color: '#fff', fontWeight: '600', fontSize: '13px', cursor: 'pointer', whiteSpace: 'nowrap' },
  btnSmall: { padding: '8px 10px', background: '#374151', border: 'none', borderRadius: '6px', color: '#ccc', fontSize: '12px', cursor: 'pointer' },
  checkLabel: { display: 'flex', alignItems: 'center', gap: '4px', color: '#ccc', fontSize: '13px' },
  statsRow: { display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '8px', fontSize: '12px', color: '#9ca3af' },
  triviaBox: { marginTop: '10px', padding: '10px', background: '#1a1a2e', borderRadius: '8px' },
  triviaBtn: { display: 'block', width: '100%', padding: '8px', marginTop: '4px', background: '#374151', border: '1px solid #4b5563', borderRadius: '6px', color: '#f0f0f0', cursor: 'pointer', textAlign: 'left', fontSize: '13px' },
  resultBox: { position: 'sticky', bottom: '10px', margin: '16px 0', padding: '12px', background: '#0a0a0a', border: '2px solid', borderRadius: '10px', maxHeight: '200px', overflow: 'auto' },
  resultPre: { margin: 0, fontSize: '11px', color: '#d1d5db', fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-word' },
};
```

- [ ] **Step 2: Verify build**

Run: `cd frontend && npx vite build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/AdminSimulator.jsx
git commit -m "feat: admin simulator tab - full player journey testing"
```

---

### Task 6: Bots Tab

**Files:**
- Modify: `frontend/src/components/AdminBots.jsx`

- [ ] **Step 1: Implement AdminBots.jsx**

Replace the placeholder with the full implementation:

```jsx
import { useState } from 'preact/hooks';
import { api } from '../api.js';
import { generateId } from '../utils/uuid.js';

const BOT_NAMES = ['Rex', 'Stego', 'Trike', 'Spino', 'Pachy', 'Para', 'Dilo'];
const SPECIES = ['trex', 'spinosaurus', 'dilophosaurus', 'pachycephalosaurus', 'parasaurolophus', 'stegosaurus', 'triceratops'];
const FOOD_MAP = { trex: 'meat', spinosaurus: 'meat', dilophosaurus: 'meat', pachycephalosaurus: 'mejoberries', parasaurolophus: 'mejoberries', stegosaurus: 'mejoberries', triceratops: 'mejoberries' };
const SPECIES_NAMES = { trex: 'T-Rex', spinosaurus: 'Spinosaurus', dilophosaurus: 'Dilophosaurus', pachycephalosaurus: 'Pachycephalosaurus', parasaurolophus: 'Parasaurolophus', stegosaurus: 'Stegosaurus', triceratops: 'Triceratops' };

export function AdminBots() {
  const [bots, setBots] = useState([]);
  const [bulkLobbyCode, setBulkLobbyCode] = useState('');
  const [log, setLog] = useState([]);

  function addLog(msg) {
    setLog(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 50));
  }

  function updateBot(id, updates) {
    setBots(prev => prev.map(b => b.id === id ? { ...b, ...updates } : b));
  }

  async function spawnBot() {
    const id = generateId();
    const nameBase = BOT_NAMES[bots.length % BOT_NAMES.length];
    const name = `Bot-${nameBase}-${bots.length + 1}`;
    try {
      await api.createPlayer(id, name, '');
      setBots(prev => [...prev, { id, name, state: 'idle', dinos: 0 }]);
      addLog(`Spawned ${name}`);
    } catch (err) {
      addLog(`Failed to spawn bot: ${err.message}`);
    }
  }

  function removeBot(id) {
    setBots(prev => prev.filter(b => b.id !== id));
  }

  async function autoCollect(bot) {
    updateBot(bot.id, { state: 'collecting' });
    const species = SPECIES[Math.floor(Math.random() * SPECIES.length)];
    const food = FOOD_MAP[species];
    try {
      await api.scanDino(bot.id, species);
      addLog(`${bot.name} encountered ${SPECIES_NAMES[species]}`);

      await api.scanFood(bot.id, food, species);
      addLog(`${bot.name} tamed ${SPECIES_NAMES[species]}`);

      const dinoName = `${bot.name}'s ${SPECIES_NAMES[species]}`;
      await api.customizeDino(bot.id, species, { name: dinoName });
      await api.setPartner(bot.id, species);
      addLog(`${bot.name} set ${dinoName} as partner`);

      updateBot(bot.id, { state: 'idle', dinos: (bot.dinos || 0) + 1 });
    } catch (err) {
      addLog(`${bot.name} auto-collect failed: ${err.message}`);
      updateBot(bot.id, { state: 'idle' });
    }
  }

  async function joinLobby(bot, code) {
    updateBot(bot.id, { state: 'trivia' });
    try {
      const joinRes = await api.joinLobby(bot.id, code);
      addLog(`${bot.name} joined lobby ${code}`);
      if (joinRes.trivia) {
        const answerIdx = Math.floor(Math.random() * 4);
        await api.answerTrivia(bot.id, code, answerIdx);
        addLog(`${bot.name} answered trivia (option ${answerIdx})`);
      }
    } catch (err) {
      addLog(`${bot.name} lobby failed: ${err.message}`);
    }
    updateBot(bot.id, { state: 'idle' });
  }

  async function bossTap(bot, count = 10) {
    updateBot(bot.id, { state: 'fighting' });
    let totalDmg = 0;
    for (let i = 0; i < count; i++) {
      try {
        const res = await api.bossTap(bot.id);
        totalDmg += res.damage || 0;
      } catch { break; }
    }
    addLog(`${bot.name} dealt ${totalDmg} total damage (${count} taps)`);
    updateBot(bot.id, { state: 'idle' });
  }

  async function bulkAction(fn) {
    await Promise.all(bots.map(fn));
  }

  return (
    <div style={styles.container}>
      {/* Controls */}
      <div style={styles.controls}>
        <button style={styles.btn} onClick={spawnBot}>Spawn Bot</button>
        <button style={styles.btnSecondary} onClick={() => bulkAction(b => autoCollect(b))} disabled={bots.length === 0}>All Auto-Collect</button>
        <div style={styles.row}>
          <input style={styles.input} placeholder="Lobby code" value={bulkLobbyCode} onInput={e => setBulkLobbyCode(e.target.value)} />
          <button style={styles.btnSecondary} onClick={() => bulkAction(b => joinLobby(b, bulkLobbyCode))} disabled={!bulkLobbyCode || bots.length === 0}>All Join</button>
        </div>
        <button style={styles.btnSecondary} onClick={() => bulkAction(b => bossTap(b))} disabled={bots.length === 0}>All Boss Tap x10</button>
      </div>

      {/* Bot list */}
      <div style={styles.botList}>
        {bots.length === 0 && <p style={styles.muted}>No bots spawned yet.</p>}
        {bots.map(bot => (
          <div key={bot.id} style={styles.botRow}>
            <div style={styles.botInfo}>
              <span style={{ ...styles.statusDot, background: bot.state === 'idle' ? '#22c55e' : '#f59e0b' }} />
              <span style={styles.botName}>{bot.name}</span>
              <span style={styles.botState}>{bot.state}</span>
              <span style={styles.botDinos}>{bot.dinos} dinos</span>
            </div>
            <div style={styles.botActions}>
              <button style={styles.btnSmall} onClick={() => autoCollect(bot)} disabled={bot.state !== 'idle'}>Collect</button>
              <button style={styles.btnSmall} onClick={() => bossTap(bot)} disabled={bot.state !== 'idle'}>Tap x10</button>
              <button style={{ ...styles.btnSmall, color: '#ef4444' }} onClick={() => removeBot(bot.id)}>X</button>
            </div>
          </div>
        ))}
      </div>

      {/* Activity log */}
      {log.length > 0 && (
        <div style={styles.logBox}>
          <h4 style={styles.logTitle}>Activity Log</h4>
          {log.map((entry, i) => (
            <div key={i} style={styles.logEntry}>{entry}</div>
          ))}
        </div>
      )}
    </div>
  );
}

const styles = {
  container: { padding: '16px' },
  controls: { display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' },
  row: { display: 'flex', gap: '8px' },
  btn: { padding: '10px 16px', background: '#6366f1', border: 'none', borderRadius: '8px', color: '#fff', fontWeight: '700', fontSize: '14px', cursor: 'pointer' },
  btnSecondary: { padding: '8px 14px', background: '#374151', border: '1px solid #4b5563', borderRadius: '6px', color: '#ccc', fontSize: '13px', cursor: 'pointer' },
  btnSmall: { padding: '4px 8px', background: '#1f2937', border: '1px solid #374151', borderRadius: '4px', color: '#ccc', fontSize: '11px', cursor: 'pointer' },
  input: { flex: 1, padding: '8px', background: '#1f2937', border: '1px solid #374151', borderRadius: '6px', color: '#f0f0f0', fontSize: '13px' },
  botList: { display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '16px' },
  botRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: '#111', borderRadius: '8px', border: '1px solid #222' },
  botInfo: { display: 'flex', alignItems: 'center', gap: '8px' },
  statusDot: { width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0 },
  botName: { fontSize: '13px', fontWeight: '600', color: '#e5e7eb' },
  botState: { fontSize: '11px', color: '#9ca3af' },
  botDinos: { fontSize: '11px', color: '#6b7280' },
  botActions: { display: 'flex', gap: '4px' },
  muted: { color: '#6b7280', fontSize: '13px' },
  logBox: { background: '#0a0a0a', border: '1px solid #222', borderRadius: '10px', padding: '12px', maxHeight: '250px', overflow: 'auto' },
  logTitle: { margin: '0 0 8px', fontSize: '12px', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '1px' },
  logEntry: { fontSize: '11px', color: '#9ca3af', fontFamily: 'monospace', padding: '2px 0' },
};
```

- [ ] **Step 2: Verify build**

Run: `cd frontend && npx vite build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/AdminBots.jsx
git commit -m "feat: admin bots tab - spawn fake players, auto-collect, boss tap"
```

---

### Task 7: Reset Tab

**Files:**
- Modify: `frontend/src/components/AdminReset.jsx`

- [ ] **Step 1: Implement AdminReset.jsx**

Replace the placeholder with the full implementation:

```jsx
import { useState, useEffect } from 'preact/hooks';
import { api } from '../api.js';

export function AdminReset() {
  const [players, setPlayers] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [resetConfirm, setResetConfirm] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.adminDashboard().then(data => {
      setPlayers(data.player_list || []);
    }).catch(() => {});
  }, []);

  const selectedPlayer = players.find(p => p.id === selectedId);

  async function handleResetPlayer() {
    if (!selectedId) return;
    if (!confirm(`Reset all game data for "${selectedPlayer?.name}"? This keeps their profile but removes all dinos, items, notes, inspiration, and cooldowns.`)) return;
    setLoading(true);
    try {
      const res = await api.resetPlayer(selectedId);
      setResult({ ok: true, msg: `Deleted ${res.deleted} items for ${selectedPlayer?.name}` });
    } catch (err) {
      setResult({ ok: false, msg: err.message });
    }
    setLoading(false);
  }

  async function handleResetAll() {
    if (resetConfirm !== 'RESET') return;
    setLoading(true);
    try {
      const res = await api.resetAll();
      setResult({ ok: true, msg: `Full reset complete. Deleted ${res.deleted} items. Player profiles preserved.` });
      setResetConfirm('');
    } catch (err) {
      setResult({ ok: false, msg: err.message });
    }
    setLoading(false);
  }

  return (
    <div style={styles.container}>
      {/* Per-player reset */}
      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>Reset Player</h3>
        <p style={styles.desc}>Wipe a player's dinos, items, notes, inspiration, and cooldowns. Their profile (name) is kept.</p>
        <div style={styles.row}>
          <select style={styles.select} value={selectedId} onChange={e => setSelectedId(e.target.value)}>
            <option value="">-- Select player --</option>
            {players.map(p => <option key={p.id} value={p.id}>{p.name} ({p.dino_count} dinos)</option>)}
          </select>
          <button
            style={{ ...styles.dangerBtn, opacity: selectedId ? 1 : 0.4 }}
            onClick={handleResetPlayer}
            disabled={!selectedId || loading}
          >
            Reset Player
          </button>
        </div>
      </div>

      {/* Full game reset */}
      <div style={styles.section}>
        <h3 style={{ ...styles.sectionTitle, color: '#ef4444' }}>Full Game Reset</h3>
        <div style={styles.warningBox}>
          <p style={styles.warningText}>
            This deletes ALL data — every player's dinos, items, notes, the plaza, feed, boss state, lobbies, and cooldowns. Player profiles are kept.
          </p>
        </div>
        <p style={styles.desc}>Type <strong style={{ color: '#ef4444' }}>RESET</strong> to enable the button:</p>
        <div style={styles.row}>
          <input
            style={styles.input}
            value={resetConfirm}
            onInput={e => setResetConfirm(e.target.value)}
            placeholder='Type "RESET" to confirm'
          />
          <button
            style={{ ...styles.dangerBtn, opacity: resetConfirm === 'RESET' ? 1 : 0.4 }}
            onClick={handleResetAll}
            disabled={resetConfirm !== 'RESET' || loading}
          >
            Reset Everything
          </button>
        </div>
      </div>

      {/* Result */}
      {result && (
        <div style={{ ...styles.resultBox, borderColor: result.ok ? '#22c55e' : '#ef4444' }}>
          <p style={{ margin: 0, fontSize: '13px', color: result.ok ? '#22c55e' : '#ef4444' }}>{result.msg}</p>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: { padding: '16px' },
  section: { marginBottom: '20px', padding: '14px', background: '#111', borderRadius: '10px', border: '1px solid #222' },
  sectionTitle: { margin: '0 0 8px', fontSize: '14px', fontWeight: '700', color: '#e5e7eb' },
  desc: { margin: '0 0 10px', fontSize: '13px', color: '#9ca3af', lineHeight: '1.5' },
  row: { display: 'flex', gap: '8px', flexWrap: 'wrap' },
  select: { flex: '1 1 160px', padding: '8px', background: '#1f2937', border: '1px solid #374151', borderRadius: '6px', color: '#f0f0f0', fontSize: '13px' },
  input: { flex: '1 1 160px', padding: '8px', background: '#1f2937', border: '1px solid #374151', borderRadius: '6px', color: '#f0f0f0', fontSize: '13px' },
  dangerBtn: { padding: '8px 16px', background: '#dc2626', border: 'none', borderRadius: '6px', color: '#fff', fontWeight: '700', fontSize: '13px', cursor: 'pointer', whiteSpace: 'nowrap' },
  warningBox: { padding: '12px', background: '#1a0000', border: '1px solid #7f1d1d', borderRadius: '8px', marginBottom: '10px' },
  warningText: { margin: 0, fontSize: '13px', color: '#fca5a5', lineHeight: '1.5' },
  resultBox: { padding: '12px', background: '#0a0a0a', border: '2px solid', borderRadius: '10px' },
};
```

- [ ] **Step 2: Verify build**

Run: `cd frontend && npx vite build`
Expected: Build succeeds

- [ ] **Step 3: Run all backend tests**

Run: `python -m pytest backend/tests/ -v`
Expected: ALL PASS

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/AdminReset.jsx
git commit -m "feat: admin reset tab - per-player and full game data wipe"
```

---

## Dependency Graph

```
Task 1 (backend reset endpoints + tests)
  └─ Task 2 (SAM template + API client updates)
       └─ Task 3 (tab shell + extract dashboard + placeholders)
            ├─ Task 4 (QR codes tab)
            ├─ Task 5 (simulator tab)
            ├─ Task 6 (bots tab)
            └─ Task 7 (reset tab)
```

Tasks 4-7 are independent of each other but all depend on Task 3 (tab shell must exist first). Recommended execution order: 1 → 2 → 3 → 4 → 5 → 6 → 7.
