# Play Together: Live Dino Scene — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the static Play Together screens with a unified split-screen view featuring a canvas dino scene at the top (your dino hops around, partner dino walks in when lobby is joined) and phase-driven UI below (menu → lobby → countdown → trivia → results).

**Architecture:** Single `PlayTogether.jsx` component with internal state machine manages all phases. A new `DinoPlayScene.jsx` canvas renders 1-2 dinos with gentle-drift movement, dust particles, and walk-in entrance animation. Backend `lobby.py` is updated to include partner dino data in the `trivia_start` WebSocket broadcast.

**Tech Stack:** Preact (JSX + hooks), HTML5 Canvas (2D), WebSocket (existing `ws.js`), Python/Lambda backend (existing DynamoDB + CDK)

---

## File Structure

### New files:
- `frontend/src/components/DinoPlayScene.jsx` — Lightweight canvas renderer for 1-2 dinos with gentle-drift AI, dust particles, drop shadows, hat rendering. Exposes imperative API via ref.
- `frontend/src/components/PlayTogether.jsx` — Unified play component replacing PlayMenu + PlayLobby + PlayTrivia. Internal state machine: menu → lobby → countdown → trivia → results.

### Modified files:
- `frontend/src/app.jsx` — Replace 3 play route imports/matches with single PlayTogether import + catch-all `/play` route
- `backend/src/handlers/lobby.py` — Add partner dino data fetch + include in `trivia_start` broadcast and join response
- `backend/tests/test_lobby.py` — Add test for partner dino data in join response

### Deprecated (no longer imported, can be deleted later):
- `frontend/src/components/PlayMenu.jsx`
- `frontend/src/components/PlayLobby.jsx`
- `frontend/src/components/PlayTrivia.jsx`

---

### Task 1: Backend — Include partner dino data in join response

**Files:**
- Modify: `backend/src/handlers/lobby.py:73-133`
- Test: `backend/tests/test_lobby.py`

- [ ] **Step 1: Write failing test for partner dino data in join response**

Add to `backend/tests/test_lobby.py` after the existing join tests (after line ~188):

```python
def test_join_lobby_returns_partner_dino_data():
    """Join response should include host_dino and guest_dino with species/colors/hat/name."""
    _make_profile("host_pd", "Alice")
    _make_profile("guest_pd", "Bob")
    _make_partner_dino("host_pd", "trex", xp=10, level=1)
    _make_partner_dino("guest_pd", "spinosaurus", xp=5, level=1)

    _make_lobby("meat_bone_hat", "host_pd")

    with patch("src.handlers.lobby.broadcast"):
        resp = join_lobby_handler(
            _join_event("meat_bone_hat", {"player_id": "guest_pd"}),
            None,
        )

    assert resp["statusCode"] == 200
    body = json.loads(resp["body"])

    # Both dino objects should be present
    assert "host_dino" in body
    assert "guest_dino" in body

    # Host dino should have the right shape
    hd = body["host_dino"]
    assert hd["species"] == "trex"
    assert "colors" in hd
    assert "hat" in hd
    assert "name" in hd

    # Guest dino should have the right shape
    gd = body["guest_dino"]
    assert gd["species"] == "spinosaurus"
    assert "colors" in gd
    assert "hat" in gd
    assert "name" in gd
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd a:/Coding/AlexBirthdayDinos/backend && python -m pytest tests/test_lobby.py::test_join_lobby_returns_partner_dino_data -v`

Expected: FAIL — `host_dino` not in response body.

- [ ] **Step 3: Implement partner dino fetch in join_lobby_handler**

In `backend/src/handlers/lobby.py`, replace lines 115-133 (the trivia fetch through the return statement) with:

```python
    trivia = lobby["trivia_question"]

    # Fetch both players' partner dinos for canvas rendering
    def _get_partner_dino(pid):
        dinos = query_pk(f"PLAYER#{pid}", "DINO#")
        partner = next((d for d in dinos if d.get("is_partner") and d.get("tamed")), None)
        if not partner:
            return {"species": "", "colors": {}, "hat": "", "name": ""}
        return {
            "species": partner["SK"].replace("DINO#", ""),
            "colors": partner.get("colors", {}),
            "hat": partner.get("hat", ""),
            "name": partner.get("name", ""),
        }

    host_dino = _get_partner_dino(host_id)
    guest_dino = _get_partner_dino(player_id)

    # Broadcast trivia to the lobby channel so both players receive it
    try:
        broadcast(f"lobby:{code}", "trivia_start", {
            "code": code,
            "question": trivia["question"],
            "options": trivia["options"],
            "host_dino": host_dino,
            "guest_dino": guest_dino,
        })
    except Exception:
        pass

    return success({
        "code": code,
        "trivia": {
            "question": trivia["question"],
            "options": trivia["options"],
        },
        "host_dino": host_dino,
        "guest_dino": guest_dino,
    })
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd a:/Coding/AlexBirthdayDinos/backend && python -m pytest tests/test_lobby.py -v`

Expected: ALL PASS including new test. Existing join test (`test_join_lobby_sets_guest_returns_trivia`) still passes since it only checks for `trivia` key.

- [ ] **Step 5: Commit**

```bash
cd a:/Coding/AlexBirthdayDinos
git add backend/src/handlers/lobby.py backend/tests/test_lobby.py
git commit -m "feat: include partner dino data in lobby join response and trivia_start broadcast"
```

