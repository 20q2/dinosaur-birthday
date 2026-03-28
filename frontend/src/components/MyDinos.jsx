import { store } from '../store.js';
import { useStore } from '../router.jsx';
import { SPECIES } from '../data/species.js';
import { HAT_MAP } from '../data/hats.js';
import { DinoSprite } from './DinoSprite.jsx';
import { TitleBar } from './TitleBar.jsx';

const TOTAL_SPECIES = Object.keys(SPECIES).length;
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
      {/* Sprite — clipped to box */}
      <div style={styles.spriteBox}>
        <DinoSprite species={dino.species} colors={dino.colors || {}} scale={2} style={{ width: '100%', height: '100%' }} />
        {dino.shiny && <span style={styles.shinyBadge}>✨</span>}
      </div>

      {/* Info column */}
      <div style={styles.info}>
        <div style={styles.nameRow}>
          <span style={styles.dinoName}>{dino.name || speciesData.name || dino.species}</span>
          {dino.is_partner && <span style={styles.partnerBadge}>Partner</span>}
        </div>
        <div style={styles.speciesName}>
          {speciesData.name || dino.species}
          {dino.gender && <span style={styles.genderIcon}>{dino.gender === 'male' ? ' ♂' : ' ♀'}</span>}
        </div>

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

      <div style={styles.chevron}>›</div>
    </button>
  );
}

const ALL_SPECIES = Object.keys(SPECIES);

function UnknownCard({ speciesKey }) {
  const speciesData = SPECIES[speciesKey] || {};
  return (
    <div style={styles.unknownCard}>
      <div style={styles.unknownSpriteBox}>
        <span style={styles.unknownIcon}>?</span>
      </div>
      <div style={styles.info}>
        <div style={styles.unknownName}>???</div>
        <div style={styles.unknownHint}>{speciesData.diet === 'carnivore' ? 'Carnivore' : 'Herbivore'}</div>
      </div>
    </div>
  );
}

export function MyDinos() {
  const { player } = useStore();
  const dinos = player?.dinos || [];
  const discoveredKeys = new Set(dinos.map(d => d.species));

  // Sort discovered: tamed first, then by level desc, then alpha
  const sorted = [...dinos].sort((a, b) => {
    if (a.tamed !== b.tamed) return a.tamed ? -1 : 1;
    if ((b.level || 1) !== (a.level || 1)) return (b.level || 1) - (a.level || 1);
    const aName = a.name || a.species;
    const bName = b.name || b.species;
    return aName.localeCompare(bName);
  });

  const undiscovered = ALL_SPECIES.filter(s => !discoveredKeys.has(s));
  const tamedCount = dinos.filter(d => d.tamed).length;

  return (
    <div style={styles.page}>
      <TitleBar title="My Dinos" subtitle={`${dinos.length}/${TOTAL_SPECIES} discovered · ${tamedCount} tamed`} />
      <div style={styles.list}>
        {sorted.map(dino => (
          <DinoCard key={dino.species} dino={dino} />
        ))}
        {undiscovered.map(sp => (
          <UnknownCard key={sp} speciesKey={sp} />
        ))}
      </div>
    </div>
  );
}

const styles = {
  page: {
    paddingBottom: '80px',
    background: 'linear-gradient(180deg, #0d1117 0%, #1a1a2e 40%, #0d1117 100%)',
    minHeight: '100dvh',
  },
  list: { display: 'flex', flexDirection: 'column', gap: '10px', padding: '16px' },
  empty: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', minHeight: '70dvh', textAlign: 'center',
  },
  card: {
    display: 'flex', flexDirection: 'row', gap: '14px', alignItems: 'center',
    background: '#1a1a2e', borderRadius: '12px', border: '2px solid #2a2a3e',
    padding: '12px', width: '100%', cursor: 'pointer', textAlign: 'left',
    color: '#e0e0e0',
  },
  spriteBox: {
    position: 'relative', width: '60px', height: '60px', flexShrink: 0,
    borderRadius: '10px', overflow: 'hidden',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  shinyBadge: {
    position: 'absolute', top: '-2px', right: '-2px', fontSize: '14px',
  },
  info: { flex: 1, minWidth: 0 },
  nameRow: { display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' },
  dinoName: { fontSize: '16px', fontWeight: 'bold', color: '#e0e0e0' },
  partnerBadge: {
    fontSize: '10px', background: '#166534', color: '#4ade80',
    borderRadius: '4px', padding: '1px 6px', fontWeight: 'bold',
  },
  speciesName: { fontSize: '12px', color: '#888', marginTop: '2px' },
  genderIcon: { color: '#9ca3af' },
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
  chevron: {
    fontSize: '22px', color: '#555', flexShrink: 0, marginLeft: '4px',
  },
  unknownCard: {
    display: 'flex', flexDirection: 'row', gap: '14px', alignItems: 'center',
    background: '#111', borderRadius: '12px', border: '2px dashed #2a2a3e',
    padding: '12px', width: '100%',
  },
  unknownSpriteBox: {
    width: '60px', height: '60px', flexShrink: 0,
    borderRadius: '10px', background: '#1a1a2e',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  unknownIcon: {
    fontSize: '28px', color: '#333', fontWeight: 'bold',
  },
  unknownName: {
    fontSize: '16px', fontWeight: 'bold', color: '#333',
  },
  unknownHint: {
    fontSize: '12px', color: '#2a2a3e', marginTop: '2px',
  },
};
