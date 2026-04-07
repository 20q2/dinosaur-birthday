import { useState, useEffect } from 'preact/hooks';
import { store } from '../store.js';
import { api } from '../api.js';
import { DinoTaming } from './DinoTaming.jsx';
import { HarvestMinigame } from './HarvestMinigame.jsx';
import { TamingRunner } from './TamingRunner.jsx';

export function FoodHarvest({ foodType }) {
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [phase, setPhase] = useState('minigame'); // 'minigame' | 'runner' | 'taming'
  const [runnerSpecies, setRunnerSpecies] = useState(null);
  const [runnerColors, setRunnerColors] = useState(null);

  async function handleGameEnd(perfects, goods) {
    try {
      const data = await api.scanFood(store.playerId, foodType, null, perfects, goods);
      setResult(data);
      await store.refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  // Resolve which species/colors to use for the runner
  function resolveRunnerDino() {
    const player = store.player;
    if (!player || !result) return null;

    let species = null;
    if (result.tamed && result.species) {
      // Auto-tamed single dino
      species = result.species;
    } else if (result.choose_species && result.untamed?.length > 0) {
      // Multiple untamed — use first for the runner visual
      species = result.untamed[0];
    }

    if (!species) return null;

    const dino = player.dinos?.find(d => d.species === species);
    return { species, colors: dino?.colors || {} };
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

  if (phase === 'runner') {
    return (
      <TamingRunner
        species={runnerSpecies}
        colors={runnerColors}
        foodType={foodType}
        onComplete={(score) => setPhase('taming')}
      />
    );
  }

  const canTame = result && !result.harvest_only && !result.already_tamed;

  function handleComplete() {
    if (canTame) {
      // Resolve dino for runner
      const dino = resolveRunnerDino();
      if (dino) {
        setRunnerSpecies(dino.species);
        setRunnerColors(dino.colors);
        setPhase('runner');
      } else {
        // Fallback: skip runner if we can't resolve a dino
        setPhase('taming');
      }
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
