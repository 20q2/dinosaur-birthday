# Boss Fight Arena Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the placeholder Zap-icon boss fight screen with a Pokemon-GO-raid-style arena: Godzilla looms large in the background, all plaza dinos ring the middle ground, and the player's tamed dinos occupy a larger front arc — lunging toward Godzilla on every tap.

**Architecture:** A new `BossFightCanvas.js` class handles all canvas rendering (Godzilla sprite, ellipse-arranged dinos with depth scaling, jump animations, particles). `BossFight.jsx` is modified to mount this canvas, preload `godzilla.png`, fetch plaza partners, and wire the tap handler to trigger the attack animation before the API call resolves.

**Tech Stack:** Preact 10, Canvas 2D API, existing `getRecolored()`/`getHatImage()`/`getHatAnchor()` sprite utilities from `spriteEngine.js` / `hatImages.js`

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `frontend/src/components/BossFightCanvas.js` | **Create** | Full canvas rendering engine: layout, sprite slots, Y-sort draw, depth scale, jump/idle animations, particles, Godzilla shake |
| `frontend/src/components/BossFight.jsx` | **Modify** | Mount canvas, preload godzilla image, fetch plaza data + WS, normalize myDinos, wire triggerAttack/setShaking, remove Zap icon |

---

## Task 1: Create BossFightCanvas.js — constructor, layout geometry, start/stop

**Files:**
- Create: `frontend/src/components/BossFightCanvas.js`

- [ ] **Step 1: Create the file with imports, constants, and constructor**

```js
// frontend/src/components/BossFightCanvas.js
import { getRecolored } from '../utils/spriteEngine.js';
import { SPECIES } from '../data/species.js';
import { getHatImage, getHatAnchor } from '../data/hatImages.js';

const BASE_SPRITE_SCALE = 1.25;
const SCALE_MIN = 0.7;
const SCALE_MAX = 1.5;
const MAX_LEVEL = 5;

// Depth: dinos at top of ellipse (far) vs bottom (near)
const DEPTH_SCALE_FAR  = 0.45;
const DEPTH_SCALE_NEAR = 1.25;

// My-dino arc: bottom portion of ellipse, in radians
// 0 = right, PI/2 = bottom, PI = left
const MY_ARC_START = (Math.PI / 2) - (Math.PI * 0.45); // ~80°
const MY_ARC_END   = (Math.PI / 2) + (Math.PI * 0.45); // ~100° span

export class BossFightCanvas {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {{
   *   plazaDinos: object[],
   *   myDinos: object[],
   *   godzillaImg: HTMLImageElement,
   * }} opts
   */
  constructor(canvas, { plazaDinos, myDinos, godzillaImg }) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.godzillaImg = godzillaImg;
    this.rafId = null;
    this.startTime = performance.now();
    this.lastTs = this.startTime;
    this.shaking = false;
    this.shakeTimer = 0;
    this._photoCache = new Map();
    this.particles = [];

    // Dino slot arrays (populated by _buildSlots)
    this._mySlots = [];
    this._plazaSlots = [];

    // Arena geometry (populated by _layout)
    this._geo = {};

    this._buildSlots(plazaDinos, myDinos);
    this._resize();

    this._boundResize = () => this._resize();
    window.addEventListener('resize', this._boundResize);
  }
```

- [ ] **Step 2: Add `_layout()` and `_resize()`**

```js
  _layout() {
    const w = this.canvas.width;
    const h = this.canvas.height;
    this._geo = {
      w, h,
      godzillaCX:  w * 0.5,
      godzillaCY:  h * 0.30,
      godzillaH:   h * 0.52,
      ellipseCX:   w * 0.5,
      ellipseCY:   h * 0.55,
      ellipseRX:   w * 0.42,
      ellipseRY:   h * 0.20,
    };
    // Recompute slot positions
    this._mySlots.forEach(s   => this._positionSlot(s));
    this._plazaSlots.forEach(s => this._positionSlot(s));
  }

  _resize() {
    const parent = this.canvas.parentElement;
    if (!parent) return;
    this.canvas.width  = parent.clientWidth  || window.innerWidth;
    this.canvas.height = parent.clientHeight || window.innerHeight;
    this._layout();
  }
```

- [ ] **Step 3: Add slot position helper `_positionSlot()`**