---

### Task 2: DinoPlayScene canvas component — Core rendering

**Files:**
- Create: `frontend/src/components/DinoPlayScene.jsx`

This is the canvas component that renders 1-2 dinos with gentle-drift movement. It reuses the sprite rendering pipeline from PlazaCanvas.

- [ ] **Step 1: Create DinoPlayScene.jsx with canvas setup and single-dino rendering**

Create `frontend/src/components/DinoPlayScene.jsx`:

```jsx
import { useEffect, useRef, useImperativeHandle } from 'preact/hooks';
import { forwardRef } from 'preact/compat';
import { getRecolored } from '../utils/spriteEngine.js';
import { getHatImage, getHatAnchor } from '../data/hatImages.js';
import { SPECIES } from '../data/species.js';

const SCALE = 3;
const DRIFT_RANGE = 40;
const DRIFT_SPEED = 15;  // px/sec
const HOP_SPEED = 6;
const HOP_HEIGHT = 3;
const BREATHE_SPEED = 2;
const BREATHE_HEIGHT = 1;
const HEADING_LERP = 2.0;

function makeDino(data, homeX, homeY) {
  const regions = SPECIES[data.species]?.regions || ['body', 'belly', 'stripes'];
  return {
    data,
    sprite: getRecolored(data.species, data.colors || {}, regions),
    homeX,
    homeY,
    x: homeX,
    y: homeY,
    targetX: homeX,
    heading: 0,         // -1 left, 1 right
    facingRight: true,
    hopPhase: Math.random() * Math.PI * 2,
    moving: false,
    entering: false,
    exitTarget: null,
    idleTimer: 0,
  };
}

function pickDriftTarget(dino) {
  dino.targetX = dino.homeX + (Math.random() - 0.5) * 2 * DRIFT_RANGE;
  dino.moving = true;
}

function updateDino(dino, dt) {
  // Handle entrance walk-in
  if (dino.entering) {
    const dx = dino.homeX - dino.x;
    const step = DRIFT_SPEED * 3 * dt;
    if (Math.abs(dx) < step) {
      dino.x = dino.homeX;
      dino.entering = false;
      dino.moving = false;
      dino.idleTimer = 1 + Math.random() * 2;
    } else {
      dino.x += Math.sign(dx) * step;
      dino.moving = true;
    }
    dino.heading += ((-1) - dino.heading) * HEADING_LERP * dt;
    dino.facingRight = false;
    return;
  }

  // Handle exit walk-off
  if (dino.exitTarget !== null) {
    const dx = dino.exitTarget - dino.x;
    const step = DRIFT_SPEED * 3 * dt;
    if (Math.abs(dx) < step) {
      dino.x = dino.exitTarget;
      dino.moving = false;
    } else {
      dino.x += Math.sign(dx) * step;
      dino.moving = true;
    }
    dino.heading += ((1) - dino.heading) * HEADING_LERP * dt;
    dino.facingRight = true;
    return;
  }

  // Gentle drift AI
  if (!dino.moving) {
    dino.idleTimer -= dt;
    if (dino.idleTimer <= 0) {
      pickDriftTarget(dino);
    }
  } else {
    const dx = dino.targetX - dino.x;
    const step = DRIFT_SPEED * dt;
    if (Math.abs(dx) < step) {
      dino.x = dino.targetX;
      dino.moving = false;
      dino.idleTimer = 1.5 + Math.random() * 3;
    } else {
      dino.x += Math.sign(dx) * step;
      const dir = Math.sign(dx);
      dino.heading += (dir - dino.heading) * HEADING_LERP * dt;
      if (Math.abs(dino.heading) > 0.3) dino.facingRight = dino.heading > 0;
    }
  }
}

function drawDino(ctx, dino, elapsed, canvasW) {
  if (!dino.sprite) return;

  dino.hopPhase += (dino.moving ? HOP_SPEED : BREATHE_SPEED) * (1 / 60);

  const hopAmt = dino.moving
    ? Math.abs(Math.sin(dino.hopPhase)) * HOP_HEIGHT * SCALE
    : Math.sin(dino.hopPhase) * BREATHE_HEIGHT * SCALE * 0.5;

  const sw = dino.sprite.width * SCALE;
  const sh = dino.sprite.height * SCALE;

  const drawX = dino.x - sw / 2;
  const drawY = dino.y - sh + hopAmt;

  // Drop shadow
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(dino.x, dino.y + 2, sw * 0.3, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Draw sprite
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  if (!dino.facingRight) {
    ctx.translate(dino.x, 0);
    ctx.scale(-1, 1);
    ctx.translate(-dino.x, 0);
  }
  ctx.drawImage(dino.sprite, drawX, drawY, sw, sh);

  // Draw hat
  if (dino.data.hat) {
    const hatInfo = getHatImage(dino.data.hat);
    const hatAnchor = getHatAnchor(dino.data.species);
    if (hatInfo?.loaded) {
      const hatW = hatInfo.img.naturalWidth * SCALE;
      const hatH = hatInfo.img.naturalHeight * SCALE;
      const anchorDrawX = hatAnchor.x * SCALE;
      const anchorDrawY = (hatAnchor.y + hatInfo.offsetY) * SCALE;
      const hatX = drawX + anchorDrawX - hatW / 2;
      const hatY = drawY + anchorDrawY - hatH;
      ctx.drawImage(hatInfo.img, hatX, hatY, hatW, hatH);
    }
  }

  ctx.restore();
}

// Dust particles
function spawnDust(particles, dino) {
  if (!dino.moving) return;
  if (Math.random() > 0.15) return;
  particles.push({
    x: dino.x + (Math.random() - 0.5) * 6,
    y: dino.y,
    vx: (Math.random() - 0.5) * 10,
    vy: -Math.random() * 8,
    life: 0.4 + Math.random() * 0.3,
    maxLife: 0.4 + Math.random() * 0.3,
    size: 1.5 + Math.random() * 1.5,
  });
}

function updateParticles(particles, dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 15 * dt; // gravity
    p.life -= dt;
    if (p.life <= 0) particles.splice(i, 1);
  }
}

function drawParticles(ctx, particles) {
  for (const p of particles) {
    const alpha = Math.max(0, p.life / p.maxLife) * 0.4;
    ctx.fillStyle = `rgba(180,160,140,${alpha})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
}

