import { getRecolored, getRecoloredUncached, getPlazaBackground, getRegionMask } from '../utils/spriteEngine.js';
import { SPECIES } from '../data/species.js';
import { getHatImage, getHatAnchor } from '../data/hatImages.js';
import { resolveColors, hasEffects } from '../dinoColors.js';
import { store } from '../store.js';
import starryNightUrl from '../assets/effects/starry_night.jpg';

const _starryImg = new Image();
_starryImg.src = starryNightUrl;
let _starryLoaded = false;
_starryImg.onload = () => { _starryLoaded = true; };

const BASE_SPRITE_SCALE = 1.25;
const SCALE_MIN = 0.7;
const SCALE_MAX = 2.3;
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
const SPRINT_CHANCE = 0.1;
const HEADING_LERP = 3.0; // radians/sec smoothing
const ARRIVE_DIST = 5;

// Lively behavior constants
const FOLLOW_CHANCE       = 0.08;  // chance when leaving idle to follow instead of random waypoint
const FOLLOW_RADIUS       = 350;   // px — "nearby" for follow candidates
const FOLLOW_OFFSET       = 40;    // random offset from leader so follower doesn't overlap
const SNIFF_RADIUS        = 80;    // two idle dinos within this range trigger a sniff
const SNIFF_DURATION      = 1.5;   // seconds
const SNIFF_COOLDOWN      = 8;     // per-dino cooldown after a sniff ends
const STARTLE_RADIUS      = 130;   // px around sprinting/tapping dino
const STARTLE_DURATION    = 0.8;   // seconds ❗ stays visible
const STARTLE_COOLDOWN    = 4;     // per-dino cooldown
const STARTLE_HOP         = 0.4;   // tapJump duration for startle
const STARTLE_HOP_HEIGHT  = 10;    // smaller than normal tap jump

// Transition animation constants
const FADE_OUT_DURATION = 0.5;   // seconds to fade departing dino
const DROP_IN_DURATION  = 0.7;   // seconds for drop-in fall
const DROP_IN_HEIGHT    = 400;   // world-pixels above landing spot

function easeInQuad(t) { return t * t; }

export class PlazaCanvas {
  constructor(canvas, partners, onSelect) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.partners = partners;
    this.onSelect = onSelect;
    this.dinos = [];
    this.departingDinos = []; // fading-out dinos (removed from partners but still animating)
    this._pendingDropIns = new Set(); // player_ids scheduled to drop-in on next buildDinoData
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

    // Tremor phase (boss buildup phase 2) — occasional brief shake bursts
    this.tremorActive = false;
    this.tremorGapTimer = 0;     // seconds until next burst starts
    this.tremorBurstTimer = 0;   // seconds remaining in current burst
    this.tremorAmplitude = 0;    // current burst amplitude in world px
    this.tremorShakeX = 0;       // current frame offset
    this.tremorShakeY = 0;

    this.cooldownSet = new Set();

    // Playing-together pairs: Map<playerId, partnerId>
    this.playingPairs = new Map();

    this._initDinos();
    this._resize();
    this._centerCamera();
    this._initInput();

