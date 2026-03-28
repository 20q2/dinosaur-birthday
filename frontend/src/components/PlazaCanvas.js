import { getRecolored, getPlazaBackground } from '../utils/spriteEngine.js';
import { SPECIES } from '../data/species.js';
import { getHatImage, getHatAnchor } from '../data/hatImages.js';

const BASE_SPRITE_SCALE = 1.25;
const SCALE_MIN = 1.0;
const SCALE_MAX = 1.4;
const MAX_LEVEL = 5;

const WORLD_W = 1800;
const WORLD_H = 1200;
const MIN_ZOOM = 0.4;
const MAX_ZOOM = 2.5;
const DRAG_THRESHOLD = 6;
const MARGIN = 150;

// Wandering AI constants
const WALK_SPEED_MIN = 30;
const WALK_SPEED_MAX = 60;
const SPRINT_SPEED_MIN = 90;
const SPRINT_SPEED_MAX = 130;
const WALK_DIST_MIN = 50;
const WALK_DIST_MAX = 150;
const SPRINT_DIST_MIN = 150;
const SPRINT_DIST_MAX = 300;
const IDLE_TIME_MIN = 1.0;
const IDLE_TIME_MAX = 3.0;
const SPRINT_CHANCE = 0.2;
const HEADING_LERP = 3.0; // radians/sec smoothing
const ARRIVE_DIST = 5;

export class PlazaCanvas {
  constructor(canvas, partners, onSelect) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.partners = partners;
    this.onSelect = onSelect;
    this.dinos = [];
    this.particles = [];
    this.rafId = null;
    this.startTime = performance.now();
    this.lastTs = this.startTime;
    this._photoCache = new Map(); // url -> { img, loaded, failed }

    // Camera state (world coordinates)
    this.camX = 0;
    this.camY = 0;
    this.zoom = 1;

    // Shadow phase overlay (boss buildup phase 1) — pulses on/off
    this.shadowAlpha = 0;
    this.shadowTarget = 0;
    this.shadowFadeSpeed = 1.5; // alpha per second
    this.shadowActive = false;
    this.shadowPulseTimer = 0;  // countdown to next pulse toggle

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

    // Load owner photo
    const photoUrl = partner.owner_photo || '';
    let ownerPhoto = null;
    if (photoUrl) {
      ownerPhoto = this._loadPhoto(photoUrl);
    }

    const anim = reuse || {
      // Waypoint AI state
      state: 'idling', // 'walking' | 'sprinting' | 'idling'
      targetX: 0,
      targetY: 0,
      speed: 60,
      heading: Math.random() * Math.PI * 2,
      facingLeft: false,
      idleTimer: Math.random() * 1.5 + 0.5, // stagger initial idle
      hopPhase: Math.random() * Math.PI * 2,
      hopSpeed: 1.5 + Math.random() * 1.0,
      sparklePhase: Math.random() * Math.PI * 2,
      worldX: MARGIN + Math.random() * (WORLD_W - MARGIN * 2),
      worldY: MARGIN + Math.random() * (WORLD_H - MARGIN * 2),
      tapJump: 0, // remaining tap-jump time (seconds)
    };

