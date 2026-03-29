import { useState, useEffect, useRef } from 'preact/hooks';
import { store } from '../store.js';
import { useStore } from '../router.jsx';
import { api } from '../api.js';
import { ws } from '../ws.js';
import { DinoPlayScene } from './DinoPlayScene.jsx';
import { TitleBar } from './TitleBar.jsx';
import { Gamepad2, Handshake } from 'lucide-preact';

import { LOBBY_SYMBOLS } from '../data/lobbySymbols.js';

const COOLDOWN_MS = 15 * 60 * 1000;
const RECENT_PLAYS_KEY = 'dino_party_recent_plays';

function SymbolDisplay({ sym, size = '28px' }) {
  const s = LOBBY_SYMBOLS.find(s => s.id === sym);
  if (!s) return <span style={{ color: '#444' }}>?</span>;
  return <img src={s.img} style={{ width: size, height: size, imageRendering: 'pixelated' }} />;
}

function getSymbolLabel(id) {
  return LOBBY_SYMBOLS.find(s => s.id === id)?.label || id;
}

function getRecentPlays() {
  try {
    const entries = JSON.parse(localStorage.getItem(RECENT_PLAYS_KEY) || '[]');
    return entries.filter(e => e.expiresAt > Date.now());
  } catch { return []; }
}

function formatCountdown(ms) {
  const mins = Math.floor(ms / 60000);
  const secs = Math.floor((ms % 60000) / 1000);
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
}