```js
  _positionSlot(slot) {
    const g = this._geo;
    slot.sx = g.ellipseCX + Math.cos(slot.slotAngle) * g.ellipseRX;
    slot.sy = g.ellipseCY + Math.sin(slot.slotAngle) * g.ellipseRY;

    // depthT: 0 = top of ellipse (far), 1 = bottom (near)
    const topY    = g.ellipseCY - g.ellipseRY;
    const rangeY  = g.ellipseRY * 2;
    slot.depthT   = Math.max(0, Math.min(1, (slot.sy - topY) / rangeY));

    const level       = slot.partner.level || 1;
    const levelScale  = SCALE_MIN + ((level - 1) / (MAX_LEVEL - 1)) * (SCALE_MAX - SCALE_MIN);
    slot.drawScale    = (DEPTH_SCALE_FAR + (DEPTH_SCALE_NEAR - DEPTH_SCALE_FAR) * slot.depthT) * BASE_SPRITE_SCALE * levelScale;

    // Face inward toward center
    slot.facingLeft = slot.sx > g.ellipseCX;
  }
```

- [ ] **Step 4: Add `start()` and `stop()` / `destroy()`**

```js
  start() {
    this.lastTs = performance.now();
    const loop = (ts) => {
      this._draw(ts);
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  stop() {
    if (this.rafId) { cancelAnimationFrame(this.rafId); this.rafId = null; }
  }

  destroy() {
    this.stop();
    window.removeEventListener('resize', this._boundResize);
  }
}
```

- [ ] **Step 5: Commit**

```bash
cd frontend
git add src/components/BossFightCanvas.js
git commit -m "feat: add BossFightCanvas skeleton with layout geometry"
```

---

## Task 2: Build dino slot initialization

**Files:**
- Modify: `frontend/src/components/BossFightCanvas.js`

- [ ] **Step 1: Add `_loadPhoto()` helper (copy pattern from PlazaCanvas)**

Add before `constructor` closes, after `_positionSlot`:

```js
  _loadPhoto(url) {
    if (this._photoCache.has(url)) return this._photoCache.get(url);
    const entry = { img: new Image(), loaded: false, failed: false };
    entry.img.crossOrigin = 'anonymous';
    entry.img.onload  = () => { entry.loaded = true; };
    entry.img.onerror = () => { entry.failed = true; };
    entry.img.src = url;
    this._photoCache.set(url, entry);
    return entry;
  }
```

- [ ] **Step 2: Add `_makeSlot()` — creates a single slot object from a partner**

```js
  _makeSlot(partner, slotAngle, isMyDino) {
    const speciesData = SPECIES[partner.species];
    const regions     = speciesData ? speciesData.regions : ['body', 'belly', 'stripes'];
    const spriteCanvas = getRecolored(partner.species, partner.colors || {}, regions);

    const photoUrl  = partner.owner_photo || '';
    const ownerPhoto = photoUrl ? this._loadPhoto(photoUrl) : null;

    return {
      partner,
      slotAngle,
      isMyDino,
      spriteCanvas,
      ownerPhoto,
      // Computed by _positionSlot (placeholder values overwritten immediately)
      sx: 0, sy: 0, depthT: 0, drawScale: 1, facingLeft: false,
      // Idle animation
      hopPhase: Math.random() * Math.PI * 2,
      // Jump state
      jumpT: -1,          // -1 = resting; >=0 = jumping (seconds elapsed)
      jumpDuration: 0.45,
      jumpHeight: 0,      // set in triggerAttack / random jump
      // Plaza dino random jump timer
      nextRandomJump: isMyDino ? null : 6 + Math.random() * 12,
    };
  }
```

- [ ] **Step 3: Add `_buildSlots()` — assigns angle slots for my dinos and plaza dinos**