export const DinoPlayScene = forwardRef(function DinoPlayScene(props, ref) {
  const canvasRef = useRef(null);
  const stateRef = useRef({
    myDino: null,
    partnerDino: null,
    particles: [],
    animId: 0,
    lastTime: 0,
  });

  useImperativeHandle(ref, () => ({
    setMyDino(data) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const homeX = canvas.width / 2 - 40;
      const homeY = canvas.height - 20;
      stateRef.current.myDino = makeDino(data, homeX, homeY);
    },
    setPartnerDino(data) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const homeX = canvas.width / 2 + 40;
      const homeY = canvas.height - 20;
      const dino = makeDino(data, homeX, homeY);
      // Start off-screen right and walk in
      dino.x = canvas.width + 60;
      dino.entering = true;
      stateRef.current.partnerDino = dino;
    },
    clearPartnerDino() {
      const pd = stateRef.current.partnerDino;
      if (pd) {
        const canvas = canvasRef.current;
        pd.exitTarget = (canvas?.width || 400) + 80;
      }
    },
  }));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    function resize() {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Update home positions when canvas resizes
      const s = stateRef.current;
      const w = rect.width;
      const h = rect.height;
      if (s.myDino) {
        s.myDino.homeX = w / 2 - 40;
        s.myDino.y = h - 20;
        s.myDino.homeY = h - 20;
      }
      if (s.partnerDino) {
        s.partnerDino.homeX = w / 2 + 40;
        s.partnerDino.y = h - 20;
        s.partnerDino.homeY = h - 20;
      }
    }
    resize();
    window.addEventListener('resize', resize);

    function loop(time) {
      const s = stateRef.current;
      const dt = Math.min((time - (s.lastTime || time)) / 1000, 0.1);
      s.lastTime = time;

      const w = canvas.getBoundingClientRect().width;
      const h = canvas.getBoundingClientRect().height;

      // Clear with gradient
      ctx.clearRect(0, 0, w, h);
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, '#0f1a2e');
      grad.addColorStop(1, '#0d1117');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // Update and draw
      if (s.myDino) {
        updateDino(s.myDino, dt);
        spawnDust(s.particles, s.myDino);
      }
      if (s.partnerDino) {
        updateDino(s.partnerDino, dt);
        spawnDust(s.particles, s.partnerDino);
        // Remove partner if exited off-screen
        if (s.partnerDino.exitTarget !== null && s.partnerDino.x >= s.partnerDino.exitTarget) {
          s.partnerDino = null;
        }
      }

      updateParticles(s.particles, dt);
      drawParticles(ctx, s.particles);

      if (s.myDino) drawDino(ctx, s.myDino, time / 1000, w);
      if (s.partnerDino) drawDino(ctx, s.partnerDino, time / 1000, w);

      s.animId = requestAnimationFrame(loop);
    }

    stateRef.current.animId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(stateRef.current.animId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: '100%',
        height: '200px',
        display: 'block',
      }}
    />
  );
});
```

- [ ] **Step 2: Verify the component renders without errors**

This is a canvas component — verify by importing it temporarily into app.jsx or by running the vite dev server and navigating to /play. For now, just ensure the build succeeds:

Run: `cd a:/Coding/AlexBirthdayDinos/frontend && npx vite build 2>&1 | tail -5`

Expected: Build succeeds (no import errors). The component isn't rendered yet — that comes in Task 3.

- [ ] **Step 3: Commit**

```bash
cd a:/Coding/AlexBirthdayDinos
git add frontend/src/components/DinoPlayScene.jsx
git commit -m "feat: DinoPlayScene canvas component with gentle-drift AI and dust particles"
```

---

### Task 3: PlayTogether unified component — Menu phase

**Files:**
- Create: `frontend/src/components/PlayTogether.jsx`
- Modify: `frontend/src/app.jsx:14-16,114-119,129`

Build the PlayTogether component with the menu phase first, then wire it into routing. The menu phase absorbs the current PlayMenu content.

- [ ] **Step 1: Create PlayTogether.jsx with menu phase**

Create `frontend/src/components/PlayTogether.jsx`. This absorbs the menu UI from PlayMenu.jsx — the Host/Join buttons, How It Works, cooldown display, and the symbol picker for joining. It renders the DinoPlayScene at the top and phase-specific UI below.

```jsx
import { useState, useEffect, useRef, useCallback } from 'preact/hooks';
import { store } from '../store.js';
import { useStore } from '../router.jsx';
import { api } from '../api.js';
import { ws } from '../ws.js';
import { DinoPlayScene } from './DinoPlayScene.jsx';
import { TitleBar } from './TitleBar.jsx';
import { SPECIES } from '../data/species.js';