    return {
      ...anim,
      partner,
      scale,
      isChampion,
      spriteCanvas,
      ownerPhoto,
    };
  }

  _loadPhoto(url) {
    if (this._photoCache.has(url)) return this._photoCache.get(url);
    const entry = { img: new Image(), loaded: false, failed: false };
    entry.img.crossOrigin = 'anonymous';
    entry.img.onload = () => { entry.loaded = true; };
    entry.img.onerror = () => { entry.failed = true; };
    entry.img.src = url;
    this._photoCache.set(url, entry);
    return entry;
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
    this.canvas.style.touchAction = 'none';

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
          const wx = this.camX + cx / this.zoom;
          const wy = this.camY + cy / this.zoom;

          this.zoom *= dist / lastPinchDist;
          this._clampCamera();

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

  // ── Wandering AI ────────────────────────────────────────────────────────

  _pickWaypoint(d, sprint) {
    const minDist = sprint ? SPRINT_DIST_MIN : WALK_DIST_MIN;
    const maxDist = sprint ? SPRINT_DIST_MAX : WALK_DIST_MAX;
    const angle = Math.random() * Math.PI * 2;
    const dist = minDist + Math.random() * (maxDist - minDist);
    d.targetX = Math.max(MARGIN, Math.min(WORLD_W - MARGIN, d.worldX + Math.cos(angle) * dist));
    d.targetY = Math.max(MARGIN, Math.min(WORLD_H - MARGIN, d.worldY + Math.sin(angle) * dist));
    d.speed = sprint
      ? SPRINT_SPEED_MIN + Math.random() * (SPRINT_SPEED_MAX - SPRINT_SPEED_MIN)
      : WALK_SPEED_MIN + Math.random() * (WALK_SPEED_MAX - WALK_SPEED_MIN);
    d.state = sprint ? 'sprinting' : 'walking';
  }

  _updateDino(d, dt, elapsed) {
    // Decay tap jump timer
    if (d.tapJump > 0) d.tapJump = Math.max(0, d.tapJump - dt);

    switch (d.state) {
      case 'idling': {
        d.idleTimer -= dt;
        if (d.idleTimer <= 0) {
          const sprint = Math.random() < SPRINT_CHANCE;
          this._pickWaypoint(d, sprint);
        }
        break;
      }
      case 'walking':
      case 'sprinting': {
        const dx = d.targetX - d.worldX;
        const dy = d.targetY - d.worldY;
        const dist = Math.hypot(dx, dy);

        if (dist < ARRIVE_DIST) {
          // Arrived — start idling
          d.state = 'idling';
          d.idleTimer = IDLE_TIME_MIN + Math.random() * (IDLE_TIME_MAX - IDLE_TIME_MIN);
          break;
        }

        // Smooth heading
        const targetHeading = Math.atan2(dy, dx);
        let diff = targetHeading - d.heading;
        // Normalize to [-PI, PI]
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        d.heading += diff * Math.min(1, HEADING_LERP * dt);

        // Move
        const step = d.speed * dt;
        d.worldX += Math.cos(d.heading) * step;
        d.worldY += Math.sin(d.heading) * step;

        // Clamp
        d.worldX = Math.max(MARGIN, Math.min(WORLD_W - MARGIN, d.worldX));
        d.worldY = Math.max(MARGIN, Math.min(WORLD_H - MARGIN, d.worldY));

        // Face direction
        d.facingLeft = Math.cos(d.heading) < 0;

        // Spawn dust particles behind the dino
        const isSprint = d.state === 'sprinting';
        const spawnRate = isSprint ? 0.55 : 0.3; // particles per frame chance
        if (Math.random() < spawnRate) {
          const footY = d.worldY + (d.spriteCanvas ? d.spriteCanvas.height * BASE_SPRITE_SCALE * d.scale * 0.35 : 10);
          // Opposite of heading + some spread
          const backAngle = d.heading + Math.PI + (Math.random() - 0.5) * 2.4;
          const offsetDist = 8 + Math.random() * 14;
          const ttl = 0.4 + Math.random() * 0.4;
          this.particles.push({
            x: d.worldX + Math.cos(backAngle) * offsetDist,
            y: footY + Math.sin(backAngle) * offsetDist * 0.5,
            vx: Math.cos(backAngle) * (18 + Math.random() * 25),
            vy: -(2 + Math.random() * 10),
            life: ttl,
            maxLife: ttl,
            size: isSprint ? 5 + Math.random() * 4 : 3 + Math.random() * 3,
          });
        }
        break;
      }
    }
  }

  _updateParticles(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.92; // drag
      p.vy *= 0.92;
    }
  }

  _drawParticles() {
    const ctx = this.ctx;
    for (const p of this.particles) {
      const alpha = (p.life / p.maxLife) * 0.6;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#b5b0a8';
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
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

  // ── Shadow phase (boss buildup) ─────────────────────────────────────────

  setShadowPhase(active) {
    this.shadowActive = active;
    if (active) {
      this.shadowTarget = 0.55;
      this.shadowPulseTimer = 1.5 + Math.random() * 2;
    } else {
      this.shadowTarget = 0;
      this.shadowPulseTimer = 0;
    }
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
        d.tapJump = 0.35; // trigger jump animation
        d.state = 'idling';
        d.idleTimer = 2.0 + Math.random(); // stay put a bit after tap
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
    const dt = Math.min((ts - this.lastTs) / 1000, 0.1); // cap at 100ms to avoid jumps
    this.lastTs = ts;

    ctx.clearRect(0, 0, w, h);

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

    // ── Shadow overlay (boss phase 1: pulses darkness over bg, dinos stay bright)
    if (this.shadowActive) {
      this.shadowPulseTimer -= dt;
      if (this.shadowPulseTimer <= 0) {
        // Toggle between dark and dim
        this.shadowTarget = this.shadowTarget > 0.3 ? (0.1 + Math.random() * 0.15) : (0.45 + Math.random() * 0.15);
        this.shadowPulseTimer = 1.0 + Math.random() * 2.5;
      }
    }
    if (this.shadowAlpha !== this.shadowTarget) {
      const dir = this.shadowTarget > this.shadowAlpha ? 1 : -1;
      this.shadowAlpha += dir * this.shadowFadeSpeed * dt;
      if (dir > 0 && this.shadowAlpha > this.shadowTarget) this.shadowAlpha = this.shadowTarget;
      if (dir < 0 && this.shadowAlpha < this.shadowTarget) this.shadowAlpha = this.shadowTarget;
    }
    if (this.shadowAlpha > 0.001) {
      ctx.save();
      ctx.globalAlpha = this.shadowAlpha;
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, WORLD_W, WORLD_H);
      ctx.restore();
    }

    // ── Update & Draw Dinos (Y-sorted for depth) ──────────────────────────
    this.dinos.forEach(d => this._updateDino(d, dt, elapsed));
    this._updateParticles(dt);
    this.dinos.sort((a, b) => a.worldY - b.worldY);
    this._drawParticles();
    this.dinos.forEach(d => this._drawDino(d, elapsed));

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

    // Hop animation — discrete hops when moving, gentle breathing when idle
    let hopY = 0;
    if (d.state === 'walking') {
      hopY = -Math.abs(Math.sin(elapsed * d.hopSpeed * 3 + d.hopPhase)) * 5;
    } else if (d.state === 'sprinting') {
      hopY = -Math.abs(Math.sin(elapsed * d.hopSpeed * 4.5 + d.hopPhase)) * 7;
    } else {
      // Idle breathing
      hopY = Math.sin(elapsed * 1.0 + d.hopPhase) * 1;
    }

    // Tap jump — parabolic arc over 0.35s
    if (d.tapJump > 0) {
      const t = 1 - d.tapJump / 0.35; // 0→1
      hopY -= Math.sin(t * Math.PI) * 10;
    }

    // Shadow
    ctx.save();
    ctx.globalAlpha = 0.2;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(x, y + halfH * 0.85, halfW * 0.7, halfH * 0.15, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Sprite (pixelated — sprites face left by default, flip for right)
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    if (!d.facingLeft) {
      ctx.translate(x, y + hopY);
      ctx.scale(-1, 1);
      ctx.drawImage(d.spriteCanvas, -halfW, -halfH, spriteW, spriteH);
    } else {
      ctx.drawImage(d.spriteCanvas, x - halfW, y - halfH + hopY, spriteW, spriteH);
    }
    ctx.imageSmoothingEnabled = true;
    ctx.restore();

    // Hat image above dino
    if (d.partner.hat) {
      const hatInfo = getHatImage(d.partner.hat);
      const hatAnchor = getHatAnchor(d.partner.species);

      if (hatInfo?.loaded) {
        const hatW = hatInfo.img.naturalWidth * drawScale;
        const hatH = hatInfo.img.naturalHeight * drawScale;
        const anchorDrawX = hatAnchor.x * drawScale;
        const anchorDrawY = (hatAnchor.y + hatInfo.offsetY) * drawScale;

        ctx.save();
        ctx.imageSmoothingEnabled = false;
        if (!d.facingLeft) {
          ctx.translate(x, y + hopY);
          ctx.scale(-1, 1);
          ctx.drawImage(hatInfo.img,
            -halfW + anchorDrawX - hatW / 2,
            -halfH + anchorDrawY - hatH,
            hatW, hatH);
        } else {
          ctx.drawImage(hatInfo.img,
            x - halfW + anchorDrawX - hatW / 2,
            y - halfH + hopY + anchorDrawY - hatH,
            hatW, hatH);
        }
        ctx.restore();
      } else {
        // Fallback text label for hats without artwork
        const labelY = y - halfH + hopY - 6;
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.beginPath();
        ctx.roundRect(x - 16, labelY - 5, 32, 10, 3);
        ctx.fill();
        ctx.fillStyle = '#e9d5ff';
        ctx.font = 'bold 5px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(d.partner.hat.replace('_', ' '), x, labelY);
      }
    }

    // Champion crown
    if (d.isChampion) {
      const crownY = y - halfH + hopY - (d.partner.hat ? 14 : 6);
      ctx.font = `${Math.round(8 * d.scale)}px serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText('\u{1F451}', x, crownY);
    }

    // Champion sparkles
    if (d.isChampion) {
      const sparkR = Math.max(halfW, halfH) + 3;
      for (let si = 0; si < 4; si++) {
        const angle = (si / 4) * Math.PI * 2 + elapsed * 1.8 + d.sparklePhase;
        const spx = x + Math.cos(angle) * sparkR;
        const spy = y + Math.sin(angle) * sparkR;
        const alpha = 0.5 + 0.5 * Math.sin(elapsed * 3 + si * 1.5 + d.sparklePhase);
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.font = '6px serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('\u2726', spx, spy);
        ctx.restore();
      }
    }

    // ── Nameplate ──────────────────────────────────────────────────────────
    this._drawNameplate(d, x, y + halfH * 0.85 + 10);
  }

  _drawNameplate(d, cx, topY) {
    const ctx = this.ctx;
    const p = d.partner;

    const photoSize = 12;
    const gap = 3;
    const padH = 5;

    // Build text
    const gender = p.gender || '';
    const genderSymbol = gender === 'male' ? ' \u2642' : gender === 'female' ? ' \u2640' : '';
    const line1 = (p.name || 'Unnamed') + genderSymbol;
    const line2 = p.owner_name ? `Owner: ${p.owner_name}` : '';

    ctx.font = 'bold 6px sans-serif';
    const line1W = ctx.measureText(line1).width;
    ctx.font = '5px sans-serif';
    const line2W = line2 ? ctx.measureText(line2).width : 0;

    const textW = Math.max(line1W, line2W);
    const pillW = photoSize + gap + textW + padH * 2;
    const pillH = line2 ? 16 : 12;
    const pillX = cx - pillW / 2;
    const pillY = topY;

    // Pill background
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.beginPath();
    ctx.roundRect(pillX, pillY, pillW, pillH, 4);
    ctx.fill();
    ctx.strokeStyle = 'rgba(74,222,128,0.3)';
    ctx.lineWidth = 0.5;
    ctx.stroke();

    // Owner photo circle
    const photoX = pillX + padH + photoSize / 2;
    const photoY = pillY + pillH / 2;
    const photoR = photoSize / 2;

    ctx.save();
    ctx.beginPath();
    ctx.arc(photoX, photoY, photoR, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();

    const photo = d.ownerPhoto;
    if (photo && photo.loaded && !photo.failed) {
      ctx.drawImage(photo.img, photoX - photoR, photoY - photoR, photoSize, photoSize);
    } else {
      // Fallback: green circle with initial
      ctx.fillStyle = '#4ade80';
      ctx.fillRect(photoX - photoR, photoY - photoR, photoSize, photoSize);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 6px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const initial = (p.owner_name || '?')[0].toUpperCase();
      ctx.fillText(initial, photoX, photoY);
    }
    ctx.restore();

    // Line 1: Dino name + gender
    const textLeft = pillX + padH + photoSize + gap;
    ctx.font = 'bold 6px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    if (genderSymbol) {
      // Draw name in white, gender symbol in color
      const nameOnly = p.name || 'Unnamed';
      const nameW = ctx.measureText(nameOnly).width;
      const line1Y = line2 ? pillY + 6 : pillY + pillH / 2;
      ctx.fillStyle = '#f0fdf4';
      ctx.fillText(nameOnly, textLeft, line1Y);
      ctx.fillStyle = gender === 'male' ? '#60a5fa' : '#f472b6';
      ctx.fillText(genderSymbol, textLeft + nameW, line1Y);
    } else {
      const line1Y = line2 ? pillY + 6 : pillY + pillH / 2;
      ctx.fillStyle = '#f0fdf4';
      ctx.fillText(line1, textLeft, line1Y);
    }

    // Line 2: Owner name
    if (line2) {
      ctx.font = '5px sans-serif';
      ctx.fillStyle = '#86efac';
      ctx.fillText(line2, textLeft, pillY + 12);
    }
  }
}