```js
  _buildSlots(plazaDinos, myDinos) {
    // ── My dinos: bottom arc [MY_ARC_START, MY_ARC_END]
    this._mySlots = myDinos.map((partner, i) => {
      const t     = myDinos.length > 1 ? i / (myDinos.length - 1) : 0.5;
      const angle = MY_ARC_START + t * (MY_ARC_END - MY_ARC_START);
      return this._makeSlot(partner, angle, true);
    });

    // ── Plaza dinos: rest of the ellipse, capped at 24, sorted by level desc
    const sorted = [...plazaDinos]
      .sort((a, b) => (b.level || 1) - (a.level || 1))
      .slice(0, 24);

    // Available angles: full circle MINUS the my-dino arc
    // Split remaining arc into two halves: [MY_ARC_END → MY_ARC_START + 2PI]
    const plazaArcStart = MY_ARC_END;
    const plazaArcSpan  = Math.PI * 2 - (MY_ARC_END - MY_ARC_START);
    this._plazaSlots = sorted.map((partner, i) => {
      const t     = sorted.length > 1 ? i / (sorted.length - 1) : 0.5;
      const angle = plazaArcStart + t * plazaArcSpan;
      return this._makeSlot(partner, angle, false);
    });

    // Position all slots (needs _geo, which _resize sets)
    this._mySlots.forEach(s   => this._positionSlot(s));
    this._plazaSlots.forEach(s => this._positionSlot(s));
  }
```

- [ ] **Step 4: Add `updatePlazaDinos()` and `updateMyDinos()` public methods**

```js
  updatePlazaDinos(partners) {
    const sorted = [...partners]
      .sort((a, b) => (b.level || 1) - (a.level || 1))
      .slice(0, 24);
    const plazaArcStart = MY_ARC_END;
    const plazaArcSpan  = Math.PI * 2 - (MY_ARC_END - MY_ARC_START);
    this._plazaSlots = sorted.map((partner, i) => {
      const t     = sorted.length > 1 ? i / (sorted.length - 1) : 0.5;
      const angle = plazaArcStart + t * plazaArcSpan;
      const slot  = this._makeSlot(partner, angle, false);
      this._positionSlot(slot);
      return slot;
    });
  }

  updateMyDinos(dinos) {
    this._mySlots = dinos.map((partner, i) => {
      const t     = dinos.length > 1 ? i / (dinos.length - 1) : 0.5;
      const angle = MY_ARC_START + t * (MY_ARC_END - MY_ARC_START);
      const slot  = this._makeSlot(partner, angle, true);
      this._positionSlot(slot);
      return slot;
    });
  }
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/BossFightCanvas.js
git commit -m "feat: add BossFightCanvas dino slot initialization"
```

---

## Task 3: Render loop — background, Godzilla, dinos

**Files:**
- Modify: `frontend/src/components/BossFightCanvas.js`

- [ ] **Step 1: Add `_draw()` main loop method**

```js
  _draw(ts) {
    const ctx     = this.ctx;
    const g       = this._geo;
    const elapsed = (ts - this.startTime) / 1000;
    const dt      = Math.min((ts - this.lastTs) / 1000, 0.1);
    this.lastTs   = ts;

    ctx.clearRect(0, 0, g.w, g.h);

    // Background gradient
    const grad = ctx.createRadialGradient(g.w / 2, g.h / 2, 0, g.w / 2, g.h / 2, Math.max(g.w, g.h) * 0.7);
    grad.addColorStop(0,   '#1a0505');
    grad.addColorStop(1,   '#0d0d0d');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.w, g.h);

    // Update particles
    this._updateParticles(dt);

    // Y-sort all slots; split into far (sy < ellipseCY) and near (sy >= ellipseCY)
    const all  = [...this._plazaSlots, ...this._mySlots].sort((a, b) => a.sy - b.sy);
    const far  = all.filter(s => s.sy <  g.ellipseCY);
    const near = all.filter(s => s.sy >= g.ellipseCY);

    // Draw far dinos (behind Godzilla)
    far.forEach(s => this._drawDino(s, elapsed, dt));

    // Draw Godzilla
    this._drawGodzilla(elapsed, dt);

    // Draw particles (above ground, below near dinos)
    this._drawParticles();

    // Draw near dinos (in front of Godzilla)
    near.forEach(s => this._drawDino(s, elapsed, dt));
  }
```

- [ ] **Step 2: Add `_drawGodzilla()`**

```js
  _drawGodzilla(elapsed, dt) {
    const ctx = this.ctx;
    const g   = this._geo;
    if (!this.godzillaImg || !this.godzillaImg.complete) return;

    // Shake offset
    let shakeX = 0, shakeY = 0;
    if (this.shaking) {
      this.shakeTimer -= dt;
      if (this.shakeTimer <= 0) {
        this.shaking = false;
      } else {
        const intensity = (this.shakeTimer / 0.4) * 7;
        shakeX = (Math.random() - 0.5) * 2 * intensity;
        shakeY = (Math.random() - 0.5) * 2 * intensity;
      }
    }

    const imgW = this.godzillaImg.naturalWidth  || 1;
    const imgH = this.godzillaImg.naturalHeight || 1;
    const drawH = g.godzillaH;
    const drawW = (imgW / imgH) * drawH;
    const drawX = g.godzillaCX - drawW / 2 + shakeX;
    const drawY = g.godzillaCY - drawH / 2 + shakeY;

    ctx.save();
    ctx.filter = 'drop-shadow(0 0 24px rgba(255,50,50,0.7))';
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.godzillaImg, drawX, drawY, drawW, drawH);
    ctx.restore();
  }
```

