import { useEffect, useRef, useImperativeHandle } from 'preact/hooks';
import { forwardRef } from 'preact/compat';
import { getRecolored } from '../utils/spriteEngine.js';
import { getHatImage, getHatAnchor } from '../data/hatImages.js';
import { SPECIES } from '../data/species.js';

const SCALE = 3;
const DRIFT_RANGE = 40;
const DRIFT_SPEED = 15;  // px/sec
const HOP_SPEED = 6;
const HOP_HEIGHT = 3;
const BREATHE_SPEED = 2;
const BREATHE_HEIGHT = 1;
const HEADING_LERP = 2.0;

function makeDino(data, homeX, homeY) {
  const regions = SPECIES[data.species]?.regions || ['body', 'belly', 'stripes'];
  return {
    data,
    sprite: getRecolored(data.species, data.colors || {}, regions),
    homeX,
    homeY,
    x: homeX,
    y: homeY,
    targetX: homeX,
    heading: 0,         // -1 left, 1 right
    facingRight: true,
    hopPhase: Math.random() * Math.PI * 2,
    moving: false,
    entering: false,
    exitTarget: null,
    idleTimer: 0,
  };
}

function pickDriftTarget(dino) {
  dino.targetX = dino.homeX + (Math.random() - 0.5) * 2 * DRIFT_RANGE;
  dino.moving = true;
}

function updateDino(dino, dt) {
  // Handle entrance walk-in
  if (dino.entering) {
    const dx = dino.homeX - dino.x;
    const step = DRIFT_SPEED * 3 * dt;
    if (Math.abs(dx) < step) {
      dino.x = dino.homeX;
      dino.entering = false;
      dino.moving = false;
      dino.idleTimer = 1 + Math.random() * 2;
    } else {
      dino.x += Math.sign(dx) * step;
      dino.moving = true;
    }
    dino.heading += ((-1) - dino.heading) * HEADING_LERP * dt;
    dino.facingRight = false;
    return;
  }

  // Handle exit walk-off
  if (dino.exitTarget !== null) {
    const dx = dino.exitTarget - dino.x;
    const step = DRIFT_SPEED * 3 * dt;
    if (Math.abs(dx) < step) {
      dino.x = dino.exitTarget;
      dino.moving = false;
    } else {
      dino.x += Math.sign(dx) * step;
      dino.moving = true;
    }
    dino.heading += ((1) - dino.heading) * HEADING_LERP * dt;
    dino.facingRight = true;
    return;
  }

  // Gentle drift AI
  if (!dino.moving) {
    dino.idleTimer -= dt;
    if (dino.idleTimer <= 0) {
      pickDriftTarget(dino);
    }
  } else {
    const dx = dino.targetX - dino.x;
    const step = DRIFT_SPEED * dt;
    if (Math.abs(dx) < step) {
      dino.x = dino.targetX;
      dino.moving = false;
      dino.idleTimer = 1.5 + Math.random() * 3;
    } else {
      dino.x += Math.sign(dx) * step;
      const dir = Math.sign(dx);
      dino.heading += (dir - dino.heading) * HEADING_LERP * dt;
      if (Math.abs(dino.heading) > 0.3) dino.facingRight = dino.heading > 0;
    }
  }
}

