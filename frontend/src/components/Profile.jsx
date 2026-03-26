import { useStore } from '../router.jsx';
import { store } from '../store.js';
import { HAT_MAP } from '../data/hats.js';
import { SPECIES } from '../data/species.js';
import { getSpeciesEmoji } from '../utils/sprites.js';

const TOTAL_NOTES = 5;

const RARITY_COLORS = {
  common: '#888',
  uncommon: '#6366f1',
  legendary: '#f59e0b',
};

function Avatar({ photoUrl, name }) {
  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={name}
        style={styles.avatarImg}
        onError={(e) => { e.target.style.display = 'none'; }}
      />
    );
  }
  const initial = (name || '?')[0].toUpperCase();
  return (
    <div style={styles.avatarPlaceholder}>
      <span style={styles.avatarInitial}>{initial}</span>
    </div>
  );
}

function StatBox({ value, label }) {
  return (
    <div style={styles.statBox}>
      <span style={styles.statValue}>{value}</span>
      <span style={styles.statLabel}>{label}</span>
    </div>
  );
}

function NotesTracker({ notes }) {
  const found = (notes || []).length;
  const pct = Math.round((found / TOTAL_NOTES) * 100);
  return (
    <div style={styles.section}>
      <h3 style={styles.sectionTitle}>Explorer's Notes</h3>
      <div style={styles.notesRow}>
        {Array.from({ length: TOTAL_NOTES }, (_, i) => (
          <div
            key={i}
            style={{
              ...styles.noteSlot,
              background: i < found ? '#22c55e' : '#1a1a2e',
              border: `2px solid ${i < found ? '#16a34a' : '#2a2a3e'}`,
            }}
          >
            {i < found ? (
              <span style={{ fontSize: '18px' }}>📜</span>
            ) : (
              <span style={{ fontSize: '16px', color: '#444' }}>?</span>
            )}
          </div>
        ))}
      </div>
      <div style={styles.progressBarBg}>
        <div style={{ ...styles.progressBarFill, width: `${pct}%` }} />
      </div>
      <p style={styles.notesCount}>{found} / {TOTAL_NOTES} notes found</p>
    </div>
  );
}

function InspirationBadge() {
  return (
    <div style={styles.inspirationCard}>
      <span style={{ fontSize: '32px' }}>✨</span>
      <div style={styles.inspirationText}>
        <span style={styles.inspirationTitle}>Birthday Girl's Blessing</span>
        <span style={styles.inspirationDesc}>Granted by Alex herself. A rare honor.</span>
      </div>
    </div>
  );
}

function HatItem({ item }) {
  const hatData = HAT_MAP[item.id] || { name: item.name || item.id, rarity: 'common' };
  const rarityColor = RARITY_COLORS[hatData.rarity] || RARITY_COLORS.common;
  return (
    <div style={{ ...styles.hatCard, borderColor: rarityColor }}>
      <span style={{ fontSize: '22px' }}>🎩</span>
      <span style={styles.hatName}>{hatData.name}</span>
      <span style={{ ...styles.rarityBadge, color: rarityColor }}>
        {hatData.rarity}
      </span>
    </div>
  );
}

function PaintItem({ item }) {
  return (
    <div style={{ ...styles.hatCard, borderColor: '#6366f1' }}>
      <span style={{ fontSize: '22px' }}>🎨</span>
      <span style={styles.hatName}>{item.name || item.id}</span>
      <span style={{ ...styles.rarityBadge, color: '#6366f1' }}>paint</span>
    </div>
  );
}

function Inventory({ items }) {
  const hats = (items || []).filter(i => i.type === 'hat');
  const paints = (items || []).filter(i => i.type === 'paint');
  const allItems = [...hats, ...paints];

  return (
    <div style={styles.section}>
      <h3 style={styles.sectionTitle}>Item Inventory</h3>
      {allItems.length === 0 ? (
        <p style={styles.emptyText}>No items yet. Explore to find hats!</p>
      ) : (
        <div style={styles.inventoryGrid}>
          {hats.map(item => <HatItem key={item.id} item={item} />)}
          {paints.map(item => <PaintItem key={item.id} item={item} />)}
        </div>
      )}
    </div>
  );
}