- [ ] **Step 3: Add `_drawDino()` — renders sprite + hat at slot position**

```js
  _drawDino(slot, elapsed, dt) {
    const ctx = this.ctx;
    if (!slot.spriteCanvas) return;

    // Update jump timer
    if (slot.jumpT >= 0) {
      slot.jumpT = Math.min(slot.jumpT + dt, slot.jumpDuration);
      if (slot.jumpT >= slot.jumpDuration) {
        slot.jumpT = -1;
        this._spawnPoof(slot);
      }
    }

    // Update random jump timer for plaza dinos
    if (slot.nextRandomJump !== null) {
      slot.nextRandomJump -= dt;
      if (slot.nextRandomJump <= 0) {
        slot.jumpT      = 0;
        slot.jumpHeight = (12 + slot.depthT * 16) * slot.drawScale;
        slot.nextRandomJump = 6 + Math.random() * 12;
      }
    }

    // Compute draw position
    const t    = slot.jumpT >= 0 ? slot.jumpT / slot.jumpDuration : 0;
    const arcY = slot.jumpT >= 0 ? Math.sin(t * Math.PI) * slot.jumpHeight : 0;
    const g    = this._geo;
    const dx   = slot.jumpT >= 0 ? (g.godzillaCX - slot.sx) * 0.25 * Math.sin(t * Math.PI) : 0;
    const dy   = slot.jumpT >= 0 ? (g.godzillaCY - slot.sy) * 0.25 * Math.sin(t * Math.PI) : 0;

    const idleHop = Math.sin(elapsed * 1.0 + slot.hopPhase) * 1.5 * slot.depthT;

    const drawX = slot.sx + dx;
    const drawY = slot.sy + dy - arcY - idleHop;

    const sc      = slot.drawScale;
    const spriteW = slot.spriteCanvas.width  * sc;
    const spriteH = slot.spriteCanvas.height * sc;
    const halfW   = spriteW / 2;
    const halfH   = spriteH / 2;

    // Shadow
    ctx.save();
    ctx.globalAlpha = 0.18 * slot.depthT + 0.05;
    ctx.fillStyle   = '#000';
    ctx.beginPath();
    ctx.ellipse(slot.sx, slot.sy + halfH * 0.85, halfW * 0.7, halfH * 0.15, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Sprite (sprites face left by default; flip for right-facing)
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    if (!slot.facingLeft) {
      ctx.translate(drawX, drawY);
      ctx.scale(-1, 1);
      ctx.drawImage(slot.spriteCanvas, -halfW, -halfH, spriteW, spriteH);
    } else {
      ctx.drawImage(slot.spriteCanvas, drawX - halfW, drawY - halfH, spriteW, spriteH);
    }
    ctx.restore();

    // Hat
    if (slot.partner.hat) {
      const hatInfo   = getHatImage(slot.partner.hat);
      const hatAnchor = getHatAnchor(slot.partner.species);
      if (hatInfo?.loaded) {
        const hatW        = hatInfo.img.naturalWidth  * sc;
        const hatH        = hatInfo.img.naturalHeight * sc;
        const anchorDrawX = (hatAnchor.x + (hatInfo.offsetX || 0)) * sc;
        const anchorDrawY = (hatAnchor.y + hatInfo.offsetY) * sc;
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        if (!slot.facingLeft) {
          ctx.translate(drawX, drawY);
          ctx.scale(-1, 1);
          ctx.drawImage(hatInfo.img, -halfW + anchorDrawX - hatW / 2, -halfH + anchorDrawY - hatH, hatW, hatH);
        } else {
          ctx.drawImage(hatInfo.img, drawX - halfW + anchorDrawX - hatW / 2, drawY - halfH + anchorDrawY - hatH, hatW, hatH);
        }
        ctx.restore();
      }
    }
  }
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/BossFightCanvas.js
git commit -m "feat: add BossFightCanvas render loop — background, Godzilla, dinos"
```

