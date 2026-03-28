import { store } from '../store.js';
import { Leaf, Footprints, Handshake, Backpack, User, Settings } from 'lucide-preact';

const IS_LOCAL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

const tabs = [
  { route: '/plaza',     Icon: Leaf,      label: 'Plaza' },
  { route: '/dinos',     Icon: Footprints, label: 'My Dinos' },
  { route: '/play',      Icon: Handshake, label: 'Play' },
  { route: '/inventory', Icon: Backpack,  label: 'Inventory' },
  { route: '/profile',   Icon: User,      label: 'Profile' },
  ...(IS_LOCAL ? [{ route: '/admin', Icon: Settings, label: 'Admin' }] : []),
];

export function BottomNav() {
  const current = store.route;

  return (
    <nav style={styles.nav}>
      {tabs.map(tab => {
        const color = current === tab.route || current.startsWith(tab.route + '/') ? '#4ade80' : '#888';
        return (
          <button
            key={tab.route}
            onClick={() => store.navigate(tab.route)}
            style={{ ...styles.tab, color }}
          >
            <tab.Icon size={24} />
            <span style={styles.label}>{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

const styles = {
  nav: {
    display: 'flex', justifyContent: 'space-around',
    background: '#111', borderTop: '1px solid #333',
    padding: '8px 4px 12px', flexShrink: 0,
    position: 'sticky', bottom: 0,
  },
  tab: {
    flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
    gap: '2px', background: 'none', border: 'none', cursor: 'pointer',
    padding: '4px',
  },
  label: { fontSize: '10px' },
};