import meatImg from '../assets/items/meat.png';
import berryImg from '../assets/items/berry.png';
import partyHatImg from '../assets/items/party_hat.png';
import cowboyHatImg from '../assets/items/cowboy_hat.png';
import topHatImg from '../assets/items/top_hat.png';
import sunglassesImg from '../assets/items/sunglasses.png';
import paintImg from '../assets/items/paint.png';
import boneImg from '../assets/items/bone.png';
import eggImg from '../assets/items/egg.png';

const COOLDOWN_MS = 15 * 60 * 1000;
const RECENT_PLAYS_KEY = 'dino_recent_plays';

const SYMBOLS = [
  { id: 'meat', emoji: '🥩', img: meatImg, label: 'Meat' },
  { id: 'mejoberry', emoji: '🫐', img: berryImg, label: 'Mejoberry' },
  { id: 'party_hat', emoji: '🎉', img: partyHatImg, label: 'Party Hat' },
  { id: 'cowboy_hat', emoji: '🤠', img: cowboyHatImg, label: 'Cowboy Hat' },
  { id: 'top_hat', emoji: '🎩', img: topHatImg, label: 'Top Hat' },
  { id: 'sunglasses', emoji: '😎', img: sunglassesImg, label: 'Sunglasses' },
  { id: 'paint', emoji: '🎨', img: paintImg, label: 'Paint' },
  { id: 'bone', emoji: '🦴', img: boneImg, label: 'Bone' },
  { id: 'egg', emoji: '🥚', img: eggImg, label: 'Egg' },
];

function getSymbolImg(id) {
  return SYMBOLS.find(s => s.id === id)?.img;
}

function getSymbolLabel(id) {
  return SYMBOLS.find(s => s.id === id)?.label || id;
}

function saveCooldown(partnerId) {
  try {
    const plays = JSON.parse(localStorage.getItem(RECENT_PLAYS_KEY) || '{}');
    plays[partnerId] = Date.now();
    localStorage.setItem(RECENT_PLAYS_KEY, JSON.stringify(plays));
  } catch {}
}

function getRecentPlays() {
  try {
    const plays = JSON.parse(localStorage.getItem(RECENT_PLAYS_KEY) || '{}');
    const now = Date.now();
    const active = {};
    for (const [id, ts] of Object.entries(plays)) {
      if (now - ts < COOLDOWN_MS) active[id] = ts;
    }
    return active;
  } catch { return {}; }
}

