import { useRef, useEffect } from 'preact/hooks';
import { rgbToHsv, hsvToRgb } from '../utils/colors.js';
import paintUrl from '../assets/items/paint.png';

/** Shared paint image — loaded once */
let paintImage = null;
let paintLoadPromise = null;

function loadPaintImage() {
  if (paintImage) return Promise.resolve(paintImage);
  if (paintLoadPromise) return paintLoadPromise;
  paintLoadPromise = new Promise((resolve) => {
    const img = new Image();
    img.onload = () => { paintImage = img; resolve(img); };
    img.onerror = () => resolve(null);
    img.src = paintUrl;
  });
  return paintLoadPromise;
}

/** Cache recolored canvases by key */
const paintCache = new Map();

function recolorPaint(img, targetHue, mode) {
  const key = mode || String(targetHue);
  if (paintCache.has(key)) return paintCache.get(key);

  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;

  const src = document.createElement('canvas');
  src.width = w;
  src.height = h;
  const ctx = src.getContext('2d');
  ctx.drawImage(img, 0, 0);

  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
    if (a < 128) continue;

    const hsv = rgbToHsv(r, g, b);

    // Only recolor the green/yellow-green liquid pixels
    if (hsv.h >= 50 && hsv.h <= 170 && hsv.s > 0.15 && hsv.v > 0.15) {
      if (mode === 'rainbow' || mode === 'prismatic') {
        // Rainbow gradient based on pixel y-position
        const t = i / 4;
        const py = Math.floor(t / w);
        const px = t % w;
        const hueShift = mode === 'rainbow'
          ? ((px + py * 2) / (w + h)) * 360
          : ((px * 3 + py * 2) / (w + h)) * 360 + 180;
        const [nr, ng, nb] = hsvToRgb(hueShift % 360, Math.max(hsv.s, 0.7), Math.min(hsv.v * 1.2, 1));
        data[i] = nr;
        data[i + 1] = ng;
        data[i + 2] = nb;
      } else if (mode === 'metallic') {
        // Desaturated bright silver/chrome
        const v = Math.min(hsv.v * 1.4, 1);
        const [nr, ng, nb] = hsvToRgb(210, 0.08, v);
        data[i] = nr;
        data[i + 1] = ng;
        data[i + 2] = nb;
      } else {
        const [nr, ng, nb] = hsvToRgb(targetHue, hsv.s, hsv.v);
        data[i] = nr;
        data[i + 1] = ng;
        data[i + 2] = nb;
      }
    }

    // For metallic, also brighten the bucket body for a shiny look
    if (mode === 'metallic' && hsv.h >= 20 && hsv.h <= 50 && hsv.s > 0.15) {
      const v = Math.min(hsv.v * 1.3, 1);
      const [nr, ng, nb] = hsvToRgb(hsv.h, hsv.s * 0.6, v);
      data[i] = nr;
      data[i + 1] = ng;
      data[i + 2] = nb;
    }
  }

  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  out.getContext('2d').putImageData(imageData, 0, 0);

  paintCache.set(key, out);
  return out;
}

/**
 * Renders the paint cup asset hue-shifted to a target color.
 * @param {number} hue - Target hue (0-359)
 * @param {number} scale - Pixel scale multiplier (default 2)
 */
export function PaintSprite({ hue, mode, scale = 2, style = {} }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    loadPaintImage().then(img => {
      if (!img || !canvasRef.current) return;
      const recolored = recolorPaint(img, hue, mode);
      const w = recolored.width * scale;
      const h = recolored.height * scale;
      canvasRef.current.width = w;
      canvasRef.current.height = h;
      const ctx = canvasRef.current.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(recolored, 0, 0, w, h);
    });
  }, [hue, mode, scale]);

  return (
    <canvas
      ref={canvasRef}
      style={{ imageRendering: 'pixelated', display: 'block', ...style }}
    />
  );
}
