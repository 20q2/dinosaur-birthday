import { store } from '../store.js';

const tabs = [
  { route: '/plaza', icon: '🌿', label: 'Plaza' },
  { route: '/dinos', icon: '🦕', label: 'My Dinos' },
  { route: '/play', icon: '🤝', label: 'Play' },
  { route: '/feed', icon: '📰', label: 'Feed' },
  { route: '/profile', icon: '👤', label: 'Profile' },
];

export function BottomNav() {
  const current = store.route;

  return (
    <nav style={styles.nav}>
      {tabs.map(tab => (
        <button
          key={tab.route}
          onClick={() => store.navigate(tab.route)}
          style={{
            ...styles.tab,
            color: current === tab.route ? '#4ade80' : '#888',
          }}
        >
          <span style={styles.icon}>{tab.icon}</span>
          <span style={styles.label}>{tab.label}</span>
        </button>
      ))}
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
  icon: { fontSize: '20px' },
  label: { fontSize: '10px' },
};
