import { useState, useEffect, useRef } from 'preact/hooks';
import meatImg from '../assets/items/meat.png';
import berryImg from '../assets/items/berry.png';

const FOOD_IMGS = { meat: meatImg, mejoberries: berryImg };
const FOOD_LABELS = { meat: 'Meat', mejoberries: 'Mejoberries' };
const TIMING_ROUNDS = 6;
const ROUND_MS = 1500;
const WHACK_MS = 10000;
const SPAWN_MS = 700;
const MAX_ON_SCREEN = 4;

function computeXp(perfects, goods) {
  const raw = goods + perfects * 2;
  return 3 + Math.min(6, Math.floor(raw / 2));
}

// ── Ready Screen ──────────────────────────────────────────────────────────────

function ReadyScreen({ foodType, countdown, theme }) {
  const isMeat = foodType === 'meat';
  return (
    <div style={{ ...styles.page, background: theme.bg }}>
      <div style={{ ...styles.tagline, color: theme.accent }}>{theme.title}</div>
      <img src={FOOD_IMGS[foodType]} style={styles.bigIcon} />
      <div style={styles.instruction}>
        {isMeat ? 'Tap when the ring hits the centre!' : 'Tap the berries before they vanish!'}
      </div>
      <div style={{ fontSize: '11px', color: '#6b7280' }}>
        {isMeat ? `${TIMING_ROUNDS} rounds` : '10 seconds'}
      </div>
      <div style={{ fontSize: '48px', fontWeight: '900', color: theme.accentAlt, marginTop: '12px' }}>
        {countdown > 0 ? countdown : 'GO!'}
      </div>
    </div>
  );
}

// ── Timing Tap Game ───────────────────────────────────────────────────────────
// Outer ring shrinks inward over ROUND_MS. t = elapsed/ROUND_MS (0→1).
// t >= 0.7 → PERFECT, t >= 0.4 → GOOD, else MISS.
// Ring freezes on tap so the player can see where they landed.

