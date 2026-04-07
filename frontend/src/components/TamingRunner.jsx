import { useState, useEffect, useRef, useCallback } from 'preact/hooks';
import { SPECIES } from '../data/species.js';
import { getRecolored, getRecoloredUncached } from '../utils/spriteEngine.js';
import { resolveColors, hasEffects } from '../dinoColors.js';
import meatImg from '../assets/items/meat.png';
import berryImg from '../assets/items/berry.png';

// ── Constants ────────────────────────────────────────────────────────────────

const RUN_DURATION = 20000;
const GROUND_Y_FRAC = 0.75;
const START_SPEED = 3;
const END_SPEED = 4.5;
const JUMP_DURATION = 500;
const JUMP_HEIGHT_FRAC = 0.35;
const STUMBLE_DURATION = 300;
const STUMBLE_SLOW = 0.4;
const DINO_X_FRAC = 0.2;
const SPRITE_SCALE = 1.5;
const OBSTACLE_MIN_GAP = 350;
const OBSTACLE_GAP_VARIANCE = 250;
const OBSTACLE_POOL_SIZE = 5;
const BOB_INTERVAL = 150;
const DEFAULT_REGIONS = ['body', 'belly', 'stripes'];

// ── Obstacle Types ───────────────────────────────────────────────────────────

