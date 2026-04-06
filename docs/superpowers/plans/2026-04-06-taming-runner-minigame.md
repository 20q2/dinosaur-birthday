# Taming Runner Minigame Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Chrome-dino-style side-scrolling runner minigame between the food harvest and dino naming screens, where the player's wild dino runs toward food dodging obstacles.

**Architecture:** Single new Preact component (`TamingRunner.jsx`) with a canvas-based game loop. Integrates into `FoodHarvest.jsx` as a new phase between `'minigame'` and `'taming'`. No backend changes. Uses existing `spriteEngine.js` for dino sprite rendering.

**Tech Stack:** Preact, HTML5 Canvas, existing spriteEngine.js

**Spec:** `docs/superpowers/specs/2026-04-06-taming-runner-minigame-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `frontend/src/components/TamingRunner.jsx` | Create | Canvas runner minigame — game loop, obstacles, jumping, scoring, all rendering |
| `frontend/src/components/FoodHarvest.jsx` | Modify | Add `'runner'` phase between harvest and taming, pass species/colors to runner |

---

### Task 1: Scaffold TamingRunner.jsx with Phase State Machine

**Files:**
- Create: `frontend/src/components/TamingRunner.jsx`

- [ ] **Step 1: Create TamingRunner.jsx with phase management and canvas ref**

```jsx
import { useState, useEffect, useRef, useCallback } from 'preact/hooks';
import { SPECIES } from '../data/species.js';
import { getRecolored, getRecoloredUncached } from '../utils/spriteEngine.js';
import { resolveColors, hasEffects } from '../dinoColors.js';
import meatImg from '../assets/items/meat.png';
import berryImg from '../assets/items/berry.png';

const RUN_DURATION = 20000; // 20 seconds
const GROUND_Y_FRAC = 0.75; // ground line at 75% canvas height
const START_SPEED = 3; // pixels per frame
const END_SPEED = 4.5; // 1.5x by end
const JUMP_DURATION = 500; // ms
const JUMP_HEIGHT_FRAC = 0.35; // fraction of canvas height
const STUMBLE_DURATION = 300; // ms
const STUMBLE_SLOW = 0.4; // speed multiplier during stumble
const DINO_X_FRAC = 0.2; // dino sits at 20% from left
const SPRITE_SCALE = 2;
const OBSTACLE_MIN_GAP = 180; // min px between obstacles
const OBSTACLE_POOL_SIZE = 5;
const BOB_INTERVAL = 150; // ms per bob frame

export function TamingRunner({ species, colors, foodType, onComplete }) {
  const canvasRef = useRef(null);
  const [phase, setPhase] = useState('ready'); // 'ready' | 'running' | 'done'
  const [finalScore, setFinalScore] = useState(0);
  const gameRef = useRef(null);

  // Canvas sizing
  const [canvasSize, setCanvasSize] = useState({ w: 360, h: 200 });

  useEffect(() => {
    const w = Math.min(window.innerWidth, 600);
    const h = Math.floor(w * 0.45);
    setCanvasSize({ w, h });
  }, []);

  return (
    <div style={styles.container}>
      {phase === 'ready' && (
        <div style={styles.readyOverlay} onClick={() => setPhase('running')}>
          <div style={styles.readyText}>TAP TO START!</div>
        </div>
      )}
      <canvas
        ref={canvasRef}
        width={canvasSize.w}
        height={canvasSize.h}
        style={{ ...styles.canvas, imageRendering: 'pixelated' }}
      />
      {phase === 'done' && (
        <div style={styles.doneOverlay}>
          <div style={styles.scoreText}>{finalScore}m</div>
          <div style={styles.xpText}>+{Math.min(10, Math.floor(finalScore / 100))} bonus XP</div>
          <button style={styles.continueBtn} onClick={() => onComplete(finalScore)}>
            Continue
          </button>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    background: '#0a0a0a',
    padding: '20px 0',
    gap: '16px',
  },
  canvas: {
    background: '#0a0a0a',
    borderRadius: '8px',
    border: '1px solid #1a1a2e',
    touchAction: 'none',
  },
  readyOverlay: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
    cursor: 'pointer',
  },
  readyText: {
    color: '#6366f1',
    fontSize: '24px',
    fontWeight: '900',
    letterSpacing: '3px',
    animation: 'pulse 1.5s ease-in-out infinite',
  },
  doneOverlay: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px',
    marginTop: '16px',
  },
  scoreText: {
    color: '#e0e0e0',
    fontSize: '36px',
    fontWeight: '900',
  },
  xpText: {
    color: '#f59e0b',
    fontSize: '16px',
    fontWeight: 'bold',
  },
  continueBtn: {
    padding: '16px 48px',
    borderRadius: '12px',
    border: 'none',
    background: '#22c55e',
    color: 'white',
    fontSize: '16px',
    fontWeight: 'bold',
    cursor: 'pointer',
    marginTop: '8px',
  },
};
```

- [ ] **Step 2: Verify the component renders**

Run: `cd frontend && npm run dev`

Open browser to `http://localhost:3000/dinosaur-birthday/` and manually navigate to a food scan route. At this point we haven't wired it in yet, so just verify the dev server builds without errors by checking the terminal output. No build errors = success.