export function PlayTogether() {
  const { player } = useStore();
  const sceneRef = useRef(null);

  // Phase state machine
  const [phase, setPhase] = useState('menu');
  const [lobbyCode, setLobbyCode] = useState('');
  const [role, setRole] = useState(null); // 'host' | 'guest'
  const [trivia, setTrivia] = useState(null);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [result, setResult] = useState(null);
  const [partnerDinoData, setPartnerDinoData] = useState(null);
  const [countdown, setCountdown] = useState(3);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Symbol picker state (for joining)
  const [joinSymbols, setJoinSymbols] = useState([]);

  // Cooldown display
  const [recentPlays, setRecentPlays] = useState({});
  useEffect(() => {
    setRecentPlays(getRecentPlays());
    const iv = setInterval(() => setRecentPlays(getRecentPlays()), 10000);
    return () => clearInterval(iv);
  }, [phase]);

  // Initialize my dino in the scene
  useEffect(() => {
    const partner = player?.dinos?.find(d => d.is_partner && d.tamed);
    if (partner && sceneRef.current) {
      sceneRef.current.setMyDino({
        species: partner.species,
        colors: partner.colors || {},
        hat: partner.hat || '',
      });
    }
  }, [player]);

  const hasPartner = player?.dinos?.some(d => d.is_partner && d.tamed);

  // ── WebSocket subscription ──
  useEffect(() => {
    if (!lobbyCode) return;

    const unsub1 = ws.on(`lobby:${lobbyCode}`, 'trivia_start', (data) => {
      // Determine which dino is ours and which is the partner's
      const myDinoData = role === 'host' ? data.guest_dino : data.host_dino;
      if (myDinoData && sceneRef.current) {
        sceneRef.current.setPartnerDino(myDinoData);
        setPartnerDinoData(myDinoData);
      }
      setTrivia({ question: data.question, options: data.options });
      setPhase('countdown');
    });

    const unsub2 = ws.on(`lobby:${lobbyCode}`, 'trivia_result', (data) => {
      setResult(data);
      setPhase('results');
    });

    ws.subscribe(`lobby:${lobbyCode}`);

    return () => {
      unsub1();
      unsub2();
    };
  }, [lobbyCode, role]);

  // Countdown timer
  useEffect(() => {
    if (phase !== 'countdown') return;
    setCountdown(3);
    const iv = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(iv);
          setPhase('trivia');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(iv);
  }, [phase]);

  // ── Actions ──
  async function handleHost() {
    setLoading(true);
    setError('');
    try {
      const data = await api.createLobby(store.playerId);
      setLobbyCode(data.code);
      setRole('host');
      store.lobbyRole = 'host';
      setPhase('lobby');
    } catch (err) {
      setError(err.message || 'Failed to create lobby');
    }
    setLoading(false);
  }

  function handleStartJoin() {
    setJoinSymbols([]);
    setRole('guest');
    store.lobbyRole = 'guest';
    setPhase('lobby');
  }

  async function handleJoinSubmit() {
    if (joinSymbols.length !== 3) return;
    const code = joinSymbols.join('_');
    setLoading(true);
    setError('');
    try {
      const data = await api.joinLobby(store.playerId, code);
      setLobbyCode(code);
      store.lobbyTrivia = data.trivia;

      // Set partner dino from response
      const myPartnerDino = data.host_dino;
      if (myPartnerDino && sceneRef.current) {
        sceneRef.current.setPartnerDino(myPartnerDino);
        setPartnerDinoData(myPartnerDino);
      }

      setTrivia(data.trivia);
      setPhase('countdown');
    } catch (err) {
      setError(err.message || 'Failed to join lobby');
    }
    setLoading(false);
  }

  async function handleAnswer(index) {
    if (selectedAnswer !== null) return;
    setSelectedAnswer(index);
    try {
      const data = await api.answerTrivia(store.playerId, lobbyCode, index);
      // Save cooldown locally
      const partnerId = role === 'host' ? data.guest_dino?.owner : data.host_dino?.owner;
      if (partnerId) saveCooldown(partnerId);
      setResult(data);
      setPhase('results');
      await store.refresh();
    } catch (err) {
      setError(err.message || 'Failed to submit answer');
    }
  }

  function handleBackToMenu() {
    if (sceneRef.current) sceneRef.current.clearPartnerDino();
    setPhase('menu');
    setLobbyCode('');
    setRole(null);
    setTrivia(null);
    setSelectedAnswer(null);
    setResult(null);
    setPartnerDinoData(null);
    setError('');
    store.lobbyRole = null;
    store.lobbyTrivia = null;
  }

  // ── Render ──
  return (
    <div style={styles.page}>
      <TitleBar title="Play Together" subtitle="Team up with another dino tamer!" />

      {/* Dino scene — always visible */}
      <DinoPlayScene ref={sceneRef} />

      {/* Phase-specific UI */}
      <div style={styles.content}>
        {error && <div style={styles.errorBanner}>{error}</div>}

        {phase === 'menu' && (
          <MenuPhase
            hasPartner={hasPartner}
            loading={loading}
            recentPlays={recentPlays}
            onHost={handleHost}
            onJoin={handleStartJoin}
          />
        )}

        {phase === 'lobby' && role === 'host' && (
          <HostLobbyPhase
            code={lobbyCode}
            onCancel={handleBackToMenu}
          />
        )}

        {phase === 'lobby' && role === 'guest' && (
          <GuestLobbyPhase
            symbols={joinSymbols}
            setSymbols={setJoinSymbols}
            loading={loading}
            error={error}
            onSubmit={handleJoinSubmit}
            onCancel={handleBackToMenu}
          />
        )}

        {phase === 'countdown' && (
          <div style={styles.countdownOverlay}>
            <div style={styles.countdownText}>Get ready!</div>
            <div style={styles.countdownNumber}>{countdown}</div>
          </div>
        )}

        {phase === 'trivia' && trivia && (
          <TriviaPhase
            trivia={trivia}
            selectedAnswer={selectedAnswer}
            onAnswer={handleAnswer}
          />
        )}

        {phase === 'results' && result && (
          <ResultsPhase
            result={result}
            role={role}
            onBack={handleBackToMenu}
          />
        )}
      </div>
    </div>
  );
}

// ── Sub-components for each phase ──

