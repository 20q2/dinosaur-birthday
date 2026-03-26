import { useState, useEffect } from 'preact/hooks';
import { store } from '../store.js';
import { useStore } from '../router.jsx';
import { api } from '../api.js';

const SYMBOL_EMOJI = {
  meat: '🥩', mejoberry: '🫐', party_hat: '🎉', cowboy_hat: '🤠',
  top_hat: '🎩', sunglasses: '😎', paint: '🎨', bone: '🦴', egg: '🥚', leaf: '🍃',
};

const ALL_SYMBOLS = Object.keys(SYMBOL_EMOJI);

// LocalStorage key for recent plays cooldown tracking
const RECENT_PLAYS_KEY = 'dino_party_recent_plays';

function getCooldowns() {
  try {
    return JSON.parse(localStorage.getItem(RECENT_PLAYS_KEY) || '[]');
  } catch {
    return [];
  }
}

function formatTimeLeft(expiresAt) {
  const now = Date.now();
  const diff = Math.max(0, expiresAt - now);
  const totalSec = Math.floor(diff / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}m ${s}s`;
}

export function PlayMenu() {
  const { player } = useStore();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [showJoin, setShowJoin] = useState(false);
  const [selectedSymbols, setSelectedSymbols] = useState([null, null, null]);
  const [tick, setTick] = useState(0);

  // Tick every second to update cooldown timers
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const recentPlays = getCooldowns().filter(p => p.expiresAt > Date.now());

  async function handleHost() {
    setBusy(true);
    setError('');
    try {
      const data = await api.createLobby(store.playerId);
      store.lobbyRole = 'host';
      store.navigate(`/play/lobby/${data.code}`);
    } catch (err) {
      setError(err.message || 'Could not create lobby');
    }
    setBusy(false);
  }

  function handleSymbolPick(slotIndex, symbol) {
    const next = [...selectedSymbols];
    next[slotIndex] = symbol;
    setSelectedSymbols(next);
  }

  async function handleJoinSubmit() {
    const filled = selectedSymbols.filter(Boolean);
    if (filled.length < 3) {
      setError('Pick all 3 symbols');
      return;
    }
    const code = selectedSymbols.join('_');
    setBusy(true);
    setError('');
    try {
      const data = await api.joinLobby(store.playerId, code);
      store.lobbyRole = 'guest';
      store.lobbyTrivia = data.trivia;
      store.navigate(`/play/trivia/${code}`);
    } catch (err) {
      setError(err.message || 'Could not join lobby');
    }
    setBusy(false);
  }

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <h2 style={styles.title}>Play Together</h2>
        <p style={styles.subtitle}>Team up with another dino tamer!</p>
      </div>

      {/* Host button */}
      <button
        onClick={handleHost}
        disabled={busy}
        style={{ ...styles.bigBtn, background: '#166534', borderColor: '#4ade80' }}
      >
        <span style={styles.bigBtnIcon}>🎮</span>
        <div>
          <div style={styles.bigBtnLabel}>Host a Lobby</div>
          <div style={styles.bigBtnSub}>Get a code, share with a friend</div>
        </div>
      </button>

      {/* Join button / picker */}
      {!showJoin ? (
        <button
          onClick={() => { setShowJoin(true); setError(''); }}
          disabled={busy}
          style={{ ...styles.bigBtn, background: '#1e3a5f', borderColor: '#60a5fa' }}
        >
          <span style={styles.bigBtnIcon}>🤝</span>
          <div>
            <div style={styles.bigBtnLabel}>Join a Lobby</div>
            <div style={styles.bigBtnSub}>Enter a 3-symbol code</div>
          </div>
        </button>
      ) : (
        <div style={styles.joinCard}>
          <div style={styles.joinTitle}>Pick the 3 symbols</div>
          <div style={styles.slots}>
            {[0, 1, 2].map(i => (
              <div key={i} style={styles.slotWrapper}>
                <div style={{
                  ...styles.slot,
                  borderColor: selectedSymbols[i] ? '#60a5fa' : '#333',
                }}>
                  {selectedSymbols[i]
                    ? SYMBOL_EMOJI[selectedSymbols[i]]
                    : <span style={{ color: '#444' }}>?</span>}
                </div>
                <div style={styles.symbolGrid}>
                  {ALL_SYMBOLS.map(sym => (
                    <button
                      key={sym}
                      onClick={() => handleSymbolPick(i, sym)}
                      style={{
                        ...styles.symbolBtn,
                        background: selectedSymbols[i] === sym ? '#1e3a5f' : 'transparent',
                        borderColor: selectedSymbols[i] === sym ? '#60a5fa' : '#222',
                      }}
                      title={sym}
                    >
                      {SYMBOL_EMOJI[sym]}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={handleJoinSubmit}
            disabled={busy || selectedSymbols.some(s => !s)}
            style={{
              ...styles.btn,
              opacity: selectedSymbols.some(s => !s) ? 0.5 : 1,
            }}
          >
            {busy ? 'Joining...' : 'Join Lobby'}
          </button>
          <button
            onClick={() => { setShowJoin(false); setSelectedSymbols([null, null, null]); setError(''); }}
            style={styles.ghostBtn}
          >
            Cancel
          </button>
        </div>
      )}

      {error && <div style={styles.errorMsg}>{error}</div>}

      {/* Recent plays / cooldown section */}
      {recentPlays.length > 0 && (
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Recent Plays</div>
          {recentPlays.map((play, idx) => (
            <div key={idx} style={styles.cooldownRow}>
              <span style={styles.cooldownLabel}>{play.withName || 'A tamer'}</span>
              <span style={styles.cooldownTimer}>
                Cooldown: {formatTimeLeft(play.expiresAt)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Partner dino reminder */}
      {player && !player.dinos?.some(d => d.is_partner && d.tamed) && (
        <div style={styles.hint}>
          <span style={{ fontSize: '20px' }}>💡</span>
          <span>Set a tamed dino as your Plaza Partner to earn XP from play!</span>
        </div>
      )}
    </div>
  );
}

const styles = {
  page: {
    display: 'flex', flexDirection: 'column', gap: '14px',
    padding: '20px 16px 80px',
  },
  header: { textAlign: 'center', marginBottom: '4px' },
  title: { color: '#4ade80', fontSize: '22px', margin: '0 0 4px' },
  subtitle: { color: '#86efac', fontSize: '13px', margin: 0 },
  bigBtn: {
    display: 'flex', alignItems: 'center', gap: '16px',
    padding: '18px 20px', borderRadius: '14px', border: '2px solid',
    cursor: 'pointer', textAlign: 'left', width: '100%',
  },
  bigBtnIcon: { fontSize: '36px', flexShrink: 0 },
  bigBtnLabel: { fontSize: '16px', fontWeight: 'bold', color: '#e0e0e0' },
  bigBtnSub: { fontSize: '12px', color: '#888', marginTop: '2px' },
  joinCard: {
    background: '#111827', border: '1.5px solid #374151', borderRadius: '14px',
    padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px',
  },
  joinTitle: { color: '#e0e0e0', fontSize: '15px', fontWeight: 'bold', textAlign: 'center' },
  slots: { display: 'flex', gap: '10px', justifyContent: 'center' },
  slotWrapper: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', flex: 1 },
  slot: {
    width: '52px', height: '52px', borderRadius: '10px', border: '2px solid',
    background: '#1f2937', display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '28px',
  },
  symbolGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '4px', width: '100%',
  },
  symbolBtn: {
    fontSize: '18px', padding: '4px', borderRadius: '6px', border: '1px solid',
    cursor: 'pointer', lineHeight: 1,
  },
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
  errorMsg: {
    background: '#1c0a0a', border: '1px solid #7f1d1d', borderRadius: '8px',
    color: '#ef4444', padding: '12px', fontSize: '13px', textAlign: 'center',
  },
  section: {
    background: '#111827', border: '1px solid #1f2937', borderRadius: '12px',
    padding: '14px',
  },
  sectionTitle: {
    color: '#9ca3af', fontSize: '11px', fontWeight: 'bold',
    textTransform: 'uppercase', marginBottom: '10px',
  },
  cooldownRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '8px 0', borderBottom: '1px solid #1f2937',
    fontSize: '13px',
  },
  cooldownLabel: { color: '#e0e0e0' },
  cooldownTimer: { color: '#f59e0b', fontSize: '12px' },
  hint: {
    display: 'flex', alignItems: 'center', gap: '10px',
    background: '#1a1a2e', borderRadius: '10px', padding: '14px',
    color: '#a78bfa', fontSize: '13px',
  },
};
