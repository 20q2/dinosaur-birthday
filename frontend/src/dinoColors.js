/**
 * Helpers for handling polymorphic dino color regions.
 * A region value is either a hue number (normal paint) or { effect: "..." } (rare paint).
 */

/** Returns the hue number for a region, or null if the region has a rare effect. */
export function regionHue(colors, region) {
  const v = colors?.[region];
  return (v && typeof v === 'object') ? null : (v ?? 0);
}

/** Returns the effect string ("rainbow" etc.) for a region, or null if it's a plain hue. */
export function regionEffect(colors, region) {
  const v = colors?.[region];
  return (v && typeof v === 'object') ? v.effect : null;
}

/** Returns true if any region in the colors object has a rare effect. */
export function hasEffects(colors) {
  return Object.values(colors || {}).some(v => v && typeof v === 'object');
}

/**
 * Returns a time-animated hue number for a rare effect.
 * Metallic and starry_night use fixed base hues — their visual distinction
 * comes from overlay effects drawn separately in canvas contexts.
 */
export function effectHue(effect, time) {
  switch (effect) {
    case 'rainbow':      return Math.floor((time / 20) % 360);
    case 'metallic':     return 210; // steel-blue base; shimmer overlay added separately
    case 'starry_night': return 240; // deep indigo base; star overlay added separately
    case 'prismatic':    return Math.floor((time / 35 + 180) % 360);
    default:             return 0;
  }
}

/**
 * Resolves a polymorphic colors object to plain hue numbers for getRecolored / getRecoloredUncached.
 * Effect regions are animated using the provided time (Date.now()).
 *
 * @param {object} colors - e.g. { body: { effect: 'rainbow' }, belly: 45 }
 * @param {number} time - Date.now() for animation
 * @returns {object} - e.g. { body: 120, belly: 45 }
 */
export function resolveColors(colors, time) {
  const out = {};
  for (const [region, value] of Object.entries(colors || {})) {
    out[region] = (value && typeof value === 'object')
      ? effectHue(value.effect, time)
      : value;
  }
  return out;
}
