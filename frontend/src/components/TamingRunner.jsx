import { useState, useEffect, useRef, useCallback } from 'preact/hooks';
import { SPECIES } from '../data/species.js';
import { getRecolored, getRecoloredUncached } from '../utils/spriteEngine.js';
import { resolveColors, hasEffects } from '../dinoColors.js';
import meatImg from '../assets/items/meat.png';
import berryImg from '../assets/items/berry.png';
import forestBackdropUrl from '../assets/dinoRun/forest_backdrop.png';
import forestForegroundUrl from '../assets/dinoRun/forest_foreground.png';
import cactusUrl from '../assets/dinoRun/cactus.png';
import rockUrl from '../assets/dinoRun/rock.png';

// ── Constants ────────────────────────────────────────────────────────────────

const RUN_DURATION = 20000;
const GROUND_Y_FRAC = 0.75;
const START_SPEED = 3;
const END_SPEED = 4.5;
const GRAVITY = 0.5;
const JUMP_VELOCITY = -7;       // initial upward velocity on tap
const HOLD_GRAVITY = 0.25;      // reduced gravity while holding (floatier rise)
const MAX_FALL_SPEED = 8;
const STUMBLE_DURATION = 300;
const STUMBLE_SLOW = 0.4;
const DINO_X_FRAC = 0.2;
const SPRITE_SCALE = 1.5;
const OBSTACLE_MIN_GAP = 420;
const OBSTACLE_GAP_VARIANCE = 280;
const OBSTACLE_POOL_SIZE = 5;
const BOB_INTERVAL = 150;
const BERRY_MIN_GAP = 250;
const BERRY_GAP_VARIANCE = 300;
const BERRY_SIZE = 24;
const BERRY_MAX_POINTS = 50;
const BERRY_MIN_POINTS = 10;
const BERRY_DECAY_MS = 3000;     // time for points to decay from max to min
const POPUP_DURATION = 800;       // how long +X floats up
const POPUP_RISE = 40;            // pixels the popup rises
const DEFAULT_REGIONS = ['body', 'belly', 'stripes'];

// ── Obstacle sprites (preloaded at module level) ────────────────────────────

const _cactusImg = new Image();
_cactusImg.src = cactusUrl;
const _rockImg = new Image();
_rockImg.src = rockUrl;

function spriteObstacle(img, scale) {
  // Dimensions computed lazily once image loads
  let w = 0, h = 0, ready = false;
  function ensure() {
    if (!ready && img.complete && img.naturalWidth > 0) {
      w = Math.round(img.width * scale);
      h = Math.round(img.height * scale);
      ready = true;
    }
  }
  return {
    get w() { ensure(); return w || Math.round(16 * scale); },
    get h() { ensure(); return h || Math.round(16 * scale); },
    draw(ctx, x, groundY) {
      ensure();
      if (!ready) return;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, x, groundY - h, w, h);
    },
  };
}

const OBSTACLE_TYPES = [
  spriteObstacle(_cactusImg, 2),
  spriteObstacle(_cactusImg, 2.8),
  spriteObstacle(_rockImg, 2),
  spriteObstacle(_rockImg, 3),
];

// ── Module-level drawing and game helpers ────────────────────────────────────

function drawGround(ctx, game, canvasW) {
  ctx.save();
  ctx.strokeStyle = '#6366f1';
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 6]);
  ctx.lineDashOffset = -game.groundOffset;
  ctx.beginPath();
  ctx.moveTo(0, game.groundY);
  ctx.lineTo(canvasW, game.groundY);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

function drawHUD(ctx, game, elapsed, canvasW) {
  ctx.save();
  ctx.font = 'bold 14px monospace';

  // Berry score top-right
  ctx.fillStyle = '#4ade80';
  ctx.textAlign = 'right';
  ctx.fillText(`🪙 ${game.berryScore || 0}`, canvasW - 8, 20);

  // Distance below score
  const meters = Math.floor(game.distance);
  ctx.fillStyle = '#9ca3af';
  ctx.font = '12px monospace';
  ctx.fillText(`${meters}m`, canvasW - 8, 36);

  // Timer bar at top
  const frac = Math.min(elapsed / RUN_DURATION, 1);
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, 0, canvasW, 4);
  ctx.fillStyle = '#6366f1';
  ctx.fillRect(0, 0, canvasW * frac, 4);
  ctx.restore();
}

