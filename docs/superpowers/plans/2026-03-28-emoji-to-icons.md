# Emoji → Icon Library Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace all Unicode emoji in the Dino Party frontend with `lucide-preact` icons, and replace lobby code symbols (9 emoji tokens) with 4 item artwork images.

**Architecture:** Install `lucide-preact`; create two shared data files (`icons.js` for feed/event icon lookups, `lobbySymbols.js` for the 4-item lobby symbol set); update backend `LOBBY_SYMBOLS` to match; replace emoji usage file-by-file across 13 components.

**Tech Stack:** Preact 10, Vite 6, lucide-preact (latest), Python 3.12 pytest (backend)

---

## File Map

| Action | File |
|--------|------|
| New | `frontend/src/data/icons.js` |
| New | `frontend/src/data/lobbySymbols.js` |
| Modify | `frontend/package.json` |
| Modify | `frontend/src/components/BottomNav.jsx` |
| Modify | `frontend/src/components/Plaza.jsx` |
| Modify | `frontend/src/components/FeedScreen.jsx` |
| Modify | `frontend/src/components/EventScan.jsx` |
| Modify | `frontend/src/components/PlayMenu.jsx` |
| Modify | `frontend/src/components/PlayLobby.jsx` |
| Modify | `frontend/src/components/PlayTogether.jsx` |
| Modify | `frontend/src/components/PlayTrivia.jsx` |
| Modify | `frontend/src/components/BossBanner.jsx` |
| Modify | `frontend/src/components/BossFight.jsx` |
| Modify | `frontend/src/components/BossVictory.jsx` |
| Modify | `frontend/src/components/InspirationScan.jsx` |
| Modify | `frontend/src/components/DinoTaming.jsx` |
| Modify | `backend/src/shared/game_data.py` |
| Modify | `backend/tests/test_lobby.py` |

---

## Task 1: Install lucide-preact

**Files:**
- Modify: `frontend/package.json`

- [ ] **Step 1: Install the package**

```bash
cd frontend && npm install lucide-preact
```

- [ ] **Step 2: Verify it's in package.json**

Run: `cd frontend && cat package.json`
Expected: `"lucide-preact"` appears under `"dependencies"`.

- [ ] **Step 3: Commit**

```bash
cd frontend && git add package.json package-lock.json
git commit -m "chore: add lucide-preact dependency"
```

---

## Task 2: Create shared data files

**Files:**
- Create: `frontend/src/data/icons.js`
- Create: `frontend/src/data/lobbySymbols.js`

- [ ] **Step 1: Create `frontend/src/data/icons.js`**

```js
import {
  Footprints, PartyPopper, Handshake, TrendingUp, Swords, Sparkles, Leaf,
  UtensilsCrossed, Music2, Camera, Cake, Gift,
} from 'lucide-preact';

// Feed entry type → Lucide icon component. Use Leaf as fallback.
export const FEED_ICONS = {
  encounter:   Footprints,
  tamed:       PartyPopper,
  play:        Handshake,
  levelup:     TrendingUp,
  boss:        Swords,
  inspiration: Sparkles,
};

// Party event type → Lucide icon component. Use Leaf as fallback.
export const EVENT_ICONS = {
  cooking_pot:   UtensilsCrossed,
  dance_floor:   Music2,
  photo_booth:   Camera,
  cake_table:    Cake,
  mystery_chest: Gift,
};
```

- [ ] **Step 2: Create `frontend/src/data/lobbySymbols.js`**

```js
import meatImg       from '../assets/items/meat.png';
import berryImg      from '../assets/items/berry.png';
import paintImg      from '../assets/items/paint.png';
import cookedMeatImg from '../assets/items/cooked_meat.png';

export const LOBBY_SYMBOLS = [
  { id: 'meat',        img: meatImg,        label: 'Meat' },
  { id: 'berry',       img: berryImg,       label: 'Berry' },
  { id: 'paint',       img: paintImg,       label: 'Paint' },
  { id: 'cooked_meat', img: cookedMeatImg,  label: 'Cooked Meat' },
];
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/data/icons.js frontend/src/data/lobbySymbols.js
git commit -m "feat: add shared icon and lobby symbol data files"
```

---

## Task 3: Update backend LOBBY_SYMBOLS and tests

**Files:**
- Modify: `backend/src/shared/game_data.py:56-59`
- Modify: `backend/tests/test_lobby.py` (hardcoded codes)

- [ ] **Step 1: Update `LOBBY_SYMBOLS` in game_data.py**

In `backend/src/shared/game_data.py`, replace lines 56-59:

```python
# Before:
LOBBY_SYMBOLS = [
    "meat", "mejoberry", "party_hat", "cowboy_hat", "top_hat",
    "sunglasses", "paint", "bone", "egg",
]

# After:
LOBBY_SYMBOLS = ["meat", "berry", "paint", "cooked_meat"]
```

- [ ] **Step 2: Run game_data tests to verify they still pass**

```bash
cd backend && pytest tests/test_game_data.py -v
```

Expected: All tests pass. `test_lobby_code_has_three_unique_symbols` uses `random.sample(LOBBY_SYMBOLS, 3)` which works fine with 4 symbols.

- [ ] **Step 3: Fix hardcoded lobby codes in test_lobby.py**

Five lobby codes in `backend/tests/test_lobby.py` use symbols no longer in the list. Replace them as follows (every occurrence must be updated — search for each string):

| Old code | New code |
|----------|----------|
| `"meat_bone_egg"` | `"meat_berry_paint"` |
| `"bone_egg_leaf"` | `"berry_paint_cooked_meat"` |
| `"paint_bone_egg"` | `"paint_meat_berry"` |
| `"leaf_sunglasses_meat"` | `"cooked_meat_berry_paint"` |
| `"meat_bone_leaf"` | `"meat_berry_cooked_meat"` |

Each code appears 2-3 times in the test file (in `_make_lobby(...)`, `_answer_event(...)`, `get_item(...)`, and assertion strings). Update every occurrence.

- [ ] **Step 4: Run lobby tests**

```bash
cd backend && pytest tests/test_lobby.py -v
```

Expected: All tests pass.

- [ ] **Step 5: Run full backend test suite**

```bash
cd backend && pytest
```

Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add backend/src/shared/game_data.py backend/tests/test_lobby.py
git commit -m "feat: reduce lobby symbols to 4 item artworks"
```

---

## Task 4: Update BottomNav.jsx

**Files:**
- Modify: `frontend/src/components/BottomNav.jsx`

- [ ] **Step 1: Replace the full file**

```jsx
import { store } from '../store.js';
import { Leaf, Footprints, Handshake, Backpack, User, Settings } from 'lucide-preact';

const IS_LOCAL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

const tabs = [
  { route: '/plaza',     Icon: Leaf,      label: 'Plaza' },
  { route: '/dinos',     Icon: Footprints, label: 'My Dinos' },
  { route: '/play',      Icon: Handshake, label: 'Play' },
  { route: '/inventory', Icon: Backpack,  label: 'Inventory' },
  { route: '/profile',   Icon: User,      label: 'Profile' },
  ...(IS_LOCAL ? [{ route: '/admin', Icon: Settings, label: 'Admin' }] : []),
];

