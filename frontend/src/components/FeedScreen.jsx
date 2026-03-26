import { useEffect, useState } from 'preact/hooks';
import { api } from '../api.js';
import { store } from '../store.js';

const TYPE_ICONS = {
  encounter: '🦕',
  tamed: '🎉',
  play: '🤝',
  levelup: '⬆️',
  boss: '⚔️',
};

function relativeTime(timestamp) {
  // timestamp is an ISO string like "2026-03-26T01:00:00"
  const now = Date.now();
  let then;
  try {
    // Treat as UTC if no timezone suffix
    const str = timestamp.endsWith('Z') ? timestamp : timestamp + 'Z';
    then = new Date(str).getTime();
  } catch {
    return '';
  }
  if (isNaN(then)) return '';

  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 5) return 'just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

export function FeedScreen() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch initial entries on mount
  useEffect(() => {
    api.getFeed()
      .then(data => {
        setEntries(data.entries || []);
        setLoading(false);
      })
      .catch(err => {
        setError('Could not load feed.');
        setLoading(false);
      });
  }, []);

  // Merge live WebSocket entries from store
  useEffect(() => {
    const unsubscribe = store.subscribe(() => {
      const liveEntries = store.feedEntries;
      if (liveEntries.length === 0) return;

      setEntries(prev => {
        // Build a set of existing ids
        const existingIds = new Set(prev.map(e => e.id));
        const newEntries = liveEntries.filter(e => e.id && !existingIds.has(e.id));
        if (newEntries.length === 0) return prev;

        // Merge and sort newest first, keep top 100
        const merged = [...newEntries, ...prev];
        merged.sort((a, b) => {
          if (!a.timestamp) return 1;
          if (!b.timestamp) return -1;
          return b.timestamp.localeCompare(a.timestamp);
        });
        return merged.slice(0, 100);
      });
    });

    return unsubscribe;
  }, []);

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <span style={styles.headerIcon}>📰</span>
          <h2 style={styles.headerTitle}>Live Feed</h2>
        </div>
        <div style={styles.center}>
          <p style={styles.muted}>Loading...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <span style={styles.headerIcon}>📰</span>
          <h2 style={styles.headerTitle}>Live Feed</h2>
        </div>
        <div style={styles.center}>
          <p style={styles.errorText}>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <span style={styles.headerIcon}>📰</span>
        <h2 style={styles.headerTitle}>Live Feed</h2>
      </div>

      {entries.length === 0 ? (
        <div style={styles.center}>
          <span style={{ fontSize: '48px' }}>🦕</span>
          <p style={styles.muted}>No activity yet!</p>
          <p style={{ ...styles.muted, fontSize: '13px' }}>Go scan some dinos to get things started.</p>
        </div>
      ) : (
        <ul style={styles.list}>
          {entries.map(entry => (
            <li key={entry.id} style={styles.item}>
              <span style={styles.icon}>
                {TYPE_ICONS[entry.type] || '🌿'}
              </span>
              <div style={styles.body}>
                <p style={styles.message}>{entry.message}</p>
                <p style={styles.timestamp}>{relativeTime(entry.timestamp)}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100%',
    background: '#0f1a0f',
    color: '#f0fdf4',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '18px 16px 12px',
    borderBottom: '1px solid #1f3d1f',
    background: '#111f11',
    flexShrink: 0,
  },
  headerIcon: {
    fontSize: '24px',
  },
  headerTitle: {
    margin: 0,
    fontSize: '20px',
    fontWeight: 'bold',
    color: '#4ade80',
  },
  center: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px 20px',
    textAlign: 'center',
  },
  muted: {
    color: '#86efac',
    marginTop: '8px',
    fontSize: '15px',
  },
  errorText: {
    color: '#f87171',
    fontSize: '15px',
  },
  list: {
    listStyle: 'none',
    margin: 0,
    padding: '8px 0',
    overflowY: 'auto',
  },
  item: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
    padding: '12px 16px',
    borderBottom: '1px solid #1f3d1f',
  },
  icon: {
    fontSize: '22px',
    flexShrink: 0,
    lineHeight: '1.4',
  },
  body: {
    flex: 1,
    minWidth: 0,
  },
  message: {
    margin: 0,
    fontSize: '15px',
    color: '#f0fdf4',
    lineHeight: '1.4',
    wordBreak: 'break-word',
  },
  timestamp: {
    margin: '3px 0 0',
    fontSize: '12px',
    color: '#4ade80',
  },
};
