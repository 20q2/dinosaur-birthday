import { useState, useEffect } from 'preact/hooks';
import { store } from '../store.js';
import { api } from '../api.js';
import { getHatImage } from '../data/hatImages.js';

export function InspirationScan() {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const data = await api.scanInspiration(store.playerId);
        setResult(data);
        await store.refresh();
      } catch (err) {
        setError(err.message);
      }
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return <div style={styles.center}><p>Receiving blessing...</p></div>;
  }

  if (error) {
    return (
      <div style={styles.center}>
        <p style={{ color: '#ef4444' }}>{error}</p>
        <button onClick={() => store.navigate('/plaza')} style={styles.button}>Back to Plaza</button>
      </div>
    );
  }

  if (result?.already_received) {
    return (
      <div style={styles.container}>
        <div style={{ fontSize: '64px' }}>✨</div>
        <h2 style={styles.title}>Alex's Inspiration</h2>
        <div style={styles.pill}>Already Received</div>
        <p style={{ color: '#888', textAlign: 'center', fontSize: '14px', maxWidth: '280px' }}>
          You've already received Alex's blessing. The Birthday Girl smiles upon you still.
        </p>
        {result?.item && (
          <div style={styles.hatBadge}>
            <span style={{ fontSize: '20px' }}>🎩</span>
            <span style={{ color: '#f59e0b', fontWeight: 'bold' }}>{result.item.name}</span>
            <span style={{ color: '#888', fontSize: '12px' }}>legendary</span>
          </div>
        )}
        <button onClick={() => store.navigate('/plaza')} style={styles.button}>Back to Plaza</button>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.sparkle}>✨ ALEX'S INSPIRATION ✨</div>

      <div style={styles.portraitBox}>
        <span style={{ fontSize: '72px' }}>👑</span>
      </div>

      <h2 style={styles.title}>You've been blessed!</h2>
      <p style={{ color: '#c084fc', textAlign: 'center', fontSize: '15px', maxWidth: '280px', margin: '0' }}>
        "Alex blessed you with Inspiration!"
      </p>

      <div style={styles.rewardBox}>
        <div style={styles.rewardRow}>
          <span>XP Gained</span>
          <span style={{ color: '#f59e0b', fontWeight: 'bold' }}>+50 XP</span>
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
          <div style={{ ...styles.rewardRow, flexDirection: 'column', alignItems: 'flex-start', gap: '4px' }}>
            <span>Legendary Item</span>
            <div style={styles.hatBadge}>
              <span style={{ fontSize: '18px' }}>🎩</span>
              <span style={{ color: '#f59e0b', fontWeight: 'bold', fontSize: '14px' }}>{result.item.name}</span>
              <span style={styles.legendaryTag}>LEGENDARY</span>
            </div>
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
    padding: '32px 20px', gap: '14px',
  },
  sparkle: {
    color: '#f59e0b', fontSize: '13px', fontWeight: 'bold',
    letterSpacing: '1px', textAlign: 'center',
  },
  portraitBox: {
    width: '110px', height: '110px',
    background: 'linear-gradient(135deg, #2d1b69, #4c1d95)',
    borderRadius: '50%', border: '3px solid #c084fc',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    margin: '4px 0',
    boxShadow: '0 0 24px #c084fc55',
  },
  title: { margin: 0, fontSize: '22px', textAlign: 'center' },
  pill: {
    background: '#374151', color: '#9ca3af', borderRadius: '999px',
    padding: '4px 14px', fontSize: '12px',
  },
  rewardBox: {
    background: '#1a1a2e', borderRadius: '10px', padding: '14px 18px',
    width: '100%', maxWidth: '320px', display: 'flex', flexDirection: 'column', gap: '10px',
    border: '1px solid #4c1d95',
  },
  rewardRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '14px',
  },
  hatBadge: {
    display: 'flex', alignItems: 'center', gap: '8px',
    background: '#1e1b2e', borderRadius: '8px', padding: '8px 12px',
    border: '1px solid #f59e0b44',
  },
  legendaryTag: {
    background: '#78350f', color: '#f59e0b', borderRadius: '4px',
    padding: '2px 6px', fontSize: '10px', fontWeight: 'bold',
  },
  button: {
    padding: '14px', borderRadius: '8px', border: 'none',
    background: '#7c3aed', color: 'white', fontSize: '16px',
    fontWeight: 'bold', cursor: 'pointer', width: '100%', maxWidth: '320px',
    marginTop: '4px',
  },
};