- [ ] **Step 3: Commit scaffold**

```bash
git add frontend/src/components/TamingRunner.jsx
git commit -m "feat: scaffold TamingRunner component with phase state machine"
```

---

### Task 2: Implement the Game Loop and Ground Rendering

**Files:**
- Modify: `frontend/src/components/TamingRunner.jsx`

- [ ] **Step 1: Add game state initialization and the core game loop**

Add the game state object and `requestAnimationFrame` loop inside the component. Insert this code after the `useEffect` that sets canvas size and before the `return` statement:

```jsx
  // Initialize game state when phase transitions to 'running'
  useEffect(() => {
    if (phase !== 'running') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const speciesData = SPECIES[species];
    const animated = hasEffects(colors);

    const game = {
      startTime: performance.now(),
      distance: 0,
      speed: START_SPEED,
      groundOffset: 0,
      // Dino state
      dinoY: 0, // offset from ground (0 = on ground, positive = up)
      jumping: false,
      jumpStart: 0,
      bobFrame: 0,
      lastBob: 0,
      // Stumble
      stumbling: false,
      stumbleStart: 0,
      // Obstacles
      obstacles: [],
      nextObstacleX: canvasSize.w + 100,
      // Dimensions
      groundY: Math.floor(canvasSize.h * GROUND_Y_FRAC),
      dinoX: Math.floor(canvasSize.w * DINO_X_FRAC),
      jumpHeight: Math.floor(canvasSize.h * JUMP_HEIGHT_FRAC),
      // Food image for end
      foodImg: null,
      // End state
      ending: false,
      ended: false,
    };

    // Load food image
    const fImg = new Image();
    fImg.src = speciesData.food === 'meat' ? meatImg : berryImg;
    fImg.onload = () => { game.foodImg = fImg; };

    gameRef.current = game;

    let rafId;

    function tick(now) {
      if (game.ended) return;
      const elapsed = now - game.startTime;

      // Speed ramp: linear from START_SPEED to END_SPEED over RUN_DURATION
      const progress = Math.min(elapsed / RUN_DURATION, 1);
      const stumbleMult = game.stumbling && (now - game.stumbleStart < STUMBLE_DURATION) ? STUMBLE_SLOW : 1;
      if (game.stumbling && now - game.stumbleStart >= STUMBLE_DURATION) {
        game.stumbling = false;
      }
      game.speed = (START_SPEED + (END_SPEED - START_SPEED) * progress) * stumbleMult;

      // Distance
      game.distance += game.speed * 0.5; // scale to reasonable "meters"
      game.groundOffset = (game.groundOffset + game.speed) % 20;

      // Jump arc
      if (game.jumping) {
        const jumpElapsed = now - game.jumpStart;
        if (jumpElapsed >= JUMP_DURATION) {
          game.jumping = false;
          game.dinoY = 0;
        } else {
          const t = jumpElapsed / JUMP_DURATION;
          game.dinoY = Math.sin(t * Math.PI) * game.jumpHeight;
        }
      }

      // Bob animation
      if (now - game.lastBob > BOB_INTERVAL) {
        game.bobFrame = 1 - game.bobFrame;
        game.lastBob = now;
      }

      // Check end
      if (elapsed >= RUN_DURATION && !game.ending) {
        game.ending = true;
        // Stop spawning, let remaining obstacles scroll off
        setTimeout(() => {
          game.ended = true;
          setFinalScore(Math.floor(game.distance));
          setPhase('done');
        }, 1000);
      }

      // ── Draw ──
      ctx.clearRect(0, 0, canvasSize.w, canvasSize.h);

      // Ground line
      drawGround(ctx, game, canvasSize.w);

      // HUD
      drawHUD(ctx, game, elapsed, canvasSize.w);

      // Dino sprite
      drawDino(ctx, game, species, colors, speciesData.regions, animated, now);

      rafId = requestAnimationFrame(tick);
    }

    rafId = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(rafId);
  }, [phase, canvasSize]);
```

