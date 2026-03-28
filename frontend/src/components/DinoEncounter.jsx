import { useState, useEffect } from 'preact/hooks';
import { store } from '../store.js';
import { api } from '../api.js';
import { SPECIES } from '../data/species.js';
import { DinoSprite } from './DinoSprite.jsx';
import { DinoTaming } from './DinoTaming.jsx';
import meatImg from '../assets/items/meat.png';
import berryImg from '../assets/items/berry.png';

export function DinoEncounter({ species }) {
  const [dino, setDino] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showReveal, setShowReveal] = useState(true);
  const [phase, setPhase] = useState('encounter'); // 'encounter' | 'taming'
  const [tamingResult, setTamingResult] = useState(null);

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

  // Brief reveal animation
  useEffect(() => {
    if (dino && !dino.already_owned) {
      const t = setTimeout(() => setShowReveal(false), 600);
      return () => clearTimeout(t);
    }
  }, [dino]);

  if (loading) {
    return (
      <div style={styles.center}>
        <div style={styles.scanPulse}>Scanning...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.center}>
        <p style={{ color: '#ef4444', fontSize: '16px' }}>{error}</p>
        <button onClick={() => store.navigate('/plaza')} style={styles.backBtn}>Back to Plaza</button>
      </div>
    );
  }

  if (dino.already_owned) {
    const speciesData = SPECIES[species];
    return (
      <div style={styles.center}>
        <div style={styles.spriteArea}>
          <DinoSprite species={species} colors={{}} scale={3} />
        </div>
        <p style={{ color: '#86efac', fontSize: '16px', margin: '0' }}>
          You already have a {speciesData?.name || species}!
        </p>
        {dino.tamed && (
          <p style={{ color: '#6b7280', fontSize: '13px', margin: '4px 0 0' }}>
            Already tamed and in your collection.
          </p>
        )}
        <button onClick={() => store.navigate('/dinos')} style={styles.primaryBtn}>View My Dinos</button>
        <button onClick={() => store.navigate('/plaza')} style={styles.backBtn}>Back to Plaza</button>
      </div>
    );
  }

  const handleFeedNow = async () => {
    setLoading(true);
    try {
      const foodType = SPECIES[species]?.food;
      const result = await api.scanFood(store.playerId, foodType, species);
      await store.refresh();
      setTamingResult(result);
      setPhase('taming');
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  // Phase 2: taming (name + hat selection)
  if (phase === 'taming') {
    const foodType = SPECIES[species]?.food;
    return <DinoTaming foodType={foodType} prefetchedResult={tamingResult} />;
  }

  const speciesData = SPECIES[species];
  const isCarnivore = dino.diet === 'carnivore';

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.encounterBanner}>
        <div style={styles.encounterLabel}>DINO DISCOVERED!</div>
      </div>

      {/* Sprite showcase */}
      <div style={{
        ...styles.spriteShowcase,
        opacity: showReveal ? 0 : 1,
        transform: showReveal ? 'scale(0.8)' : 'scale(1)',
        transition: 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
      }}>
        <div style={styles.spriteGlow} />
        <DinoSprite species={species} colors={dino.colors || {}} scale={4} style={{ marginTop: '-5px' }} />
      </div>

      {/* Name + gender icon */}
      <div style={styles.nameSection}>
        <h2 style={styles.dinoName}>{speciesData?.name || species}</h2>
        <span style={styles.genderIcon}>{dino.gender === 'male' ? '♂' : '♀'}</span>
      </div>

      {/* Shiny callout */}
      {dino.shiny && (
        <div style={styles.shinyCallout}>
          <span style={styles.shinyStars}>✨</span>
          <span style={styles.shinyText}>It's Shiny!</span>
          <span style={styles.shinyStars}>✨</span>
        </div>
      )}

      <div style={styles.tagRow}>
        <span style={{
          ...styles.dietTag,
          background: isCarnivore ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.15)',
          color: isCarnivore ? '#fca5a5' : '#86efac',
          borderColor: isCarnivore ? 'rgba(239,68,68,0.3)' : 'rgba(34,197,94,0.3)',
        }}>
          <img src={isCarnivore ? meatImg : berryImg} style={styles.foodIcon} />
          {isCarnivore ? ' Carnivore' : ' Herbivore'}
        </span>
      </div>

      {/* Feed now — player already has food */}
      {dino.has_food ? (
        <>
          <div style={{
            ...styles.questCard,
            borderColor: isCarnivore ? 'rgba(239,68,68,0.3)' : 'rgba(34,197,94,0.3)',
          }}>
            <div style={styles.questHeader}>
              <img src={isCarnivore ? meatImg : berryImg} style={styles.questFoodImg} />
              <span style={styles.questTitle}>You have {isCarnivore ? 'Meat' : 'Mejoberries'}!</span>
            </div>
            <p style={styles.questDesc}>
              You already have the food this dino needs. Feed it now to tame it!
            </p>
          </div>
          <button onClick={handleFeedNow} style={styles.primaryBtn}>
            <img src={isCarnivore ? meatImg : berryImg} style={{ width: '20px', height: '20px', imageRendering: 'pixelated', verticalAlign: 'middle', marginRight: '8px' }} />
            Feed Now!
          </button>
        </>
      ) : (
        <div style={{
          ...styles.questCard,
          borderColor: isCarnivore ? 'rgba(239,68,68,0.3)' : 'rgba(34,197,94,0.3)',
        }}>
          <div style={styles.questHeader}>
            <img src={isCarnivore ? meatImg : berryImg} style={styles.questFoodImg} />
            <span style={styles.questTitle}>Find Food to Tame!</span>
          </div>
          <p style={styles.questDesc}>
            {isCarnivore
              ? 'This dino eats Meat. Look for the Meat QR code near the grill!'
              : 'This dino eats Mejoberries. Look for the Mejoberry QR code near the veggie platters!'}
          </p>
        </div>
      )}

      {/* Hint */}
      <p style={styles.hintText}>You can revisit this dino from your "My Dinos" tab.</p>

      {/* Actions */}
      <button onClick={() => store.navigate('/plaza')} style={styles.backBtn}>
        Back to Plaza
      </button>
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
    padding: '24px 20px 80px', gap: '8px', minHeight: '100dvh',
    background: 'linear-gradient(180deg, #0f1a0f 0%, #111 40%)',
  },

  // Header
  encounterBanner: {
    padding: '8px 24px',
    borderRadius: '20px',
    background: 'rgba(245,158,11,0.1)',
    border: '1px solid rgba(245,158,11,0.25)',
  },
  encounterLabel: {
    fontSize: '13px', fontWeight: '800', letterSpacing: '3px',
    color: '#f59e0b', textTransform: 'uppercase',
  },

  // Sprite
  spriteShowcase: {
    position: 'relative',
    width: '180px', height: '180px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    margin: '-16px 0 12px',
    overflow: 'visible',
  },
  spriteGlow: {
    position: 'absolute', inset: '-20px',
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(74,222,128,0.12) 0%, transparent 70%)',
    pointerEvents: 'none',
  },
  spriteArea: {
    width: '120px', height: '120px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },

  // Name
  nameSection: {
    display: 'flex', alignItems: 'center', gap: '8px',
    justifyContent: 'center', flexWrap: 'wrap',
    maxWidth: '320px',
  },
  dinoName: {
    margin: 0, fontSize: '24px', fontWeight: '800', color: '#f0fdf4',
    textAlign: 'center', wordBreak: 'break-word',
  },
  genderIcon: {
    fontSize: '22px', color: '#9ca3af', fontWeight: '600',
  },
  shinyCallout: {
    display: 'flex', alignItems: 'center', gap: '8px',
    padding: '6px 18px', borderRadius: '14px',
    background: 'linear-gradient(135deg, rgba(245,158,11,0.15), rgba(234,179,8,0.1))',
    border: '1px solid rgba(245,158,11,0.3)',
  },
  shinyText: {
    fontSize: '16px', fontWeight: '800', color: '#fbbf24',
    letterSpacing: '0.5px',
  },
  shinyStars: { fontSize: '16px' },

  // Tags
  tagRow: {
    display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center',
  },
  dietTag: {
    padding: '4px 12px', borderRadius: '12px',
    fontSize: '13px', fontWeight: '600',
    border: '1px solid',
  },
  traitTag: {
    padding: '4px 10px', borderRadius: '12px',
    fontSize: '12px', color: '#9ca3af',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.08)',
  },

  // Quest card
  questCard: {
    width: '100%', maxWidth: '320px',
    padding: '16px', borderRadius: '14px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid',
    marginTop: '2px',
  },
  questHeader: {
    display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px',
  },
  foodIcon: { width: '16px', height: '16px', verticalAlign: 'middle', imageRendering: 'pixelated' },
  questFoodImg: { width: '24px', height: '24px', imageRendering: 'pixelated' },
  questTitle: {
    fontSize: '15px', fontWeight: '700', color: '#e5e7eb',
  },
  questDesc: {
    margin: 0, fontSize: '13px', color: '#9ca3af', lineHeight: '1.5',
  },

  hintText: {
    margin: 0, fontSize: '12px', color: '#6b7280', fontStyle: 'italic',
    textAlign: 'center',
  },

  // Buttons
  primaryBtn: {
    padding: '14px', borderRadius: '10px', border: 'none',
    background: '#4ade80', color: '#14532d', fontSize: '15px',
    fontWeight: '700', cursor: 'pointer', width: '100%', maxWidth: '320px',
  },
  backBtn: {
    padding: '12px', borderRadius: '10px',
    background: 'transparent', color: '#6b7280',
    border: '1px solid rgba(255,255,255,0.1)',
    fontSize: '14px', fontWeight: '600', cursor: 'pointer',
    width: '100%', maxWidth: '320px',
  },
  scanPulse: {
    color: '#4ade80', fontSize: '16px', fontWeight: '600',
  },
};
