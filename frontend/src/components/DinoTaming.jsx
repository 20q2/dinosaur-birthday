import { useState, useEffect } from 'preact/hooks';
import { store } from '../store.js';
import { api } from '../api.js';
import { SPECIES } from '../data/species.js';
import { STARTER_HATS } from '../data/hats.js';
import { DinoSprite } from './DinoSprite.jsx';
import meatImg from '../assets/items/meat.png';
import berryImg from '../assets/items/berry.png';

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

  if (loading) return <div style={styles.loadingPage}><p>Feeding...</p></div>;

  // Choose which dino to feed
  if (untamed.length > 0 && !tamed) {
    return (
      <div style={styles.page}>
        <h2 style={styles.pageTitle}>Which dino should eat?</h2>
        <p style={styles.pageSub}>You have multiple untamed {foodType === 'meat' ? 'carnivores' : 'herbivores'}</p>
        <div style={styles.choiceList}>
          {untamed.map(sp => (
            <button key={sp} onClick={() => handleChooseSpecies(sp)} style={styles.choiceBtn}>
              <DinoSprite species={sp} colors={{}} scale={1} />
              <span>{SPECIES[sp]?.name || sp}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Name and hat selection
  if (tamed) {
    const speciesData = SPECIES[selectedSpecies];
    return (
      <div style={styles.page}>
        <div style={styles.banner}>TAMING TIME</div>

        <div style={styles.spriteArea}>
          <DinoSprite species={selectedSpecies} colors={{}} scale={4} />
        </div>

        <h2 style={styles.dinoName}>{speciesData?.name}</h2>
        <div style={styles.munchLabel}>
          <img src={foodType === 'meat' ? meatImg : berryImg} style={styles.munchFoodImg} />
          {' '}Munching on {foodType === 'meat' ? 'Meat' : 'Mejoberries'}...
        </div>

        <div style={styles.card}>
          <input
            type="text"
            placeholder="Name your dino!"
            value={name}
            onInput={(e) => setName(e.target.value)}
            maxLength={16}
            style={styles.input}
            autoFocus
          />

          <div style={styles.hatSection}>
            <div style={styles.hatLabel}>Pick a starter hat:</div>
            <div style={styles.hatRow}>
              {STARTER_HATS.map(hat => (
                <button
                  key={hat.id}
                  onClick={() => setSelectedHat(hat.id)}
                  style={{
                    ...styles.hatBtn,
                    borderColor: selectedHat === hat.id ? '#4ade80' : '#333',
                    background: selectedHat === hat.id ? '#0f2a1a' : '#1a1a2e',
                  }}
                  title={hat.name}
                >
                  <span style={{ fontSize: '22px' }}>🎩</span>
                  <span style={styles.hatName}>{hat.name}</span>
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleFinish}
            disabled={!name.trim()}
            style={{ ...styles.mainBtn, opacity: name.trim() ? 1 : 0.5 }}
          >
            WELCOME HOME!
          </button>
        </div>
      </div>
    );
  }

  return null;
}

const styles = {
  loadingPage: {
    display: 'flex', alignItems: 'center', justifyContent: 'center', height: '80dvh',
  },
  page: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    padding: '24px 16px 80px', gap: '12px',
  },
  pageTitle: { margin: 0, fontSize: '20px', color: '#e0e0e0' },
  pageSub: { color: '#888', fontSize: '13px', margin: 0 },
  banner: {
    color: '#f59e0b', fontSize: '13px', fontWeight: '900',
    letterSpacing: '3px', textAlign: 'center',
  },
  spriteArea: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '16px',
  },
  dinoName: {
    margin: 0, fontSize: '24px', fontWeight: 'bold', color: '#e0e0e0',
    textAlign: 'center',
  },
  munchLabel: {
    color: '#4ade80', fontSize: '14px', textAlign: 'center',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
  },
  munchFoodImg: { width: '20px', height: '20px', imageRendering: 'pixelated' },
  card: {
    width: '100%', maxWidth: '340px',
    display: 'flex', flexDirection: 'column', gap: '16px',
    marginTop: '4px',
  },
  input: {
    padding: '14px', borderRadius: '10px', border: '1.5px solid #333',
    background: '#1a1a2e', color: '#e0e0e0', fontSize: '16px',
    outline: 'none', textAlign: 'center', width: '100%',
  },
  hatSection: {
    display: 'flex', flexDirection: 'column', gap: '8px',
  },
  hatLabel: { color: '#888', fontSize: '12px', textAlign: 'center' },
  hatRow: {
    display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px',
  },
  hatBtn: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
    padding: '10px 4px', borderRadius: '10px',
    border: '2px solid #333', cursor: 'pointer',
  },
  hatName: {
    fontSize: '10px', color: '#aaa', lineHeight: 1.2, textAlign: 'center',
  },
  mainBtn: {
    padding: '16px', borderRadius: '12px', border: 'none',
    background: '#22c55e', color: 'white', fontSize: '16px',
    fontWeight: 'bold', cursor: 'pointer', width: '100%',
    letterSpacing: '1px',
  },
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