- [ ] **Step 2: Add the ground drawing function**

Add these functions above the component (after imports, before `export function TamingRunner`):

```jsx
function drawGround(ctx, game, canvasW) {
  const y = game.groundY;
  ctx.strokeStyle = '#6366f1';
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 6]);
  ctx.lineDashOffset = -game.groundOffset;
  ctx.beginPath();
  ctx.moveTo(0, y);
  ctx.lineTo(canvasW, y);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawHUD(ctx, game, elapsed, canvasW) {
  // Distance counter
  ctx.fillStyle = '#e0e0e0';
  ctx.font = 'bold 14px monospace';
  ctx.textAlign = 'right';
  ctx.fillText(`${Math.floor(game.distance)}m`, canvasW - 12, 24);

  // Timer bar
  const progress = Math.min(elapsed / RUN_DURATION, 1);
  const barW = canvasW - 24;
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(12, 6, barW, 4);
  ctx.fillStyle = '#6366f1';
  ctx.fillRect(12, 6, barW * progress, 4);
  ctx.textAlign = 'left'; // reset
}

function drawDino(ctx, game, species, colors, regions, animated, now) {
  const resolved = animated ? resolveColors(colors, now) : colors;
  const spriteCanvas = animated
    ? getRecoloredUncached(species, resolved, regions)
    : getRecolored(species, resolved, regions);

  if (!spriteCanvas) return;

  const sw = spriteCanvas.width * SPRITE_SCALE;
  const sh = spriteCanvas.height * SPRITE_SCALE;
  const x = game.dinoX - sw / 2;
  const baseY = game.groundY - sh;
  const y = baseY - game.dinoY;

  // Bob offset when running on ground
  const bobOffset = (!game.jumping && game.bobFrame) ? -2 : 0;

  // Squash and stretch
  let scaleX = 1, scaleY = 1;
  if (game.jumping) {
    const t = (now - game.jumpStart) / JUMP_DURATION;
    if (t < 0.1) { scaleX = 1.1; scaleY = 0.9; } // takeoff squash
    else if (t > 0.9) { scaleX = 1.1; scaleY = 0.9; } // landing squash
    else { scaleX = 0.95; scaleY = 1.05; } // airborne stretch
  }

  ctx.save();
  ctx.imageSmoothingEnabled = false;

  // Stumble red tint
  if (game.stumbling) {
    ctx.globalAlpha = 0.7 + 0.3 * Math.sin((now - game.stumbleStart) / 50);
  }

  ctx.translate(x + sw / 2, y + sh + bobOffset);
  ctx.scale(scaleX, scaleY);
  ctx.drawImage(spriteCanvas, -sw / 2, -sh, sw, sh);

  // Red overlay for stumble
  if (game.stumbling) {
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = 'rgba(239, 68, 68, 0.3)';
    ctx.fillRect(-sw / 2, -sh, sw, sh);
    ctx.globalCompositeOperation = 'source-over';
  }

  ctx.restore();
}
```

