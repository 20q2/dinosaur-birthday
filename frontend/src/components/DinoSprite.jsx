import { useRef, useEffect } from 'preact/hooks';
import { getRecolored, getRawImage } from '../utils/spriteEngine.js';
import { SPECIES } from '../data/species.js';

/**
 * Renders a recolored dino sprite on a <canvas> element with pixelated scaling.
 *
 * @param {string} species - Species ID (e.g. 'trex')
 * @param {object} colors - Region→hue map (e.g. {body: 120, belly: 45, stripes: 200})
 * @param {number} scale - Pixel scale multiplier (default 3)
 * @param {string} className - Optional CSS class
 */
export function DinoSprite({ species, colors = {}, scale = 3, style = {} }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const speciesData = SPECIES[species];
    if (!speciesData) return;

    const regions = speciesData.regions;
    const recolored = getRecolored(species, colors || {}, regions);

    if (recolored) {
      const w = recolored.width * scale;
      const h = recolored.height * scale;
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(recolored, 0, 0, w, h);
    } else {
      // Fallback: draw raw sprite without recolor
      const raw = getRawImage(species);
      if (raw) {
        const w = raw.naturalWidth * scale;
        const h = raw.naturalHeight * scale;
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        // Draw at native size, strip white, then scale
        const tmp = document.createElement('canvas');
        tmp.width = raw.naturalWidth;
        tmp.height = raw.naturalHeight;
        const tmpCtx = tmp.getContext('2d');
        tmpCtx.drawImage(raw, 0, 0);
        const imgData = tmpCtx.getImageData(0, 0, tmp.width, tmp.height);
        const d = imgData.data;
        for (let i = 0; i < d.length; i += 4) {
          if (d[i] === 255 && d[i+1] === 255 && d[i+2] === 255 && d[i+3] > 0) d[i+3] = 0;
        }
        tmpCtx.putImageData(imgData, 0, 0);
        ctx.drawImage(tmp, 0, 0, w, h);
      }
    }
  }, [species, colors, scale]);

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
