import { getRecolored, getPlazaBackground } from '../utils/spriteEngine.js';
import { SPECIES } from '../data/species.js';

const BASE_SPRITE_SCALE = 2.5;
const SCALE_MIN = 1.0;
const SCALE_MAX = 1.4;
const MAX_LEVEL = 5;

export class PlazaCanvas {
  constructor(canvas, partners, onSelect) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.partners = partners;
    this.onSelect = onSelect;
    this.dinos = [];
    this.rafId = null;
    this.startTime = performance.now();

    this._initDinos();
    this._resize();
    this._boundResize = () => this._resize();
    window.addEventListener('resize', this._boundResize);
  }

  // ── Initialization ────────────────────────────────────────────────────────

  _buildDinoData(partner, i, maxLevel, reuse) {
    const level = partner.level || 1;
    const scale = SCALE_MIN + ((level - 1) / (MAX_LEVEL - 1)) * (SCALE_MAX - SCALE_MIN);
    const isChampion = level === maxLevel;

    // Get recolored sprite
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
      screenX: 0,
      screenY: 0,
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

    this.dinos.forEach(d => {
      d.screenX = d.driftCenterXFrac * w;
      d.screenY = d.driftCenterYFrac * h;
    });
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
  }

  // ── Hit-test ──────────────────────────────────────────────────────────────

  handleTap(x, y) {
    for (let i = this.dinos.length - 1; i >= 0; i--) {
      const d = this.dinos[i];
      const spriteW = (d.spriteCanvas?.width || 32) * BASE_SPRITE_SCALE * d.scale;
      const spriteH = (d.spriteCanvas?.height || 32) * BASE_SPRITE_SCALE * d.scale;
      const halfW = spriteW / 2;
      const halfH = spriteH / 2;
      if (x >= d.screenX - halfW && x <= d.screenX + halfW &&
          y >= d.screenY - halfH && y <= d.screenY + halfH) {
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

    // ── Background ────────────────────────────────────────────────────────
    const bg = getPlazaBackground();
    if (bg) {
      ctx.drawImage(bg, 0, 0, w, h);
    } else {
      // Fallback: green fill
      ctx.fillStyle = '#22c55e';
      ctx.fillRect(0, 0, w, h);
    }

    // ── Dinos ─────────────────────────────────────────────────────────────
    this.dinos.forEach(d => {
      const t = elapsed;
      const hopY = Math.sin(t * d.hopSpeed + d.hopPhase) * 6;
      d.driftAngle += d.driftSpeed * 0.008;
      const cx = d.driftCenterXFrac * w;
      const cy = d.driftCenterYFrac * h;
      const sx = cx + Math.cos(d.driftAngle) * d.driftRadius;
      const sy = cy + Math.sin(d.driftAngle) * d.driftRadius + hopY;

      const margin = 40;
      d.screenX = Math.max(margin, Math.min(w - margin, sx));
      d.screenY = Math.max(margin, Math.min(h - margin, sy));

      this._drawDino(d, elapsed);
    });
  }

  _drawDino(d, elapsed) {
    const ctx = this.ctx;
    const x = d.screenX;
    const y = d.screenY;

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
