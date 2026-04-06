import { useRef, useEffect, useState } from 'preact/hooks';
import { getRecolored, getRecoloredUncached, getRawImage } from '../utils/spriteEngine.js';
import { SPECIES } from '../data/species.js';
import { getHatImage, getHatAnchor } from '../data/hatImages.js';
import { resolveColors, hasEffects } from '../dinoColors.js';

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

      let hatRise = 0;
      const hatInfo = hat ? getHatImage(hat) : null;
      const anchor = hat ? getHatAnchor(species) : null;

      if (hatInfo?.loaded && anchor) {
        const hatH = hatInfo.img.naturalHeight;
        const hatTopInSprite = anchor.y + hatInfo.offsetY - hatH;
        if (hatTopInSprite < 0) hatRise = Math.ceil(-hatTopInSprite);
      }

      const w = sw * scale;
      const h = (sh + hatRise) * scale;
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = false;

      ctx.drawImage(spriteSource, 0, hatRise * scale, sw * scale, sh * scale);

      if (hatInfo?.loaded && anchor) {
        const hatW = hatInfo.img.naturalWidth * scale;
        const hatH = hatInfo.img.naturalHeight * scale;
        const hatX = (anchor.x + (hatInfo.offsetX || 0)) * scale - hatW / 2;
        const hatY = (anchor.y + hatRise + hatInfo.offsetY) * scale - hatH;
        ctx.drawImage(hatInfo.img, hatX, hatY, hatW, hatH);
      }

      // Overlay effects for rare paints
      _drawEffectOverlays(ctx, colors, regions, spriteSource, sw, sh, hatRise, scale);
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
 * Only draws over non-transparent sprite pixels.
 */
function _drawEffectOverlays(ctx, colors, regions, sprite, sw, sh, hatRise, scale) {
  const now = Date.now() / 1000;

  for (const [region, value] of Object.entries(colors || {})) {
    if (!value || typeof value !== 'object') continue;
    const effect = value.effect;

    if (effect === 'metallic') {
      // Sweeping shine highlight
      ctx.save();
      ctx.globalCompositeOperation = 'source-atop';
      const shineX = ((now * 0.4) % 1.6 - 0.3) * sw * scale;
      const grad = ctx.createLinearGradient(shineX - 15, 0, shineX + 15, 0);
      grad.addColorStop(0, 'rgba(255,255,255,0)');
      grad.addColorStop(0.5, 'rgba(255,255,255,0.35)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, hatRise * scale, sw * scale, sh * scale);
      ctx.restore();
    } else if (effect === 'starry_night') {
      // Twinkling star dots
      ctx.save();
      ctx.globalCompositeOperation = 'source-atop';
      for (let i = 0; i < 8; i++) {
        const sx = ((Math.sin(i * 7.3 + now * 0.7) * 0.5 + 0.5) * sw * scale);
        const sy = hatRise * scale + ((Math.cos(i * 5.1 + now * 0.5) * 0.5 + 0.5) * sh * scale);
        const alpha = 0.4 + 0.6 * Math.sin(now * 3 + i * 2.1);
        ctx.globalAlpha = Math.max(0, alpha);
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(sx, sy, 1.5 * scale, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    } else if (effect === 'rainbow' || effect === 'prismatic') {
      // Subtle hue-shifting glow overlay
      ctx.save();
      ctx.globalCompositeOperation = 'source-atop';
      ctx.globalAlpha = 0.12;
      const hue = effect === 'rainbow'
        ? Math.floor((now * 18) % 360)
        : Math.floor((now * 10 + 180) % 360);
      ctx.fillStyle = `hsl(${hue}, 100%, 70%)`;
      ctx.fillRect(0, hatRise * scale, sw * scale, sh * scale);
      ctx.restore();
    }

    break; // one overlay per dino is enough (effects apply to whole sprite)
  }
}