function DinoSummaryRow({ dino }) {
  const speciesData = SPECIES[dino.species] || {};
  const emoji = getSpeciesEmoji(dino.species);
  return (
    <div style={styles.dinoRow}>
      <span style={{ fontSize: '22px' }}>{emoji}</span>
      <div style={styles.dinoRowInfo}>
        <span style={styles.dinoRowName}>{dino.name || speciesData.name || dino.species}</span>
        <span style={styles.dinoRowMeta}>{speciesData.name || dino.species}</span>
      </div>
      <span style={styles.dinoRowLevel}>Lv {dino.level || 1}</span>
      {dino.is_partner && <span style={styles.partnerBadge}>Partner</span>}
    </div>
  );
}

function DinoSummary({ dinos }) {
  const tamed = (dinos || []).filter(d => d.tamed);
  return (
    <div style={styles.section}>
      <h3 style={styles.sectionTitle}>My Dinos</h3>
      {tamed.length === 0 ? (
        <p style={styles.emptyText}>No tamed dinos yet. Go scan some!</p>
      ) : (
        <div style={styles.dinoList}>
          {tamed.map(dino => <DinoSummaryRow key={dino.species} dino={dino} />)}
        </div>
      )}
      <button style={styles.linkBtn} onClick={() => store.navigate('/dinos')}>
        View all dinos →
      </button>
    </div>
  );
}

export function Profile() {
  const { player } = useStore();

  if (!player) {
    return (
      <div style={styles.page}>
        <p style={{ color: '#888', textAlign: 'center', marginTop: '40px' }}>Loading profile...</p>
      </div>
    );
  }

  const tamedCount = (player.dinos || []).filter(d => d.tamed).length;
  const notesCount = (player.notes || []).length;
  const itemsCount = (player.items || []).length;

  return (
    <div style={styles.page}>
      {/* Header */}
      <div style={styles.header}>
        <Avatar photoUrl={player.photo_url} name={player.name} />
        <h2 style={styles.playerName}>{player.name}</h2>
        <p style={styles.playerSub}>Dino Tamer</p>
      </div>

      {/* Stats row */}
      <div style={styles.statsRow}>
        <StatBox value={tamedCount} label="Dinos" />
        <div style={styles.statDivider} />
        <StatBox value={`${notesCount}/${TOTAL_NOTES}`} label="Notes" />
        <div style={styles.statDivider} />
        <StatBox value={itemsCount} label="Items" />
      </div>

      {/* Inspiration badge */}
      {player.inspiration && <InspirationBadge />}

      {/* Explorer's Notes tracker */}
      <NotesTracker notes={player.notes} />

      {/* Item Inventory */}
      <Inventory items={player.items} />

      {/* Dino Summary */}
      <DinoSummary dinos={player.dinos} />
    </div>
  );
}

