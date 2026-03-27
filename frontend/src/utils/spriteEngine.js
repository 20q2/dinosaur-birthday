/**
 * Sprite Engine — loads pixel art dino sprites and recolors them by hue-shifting
 * marker regions to match each dino's unique color palette.
 *
 * Each sprite uses 3 green marker color families:
 *   - Primary (body):     hue ≈ 90-125, value > 50%
 *   - Secondary (accent):  hue ≈ 50-80 (yellow-green highlights)
 *   - Accent (details):   hue ≈ 90-125, value 28-50% (darker shading)
 * Outline pixels (value < 28%) are kept as-is.
 *
 * Recoloring: shift each marker pixel's hue to the target region hue,
 * preserving original saturation and value for natural shading.
 */

import { rgbToHsv, hsvToRgb } from './colors.js';

import rexUrl from '../assets/sprites/rex.png';
import spinoUrl from '../assets/sprites/spino.png';
import diploUrl from '../assets/sprites/diplo.png';
import pachyUrl from '../assets/sprites/pachy.png';
import parasaurUrl from '../assets/sprites/parasaur.png';
import trikeUrl from '../assets/sprites/trike.png';
import ankyUrl from '../assets/sprites/anky.png';
import plazaBgUrl from '../assets/plaza_background.png';

const SPRITE_URLS = {
  trex: rexUrl,
  spinosaurus: spinoUrl,
  dilophosaurus: diploUrl,
  pachycephalosaurus: pachyUrl,
  parasaurolophus: parasaurUrl,
  triceratops: trikeUrl,
  ankylosaurus: ankyUrl,
};

// ── Image cache ──────────────────────────────────────────────────────────────

/** Raw loaded Image objects per species */
const rawImages = {};

/** Recolored canvas cache: key = "species-h1-h2-h3" */
const recolorCache = new Map();

/** Plaza background Image */
let plazaBgImage = null;

/** Promise that resolves when all sprites are loaded */
let loadPromise = null;

// ── Pixel classification ─────────────────────────────────────────────────────

/**
 * Classify a pixel by its HSV values into a region index:
 *   0 = primary (body green, h≈90-125, v>50%)
 *   1 = secondary (yellow-green, h≈50-80)
 *   2 = accent (dark body green, h≈90-125, v 28-50%)
 *  -1 = not a marker pixel (outline, black, white, or out of range)
 */
function classifyPixel(r, g, b, a) {
  if (a < 128) return -1; // transparent

  const { h, s, v } = rgbToHsv(r, g, b);

  // White/near-white background
  if (v > 0.92 && s < 0.12) return -1;

  // Outline / very dark
  if (v < 0.28) return -1;

  // Secondary: yellow-green hue range (the belly/sail/frill highlights)
  if (h >= 50 && h <= 80 && v > 0.40) return 1;

  // Primary: green hue, brighter
  if (h >= 85 && h <= 135 && v > 0.50) return 0;

  // Accent: green hue, darker shading
  if (h >= 85 && h <= 135 && v >= 0.28 && v <= 0.50) return 2;

  return -1;
}

// ── Core recolor function ────────────────────────────────────────────────────

/**
 * Recolor a sprite by shifting marker pixel hues to target hues.
 * @param {HTMLImageElement} img - Source sprite image
 * @param {number[]} targetHues - Array of 3 hue values [primary, secondary, accent]
 * @returns {HTMLCanvasElement} - Offscreen canvas with recolored sprite
 */
function recolorImage(img, targetHues) {
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;

  // Draw original onto offscreen canvas
  const src = document.createElement('canvas');
  src.width = w;
  src.height = h;
  const srcCtx = src.getContext('2d');
  srcCtx.drawImage(img, 0, 0);

  const imageData = srcCtx.getImageData(0, 0, w, h);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
    const region = classifyPixel(r, g, b, a);

    if (region === -1) continue;

    // Get the original pixel's HSV
    const hsv = rgbToHsv(r, g, b);

    // Shift hue to the target for this region, keep sat & val
    const newHue = targetHues[region] ?? hsv.h;
    const [nr, ng, nb] = hsvToRgb(newHue, hsv.s, hsv.v);

    data[i] = nr;
    data[i + 1] = ng;
    data[i + 2] = nb;
    // Alpha stays the same
  }

  // Write recolored data to a fresh canvas
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  out.getContext('2d').putImageData(imageData, 0, 0);
  return out;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Preload all sprite images. Call once at app startup.
 * @returns {Promise<void>}
 */
export function preloadAll() {
  if (loadPromise) return loadPromise;

  const promises = Object.entries(SPRITE_URLS).map(([species, url]) => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => { rawImages[species] = img; resolve(); };
      img.onerror = reject;
      img.src = url;
    });
  });

  // Also load plaza background
  promises.push(new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => { plazaBgImage = img; resolve(); };
    img.onerror = reject;
    img.src = plazaBgUrl;
  }));

  loadPromise = Promise.all(promises);
  return loadPromise;
}

/**
 * Check if sprites are loaded.
 */
export function isLoaded() {
  return Object.keys(rawImages).length === Object.keys(SPRITE_URLS).length;
}

/**
 * Get the raw (un-recolored) Image for a species.
 */
export function getRawImage(species) {
  return rawImages[species] || null;
}

/**
 * Get the plaza background Image.
 */
export function getPlazaBackground() {
  return plazaBgImage;
}

/**
 * Get a recolored sprite canvas for a species + color map.
 * @param {string} species - e.g. 'trex'
 * @param {object} colors - Region color map, e.g. {body: 120, belly: 45, stripes: 200}
 * @param {string[]} regions - Ordered region names, e.g. ['body', 'belly', 'stripes']
 * @returns {HTMLCanvasElement|null} - Recolored canvas, or null if not loaded
 */
export function getRecolored(species, colors, regions) {
  const img = rawImages[species];
  if (!img) return null;

  // Build target hues array ordered by region index
  const hues = regions.map(r => colors[r] ?? 120);
  const key = `${species}-${hues.join('-')}`;

  if (recolorCache.has(key)) return recolorCache.get(key);

  const canvas = recolorImage(img, hues);
  recolorCache.set(key, canvas);
  return canvas;
}

/**
 * Clear the recolor cache (useful after paint changes).
 */
export function clearCache(species) {
  if (species) {
    for (const key of recolorCache.keys()) {
      if (key.startsWith(species + '-')) recolorCache.delete(key);
    }
  } else {
    recolorCache.clear();
  }
}

/**
 * Get a data URL for a recolored sprite (for use in <img> tags).
 */
export function getRecoloredDataUrl(species, colors, regions) {
  const canvas = getRecolored(species, colors, regions);
  return canvas ? canvas.toDataURL() : null;
}