---

## Task 4: Particles and public attack/shake API

**Files:**
- Modify: `frontend/src/components/BossFightCanvas.js`

- [ ] **Step 1: Add `_spawnPoof()`, `_updateParticles()`, `_drawParticles()`**

```js
  _spawnPoof(slot) {
    const footY = slot.sy + (slot.spriteCanvas ? slot.spriteCanvas.height * slot.drawScale * 0.38 : 12);
    const count = 7 + Math.floor(Math.random() * 5);
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.4;
      const speed = 20 + Math.random() * 28;
      const ttl   = 0.3 + Math.random() * 0.2;
      this.particles.push({
        x: slot.sx + (Math.random() - 0.5) * 8,
        y: footY,
        vx: Math.cos(angle) * speed * 3.5,
        vy: Math.sin(angle) * speed * 0.3 - 14,
        life: ttl, maxLife: ttl,
        size: 3 + Math.random() * 4,
      });
    }
  }

  _updateParticles(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) { this.particles.splice(i, 1); continue; }
      p.x  += p.vx * dt;
      p.y  += p.vy * dt;
      p.vx *= 0.9;
      p.vy *= 0.9;
    }
  }

  _drawParticles() {
    const ctx = this.ctx;
    for (const p of this.particles) {
      ctx.save();
      ctx.globalAlpha = (p.life / p.maxLife) * 0.65;
      ctx.fillStyle   = '#e9c46a';
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
```

- [ ] **Step 2: Add `triggerAttack()` and `setShaking()` public methods**

```js
  triggerAttack() {
    this._mySlots.forEach(slot => {
      slot.jumpT      = 0;
      slot.jumpHeight = (30 + slot.depthT * 30) * slot.drawScale;
    });
  }

  setShaking(active) {
    this.shaking   = active;
    this.shakeTimer = active ? 0.4 : 0;
  }
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/BossFightCanvas.js
git commit -m "feat: add BossFightCanvas particles, triggerAttack, setShaking"
```

---

## Task 5: Wire BossFight.jsx

**Files:**
- Modify: `frontend/src/components/BossFight.jsx`

- [ ] **Step 1: Replace imports at the top of BossFight.jsx**

Current imports:
```js
import { useEffect, useRef, useState } from 'preact/hooks';
import { api } from '../api.js';
import { store } from '../store.js';
import { useStore } from '../router.jsx';
import { Skull, Zap } from 'lucide-preact';
```

Replace with:
```js
import { useEffect, useRef, useState } from 'preact/hooks';
import { api } from '../api.js';
import { ws } from '../ws.js';
import { store } from '../store.js';
import { useStore } from '../router.jsx';
import { Skull } from 'lucide-preact';
import { BossFightCanvas } from './BossFightCanvas.js';
import godzillaUrl from '../assets/sprites/godzilla.png';
```

- [ ] **Step 2: Add new state and refs inside `BossFight()`, after existing state**

Find the line `const lastTapRef = useRef(0);` and add below it:

```js
  const canvasRef     = useRef(null);
  const arenaRef      = useRef(null);   // BossFightCanvas instance
  const godzImgRef    = useRef(null);   // preloaded Image
  const [plazaPartners, setPlazaPartners] = useState([]);
```

- [ ] **Step 3: Add useEffect to preload godzilla.png and mount the canvas**

Add after the existing `useEffect` blocks (after the `bossState?.status === 'defeated'` effect):

```js
  // Preload Godzilla image then mount canvas
  useEffect(() => {
    const img = new Image();
    img.src = godzillaUrl;
    godzImgRef.current = img;

    const init = () => {
      if (!canvasRef.current) return;
      const myDinos = (player?.dinos ?? [])
        .filter(d => d.tamed)
        .map(d => ({
          ...d,
          player_id:   playerId,
          owner_name:  player?.name,
          owner_photo: player?.photo_url,
        }));

      const arena = new BossFightCanvas(canvasRef.current, {
        plazaDinos: [],
        myDinos,
        godzillaImg: img,
      });
      arenaRef.current = arena;
      arena.start();
    };

    if (img.complete) {
      init();
    } else {
      img.onload = init;
    }

    return () => {
      if (arenaRef.current) { arenaRef.current.destroy(); arenaRef.current = null; }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
```