- [ ] **Step 3: Add tap/keyboard input for jumping**

Add this `useEffect` inside the component, after the game loop `useEffect`:

```jsx
  // Input handling
  useEffect(() => {
    if (phase !== 'running') return;

    function jump() {
      const game = gameRef.current;
      if (!game || game.jumping || game.ended) return;
      game.jumping = true;
      game.jumpStart = performance.now();
    }

    function handleTouch(e) {
      e.preventDefault();
      jump();
    }

    function handleKey(e) {
      if (e.code === 'Space') {
        e.preventDefault();
        jump();
      }
    }

    const canvas = canvasRef.current;
    canvas?.addEventListener('touchstart', handleTouch, { passive: false });
    canvas?.addEventListener('mousedown', jump);
    window.addEventListener('keydown', handleKey);

    return () => {
      canvas?.removeEventListener('touchstart', handleTouch);
      canvas?.removeEventListener('mousedown', jump);
      window.removeEventListener('keydown', handleKey);
    };
  }, [phase]);
```

- [ ] **Step 4: Verify ground scrolling and dino rendering**

Run: `cd frontend && npm run dev`

We can't test the full flow yet (not wired in), but verify no build errors. Check terminal for clean compilation.

- [ ] **Step 5: Commit game loop and ground rendering**

```bash
git add frontend/src/components/TamingRunner.jsx
git commit -m "feat: add game loop, ground rendering, dino sprite, and jump input"
```

---

### Task 3: Add Obstacle Spawning, Scrolling, and Collision

**Files:**
- Modify: `frontend/src/components/TamingRunner.jsx`

- [ ] **Step 1: Add obstacle drawing functions**

Add these functions alongside the other draw functions (above the component):