// Cached offscreen canvas for stumble red-tint overlay (avoid per-frame allocation)
let _stumbleTmp = null;
let _stumbleTmpCtx = null;

function drawDino(ctx, game, spriteCanvas, now) {
  if (!spriteCanvas) return;

  const sw = spriteCanvas.width;
  const sh = spriteCanvas.height;
  const dw = sw * SPRITE_SCALE;
  const dh = sh * SPRITE_SCALE;

  // Bob offset (2-frame, alternating every BOB_INTERVAL when on ground)
  let bobY = 0;
  if (!game.jumping) {
    bobY = game.bobFrame % 2 === 0 ? 0 : -2;
  }

  // Jump Y offset from physics
  const jumpY = game.dinoYOffset || 0;

  // Squash/stretch
  let scaleX = 1;
  let scaleY = 1;
  if (game.jumping) {
    if (game.velocityY < -4) {
      // rising fast — stretch vertically
      scaleX = 0.9;
      scaleY = 1.15;
    } else if (game.velocityY > 4) {
      // falling fast — squash
      scaleX = 1.15;
      scaleY = 0.85;
    }
  } else if (game.landSquash > 0) {
    // brief squash on landing
    scaleX = 1.12;
    scaleY = 0.88;
  }

  const x = game.dinoX - (dw * scaleX) / 2;
  const y = game.groundY - dh * scaleY + jumpY + bobY;

  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
  ctx.shadowBlur = 8;
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 2;

  // Flip horizontally so dino faces right (sprites face left by default)
  const drawW = dw * scaleX;
  const drawH = dh * scaleY;
  ctx.translate(x + drawW, y);
  ctx.scale(-1, 1);

  // Stumble red flash
  if (game.stumbling) {
    const stT = (now - game.stumbleStart) / STUMBLE_DURATION;
    const flash = Math.sin(stT * Math.PI * 4) * 0.5 + 0.5;

    // Draw normal sprite
    ctx.drawImage(spriteCanvas, 0, 0, drawW, drawH);

    // Red overlay using cached offscreen canvas with source-atop
    const needW = Math.ceil(drawW);
    const needH = Math.ceil(drawH);
    if (!_stumbleTmp) {
      _stumbleTmp = document.createElement('canvas');
      _stumbleTmpCtx = _stumbleTmp.getContext('2d');
      _stumbleTmpCtx.imageSmoothingEnabled = false;
    }
    if (_stumbleTmp.width !== needW || _stumbleTmp.height !== needH) {
      _stumbleTmp.width = needW;
      _stumbleTmp.height = needH;
      _stumbleTmpCtx.imageSmoothingEnabled = false;
    }
    _stumbleTmpCtx.clearRect(0, 0, needW, needH);
    _stumbleTmpCtx.globalCompositeOperation = 'source-over';
    _stumbleTmpCtx.drawImage(spriteCanvas, 0, 0, needW, needH);
    _stumbleTmpCtx.globalCompositeOperation = 'source-atop';
    _stumbleTmpCtx.fillStyle = `rgba(255, 60, 60, ${flash * 0.6})`;
    _stumbleTmpCtx.fillRect(0, 0, needW, needH);

    ctx.globalAlpha = 1;
    ctx.drawImage(_stumbleTmp, 0, 0);
  } else {
    ctx.drawImage(spriteCanvas, 0, 0, drawW, drawH);
  }

  ctx.restore();
}

function drawObstacles(ctx, game) {
  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
  ctx.shadowBlur = 10;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 2;
  for (const obs of game.obstacles) {
    obs.type.draw(ctx, obs.x, game.groundY - 4);
  }
  ctx.restore();
}

