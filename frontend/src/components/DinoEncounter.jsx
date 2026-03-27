import { useState, useEffect } from 'preact/hooks';
import { store } from '../store.js';
import { api } from '../api.js';
import { SPECIES } from '../data/species.js';
import { DinoSprite } from './DinoSprite.jsx';

export function DinoEncounter({ species }) {
  const [dino, setDino] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const result = await api.scanDino(store.playerId, species);
        setDino(result);
        await store.refresh();
      } catch (err) {
        setError(err.message);
      }
      setLoading(false);
    })();
  }, [species]);

  if (loading) return <div style={styles.center}><p>Scanning...</p></div>;
  if (error) return <div style={styles.center}><p style={{ color: '#ef4444' }}>{error}</p></div>;

  if (dino.already_owned) {
    return (
      <div style={styles.center}>
        <p>You already have a {SPECIES[species]?.name || species}!</p>
        <button onClick={() => store.navigate('/dinos')} style={styles.button}>View My Dinos</button>
      </div>
    );
  }

  const speciesData = SPECIES[species];

  return (
    <div style={styles.container}>
      <div style={styles.header}>⚡ WILD ENCOUNTER ⚡</div>

      <div style={styles.dinoBox}>
        <DinoSprite species={species} colors={dino.colors || {}} scale={3} />
      </div>

      <h2>{speciesData?.name || species}</h2>
      {dino.shiny && <div style={styles.shiny}>✨ SHINY ✨</div>}
      <div style={{ color: dino.diet === 'carnivore' ? '#ef4444' : '#22c55e', fontSize: '14px' }}>
        {dino.diet === 'carnivore' ? '🥩 Carnivore' : '🫐 Herbivore'}
      </div>
      <div style={{ color: '#888', fontSize: '12px', margin: '4px 0' }}>
        {dino.gender} · {dino.nature}
      </div>

      <div style={styles.foodHint}>
        <div style={{ color: '#f59e0b' }}>
          {dino.diet === 'carnivore' ? '🥩 This dino wants Meat!' : '🫐 This dino wants Mejoberries!'}
        </div>
        <div style={{ color: '#888', fontSize: '12px', marginTop: '4px' }}>
          {dino.diet === 'carnivore'
            ? 'Find the Meat QR near the grill'
            : 'Find the Mejoberry QR near the veggie platters'}
        </div>
      </div>

      <button disabled style={{ ...styles.button, opacity: 0.5 }}>TAME (needs food)</button>
      <button onClick={() => store.navigate('/plaza')} style={{ ...styles.button, background: '#333', marginTop: '8px' }}>
        Back to Plaza
      </button>
    </div>
  );
}

const styles = {
  center: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '80dvh', padding: '20px', gap: '16px' },
  container: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 20px', gap: '8px' },
  header: { color: '#f59e0b', fontSize: '14px', fontWeight: 'bold' },
  dinoBox: {
    width: '120px', height: '120px', background: '#1a2e1a', borderRadius: '16px',
    display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '12px 0',
  },
  shiny: { color: '#f59e0b', fontSize: '16px', fontWeight: 'bold' },
  foodHint: {
    background: '#1a1a2e', borderRadius: '8px', padding: '14px', textAlign: 'center',
    margin: '12px 0', width: '100%', maxWidth: '300px',
  },
  button: {
    padding: '14px', borderRadius: '8px', border: 'none',
    background: '#6366f1', color: 'white', fontSize: '16px',
    fontWeight: 'bold', cursor: 'pointer', width: '100%', maxWidth: '300px',
  },
};