export function PlayTogether() {
  const { player } = useStore();
  const sceneRef = useRef(null);

  // Phase state machine
  const [phase, setPhase] = useState('menu');
  const [lobbyCode, setLobbyCode] = useState('');
  const [role, setRole] = useState(null); // 'host' | 'guest'
  const [trivia, setTrivia] = useState(null);
  const [hostTrivia, setHostTrivia] = useState(null); // stored from create_lobby for reliability
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [result, setResult] = useState(null);
  const [partnerDinoData, setPartnerDinoData] = useState(null);
  const [partnerAnswered, setPartnerAnswered] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const hasAnsweredRef = useRef(false);

  // Symbol picker state (for joining)
  const [joinSymbols, setJoinSymbols] = useState([]);
  const [lobbySymbols, setLobbySymbols] = useState([]);

  // Cooldown display
  const [recentPlays, setRecentPlays] = useState([]);
  useEffect(() => {
    setRecentPlays(getRecentPlays());
    const iv = setInterval(() => setRecentPlays(getRecentPlays()), 1000);
    return () => clearInterval(iv);
  }, [phase]);

  // Initialize my dino in the scene
  useEffect(() => {
    const partner = player?.dinos?.find(d => d.is_partner && d.tamed);
    if (partner && sceneRef.current) {
      sceneRef.current.setMyDino({
        species: partner.species,
        colors: partner.colors || {},
        hat: partner.hat || '',
        background: partner.background || '',
      });
    }
  }, [player]);

  const hasPartner = player?.dinos?.some(d => d.is_partner && d.tamed);

  // -- WebSocket subscription --
  useEffect(() => {
    if (!lobbyCode) return;

    const unsub1 = ws.on(`lobby:${lobbyCode}`, 'trivia_start', (data) => {
      const myPartnerDino = role === 'host' ? data.guest_dino : data.host_dino;
      if (myPartnerDino && sceneRef.current) {
        sceneRef.current.setPartnerDino(myPartnerDino);
        setPartnerDinoData(myPartnerDino);
      }
      setTrivia({ question: data.question, options: data.options });
      setPhase('countdown');
    });

    const unsub2 = ws.on(`lobby:${lobbyCode}`, 'trivia_result', (data) => {
      // Only auto-advance to results if this player has already submitted their answer.
      // Otherwise show a "partner answered" indicator so they can still answer.
      if (hasAnsweredRef.current) {
        setResult(data);
        setPhase('results');
      } else {
        setPartnerAnswered(true);
      }
    });

    ws.subscribe(`lobby:${lobbyCode}`);

    return () => {
      unsub1();
      unsub2();
    };
  }, [lobbyCode, role]);

  // Countdown timer
  useEffect(() => {
    if (phase !== 'countdown') return;
    setCountdown(3);
    const iv = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(iv);
          setPhase('trivia');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(iv);
  }, [phase]);

  // -- Actions --
  async function handleHost() {
    setLoading(true);
    setError('');
    try {
      const data = await api.createLobby(store.playerId);
      setLobbyCode(data.code);
      setLobbySymbols(data.symbols);
      setHostTrivia(data.trivia || null);
      setRole('host');
      store.lobbyRole = 'host';
      setPhase('lobby');
    } catch (err) {
      setError(err.message || 'Failed to create lobby');
    }
    setLoading(false);
  }

  function handleStartJoin() {
    setJoinSymbols([]);
    setRole('guest');
    store.lobbyRole = 'guest';
    setPhase('lobby');
  }

  async function handleJoinSubmit() {
    if (joinSymbols.length !== 3) return;
    const code = joinSymbols.join('-');
    setLoading(true);
    setError('');
    try {
      const data = await api.joinLobby(store.playerId, code);
      setLobbyCode(code);
      store.lobbyTrivia = data.trivia;

      // Set partner dino from response
      const myPartnerDino = data.host_dino;
      if (myPartnerDino && sceneRef.current) {
        sceneRef.current.setPartnerDino(myPartnerDino);
        setPartnerDinoData(myPartnerDino);
      }

      setTrivia(data.trivia);
      setPhase('countdown');
    } catch (err) {
      setError(err.message || 'Failed to join lobby');
    }
    setLoading(false);
  }

  async function handleAnswer(index) {
    if (selectedAnswer !== null) return;
    setSelectedAnswer(index);
    hasAnsweredRef.current = true;
    try {
      const data = await api.answerTrivia(store.playerId, lobbyCode, index);
      setResult(data);
      setPhase('results');
      await store.refresh();
      if (data.partner_id) {
        try {
          const entries = JSON.parse(localStorage.getItem(RECENT_PLAYS_KEY) || '[]');
          const filtered = entries.filter(e => e.partnerId !== data.partner_id);
          filtered.push({ partnerId: data.partner_id, withName: data.partner_name || data.partner_id, expiresAt: Date.now() + COOLDOWN_MS });
          localStorage.setItem(RECENT_PLAYS_KEY, JSON.stringify(filtered));
        } catch {}
      }
    } catch (err) {
      setError(err.message || 'Failed to submit answer');
    }
  }

  function handleBackToMenu() {
    if (sceneRef.current) sceneRef.current.clearPartnerDino();
    setPhase('menu');
    setLobbyCode('');
    setRole(null);
    setTrivia(null);
    setHostTrivia(null);
    setSelectedAnswer(null);
    setResult(null);
    setPartnerDinoData(null);
    setPartnerAnswered(false);
    hasAnsweredRef.current = false;
    setError('');
    store.lobbyRole = null;
    store.lobbyTrivia = null;
  }

  // -- Render --
  return (
    <div style={styles.page}>
      <TitleBar title="Play Together" subtitle="Team up with another dino tamer!" />

      {/* Dino scene -- always visible */}
      <DinoPlayScene ref={sceneRef} />

      {/* Phase-specific UI */}
      <div style={styles.content}>
        {error && <div style={styles.errorBanner}>{error}</div>}

        {phase === 'menu' && (
          <MenuPhase
            hasPartner={hasPartner}
            loading={loading}
            recentPlays={recentPlays}
            onHost={handleHost}
            onJoin={handleStartJoin}
          />
        )}

        {phase === 'lobby' && role === 'host' && (
          <HostLobbyPhase
            symbols={lobbySymbols}
            onCancel={handleBackToMenu}
          />
        )}

        {phase === 'lobby' && role === 'guest' && (
          <GuestLobbyPhase
            symbols={joinSymbols}
            setSymbols={setJoinSymbols}
            loading={loading}
            error={error}
            onSubmit={handleJoinSubmit}
            onCancel={handleBackToMenu}
          />
        )}

        {phase === 'countdown' && (
          <div style={styles.countdownOverlay}>
            <div style={styles.countdownText}>Get ready!</div>
            <div style={styles.countdownNumber}>{countdown}</div>
          </div>
        )}

        {phase === 'trivia' && trivia && (
          <TriviaPhase
            trivia={trivia}
            selectedAnswer={selectedAnswer}
            onAnswer={handleAnswer}
            partnerAnswered={partnerAnswered}
            onSeeResults={() => { setResult({}); setPhase('results'); }}
          />
        )}

        {phase === 'results' && result && (
          <ResultsPhase
            result={result}
            role={role}
            onBack={handleBackToMenu}
          />
        )}
      </div>
    </div>
  );
}

