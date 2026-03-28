import { useEffect, useRef, useState } from 'preact/hooks';
import { api } from '../api.js';
import { store } from '../store.js';
import { useStore } from '../router.jsx';
import { Skull, Zap } from 'lucide-preact';

const TAP_THROTTLE_MS = 333; // ~3 taps/sec

/**
 * BossFight — full-screen tap-to-attack boss fight screen.
 * Shows Godzilla, HP bar, player damage stat, and floating damage numbers.
 */
export function BossFight() {
  const { bossState, player, playerId } = useStore();
  const [localHp, setLocalHp] = useState(null);
  const [maxHp, setMaxHp] = useState(null);
  const [damageNumbers, setDamageNumbers] = useState([]);
  const [shaking, setShaking] = useState(false);
  const lastTapRef = useRef(0);
  const idCounter = useRef(0);

  // Sync HP from store
  useEffect(() => {
    if (bossState) {
      setLocalHp(bossState.hp ?? null);
      setMaxHp(bossState.max_hp ?? bossState.maxHp ?? null);
    }
  }, [bossState]);

  // Navigate to victory when boss is defeated
  useEffect(() => {
    if (bossState?.status === 'defeated') {
      setTimeout(() => store.navigate('/boss/victory'), 800);
    }
  }, [bossState?.status]);

  const handleTap = async (e) => {
    const now = Date.now();
    if (now - lastTapRef.current < TAP_THROTTLE_MS) return;
    lastTapRef.current = now;

    if (!playerId) return;

    // Get tap coordinates for floating number
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX || e.touches?.[0]?.clientX || rect.width / 2) - rect.left;
    const y = (e.clientY || e.touches?.[0]?.clientY || rect.height / 2) - rect.top;

    try {
      const result = await api.bossTap(playerId);
      const dmg = result.damage ?? 0;
      const newHp = result.hp ?? 0;

      // Update local HP immediately
      setLocalHp(newHp);

      // Spawn floating damage number
      const id = ++idCounter.current;
      setDamageNumbers(prev => [...prev, { id, dmg, x, y }]);
      setTimeout(() => {
        setDamageNumbers(prev => prev.filter(n => n.id !== id));
      }, 1200);

      // Screen shake on big hits (>= 20 damage)
      if (dmg >= 20) {
        setShaking(true);
        setTimeout(() => setShaking(false), 400);
      }
    } catch {
      // Tap failed (throttled by server or fight over), ignore
    }
  };

  const hp = localHp ?? bossState?.hp ?? 0;
  const max = maxHp ?? bossState?.max_hp ?? bossState?.maxHp ?? 1;
  const hpPct = Math.max(0, Math.min(100, (hp / max) * 100));

  const playerDinos = player?.dinos?.filter(d => d.tamed) ?? [];
  const totalLevels = playerDinos.reduce((sum, d) => sum + (d.level || 1), 0);
  const playerDamage = 5 + totalLevels;

  const isDefeated = hp <= 0 || bossState?.status === 'defeated';

  return (
    <div
      style={{ ...styles.container, ...(shaking ? styles.shake : {}) }}
      onClick={!isDefeated ? handleTap : undefined}
      onTouchStart={!isDefeated ? handleTap : undefined}
    >
      <style>{`
        @keyframes bossShake {
          0%   { transform: translate(0, 0); }
          20%  { transform: translate(-6px, -4px); }
          40%  { transform: translate(6px, 4px); }
          60%  { transform: translate(-6px, 4px); }
          80%  { transform: translate(6px, -4px); }
          100% { transform: translate(0, 0); }
        }
        @keyframes floatUp {
          0%   { opacity: 1; transform: translateY(0) scale(1); }
          50%  { opacity: 1; transform: translateY(-40px) scale(1.2); }
          100% { opacity: 0; transform: translateY(-80px) scale(0.8); }
        }
        @keyframes hpBarPulse {
          0%   { filter: brightness(1); }
          50%  { filter: brightness(1.3); }
          100% { filter: brightness(1); }
        }
        .boss-shake { animation: bossShake 0.4s ease-out; }
        .dmg-float  { animation: floatUp 1.2s ease-out forwards; position: absolute; pointer-events: none; }
        .hp-pulse   { animation: hpBarPulse 0.5s ease-in-out; }
      `}</style>

      {/* Header */}
      <div style={styles.header}>
        <div style={styles.bossTitle}>GODZILLA ATTACKS!</div>
        <div style={styles.bossSubtitle}>Tap anywhere to fight back!</div>
      </div>

      {/* Boss sprite */}
      <div style={styles.bossWrapper}>
        <div style={styles.bossEmoji} class={shaking ? 'boss-shake' : ''}>
          {isDefeated
            ? <Skull style={{ width: 'clamp(80px, 25vw, 160px)', height: 'clamp(80px, 25vw, 160px)', color: '#4ade80' }} />
            : <Zap style={{ width: 'clamp(80px, 25vw, 160px)', height: 'clamp(80px, 25vw, 160px)', color: '#ef4444' }} />
          }
        </div>
      </div>

      {/* HP Bar */}
      <div style={styles.hpSection}>
        <div style={styles.hpLabel}>
          <span>GODZILLA HP</span>
          <span style={{ color: hpPct < 25 ? '#f87171' : '#4ade80' }}>
            {hp} / {max}
          </span>
        </div>
        <div style={styles.hpBarBg}>
          <div
            style={{
              ...styles.hpBarFill,
              width: `${hpPct}%`,
              background: hpPct < 25
                ? 'linear-gradient(90deg, #ef4444, #f87171)'
                : hpPct < 50
                  ? 'linear-gradient(90deg, #f59e0b, #fbbf24)'
                  : 'linear-gradient(90deg, #16a34a, #4ade80)',
            }}
          />
        </div>
      </div>

      {/* Player stats */}
      <div style={styles.statsRow}>
        <div style={styles.statBox}>
          <div style={styles.statValue}>{playerDamage}</div>
          <div style={styles.statLabel}>Your DMG/tap</div>
        </div>
        <div style={styles.statBox}>
          <div style={styles.statValue}>{playerDinos.length}</div>
          <div style={styles.statLabel}>Tamed Dinos</div>
        </div>
        <div style={styles.statBox}>
          <div style={styles.statValue}>{totalLevels}</div>
          <div style={styles.statLabel}>Total Levels</div>
        </div>
      </div>

      {/* Tap hint */}
      {!isDefeated && (
        <div style={styles.tapHint}>
          TAP TO ATTACK!
        </div>
      )}

      {/* Defeated overlay */}
      {isDefeated && (
        <div style={styles.defeatedOverlay}>
          <div style={styles.defeatedText}>DEFEATED!</div>
        </div>
      )}

      {/* Floating damage numbers */}
      {damageNumbers.map(({ id, dmg, x, y }) => (
        <div
          key={id}
          class="dmg-float"
          style={{
            left: x,
            top: y,
            fontSize: dmg >= 20 ? '32px' : '24px',
            fontWeight: 'bold',
            color: dmg >= 20 ? '#ffdd00' : '#ffffff',
            textShadow: '0 0 8px rgba(0,0,0,0.8)',
            zIndex: 100,
          }}
        >
          -{dmg}
        </div>
      ))}
    </div>
  );
}

