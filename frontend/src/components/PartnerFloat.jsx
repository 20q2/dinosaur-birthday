import { store } from '../store.js';
import { useStore } from '../router.jsx';
import { DinoSprite } from './DinoSprite.jsx';

/**
 * Floating partner dino in the bottom-right corner.
 * Shown on all views except the plaza.
 */
export function PartnerFloat() {
  const { player, route } = useStore();

  // Hide on plaza (including default route) and when no player data
  if (!player || !player.dinos) return null;
  if (route === '/plaza' || route === '/') return null;

  const partner = player.dinos.find(d => d.is_partner);
  if (!partner) return null;

  return (
    <div style={styles.wrapper}>
      <DinoSprite
        species={partner.species}
        colors={partner.colors || {}}
        scale={3}
      />
    </div>
  );
}

const styles = {
  wrapper: {
    position: 'fixed',
    bottom: '70px',
    right: '12px',
    zIndex: 20,
    pointerEvents: 'none',
    filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))',
  },
};