```jsx
// Obstacle types: each has a draw function, width, and height (for hitbox)
const OBSTACLE_TYPES = [
  {
    // Small cactus
    w: 12, h: 24,
    draw(ctx, x, groundY) {
      ctx.fillStyle = '#2d5a27';
      // Trunk
      ctx.fillRect(x + 4, groundY - 24, 4, 24);
      // Left arm
      ctx.fillRect(x, groundY - 18, 4, 10);
      // Right arm
      ctx.fillRect(x + 8, groundY - 14, 4, 8);
    },
  },
  {
    // Tall cactus
    w: 14, h: 34,
    draw(ctx, x, groundY) {
      ctx.fillStyle = '#2d5a27';
      ctx.fillRect(x + 5, groundY - 34, 4, 34);
      ctx.fillRect(x, groundY - 28, 4, 14);
      ctx.fillRect(x + 10, groundY - 22, 4, 12);
      // Darker shade
      ctx.fillStyle = '#1e3d1a';
      ctx.fillRect(x + 5, groundY - 34, 2, 34);
    },
  },
  {
    // Rock
    w: 20, h: 14,
    draw(ctx, x, groundY) {
      ctx.fillStyle = '#4a4a4a';
      ctx.beginPath();
      ctx.moveTo(x, groundY);
      ctx.lineTo(x + 3, groundY - 10);
      ctx.lineTo(x + 8, groundY - 14);
      ctx.lineTo(x + 14, groundY - 12);
      ctx.lineTo(x + 20, groundY - 4);
      ctx.lineTo(x + 20, groundY);
      ctx.closePath();
      ctx.fill();
      // Highlight
      ctx.fillStyle = '#5a5a5a';
      ctx.beginPath();
      ctx.moveTo(x + 5, groundY - 8);
      ctx.lineTo(x + 8, groundY - 14);
      ctx.lineTo(x + 14, groundY - 12);
      ctx.lineTo(x + 10, groundY - 6);
      ctx.closePath();
      ctx.fill();
    },
  },
  {
    // Double cactus
    w: 22, h: 26,
    draw(ctx, x, groundY) {
      ctx.fillStyle = '#2d5a27';
      ctx.fillRect(x + 3, groundY - 24, 4, 24);
      ctx.fillRect(x, groundY - 16, 3, 8);
      ctx.fillRect(x + 15, groundY - 26, 4, 26);
      ctx.fillRect(x + 19, groundY - 20, 3, 10);
      ctx.fillStyle = '#1e3d1a';
      ctx.fillRect(x + 3, groundY - 24, 2, 24);
      ctx.fillRect(x + 15, groundY - 26, 2, 26);
    },
  },
];

function spawnObstacle(game, canvasW) {
  if (game.obstacles.length >= OBSTACLE_POOL_SIZE) return;
  const type = OBSTACLE_TYPES[Math.floor(Math.random() * OBSTACLE_TYPES.length)];
  game.obstacles.push({
    x: canvasW + 10,
    type,
    passed: false,
  });
  // Next obstacle after a gap
  game.nextObstacleX = canvasW + OBSTACLE_MIN_GAP + Math.random() * 100;
}

function updateObstacles(game, canvasW, now) {
  // Spawn
  if (!game.ending && game.nextObstacleX <= canvasW) {
    spawnObstacle(game, canvasW);
  }
  game.nextObstacleX -= game.speed;

  // Move & cull
  for (let i = game.obstacles.length - 1; i >= 0; i--) {
    const obs = game.obstacles[i];
    obs.x -= game.speed;
    if (obs.x + obs.type.w < -10) {
      game.obstacles.splice(i, 1);
    }
  }
}

function checkCollisions(game, spriteCanvas) {
  if (!spriteCanvas || game.stumbling || game.jumping) return;

  const sw = spriteCanvas.width * SPRITE_SCALE;
  const sh = spriteCanvas.height * SPRITE_SCALE;
  // Dino hitbox (slightly smaller than sprite for forgiveness)
  const dx = game.dinoX - sw * 0.3;
  const dy = game.groundY - sh;
  const dw = sw * 0.6;
  const dh = sh * 0.8;

  for (const obs of game.obstacles) {
    if (obs.passed) continue;
    const ox = obs.x;
    const oy = game.groundY - obs.type.h;
    const ow = obs.type.w;
    const oh = obs.type.h;

    // AABB overlap
    if (dx < ox + ow && dx + dw > ox && dy < oy + oh && dy + dh > oy) {
      game.stumbling = true;
      game.stumbleStart = performance.now();
      obs.passed = true; // don't re-collide
      break;
    }
  }
}

function drawObstacles(ctx, game) {
  for (const obs of game.obstacles) {
    obs.type.draw(ctx, obs.x, game.groundY);
  }
}
```

- [ ] **Step 2: Integrate obstacles into the game loop**

In the `tick` function inside the game loop `useEffect`, add obstacle update/draw/collision calls. Insert after the jump arc calculation and before the end check:

```jsx
      // Update obstacles
      updateObstacles(game, canvasSize.w, now);

      // Get sprite for collision check
      const resolved = animated ? resolveColors(colors, now) : colors;
      const spriteCanvas = animated
        ? getRecoloredUncached(species, resolved, speciesData.regions)
        : getRecolored(species, resolved, speciesData.regions);

      // Collision
      if (!game.jumping) {
        checkCollisions(game, spriteCanvas);
      }
```

Then in the draw section, add obstacle drawing between ground and dino:

```jsx
      // ── Draw ──
      ctx.clearRect(0, 0, canvasSize.w, canvasSize.h);

      // Ground line
      drawGround(ctx, game, canvasSize.w);

      // Obstacles
      drawObstacles(ctx, game);

      // HUD
      drawHUD(ctx, game, elapsed, canvasSize.w);

      // Dino sprite
      drawDino(ctx, game, species, colors, speciesData.regions, animated, now);
```

Note: Since we're now getting `spriteCanvas` for collision detection before drawing, update `drawDino` to accept the pre-resolved sprite to avoid double work. Change `drawDino`'s signature and body:

