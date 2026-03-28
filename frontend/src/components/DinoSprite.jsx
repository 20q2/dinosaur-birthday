import { useRef, useEffect, useState } from 'preact/hooks';
import { getRecolored, getRawImage } from '../utils/spriteEngine.js';
import { SPECIES } from '../data/species.js';
import { getHatImage, getHatAnchor } from '../data/hatImages.js';

/**
 * Renders a recolored dino sprite on a <canvas> element with pixelated scaling.
 * Optionally draws a hat image on the dino's head.
 *
 * @param {string} species - Species ID (e.g. 'trex')
 * @param {object} colors - Region→hue map (e.g. {body: 120, belly: 45, stripes: 200})
 * @param {number} scale - Pixel scale multiplier (default 3)
 * @param {string} hat - Hat ID to render (e.g. 'party_hat'), or null
 */
export function DinoSprite({ species, colors = {}, scale = 3, style = {}, hat = null }) {
  const canvasRef = useRef(null);
  const [hatVersion, setHatVersion] = useState(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const speciesData = SPECIES[species];
    if (!speciesData) return;

    const regions = speciesData.regions;
    const recolored = getRecolored(species, colors || {}, regions);
    const spriteSource = recolored || getRawImage(species);
    if (!spriteSource) return;

    const sw = spriteSource.width || spriteSource.naturalWidth;
    const sh = spriteSource.height || spriteSource.naturalHeight;

    // Calculate extra headroom for hat above sprite
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

    // Draw sprite shifted down by hatRise
    ctx.drawImage(spriteSource, 0, hatRise * scale, sw * scale, sh * scale);

    // Draw hat on top
    if (hatInfo?.loaded && anchor) {
      const hatW = hatInfo.img.naturalWidth * scale;
      const hatH = hatInfo.img.naturalHeight * scale;
      const hatX = anchor.x * scale - hatW / 2;
      const hatY = (anchor.y + hatRise + hatInfo.offsetY) * scale - hatH;
      ctx.drawImage(hatInfo.img, hatX, hatY, hatW, hatH);
    }
  }, [species, colors, scale, hat, hatVersion]);

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