function updateFood(game, canvasW) {
  if (!game.ending || !game.foodImg) return;
  // Initialize food position on first ending frame
  if (game.foodX == null) {
    game.foodX = canvasW + 20;
    game.foodY = game.groundY - game.groundY * 0.5; // start high in the air
    game.foodTargetY = game.groundY - 28; // land near ground
  }
  // Float toward the dino: drift left and descend
  const driftSpeed = game.speed * 0.6;
  game.foodX -= driftSpeed;
  // Ease Y toward target
  game.foodY += (game.foodTargetY - game.foodY) * 0.03;
  // Don't drift past the dino
  const minX = game.dinoX + 10;
  if (game.foodX < minX) game.foodX = minX;
}

function drawFood(ctx, game) {
  if (!game.ending || !game.foodImg || game.foodX == null) return;
  const size = 28;
  // Gentle bob
  const bob = Math.sin(performance.now() / 200) * 3;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(game.foodImg, game.foodX, game.foodY + bob, size, size);
}

function spawnObstacle(game, canvasW, progress) {
  const type = OBSTACLE_TYPES[Math.floor(Math.random() * OBSTACLE_TYPES.length)];
  game.obstacles.push({
    type,
    x: canvasW + type.w,
    passed: false,
  });
  // Gaps shrink as progress increases: full gap at start, ~55% gap at end
  const gapScale = 1 - progress * 0.45;
  game.nextObstacleX = canvasW + (OBSTACLE_MIN_GAP + Math.random() * OBSTACLE_GAP_VARIANCE) * gapScale;
}

function updateObstacles(game, canvasW, now, progress) {
  // Spawn new obstacles
  if (game.obstacles.length < OBSTACLE_POOL_SIZE && game.nextObstacleX <= canvasW && !game.ending) {
    spawnObstacle(game, canvasW, progress);
  }

  // Move obstacles left
  for (let i = game.obstacles.length - 1; i >= 0; i--) {
    game.obstacles[i].x -= game.speed;
    // Cull off-screen
    if (game.obstacles[i].x + game.obstacles[i].type.w < 0) {
      game.obstacles.splice(i, 1);
    }
  }

  // Decrease next obstacle distance
  game.nextObstacleX -= game.speed;
}

function checkCollisions(game, spriteCanvas) {
  if (!spriteCanvas || game.stumbling) return;

  const sw = spriteCanvas.width * SPRITE_SCALE;
  const sh = spriteCanvas.height * SPRITE_SCALE;

  // Dino hitbox (forgiving: 60% width, 80% height)
  const dinoW = sw * 0.6;
  const dinoH = sh * 0.8;
  const dinoLeft = game.dinoX - dinoW / 2;
  const dinoRight = dinoLeft + dinoW;
  const dinoTop = game.groundY - dinoH + (game.dinoYOffset || 0);
  const dinoBottom = game.groundY + (game.dinoYOffset || 0);

  // Obstacle collisions (only when on ground)
  if (!game.jumping) {
    for (const obs of game.obstacles) {
      if (obs.passed) continue;
      const obsLeft = obs.x;
      const obsRight = obs.x + obs.type.w;
      const obsTop = game.groundY - obs.type.h;
      const obsBottom = game.groundY;
      if (dinoRight > obsLeft && dinoLeft < obsRight && dinoBottom > obsTop && dinoTop < obsBottom) {
        game.stumbling = true;
        game.stumbleStart = performance.now();
        obs.passed = true;
        return;
      }
    }
  }

  // Berry collection (works in air too)
  const half = BERRY_SIZE / 2;
  for (let i = game.berries.length - 1; i >= 0; i--) {
    const b = game.berries[i];
    const bLeft = b.x - half;
    const bRight = b.x + half;
    const bTop = b.y - half;
    const bBottom = b.y + half;
    if (dinoRight > bLeft && dinoLeft < bRight && dinoBottom > bTop && dinoTop < bBottom) {
      // Score: more points the faster you grab it
      const age = performance.now() - b.spawnTime;
      const t = Math.min(age / BERRY_DECAY_MS, 1);
      const points = Math.round(BERRY_MAX_POINTS - (BERRY_MAX_POINTS - BERRY_MIN_POINTS) * t);
      game.berryScore += points;
      // Spawn popup
      game.popups.push({ x: b.x, y: b.y, points, startTime: performance.now() });
      game.berries.splice(i, 1);
    }
  }
}