```jsx
function drawDino(ctx, game, spriteCanvas, now) {
  if (!spriteCanvas) return;

  const sw = spriteCanvas.width * SPRITE_SCALE;
  const sh = spriteCanvas.height * SPRITE_SCALE;
  const x = game.dinoX - sw / 2;
  const baseY = game.groundY - sh;
  const y = baseY - game.dinoY;

  // Bob offset when running on ground
  const bobOffset = (!game.jumping && game.bobFrame) ? -2 : 0;

  // Squash and stretch
  let scaleX = 1, scaleY = 1;
  if (game.jumping) {
    const t = (now - game.jumpStart) / JUMP_DURATION;
    if (t < 0.1) { scaleX = 1.1; scaleY = 0.9; }
    else if (t > 0.9) { scaleX = 1.1; scaleY = 0.9; }
    else { scaleX = 0.95; scaleY = 1.05; }
  }

  ctx.save();
  ctx.imageSmoothingEnabled = false;

  if (game.stumbling) {
    ctx.globalAlpha = 0.7 + 0.3 * Math.sin((now - game.stumbleStart) / 50);
  }

  ctx.translate(x + sw / 2, y + sh + bobOffset);
  ctx.scale(scaleX, scaleY);
  ctx.drawImage(spriteCanvas, -sw / 2, -sh, sw, sh);

  ctx.restore();
}
```

And update the draw call in tick:

```jsx
      drawDino(ctx, game, spriteCanvas, now);
```

- [ ] **Step 3: Commit obstacles and collision**

```bash
git add frontend/src/components/TamingRunner.jsx
git commit -m "feat: add obstacle spawning, scrolling, collision, and stumble"
```

---

### Task 4: Add End-of-Run Food Animation

**Files:**
- Modify: `frontend/src/components/TamingRunner.jsx`

- [ ] **Step 1: Add food drawing at end of run**

Add a `drawFood` function alongside the other draw functions:

```jsx
function drawFood(ctx, game, canvasW) {
  if (!game.ending || !game.foodImg) return;
  // Food appears at right side, dino "runs to it"
  const foodSize = 24;
  const x = canvasW - 40;
  const y = game.groundY - foodSize;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(game.foodImg, x, y, foodSize, foodSize);
}
```

Add the call in the draw section of `tick`, after drawing obstacles and before HUD:

```jsx
      // Food at end
      drawFood(ctx, game, canvasSize.w);
```

- [ ] **Step 2: Commit end-of-run food**

```bash
git add frontend/src/components/TamingRunner.jsx
git commit -m "feat: add food item at end of run"
```

---

### Task 5: Wire TamingRunner into FoodHarvest

**Files:**
- Modify: `frontend/src/components/FoodHarvest.jsx`

This is the integration step. The key challenge: we need to know the dino's species and colors to render the runner. The `api.scanFood` result from the harvest may auto-tame a single species (`result.tamed` + `result.species`) or require a choice (`result.choose_species` + `result.untamed`).

For the auto-tame case, `store.player.dinos` has the dino data after `store.refresh()`. For the choose case, the dino records already exist (untamed) from the prior `scanDino` call.

- [ ] **Step 1: Add runner phase and species resolution to FoodHarvest**

Replace the entire contents of `frontend/src/components/FoodHarvest.jsx`:

