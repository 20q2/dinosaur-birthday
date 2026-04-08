import { store } from '../store.js';
import { useStore } from '../router.jsx';
import { DinoSprite } from './DinoSprite.jsx';
import { SPECIES } from '../data/species.js';

import bgRocks from '../assets/backgrounds/dino_find_rocks.png';
import bgSwamp from '../assets/backgrounds/dino_find_swamp.png';
import bgRiver from '../assets/backgrounds/dino_find_river.png';
import bgGrass from '../assets/backgrounds/dino_find_tall_grass.png';
import bgCave from '../assets/backgrounds/dino_find_cave.png';
import bgCanyon from '../assets/backgrounds/dino_find_canyon.png';
import bgVolcanic from '../assets/backgrounds/dino_find_volcanic.png';

const BG_MAP = {
  rocks: bgRocks,
  swamp: bgSwamp,
  river: bgRiver,
  grass: bgGrass,
  cave: bgCave,
  canyon: bgCanyon,
  volcanic: bgVolcanic,
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

  const bgKey = partner.background || (SPECIES[partner.species] && SPECIES[partner.species].backdrop) || 'volcanic';
  const bgImg = BG_MAP[bgKey];
  const bgStyle = bgImg
    ? { backgroundImage: `url(${bgImg})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : { background: '#1a2e1a' };

  return (
    <div
      style={styles.wrapper}
      onClick={() => store.navigate('/dinos/' + partner.species)}
    >
      <div style={{ ...styles.bg, ...bgStyle }} />
      <DinoSprite
        species={partner.species}
        colors={partner.colors || {}}
        hat={partner.hat || null}
        scale={1.5}
        style={{ marginTop: '-20%', marginLeft: '15%', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.7))', position: 'relative' }}
      />
    </div>
  );
}

const styles = {
  wrapper: {
    position: 'fixed',
    bottom: '68px',
    right: '2px',
    zIndex: 20,
    width: '88px',
    height: '88px',
    borderRadius: '4px',
    border: '2px solid #000000a0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
    overflow: 'hidden',
  },
  bg: {
    position: 'absolute', inset: 0,
    backgroundSize: 'cover', backgroundPosition: 'center',
    filter: 'saturate(0.5)',
  },
};