function overlapsObstacle(game, x, y) {
  const half = BERRY_SIZE / 2;
  const pad = 8; // extra padding so coins don't sit right at the edge
  for (const obs of game.obstacles) {
    const obsL = obs.x - pad;
    const obsR = obs.x + obs.type.w + pad;
    const obsT = game.groundY - obs.type.h - pad;
    if (x + half > obsL && x - half < obsR && y + half > obsT && y - half < game.groundY) {
      return true;
    }
  }
  return false;
}

// Max jump height from physics: v²/(2g) using hold gravity (floatiest jump)
const MAX_JUMP_PX = (JUMP_VELOCITY * JUMP_VELOCITY) / (2 * HOLD_GRAVITY);

function spawnBerry(game, canvasW) {
  const x = canvasW + BERRY_SIZE;
  // Aerial coins spawn between 30-90% of max jump height
  const groundLevel = game.groundY - BERRY_SIZE;
  const minAir = game.groundY - MAX_JUMP_PX * 0.9;
  const maxAir = game.groundY - MAX_JUMP_PX * 0.3;
  const airLevel = minAir + Math.random() * (maxAir - minAir);
  let y = Math.random() < 0.6 ? groundLevel : airLevel;

  // If ground-level coin overlaps an obstacle, push it to air instead
  if (y === groundLevel && overlapsObstacle(game, x, y)) {
    y = minAir + Math.random() * (maxAir - minAir);
  }

  game.berries.push({
    x,
    y,
    spawnTime: performance.now(),
  });
  game.nextBerryX = canvasW + BERRY_MIN_GAP + Math.random() * BERRY_GAP_VARIANCE;
}

function updateBerries(game, canvasW) {
  if (!game.ending && game.nextBerryX <= canvasW) {
    spawnBerry(game, canvasW);
  }
  game.nextBerryX -= game.speed;
  // Move berries left and cull off-screen
  for (let i = game.berries.length - 1; i >= 0; i--) {
    game.berries[i].x -= game.speed;
    if (game.berries[i].x + BERRY_SIZE < 0) {
      game.berries.splice(i, 1);
    }
  }
}

function drawCoin(ctx, cx, cy, r) {
  ctx.save();
  // Squash horizontally for a narrower, angled-coin look
  ctx.translate(cx, cy);
  ctx.scale(0.65, 1);
  // Outer gold
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fillStyle = '#fbbf24';
  ctx.fill();
  // Inner ring
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.75, 0, Math.PI * 2);
  ctx.strokeStyle = '#d97706';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // Centre dot
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.25, 0, Math.PI * 2);
  ctx.fillStyle = '#d97706';
  ctx.fill();
  ctx.restore();
}

function drawBerries(ctx, game) {
  const half = BERRY_SIZE / 2;
  const r = half - 2;
  for (const b of game.berries) {
    const bob = Math.sin((performance.now() + b.x * 3) / 250) * 2;
    drawCoin(ctx, b.x, b.y + bob, r);
  }
}

function drawPopups(ctx, game, now) {
  for (let i = game.popups.length - 1; i >= 0; i--) {
    const p = game.popups[i];
    const t = (now - p.startTime) / POPUP_DURATION;
    if (t >= 1) {
      game.popups.splice(i, 1);
      continue;
    }
    const alpha = 1 - t;
    const rise = t * POPUP_RISE;
    ctx.save();
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = `rgba(74, 222, 128, ${alpha})`;
    ctx.fillText(`+${p.points}`, p.x, p.y - rise);
    ctx.restore();
  }
}

// ── Dust particles ──────────────────────────────────────────────────────────

