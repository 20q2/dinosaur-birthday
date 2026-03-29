import { useState, useEffect } from 'preact/hooks';
import { store } from '../store.js';
import { Crown } from 'lucide-preact';
import { useStore } from '../router.jsx';
import { api } from '../api.js';
import { SPECIES } from '../data/species.js';
import { HAT_MAP } from '../data/hats.js';
import { DinoSprite } from './DinoSprite.jsx';
import { getHatImage } from '../data/hatImages.js';
import { getQuirk } from '../data/natureQuirks.js';
import meatImg from '../assets/items/meat.png';
import berryImg from '../assets/items/berry.png';

export function DinoTaming({ foodType, prefetchedResult }) {
  const { player } = useStore();
  const [untamed, setUntamed] = useState([]);
  const [selectedSpecies, setSelectedSpecies] = useState(null);
  const [tamed, setTamed] = useState(false);
  const [name, setName] = useState('');
  const [selectedHat, setSelectedHat] = useState('');
  const [loading, setLoading] = useState(!prefetchedResult);
  const [firstPartner, setFirstPartner] = useState(false);

  useEffect(() => {
    // If we got pre-fetched data from FoodHarvest, use it directly
    if (prefetchedResult) {
      if (prefetchedResult.choose_species) {
        setUntamed(prefetchedResult.untamed);
      } else if (prefetchedResult.tamed) {
        setTamed(true);
        setSelectedSpecies(prefetchedResult.species);
        if (prefetchedResult.first_partner) setFirstPartner(true);
      } else if (prefetchedResult.already_tamed) {
        store.navigate('/dinos');
      }
      return;
    }
    (async () => {
      try {
        const result = await api.scanFood(store.playerId, foodType, null);
        if (result.choose_species) {
          setUntamed(result.untamed);
        } else if (result.tamed) {
          setTamed(true);
          setSelectedSpecies(result.species);
          if (result.first_partner) setFirstPartner(true);
        } else if (result.already_tamed) {
          store.navigate('/dinos');
        }
      } catch (err) {
        store.navigate('/plaza');
      }
      setLoading(false);
    })();
  }, [foodType]);

  // No auto-select — default is None

  const handleChooseSpecies = async (species) => {
    setLoading(true);
    const result = await api.scanFood(store.playerId, foodType, species);
    if (result.tamed) {
      setTamed(true);
      setSelectedSpecies(species);
      if (result.first_partner) setFirstPartner(true);
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
    const dino = player?.dinos?.find(d => d.species === selectedSpecies);
    const dinoColors = dino?.colors || {};

    // Deduplicate owned hats from inventory
    const ownedHatIds = new Set();
    (player?.items || []).forEach(i => {
      if (i.type === 'hat' && i.details?.hat_id) ownedHatIds.add(i.details.hat_id);
    });
    const ownedHats = [...ownedHatIds].map(id => HAT_MAP[id]).filter(Boolean);

    return (
      <div style={styles.page}>
        <style>{`
          @keyframes dino-wobble {
            0% { transform: rotate(-2deg); }
            50% { transform: rotate(2deg); }
            100% { transform: rotate(-2deg); }
          }
        `}</style>
        <div style={styles.banner}>TAMING TIME</div>

        <div style={styles.spriteArea}>
          <div style={styles.spriteGlow} />
          <DinoSprite
            species={selectedSpecies}
            colors={dinoColors}
            scale={4}
            hat={selectedHat || null}
            style={{ animation: 'dino-wobble 3s ease-in-out infinite', transformOrigin: 'center bottom' }}
          />
        </div>

        <h2 style={styles.dinoName}>{speciesData?.name} {dino?.gender === 'male' ? '\u2642' : '\u2640'}</h2>
        <div style={styles.munchLabel}>
          <img src={foodType === 'meat' ? meatImg : berryImg} style={styles.munchFoodImg} />
          {' '}Munching on {foodType === 'meat' ? 'Meat' : 'Mejoberries'}...
        </div>
        {firstPartner && (
          <div style={styles.partnerBadge}>
            Your first partner! This dino will represent you on the Plaza.
          </div>
        )}
        {dino?.nature && (
          <div style={{ color: '#9ca3af', fontSize: '13px', textAlign: 'center' }}>Nature: {dino.nature}</div>
        )}

        {speciesData?.flavor && (
          <p style={styles.flavorText}>"{speciesData.flavor}{dino?.nature ? ` ${getQuirk(dino.nature, selectedSpecies)}` : ''}"</p>
        )}

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

          {ownedHats.length > 0 && (
            <div style={styles.hatSection}>
              <div style={styles.hatLabel}>Pick a hat:</div>
              <div style={styles.hatRow}>
                <button
                  onClick={() => setSelectedHat('')}
                  style={{
                    ...styles.hatBtn,
                    borderColor: selectedHat === '' ? '#4ade80' : '#333',
                    background: selectedHat === '' ? '#0f2a1a' : '#1a1a2e',
                  }}
                >
                  <span style={{ fontSize: '18px', color: '#666' }}>-</span>
                  <span style={styles.hatName}>None</span>
                </button>
                {ownedHats.map(hat => {
                  const hatImg = getHatImage(hat.id);
                  return (
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
                      {hatImg && hatImg.loaded
                        ? <img src={hatImg.img.src} style={{ width: '32px', height: '32px', imageRendering: 'pixelated', objectFit: 'contain' }} />
                        : <Crown size={22} color="#aaa" />}
                      <span style={styles.hatName}>{hat.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

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
    position: 'relative',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '16px',
  },
  spriteGlow: {
    position: 'absolute', inset: '-10px',
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(74,222,128,0.18) 0%, rgba(99,102,241,0.08) 50%, transparent 75%)',
    pointerEvents: 'none',
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
  partnerBadge: {
    color: '#c084fc', fontSize: '13px', textAlign: 'center',
    background: 'rgba(139,92,246,0.1)', borderRadius: '10px',
    padding: '8px 16px', border: '1px solid rgba(139,92,246,0.25)',
    maxWidth: '320px',
  },
  flavorText: {
    margin: 0, fontSize: '13px', color: '#9ca3af', fontStyle: 'italic',
    textAlign: 'center', maxWidth: '320px', lineHeight: '1.4',
  },
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
    display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center',
  },
  hatBtn: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
    padding: '10px 8px', borderRadius: '10px',
    border: '2px solid #333', cursor: 'pointer',
    minWidth: '68px',
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
