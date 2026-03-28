import { useState, useEffect } from 'preact/hooks';
import { store } from '../store.js';
import { useStore } from '../router.jsx';
import { api } from '../api.js';
import { ws } from '../ws.js';
import { Footprints, CheckCircle2, XCircle, Zap, Crown } from 'lucide-preact';

const RECENT_PLAYS_KEY = 'dino_party_recent_plays';
const COOLDOWN_MS = 15 * 60 * 1000;

function saveCooldown(withName) {
  try {
    const existing = JSON.parse(localStorage.getItem(RECENT_PLAYS_KEY) || '[]');
    const entry = { withName, expiresAt: Date.now() + COOLDOWN_MS };
    const filtered = existing.filter(e => e.expiresAt > Date.now() && e.withName !== withName);
    localStorage.setItem(RECENT_PLAYS_KEY, JSON.stringify([entry, ...filtered].slice(0, 10)));
  } catch {
    // ignore
  }
}

function DinoDisplay({ player }) {
  const dino = player?.dinos?.find(d => d.is_partner && d.tamed);
  const name = dino?.name || dino?.species || 'Your Dino';

  return (
    <div style={styles.dinoBox}>
      <Footprints size={52} style={styles.dinoIcon} />
      <div style={styles.dinoName}>{name}</div>
      {dino && (
        <div style={styles.dinoLevel}>Lv{dino.level || 1}</div>
      )}
    </div>
  );
}

