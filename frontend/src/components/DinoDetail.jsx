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

import bgRocks from '../assets/backgrounds/dino_find_rocks.png';
import bgSwamp from '../assets/backgrounds/dino_find_swamp.png';
import bgRiver from '../assets/backgrounds/dino_find_river.png';
import bgGrass from '../assets/backgrounds/dino_find_tall_grass.png';
import meatImg from '../assets/items/meat.png';
import berryImg from '../assets/items/berry.png';

const WILD_BG = {
  trex: bgRocks,
  spinosaurus: bgSwamp,
  dilophosaurus: bgGrass,
  pachycephalosaurus: bgRocks,
  parasaurolophus: bgRiver,
  triceratops: bgGrass,
  ankylosaurus: bgSwamp,
};

const BG_OPTIONS = [
  { id: '', label: 'Default', color: '#0a0a0a', img: null },
  { id: 'rocks', label: 'Rocks', color: null, img: bgRocks },
  { id: 'swamp', label: 'Swamp', color: null, img: bgSwamp },
  { id: 'river', label: 'River', color: null, img: bgRiver },
  { id: 'grass', label: 'Tall Grass', color: null, img: bgGrass },
];

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
  const [selectedPaint, setSelectedPaint] = useState(null); // paint_id
  const [paintRegion, setPaintRegion] = useState(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState('');

  if (!dino) {
    return (
      <div style={styles.page}>
        <TitleBar title="Not Found" back="/dinos" />
        <div style={styles.center}>
          <p style={{ color: '#ef4444' }}>Dino not found.</p>
        </div>
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

  // Paint inventory grouped by paint_id
  const paintItems = (player?.items || []).filter(i => i.type === 'paint' && i.details?.paint_id);
  const paintCounts = {};
  paintItems.forEach(i => {
    const pid = i.details.paint_id;
    paintCounts[pid] = (paintCounts[pid] || 0) + 1;
  });
  const hasPaints = Object.keys(paintCounts).length > 0;

  // Regions for this species
  const regions = speciesData.regions || [];

  // Preview colors during paint mode
  const previewColors = selectedPaint && paintRegion
    ? { ...colors, [paintRegion]: PAINT_MAP[selectedPaint]?.hue ?? 120 }
    : colors;

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

  function handleSelectPaint(paintId) {
    setSelectedPaint(paintId);
    setPaintRegion(null);
  }

  function handleApplyPaint() {
    if (!selectedPaint || !paintRegion) return;
    doAction(async () => {
      await api.customizeDino(store.playerId, species, {
        paint: { region: paintRegion, paint_id: selectedPaint },
      });
      setSelectedPaint(null);
      setPaintRegion(null);
    });
  }

  function handleCancelPaint() {
    setSelectedPaint(null);
    setPaintRegion(null);
  }

  // Compute backdrop for full page background
  const pageBg = (() => {
    if (!dino.tamed && WILD_BG[species]) {
      return { backgroundImage: `url(${WILD_BG[species]})`, backgroundSize: 'cover', backgroundPosition: 'center top', backgroundAttachment: 'fixed' };
    }
    if (dino.tamed && dino.background) {
      const bg = BG_OPTIONS.find(b => b.id === dino.background);
      if (bg?.img) return { backgroundImage: `url(${bg.img})`, backgroundSize: 'cover', backgroundPosition: 'center top', backgroundAttachment: 'fixed' };
    }
    return {};
  })();

  return (
    <div style={{ ...styles.page, ...pageBg }}>
      <TitleBar
        title={`${speciesData.name || species} ${dino.gender === 'male' ? '\u2642' : '\u2640'}`}
        back="/dinos"
      />
      <div style={styles.content}>
      {/* Dino portrait */}
      <div style={styles.portrait}>
        <DinoSprite species={species} colors={previewColors} scale={4} style={{ filter: 'drop-shadow(0 6px 12px rgba(0,0,0,0.6))' }} />
        {dino.shiny && <div style={styles.shinyLabel}>✨ SHINY</div>}
        {!dino.tamed && <div style={styles.wildLabel}>WILD</div>}
        {dino.is_partner && <div style={styles.partnerLabel}>Plaza Partner</div>}
      </div>

      {/* Name */}
      <div style={styles.section}>
        <div style={styles.dinoName}>{dino.name || <em style={{ color: '#666' }}>Unnamed</em>}</div>
        <div style={styles.meta}>Nature: {dino.nature}</div>
      </div>

      {/* Flavor text */}
      {speciesData.flavor && (
        <div style={styles.flavor}>"{speciesData.flavor}"</div>
      )}

      {/* Level / XP — tamed only */}
      {dino.tamed && (
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
      )}

      {/* Hat — tamed only */}
      {dino.tamed && (
        <div style={styles.card}>
          <div style={styles.statRow}>
            <span style={styles.statLabel}>Hat</span>
            <span style={styles.statValue}>{hatData ? hatData.name : 'None'}</span>
          </div>
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

      {/* Rename flow — tamed only */}
      {dino.tamed && (renaming ? (
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
      ))}

      {/* Hat picker flow — tamed only */}
      {dino.tamed && (showHats ? (
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
      ))}

      {/* Background picker — tamed only */}
      {dino.tamed && (
        <div style={styles.card}>
          <div style={styles.sectionTitle}>Backdrop</div>
          <div style={styles.bgRow}>
            {BG_OPTIONS.map(bg => (
              <button
                key={bg.id}
                onClick={() => {
                  if (dino.background === bg.id || (!dino.background && !bg.id)) return;
                  doAction(() => api.customizeDino(store.playerId, species, { background: bg.id }));
                }}
                disabled={busy}
                style={{
                  ...styles.bgThumb,
                  background: bg.img ? `url(${bg.img}) center/cover` : bg.color,
                  borderColor: (dino.background || '') === bg.id ? '#4ade80' : '#333',
                }}
              >
                {(dino.background || '') === bg.id && (
                  <span style={styles.bgCheck}>✓</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Paint flow — tamed only */}
      {dino.tamed && hasPaints && (
        selectedPaint ? (
          <div style={styles.card}>
            <div style={styles.sectionTitle}>
              Apply {PAINT_MAP[selectedPaint]?.name} Paint
            </div>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <PaintSprite hue={PAINT_MAP[selectedPaint]?.hue ?? 120} scale={3} />
            </div>
            <div style={{ fontSize: '12px', color: '#888', textAlign: 'center' }}>
              Pick a region to paint
            </div>
            <div style={styles.regionRow}>
              {regions.map(r => (
                <button
                  key={r}
                  onClick={() => setPaintRegion(r)}
                  disabled={busy}
                  style={{
                    ...styles.regionBtn,
                    borderColor: paintRegion === r ? '#a78bfa' : '#333',
                    background: paintRegion === r ? '#2d1b69' : '#0d1117',
                  }}
                >
                  <div style={{
                    width: '14px', height: '14px', borderRadius: '4px',
                    background: colors[r] != null ? `hsl(${colors[r]}, 70%, 50%)` : '#555',
                    flexShrink: 0,
                  }} />
                  <span style={{ textTransform: 'capitalize' }}>{r}</span>
                </button>
              ))}
            </div>
            <div style={styles.btnRow}>
              <button
                onClick={handleApplyPaint}
                disabled={busy || !paintRegion}
                style={{
                  ...styles.btn,
                  background: '#7c3aed',
                  opacity: paintRegion ? 1 : 0.5,
                }}
              >
                {busy ? '...' : 'Apply Paint'}
              </button>
              <button onClick={handleCancelPaint} style={styles.ghostBtn}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div style={styles.card}>
            <div style={styles.sectionTitle}>Paints</div>
            <div style={styles.paintGrid}>
              {Object.entries(paintCounts).map(([paintId, count]) => {
                const paintData = PAINT_MAP[paintId];
                if (!paintData) return null;
                return (
                  <button
                    key={paintId}
                    onClick={() => handleSelectPaint(paintId)}
                    disabled={busy}
                    style={styles.paintItem}
                  >
                    <PaintSprite hue={paintData.hue} scale={2} />
                    <span style={styles.paintItemName}>{paintData.name}</span>
                    {count > 1 && (
                      <span style={styles.paintItemCount}>x{count}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )
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
          <img src={speciesData.diet === 'carnivore' ? meatImg : berryImg} style={styles.untamedFoodImg} />
          <span>Find {speciesData.diet === 'carnivore' ? 'Meat' : 'Mejoberries'} to tame this dino!</span>
        </div>
      )}
      </div>
    </div>
  );
}

const styles = {
  page: { display: 'flex', flexDirection: 'column', paddingBottom: '80px', background: '#0a0a0a', minHeight: '100dvh' },
  content: { display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px' },
  center: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '70dvh', gap: '16px' },
  portrait: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px',
    padding: '24px',
  },
  shinyLabel: { color: '#f59e0b', fontSize: '13px', fontWeight: 'bold' },
  wildLabel: {
    fontSize: '11px', fontWeight: '900', letterSpacing: '2px',
    color: '#f97316', background: 'rgba(0,0,0,0.5)',
    borderRadius: '6px', padding: '3px 10px',
  },
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
  regionRow: { display: 'flex', gap: '6px' },
  regionBtn: {
    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
    padding: '10px 6px', borderRadius: '8px', border: '2px solid #333',
    background: '#0d1117', color: '#e0e0e0', fontSize: '12px',
    cursor: 'pointer', fontWeight: 'bold',
  },
  paintGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px',
  },
  paintItem: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px',
    padding: '8px 4px', borderRadius: '10px', border: '2px solid #333',
    background: '#0d1117', cursor: 'pointer', position: 'relative',
  },
  paintItemName: {
    fontSize: '10px', color: '#ccc', textAlign: 'center',
  },
  paintItemCount: {
    position: 'absolute', top: '2px', right: '4px',
    fontSize: '10px', color: '#888', fontWeight: 'bold',
  },
  bgRow: {
    display: 'flex', gap: '8px', flexWrap: 'wrap',
  },
  bgThumb: {
    width: '52px', height: '52px', borderRadius: '10px',
    border: '2.5px solid #333', cursor: 'pointer', padding: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    position: 'relative',
  },
  bgCheck: {
    color: '#4ade80', fontSize: '18px', fontWeight: 'bold',
    textShadow: '0 1px 3px rgba(0,0,0,0.8)',
  },
  partnerNote: { textAlign: 'center', color: '#4ade80', fontSize: '13px' },
  untamedNote: {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
    background: '#1a1a2e', borderRadius: '10px', padding: '14px',
    color: '#f59e0b', fontSize: '14px',
  },
  untamedFoodImg: { width: '24px', height: '24px', imageRendering: 'pixelated' },
};
