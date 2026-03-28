import { useState, useEffect } from 'preact/hooks';
import { store } from '../store.js';
import { useStore } from '../router.jsx';
import { api } from '../api.js';
import { ws } from '../ws.js';

const SYMBOL_EMOJI = {
  meat: '🥩', mejoberry: '🫐', party_hat: '🎉', cowboy_hat: '🤠',
  top_hat: '🎩', sunglasses: '😎', paint: '🎨', bone: '🦴', egg: '🥚',
};

const ALL_SYMBOLS = Object.keys(SYMBOL_EMOJI);

export function PlayLobby({ code }) {
  const { player } = useStore();

  // Determine role from store (set before navigating here)
  const isHost = store.lobbyRole === 'host';

  // Host state: the symbols that make up the code
  const [symbols, setSymbols] = useState(() => code ? code.split('_') : []);
  const [status, setStatus] = useState('waiting'); // 'waiting' | 'active'
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(null);

  // Join state (for when an external player is sent here directly, role = 'join')
  const [selectedSymbols, setSelectedSymbols] = useState([null, null, null]);
  const [joinBusy, setJoinBusy] = useState(false);

  // Subscribe to lobby WebSocket channel
  useEffect(() => {
    ws.subscribe(`lobby:${code}`);

    const offTrivia = ws.on(`lobby:${code}`, 'trivia_start', () => {
      // A guest joined — navigate host to trivia
      setStatus('active');
      setCountdown(3);
    });

    return () => {
      offTrivia();
    };
  }, [code]);

  // Count down then navigate when match is confirmed
  useEffect(() => {
    if (countdown === null) return;
    if (countdown === 0) {
      store.navigate(`/play/trivia/${code}`);
      return;
    }
    const id = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(id);
  }, [countdown, code]);

  // Host view: show the code symbols for the other player to enter
  if (isHost) {
    return (
      <div style={styles.page}>
        <div style={styles.header}>
          <button onClick={() => store.navigate('/play')} style={styles.backBtn}>
            Back
          </button>
          <h2 style={styles.headerTitle}>Your Lobby</h2>
          <div style={{ width: '48px' }} />
        </div>

        <div style={styles.codeCard}>
          <div style={styles.codeLabel}>Share this code:</div>
          <div style={styles.symbolRow}>
            {symbols.map((sym, i) => (
              <div key={i} style={styles.symbolBig}>
                <span style={styles.symbolEmoji}>{SYMBOL_EMOJI[sym] || '?'}</span>
                <span style={styles.symbolName}>{sym.replace('_', ' ')}</span>
              </div>
            ))}
          </div>
          <div style={styles.codeText}>{code}</div>
        </div>

        {status === 'waiting' && (
          <div style={styles.waitingBox}>
            <div style={styles.waitingDots}>
              <span style={styles.dot} />
              <span style={{ ...styles.dot, animationDelay: '0.2s' }} />
              <span style={{ ...styles.dot, animationDelay: '0.4s' }} />
            </div>
            <p style={styles.waitingText}>Waiting for a friend to join...</p>
            <p style={styles.waitingHint}>Show them these 3 symbols!</p>
          </div>
        )}

        {status === 'active' && countdown !== null && (
          <div style={styles.matchedBox}>
            <div style={{ fontSize: '48px' }}>🎉</div>
            <div style={styles.matchedText}>A friend joined!</div>
            <div style={styles.countdown}>Starting in {countdown}...</div>
          </div>
        )}

        <style>{dotAnimation}</style>
      </div>
    );
  }

  // Guest / join view: symbol picker (if code is empty, they pick their code here)
  async function handleJoin() {
    const filled = selectedSymbols.filter(Boolean);
    if (filled.length < 3) {
      setError('Pick all 3 symbols');
      return;
    }
    const joinCode = selectedSymbols.join('_');
    setJoinBusy(true);
    setError('');
    try {
      const data = await api.joinLobby(store.playerId, joinCode);
      store.lobbyRole = 'guest';
      store.lobbyTrivia = data.trivia;
      store.navigate(`/play/trivia/${joinCode}`);
    } catch (err) {
      setError(err.message || 'Could not join lobby');
    }
    setJoinBusy(false);
  }

  function handleSymbolPick(slotIndex, symbol) {
    const next = [...selectedSymbols];
    next[slotIndex] = symbol;
    setSelectedSymbols(next);
  }

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <button onClick={() => store.navigate('/play')} style={styles.backBtn}>
          Back
        </button>
        <h2 style={styles.headerTitle}>Join Lobby</h2>
        <div style={{ width: '48px' }} />
      </div>

      <div style={styles.joinCard}>
        <div style={styles.joinTitle}>Pick the 3 symbols in order</div>
        <div style={styles.slots}>
          {[0, 1, 2].map(i => (
            <div key={i} style={styles.slotWrapper}>
              <div style={{
                ...styles.slot,
                borderColor: selectedSymbols[i] ? '#60a5fa' : '#333',
              }}>
                {selectedSymbols[i]
                  ? SYMBOL_EMOJI[selectedSymbols[i]]
                  : <span style={{ color: '#444', fontSize: '18px' }}>?</span>}
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

        {error && <div style={styles.errorMsg}>{error}</div>}

        <button
          onClick={handleJoin}
          disabled={joinBusy || selectedSymbols.some(s => !s)}
          style={{
            ...styles.btn,
            opacity: selectedSymbols.some(s => !s) ? 0.5 : 1,
          }}
        >
          {joinBusy ? 'Joining...' : 'Join Lobby'}
        </button>
      </div>
    </div>
  );
}

const dotAnimation = `
@keyframes bounce {
  0%, 80%, 100% { transform: scale(0); }
  40% { transform: scale(1); }
}
`;

const styles = {
  page: {
    display: 'flex', flexDirection: 'column', gap: '16px',
    padding: '16px 16px 80px', minHeight: '100dvh',
  },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: '4px',
  },
  headerTitle: { fontSize: '18px', margin: 0, color: '#e0e0e0' },
  backBtn: {
    background: 'none', border: '1px solid #333', borderRadius: '8px',
    color: '#aaa', padding: '6px 12px', cursor: 'pointer', fontSize: '14px',
  },
  codeCard: {
    background: '#0f2a1a', border: '2px solid #4ade80', borderRadius: '16px',
    padding: '24px', textAlign: 'center', display: 'flex',
    flexDirection: 'column', alignItems: 'center', gap: '16px',
  },
  codeLabel: { color: '#86efac', fontSize: '13px', fontWeight: 'bold', textTransform: 'uppercase' },
  symbolRow: { display: 'flex', gap: '16px', justifyContent: 'center' },
  symbolBig: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
  },
  symbolEmoji: { fontSize: '52px' },
  symbolName: { color: '#86efac', fontSize: '11px', textTransform: 'capitalize' },
  codeText: {
    color: '#4ade80', fontSize: '12px', fontFamily: 'monospace',
    background: '#0a1a0a', padding: '6px 14px', borderRadius: '8px',
  },
  waitingBox: {
    background: '#111827', border: '1px solid #1f2937', borderRadius: '14px',
    padding: '28px', textAlign: 'center', display: 'flex',
    flexDirection: 'column', alignItems: 'center', gap: '10px',
  },
  waitingDots: { display: 'flex', gap: '8px', alignItems: 'center', height: '20px' },
  dot: {
    width: '10px', height: '10px', background: '#4ade80', borderRadius: '50%',
    display: 'inline-block',
    animation: 'bounce 1.2s infinite ease-in-out',
  },
  waitingText: { color: '#e0e0e0', fontSize: '15px', margin: 0 },
  waitingHint: { color: '#6b7280', fontSize: '12px', margin: 0 },
  matchedBox: {
    background: '#0f2a1a', border: '2px solid #4ade80', borderRadius: '14px',
    padding: '28px', textAlign: 'center', display: 'flex',
    flexDirection: 'column', alignItems: 'center', gap: '10px',
  },
  matchedText: { color: '#4ade80', fontSize: '18px', fontWeight: 'bold' },
  countdown: { color: '#86efac', fontSize: '32px', fontWeight: 'bold' },
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
    display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px', width: '100%',
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
  errorMsg: {
    background: '#1c0a0a', border: '1px solid #7f1d1d', borderRadius: '8px',
    color: '#ef4444', padding: '12px', fontSize: '13px', textAlign: 'center',
  },
};