const styles = {
  container: {
    position: 'relative',
    width: '100%',
    minHeight: '100dvh',
    background: 'radial-gradient(ellipse at center, #1a0505 0%, #0d0d0d 100%)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '20px 16px 100px',
    boxSizing: 'border-box',
    userSelect: 'none',
    WebkitUserSelect: 'none',
    cursor: 'crosshair',
    overflowX: 'hidden',
  },
  shake: {
    animation: 'bossShake 0.4s ease-out',
  },
  header: {
    textAlign: 'center',
    marginBottom: '8px',
  },
  bossTitle: {
    fontSize: '28px',
    fontWeight: '900',
    color: '#f87171',
    textShadow: '0 0 20px rgba(248,113,113,0.6)',
    letterSpacing: '2px',
  },
  bossSubtitle: {
    fontSize: '14px',
    color: '#fca5a5',
    marginTop: '4px',
  },
  bossWrapper: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    minHeight: '200px',
  },
  bossEmoji: {
    lineHeight: 1,
    filter: 'drop-shadow(0 0 30px rgba(255,50,50,0.6))',
    transition: 'filter 0.2s',
  },
  hpSection: {
    width: '100%',
    maxWidth: '400px',
    marginBottom: '16px',
  },
  hpLabel: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '13px',
    fontWeight: 'bold',
    color: '#d1d5db',
    marginBottom: '6px',
  },
  hpBarBg: {
    width: '100%',
    height: '20px',
    background: 'rgba(255,255,255,0.1)',
    borderRadius: '10px',
    overflow: 'hidden',
    border: '1px solid rgba(255,255,255,0.15)',
  },
  hpBarFill: {
    height: '100%',
    borderRadius: '10px',
    transition: 'width 0.4s ease-out',
  },
  statsRow: {
    display: 'flex',
    gap: '12px',
    marginBottom: '20px',
  },
  statBox: {
    background: 'rgba(255,255,255,0.07)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: '10px',
    padding: '10px 16px',
    textAlign: 'center',
    minWidth: '80px',
  },
  statValue: {
    fontSize: '22px',
    fontWeight: 'bold',
    color: '#facc15',
  },
  statLabel: {
    fontSize: '11px',
    color: '#9ca3af',
    marginTop: '2px',
  },
  tapHint: {
    fontSize: '18px',
    fontWeight: 'bold',
    color: 'rgba(255,255,255,0.3)',
    letterSpacing: '3px',
    animation: 'hpBarPulse 1.5s ease-in-out infinite',
  },
  defeatedOverlay: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(0,0,0,0.7)',
    zIndex: 50,
  },
  defeatedText: {
    fontSize: 'clamp(48px, 15vw, 80px)',
    fontWeight: '900',
    color: '#4ade80',
    textShadow: '0 0 40px rgba(74,222,128,0.7)',
    letterSpacing: '4px',
  },
};
