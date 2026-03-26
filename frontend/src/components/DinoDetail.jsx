import { useState } from 'preact/hooks';
import { store } from '../store.js';
import { useStore } from '../router.jsx';
import { api } from '../api.js';
import { SPECIES } from '../data/species.js';
import { HATS, HAT_MAP } from '../data/hats.js';

const XP_PER_LEVEL = 100;
const MAX_LEVEL = 5;

function xpProgress(xp, level) {
  if (level >= MAX_LEVEL) return 100;
  const levelXp = (xp || 0) % XP_PER_LEVEL;
  return Math.min(100, Math.round((levelXp / XP_PER_LEVEL) * 100));
}

function ColorSwatch({ region, hue }) {
  return (
    <div style={styles.swatchRow}>
      <span style={styles.swatchLabel}>{region}</span>
      <div
        style={{
          ...styles.swatch,
          background: `hsl(${hue}, 70%, 50%)`,
        }}
      />
      <span style={styles.swatchHue}>{hue}</span>
    </div>
  );
}

export function DinoDetail({ species }) {
  const { player } = useStore();
  const dino = (player?.dinos || []).find(d => d.species === species);
  const speciesData = SPECIES[species] || {};

  const [renaming, setRenaming] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [showHats, setShowHats] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState('');

  if (!dino) {
    return (
      <div style={styles.center}>
        <p style={{ color: '#ef4444' }}>Dino not found.</p>
        <button onClick={() => store.navigate('/dinos')} style={styles.backBtn}>
          Back
        </button>
      </div>
    );
  }

  const hatData = dino.hat ? HAT_MAP[dino.hat] : null;
  const colors = dino.colors || {};
  const progress = xpProgress(dino.xp, dino.level);

  // Player's hat inventory (items of type "hat")
  const ownedHatIds = new Set(
    (player?.items || [])
      .filter(i => i.type === 'hat')
      .map(i => i.details?.hat_id)
      .filter(Boolean)
  );
  // Always include currently equipped hat
  if (dino.hat) ownedHatIds.add(dino.hat);

  const availableHats = HATS.filter(h => ownedHatIds.has(h.id));

  async function doAction(action) {
    setBusy(true);
    setFeedback('');
    try {
      await action();
      await store.refresh();
      setFeedback('Saved!');
      setTimeout(() => setFeedback(''), 2000);
    } catch (err) {
      setFeedback(err.message || 'Something went wrong');
    }
    setBusy(false);
  }

  function handleRenameSubmit() {
    const trimmed = nameInput.trim();
    if (!trimmed) return;
    doAction(async () => {
      await api.customizeDino(store.playerId, species, { name: trimmed });
      setRenaming(false);
      setNameInput('');
    });
  }

  function handleEquipHat(hatId) {
    doAction(async () => {
      await api.customizeDino(store.playerId, species, { hat: hatId });
      setShowHats(false);
    });
  }

  function handleSetPartner() {
    doAction(async () => {
      await api.setPartner(store.playerId, species);
    });
  }

  return (
    <div style={styles.page}>
      {/* Header */}
      <div style={styles.header}>
        <button onClick={() => store.navigate('/dinos')} style={styles.backBtn}>
          Back
        </button>
        <h2 style={styles.headerTitle}>{speciesData.name || species}</h2>
        <div style={{ width: '48px' }} />
      </div>

      {/* Dino portrait */}
      <div style={styles.portrait}>
        <span style={{ fontSize: '72px' }}>🦕</span>
        {dino.shiny && <div style={styles.shinyLabel}>✨ SHINY</div>}
        {dino.is_partner && <div style={styles.partnerLabel}>Plaza Partner</div>}
      </div>

      {/* Name */}
      <div style={styles.section}>
        <div style={styles.dinoName}>{dino.name || <em style={{ color: '#666' }}>Unnamed</em>}</div>
        <div style={styles.meta}>{dino.gender} · {dino.nature}</div>
      </div>

      {/* Flavor text */}
      {speciesData.flavor && (
        <div style={styles.flavor}>"{speciesData.flavor}"</div>
      )}

      {/* Level / XP */}
      <div style={styles.card}>
        <div style={styles.statRow}>
          <span style={styles.statLabel}>Level</span>
          <span style={styles.statValue}>{dino.level || 1}{dino.level >= MAX_LEVEL ? ' (MAX)' : ''}</span>
        </div>
        <div style={styles.xpBarBg}>
          <div style={{ ...styles.xpBarFill, width: `${progress}%` }} />
        </div>
        <div style={styles.xpText}>{dino.xp || 0} XP</div>
      </div>

      {/* Hat */}
      <div style={styles.card}>
        <div style={styles.statRow}>
          <span style={styles.statLabel}>Hat</span>
          <span style={styles.statValue}>{hatData ? hatData.name : 'None'}</span>
        </div>
      </div>

      {/* Colors */}
      {Object.keys(colors).length > 0 && (
        <div style={styles.card}>
          <div style={styles.sectionTitle}>Colors</div>
          {Object.entries(colors).map(([region, hue]) => (
            <ColorSwatch key={region} region={region} hue={hue} />
          ))}
        </div>
      )}

      {/* Feedback message */}
      {feedback && (
        <div style={{
          ...styles.feedback,
          color: feedback === 'Saved!' ? '#4ade80' : '#ef4444',
        }}>
          {feedback}
        </div>
      )}

      {/* Rename flow */}
      {renaming ? (
        <div style={styles.card}>
          <input
            type="text"
            placeholder="New name..."
            value={nameInput}
            onInput={e => setNameInput(e.target.value)}
            maxLength={16}
            style={styles.input}
            autoFocus
          />
          <div style={styles.btnRow}>
            <button
              onClick={handleRenameSubmit}
              disabled={busy || !nameInput.trim()}
              style={{ ...styles.btn, opacity: nameInput.trim() ? 1 : 0.5 }}
            >
              {busy ? '...' : 'Save Name'}
            </button>
            <button onClick={() => { setRenaming(false); setNameInput(''); }} style={styles.ghostBtn}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button onClick={() => { setRenaming(true); setNameInput(dino.name || ''); }} style={styles.btn} disabled={busy}>
          Rename
        </button>
      )}

      {/* Hat picker flow */}
      {showHats ? (
        <div style={styles.card}>
          <div style={styles.sectionTitle}>Choose a Hat</div>
          {availableHats.length === 0 ? (
            <p style={{ color: '#666', fontSize: '13px' }}>No hats in inventory.</p>
          ) : (
            availableHats.map(hat => (
              <button
                key={hat.id}
                onClick={() => handleEquipHat(hat.id)}
                disabled={busy}
                style={{
                  ...styles.hatOption,
                  borderColor: dino.hat === hat.id ? '#4ade80' : '#333',
                }}
              >
                <span>🎩</span>
                <span style={{ flex: 1 }}>{hat.name}</span>
                <span style={{ fontSize: '11px', color: '#888' }}>{hat.rarity}</span>
                {dino.hat === hat.id && <span style={{ color: '#4ade80', fontSize: '12px' }}>Equipped</span>}
              </button>
            ))
          )}
          <button onClick={() => setShowHats(false)} style={styles.ghostBtn}>Cancel</button>
        </div>
      ) : (
        <button onClick={() => setShowHats(true)} style={styles.btn} disabled={busy}>
          Change Hat
        </button>
      )}

      {/* Set Partner */}
      {dino.tamed && !dino.is_partner && (
        <button onClick={handleSetPartner} style={{ ...styles.btn, background: '#166534', color: '#4ade80' }} disabled={busy}>
          {busy ? '...' : 'Set as Partner'}
        </button>
      )}
      {dino.is_partner && (
        <div style={styles.partnerNote}>This dino is your Plaza partner!</div>
      )}

      {/* Untamed notice */}
      {!dino.tamed && (
        <div style={styles.untamedNote}>
          <span style={{ fontSize: '20px' }}>🍖</span>
          <span>Find the food QR to tame this dino!</span>
        </div>
      )}
    </div>
  );
}

