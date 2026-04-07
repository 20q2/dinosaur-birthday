import { useRef, useEffect, useState } from 'preact/hooks';
import { getRecolored, getRecoloredUncached, getRawImage, getRegionMask } from '../utils/spriteEngine.js';
import { SPECIES } from '../data/species.js';
import { getHatImage, getHatAnchor } from '../data/hatImages.js';
import { resolveColors, hasEffects } from '../dinoColors.js';
import starryNightUrl from '../assets/effects/starry_night.jpg';

// Preload starry night texture
const _starryImg = new Image();
_starryImg.src = starryNightUrl;
let _starryLoaded = false;
_starryImg.onload = () => { _starryLoaded = true; };

/**
 * Renders a recolored dino sprite on a <canvas> element with pixelated scaling.
 * Optionally draws a hat image on the dino's head.
 * Supports animated rare paint effects (rainbow, prismatic, etc.).
 */
export function DinoSprite({ species, colors = {}, scale = 3, style = {}, hat = null }) {
  const canvasRef = useRef(null);
  const [hatVersion, setHatVersion] = useState(0);
  const rafRef = useRef(null);
  const animated = hasEffects(colors);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const speciesData = SPECIES[species];
    if (!speciesData) return;
    const regions = speciesData.regions;

    function draw() {
      const resolved = resolveColors(colors, Date.now());
      const recolored = animated
        ? getRecoloredUncached(species, resolved, regions)
        : getRecolored(species, resolved, regions);
      const spriteSource = recolored || getRawImage(species);
      if (!spriteSource) return;

      const sw = spriteSource.width || spriteSource.naturalWidth;
      const sh = spriteSource.height || spriteSource.naturalHeight;

      // Normalize oversized sprites (e.g. godzilla 496x535) to match standard 64px dinos
      const STANDARD_SIZE = 64;
      const normScale = Math.max(sw, sh) > STANDARD_SIZE * 2
        ? (STANDARD_SIZE / Math.max(sw, sh)) * scale
        : scale;

      let hatRise = 0;
      const hatInfo = hat ? getHatImage(hat) : null;
      const anchor = hat ? getHatAnchor(species) : null;

      if (hatInfo?.loaded && anchor) {
        const hatH = hatInfo.img.naturalHeight;
        const hatTopInSprite = anchor.y + hatInfo.offsetY - hatH;
        if (hatTopInSprite < 0) hatRise = Math.ceil(-hatTopInSprite);
      }

      const w = sw * normScale;
      const h = (sh + hatRise) * normScale;
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = false;

      ctx.drawImage(spriteSource, 0, hatRise * normScale, sw * normScale, sh * normScale);

      if (hatInfo?.loaded && anchor) {
        const hatW = hatInfo.img.naturalWidth * normScale;
        const hatH = hatInfo.img.naturalHeight * normScale;
        const hatX = (anchor.x + (hatInfo.offsetX || 0)) * normScale - hatW / 2;
        const hatY = (anchor.y + hatRise + hatInfo.offsetY) * normScale - hatH;
        ctx.drawImage(hatInfo.img, hatX, hatY, hatW, hatH);
      }

      // Overlay effects for rare paints
      _drawEffectOverlays(ctx, species, colors, regions, spriteSource, sw, sh, hatRise, normScale);
    }

    draw();

    if (animated) {
      const loop = () => { draw(); rafRef.current = requestAnimationFrame(loop); };
      rafRef.current = requestAnimationFrame(loop);
      return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
    }
  }, [species, colors, scale, hat, hatVersion, animated]);

  // Watch for hat image load to trigger canvas redraw
  useEffect(() => {
    if (!hat) return;
    const hatInfo = getHatImage(hat);
    if (!hatInfo || hatInfo.loaded) return;
    const onLoad = () => setHatVersion(v => v + 1);
    hatInfo.img.addEventListener('load', onLoad);
    return () => hatInfo.img.removeEventListener('load', onLoad);
  }, [hat]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        imageRendering: 'pixelated',
        display: 'block',
        ...style,
      }}
    />
  );
}

