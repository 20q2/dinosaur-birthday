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
    this._defeated = false;

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

  // ── Layout ────────────────────────────────────────────────────────────────

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
    // Recompute slot positions after geometry change
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

  _positionSlot(slot) {
    const g = this._geo;
    if (!g.ellipseCX) return; // geometry not yet computed
    slot.sx = g.ellipseCX + Math.cos(slot.slotAngle) * g.ellipseRX;
    slot.sy = g.ellipseCY + Math.sin(slot.slotAngle) * g.ellipseRY;

    // depthT: 0 = top of ellipse (far), 1 = bottom (near)
    const topY   = g.ellipseCY - g.ellipseRY;
    const rangeY = g.ellipseRY * 2;
    slot.depthT  = Math.max(0, Math.min(1, (slot.sy - topY) / rangeY));

    const level      = slot.partner.level || 1;
    const levelScale = SCALE_MIN + ((level - 1) / (MAX_LEVEL - 1)) * (SCALE_MAX - SCALE_MIN);
    slot.drawScale   = (DEPTH_SCALE_FAR + (DEPTH_SCALE_NEAR - DEPTH_SCALE_FAR) * slot.depthT) * BASE_SPRITE_SCALE * levelScale;

    // Face inward toward center
    slot.facingLeft = slot.sx > g.ellipseCX;
  }

  // ── Photo cache ────────────────────────────────────────────────────────────

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

  // ── Slot construction ─────────────────────────────────────────────────────

  _makeSlot(partner, slotAngle, isMyDino) {
    const speciesData  = SPECIES[partner.species];
    const regions      = speciesData ? speciesData.regions : ['body', 'belly', 'stripes'];
    const spriteCanvas = getRecolored(partner.species, partner.colors || {}, regions);

    const photoUrl   = partner.owner_photo || '';
    const ownerPhoto = photoUrl ? this._loadPhoto(photoUrl) : null;

    return {
      partner,
      slotAngle,
      isMyDino,
      spriteCanvas,
      ownerPhoto,
      // Computed by _positionSlot (overwritten on first _layout call)
      sx: 0, sy: 0, depthT: 0, drawScale: 1, facingLeft: false,
      // Idle animation
      hopPhase: Math.random() * Math.PI * 2,
      // Jump state: -1 = resting; >=0 = seconds elapsed since jump start
      jumpT: -1,
      jumpDuration: 0.45,
      jumpHeight: 0,
      // Plaza dino random jump timer (null for my dinos)
      nextRandomJump: isMyDino ? null : 6 + Math.random() * 12,
    };
  }

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

    const plazaArcStart = MY_ARC_END;
    const plazaArcSpan  = Math.PI * 2 - (MY_ARC_END - MY_ARC_START);
    this._plazaSlots = sorted.map((partner, i) => {
      const t     = sorted.length > 1 ? i / (sorted.length - 1) : 0.5;
      const angle = plazaArcStart + t * plazaArcSpan;
      return this._makeSlot(partner, angle, false);
    });

    // Initial position pass (may be NaN until _resize sets _geo — overwritten by _layout)
    this._mySlots.forEach(s   => this._positionSlot(s));
    this._plazaSlots.forEach(s => this._positionSlot(s));
  }

  // ── Public update methods ──────────────────────────────────────────────────

  updatePlazaDinos(partners) {
    const sorted = [...partners]
      .sort((a, b) => (b.level || 1) - (a.level || 1))
      .slice(0, 24);
    const plazaArcStart = MY_ARC_END;
    const plazaArcSpan  = Math.PI * 2 - (MY_ARC_END - MY_ARC_START);
    this._plazaSlots = sorted.map((partner, i) => {
      const t    = sorted.length > 1 ? i / (sorted.length - 1) : 0.5;
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

  triggerAttack() {
    if (this._defeated) return;
    this._mySlots.forEach(slot => {
      slot.jumpT      = 0;
      slot.jumpHeight = (30 + slot.depthT * 30) * slot.drawScale;
    });
  }

  setShaking(active) {
    this.shaking    = active;
    this.shakeTimer = active ? 0.4 : 0;
  }

  setDefeated(active) {
    this._defeated = active;
  }

  // ── Start / Stop ──────────────────────────────────────────────────────────

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

  // ── Main draw loop ────────────────────────────────────────────────────────

  _draw(ts) {
    const ctx     = this.ctx;
    const g       = this._geo;
    if (!g.w) return;
    const elapsed = (ts - this.startTime) / 1000;
    const dt      = Math.min((ts - this.lastTs) / 1000, 0.1);
    this.lastTs   = ts;

    ctx.clearRect(0, 0, g.w, g.h);

    // Background gradient
    const grad = ctx.createRadialGradient(g.w / 2, g.h / 2, 0, g.w / 2, g.h / 2, Math.max(g.w, g.h) * 0.7);
    grad.addColorStop(0, '#1a0505');
    grad.addColorStop(1, '#0d0d0d');
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
    this._drawGodzilla(dt);

    // Draw particles (above Godzilla base, below near dinos)
    this._drawParticles();

    // Draw near dinos (in front of Godzilla)
    near.forEach(s => this._drawDino(s, elapsed, dt));
  }

  // ── Godzilla ──────────────────────────────────────────────────────────────

  _drawGodzilla(dt) {
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

    const imgW  = this.godzillaImg.naturalWidth  || 1;
    const imgH  = this.godzillaImg.naturalHeight || 1;
    const drawH = g.godzillaH;
    const drawW = (imgW / imgH) * drawH;
    const drawX = g.godzillaCX - drawW / 2 + shakeX;
    const drawY = g.godzillaCY - drawH / 2 + shakeY;

    ctx.save();
    ctx.filter = this._defeated
      ? 'grayscale(1) brightness(0.4) drop-shadow(0 0 16px rgba(74,222,128,0.5))'
      : 'drop-shadow(0 0 24px rgba(255,50,50,0.7))';
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.godzillaImg, drawX, drawY, drawW, drawH);
    ctx.restore();
  }

  // ── Dino rendering ────────────────────────────────────────────────────────

  _drawDino(slot, elapsed, dt) {
    const ctx = this.ctx;
    if (!slot.spriteCanvas) return;

    // Advance jump timer
    if (slot.jumpT >= 0) {
      slot.jumpT = Math.min(slot.jumpT + dt, slot.jumpDuration);
      if (slot.jumpT >= slot.jumpDuration) {
        slot.jumpT = -1;
        this._spawnPoof(slot);
      }
    }

    // Tick random jump timer for plaza dinos
    if (slot.nextRandomJump !== null) {
      slot.nextRandomJump -= dt;
      if (slot.nextRandomJump <= 0) {
        slot.jumpT          = 0;
        slot.jumpHeight     = (12 + slot.depthT * 16) * slot.drawScale;
        slot.nextRandomJump = 6 + Math.random() * 12;
      }
    }

    // Arc math
    const jumping = slot.jumpT >= 0;
    const t       = jumping ? slot.jumpT / slot.jumpDuration : 0;
    const sinT    = jumping ? Math.sin(t * Math.PI) : 0;
    const arcY    = jumping ? sinT * slot.jumpHeight : 0;
    const g       = this._geo;
    const dx      = jumping ? (g.godzillaCX - slot.sx) * 0.25 * sinT : 0;
    const dy      = jumping ? (g.godzillaCY - slot.sy) * 0.25 * sinT : 0;

    const idleHop = Math.sin(elapsed * 1.0 + slot.hopPhase) * 1.5 * slot.depthT;

    const drawX = slot.sx + dx;
    const drawY = slot.sy + dy - arcY - idleHop;

    const sc      = slot.drawScale;
    const spriteW = slot.spriteCanvas.width  * sc;
    const spriteH = slot.spriteCanvas.height * sc;
    const halfW   = spriteW / 2;
    const halfH   = spriteH / 2;

    // Ground shadow (at rest position)
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

  // ── Particles ─────────────────────────────────────────────────────────────

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
}
