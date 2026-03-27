import { getRecolored, getPlazaBackground } from '../utils/spriteEngine.js';
import { SPECIES } from '../data/species.js';

const BASE_SPRITE_SCALE = 2.5;
const SCALE_MIN = 1.0;
const SCALE_MAX = 1.4;
const MAX_LEVEL = 5;

const WORLD_W = 1200;
const WORLD_H = 1200;
const MIN_ZOOM = 0.4;
const MAX_ZOOM = 2.5;
const DRAG_THRESHOLD = 6;

export class PlazaCanvas {
  constructor(canvas, partners, onSelect) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.partners = partners;
    this.onSelect = onSelect;
    this.dinos = [];
    this.rafId = null;
    this.startTime = performance.now();

    // Camera state (world coordinates)
    this.camX = 0;
    this.camY = 0;
    this.zoom = 1;

    this._initDinos();
    this._resize();
    this._centerCamera();
    this._initInput();

    this._boundResize = () => this._resize();
    window.addEventListener('resize', this._boundResize);
  }

  // ── Initialization ────────────────────────────────────────────────────────

  _buildDinoData(partner, i, maxLevel, reuse) {
    const level = partner.level || 1;
    const scale = SCALE_MIN + ((level - 1) / (MAX_LEVEL - 1)) * (SCALE_MAX - SCALE_MIN);
    const isChampion = level === maxLevel;

    const speciesData = SPECIES[partner.species];
    const regions = speciesData ? speciesData.regions : ['body', 'belly', 'stripes'];
    const colors = partner.colors || {};
    const spriteCanvas = getRecolored(partner.species, colors, regions);

    const anim = reuse || {
      hopPhase: Math.random() * Math.PI * 2,
      hopSpeed: 1.5 + Math.random() * 1.0,
      driftAngle: Math.random() * Math.PI * 2,
      driftSpeed: 0.3 + Math.random() * 0.4,
      driftRadius: 20 + Math.random() * 30,
      driftCenterXFrac: 0.1 + Math.random() * 0.8,
      driftCenterYFrac: 0.1 + Math.random() * 0.8,
      sparklePhase: Math.random() * Math.PI * 2,
      worldX: 0,
      worldY: 0,
    };

    return {
      ...anim,
      partner,
      scale,
      isChampion,
      spriteCanvas,
    };
  }

  _initDinos() {
    const maxLevel = this.partners.reduce((m, p) => Math.max(m, p.level || 1), 1);
    this.dinos = this.partners.map((partner, i) =>
      this._buildDinoData(partner, i, maxLevel, null)
    );
  }

  _resize() {
    const parent = this.canvas.parentElement;
    if (!parent) return;
    const w = parent.clientWidth || window.innerWidth;
    const h = parent.clientHeight || window.innerHeight;
    this.canvas.width = w;
    this.canvas.height = h;
    this._clampCamera();
  }

  _centerCamera() {
    const vw = this.canvas.width / this.zoom;
    const vh = this.canvas.height / this.zoom;
    this.camX = (WORLD_W - vw) / 2;
    this.camY = (WORLD_H - vh) / 2;
    this._clampCamera();
  }

  _clampCamera() {
    // Ensure zoom can't go below what's needed to fill the viewport
    const minZoomW = this.canvas.width / WORLD_W;
    const minZoomH = this.canvas.height / WORLD_H;
    const dynamicMin = Math.max(minZoomW, minZoomH, MIN_ZOOM);
    if (this.zoom < dynamicMin) this.zoom = dynamicMin;
    if (this.zoom > MAX_ZOOM) this.zoom = MAX_ZOOM;

    const vw = this.canvas.width / this.zoom;
    const vh = this.canvas.height / this.zoom;
    this.camX = Math.max(0, Math.min(WORLD_W - vw, this.camX));
    this.camY = Math.max(0, Math.min(WORLD_H - vh, this.camY));
  }

  // ── Input handling ────────────────────────────────────────────────────────

  _initInput() {
    this.canvas.style.touchAction = 'none'; // prevent browser gestures

    const pointers = new Map();
    let dragStart = null;
    let didDrag = false;
    let lastPinchDist = 0;

    const onDown = (e) => {
      e.preventDefault();
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      this.canvas.setPointerCapture(e.pointerId);

      if (pointers.size === 1) {
        dragStart = { x: e.clientX, y: e.clientY, camX: this.camX, camY: this.camY };
        didDrag = false;
      } else if (pointers.size === 2) {
        const pts = [...pointers.values()];
        lastPinchDist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
        dragStart = null;
        didDrag = true;
      }
    };

    const onMove = (e) => {
      e.preventDefault();
      if (!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (pointers.size === 1 && dragStart) {
        const dx = e.clientX - dragStart.x;
        const dy = e.clientY - dragStart.y;
        if (!didDrag && (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD)) {
          didDrag = true;
        }
        if (didDrag) {
          this.camX = dragStart.camX - dx / this.zoom;
          this.camY = dragStart.camY - dy / this.zoom;
          this._clampCamera();
        }
      } else if (pointers.size === 2) {
        const pts = [...pointers.values()];
        const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
        const centerX = (pts[0].x + pts[1].x) / 2;
        const centerY = (pts[0].y + pts[1].y) / 2;

        if (lastPinchDist > 0) {
          const rect = this.canvas.getBoundingClientRect();
          const cx = centerX - rect.left;
          const cy = centerY - rect.top;

          // World point under pinch center before zoom
          const wx = this.camX + cx / this.zoom;
          const wy = this.camY + cy / this.zoom;

          this.zoom *= dist / lastPinchDist;
          this._clampCamera();

          // Keep same world point under pinch center
          this.camX = wx - cx / this.zoom;
          this.camY = wy - cy / this.zoom;
          this._clampCamera();
        }
        lastPinchDist = dist;
      }
    };

    const onUp = (e) => {
      pointers.delete(e.pointerId);

      if (pointers.size === 0) {
        if (!didDrag && dragStart) {
          const rect = this.canvas.getBoundingClientRect();
          const sx = e.clientX - rect.left;
          const sy = e.clientY - rect.top;
          this.handleTap(sx, sy);
        }
        dragStart = null;
        lastPinchDist = 0;
      } else if (pointers.size === 1) {
        // Went from 2 fingers to 1 — restart drag from current state
        const remaining = [...pointers.values()][0];
        dragStart = { x: remaining.x, y: remaining.y, camX: this.camX, camY: this.camY };
        lastPinchDist = 0;
      }
    };

    this.canvas.addEventListener('pointerdown', onDown);
    this.canvas.addEventListener('pointermove', onMove);
    this.canvas.addEventListener('pointerup', onUp);
    this.canvas.addEventListener('pointercancel', onUp);
    this._pointerHandlers = { onDown, onMove, onUp };

    // Desktop scroll-wheel zoom
    const onWheel = (e) => {
      e.preventDefault();
      const rect = this.canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      const wx = this.camX + mx / this.zoom;
      const wy = this.camY + my / this.zoom;

      const factor = e.deltaY > 0 ? 0.9 : 1.1;
      this.zoom *= factor;
      this._clampCamera();

      this.camX = wx - mx / this.zoom;
      this.camY = wy - my / this.zoom;
      this._clampCamera();
    };
    this.canvas.addEventListener('wheel', onWheel, { passive: false });
    this._onWheel = onWheel;
  }

  // ── Live partner updates ───────────────────────────────────────────────────

  updatePartners(partners) {
    this.partners = partners;
    const existing = new Map();
    this.dinos.forEach(d => {
      if (d.partner.player_id) existing.set(d.partner.player_id, d);
    });

    const maxLevel = partners.reduce((m, p) => Math.max(m, p.level || 1), 1);

    this.dinos = partners.map((partner, i) => {
      const prev = partner.player_id && existing.get(partner.player_id);
      return this._buildDinoData(partner, i, maxLevel, prev || null);
    });
  }

  // ── Start / Stop ──────────────────────────────────────────────────────────

  start() {
    const loop = (ts) => {
      this._draw(ts);
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  stop() {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    window.removeEventListener('resize', this._boundResize);
    if (this._pointerHandlers) {
      this.canvas.removeEventListener('pointerdown', this._pointerHandlers.onDown);
      this.canvas.removeEventListener('pointermove', this._pointerHandlers.onMove);
      this.canvas.removeEventListener('pointerup', this._pointerHandlers.onUp);
      this.canvas.removeEventListener('pointercancel', this._pointerHandlers.onUp);
    }
    if (this._onWheel) {
      this.canvas.removeEventListener('wheel', this._onWheel);
    }
  }

  // ── Hit-test (screen coords in, converted to world coords) ─────────────

  handleTap(screenX, screenY) {
    const wx = this.camX + screenX / this.zoom;
    const wy = this.camY + screenY / this.zoom;

    for (let i = this.dinos.length - 1; i >= 0; i--) {
      const d = this.dinos[i];
      const spriteW = (d.spriteCanvas?.width || 32) * BASE_SPRITE_SCALE * d.scale;
      const spriteH = (d.spriteCanvas?.height || 32) * BASE_SPRITE_SCALE * d.scale;
      const halfW = spriteW / 2;
      const halfH = spriteH / 2;
      if (wx >= d.worldX - halfW && wx <= d.worldX + halfW &&
          wy >= d.worldY - halfH && wy <= d.worldY + halfH) {
        this.onSelect(d.partner);
        return;
      }
    }
    this.onSelect(null);
  }

  // ── Drawing ───────────────────────────────────────────────────────────────

  _draw(ts) {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const elapsed = (ts - this.startTime) / 1000;

    // Clear entire canvas
    ctx.clearRect(0, 0, w, h);

    // Apply camera transform
    ctx.save();
    ctx.scale(this.zoom, this.zoom);
    ctx.translate(-this.camX, -this.camY);

    // ── Background ────────────────────────────────────────────────────────
    const bg = getPlazaBackground();
    if (bg) {
      ctx.drawImage(bg, 0, 0, WORLD_W, WORLD_H);
    } else {
      ctx.fillStyle = '#22c55e';
      ctx.fillRect(0, 0, WORLD_W, WORLD_H);
    }

    // ── Dinos ─────────────────────────────────────────────────────────────
    this.dinos.forEach(d => {
      const hopY = Math.sin(elapsed * d.hopSpeed + d.hopPhase) * 6;
      d.driftAngle += d.driftSpeed * 0.008;

      const cx = d.driftCenterXFrac * WORLD_W;
      const cy = d.driftCenterYFrac * WORLD_H;
      const sx = cx + Math.cos(d.driftAngle) * d.driftRadius;
      const sy = cy + Math.sin(d.driftAngle) * d.driftRadius + hopY;

      const margin = 40;
      d.worldX = Math.max(margin, Math.min(WORLD_W - margin, sx));
      d.worldY = Math.max(margin, Math.min(WORLD_H - margin, sy));

      this._drawDino(d, elapsed);
    });

    ctx.restore();
  }

  _drawDino(d, elapsed) {
    const ctx = this.ctx;
    const x = d.worldX;
    const y = d.worldY;

    if (!d.spriteCanvas) return;

    const drawScale = BASE_SPRITE_SCALE * d.scale;
    const spriteW = d.spriteCanvas.width * drawScale;
    const spriteH = d.spriteCanvas.height * drawScale;
    const halfW = spriteW / 2;
    const halfH = spriteH / 2;

    // Shadow
    ctx.save();
    ctx.globalAlpha = 0.2;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(x, y + halfH * 0.85, halfW * 0.7, halfH * 0.15, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Sprite (pixelated)
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(d.spriteCanvas, x - halfW, y - halfH, spriteW, spriteH);
    ctx.imageSmoothingEnabled = true;

    // Hat label above dino
    if (d.partner.hat) {
      const hatY = y - halfH - 12;
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.beginPath();
      ctx.roundRect(x - 28, hatY - 9, 56, 16, 5);
      ctx.fill();
      ctx.fillStyle = '#e9d5ff';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(d.partner.hat.replace('_', ' '), x, hatY);
    }

    // Champion crown
    if (d.isChampion) {
      const crownY = y - halfH - (d.partner.hat ? 26 : 12);
      ctx.font = `${Math.round(16 * d.scale)}px serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText('\u{1F451}', x, crownY);
    }

    // Sparkles for champion
    if (d.isChampion) {
      const sparkR = Math.max(halfW, halfH) + 6;
      for (let si = 0; si < 4; si++) {
        const angle = (si / 4) * Math.PI * 2 + elapsed * 1.8 + d.sparklePhase;
        const spx = x + Math.cos(angle) * sparkR;
        const spy = y + Math.sin(angle) * sparkR;
        const alpha = 0.5 + 0.5 * Math.sin(elapsed * 3 + si * 1.5 + d.sparklePhase);
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.font = '10px serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('\u2726', spx, spy);
        ctx.restore();
      }
    }
  }
}
