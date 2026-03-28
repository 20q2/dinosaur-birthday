import { store } from '../store.js';
import { useStore } from '../router.jsx';
import { DinoSprite } from './DinoSprite.jsx';

import bgRocks from '../assets/backgrounds/dino_find_rocks.png';
import bgSwamp from '../assets/backgrounds/dino_find_swamp.png';
import bgRiver from '../assets/backgrounds/dino_find_river.png';
import bgGrass from '../assets/backgrounds/dino_find_tall_grass.png';

const BG_MAP = {
  rocks: bgRocks,
  swamp: bgSwamp,
  river: bgRiver,
  grass: bgGrass,
};

/**
 * Tappable partner dino box in the bottom-right corner.
 * Shows partner sprite over its selected backdrop.
 */
export function PartnerFloat() {
  const { player } = useStore();

  if (!player || !player.dinos) return null;

  const partner = player.dinos.find(d => d.is_partner);
  if (!partner) return null;

  const bgImg = BG_MAP[partner.background];
  const bgStyle = bgImg
    ? { backgroundImage: `url(${bgImg})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : { background: '#1a2e1a' };

  return (
    <div
      style={{ ...styles.wrapper, ...bgStyle }}
      onClick={() => store.navigate('/dinos/' + partner.species)}
    >
      <DinoSprite
        species={partner.species}
        colors={partner.colors || {}}
        scale={1.5}
        style={{ marginBottom: '-10px' }}
      />
    </div>
  );
}

const styles = {
  wrapper: {
    position: 'fixed',
    bottom: '76px',
    right: '12px',
    zIndex: 20,
    width: '88px',
    height: '88px',
    borderRadius: '14px',
    border: '2px solid #333',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
    overflow: 'hidden',
  },
};