const OBSTACLE_TYPES = [
  {
    w: 12, h: 24,
    draw(ctx, x, groundY) {
      // Small cactus
      ctx.fillStyle = '#22c55e';
      ctx.fillRect(x + 4, groundY - 24, 4, 24); // trunk
      ctx.fillRect(x, groundY - 16, 4, 8);       // left arm
      ctx.fillRect(x + 8, groundY - 20, 4, 8);   // right arm
    },
  },
  {
    w: 14, h: 34,
    draw(ctx, x, groundY) {
      // Tall cactus
      ctx.fillStyle = '#16a34a';
      ctx.fillRect(x + 5, groundY - 34, 4, 34);
      ctx.fillStyle = '#22c55e';
      ctx.fillRect(x, groundY - 24, 5, 6);
      ctx.fillRect(x + 9, groundY - 28, 5, 6);
    },
  },
  {
    w: 20, h: 14,
    draw(ctx, x, groundY) {
      // Rock
      ctx.fillStyle = '#6b7280';
      ctx.beginPath();
      ctx.moveTo(x, groundY);
      ctx.lineTo(x + 3, groundY - 12);
      ctx.lineTo(x + 10, groundY - 14);
      ctx.lineTo(x + 17, groundY - 10);
      ctx.lineTo(x + 20, groundY);
      ctx.closePath();
      ctx.fill();
      // highlight
      ctx.fillStyle = '#9ca3af';
      ctx.beginPath();
      ctx.moveTo(x + 5, groundY - 8);
      ctx.lineTo(x + 10, groundY - 13);
      ctx.lineTo(x + 14, groundY - 9);
      ctx.closePath();
      ctx.fill();
    },
  },
  {
    w: 22, h: 26,
    draw(ctx, x, groundY) {
      // Double cactus
      ctx.fillStyle = '#22c55e';
      ctx.fillRect(x + 2, groundY - 22, 4, 22);
      ctx.fillRect(x, groundY - 14, 3, 6);
      ctx.fillStyle = '#16a34a';
      ctx.fillRect(x + 14, groundY - 26, 4, 26);
      ctx.fillRect(x + 18, groundY - 18, 4, 6);
    },
  },
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
  // Distance counter top-right
  const meters = Math.floor(game.distance);
  ctx.save();
  ctx.font = 'bold 14px monospace';
  ctx.fillStyle = '#e0e0e0';
  ctx.textAlign = 'right';
  ctx.fillText(`${meters}m`, canvasW - 8, 20);

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

  // Jump Y offset
  let jumpY = 0;
  if (game.jumping) {
    const t = Math.min((now - game.jumpStart) / JUMP_DURATION, 1);
    jumpY = -Math.sin(t * Math.PI) * game.jumpHeight;
  }

  // Squash/stretch on jump
  let scaleX = 1;
  let scaleY = 1;
  if (game.jumping) {
    const t = (now - game.jumpStart) / JUMP_DURATION;
    if (t < 0.15) {
      // takeoff squash
      scaleX = 1.15;
      scaleY = 0.85;
    } else if (t > 0.4 && t < 0.6) {
      // mid-air stretch
      scaleX = 0.9;
      scaleY = 1.15;
    } else if (t > 0.85) {
      // landing squash
      scaleX = 1.15;
      scaleY = 0.85;
    }
  }

  const x = game.dinoX - (dw * scaleX) / 2;
  const y = game.groundY - dh * scaleY + jumpY + bobY;

  ctx.save();

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
  for (const obs of game.obstacles) {
    obs.type.draw(ctx, obs.x, game.groundY);
  }
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
  if (!spriteCanvas || game.jumping || game.stumbling) return;

  const sw = spriteCanvas.width * SPRITE_SCALE;
  const sh = spriteCanvas.height * SPRITE_SCALE;

  // Dino hitbox (forgiving: 60% width, 80% height)
  const dinoW = sw * 0.6;
  const dinoH = sh * 0.8;
  const dinoLeft = game.dinoX - dinoW / 2;
  const dinoRight = dinoLeft + dinoW;
  const dinoTop = game.groundY - dinoH;
  const dinoBottom = game.groundY;

  for (const obs of game.obstacles) {
    if (obs.passed) continue;

    const obsLeft = obs.x;
    const obsRight = obs.x + obs.type.w;
    const obsTop = game.groundY - obs.type.h;
    const obsBottom = game.groundY;

    // AABB overlap
    if (dinoRight > obsLeft && dinoLeft < obsRight && dinoBottom > obsTop && dinoTop < obsBottom) {
      game.stumbling = true;
      game.stumbleStart = performance.now();
      obs.passed = true;
      return;
    }
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

  // Canvas sizing — fill viewport in landscape orientation
  useEffect(() => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    // Use full viewport: wide dimension as width, short as height
    const w = Math.max(vw, vh);
    const h = Math.min(vw, vh);
    setCanvasSize({ w, h });
  }, []);

  const canvasW = canvasSize.w;
  const canvasH = canvasSize.h;

  const speciesData = SPECIES[species];
  const regions = speciesData ? speciesData.regions : DEFAULT_REGIONS;
  const animated = hasEffects(colors);

  // Jump handler
  const doJump = useCallback(() => {
    const game = gameRef.current;
    if (!game || game.jumping) return;
    game.jumping = true;
    game.jumpStart = performance.now();
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

    // Draw background gradient
    const grad = ctx.createLinearGradient(0, 0, 0, canvasH);
    grad.addColorStop(0, '#1a1a3e');
    grad.addColorStop(0.6, '#0f0f2a');
    grad.addColorStop(1, '#0a0a0a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvasW, canvasH);

    // Draw ground line
    const previewGame = { groundY, groundOffset: 0 };
    drawGround(ctx, previewGame, canvasW);

    // Draw dino standing still
    const resolved = animated ? resolveColors(colors, Date.now()) : colors;
    const spriteCanvas = animated
      ? getRecoloredUncached(species, resolved, regions)
      : getRecolored(species, resolved, regions);
    if (spriteCanvas) {
      const sw = spriteCanvas.width;
      const sh = spriteCanvas.height;
      const dw = sw * SPRITE_SCALE;
      const dh = sh * SPRITE_SCALE;
      // Flip horizontally (facing right)
      ctx.save();
      ctx.translate(dinoX + dw / 2, groundY - dh);
      ctx.scale(-1, 1);
      ctx.drawImage(spriteCanvas, -dw / 2, 0, dw, dh);
      ctx.restore();
    }

    // Scatter a few obstacles for visual interest
    const previewObs = [
      { type: OBSTACLE_TYPES[0], x: canvasW * 0.45 },
      { type: OBSTACLE_TYPES[2], x: canvasW * 0.65 },
      { type: OBSTACLE_TYPES[1], x: canvasW * 0.85 },
    ];
    for (const obs of previewObs) {
      obs.type.draw(ctx, obs.x, groundY);
    }
  }, [phase, canvasSize, species, colors, regions, animated]);

  // ── Game loop (runs when phase='running') ────────────────────────────────
  useEffect(() => {
    if (phase !== 'running') return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    // Load food image
    const foodImg = new Image();
    foodImg.src = foodType === 'meat' ? meatImg : berryImg;

    const groundY = Math.floor(canvasH * GROUND_Y_FRAC);
    const dinoX = Math.floor(canvasW * DINO_X_FRAC);
    const jumpHeight = Math.floor(canvasH * JUMP_HEIGHT_FRAC);

    const game = {
      startTime: performance.now(),
      distance: 0,
      speed: START_SPEED,
      groundOffset: 0,
      dinoY: groundY,
      jumping: false,
      jumpStart: 0,
      bobFrame: 0,
      lastBob: 0,
      stumbling: false,
      stumbleStart: 0,
      obstacles: [],
      nextObstacleX: canvasW + 100,
      groundY,
      dinoX,
      jumpHeight,
      foodImg: null,
      ending: false,
      ended: false,
    };

    foodImg.onload = () => { game.foodImg = foodImg; };
    // If already cached/loaded
    if (foodImg.complete && foodImg.naturalWidth > 0) {
      game.foodImg = foodImg;
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

      // Jump arc
      if (game.jumping) {
        const t = (now - game.jumpStart) / JUMP_DURATION;
        if (t >= 1) {
          game.jumping = false;
        }
      }

      // Bob dino sprite when on ground
      if (!game.jumping && now - game.lastBob > BOB_INTERVAL) {
        game.bobFrame++;
        game.lastBob = now;
      }

      // End-of-run
      if (elapsed >= RUN_DURATION && !game.ending) {
        game.ending = true;
        endTimeoutId = setTimeout(() => {
          game.ended = true;
          const finalScore = Math.floor(game.distance);
          setScore(finalScore);
          setPhase('done');
        }, 1500);
      }

      // Update obstacles and food
      updateObstacles(game, canvasW, now, progress);
      updateFood(game, canvasW);

      // Resolve sprite
      const time = Date.now();
      const resolved = animated ? resolveColors(colors, time) : colors;
      const spriteCanvas = animated
        ? getRecoloredUncached(species, resolved, regions)
        : getRecolored(species, resolved, regions);

      // Check collisions (only when not jumping)
      if (!game.jumping) {
        checkCollisions(game, spriteCanvas);
      }

      // ── Draw ──────────────────────────────────────────────────────────────
      ctx.clearRect(0, 0, canvasW, canvasH);
      // Gradient sky background
      if (!game._bgGrad) {
        const grad = ctx.createLinearGradient(0, 0, 0, canvasH);
        grad.addColorStop(0, '#1a1a3e');
        grad.addColorStop(0.6, '#0f0f2a');
        grad.addColorStop(1, '#0a0a0a');
        game._bgGrad = grad;
      }
      ctx.fillStyle = game._bgGrad;
      ctx.fillRect(0, 0, canvasW, canvasH);

      drawGround(ctx, game, canvasW);
      drawObstacles(ctx, game);
      drawFood(ctx, game);
      drawHUD(ctx, game, elapsed, canvasW);
      drawDino(ctx, game, spriteCanvas, now);

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

    const onTouch = (e) => {
      e.preventDefault();
      doJump();
    };
    const onMouse = () => doJump();
    const onKey = (e) => {
      if (e.code === 'Space') {
        e.preventDefault();
        doJump();
      }
    };

    canvas.addEventListener('touchstart', onTouch, { passive: false });
    canvas.addEventListener('mousedown', onMouse);
    window.addEventListener('keydown', onKey);

    return () => {
      canvas.removeEventListener('touchstart', onTouch);
      canvas.removeEventListener('mousedown', onMouse);
      window.removeEventListener('keydown', onKey);
    };
  }, [phase, doJump]);

  // ── Render ─────────────────────────────────────────────────────────────────

  const bonusXP = Math.min(10, Math.floor(score / 100));

  return (
    <div style={styles.container}>
      <canvas
        ref={canvasRef}
        width={canvasW}
        height={canvasH}
        style={styles.canvas}
      />

      {phase === 'ready' && (
        <div style={styles.readyOverlay} onClick={() => setPhase('running')}>
          <div style={styles.rotateHint}>📱 Turn your phone sideways!</div>
          <div style={styles.readyText}>TAP TO START</div>
        </div>
      )}

      {phase === 'done' && (
        <div style={styles.overlay}>
          <div style={styles.scoreText}>{score}m</div>
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
    maxWidth: '100vw',
    maxHeight: '100vh',
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
  rotateHint: {
    color: '#9ca3af',
    fontSize: '14px',
    letterSpacing: '1px',
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
