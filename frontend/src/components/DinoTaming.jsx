import { useState, useEffect } from 'preact/hooks';
import { store } from '../store.js';
import { api } from '../api.js';
import { SPECIES } from '../data/species.js';
import { STARTER_HATS } from '../data/hats.js';

export function DinoTaming({ foodType }) {
  const [untamed, setUntamed] = useState([]);
  const [selectedSpecies, setSelectedSpecies] = useState(null);
  const [tamed, setTamed] = useState(false);
  const [name, setName] = useState('');
  const [selectedHat, setSelectedHat] = useState(STARTER_HATS[0]?.id || '');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const result = await api.scanFood(store.playerId, foodType, null);
        if (result.choose_species) {
          setUntamed(result.untamed);
        } else if (result.tamed) {
          setTamed(true);
          setSelectedSpecies(result.species);
        } else if (result.already_tamed) {
          store.navigate('/dinos');
        }
      } catch (err) {
        // No untamed dinos of this type
        store.navigate('/plaza');
      }
      setLoading(false);
    })();
  }, [foodType]);

  const handleChooseSpecies = async (species) => {
    setLoading(true);
    const result = await api.scanFood(store.playerId, foodType, species);
    if (result.tamed) {
      setTamed(true);
      setSelectedSpecies(species);
    }
    setLoading(false);
  };

  const handleFinish = async () => {
    if (!name.trim()) return;
    await api.customizeDino(store.playerId, selectedSpecies, {
      name: name.trim(),
      hat: selectedHat,
    });
    await store.refresh();
    store.navigate('/dinos');
  };

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '80dvh' }}><p>Feeding...</p></div>;

  // Choose which dino to feed
  if (untamed.length > 0 && !tamed) {
    return (
      <div style={{ padding: '24px', textAlign: 'center' }}>
        <h2>Which dino should eat?</h2>
        <p style={{ color: '#888', marginBottom: '16px' }}>You have multiple untamed {foodType === 'meat' ? 'carnivores' : 'herbivores'}</p>
        {untamed.map(sp => (
          <button key={sp} onClick={() => handleChooseSpecies(sp)} style={styles.choiceBtn}>
            {SPECIES[sp]?.name || sp}
          </button>
        ))}
      </div>
    );
  }

  // Name and hat selection
  if (tamed) {
    const speciesData = SPECIES[selectedSpecies];
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px', gap: '12px' }}>
        <div style={{ color: '#22c55e', fontSize: '14px' }}>✨ TAMING TIME ✨</div>
        <div style={styles.dinoBox}><span style={{ fontSize: '64px' }}>🦕</span></div>
        <h2>{speciesData?.name}</h2>
        <div style={{ color: '#22c55e' }}>❤️ Munching on {foodType === 'meat' ? 'Meat' : 'Mejoberries'}...</div>

        <input
          type="text"
          placeholder="Name your dino!"
          value={name}
          onInput={(e) => setName(e.target.value)}
          maxLength={16}
          style={styles.input}
          autoFocus
        />

        <div style={{ color: '#888', fontSize: '12px' }}>Pick a starter hat:</div>
        <div style={{ display: 'flex', gap: '10px' }}>
          {STARTER_HATS.map(hat => (
            <button
              key={hat.id}
              onClick={() => setSelectedHat(hat.id)}
              style={{
                ...styles.hatBtn,
                borderColor: selectedHat === hat.id ? '#4ade80' : '#333',
              }}
              title={hat.name}
            >
              🎩
            </button>
          ))}
        </div>

        <button
          onClick={handleFinish}
          disabled={!name.trim()}
          style={{ ...styles.mainBtn, opacity: name.trim() ? 1 : 0.5 }}
        >
          WELCOME HOME!
        </button>
      </div>
    );
  }

  return null;
}

const styles = {
  dinoBox: {
    width: '120px', height: '120px', background: '#1a2e1a', borderRadius: '16px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  input: {
    padding: '14px', borderRadius: '8px', border: '1px solid #333',
    background: '#1a1a2e', color: '#e0e0e0', fontSize: '16px',
    outline: 'none', textAlign: 'center', width: '100%', maxWidth: '280px',
  },
  hatBtn: {
    width: '48px', height: '48px', background: '#333', borderRadius: '8px',
    border: '2px solid #333', fontSize: '22px', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  mainBtn: {
    padding: '14px', borderRadius: '8px', border: 'none',
    background: '#22c55e', color: 'white', fontSize: '16px',
    fontWeight: 'bold', cursor: 'pointer', width: '100%', maxWidth: '280px',
  },
  choiceBtn: {
    display: 'block', width: '100%', maxWidth: '280px', margin: '8px auto',
    padding: '14px', borderRadius: '8px', border: 'none',
    background: '#1a1a2e', color: '#e0e0e0', fontSize: '16px', cursor: 'pointer',
  },
};