    this._boundResize = () => this._resize();
    window.addEventListener('resize', this._boundResize);
  }

  // ── Initialization ────────────────────────────────────────────────────────

  // Bake a blurred dark silhouette from a sprite canvas (used as a cheap drop-shadow).
  // Blur is applied once at bake time, so it's free at draw time.
  _bakeShadow(src) {
    if (!src) return null;
    const pad = 10; // extra padding for blur to bleed into
    const c = document.createElement('canvas');
    c.width = src.width + pad * 2;
    c.height = src.height + pad * 2;
    const ctx = c.getContext('2d');
    // Draw silhouette centered with padding
    ctx.drawImage(src, pad, pad);
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, c.width, c.height);
    // Blur the silhouette (one-time cost)
    ctx.globalCompositeOperation = 'source-over';
    ctx.filter = 'blur(5px)';
    ctx.drawImage(c, 0, 0);
    ctx.filter = 'none';
    return c;
  }

  _buildDinoData(partner, i, reuse) {
    const level = partner.level || 1;
    const scale = SCALE_MIN + ((level - 1) / (MAX_LEVEL - 1)) * (SCALE_MAX - SCALE_MIN);

    const speciesData = SPECIES[partner.species];
    const regions = speciesData ? speciesData.regions : ['body', 'belly', 'stripes'];
    const colors = partner.colors || {};
    const animated = hasEffects(colors);
    const resolved = resolveColors(colors, Date.now());
    const spriteCanvas = getRecolored(partner.species, resolved, regions);
    const shadowSprite = animated ? null : this._bakeShadow(spriteCanvas);

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
      tapJumpHeight: 0, // peak height in world-pixels for current tap jump
      nameplateScale: 1, // current nameplate scale (animated)
      nameplateBig: 0, // remaining seconds for enlarged nameplate
      sniffTimer: 0,          // seconds remaining in sniff interaction
      sniffPartnerId: null,   // player_id of the other dino
      sniffCooldown: 0,       // seconds until this dino can sniff again
      startleTimer: 0,        // seconds remaining for ❗ emoji
      startleCooldown: 0,     // seconds until this dino can be startled again
    };

    // Preserve active drop-in animation from live dinos, but clear stale
    // fadeOut from departing dinos used only for position reuse.
    // Also consume any pending drop-in scheduled for this player_id.
    let dropIn = (reuse && reuse.dropIn > 0) ? reuse.dropIn : 0;
    let dropInTotal = (reuse && reuse.dropInTotal > 0) ? reuse.dropInTotal : 0;
    if (partner.player_id && this._pendingDropIns && this._pendingDropIns.has(partner.player_id)) {
      dropIn = DROP_IN_DURATION;
      dropInTotal = DROP_IN_DURATION;
      this._pendingDropIns.delete(partner.player_id);
      console.log('[drop-in] consumed pending for', partner.player_id);
    }
    const squish = (reuse && reuse.squish > 0) ? reuse.squish : 0;

    return {
      ...anim,
      fadeOut: 0,
      dropIn,
      dropInTotal,
      squish,
      partner,
      scale,
      spriteCanvas,
      ownerPhoto,
      animated,
      regions,
      _lastRecolorKey: null, // cached key for animated sprite quantization
      _cleanSprite: null,    // un-baked recolored sprite (effects get baked onto a copy)
      _effectTmp: null,      // reusable temp canvas for effect baking
      _bakedSprite: null,    // working copy with effects baked on
      _lastBakeTime: 0,      // timestamp of last effect bake (throttled to ~15fps)
      _shadowSprite: shadowSprite, // pre-baked dark silhouette for drop-shadow effect
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
    this.dinos = this.partners.map((partner, i) =>
      this._buildDinoData(partner, i, null)
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

  _pickFollowTarget(d) {
    // Return a dino to follow, or null to fall back to random waypoint.
    const moving = [];
    const idle = [];
    for (const other of this.dinos) {
      if (other === d) continue;
      if (other.dropIn > 0) continue;
      if (other.playPartner) continue;
      const dx = other.worldX - d.worldX;
      const dy = other.worldY - d.worldY;
      const dist = Math.hypot(dx, dy);
      if (dist > FOLLOW_RADIUS) continue;
      if (dist < ARRIVE_DIST) continue; // already there
      if (other.state === 'walking' || other.state === 'sprinting') {
        moving.push(other);
      } else if (other.state === 'idling') {
        idle.push(other);
      }
    }
    const pool = moving.length > 0 ? moving : idle;
    if (pool.length === 0) return null;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  _broadcastStartle(source) {
    for (const other of this.dinos) {
      if (other === source) continue;
      if (other.startleCooldown > 0) continue;
      if (other.dropIn > 0 || other.playPartner) continue;
      const dx = other.worldX - source.worldX;
      const dy = other.worldY - source.worldY;
      if (Math.hypot(dx, dy) > STARTLE_RADIUS) continue;
      // Startle wins over sniff — cancel any in-progress sniff on target
      if (other.sniffTimer > 0) {
        other.sniffTimer = 0;
        other.sniffPartnerId = null;
        other.sniffCooldown = SNIFF_COOLDOWN;
      }
      other.tapJump = STARTLE_HOP;
      other.tapJumpHeight = STARTLE_HOP_HEIGHT;
      other.startleTimer = STARTLE_DURATION;
      other.startleCooldown = STARTLE_COOLDOWN;
    }
  }

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

  _spawnLandingPoof(d) {
    const footY = d.worldY + (d.spriteCanvas ? d.spriteCanvas.height * BASE_SPRITE_SCALE * d.scale * 0.38 : 12);
    const count = 8 + Math.floor(Math.random() * 5);
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.4;
      const speed = 28 + Math.random() * 36;
      const ttl = 0.35 + Math.random() * 0.25;
      this.particles.push({
        x: d.worldX + (Math.random() - 0.5) * 8,
        y: footY,
        vx: Math.cos(angle) * speed * 4.0,
        vy: Math.sin(angle) * speed * 0.3 - 18,
        life: ttl,
        maxLife: ttl,
        size: 4 + Math.random() * 5,
      });
    }
  }

  _updateDino(d, dt, elapsed) {
    // Drop-in animation — tick timer, spawn poof on landing, skip AI
    if (d.dropIn > 0) {
      if (!d._dropInTickLogged) {
        d._dropInTickLogged = true;
        console.log('[drop-in] tick started', d.partner.player_id, 'dropIn=', d.dropIn);
      }
      d.dropIn = Math.max(0, d.dropIn - dt);
      if (d.dropIn === 0) {
        console.log('[drop-in] landed', d.partner.player_id);
        this._spawnLandingPoof(d);
        d.squish = 0.15; // brief squish on landing
      }
      return; // freeze AI while dropping in
    }

    // ── Startle ticking ────────────────────────────────────────────────────
    d.startleCooldown = Math.max(0, d.startleCooldown - dt);
    d.startleTimer = Math.max(0, d.startleTimer - dt);

    // ── Sniff ticking (runs before normal AI so sniffing pauses idle) ──────
    d.sniffCooldown = Math.max(0, d.sniffCooldown - dt);
    if (d.sniffTimer > 0) {
      d.sniffTimer = Math.max(0, d.sniffTimer - dt);
      if (d.sniffTimer === 0) {
        d.sniffPartnerId = null;
        d.sniffCooldown = SNIFF_COOLDOWN;
        // Fall through — dino resumes normal behavior this frame
      } else {
        const partner = this.dinos.find(o => o.partner.player_id === d.sniffPartnerId);
        if (partner) {
          d.facingLeft = partner.worldX < d.worldX;
        }
        return; // skip rest of AI while sniffing
      }
    }

    // Squish recovery
    if (d.squish > 0) d.squish = Math.max(0, d.squish - dt * 0.6);

    // Decay tap jump timer; detect landing to spawn poof
    if (d.tapJump > 0) {
      d.tapJump = Math.max(0, d.tapJump - dt);
      if (d.tapJump === 0) this._spawnLandingPoof(d);
    }

    // Smoothly animate nameplate scale
    if (d.nameplateBig > 0) d.nameplateBig = Math.max(0, d.nameplateBig - dt);
    const targetNpScale = d.nameplateBig > 0 ? 1.6 : 1;
    d.nameplateScale += (targetNpScale - d.nameplateScale) * Math.min(1, dt * 5);

    // ── Playing-together override ──────────────────────────────────────────
    if (d.playPartner) {
      const other = this.dinos.find(o => o.partner.player_id === d.playPartner);
      if (other) {
        const dx = d.targetX - d.worldX;
        const dy = d.targetY - d.worldY;
        const dist = Math.hypot(dx, dy);

        if (dist > ARRIVE_DIST && d.state === 'walking') {
          // Still walking to meetup point
          const targetHeading = Math.atan2(dy, dx);
          let diff = targetHeading - d.heading;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          d.heading += diff * Math.min(1, HEADING_LERP * dt);
          const step = d.speed * dt;
          d.worldX += Math.cos(d.heading) * step;
          d.worldY += Math.sin(d.heading) * step;
          d.facingLeft = Math.cos(d.heading) < 0;
        } else {
          // Arrived at meetup — face partner and do play idle
          d.state = 'playing';
          d.facingLeft = other.worldX < d.worldX;
          d.playPhase = (d.playPhase || 0) + dt;
        }
      }
      return;
    }

    // ── Normal AI ──────────────────────────────────────────────────────────
    switch (d.state) {
      case 'idling': {
        // Look for a nearby idle dino to sniff with
        if (d.sniffCooldown === 0 && d.sniffPartnerId === null) {
          for (const other of this.dinos) {
            if (other === d) continue;
            if (other.state !== 'idling') continue;
            if (other.sniffCooldown !== 0 || other.sniffPartnerId !== null) continue;
            if (other.dropIn > 0 || other.playPartner) continue;
            const dx = other.worldX - d.worldX;
            const dy = other.worldY - d.worldY;
            if (Math.hypot(dx, dy) > SNIFF_RADIUS) continue;
            d.sniffPartnerId = other.partner.player_id;
            d.sniffTimer = SNIFF_DURATION;
            other.sniffPartnerId = d.partner.player_id;
            other.sniffTimer = SNIFF_DURATION;
            break;
          }
        }
        d.idleTimer -= dt;
        if (d.idleTimer <= 0) {
          // Chance to follow another dino instead of picking a random waypoint
          if (Math.random() < FOLLOW_CHANCE) {
            const leader = this._pickFollowTarget(d);
            if (leader) {
              const ox = (Math.random() - 0.5) * FOLLOW_OFFSET * 2;
              const oy = (Math.random() - 0.5) * FOLLOW_OFFSET * 2;
              d.targetX = Math.max(MARGIN, Math.min(WORLD_W - MARGIN, leader.worldX + ox));
              d.targetY = Math.max(MARGIN, Math.min(WORLD_H - MARGIN, leader.worldY + oy));
              d.speed = WALK_SPEED_MIN + Math.random() * (WALK_SPEED_MAX - WALK_SPEED_MIN);
              d.state = 'walking';
              break;
            }
          }
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
    // Also check departing dinos for position reuse (partner swap: old is fading out)
    this.departingDinos.forEach(d => {
      if (d.partner.player_id && !existing.has(d.partner.player_id)) {
        existing.set(d.partner.player_id, d);
      }
    });

    this.dinos = partners.map((partner, i) => {
      const prev = partner.player_id && existing.get(partner.player_id);
      return this._buildDinoData(partner, i, prev || null);
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

  // ── Tremor phase (boss buildup phase 2) ─────────────────────────────────

  setTremorPhase(active) {
    this.tremorActive = active;
    if (active) {
      // Wait a few seconds before the first rumble
      this.tremorGapTimer = 3.0 + Math.random() * 4.0;
      this.tremorBurstTimer = 0;
      this.tremorAmplitude = 0;
    } else {
      this.tremorGapTimer = 0;
      this.tremorBurstTimer = 0;
      this.tremorAmplitude = 0;
      this.tremorShakeX = 0;
      this.tremorShakeY = 0;
    }
  }

  // ── Cooldown overlay ─────────────────────────────────────────────────────

  setCooldowns(playerIds) {
    this.cooldownSet = new Set(playerIds);
  }

  // Trigger a boing (tap-jump) animation on a specific dino by player ID
  boingDino(playerId) {
    const d = this.dinos.find(d => d.partner.player_id === playerId);
    if (d) {
      d.tapJump = 0.45;
      d.tapJumpHeight = 20 + Math.random() * 16;
    }
  }

  // ── Partner swap transitions ────────────────────────────────────────────

  // Move a dino to the departing list so it fades out in place
  fadeOutDino(playerId) {
    const idx = this.dinos.findIndex(d => d.partner.player_id === playerId);
    if (idx === -1) return;
    const d = this.dinos.splice(idx, 1)[0];
    d.fadeOut = FADE_OUT_DURATION;
    this.departingDinos.push(d);
  }

  // Mark a dino for drop-in animation. Survives rebuilds of this.dinos via
  // _pendingDropIns — applied in _buildDinoData when the new dino appears.
  dropInDino(playerId) {
    console.log('[drop-in] scheduled for', playerId);
    this._pendingDropIns.add(playerId);
    const d = this.dinos.find(d => d.partner.player_id === playerId);
    if (d && !(d.dropIn > 0)) {
      d.dropIn = DROP_IN_DURATION;
      d.dropInTotal = DROP_IN_DURATION;
      this._pendingDropIns.delete(playerId);
      console.log('[drop-in] applied directly to existing dino');
    }
  }

  // ── Play-together state ───────────────────────────────────────────────────

  setPlayingTogether(playerIds) {
    // playerIds = [idA, idB]
    if (!playerIds || playerIds.length < 2) return;
    const [a, b] = playerIds;
    this.playingPairs.set(a, b);
    this.playingPairs.set(b, a);

    // Find both dinos and set them walking toward each other
    const dinoA = this.dinos.find(d => d.partner.player_id === a);
    const dinoB = this.dinos.find(d => d.partner.player_id === b);
    if (dinoA && dinoB) {
      // Pick a midpoint between them for the meetup
      const midX = (dinoA.worldX + dinoB.worldX) / 2;
      const midY = (dinoA.worldY + dinoB.worldY) / 2;
      const gap = 35; // half the gap between them

      const angle = Math.atan2(dinoB.worldY - dinoA.worldY, dinoB.worldX - dinoA.worldX);
      dinoA.targetX = midX - Math.cos(angle) * gap;
      dinoA.targetY = midY - Math.sin(angle) * gap;
      dinoB.targetX = midX + Math.cos(angle) * gap;
      dinoB.targetY = midY + Math.sin(angle) * gap;

      dinoA.state = 'walking';
      dinoA.speed = 50;
      dinoB.state = 'walking';
      dinoB.speed = 50;

      dinoA.playPartner = b;
      dinoA.playPhase = 0;
      dinoB.playPartner = a;
      dinoB.playPhase = 0;
    }
  }

  clearPlayingTogether(playerIds) {
    if (!playerIds || playerIds.length < 2) return;
    const [a, b] = playerIds;
    this.playingPairs.delete(a);
    this.playingPairs.delete(b);

    // Release both dinos back to normal AI
    for (const d of this.dinos) {
      if (d.partner.player_id === a || d.partner.player_id === b) {
        d.playPartner = null;
        d.playPhase = 0;
        d.state = 'idling';
        d.idleTimer = 1 + Math.random() * 2;
      }
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
        d.tapJump = 0.45; // trigger jump animation
        d.tapJumpHeight = 14 + Math.random() * 22; // 14–36px variable height
        d.state = 'idling';
        d.idleTimer = 3.5 + Math.random() * 2.0; // stay put 3.5–5.5s after tap
        d.nameplateBig = 3; // enlarged nameplate for 3s
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

    // ── Tremor update (boss phase 2: occasional brief screen shake) ───────
    if (this.tremorActive) {
      if (this.tremorBurstTimer > 0) {
        this.tremorBurstTimer -= dt;
        if (this.tremorBurstTimer <= 0) {
          // Burst ended; schedule a long quiet gap until the next one
          this.tremorBurstTimer = 0;
          this.tremorAmplitude = 0;
          this.tremorShakeX = 0;
          this.tremorShakeY = 0;
          this.tremorGapTimer = 7.0 + Math.random() * 6.0;
        } else {
          // Amplitude eases out over the burst for a natural tail
          const falloff = Math.max(0, this.tremorBurstTimer / this.tremorBurstDuration);
          const amp = this.tremorAmplitude * falloff;
          this.tremorShakeX = (Math.random() * 2 - 1) * amp;
          this.tremorShakeY = (Math.random() * 2 - 1) * amp * 0.6;
        }
      } else {
        this.tremorGapTimer -= dt;
        if (this.tremorGapTimer <= 0) {
          // Start a new burst
          this.tremorBurstDuration = 0.6 + Math.random() * 0.7;
          this.tremorBurstTimer = this.tremorBurstDuration;
          this.tremorAmplitude = 6 + Math.random() * 6; // world px
        }
      }
    }

    ctx.save();
    ctx.scale(this.zoom, this.zoom);
    ctx.translate(-this.camX + this.tremorShakeX, -this.camY + this.tremorShakeY);

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
        // Toggle between dark and dim — dark pulses are brief, dim gaps are long
        // so the darkening feels occasional but still noticeable
        const wasDark = this.shadowTarget > 0.3;
        this.shadowTarget = wasDark ? (0.1 + Math.random() * 0.15) : (0.45 + Math.random() * 0.15);
        this.shadowPulseTimer = wasDark ? (7.0 + Math.random() * 6.0) : (2.0 + Math.random() * 1.5);
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
    // Sprinting dinos startle nearby dinos
    for (const d of this.dinos) {
      if (d.state === 'sprinting') this._broadcastStartle(d);
    }

    // Tick departing dinos (fade-out)
    for (let i = this.departingDinos.length - 1; i >= 0; i--) {
      const d = this.departingDinos[i];
      d.fadeOut -= dt;
      if (d.fadeOut <= 0) {
        this.departingDinos.splice(i, 1);
      }
    }

    this._updateParticles(dt);

    // Merge active + departing for Y-sorted drawing
    const allDinos = [...this.dinos, ...this.departingDinos];
    allDinos.sort((a, b) => a.worldY - b.worldY);
    this._drawParticles();

    // Re-resolve animated dino sprites — throttled to ~15fps for both recolor + effect bake
    const now = Date.now();
    allDinos.forEach(d => {
      if (d.animated) {
        // Throttle all animated sprite work to every ~66ms (15fps) — plenty for color shifts / overlays
        if (now - d._lastBakeTime < 66) return;
        d._lastBakeTime = now;

        const resolved = resolveColors(d.partner.colors || {}, now);
        // Quantize hues to 4° steps — avoids expensive recolor when nothing visibly changed
        const quantized = {};
        for (const k in resolved) quantized[k] = Math.round(resolved[k] / 4) * 4;
        const key = d.regions.map(r => quantized[r] ?? 0).join(',');
        if (key !== d._lastRecolorKey) {
          d._lastRecolorKey = key;
          d._cleanSprite = getRecoloredUncached(d.partner.species, quantized, d.regions);
        }
        // Bake effect overlays onto a working copy (preserves clean sprite for next frame)
        if (d._cleanSprite) {
          const w = d._cleanSprite.width, h = d._cleanSprite.height;
          if (!d._bakedSprite || d._bakedSprite.width !== w || d._bakedSprite.height !== h) {
            d._bakedSprite = document.createElement('canvas');
            d._bakedSprite.width = w;
            d._bakedSprite.height = h;
          }
          const bc = d._bakedSprite.getContext('2d');
          bc.clearRect(0, 0, w, h);
          bc.drawImage(d._cleanSprite, 0, 0);
          d.spriteCanvas = d._bakedSprite;
          this._bakeEffectOnSprite(d, elapsed);
          d._shadowSprite = this._bakeShadow(d.spriteCanvas);
        }
      }
    });

    allDinos.forEach(d => this._drawDino(d, elapsed));

    ctx.restore();
  }

  _drawDino(d, elapsed) {
    const ctx = this.ctx;
    const x = d.worldX;
    const y = d.worldY;

    if (!d.spriteCanvas) return;

    // Fade-out: departing dino dissolves
    let dinoAlpha = 1;
    if (d.fadeOut > 0) {
      dinoAlpha = d.fadeOut / FADE_OUT_DURATION;
    }

    // Drop-in: falling from above with easeInQuad
    let dropOffsetY = 0;
    if (d.dropIn > 0) {
      const t = 1 - d.dropIn / d.dropInTotal; // 0→1
      dropOffsetY = -(1 - easeInQuad(t)) * DROP_IN_HEIGHT;
      dinoAlpha = Math.min(1, t * 2.5); // fade in quickly over first 40%
      if (!d._dropInLogged) {
        d._dropInLogged = true;
        console.log('[drop-in] first draw', d.partner.player_id, 'dropIn=', d.dropIn, 'offsetY=', dropOffsetY, 'alpha=', dinoAlpha);
      }
    }

    if (dinoAlpha <= 0.001) return;

    const drawScale = BASE_SPRITE_SCALE * d.scale;
    const spriteW = d.spriteCanvas.width * drawScale;
    const spriteH = d.spriteCanvas.height * drawScale;
    const halfW = spriteW / 2;
    const halfH = spriteH / 2;

    // Hop animation — discrete hops when moving, gentle breathing when idle
    let hopY = 0;
    if (d.state === 'playing') {
      // Playful alternating hops — bouncy and excited
      hopY = -Math.abs(Math.sin(elapsed * 4.5 + d.hopPhase)) * 8;
    } else if (d.state === 'walking') {
      hopY = -Math.abs(Math.sin(elapsed * d.hopSpeed * 3 + d.hopPhase)) * 5;
    } else if (d.state === 'sprinting') {
      hopY = -Math.abs(Math.sin(elapsed * d.hopSpeed * 4.5 + d.hopPhase)) * 7;
    } else {
      // Idle breathing
      hopY = Math.sin(elapsed * 1.0 + d.hopPhase) * 1;
    }

    // Tap jump — parabolic arc over 0.45s, variable height
    if (d.tapJump > 0) {
      const t = 1 - d.tapJump / 0.45; // 0→1
      hopY -= Math.sin(t * Math.PI) * (d.tapJumpHeight || 10);
    }

    // Landing squish (from drop-in)
    const squish = d.squish || 0;
    const squishScaleX = 1 + squish * 0.2;
    const squishScaleY = 1 - squish * 0.3;

    // Shadow (don't show shadow while high up in drop-in)
    if (dropOffsetY > -80) {
      ctx.save();
      ctx.globalAlpha = 0.2 * dinoAlpha * Math.max(0, 1 + dropOffsetY / 80);
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.ellipse(x, y + halfH * 0.85, halfW * 0.7, halfH * 0.15, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Pre-baked drop shadow (blurred silhouette, offset down+right)
    if (d._shadowSprite) {
      const padScale = drawScale * 10; // match the pad=10 from _bakeShadow
      const shW = spriteW + padScale * 2;
      const shH = spriteH + padScale * 2;
      ctx.save();
      ctx.globalAlpha = dinoAlpha;
      if (!d.facingLeft) {
        ctx.translate(x, y + hopY + dropOffsetY);
        ctx.scale(-squishScaleX, squishScaleY);
      } else {
        ctx.translate(x, y + hopY + dropOffsetY);
        ctx.scale(squishScaleX, squishScaleY);
      }
      ctx.drawImage(d._shadowSprite, -shW / 2, -shH / 2, shW, shH);
      ctx.restore();
    }

    // Sprite (pixelated — sprites face left by default, flip for right)
    ctx.save();
    ctx.globalAlpha = dinoAlpha;
    ctx.imageSmoothingEnabled = false;
    if (!d.facingLeft) {
      ctx.translate(x, y + hopY + dropOffsetY);
      ctx.scale(-squishScaleX, squishScaleY);
      ctx.drawImage(d.spriteCanvas, -halfW, -halfH, spriteW, spriteH);
    } else {
      ctx.translate(x, y + hopY + dropOffsetY);
      ctx.scale(squishScaleX, squishScaleY);
      ctx.drawImage(d.spriteCanvas, -halfW, -halfH, spriteW, spriteH);
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
        const anchorDrawX = (hatAnchor.x + (hatInfo.offsetX || 0)) * drawScale;
        const anchorDrawY = (hatAnchor.y + hatInfo.offsetY) * drawScale;

        ctx.save();
        ctx.globalAlpha = dinoAlpha;
        ctx.imageSmoothingEnabled = false;
        if (!d.facingLeft) {
          ctx.translate(x, y + hopY + dropOffsetY);
          ctx.scale(-1, 1);
          ctx.drawImage(hatInfo.img,
            -halfW + anchorDrawX - hatW / 2,
            -halfH + anchorDrawY - hatH,
            hatW, hatH);
        } else {
          ctx.drawImage(hatInfo.img,
            x - halfW + anchorDrawX - hatW / 2,
            y - halfH + hopY + dropOffsetY + anchorDrawY - hatH,
            hatW, hatH);
        }
        ctx.restore();
      } else {
        // Fallback text label for hats without artwork
        const labelY = y - halfH + hopY + dropOffsetY - 6;
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

    // Skip UI overlays during transitions
    if (d.fadeOut > 0 || d.dropIn > 0) {
      this._drawNameplate(d, x, y + halfH * 0.85 + 10 + dropOffsetY, d.nameplateScale, dinoAlpha);
      return;
    }

    // Cooldown icon
    const onCooldown = this.cooldownSet.has(d.partner.player_id);
    if (onCooldown) {
      const aboveHatOffset = d.partner.hat ? 14 : 6;
      const baseY = y - halfH + hopY - aboveHatOffset;
      const iconSize = Math.round(8 * d.scale);
      ctx.font = `${iconSize}px serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText('\u23F3', x, baseY);
    }

    // Play-together emoji above head
    if (d.state === 'playing') {
      const playEmojis = ['\u{1F3B2}', '\u2764\uFE0F', '\u{1F389}', '\u2B50'];
      // Cycle through emojis every 1.5s
      const emojiIdx = Math.floor((elapsed + d.hopPhase) / 1.5) % playEmojis.length;
      const emojiY = y - halfH + hopY - (d.partner.hat ? 14 : 6);
      // Gentle float
      const floatY = Math.sin(elapsed * 2.5 + d.hopPhase) * 3;
      const emojiAlpha = 0.7 + 0.3 * Math.sin(elapsed * 3 + d.hopPhase);
      ctx.save();
      ctx.globalAlpha = emojiAlpha;
      ctx.font = `${Math.round(10 * d.scale)}px serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(playEmojis[emojiIdx], x, emojiY + floatY);
      ctx.restore();
    }

    // Startle emoji above head
    if (d.startleTimer > 0 && d.state !== 'playing') {
      const emojiY = y - halfH + hopY - (d.partner.hat ? 14 : 6);
      const floatY = Math.sin(elapsed * 4 + d.hopPhase) * 2;
      // Fade out over the last half of the timer
      const fade = Math.min(1, d.startleTimer / (STARTLE_DURATION * 0.5));
      ctx.save();
      ctx.globalAlpha = fade;
      ctx.font = `${Math.round(11 * d.scale)}px serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText('\u2757', x, emojiY + floatY); // ❗
      ctx.restore();
    }

    // Sniff emoji above head
    if (d.sniffTimer > 0 && d.state !== 'playing' && d.startleTimer === 0) {
      const emojiY = y - halfH + hopY - (d.partner.hat ? 14 : 6);
      const floatY = Math.sin(elapsed * 2.5 + d.hopPhase) * 3;
      const emojiAlpha = 0.7 + 0.3 * Math.sin(elapsed * 3 + d.hopPhase);
      ctx.save();
      ctx.globalAlpha = emojiAlpha;
      ctx.font = `${Math.round(10 * d.scale)}px serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText('\u{1F4AD}', x, emojiY + floatY); // 💭
      ctx.restore();
    }

    // Shiny sparkles — subtle glints orbiting the dino
    if (d.partner.shiny) {
      this._drawShinySparkles(ctx, x, y + hopY, halfW, halfH, elapsed, d);
    }

    // ── Nameplate ──────────────────────────────────────────────────────────
    this._drawNameplate(d, x, y + halfH * 0.85 + 10, d.nameplateScale);
  }


  _bakeEffectOnSprite(d, elapsed) {
    const canvas = d.spriteCanvas;
    const sc = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    const colors = d.partner.colors || {};
    const regions = d.regions;

    // Group region indices by effect
    const effectRegions = {};
    for (let i = 0; i < regions.length; i++) {
      const val = colors[regions[i]];
      if (val && typeof val === 'object' && val.effect) {
        if (!effectRegions[val.effect]) effectRegions[val.effect] = [];
        effectRegions[val.effect].push(i);
      }
    }

    for (const [effect, regionIdxs] of Object.entries(effectRegions)) {
      const mask = getRegionMask(d.partner.species, regionIdxs);
      if (!mask) continue;

      // Reuse a single temp canvas per dino to avoid allocation/GC churn
      if (!d._effectTmp || d._effectTmp.width !== w || d._effectTmp.height !== h) {
        d._effectTmp = document.createElement('canvas');
        d._effectTmp.width = w;
        d._effectTmp.height = h;
      }
      const tmp = d._effectTmp;
      const tc = tmp.getContext('2d');
      tc.clearRect(0, 0, w, h);
      tc.imageSmoothingEnabled = false;
      tc.globalCompositeOperation = 'source-over';
      tc.globalAlpha = 1;
      tc.drawImage(mask, 0, 0);
      tc.globalCompositeOperation = 'source-in';

      if (effect === 'metallic') {
        const shineX = ((elapsed * 0.4) % 1.6 - 0.3) * w;
        const grad = tc.createLinearGradient(shineX - 4, 0, shineX + 4, 0);
        grad.addColorStop(0, 'rgba(255,255,255,0)');
        grad.addColorStop(0.5, 'rgba(255,255,255,0.35)');
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        tc.fillStyle = grad;
        tc.fillRect(0, 0, w, h);
      } else if (effect === 'starry_night' && _starryLoaded) {
        tc.imageSmoothingEnabled = true;
        tc.globalAlpha = 0.6;
        const texW = _starryImg.naturalWidth;
        const texH = _starryImg.naturalHeight;
        const cx = texW * 0.25;
        const cy = texH * 0.25;
        const range = texW * 0.08;
        const panX = cx + Math.sin(elapsed * 0.15) * range;
        const panY = cy + Math.cos(elapsed * 0.1) * range * 0.6;
        tc.drawImage(_starryImg, panX, panY, texW * 0.4, texH * 0.4, 0, 0, w, h);
      } else if (effect === 'rainbow') {
        const bandHalf = w * 0.5;
        const sweepX = ((elapsed * 0.35) % 1.6 - 0.3) * w;
        const baseHue = Math.floor((elapsed * 50) % 360);
        const grad = tc.createLinearGradient(sweepX - bandHalf, 0, sweepX + bandHalf, 0);
        grad.addColorStop(0, 'rgba(255,255,255,0)');
        grad.addColorStop(0.2, `hsla(${baseHue}, 100%, 65%, 0.35)`);
        grad.addColorStop(0.5, `hsla(${(baseHue + 120) % 360}, 100%, 65%, 0.4)`);
        grad.addColorStop(0.8, `hsla(${(baseHue + 240) % 360}, 100%, 65%, 0.35)`);
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        tc.fillStyle = grad;
        tc.fillRect(0, 0, w, h);
      } else if (effect === 'prismatic') {
        tc.globalAlpha = 0.12;
        const hue = Math.floor((elapsed * 10 + 180) % 360);
        tc.fillStyle = `hsl(${hue}, 100%, 70%)`;
        tc.fillRect(0, 0, w, h);
      }

      // Composite masked effect onto the sprite canvas
      sc.save();
      sc.globalCompositeOperation = 'source-atop';
      sc.drawImage(tmp, 0, 0);
      sc.restore();
    }
  }

  // Legacy method kept for reference — replaced by _bakeEffectOnSprite
  _drawEffectOverlay(ctx, d, x, y, hopY, halfW, halfH, spriteW, spriteH, elapsed) {
    const colors = d.partner.colors || {};
    const regions = d.regions;

    // Group region indices by effect
    const effectRegions = {};
    for (let i = 0; i < regions.length; i++) {
      const val = colors[regions[i]];
      if (val && typeof val === 'object' && val.effect) {
        if (!effectRegions[val.effect]) effectRegions[val.effect] = [];
        effectRegions[val.effect].push(i);
      }
    }

    const drawX = x - halfW;
    const drawY = y - halfH + hopY;

    for (const [effect, regionIdxs] of Object.entries(effectRegions)) {
      const mask = getRegionMask(d.partner.species, regionIdxs);
      if (!mask) continue;

      // Off-screen canvas: draw mask scaled, then effect with source-in to clip
      const tmp = document.createElement('canvas');
      tmp.width = spriteW;
      tmp.height = spriteH;
      const tc = tmp.getContext('2d');
      tc.imageSmoothingEnabled = false;
      tc.drawImage(mask, 0, 0, spriteW, spriteH);
      tc.globalCompositeOperation = 'source-in';

      if (effect === 'metallic') {
        const shinePos = ((elapsed * 0.4) % 1.6 - 0.3);
        const shineX = shinePos * spriteW;
        const grad = tc.createLinearGradient(shineX - 8, 0, shineX + 8, 0);
        grad.addColorStop(0, 'rgba(255,255,255,0)');
        grad.addColorStop(0.5, 'rgba(255,255,255,0.3)');
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        tc.fillStyle = grad;
        tc.fillRect(0, 0, spriteW, spriteH);
      } else if (effect === 'starry_night' && _starryLoaded) {
        tc.imageSmoothingEnabled = true;
        tc.globalAlpha = 0.6;
        const texW = _starryImg.naturalWidth;
        const texH = _starryImg.naturalHeight;
        const cx = texW * 0.25;
        const cy = texH * 0.25;
        const range = texW * 0.08;
        const panX = cx + Math.sin(elapsed * 0.15) * range;
        const panY = cy + Math.cos(elapsed * 0.1) * range * 0.6;
        tc.drawImage(_starryImg, panX, panY, texW * 0.4, texH * 0.4, 0, 0, spriteW, spriteH);
      } else if (effect === 'rainbow') {
        const sweepPos = ((elapsed * 0.35) % 1.6 - 0.3);
        const sweepX = sweepPos * spriteW;
        const baseHue = Math.floor((elapsed * 50) % 360);
        const grad = tc.createLinearGradient(sweepX - 10, 0, sweepX + 10, 0);
        grad.addColorStop(0, 'rgba(255,255,255,0)');
        grad.addColorStop(0.2, `hsla(${baseHue}, 100%, 65%, 0.35)`);
        grad.addColorStop(0.5, `hsla(${(baseHue + 120) % 360}, 100%, 65%, 0.4)`);
        grad.addColorStop(0.8, `hsla(${(baseHue + 240) % 360}, 100%, 65%, 0.35)`);
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        tc.fillStyle = grad;
        tc.fillRect(0, 0, spriteW, spriteH);
      } else if (effect === 'prismatic') {
        tc.globalAlpha = 0.12;
        const hue = Math.floor((elapsed * 10 + 180) % 360);
        tc.fillStyle = `hsl(${hue}, 100%, 70%)`;
        tc.fillRect(0, 0, spriteW, spriteH);
      }

      // Draw masked effect onto the main canvas, respecting facing direction
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      if (!d.facingLeft) {
        ctx.translate(x, y + hopY);
        ctx.scale(-1, 1);
        ctx.drawImage(tmp, -halfW, -halfH);
      } else {
        ctx.drawImage(tmp, drawX, drawY);
      }
      ctx.restore();
    }
  }

  _drawShinySparkles(ctx, cx, cy, halfW, halfH, elapsed, d) {
    // 5 sparkle points with staggered phases, orbiting gently around the dino
    const count = 5;
    const phase = d.sparklePhase || 0;
    for (let i = 0; i < count; i++) {
      const t = elapsed * 0.8 + phase + (i * Math.PI * 2) / count;
      // Each sparkle drifts in an ellipse around the dino bounds
      const rx = halfW * 0.9 + Math.sin(t * 0.7 + i) * halfW * 0.3;
      const ry = halfH * 0.7 + Math.cos(t * 0.5 + i * 2) * halfH * 0.2;
      const sx = cx + Math.cos(t) * rx;
      const sy = cy + Math.sin(t * 1.3 + i) * ry;

      // Twinkle: fade in and out smoothly
      const twinkle = Math.sin(elapsed * 3.0 + i * 1.8) * 0.5 + 0.5;
      // Only show when twinkle is above threshold for sparse appearance
      if (twinkle < 0.3) continue;
      const alpha = (twinkle - 0.3) * 0.5; // max ~0.35 opacity — very subtle

      const size = 2.5 + twinkle * 1.5;

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(sx, sy);

      // 4-point star shape
      ctx.fillStyle = '#fffbe6';
      ctx.beginPath();
      ctx.moveTo(0, -size);
      ctx.lineTo(size * 0.25, -size * 0.25);
      ctx.lineTo(size, 0);
      ctx.lineTo(size * 0.25, size * 0.25);
      ctx.lineTo(0, size);
      ctx.lineTo(-size * 0.25, size * 0.25);
      ctx.lineTo(-size, 0);
      ctx.lineTo(-size * 0.25, -size * 0.25);
      ctx.closePath();
      ctx.fill();

      ctx.restore();
    }
  }

  _drawNameplate(d, cx, topY, scale = 1, alpha = 1) {
    const ctx = this.ctx;
    if (alpha < 0.01) return;
    if (alpha < 1) { ctx.save(); ctx.globalAlpha = alpha; }
    const p = d.partner;

    const photoSize = 12 * scale;
    const gap = 3 * scale;
    const padH = 5 * scale;

    // Build text
    const gender = p.gender || '';
    const genderSymbol = gender === 'male' ? ' \u2642' : gender === 'female' ? ' \u2640' : '';
    const shinyTag = p.shiny ? ' \u2728' : '';
    const line1 = (p.name || 'Unnamed') + genderSymbol + shinyTag;
    const line2 = p.owner_name ? `Owner: ${p.owner_name}` : '';

    const fontSize1 = Math.round(6 * scale);
    const fontSize2 = Math.round(5 * scale);
    ctx.font = `bold ${fontSize1}px sans-serif`;
    const line1W = ctx.measureText(line1).width;
    ctx.font = `${fontSize2}px sans-serif`;
    const line2W = line2 ? ctx.measureText(line2).width : 0;

    const textW = Math.max(line1W, line2W);
    const pillW = photoSize + gap + textW + padH * 2;
    const pillH = (line2 ? 16 : 12) * scale;
    const pillX = cx - pillW / 2;
    const pillY = topY;

    const isOwnPartner = p.player_id && store.playerId && p.player_id === store.playerId;
    // Pill background
    ctx.fillStyle = isOwnPartner ? 'rgba(40,30,10,0.65)' : 'rgba(0,0,0,0.65)';
    ctx.beginPath();
    ctx.roundRect(pillX, pillY, pillW, pillH, 4 * scale);
    ctx.fill();
    if (isOwnPartner) {
      ctx.strokeStyle = 'rgba(251, 191, 36, 0.55)';
      ctx.lineWidth = 0.6 * scale;
      ctx.stroke();
    } else {
      ctx.strokeStyle = 'rgba(74,222,128,0.3)';
      ctx.lineWidth = 0.5 * scale;
      ctx.stroke();
    }

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
      // Draw cover-fit to avoid squishing non-square photos
      const iw = photo.img.naturalWidth || photo.img.width;
      const ih = photo.img.naturalHeight || photo.img.height;
      const coverScale = Math.max(photoSize / iw, photoSize / ih);
      const dw = iw * coverScale;
      const dh = ih * coverScale;
      ctx.drawImage(photo.img, photoX - dw / 2, photoY - dh / 2, dw, dh);
    } else {
      // Fallback: green circle with initial
      ctx.fillStyle = '#4ade80';
      ctx.fillRect(photoX - photoR, photoY - photoR, photoSize, photoSize);
      ctx.fillStyle = '#fff';
      ctx.font = `bold ${fontSize1}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const initial = (p.owner_name || '?')[0].toUpperCase();
      ctx.fillText(initial, photoX, photoY);
    }
    ctx.restore();

    // Line 1: Dino name + gender
    const textLeft = pillX + padH + photoSize + gap;
    ctx.font = `bold ${fontSize1}px sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    const line1Y = line2 ? pillY + 6 * scale : pillY + pillH / 2;
    const nameOnly = p.name || 'Unnamed';
    let cursor = textLeft;

    // Name
    ctx.fillStyle = '#f0fdf4';
    ctx.fillText(nameOnly, cursor, line1Y);
    cursor += ctx.measureText(nameOnly).width;

    // Gender symbol (colored)
    if (genderSymbol) {
      ctx.fillStyle = gender === 'male' ? '#60a5fa' : '#f472b6';
      ctx.fillText(genderSymbol, cursor, line1Y);
      cursor += ctx.measureText(genderSymbol).width;
    }

    // Shiny sparkle
    if (shinyTag) {
      ctx.fillText(shinyTag, cursor, line1Y);
    }

    // Line 2: Owner name
    if (line2) {
      ctx.font = `${fontSize2}px sans-serif`;
      ctx.fillStyle = '#86efac';
      ctx.fillText(line2, textLeft, pillY + 12 * scale);
    }
    if (alpha < 1) ctx.restore();
  }
}
