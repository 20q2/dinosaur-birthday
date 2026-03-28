import { useState, useEffect } from 'preact/hooks';
import { store } from '../store.js';
import { useStore } from '../router.jsx';
import { api } from '../api.js';
import { TitleBar } from './TitleBar.jsx';
import { LOBBY_SYMBOLS } from '../data/lobbySymbols.js';
import { Gamepad2, Handshake, Lightbulb } from 'lucide-preact';

function SymbolIcon({ sym, size }) {
  const s = LOBBY_SYMBOLS.find(s => s.id === sym);
  if (!s) return <span style={{ color: '#444' }}>?</span>;
  return <img src={s.img} style={{ width: size, height: size, imageRendering: 'pixelated' }} />;
}

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

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const recentPlays = getCooldowns().filter(p => p.expiresAt > Date.now());
  const hasPartner = player?.dinos?.some(d => d.is_partner && d.tamed);

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
      <TitleBar title="Play Together" subtitle="Team up with another dino tamer!" />

      <div style={styles.content}>
      {!hasPartner && (
        <div style={styles.hint}>
          <Lightbulb size={20} color="#a78bfa" />
          <span>Set a tamed dino as your Plaza Partner before you can play!</span>
        </div>
      )}

      <button
        onClick={handleHost}
        disabled={busy || !hasPartner}
        style={{ ...styles.hostBtn, opacity: hasPartner ? 1 : 0.4 }}
      >
        <div style={styles.bigBtnIconWrap}>
          <Gamepad2 size={32} color="#4ade80" />
        </div>
        <div style={styles.bigBtnText}>
          <div style={styles.bigBtnLabel}>Host a Lobby</div>
          <div style={styles.bigBtnSub}>Get a code, share with a friend</div>
        </div>
        <span style={styles.bigBtnArrow}>›</span>
      </button>

      {!showJoin ? (
        <button
          onClick={() => { setShowJoin(true); setError(''); }}
          disabled={busy || !hasPartner}
          style={{ ...styles.joinBtn, opacity: hasPartner ? 1 : 0.4 }}
        >
          <div style={styles.bigBtnIconWrap}>
            <Handshake size={32} color="#60a5fa" />
          </div>
          <div style={styles.bigBtnText}>
            <div style={styles.bigBtnLabel}>Join a Lobby</div>
            <div style={styles.bigBtnSub}>Enter a 3-symbol code</div>
          </div>
          <span style={styles.bigBtnArrow}>›</span>
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
                  background: selectedSymbols[i] ? '#1e293b' : '#1f2937',
                }}>
                  {selectedSymbols[i]
                    ? <SymbolIcon sym={selectedSymbols[i]} size="28px" />
                    : <span style={{ color: '#444', fontSize: '20px' }}>?</span>}
                </div>
                <div style={styles.symbolGrid}>
                  {LOBBY_SYMBOLS.map(s => (
                    <button
                      key={s.id}
                      onClick={() => handleSymbolPick(i, s.id)}
                      style={{
                        ...styles.symbolBtn,
                        background: selectedSymbols[i] === s.id ? '#1e3a5f' : 'transparent',
                        borderColor: selectedSymbols[i] === s.id ? '#60a5fa' : '#222',
                      }}
                      title={s.label}
                    >
                      <SymbolIcon sym={s.id} size="18px" />
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

      <div style={styles.howSection}>
        <div style={styles.howTitle}>How It Works</div>
        <div style={styles.stepsContainer}>
          <div style={styles.step}>
            <div style={styles.stepNum}>1</div>
            <div style={styles.stepText}>
              <strong style={styles.stepLabel}>Pair up</strong>
              <span style={styles.stepDesc}>One player hosts, the other joins with the symbol code</span>
            </div>
          </div>
          <div style={styles.stepDivider} />
          <div style={styles.step}>
            <div style={styles.stepNum}>2</div>
            <div style={styles.stepText}>
              <strong style={styles.stepLabel}>Answer trivia</strong>
              <span style={styles.stepDesc}>While your dinos are off playing, you both get a dino trivia question — work together to answer correctly!</span>
            </div>
          </div>
          <div style={styles.stepDivider} />
          <div style={styles.step}>
            <div style={styles.stepNum}>3</div>
            <div style={styles.stepText}>
              <strong style={styles.stepLabel}>Earn rewards</strong>
              <span style={styles.stepDesc}>Your Plaza Partner earns XP and you might get a hat drop</span>
            </div>
          </div>
        </div>
      </div>

      </div>
    </div>
  );
}

const styles = {
  page: {
    display: 'flex', flexDirection: 'column',
    paddingBottom: '80px',
    background: 'linear-gradient(180deg, #0f1a2e 0%, #0a0f1a 40%, #0d1117 100%)',
    minHeight: '100vh',
  },
  content: {
    display: 'flex', flexDirection: 'column', gap: '12px',
    padding: '16px',
  },
  hostBtn: {
    display: 'flex', alignItems: 'center', gap: '14px',
    padding: '18px 20px', borderRadius: '14px',
    border: '1.5px solid #22633480',
    background: 'linear-gradient(135deg, #14532d 0%, #166534 100%)',
    cursor: 'pointer', textAlign: 'left', width: '100%',
    boxShadow: '0 2px 12px rgba(34, 197, 94, 0.08)',
  },
  joinBtn: {
    display: 'flex', alignItems: 'center', gap: '14px',
    padding: '18px 20px', borderRadius: '14px',
    border: '1.5px solid #1e3a5f80',
    background: 'linear-gradient(135deg, #172554 0%, #1e3a5f 100%)',
    cursor: 'pointer', textAlign: 'left', width: '100%',
    boxShadow: '0 2px 12px rgba(96, 165, 250, 0.06)',
  },
  bigBtnIconWrap: {
    flexShrink: 0,
    width: '48px', height: '48px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'rgba(255,255,255,0.06)', borderRadius: '12px',
  },
  bigBtnText: { flex: 1 },
  bigBtnLabel: { fontSize: '16px', fontWeight: 'bold', color: '#e5e7eb' },
  bigBtnSub: { fontSize: '12px', color: '#9ca3af', marginTop: '3px' },
  bigBtnArrow: { fontSize: '22px', color: '#4b5563', flexShrink: 0 },
  joinCard: {
    background: '#111827', border: '1.5px solid #374151', borderRadius: '14px',
    padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px',
  },
  joinTitle: { color: '#e0e0e0', fontSize: '15px', fontWeight: 'bold', textAlign: 'center' },
  slots: { display: 'flex', gap: '10px', justifyContent: 'center' },
  slotWrapper: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', flex: 1 },
  slot: {
    width: '52px', height: '52px', borderRadius: '10px', border: '2px solid',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'border-color 0.2s, background 0.2s',
  },
  symbolGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '4px', width: '100%',
  },
  symbolBtn: {
    padding: '6px', borderRadius: '6px', border: '1px solid',
    cursor: 'pointer', lineHeight: 1,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
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
  howSection: {
    background: '#0d1117', border: '1px solid #1e293b', borderRadius: '14px',
    padding: '18px', marginTop: '4px',
  },
  howTitle: {
    color: '#9ca3af', fontSize: '11px', fontWeight: 'bold',
    textTransform: 'uppercase', letterSpacing: '1px',
    marginBottom: '14px',
  },
  stepsContainer: {
    display: 'flex', flexDirection: 'column', gap: '0',
  },
  step: {
    display: 'flex', alignItems: 'flex-start', gap: '14px',
    padding: '2px 0',
  },
  stepNum: {
    width: '28px', height: '28px', borderRadius: '50%',
    background: '#1e293b', border: '1.5px solid #334155',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '13px', fontWeight: 'bold', color: '#94a3b8',
    flexShrink: 0,
  },
  stepText: {
    display: 'flex', flexDirection: 'column', gap: '2px',
    paddingTop: '3px',
  },
  stepLabel: { color: '#e2e8f0', fontSize: '14px' },
  stepDesc: { color: '#64748b', fontSize: '12px', lineHeight: '1.4' },
  stepDivider: {
    width: '1.5px', height: '16px', background: '#1e293b',
    marginLeft: '13px',
  },
  hint: {
    display: 'flex', alignItems: 'center', gap: '10px',
    background: '#1a1a2e', borderRadius: '10px', padding: '14px',
    color: '#a78bfa', fontSize: '13px',
  },
};
