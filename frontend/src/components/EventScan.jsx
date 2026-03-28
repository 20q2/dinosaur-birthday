import { useState, useEffect } from 'preact/hooks';
import { store } from '../store.js';
import { api } from '../api.js';
import { EVENT_ICONS } from '../data/icons.js';
import { PartyPopper, Crown } from 'lucide-preact';

const EVENT_LABELS = {
  cooking_pot: 'Cooking Pot',
  dance_floor: 'Dance Floor',
  photo_booth: 'Photo Booth',
  cake_table: 'Cake Table',
  mystery_chest: 'Mystery Chest',
};

export function EventScan({ eventType }) {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [description, setDescription] = useState('');
  const [descSent, setDescSent] = useState(false);

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

  const handleSendDescription = async () => {
    if (!description.trim()) return;
    try {
      await api.scanEvent(store.playerId, eventType, description.trim());
      setDescSent(true);
    } catch {
      setDescSent(true);
    }
  };

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

  const label = EVENT_LABELS[eventType] || eventType;
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

      {!descSent ? (
        <div style={styles.descBox}>
          <p style={{ color: '#888', fontSize: '13px', margin: '0 0 8px' }}>
            Add a fun description for the feed? (optional)
          </p>
          <textarea
            placeholder={`e.g. "brewed a Health Potion (Beer + Lemonade)"`}
            value={description}
            onInput={(e) => setDescription(e.target.value)}
            maxLength={120}
            rows={3}
            style={styles.textarea}
          />
          <button
            onClick={handleSendDescription}
            disabled={!description.trim()}
            style={{ ...styles.secondaryButton, opacity: description.trim() ? 1 : 0.5 }}
          >
            Post to Feed
          </button>
        </div>
      ) : (
        <div style={{ color: '#4ade80', fontSize: '13px', textAlign: 'center' }}>
          Posted to feed!
        </div>
      )}

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
  descBox: {
    width: '100%', maxWidth: '320px', display: 'flex', flexDirection: 'column', gap: '6px',
  },
  textarea: {
    width: '100%', background: '#1a1a2e', border: '1px solid #333', borderRadius: '8px',
    color: '#e0e0e0', fontSize: '13px', padding: '10px', resize: 'none',
    fontFamily: 'inherit', boxSizing: 'border-box',
  },
  button: {
    padding: '14px', borderRadius: '8px', border: 'none',
    background: '#6366f1', color: 'white', fontSize: '16px',
    fontWeight: 'bold', cursor: 'pointer', width: '100%', maxWidth: '320px',
  },
  secondaryButton: {
    padding: '10px', borderRadius: '8px', border: 'none',
    background: '#374151', color: '#e0e0e0', fontSize: '14px',
    cursor: 'pointer', width: '100%',
  },
};