function TimingTapGame({ foodType, theme, onFinish }) {
  const [displayRound, setDisplayRound] = useState(1);
  const [animKey, setAnimKey] = useState(0);
  const [feedback, setFeedback] = useState(null);
  const [dots, setDots] = useState([]);
  const [frozen, setFrozen] = useState(false);
  const [tapEffect, setTapEffect] = useState(null); // { color, key }

  const roundStartRef = useRef(null);
  const tappedRef = useRef(false);
  const timerRef = useRef(null);
  const perfectRef = useRef(0);
  const goodRef = useRef(0);
  const roundRef = useRef(0);

  // pts: 0=miss, 1=good, 2=perfect. fromTap: true if player tapped (not timer miss).
  function resolveRound(label, pts, fromTap) {
    if (tappedRef.current) return;
    tappedRef.current = true;
    clearTimeout(timerRef.current);

    if (pts === 2) perfectRef.current++;
    else if (pts === 1) goodRef.current++;

    setFeedback(label);
    setDots(d => [...d, pts === 2 ? 'perfect' : pts === 1 ? 'good' : 'miss']);

    if (fromTap) {
      setFrozen(true);
      setTapEffect({
        color: pts === 2 ? '#fbbf24' : pts === 1 ? '#4ade80' : '#ef4444',
        key: Date.now(),
      });
    }

    const next = roundRef.current + 1;
    roundRef.current = next;
    setDisplayRound(Math.min(next + 1, TIMING_ROUNDS));

    if (next >= TIMING_ROUNDS) {
      setTimeout(() => onFinish(perfectRef.current, goodRef.current, TIMING_ROUNDS), 700);
    } else {
      setTimeout(() => startRound(), 700);
    }
  }

  function startRound() {
    tappedRef.current = false;
    roundStartRef.current = performance.now();
    setAnimKey(k => k + 1);
    setFeedback(null);
    setFrozen(false);
    setTapEffect(null);
    timerRef.current = setTimeout(() => resolveRound('MISS', 0, false), ROUND_MS + 50);
  }

  function handleTap() {
    const elapsed = performance.now() - (roundStartRef.current || 0);
    const t = Math.min(elapsed / ROUND_MS, 1);
    if (t >= 0.7) resolveRound('PERFECT ✦', 2, true);
    else if (t >= 0.4) resolveRound('GOOD', 1, true);
    else resolveRound('MISS', 0, true);
  }

  useEffect(() => {
    startRound();
    return () => clearTimeout(timerRef.current);
  }, []);

  return (
    <div style={{ ...styles.page, background: theme.bg, userSelect: 'none' }} onClick={handleTap}>
      <style>{`
        @keyframes shrinkRing {
          from { transform: scale(1); opacity: 1; }
          to   { transform: scale(0.02); opacity: 0; }
        }
        @keyframes tapFlash {
          0%   { opacity: 0.5; transform: scale(0.9); }
          100% { opacity: 0; transform: scale(1.3); }
        }
      `}</style>

      <div style={styles.roundRow}>
        <span style={{ color: '#9ca3af', fontSize: '11px' }}>
          Round {displayRound} / {TIMING_ROUNDS}
        </span>
        <div style={{ display: 'flex', gap: '4px' }}>
          {Array.from({ length: TIMING_ROUNDS }).map((_, i) => {
            const d = dots[i];
            const color = d === 'perfect' ? theme.accentAlt
              : d === 'good' ? '#4ade80'
              : '#374151';
            return <span key={i} style={{ color, fontSize: '14px' }}>{d ? '●' : '○'}</span>;
          })}
        </div>
      </div>

      {/* Ring arena */}
      <div style={styles.ringContainer}>
        {/* Static outer reference ring */}
        <div style={styles.ringOuter} />
        {/* GOOD zone band (t=0.4–0.7) */}
        <div style={styles.zoneGood} />
        {/* PERFECT zone (t=0.7–1.0) */}
        <div style={styles.zonePerfect} />
        {/* Animated shrinking ring */}
        <div
          key={animKey}
          style={{
            position: 'absolute', inset: 0,
            borderRadius: '50%',
            border: `4px solid ${theme.accentAlt}`,
            boxShadow: `0 0 14px ${theme.accentAlt}88`,
            animation: `shrinkRing ${ROUND_MS}ms linear forwards`,
            animationPlayState: frozen ? 'paused' : 'running',
          }}
        />
        {/* Tap flash glow */}
        {tapEffect && (
          <div
            key={tapEffect.key}
            style={{
              position: 'absolute', inset: '-20px',
              borderRadius: '50%',
              background: `radial-gradient(circle, ${tapEffect.color}60 0%, transparent 70%)`,
              animation: 'tapFlash 300ms ease-out forwards',
              pointerEvents: 'none',
            }}
          />
        )}
        {/* Food icon in centre */}
        <img src={FOOD_IMGS[foodType]} style={styles.ringIcon} />
      </div>

      <div style={{ fontSize: '11px', color: '#4ade80', fontWeight: 'bold', letterSpacing: '1px' }}>
        TAP!
      </div>

      <div style={{ height: '24px', display: 'flex', alignItems: 'center' }}>
        {feedback && (
          <span style={{
            fontSize: '15px', fontWeight: 'bold',
            color: feedback.includes('PERFECT') ? theme.accentAlt
              : feedback === 'GOOD' ? '#4ade80'
              : '#4b5563',
          }}>
            {feedback}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Whack-a-Food Game ─────────────────────────────────────────────────────────
// Items pop in with a bounce, fade out when expiring, and burst on tap.

function WhackAFoodGame({ foodType, theme, onFinish }) {
  const [items, setItems] = useState([]);
  const [bursts, setBursts] = useState([]);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(WHACK_MS);

  const scoreRef = useRef(0);
  const totalRef = useRef(0);
  const nextIdRef = useRef(0);
  const burstIdRef = useRef(0);
  const doneRef = useRef(false);

  function spawnItem() {
    if (doneRef.current) return;
    const life = 1000 + Math.random() * 400;
    const id = nextIdRef.current++;
    const item = {
      id,
      left: 5 + Math.random() * 70,
      top: 5 + Math.random() * 75,
      life,
      state: 'active',
    };
    setItems(prev => {
      if (prev.length >= MAX_ON_SCREEN) return prev;
      totalRef.current++;
      return [...prev, item];
    });
    // Start expire-out animation, then remove
    setTimeout(() => {
      setItems(prev => prev.map(i => i.id === id ? { ...i, state: 'expiring' } : i));
      setTimeout(() => {
        setItems(prev => prev.filter(i => i.id !== id));
      }, 200);
    }, life);
  }

  function tapItem(e, id) {
    e.stopPropagation();
    // Spawn burst at berry position
    const tapped = items.find(i => i.id === id);
    if (tapped) {
      const bid = burstIdRef.current++;
      setBursts(b => [...b, { id: bid, left: tapped.left, top: tapped.top }]);
      setTimeout(() => setBursts(b => b.filter(x => x.id !== bid)), 350);
    }
    scoreRef.current++;
    setScore(scoreRef.current);
    setItems(prev => prev.filter(i => i.id !== id));
  }

  useEffect(() => {
    const start = Date.now();

    const timerInterval = setInterval(() => {
      const remaining = WHACK_MS - (Date.now() - start);
      setTimeLeft(Math.max(0, remaining));
      if (remaining <= 0) {
        clearInterval(timerInterval);
        doneRef.current = true;
        onFinish(0, scoreRef.current, totalRef.current);
      }
    }, 100);

    const spawnInterval = setInterval(() => {
      if (!doneRef.current) spawnItem();
    }, SPAWN_MS);

    spawnItem();

    return () => {
      clearInterval(timerInterval);
      clearInterval(spawnInterval);
    };
  }, []);

  const timerFraction = timeLeft / WHACK_MS;

  return (
    <div style={{ ...styles.page, background: theme.bg }}>
      <style>{`
        @keyframes berrySpawn {
          from { transform: scale(0) rotate(-20deg); opacity: 0; }
          to   { transform: scale(1) rotate(0deg); opacity: 1; }
        }
        @keyframes berryExpire {
          from { transform: scale(1); opacity: 1; }
          to   { transform: scale(0.3); opacity: 0; }
        }
        @keyframes berryBurst {
          0%   { transform: translate(-50%, -50%) scale(0.5); opacity: 0.7; }
          100% { transform: translate(-50%, -50%) scale(2.2); opacity: 0; }
        }
      `}</style>

      <div style={styles.roundRow}>
        <span style={{ color: theme.accent, fontWeight: 'bold', fontSize: '13px' }}>
          Score: {score}
        </span>
        <div style={styles.timerTrack}>
          <div style={{
            ...styles.timerBar,
            width: `${timerFraction * 100}%`,
            background: theme.accent,
          }} />
        </div>
      </div>

      <div style={styles.playArea}>
        {items.map(item => (
          <img
            key={item.id}
            src={FOOD_IMGS[foodType]}
            onClick={e => tapItem(e, item.id)}
            style={{
              position: 'absolute',
              left: `${item.left}%`,
              top: `${item.top}%`,
              width: '44px',
              height: '44px',
              imageRendering: 'pixelated',
              cursor: 'pointer',
              filter: `drop-shadow(0 0 6px ${theme.accent})`,
              touchAction: 'manipulation',
              pointerEvents: item.state === 'expiring' ? 'none' : 'auto',
              animation: item.state === 'expiring'
                ? 'berryExpire 200ms ease-in forwards'
                : 'berrySpawn 200ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
            }}
          />
        ))}
        {bursts.map(b => (
          <div
            key={b.id}
            style={{
              position: 'absolute',
              left: `calc(${b.left}% + 22px)`,
              top: `calc(${b.top}% + 22px)`,
              width: '44px', height: '44px',
              borderRadius: '50%',
              background: `radial-gradient(circle, ${theme.accent}70 0%, transparent 70%)`,
              animation: 'berryBurst 350ms ease-out forwards',
              pointerEvents: 'none',
            }}
          />
        ))}
      </div>

      <div style={{ color: '#6b7280', fontSize: '11px' }}>
        {Math.ceil(timeLeft / 1000)}s left
      </div>
    </div>
  );
}

// ── Results Screen ────────────────────────────────────────────────────────────

function ResultsScreen({ score, total, foodType, xpEarned, apiResult, onComplete, theme }) {
  const canTame = apiResult && !apiResult.harvest_only && !apiResult.already_tamed;
  const scoreLabel = foodType === 'meat' ? 'catches' : 'berries collected';
  const label = FOOD_LABELS[foodType] || foodType;

  return (
    <div style={{ ...styles.page, background: theme.bg }}>
      <div style={{ ...styles.tagline, color: theme.accent }}>{theme.label}</div>

      {/* Food obtained */}
      <img src={FOOD_IMGS[foodType]} style={{ width: '64px', height: '64px', imageRendering: 'pixelated', margin: '4px 0' }} />
      <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#e5e7eb', textAlign: 'center' }}>
        You obtained {label}!
      </div>
      <div style={{ fontSize: '12px', color: '#6b7280', margin: '-6px 0 4px' }}>
        Added to your inventory
      </div>

      {/* Score */}
      <div style={{ fontSize: '32px', fontWeight: '900', color: theme.text }}>
        {score} / {total || '?'}
      </div>
      <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>{scoreLabel}</div>

      {/* XP box */}
      <div style={{ ...styles.xpBox, borderColor: `${theme.accent}40` }}>
        <div style={styles.xpRow}>
          <span style={{ color: '#9ca3af' }}>XP Earned</span>
          <span style={{ color: '#f59e0b', fontWeight: 'bold' }}>+{xpEarned} XP</span>
        </div>
      </div>

      {/* Action button */}
      {!apiResult ? (
        <div style={{ color: '#6b7280', fontSize: '13px' }}>Calculating reward...</div>
      ) : canTame ? (
        <button onClick={onComplete} style={styles.primaryBtn}>Feed a Dino!</button>
      ) : (
        <button onClick={onComplete} style={styles.secondaryBtn}>Back to Plaza</button>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function HarvestMinigame({ foodType, apiResult, onGameEnd, onComplete }) {
  const [phase, setPhase] = useState('ready');
  const [countdown, setCountdown] = useState(3);
  const [score, setScore] = useState(0);
  const [total, setTotal] = useState(0);
  const [xpEarned, setXpEarned] = useState(5);

  const isMeat = foodType === 'meat';
  const theme = isMeat
    ? { bg: '#1a1008', accent: '#f87171', accentAlt: '#fbbf24', text: '#fef3c7', title: 'HUNTING TIME',   label: 'HUNT COMPLETE'   }
    : { bg: '#1a1035', accent: '#a78bfa', accentAlt: '#a78bfa', text: '#ede9fe', title: 'FORAGING TIME', label: 'FORAGE COMPLETE' };

  useEffect(() => {
    if (phase !== 'ready') return;
    const interval = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) {
          clearInterval(interval);
          setTimeout(() => setPhase('playing'), 400);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [phase]);

  function handleGameFinish(perfects, goods, total) {
    setScore(perfects + goods);
    setTotal(total);
    setXpEarned(computeXp(perfects, goods));
    setPhase('results');
    if (onGameEnd) onGameEnd(perfects, goods);
  }

  if (phase === 'ready') {
    return <ReadyScreen foodType={foodType} countdown={countdown} theme={theme} />;
  }
  if (phase === 'playing') {
    return isMeat
      ? <TimingTapGame foodType={foodType} theme={theme} onFinish={handleGameFinish} />
      : <WhackAFoodGame foodType={foodType} theme={theme} onFinish={handleGameFinish} />;
  }
  return (
    <ResultsScreen
      score={score}
      total={total}
      foodType={foodType}
      xpEarned={xpEarned}
      apiResult={apiResult}
      onComplete={onComplete}
      theme={theme}
    />
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = {
  page: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    padding: '32px 20px 80px', gap: '14px', minHeight: '100vh',
  },
  tagline: {
    fontSize: '11px', fontWeight: '900', letterSpacing: '3px', textAlign: 'center',
  },
  bigIcon: {
    width: '80px', height: '80px', imageRendering: 'pixelated', margin: '8px 0',
  },
  instruction: {
    fontSize: '16px', fontWeight: 'bold', color: '#e5e7eb', textAlign: 'center', maxWidth: '260px',
  },
  roundRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    width: '100%', maxWidth: '300px',
  },
  // Ring layout for Timing Tap
  ringContainer: {
    position: 'relative', width: '140px', height: '140px',
  },
  ringOuter: {
    position: 'absolute', inset: 0, borderRadius: '50%',
    border: '3px solid #374151',
  },
  // GOOD zone: t=0.4–0.7 → scale 0.6–0.3 → inset 28px–49px
  zoneGood: {
    position: 'absolute', inset: '28px', borderRadius: '50%',
    background: '#22c55e18', border: '1px solid #22c55e40',
  },
  // PERFECT zone: t=0.7–1.0 → scale 0.3–0 → inset 49px–center
  zonePerfect: {
    position: 'absolute', inset: '49px', borderRadius: '50%',
    background: '#fbbf2425', border: '1px solid #fbbf2450',
  },
  ringIcon: {
    position: 'absolute', width: '44px', height: '44px',
    imageRendering: 'pixelated', zIndex: 1,
    top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
  },
  // Timer bar for Whack-a-Food
  timerTrack: {
    width: '100px', height: '8px', background: '#1e293b',
    borderRadius: '4px', overflow: 'hidden',
  },
  timerBar: {
    height: '100%', borderRadius: '4px', transition: 'width 0.1s linear',
  },
  playArea: {
    position: 'relative', width: '100%', maxWidth: '340px', height: '200px',
    background: '#0f0a20', borderRadius: '12px', overflow: 'hidden',
  },
  // Results
  xpBox: {
    background: '#111827', border: '1px solid', borderRadius: '12px',
    padding: '12px 18px', width: '100%', maxWidth: '300px',
  },
  xpRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '14px',
  },
  primaryBtn: {
    padding: '16px', borderRadius: '12px', border: 'none',
    background: '#22c55e', color: 'white', fontSize: '16px',
    fontWeight: 'bold', cursor: 'pointer', width: '100%', maxWidth: '300px',
  },
  secondaryBtn: {
    padding: '14px', borderRadius: '10px', border: 'none',
    background: '#6366f1', color: 'white', fontSize: '16px',
    fontWeight: 'bold', cursor: 'pointer', width: '100%', maxWidth: '300px',
  },
};