```jsx
import { useState, useEffect } from 'preact/hooks';
import { store } from '../store.js';
import { api } from '../api.js';
import { DinoTaming } from './DinoTaming.jsx';
import { HarvestMinigame } from './HarvestMinigame.jsx';
import { TamingRunner } from './TamingRunner.jsx';

export function FoodHarvest({ foodType }) {
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [phase, setPhase] = useState('minigame'); // 'minigame' | 'runner' | 'taming'
  const [runnerSpecies, setRunnerSpecies] = useState(null);
  const [runnerColors, setRunnerColors] = useState(null);

  async function handleGameEnd(perfects, goods) {
    try {
      const data = await api.scanFood(store.playerId, foodType, null, perfects, goods);
      setResult(data);
      await store.refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  // Resolve which species/colors to use for the runner
  function resolveRunnerDino() {
    const player = store.player;
    if (!player || !result) return null;

    let species = null;
    if (result.tamed && result.species) {
      // Auto-tamed single dino
      species = result.species;
    } else if (result.choose_species && result.untamed?.length > 0) {
      // Multiple untamed — use first for the runner visual
      species = result.untamed[0];
    }

    if (!species) return null;

    const dino = player.dinos?.find(d => d.species === species);
    return { species, colors: dino?.colors || {} };
  }

  if (error) {
    return (
      <div style={styles.center}>
        <p style={{ color: '#ef4444' }}>{error}</p>
        <button onClick={() => store.navigate('/plaza')} style={styles.button}>Back to Plaza</button>
      </div>
    );
  }

  if (phase === 'taming') {
    return <DinoTaming foodType={foodType} prefetchedResult={result} />;
  }

  if (phase === 'runner') {
    return (
      <TamingRunner
        species={runnerSpecies}
        colors={runnerColors}
        foodType={foodType}
        onComplete={(score) => setPhase('taming')}
      />
    );
  }

  const canTame = result && !result.harvest_only && !result.already_tamed;

  function handleComplete() {
    if (canTame) {
      // Resolve dino for runner
      const dino = resolveRunnerDino();
      if (dino) {
        setRunnerSpecies(dino.species);
        setRunnerColors(dino.colors);
        setPhase('runner');
      } else {
        // Fallback: skip runner if we can't resolve a dino
        setPhase('taming');
      }
    } else {
      store.navigate('/plaza');
    }
  }

  return (
    <HarvestMinigame
      foodType={foodType}
      apiResult={result}
      onGameEnd={handleGameEnd}
      onComplete={handleComplete}
    />
  );
}

const styles = {
  center: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', minHeight: '80dvh', padding: '20px', gap: '16px',
  },
  button: {
    padding: '14px', borderRadius: '10px', border: 'none',
    background: '#6366f1', color: 'white', fontSize: '16px',
    fontWeight: 'bold', cursor: 'pointer', width: '100%', maxWidth: '320px',
  },
};
```

- [ ] **Step 2: Verify the full flow compiles**

Run: `cd frontend && npm run dev`

Check terminal for no build errors. The dev server should compile successfully.

- [ ] **Step 3: Commit integration**

```bash
git add frontend/src/components/FoodHarvest.jsx frontend/src/components/TamingRunner.jsx
git commit -m "feat: wire TamingRunner into FoodHarvest between harvest and taming"
```

---

### Task 6: End-to-End Manual Testing and Polish

**Files:**
- Modify: `frontend/src/components/TamingRunner.jsx` (if fixes needed)

- [ ] **Step 1: Test the full taming flow**

Run: `cd frontend && npm run dev`

Test procedure (requires backend running or mock):
1. Navigate to `/#scan/food/meat` or `/#scan/food/mejoberries`
2. Play through the harvest minigame
3. On the results screen, tap "Feed a Dino!" (requires an untamed dino)
4. Verify the runner appears with "TAP TO START!"
5. Tap to start — verify:
   - Ground scrolls with indigo dashed line
   - Dino sprite renders with correct species and colors
   - Distance counter increments in top-right
   - Timer bar fills along the top
   - Obstacles (cacti, rocks) spawn from the right
6. Tap to jump — verify:
   - Dino follows parabolic arc
   - Squash on takeoff/landing
   - No double-jump while airborne
7. Hit an obstacle — verify:
   - Dino flashes/stumbles
   - Speed dips briefly
   - Run continues (no game over)
8. Wait 20 seconds — verify:
   - Obstacles stop spawning
   - Food item appears at right
   - Score summary appears
   - "Continue" button visible
9. Tap Continue — verify:
   - DinoTaming screen appears (name input, hat selection)
   - Normal taming flow completes

- [ ] **Step 2: Fix any issues found during testing**

Address any visual glitches, timing issues, or interaction bugs discovered during manual testing. Common things to check:
- Canvas touch events don't scroll the page
- Sprite renders at correct position relative to ground
- Obstacles don't spawn in impossible-to-dodge clusters
- Stumble doesn't trigger while airborne (already guarded)

- [ ] **Step 3: Final commit**

```bash
git add -u
git commit -m "feat: taming runner minigame complete"
```
