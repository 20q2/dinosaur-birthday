import { useState } from 'preact/hooks';
import { AdminDashboard } from './AdminDashboard.jsx';
import { AdminQRCodes } from './AdminQRCodes.jsx';
import { AdminSimulator } from './AdminSimulator.jsx';
import { AdminBots } from './AdminBots.jsx';
import { AdminReset } from './AdminReset.jsx';

const TABS = [
  { id: 'dashboard',  label: 'Dashboard', icon: '\u{1F4CA}' },
  { id: 'qrcodes',    label: 'QR Codes',  icon: '\u{1F4F1}' },
  { id: 'simulator',  label: 'Simulator', icon: '\u{1F3AE}' },
  { id: 'bots',       label: 'Bots',      icon: '\u{1F916}' },
  { id: 'reset',      label: 'Reset',     icon: '\u{1F5D1}\u{FE0F}' },
];

const TAB_COMPONENTS = {
  dashboard: AdminDashboard,
  qrcodes: AdminQRCodes,
  simulator: AdminSimulator,
  bots: AdminBots,
  reset: AdminReset,
};

export function AdminPanel() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const TabContent = TAB_COMPONENTS[activeTab];

  return (
    <div style={styles.page}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerTitle}>ADMIN PANEL</div>
        <div style={styles.headerSub}>Party Host Controls</div>
      </div>

      {/* Tab bar */}
      <div style={styles.tabBar}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            style={{
              ...styles.tab,
              ...(activeTab === tab.id ? styles.tabActive : {}),
            }}
            onClick={() => setActiveTab(tab.id)}
          >
            <span style={styles.tabIcon}>{tab.icon}</span>
            <span style={styles.tabLabel}>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={styles.tabContent}>
        <TabContent />
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100dvh',
    background: '#0a0a0a',
    color: '#f0f0f0',
    display: 'flex',
    flexDirection: 'column',
    overflowX: 'hidden',
  },
  header: {
    background: 'linear-gradient(135deg, #1a0000 0%, #3d0000 100%)',
    padding: '20px 16px 16px',
    borderBottom: '2px solid #7f1d1d',
    flexShrink: 0,
  },
  headerTitle: {
    fontSize: '26px',
    fontWeight: '900',
    color: '#ef4444',
    letterSpacing: '3px',
    textShadow: '0 0 20px rgba(239,68,68,0.5)',
  },
  headerSub: {
    fontSize: '13px',
    color: '#fca5a5',
    marginTop: '3px',
  },
  tabBar: {
    display: 'flex',
    background: '#111',
    borderBottom: '1px solid #333',
    overflowX: 'auto',
    flexShrink: 0,
  },
  tab: {
    flex: '1 1 0',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '2px',
    padding: '10px 4px 8px',
    background: 'none',
    border: 'none',
    borderBottom: '3px solid transparent',
    color: '#888',
    cursor: 'pointer',
    minWidth: '60px',
    fontSize: '12px',
  },
  tabActive: {
    color: '#fff',
    borderBottomColor: '#6366f1',
  },
  tabIcon: {
    fontSize: '18px',
  },
  tabLabel: {
    fontSize: '10px',
    whiteSpace: 'nowrap',
  },
  tabContent: {
    flex: 1,
    overflow: 'auto',
  },
};
