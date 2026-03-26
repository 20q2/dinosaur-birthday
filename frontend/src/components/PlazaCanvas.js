import { hueToColor } from '../utils/colors.js';
import { getSpeciesInitial } from '../utils/sprites.js';

const BASE_RADIUS = 24;
const SCALE_MIN = 1.0;
const SCALE_MAX = 1.4;
const MAX_LEVEL = 5;

// Grass tile colors for decorative grid
const GRASS_COLORS = ['#4ade80', '#22c55e', '#16a34a'];

// Subtle decoration positions (fixed seed so they don't move)
const DECO_COUNT = 18;

function seededRand(seed) {
  // Simple deterministic PRNG for decoration placement
  let s = seed;
  return function () {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

export class PlazaCanvas {
  constructor(canvas, partners, onSelect) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.partners = partners;
    this.onSelect = onSelect;
    this.dinos = [];
    this.decorations = [];
    this.rafId = null;
    this.startTime = performance.now();

    this._initDecorations();
    this._initDinos();
    this._resize();
    this._boundResize = () => this._resize();
    window.addEventListener('resize', this._boundResize);
  }

  // ── Initialization ────────────────────────────────────────────────────────

  _initDecorations() {
    const rand = seededRand(42);
    this.decorations = [];
    for (let i = 0; i < DECO_COUNT; i++) {
      this.decorations.push({
        xFrac: rand(),   // fraction of canvas width (recalculated on resize)
        yFrac: rand(),
        type: Math.floor(rand() * 3), // 0=rock, 1=bush, 2=flower
        size: 6 + rand() * 8,
      });
    }
  }

  _initDinos() {
    // Find champion level
    const maxLevel = this.partners.reduce((m, p) => Math.max(m, p.level || 1), 1);

    this.dinos = this.partners.map((partner, i) => {
      const level = partner.level || 1;
      const scale = SCALE_MIN + ((level - 1) / (MAX_LEVEL - 1)) * (SCALE_MAX - SCALE_MIN);
      const isChampion = level === maxLevel;

      // Derive color from species colors or fall back to species-based hue
      const bodyHue = partner.colors && partner.colors.body != null
        ? partner.colors.body
        : (i * 47) % 360;

      return {
        partner,
        x: 0,        // set in _resize
        y: 0,
        xFrac: 0.1 + Math.random() * 0.8,
        yFrac: 0.1 + Math.random() * 0.8,
        radius: BASE_RADIUS * scale,
        scale,
        isChampion,
        bodyColor: hueToColor(bodyHue, 65, 55),
        bellyColor: hueToColor(bodyHue, 40, 75),
        borderColor: hueToColor(bodyHue, 65, 35),
        initial: getSpeciesInitial(partner.species),
        // Animation state
        hopPhase: Math.random() * Math.PI * 2,
        hopSpeed: 1.5 + Math.random() * 1.0,
        driftAngle: Math.random() * Math.PI * 2,
        driftSpeed: 0.3 + Math.random() * 0.4,
        driftRadius: 20 + Math.random() * 30,
        driftCenterXFrac: 0.1 + Math.random() * 0.8,
        driftCenterYFrac: 0.1 + Math.random() * 0.8,
        // Sparkle for shiny/champion
        sparklePhase: Math.random() * Math.PI * 2,
      };
    });
  }

  _resize() {
    const parent = this.canvas.parentElement;
    if (!parent) return;
    const w = parent.clientWidth || window.innerWidth;
    const h = parent.clientHeight || window.innerHeight;
    this.canvas.width = w;
    this.canvas.height = h;

    // Re-place dinos proportionally
    this.dinos.forEach(d => {
      d.x = d.driftCenterXFrac * w;
      d.y = d.driftCenterYFrac * h;
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
    // Test in reverse order (top-drawn dinos first)
    for (let i = this.dinos.length - 1; i >= 0; i--) {
      const d = this.dinos[i];
      const dx = x - d.screenX;
      const dy = y - d.screenY;
      if (Math.sqrt(dx * dx + dy * dy) <= d.radius + 4) {
        this.onSelect(d.partner);
        return;
      }
    }
    // Tapped empty space — deselect
    this.onSelect(null);
  }

  // ── Drawing ───────────────────────────────────────────────────────────────

  _draw(ts) {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const elapsed = (ts - this.startTime) / 1000; // seconds

    // ── Background ────────────────────────────────────────────────────────
    ctx.fillStyle = '#22c55e';
    ctx.fillRect(0, 0, w, h);

    // Subtle grass tile grid
    const tileSize = 48;
    for (let ty = 0; ty < h; ty += tileSize) {
      for (let tx = 0; tx < w; tx += tileSize) {
        const idx = ((tx / tileSize) + (ty / tileSize)) % 2;
        ctx.fillStyle = idx === 0 ? '#16a34a' : '#22c55e';
        ctx.fillRect(tx, ty, tileSize, tileSize);
      }
    }

    // ── Decorations ──────────────────────────────────────────────────────
    this.decorations.forEach(deco => {
      const dx = deco.xFrac * w;
      const dy = deco.yFrac * h;
      const sz = deco.size;

      if (deco.type === 0) {
        // Rock
        ctx.fillStyle = '#94a3b8';
        ctx.beginPath();
        ctx.ellipse(dx, dy, sz, sz * 0.65, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#cbd5e1';
        ctx.beginPath();
        ctx.ellipse(dx - sz * 0.2, dy - sz * 0.2, sz * 0.35, sz * 0.25, -0.4, 0, Math.PI * 2);
        ctx.fill();
      } else if (deco.type === 1) {
        // Bush
        ctx.fillStyle = '#15803d';
        for (let bi = 0; bi < 3; bi++) {
          ctx.beginPath();
          ctx.arc(dx + (bi - 1) * sz * 0.6, dy, sz * 0.6, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = '#166534';
        ctx.beginPath();
        ctx.arc(dx, dy - sz * 0.3, sz * 0.5, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Flower
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.arc(dx, dy, sz * 0.45, 0, Math.PI * 2);
        ctx.fill();
        const petalColors = ['#f472b6', '#fb923c', '#a78bfa', '#60a5fa'];
        ctx.fillStyle = petalColors[Math.floor(deco.size) % petalColors.length];
        for (let pi = 0; pi < 5; pi++) {
          const angle = (pi / 5) * Math.PI * 2;
          ctx.beginPath();
          ctx.arc(dx + Math.cos(angle) * sz * 0.7, dy + Math.sin(angle) * sz * 0.7, sz * 0.35, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    });

    // ── Dinos ─────────────────────────────────────────────────────────────
    // Update positions and draw
    this.dinos.forEach(d => {
      const t = elapsed;
      // Hop: sine wave on Y axis
      const hopY = Math.sin(t * d.hopSpeed + d.hopPhase) * 6;
      // Drift: slow circular wander
      d.driftAngle += d.driftSpeed * 0.008;
      const cx = d.driftCenterXFrac * w;
      const cy = d.driftCenterYFrac * h;
      const sx = cx + Math.cos(d.driftAngle) * d.driftRadius;
      const sy = cy + Math.sin(d.driftAngle) * d.driftRadius + hopY;

      // Clamp to canvas with margin
      const margin = d.radius + 10;
      d.screenX = Math.max(margin, Math.min(w - margin, sx));
      d.screenY = Math.max(margin, Math.min(h - margin, sy));

      this._drawDino(d, elapsed);
    });
  }

  _drawDino(d, elapsed) {
    const ctx = this.ctx;
    const x = d.screenX;
    const y = d.screenY;
    const r = d.radius;

    // Shadow
    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(x, y + r * 0.85, r * 0.75, r * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Body circle
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = d.bodyColor;
    ctx.fill();
    ctx.strokeStyle = d.borderColor;
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Belly highlight
    ctx.beginPath();
    ctx.arc(x + r * 0.15, y + r * 0.1, r * 0.55, 0, Math.PI * 2);
    ctx.fillStyle = d.bellyColor;
    ctx.globalAlpha = 0.35;
    ctx.fill();
    ctx.globalAlpha = 1;

    // Species initial letter
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${Math.round(r * 0.72)}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(d.initial, x, y + 1);

    // Hat label above dino
    if (d.partner.hat) {
      const hatY = y - r - 14;
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.beginPath();
      ctx.roundRect(x - 28, hatY - 9, 56, 16, 5);
      ctx.fill();
      ctx.fillStyle = '#e9d5ff';
      ctx.font = `bold 9px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(d.partner.hat.replace('_', ' '), x, hatY);
    }

    // Champion crown
    if (d.isChampion) {
      const crownY = y - r - (d.partner.hat ? 28 : 14);
      ctx.font = `${Math.round(r * 0.6)}px serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText('👑', x, crownY);
    }

    // Sparkle for champion dinos — small rotating stars
    if (d.isChampion) {
      const sparkCount = 4;
      const sparkR = r + 8;
      for (let si = 0; si < sparkCount; si++) {
        const angle = (si / sparkCount) * Math.PI * 2 + elapsed * 1.8 + d.sparklePhase;
        const sx = x + Math.cos(angle) * sparkR;
        const sy = y + Math.sin(angle) * sparkR;
        const alpha = 0.5 + 0.5 * Math.sin(elapsed * 3 + si * 1.5 + d.sparklePhase);
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.font = '10px serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('✦', sx, sy);
        ctx.restore();
      }
    }
  }
}