function MenuPhase({ hasPartner, loading, recentPlays, onHost, onJoin }) {
  const cooldownEntries = Object.entries(recentPlays);

  return (
    <>
      {!hasPartner && (
        <div style={styles.partnerHint}>
          Set a dino as your Plaza Partner first to play!
        </div>
      )}

      <button
        onClick={onHost}
        disabled={loading || !hasPartner}
        style={{ ...styles.actionBtn, ...styles.hostBtn, opacity: hasPartner ? 1 : 0.5 }}
      >
        <div style={styles.actionBtnIcon}>🎮</div>
        <div>
          <div style={styles.actionBtnTitle}>Host a Lobby</div>
          <div style={styles.actionBtnSub}>Get a code, share with a friend</div>
        </div>
        <span style={styles.chevron}>›</span>
      </button>

      <button
        onClick={onJoin}
        disabled={loading || !hasPartner}
        style={{ ...styles.actionBtn, ...styles.joinBtn, opacity: hasPartner ? 1 : 0.5 }}
      >
        <div style={styles.actionBtnIcon}>💛</div>
        <div>
          <div style={styles.actionBtnTitle}>Join a Lobby</div>
          <div style={styles.actionBtnSub}>Enter a 3-symbol code</div>
        </div>
        <span style={styles.chevron}>›</span>
      </button>

      {cooldownEntries.length > 0 && (
        <div style={styles.cooldownSection}>
          <div style={styles.cooldownTitle}>Recent Plays</div>
          {cooldownEntries.map(([id, ts]) => {
            const remaining = Math.max(0, COOLDOWN_MS - (Date.now() - ts));
            const mins = Math.ceil(remaining / 60000);
            return (
              <div key={id} style={styles.cooldownRow}>
                <span style={{ color: '#9ca3af', fontSize: '13px' }}>{id}</span>
                <span style={{ color: '#f59e0b', fontSize: '13px' }}>{mins}m left</span>
              </div>
            );
          })}
        </div>
      )}

      <div style={styles.howItWorks}>
        <div style={styles.howTitle}>HOW IT WORKS</div>
        {[
          { num: '1', title: 'Pair up', desc: 'One player hosts, the other joins with the symbol code' },
          { num: '2', title: 'Answer trivia', desc: "While your dinos are off playing, you both get a dino trivia question — work together to answer correctly!" },
          { num: '3', title: 'Earn rewards', desc: 'Your Plaza Partner earns XP and you might get a hat drop' },
        ].map(step => (
          <div key={step.num} style={styles.step}>
            <div style={styles.stepNum}>{step.num}</div>
            <div>
              <div style={styles.stepTitle}>{step.title}</div>
              <div style={styles.stepDesc}>{step.desc}</div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function HostLobbyPhase({ code, onCancel }) {
  const symbols = code ? code.split('_') : [];

  return (
    <div style={styles.lobbyCard}>
      <div style={styles.lobbyTitle}>Your Code</div>
      <div style={styles.symbolRow}>
        {symbols.map((s, i) => (
          <div key={i} style={styles.symbolCard}>
            <img src={getSymbolImg(s)} style={styles.symbolImg} />
            <div style={styles.symbolLabel}>{getSymbolLabel(s)}</div>
          </div>
        ))}
      </div>
      <div style={styles.waitingText}>
        Waiting for a friend to join
        <span style={styles.dots}>...</span>
      </div>
      <button onClick={onCancel} style={styles.ghostBtn}>Cancel</button>
    </div>
  );
}

function GuestLobbyPhase({ symbols, setSymbols, loading, error, onSubmit, onCancel }) {
  function handlePick(id) {
    if (symbols.length >= 3) return;
    setSymbols([...symbols, id]);
  }

  function handleClear() {
    setSymbols([]);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={styles.lobbyTitle}>Enter the 3-symbol code</div>

      {/* Selected slots */}
      <div style={styles.symbolRow}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{ ...styles.symbolSlot, borderColor: symbols[i] ? '#4ade80' : '#333' }}>
            {symbols[i] ? (
              <img src={getSymbolImg(symbols[i])} style={styles.symbolImg} />
            ) : (
              <span style={{ color: '#555', fontSize: '20px' }}>?</span>
            )}
          </div>
        ))}
      </div>

      {/* Symbol grid */}
      <div style={styles.symbolGrid}>
        {SYMBOLS.map(s => (
          <button
            key={s.id}
            onClick={() => handlePick(s.id)}
            disabled={symbols.length >= 3}
            style={styles.symbolPickBtn}
          >
            <img src={s.img} style={{ width: '28px', height: '28px', imageRendering: 'pixelated' }} />
            <span style={{ fontSize: '10px', color: '#aaa' }}>{s.label}</span>
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          onClick={onSubmit}
          disabled={symbols.length !== 3 || loading}
          style={{ ...styles.primaryBtn, opacity: symbols.length === 3 ? 1 : 0.5, flex: 1 }}
        >
          {loading ? 'Joining...' : 'Join!'}
        </button>
        <button onClick={handleClear} style={{ ...styles.ghostBtn, flex: 0, padding: '12px 16px' }}>
          Clear
        </button>
      </div>
      <button onClick={onCancel} style={styles.ghostBtn}>Cancel</button>
    </div>
  );
}

function TriviaPhase({ trivia, selectedAnswer, onAnswer }) {
  const labels = ['A', 'B', 'C', 'D'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={styles.questionText}>{trivia.question}</div>
      {trivia.options.map((opt, i) => (
        <button
          key={i}
          onClick={() => onAnswer(i)}
          disabled={selectedAnswer !== null}
          style={{
            ...styles.answerBtn,
            borderColor: selectedAnswer === i ? '#4ade80' : '#333',
            background: selectedAnswer === i ? '#0f2a1a' : '#16213e',
            opacity: selectedAnswer !== null && selectedAnswer !== i ? 0.5 : 1,
          }}
        >
          <span style={styles.answerLabel}>{labels[i]}</span>
          <span>{opt}</span>
        </button>
      ))}
      {selectedAnswer !== null && (
        <div style={styles.waitingText}>Waiting for results...</div>
      )}
    </div>
  );
}

function ResultsPhase({ result, role, onBack }) {
  const isCorrect = result.correct;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', alignItems: 'center' }}>
      <div style={{
        ...styles.resultBanner,
        background: isCorrect ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
        borderColor: isCorrect ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)',
        color: isCorrect ? '#4ade80' : '#f87171',
      }}>
        {isCorrect ? '✅ Correct!' : '❌ Incorrect!'}
      </div>

      {!isCorrect && result.correct_index != null && (
        <div style={{ color: '#9ca3af', fontSize: '13px', textAlign: 'center' }}>
          The answer was: <strong>{String.fromCharCode(65 + result.correct_index)}</strong>
        </div>
      )}

      <div style={styles.rewardBox}>
        <div style={styles.rewardRow}>
          <span style={{ color: '#d1d5db' }}>XP Earned</span>
          <span style={{ color: '#f59e0b', fontWeight: 'bold' }}>+{result.xp_awarded} XP</span>
        </div>
        {result.reward && (
          <div style={styles.rewardRow}>
            <span style={{ color: '#d1d5db' }}>Reward</span>
            <span style={{ color: '#a78bfa', fontWeight: 'bold' }}>{result.reward}</span>
          </div>
        )}
      </div>

      <button onClick={onBack} style={styles.primaryBtn}>
        Back to Play
      </button>
    </div>
  );
}

// ── Styles ──

const styles = {
  page: {
    display: 'flex', flexDirection: 'column',
    background: 'linear-gradient(180deg, #0f1a2e 0%, #0a0f1a 40%, #0d1117 100%)',
    minHeight: '100vh', paddingBottom: '80px',
  },
  content: {
    display: 'flex', flexDirection: 'column', gap: '14px',
    padding: '16px 16px 40px',
  },
  errorBanner: {
    background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)',
    borderRadius: '10px', padding: '10px 14px',
    color: '#f87171', fontSize: '14px', textAlign: 'center',
  },

  // Menu phase
  partnerHint: {
    background: '#1c1508', border: '1px solid #78350f40', borderRadius: '10px',
    padding: '12px', color: '#f59e0b', fontSize: '13px', textAlign: 'center',
  },
  actionBtn: {
    display: 'flex', alignItems: 'center', gap: '12px',
    width: '100%', padding: '16px', borderRadius: '14px',
    border: '2px solid', cursor: 'pointer', textAlign: 'left',
  },
  hostBtn: {
    background: 'linear-gradient(135deg, #166534, #14532d)',
    borderColor: '#22c55e40', color: '#e0e0e0',
  },
  joinBtn: {
    background: 'linear-gradient(135deg, #1e3a5f, #16213e)',
    borderColor: '#6366f140', color: '#e0e0e0',
  },
  actionBtnIcon: { fontSize: '28px', width: '44px', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '12px', background: 'rgba(255,255,255,0.05)' },
  actionBtnTitle: { fontSize: '15px', fontWeight: 'bold', color: '#e0e0e0' },
  actionBtnSub: { fontSize: '12px', color: '#9ca3af', marginTop: '2px' },
  chevron: { marginLeft: 'auto', fontSize: '24px', color: '#555' },

  // Lobby phase
  lobbyCard: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px',
    padding: '20px', borderRadius: '14px',
    background: 'rgba(22,33,62,0.8)', border: '1px solid #333',
  },
  lobbyTitle: { fontSize: '16px', fontWeight: 'bold', color: '#e0e0e0', textAlign: 'center' },
  symbolRow: { display: 'flex', gap: '12px', justifyContent: 'center' },
  symbolCard: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px',
    padding: '12px', borderRadius: '12px',
    background: '#166534', border: '2px solid #22c55e60',
    minWidth: '72px',
  },
  symbolImg: { width: '36px', height: '36px', imageRendering: 'pixelated' },
  symbolLabel: { fontSize: '11px', color: '#86efac', fontWeight: '600' },
  symbolSlot: {
    width: '64px', height: '64px', borderRadius: '12px',
    border: '2px solid #333', background: '#0d1117',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  symbolGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px',
  },
  symbolPickBtn: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
    padding: '10px 6px', borderRadius: '10px',
    border: '2px solid #333', background: '#16213e',
    cursor: 'pointer',
  },
  waitingText: {
    color: '#9ca3af', fontSize: '14px', textAlign: 'center',
  },
  dots: { animation: 'none' },

  // Countdown
  countdownOverlay: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', gap: '8px', padding: '40px 0',
  },
  countdownText: { fontSize: '18px', color: '#e0e0e0', fontWeight: '600' },
  countdownNumber: { fontSize: '64px', fontWeight: '900', color: '#4ade80' },

  // Trivia phase
  questionText: {
    fontSize: '18px', color: '#e5e7eb', fontWeight: '600',
    textAlign: 'center', lineHeight: '1.5', padding: '8px 0',
  },
  answerBtn: {
    display: 'flex', alignItems: 'center', gap: '12px',
    width: '100%', padding: '14px 16px', borderRadius: '12px',
    border: '2px solid #333', background: '#16213e',
    color: '#e0e0e0', fontSize: '15px', cursor: 'pointer',
    textAlign: 'left',
  },
  answerLabel: {
    width: '28px', height: '28px', borderRadius: '8px',
    background: 'rgba(255,255,255,0.08)', display: 'flex',
    alignItems: 'center', justifyContent: 'center',
    fontSize: '13px', fontWeight: 'bold', color: '#888', flexShrink: 0,
  },

  // Results phase
  resultBanner: {
    padding: '14px 24px', borderRadius: '12px',
    border: '1px solid', fontSize: '18px', fontWeight: 'bold',
  },
  rewardBox: {
    background: '#111827', border: '1px solid #1e293b', borderRadius: '12px',
    padding: '14px 18px', width: '100%', maxWidth: '320px',
    display: 'flex', flexDirection: 'column', gap: '8px',
  },
  rewardRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    fontSize: '14px',
  },

  // Shared
  primaryBtn: {
    padding: '16px', borderRadius: '12px', border: 'none',
    background: '#22c55e', color: 'white', fontSize: '16px',
    fontWeight: 'bold', cursor: 'pointer', width: '100%', maxWidth: '320px',
  },
  ghostBtn: {
    padding: '12px', borderRadius: '10px', border: '1px solid #333',
    background: 'none', color: '#aaa', fontSize: '14px',
    cursor: 'pointer', width: '100%',
  },

  // How It Works
  howItWorks: {
    background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: '14px', padding: '16px', marginTop: '4px',
  },
  howTitle: { fontSize: '12px', fontWeight: '800', color: '#888', letterSpacing: '1.5px', marginBottom: '12px' },
  step: { display: 'flex', gap: '12px', marginBottom: '12px' },
  stepNum: {
    width: '24px', height: '24px', borderRadius: '50%',
    background: '#166534', color: '#4ade80', fontSize: '12px', fontWeight: 'bold',
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  stepTitle: { fontSize: '14px', fontWeight: 'bold', color: '#e0e0e0' },
  stepDesc: { fontSize: '12px', color: '#9ca3af', lineHeight: '1.4', marginTop: '2px' },

  // Cooldown
  cooldownSection: {
    background: '#111827', borderRadius: '10px', padding: '12px',
    display: 'flex', flexDirection: 'column', gap: '6px',
  },
  cooldownTitle: { fontSize: '12px', fontWeight: 'bold', color: '#666', textTransform: 'uppercase' },
  cooldownRow: { display: 'flex', justifyContent: 'space-between' },
};
```

- [ ] **Step 2: Update app.jsx routing**

In `frontend/src/app.jsx`, replace the 3 play-related imports (lines 14-16) with:

```javascript
import { PlayTogether } from './components/PlayTogether.jsx';
```

Remove the PlayLobby and PlayTrivia route matches (lines 115-119):

```javascript
  const playLobby = route.match(/^\/play\/lobby\/([^/]+)$/);
  if (playLobby) return <PlayLobby code={playLobby[1]} />;

  const playTrivia = route.match(/^\/play\/trivia\/([^/]+)$/);
  if (playTrivia) return <PlayTrivia code={playTrivia[1]} />;