const DUST_LIFE = 600; // ms

function spawnDust(game, count, spread, extraVy) {
  for (let i = 0; i < count; i++) {
    game.dust.push({
      x: game.dinoX + (Math.random() - 0.5) * spread,
      y: game.groundY - Math.random() * 4,
      vx: -(Math.random() * 2 + 0.5),
      vy: -(Math.random() * 2 + 0.5) + (extraVy || 0),
      life: DUST_LIFE,
      born: performance.now(),
      size: 2.5 + Math.random() * 3,
    });
  }
}

function updateDust(game, now) {
  for (let i = game.dust.length - 1; i >= 0; i--) {
    const d = game.dust[i];
    d.x += d.vx;
    d.y += d.vy;
    d.vy += 0.03;
    if (now - d.born >= d.life) {
      game.dust.splice(i, 1);
    }
  }
}

function drawDust(ctx, game, now) {
  for (const d of game.dust) {
    const t = (now - d.born) / d.life;
    const alpha = 1 - t;
    ctx.beginPath();
    ctx.arc(d.x, d.y, d.size * (1 - t * 0.5), 0, Math.PI * 2);
    ctx.fillStyle = `rgba(210, 200, 180, ${alpha * 0.8})`;
    ctx.fill();
  }
}

// ── Component ────────────────────────────────────────────────────────────────