export function PlayTrivia({ code }) {
  const { player } = useStore();

  const [trivia, setTrivia] = useState(store.lobbyTrivia || null);
  const [answered, setAnswered] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [partnerName, setPartnerName] = useState('');

  useEffect(() => {
    ws.subscribe(`lobby:${code}`);

    const offTrivia = ws.on(`lobby:${code}`, 'trivia_start', (data) => {
      setTrivia({
        question: data.question,
        options: data.options,
      });
    });

    const offResult = ws.on(`lobby:${code}`, 'trivia_result', (data) => {
      setResult(data);
      setAnswered(true);
    });

    return () => {
      offTrivia();
      offResult();
    };
  }, [code]);

  async function handleAnswer(index) {
    if (answered || busy) return;
    setSelectedAnswer(index);
    setBusy(true);
    setError('');
    try {
      const data = await api.answerTrivia(store.playerId, code, index);
      setResult(data);
      setAnswered(true);
      saveCooldown(partnerName || 'A tamer');
      await store.refresh();
    } catch (err) {
      setError(err.message || 'Something went wrong');
      setSelectedAnswer(null);
    }
    setBusy(false);
  }

  function handleBackToPlaza() {
    store.lobbyRole = null;
    store.lobbyTrivia = null;
    store.navigate('/play');
  }

  if (!trivia) {
    return (
      <div style={styles.page}>
        <div style={styles.loadingBox}>
          <Footprints size={48} color="#86efac" style={{ marginBottom: '12px' }} />
          <p style={{ color: '#86efac' }}>Waiting for trivia question...</p>
          <button onClick={handleBackToPlaza} style={styles.ghostBtn}>
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.topHalf}>
        <div style={styles.dinosRow}>
          <DinoDisplay player={player} />
          <div style={styles.vsText}>VS</div>
          <div style={styles.dinoBox}>
            <Footprints size={52} style={styles.dinoIcon} />
            <div style={styles.dinoName}>Partner</div>
            <div style={styles.dinoLevel}>Friend</div>
          </div>
        </div>
        <div style={styles.playingLabel}>Playing Together!</div>
        <style>{hopAnimation}</style>
      </div>

      <div style={styles.bottomHalf}>
        {!answered ? (
          <>
            <div style={styles.questionBox}>
              <div style={styles.questionLabel}>Dino Trivia</div>
              <div style={styles.questionText}>{trivia.question}</div>
            </div>

            <div style={styles.answersGrid}>
              {(trivia.options || []).map((option, i) => (
                <button
                  key={i}
                  onClick={() => handleAnswer(i)}
                  disabled={busy}
                  style={{
                    ...styles.answerBtn,
                    opacity: busy ? 0.6 : 1,
                    background: selectedAnswer === i ? '#1e3a5f' : '#111827',
                    borderColor: selectedAnswer === i ? '#60a5fa' : '#374151',
                  }}
                >
                  <span style={styles.answerLetter}>{String.fromCharCode(65 + i)}</span>
                  <span style={styles.answerText}>{option}</span>
                </button>
              ))}
            </div>

            {error && <div style={styles.errorMsg}>{error}</div>}
          </>
        ) : (
          <div style={styles.resultsBox}>
            <div style={{
              ...styles.resultBanner,
              background: result?.correct ? '#0f2a1a' : '#2a0f0f',
              borderColor: result?.correct ? '#4ade80' : '#ef4444',
            }}>
              <div style={styles.resultIcon}>
                {result?.correct
                  ? <CheckCircle2 size={40} color="#4ade80" />
                  : <XCircle size={40} color="#ef4444" />
                }
              </div>
              <div style={{
                ...styles.resultLabel,
                color: result?.correct ? '#4ade80' : '#ef4444',
              }}>
                {result?.correct ? 'Correct!' : 'Incorrect!'}
              </div>
              {!result?.correct && trivia.options && result?.correct_index !== undefined && (
                <div style={styles.correctAnswerText}>
                  Answer: {trivia.options[result.correct_index]}
                </div>
              )}
            </div>

            <div style={styles.rewardsCard}>
              <div style={styles.rewardsTitle}>Rewards</div>
              <div style={styles.rewardRow}>
                <Zap size={20} color="#f59e0b" style={{ flexShrink: 0 }} />
                <span style={styles.rewardText}>
                  +{result?.xp_awarded || 0} XP to your partner dino!
                </span>
              </div>
              {result?.hat && (
                <div style={styles.rewardRow}>
                  <Crown size={20} color="#f59e0b" style={{ flexShrink: 0 }} />
                  <span style={styles.rewardText}>
                    New hat: <strong style={{ color: '#f59e0b' }}>{result.hat}</strong>
                  </span>
                </div>
              )}
              {!result?.hat && (
                <div style={{ ...styles.rewardRow, opacity: 0.5 }}>
                  <Crown size={20} color="#f59e0b" style={{ flexShrink: 0 }} />
                  <span style={styles.rewardText}>No hat this time</span>
                </div>
              )}

              {player?.dinos?.find(d => d.is_partner && d.tamed) && (() => {
                const dino = player.dinos.find(d => d.is_partner && d.tamed);
                const lvl = dino.level || 1;
                const xp = dino.xp || 0;
                const pct = lvl >= 5 ? 100 : Math.min(100, Math.round(((xp % 100) / 100) * 100));
                return (
                  <div style={styles.xpSection}>
                    <div style={styles.xpLabel}>
                      {dino.name || dino.species} · Lv{lvl}{lvl >= 5 ? ' (MAX)' : ''}
                    </div>
                    <div style={styles.xpBarBg}>
                      <div style={{ ...styles.xpBarFill, width: `${pct}%` }} />
                    </div>
                    <div style={styles.xpNum}>{xp} XP</div>
                  </div>
                );
              })()}
            </div>

            <button onClick={handleBackToPlaza} style={styles.backBtn}>
              Back to Play Menu
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const hopAnimation = `
@keyframes hop {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-12px); }
}
`;

const styles = {
  page: {
    display: 'flex', flexDirection: 'column', minHeight: '100dvh',
    background: '#0a0f0a',
  },
  loadingBox: {
    flex: 1, display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', gap: '12px', padding: '40px',
  },
  topHalf: {
    background: '#0f2a1a', borderBottom: '2px solid #166534',
    padding: '24px 16px 16px', display: 'flex',
    flexDirection: 'column', alignItems: 'center', gap: '10px',
    flex: '0 0 auto',
  },
  dinosRow: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    gap: '20px', width: '100%',
  },
  dinoBox: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
  },
  dinoIcon: {
    color: '#4ade80',
    animation: 'hop 1s infinite ease-in-out',
  },
  dinoName: { color: '#86efac', fontSize: '12px', fontWeight: 'bold' },
  dinoLevel: { color: '#4ade80', fontSize: '11px' },
  vsText: { color: '#f59e0b', fontSize: '20px', fontWeight: 'bold', flexShrink: 0 },
  playingLabel: {
    color: '#4ade80', fontSize: '13px', fontWeight: 'bold',
    textTransform: 'uppercase', letterSpacing: '1px',
  },
  bottomHalf: {
    flex: 1, display: 'flex', flexDirection: 'column',
    gap: '14px', padding: '16px 16px 80px', overflow: 'auto',
  },
  questionBox: {
    background: '#111827', border: '1px solid #1f2937', borderRadius: '14px',
    padding: '18px',
  },
  questionLabel: {
    color: '#6b7280', fontSize: '11px', fontWeight: 'bold',
    textTransform: 'uppercase', marginBottom: '8px',
  },
  questionText: { color: '#f3f4f6', fontSize: '16px', lineHeight: 1.5 },
  answersGrid: {
    display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px',
  },
  answerBtn: {
    display: 'flex', alignItems: 'center', gap: '10px',
    padding: '14px 12px', borderRadius: '10px', border: '2px solid',
    cursor: 'pointer', textAlign: 'left', transition: 'background 0.1s',
  },
  answerLetter: {
    width: '24px', height: '24px', borderRadius: '50%',
    background: '#374151', color: '#e0e0e0', display: 'flex',
    alignItems: 'center', justifyContent: 'center',
    fontSize: '12px', fontWeight: 'bold', flexShrink: 0,
  },
  answerText: { color: '#e0e0e0', fontSize: '13px', lineHeight: 1.3 },
  errorMsg: {
    background: '#1c0a0a', border: '1px solid #7f1d1d', borderRadius: '8px',
    color: '#ef4444', padding: '12px', fontSize: '13px', textAlign: 'center',
  },
  resultsBox: {
    display: 'flex', flexDirection: 'column', gap: '14px',
  },
  resultBanner: {
    borderRadius: '14px', border: '2px solid',
    padding: '20px', textAlign: 'center',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px',
  },
  resultIcon: { lineHeight: 1 },
  resultLabel: { fontSize: '22px', fontWeight: 'bold' },
  correctAnswerText: { color: '#9ca3af', fontSize: '13px', marginTop: '4px' },
  rewardsCard: {
    background: '#111827', border: '1px solid #1f2937', borderRadius: '14px',
    padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px',
  },
  rewardsTitle: {
    color: '#9ca3af', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase',
  },
  rewardRow: { display: 'flex', alignItems: 'center', gap: '10px' },
  rewardText: { color: '#e0e0e0', fontSize: '14px' },
  xpSection: {
    borderTop: '1px solid #1f2937', paddingTop: '10px',
    display: 'flex', flexDirection: 'column', gap: '6px',
  },
  xpLabel: { color: '#86efac', fontSize: '13px' },
  xpBarBg: { height: '8px', background: '#1f2937', borderRadius: '4px', overflow: 'hidden' },
  xpBarFill: { height: '100%', background: '#4ade80', borderRadius: '4px', transition: 'width 0.4s' },
  xpNum: { color: '#6b7280', fontSize: '11px', textAlign: 'right' },
  backBtn: {
    padding: '14px', borderRadius: '10px', border: 'none',
    background: '#166534', color: '#4ade80', fontSize: '15px',
    fontWeight: 'bold', cursor: 'pointer', width: '100%',
  },
  ghostBtn: {
    padding: '12px', borderRadius: '10px', border: '1px solid #333',
    background: 'none', color: '#aaa', fontSize: '14px',
    cursor: 'pointer', width: '100%',
  },
};
