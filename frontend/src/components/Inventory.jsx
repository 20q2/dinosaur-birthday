import { useState } from 'preact/hooks';
import { store } from '../store.js';
import { useStore } from '../router.jsx';
import { api } from '../api.js';
import { SPECIES } from '../data/species.js';
import { HATS, HAT_MAP } from '../data/hats.js';
import { DinoSprite } from './DinoSprite.jsx';

const PAINT_COLORS = [
  { name: 'Crimson', hue: 0 },
  { name: 'Scarlet', hue: 15 },
  { name: 'Rose', hue: 340 },
  { name: 'Orange', hue: 30 },
  { name: 'Amber', hue: 45 },
  { name: 'Gold', hue: 50 },
  { name: 'Forest', hue: 130 },
  { name: 'Lime', hue: 90 },
  { name: 'Emerald', hue: 155 },
  { name: 'Navy', hue: 230 },
  { name: 'Sky', hue: 200 },
  { name: 'Cyan', hue: 180 },
  { name: 'Violet', hue: 270 },
  { name: 'Plum', hue: 300 },
  { name: 'Lavender', hue: 260 },
  { name: 'White', hue: 0 },
  { name: 'Silver', hue: 210 },
  { name: 'Charcoal', hue: 0 },
];

const RARITY_COLORS = {
  common: '#9ca3af',
  uncommon: '#4ade80',
  legendary: '#f59e0b',
};

