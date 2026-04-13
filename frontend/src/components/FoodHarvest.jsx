import { useState, useEffect } from 'preact/hooks';
import { store } from '../store.js';
import { api } from '../api.js';
import { SPECIES } from '../data/species.js';
import { DinoSprite } from './DinoSprite.jsx';
import { DinoTaming } from './DinoTaming.jsx';
import { HarvestMinigame } from './HarvestMinigame.jsx';
import { TamingRunner } from './TamingRunner.jsx';

export function FoodHarvest({ foodType }) {
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  // 'minigame' | 'picker' | 'runner' | 'taming'
  const [phase, setPhase] = useState('minigame');
  const [runnerSpecies, setRunnerSpecies] = useState(null);
  const [runnerColors, setRunnerColors] = useState(null);
  const [tamedResult, setTamedResult] = useState(null);
  const [pickerBusy, setPickerBusy] = useState(false);

  async function handleGameEnd(perfects, goods) {
    try {
      const data = await api.scanFood(store.playerId, foodType, null, perfects, goods);
      setResult(data);
      await store.refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  function goToRunnerForSpecies(species, tamedData) {
    const player = store.player;
    const dino = player?.dinos?.find(d => d.species === species);
    setRunnerSpecies(species);
    setRunnerColors(dino?.colors || {});
    setTamedResult(tamedData);
    setPhase('runner');
  }

  async function handlePickSpecies(species) {
    if (pickerBusy) return;
    // If this species was already tamed by the initial scan_food call (single-untamed
    // auto-tame path), skip the extra API hit.
    if (result?.tamed && result.species === species) {
      goToRunnerForSpecies(species, result);
      return;
    }
    setPickerBusy(true);
    try {
      const tamedData = await api.scanFood(store.playerId, foodType, species);
      await store.refresh();
      goToRunnerForSpecies(species, tamedData);
    } catch (err) {
      setError(err.message);
      setPickerBusy(false);
    }
  }

  function handleComplete() {
    // From the minigame results screen.
    if (!result) {
      store.navigate('/plaza');
      return;
    }
    // Always show the picker before the runner, even for a single untamed dino.
    if (result.choose_species && result.untamed?.length > 0) {
      setPhase('picker');
      return;
    }
    if (result.tamed && result.species) {
      // Backend auto-tamed (only one untamed dino existed). Show a single-option
      // picker anyway so the player sees who they're feeding before the runner.
      setPhase('picker');
      return;
    }
    // harvest_only / already_tamed → back to plaza.
    store.navigate('/plaza');
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
    return <DinoTaming foodType={foodType} prefetchedResult={tamedResult || result} />;
  }

  if (phase === 'runner') {
    return (
      <TamingRunner
        species={runnerSpecies}
        colors={runnerColors}
        foodType={foodType}
        onComplete={() => setPhase('taming')}
      />
    );
  }

  if (phase === 'picker') {
    // Options come from either the "multiple untamed" response OR a single
    // auto-tamed dino from the initial scan.
    const options = result.untamed?.length > 0
      ? result.untamed
      : (result.species ? [result.species] : []);
    return (
      <div style={styles.page}>
        <h2 style={styles.pageTitle}>Which dino should eat?</h2>
        <p style={styles.pageSub}>
          {options.length > 1
            ? `You have multiple untamed ${foodType === 'meat' ? 'carnivores' : 'herbivores'}`
            : 'Tap to feed them'}
        </p>
        <div style={styles.choiceList}>
          {options.map(sp => {
            const player = store.player;
            const dino = player?.dinos?.find(d => d.species === sp);
            return (
              <button
                key={sp}
                onClick={() => handlePickSpecies(sp)}
                style={styles.choiceBtn}
                disabled={pickerBusy}
              >
                <DinoSprite species={sp} colors={dino?.colors || {}} scale={1} />
                <span>{SPECIES[sp]?.name || sp}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
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
  page: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    padding: '24px 16px 80px', gap: '12px',
  },
  pageTitle: { margin: 0, fontSize: '20px', color: '#e0e0e0' },
  pageSub: { color: '#888', fontSize: '13px', margin: 0 },
  choiceList: {
    display: 'flex', flexDirection: 'column', gap: '8px',
    width: '100%', maxWidth: '300px', marginTop: '8px',
  },
  choiceBtn: {
    display: 'flex', alignItems: 'center', gap: '12px',
    width: '100%', padding: '14px',
    borderRadius: '10px', border: '2px solid #2a2a3e',
    background: '#1a1a2e', color: '#e0e0e0', fontSize: '16px',
    cursor: 'pointer', textAlign: 'left',
  },
};
