import { useEffect, useRef, useImperativeHandle } from 'preact/hooks';
import { forwardRef } from 'preact/compat';
import { getRecolored, getRecoloredUncached, getRegionMask } from '../utils/spriteEngine.js';
import { getHatImage, getHatAnchor } from '../data/hatImages.js';
import { SPECIES } from '../data/species.js';
import { resolveColors, hasEffects } from '../dinoColors.js';
import starryNightUrl from '../assets/effects/starry_night.jpg';

const _starryImg = new Image();
_starryImg.src = starryNightUrl;
let _starryLoaded = false;
_starryImg.onload = () => { _starryLoaded = true; };

import bgRocks from '../assets/backgrounds/dino_find_rocks.png';
import bgSwamp from '../assets/backgrounds/dino_find_swamp.png';
import bgRiver from '../assets/backgrounds/dino_find_river.png';
import bgGrass from '../assets/backgrounds/dino_find_tall_grass.png';
import bgCave from '../assets/backgrounds/dino_find_cave.png';
import bgCanyon from '../assets/backgrounds/dino_find_canyon.png';
import bgVolcanic from '../assets/backgrounds/dino_find_volcanic.png';

const BG_MAP = {
  rocks: bgRocks, swamp: bgSwamp, river: bgRiver,
  grass: bgGrass, cave: bgCave, canyon: bgCanyon,
  volcanic: bgVolcanic,
};

const SCALE = 3;
const DRIFT_RANGE = 40;
const DRIFT_SPEED = 15;  // px/sec
const HOP_SPEED = 6;
const HOP_HEIGHT = 3;
const BREATHE_SPEED = 2;
const BREATHE_HEIGHT = 1;
const HEADING_LERP = 2.0;

function makeDino(data, homeX, homeY, ownerName) {
  const regions = SPECIES[data.species]?.regions || ['body', 'belly', 'stripes'];
  const animated = hasEffects(data.colors);
  const resolved = resolveColors(data.colors || {}, Date.now());
  return {
    data,
    sprite: getRecolored(data.species, resolved, regions),
    animated,
    regions,
    ownerName: ownerName || '',
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

function pickDriftTarget(dino, canvasW) {
  const margin = 30;
  let tx = dino.homeX + (Math.random() - 0.5) * 2 * DRIFT_RANGE;
  tx = Math.max(margin, Math.min(canvasW - margin, tx));
  dino.targetX = tx;
  dino.moving = true;
}

function updateDino(dino, dt, canvasW) {
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
      pickDriftTarget(dino, canvasW);
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

function _bakeEffects(dino, elapsed) {
  const canvas = dino.sprite;
  const sc = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  const colors = dino.data.colors || {};
  const regions = dino.regions;

  const effectRegions = {};
  for (let i = 0; i < regions.length; i++) {
    const val = colors[regions[i]];
    if (val && typeof val === 'object' && val.effect) {
      if (!effectRegions[val.effect]) effectRegions[val.effect] = [];
      effectRegions[val.effect].push(i);
    }
  }

  for (const [effect, regionIdxs] of Object.entries(effectRegions)) {
    const mask = getRegionMask(dino.data.species, regionIdxs);
    if (!mask) continue;

    const tmp = document.createElement('canvas');
    tmp.width = w;
    tmp.height = h;
    const tc = tmp.getContext('2d');
    tc.imageSmoothingEnabled = false;
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
      const cx = texW * 0.25, cy = texH * 0.25;
      const range = texW * 0.08;
      const panX = cx + Math.sin(elapsed * 0.15) * range;
      const panY = cy + Math.cos(elapsed * 0.1) * range * 0.6;
      tc.drawImage(_starryImg, panX, panY, texW * 0.4, texH * 0.4, 0, 0, w, h);
    } else if (effect === 'rainbow') {
      const sweepX = ((elapsed * 0.35) % 1.6 - 0.3) * w;
      const baseHue = Math.floor((elapsed * 50) % 360);
      const bw = w * 0.5;
      const grad = tc.createLinearGradient(sweepX - bw, 0, sweepX + bw, 0);
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

    sc.save();
    sc.globalCompositeOperation = 'source-atop';
    sc.drawImage(tmp, 0, 0);
    sc.restore();
  }
}

function drawDino(ctx, dino, elapsed, canvasW) {
  // Refresh sprite for animated effects and bake overlays
  if (dino.animated) {
    const resolved = resolveColors(dino.data.colors || {}, Date.now());
    dino.sprite = getRecoloredUncached(dino.data.species, resolved, dino.regions);
    if (dino.sprite) _bakeEffects(dino, elapsed);
  }
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
  if (dino.facingRight) {
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

  // Draw owner name below dino
  if (dino.ownerName) {
    ctx.save();
    ctx.font = '600 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillText(dino.ownerName, dino.x, dino.y + 14);
    ctx.restore();
  }
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
    bgImage: null,
  });

  useImperativeHandle(ref, () => ({
    setMyDino(data, ownerName) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const w = canvas.getBoundingClientRect().width;
      const homeX = w / 2;
      const homeY = canvas.getBoundingClientRect().height - 20;
      stateRef.current.myDino = makeDino(data, homeX, homeY, ownerName);
      // Load background image from partner dino's backdrop setting
      if (data.background && BG_MAP[data.background]) {
        const img = new Image();
        img.onload = () => { stateRef.current.bgImage = img; };
        img.src = BG_MAP[data.background];
      }
    },
    setPartnerDino(data, ownerName) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const w = canvas.getBoundingClientRect().width;
      const h = canvas.getBoundingClientRect().height;
      // Shift my dino left to make room
      const s = stateRef.current;
      if (s.myDino) {
        s.myDino.homeX = w / 2 - 40;
      }
      const homeX = w / 2 + 40;
      const homeY = h - 20;
      const dino = makeDino(data, homeX, homeY, ownerName);
      // Start off-screen right and walk in
      dino.x = w + 60;
      dino.entering = true;
      s.partnerDino = dino;
    },
    clearPartnerDino() {
      const s = stateRef.current;
      if (s.partnerDino) {
        const canvas = canvasRef.current;
        const w = canvas?.getBoundingClientRect().width || 400;
        s.partnerDino.exitTarget = w + 80;
        // Move my dino back to center
        if (s.myDino) {
          s.myDino.homeX = w / 2;
        }
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
        s.myDino.homeX = s.partnerDino ? w / 2 - 40 : w / 2;
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

      // Clear and draw background
      ctx.clearRect(0, 0, w, h);
      if (s.bgImage) {
        // Cover-fit the background image
        const imgW = s.bgImage.naturalWidth;
        const imgH = s.bgImage.naturalHeight;
        const scale = Math.max(w / imgW, h / imgH);
        const sw = imgW * scale;
        const sh = imgH * scale;
        ctx.drawImage(s.bgImage, (w - sw) / 2, h - sh, sw, sh);
        // Darken overlay so dinos are visible
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.fillRect(0, 0, w, h);
      } else {
        const grad = ctx.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, '#0f1a2e');
        grad.addColorStop(1, '#0d1117');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);
      }

      // Update and draw
      if (s.myDino) {
        updateDino(s.myDino, dt, w);
        spawnDust(s.particles, s.myDino);
      }
      if (s.partnerDino) {
        updateDino(s.partnerDino, dt, w);
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