- [ ] **Step 4: Add useEffect to push plaza partner updates into the arena**

```js
  // Fetch plaza partners and listen for live updates
  useEffect(() => {
    api.getPlaza().then(data => {
      const partners = data.partners || [];
      setPlazaPartners(partners);
      if (arenaRef.current) arenaRef.current.updatePlazaDinos(partners);
    }).catch(() => {});

    const offArrive = ws.on('plaza', 'dino_arrive', (data) => {
      setPlazaPartners(prev => {
        const updated = [...prev.filter(p => p.player_id !== data.player_id), data];
        if (arenaRef.current) arenaRef.current.updatePlazaDinos(updated);
        return updated;
      });
    });
    const offLeave = ws.on('plaza', 'dino_leave', (data) => {
      setPlazaPartners(prev => {
        const updated = prev.filter(p => p.player_id !== data.player_id);
        if (arenaRef.current) arenaRef.current.updatePlazaDinos(updated);
        return updated;
      });
    });

    return () => { offArrive(); offLeave(); };
  }, []);
```

- [ ] **Step 5: Add useEffect to keep myDinos in sync when player changes**

```js
  // Keep my dinos in sync with player state
  useEffect(() => {
    if (!arenaRef.current || !player) return;
    const myDinos = (player.dinos ?? [])
      .filter(d => d.tamed)
      .map(d => ({
        ...d,
        player_id:   playerId,
        owner_name:  player.name,
        owner_photo: player.photo_url,
      }));
    arenaRef.current.updateMyDinos(myDinos);
  }, [player, playerId]);
```

- [ ] **Step 6: Update `handleTap` to call `triggerAttack()` and update shaking**

Replace the existing `handleTap` function:

```js
  const handleTap = async (e) => {
    const now = Date.now();
    if (now - lastTapRef.current < TAP_THROTTLE_MS) return;
    lastTapRef.current = now;

    if (!playerId) return;

    // Trigger attack animation immediately (before API)
    if (arenaRef.current) arenaRef.current.triggerAttack();

    // Get tap coordinates for floating number
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX || e.touches?.[0]?.clientX || rect.width / 2) - rect.left;
    const y = (e.clientY || e.touches?.[0]?.clientY || rect.height / 2) - rect.top;

    try {
      const result = await api.bossTap(playerId);
      const dmg    = result.damage ?? 0;
      const newHp  = result.hp ?? 0;

      setLocalHp(newHp);

      const id = ++idCounter.current;
      setDamageNumbers(prev => [...prev, { id, dmg, x, y }]);
      setTimeout(() => {
        setDamageNumbers(prev => prev.filter(n => n.id !== id));
      }, 1200);

      if (dmg >= 20) {
        if (arenaRef.current) arenaRef.current.setShaking(true);
        setTimeout(() => {
          if (arenaRef.current) arenaRef.current.setShaking(false);
        }, 400);
      }
    } catch {
      // Tap failed (throttled by server or fight over), ignore
    }
  };
```

- [ ] **Step 7: Replace the JSX — remove bossWrapper/bossEmoji, add canvas**

In the returned JSX, replace the `{/* Boss sprite */}` block:

```jsx
      {/* Boss sprite */}
      <div style={styles.bossWrapper}>
        <div style={styles.bossEmoji} class={shaking ? 'boss-shake' : ''}>
          {isDefeated
            ? <Skull style={{ width: 'clamp(80px, 25vw, 160px)', height: 'clamp(80px, 25vw, 160px)', color: '#4ade80' }} />
            : <Zap style={{ width: 'clamp(80px, 25vw, 160px)', height: 'clamp(80px, 25vw, 160px)', color: '#ef4444' }} />
          }
        </div>
      </div>
```

With:

```jsx
      {/* Arena canvas */}
      <canvas ref={canvasRef} style={styles.arenaCanvas} />
```

- [ ] **Step 8: Remove the bossShake CSS animation from the `<style>` block**

Find and remove these lines from the `<style>` string inside JSX:

```
        @keyframes bossShake {
          0%   { transform: translate(0, 0); }
          20%  { transform: translate(-6px, -4px); }
          40%  { transform: translate(6px, 4px); }
          60%  { transform: translate(-6px, 4px); }
          80%  { transform: translate(6px, -4px); }
          100% { transform: translate(0, 0); }
        }
        .boss-shake { animation: bossShake 0.4s ease-out; }
```