export function Inventory() {
  const { player } = useStore();
  const [modal, setModal] = useState(null); // null | { type, hatId?, step, species?, region?, hue? }
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState('');

  const dinos = player?.dinos || [];
  const tamedDinos = dinos.filter(d => d.tamed);
  const items = player?.items || [];

  // Hats: deduplicate by hat_id, count duplicates
  const hatCounts = {};
  items.filter(i => i.type === 'hat').forEach(i => {
    const id = i.details?.hat_id;
    if (id) hatCounts[id] = (hatCounts[id] || 0) + 1;
  });
  const ownedHats = Object.keys(hatCounts)
    .map(id => ({ ...HAT_MAP[id], count: hatCounts[id] }))
    .filter(h => h.id);

  const paintCount = items.filter(i => i.type === 'paint').length;

  async function doAction(action) {
    setBusy(true);
    setFeedback('');
    try {
      await action();
      await store.refresh();
      setFeedback('Applied!');
      setModal(null);
      setTimeout(() => setFeedback(''), 2000);
    } catch (err) {
      setFeedback(err.message || 'Something went wrong');
    }
    setBusy(false);
  }

  function handleHatTap(hatId) {
    if (tamedDinos.length === 0) return;
    if (tamedDinos.length === 1) {
      doAction(() => api.customizeDino(store.playerId, tamedDinos[0].species, { hat: hatId }));
    } else {
      setModal({ type: 'hat', hatId, step: 'dino' });
    }
  }

  function handleHatDinoPick(species) {
    doAction(() => api.customizeDino(store.playerId, species, { hat: modal.hatId }));
  }

  function handlePaintTap() {
    if (tamedDinos.length === 0 || paintCount === 0) return;
    if (tamedDinos.length === 1) {
      setModal({ type: 'paint', step: 'region', species: tamedDinos[0].species });
    } else {
      setModal({ type: 'paint', step: 'dino' });
    }
  }

  function handlePaintDinoPick(species) {
    setModal({ ...modal, step: 'region', species });
  }

  function handlePaintRegionPick(region) {
    setModal({ ...modal, step: 'color', region });
  }

  function handlePaintColorPick(hue) {
    doAction(() =>
      api.customizeDino(store.playerId, modal.species, {
        paint: { region: modal.region, color: hue },
      })
    );
  }

  return (
    <div style={styles.page}>
      <h2 style={styles.title}>Inventory</h2>

      {feedback && (
        <div style={{
          ...styles.feedback,
          color: feedback === 'Applied!' ? '#4ade80' : '#ef4444',
        }}>
          {feedback}
        </div>
      )}

      {/* My Dinos */}
      <div style={styles.section}>
        <div style={styles.sectionHeader}>My Dinos</div>
        {dinos.length === 0 ? (
          <p style={styles.empty}>No dinos yet! Scan QR codes to find them.</p>
        ) : (
          <div style={styles.dinoGrid}>
            {dinos.map(d => {
              const sp = SPECIES[d.species] || {};
              return (
                <button
                  key={d.species}
                  style={styles.dinoCard}
                  onClick={() => store.navigate(`/dinos/${d.species}`)}
                >
                  <DinoSprite species={d.species} colors={d.colors || {}} scale={2} />
                  <span style={styles.dinoCardName}>{d.name || sp.name || d.species}</span>
                  {!d.tamed && <span style={styles.wildBadge}>WILD</span>}
                  {d.is_partner && <span style={styles.partnerBadge}>Partner</span>}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Hats */}
      <div style={styles.section}>
        <div style={styles.sectionHeader}>Hats</div>
        {ownedHats.length === 0 ? (
          <p style={styles.empty}>No hats yet! Visit events and play trivia to earn some.</p>
        ) : (
          <div style={styles.itemList}>
            {ownedHats.map(hat => (
              <button
                key={hat.id}
                style={styles.hatRow}
                onClick={() => handleHatTap(hat.id)}
                disabled={tamedDinos.length === 0}
              >
                <span style={{ fontSize: '18px' }}>🎩</span>
                <div style={{ flex: 1 }}>
                  <div style={styles.hatName}>{hat.name}</div>
                  <div style={{ fontSize: '11px', color: RARITY_COLORS[hat.rarity] || '#888' }}>
                    {hat.rarity}{hat.count > 1 ? ` x${hat.count}` : ''}
                  </div>
                </div>
                {tamedDinos.length > 0 && <span style={styles.applyHint}>Apply</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Paints */}
      <div style={styles.section}>
        <div style={styles.sectionHeader}>Paints</div>
        {paintCount === 0 ? (
          <p style={styles.empty}>No paints yet! Visit events and play trivia to earn some.</p>
        ) : (
          <button
            style={styles.paintRow}
            onClick={handlePaintTap}
            disabled={tamedDinos.length === 0}
          >
            <span style={{ fontSize: '18px' }}>🎨</span>
            <div style={{ flex: 1 }}>
              <div style={styles.hatName}>Paint</div>
              <div style={{ fontSize: '11px', color: '#888' }}>x{paintCount}</div>
            </div>
            {tamedDinos.length > 0 && <span style={styles.applyHint}>Use</span>}
          </button>
        )}
      </div>

      {/* Modal overlay */}
      {modal && (
        <div style={styles.overlay} onClick={() => !busy && setModal(null)}>
          <div style={styles.modal} onClick={e => e.stopPropagation()}>
            {/* Dino picker (hat or paint step 1) */}
            {modal.step === 'dino' && (
              <>
                <div style={styles.modalTitle}>
                  {modal.type === 'hat' ? 'Apply hat to which dino?' : 'Paint which dino?'}
                </div>
                <div style={styles.dinoGrid}>
                  {tamedDinos.map(d => {
                    const sp = SPECIES[d.species] || {};
                    return (
                      <button
                        key={d.species}
                        style={styles.dinoCard}
                        onClick={() => modal.type === 'hat'
                          ? handleHatDinoPick(d.species)
                          : handlePaintDinoPick(d.species)
                        }
                        disabled={busy}
                      >
                        <DinoSprite species={d.species} colors={d.colors || {}} scale={2} />
                        <span style={styles.dinoCardName}>{d.name || sp.name || d.species}</span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            {/* Region picker (paint step 2) */}
            {modal.step === 'region' && (
              <>
                <div style={styles.modalTitle}>Pick a region</div>
                <div style={styles.modalDinoPreview}>
                  <DinoSprite species={modal.species} colors={
                    (tamedDinos.find(d => d.species === modal.species) || {}).colors || {}
                  } scale={3} />
                </div>
                <div style={styles.regionRow}>
                  {(SPECIES[modal.species]?.regions || []).map(r => (
                    <button
                      key={r}
                      style={styles.regionBtn}
                      onClick={() => handlePaintRegionPick(r)}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* Color picker (paint step 3) */}
            {modal.step === 'color' && (
              <>
                <div style={styles.modalTitle}>Pick a color for {modal.region}</div>
                <div style={styles.swatchGrid}>
                  {PAINT_COLORS.map(c => (
                    <button
                      key={c.name}
                      onClick={() => handlePaintColorPick(c.hue)}
                      title={c.name}
                      disabled={busy}
                      style={{
                        ...styles.paintSwatch,
                        background: c.name === 'White' ? '#e8e8e8'
                          : c.name === 'Charcoal' ? '#333'
                          : `hsl(${c.hue}, 70%, 50%)`,
                      }}
                    />
                  ))}
                </div>
              </>
            )}

            <button style={styles.cancelBtn} onClick={() => setModal(null)} disabled={busy}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  page: { display: 'flex', flexDirection: 'column', gap: '16px', padding: '16px 16px 80px' },
  title: { fontSize: '20px', color: '#e0e0e0', margin: 0 },
  feedback: { textAlign: 'center', fontSize: '14px', fontWeight: 'bold' },
  section: { display: 'flex', flexDirection: 'column', gap: '8px' },
  sectionHeader: {
    fontSize: '13px', color: '#888', fontWeight: 'bold',
    textTransform: 'uppercase', letterSpacing: '1px',
  },
  empty: { color: '#555', fontSize: '13px', margin: 0 },

  // Dino grid
  dinoGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))',
    gap: '8px',
  },
  dinoCard: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
    padding: '10px 4px', borderRadius: '10px', border: '1px solid #222',
    background: '#111', cursor: 'pointer', position: 'relative',
  },
  dinoCardName: { fontSize: '11px', color: '#ccc', textAlign: 'center', wordBreak: 'break-word' },
  wildBadge: {
    position: 'absolute', top: '4px', right: '4px',
    fontSize: '8px', fontWeight: '900', color: '#f97316',
    background: 'rgba(0,0,0,0.6)', borderRadius: '3px', padding: '1px 4px',
    letterSpacing: '1px',
  },
  partnerBadge: {
    position: 'absolute', top: '4px', right: '4px',
    fontSize: '8px', fontWeight: '700', color: '#4ade80',
    background: 'rgba(0,0,0,0.6)', borderRadius: '3px', padding: '1px 4px',
  },

  // Item rows
  itemList: { display: 'flex', flexDirection: 'column', gap: '4px' },
  hatRow: {
    display: 'flex', alignItems: 'center', gap: '10px',
    padding: '12px', borderRadius: '10px', border: '1px solid #222',
    background: '#111', cursor: 'pointer', width: '100%',
  },
  paintRow: {
    display: 'flex', alignItems: 'center', gap: '10px',
    padding: '12px', borderRadius: '10px', border: '1px solid #222',
    background: '#111', cursor: 'pointer', width: '100%',
  },
  hatName: { fontSize: '14px', color: '#e0e0e0', fontWeight: '600' },
  applyHint: { fontSize: '12px', color: '#6366f1', fontWeight: '600' },

  // Modal
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 100, padding: '20px',
  },
  modal: {
    background: '#1a1a2e', borderRadius: '16px', padding: '20px',
    maxWidth: '360px', width: '100%', maxHeight: '80vh', overflow: 'auto',
    display: 'flex', flexDirection: 'column', gap: '12px',
  },
  modalTitle: { fontSize: '16px', color: '#e0e0e0', fontWeight: 'bold', textAlign: 'center' },
  modalDinoPreview: { display: 'flex', justifyContent: 'center' },

  // Region buttons
  regionRow: { display: 'flex', gap: '6px', flexWrap: 'wrap' },
  regionBtn: {
    flex: 1, minWidth: '70px', padding: '12px 8px', borderRadius: '8px',
    border: '2px solid #333', background: '#0d1117', color: '#e0e0e0',
    fontSize: '13px', cursor: 'pointer', fontWeight: 'bold', textTransform: 'capitalize',
    textAlign: 'center',
  },

  // Color grid
  swatchGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '8px',
    justifyItems: 'center',
  },
  paintSwatch: {
    width: '36px', height: '36px', borderRadius: '50%', border: '2px solid transparent',
    cursor: 'pointer', padding: 0,
  },

  cancelBtn: {
    padding: '12px', borderRadius: '10px', border: '1px solid #333',
    background: 'none', color: '#aaa', fontSize: '14px',
    cursor: 'pointer', width: '100%',
  },
};