// -- Sub-components for each phase --

function MenuPhase({ hasPartner, loading, recentPlays, onHost, onJoin }) {
  return (
    <>
      {!hasPartner && (
        <div style={styles.partnerHint}>
          Set a dino as your Plaza Partner first to play!
        </div>
      )}

      <button
        onClick={onHost}
        disabled={loading || !hasPartner}
        style={{ ...styles.actionBtn, ...styles.hostBtn, opacity: hasPartner ? 1 : 0.5 }}
      >
        <div style={styles.actionBtnIcon}><Gamepad2 size={28} color="#4ade80" /></div>
        <div>
          <div style={styles.actionBtnTitle}>Host a Lobby</div>
          <div style={styles.actionBtnSub}>Get a code, share with a friend</div>
        </div>
        <span style={styles.chevron}>{'\u203A'}</span>
      </button>

      <button
        onClick={onJoin}
        disabled={loading || !hasPartner}
        style={{ ...styles.actionBtn, ...styles.joinBtn, opacity: hasPartner ? 1 : 0.5 }}
      >
        <div style={styles.actionBtnIcon}><Handshake size={28} color="#60a5fa" /></div>
        <div>
          <div style={styles.actionBtnTitle}>Join a Lobby</div>
          <div style={styles.actionBtnSub}>Enter a 3-symbol code</div>
        </div>
        <span style={styles.chevron}>{'\u203A'}</span>
      </button>

      <div style={styles.howItWorks}>
        <div style={styles.howTitle}>HOW IT WORKS</div>
        {[
          { num: '1', title: 'Pair up', desc: 'One player hosts, the other joins with the symbol code' },
          { num: '2', title: 'Answer trivia', desc: "While your dinos are off playing, you both get a dino trivia question \u2014 work together to answer correctly!" },
          { num: '3', title: 'Earn rewards', desc: 'Your Plaza Partner earns XP and you might get a hat drop' },
        ].map(step => (
          <div key={step.num} style={styles.step}>
            <div style={styles.stepNum}>{step.num}</div>
            <div>
              <div style={styles.stepTitle}>{step.title}</div>
              <div style={styles.stepDesc}>{step.desc}</div>
            </div>
          </div>
        ))}
      </div>

      {recentPlays.length > 0 && (
        <div style={styles.cooldownSection}>
          <div style={styles.cooldownTitle}>Recent Plays</div>
          {recentPlays.map((entry, i) => {
            const remaining = Math.max(0, entry.expiresAt - Date.now());
            const ready = remaining === 0;
            return (
              <div key={i} style={styles.cooldownRow}>
                <div style={styles.cooldownInfo}>
                  <Handshake size={14} color="#60a5fa" />
                  <span style={{ color: '#d1d5db', fontSize: '13px' }}>{entry.withName}</span>
                </div>
                {ready
                  ? <span style={{ color: '#4ade80', fontSize: '12px', fontWeight: '600' }}>Ready!</span>
                  : <span style={{ color: '#f59e0b', fontSize: '12px', fontFamily: 'monospace' }}>{formatCountdown(remaining)}</span>
                }
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

function HostLobbyPhase({ symbols = [], onCancel }) {

  return (
    <div style={styles.lobbyCard}>
      <div style={styles.lobbyTitle}>Your Code</div>
      <div style={styles.symbolRow}>
        {symbols.map((s, i) => (
          <div key={i} style={styles.symbolCard}>
            <SymbolDisplay sym={s} size="36px" />
            <div style={styles.symbolLabel}>{getSymbolLabel(s)}</div>
          </div>
        ))}
      </div>
      <div style={styles.waitingText}>
        Waiting for a friend to join...
      </div>
      <button onClick={onCancel} style={styles.ghostBtn}>Cancel</button>
    </div>
  );
}

function GuestLobbyPhase({ symbols, setSymbols, loading, error, onSubmit, onCancel }) {
  function handlePick(id) {
    if (symbols.length >= 3) return;
    setSymbols([...symbols, id]);
  }

  function handleClear() {
    setSymbols([]);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={styles.lobbyTitle}>Enter the 3-symbol code</div>

      {/* Selected slots */}
      <div style={styles.symbolRow}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{ ...styles.symbolSlot, borderColor: symbols[i] ? '#4ade80' : '#333' }}>
            {symbols[i] ? (
              <SymbolDisplay sym={symbols[i]} size="28px" />
            ) : (
              <span style={{ color: '#555', fontSize: '20px' }}>?</span>
            )}
          </div>
        ))}
      </div>

      {/* Symbol grid */}
      <div style={styles.symbolGrid}>
        {LOBBY_SYMBOLS.map(s => (
          <button
            key={s.id}
            onClick={() => handlePick(s.id)}
            disabled={symbols.length >= 3}
            style={styles.symbolPickBtn}
          >
            <SymbolDisplay sym={s.id} size="28px" />
            <span style={{ fontSize: '10px', color: '#aaa' }}>{s.label}</span>
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          onClick={onSubmit}
          disabled={symbols.length !== 3 || loading}
          style={{ ...styles.primaryBtn, opacity: symbols.length === 3 ? 1 : 0.5, flex: 1 }}
        >
          {loading ? 'Joining...' : 'Join!'}
        </button>
        <button onClick={handleClear} style={{ ...styles.ghostBtn, flex: 0, padding: '12px 16px' }}>
          Clear
        </button>
      </div>
      <button onClick={onCancel} style={styles.ghostBtn}>Cancel</button>
    </div>
  );
}

function TriviaPhase({ trivia, selectedAnswer, onAnswer, partnerAnswered, onSeeResults }) {
  const labels = ['A', 'B', 'C', 'D'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={styles.questionText}>{trivia.question}</div>
      {trivia.options.map((opt, i) => (
        <button
          key={i}
          onClick={() => onAnswer(i)}
          disabled={selectedAnswer !== null}
          style={{
            ...styles.answerBtn,
            borderColor: selectedAnswer === i ? '#4ade80' : '#333',
            background: selectedAnswer === i ? '#0f2a1a' : '#16213e',
            opacity: selectedAnswer !== null && selectedAnswer !== i ? 0.5 : 1,
          }}
        >
          <span style={styles.answerLabel}>{labels[i]}</span>
          <span>{opt}</span>
        </button>
      ))}
      {selectedAnswer !== null && (
        <div style={styles.waitingText}>Waiting for results...</div>
      )}
      {partnerAnswered && selectedAnswer === null && (
        <div style={styles.partnerAnsweredBanner}>
          <span>Your partner already answered!</span>
          <button onClick={onSeeResults} style={styles.seeResultsBtn}>See Results</button>
        </div>
      )}
    </div>
  );
}

function ResultsPhase({ result, role, onBack }) {
  const isCorrect = result.correct;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', alignItems: 'center' }}>
      <div style={{
        ...styles.resultBanner,
        background: isCorrect ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
        borderColor: isCorrect ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)',
        color: isCorrect ? '#4ade80' : '#f87171',
      }}>
        {isCorrect ? 'Correct!' : 'Incorrect'}
      </div>

      {!isCorrect && result.correct_index != null && (
        <div style={{ color: '#9ca3af', fontSize: '13px', textAlign: 'center' }}>
          The answer was: <strong>{String.fromCharCode(65 + result.correct_index)}</strong>
        </div>
      )}

      <div style={styles.rewardBox}>
        <div style={styles.rewardRow}>
          <span style={{ color: '#d1d5db' }}>XP Earned</span>
          <span style={{ color: '#f59e0b', fontWeight: 'bold' }}>+{result.xp_awarded} XP</span>
        </div>
        {result.reward && (
          <div style={styles.rewardRow}>
            <span style={{ color: '#d1d5db' }}>Reward</span>
            <span style={{ color: '#a78bfa', fontWeight: 'bold' }}>{result.reward}</span>
          </div>
        )}
      </div>

      <button onClick={onBack} style={styles.primaryBtn}>
        Back to Play
      </button>
    </div>
  );
}

// -- Styles --

const styles = {
  page: {
    display: 'flex', flexDirection: 'column',
    background: 'linear-gradient(180deg, #0f1a2e 0%, #0a0f1a 40%, #0d1117 100%)',
    minHeight: '100vh', paddingBottom: '80px',
  },
  content: {
    display: 'flex', flexDirection: 'column', gap: '14px',
    padding: '16px 16px 40px',
  },
  errorBanner: {
    background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)',
    borderRadius: '10px', padding: '10px 14px',
    color: '#f87171', fontSize: '14px', textAlign: 'center',
  },

  // Menu phase
  partnerHint: {
    background: '#1c1508', border: '1px solid #78350f40', borderRadius: '10px',
    padding: '12px', color: '#f59e0b', fontSize: '13px', textAlign: 'center',
  },
  actionBtn: {
    display: 'flex', alignItems: 'center', gap: '12px',
    width: '100%', padding: '16px', borderRadius: '14px',
    border: '2px solid', cursor: 'pointer', textAlign: 'left',
  },
  hostBtn: {
    background: 'linear-gradient(135deg, #166534, #14532d)',
    borderColor: '#22c55e40', color: '#e0e0e0',
  },
  joinBtn: {
    background: 'linear-gradient(135deg, #1e3a5f, #16213e)',
    borderColor: '#6366f140', color: '#e0e0e0',
  },
  actionBtnIcon: { fontSize: '28px', width: '44px', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '12px', background: 'rgba(255,255,255,0.05)' },
  actionBtnTitle: { fontSize: '15px', fontWeight: 'bold', color: '#e0e0e0' },
  actionBtnSub: { fontSize: '12px', color: '#9ca3af', marginTop: '2px' },
  chevron: { marginLeft: 'auto', fontSize: '24px', color: '#555' },

  // Lobby phase
  lobbyCard: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px',
    padding: '20px', borderRadius: '14px',
    background: 'rgba(22,33,62,0.8)', border: '1px solid #333',
  },
  lobbyTitle: { fontSize: '16px', fontWeight: 'bold', color: '#e0e0e0', textAlign: 'center' },
  symbolRow: { display: 'flex', gap: '12px', justifyContent: 'center' },
  symbolCard: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px',
    padding: '12px', borderRadius: '12px',
    background: '#166534', border: '2px solid #22c55e60',
    minWidth: '72px',
  },
  symbolLabel: { fontSize: '11px', color: '#86efac', fontWeight: '600' },
  symbolSlot: {
    width: '64px', height: '64px', borderRadius: '12px',
    border: '2px solid #333', background: '#0d1117',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  symbolGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px',
  },
  symbolPickBtn: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
    padding: '10px 6px', borderRadius: '10px',
    border: '2px solid #333', background: '#16213e',
    cursor: 'pointer',
  },
  waitingText: {
    color: '#9ca3af', fontSize: '14px', textAlign: 'center',
  },
  partnerAnsweredBanner: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    gap: '12px', padding: '12px 14px', borderRadius: '10px',
    background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)',
    color: '#f59e0b', fontSize: '13px',
  },
  seeResultsBtn: {
    padding: '6px 14px', borderRadius: '8px', border: 'none',
    background: '#f59e0b', color: '#000', fontSize: '13px',
    fontWeight: 'bold', cursor: 'pointer', flexShrink: 0,
  },

  // Countdown
  countdownOverlay: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', gap: '8px', padding: '40px 0',
  },
  countdownText: { fontSize: '18px', color: '#e0e0e0', fontWeight: '600' },
  countdownNumber: { fontSize: '64px', fontWeight: '900', color: '#4ade80' },

  // Trivia phase
  questionText: {
    fontSize: '18px', color: '#e5e7eb', fontWeight: '600',
    textAlign: 'center', lineHeight: '1.5', padding: '8px 0',
  },
  answerBtn: {
    display: 'flex', alignItems: 'center', gap: '12px',
    width: '100%', padding: '14px 16px', borderRadius: '12px',
    border: '2px solid #333', background: '#16213e',
    color: '#e0e0e0', fontSize: '15px', cursor: 'pointer',
    textAlign: 'left',
  },
  answerLabel: {
    width: '28px', height: '28px', borderRadius: '8px',
    background: 'rgba(255,255,255,0.08)', display: 'flex',
    alignItems: 'center', justifyContent: 'center',
    fontSize: '13px', fontWeight: 'bold', color: '#888', flexShrink: 0,
  },

  // Results phase
  resultBanner: {
    padding: '14px 24px', borderRadius: '12px',
    border: '1px solid', fontSize: '18px', fontWeight: 'bold',
  },
  rewardBox: {
    background: '#111827', border: '1px solid #1e293b', borderRadius: '12px',
    padding: '14px 18px', width: '100%', maxWidth: '320px',
    display: 'flex', flexDirection: 'column', gap: '8px',
  },
  rewardRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    fontSize: '14px',
  },

  // Shared
  primaryBtn: {
    padding: '16px', borderRadius: '12px', border: 'none',
    background: '#22c55e', color: 'white', fontSize: '16px',
    fontWeight: 'bold', cursor: 'pointer', width: '100%', maxWidth: '320px',
  },
  ghostBtn: {
    padding: '12px', borderRadius: '10px', border: '1px solid #333',
    background: 'none', color: '#aaa', fontSize: '14px',
    cursor: 'pointer', width: '100%',
  },

  // How It Works
  howItWorks: {
    background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: '14px', padding: '16px', marginTop: '4px',
  },
  howTitle: { fontSize: '12px', fontWeight: '800', color: '#888', letterSpacing: '1.5px', marginBottom: '12px' },
  step: { display: 'flex', gap: '12px', marginBottom: '12px' },
  stepNum: {
    width: '24px', height: '24px', borderRadius: '50%',
    background: '#166534', color: '#4ade80', fontSize: '12px', fontWeight: 'bold',
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  stepTitle: { fontSize: '14px', fontWeight: 'bold', color: '#e0e0e0' },
  stepDesc: { fontSize: '12px', color: '#9ca3af', lineHeight: '1.4', marginTop: '2px' },

  // Cooldown
  cooldownSection: {
    background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: '14px', padding: '14px 16px',
    display: 'flex', flexDirection: 'column', gap: '8px',
  },
  cooldownTitle: { fontSize: '12px', fontWeight: '800', color: '#888', letterSpacing: '1.5px', textTransform: 'uppercase' },
  cooldownRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)',
  },
  cooldownInfo: { display: 'flex', alignItems: 'center', gap: '8px' },
};