```

And change the `/play` case (line 129) from `<PlayMenu />` to `<PlayTogether />`:

```javascript
    case '/play': return <PlayTogether />;
```

Also add a catch-all for any `/play/...` sub-route to render PlayTogether (in case someone deep-links):

```javascript
  // Play routes — all handled by PlayTogether
  if (route.startsWith('/play')) return <PlayTogether />;
```

Place this before the `switch` statement.

- [ ] **Step 3: Verify the build succeeds**

Run: `cd a:/Coding/AlexBirthdayDinos/frontend && npx vite build 2>&1 | tail -5`

Expected: Build succeeds. If there are missing asset imports (e.g., bone.png, egg.png), check the actual asset filenames in `frontend/src/assets/items/` and fix the import paths.

- [ ] **Step 4: Commit**

```bash
cd a:/Coding/AlexBirthdayDinos
git add frontend/src/components/PlayTogether.jsx frontend/src/app.jsx
git commit -m "feat: unified PlayTogether component with all phases and DinoPlayScene integration"
```

---

### Task 4: Build, deploy, and verify

**Files:**
- No new files — build and deploy what we have

- [ ] **Step 1: Run backend tests**

Run: `cd a:/Coding/AlexBirthdayDinos/backend && python -m pytest tests/test_lobby.py -v`

Expected: ALL PASS

- [ ] **Step 2: Build frontend**

Run: `cd a:/Coding/AlexBirthdayDinos/frontend && npx vite build`

Expected: Build succeeds with no errors. Fix any import path issues (missing assets, wrong file names) if they arise.

- [ ] **Step 3: Deploy backend**

Run: `cd a:/Coding/AlexBirthdayDinos/infra && npx cdk deploy --require-approval never 2>&1 | tail -20`

Expected: Stack deploys successfully.

- [ ] **Step 4: Commit any build fixes**

If any fixes were needed for the build:

```bash
cd a:/Coding/AlexBirthdayDinos
git add -A
git commit -m "fix: resolve build issues for play together feature"
```

---

### Task 5: Manual testing checklist

No code changes — verify the feature works end-to-end.

- [ ] **Step 1: Verify menu phase**

Navigate to `/play`. Confirm:
- Dino scene at top shows your partner dino hopping with gentle drift
- Host/Join buttons appear below
- How It Works section renders
- If no partner set, buttons are disabled with hint text

- [ ] **Step 2: Verify host lobby**

Click "Host a Lobby". Confirm:
- Symbol code displays in green cards
- "Waiting for a friend to join" text shows
- Dino continues hopping in scene above
- Cancel returns to menu

- [ ] **Step 3: Verify join and trivia flow (requires two browsers/devices)**

From a second player, join the lobby code. Confirm:
- Partner dino walks in from right side of canvas on BOTH screens
- 3-second countdown appears
- Trivia question with 4 answer buttons renders
- Answering shows results with XP and reward
- "Back to Play" clears partner dino and returns to menu

---