function drawDino(ctx, dino, elapsed, canvasW) {
  if (!dino.sprite) return;

  dino.hopPhase += (dino.moving ? HOP_SPEED : BREATHE_SPEED) * (1 / 60);

  const hopAmt = dino.moving
    ? Math.abs(Math.sin(dino.hopPhase)) * HOP_HEIGHT * SCALE
    : Math.sin(dino.hopPhase) * BREATHE_HEIGHT * SCALE * 0.5;

  const sw = dino.sprite.width * SCALE;
  const sh = dino.sprite.height * SCALE;

  const drawX = dino.x - sw / 2;
  const drawY = dino.y - sh + hopAmt;

  // Drop shadow
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(dino.x, dino.y + 2, sw * 0.3, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Draw sprite
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  if (!dino.facingRight) {
    ctx.translate(dino.x, 0);
    ctx.scale(-1, 1);
    ctx.translate(-dino.x, 0);
  }
  ctx.drawImage(dino.sprite, drawX, drawY, sw, sh);

  // Draw hat
  if (dino.data.hat) {
    const hatInfo = getHatImage(dino.data.hat);
    const hatAnchor = getHatAnchor(dino.data.species);
    if (hatInfo?.loaded) {
      const hatW = hatInfo.img.naturalWidth * SCALE;
      const hatH = hatInfo.img.naturalHeight * SCALE;
      const anchorDrawX = hatAnchor.x * SCALE;
      const anchorDrawY = (hatAnchor.y + hatInfo.offsetY) * SCALE;
      const hatX = drawX + anchorDrawX - hatW / 2;
      const hatY = drawY + anchorDrawY - hatH;
      ctx.drawImage(hatInfo.img, hatX, hatY, hatW, hatH);
    }
  }

  ctx.restore();
}

// Dust particles
function spawnDust(particles, dino) {
  if (!dino.moving) return;
  if (Math.random() > 0.15) return;
  particles.push({
    x: dino.x + (Math.random() - 0.5) * 6,
    y: dino.y,
    vx: (Math.random() - 0.5) * 10,
    vy: -Math.random() * 8,
    life: 0.4 + Math.random() * 0.3,
    maxLife: 0.4 + Math.random() * 0.3,
    size: 1.5 + Math.random() * 1.5,
  });
}

function updateParticles(particles, dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 15 * dt; // gravity
    p.life -= dt;
    if (p.life <= 0) particles.splice(i, 1);
  }
}

function drawParticles(ctx, particles) {
  for (const p of particles) {
    const alpha = Math.max(0, p.life / p.maxLife) * 0.4;
    ctx.fillStyle = `rgba(180,160,140,${alpha})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
}

export const DinoPlayScene = forwardRef(function DinoPlayScene(props, ref) {
  const canvasRef = useRef(null);
  const stateRef = useRef({
    myDino: null,
    partnerDino: null,
    particles: [],
    animId: 0,
    lastTime: 0,
  });

  useImperativeHandle(ref, () => ({
    setMyDino(data) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const homeX = canvas.width / 2 - 40;
      const homeY = canvas.height - 20;
      stateRef.current.myDino = makeDino(data, homeX, homeY);
    },
    setPartnerDino(data) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const homeX = canvas.width / 2 + 40;
      const homeY = canvas.height - 20;
      const dino = makeDino(data, homeX, homeY);
      // Start off-screen right and walk in
      dino.x = canvas.width + 60;
      dino.entering = true;
      stateRef.current.partnerDino = dino;
    },
    clearPartnerDino() {
      const pd = stateRef.current.partnerDino;
      if (pd) {
        const canvas = canvasRef.current;
        pd.exitTarget = (canvas?.width || 400) + 80;
      }
    },
  }));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    function resize() {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Update home positions when canvas resizes
      const s = stateRef.current;
      const w = rect.width;
      const h = rect.height;
      if (s.myDino) {
        s.myDino.homeX = w / 2 - 40;
        s.myDino.y = h - 20;
        s.myDino.homeY = h - 20;
      }
      if (s.partnerDino) {
        s.partnerDino.homeX = w / 2 + 40;
        s.partnerDino.y = h - 20;
        s.partnerDino.homeY = h - 20;
      }
    }
    resize();
    window.addEventListener('resize', resize);

    function loop(time) {
      const s = stateRef.current;
      const dt = Math.min((time - (s.lastTime || time)) / 1000, 0.1);
      s.lastTime = time;

      const w = canvas.getBoundingClientRect().width;
      const h = canvas.getBoundingClientRect().height;

      // Clear with gradient
      ctx.clearRect(0, 0, w, h);
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, '#0f1a2e');
      grad.addColorStop(1, '#0d1117');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // Update and draw
      if (s.myDino) {
        updateDino(s.myDino, dt);
        spawnDust(s.particles, s.myDino);
      }
      if (s.partnerDino) {
        updateDino(s.partnerDino, dt);
        spawnDust(s.particles, s.partnerDino);
        // Remove partner if exited off-screen
        if (s.partnerDino.exitTarget !== null && s.partnerDino.x >= s.partnerDino.exitTarget) {
          s.partnerDino = null;
        }
      }

      updateParticles(s.particles, dt);
      drawParticles(ctx, s.particles);

      if (s.myDino) drawDino(ctx, s.myDino, time / 1000, w);
      if (s.partnerDino) drawDino(ctx, s.partnerDino, time / 1000, w);

      s.animId = requestAnimationFrame(loop);
    }

    stateRef.current.animId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(stateRef.current.animId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: '100%',
        height: '200px',
        display: 'block',
      }}
    />
  );
});