const styles = {
  page: {
    padding: '20px 16px 80px',
    maxWidth: '480px',
    margin: '0 auto',
    background: '#0a0a0a',
    minHeight: '100dvh',
    color: '#e0e0e0',
  },

  // Header
  header: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    marginBottom: '20px',
  },
  avatarImg: {
    width: '80px',
    height: '80px',
    borderRadius: '50%',
    objectFit: 'cover',
    border: '3px solid #6366f1',
    marginBottom: '12px',
  },
  avatarPlaceholder: {
    width: '80px',
    height: '80px',
    borderRadius: '50%',
    background: '#1a1a2e',
    border: '3px solid #6366f1',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '12px',
  },
  avatarInitial: {
    fontSize: '32px',
    fontWeight: 'bold',
    color: '#6366f1',
  },
  playerName: {
    margin: '0 0 4px',
    fontSize: '24px',
    fontWeight: 'bold',
    color: '#ffffff',
  },
  playerSub: {
    margin: 0,
    fontSize: '13px',
    color: '#888',
  },

  // Stats row
  statsRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-around',
    background: '#111',
    borderRadius: '12px',
    padding: '14px 8px',
    marginBottom: '16px',
    border: '1px solid #2a2a3e',
  },
  statBox: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '2px',
    flex: 1,
  },
  statValue: {
    fontSize: '20px',
    fontWeight: 'bold',
    color: '#ffffff',
  },
  statLabel: {
    fontSize: '11px',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  statDivider: {
    width: '1px',
    height: '32px',
    background: '#2a2a3e',
  },

  // Inspiration badge
  inspirationCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    background: '#1c1500',
    border: '2px solid #f59e0b',
    borderRadius: '12px',
    padding: '14px 16px',
    marginBottom: '16px',
  },
  inspirationText: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  inspirationTitle: {
    fontSize: '15px',
    fontWeight: 'bold',
    color: '#f59e0b',
  },
  inspirationDesc: {
    fontSize: '12px',
    color: '#92741a',
  },

  // Sections
  section: {
    background: '#111',
    borderRadius: '12px',
    padding: '14px 16px',
    marginBottom: '16px',
    border: '1px solid #1a1a2e',
  },
  sectionTitle: {
    margin: '0 0 12px',
    fontSize: '15px',
    fontWeight: 'bold',
    color: '#e0e0e0',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },
  emptyText: {
    color: '#888',
    fontSize: '13px',
    margin: 0,
    textAlign: 'center',
    padding: '8px 0',
  },

  // Notes tracker
  notesRow: {
    display: 'flex',
    gap: '8px',
    marginBottom: '10px',
  },
  noteSlot: {
    flex: 1,
    borderRadius: '8px',
    height: '44px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressBarBg: {
    height: '6px',
    background: '#1a1a2e',
    borderRadius: '3px',
    overflow: 'hidden',
    marginBottom: '6px',
  },
  progressBarFill: {
    height: '100%',
    background: '#22c55e',
    borderRadius: '3px',
    transition: 'width 0.4s ease',
  },
  notesCount: {
    margin: 0,
    fontSize: '12px',
    color: '#888',
    textAlign: 'right',
  },

  // Inventory grid
  inventoryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '8px',
  },
  hatCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px',
    background: '#0a0a0a',
    border: '1.5px solid',
    borderRadius: '10px',
    padding: '12px 8px',
    textAlign: 'center',
  },
  hatName: {
    fontSize: '12px',
    color: '#e0e0e0',
    lineHeight: 1.2,
  },
  rarityBadge: {
    fontSize: '10px',
    textTransform: 'capitalize',
    fontWeight: 'bold',
  },

  // Dino summary
  dinoList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    marginBottom: '10px',
  },
  dinoRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    background: '#0a0a0a',
    borderRadius: '8px',
    padding: '10px 12px',
    border: '1px solid #1a1a2e',
  },
  dinoRowInfo: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '1px',
  },
  dinoRowName: {
    fontSize: '14px',
    fontWeight: 'bold',
    color: '#e0e0e0',
  },
  dinoRowMeta: {
    fontSize: '11px',
    color: '#888',
  },
  dinoRowLevel: {
    fontSize: '12px',
    color: '#6366f1',
    fontWeight: 'bold',
  },
  partnerBadge: {
    fontSize: '10px',
    background: '#166534',
    color: '#4ade80',
    borderRadius: '4px',
    padding: '1px 6px',
    fontWeight: 'bold',
  },
  linkBtn: {
    background: 'none',
    border: 'none',
    color: '#6366f1',
    fontSize: '13px',
    cursor: 'pointer',
    padding: 0,
    marginTop: '2px',
    textDecoration: 'underline',
  },
};