export function BottomNav() {
  const current = store.route;

  return (
    <nav style={styles.nav}>
      {tabs.map(tab => {
        const color = current === tab.route || current.startsWith(tab.route + '/') ? '#4ade80' : '#888';
        return (
          <button
            key={tab.route}
            onClick={() => store.navigate(tab.route)}
            style={{ ...styles.tab, color }}
          >
            <tab.Icon size={24} />
            <span style={styles.label}>{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

const styles = {
  nav: {
    display: 'flex', justifyContent: 'space-around',
    background: '#111', borderTop: '1px solid #333',
    padding: '8px 4px 12px', flexShrink: 0,
    position: 'sticky', bottom: 0,
  },
  tab: {
    flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
    gap: '2px', background: 'none', border: 'none', cursor: 'pointer',
    padding: '4px',
  },
  label: { fontSize: '10px' },
};
```

- [ ] **Step 2: Start dev server and verify nav bar**

```bash
cd frontend && npm run dev
```

Open `http://localhost:3000/dinosaur-birthday/`. Expected: Bottom nav shows 5 Lucide icons (Leaf, Footprints, Handshake, Backpack, User) with labels. Active tab is green. No emoji.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/BottomNav.jsx
git commit -m "feat: replace nav emoji with lucide icons in BottomNav"
```

---

## Task 5: Update Plaza.jsx and FeedScreen.jsx

**Files:**
- Modify: `frontend/src/components/Plaza.jsx`
- Modify: `frontend/src/components/FeedScreen.jsx`

- [ ] **Step 1: Update Plaza.jsx**

Remove the `FEED_ICONS` constant and emoji from the file. Full updated file:

```jsx
import { useEffect, useRef, useState } from 'preact/hooks';
import { api } from '../api.js';
import { ws } from '../ws.js';
import { store } from '../store.js';
import { PlazaCanvas } from './PlazaCanvas.js';
import { TitleBar } from './TitleBar.jsx';
import { FEED_ICONS } from '../data/icons.js';
import { Leaf, Footprints } from 'lucide-preact';

export function Plaza() {
  const canvasRef = useRef(null);
  const plazaRef = useRef(null);
  const [partners, setPartners] = useState([]);
  const [feedEntries, setFeedEntries] = useState(store.feedEntries.slice(0, 7));

  // Initial load + canvas setup
  useEffect(() => {
    api.getPlaza().then(data => {
      setPartners(data.partners || []);
    }).catch(() => {});
  }, []);

  // Create canvas once on mount
  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const plaza = new PlazaCanvas(canvas, [], () => {});
    plazaRef.current = plaza;
    plaza.start();
    return () => plaza.stop();
  }, []);

  // Push partner updates into the existing canvas instance
  useEffect(() => {
    if (plazaRef.current) plazaRef.current.updatePartners(partners);
  }, [partners]);

  // Wire real-time plaza updates
  useEffect(() => {
    const offArrive = ws.on('plaza', 'dino_arrive', (data) => {
      setPartners(prev => {
        const updated = [...prev.filter(p => p.player_id !== data.player_id), data];
        if (plazaRef.current) plazaRef.current.updatePartners(updated);
        return updated;
      });
    });
    const offLeave = ws.on('plaza', 'dino_leave', (data) => {
      setPartners(prev => {
        const updated = prev.filter(p => p.player_id !== data.player_id);
        if (plazaRef.current) plazaRef.current.updatePartners(updated);
        return updated;
      });
    });

    return () => { offArrive(); offLeave(); };
  }, []);

  // Boss buildup — fetch persisted phase on mount, then listen for WS updates
  useEffect(() => {
    api.getBossState().then(data => {
      if (plazaRef.current && data.buildup_phase === 1) {
        plazaRef.current.setShadowPhase(true);
      }
    }).catch(() => {});

    const off = ws.on('plaza', 'buildup', (data) => {
      if (!plazaRef.current) return;
      plazaRef.current.setShadowPhase(data.phase === 1);
    });
    return () => off();
  }, []);

  // Subscribe to live feed entries from store
  useEffect(() => {
    const unsub = store.subscribe(() => {
      setFeedEntries(store.feedEntries.slice(0, 7));
    });
    return unsub;
  }, []);

  return (
    <div style={styles.container}>
      <TitleBar title="Plaza" transparent />
      <canvas ref={canvasRef} style={styles.canvas} />

      {partners.length === 0 && (
        <div style={styles.emptyHint}>
          <Footprints size={48} color="#4ade80" />
          <p style={{ color: '#4ade80', marginTop: '8px' }}>It's quiet in here...</p>
          <p style={{ color: '#86efac', fontSize: '13px' }}>Maybe there are some dinos hiding around the party that might want to join?</p>
        </div>
      )}

      {feedEntries.length > 0 && (
        <div style={styles.feedOverlay}>
          <div style={styles.feedList}>
            {feedEntries.map(entry => {
              const FeedIcon = FEED_ICONS[entry.type] || Leaf;
              return (
                <div key={entry.id} style={styles.feedItem}>
                  <FeedIcon size={12} style={styles.feedIcon} />
                  <span style={styles.feedText}>{entry.message}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    position: 'absolute',
    inset: 0,
    overflow: 'hidden',
    background: '#15803d',
  },
  canvas: {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    display: 'block',
    cursor: 'grab',
    touchAction: 'none',
  },
  emptyHint: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    textAlign: 'center',
    pointerEvents: 'none',
    background: 'rgba(0,0,0,0.65)',
    backdropFilter: 'blur(4px)',
    borderRadius: '16px',
    padding: '20px 24px',
    maxWidth: '320px',
    width: '85%',
  },
  feedOverlay: {
    position: 'absolute',
    bottom: '8px',
    left: '8px',
    width: '200px',
    pointerEvents: 'none',
    zIndex: 5,
    background: 'rgba(0, 0, 0, 0.25)',
    borderRadius: '8px',
    padding: '6px 8px',
    display: 'flex',
    flexDirection: 'column',
    gap: '3px',
  },
  feedList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '3px',
  },
  feedItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    lineHeight: '1.3',
    textShadow: '0 1px 3px rgba(0,0,0,0.8)',
  },
  feedIcon: {
    flexShrink: 0,
  },
  feedText: {
    fontSize: '12px',
    color: 'rgba(255, 255, 255, 0.85)',
    wordBreak: 'break-word',
  },
};
```

- [ ] **Step 2: Update FeedScreen.jsx**

Full updated file:

```jsx
import { useEffect, useState } from 'preact/hooks';
import { api } from '../api.js';
import { store } from '../store.js';
import { FEED_ICONS } from '../data/icons.js';
import { Leaf, Newspaper, Footprints } from 'lucide-preact';

function relativeTime(timestamp) {
  const now = Date.now();
  let then;
  try {
    const str = timestamp.endsWith('Z') ? timestamp : timestamp + 'Z';
    then = new Date(str).getTime();
  } catch {
    return '';
  }
  if (isNaN(then)) return '';

  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 5) return 'just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

export function FeedScreen() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.getFeed()
      .then(data => {
        setEntries(data.entries || []);
        setLoading(false);
      })
      .catch(err => {
        setError('Could not load feed.');
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    const unsubscribe = store.subscribe(() => {
      const liveEntries = store.feedEntries;
      if (liveEntries.length === 0) return;

      setEntries(prev => {
        const existingIds = new Set(prev.map(e => e.id));
        const newEntries = liveEntries.filter(e => e.id && !existingIds.has(e.id));
        if (newEntries.length === 0) return prev;

        const merged = [...newEntries, ...prev];
        merged.sort((a, b) => {
          if (!a.timestamp) return 1;
          if (!b.timestamp) return -1;
          return b.timestamp.localeCompare(a.timestamp);
        });
        return merged.slice(0, 100);
      });
    });

    return unsubscribe;
  }, []);

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <Newspaper size={24} color="#4ade80" />
          <h2 style={styles.headerTitle}>Live Feed</h2>
        </div>
        <div style={styles.center}>
          <p style={styles.muted}>Loading...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <Newspaper size={24} color="#4ade80" />
          <h2 style={styles.headerTitle}>Live Feed</h2>
        </div>
        <div style={styles.center}>
          <p style={styles.errorText}>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <Newspaper size={24} color="#4ade80" />
        <h2 style={styles.headerTitle}>Live Feed</h2>
      </div>

      {entries.length === 0 ? (
        <div style={styles.center}>
          <Footprints size={48} color="#4ade80" />
          <p style={styles.muted}>No activity yet!</p>
          <p style={{ ...styles.muted, fontSize: '13px' }}>Go scan some dinos to get things started.</p>
        </div>
      ) : (
        <ul style={styles.list}>
          {entries.map(entry => {
            const EntryIcon = FEED_ICONS[entry.type] || Leaf;
            return (
              <li key={entry.id} style={styles.item}>
                <EntryIcon size={22} style={styles.icon} />
                <div style={styles.body}>
                  <p style={styles.message}>{entry.message}</p>
                  <p style={styles.timestamp}>{relativeTime(entry.timestamp)}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100%',
    background: '#0f1a0f',
    color: '#f0fdf4',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '18px 16px 12px',
    borderBottom: '1px solid #1f3d1f',
    background: '#111f11',
    flexShrink: 0,
  },
  headerTitle: {
    margin: 0,
    fontSize: '20px',
    fontWeight: 'bold',
    color: '#4ade80',
  },
  center: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px 20px',
    textAlign: 'center',
  },
  muted: {
    color: '#86efac',
    marginTop: '8px',
    fontSize: '15px',
  },
  errorText: {
    color: '#f87171',
    fontSize: '15px',
  },
  list: {
    listStyle: 'none',
    margin: 0,
    padding: '8px 0',
    overflowY: 'auto',
  },
  item: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
    padding: '12px 16px',
    borderBottom: '1px solid #1f3d1f',
  },
  icon: {
    flexShrink: 0,
    marginTop: '2px',
    color: '#4ade80',
  },
  body: {
    flex: 1,
    minWidth: 0,
  },
  message: {
    margin: 0,
    fontSize: '15px',
    color: '#f0fdf4',
    lineHeight: '1.4',
    wordBreak: 'break-word',
  },
  timestamp: {
    margin: '3px 0 0',
    fontSize: '12px',
    color: '#4ade80',
  },
};
```

- [ ] **Step 3: Verify in dev server**

Navigate to Plaza and the Feed tab. Expected: Feed overlay on plaza uses small icons, Feed screen header shows Newspaper icon, empty state shows Footprints icon, feed entries show type-appropriate icons. No emoji.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/Plaza.jsx frontend/src/components/FeedScreen.jsx
git commit -m "feat: replace emoji with icons in Plaza and FeedScreen"
```

---

## Task 6: Update EventScan.jsx

**Files:**
- Modify: `frontend/src/components/EventScan.jsx`

- [ ] **Step 1: Replace full file**

```jsx
import { useState, useEffect } from 'preact/hooks';
import { store } from '../store.js';
import { api } from '../api.js';
import { EVENT_ICONS } from '../data/icons.js';
import { PartyPopper, Crown } from 'lucide-preact';

const EVENT_LABELS = {
  cooking_pot: 'Cooking Pot',
  dance_floor: 'Dance Floor',
  photo_booth: 'Photo Booth',
  cake_table: 'Cake Table',
  mystery_chest: 'Mystery Chest',
};

export function EventScan({ eventType }) {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [description, setDescription] = useState('');
  const [descSent, setDescSent] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const data = await api.scanEvent(store.playerId, eventType);
        setResult(data);
        await store.refresh();
      } catch (err) {
        setError(err.message);
      }
      setLoading(false);
    })();
  }, [eventType]);

  const handleSendDescription = async () => {
    if (!description.trim()) return;
    try {
      await api.scanEvent(store.playerId, eventType, description.trim());
      setDescSent(true);
    } catch {
      setDescSent(true);
    }
  };

  if (loading) {
    return <div style={styles.center}><p>Checking event...</p></div>;
  }

  if (error) {
    return (
      <div style={styles.center}>
        <p style={{ color: '#ef4444' }}>{error}</p>
        <button onClick={() => store.navigate('/plaza')} style={styles.button}>Back to Plaza</button>
      </div>
    );
  }

  const label = EVENT_LABELS[eventType] || eventType;
  const EventIcon = EVENT_ICONS[eventType] || PartyPopper;

  if (result?.already_claimed) {
    return (
      <div style={styles.container}>
        <div style={styles.iconBox}><EventIcon size={56} /></div>
        <h2 style={styles.title}>{label}</h2>
        <div style={styles.pill}>Already Claimed</div>
        <p style={{ color: '#888', textAlign: 'center', fontSize: '14px' }}>
          You've already visited this event. Only one reward per party station!
        </p>
        <button onClick={() => store.navigate('/plaza')} style={styles.button}>Back to Plaza</button>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>PARTY EVENT!</div>
      <div style={styles.iconBox}><EventIcon size={56} /></div>
      <h2 style={styles.title}>{label}</h2>

      <div style={styles.rewardBox}>
        <div style={styles.rewardRow}>
          <span>XP Gained</span>
          <span style={{ color: '#f59e0b', fontWeight: 'bold' }}>+25 XP</span>
        </div>
        {result?.dino && (
          <div style={styles.rewardRow}>
            <span>Partner Dino</span>
            <span style={{ color: '#a78bfa', fontSize: '13px' }}>
              {result.dino.species} Lv.{result.dino.level} ({result.dino.xp} XP)
            </span>
          </div>
        )}
        {result?.item && (
          <div style={styles.rewardRow}>
            <span>Item Found</span>
            <span style={{ color: '#4ade80', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Crown size={14} /> {result.item.name}
            </span>
          </div>
        )}
      </div>

      {!descSent ? (
        <div style={styles.descBox}>
          <p style={{ color: '#888', fontSize: '13px', margin: '0 0 8px' }}>
            Add a fun description for the feed? (optional)
          </p>
          <textarea
            placeholder={`e.g. "brewed a Health Potion (Beer + Lemonade)"`}
            value={description}
            onInput={(e) => setDescription(e.target.value)}
            maxLength={120}
            rows={3}
            style={styles.textarea}
          />
          <button
            onClick={handleSendDescription}
            disabled={!description.trim()}
            style={{ ...styles.secondaryButton, opacity: description.trim() ? 1 : 0.5 }}
          >
            Post to Feed
          </button>
        </div>
      ) : (
        <div style={{ color: '#4ade80', fontSize: '13px', textAlign: 'center' }}>
          Posted to feed!
        </div>
      )}

      <button onClick={() => store.navigate('/plaza')} style={styles.button}>Back to Plaza</button>
    </div>
  );
}

const styles = {
  center: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', minHeight: '80dvh', padding: '20px', gap: '16px',
  },
  container: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    padding: '24px 20px', gap: '12px',
  },
  header: { color: '#f59e0b', fontSize: '13px', fontWeight: 'bold', letterSpacing: '1px' },
  iconBox: {
    width: '100px', height: '100px', background: '#1a2e1a', borderRadius: '16px',
    display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '4px 0',
    color: '#4ade80',
  },
  title: { margin: 0, fontSize: '22px' },
  pill: {
    background: '#374151', color: '#9ca3af', borderRadius: '999px',
    padding: '4px 14px', fontSize: '12px',
  },
  rewardBox: {
    background: '#1a1a2e', borderRadius: '10px', padding: '14px 18px',
    width: '100%', maxWidth: '320px', display: 'flex', flexDirection: 'column', gap: '8px',
  },
  rewardRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '14px',
  },
  descBox: {
    width: '100%', maxWidth: '320px', display: 'flex', flexDirection: 'column', gap: '6px',
  },
  textarea: {
    width: '100%', background: '#1a1a2e', border: '1px solid #333', borderRadius: '8px',
    color: '#e0e0e0', fontSize: '13px', padding: '10px', resize: 'none',
    fontFamily: 'inherit', boxSizing: 'border-box',
  },
  button: {
    padding: '14px', borderRadius: '8px', border: 'none',
    background: '#6366f1', color: 'white', fontSize: '16px',
    fontWeight: 'bold', cursor: 'pointer', width: '100%', maxWidth: '320px',
  },
  secondaryButton: {
    padding: '10px', borderRadius: '8px', border: 'none',
    background: '#374151', color: '#e0e0e0', fontSize: '14px',
    cursor: 'pointer', width: '100%',
  },
};
```

- [ ] **Step 2: Verify**

Scan an event QR (or navigate directly to `/scan/event/cooking_pot`). Expected: Icon shows UtensilsCrossed instead of 🍲, hat reward shows Crown icon. No emoji.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/EventScan.jsx
git commit -m "feat: replace emoji with icons in EventScan"
```

---

## Task 7: Update PlayMenu.jsx, PlayLobby.jsx, PlayTogether.jsx

**Files:**
- Modify: `frontend/src/components/PlayMenu.jsx`
- Modify: `frontend/src/components/PlayLobby.jsx`
- Modify: `frontend/src/components/PlayTogether.jsx`

All three files share a common pattern: delete local `SYMBOL_EMOJI` / `SYMBOL_IMG` / `SYMBOLS` / `ALL_SYMBOLS` definitions, import `LOBBY_SYMBOLS` from `../data/lobbySymbols.js`, and use a local `SymbolIcon` helper that renders item images.

- [ ] **Step 1: Replace PlayMenu.jsx**

```jsx
import { useState, useEffect } from 'preact/hooks';
import { store } from '../store.js';
import { useStore } from '../router.jsx';
import { api } from '../api.js';
import { TitleBar } from './TitleBar.jsx';
import { LOBBY_SYMBOLS } from '../data/lobbySymbols.js';
import { Gamepad2, Handshake, Lightbulb } from 'lucide-preact';

function SymbolIcon({ sym, size }) {
  const s = LOBBY_SYMBOLS.find(s => s.id === sym);
  if (!s) return <span style={{ color: '#444' }}>?</span>;
  return <img src={s.img} style={{ width: size, height: size, imageRendering: 'pixelated' }} />;
}

const RECENT_PLAYS_KEY = 'dino_party_recent_plays';

function getCooldowns() {
  try {
    return JSON.parse(localStorage.getItem(RECENT_PLAYS_KEY) || '[]');
  } catch {
    return [];
  }
}

function formatTimeLeft(expiresAt) {
  const now = Date.now();
  const diff = Math.max(0, expiresAt - now);
  const totalSec = Math.floor(diff / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}m ${s}s`;
}

export function PlayMenu() {
  const { player } = useStore();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [showJoin, setShowJoin] = useState(false);
  const [selectedSymbols, setSelectedSymbols] = useState([null, null, null]);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const recentPlays = getCooldowns().filter(p => p.expiresAt > Date.now());
  const hasPartner = player?.dinos?.some(d => d.is_partner && d.tamed);

  async function handleHost() {
    setBusy(true);
    setError('');
    try {
      const data = await api.createLobby(store.playerId);
      store.lobbyRole = 'host';
      store.navigate(`/play/lobby/${data.code}`);
    } catch (err) {
      setError(err.message || 'Could not create lobby');
    }
    setBusy(false);
  }

  function handleSymbolPick(slotIndex, symbol) {
    const next = [...selectedSymbols];
    next[slotIndex] = symbol;
    setSelectedSymbols(next);
  }

  async function handleJoinSubmit() {
    const filled = selectedSymbols.filter(Boolean);
    if (filled.length < 3) {
      setError('Pick all 3 symbols');
      return;
    }
    const code = selectedSymbols.join('_');
    setBusy(true);
    setError('');
    try {
      const data = await api.joinLobby(store.playerId, code);
      store.lobbyRole = 'guest';
      store.lobbyTrivia = data.trivia;
      store.navigate(`/play/trivia/${code}`);
    } catch (err) {
      setError(err.message || 'Could not join lobby');
    }
    setBusy(false);
  }

  return (
    <div style={styles.page}>
      <TitleBar title="Play Together" subtitle="Team up with another dino tamer!" />

      <div style={styles.content}>
      {!hasPartner && (
        <div style={styles.hint}>
          <Lightbulb size={20} color="#a78bfa" />
          <span>Set a tamed dino as your Plaza Partner before you can play!</span>
        </div>
      )}

      <button
        onClick={handleHost}
        disabled={busy || !hasPartner}
        style={{ ...styles.hostBtn, opacity: hasPartner ? 1 : 0.4 }}
      >
        <div style={styles.bigBtnIconWrap}>
          <Gamepad2 size={32} color="#4ade80" />
        </div>
        <div style={styles.bigBtnText}>
          <div style={styles.bigBtnLabel}>Host a Lobby</div>
          <div style={styles.bigBtnSub}>Get a code, share with a friend</div>
        </div>
        <span style={styles.bigBtnArrow}>›</span>
      </button>

      {!showJoin ? (
        <button
          onClick={() => { setShowJoin(true); setError(''); }}
          disabled={busy || !hasPartner}
          style={{ ...styles.joinBtn, opacity: hasPartner ? 1 : 0.4 }}
        >
          <div style={styles.bigBtnIconWrap}>
            <Handshake size={32} color="#60a5fa" />
          </div>
          <div style={styles.bigBtnText}>
            <div style={styles.bigBtnLabel}>Join a Lobby</div>
            <div style={styles.bigBtnSub}>Enter a 3-symbol code</div>
          </div>
          <span style={styles.bigBtnArrow}>›</span>
        </button>
      ) : (
        <div style={styles.joinCard}>
          <div style={styles.joinTitle}>Pick the 3 symbols</div>
          <div style={styles.slots}>
            {[0, 1, 2].map(i => (
              <div key={i} style={styles.slotWrapper}>
                <div style={{
                  ...styles.slot,
                  borderColor: selectedSymbols[i] ? '#60a5fa' : '#333',
                  background: selectedSymbols[i] ? '#1e293b' : '#1f2937',
                }}>
                  {selectedSymbols[i]
                    ? <SymbolIcon sym={selectedSymbols[i]} size="28px" />
                    : <span style={{ color: '#444', fontSize: '20px' }}>?</span>}
                </div>
                <div style={styles.symbolGrid}>
                  {LOBBY_SYMBOLS.map(s => (
                    <button
                      key={s.id}
                      onClick={() => handleSymbolPick(i, s.id)}
                      style={{
                        ...styles.symbolBtn,
                        background: selectedSymbols[i] === s.id ? '#1e3a5f' : 'transparent',
                        borderColor: selectedSymbols[i] === s.id ? '#60a5fa' : '#222',
                      }}
                      title={s.label}
                    >
                      <SymbolIcon sym={s.id} size="18px" />
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={handleJoinSubmit}
            disabled={busy || selectedSymbols.some(s => !s)}
            style={{
              ...styles.btn,
              opacity: selectedSymbols.some(s => !s) ? 0.5 : 1,
            }}
          >
            {busy ? 'Joining...' : 'Join Lobby'}
          </button>
          <button
            onClick={() => { setShowJoin(false); setSelectedSymbols([null, null, null]); setError(''); }}
            style={styles.ghostBtn}
          >
            Cancel
          </button>
        </div>
      )}

      {error && <div style={styles.errorMsg}>{error}</div>}

      {recentPlays.length > 0 && (
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Recent Plays</div>
          {recentPlays.map((play, idx) => (
            <div key={idx} style={styles.cooldownRow}>
              <span style={styles.cooldownLabel}>{play.withName || 'A tamer'}</span>
              <span style={styles.cooldownTimer}>
                Cooldown: {formatTimeLeft(play.expiresAt)}
              </span>
            </div>
          ))}
        </div>
      )}

      <div style={styles.howSection}>
        <div style={styles.howTitle}>How It Works</div>
        <div style={styles.stepsContainer}>
          <div style={styles.step}>
            <div style={styles.stepNum}>1</div>
            <div style={styles.stepText}>
              <strong style={styles.stepLabel}>Pair up</strong>
              <span style={styles.stepDesc}>One player hosts, the other joins with the symbol code</span>
            </div>
          </div>
          <div style={styles.stepDivider} />
          <div style={styles.step}>
            <div style={styles.stepNum}>2</div>
            <div style={styles.stepText}>
              <strong style={styles.stepLabel}>Answer trivia</strong>
              <span style={styles.stepDesc}>While your dinos are off playing, you both get a dino trivia question — work together to answer correctly!</span>
            </div>
          </div>
          <div style={styles.stepDivider} />
          <div style={styles.step}>
            <div style={styles.stepNum}>3</div>
            <div style={styles.stepText}>
              <strong style={styles.stepLabel}>Earn rewards</strong>
              <span style={styles.stepDesc}>Your Plaza Partner earns XP and you might get a hat drop</span>
            </div>
          </div>
        </div>
      </div>

      </div>
    </div>
  );
}

const styles = {
  page: {
    display: 'flex', flexDirection: 'column',
    paddingBottom: '80px',
    background: 'linear-gradient(180deg, #0f1a2e 0%, #0a0f1a 40%, #0d1117 100%)',
    minHeight: '100vh',
  },
  content: {
    display: 'flex', flexDirection: 'column', gap: '12px',
    padding: '16px',
  },
  hostBtn: {
    display: 'flex', alignItems: 'center', gap: '14px',
    padding: '18px 20px', borderRadius: '14px',
    border: '1.5px solid #22633480',
    background: 'linear-gradient(135deg, #14532d 0%, #166534 100%)',
    cursor: 'pointer', textAlign: 'left', width: '100%',
    boxShadow: '0 2px 12px rgba(34, 197, 94, 0.08)',
  },
  joinBtn: {
    display: 'flex', alignItems: 'center', gap: '14px',
    padding: '18px 20px', borderRadius: '14px',
    border: '1.5px solid #1e3a5f80',
    background: 'linear-gradient(135deg, #172554 0%, #1e3a5f 100%)',
    cursor: 'pointer', textAlign: 'left', width: '100%',
    boxShadow: '0 2px 12px rgba(96, 165, 250, 0.06)',
  },
  bigBtnIconWrap: {
    flexShrink: 0,
    width: '48px', height: '48px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'rgba(255,255,255,0.06)', borderRadius: '12px',
  },
  bigBtnText: { flex: 1 },
  bigBtnLabel: { fontSize: '16px', fontWeight: 'bold', color: '#e5e7eb' },
  bigBtnSub: { fontSize: '12px', color: '#9ca3af', marginTop: '3px' },
  bigBtnArrow: { fontSize: '22px', color: '#4b5563', flexShrink: 0 },
  joinCard: {
    background: '#111827', border: '1.5px solid #374151', borderRadius: '14px',
    padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px',
  },
  joinTitle: { color: '#e0e0e0', fontSize: '15px', fontWeight: 'bold', textAlign: 'center' },
  slots: { display: 'flex', gap: '10px', justifyContent: 'center' },
  slotWrapper: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', flex: 1 },
  slot: {
    width: '52px', height: '52px', borderRadius: '10px', border: '2px solid',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'border-color 0.2s, background 0.2s',
  },
  symbolGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '4px', width: '100%',
  },
  symbolBtn: {
    padding: '6px', borderRadius: '6px', border: '1px solid',
    cursor: 'pointer', lineHeight: 1,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  btn: {
    padding: '14px', borderRadius: '10px', border: 'none',
    background: '#6366f1', color: 'white', fontSize: '15px',
    fontWeight: 'bold', cursor: 'pointer', width: '100%',
  },
  ghostBtn: {
    padding: '12px', borderRadius: '10px', border: '1px solid #333',
    background: 'none', color: '#aaa', fontSize: '14px',
    cursor: 'pointer', width: '100%',
  },
  errorMsg: {
    background: '#1c0a0a', border: '1px solid #7f1d1d', borderRadius: '8px',
    color: '#ef4444', padding: '12px', fontSize: '13px', textAlign: 'center',
  },
  section: {
    background: '#111827', border: '1px solid #1f2937', borderRadius: '12px',
    padding: '14px',
  },
  sectionTitle: {
    color: '#9ca3af', fontSize: '11px', fontWeight: 'bold',
    textTransform: 'uppercase', marginBottom: '10px',
  },
  cooldownRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '8px 0', borderBottom: '1px solid #1f2937',
    fontSize: '13px',
  },
  cooldownLabel: { color: '#e0e0e0' },
  cooldownTimer: { color: '#f59e0b', fontSize: '12px' },
  howSection: {
    background: '#0d1117', border: '1px solid #1e293b', borderRadius: '14px',
    padding: '18px', marginTop: '4px',
  },
  howTitle: {
    color: '#9ca3af', fontSize: '11px', fontWeight: 'bold',
    textTransform: 'uppercase', letterSpacing: '1px',
    marginBottom: '14px',
  },
  stepsContainer: {
    display: 'flex', flexDirection: 'column', gap: '0',
  },
  step: {
    display: 'flex', alignItems: 'flex-start', gap: '14px',
    padding: '2px 0',
  },
  stepNum: {
    width: '28px', height: '28px', borderRadius: '50%',
    background: '#1e293b', border: '1.5px solid #334155',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '13px', fontWeight: 'bold', color: '#94a3b8',
    flexShrink: 0,
  },
  stepText: {
    display: 'flex', flexDirection: 'column', gap: '2px',
    paddingTop: '3px',
  },
  stepLabel: { color: '#e2e8f0', fontSize: '14px' },
  stepDesc: { color: '#64748b', fontSize: '12px', lineHeight: '1.4' },
  stepDivider: {
    width: '1.5px', height: '16px', background: '#1e293b',
    marginLeft: '13px',
  },
  hint: {
    display: 'flex', alignItems: 'center', gap: '10px',
    background: '#1a1a2e', borderRadius: '10px', padding: '14px',
    color: '#a78bfa', fontSize: '13px',
  },
};
```

Note: `symbolGrid` column changed from `repeat(3, 1fr)` to `repeat(2, 1fr)` since there are now 4 symbols (2×2 grid instead of 3×3).

- [ ] **Step 2: Replace PlayLobby.jsx**

```jsx
import { useState, useEffect } from 'preact/hooks';
import { store } from '../store.js';
import { useStore } from '../router.jsx';
import { api } from '../api.js';
import { ws } from '../ws.js';
import { LOBBY_SYMBOLS } from '../data/lobbySymbols.js';
import { PartyPopper } from 'lucide-preact';

function SymbolIcon({ sym, size }) {
  const s = LOBBY_SYMBOLS.find(s => s.id === sym);
  if (!s) return <span style={{ color: '#444' }}>?</span>;
  return <img src={s.img} style={{ width: size, height: size, imageRendering: 'pixelated' }} />;
}

export function PlayLobby({ code }) {
  const { player } = useStore();
  const isHost = store.lobbyRole === 'host';

  const [symbols, setSymbols] = useState(() => code ? code.split('_') : []);
  const [status, setStatus] = useState('waiting');
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(null);

  const [selectedSymbols, setSelectedSymbols] = useState([null, null, null]);
  const [joinBusy, setJoinBusy] = useState(false);

  useEffect(() => {
    ws.subscribe(`lobby:${code}`);

    const offTrivia = ws.on(`lobby:${code}`, 'trivia_start', () => {
      setStatus('active');
      setCountdown(3);
    });

    return () => {
      offTrivia();
    };
  }, [code]);

  useEffect(() => {
    if (countdown === null) return;
    if (countdown === 0) {
      store.navigate(`/play/trivia/${code}`);
      return;
    }
    const id = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(id);
  }, [countdown, code]);

  if (isHost) {
    return (
      <div style={styles.page}>
        <div style={styles.header}>
          <button onClick={() => store.navigate('/play')} style={styles.backBtn}>
            Back
          </button>
          <h2 style={styles.headerTitle}>Your Lobby</h2>
          <div style={{ width: '48px' }} />
        </div>

        <div style={styles.codeCard}>
          <div style={styles.codeLabel}>Share this code:</div>
          <div style={styles.symbolRow}>
            {symbols.map((sym, i) => (
              <div key={i} style={styles.symbolBig}>
                <SymbolIcon sym={sym} size="52px" />
                <span style={styles.symbolName}>{sym.replace('_', ' ')}</span>
              </div>
            ))}
          </div>
          <div style={styles.codeText}>{code}</div>
        </div>

        {status === 'waiting' && (
          <div style={styles.waitingBox}>
            <div style={styles.waitingDots}>
              <span style={styles.dot} />
              <span style={{ ...styles.dot, animationDelay: '0.2s' }} />
              <span style={{ ...styles.dot, animationDelay: '0.4s' }} />
            </div>
            <p style={styles.waitingText}>Waiting for a friend to join...</p>
            <p style={styles.waitingHint}>Show them these 3 symbols!</p>
          </div>
        )}

        {status === 'active' && countdown !== null && (
          <div style={styles.matchedBox}>
            <PartyPopper size={48} color="#4ade80" />
            <div style={styles.matchedText}>A friend joined!</div>
            <div style={styles.countdown}>Starting in {countdown}...</div>
          </div>
        )}

        <style>{dotAnimation}</style>
      </div>
    );
  }

  async function handleJoin() {
    const filled = selectedSymbols.filter(Boolean);
    if (filled.length < 3) {
      setError('Pick all 3 symbols');
      return;
    }
    const joinCode = selectedSymbols.join('_');
    setJoinBusy(true);
    setError('');
    try {
      const data = await api.joinLobby(store.playerId, joinCode);
      store.lobbyRole = 'guest';
      store.lobbyTrivia = data.trivia;
      store.navigate(`/play/trivia/${joinCode}`);
    } catch (err) {
      setError(err.message || 'Could not join lobby');
    }
    setJoinBusy(false);
  }

  function handleSymbolPick(slotIndex, symbol) {
    const next = [...selectedSymbols];
    next[slotIndex] = symbol;
    setSelectedSymbols(next);
  }

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <button onClick={() => store.navigate('/play')} style={styles.backBtn}>
          Back
        </button>
        <h2 style={styles.headerTitle}>Join Lobby</h2>
        <div style={{ width: '48px' }} />
      </div>

      <div style={styles.joinCard}>
        <div style={styles.joinTitle}>Pick the 3 symbols in order</div>
        <div style={styles.slots}>
          {[0, 1, 2].map(i => (
            <div key={i} style={styles.slotWrapper}>
              <div style={{
                ...styles.slot,
                borderColor: selectedSymbols[i] ? '#60a5fa' : '#333',
              }}>
                {selectedSymbols[i]
                  ? <SymbolIcon sym={selectedSymbols[i]} size="28px" />
                  : <span style={{ color: '#444', fontSize: '18px' }}>?</span>}
              </div>
              <div style={styles.symbolGrid}>
                {LOBBY_SYMBOLS.map(s => (
                  <button
                    key={s.id}
                    onClick={() => handleSymbolPick(i, s.id)}
                    style={{
                      ...styles.symbolBtn,
                      background: selectedSymbols[i] === s.id ? '#1e3a5f' : 'transparent',
                      borderColor: selectedSymbols[i] === s.id ? '#60a5fa' : '#222',
                    }}
                    title={s.label}
                  >
                    <SymbolIcon sym={s.id} size="18px" />
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {error && <div style={styles.errorMsg}>{error}</div>}

        <button
          onClick={handleJoin}
          disabled={joinBusy || selectedSymbols.some(s => !s)}
          style={{
            ...styles.btn,
            opacity: selectedSymbols.some(s => !s) ? 0.5 : 1,
          }}
        >
          {joinBusy ? 'Joining...' : 'Join Lobby'}
        </button>
      </div>
    </div>
  );
}

const dotAnimation = `
@keyframes bounce {
  0%, 80%, 100% { transform: scale(0); }
  40% { transform: scale(1); }
}
`;

const styles = {
  page: {
    display: 'flex', flexDirection: 'column', gap: '16px',
    padding: '16px 16px 80px', minHeight: '100dvh',
  },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: '4px',
  },
  headerTitle: { fontSize: '18px', margin: 0, color: '#e0e0e0' },
  backBtn: {
    background: 'none', border: '1px solid #333', borderRadius: '8px',
    color: '#aaa', padding: '6px 12px', cursor: 'pointer', fontSize: '14px',
  },
  codeCard: {
    background: '#0f2a1a', border: '2px solid #4ade80', borderRadius: '16px',
    padding: '24px', textAlign: 'center', display: 'flex',
    flexDirection: 'column', alignItems: 'center', gap: '16px',
  },
  codeLabel: { color: '#86efac', fontSize: '13px', fontWeight: 'bold', textTransform: 'uppercase' },
  symbolRow: { display: 'flex', gap: '16px', justifyContent: 'center' },
  symbolBig: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
  },
  symbolName: { color: '#86efac', fontSize: '11px', textTransform: 'capitalize' },
  codeText: {
    color: '#4ade80', fontSize: '12px', fontFamily: 'monospace',
    background: '#0a1a0a', padding: '6px 14px', borderRadius: '8px',
  },
  waitingBox: {
    background: '#111827', border: '1px solid #1f2937', borderRadius: '14px',
    padding: '28px', textAlign: 'center', display: 'flex',
    flexDirection: 'column', alignItems: 'center', gap: '10px',
  },
  waitingDots: { display: 'flex', gap: '8px', alignItems: 'center', height: '20px' },
  dot: {
    width: '10px', height: '10px', background: '#4ade80', borderRadius: '50%',
    display: 'inline-block',
    animation: 'bounce 1.2s infinite ease-in-out',
  },
  waitingText: { color: '#e0e0e0', fontSize: '15px', margin: 0 },
  waitingHint: { color: '#6b7280', fontSize: '12px', margin: 0 },
  matchedBox: {
    background: '#0f2a1a', border: '2px solid #4ade80', borderRadius: '14px',
    padding: '28px', textAlign: 'center', display: 'flex',
    flexDirection: 'column', alignItems: 'center', gap: '10px',
  },
  matchedText: { color: '#4ade80', fontSize: '18px', fontWeight: 'bold' },
  countdown: { color: '#86efac', fontSize: '32px', fontWeight: 'bold' },
  joinCard: {
    background: '#111827', border: '1.5px solid #374151', borderRadius: '14px',
    padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px',
  },
  joinTitle: { color: '#e0e0e0', fontSize: '15px', fontWeight: 'bold', textAlign: 'center' },
  slots: { display: 'flex', gap: '10px', justifyContent: 'center' },
  slotWrapper: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', flex: 1 },
  slot: {
    width: '52px', height: '52px', borderRadius: '10px', border: '2px solid',
    background: '#1f2937', display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  symbolGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '4px', width: '100%',
  },
  symbolBtn: {
    padding: '6px', borderRadius: '6px', border: '1px solid',
    cursor: 'pointer', lineHeight: 1,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  btn: {
    padding: '14px', borderRadius: '10px', border: 'none',
    background: '#6366f1', color: 'white', fontSize: '15px',
    fontWeight: 'bold', cursor: 'pointer', width: '100%',
  },
  errorMsg: {
    background: '#1c0a0a', border: '1px solid #7f1d1d', borderRadius: '8px',
    color: '#ef4444', padding: '12px', fontSize: '13px', textAlign: 'center',
  },
};
```

- [ ] **Step 3: Update PlayTogether.jsx**

In `frontend/src/components/PlayTogether.jsx`, make these changes:

3a. Replace the import block at the top (lines 9-16, the symbol-related imports) and the `SYMBOLS` array (lines 20-30) and `SymbolDisplay` / `getSymbolLabel` functions (lines 32-41):

```jsx
// Remove these imports:
// import meatImg from '../assets/items/meat.png';
// import berryImg from '../assets/items/berry.png';
// import paintImg from '../assets/items/paint.png';
// import partyHatImg from '../assets/hats/partyhat.png';
// import cowboyHatImg from '../assets/hats/cowboyhat.png';
// import topHatImg from '../assets/hats/tophat.png';
// import sunglassesImg from '../assets/hats/sunglasses.png';

// Remove the SYMBOLS array (lines 20-30)
// Remove SymbolDisplay function (lines 32-36)
// Remove getSymbolLabel function (lines 39-41)

// Add at top of file (after other imports):
import { LOBBY_SYMBOLS } from '../data/lobbySymbols.js';

function SymbolDisplay({ sym, size = '28px' }) {
  const s = LOBBY_SYMBOLS.find(s => s.id === sym);
  if (!s) return <span style={{ color: '#444' }}>?</span>;
  return <img src={s.img} style={{ width: size, height: size, imageRendering: 'pixelated' }} />;
}

function getSymbolLabel(id) {
  return LOBBY_SYMBOLS.find(s => s.id === id)?.label || id;
}
```

3b. In the JSX where `SYMBOLS.map(s => ...)` renders the symbol picker buttons (around line 417), replace with:

```jsx
{LOBBY_SYMBOLS.map(s => (
```

(The existing code uses `SYMBOLS` — replace with `LOBBY_SYMBOLS`. The rest of the map body stays the same since `s.id`, `s.img`, `s.label` are identical.)

- [ ] **Step 4: Verify lobby flow**

In dev server, navigate to `/play`. Expected: Host and Join buttons show Gamepad2 / Handshake icons. Hint shows Lightbulb icon. Symbol picker shows 4 item images (2×2 grid) instead of 9 emoji. No emoji anywhere. The "A friend joined!" state shows PartyPopper icon.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/PlayMenu.jsx frontend/src/components/PlayLobby.jsx frontend/src/components/PlayTogether.jsx
git commit -m "feat: replace emoji with icons in lobby components, use 4-item symbol set"
```

---

## Task 8: Update PlayTrivia.jsx

**Files:**
- Modify: `frontend/src/components/PlayTrivia.jsx`

- [ ] **Step 1: Replace full file**

```jsx
import { useState, useEffect, useRef } from 'preact/hooks';
import { store } from '../store.js';
import { useStore } from '../router.jsx';
import { api } from '../api.js';
import { ws } from '../ws.js';
import { Footprints, CheckCircle2, XCircle, Zap, Crown } from 'lucide-preact';

const RECENT_PLAYS_KEY = 'dino_party_recent_plays';
const COOLDOWN_MS = 15 * 60 * 1000;

function saveCooldown(withName) {
  try {
    const existing = JSON.parse(localStorage.getItem(RECENT_PLAYS_KEY) || '[]');
    const entry = { withName, expiresAt: Date.now() + COOLDOWN_MS };
    const filtered = existing.filter(e => e.expiresAt > Date.now() && e.withName !== withName);
    localStorage.setItem(RECENT_PLAYS_KEY, JSON.stringify([entry, ...filtered].slice(0, 10)));
  } catch {
    // ignore
  }
}

function DinoDisplay({ player }) {
  const dino = player?.dinos?.find(d => d.is_partner && d.tamed);
  const name = dino?.name || dino?.species || 'Your Dino';

  return (
    <div style={styles.dinoBox}>
      <Footprints size={52} style={styles.dinoIcon} />
      <div style={styles.dinoName}>{name}</div>
      {dino && (
        <div style={styles.dinoLevel}>Lv{dino.level || 1}</div>
      )}
    </div>
  );
}

export function PlayTrivia({ code }) {
  const { player } = useStore();

  const [trivia, setTrivia] = useState(store.lobbyTrivia || null);
  const [answered, setAnswered] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [partnerName, setPartnerName] = useState('');

  useEffect(() => {
    ws.subscribe(`lobby:${code}`);

    const offTrivia = ws.on(`lobby:${code}`, 'trivia_start', (data) => {
      setTrivia({
        question: data.question,
        options: data.options,
      });
    });

    const offResult = ws.on(`lobby:${code}`, 'trivia_result', (data) => {
      setResult(data);
      setAnswered(true);
    });

    return () => {
      offTrivia();
      offResult();
    };
  }, [code]);

  async function handleAnswer(index) {
    if (answered || busy) return;
    setSelectedAnswer(index);
    setBusy(true);
    setError('');
    try {
      const data = await api.answerTrivia(store.playerId, code, index);
      setResult(data);
      setAnswered(true);
      saveCooldown(partnerName || 'A tamer');
      await store.refresh();
    } catch (err) {
      setError(err.message || 'Something went wrong');
      setSelectedAnswer(null);
    }
    setBusy(false);
  }

  function handleBackToPlaza() {
    store.lobbyRole = null;
    store.lobbyTrivia = null;
    store.navigate('/play');
  }

  if (!trivia) {
    return (
      <div style={styles.page}>
        <div style={styles.loadingBox}>
          <Footprints size={48} color="#86efac" style={{ marginBottom: '12px' }} />
          <p style={{ color: '#86efac' }}>Waiting for trivia question...</p>
          <button onClick={handleBackToPlaza} style={styles.ghostBtn}>
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.topHalf}>
        <div style={styles.dinosRow}>
          <DinoDisplay player={player} />
          <div style={styles.vsText}>VS</div>
          <div style={styles.dinoBox}>
            <Footprints size={52} style={styles.dinoIcon} />
            <div style={styles.dinoName}>Partner</div>
            <div style={styles.dinoLevel}>Friend</div>
          </div>
        </div>
        <div style={styles.playingLabel}>Playing Together!</div>
        <style>{hopAnimation}</style>
      </div>

      <div style={styles.bottomHalf}>
        {!answered ? (
          <>
            <div style={styles.questionBox}>
              <div style={styles.questionLabel}>Dino Trivia</div>
              <div style={styles.questionText}>{trivia.question}</div>
            </div>

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
                  <span style={styles.answerLetter}>{String.fromCharCode(65 + i)}</span>
                  <span style={styles.answerText}>{option}</span>
                </button>
              ))}
            </div>

            {error && <div style={styles.errorMsg}>{error}</div>}
          </>
        ) : (
          <div style={styles.resultsBox}>
            <div style={{
              ...styles.resultBanner,
              background: result?.correct ? '#0f2a1a' : '#2a0f0f',
              borderColor: result?.correct ? '#4ade80' : '#ef4444',
            }}>
              <div style={styles.resultIcon}>
                {result?.correct
                  ? <CheckCircle2 size={40} color="#4ade80" />
                  : <XCircle size={40} color="#ef4444" />
                }
              </div>
              <div style={{
                ...styles.resultLabel,
                color: result?.correct ? '#4ade80' : '#ef4444',
              }}>
                {result?.correct ? 'Correct!' : 'Incorrect!'}
              </div>
              {!result?.correct && trivia.options && result?.correct_index !== undefined && (
                <div style={styles.correctAnswerText}>
                  Answer: {trivia.options[result.correct_index]}
                </div>
              )}
            </div>

            <div style={styles.rewardsCard}>
              <div style={styles.rewardsTitle}>Rewards</div>
              <div style={styles.rewardRow}>
                <Zap size={20} color="#f59e0b" style={{ flexShrink: 0 }} />
                <span style={styles.rewardText}>
                  +{result?.xp_awarded || 0} XP to your partner dino!
                </span>
              </div>
              {result?.hat && (
                <div style={styles.rewardRow}>
                  <Crown size={20} color="#f59e0b" style={{ flexShrink: 0 }} />
                  <span style={styles.rewardText}>
                    New hat: <strong style={{ color: '#f59e0b' }}>{result.hat}</strong>
                  </span>
                </div>
              )}
              {!result?.hat && (
                <div style={{ ...styles.rewardRow, opacity: 0.5 }}>
                  <Crown size={20} color="#f59e0b" style={{ flexShrink: 0 }} />
                  <span style={styles.rewardText}>No hat this time</span>
                </div>
              )}

              {player?.dinos?.find(d => d.is_partner && d.tamed) && (() => {
                const dino = player.dinos.find(d => d.is_partner && d.tamed);
                const lvl = dino.level || 1;
                const xp = dino.xp || 0;
                const pct = lvl >= 5 ? 100 : Math.min(100, Math.round(((xp % 100) / 100) * 100));
                return (
                  <div style={styles.xpSection}>
                    <div style={styles.xpLabel}>
                      {dino.name || dino.species} · Lv{lvl}{lvl >= 5 ? ' (MAX)' : ''}
                    </div>
                    <div style={styles.xpBarBg}>
                      <div style={{ ...styles.xpBarFill, width: `${pct}%` }} />
                    </div>
                    <div style={styles.xpNum}>{xp} XP</div>
                  </div>
                );
              })()}
            </div>

            <button onClick={handleBackToPlaza} style={styles.backBtn}>
              Back to Play Menu
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const hopAnimation = `
@keyframes hop {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-12px); }
}
`;

const styles = {
  page: {
    display: 'flex', flexDirection: 'column', minHeight: '100dvh',
    background: '#0a0f0a',
  },
  loadingBox: {
    flex: 1, display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', gap: '12px', padding: '40px',
  },
  topHalf: {
    background: '#0f2a1a', borderBottom: '2px solid #166534',
    padding: '24px 16px 16px', display: 'flex',
    flexDirection: 'column', alignItems: 'center', gap: '10px',
    flex: '0 0 auto',
  },
  dinosRow: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    gap: '20px', width: '100%',
  },
  dinoBox: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
  },
  dinoIcon: {
    color: '#4ade80',
    animation: 'hop 1s infinite ease-in-out',
  },
  dinoName: { color: '#86efac', fontSize: '12px', fontWeight: 'bold' },
  dinoLevel: { color: '#4ade80', fontSize: '11px' },
  vsText: { color: '#f59e0b', fontSize: '20px', fontWeight: 'bold', flexShrink: 0 },
  playingLabel: {
    color: '#4ade80', fontSize: '13px', fontWeight: 'bold',
    textTransform: 'uppercase', letterSpacing: '1px',
  },
  bottomHalf: {
    flex: 1, display: 'flex', flexDirection: 'column',
    gap: '14px', padding: '16px 16px 80px', overflow: 'auto',
  },
  questionBox: {
    background: '#111827', border: '1px solid #1f2937', borderRadius: '14px',
    padding: '18px',
  },
  questionLabel: {
    color: '#6b7280', fontSize: '11px', fontWeight: 'bold',
    textTransform: 'uppercase', marginBottom: '8px',
  },
  questionText: { color: '#f3f4f6', fontSize: '16px', lineHeight: 1.5 },
  answersGrid: {
    display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px',
  },
  answerBtn: {
    display: 'flex', alignItems: 'center', gap: '10px',
    padding: '14px 12px', borderRadius: '10px', border: '2px solid',
    cursor: 'pointer', textAlign: 'left', transition: 'background 0.1s',
  },
  answerLetter: {
    width: '24px', height: '24px', borderRadius: '50%',
    background: '#374151', color: '#e0e0e0', display: 'flex',
    alignItems: 'center', justifyContent: 'center',
    fontSize: '12px', fontWeight: 'bold', flexShrink: 0,
  },
  answerText: { color: '#e0e0e0', fontSize: '13px', lineHeight: 1.3 },
  errorMsg: {
    background: '#1c0a0a', border: '1px solid #7f1d1d', borderRadius: '8px',
    color: '#ef4444', padding: '12px', fontSize: '13px', textAlign: 'center',
  },
  resultsBox: {
    display: 'flex', flexDirection: 'column', gap: '14px',
  },
  resultBanner: {
    borderRadius: '14px', border: '2px solid',
    padding: '20px', textAlign: 'center',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px',
  },
  resultIcon: { lineHeight: 1 },
  resultLabel: { fontSize: '22px', fontWeight: 'bold' },
  correctAnswerText: { color: '#9ca3af', fontSize: '13px', marginTop: '4px' },
  rewardsCard: {
    background: '#111827', border: '1px solid #1f2937', borderRadius: '14px',
    padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px',
  },
  rewardsTitle: {
    color: '#9ca3af', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase',
  },
  rewardRow: { display: 'flex', alignItems: 'center', gap: '10px' },
  rewardText: { color: '#e0e0e0', fontSize: '14px' },
  xpSection: {
    borderTop: '1px solid #1f2937', paddingTop: '10px',
    display: 'flex', flexDirection: 'column', gap: '6px',
  },
  xpLabel: { color: '#86efac', fontSize: '13px' },
  xpBarBg: { height: '8px', background: '#1f2937', borderRadius: '4px', overflow: 'hidden' },
  xpBarFill: { height: '100%', background: '#4ade80', borderRadius: '4px', transition: 'width 0.4s' },
  xpNum: { color: '#6b7280', fontSize: '11px', textAlign: 'right' },
  backBtn: {
    padding: '14px', borderRadius: '10px', border: 'none',
    background: '#166534', color: '#4ade80', fontSize: '15px',
    fontWeight: 'bold', cursor: 'pointer', width: '100%',
  },
  ghostBtn: {
    padding: '12px', borderRadius: '10px', border: '1px solid #333',
    background: 'none', color: '#aaa', fontSize: '14px',
    cursor: 'pointer', width: '100%',
  },
};
```

- [ ] **Step 2: Verify**

Navigate to `/play`, host a lobby. In the trivia screen: dino icons are Footprints, loading state shows Footprints, correct/incorrect shows CheckCircle2/XCircle, rewards show Zap and Crown. No emoji.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/PlayTrivia.jsx
git commit -m "feat: replace emoji with icons in PlayTrivia"
```

---

## Task 9: Update BossBanner.jsx, BossFight.jsx, BossVictory.jsx

**Files:**
- Modify: `frontend/src/components/BossBanner.jsx`
- Modify: `frontend/src/components/BossFight.jsx`
- Modify: `frontend/src/components/BossVictory.jsx`

- [ ] **Step 1: Update BossBanner.jsx**

Two emoji to replace:
- `💥` in `TremorsOverlay` → `<Flame size={48} />`
- `🦎` in `RoarOverlay` → `<Zap />`

Replace the two occurrences:

In `TremorsOverlay`, replace:
```jsx
<div style={{ fontSize: '48px', marginTop: '16px' }}>💥</div>
```
With:
```jsx
<Flame size={48} color="#ffaa00" style={{ marginTop: '16px' }} />
```

In `RoarOverlay`, replace:
```jsx
<div class="roar-text" style={{ ...styles.roarSubText, animationDelay: '0.3s' }}>
  🦎 GODZILLA IS COMING! 🦎
</div>
```
With:
```jsx
<div class="roar-text" style={{ ...styles.roarSubText, animationDelay: '0.3s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
  <Zap size={28} color="#ffdd00" /> GODZILLA IS COMING! <Zap size={28} color="#ffdd00" />
</div>
```

Add import at top of file:
```jsx
import { Flame, Zap } from 'lucide-preact';
```

- [ ] **Step 2: Update BossFight.jsx**

Replace the boss emoji display (line 122):
```jsx
// Before:
<div style={styles.bossEmoji} class={shaking ? 'boss-shake' : ''}>
  {isDefeated ? '💀' : '🦎'}
</div>

// After:
<div style={styles.bossEmoji} class={shaking ? 'boss-shake' : ''}>
  {isDefeated
    ? <Skull style={{ width: 'clamp(80px, 25vw, 160px)', height: 'clamp(80px, 25vw, 160px)', color: '#4ade80' }} />
    : <Zap style={{ width: 'clamp(80px, 25vw, 160px)', height: 'clamp(80px, 25vw, 160px)', color: '#ef4444' }} />
  }
</div>
```

Remove `fontSize` from `styles.bossEmoji` (it no longer applies to SVGs — the size is set inline via `clamp`).

```js
// Before:
bossEmoji: {
  fontSize: 'clamp(80px, 25vw, 160px)',
  lineHeight: 1,
  filter: 'drop-shadow(0 0 30px rgba(255,50,50,0.6))',
  transition: 'filter 0.2s',
},

// After:
bossEmoji: {
  lineHeight: 1,
  filter: 'drop-shadow(0 0 30px rgba(255,50,50,0.6))',
  transition: 'filter 0.2s',
},
```

Add import at top of file:
```jsx
import { Skull, Zap } from 'lucide-preact';
```

- [ ] **Step 3: Update BossVictory.jsx**

Replace `🏆` (line 75) and `🎩` (line 82):

```jsx
// Before:
<div style={styles.victoryEmoji}>🏆</div>

// After:
<Trophy size={72} color="#4ade80" style={{ marginBottom: '8px' }} />
```

```jsx
// Before:
<div class="hat-icon" style={styles.hatEmoji}>🎩</div>

// After:
<div class="hat-icon" style={styles.hatEmoji}>
  <Crown size={48} color="#facc15" />
</div>
```

Remove the `victoryEmoji` style entry (replaced by inline style on Trophy). Keep `hatEmoji` style as-is (it handles the bounce animation wrapper).

Add import at top of file:
```jsx
import { Trophy, Crown } from 'lucide-preact';
```

- [ ] **Step 4: Verify**

In admin panel (`/#admin`), trigger boss buildup phases. Expected: Phase 2 (tremors) shows Flame icon; Phase 3 (roar) shows Zap icons flanking "GODZILLA IS COMING!". On boss fight screen: living boss shows Zap icon; defeated boss shows Skull icon. Victory screen shows Trophy and Crown. No emoji.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/BossBanner.jsx frontend/src/components/BossFight.jsx frontend/src/components/BossVictory.jsx
git commit -m "feat: replace emoji with icons in Boss components"
```

---

## Task 10: Update InspirationScan.jsx and DinoTaming.jsx

**Files:**
- Modify: `frontend/src/components/InspirationScan.jsx`
- Modify: `frontend/src/components/DinoTaming.jsx`

- [ ] **Step 1: Update InspirationScan.jsx**

Three emoji to replace: ✨, 👑, 🎩.

Add import at top:
```jsx
import { Sparkles, Crown } from 'lucide-preact';
```

Replace `<div style={{ fontSize: '64px' }}>✨</div>` (already_received state):
```jsx
<Sparkles size={64} color="#f59e0b" />
```

Replace `<span style={{ fontSize: '20px' }}>🎩</span>` in already_received hat badge:
```jsx
<Crown size={20} color="#f59e0b" />
```

Replace the sparkle header in the main return (line 59):
```jsx
// Before:
<div style={styles.sparkle}>✨ ALEX'S INSPIRATION ✨</div>

// After:
<div style={styles.sparkle}>
  <Sparkles size={14} style={{ verticalAlign: 'middle' }} /> ALEX'S INSPIRATION <Sparkles size={14} style={{ verticalAlign: 'middle' }} />
</div>
```

Replace the crown portrait (line 62):
```jsx
// Before:
<span style={{ fontSize: '72px' }}>👑</span>

// After:
<Crown size={72} color="#c084fc" />
```

Replace `<span style={{ fontSize: '18px' }}>🎩</span>` in reward hat badge:
```jsx
<Crown size={18} color="#f59e0b" />
```

- [ ] **Step 2: Update DinoTaming.jsx**

One emoji to replace: `🎩` hat button icon (line 176).

Add import at top:
```jsx
import { Crown } from 'lucide-preact';
```

Replace:
```jsx
// Before:
<span style={{ fontSize: '22px' }}>🎩</span>

// After:
<Crown size={22} color="#aaa" />
```

- [ ] **Step 3: Verify**

Scan the inspiration QR code. Expected: Sparkles icons flank the header text, Crown icon in the portrait circle, Crown icon on hat reward. In DinoTaming hat picker: Crown icon on hat buttons. No emoji.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/InspirationScan.jsx frontend/src/components/DinoTaming.jsx
git commit -m "feat: replace emoji with icons in InspirationScan and DinoTaming"
```

---

## Task 11: Final verification

- [ ] **Step 1: Run backend tests one final time**

```bash
cd backend && pytest -v
```

Expected: All tests pass.

- [ ] **Step 2: Build frontend to check for import errors**

```bash
cd frontend && npm run build
```

Expected: Build completes with no errors. No unresolved imports from `lucide-preact`.

- [ ] **Step 3: Grep for remaining emoji in component files**

```bash
grep -rn --include="*.jsx" --include="*.js" -P "[\x{1F300}-\x{1F9FF}]|[\x{2600}-\x{26FF}]|[\x{2700}-\x{27BF}]" frontend/src/components/ frontend/src/data/
```

Expected: No matches (or only matches in comments/strings that are intentionally kept).

- [ ] **Step 4: Commit if any straggler fixes needed, else final summary commit**

```bash
git add -A
git commit -m "feat: complete emoji-to-icons migration"
```
