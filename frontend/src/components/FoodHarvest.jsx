import { useState, useEffect } from 'preact/hooks';
import { store } from '../store.js';
import { api } from '../api.js';
import { DinoTaming } from './DinoTaming.jsx';
import meatImg from '../assets/items/meat.png';
import berryImg from '../assets/items/berry.png';

const FOOD_LABELS = { meat: 'Meat', mejoberries: 'Mejoberries' };
const FOOD_IMGS = { meat: meatImg, mejoberries: berryImg };
const FOOD_ICONS = { meat: '🥩', mejoberries: '🫐' };

export function FoodHarvest({ foodType }) {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [phase, setPhase] = useState('harvest'); // 'harvest' | 'taming'
  const [popIn, setPopIn] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const data = await api.scanFood(store.playerId, foodType, null);
        setResult(data);
        await store.refresh();
        // Trigger pop-in animation after a brief delay
        setTimeout(() => setPopIn(true), 100);
      } catch (err) {
        setError(err.message);
      }
      setLoading(false);
    })();
  }, [foodType]);

  if (loading) {
    return <div style={styles.center}><p style={{ color: '#9ca3af' }}>Harvesting...</p></div>;
  }

  if (error) {
    return (
      <div style={styles.center}>
        <p style={{ color: '#ef4444' }}>{error}</p>
        <button onClick={() => store.navigate('/plaza')} style={styles.button}>Back to Plaza</button>
      </div>
    );
  }

  // Phase 2: taming (pass through to DinoTaming with pre-fetched data)
  if (phase === 'taming') {
    return <DinoTaming foodType={foodType} prefetchedResult={result} />;
  }

  // Phase 1: harvest screen
  const harvest = result?.harvest || {};
  const label = FOOD_LABELS[foodType] || foodType;
  const img = FOOD_IMGS[foodType];
  const canTame = !result?.harvest_only && !result?.already_tamed;

  return (
    <div style={styles.page}>
      <div style={styles.header}>FOOD HARVESTED!</div>

      <div style={{
        ...styles.iconBox,
        transform: popIn ? 'scale(1)' : 'scale(0)',
        opacity: popIn ? 1 : 0,
      }}>
        <img src={img} style={styles.foodImg} />
      </div>

      <h2 style={styles.title}>
        <img src={FOOD_IMGS[foodType]} style={{ width: '24px', height: '24px', imageRendering: 'pixelated', verticalAlign: 'middle' }} />{' '}You collected {label}!
      </h2>

      <p style={styles.inventoryNote}>Added to your inventory</p>

      {/* Reward box */}
      <div style={styles.rewardBox}>
        {harvest.first_time ? (
          <>
            <div style={styles.rewardRow}>
              <span style={{ color: '#d1d5db' }}>XP Earned</span>
              <span style={styles.xpBadge}>+{harvest.xp_awarded} XP</span>
            </div>
            {harvest.dino && (
              <div style={styles.rewardRow}>
                <span style={{ color: '#d1d5db' }}>Partner</span>
                <span style={{ color: '#a78bfa', fontSize: '13px' }}>
                  {harvest.dino.species} Lv.{harvest.dino.level} ({harvest.dino.xp} XP)
                </span>
              </div>
            )}
            {harvest.no_partner && (
              <div style={styles.partnerHint}>
                Set a partner dino to earn XP from activities!
              </div>
            )}
          </>
        ) : (
          <div style={styles.rewardRow}>
            <span style={{ color: '#9ca3af' }}>Already harvested this food type</span>
          </div>
        )}
      </div>

      {/* Already tamed notice */}
      {result?.already_tamed && (
        <p style={{ color: '#9ca3af', fontSize: '13px', textAlign: 'center' }}>
          Your {label}-eating dinos are all tamed already!
        </p>
      )}

      {/* Actions */}
      {canTame ? (
        <button onClick={() => setPhase('taming')} style={styles.primaryBtn}>
          Feed a Dino!
        </button>
      ) : (
        <button onClick={() => store.navigate('/plaza')} style={styles.button}>
          Back to Plaza
        </button>
      )}
    </div>
  );
}

const styles = {
  center: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', minHeight: '80dvh', padding: '20px', gap: '16px',
  },
  page: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    padding: '32px 20px 80px', gap: '14px',
    background: 'linear-gradient(180deg, #1a2e1a 0%, #0d1117 40%)',
    minHeight: '100vh',
  },
  header: {
    color: '#4ade80', fontSize: '13px', fontWeight: '900',
    letterSpacing: '3px', textAlign: 'center',
  },
  iconBox: {
    width: '120px', height: '120px',
    background: 'radial-gradient(circle, #1a3a1a 0%, #0f1f0f 100%)',
    borderRadius: '24px', border: '2px solid #22633480',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    margin: '8px 0',
    transition: 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.3s ease',
  },
  foodImg: {
    width: '64px', height: '64px', imageRendering: 'pixelated',
  },
  title: {
    margin: 0, fontSize: '22px', color: '#e5e7eb', textAlign: 'center',
  },
  inventoryNote: {
    color: '#6b7280', fontSize: '13px', margin: 0,
    background: '#111827', borderRadius: '999px', padding: '4px 14px',
  },
  rewardBox: {
    background: '#111827', border: '1px solid #1e293b', borderRadius: '12px',
    padding: '14px 18px', width: '100%', maxWidth: '320px',
    display: 'flex', flexDirection: 'column', gap: '8px',
  },
  rewardRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    fontSize: '14px',
  },
  xpBadge: {
    color: '#f59e0b', fontWeight: 'bold', fontSize: '14px',
  },
  partnerHint: {
    color: '#f59e0b', fontSize: '13px', textAlign: 'center',
    background: '#1c1508', borderRadius: '8px', padding: '10px',
    border: '1px solid #78350f40',
  },
  primaryBtn: {
    padding: '16px', borderRadius: '12px', border: 'none',
    background: '#22c55e', color: 'white', fontSize: '16px',
    fontWeight: 'bold', cursor: 'pointer', width: '100%', maxWidth: '320px',
    letterSpacing: '0.5px', marginTop: '4px',
  },
  button: {
    padding: '14px', borderRadius: '10px', border: 'none',
    background: '#6366f1', color: 'white', fontSize: '16px',
    fontWeight: 'bold', cursor: 'pointer', width: '100%', maxWidth: '320px',
  },
};