export function TamingRunner({ species, colors, foodType, onComplete }) {
  const [phase, setPhase] = useState('ready');
  const [score, setScore] = useState(0);
  const [canvasSize, setCanvasSize] = useState({ w: 360, h: 200 });
  const canvasRef = useRef(null);
  const gameRef = useRef(null);
  const rafRef = useRef(null);

  const [isPortrait, setIsPortrait] = useState(false);

  // Canvas sizing — always landscape resolution, CSS-rotated if portrait
  useEffect(() => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const w = Math.max(vw, vh);
    const h = Math.min(vw, vh);
    setCanvasSize({ w, h });
    setIsPortrait(vh > vw);
  }, []);

  const canvasW = canvasSize.w;
  const canvasH = canvasSize.h;

  const speciesData = SPECIES[species];
  const regions = speciesData ? speciesData.regions : DEFAULT_REGIONS;
  const animated = hasEffects(colors);

  // Jump handlers
  const doJump = useCallback(() => {
    const game = gameRef.current;
    if (!game || game.jumping) return;
    game.jumping = true;
    game.holdingJump = true;
    game.velocityY = JUMP_VELOCITY;
    game.landSquash = 0;
  }, []);

  const doRelease = useCallback(() => {
    const game = gameRef.current;
    if (!game) return;
    game.holdingJump = false;
  }, []);

  // ── Static preview frame for 'ready' phase ──────────────────────────────
  useEffect(() => {
    if (phase !== 'ready') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    const groundY = Math.floor(canvasH * GROUND_Y_FRAC);
    const dinoX = Math.floor(canvasW * DINO_X_FRAC);

    // Preload images for preview
    const previewBg = new Image();
    previewBg.src = forestBackdropUrl;
    const previewFg = new Image();
    previewFg.src = forestForegroundUrl;

    let pending = 2;
    function drawPreview() {
      ctx.clearRect(0, 0, canvasW, canvasH);

      // Background
      if (previewBg.complete && previewBg.naturalWidth > 0) {
        const scale = canvasH / previewBg.height;
        const drawW = previewBg.width * scale;
        for (let x = 0; x < canvasW; x += drawW) {
          ctx.drawImage(previewBg, x, 0, drawW, canvasH);
        }
        ctx.fillStyle = 'rgba(10, 10, 26, 0.45)';
        ctx.fillRect(0, 0, canvasW, canvasH);
      } else {
        const grad = ctx.createLinearGradient(0, 0, 0, canvasH);
        grad.addColorStop(0, '#1a1a3e');
        grad.addColorStop(0.6, '#0f0f2a');
        grad.addColorStop(1, '#0a0a0a');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, canvasW, canvasH);
      }

      // Ground line
      drawGround(ctx, { groundY, groundOffset: 0 }, canvasW);

      // Foreground foliage — fill from ground line to bottom
      if (previewFg.complete && previewFg.naturalWidth > 0) {
        const fgH = canvasH - groundY + Math.floor(canvasH * 0.02);
        const fgScale = fgH / previewFg.height;
        const fgW = previewFg.width * fgScale;
        const fgY = groundY - Math.floor(canvasH * 0.02);
        const tileW = Math.ceil(fgW) + 1;
        for (let x = 0; x < canvasW; x += fgW) {
          ctx.drawImage(previewFg, Math.floor(x), fgY, tileW, fgH);
        }
      }

      // Obstacles
      const previewObs = [
        { type: OBSTACLE_TYPES[0], x: canvasW * 0.45 },
        { type: OBSTACLE_TYPES[2], x: canvasW * 0.65 },
        { type: OBSTACLE_TYPES[1], x: canvasW * 0.85 },
      ];
      for (const obs of previewObs) obs.type.draw(ctx, obs.x, groundY - 4);

      // Dino
      const resolved = animated ? resolveColors(colors, Date.now()) : colors;
      const sc = animated
        ? getRecoloredUncached(species, resolved, regions)
        : getRecolored(species, resolved, regions);
      if (sc) {
        const dw = sc.width * SPRITE_SCALE;
        const dh = sc.height * SPRITE_SCALE;
        ctx.save();
        ctx.translate(dinoX + dw / 2, groundY - dh);
        ctx.scale(-1, 1);
        ctx.drawImage(sc, -dw / 2, 0, dw, dh);
        ctx.restore();
      }
    }

    drawPreview();
    const onLoad = () => { if (--pending <= 0) drawPreview(); };
    previewBg.onload = onLoad;
    previewFg.onload = onLoad;
  }, [phase, canvasSize, species, colors, regions, animated]);

  // ── Game loop (runs when phase='running') ────────────────────────────────
  useEffect(() => {
    if (phase !== 'running') return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    // Load food image (end-of-run)
    const foodImg = new Image();
    foodImg.src = foodType === 'meat' ? meatImg : berryImg;

    // Load backdrop and foreground
    const backdropImg = new Image();
    backdropImg.src = forestBackdropUrl;
    const foregroundImg = new Image();
    foregroundImg.src = forestForegroundUrl;

    const groundY = Math.floor(canvasH * GROUND_Y_FRAC);
    const dinoX = Math.floor(canvasW * DINO_X_FRAC);

    const game = {
      startTime: performance.now(),
      distance: 0,
      speed: START_SPEED,
      groundOffset: 0,
      bgOffset: 0,
      fgOffset: 0,
      dinoYOffset: 0,
      velocityY: 0,
      jumping: false,
      holdingJump: false,
      landSquash: 0,
      bobFrame: 0,
      lastBob: 0,
      stumbling: false,
      stumbleStart: 0,
      obstacles: [],
      nextObstacleX: canvasW + 100,
      berries: [],
      nextBerryX: canvasW + 200,
      berryScore: 0,
      popups: [],
      dust: [],
      groundY,
      dinoX,
      foodImg: null,
      backdropImg: null,
      foregroundImg: null,
      ending: false,
      ended: false,
    };

    foodImg.onload = () => { game.foodImg = foodImg; };
    if (foodImg.complete && foodImg.naturalWidth > 0) {
      game.foodImg = foodImg;
    }
    backdropImg.onload = () => { game.backdropImg = backdropImg; };
    if (backdropImg.complete && backdropImg.naturalWidth > 0) {
      game.backdropImg = backdropImg;
    }
    foregroundImg.onload = () => { game.foregroundImg = foregroundImg; };
    if (foregroundImg.complete && foregroundImg.naturalWidth > 0) {
      game.foregroundImg = foregroundImg;
    }

    gameRef.current = game;

    let endTimeoutId = null;

    function tick(now) {
      if (game.ended) return;

      const elapsed = now - game.startTime;

      // Ramp speed linearly
      const progress = Math.min(elapsed / RUN_DURATION, 1);
      game.speed = START_SPEED + (END_SPEED - START_SPEED) * progress;

      // Stumble slowdown
      if (game.stumbling) {
        if (now - game.stumbleStart > STUMBLE_DURATION) {
          game.stumbling = false;
        } else {
          game.speed *= STUMBLE_SLOW;
        }
      }

      // Accumulate distance
      game.distance += game.speed * 0.5;

      // Scroll ground (mod by dash pattern period 8+6=14)
      game.groundOffset = (game.groundOffset + game.speed) % 14;
      // Parallax: backdrop slow, foreground faster
      game.bgOffset += game.speed * 0.4;
      game.fgOffset += game.speed;

      // Jump physics: hold = float up (low gravity), release = fall (full gravity)
      if (game.jumping) {
        const grav = game.holdingJump && game.velocityY < 0 ? HOLD_GRAVITY : GRAVITY;
        game.velocityY = Math.min(game.velocityY + grav, MAX_FALL_SPEED);
        game.dinoYOffset += game.velocityY;
        // Landed
        if (game.dinoYOffset >= 0) {
          game.dinoYOffset = 0;
          game.velocityY = 0;
          game.jumping = false;
          game.holdingJump = false;
          game.landSquash = 4;
          spawnDust(game, 8, 20, -1.5); // landing puff
        }
      }
      if (game.landSquash > 0) game.landSquash--;

      // Bob dino sprite when on ground + running dust
      if (!game.jumping && now - game.lastBob > BOB_INTERVAL) {
        game.bobFrame++;
        game.lastBob = now;
        spawnDust(game, 2, 10, 0);
      }

      // End-of-run
      if (elapsed >= RUN_DURATION && !game.ending) {
        game.ending = true;
        endTimeoutId = setTimeout(() => {
          game.ended = true;
          const finalScore = Math.floor(game.distance) + game.berryScore;
          setScore(finalScore);
          setPhase('done');
        }, 1500);
      }

      // Update obstacles, berries, food, dust
      updateObstacles(game, canvasW, now, progress);
      updateBerries(game, canvasW);
      updateFood(game, canvasW);
      updateDust(game, now);

      // Resolve sprite
      const time = Date.now();
      const resolved = animated ? resolveColors(colors, time) : colors;
      const spriteCanvas = animated
        ? getRecoloredUncached(species, resolved, regions)
        : getRecolored(species, resolved, regions);

      // Check collisions (obstacles + berry collection)
      checkCollisions(game, spriteCanvas);

      // ── Draw ──────────────────────────────────────────────────────────────
      ctx.clearRect(0, 0, canvasW, canvasH);

      // Scrolling backdrop (parallax) or fallback gradient
      if (game.backdropImg) {
        const img = game.backdropImg;
        // Scale image to fill canvas height, then tile horizontally
        const scale = canvasH / img.height;
        const drawW = img.width * scale;
        const offset = game.bgOffset % drawW;
        for (let x = -offset; x < canvasW; x += drawW) {
          ctx.drawImage(img, x, 0, drawW, canvasH);
        }
        // Darken overlay so foreground elements stay visible
        ctx.fillStyle = 'rgba(10, 10, 26, 0.45)';
        ctx.fillRect(0, 0, canvasW, canvasH);
      } else {
        if (!game._bgGrad) {
          const grad = ctx.createLinearGradient(0, 0, 0, canvasH);
          grad.addColorStop(0, '#1a1a3e');
          grad.addColorStop(0.6, '#0f0f2a');
          grad.addColorStop(1, '#0a0a0a');
          game._bgGrad = grad;
        }
        ctx.fillStyle = game._bgGrad;
        ctx.fillRect(0, 0, canvasW, canvasH);
      }

      drawGround(ctx, game, canvasW);

      // Foreground foliage — scale to fill from ground line to bottom
      if (game.foregroundImg) {
        const fgImg = game.foregroundImg;
        const fgH = canvasH - game.groundY + Math.floor(canvasH * 0.02);
        const fgScale = fgH / fgImg.height;
        const fgW = fgImg.width * fgScale;
        const fgY = game.groundY - Math.floor(canvasH * 0.02);
        const offset = game.fgOffset % fgW;
        const tileW = Math.ceil(fgW) + 1; // +1px overlap to hide sub-pixel seams
        for (let x = -offset; x < canvasW; x += fgW) {
          ctx.drawImage(fgImg, Math.floor(x), fgY, tileW, fgH);
        }
      }

      drawDust(ctx, game, now);
      drawObstacles(ctx, game);
      drawBerries(ctx, game);
      drawFood(ctx, game);
      drawHUD(ctx, game, elapsed, canvasW);
      drawDino(ctx, game, spriteCanvas, now);
      drawPopups(ctx, game, now);

      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (endTimeoutId) clearTimeout(endTimeoutId);
    };
  }, [phase, canvasSize, species, colors, regions, animated]);

  // ── Input handling ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'running') return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const onTouchStart = (e) => { e.preventDefault(); doJump(); };
    const onTouchEnd = (e) => { e.preventDefault(); doRelease(); };
    const onMouseDown = () => doJump();
    const onMouseUp = () => doRelease();
    const onKeyDown = (e) => { if (e.code === 'Space') { e.preventDefault(); doJump(); } };
    const onKeyUp = (e) => { if (e.code === 'Space') doRelease(); };

    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd, { passive: false });
    canvas.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    return () => {
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchend', onTouchEnd);
      canvas.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [phase, doJump, doRelease]);

  // ── Render ─────────────────────────────────────────────────────────────────

  const bonusXP = Math.min(10, Math.floor(score / 100));

  const rotateStyle = isPortrait ? {
    position: 'absolute',
    transform: 'rotate(90deg)',
    transformOrigin: 'center center',
    width: '100vh',
    height: '100vw',
    left: '50%',
    top: '50%',
    marginLeft: '-50vh',
    marginTop: '-50vw',
  } : {};

  return (
    <div style={styles.container}>
      <div style={rotateStyle}>
        <canvas
          ref={canvasRef}
          width={canvasW}
          height={canvasH}
          style={styles.canvas}
        />

        {phase === 'ready' && (
          <div style={styles.readyOverlay} onClick={() => setPhase('running')}>
            <div style={styles.readyText}>TAP TO START</div>
          </div>
        )}

      {phase === 'done' && (
        <div style={styles.overlay}>
          <div style={styles.scoreText}>Score: {score}</div>
          <div style={styles.bonusText}>+{bonusXP} bonus XP</div>
          <button
            style={styles.continueBtn}
            onClick={() => onComplete(score)}
          >
            Continue
          </button>
        </div>
      )}
      </div>
    </div>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = {
  container: {
    position: 'fixed',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#0a0a0a',
    zIndex: 100,
  },
  canvas: {
    display: 'block',
    background: '#0a0a0a',
    width: '100%',
    height: '100%',
    imageRendering: 'pixelated',
    touchAction: 'none',
  },
  readyOverlay: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    background: 'rgba(10, 10, 10, 0.45)',
    cursor: 'pointer',
  },
  overlay: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(10, 10, 10, 0.75)',
    cursor: 'pointer',
  },
  readyText: {
    color: '#e0e0e0',
    fontSize: '28px',
    fontWeight: '900',
    letterSpacing: '4px',
    textShadow: '0 0 16px #6366f1, 0 0 32px #6366f180',
  },
  scoreText: {
    color: '#e0e0e0',
    fontSize: '32px',
    fontWeight: 'bold',
    fontFamily: 'monospace',
  },
  bonusText: {
    color: '#6366f1',
    fontSize: '16px',
    marginTop: '4px',
    marginBottom: '16px',
  },
  continueBtn: {
    background: '#22c55e',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    padding: '10px 28px',
    fontSize: '16px',
    fontWeight: 'bold',
    cursor: 'pointer',
  },
};
