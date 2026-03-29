import { useState } from 'preact/hooks';
import { store } from '../store.js';
import { useStore } from '../router.jsx';
import { api } from '../api.js';
import { SPECIES } from '../data/species.js';
import { HATS, HAT_MAP } from '../data/hats.js';
import { PAINT_MAP } from '../data/paints.js';
import { DinoSprite } from './DinoSprite.jsx';
import { PaintSprite } from './PaintSprite.jsx';
import { TitleBar } from './TitleBar.jsx';
import { getHatImage } from '../data/hatImages.js';
import meatImg from '../assets/items/meat.png';
import berryImg from '../assets/items/berry.png';

const RARITY_COLORS = {
  common: '#9ca3af',
  uncommon: '#4ade80',
  legendary: '#f59e0b',
};

export function Inventory() {
  const { player } = useStore();
  const [modal, setModal] = useState(null);
  const [busy, setBusy] = useState(false);
  const [busySpecies, setBusySpecies] = useState(null);
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

  // Paints: group by paint_id with counts
  const paintCountsMap = {};
  items.filter(i => i.type === 'paint' && i.details?.paint_id).forEach(i => {
    const pid = i.details.paint_id;
    paintCountsMap[pid] = (paintCountsMap[pid] || 0) + 1;
  });
  const ownedPaints = Object.entries(paintCountsMap)
    .map(([id, count]) => ({ ...PAINT_MAP[id], count }))
    .filter(p => p.id);

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
    setBusySpecies(null);
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
    setBusySpecies(species);
    doAction(() => api.customizeDino(store.playerId, species, { hat: modal.hatId }));
  }

  function handlePaintTap(paintId) {
    if (tamedDinos.length === 0) return;
    if (tamedDinos.length === 1) {
      setModal({ type: 'paint', paintId, step: 'region', species: tamedDinos[0].species });
    } else {
      setModal({ type: 'paint', paintId, step: 'dino' });
    }
  }

  function handlePaintDinoPick(species) {
    setModal({ ...modal, step: 'region', species });
  }

  function handlePaintRegionPick(region) {
    setModal({ ...modal, step: 'confirm', region });
  }

  function handlePaintConfirm() {
    doAction(() =>
      api.customizeDino(store.playerId, modal.species, {
        paint: { region: modal.region, paint_id: modal.paintId },
      })
    );
  }

  return (
    <div style={styles.page}>
      <TitleBar title="Inventory" />
      <div style={styles.content}>
      {feedback && (
        <div style={{
          ...styles.feedback,
          color: feedback === 'Applied!' ? '#4ade80' : '#ef4444',
        }}>
          {feedback}
        </div>
      )}

      {/* Food */}
      <div style={styles.section}>
        <div style={styles.sectionHeader}>Food</div>
        <div style={styles.foodRow}>
          <div style={styles.foodCard}>
            <img src={meatImg} style={styles.foodImg} />
            <div style={styles.foodInfo}>
              <span style={styles.foodName}>Meat</span>
              <span style={styles.foodCount}>
                {tamedDinos.filter(d => SPECIES[d.species]?.diet === 'carnivore').length} collected
              </span>
            </div>
          </div>
          <div style={styles.foodCard}>
            <img src={berryImg} style={styles.foodImg} />
            <div style={styles.foodInfo}>
              <span style={styles.foodName}>Mejoberries</span>
              <span style={styles.foodCount}>
                {tamedDinos.filter(d => SPECIES[d.species]?.diet === 'herbivore').length} collected
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Hats */}
      <div style={styles.section}>
        <div style={styles.sectionHeader}>Hats</div>
        {ownedHats.length === 0 ? (
          <p style={styles.empty}>No hats yet! Visit events and play trivia to earn some.</p>
        ) : (
          <div style={styles.hatGrid}>
            {ownedHats.map(hat => {
              const hatImg = getHatImage(hat.id);
              return (
                <button
                  key={hat.id}
                  style={styles.hatItem}
                  onClick={() => handleHatTap(hat.id)}
                  disabled={tamedDinos.length === 0}
                >
                  {hatImg
                    ? <img src={hatImg.img.src} style={styles.hatSprite} />
                    : <span style={{ fontSize: '24px' }}>{'\uD83C\uDFA9'}</span>
                  }
                  <span style={styles.hatItemName}>{hat.name}</span>
                  {hat.count > 1 && <span style={styles.hatItemCount}>x{hat.count}</span>}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Paints */}
      <div style={styles.section}>
        <div style={styles.sectionHeader}>Paints</div>
        {ownedPaints.length === 0 ? (
          <p style={styles.empty}>No paints yet! Visit events and play trivia to earn some.</p>
        ) : (
          <div style={styles.paintGrid}>
            {ownedPaints.map(paint => (
              <button
                key={paint.id}
                style={styles.paintItem}
                onClick={() => handlePaintTap(paint.id)}
                disabled={tamedDinos.length === 0}
              >
                <PaintSprite hue={paint.hue} scale={0.18} />
                <span style={styles.paintItemName}>{paint.name}</span>
                {paint.count > 1 && (
                  <span style={styles.paintItemCount}>x{paint.count}</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      </div>
      {/* Modal overlay */}
      {modal && (
        <div style={styles.overlay} onClick={() => !busy && setModal(null)}>
          <div style={styles.modal} onClick={e => e.stopPropagation()}>
            <button style={styles.closeBtn} onClick={() => setModal(null)} disabled={busy}>{'\u2715'}</button>
            {/* Dino picker (hat or paint) */}
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
                        <DinoSprite species={d.species} colors={d.colors || {}} scale={2} hat={modal.type === 'hat' ? modal.hatId : null} />
                        <span style={styles.dinoCardName}>{d.name || sp.name || d.species}</span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            {/* Region picker (paint) */}
            {modal.step === 'region' && (() => {
              const currentColors = (tamedDinos.find(d => d.species === modal.species) || {}).colors || {};
              return (
                <>
                  <div style={styles.modalTitle}>
                    Apply {PAINT_MAP[modal.paintId]?.name} Paint
                  </div>
                  <div style={styles.modalDinoPreview}>
                    <DinoSprite species={modal.species} colors={currentColors} scale={3} />
                  </div>
                  <div style={{ fontSize: '12px', color: '#888', textAlign: 'center' }}>
                    Pick a region to paint
                  </div>
                  <div style={styles.regionRow}>
                    {(SPECIES[modal.species]?.regions || []).map(r => (
                      <button
                        key={r}
                        style={styles.regionBtn}
                        onClick={() => handlePaintRegionPick(r)}
                        disabled={busy}
                      >
                        <span style={{
                          width: '14px', height: '14px', borderRadius: '3px',
                          background: currentColors[r] != null
                            ? `hsl(${currentColors[r]}, 70%, 50%)`
                            : '#444',
                          border: '1px solid rgba(255,255,255,0.2)',
                          flexShrink: 0,
                        }} />
                        {r}
                      </button>
                    ))}
                  </div>
                </>
              );
            })()}

            {/* Paint preview + confirm */}
            {modal.step === 'confirm' && (() => {
              const currentColors = (tamedDinos.find(d => d.species === modal.species) || {}).colors || {};
              const paintHue = PAINT_MAP[modal.paintId]?.hue ?? 120;
              const previewColors = { ...currentColors, [modal.region]: paintHue };
              return (
                <>
                  <div style={styles.modalTitle}>
                    {PAINT_MAP[modal.paintId]?.name} on {modal.region}
                  </div>
                  <div style={styles.previewRow}>
                    <div style={styles.previewCol}>
                      <DinoSprite species={modal.species} colors={currentColors} scale={2} />
                      <span style={styles.previewLabel}>Before</span>
                    </div>
                    <span style={styles.previewArrow}>→</span>
                    <div style={styles.previewCol}>
                      <DinoSprite species={modal.species} colors={previewColors} scale={2} />
                      <span style={styles.previewLabel}>After</span>
                    </div>
                  </div>
                  <div style={styles.regionRow}>
                    <button
                      style={{ ...styles.regionBtn, background: '#16a34a', borderColor: '#22c55e', color: '#fff' }}
                      onClick={handlePaintConfirm}
                      disabled={busy}
                    >
                      Apply
                    </button>
                    <button
                      style={styles.regionBtn}
                      onClick={() => setModal({ ...modal, step: 'region' })}
                      disabled={busy}
                    >
                      Back
                    </button>
                  </div>
                </>
              );
            })()}

          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  page: { display: 'flex', flexDirection: 'column', paddingBottom: '80px' },
  content: { display: 'flex', flexDirection: 'column', gap: '16px', padding: '16px' },
  feedback: { textAlign: 'center', fontSize: '14px', fontWeight: 'bold' },
  section: { display: 'flex', flexDirection: 'column', gap: '8px' },
  sectionHeader: {
    fontSize: '13px', color: '#888', fontWeight: 'bold',
    textTransform: 'uppercase', letterSpacing: '1px',
  },
  empty: { color: '#555', fontSize: '13px', margin: 0 },

  // Food
  foodRow: {
    display: 'flex', gap: '8px',
  },
  foodCard: {
    flex: 1, display: 'flex', alignItems: 'center', gap: '10px',
    padding: '12px', borderRadius: '10px', border: '1px solid #222',
    background: '#111',
  },
  foodImg: {
    width: '32px', height: '32px', imageRendering: 'pixelated',
  },
  foodInfo: {
    display: 'flex', flexDirection: 'column', gap: '2px',
  },
  foodName: {
    fontSize: '14px', color: '#e0e0e0', fontWeight: '600',
  },
  foodCount: {
    fontSize: '11px', color: '#888',
  },

  // Hat grid
  hatGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px',
  },
  hatItem: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px',
    padding: '8px 4px', borderRadius: '10px', border: '2px solid #222',
    background: '#111', cursor: 'pointer', position: 'relative',
  },
  hatSprite: {
    width: '32px', height: '32px', imageRendering: 'pixelated', objectFit: 'contain',
  },
  hatItemName: {
    fontSize: '10px', color: '#ccc', textAlign: 'center',
  },
  hatItemCount: {
    position: 'absolute', top: '2px', right: '4px',
    fontSize: '10px', color: '#888', fontWeight: 'bold',
  },

  // Paint grid
  paintGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px',
  },
  paintItem: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px',
    padding: '8px 4px', borderRadius: '10px', border: '2px solid #222',
    background: '#111', cursor: 'pointer', position: 'relative',
  },
  paintItemName: {
    fontSize: '10px', color: '#ccc', textAlign: 'center',
  },
  paintItemCount: {
    position: 'absolute', top: '2px', right: '4px',
    fontSize: '10px', color: '#888', fontWeight: 'bold',
  },

  // Modal
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 100, padding: '20px',
  },
  modal: {
    background: '#1a1a2e', borderRadius: '16px', padding: '20px',
    maxWidth: '360px', width: '100%', maxHeight: '80vh', overflowX: 'hidden', overflowY: 'auto',
    display: 'flex', flexDirection: 'column', gap: '12px', position: 'relative',
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
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
  },

  // Preview (paint confirm)
  previewRow: {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px',
  },
  previewCol: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
    flex: 1, minWidth: 0, overflow: 'hidden',
  },
  previewLabel: {
    fontSize: '12px', color: '#888', fontWeight: '600',
  },
  previewArrow: {
    fontSize: '24px', color: '#6366f1',
  },

  closeBtn: {
    position: 'absolute', top: '10px', right: '10px',
    background: 'none', border: 'none', color: '#888',
    fontSize: '18px', cursor: 'pointer', padding: '4px 8px',
    lineHeight: 1,
  },

  // Dino picker grid
  dinoGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px',
  },
  dinoCard: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px',
    padding: '14px 8px', borderRadius: '12px', border: '2px solid #2a2a3e',
    background: '#0d1117', cursor: 'pointer', color: '#e0e0e0',
  },
  dinoCardName: {
    fontSize: '13px', fontWeight: '600', color: '#e0e0e0', textAlign: 'center',
  },
};