Also remove `shake` from the container's style spread — change:
```jsx
    <div
      style={{ ...styles.container, ...(shaking ? styles.shake : {}) }}
```
To:
```jsx
    <div
      style={styles.container}
```

And remove the `shaking` state variable and the `shake` style entry (they're no longer used — shaking is managed inside the canvas now).

- [ ] **Step 9: Update styles object — add arenaCanvas, remove bossWrapper/bossEmoji/shake**

Remove `bossWrapper`, `bossEmoji`, and `shake` from the `styles` object.

Add:
```js
  arenaCanvas: {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    display: 'block',
    pointerEvents: 'none',   // container handles taps
  },
```

Change `container` to use `position: 'relative'` and remove the `flex` layout (canvas fills inset):
```js
  container: {
    position: 'relative',
    width: '100%',
    height: '100dvh',
    background: 'radial-gradient(ellipse at center, #1a0505 0%, #0d0d0d 100%)',
    userSelect: 'none',
    WebkitUserSelect: 'none',
    cursor: 'crosshair',
    overflow: 'hidden',
  },
```

The JSX structure becomes three absolute layers inside the container:

```jsx
  return (
    <div
      style={styles.container}
      onClick={!isDefeated ? handleTap : undefined}
      onTouchStart={!isDefeated ? handleTap : undefined}
    >
      <style>{`
        @keyframes floatUp {
          0%   { opacity: 1; transform: translateY(0) scale(1); }
          50%  { opacity: 1; transform: translateY(-40px) scale(1.2); }
          100% { opacity: 0; transform: translateY(-80px) scale(0.8); }
        }
        @keyframes hpBarPulse {
          0%   { filter: brightness(1); }
          50%  { filter: brightness(1.3); }
          100% { filter: brightness(1); }
        }
        .dmg-float { animation: floatUp 1.2s ease-out forwards; position: absolute; pointer-events: none; }
        .hp-pulse  { animation: hpBarPulse 0.5s ease-in-out; }
      `}</style>

      {/* Arena canvas — full screen */}
      <canvas ref={canvasRef} style={styles.arenaCanvas} />

      {/* Header — top overlay */}
      <div style={styles.header}>
        <div style={styles.bossTitle}>GODZILLA ATTACKS!</div>
        <div style={styles.bossSubtitle}>Tap anywhere to fight back!</div>
      </div>

      {/* UI overlay — HP bar, stats, tap hint at bottom */}
      <div style={styles.uiOverlay}>
        <div style={styles.hpSection}>
          <div style={styles.hpLabel}>
            <span>GODZILLA HP</span>
            <span style={{ color: hpPct < 25 ? '#f87171' : '#4ade80' }}>
              {hp} / {max}
            </span>
          </div>
          <div style={styles.hpBarBg}>
            <div style={{
              ...styles.hpBarFill,
              width: `${hpPct}%`,
              background: hpPct < 25
                ? 'linear-gradient(90deg, #ef4444, #f87171)'
                : hpPct < 50
                  ? 'linear-gradient(90deg, #f59e0b, #fbbf24)'
                  : 'linear-gradient(90deg, #16a34a, #4ade80)',
            }} />
          </div>
        </div>
        <div style={styles.statsRow}>
          <div style={styles.statBox}>
            <div style={styles.statValue}>{playerDamage}</div>
            <div style={styles.statLabel}>Your DMG/tap</div>
          </div>
          <div style={styles.statBox}>
            <div style={styles.statValue}>{playerDinos.length}</div>
            <div style={styles.statLabel}>Tamed Dinos</div>
          </div>
          <div style={styles.statBox}>
            <div style={styles.statValue}>{totalLevels}</div>
            <div style={styles.statLabel}>Total Levels</div>
          </div>
        </div>
        {!isDefeated && <div style={styles.tapHint}>TAP TO ATTACK!</div>}
      </div>

      {/* Defeated overlay */}
      {isDefeated && (
        <div style={styles.defeatedOverlay}>
          <div style={styles.defeatedText}>DEFEATED!</div>
        </div>
      )}

      {/* Floating damage numbers */}
      {damageNumbers.map(({ id, dmg, x, y }) => (
        <div key={id} class="dmg-float" style={{
          left: x, top: y,
          fontSize: dmg >= 20 ? '32px' : '24px',
          fontWeight: 'bold',
          color: dmg >= 20 ? '#ffdd00' : '#ffffff',
          textShadow: '0 0 8px rgba(0,0,0,0.8)',
          zIndex: 100,
        }}>
          -{dmg}
        </div>
      ))}
    </div>
  );
```

Update the `styles` object — replace `bossWrapper`, `bossEmoji`, and `shake` with the new layout styles:
```js
  arenaCanvas: {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    display: 'block',
    pointerEvents: 'none',
  },
  header: {
    position: 'absolute',
    top: '20px',
    left: 0,
    right: 0,
    textAlign: 'center',
    pointerEvents: 'none',
    zIndex: 10,
  },
  uiOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: '12px 16px 24px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px',
    background: 'linear-gradient(to top, rgba(0,0,0,0.75) 0%, transparent 100%)',
    pointerEvents: 'none',
    zIndex: 10,
  },
```

- [ ] **Step 10: Commit**

```bash
git add frontend/src/components/BossFight.jsx
git commit -m "feat: wire BossFight.jsx to BossFightCanvas — arena, plaza fetch, attack animation"
```

---

## Task 6: Verify in dev server

**Files:** (none changed)

- [ ] **Step 1: Start the dev server**

```bash
cd frontend && npm run dev
```

Open http://localhost:3000/dinosaur-birthday/ in a browser.

- [ ] **Step 2: Navigate to boss fight**

In the URL bar go to `http://localhost:3000/dinosaur-birthday/#/boss` (or trigger boss start from admin panel at `#admin`).

Expected:
- Dark arena background fills the screen
- Godzilla sprite visible in upper-center with red glow
- Any tamed dinos visible in the lower arc
- Any plaza dinos visible in the mid ring (may be empty in dev)

- [ ] **Step 3: Tap the screen**

Expected:
- Tamed dinos jump toward Godzilla immediately on tap
- Floating damage number appears at tap position
- On a big hit (>=20 dmg), Godzilla shakes

- [ ] **Step 4: Check console for errors**

Expected: no errors in browser console. If any `getRecolored` or `getHatAnchor` calls fail, they will log there.

- [ ] **Step 5: Resize the window**

Expected: dinos and Godzilla reposition correctly at new canvas dimensions.

- [ ] **Step 6: Commit if any last fixes were made**

```bash
git add -p
git commit -m "fix: boss fight arena visual tweaks from dev review"
```

---

## Task 7: Handle defeated state on canvas

**Files:**
- Modify: `frontend/src/components/BossFightCanvas.js`
- Modify: `frontend/src/components/BossFight.jsx`

- [ ] **Step 1: Add `setDefeated()` to BossFightCanvas.js**

Add inside the class, after `setShaking()`:

```js
  setDefeated(active) {
    this._defeated = active;
  }
```

In `_drawGodzilla()`, after checking `!this.godzillaImg.complete`, add a desaturated overlay when defeated:

```js
  _drawGodzilla(elapsed, dt) {
    // ... existing shake/draw code ...
    ctx.save();
    // Desaturate on defeat
    ctx.filter = this._defeated
      ? 'grayscale(1) brightness(0.4) drop-shadow(0 0 16px rgba(74,222,128,0.5))'
      : 'drop-shadow(0 0 24px rgba(255,50,50,0.7))';
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.godzillaImg, drawX, drawY, drawW, drawH);
    ctx.restore();
  }
```

Also make `triggerAttack()` a no-op when defeated:

```js
  triggerAttack() {
    if (this._defeated) return;
    this._mySlots.forEach(slot => {
      slot.jumpT      = 0;
      slot.jumpHeight = (30 + slot.depthT * 30) * slot.drawScale;
    });
  }
```

In the constructor (Task 1), add `this._defeated = false;` after `this.particles = [];`.

- [ ] **Step 2: Call `setDefeated()` from BossFight.jsx when boss is defeated**

In the existing `useEffect` that navigates to victory:

```js
  useEffect(() => {
    if (bossState?.status === 'defeated') {
      if (arenaRef.current) arenaRef.current.setDefeated(true);
      setTimeout(() => store.navigate('/boss/victory'), 800);
    }
  }, [bossState?.status]);
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/BossFightCanvas.js frontend/src/components/BossFight.jsx
git commit -m "feat: boss fight canvas — defeated state desaturates Godzilla"
```