const styles = {
  page: { display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px 16px 80px' },
  center: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '70dvh', gap: '16px' },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' },
  headerTitle: { fontSize: '18px', margin: 0, color: '#e0e0e0' },
  backBtn: {
    background: 'none', border: '1px solid #333', borderRadius: '8px',
    color: '#aaa', padding: '6px 12px', cursor: 'pointer', fontSize: '14px',
  },
  portrait: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px',
    background: '#1a2e1a', borderRadius: '16px', padding: '24px',
  },
  shinyLabel: { color: '#f59e0b', fontSize: '13px', fontWeight: 'bold' },
  partnerLabel: {
    fontSize: '12px', background: '#166534', color: '#4ade80',
    borderRadius: '6px', padding: '3px 10px', fontWeight: 'bold',
  },
  section: { textAlign: 'center' },
  dinoName: { fontSize: '22px', fontWeight: 'bold', color: '#e0e0e0' },
  meta: { fontSize: '13px', color: '#888', marginTop: '4px' },
  flavor: {
    color: '#a78bfa', fontSize: '13px', fontStyle: 'italic',
    textAlign: 'center', padding: '0 8px',
  },
  card: {
    background: '#16213e', borderRadius: '12px', padding: '14px',
    display: 'flex', flexDirection: 'column', gap: '8px',
  },
  sectionTitle: { fontSize: '13px', color: '#888', fontWeight: 'bold', textTransform: 'uppercase' },
  statRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  statLabel: { fontSize: '13px', color: '#888' },
  statValue: { fontSize: '14px', color: '#e0e0e0', fontWeight: 'bold' },
  xpBarBg: { height: '6px', background: '#2a2a3e', borderRadius: '3px', overflow: 'hidden' },
  xpBarFill: { height: '100%', background: '#4ade80', borderRadius: '3px' },
  xpText: { fontSize: '11px', color: '#666', textAlign: 'right' },
  swatchRow: { display: 'flex', alignItems: 'center', gap: '10px' },
  swatchLabel: { fontSize: '12px', color: '#888', width: '60px', textTransform: 'capitalize' },
  swatch: { width: '28px', height: '28px', borderRadius: '6px', flexShrink: 0 },
  swatchHue: { fontSize: '11px', color: '#555' },
  feedback: { textAlign: 'center', fontSize: '14px', fontWeight: 'bold' },
  input: {
    padding: '12px', borderRadius: '8px', border: '1px solid #333',
    background: '#0d1117', color: '#e0e0e0', fontSize: '15px',
    outline: 'none', width: '100%',
  },
  btnRow: { display: 'flex', gap: '8px' },
  btn: {
    padding: '14px', borderRadius: '10px', border: 'none',
    background: '#6366f1', color: 'white', fontSize: '15px',
    fontWeight: 'bold', cursor: 'pointer', width: '100%',
  },
  ghostBtn: {
    padding: '12px', borderRadius: '10px', border: '1px solid #333',
    background: 'none', color: '#aaa', fontSize: '14px',
    cursor: 'pointer', width: '100%',
  },
  hatOption: {
    display: 'flex', alignItems: 'center', gap: '10px',
    padding: '12px', borderRadius: '8px', border: '2px solid #333',
    background: '#0d1117', color: '#e0e0e0', fontSize: '14px',
    cursor: 'pointer', width: '100%',
  },
  partnerNote: { textAlign: 'center', color: '#4ade80', fontSize: '13px' },
  untamedNote: {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
    background: '#1a1a2e', borderRadius: '10px', padding: '14px',
    color: '#f59e0b', fontSize: '14px',
  },
};
