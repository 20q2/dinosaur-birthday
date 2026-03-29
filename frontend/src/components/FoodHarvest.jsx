import { useState, useEffect } from 'preact/hooks';
import { store } from '../store.js';
import { api } from '../api.js';
import { DinoTaming } from './DinoTaming.jsx';
import { HarvestMinigame } from './HarvestMinigame.jsx';

export function FoodHarvest({ foodType }) {
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [phase, setPhase] = useState('minigame'); // 'minigame' | 'taming'

  async function handleGameEnd(perfects, goods) {
    try {
      const data = await api.scanFood(store.playerId, foodType, null, perfects, goods);
      setResult(data);
      await store.refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  if (error) {
    return (
      <div style={styles.center}>
        <p style={{ color: '#ef4444' }}>{error}</p>
        <button onClick={() => store.navigate('/plaza')} style={styles.button}>Back to Plaza</button>
      </div>
    );
  }

  if (phase === 'taming') {
    return <DinoTaming foodType={foodType} prefetchedResult={result} />;
  }

  const canTame = result && !result.harvest_only && !result.already_tamed;

  function handleComplete() {
    if (canTame) {
      setPhase('taming');
    } else {
      store.navigate('/plaza');
    }
  }

  return (
    <HarvestMinigame
      foodType={foodType}
      apiResult={result}
      onGameEnd={handleGameEnd}
      onComplete={handleComplete}
    />
  );
}

const styles = {
  center: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', minHeight: '80dvh', padding: '20px', gap: '16px',
  },
  button: {
    padding: '14px', borderRadius: '10px', border: 'none',
    background: '#6366f1', color: 'white', fontSize: '16px',
    fontWeight: 'bold', cursor: 'pointer', width: '100%', maxWidth: '320px',
  },
};
