import { store } from '../store.js';
import { useStore } from '../router.jsx';
import { SPECIES } from '../data/species.js';
import { HAT_MAP } from '../data/hats.js';
import { DinoSprite } from './DinoSprite.jsx';

const XP_PER_LEVEL = 100;
const MAX_LEVEL = 5;

function xpProgress(xp, level) {
  if (level >= MAX_LEVEL) return 100;
  const levelXp = xp % XP_PER_LEVEL;
  return Math.min(100, Math.round((levelXp / XP_PER_LEVEL) * 100));
}

function DinoCard({ dino }) {
  const speciesData = SPECIES[dino.species] || {};
  const hatData = dino.hat ? HAT_MAP[dino.hat] : null;
  const isTamed = dino.tamed;
  const progress = xpProgress(dino.xp || 0, dino.level || 1);

  return (
    <button
      onClick={() => store.navigate(`/dinos/${dino.species}`)}
      style={{
        ...styles.card,
        opacity: isTamed ? 1 : 0.65,
        borderColor: dino.is_partner ? '#4ade80' : '#2a2a3e',
      }}
    >
      {/* Sprite + shiny badge */}
      <div style={styles.emojiBox}>
        <DinoSprite species={dino.species} colors={dino.colors || {}} scale={2} />
        {dino.shiny && <span style={styles.shinyBadge}>✨</span>}
      </div>

      {/* Info column */}
      <div style={styles.info}>
        <div style={styles.nameRow}>
          <span style={styles.dinoName}>{dino.name || speciesData.name || dino.species}</span>
          {dino.is_partner && <span style={styles.partnerBadge}>Partner</span>}
        </div>
        <div style={styles.speciesName}>{speciesData.name || dino.species}</div>

        {isTamed ? (
          <>
            <div style={styles.levelRow}>
              Lv {dino.level || 1}
              {hatData && <span style={styles.hatLabel}>{hatData.name}</span>}
            </div>
            <div style={styles.xpBarBg}>
              <div style={{ ...styles.xpBarFill, width: `${progress}%` }} />
            </div>
          </>
        ) : (
          <div style={styles.untamedMsg}>Untamed — find food!</div>
        )}
      </div>
    </button>
  );
}

export function MyDinos() {
  const { player } = useStore();
  const dinos = player?.dinos || [];

  if (dinos.length === 0) {
    return (
      <div style={styles.empty}>
        <div style={{ fontSize: '64px' }}>🦕</div>
        {/* Empty state keeps emoji */}
        <p style={{ color: '#aaa', marginTop: '12px' }}>No dinos yet!</p>
        <p style={{ color: '#666', fontSize: '13px' }}>Scan a dino QR code to encounter one.</p>
      </div>
    );
  }

  // Sort: tamed first, then by level desc, then alpha
  const sorted = [...dinos].sort((a, b) => {
    if (a.tamed !== b.tamed) return a.tamed ? -1 : 1;
    if ((b.level || 1) !== (a.level || 1)) return (b.level || 1) - (a.level || 1);
    const aName = a.name || a.species;
    const bName = b.name || b.species;
    return aName.localeCompare(bName);
  });

  return (
    <div style={styles.page}>
      <h2 style={styles.title}>My Dinos</h2>
      <div style={styles.list}>
        {sorted.map(dino => (
          <DinoCard key={dino.species} dino={dino} />
        ))}
      </div>
    </div>
  );
}

const styles = {
  page: { padding: '16px 16px 80px' },
  title: { margin: '0 0 16px', fontSize: '22px', color: '#e0e0e0' },
  list: { display: 'flex', flexDirection: 'column', gap: '10px' },
  empty: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', minHeight: '70dvh', textAlign: 'center',
  },
  card: {
    display: 'flex', flexDirection: 'row', gap: '14px', alignItems: 'center',
    background: '#16213e', borderRadius: '12px', border: '2px solid #2a2a3e',
    padding: '14px', width: '100%', cursor: 'pointer', textAlign: 'left',
    color: '#e0e0e0',
  },
  emojiBox: {
    position: 'relative', width: '56px', height: '56px', flexShrink: 0,
    background: '#1a2e1a', borderRadius: '10px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  shinyBadge: {
    position: 'absolute', top: '-6px', right: '-6px', fontSize: '12px',
  },
  info: { flex: 1, minWidth: 0 },
  nameRow: { display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' },
  dinoName: { fontSize: '16px', fontWeight: 'bold', color: '#e0e0e0' },
  partnerBadge: {
    fontSize: '10px', background: '#166534', color: '#4ade80',
    borderRadius: '4px', padding: '1px 6px', fontWeight: 'bold',
  },
  speciesName: { fontSize: '12px', color: '#888', marginTop: '2px' },
  levelRow: {
    display: 'flex', alignItems: 'center', gap: '8px',
    fontSize: '12px', color: '#aaa', marginTop: '4px',
  },
  hatLabel: {
    fontSize: '11px', color: '#a78bfa', background: '#2d1b69',
    borderRadius: '4px', padding: '1px 5px',
  },
  xpBarBg: {
    marginTop: '5px', height: '4px', background: '#2a2a3e',
    borderRadius: '2px', overflow: 'hidden',
  },
  xpBarFill: { height: '100%', background: '#4ade80', borderRadius: '2px' },
  untamedMsg: { fontSize: '12px', color: '#f59e0b', marginTop: '4px' },
};
