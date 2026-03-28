import partyHatSrc from '../assets/hats/partyhat.png';
import cowboyHatSrc from '../assets/hats/cowboyhat.png';
import topHatSrc from '../assets/hats/tophat.png';
import flowerCrownSrc from '../assets/hats/flowercrownhat.png';
import sunglassesSrc from '../assets/hats/sunglasses.png';
import chefHatSrc from '../assets/hats/chefhat.png';
import headbandSrc from '../assets/hats/headband.png';
import beanieSrc from '../assets/hats/beanie.png';
import { getRedPixelAnchor } from '../utils/spriteEngine.js';

/**
 * Per-hat render metadata.
 * offsetY: vertical nudge in sprite pixels (positive = lower on head)
 */
const HAT_META = {
  party_hat:    { src: partyHatSrc,    offsetY: 1 },
  cowboy_hat:   { src: cowboyHatSrc,   offsetY: 2 },
  top_hat:      { src: topHatSrc,      offsetY: 0 },
  flower_crown: { src: flowerCrownSrc, offsetY: 2 },
  sunglasses:   { src: sunglassesSrc,  offsetY: 8 },
  chef_hat:     { src: chefHatSrc,     offsetY: 0 },
  headband:     { src: headbandSrc,    offsetY: 4 },
  beanie:       { src: beanieSrc,      offsetY: 2 },
};

/**
 * Fallback per-species head anchors (used if no red pixel marker found).
 */
const FALLBACK_ANCHORS = {
  trex:               { x: 9,  y: 5 },
  spinosaurus:        { x: 5,  y: 9 },
  dilophosaurus:      { x: 8,  y: 5 },
  pachycephalosaurus: { x: 9,  y: 5 },
  parasaurolophus:    { x: 8,  y: 3 },
  triceratops:        { x: 6,  y: 8 },
  ankylosaurus:       { x: 6,  y: 10 },
};
const DEFAULT_ANCHOR = { x: 16, y: 6 };

// Preload all hat images eagerly
const _cache = {};
Object.entries(HAT_META).forEach(([id, meta]) => {
  const img = new Image();
  img.src = meta.src;
  const entry = { img, offsetY: meta.offsetY, loaded: false };
  img.onload = () => { entry.loaded = true; };
  _cache[id] = entry;
});

/** Get hat image data, or null if hat has no artwork. */
export function getHatImage(hatId) {
  return _cache[hatId] || null;
}

/**
 * Get species head anchor point for hat placement.
 * Auto-detects from a pure-red (255,0,0) pixel in the sprite,
 * falling back to hardcoded anchors if not found.
 */
export function getHatAnchor(species) {
  return getRedPixelAnchor(species) || FALLBACK_ANCHORS[species] || DEFAULT_ANCHOR;
}
