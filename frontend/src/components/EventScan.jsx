import { useState, useEffect } from 'preact/hooks';
import { store } from '../store.js';
import { api } from '../api.js';
import { EVENT_ICONS } from '../data/icons.js';
import { PartyPopper, Crown } from 'lucide-preact';

export function EventScan({ eventType }) {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const data = await api.scanEvent(store.playerId, eventType);
        setResult(data);
        await store.refresh();
      } catch (err) {
        setError(err.message);
      }
      setLoading(false);
    })();
  }, [eventType]);

  if (loading) {
    return <div style={styles.center}><p>Checking event...</p></div>;
  }

  if (error) {
    return (
      <div style={styles.center}>
        <p style={{ color: '#ef4444' }}>{error}</p>
        <button onClick={() => store.navigate('/plaza')} style={styles.button}>Back to Plaza</button>
      </div>
    );
  }

  const label = result?.event_label || eventType;
  const EventIcon = EVENT_ICONS[eventType] || PartyPopper;

  if (result?.already_claimed) {
    return (
      <div style={styles.container}>
        <div style={styles.iconBox}><EventIcon size={56} /></div>
        <h2 style={styles.title}>{label}</h2>
        <div style={styles.pill}>Already Claimed</div>
        <p style={{ color: '#888', textAlign: 'center', fontSize: '14px' }}>
          You've already visited this event. Only one reward per party station!
        </p>
        <button onClick={() => store.navigate('/plaza')} style={styles.button}>Back to Plaza</button>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>PARTY EVENT!</div>
      <div style={styles.iconBox}><EventIcon size={56} /></div>
      <h2 style={styles.title}>{label}</h2>

      <div style={styles.rewardBox}>
        <div style={styles.rewardRow}>
          <span>XP Gained</span>
          <span style={{ color: '#f59e0b', fontWeight: 'bold' }}>+25 XP</span>
        </div>
        {result?.dino && (
          <div style={styles.rewardRow}>
            <span>Partner Dino</span>
            <span style={{ color: '#a78bfa', fontSize: '13px' }}>
              {result.dino.species} Lv.{result.dino.level} ({result.dino.xp} XP)
            </span>
          </div>
        )}
        {result?.item && (
          <div style={styles.rewardRow}>
            <span>Item Found</span>
            <span style={{ color: '#4ade80', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Crown size={14} /> {result.item.name}
            </span>
          </div>
        )}
      </div>

      <button onClick={() => store.navigate('/plaza')} style={styles.button}>Back to Plaza</button>
    </div>
  );
}

const styles = {
  center: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', minHeight: '80dvh', padding: '20px', gap: '16px',
  },
  container: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    padding: '24px 20px', gap: '12px',
  },
  header: { color: '#f59e0b', fontSize: '13px', fontWeight: 'bold', letterSpacing: '1px' },
  iconBox: {
    width: '100px', height: '100px', background: '#1a2e1a', borderRadius: '16px',
    display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '4px 0',
    color: '#4ade80',
  },
  title: { margin: 0, fontSize: '22px' },
  pill: {
    background: '#374151', color: '#9ca3af', borderRadius: '999px',
    padding: '4px 14px', fontSize: '12px',
  },
  rewardBox: {
    background: '#1a1a2e', borderRadius: '10px', padding: '14px 18px',
    width: '100%', maxWidth: '320px', display: 'flex', flexDirection: 'column', gap: '8px',
  },
  rewardRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '14px',
  },
  button: {
    padding: '14px', borderRadius: '8px', border: 'none',
    background: '#6366f1', color: 'white', fontSize: '16px',
    fontWeight: 'bold', cursor: 'pointer', width: '100%', maxWidth: '320px',
  },
};