/**
 * Draw shimmer/sparkle overlays for rare paint effects.
 * Region-aware: only draws on the specific regions that have the effect applied.
 */
function _drawEffectOverlays(ctx, species, colors, regions, sprite, sw, sh, hatRise, scale) {
  const now = Date.now() / 1000;

  // Group region indices by effect
  const effectRegions = {};
  for (let i = 0; i < regions.length; i++) {
    const val = colors[regions[i]];
    if (val && typeof val === 'object' && val.effect) {
      if (!effectRegions[val.effect]) effectRegions[val.effect] = [];
      effectRegions[val.effect].push(i);
    }
  }

  const dstW = sw * scale;
  const dstH = sh * scale;
  const dstY = hatRise * scale;

  for (const [effect, regionIdxs] of Object.entries(effectRegions)) {
    // Get a mask for just the affected regions
    const mask = getRegionMask(species, regionIdxs);
    if (!mask) continue;

    // Create temp canvas: draw mask scaled up, then draw effect with source-in to clip
    const tmp = document.createElement('canvas');
    tmp.width = ctx.canvas.width;
    tmp.height = ctx.canvas.height;
    const tc = tmp.getContext('2d');
    tc.imageSmoothingEnabled = false;
    tc.drawImage(mask, 0, dstY, dstW, dstH);

    // Now draw the effect clipped to the mask via source-in
    tc.globalCompositeOperation = 'source-in';

    if (effect === 'metallic') {
      const shineX = ((now * 0.4) % 1.6 - 0.3) * dstW;
      const grad = tc.createLinearGradient(shineX - 15, 0, shineX + 15, 0);
      grad.addColorStop(0, 'rgba(255,255,255,0)');
      grad.addColorStop(0.5, 'rgba(255,255,255,0.35)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      tc.fillStyle = grad;
      tc.fillRect(0, dstY, dstW, dstH);
    } else if (effect === 'starry_night' && _starryLoaded) {
      tc.imageSmoothingEnabled = true;
      tc.imageSmoothingQuality = 'high';
      tc.globalAlpha = 0.6;
      const texW = _starryImg.naturalWidth;
      const texH = _starryImg.naturalHeight;
      // Gentle back-and-forth drift within a small window of the texture
      const cx = texW * 0.25;
      const cy = texH * 0.25;
      const range = texW * 0.08;
      const panX = cx + Math.sin(now * 0.15) * range;
      const panY = cy + Math.cos(now * 0.1) * range * 0.6;
      tc.drawImage(_starryImg, panX, panY, texW * 0.4, texH * 0.4, 0, dstY, dstW, dstH);
    } else if (effect === 'rainbow') {
      const bandHalf = dstW * 0.5;
      const sweepX = ((now * 0.35) % 1.6 - 0.3) * dstW;
      const baseHue = Math.floor((now * 50) % 360);
      const grad = tc.createLinearGradient(sweepX - bandHalf, 0, sweepX + bandHalf, 0);
      grad.addColorStop(0, 'rgba(255,255,255,0)');
      grad.addColorStop(0.2, `hsla(${baseHue}, 100%, 65%, 0.35)`);
      grad.addColorStop(0.5, `hsla(${(baseHue + 120) % 360}, 100%, 65%, 0.4)`);
      grad.addColorStop(0.8, `hsla(${(baseHue + 240) % 360}, 100%, 65%, 0.35)`);
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      tc.fillStyle = grad;
      tc.fillRect(0, dstY, dstW, dstH);
    } else if (effect === 'prismatic') {
      tc.globalAlpha = 0.12;
      const hue = Math.floor((now * 10 + 180) % 360);
      tc.fillStyle = `hsl(${hue}, 100%, 70%)`;
      tc.fillRect(0, dstY, dstW, dstH);
    }

    // Composite the masked effect onto the main canvas
    ctx.save();
    ctx.globalCompositeOperation = 'source-atop';
    ctx.drawImage(tmp, 0, 0);
    ctx.restore();
  }
}
